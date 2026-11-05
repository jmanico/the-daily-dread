import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceJobCounters, jobLimits } from '../src/jobs/work-budget.js';

const fence = { companyId: 'company-a', jobId: 'job-a', attemptToken: 'attempt-a', version: 1 };
const initial = { ...fence, decodedBytes: 0, treeEntries: 0, activeMs: 0 };
const zero = { decodedBytes: 0, treeEntries: 0, activeMs: 0 };

test('job budget transitions accumulate exact counters and never mutate the loaded owner record', () => {
  const first = advanceJobCounters(initial, fence, { decodedBytes: 20, treeEntries: 3, activeMs: 10 });
  assert.equal(first.kind, 'advanced'); if (first.kind !== 'advanced') return;
  assert.equal(first.record.version, 2); assert.equal(initial.version, 1); assert.equal(initial.decodedBytes, 0);
  assert.ok(Object.isFrozen(first.record));
  const secondFence = { ...fence, version: 2 };
  // Serialization only proves the transition accepts restored exact data. It is
  // not a PostgreSQL/restart acceptance test or authorization evidence.
  const restored = JSON.parse(JSON.stringify(first.record));
  const next = advanceJobCounters(restored, secondFence, { decodedBytes: 4, treeEntries: 1, activeMs: 2 });
  assert.equal(next.kind, 'advanced'); if (next.kind !== 'advanced') return;
  assert.deepEqual(next.record, { ...fence, version: 3, decodedBytes: 24, treeEntries: 4, activeMs: 12 });
  assert.equal(advanceJobCounters(next.record, secondFence, zero).kind, 'rejected');
});

test('scope, job, attempt and revision must match the current owner fence', () => {
  for (const changed of [{ companyId: 'company-b' }, { jobId: 'job-b' }, { attemptToken: 'old-attempt' }, { version: 2 }]) {
    assert.deepEqual(advanceJobCounters(initial, { ...fence, ...changed }, zero), { kind: 'rejected', reason: 'stale', boundary: null, limit: null });
  }
  // An owner renewing a lease must preserve the logical job's counters. A new
  // attempt token does not give this pure transition a fresh budget.
  const resumed = { ...initial, attemptToken: 'attempt-b', version: 2, decodedBytes: 256 * 1024 * 1024 };
  assert.deepEqual(advanceJobCounters(resumed, { ...fence, attemptToken: 'attempt-b', version: 2 }, { ...zero, decodedBytes: 1 }),
    { kind: 'rejected', reason: 'exhausted', boundary: 'decodedBytes', limit: 268435456 });
});

test('all cumulative ceilings accept the boundary and reject the next charge without partial mutation', () => {
  const limits = jobLimits();
  for (const key of /** @type {(keyof typeof limits)[]} */ (Object.keys(limits))) {
    const exact = advanceJobCounters(initial, fence, { ...zero, [key]: limits[key] });
    assert.equal(exact.kind, 'advanced'); if (exact.kind !== 'advanced') continue;
    const before = JSON.stringify(exact.record);
    assert.deepEqual(advanceJobCounters(exact.record, { ...fence, version: 2 }, { ...zero, [key]: 1 }),
      { kind: 'rejected', reason: 'exhausted', boundary: key, limit: limits[key] });
    assert.equal(JSON.stringify(exact.record), before);
  }
  assert.equal(advanceJobCounters(initial, fence, { decodedBytes: 2, treeEntries: 1, activeMs: 1 }, { decodedBytes: 1 }).kind, 'rejected');
});

test('malformed owner facts, unknown fields, unsafe counters, getters and reset attempts fail closed', () => {
  for (const value of [undefined, null, NaN, Infinity, -1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(advanceJobCounters(initial, fence, { ...zero, activeMs: value }).kind, 'rejected');
    assert.equal(advanceJobCounters({ ...initial, treeEntries: value }, fence, zero).kind, 'rejected');
  }
  for (const record of [null, [], {}, { ...initial, private: 'canary' }, { ...initial, companyId: '../other' },
    { ...initial, version: 0 }, { ...initial, version: Number.MAX_SAFE_INTEGER }]) assert.equal(advanceJobCounters(record, fence, zero).kind, 'rejected');
  assert.equal(advanceJobCounters(initial, { ...fence, admin: true }, zero).kind, 'rejected');
  assert.equal(advanceJobCounters(initial, fence, { ...zero, reset: true }).kind, 'rejected');
  let read = false;
  assert.equal(advanceJobCounters(initial, fence, { ...zero, get activeMs() { read = true; return 1; } }).kind, 'rejected');
  assert.equal(read, false);
  for (const config of [null, [], { extra: 1 }, { activeMs: undefined }, { activeMs: '1' }, { activeMs: 0 }, { decodedBytes: Infinity },
    { treeEntries: -1 }, { activeMs: 900001 }, { decodedBytes: 268435457 }, { treeEntries: 100001 }]) assert.throws(() => jobLimits(config));
});
