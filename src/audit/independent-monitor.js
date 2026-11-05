import { closedRecord } from '../contracts/http-results.js';
import { setTimeout as delay } from 'node:timers/promises';
/** A separately supervised process owns this monitor and its monotonic clock.
 * A trusted read-only heartbeat source and separately credentialed storage probe
 * are supplied by installation composition. No application logger or event bytes
 * enter this process. Never run it in the application event loop as production
 * evidence of independence.
 * @typedef {{heartbeat:(signal:AbortSignal)=>Promise<unknown>,probe:(signal:AbortSignal)=>Promise<unknown>}} Source
 */
const maximum=Number.MAX_SAFE_INTEGER;
const errors=['startup','healthy','unavailable','invalid_snapshot','queue_full','deadline','conflicting_id','shutdown','canceled','shutdown_timeout'];
/** @param {unknown} value */
const count=value=>typeof value==='number' && Number.isSafeInteger(value) && value>=0 && value<=maximum;
/** @param {unknown} value */
function heartbeat(value) {
  return closedRecord(value,['generation','ready','closed','active','pending','bytes','dropped','checkpoint','sequence','errorCode']) &&
    typeof value.ready==='boolean' && typeof value.closed==='boolean' && typeof value.errorCode==='string' && errors.includes(value.errorCode) &&
    ['generation','active','pending','bytes','dropped','checkpoint','sequence'].every(key=>count(value[key])) &&
    /** @type {number} */(value.active)<=2 && /** @type {number} */(value.pending)<=128 && /** @type {number} */(value.bytes)<=1048576 && /** @type {number} */(value.sequence)>0 && /** @type {number} */(value.generation)>0;
}
/** Pure observation state. Supplied time is the monitor's local monotonic elapsed
 * time, not a producer timestamp. Public output contains only bounded categories
 * and aggregate counts; it proves neither synchronization nor operator delivery. */
export function createHealthObserver() {
  let lastTime=-1,lastGeneration=-1,lastHeartbeat=-1,lastCheckpoint=-1,lastAppCheckpoint=-1,lastProbe=-1,lastDropped=0,heartbeatAt=0,progressAt=0,wasPending=false;
  return Object.freeze({
    /** @param {unknown} input @param {unknown} probe @param {number} now */
    observe(input,probe,now) {
    /** @param {'healthy'|'unhealthy'|'unknown'} status @param {string} code */
    const result=(status,code)=>Object.freeze({status,errorCode:code,droppedCount:lastDropped,lagMs:Math.min(maximum,Math.max(0,Math.floor(now-Math.min(heartbeatAt,progressAt))))});
    if(!Number.isFinite(now) || now<0 || now<lastTime)return Object.freeze({status:'unhealthy',errorCode:'invalid_observation',droppedCount:lastDropped,lagMs:0});
    lastTime=now;
    try{if(!heartbeat(input) || !closedRecord(probe,['sequence','checkpoint','generation']) || !count(probe.sequence) || !count(probe.checkpoint) || !count(probe.generation) || /** @type {number} */(probe.sequence)<1)return result('unhealthy','invalid_observation');}
    catch{return result('unhealthy','invalid_observation');}
    const h=/** @type {{generation:number,ready:boolean,closed:boolean,active:number,pending:number,bytes:number,dropped:number,checkpoint:number,sequence:number,errorCode:string}} */(input);
    const p=/** @type {{sequence:number,checkpoint:number,generation:number}} */(probe);
    if(h.generation!==p.generation)return result('unhealthy','generation_mismatch');
    const initial=lastHeartbeat<0,restart=!initial && (h.generation!==lastGeneration || h.sequence<lastHeartbeat || h.checkpoint<lastAppCheckpoint || p.checkpoint<lastCheckpoint || p.sequence<lastProbe || h.dropped<lastDropped);
    const loss=h.dropped>lastDropped;
    if(initial || restart){heartbeatAt=now;progressAt=now;}
    else {
      if(h.sequence>lastHeartbeat)heartbeatAt=now;
      if(p.checkpoint>lastCheckpoint || h.active+h.pending===0 || !wasPending)progressAt=now;
    }
    const repeatedProbe=!initial && !restart && p.sequence<=lastProbe;
    wasPending=h.active+h.pending>0;
    lastGeneration=h.generation;lastHeartbeat=h.sequence;lastAppCheckpoint=h.checkpoint;lastCheckpoint=p.checkpoint;lastProbe=p.sequence;lastDropped=h.dropped;
    if(h.closed || !h.ready || h.errorCode!=='healthy' || loss)return result('unhealthy',loss?'unrecorded':h.closed?'shutdown':h.errorCode==='healthy'?'unavailable':h.errorCode);
    if(initial || restart)return result('unknown','restart');
    if(repeatedProbe)return result('unhealthy','probe_stalled');
    if(now-heartbeatAt>=30000)return result('unhealthy','heartbeat_silence');
    if(h.active+h.pending>0 && now-progressAt>=30000)return result('unhealthy','pipeline_stalled');
    return result('healthy','healthy');
  }});
}

/** Poll without overlap. A failed/timed-out source ends this run after a minimal
 * terminal observation so the supervisor can report monitor failure. Underlying
 * source I/O must honor the abort signal; no replacement task is started after a
 * stuck probe. Ten-second polls plus two-second I/O budget give a controlled
 * silence acceptance bound of 42 seconds, subject to deployment verification.
 * @param {Source} source @param {AbortSignal} signal */
export async function* independentObservations(source,signal) {
  if(!(signal instanceof AbortSignal))throw new Error('Invalid monitor signal');
  const observer=createHealthObserver();
  while(!signal.aborted) {
    const controller=new AbortController(),combined=AbortSignal.any([signal,controller.signal]);
    const timeout=setTimeout(()=>controller.abort(),2000);
    const aborted=new Promise((_,reject)=>combined.addEventListener('abort',()=>reject(new Error('Monitor canceled')),{once:true}));
    let values;
    try{values=await Promise.race([Promise.all([Promise.resolve().then(()=>source.heartbeat(combined)),Promise.resolve().then(()=>source.probe(combined))]),aborted]);}
    catch{if(!signal.aborted){const last=observer.observe(undefined,undefined,performance.now());yield Object.freeze({status:'unhealthy',errorCode:'probe_unavailable',droppedCount:last.droppedCount,lagMs:last.lagMs});}return;}
    finally{clearTimeout(timeout);controller.abort();}
    if(signal.aborted)return;
    yield observer.observe(values[0],values[1],performance.now());
    try{await delay(10000,undefined,{signal});}catch(error){if(!signal.aborted)throw error;}
  }
}
