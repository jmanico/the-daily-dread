import { parentPort, workerData } from 'node:worker_threads';
import { parseSyntax, InputFailure } from './input.js';

// Only copied bytes and code-owned limits cross this boundary; no authority,
// credentials, paths or environment. Worker results remain syntax facts only.
try { parentPort?.postMessage({ kind: 'parsed', value: parseSyntax(workerData.bytes, workerData.limits) }); }
catch (error) {
  parentPort?.postMessage({ kind: 'rejected', reason: error instanceof InputFailure ? error.reason : 'malformed' });
}
