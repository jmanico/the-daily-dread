import { closedRecord } from '../contracts/http-results.js';
import { setTimeout as delay } from 'node:timers/promises';
/** @typedef {import('../persistence/transactions.js').Context} Context */
/** @typedef {NonNullable<ReturnType<typeof import('./received-record.js').receiveConfigurationRecord>>} Snapshot */
/** @typedef {{snapshot:(input:unknown,company:string)=>Snapshot|undefined,append:(context:Context,record:unknown)=>Promise<{kind:string,value?:{kind:string}}>,probe:(signal:AbortSignal)=>Promise<boolean>}} Adapter */
/** @typedef {'recorded'|'unrecorded'|'unknown'|'conflict'} Outcome */
/** @typedef {{snapshot:Snapshot,companyId:string,operationId:string,controller:AbortController,deadline:number,resolve:(result:Readonly<{kind:Outcome}>)=>void,timer:ReturnType<typeof setTimeout>,settled:boolean,started:boolean,signal:AbortSignal,onAbort:()=>void}} Entry */
const maximum=Number.MAX_SAFE_INTEGER;
/** An explicit owner retains every append promise. Only immutable validated
 * primitive snapshots enter the finite queue; no logger or file fallback.
 * The adapter must cancel its underlying I/O when signaled. A stuck adapter keeps
 * its slot and makes shutdown fail rather than spawning unlimited replacements.
 * @param {Adapter} adapter @param {number} bootGeneration */
export function createAuditPipeline(adapter,bootGeneration) {
  if(!Number.isSafeInteger(bootGeneration) || bootGeneration<1)throw new Error('Invalid audit boot generation');
  /** @type {Entry[]} */let queue=[];
  /** @type {Set<Promise<void>>} */const tasks=new Set();
  /** @type {Set<Entry>} */const active=new Set();
  /** @type {Set<()=>void>} */const drained=new Set();
  let bytes=0,dropped=0,checkpoint=0,sequence=0,generation=0,ready=false,closed=false,recovering=false;
  let errorCode='startup';
  /** @type {Promise<boolean>|undefined} */let stopping;
  /** @param {string} code */
  function fault(code){ready=false;errorCode=code;generation=Math.min(maximum,generation+1);}
  /** @param {Entry} entry @param {Outcome} kind @param {string} [code] */
  function settle(entry,kind,code) {
    if(entry.settled)return;
    entry.settled=true;clearTimeout(entry.timer);entry.signal.removeEventListener('abort',entry.onAbort);
    if(kind!=='recorded'){dropped=Math.min(maximum,dropped+1);fault(code??'unavailable');}
    entry.resolve(Object.freeze({kind}));
  }
  function pump() {
    while(tasks.size<2 && queue.length>0) {
      const entry=queue.shift();if(!entry)break;
      bytes-=new TextEncoder().encode(entry.snapshot.json).length;
      if(entry.settled)continue;
      entry.started=true;active.add(entry);
      const task=run(entry).then(()=>{active.delete(entry);tasks.delete(task);pump();},()=>{
        settle(entry,'unknown','unavailable');active.delete(entry);tasks.delete(task);pump();
      });
      tasks.add(task);
    }
    if(tasks.size===0 && queue.length===0){for(const done of drained)done();drained.clear();}
  }
  /** @param {Entry} entry */
  async function run(entry) {
    try {
      for(let attempt=0;attempt<2;attempt++) {
        const remaining=Math.floor(entry.deadline-performance.now());
        if(entry.settled || remaining<1 || entry.controller.signal.aborted){settle(entry,'unknown','deadline');return;}
        const result=await adapter.append({companyId:entry.companyId,operationId:entry.operationId,signal:entry.controller.signal,timeoutMs:remaining},entry.snapshot.record);
        if(entry.settled)return;
        if(performance.now()>=entry.deadline || entry.controller.signal.aborted){entry.controller.abort();settle(entry,'unknown','deadline');return;}
        if(result.kind==='retryable' && attempt===0)continue;
        if(result.kind==='committed' && (result.value?.kind==='appended' || result.value?.kind==='duplicate')) {
          checkpoint=Math.min(maximum,checkpoint+1);settle(entry,'recorded');return;
        }
        if(result.kind==='committed' && result.value?.kind==='conflicting_id'){settle(entry,'conflict','conflicting_id');return;}
        settle(entry,result.kind==='unknown'?'unknown':'unrecorded',result.kind==='conflict'?'conflicting_id':'unavailable');return;
      }
    }catch{settle(entry,'unknown','unavailable');}
  }
  return Object.freeze({
    /** Readiness gates protected operations, not required denial/failure capture.
     * Startup/recovery is explicit, requires a successful probe and a drained
     * pipeline, and cannot erase counters or a fault occurring during the probe. */
    async recover() {
      if(closed || recovering || generation===maximum || tasks.size!==0 || queue.length!==0)return false;
      recovering=true;ready=false;errorCode='startup';
      const before=generation,controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),2000);
      const aborted=new Promise(resolve=>controller.signal.addEventListener('abort',()=>resolve(false),{once:true}));
      try {
        const result=await Promise.race([adapter.probe(controller.signal),aborted]);
        if(result!==true || closed || before!==generation || tasks.size!==0 || queue.length!==0){fault('unavailable');return false;}
        ready=true;errorCode='healthy';return true;
      }catch{fault('unavailable');return false;}
      finally{clearTimeout(timeout);controller.abort();recovering=false;}
    },
    /** @param {unknown} input @param {unknown} record @returns {Promise<Readonly<{kind:Outcome}>>} */
    enqueue(input,record) {
      let snapshot;
      try {
        if(!closedRecord(input,['companyId','operationId','signal','timeoutMs']) || typeof input.companyId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.companyId) ||
          typeof input.operationId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.operationId) || !(input.signal instanceof AbortSignal) || input.timeoutMs!==1000)throw Error('Invalid audit context');
        snapshot=adapter.snapshot(record,input.companyId);
        if(!snapshot || snapshot.operationId!==input.operationId || snapshot.outcome==='success')throw Error('Invalid audit snapshot');
      }catch{dropped=Math.min(maximum,dropped+1);fault('invalid_snapshot');return Promise.resolve(Object.freeze({kind:'unrecorded'}));}
      const size=new TextEncoder().encode(snapshot.json).length;
      if(closed || input.signal.aborted || size>8192 || queue.length>=128 || bytes+size>1048576) {
        dropped=Math.min(maximum,dropped+1);fault(closed?'shutdown':input.signal.aborted?'canceled':'queue_full');return Promise.resolve(Object.freeze({kind:'unrecorded'}));
      }
      const controller=new AbortController(),signal=input.signal;
      const captured=snapshot,companyId=/** @type {string} */(input.companyId),operationId=/** @type {string} */(input.operationId);
      return new Promise(resolve=>{
        /** @type {Entry} */const entry={snapshot:captured,companyId,operationId,controller,deadline:performance.now()+1000,resolve,
          timer:setTimeout(()=>{controller.abort();settle(entry,entry.started?'unknown':'unrecorded','deadline');if(!entry.started){queue=queue.filter(x=>x!==entry);bytes-=size;pump();}},1000),
          settled:false,started:false,signal,onAbort:()=>{controller.abort();settle(entry,entry.started?'unknown':'unrecorded','canceled');if(!entry.started){queue=queue.filter(x=>x!==entry);bytes-=size;pump();}}};
        signal.addEventListener('abort',entry.onAbort,{once:true});
        queue.push(entry);bytes+=size;pump();
      });
    },
    stopAdmission:()=>{closed=true;ready=false;},
    status:()=>Object.freeze({generation:bootGeneration,ready,closed,active:tasks.size,pending:queue.length,bytes,dropped,checkpoint,sequence,errorCode}),
    /** @param {AbortSignal} signal */
    async *heartbeats(signal) {
      if(!(signal instanceof AbortSignal))throw new Error('Invalid heartbeat signal');
      while(!signal.aborted) {
        sequence=Math.min(maximum,sequence+1);
        yield Object.freeze({generation:bootGeneration,ready,closed,active:tasks.size,pending:queue.length,bytes,dropped,checkpoint,sequence,errorCode});
        try{await delay(10000,undefined,{signal});}catch(error){if(!signal.aborted)throw error;}
      }
    },
    shutdown() {
      if(stopping)return stopping;
      closed=true;ready=false;
      return stopping=(async()=>{
        if(tasks.size===0 && queue.length===0)return true;
        let finish=()=>{};const empty=new Promise(resolve=>{finish=()=>resolve(true);drained.add(finish);});
        const timeout=new AbortController();
        try {
          const clean=await Promise.race([empty,delay(5000,false,{signal:timeout.signal})]);
          if(clean===true)return true;
          fault('shutdown_timeout');
          for(const entry of active){entry.controller.abort();settle(entry,'unknown','shutdown_timeout');}
          for(const entry of queue)settle(entry,'unrecorded','shutdown_timeout');
          queue=[];bytes=0;return false;
        }finally{drained.delete(finish);timeout.abort();}
      })();
    },
  });
}
