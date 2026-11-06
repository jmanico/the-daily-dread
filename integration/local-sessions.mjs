import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import postgres from 'postgres';
import { startPostgres } from '../test-support/postgres-container.mjs';
import { createTransactionBoundary } from '../src/persistence/transactions.js';
import { createLocalSessions,localSessionStatements } from '../src/persistence/local-sessions.js';

const signal=()=>new AbortController().signal;
const identity=()=>({workspaceRef:randomUUID(),actorRef:randomUUID(),revisionRef:randomUUID()});
/** @param {import('../src/persistence/local-sessions.js').Result} result @param {'code'|'secret'} field */
function credential(result,field){assert.equal(result.kind,'issued');const value=result[field];assert.equal(typeof value,'string');if(typeof value!=='string')throw Error('Missing fixture credential');assert.match(value,/^[A-Za-z0-9_-]{43}$/);assert.equal(Buffer.from(value,'base64url').length,32);return value;}
/** @param {string} input @param {string} purpose */
const hash=(input,purpose)=>createHash('sha256').update(purpose+':').update(Buffer.from(input,'base64url')).digest('hex');

test('local identity lifecycle on PostgreSQL with TLS and a restricted role',{timeout:120000},async t=>{
  const fixture=await startPostgres();t.after(()=>fixture.close());
  const admin=postgres({...fixture.config,ssl:{ca:fixture.config.ca,rejectUnauthorized:true},channel_binding:'require',max:2,fetch_types:false,onnotice:false});t.after(()=>admin.end({timeout:0}));
  await admin.unsafe(await readFile(new URL('../db/004-local-sessions.sql',import.meta.url),'utf8')).raw();
  await admin.unsafe(`create role local_identity_fixture login password 'synthetic-local-identity' nosuperuser nocreatedb nocreaterole noinherit;
    grant usage on schema dread_local to local_identity_fixture;
    grant select,insert,update,delete on all tables in schema dread_local to local_identity_fixture;`).raw();
  const config={...fixture.config,user:'local_identity_fixture',password:'synthetic-local-identity'};
  const boundary=createTransactionBoundary(config,localSessionStatements);t.after(()=>boundary.close());
  /** @type {ReturnType<typeof createLocalSessions>[]} */const owners=[];
  t.after(()=>{for(const owner of owners)owner.stop();});
  async function setup(){
    const scope=identity(),clock={wall:1800000000000,tick:1000000};
    const owner=createLocalSessions(boundary,scope,()=>clock);owners.push(owner);
    assert.equal((await owner.start(signal())).kind,'ready');
    const issue=async()=>credential(await owner.issue(signal()),'code');
    const login=async()=>credential(await owner.exchange(signal(),await issue()),'secret');
    const advance=(/** @type {number} */ms)=>{clock.wall+=ms;clock.tick+=ms;};
    return {scope,clock,owner,issue,login,advance};
  }
  async function count(/** @type {string} */workspace){return Number((await admin`select count(*)::text from dread_local.sessions where workspace_id=${workspace}::uuid`.raw())[0][0].toString());}

  await t.test('AC-01/02: separate canonical credentials, digests only, replacement and one-use exchange',async()=>{
    const {owner,scope,issue}=await setup(),first=await issue(),second=await issue();assert.notEqual(first,second);
    assert.equal((await owner.exchange(signal(),first)).kind,'denied');
    const stored=(await admin`select code_digest from dread_local.authority where workspace_id=${scope.workspaceRef}::uuid`.raw())[0][0].toString();
    assert.equal(stored,hash(second,'launch'));assert.notEqual(stored,second);
    const secret=credential(await owner.exchange(signal(),second),'secret');assert.notEqual(secret,second);
    assert.equal((await owner.exchange(signal(),second)).kind,'denied');
    assert.equal((await owner.verify(signal(),second)).kind,'denied');
    assert.deepEqual(await owner.verify(signal(),secret),{kind:'verified',actorRef:scope.actorRef,workspaceRef:scope.workspaceRef,revisionRef:scope.revisionRef});
    const rows=await admin`select row_to_json(s)::text from dread_local.sessions s where workspace_id=${scope.workspaceRef}::uuid`.raw();
    const encoded=rows[0][0].toString();assert.ok(encoded.includes(hash(secret,'session')));assert.ok(!encoded.includes(secret));assert.ok(!encoded.includes(second));
    assert.equal((await admin`select code_digest from dread_local.authority where workspace_id=${scope.workspaceRef}::uuid`.raw())[0][0],null);
    const result=await owner.verify(signal(),secret);assert.ok(Object.isFrozen(result));assert.deepEqual(Object.keys(result).sort(),['actorRef','kind','revisionRef','workspaceRef']);
  });
  await t.test('AC-01/02: concurrent exchanges commit at most once and retry sees consumed code',async()=>{
    const {owner,scope,issue}=await setup(),code=await issue();
    const results=await Promise.all([owner.exchange(signal(),code),owner.exchange(signal(),code)]);
    assert.equal(results.filter(value=>value.kind==='issued').length,1);assert.equal(await count(scope.workspaceRef),1);
    assert.ok(results.every(value=>['issued','denied','retryable'].includes(value.kind)));
    assert.equal((await owner.exchange(signal(),code)).kind,'denied');
  });
  await t.test('AC-01: code expiry is exclusive at 60 seconds on either clock',async()=>{
    for(const which of ['wall','tick','both']){
      const {owner,clock,issue,advance}=await setup();const code=await issue();
      if(which==='both')advance(60000);else if(which==='wall')clock.wall+=60000;else clock.tick+=60000;
      assert.equal((await owner.exchange(signal(),code)).kind,'denied');
    }
    const {owner,issue,advance}=await setup(),code=await issue();advance(59999);assert.equal((await owner.exchange(signal(),code)).kind,'issued');
  });
  await t.test('AC-03: five failures in a rolling minute; replacement and success do not reset failure history',async()=>{
    const {owner,issue,advance}=await setup();let code=await issue();
    for(let i=0;i<5;i++){assert.equal((await owner.exchange(signal(),'invalid')).kind,'denied');advance(1000);}
    assert.equal((await owner.exchange(signal(),code)).kind,'limited');code=await issue();assert.equal((await owner.exchange(signal(),code)).kind,'limited');
    advance(54999);assert.equal((await owner.exchange(signal(),code)).kind,'limited');advance(1);
    assert.equal((await owner.exchange(signal(),code)).kind,'issued');
    assert.equal((await owner.exchange(signal(),'invalid')).kind,'denied');assert.equal((await owner.exchange(signal(),'invalid')).kind,'limited');
  });
  await t.test('AC-03: eight-session ceiling, logout frees capacity, expired entries are pruned',async()=>{
    const {owner,scope,issue,login,advance}=await setup();const secrets=[];
    for(let i=0;i<8;i++)secrets.push(await login());assert.equal(await count(scope.workspaceRef),8);
    const code=await issue();assert.equal((await owner.exchange(signal(),code)).kind,'limited');assert.equal(await count(scope.workspaceRef),8);
    assert.equal((await owner.logout(signal(),secrets[0])).kind,'revoked');assert.equal((await owner.exchange(signal(),code)).kind,'issued');
    assert.equal((await owner.verify(signal(),secrets[0])).kind,'denied');advance(30*60000);await login();assert.equal(await count(scope.workspaceRef),1);
  });
  await t.test('AC-04: polling never extends idle; explicit activity cannot extend absolute expiry',async()=>{
    const {owner,login,advance}=await setup(),secret=await login();
    for(let i=0;i<29;i++){advance(60000);assert.equal((await owner.verify(signal(),secret)).kind,'verified');}
    advance(59999);assert.equal((await owner.verify(signal(),secret)).kind,'verified');advance(1);
    assert.equal((await owner.verify(signal(),secret)).kind,'denied');assert.equal((await owner.activity(signal(),secret)).kind,'denied');
    const active=await setup(),activeSecret=await active.login();
    for(let i=0;i<31;i++){active.advance(15*60000);assert.equal((await active.owner.activity(signal(),activeSecret)).kind,'verified');}
    active.advance(15*60000-1);assert.equal((await active.owner.verify(signal(),activeSecret)).kind,'verified');active.advance(1);
    assert.equal((await active.owner.activity(signal(),activeSecret)).kind,'denied');
    for(const which of ['wall','tick']){const f=await setup(),s=await f.login();f.clock[/** @type {'wall'|'tick'} */(which)]+=30*60000;assert.equal((await f.owner.verify(signal(),s)).kind,'denied');}
  });
  await t.test('AC-04/05: logout, other workspace, changed actor/revision/generation, restart and stop revoke',async()=>{
    const f=await setup(),secret=await f.login(),code=await f.issue(),other=await setup();
    assert.equal((await other.owner.verify(signal(),secret)).kind,'denied');assert.equal((await other.owner.exchange(signal(),code)).kind,'denied');
    const replacement=createLocalSessions(boundary,f.scope,()=>f.clock);owners.push(replacement);assert.equal((await replacement.start(signal())).kind,'ready');
    assert.equal((await replacement.verify(signal(),secret)).kind,'denied');assert.equal((await replacement.exchange(signal(),code)).kind,'denied');assert.equal((await f.owner.issue(signal())).kind,'denied');
    for(const field of ['actor_id','revision','generation']){
      const item=await setup(),s=await item.login();
      // Fixed code-owned SQL choices, never runtime identifiers.
      const statements={actor_id:'update dread_local.authority set actor_id=$2::uuid where workspace_id=$1::uuid',revision:'update dread_local.authority set revision=$2::uuid where workspace_id=$1::uuid',generation:'update dread_local.authority set generation=$2::uuid where workspace_id=$1::uuid'};
      await admin.unsafe(statements[/** @type {keyof typeof statements} */(field)],[item.scope.workspaceRef,randomUUID()]).raw();
      assert.equal((await item.owner.verify(signal(),s)).kind,'denied');assert.equal((await item.owner.issue(signal())).kind,'denied');
    }
    const stopped=await setup(),s=await stopped.login();stopped.owner.stop();assert.equal((await stopped.owner.verify(signal(),s)).kind,'unavailable');assert.equal((await stopped.owner.start(signal())).kind,'unavailable');
  });
  await t.test('AC-05: wall/monotonic rollback and invalid clock latch admission closed',async()=>{
    for(const mode of ['wall','tick','NaN','negative','fraction','throw']){
      const f=await setup(),secret=await f.login();
      if(mode==='wall')f.clock.wall--;else if(mode==='tick')f.clock.tick--;else if(mode==='NaN')f.clock.wall=NaN;else if(mode==='negative')f.clock.tick=-1;else if(mode==='fraction')f.clock.tick+=0.5;
      else {Object.defineProperty(f.clock,'wall',{get(){throw Error('CLOCK_SECRET_CANARY');}});}
      const result=await f.owner.verify(signal(),secret);assert.equal(result.kind,'unavailable');assert.doesNotMatch(JSON.stringify(result),/CANARY/);
      assert.equal((await f.owner.issue(signal())).kind,'unavailable');
    }
  });
  await t.test('AC-06: malformed/oversized/noncanonical/accessor credentials never become identity',async()=>{
    const {owner,login}=await setup(),secret=await login();let accessed=false;
    const getter={get secret(){accessed=true;return secret;}};
    for(const value of [null,{},getter,{secret,actorRef:'forged'},Object.create({secret}),secret+'=',secret+'\n','A'.repeat(100000),'A'.repeat(42)+'B',42]){
      assert.equal((await owner.verify(signal(),value)).kind,'denied');
    }
    assert.equal(accessed,false);assert.equal((await owner.verify(signal(),secret)).kind,'verified');
  });
  await t.test('AC-06: restricted schema and constraints reject corrupt credential state',async()=>{
    const runtime=postgres({...config,ssl:{ca:config.ca,rejectUnauthorized:true},channel_binding:'require',max:1,fetch_types:false,onnotice:false});
    try{for(const statement of ['truncate dread_local.sessions','drop table dread_local.sessions','alter table dread_local.sessions add column bad text','create table dread_local.bad(id int)'])await assert.rejects(runtime.unsafe(statement).raw(),{code:'42501'});}
    finally{await runtime.end({timeout:0});}
    const f=await setup();await assert.rejects(admin`update dread_local.authority set code_digest=${'a'.repeat(64)},code_wall=null,code_tick=null where workspace_id=${f.scope.workspaceRef}::uuid`.raw(),{code:'23514'});
    await assert.rejects(admin`update dread_local.authority set failed_at=array[1,2,3,4,5,6]::bigint[] where workspace_id=${f.scope.workspaceRef}::uuid`.raw(),{code:'23514'});
    await assert.rejects(admin`update dread_local.authority set code_digest='RAW_SECRET_CANARY' where workspace_id=${f.scope.workspaceRef}::uuid`.raw(),{code:'23514'});
  });
  await t.test('AC-06: insert/update/select privilege failures roll back and disclose no secrets',async()=>{
    const f=await setup(),code=await f.issue();await admin`revoke insert on dread_local.sessions from local_identity_fixture`.raw();
    try{const result=await f.owner.exchange(signal(),code);assert.deepEqual(result,{kind:'unavailable'});assert.equal(await count(f.scope.workspaceRef),0);}
    finally{await admin`grant insert on dread_local.sessions to local_identity_fixture`.raw();}
    const secret=credential(await f.owner.exchange(signal(),code),'secret');
    await admin`revoke update on dread_local.authority from local_identity_fixture`.raw();
    try{assert.deepEqual(await f.owner.issue(signal()),{kind:'unavailable'});}
    finally{await admin`grant update on dread_local.authority to local_identity_fixture`.raw();}
    await admin`revoke select on dread_local.sessions from local_identity_fixture`.raw();
    try{assert.deepEqual(await f.owner.verify(signal(),secret),{kind:'unavailable'});}
    finally{await admin`grant select on dread_local.sessions to local_identity_fixture`.raw();}
    assert.equal((await f.owner.verify(signal(),secret)).kind,'verified');
  });
  await t.test('AC-05/06: real database lock deadline, cancellation and stop fence pending exchanges',async()=>{
    for(const mode of ['timeout','cancel','stop']){
      const f=await setup(),code=await f.issue();let release=()=>{},locked=()=>{};
      const gate=new Promise(resolve=>{release=()=>resolve(undefined);}),ready=new Promise(resolve=>{locked=()=>resolve(undefined);});
      const holder=admin.begin(async tx=>{await tx`select workspace_id from dread_local.authority where workspace_id=${f.scope.workspaceRef}::uuid for update`.raw();locked();await gate;});await ready;
      const c=new AbortController(),begin=performance.now();let timer;
      try{
        const pending=f.owner.exchange(c.signal,code);
        if(mode==='cancel')timer=setTimeout(()=>c.abort(),50);else if(mode==='stop')timer=setTimeout(()=>f.owner.stop(),50);
        const result=await pending;assert.ok(['unavailable','cancelled'].includes(result.kind));assert.deepEqual(Object.keys(result),['kind']);assert.ok(performance.now()-begin<4000);
      }finally{clearTimeout(timer);release();await holder;}
      assert.equal(await count(f.scope.workspaceRef),0);
      if(mode!=='stop')assert.equal((await f.owner.exchange(signal(),code)).kind,'issued');
    }
  });
  await t.test('AC-02/05: cancellation or expiry during insertion rolls back consumed code and session',async()=>{
    await admin.unsafe(`create function dread_local.fixture_delay() returns trigger language plpgsql as $$ begin perform pg_sleep(0.3); return new; end $$;
      create trigger fixture_delay before insert on dread_local.sessions for each row execute function dread_local.fixture_delay();`).raw();
    try{
      for(const mode of ['cancel','expire','rollback']){
        const f=await setup(),code=await f.issue(),controller=new AbortController();
        const pending=f.owner.exchange(controller.signal,code);
        const timer=setTimeout(()=>{if(mode==='cancel')controller.abort();else if(mode==='expire')f.advance(60000);else f.clock.tick--;},100);
        try{const result=await pending;assert.ok(['cancelled','denied','unavailable'].includes(result.kind));assert.deepEqual(Object.keys(result),['kind']);}
        finally{clearTimeout(timer);}
        assert.equal(await count(f.scope.workspaceRef),0);
        const row=(await admin`select code_digest from dread_local.authority where workspace_id=${f.scope.workspaceRef}::uuid`.raw())[0];assert.equal(row[0]?.toString(),hash(code,'launch'));
        if(mode==='cancel')assert.equal((await f.owner.exchange(signal(),code)).kind,'issued');
      }
    }finally{await admin.unsafe('drop trigger fixture_delay on dread_local.sessions; drop function dread_local.fixture_delay()').raw();}
  });
  await t.test('AC-06: bounded owner rejects corrupt rows and enforces two-operation admission',async()=>{
    const f=await setup(),secret=await f.login();
    await admin`update dread_local.sessions set active_tick=${f.clock.tick+1}::bigint where workspace_id=${f.scope.workspaceRef}::uuid`.raw();
    assert.deepEqual(await f.owner.verify(signal(),secret),{kind:'unavailable'});
    const active=await setup(),code=await active.issue();let release=()=>{},locked=()=>{};
    const gate=new Promise(resolve=>{release=()=>resolve(undefined);}),ready=new Promise(resolve=>{locked=()=>resolve(undefined);});
    const holder=admin.begin(async tx=>{await tx`select workspace_id from dread_local.authority where workspace_id=${active.scope.workspaceRef}::uuid for update`.raw();locked();await gate;});await ready;
    const pending=[active.owner.exchange(signal(),code),active.owner.exchange(signal(),code)];
    try{assert.deepEqual(await active.owner.exchange(signal(),code),{kind:'unavailable'});active.owner.stop();const results=await Promise.all(pending);assert.ok(results.every(result=>result.kind!=='issued'));}
    finally{release();await holder;}
    assert.equal(await count(active.scope.workspaceRef),0);
  });
  await t.test('AC-02/05: lost or late commit acknowledgment never releases a session secret',async()=>{
    for(const mode of ['unknown','stopped']){
      let lose=false,release=()=>{},committed=()=>{};
      const gate=new Promise(resolve=>{release=()=>resolve(undefined);}),ready=new Promise(resolve=>{committed=()=>resolve(undefined);});
      /** @type {ReturnType<typeof createTransactionBoundary>} */
      const fault={...boundary,async run(context,work){
        const result=await boundary.run(context,work);
        if(lose && result.kind==='committed'){
          if(mode==='stopped'){committed();await gate;return result;}
          return Object.freeze({kind:'unknown',operationId:result.operationId});
        }
        return result;
      }};
      const scope=identity(),owner=createLocalSessions(fault,scope);owners.push(owner);
      assert.equal((await owner.start(signal())).kind,'ready');const code=credential(await owner.issue(signal()),'code');lose=true;
      const pending=owner.exchange(signal(),code);
      if(mode==='stopped'){await ready;owner.stop();release();}
      assert.deepEqual(await pending,{kind:'unavailable'});assert.equal(await count(scope.workspaceRef),1);
      assert.deepEqual(await owner.issue(signal()),{kind:'unavailable'});assert.deepEqual(await owner.exchange(signal(),code),{kind:'unavailable'});
      const restarted=createLocalSessions(boundary,scope);owners.push(restarted);assert.equal((await restarted.start(signal())).kind,'ready');assert.equal(await count(scope.workspaceRef),0);
    }
  });
  await t.test('AC-05/06: canceled startup, reinitialization and foreign bootstrap never replace authority',async()=>{
    const scope=identity(),owner=createLocalSessions(boundary,scope);owners.push(owner);
    const c=new AbortController();c.abort();assert.equal((await owner.start(c.signal)).kind,'cancelled');assert.equal((await owner.issue(signal())).kind,'unavailable');
    assert.equal((await owner.start(signal())).kind,'ready');assert.equal((await owner.start(signal())).kind,'unavailable');
    const foreign=createLocalSessions(boundary,{...scope,actorRef:randomUUID()});owners.push(foreign);assert.equal((await foreign.start(signal())).kind,'denied');
    const otherRevision=createLocalSessions(boundary,{...scope,revisionRef:randomUUID()});owners.push(otherRevision);assert.equal((await otherRevision.start(signal())).kind,'denied');
    assert.equal((await owner.issue(signal())).kind,'issued');
  });
});
