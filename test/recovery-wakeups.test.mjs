import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryWakeups } from '../src/jobs/recovery-wakeups.js';

test('recovery requests immediate startup reconciliation and stops on pre-aborted/invalid signals',async()=>{
  const stopped=new AbortController();stopped.abort();assert.equal((await recoveryWakeups(stopped.signal).next()).done,true);
  await assert.rejects(recoveryWakeups(/** @type {AbortSignal} */({})).next(),/Invalid recovery signal/);
  const signal=new AbortController();const ticks=recoveryWakeups(signal.signal);
  assert.equal((await ticks.next()).done,false);
  const waiting=ticks.next();signal.abort();assert.equal((await waiting).done,true);
});
test('actual recovery cadence provides a 30-second wake-up when no notification arrives',{timeout:35000},async()=>{
  const stop=new AbortController();const ticks=recoveryWakeups(stop.signal);
  const start=performance.now();assert.equal((await ticks.next()).done,false);
  // No post-commit notification is delivered. This is the real timer, not a fake.
  assert.equal((await ticks.next()).done,false);
  const elapsed=performance.now()-start;assert.ok(elapsed>=29900 && elapsed<34000);
  stop.abort();assert.equal((await ticks.next()).done,true);
});
