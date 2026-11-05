import { Worker as ParserWorker } from 'node:worker_threads';
import { InputFailure } from './input.js';

// Process-wide admission, across factory instances. No waiting queue retains request bodies.
let active = 0;
export class ParserUnavailable extends Error {
  constructor() { super('Parser unavailable'); }
}
/** @param {Uint8Array} bytes @param {AbortSignal | undefined} signal @returns {Promise<unknown>} */
export async function parseBody(bytes, signal) {
  if (bytes.byteLength > 65536) throw new InputFailure();
  if (active >= 2 || signal?.aborted) throw new ParserUnavailable();
  active++;
  /** @type {ParserWorker | undefined} */ let worker;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let timer;
  /** @type {() => void} */ let abort = () => {};
  const deadline = performance.now() + 2000;
  try {
    // Reviewed fixed module; no user-selected paths, inherited preloads or service environment.
    worker = new ParserWorker(new URL('./json-worker.js', import.meta.url), {
      workerData: bytes, env: {}, execArgv: [], stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 64 },
    });
    worker.stdout?.resume(); worker.stderr?.resume();
    return await new Promise((resolve, reject) => {
      abort = () => reject(new ParserUnavailable());
      timer = setTimeout(abort, 2000);
      signal?.addEventListener('abort', abort, { once: true });
      worker?.once('error', abort);
      worker?.once('exit', abort);
      worker?.once('messageerror', abort);
      worker?.once('message', (result) => {
        if (signal?.aborted || performance.now() >= deadline) { abort(); return; }
        if (result?.kind === 'parsed') resolve(result.value);
        else reject(new InputFailure());
      });
      if (signal?.aborted) abort();
    });
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    try { if (worker) await worker.terminate(); }
    finally { active--; }
  }
}
