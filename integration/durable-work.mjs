import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { startPostgres } from '../test-support/postgres-container.mjs';
import { workFixture } from '../test-support/work-owner.mjs';
import { createWorkOwner } from '../src/persistence/durable-work.js';
import { recoveryWakeups } from '../src/jobs/recovery-wakeups.js';

/** @param {string} operationId @param {string} [companyId] */
const context=(operationId,companyId='company_a')=>({companyId,operationId,signal:new AbortController().signal,timeoutMs:3000});
/** @param {string} [eventId] */
const command=(eventId='event_a')=>({eventId,eventRevision:1,repositoryId:'repository_a',grantId:'grant_a',repositoryRevision:1,grantRevision:1});
/** @template T @param {{kind:string,value?:T}} result @returns {T} */
function value(result){assert.equal(result.kind,'committed');if(result.value===undefined)throw Error('Missing committed value');return result.value;}
/** @param {import('../src/persistence/durable-work.js').Job} job */
const fence=job=>({jobId:job.jobId,attemptToken:job.attemptToken,version:job.version});

/** @param {import('../src/persistence/transactions.js').Configuration} config */
async function crashedClaim(config) {
  const child=fork(new URL('../test-support/work-crash.mjs',import.meta.url),[],{stdio:['ignore','pipe','pipe','ipc'],env:{LANG:'C',TZ:'UTC'}});
  let stdout='',stderr='';/** @type {unknown} */let message;
  child.stdout?.on('data',chunk=>{stdout+=String(chunk);if(stdout.length>8192)child.kill('SIGKILL');});
  child.stderr?.on('data',chunk=>{stderr+=String(chunk);if(stderr.length>8192)child.kill('SIGKILL');});
  const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
  child.once('message',data=>{message=data;});
  const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  child.send(config);
  try{assert.deepEqual(await exit,{code:null,signal:'SIGKILL'});assert.equal(stdout,'');assert.equal(stderr,'');assert.ok(message);return message;}
  finally{clearTimeout(timer);if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL');}
}

test('durable repository work survives process loss and fences stale owners on PostgreSQL 18.6',{timeout:90000},async t=>{
  const fixture=await startPostgres();t.after(()=>fixture.close());
  const admin=postgres({...fixture.config,ssl:{ca:fixture.config.ca,rejectUnauthorized:true},channel_binding:'require',max:2,fetch_types:false,onnotice:false});t.after(()=>admin.end({timeout:0}));
  await admin.unsafe(await readFile(new URL('../db/001-durable-work.sql',import.meta.url),'utf8')).raw();
  await admin.unsafe(`create role dread_worker login password 'synthetic-worker-fixture' nosuperuser nocreatedb nocreaterole noinherit;
    create schema fixture;
    create table fixture.principals(company_id text,principal_id text,enabled boolean not null,primary key(company_id,principal_id));
    create table fixture.repositories(company_id text,repository_id text,revision bigint,enabled boolean not null,primary key(company_id,repository_id));
    create table fixture.events(company_id text,event_id text,revision bigint,enabled boolean not null,primary key(company_id,event_id,revision));
    create table fixture.grants(company_id text,grant_id text,principal_id text,repository_id text,revision bigint,enabled boolean not null,primary key(company_id,grant_id),foreign key(company_id,principal_id) references fixture.principals,foreign key(company_id,repository_id) references fixture.repositories);
    create table fixture.results(company_id text,job_id uuid,marker text,primary key(company_id,job_id),foreign key(company_id,job_id) references dread_work.jobs);
    grant usage on schema dread_work,fixture to dread_worker;
    grant select,insert,update on dread_work.jobs,dread_work.attempts to dread_worker;
    grant select,update on dread_work.admission to dread_worker;
    grant select on all tables in schema fixture to dread_worker;
    grant insert on fixture.events,fixture.results to dread_worker;
    grant update on fixture.principals,fixture.repositories,fixture.events,fixture.grants to dread_worker;
    insert into fixture.principals values('company_a','worker_a',true),('company_b','worker_b',true),('company_a','worker_other',true);
    insert into fixture.repositories values('company_a','repository_a',1,true),('company_b','repository_a',1,true);
    insert into fixture.events values('company_a','event_a',1,true),('company_a','event_b',1,true),('company_b','event_a',1,true);
    insert into fixture.grants values('company_a','grant_a','worker_a','repository_a',1,true),('company_b','grant_a','worker_b','repository_a',1,true);`).raw();
  const config={...fixture.config,user:'dread_worker',password:'synthetic-worker-fixture'};
  const {owner,boundary,authority}=workFixture(config);t.after(()=>boundary.close());
  t.beforeEach(async()=>{
    await admin.unsafe('truncate fixture.results,dread_work.attempts,dread_work.jobs; update fixture.grants set enabled=true,revision=1; update fixture.repositories set enabled=true,revision=1; update fixture.events set enabled=true; update fixture.principals set enabled=true').raw();
  });
  /** @param {string} operation */
  async function claimed(operation){const result=value(await owner.claim(context(operation)));assert.equal(result.kind,'claimed');return result.job;}

  await t.test('producer mutation/work intent is atomic and logical identity deduplicates across concurrent retries',async()=>{
    const failed=await boundary.run(context('producer_failure'),async tx=>{await tx.query('event_create',['atomic_failed']);await owner.enqueueInTransaction(tx,command('atomic_failed'));throw Error('synthetic-producer-secret');});
    assert.equal(failed.kind,'unavailable');assert.doesNotMatch(JSON.stringify(failed),/synthetic-producer-secret/);
    assert.equal((await admin`select count(*)::text from fixture.events where event_id='atomic_failed'`.raw())[0][0]?.toString(),'0');
    assert.equal((await admin`select count(*)::text from dread_work.jobs`.raw())[0][0]?.toString(),'0');
    const results=await Promise.all([owner.enqueue(context('enqueue_a'),command()),owner.enqueue(context('enqueue_b'),command())]);
    assert.ok(results.every(x=>x.kind==='committed' || x.kind==='retryable'));
    const original=value(await owner.enqueue(context('enqueue_retry'),command()));
    assert.equal(original.attempts,0);assert.equal(original.state,'queued');
    assert.equal((await admin`select count(*)::text from dread_work.jobs`.raw())[0][0]?.toString(),'1');
    assert.equal(value(await owner.enqueue(context('enqueue_again'),command())).jobId,original.jobId);
    value(await boundary.run(context('producer_success'),async tx=>{await tx.query('event_create',['atomic_success']);return owner.enqueueInTransaction(tx,command('atomic_success'));}));
    assert.equal((await admin`select count(*)::text from fixture.events where event_id='atomic_success'`.raw())[0][0]?.toString(),'1');
    assert.equal((await admin`select count(*)::text from dread_work.jobs where event_id='atomic_success'`.raw())[0][0]?.toString(),'1');
  });

  await t.test('current authority and malformed producer inputs fail without creating work',async()=>{
    for(const input of [null,{...command(),extra:true},{...command(),eventRevision:0},{...command(),grantRevision:1.5},{...command(),repositoryId:'../private'},Object.create(command())])assert.equal((await owner.enqueue(context('invalid'),input)).kind,'invalid');
    for(const input of [{...command(),grantId:'missing'},command('missing'),{...command(),repositoryRevision:2},{...command(),grantRevision:2}])assert.equal((await owner.enqueue(context('denied'),input)).kind,'denied');
    assert.equal((await owner.enqueue(context('wrong_company','company_b'),command())).kind,'denied');
    const unavailable=createWorkOwner(boundary,async()=> 'unavailable');assert.equal((await unavailable.enqueue(context('unavailable'),command())).kind,'unavailable');
    const throwing=createWorkOwner(boundary,async()=>{throw Error('secret-policy');});assert.equal((await throwing.claim(context('throw'))).kind,'unavailable');
    const invalid=Reflect.apply(createWorkOwner,undefined,[boundary,async()=>true]);assert.equal((await invalid.claim(context('invalid_policy'))).kind,'unavailable');
    assert.equal((await admin`select count(*)::text from dread_work.jobs`.raw())[0][0]?.toString(),'0');
  });

  await t.test('database constraints preserve owner relationships, budgets and retained attempts',async()=>{
    const original=value(await owner.enqueue(context('enqueue'),command()));
    await assert.rejects(admin`update dread_work.jobs set decoded_bytes=268435457 where company_id='company_a'`.raw(),{code:'23514'});
    await assert.rejects(admin`insert into dread_work.attempts(company_id,job_id,attempt_token,ordinal,operation_id,outcome) values('company_b',${original.jobId}::uuid,'11111111-1111-4111-8111-111111111111',1,'forged','running')`.raw(),{code:'23503'});
    const runtime=postgres({...config,ssl:{ca:config.ca,rejectUnauthorized:true},channel_binding:'require',max:1,fetch_types:false,onnotice:false});
    try{await assert.rejects(runtime`delete from dread_work.jobs`.raw(),{code:'42501'});await assert.rejects(runtime`delete from dread_work.attempts`.raw(),{code:'42501'});}
    finally{await runtime.end({timeout:0});}
    assert.equal((await admin`select count(*)::text from dread_work.jobs`.raw())[0][0]?.toString(),'1');
  });

  await t.test('revoked queued work becomes blocked; forged and cross-company fences never reach a result owner',async()=>{
    value(await owner.enqueue(context('enqueue'),command()));
    await admin`update fixture.grants set enabled=false where company_id='company_a'`.raw();
    assert.equal(value(await owner.claim(context('blocked'))).kind,'blocked');
    assert.equal((await admin`select count(*)::text from dread_work.attempts`.raw())[0][0]?.toString(),'0');
    await admin`update fixture.grants set enabled=true where company_id='company_a'`.raw();
    value(await owner.enqueue(context('enqueue_b'),command('event_b')));const job=await claimed('claim_b');
    for(const input of [null,{...fence(job),extra:true},{...fence(job),version:0},{...fence(job),attemptToken:'bad'},Object.create(fence(job))])assert.equal((await owner.renew(context('bad_fence'),input)).kind,'invalid');
    assert.equal((await owner.renew(context('forged_token'),{...fence(job),attemptToken:'11111111-1111-4111-8111-111111111111'})).kind,'conflict');
    const b=workFixture(config,'worker_b');let committed=false;
    try{assert.equal((await b.owner.complete(context('cross_company','company_b'),fence(job),async()=>{committed=true;})).kind,'not_found');assert.equal(committed,false);}
    finally{await b.boundary.close();}
    assert.equal((await owner.debit(context('bad_budget'),fence(job),{decodedBytes:-1,treeEntries:0,activeMs:0})).kind,'invalid');
    assert.equal(value(await owner.renew(context('unchanged_fence'),fence(job))).version,job.version);
  });

  await t.test('one installation slot is atomic across companies and unknown claim retries return the same attempt',async()=>{
    const b=workFixture(config,'worker_b');try{
      value(await owner.enqueue(context('enqueue_a'),command()));value(await b.owner.enqueue(context('enqueue_b','company_b'),command()));
      const results=await Promise.all([owner.claim(context('claim_a')),b.owner.claim(context('claim_b','company_b'))]);
      assert.equal(results.filter(x=>x.kind==='committed' && x.value.kind==='claimed').length,1);
      assert.equal((await admin`select count(*)::text from dread_work.jobs where state='running'`.raw())[0][0]?.toString(),'1');
      const first=results[0].kind==='committed' && results[0].value.kind==='claimed';
      const repeated=value(await (first?owner:b.owner).claim(context(first?'claim_a':'claim_b',first?'company_a':'company_b')));
      assert.equal(repeated.kind,'claimed');assert.equal(repeated.job.attempts,1);
      assert.equal((await admin`select count(*)::text from dread_work.attempts`.raw())[0][0]?.toString(),'1');
    }finally{await b.boundary.close();}
  });

  await t.test('another enabled service principal cannot claim, block, recover or commit work it does not own',async()=>{
    value(await owner.enqueue(context('enqueue'),command()));
    const other=workFixture(config,'worker_other');
    try {
      assert.equal((await other.owner.claim(context('wrong_owner'))).kind,'not_found');
      assert.equal((await admin`select state from dread_work.jobs`.raw())[0][0]?.toString(),'queued');
      const job=await claimed('original_claim');let called=false;
      assert.equal((await other.owner.complete(context('forged_owner'),fence(job),async()=>{called=true;})).kind,'not_found');assert.equal(called,false);
      assert.equal((await other.owner.renew(context('unknown_fence'),{...fence(job),attemptToken:'11111111-1111-4111-8111-111111111111'})).kind,'not_found');
      await admin`update dread_work.jobs set lease_until=clock_timestamp()-interval '1 second' where company_id='company_a'`.raw();
      assert.equal((await other.owner.recover(context('wrong_recovery'))).kind,'not_found');
      assert.equal((await admin`select outcome from dread_work.attempts`.raw())[0][0]?.toString(),'running');
      assert.deepEqual(value(await owner.recover(context('correct_recovery'))),{recovered:1,blocked:0,more:false});
      const next=await claimed('next_claim');value(await owner.complete(context('completed'),fence(next),async()=>true));
      assert.equal((await other.owner.claim(context('original_claim'))).kind,'not_found');
    }finally{await other.boundary.close();}
  });

  await t.test('SIGKILL retains original event, attempt and budget; fresh startup recovery replaces its fencing token',async()=>{
    const original=value(await owner.enqueue(context('enqueue'),command()));
    await crashedClaim(config);
    const old=(await admin`select attempt_token::text,version::text from dread_work.jobs where company_id='company_a' and job_id=${original.jobId}::uuid`.raw())[0];
    await admin`update dread_work.jobs set lease_until=clock_timestamp()-interval '1 second' where company_id='company_a'`.raw();
    const fresh=workFixture(config);const stop=new AbortController();const ticks=recoveryWakeups(stop.signal);
    try {
      assert.equal((await ticks.next()).done,false);assert.deepEqual(value(await fresh.owner.recover(context('startup'))),{recovered:1,blocked:0,more:false});
      const next=value(await fresh.owner.claim(context('reclaimed')));assert.equal(next.kind,'claimed');
      assert.equal(next.job.jobId,original.jobId);assert.equal(next.job.eventId,original.eventId);assert.equal(next.job.eventRevision,original.eventRevision);
      assert.notEqual(next.job.attemptToken,old[0]?.toString());assert.equal(next.job.attempts,2);
      assert.deepEqual([next.job.decodedBytes,next.job.treeEntries,next.job.activeMs],[1024,3,50]);
      let commits=0;
      const stale={jobId:original.jobId,attemptToken:old[0]?.toString(),version:Number(old[1]?.toString())};
      assert.equal((await fresh.owner.complete(context('stale'),stale,async()=>{commits++;})).kind,'conflict');assert.equal(commits,0);
      assert.equal((await fresh.owner.claim(context('crashed_claim'))).kind,'conflict');
      assert.deepEqual((await admin`select outcome from dread_work.attempts order by ordinal`.raw()).map(row=>row[0]?.toString()),['interrupted','running']);
    }finally{stop.abort();await ticks.return();await fresh.boundary.close();}
  });

  await t.test('current grant, repository revision and source validity are checked again at renewal and commit',async()=>{
    value(await owner.enqueue(context('enqueue'),command()));const job=await claimed('claim');let commits=0;
    await admin`update fixture.grants set enabled=false where company_id='company_a'`.raw();
    assert.equal((await owner.renew(context('renew'),fence(job))).kind,'not_found');
    assert.equal((await owner.debit(context('debit'),fence(job),{decodedBytes:1,treeEntries:1,activeMs:1})).kind,'not_found');
    assert.equal((await owner.complete(context('complete'),fence(job),async()=>{commits++;})).kind,'not_found');
    await admin`update fixture.grants set enabled=true,revision=2 where company_id='company_a'`.raw();
    assert.equal((await owner.renew(context('grant_revision'),fence(job))).kind,'not_found');
    await admin`update fixture.grants set revision=1 where company_id='company_a'`.raw();await admin`update fixture.repositories set revision=2 where company_id='company_a'`.raw();
    assert.equal((await owner.renew(context('repository_revision'),fence(job))).kind,'not_found');
    await admin`update fixture.repositories set revision=1 where company_id='company_a'`.raw();await admin`update fixture.events set enabled=false where company_id='company_a'`.raw();
    assert.equal((await owner.renew(context('source_revoked'),fence(job))).kind,'not_found');assert.equal(commits,0);
    await admin`update dread_work.jobs set lease_until=clock_timestamp()-interval '1 second' where company_id='company_a'`.raw();
    assert.deepEqual(value(await owner.recover(context('recover_revoked'))),{recovered:0,blocked:1,more:false});
    assert.equal(value(await owner.claim(context('no_restart'))).kind,'idle');
  });

  await t.test('recovery is bounded to ten rows and unavailable authority rolls back the entire page',async()=>{
    await admin`insert into fixture.events select 'company_a','page_'||i::text,1,true from generate_series(0,10) i`.raw();
    for(let i=0;i<11;i++) {
      value(await owner.enqueue(context('enqueue_page_'+i),command('page_'+i)));const job=await claimed('claim_page_'+i);
      await admin`update dread_work.jobs set lease_until=clock_timestamp()-interval '1 second' where company_id='company_a' and job_id=${job.jobId}::uuid`.raw();
    }
    let checked=0;
    const unavailable=createWorkOwner(boundary,async(tx,target,phase)=>phase==='recover' && ++checked===2?'unavailable':authority(tx,target,phase));
    assert.equal((await unavailable.recover(context('partial_failure'))).kind,'unavailable');
    assert.equal((await admin`select count(*)::text from dread_work.attempts where outcome='interrupted'`.raw())[0][0]?.toString(),'0');
    assert.deepEqual(value(await owner.recover(context('page_one'))),{recovered:10,blocked:0,more:true});
    assert.deepEqual(value(await owner.recover(context('page_two'))),{recovered:1,blocked:0,more:false});
    assert.equal((await admin`select count(*)::text from dread_work.jobs where state='queued'`.raw())[0][0]?.toString(),'11');
  });

  await t.test('budget reservations are cumulative, versioned, immutable across recovery and terminal on exhaustion',async()=>{
    value(await owner.enqueue(context('enqueue'),command()));const job=await claimed('claim');
    const debit=value(await owner.debit(context('reserve'),fence(job),{decodedBytes:268435455,treeEntries:100000,activeMs:900000}));assert.equal(debit.kind,'reserved');
    assert.equal((await owner.renew(context('old_version'),fence(job))).kind,'conflict');
    const renewed=value(await owner.renew(context('renew'),fence(debit.job)));assert.equal(renewed.version,debit.job.version);
    const exhausted=value(await owner.debit(context('exhaust'),fence(renewed),{decodedBytes:2,treeEntries:0,activeMs:0}));
    assert.deepEqual(exhausted,{kind:'exhausted',boundary:'decodedBytes',limit:268435456});
    const state=(await admin`select state,decoded_bytes::text from dread_work.jobs`.raw())[0];assert.deepEqual(state.map(x=>x?.toString()),['failed','268435455']);
    assert.equal((await owner.complete(context('after_limit'),fence(renewed),async()=>{})).kind,'conflict');
    assert.equal(value(await owner.claim(context('no_retry'))).kind,'idle');
  });

  await t.test('result commit is atomic and denied after lease expiry, cancellation, owner failure or final authority change',async()=>{
    value(await owner.enqueue(context('enqueue'),command()));let job=await claimed('claim');
    assert.equal((await owner.complete(context('failure'),fence(job),async(tx,record)=>{await tx.query('result_write',[record.jobId,'secret-must-rollback']);throw Error('secret-error');})).kind,'unavailable');
    assert.equal((await owner.complete(context('final_recheck'),fence(job),async(tx,record)=>{await tx.query('result_write',[record.jobId,'secret-must-rollback']);await tx.query('revoke',['grant_a']);})).kind,'denied');
    assert.equal((await admin`select count(*)::text from fixture.results`.raw())[0][0]?.toString(),'0');
    await admin`update dread_work.jobs set lease_until=clock_timestamp()+interval '1 second' where company_id='company_a'`.raw();
    const expired=await owner.complete(context('late'),fence(job),async(tx,record)=>{await delay(1100);await tx.query('result_write',[record.jobId,'late-private']);});assert.equal(expired.kind,'conflict');
    assert.equal((await admin`select count(*)::text from fixture.results`.raw())[0][0]?.toString(),'0');
    value(await owner.recover(context('recover')));job=await claimed('claim_again');
    const abort=new AbortController();
    const cancelled=await owner.complete({...context('cancel'),signal:abort.signal},fence(job),async(tx,record)=>{await tx.query('result_write',[record.jobId,'cancelled-private']);abort.abort();});assert.equal(cancelled.kind,'cancelled');
    assert.equal((await admin`select count(*)::text from fixture.results`.raw())[0][0]?.toString(),'0');
    const completed=await owner.complete(context('success'),fence(job),async(tx,record)=>{await tx.query('result_write',[record.jobId,'safe-result']);return 'saved';});assert.equal(value(completed),'saved');
    assert.equal((await admin`select state from dread_work.jobs`.raw())[0][0]?.toString(),'succeeded');
    let duplicated=false;assert.equal((await owner.complete(context('duplicate'),fence(job),async()=>{duplicated=true;})).kind,'conflict');assert.equal(duplicated,false);
  });
});
