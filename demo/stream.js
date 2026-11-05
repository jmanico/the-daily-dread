import { feedState } from './feed-state.js';
/** Credential-free, fixed same-origin stream. Bounded frames, owned reconnect
 * task and abortable reads prevent stale callbacks after the view unmounts.
 * @param {(state:import('./feed-state.js').FeedState)=>void} receive @param {()=>void} unavailable */
export function subscribeFeed(receive,unavailable) {
  const controller=new AbortController();
  /** @type {ReturnType<typeof setTimeout>|undefined} */let timer;
  /** @type {Set<Promise<void>>} */const tasks=new Set();
  async function read() {
    const connection=new AbortController(),signal=AbortSignal.any([controller.signal,connection.signal]);
    let reported=false;
    const fail=()=>{if(!reported && !controller.signal.aborted){reported=true;unavailable();}};
    let timeout=setTimeout(()=>connection.abort(),30000);
    /** @type {ReadableStreamDefaultReader<Uint8Array>|undefined} */let reader;
    try {
      const response=await fetch('/demo/feed-events',{credentials:'omit',cache:'no-store',redirect:'error',signal});
      if(response.status!==200 || response.headers.get('content-type')!=='text/event-stream; charset=utf-8' || !response.body)throw Error('Feed unavailable');
      reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let pending='';
      while(!signal.aborted) {
        const chunk=await reader.read();if(signal.aborted)return;
        if(chunk.done)throw Error('Feed disconnected');
        if(chunk.value.byteLength>1048600)throw Error('Feed chunk limit');
        clearTimeout(timeout);timeout=setTimeout(()=>connection.abort(),30000);
        pending+=decoder.decode(chunk.value,{stream:true});
        if(pending.length>1048600 || new TextEncoder().encode(pending).length>1048600)throw Error('Feed frame limit');
        let end;
        while((end=pending.indexOf('\n\n'))>=0) {
          const frame=pending.slice(0,end);pending=pending.slice(end+2);
          if(!frame.startsWith('data: '))continue;
          const state=feedState(JSON.parse(frame.slice(6)));if(!state)throw Error('Invalid feed projection');
          if(!signal.aborted)receive(state);
        }
      }
    }catch{fail();}
    finally{clearTimeout(timeout);connection.abort();if(reader){try{await reader.cancel();}catch{fail();}reader.releaseLock();}}
  }
  function connect(){
    const task=read().finally(()=>{tasks.delete(task);if(!controller.signal.aborted)timer=setTimeout(connect,10000);});tasks.add(task);
  }
  connect();
  return ()=>{controller.abort();clearTimeout(timer);};
}
