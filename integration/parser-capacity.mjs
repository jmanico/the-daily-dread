// Controlled parser-only load. This is not the 1,000-repository/100-user app gate.
import assert from 'node:assert/strict';
import { cpus, platform, arch, totalmem } from 'node:os';
import { parseJSONTask, parserStatus, ParserFailure } from '../src/workers/json-tasks.js';

const start = performance.now();
const baselineRssBytes = process.memoryUsage.rss();
let peakObservedRssBytes = baselineRssBytes, maxActive = 0, maxPending = 0, maxPendingBytes = 0;
function sample() {
  peakObservedRssBytes = Math.max(peakObservedRssBytes, process.memoryUsage.rss());
  const status = parserStatus();
  maxActive = Math.max(maxActive, status.active); maxPending = Math.max(maxPending, status.pending);
  maxPendingBytes = Math.max(maxPendingBytes, status.pendingBytes);
  assert.ok(status.active <= 2); assert.ok(status.pending <= 100); assert.ok(status.pendingBytes <= 16 * 1024 * 1024);
}
const interval = setInterval(sample, 10);
try {
  const inputs = [Buffer.from('"' + 'x'.repeat(2 * 1024 * 1024 - 2) + '"'), Buffer.from('"' + 'y'.repeat(2 * 1024 * 1024 - 2) + '"')];
  const small = Buffer.from('"' + 'z'.repeat(65534) + '"');
  const tasks = Array.from({ length: 102 }, (_, i) => parseJSONTask(i < 2 ? inputs[i] : small,
    { bytes: 2 * 1024 * 1024 }, new AbortController().signal).then(value => {
      assert.equal(typeof value, 'string'); assert.equal(/** @type {string} */ (value).length, (i < 2 ? 2 * 1024 * 1024 : 65536) - 2);
      sample();
    }));
  sample();
  await assert.rejects(parseJSONTask(small, {}, new AbortController().signal), error => error instanceof ParserFailure && error.reason === 'overloaded');
  const results = await Promise.allSettled(tasks);
  assert.ok(results.every(result => result.status === 'fulfilled'), 'Every admitted bounded task completed');
  sample();
  assert.equal(maxActive, 2); assert.equal(maxPending, 100); assert.equal(parserStatus().active, 0);
  console.log(JSON.stringify({ scope: 'parser-only synthetic load', node: process.version, platform: platform(), arch: arch(),
    cpuModel: cpus()[0]?.model, logicalCpus: cpus().length, hostMemoryBytes: totalmem(),
    workers: 2, pendingLimit: 100, pendingByteLimit: 16777216, taskOldGenerationMiB: 64, taskDeadlineMs: 2000,
    submitted: 103, completed: 102, admissionRejected: 1, decodedInputBytes: 2 * 2097152 + 100 * 65536,
    elapsedMs: Math.ceil(performance.now() - start), baselineRssBytes, peakObservedRssBytes,
    processPeakRssBytes: process.resourceUsage().maxRSS * 1024, sampleIntervalMs: 10,
    maxActive, maxPending, maxPendingBytes, containerMemoryLimit: 'not established by this script' }, null, 2));
} finally { clearInterval(interval); }
