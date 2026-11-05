import { feedState } from './feed-state.js';
/** One owner, one scheduled task, no browser-triggered provider requests. Only
 * validated public data is retained in memory. Stop cancels network/parser work.
 * @param {{read:(signal:AbortSignal)=>Promise<unknown>}} source */
export function createPublicRefresh(source) {
  /** @type {import('./feed-state.js').FeedState} */let state={state:'checking',checkedAt:null,nextCheckAt:null,data:null,omitted:0};
  /** @type {Set<(json:string)=>void>} */const listeners=new Set();
  /** @type {Set<Promise<void>>} */const running=new Set();
  /** @type {ReturnType<typeof setTimeout>|undefined} */let timer;
  const controller=new AbortController();let started=false;
  const encoded=()=>JSON.stringify(state);
  function publish(){const json=encoded();for(const listener of listeners){try{listener(json);}catch{listeners.delete(listener);}}}
  async function check() {
    state={state:'checking',checkedAt:state.checkedAt,nextCheckAt:null,data:state.data,omitted:state.omitted};publish();
    const deadline=new AbortController(),signal=AbortSignal.any([controller.signal,deadline.signal]);
    let expired=false;
    const timeout=setTimeout(()=>{expired=true;deadline.abort();},30000);
    const canceled=new Promise(resolve=>signal.addEventListener('abort',()=>resolve({kind:'unavailable'}),{once:true}));
    try {
      const raw=await Promise.race([source.read(signal),canceled]);
      if(controller.signal.aborted)return;
      const result=/** @type {{kind?:string,data?:unknown,omitted?:number}} */(raw);
      const next=new Date(Date.now()+300000).toISOString(),checkedAt=new Date().toISOString();
      const updated=result?.kind==='updated'?feedState({state:'live',checkedAt,nextCheckAt:next,data:result.data,omitted:result.omitted}):null;
      const paused=expired || result?.kind==='paused';
      state=updated??{state:paused?'paused':'stale',checkedAt,nextCheckAt:paused?null:next,data:state.data,omitted:state.omitted};
    }catch{if(!controller.signal.aborted)state={state:'stale',checkedAt:new Date().toISOString(),nextCheckAt:new Date(Date.now()+300000).toISOString(),data:state.data,omitted:state.omitted};}
    finally{clearTimeout(timeout);deadline.abort();}
    if(controller.signal.aborted)return;
    // Deadline failures pause rather than replacing possibly stuck source tasks.
    publish();
  }
  function schedule(){
    const task=check().finally(()=>{running.delete(task);if(!controller.signal.aborted && state.state!=='paused')timer=setTimeout(schedule,300000);});
    running.add(task);
  }
  return Object.freeze({
    start(){if(!started && !controller.signal.aborted){started=true;schedule();}},
    current:encoded,
    /** @param {(json:string)=>void} listener */
    subscribe(listener){if(controller.signal.aborted || listeners.size>=8)return null;listeners.add(listener);return ()=>{listeners.delete(listener);};},
    async stop(){controller.abort();clearTimeout(timer);listeners.clear();await Promise.all(running);},
  });
}
