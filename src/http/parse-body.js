import { InputFailure } from './input.js';
import { parseJSONTask, ParserFailure } from '../workers/json-tasks.js';

export class ParserUnavailable extends Error {
  constructor() { super('Parser unavailable'); }
}
/** HTTP shares installation worker admission but never queues request bodies.
 * @param {Uint8Array} bytes @param {AbortSignal | undefined} signal @returns {Promise<unknown>} */
export async function parseBody(bytes, signal) {
  try { return await parseJSONTask(bytes, { bytes: 65536 }, signal ?? new AbortController().signal, false); }
  catch (error) {
    if (error instanceof ParserFailure && ['malformed', 'bytes', 'depth', 'entries'].includes(error.reason)) throw new InputFailure();
    throw new ParserUnavailable();
  }
}
