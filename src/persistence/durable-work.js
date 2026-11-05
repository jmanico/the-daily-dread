import { randomUUID } from 'node:crypto';
import { closedRecord } from '../contracts/http-results.js';
import { TransactionRejection } from './transactions.js';
import { advanceJobCounters } from '../jobs/work-budget.js';

/** @typedef {import('./transactions.js').Transaction} Transaction */
/** @typedef {import('./transactions.js').Context} Context */
/** @typedef {ReturnType<typeof import('./transactions.js').createTransactionBoundary>} Boundary */
/** @typedef {{jobId:string,eventId:string,eventRevision:number,repositoryId:string,grantId:string,repositoryRevision:number,grantRevision:number,state:string,attemptToken:string|null,version:number,decodedBytes:number,treeEntries:number,activeMs:number,attempts:number,leaseActive:boolean}} Job */
/** @typedef {{jobId:string,attemptToken:string,version:number}} Fence */
/** @typedef {'enqueue'|'scan'|'claim'|'recover'|'renew'|'debit'|'commit'} Phase */
/** @typedef {(tx:Transaction,target:Readonly<Job>|Readonly<{eventId:string,eventRevision:number,repositoryId:string,grantId:string,repositoryRevision:number,grantRevision:number}>|null,phase:Phase)=>Promise<'allowed'|'denied'|'revoked'|'unavailable'>} Authority */
const id=/^[A-Za-z0-9_-]{1,128}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const columns='j.job_id::text,j.event_id,j.event_revision::text,j.repository_id,j.grant_id,j.state,j.attempt_token::text,j.version::text,j.decoded_bytes::text,j.tree_entries::text,j.active_ms::text,j.attempts::text,(j.lease_until>clock_timestamp())::text,j.repository_revision::text,j.grant_revision::text';

// Fixed SQL only. Scope is always $1. Installation admission is the one explicit
// global aggregate/mutex; it exposes no other company's object rows or identity.
export const workStatements=Object.freeze({
  work_enqueue:"insert into dread_work.jobs(company_id,job_id,event_id,event_revision,repository_id,grant_id,repository_revision,grant_revision,state) values($1,$2::uuid,$3,$4::bigint,$5,$6,$7::bigint,$8::bigint,'queued') on conflict(company_id,event_id,event_revision,repository_id) do nothing",
  work_identity:'select '+columns+' from dread_work.jobs j where j.company_id=$1 and j.event_id=$2 and j.event_revision=$3::bigint and j.repository_id=$4 for update',
  work_get:'select '+columns+' from dread_work.jobs j where j.company_id=$1 and j.job_id=$2::uuid for update',
  work_mutex:'update dread_work.admission set lock_epoch=lock_epoch+1 where singleton=true and $1::text is not null returning lock_epoch::text',
  work_active:"select count(*)::text from dread_work.jobs where state='running' and lease_until>clock_timestamp() and $1::text is not null",
  work_next:'select '+columns+" from dread_work.jobs j where j.company_id=$1 and j.state='queued' order by j.created_at,j.job_id limit 1 for update skip locked",
  work_claim:'update dread_work.jobs j set state=\'running\',attempt_token=$3::uuid,lease_until=clock_timestamp()+interval \'60 seconds\',version=version+1,attempts=attempts+1 where j.company_id=$1 and j.job_id=$2::uuid and j.state=\'queued\' and j.version=$4::bigint returning '+columns,
  work_attempt:"insert into dread_work.attempts(company_id,job_id,attempt_token,ordinal,operation_id,outcome) values($1,$2::uuid,$3::uuid,$4::bigint,$5,'running')",
  work_prior:'select '+columns+' from dread_work.jobs j join dread_work.attempts a using(company_id,job_id) where j.company_id=$1 and a.operation_id=$2 and a.attempt_token=j.attempt_token for update of j',
  work_used:'select '+columns+' from dread_work.jobs j join dread_work.attempts a using(company_id,job_id) where j.company_id=$1 and a.operation_id=$2 for update of j',
  work_expired:'select '+columns+" from dread_work.jobs j where j.company_id=$1 and j.state='running' and j.lease_until<=clock_timestamp() order by j.lease_until,j.job_id limit 10 for update skip locked",
  work_finish_attempt:"update dread_work.attempts set outcome=$4,finished_at=clock_timestamp() where company_id=$1 and job_id=$2::uuid and attempt_token=$3::uuid and outcome='running' returning ordinal::text",
  work_recover:"update dread_work.jobs set state=$3,attempt_token=null,lease_until=null,version=version+1 where company_id=$1 and job_id=$2::uuid and state='running' and lease_until<=clock_timestamp() returning job_id::text",
  work_block:"update dread_work.jobs set state='blocked',version=version+1 where company_id=$1 and job_id=$2::uuid and state='queued' returning job_id::text",
  work_renew:'update dread_work.jobs j set lease_until=clock_timestamp()+interval \'60 seconds\' where j.company_id=$1 and j.job_id=$2::uuid and j.attempt_token=$3::uuid and j.version=$4::bigint and j.state=\'running\' and j.lease_until>clock_timestamp() returning '+columns,
  work_debit:'update dread_work.jobs j set decoded_bytes=$5::bigint,tree_entries=$6::int,active_ms=$7::int,version=version+1 where j.company_id=$1 and j.job_id=$2::uuid and j.attempt_token=$3::uuid and j.version=$4::bigint and j.state=\'running\' and j.lease_until>clock_timestamp() returning '+columns,
  work_finish:"update dread_work.jobs set state=$5,attempt_token=null,lease_until=null,version=version+1 where company_id=$1 and job_id=$2::uuid and attempt_token=$3::uuid and version=$4::bigint and state='running' and lease_until>clock_timestamp() returning job_id::text",
});

/** @param {string|null|undefined} value */
function integer(value) {
  if(typeof value!=='string' || !/^(0|[1-9][0-9]{0,15})$/.test(value) || !Number.isSafeInteger(Number(value)))throw new Error('Invalid stored work record');
  return Number(value);
}
/** @param {readonly (string|null)[]|undefined} row @returns {Readonly<Job>} */
function job(row) {
  if(!row || row.length!==15 || !row[0] || !uuid.test(row[0]) || !row[1] || !id.test(row[1]) || !row[3] || !id.test(row[3]) ||
    !row[4] || !id.test(row[4]) || !row[5] || !['queued','running','succeeded','failed','blocked'].includes(row[5]) ||
    row[6]!==null && !uuid.test(row[6]) || ![null,'true','false'].includes(row[12]))throw new Error('Invalid stored work record');
  return Object.freeze({jobId:row[0],eventId:row[1],eventRevision:integer(row[2]),repositoryId:row[3],grantId:row[4],state:row[5],
    attemptToken:row[6],version:integer(row[7]),decodedBytes:integer(row[8]),treeEntries:integer(row[9]),activeMs:integer(row[10]),attempts:integer(row[11]),leaseActive:row[12]==='true',repositoryRevision:integer(row[13]),grantRevision:integer(row[14])});
}
/** @param {unknown} input */
function command(input) {
  if(!closedRecord(input,['eventId','eventRevision','repositoryId','grantId','repositoryRevision','grantRevision']) || typeof input.eventId!=='string' || !id.test(input.eventId) ||
    typeof input.repositoryId!=='string' || !id.test(input.repositoryId) || typeof input.grantId!=='string' || !id.test(input.grantId) ||
    typeof input.eventRevision!=='number' || !Number.isSafeInteger(input.eventRevision) || input.eventRevision<1 ||
    typeof input.repositoryRevision!=='number' || !Number.isSafeInteger(input.repositoryRevision) || input.repositoryRevision<1 ||
    typeof input.grantRevision!=='number' || !Number.isSafeInteger(input.grantRevision) || input.grantRevision<1)throw new TransactionRejection('invalid');
  return Object.freeze({eventId:input.eventId,eventRevision:input.eventRevision,repositoryId:input.repositoryId,grantId:input.grantId,repositoryRevision:input.repositoryRevision,grantRevision:input.grantRevision});
}
/** @param {unknown} input @returns {Fence} */
function fence(input) {
  if(!closedRecord(input,['jobId','attemptToken','version']) || typeof input.jobId!=='string' || !uuid.test(input.jobId) ||
    typeof input.attemptToken!=='string' || !uuid.test(input.attemptToken) || typeof input.version!=='number' || !Number.isSafeInteger(input.version) || input.version<1)throw new TransactionRejection('invalid');
  return {jobId:input.jobId,attemptToken:input.attemptToken,version:input.version};
}

/** Authority is a trusted owner that reads/locks current grant, source/event and
 * repository revisions in this same transaction. It must never use a cached role
 * or queue payload as authority. 'revoked' additionally asserts current authority
 * to maintain this job while its bound target access/revision is no longer valid.
 * An unauthorized owner must return 'denied'; that result cannot mutate the job.
 * This queue does not implement product identity.
 * No HTTP surface, repository scan or external side effect is started here.
 * @param {Boundary} boundary @param {Authority} authority */
export function createWorkOwner(boundary,authority) {
  if(typeof authority!=='function')throw new Error('Missing current work authority');
  /** @param {Transaction} tx @param {Parameters<Authority>[1]} target @param {Phase} phase */
  async function permission(tx,target,phase) {
    const answer=await authority(tx,target,phase);
    if(answer==='unavailable')throw new Error('Work authority unavailable');
    if(answer!=='allowed' && answer!=='denied' && answer!=='revoked')throw new Error('Invalid work authority');
    return answer;
  }
  /** @param {Transaction} tx @param {unknown} input */
  async function enqueueInTransaction(tx,input) {
    const value=command(input);
    if(await permission(tx,value,'enqueue')!=='allowed')throw new TransactionRejection('denied');
    await tx.query('work_enqueue',[randomUUID(),value.eventId,value.eventRevision,value.repositoryId,value.grantId,value.repositoryRevision,value.grantRevision]);
    const existing=job((await tx.query('work_identity',[value.eventId,value.eventRevision,value.repositoryId]))[0]);
    if(existing.grantId!==value.grantId || existing.grantRevision!==value.grantRevision || existing.repositoryRevision!==value.repositoryRevision)throw new TransactionRejection('conflict');
    return existing;
  }
  /** @param {Transaction} tx @param {unknown} input @param {Phase} phase */
  async function current(tx,input,phase) {
    const expected=fence(input);
    if(await permission(tx,null,'scan')!=='allowed')throw new TransactionRejection('denied');
    const rows=await tx.query('work_get',[expected.jobId]);
    if(rows.length!==1)throw new TransactionRejection('not_found');
    const value=job(rows[0]);
    if(await permission(tx,value,phase)!=='allowed')throw new TransactionRejection('not_found');
    if(value.state!=='running' || !value.leaseActive || value.attemptToken!==expected.attemptToken || value.version!==expected.version)throw new TransactionRejection('conflict');
    return value;
  }
  /** @param {Transaction} tx @param {Readonly<Job>} value @param {'succeeded'|'failed'} state */
  async function finish(tx,value,state) {
    const rows=await tx.query('work_finish',[value.jobId,value.attemptToken,value.version,state]);
    if(rows.length!==1)throw new TransactionRejection('conflict');
    if((await tx.query('work_finish_attempt',[value.jobId,value.attemptToken,state])).length!==1)throw new Error('Missing running attempt');
  }
  return Object.freeze({
    enqueueInTransaction,
    /** @param {Context} context @param {unknown} input */
    enqueue:(context,input)=>boundary.run(context,tx=>enqueueInTransaction(tx,input)),
    /** @param {Context} context */
    claim:context=>boundary.run(context,async tx=>{
      if(await permission(tx,null,'scan')!=='allowed')throw new TransactionRejection('denied');
      const prior=await tx.query('work_prior',[tx.operationId]);
      if(prior.length===1) {
        const value=job(prior[0]);
        if(await permission(tx,value,'claim')!=='allowed')throw new TransactionRejection('not_found');
        if(!value.leaseActive)throw new TransactionRejection('conflict');
        return Object.freeze({kind:'claimed',job:value});
      }
      const used=await tx.query('work_used',[tx.operationId]);
      if(used.length) {
        if(await permission(tx,job(used[0]),'claim')!=='allowed')throw new TransactionRejection('not_found');
        throw new TransactionRejection('conflict');
      }
      if((await tx.query('work_mutex')).length!==1)throw new Error('Missing installation admission');
      if(integer((await tx.query('work_active'))[0]?.[0])>=1)return Object.freeze({kind:'idle'});
      const next=await tx.query('work_next');
      if(next.length===0)return Object.freeze({kind:'idle'});
      const value=job(next[0]);
      const access=await permission(tx,value,'claim');
      if(access==='denied')throw new TransactionRejection('not_found');
      if(access==='revoked') {await tx.query('work_block',[value.jobId]);return Object.freeze({kind:'blocked'});}
      const claimed=job((await tx.query('work_claim',[value.jobId,randomUUID(),value.version]))[0]);
      await tx.query('work_attempt',[claimed.jobId,claimed.attemptToken,claimed.attempts,tx.operationId]);
      return Object.freeze({kind:'claimed',job:claimed});
    }),
    /** One bounded page. The consumer repeats while this page is full; no queue
     * notification is authoritative. Startup and periodic wakeups call this owner.
     * @param {Context} context */
    recover:context=>boundary.run(context,async tx=>{
      if(await permission(tx,null,'scan')!=='allowed')throw new TransactionRejection('denied');
      const rows=await tx.query('work_expired');let recovered=0,blocked=0;
      for(const row of rows) {
        const value=job(row), access=await permission(tx,value,'recover');
        if(access==='denied')throw new TransactionRejection('not_found');
        const permitted=access==='allowed';
        if((await tx.query('work_finish_attempt',[value.jobId,value.attemptToken,permitted?'interrupted':'blocked'])).length!==1)throw new Error('Missing expired attempt');
        if((await tx.query('work_recover',[value.jobId,permitted?'queued':'blocked'])).length!==1)throw new TransactionRejection('conflict');
        permitted?recovered++:blocked++;
      }
      return Object.freeze({recovered,blocked,more:rows.length===10});
    }),
    /** @param {Context} context @param {unknown} input */
    renew:(context,input)=>boundary.run(context,async tx=>{
      const value=await current(tx,input,'renew');
      const renewed=await tx.query('work_renew',[value.jobId,value.attemptToken,value.version]);
      if(renewed.length!==1)throw new TransactionRejection('conflict');
      return job(renewed[0]);
    }),
    /** Reserve conservative cost before work; uncertain/crashed work keeps its
     * debit. Neither recovery nor a new attempt resets or refunds counters.
     * @param {Context} context @param {unknown} input @param {unknown} delta */
    debit:(context,input,delta)=>boundary.run(context,async tx=>{
      const value=await current(tx,input,'debit');
      const expected={companyId:tx.companyId,jobId:value.jobId,attemptToken:value.attemptToken,version:value.version};
      const result=advanceJobCounters({...expected,decodedBytes:value.decodedBytes,treeEntries:value.treeEntries,activeMs:value.activeMs},expected,delta);
      if(result.kind==='rejected') {
        if(result.reason!=='exhausted')throw new TransactionRejection('invalid');
        await finish(tx,value,'failed');return Object.freeze({kind:'exhausted',boundary:result.boundary,limit:result.limit});
      }
      const debited=await tx.query('work_debit',[value.jobId,value.attemptToken,value.version,result.record.decodedBytes,result.record.treeEntries,result.record.activeMs]);
      if(debited.length!==1)throw new TransactionRejection('conflict');
      const next=job(debited[0]);
      return Object.freeze({kind:'reserved',job:next});
    }),
    /** Commit the owning result in the fenced transaction. External effects do
     * not belong in this callback; their durable intent/reconciliation owner is
     * separate. The authority owner is checked again before the final transition.
     * @template T @param {Context} context @param {unknown} input @param {(tx:Transaction,job:Readonly<Job>)=>Promise<T>} commit */
    complete:(context,input,commit)=>boundary.run(context,async tx=>{
      if(typeof commit!=='function')throw new TransactionRejection('invalid');
      const value=await current(tx,input,'commit');
      const result=await commit(tx,value);
      if(await permission(tx,value,'commit')!=='allowed')throw new TransactionRejection('denied');
      await finish(tx,value,'succeeded');return result;
    }),
  });
}
