import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { serializeFoundationEvent } from '../src/audit/envelope.js';
import { receiveConfigurationRecord } from '../src/audit/received-record.js';
import { createAuditPipeline as createPipelineWithGeneration } from '../src/audit/pipeline.js';
import { createHealthObserver,independentObservations } from '../src/audit/independent-monitor.js';
/** @param {import('../src/audit/pipeline.js').Adapter} adapter */
const createAuditPipeline=adapter=>createPipelineWithGeneration(adapter,1);
const context=()=>({companyId:'company_a',operationId:'operation_a',signal:new AbortController().signal,timeoutMs:1000});
function record(){const result=serializeFoundationEvent('dread.audit.config_change',{event_id:'12345678-1234-4234-8234-123456789abc',producer_ref:'producer_a',timestamp:'2026-11-05T10:00:00.000Z',environment:'test',actor_kind:'user',actor_ref:'actor_a',actor_provenance:'verified_session',tenant_ref:'company_a',operation_ref:'operation_a'},
  {outcome:'denied',reason_code:'access_denied',config_ref:'config_a',revision_ref:'revision_a',change_kind:'configure'});assert.equal(result.status,'accepted');return JSON.parse(result.json);}
/** @param {unknown} input @param {string} company */
const snapshot=(input,company)=>receiveConfigurationRecord(input,'producer_a','test',company);
const healthy=()=>({generation:1,ready:true,closed:false,active:0,pending:0,bytes:0,dropped:0,checkpoint:0,sequence:1,errorCode:'healthy'});
const probe=(sequence=1,checkpoint=0)=>({sequence,checkpoint,generation:1});

 test('received projection is closed, canonical, immutable and cannot trust submitted namespace or policy',()=>{
  const original=record();const received=snapshot(original,'company_a');assert.ok(received);assert.ok(Object.isFrozen(received.record));original.actor_ref='changed';assert.equal(received.record.actor_ref,'actor_a');
  const reordered=Object.fromEntries(Object.entries(record()).reverse());assert.equal(snapshot(reordered,'company_a')?.json,received.json);
  for(const bad of [{...record(),producer_ref:'other'},{...record(),tenant_ref:'other'},{...record(),environment:'production'},{...record(),schema_version:2},{...record(),audit_required:false},{...record(),severity:'info'},{...record(),policy_ref:'caller'},{...record(),raw:'SECRET_CANARY'},{...record(),actor_ref:'x'.repeat(8193)},Object.create(record()),{...record(),ingested_timestamp:'forged'}])assert.equal(snapshot(bad,'company_a'),undefined);
  let gets=0;const accessor=Object.defineProperty(record(),'actor_ref',{get(){gets++;return 'SECRET_CANARY';}});assert.equal(snapshot(accessor,'company_a'),undefined);assert.equal(gets,0);
  assert.equal(snapshot({...record(),context_status:'optional_context_invalid'},'company_a')?.record.context_status,'optional_context_invalid');
});

test('startup and recovery require successful drained probes, preserving failure counters and immutable queued bytes',async()=>{
  let works=0,probes=0,available=false,captured;
  const pipeline=createAuditPipeline({snapshot,probe:async()=>{probes++;return available;},append:async(_context,input)=>{works++;captured=input;return {kind:'committed',value:{kind:'appended'}};}});
  assert.equal(pipeline.status().ready,false);assert.equal(await pipeline.recover(),false);available=true;assert.equal(await pipeline.recover(),true);
  const input=record();const pending=pipeline.enqueue(context(),input);input.actor_ref='changed';assert.deepEqual(await pending,{kind:'recorded'});assert.equal(JSON.parse(JSON.stringify(captured)).actor_ref,'actor_a');assert.equal(works,1);assert.equal(probes,2);
  assert.equal((await pipeline.enqueue(context(),{...record(),raw:'SECRET_CANARY'})).kind,'unrecorded');assert.equal(pipeline.status().ready,false);assert.equal(pipeline.status().dropped,1);assert.doesNotMatch(JSON.stringify(pipeline.status()),/SECRET_CANARY/);
  await delay(0);assert.equal(await pipeline.recover(),true);assert.equal(pipeline.status().dropped,1);assert.equal(await pipeline.shutdown(),true);assert.equal((await pipeline.enqueue(context(),record())).kind,'unrecorded');
});

test('two active and 128 pending records bound admission; saturation is visible and never grows replacement tasks',{timeout:5000},async()=>{
  let active=0,peak=0;
  /** @type {Array<()=>void>} */const releases=[];
  const pipeline=createAuditPipeline({snapshot,probe:async()=>true,append:async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>releases.push(()=>resolve(undefined)));active--;return {kind:'committed',value:{kind:'appended'}};}});
  assert.equal(await pipeline.recover(),true);
  const entries=Array.from({length:130},()=>pipeline.enqueue(context(),record()));assert.equal(pipeline.status().active,2);assert.equal(pipeline.status().pending,128);assert.ok(pipeline.status().bytes<=1048576);
  assert.equal((await pipeline.enqueue(context(),record())).kind,'unrecorded');assert.equal(pipeline.status().errorCode,'queue_full');assert.equal(await pipeline.recover(),false);
  for(let completed=0;completed<130;completed+=2){for(const release of releases.splice(0))release();await delay(0);}
  assert.ok((await Promise.all(entries)).every(x=>x.kind==='recorded'));await delay(0);assert.equal(peak,2);assert.equal(pipeline.status().bytes,0);assert.equal(pipeline.status().pending,0);assert.equal(pipeline.status().ready,false);assert.equal(await pipeline.recover(),true);await pipeline.shutdown();
});

test('one transient retry reuses the identical event and operation; unknown, denial and conflict never retry',async()=>{
  for(const kind of ['retryable','unknown','denied','unavailable','conflicting_id']){
    /** @type {Array<{ctx:import('../src/persistence/transactions.js').Context,input:unknown}>} */const calls=[];const pipeline=createAuditPipeline({snapshot,probe:async()=>true,append:async(ctx,input)=>{calls.push({ctx,input});return kind==='retryable' && calls.length===2?{kind:'committed',value:{kind:'duplicate'}}:kind==='conflicting_id'?{kind:'committed',value:{kind}}:{kind};}});
    await pipeline.recover();const result=await pipeline.enqueue(context(),record());assert.equal(calls.length,kind==='retryable'?2:1);
    assert.equal(result.kind,kind==='retryable'?'recorded':kind==='unknown'?'unknown':kind==='conflicting_id'?'conflict':'unrecorded');
    if(calls.length===2){assert.equal(calls[0].input,calls[1].input);assert.equal(calls[0].ctx.operationId,calls[1].ctx.operationId);assert.ok(calls[1].ctx.timeoutMs<=calls[0].ctx.timeoutMs);}
    await pipeline.shutdown();
  }
});

test('actual one-second deadline cancels storage and excludes late success; queued cancellation removes bytes',async()=>{
  let canceled=false;
  const pipeline=createAuditPipeline({snapshot,probe:async()=>true,append:async(ctx)=>{await new Promise(resolve=>ctx.signal.addEventListener('abort',()=>{canceled=true;resolve(undefined);},{once:true}));return {kind:'committed',value:{kind:'appended'}};}});
  await pipeline.recover();const start=performance.now();const active=[pipeline.enqueue(context(),record()),pipeline.enqueue(context(),record())];
  const controller=new AbortController(),pending=pipeline.enqueue({...context(),signal:controller.signal},record());assert.ok(pipeline.status().bytes>0);controller.abort();assert.equal((await pending).kind,'unrecorded');assert.equal(pipeline.status().bytes,0);
  assert.ok((await Promise.all(active)).every(x=>x.kind==='unknown'));assert.ok(performance.now()-start>=900);assert.ok(performance.now()-start<2000);assert.equal(canceled,true);await delay(0);assert.equal(pipeline.status().checkpoint,0);assert.equal(pipeline.status().ready,false);assert.equal(await pipeline.shutdown(),true);
});

test('stuck adapter retains its slot and shutdown fails within five seconds without logging raw errors',{timeout:7000},async()=>{
  const pipeline=createAuditPipeline({snapshot,probe:async()=>true,append:async()=>new Promise(()=>{})});await pipeline.recover();
  const pending=pipeline.enqueue(context(),record());const start=performance.now();const stopped=pipeline.shutdown();assert.equal(pipeline.shutdown(),stopped);
  assert.equal((await pending).kind,'unknown');assert.equal(await stopped,false);assert.ok(performance.now()-start>=4900);assert.ok(performance.now()-start<6000);assert.equal(pipeline.status().active,1);assert.equal(pipeline.status().errorCode,'shutdown_timeout');
});

test('probe admission is bounded, aborts at two seconds and cannot clear a concurrent failure',async()=>{
  let canceled=false,calls=0;const pipeline=createAuditPipeline({snapshot,append:async()=>({kind:'unavailable'}),probe:async signal=>{calls++;await new Promise(resolve=>signal.addEventListener('abort',()=>{canceled=true;resolve(undefined);},{once:true}));return true;}});
  const start=performance.now(),pending=pipeline.recover();assert.equal(await pipeline.recover(),false);await pipeline.enqueue(context(),{});assert.equal(await pending,false);assert.equal(calls,1);assert.equal(canceled,true);assert.ok(performance.now()-start<3000);assert.equal(pipeline.status().ready,false);await pipeline.shutdown();
});

test('independent observer distinguishes idle, backlog stall, heartbeat silence, loss, restart and invalid probes',()=>{
  const observer=createHealthObserver();const h=healthy();assert.equal(observer.observe(h,probe(),0).status,'unknown');
  h.sequence++;assert.equal(observer.observe(h,probe(2),10000).status,'healthy');
  h.sequence++;assert.equal(observer.observe(h,probe(3),20000).status,'healthy');
  assert.equal(observer.observe(h,probe(4),50000).errorCode,'heartbeat_silence');
  h.sequence++;h.pending=1;assert.equal(observer.observe(h,probe(5),60000).status,'healthy');h.sequence++;assert.equal(observer.observe(h,probe(6),90000).errorCode,'pipeline_stalled');
  h.checkpoint++;h.sequence++;assert.equal(observer.observe(h,probe(7,1),91000).status,'healthy');
  h.dropped++;h.sequence++;assert.equal(observer.observe(h,probe(8,1),92000).errorCode,'unrecorded');
  assert.equal(observer.observe(healthy(),probe(9,1),93000).errorCode,'restart');
  assert.equal(observer.observe({...healthy(),sequence:2},probe(10,1),94000).status,'healthy');
  assert.equal(observer.observe({...healthy(),sequence:3},probe(10,1),95000).errorCode,'probe_stalled');
  assert.equal(observer.observe({...healthy(),secret:'CANARY'},probe(11),96000).errorCode,'invalid_observation');
  assert.equal(observer.observe(h,probe(11),100).errorCode,'invalid_observation');
  assert.equal(observer.observe(new Proxy({}, {getPrototypeOf(){throw Error('PRIVATE_CANARY');}}),probe(12),97000).errorCode,'invalid_observation');
});

test('monitor rejects throwing and blocked sources, honors cancellation and never overlaps a failed probe',async()=>{
  for(const throwing of [true,false]){
    let calls=0,canceled=false;
  /** @type {import('../src/audit/independent-monitor.js').Source} */const source={heartbeat:async()=>healthy(),probe:async signal=>{calls++;if(throwing)throw Error('PRIVATE_MONITOR_CANARY');await new Promise(resolve=>signal.addEventListener('abort',()=>{canceled=true;resolve(undefined);},{once:true}));return probe();}};
    const start=performance.now(),iterator=independentObservations(source,new AbortController().signal);const result=await iterator.next();if(result.done)assert.fail('Missing monitor observation');assert.equal(result.value.errorCode,'probe_unavailable');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_MONITOR_CANARY/);assert.equal((await iterator.next()).done,true);assert.equal(calls,1);if(!throwing)assert.equal(canceled,true);assert.ok(performance.now()-start<3000);
  }
  const stopped=new AbortController();stopped.abort();assert.equal((await independentObservations({heartbeat:async()=>{assert.fail();},probe:async()=>{assert.fail();}},stopped.signal).next()).done,true);
});


test('durable boot generations reveal a restart even when process sequence and counters are reused',()=>{
  const observer=createHealthObserver();assert.equal(observer.observe(healthy(),probe(),0).status,'unknown');
  assert.equal(observer.observe({...healthy(),sequence:2},probe(2),10000).status,'healthy');
  assert.equal(observer.observe({...healthy(),generation:2,sequence:2},{...probe(3),generation:2},20000).errorCode,'restart');
  assert.equal(observer.observe({...healthy(),generation:2,sequence:3},{...probe(4),generation:2},30000).status,'healthy');
  assert.equal(observer.observe({...healthy(),generation:1,sequence:4},{...probe(5),generation:2},40000).errorCode,'generation_mismatch');
  assert.throws(()=>createPipelineWithGeneration({snapshot,append:async()=>({kind:'unavailable'}),probe:async()=>true},0));
});

test('real process shutdown exits zero only after audit drain and exits nonzero for a stuck audit writer',{timeout:15000},async()=>{
  const {fork}=await import('node:child_process');
  for(const mode of ['clean','stuck']) {
    const child=fork(new URL('../test-support/audit-shutdown.mjs',import.meta.url),[mode],{stdio:['ignore','pipe','pipe','ipc'],env:{LANG:'C',TZ:'UTC'}});
    let output='',ready=false;for(const stream of [child.stdout,child.stderr])stream?.on('data',bytes=>{output+=String(bytes);if(output.length>8192)child.kill('SIGKILL');});
    child.once('message',()=>{ready=true;child.kill('SIGTERM');});
    const timer=setTimeout(()=>child.kill('SIGKILL'),8000);
    try{const result=await new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));assert.deepEqual(result,{code:mode==='clean'?0:75,signal:null});assert.equal(ready,true);assert.equal(output,'');}
    finally{clearTimeout(timer);if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL');}
  }
});
