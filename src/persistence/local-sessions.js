import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { closedRecord } from '../contracts/http-results.js';
import { TransactionRejection } from './transactions.js';

/** @typedef {import('./transactions.js').Transaction} Transaction */
/** @typedef {ReturnType<typeof import('./transactions.js').createTransactionBoundary>} Boundary */
/** @typedef {{wall:number,tick:number}} Stamp */
/** @typedef {{kind:string,code?:string,secret?:string,actorRef?:string,workspaceRef?:string,revisionRef?:string}} Result */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digestPattern=/^[0-9a-f]{64}$/;
const minute=60000,idle=30*minute,absolute=8*60*minute;

export const localSessionStatements=Object.freeze({
  local_boot:`insert into dread_local.authority(workspace_id,actor_id,revision,generation) values($1::uuid,$2::uuid,$3::uuid,$4::uuid)
    on conflict(workspace_id) do update set generation=excluded.generation,code_digest=null,code_wall=null,code_tick=null,failed_at='{}'
    where dread_local.authority.actor_id=excluded.actor_id and dread_local.authority.revision=excluded.revision returning generation::text`,
  local_lock:`select actor_id::text,revision::text,generation::text,code_digest,code_wall::text,code_tick::text,array_to_string(failed_at,',')
    from dread_local.authority where workspace_id=$1::uuid for update`,
  local_clear:'delete from dread_local.sessions where workspace_id=$1::uuid',
  local_code:'update dread_local.authority set code_digest=$2,code_wall=$3::bigint,code_tick=$4::bigint where workspace_id=$1::uuid',
  local_failures:"update dread_local.authority set failed_at=case when $2='' then '{}'::bigint[] else string_to_array($2,',')::bigint[] end where workspace_id=$1::uuid",
  local_prune:`delete from dread_local.sessions where workspace_id=$1::uuid and (generation<>$2::uuid or
    $3::bigint-created_wall>=28800000 or $4::bigint-created_tick>=28800000 or $3::bigint-active_wall>=1800000 or $4::bigint-active_tick>=1800000)`,
  local_sessions:'select digest,created_wall::text,created_tick::text,active_wall::text,active_tick::text from dread_local.sessions where workspace_id=$1::uuid and generation=$2::uuid limit 9',
  local_insert:'insert into dread_local.sessions(workspace_id,generation,digest,created_wall,created_tick,active_wall,active_tick) values($1::uuid,$2::uuid,$3,$4::bigint,$5::bigint,$4::bigint,$5::bigint)',
  local_activity:'update dread_local.sessions set active_wall=$4::bigint,active_tick=$5::bigint where workspace_id=$1::uuid and generation=$2::uuid and digest=$3',
  local_logout:'delete from dread_local.sessions where workspace_id=$1::uuid and generation=$2::uuid and digest=$3',
});

/** Canonical 32-byte base64url, with purpose separation. Never return this digest
 * to a caller, log, event or diagnostic. No user-chosen hash algorithm.
 * @param {unknown} input @param {'launch'|'session'} purpose */
function digest(input,purpose) {
  if(typeof input!=='string' || input.length!==43 || !/^[A-Za-z0-9_-]{43}$/.test(input))return null;
  const bytes=Buffer.from(input,'base64url');
  if(bytes.length!==32 || bytes.toString('base64url')!==input)return null;
  return createHash('sha256').update(purpose+':').update(bytes).digest('hex');
}
/** @param {string|null|undefined} value */
function number(value) {
  if(typeof value!=='string' || !/^(0|[1-9][0-9]{0,15})$/.test(value))throw new Error('Invalid local identity state');
  const result=Number(value);if(!Number.isSafeInteger(result))throw new Error('Invalid local identity state');return result;
}
/** @param {string} left @param {string} right */
function equal(left,right) {
  if(!digestPattern.test(left) || !digestPattern.test(right))throw new Error('Invalid local identity state');
  return timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'));
}
/** @param {Stamp} start @param {Stamp} end @param {number} duration */
const fresh=(start,end,duration)=>end.wall>=start.wall && end.tick>=start.tick && end.wall-start.wall<duration && end.tick-start.tick<duration;

/** Unactivated credential owner. A verified result is an identity candidate, NOT
 * a business-operation grant. The future composition must commit required audit,
 * enforce origin/transport, validate the workspace and reauthorize each use case.
 * start/issue/activity/stop are trusted orchestration capabilities, never routes.
 * The clock is a trusted platform/test port, never request configuration.
 * @param {Boundary} boundary @param {unknown} configuration
 * @param {()=>Stamp} [clock] */
export function createLocalSessions(boundary,configuration,clock=()=>({wall:Date.now(),tick:Math.floor(performance.now())})) {
  if(!closedRecord(configuration,['workspaceRef','actorRef','revisionRef']) ||
    typeof configuration.workspaceRef!=='string' || !uuid.test(configuration.workspaceRef) ||
    typeof configuration.actorRef!=='string' || !uuid.test(configuration.actorRef) || configuration.actorRef===configuration.workspaceRef ||
    typeof configuration.revisionRef!=='string' || !uuid.test(configuration.revisionRef) || typeof clock!=='function')throw new Error('Invalid local identity configuration');
  const workspaceRef=configuration.workspaceRef,actorRef=configuration.actorRef,revisionRef=configuration.revisionRef,generation=randomUUID();
  let started=false,starting=false,closed=false;
  /** @type {Stamp|undefined} */let last;
  /** @type {Set<AbortController>} */const controllers=new Set();
  function stop(){closed=true;for(const controller of controllers)controller.abort();}
  function now() {
    try {
      const value=clock();
      if(!closedRecord(value,['wall','tick']) || !Number.isSafeInteger(value.wall) || !Number.isSafeInteger(value.tick) || value.wall<0 || value.tick<0 ||
        (last && (value.wall<last.wall || value.tick<last.tick)))throw new Error('Invalid clock');
      last={wall:value.wall,tick:value.tick};return last;
    }catch{stop();throw new Error('Local clock unavailable');}
  }

  /** Both pre-commit and post-commit checks fence cancellations/expiry. Unknown
   * commits latch this owner closed: no secret can escape and no blind retry.
   * @param {AbortSignal} signal
   * @param {(tx:Transaction,setGuard:(guard:(stamp:Stamp)=>boolean)=>void)=>Promise<Result>} work
   * @param {boolean} [bootstrap] @returns {Promise<Readonly<Result>>} */
  async function run(signal,work,bootstrap=false) {
    if(!(signal instanceof AbortSignal))return Object.freeze({kind:'invalid'});
    if(signal.aborted)return Object.freeze({kind:'cancelled'});
    if(closed || (!bootstrap && !started) || controllers.size>=2)return Object.freeze({kind:'unavailable'});
    const controller=new AbortController();controllers.add(controller);
    const combined=AbortSignal.any([signal,controller.signal]);
    /** @type {(stamp:Stamp)=>boolean} */let guard=()=>true;
    try {
      now();
      const result=await boundary.run({companyId:workspaceRef,operationId:randomUUID(),signal:combined,timeoutMs:3000},async tx=>{
        const value=await work(tx,next=>{guard=next;});
        if(closed || combined.aborted || !guard(now()))throw new TransactionRejection('denied');
        return Object.freeze(value);
      });
      if(result.kind==='unknown')stop();
      if(closed || !guard(now()))return Object.freeze({kind:'unavailable'});
      if(combined.aborted)return Object.freeze({kind:'cancelled'});
      return result.kind==='committed'?result.value:Object.freeze({kind:result.kind});
    }catch{stop();return Object.freeze({kind:'unavailable'});}
    finally{controllers.delete(controller);}
  }

  /** @param {Transaction} tx */
  async function authority(tx) {
    const rows=await tx.query('local_lock');
    if(rows.length!==1 || rows[0]?.length!==7 || rows[0][0]!==actorRef || rows[0][1]!==revisionRef || rows[0][2]!==generation)throw new TransactionRejection('denied');
    return rows[0];
  }
  /** @param {Transaction} tx @param {Stamp} stamp */
  async function sessions(tx,stamp) {
    await tx.query('local_prune',[generation,stamp.wall,stamp.tick]);
    const rows=await tx.query('local_sessions',[generation]);
    if(rows.length>8)throw new Error('Local identity capacity exceeded');
    return rows.map(row=>{
      if(row.length!==5 || typeof row[0]!=='string' || !digestPattern.test(row[0]))throw new Error('Invalid local identity state');
      const created={wall:number(row[1]),tick:number(row[2])},active={wall:number(row[3]),tick:number(row[4])};
      if(active.wall<created.wall || active.tick<created.tick || !fresh(created,stamp,absolute) || !fresh(active,stamp,idle))throw new Error('Invalid local identity state');
      return {digest:row[0],created,active};
    });
  }
  /** @param {AbortSignal} signal @param {unknown} secret @param {'verify'|'activity'|'logout'} action */
  function use(signal,secret,action) {
    const hash=digest(secret,'session');
    if(hash===null)return Promise.resolve(Object.freeze({kind:'denied'}));
    return run(signal,async(tx,setGuard)=>{
      await authority(tx);const stamp=now();
      const session=(await sessions(tx,stamp)).find(value=>equal(hash,value.digest));
      if(!session)return {kind:'denied'};
      setGuard(end=>fresh(session.created,end,absolute) && fresh(session.active,end,idle));
      if(action==='logout'){await tx.query('local_logout',[generation,hash]);return {kind:'revoked'};}
      if(action==='activity')await tx.query('local_activity',[generation,hash,stamp.wall,stamp.tick]);
      return {kind:'verified',actorRef,workspaceRef,revisionRef};
    });
  }
  return Object.freeze({
    /** Trusted launcher only, after exclusive listener/workspace ownership checks.
     * Existing actor/revision cannot be replaced through this method.
     * @param {AbortSignal} signal */
    async start(signal) {
      if(started || starting || closed)return Object.freeze({kind:'unavailable'});
      starting=true;
      const result=await run(signal,async tx=>{
        const rows=await tx.query('local_boot',[actorRef,revisionRef,generation]);
        if(rows.length!==1 || rows[0]?.[0]!==generation)throw new TransactionRejection('denied');
        await tx.query('local_clear');return {kind:'ready'};
      },true);
      starting=false;started=result.kind==='ready';return result;
    },
    /** Only a trusted interactive delivery owner may receive this raw code.
     * @param {AbortSignal} signal */
    issue:(signal)=>run(signal,async(tx,setGuard)=>{
      await authority(tx);const stamp=now(),code=randomBytes(32).toString('base64url');
      const hash=digest(code,'launch');if(hash===null)throw new Error('Local entropy unavailable');
      await tx.query('local_code',[hash,stamp.wall,stamp.tick]);setGuard(end=>fresh(stamp,end,minute));return {kind:'issued',code};
    }),
    /** Invalid attempts must commit their bounded counter, not throw/roll it back.
     * @param {AbortSignal} signal @param {unknown} code */
    exchange:(signal,code)=>run(signal,async(tx,setGuard)=>{
      const row=await authority(tx),stamp=now();
      if(typeof row[6]!=='string' || row[6].length>84)throw new Error('Invalid local identity state');
      const failures=row[6]===''?[]:row[6].split(',').map(value=>number(value));
      if(failures.length>5 || failures.some(value=>value>stamp.tick))throw new Error('Invalid local identity state');
      const recent=failures.filter(value=>stamp.tick-value<minute);
      if(recent.length>=5)return {kind:'limited'};
      const hash=digest(code,'launch');
      const pending=row[3]===null?null:{wall:number(row[4]),tick:number(row[5])};
      if(hash===null || typeof row[3]!=='string' || !pending || !equal(hash,row[3]) || !fresh(pending,stamp,minute)) {
        recent.push(stamp.tick);await tx.query('local_failures',[recent.join(',')]);return {kind:'denied'};
      }
      if((await sessions(tx,stamp)).length>=8)return {kind:'limited'};
      const secret=randomBytes(32).toString('base64url'),secretHash=digest(secret,'session');
      if(secretHash===null)throw new Error('Local entropy unavailable');
      await tx.query('local_code',[null,null,null]);
      await tx.query('local_insert',[generation,secretHash,stamp.wall,stamp.tick]);
      setGuard(end=>fresh(pending,end,minute));return {kind:'issued',secret};
    }),
    /** Polling and all ordinary verification never update activity.
     * @param {AbortSignal} signal @param {unknown} secret */
    verify:(signal,secret)=>use(signal,secret,'verify'),
    /** Called only by a code-owned user-activity use case AFTER its authorization;
     * HTTP parameters/headers cannot select this operation.
     * @param {AbortSignal} signal @param {unknown} secret */
    activity:(signal,secret)=>use(signal,secret,'activity'),
    /** @param {AbortSignal} signal @param {unknown} secret */
    logout:(signal,secret)=>use(signal,secret,'logout'),
    // Immediate admission fence, even when PostgreSQL is unavailable. A new
    // process must start with a fresh generation before accepting any credential.
    stop,
  });
}
