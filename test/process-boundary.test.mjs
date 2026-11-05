import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createApplication,operationSignal} from '../src/http/application.js';
import {exitCodes} from '../src/lifecycle/process-boundary.js';

/** @param {string} mode @param {NodeJS.Signals|undefined} [signal] @param {string[]} [flags] */
async function childResult(mode,signal,flags=[]) {
  const started=performance.now();
  const child=spawn(process.execPath,[...flags,'test-support/process-boundary.mjs',mode],{env:{TZ:'UTC',LANG:'C'},stdio:['ignore','pipe','pipe','ipc']});
  assert.ok(child.stdout && child.stderr);
  let stdout='',stderr='';let ready=false;
  child.stdout.on('data',bytes=>{stdout+=bytes;if(stdout.length>8192)child.kill('SIGKILL');});
  child.stderr.on('data',bytes=>{stderr+=bytes;if(stderr.length>8192)child.kill('SIGKILL');});
  child.on('message',message=>{
    if(typeof message==='object' && message!==null && 'ready' in message && message.ready===true){
      ready=true;if(signal){child.kill(signal);child.kill(signal);}
    }
  });
  const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
  try {
    const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,terminatedBy)=>resolve({code,terminatedBy}));});
    assert.equal(stdout,'');assert.equal(stderr,'');
    return {...result,ready,elapsed:performance.now()-started};
  } finally {clearTimeout(timer);if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL');}
}
test('actual uncaught/rejected/strict-rejected/critical-stream failures exit categorically without raw stderr',async()=>{
  for(const [mode,expected,flags] of [
    ['uncaught',exitCodes.uncaught,[]],['unhandled',exitCodes.unhandled,[]],
    ['unhandled',exitCodes.unhandled,['--unhandled-rejections=strict']],['stream',exitCodes.critical_stream,[]],
  ]){
    const result=await childResult(String(mode),undefined,/** @type {string[]} */(flags));
    assert.equal(result.code,expected);assert.equal(result.terminatedBy,null);assert.ok(result.ready);assert.ok(result.elapsed<5000);
  }
});
test('startup, duplicate ownership and pre-existing raw exception observers fail before service admission',async()=>{
  for(const mode of ['startup','duplicate','observer']){const result=await childResult(mode);assert.equal(result.code,exitCodes.startup);assert.equal(result.ready,false);}
});
test('graceful and real repeated SIGTERM/SIGINT stop exactly once and exit zero',async()=>{
  for(const signal of [undefined,'SIGTERM','SIGINT']){
    const result=await childResult(signal?'signal':'graceful',/** @type {NodeJS.Signals|undefined} */(signal));
    assert.equal(result.code,0);assert.equal(result.terminatedBy,null);assert.ok(result.ready);
  }
});
test('admission/drain errors and fatal faults during shutdown never become successful exits',async()=>{
  for(const mode of ['admission_throw','drain_throw','fatal_during_drain']){
    const result=await childResult(mode);assert.equal(result.code,mode==='fatal_during_drain'?exitCodes.uncaught:exitCodes.shutdown_failure);assert.equal(result.terminatedBy,null);
  }
});
test('hung shutdown enforces the real five-second deadline and terminates nonzero',{timeout:15000},async()=>{
  const result=await childResult('hang');assert.equal(result.code,exitCodes.shutdown_timeout);assert.equal(result.terminatedBy,null);
  assert.ok(result.elapsed>=4900);assert.ok(result.elapsed<9000);
});
test('HTTP shutdown revokes active signals and rejects new admission before the access owner',async t=>{
  let authorizations=0;
  /** @type {()=>void} */ let entered=()=>undefined;
  const started=new Promise(resolve=>{entered=()=>resolve(undefined);});
  const app=createApplication(async()=>{authorizations++;return 'allowed';});t.after(()=>app.close());
  let aborted=false;
  app.get('/work',async request=>{
    const signal=operationSignal(request);entered();
    await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve(undefined);},{once:true}));
    return {private_value:'SYNTHETIC_LATE_RESPONSE_SECRET'};
  });
  const pending=app.inject('/work');await started;
  app.getDecorator('stopAdmission')();const reply=await pending;assert.equal(reply.statusCode,503);assert.ok(!reply.body.includes('SYNTHETIC_LATE_RESPONSE_SECRET'));assert.equal(aborted,true);
  assert.equal((await app.inject('/work')).statusCode,503);assert.equal(authorizations,1);
});
