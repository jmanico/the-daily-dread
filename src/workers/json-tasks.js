import { Worker as ParserWorker } from 'node:worker_threads';
import { parserLimits } from './limits.js';

/** @typedef {'malformed'|'bytes'|'depth'|'entries'|'timeout'|'canceled'|'overloaded'|'unavailable'} ParserReason */
export class ParserFailure extends Error {
  /** @param {ParserReason} reason @param {number | null} [limit] @param {string|null} [boundary] */
  constructor(reason, limit = null, boundary = null) {
    super('Parser task rejected'); this.reason = reason; this.limit = limit;
    this.boundary = boundary ?? (reason === 'bytes' ? 'input_bytes' : reason === 'timeout' ? 'wall_ms' : ['depth', 'entries'].includes(reason) ? reason : null);
  }
}
// One main-thread service process owns this admission state. Additional service
// replicas require a shared installation admission owner before deployment.
const capacity = Object.freeze({ workers: 2, pending: 100, pendingBytes: 16 * 1024 * 1024 });
/** @typedef {{bytes:Uint8Array,limits:Readonly<import('./limits.js').ParserLimits>,signal:AbortSignal,
 * resolve:(value:unknown)=>void,reject:(error:ParserFailure)=>void,cancel:()=>void}} Task */
/** @type {Task[]} */ const queue = [];
let active = 0, pendingBytes = 0;
/** @type {Set<Promise<void>>} */ const running = new Set();

/** Safe aggregate diagnostics; no IDs, inputs, errors or result values. */
export function parserStatus() { return Object.freeze({ active, pending: queue.length, pendingBytes, capacity }); }

/** The caller supplies already-authorized bounded bytes, never code or paths.
 * HTTP uses wait=false; job callers must additionally use their durable budget
 * and current attempt/fence owner before submission and before result commit.
 * @param {Uint8Array} bytes @param {unknown} configuration @param {AbortSignal} signal
 * @param {boolean} [wait] @returns {Promise<unknown>} */
export function parseJSONTask(bytes, configuration, signal, wait = true) {
  const limits = parserLimits(configuration);
  if (!(signal instanceof AbortSignal) || typeof wait !== 'boolean') throw new Error('Invalid parser task context');
  if (!(bytes instanceof Uint8Array) || !(bytes.buffer instanceof ArrayBuffer) || bytes.byteLength > limits.bytes) return Promise.reject(new ParserFailure('bytes', limits.bytes));
  if (signal.aborted) return Promise.reject(new ParserFailure('canceled'));
  const waiting = active >= capacity.workers || queue.length > 0;
  if (waiting && !wait) return Promise.reject(new ParserFailure('overloaded', capacity.workers, 'worker_count'));
  if (waiting && queue.length >= capacity.pending) return Promise.reject(new ParserFailure('overloaded', capacity.pending, 'pending_count'));
  if (waiting && bytes.byteLength > capacity.pendingBytes - pendingBytes) return Promise.reject(new ParserFailure('overloaded', capacity.pendingBytes, 'pending_bytes'));
  // Copy only after admission checks. Mutating the caller's buffer cannot change
  // queued work, and transferring this exact buffer cannot expose slab neighbors.
  const snapshot = Uint8Array.from(bytes);
  return new Promise((resolve, reject) => {
    const task = { bytes: snapshot, limits, signal, resolve, reject, cancel: () => {} };
    task.cancel = () => {
      const index = queue.indexOf(task);
      if (index < 0) return;
      queue.splice(index, 1); pendingBytes -= task.bytes.byteLength;
      signal.removeEventListener('abort', task.cancel);
      reject(new ParserFailure('canceled'));
    };
    if (waiting) {
      queue.push(task); pendingBytes += snapshot.byteLength;
      signal.addEventListener('abort', task.cancel, { once: true });
      if (signal.aborted) task.cancel();
    } else start(task);
  });
}

/** @param {Task} task */
function start(task) {
  active++;
  // The explicit owner retains every task until worker termination/cleanup.
  const completion = execute(task).then(value => {
    running.delete(completion); active--; drain();
    if (task.signal.aborted) task.reject(new ParserFailure('canceled'));
    else task.resolve(value);
  }, error => {
    running.delete(completion); active--; drain();
    task.reject(error instanceof ParserFailure ? error : new ParserFailure('unavailable'));
  });
  running.add(completion);
}
function drain() {
  while (active < capacity.workers && queue.length) {
    const task = queue.shift();
    if (!task) return;
    pendingBytes -= task.bytes.byteLength;
    task.signal.removeEventListener('abort', task.cancel);
    if (task.signal.aborted) task.reject(new ParserFailure('canceled'));
    else start(task);
  }
}

/** @param {Task} task */
async function execute(task) {
  /** @type {ParserWorker | undefined} */ let worker;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;
  /** @type {() => void} */ let cancel = () => {};
  const deadline = performance.now() + task.limits.timeMs;
  /** @type {unknown} */ let value;
  /** @type {ParserFailure | undefined} */ let failure;
  try {
    if (task.signal.aborted) throw new ParserFailure('canceled');
    if (!(task.bytes.buffer instanceof ArrayBuffer)) throw new ParserFailure('unavailable');
    // Only this fixed reviewed module executes. No inherited environment,
    // preloads, raw stderr/stdout, network clients or service context is passed.
    worker = new ParserWorker(new URL('../http/json-worker.js', import.meta.url), {
      workerData: { bytes: task.bytes, limits: task.limits }, transferList: [task.bytes.buffer],
      env: {}, execArgv: [], stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 64 },
    });
    worker.stdout?.resume(); worker.stderr?.resume();
    value = await new Promise((resolve, reject) => {
      cancel = () => reject(new ParserFailure('canceled'));
      const unavailable = () => reject(new ParserFailure('unavailable'));
      timer = setTimeout(() => reject(new ParserFailure('timeout', task.limits.timeMs)), Math.max(0, deadline - performance.now()));
      task.signal.addEventListener('abort', cancel, { once: true });
      worker?.once('error', unavailable); worker?.once('exit', unavailable); worker?.once('messageerror', unavailable);
      worker?.once('message', result => {
        if (task.signal.aborted) { cancel(); return; }
        if (performance.now() >= deadline) { reject(new ParserFailure('timeout', task.limits.timeMs)); return; }
        if (result?.kind === 'parsed') resolve(result.value);
        else if (result?.kind === 'rejected' && ['malformed', 'bytes', 'depth', 'entries', 'timeout'].includes(result.reason)) {
          const reason = /** @type {ParserReason} */ (result.reason);
          const limit = reason === 'timeout' ? task.limits.timeMs : reason === 'malformed' ? null : task.limits[/** @type {'bytes'|'depth'|'entries'} */ (reason)];
          reject(new ParserFailure(reason, limit));
        } else unavailable();
      });
      if (task.signal.aborted) cancel();
    });
  } catch (error) { failure = error instanceof ParserFailure ? error : new ParserFailure('unavailable'); }
  finally {
    clearTimeout(timer); task.signal.removeEventListener('abort', cancel);
    try { if (worker) await worker.terminate(); }
    catch { failure = new ParserFailure('unavailable'); }
  }
  // A cancellation/deadline during termination must also revoke disclosure.
  if (task.signal.aborted) failure = new ParserFailure('canceled');
  else if (performance.now() >= deadline) failure = new ParserFailure('timeout', task.limits.timeMs);
  if (failure) throw failure;
  return value;
}
