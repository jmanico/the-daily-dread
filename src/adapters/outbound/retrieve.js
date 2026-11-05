import { Agent, request } from 'node:http';
import { createDestinationConnector } from './connect-destination.js';
import { destinationPolicy, plainRecord } from './destination-policy.js';
import { createRetrievalBudget, retrievalLimits } from './retrieval-budget.js';
import { readBoundedBody } from './read-body.js';

/** @typedef {import('./connect-destination.js').Authorize} Authorize */
/** @typedef {ReturnType<typeof createRetrievalBudget>} Budget */
/** @typedef {{kind:'wait',status:number,notBeforeMs:number|null}} ProviderWait */
/** @typedef {import('./connect-destination.js').Failure|import('./read-body.js').BodyFailure|'busy'|'redirect'|'provider_wait'|'headers'|'framing'|'protocol'|'transport'} Failure */
/** @typedef {{kind:'failed',reason:Failure,wait?:ProviderWait}} Failed */
/** @typedef {{kind:'retrieved',body:Buffer,status:number,contentType:string|null,pollAfterMs:number|null}|ProviderWait|{kind:'status',status:number}|Failed} Retrieval */
/** No request can supply credentials, arbitrary headers, proxy/agent options or a
 * method/body. This read-only transport owns only GET retrieval; effectful
 * provider adapters require separate authorized request/projection contracts.
 * @param {unknown} configuration @param {Authorize} authorize @param {unknown} [limitsInput]
 * @param {Parameters<typeof createDestinationConnector>[2]} [ports]
 */
export function createRetrievalTransport(configuration,authorize,limitsInput={},ports={}) {
  const policy=destinationPolicy(configuration),limits=retrievalLimits(limitsInput);
  if (!policy || typeof authorize!=='function') throw new Error('Invalid retrieval configuration');
  const connector=createDestinationConnector(policy,authorize,ports);
  /** @type {Set<Budget>} */ const operations=new Set();
  let retired=false;
  /** @param {unknown} context */
  const allowed=context=>{try{return !retired && authorize(context,policy)==='allowed';}catch{return false;}};
  return Object.freeze({
    retire(){retired=true;connector.retire();for(const budget of operations)budget.close();},
    /** Context comes from the owning use case, never from submitted identity fields.
     * One operation retains its counters across reads/retries. Its owner must close
     * it in finally; the total deadline also releases abandoned operation slots.
     * @param {unknown} input
     */
    begin(input) {
      if (retired) return /** @type {Failed} */({kind:'failed',reason:'revoked'});
      if (!plainRecord(input) || Object.keys(input).length!==2 || !Object.hasOwn(input,'context') || !(input.signal instanceof AbortSignal)) return /** @type {Failed} */({kind:'failed',reason:'invalid'});
      if (!allowed(input.context)) return /** @type {Failed} */({kind:'failed',reason:'denied'});
      if (input.signal.aborted) return /** @type {Failed} */({kind:'failed',reason:'canceled'});
      // At most four retained/streaming operations per composed transport. The
      // application owner must separately bound transport instances globally.
      if (operations.size>=4) return /** @type {Failed} */({kind:'failed',reason:'capacity'});
      const context=input.context,budget=createRetrievalBudget(limits,input.signal);
      operations.add(budget);
      budget.signal.addEventListener('abort',()=>operations.delete(budget),{once:true});
      let busy=false;
      /** @type {ProviderWait|undefined} */ let pendingWait;
      return Object.freeze({
        kind:/** @type {const} */('operation'),
        close(){budget.close();},
        snapshot(){return budget.snapshot();},
        /** @param {unknown} initialURL @returns {Promise<Retrieval>} */
        async read(initialURL) {
          if (!allowed(context)) return {kind:'failed',reason:retired ? 'revoked' : 'denied'};
          if (busy) return {kind:'failed',reason:'busy'};
          if (!budget.check()) return {kind:'failed',reason:budget.snapshot().failure ?? 'canceled'};
          if (pendingWait && (pendingWait.notBeforeMs===null || Date.now()<pendingWait.notBeforeMs)) return {kind:'wait',status:pendingWait.status,notBeforeMs:pendingWait.notBeforeMs};
          pendingWait=undefined;
          busy=true;
          let next=initialURL;
          try {
            while (budget.beginAttempt()) {
              const connected=await connector.connect({url:next,context,signal:budget.signal});
              if (connected.kind==='failed') return {kind:'failed',reason:budget.snapshot().failure ?? connected.reason};
              try {
                if (!allowed(context)) return {kind:'failed',reason:retired ? 'revoked' : 'denied'};
                budget.check();budget.signal.throwIfAborted();
                const response=await readResponse(connected,budget);
                pendingWait=response.wait;
                if (!allowed(context)) return {kind:'failed',reason:retired ? 'revoked' : 'denied'};
                if (response.kind==='failed') return response;
                budget.check();budget.signal.throwIfAborted();
                if ([301,302,303,307,308].includes(response.status)) {
                  if (!budget.consumeRedirect()) return {kind:'failed',reason:budget.snapshot().failure ?? 'redirect_limit'};
                  if (!response.location || Buffer.byteLength(response.location)>4096) return {kind:'failed',reason:'redirect'};
                  try {next=new URL(response.location,connected.url).href;} catch {return {kind:'failed',reason:'redirect'};}
                  // Every hop goes back through the same policy/DNS/TLS factory.
                  continue;
                }
                if (response.wait) return {kind:'wait',status:response.wait.status,notBeforeMs:response.wait.notBeforeMs};
                if (response.status<200 || response.status>299) return {kind:'status',status:response.status};
                return {kind:'retrieved',body:response.body,status:response.status,contentType:response.contentType,pollAfterMs:response.pollAfterMs};
              } finally {connected.socket.destroy();}
            }
            return {kind:'failed',reason:budget.snapshot().failure ?? 'attempt_limit'};
          } catch {
            return {kind:'failed',reason:budget.snapshot().failure ?? 'transport'};
          } finally {busy=false;budget.endRead();}
        },
      });
    },
  });
}

/** Retain only factual provider timing. No sleeping, retry scheduling, clamping
 * an excessive delay downwards, or provider authority over workflow transitions.
 * @param {string|null} header @param {number} observedAtMs @returns {number|null|undefined}
 */
export function providerWait(header,observedAtMs) {
  if (header===null) return null;
  if (!Number.isSafeInteger(observedAtMs) || observedAtMs<0 || typeof header!=='string') return;
  if (/^[0-9]{1,16}$/.test(header)) {
    const delay=Number(header)*1000,at=observedAtMs+delay;
    if (Number.isSafeInteger(at) && at<=8640000000000000) return at;
    return;
  }
  // Accept canonical IMF-fixdate only, with the weekday checked by round trip.
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [0-9]{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(header)) return;
  const at=Date.parse(header);
  if (Number.isFinite(at) && new Date(at).toUTCString()===header) return Math.max(at,observedAtMs);
}

/** @param {import('./connect-destination.js').Connected} connected @param {Budget} budget
 * @returns {Promise<{kind:'response',status:number,body:Buffer,contentType:string|null,pollAfterMs:number|null,location:string|null,wait:ProviderWait|undefined}|Failed>}
 */
async function readResponse(connected,budget) {
  // HTTP framing is applied only to the already verified encrypted socket. This
  // agent cannot create a network connection or reuse another destination.
  const url=new URL(connected.url),agent=new Agent({keepAlive:false,maxSockets:1});
  let used=false;
  agent.createConnection=()=>{if(used)throw new Error('Socket already used');used=true;return connected.socket;};
  /** @type {import('node:http').ClientRequest|undefined} */ let outgoing;
  /** @type {import('node:http').IncomingMessage|undefined} */ let incoming;
  /** @type {{reason:Failure}} */ const state={reason:'transport'};
  /** @type {ProviderWait|undefined} */ let wait;
  budget.touchRead();
  try {
    const response=await new Promise((resolve,reject)=>{
      outgoing=request({hostname:url.hostname,port:url.port || 443,path:url.pathname+url.search,method:'GET',agent,
        headers:{Host:url.host,Connection:'close','Accept-Encoding':'gzip, deflate','User-Agent':'The-Daily-Dread/0.1'},
        insecureHTTPParser:false,maxHeaderSize:16384,signal:budget.signal},resolve);
      // Disable silent count truncation and reject using the complete bounded
      // raw header list. Native maxHeaderSize remains enforced by the parser.
      outgoing.maxHeadersCount=0;
      outgoing.once('error',()=>reject(new Error('HTTP retrieval failed')));
      outgoing.once('upgrade',(_response,socket)=>{state.reason='protocol';socket.destroy();reject(new Error('Unexpected HTTP upgrade'));});
      outgoing.on('information',()=>{state.reason='protocol';outgoing?.destroy(new Error('Unexpected informational response'));});
      outgoing.end();
    });
    incoming=response;
    if (state.reason==='protocol') return {kind:'failed',reason:state.reason};
    const headers=responseHeaders(response);
    if (!headers) return {kind:'failed',reason:'headers'};
    const pollAfterMs=headers.pollInterval===null?null:providerWait(headers.pollInterval,Date.now());
    if(headers.pollInterval!==null && (!/^[0-9]{1,16}$/.test(headers.pollInterval) || pollAfterMs===undefined))return {kind:'failed',reason:'provider_wait',wait:Object.freeze({kind:'wait',status:headers.status,notBeforeMs:null})};
    if (headers.status===429 || headers.status===503) {
      const notBeforeMs=providerWait(headers.retryAfter,Date.now());
      if (notBeforeMs===undefined) return {kind:'failed',reason:'provider_wait',wait:Object.freeze({kind:'wait',status:headers.status,notBeforeMs:null})};
      wait=Object.freeze({kind:'wait',status:headers.status,notBeforeMs});
    }
    const body=await readBoundedBody(response,headers.encoding,budget);
    if (body.kind==='failed') return wait ? {kind:'failed',reason:body.reason,wait} : body;
    if (!response.complete || response.rawTrailers.length!==0) return wait ? {kind:'failed',reason:'framing',wait} : {kind:'failed',reason:'framing'};
    return {kind:'response',status:headers.status,body:body.body,contentType:headers.contentType,pollAfterMs:pollAfterMs??null,location:headers.location,wait};
  } catch {return wait ? {kind:'failed',reason:budget.snapshot().failure ?? state.reason,wait} : {kind:'failed',reason:budget.snapshot().failure ?? state.reason};}
  finally {budget.endRead();incoming?.destroy();outgoing?.destroy();agent.destroy();}
}

/** @param {import('node:http').IncomingMessage} response */
function responseHeaders(response) {
  const status=response.statusCode;
  if (!status || status<200 || status>599 || response.rawHeaders.length>200) return;
  /** @type {Map<string,string>} */ const selected=new Map();
  const singletons=['content-length','transfer-encoding','content-encoding','content-type','location','retry-after','x-poll-interval'];
  for(let i=0;i<response.rawHeaders.length;i+=2) {
    const name=response.rawHeaders[i].toLowerCase(),value=response.rawHeaders[i+1];
    if (singletons.includes(name)) {if(selected.has(name))return;selected.set(name,value);}
  }
  const contentType=selected.get('content-type') ?? null;
  if (contentType!==null && (Buffer.byteLength(contentType)>256 || /[\u0000-\u001f\u007f]/u.test(contentType))) return;
  const transfer=selected.get('transfer-encoding');
  if (transfer!==undefined && transfer.toLowerCase()!=='chunked') return;
  return {status,contentType,pollInterval:selected.get('x-poll-interval')??null,encoding:selected.get('content-encoding')?.toLowerCase() ?? 'identity',location:selected.get('location') ?? null,retryAfter:selected.get('retry-after') ?? null};
}
