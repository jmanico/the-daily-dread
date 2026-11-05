import { parentPort, workerData } from 'node:worker_threads';
import { parseCommand } from './input.js';

// Only command bytes cross this boundary; no request context, credentials or environment.
try { parentPort?.postMessage({ kind: 'parsed', value: parseCommand(workerData) }); }
catch { parentPort?.postMessage({ kind: 'invalid' }); }
