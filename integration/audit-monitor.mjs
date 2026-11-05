import test from 'node:test';
import assert from 'node:assert/strict';
import { fork,execFileSync } from 'node:child_process';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { startPostgres } from '../test-support/postgres-container.mjs';
/** @param {import('node:child_process').ChildProcess} child @param {(message:unknown)=>boolean} predicate @param {number} timeoutMs */
function message(child,predicate,timeoutMs) {
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{cleanup();reject(Error('Fixture message deadline'));},timeoutMs);
    /** @param {unknown} value */const receive=value=>{if(predicate(value)){cleanup();resolve(value);}};
    const failed=()=>{cleanup();reject(Error('Fixture process exited before observation'));};
    function cleanup(){clearTimeout(timeout);child.off('message',receive);child.off('exit',failed);}
    child.on('message',receive);child.once('exit',failed);
  });
}
function launch(){
  const child=fork(new URL('../test-support/audit-monitor-process.mjs',import.meta.url),[],{stdio:['ignore','pipe','pipe','ipc'],env:{LANG:'C',TZ:'UTC'}});
  let output='';for(const stream of [child.stdout,child.stderr])stream?.on('data',bytes=>{output+=String(bytes);if(output.length>8192)child.kill('SIGKILL');});
  const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  return {child,output:()=>output,exited,async close(){if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL');await exited;}};
}

test('a separate process detects a SIGSTOP-frozen application through real heartbeat and PostgreSQL probes',{timeout:65000},async t=>{
  const database=await startPostgres();t.after(()=>database.close());
  const directory=await mkdtemp(join(tmpdir(),'dread-health-'));t.after(()=>rm(directory,{recursive:true,force:true}));const path=join(directory,'heartbeat.json');
  const admin=postgres({...database.config,ssl:{ca:database.config.ca,rejectUnauthorized:true},channel_binding:'require',fetch_types:false,onnotice:false});t.after(()=>admin.end({timeout:0}));
  for(const migration of ['002-administrative-audit.sql','003-audit-pipeline.sql'])await admin.unsafe(await readFile(new URL(`../db/${migration}`,import.meta.url),'utf8')).raw();
  await admin.unsafe(`create role audit_monitor login password 'synthetic-monitor' nosuperuser nocreatedb nocreaterole noinherit;
    create schema fixture;create table fixture.producers(company_id text,actor_id text,producer_ref text,mode text,enabled boolean);
    insert into fixture.producers values('company_a','monitor_a','producer_a','probe',true);
    insert into dread_audit.checkpoints(company_id,producer_ref,generation,sequence) values('company_a','producer_a',1,0);
    grant usage on schema dread_audit,fixture to audit_monitor;
    grant select,update on fixture.producers to audit_monitor;
    grant select on dread_audit.checkpoints to audit_monitor;
    grant select,insert,update on dread_audit.probes to audit_monitor;`).raw();
  const config={...database.config,user:'audit_monitor',password:'synthetic-monitor'};
  const producer=launch(),monitor=launch();t.after(()=>producer.close());t.after(()=>monitor.close());
  const producerReady=message(producer.child,value=>/** @type {{kind?:string}} */(value).kind==='ready',5000);
  producer.child.send({mode:'producer',path,generation:1,config});await producerReady;
  const healthy=message(monitor.child,value=>{const event=/** @type {{kind?:string,json?:string}} */(value);return event.kind==='observation' && typeof event.json==='string' && JSON.parse(event.json).reason_code==='healthy';},16000);
  monitor.child.send({mode:'monitor',path,generation:1,config});await healthy;
  const loss=message(monitor.child,value=>{const event=/** @type {{kind?:string,json?:string}} */(value);return event.kind==='observation' && typeof event.json==='string' && JSON.parse(event.json).reason_code==='heartbeat_silence';},42000);
  const stoppedAt=performance.now();assert.equal(producer.child.kill('SIGSTOP'),true);await delay(50);
  assert.match(execFileSync('ps',['-o','stat=','-p',String(producer.child.pid)],{encoding:'utf8',timeout:1000}),/T/);
  const frozen=await readFile(path,'utf8');
  const observed=/** @type {{json:string}} */(await loss),event=JSON.parse(observed.json);
  assert.ok(performance.now()-stoppedAt<=42000);assert.ok(event.lag_ms>=30000 && event.lag_ms<=42000);assert.equal(event.event,'dread.audit.health');assert.equal(event.outcome,'failure');assert.equal(event.audit_required,false);assert.equal(event.stage,'monitor');
  assert.equal(await readFile(path,'utf8'),frozen);assert.notEqual(producer.child.pid,monitor.child.pid);
  assert.deepEqual(await monitor.exited,{code:1,signal:null});assert.equal(producer.output(),'');assert.equal(monitor.output(),'');
  const probes=(await admin`select sequence::text from dread_audit.probes`.raw())[0][0]?.toString();assert.ok(Number(probes)>=4);t.diagnostic(JSON.stringify({heartbeatSilenceLagMs:event.lag_ms,monitorProbeCount:Number(probes),monitorExitCode:1}));
});
