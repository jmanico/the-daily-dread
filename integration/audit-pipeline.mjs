import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { startPostgres } from '../test-support/postgres-container.mjs';
import { auditFixture } from '../test-support/audit-owner.mjs';
import { serializeFoundationEvent } from '../src/audit/envelope.js';
import { createApplication,HttpFailure } from '../src/http/application.js';
import { independentObservations } from '../src/audit/independent-monitor.js';
import { createAuditPipeline } from '../src/audit/pipeline.js';
/** @param {string} operationId @param {string} [companyId] */
const context=(operationId,companyId='company_a')=>({companyId,operationId,signal:new AbortController().signal,timeoutMs:1000});
/** @template T @param {{kind:string,value?:T}} result @returns {T} */
function value(result){assert.equal(result.kind,'committed');if(result.value===undefined)throw Error('Missing committed value');return result.value;}
function record(operation='operation_a',eventId=randomUUID(),company='company_a',outcome='denied',reason='access_denied') {
  const result=serializeFoundationEvent('dread.audit.config_change',{event_id:eventId,producer_ref:'producer_a',timestamp:'2026-11-05T10:00:00.000Z',environment:'test',actor_kind:'user',actor_ref:'actor_a',actor_provenance:'verified_session',tenant_ref:company,operation_ref:operation},
    {outcome,reason_code:reason,config_ref:'config_a',revision_ref:'revision_a',change_kind:'configure'});assert.equal(result.status,'accepted');return JSON.parse(result.json);
}

test('bounded audit delivery authenticates producer scope and persists immutable outcomes on PostgreSQL 18.6',{timeout:90000},async t=>{
  const fixture=await startPostgres();t.after(()=>fixture.close());
  const admin=postgres({...fixture.config,ssl:{ca:fixture.config.ca,rejectUnauthorized:true},channel_binding:'require',max:2,fetch_types:false,onnotice:false});t.after(()=>admin.end({timeout:0}));
  for(const migration of ['002-administrative-audit.sql','003-audit-pipeline.sql'])await admin.unsafe(await readFile(new URL(`../db/${migration}`,import.meta.url),'utf8')).raw();
  await admin.unsafe(`create role audit_writer login password 'synthetic-writer' nosuperuser nocreatedb nocreaterole noinherit;
    create role audit_monitor login password 'synthetic-monitor' nosuperuser nocreatedb nocreaterole noinherit;
    create schema fixture;
    create table fixture.producers(company_id text,actor_id text,producer_ref text,mode text,enabled boolean,primary key(company_id,actor_id,mode));
    insert into fixture.producers values('company_a','writer_a','producer_a','append',true),('company_b','writer_b','producer_a','append',true),('company_a','monitor_a','producer_a','probe',true);
    grant usage on schema dread_audit,fixture to audit_writer,audit_monitor;
    grant select,update on fixture.producers to audit_writer,audit_monitor;
    grant select,insert on dread_audit.events,dread_audit.conflicts to audit_writer;
    grant select,insert,update on dread_audit.checkpoints to audit_writer;
    grant select on dread_audit.checkpoints to audit_monitor;
    grant select,insert,update on dread_audit.probes to audit_monitor;`).raw();
  const writerConfig={...fixture.config,user:'audit_writer',password:'synthetic-writer'},monitorConfig={...fixture.config,user:'audit_monitor',password:'synthetic-monitor'};
  const {receiver,boundary}=auditFixture(writerConfig,'writer_a'),monitor=auditFixture(monitorConfig,'monitor_a');t.after(()=>boundary.close());t.after(()=>monitor.boundary.close());
  t.beforeEach(async()=>{await admin.unsafe('truncate dread_audit.conflicts,dread_audit.mutation_receipts,dread_audit.events,dread_audit.checkpoints,dread_audit.probes; update fixture.producers set enabled=true').raw();});
  async function counts(){return (await admin`select (select count(*) from dread_audit.events)::text,(select count(*) from dread_audit.conflicts)::text`.raw())[0].map(x=>x?.toString());}
  const makePipeline=async()=>{const generation=value(await receiver.start(context('boot'))).generation;return createAuditPipeline({snapshot:receiver.snapshot,append:receiver.append,probe:async signal=>{
    const checked=await receiver.check({...context('check'),signal});
    const probed=await monitor.receiver.probe({...context('probe'),timeoutMs:2000,signal});
    return checked.kind==='committed' && checked.value.ready===true && probed.kind==='committed';
  }},generation);};

  await t.test('same event retransmissions deduplicate only identical producer bytes and retain distinct outcomes',async()=>{
    const r=record();assert.equal(value(await receiver.append(context('operation_a'),r)).kind,'appended');
    assert.equal(value(await receiver.append(context('operation_a'),Object.fromEntries(Object.entries(r).reverse()))).kind,'duplicate');
    for(const [outcome,reason] of [['attempted','requested'],['failure','storage_unavailable'],['rolled_back','canceled'],['unknown','outcome_unknown']])assert.equal(value(await receiver.append(context('operation_a'),record('operation_a',randomUUID(),'company_a',outcome,reason))).kind,'appended');
    assert.deepEqual(await counts(),['5','0']);
    const rows=await admin`select encoded,ingested_at from dread_audit.events`.raw();for(const row of rows){const parsed=JSON.parse(row[0].toString());assert.equal(parsed.producer_ref,'producer_a');assert.equal(parsed.tenant_ref,'company_a');assert.ok(row[1]);assert.equal('ingested_timestamp' in parsed,false);}
    const observed=value(await monitor.receiver.probe({...context('probe'),timeoutMs:2000}));assert.equal(observed.checkpoint,6);assert.equal(observed.sequence,1);
  });

  await t.test('boot generations are durable, scoped and refuse overflow; failed outcomes cannot become success receipts',async()=>{
    assert.equal(value(await receiver.start(context('boot_a'))).generation,1);assert.equal(value(await receiver.start(context('boot_b'))).generation,2);
    assert.equal(value(await monitor.receiver.probe(context('probe'))).generation,2);
    assert.equal((await monitor.receiver.start(context('forged_boot'))).kind,'denied');
    const r=record();value(await receiver.append(context('operation_a'),r));
    await assert.rejects(admin`insert into dread_audit.mutation_receipts(company_id,producer_ref,operation_ref,event_id) values('company_a','producer_a','operation_a',${r.event_id}::uuid)`.raw(),{code:'23503'});
    await admin`update dread_audit.checkpoints set generation=9007199254740991 where company_id='company_a'`.raw();
    assert.equal((await receiver.start(context('exhausted_boot'))).kind,'unavailable');assert.equal(value(await monitor.receiver.probe(context('probe'))).generation,Number.MAX_SAFE_INTEGER);
  });

  await t.test('authenticated producer namespace, current revocation and company scope precede any storage',async()=>{
    const b=auditFixture(writerConfig,'writer_b');try{
      assert.equal((await b.receiver.append(context('operation_a'),record())).kind,'denied');
      assert.equal(value(await b.receiver.append(context('operation_b','company_b'),record('operation_b',randomUUID(),'company_b'))).kind,'appended');
    }finally{await b.boundary.close();}
    assert.equal((await receiver.append(context('operation_a'),{...record(),tenant_ref:'company_b'})).kind,'invalid');
    assert.equal((await receiver.append(context('operation_a'),{...record(),producer_ref:'forged'})).kind,'invalid');
    await admin`update fixture.producers set enabled=false where actor_id='writer_a'`.raw();assert.equal((await receiver.append(context('operation_a'),record())).kind,'denied');
    assert.equal((await monitor.receiver.append(context('operation_a'),record())).kind,'denied');assert.equal((await receiver.probe(context('probe'))).kind,'denied');assert.deepEqual(await counts(),['1','0']);
  });

  await t.test('conflicting valid IDs retain both safe versions without overwriting history or claiming success',async()=>{
    const r=record();value(await receiver.append(context('operation_a'),r));
    const conflict={...r,revision_ref:'revision_b'};assert.equal(value(await receiver.append(context('operation_a'),conflict)).kind,'conflicting_id');assert.deepEqual(await counts(),['1','1']);
    const row=(await admin`select e.encoded,c.candidate from dread_audit.events e join dread_audit.conflicts c on c.company_id=e.company_id and c.producer_ref=e.producer_ref and c.event_id=e.event_id`.raw())[0];
    assert.equal(JSON.parse(row[0].toString()).revision_ref,'revision_a');assert.equal(JSON.parse(row[1].toString()).revision_ref,'revision_b');
    const pipeline=await makePipeline();await pipeline.recover();assert.equal((await pipeline.enqueue(context('operation_a'),conflict)).kind,'conflict');assert.equal(pipeline.status().ready,false);assert.equal(pipeline.status().errorCode,'conflicting_id');await pipeline.shutdown();
  });

  await t.test('consumer rejects corrupted stored projections before deduplication or conflict quarantine',async()=>{
    const r=record();value(await receiver.append(context('operation_a'),r));
    // Privileged fixture simulates storage corruption; application roles cannot
    // rewrite this history. The consumer must not promote it into safe evidence.
    await admin`update dread_audit.events set encoded=${JSON.stringify({...r,raw:'PRIVATE_STORAGE_CANARY'})} where event_id=${r.event_id}::uuid`.raw();
    const result=await receiver.append(context('operation_a'),{...r,revision_ref:'revision_b'});assert.equal(result.kind,'unavailable');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_STORAGE_CANARY/);assert.deepEqual(await counts(),['1','0']);
  });

  await t.test('malformed/oversize input and fabricated success never enter storage or conflict quarantine',async()=>{
    for(const r of [null,{},Object.create(record()),{...record(),raw:'SECRET_CANARY'},{...record(),actor_ref:'x'.repeat(8193)},{...record(),schema_version:2},record('operation_a',randomUUID(),'company_a','success','committed')])assert.equal((await receiver.append(context('operation_a'),r)).kind,'invalid');
    let invoked=0;const r=Object.defineProperty(record(),'actor_ref',{get(){invoked++;throw Error('SECRET_CANARY');}});assert.equal((await receiver.append(context('operation_a'),r)).kind,'invalid');assert.equal(invoked,0);assert.deepEqual(await counts(),['0','0']);
  });

  await t.test('writer/monitor credentials enforce separate storage privileges and readiness detects revoked grants',async()=>{
    assert.equal(value(await receiver.check(context('check'))).ready,true);
    const writer=postgres({...writerConfig,ssl:{ca:writerConfig.ca,rejectUnauthorized:true},channel_binding:'require',fetch_types:false,onnotice:false});
    const reader=postgres({...monitorConfig,ssl:{ca:monitorConfig.ca,rejectUnauthorized:true},channel_binding:'require',fetch_types:false,onnotice:false});
    try{
      for(const sql of ['select encoded from dread_audit.events','select candidate from dread_audit.conflicts','select * from dread_audit.mutation_receipts','delete from dread_audit.checkpoints'])await assert.rejects(reader.unsafe(sql).raw(),{code:'42501'});
      for(const sql of ['update dread_audit.events set encoded=encoded','delete from dread_audit.events','truncate dread_audit.events cascade','update dread_audit.conflicts set candidate=candidate','delete from dread_audit.conflicts','select * from dread_audit.probes'])await assert.rejects(writer.unsafe(sql).raw(),{code:'42501'});
    }finally{await writer.end({timeout:0});await reader.end({timeout:0});}
    await admin`revoke insert on dread_audit.events from audit_writer`.raw();
    const pipeline=await makePipeline();try{assert.equal(value(await receiver.check(context('check'))).ready,false);assert.equal(await pipeline.recover(),false);assert.equal((await pipeline.enqueue(context('operation_a'),record())).kind,'unrecorded');assert.deepEqual(await counts(),['0','0']);}
    finally{await pipeline.shutdown();await admin`grant insert on dread_audit.events to audit_writer`.raw();}
  });

  await t.test('failed quarantine rolls back safely and exposes only categorical pipeline failure',async()=>{
    const r=record();value(await receiver.append(context('operation_a'),r));await admin`revoke insert on dread_audit.conflicts from audit_writer`.raw();
    const pipeline=await makePipeline();try{assert.equal(await pipeline.recover(),false);assert.equal((await pipeline.enqueue(context('operation_a'),{...r,revision_ref:'revision_b'})).kind,'unrecorded');assert.equal(pipeline.status().ready,false);assert.deepEqual(await counts(),['1','0']);}
    finally{await pipeline.shutdown();await admin`grant insert on dread_audit.conflicts to audit_writer`.raw();}
  });

  await t.test('concurrent duplicate writes and a real lock timeout preserve bounds and cancel the database operation',async()=>{
    const r=record();const results=await Promise.all([receiver.append(context('operation_a'),r),receiver.append(context('operation_a'),r)]);assert.ok(results.every(x=>['committed','retryable'].includes(x.kind)));assert.deepEqual(await counts(),['1','0']);
    let entered=()=>{},release=()=>{};const ready=new Promise(resolve=>{entered=()=>resolve(undefined);});const gate=new Promise(resolve=>{release=()=>resolve(undefined);});
    const holder=admin.begin(async tx=>{await tx`lock table dread_audit.events in access exclusive mode`.raw();entered();await gate;});await ready;
    const pipeline=await makePipeline();try{const start=performance.now();assert.ok(['unknown','unrecorded'].includes((await pipeline.enqueue(context('locked'),record('locked'))).kind));assert.ok(performance.now()-start<2000);assert.equal(pipeline.status().ready,false);}
    finally{release();await holder;await pipeline.shutdown();}
    assert.deepEqual(await counts(),['1','0']);
  });

  await t.test('actual HTTP admission preserves authentication denials and blocks protected work until audit recovery',async()=>{
    const pipeline=await makePipeline();let reached=0;
    const app=createApplication(async request=>{if(request.headers['x-fixture-auth']!=='valid')return 'unauthenticated';if(!pipeline.status().ready)throw new HttpFailure(503);return 'allowed';});
    app.get('/protected-check',async()=>{reached++;return {status:'available'};});
    const allowed={url:'/protected-check',headers:{'x-fixture-auth':'valid'}};
    try{
      assert.equal((await app.inject('/protected-check')).statusCode,401);assert.equal((await app.inject(allowed)).statusCode,503);assert.equal(reached,0);
      assert.equal(await pipeline.recover(),true);assert.equal((await app.inject(allowed)).statusCode,200);assert.equal(reached,1);
      await pipeline.enqueue(context('invalid'),{raw:'SECRET_CANARY'});assert.equal((await app.inject(allowed)).statusCode,503);assert.equal((await app.inject('/protected-check')).statusCode,401);assert.equal(reached,1);
      await admin`revoke insert on dread_audit.events from audit_writer`.raw();try{assert.equal(await pipeline.recover(),false);assert.equal((await app.inject(allowed)).statusCode,503);}finally{await admin`grant insert on dread_audit.events to audit_writer`.raw();}
      assert.equal(await pipeline.recover(),true);assert.equal((await app.inject(allowed)).statusCode,200);assert.equal(reached,2);
    }finally{await app.close();await pipeline.shutdown();}
  });

  await t.test('independent observation reports actual PostgreSQL probe privilege loss without event access',async()=>{
    const boot=value(await receiver.start(context('monitor_boot'))).generation;let sequence=0;const controller=new AbortController();
    const iterator=independentObservations({heartbeat:async()=>({generation:boot,ready:true,closed:false,active:0,pending:0,bytes:0,dropped:0,checkpoint:0,sequence:++sequence,errorCode:'healthy'}),probe:async signal=>{
      const result=await monitor.receiver.probe({...context('probe'),signal,timeoutMs:2000});if(result.kind!=='committed')throw Error('Synthetic probe failed');return result.value;
    }},controller.signal);
    const first=await iterator.next();assert.equal(first.value?.status,'unknown');
    await admin`revoke insert on dread_audit.probes from audit_monitor`.raw();
    try{const next=await iterator.next();assert.equal(next.value?.errorCode,'probe_unavailable');assert.equal((await iterator.next()).done,true);assert.deepEqual(await counts(),['0','0']);}
    finally{controller.abort();await admin`grant insert on dread_audit.probes to audit_monitor`.raw();}
  });

  await t.test('unknown standalone commit is not retried by the pipeline and explicit retransmission deduplicates',async()=>{
    const pipeline=await makePipeline();await pipeline.recover();await admin`alter system set synchronous_standby_names='*'`.raw();await admin`select pg_reload_conf()`.raw();
    const r=record('unknown_commit');try{
      await delay(100);const pending=pipeline.enqueue(context('unknown_commit'),r);let waiting=false;
      for(let i=0;i<50;i++){if((await admin`select pid from pg_stat_activity where usename='audit_writer' and wait_event='SyncRep'`.raw()).length===1){waiting=true;break;}await delay(10);}
      assert.equal(waiting,true);assert.equal((await pending).kind,'unknown');assert.equal(pipeline.status().ready,false);
      await admin`alter system reset synchronous_standby_names`.raw();await admin`select pg_reload_conf()`.raw();
      for(let i=0;i<50;i++){if((await counts())[0]==='1')break;await delay(10);}
      assert.equal(value(await receiver.append(context('unknown_commit'),r)).kind,'duplicate');assert.deepEqual(await counts(),['1','0']);
    }finally{await admin`alter system reset synchronous_standby_names`.raw();await admin`select pg_reload_conf()`.raw();await pipeline.shutdown();}
  });
});
