import { plainRecord } from './destination-policy.js';

/** @typedef {{wireBytes:number,decodedBytes:number,totalMs:number,readMs:number,redirects:number}} RetrievalLimits */
const ceilings=Object.freeze({wireBytes:5*1024*1024,decodedBytes:10*1024*1024,totalMs:30000,readMs:10000,redirects:3});
/** Only trusted composition supplies smaller limits. Redirects are off by default.
 * @param {unknown} [input] @returns {Readonly<RetrievalLimits>}
 */
export function retrievalLimits(input={}) {
  if (!plainRecord(input) || Object.keys(input).some(key=>!Object.hasOwn(ceilings,key))) throw new Error('Invalid retrieval limits');
  /** @type {RetrievalLimits} */
  const result={wireBytes:ceilings.wireBytes,decodedBytes:ceilings.decodedBytes,totalMs:ceilings.totalMs,readMs:ceilings.readMs,redirects:0};
  for (const key of /** @type {(keyof RetrievalLimits)[]} */ (Object.keys(ceilings))) {
    if (!Object.hasOwn(input,key)) continue;
    const value=input[key];
    if (typeof value!=='number' || !Number.isSafeInteger(value) || value<(key==='redirects' ? 0 : 1) || value>ceilings[key]) throw new Error('Invalid retrieval limits');
    result[key]=value;
  }
  return Object.freeze(result);
}

/** @typedef {'canceled'|'timeout'|'read_timeout'|'wire_limit'|'decoded_limit'|'redirect_limit'|'attempt_limit'|'invalid_count'|'closed'} BudgetFailure */
/** One logical retrieval owns this budget through all hops and caller-owned retries.
 * Native I/O must use the returned signal; a timer alone is not cancellation.
 * Counters are process-local. Durable job accounting belongs to its owner.
 * @param {unknown} configuration @param {AbortSignal} externalSignal
 */
export function createRetrievalBudget(configuration,externalSignal) {
  const limits=retrievalLimits(configuration);
  if (!(externalSignal instanceof AbortSignal)) throw new Error('Invalid retrieval cancellation');
  const controller=new AbortController();
  const start=performance.now();
  let wireBytes=0,decodedBytes=0,redirects=0,attempts=0;
  /** @type {BudgetFailure | undefined} */ let failure;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let readTimer;
  const totalTimer=setTimeout(()=>fail('timeout'),limits.totalMs);
  const cancel=()=>fail('canceled');
  externalSignal.addEventListener('abort',cancel,{once:true});
  /** First failure is stable; abort all owned I/O and release every timer/listener.
   * @param {BudgetFailure} reason
   */
  function fail(reason) {
    if (failure) return false;
    failure=reason;
    clearTimeout(totalTimer);clearTimeout(readTimer);
    externalSignal.removeEventListener('abort',cancel);
    controller.abort();
    return false;
  }
  if (externalSignal.aborted) fail('canceled');
  return Object.freeze({
    signal:controller.signal,
    limits,
    /** @param {'wire'|'decoded'} kind @param {number} bytes */
    charge(kind,bytes) {
      if (failure) return false;
      if (!['wire','decoded'].includes(kind) || !Number.isSafeInteger(bytes) || bytes<0) return fail('invalid_count');
      const previous=kind==='wire' ? wireBytes : decodedBytes;
      if (bytes>Number.MAX_SAFE_INTEGER-previous) return fail('invalid_count');
      if (kind==='wire') {wireBytes+=bytes;if(wireBytes>limits.wireBytes)return fail('wire_limit');}
      else {decodedBytes+=bytes;if(decodedBytes>limits.decodedBytes)return fail('decoded_limit');}
      return true;
    },
    beginAttempt() {
      if (failure) return false;
      // This is an admission ceiling, not permission or a retry schedule.
      if (++attempts>32) return fail('attempt_limit');
      return true;
    },
    consumeRedirect() {
      if (failure) return false;
      if (++redirects>limits.redirects) return fail('redirect_limit');
      return true;
    },
    /** Start/reset only while an HTTP response is pending or streaming. */
    touchRead() {
      if (failure) return false;
      clearTimeout(readTimer);
      readTimer=setTimeout(()=>fail('read_timeout'),limits.readMs);
      return true;
    },
    endRead() {clearTimeout(readTimer);},
    close() {fail('closed');},
    snapshot() {return Object.freeze({wireBytes,decodedBytes,redirects,attempts,remainingMs:Math.max(0,limits.totalMs-(performance.now()-start)),failure});},
  });
}
