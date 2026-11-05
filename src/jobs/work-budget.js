import { closedRecord } from '../contracts/http-results.js';

/** @typedef {{decodedBytes:number,treeEntries:number,activeMs:number}} JobCounters */
/** @typedef {{companyId:string,jobId:string,attemptToken:string,version:number}} JobFence */
/** @typedef {JobCounters & JobFence} JobBudgetRecord */
const ceilings = Object.freeze({ decodedBytes: 256 * 1024 * 1024, treeEntries: 100000, activeMs: 15 * 60 * 1000 });
const counterKeys = Object.keys(ceilings);
const fenceKeys = ['companyId', 'jobId', 'attemptToken', 'version'];
const recordKeys = [...fenceKeys, ...counterKeys];
/** @param {unknown} value */
const opaque = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
/** @param {unknown} value */
const count = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Trusted composition may lower ceilings; settings cannot raise them.
 * @param {unknown} [input] @returns {Readonly<JobCounters>} */
export function jobLimits(input = {}) {
  if (!closedRecord(input, counterKeys, [])) throw new Error('Invalid job limits');
  /** @type {JobCounters} */
  const result = { decodedBytes: ceilings.decodedBytes, treeEntries: ceilings.treeEntries, activeMs: ceilings.activeMs };
  for (const key of /** @type {(keyof JobCounters)[]} */ (counterKeys)) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > ceilings[key]) throw new Error('Invalid job limits');
    result[key] = value;
  }
  return Object.freeze(result);
}
/** @param {unknown} record @returns {record is JobFence & Record<string, unknown>} */
function validFence(record) {
  return closedRecord(record, recordKeys, fenceKeys) && opaque(record.companyId) && opaque(record.jobId) &&
    opaque(record.attemptToken) && typeof record.version === 'number' && Number.isSafeInteger(record.version) && record.version >= 1;
}

/** Pure transition for the durable owner, NOT an authorization or storage adapter.
 * Call only inside the owner's scoped, current-authority/lease transaction. Persist
 * the returned counters + version atomically with the owner's transition, using a
 * version/fence predicate; discarded transactions cannot authorize work. Never
 * accept the record, expected fence or deltas directly from HTTP/queue payloads.
 * Charge decoded bytes while reading, tree entries while enumerating, and measured
 * active-work milliseconds. Provider backoff and queue wait are not active work.
 * Reserving before work uses a conservative maximum delta; uncertain/crashed work
 * retains that debit. Refund/settlement must be a separately fenced owner operation
 * (this function intentionally cannot subtract or reset a counter).
 * @param {unknown} record @param {unknown} expected @param {unknown} delta @param {unknown} [configuration]
 * @returns {{kind:'advanced',record:Readonly<JobBudgetRecord>}|{kind:'rejected',reason:'invalid'|'stale'|'exhausted',boundary:string|null,limit:number|null}}
 */
export function advanceJobCounters(record, expected, delta, configuration = {}) {
  const limits = jobLimits(configuration);
  const invalid = /** @type {const} */ ({ kind: 'rejected', reason: 'invalid', boundary: null, limit: null });
  if (!closedRecord(record, recordKeys) || !validFence(record) || !closedRecord(expected, fenceKeys) || !validFence(expected) ||
    !closedRecord(delta, counterKeys)) return invalid;
  for (const key of counterKeys) if (!count(record[key]) || !count(delta[key])) return invalid;
  if (record.companyId !== expected.companyId || record.jobId !== expected.jobId || record.attemptToken !== expected.attemptToken || record.version !== expected.version) {
    return { kind: 'rejected', reason: 'stale', boundary: null, limit: null };
  }
  if (record.version >= Number.MAX_SAFE_INTEGER) return invalid;
  /** @type {JobCounters} */ const next = { decodedBytes: 0, treeEntries: 0, activeMs: 0 };
  for (const key of /** @type {(keyof JobCounters)[]} */ (counterKeys)) {
    const previous = /** @type {number} */ (record[key]), increase = /** @type {number} */ (delta[key]);
    if (previous > limits[key] || increase > limits[key] - previous) return { kind: 'rejected', reason: 'exhausted', boundary: key, limit: limits[key] };
    next[key] = previous + increase;
  }
  return { kind: 'advanced', record: Object.freeze({ companyId: record.companyId, jobId: record.jobId,
    attemptToken: record.attemptToken, version: record.version + 1,
    decodedBytes: next.decodedBytes, treeEntries: next.treeEntries, activeMs: next.activeMs }) };
}
