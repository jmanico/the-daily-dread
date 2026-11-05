import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJSONTask, parserStatus, ParserFailure } from '../src/workers/json-tasks.js';
import { parserLimits } from '../src/workers/limits.js';
import { parseBody } from '../src/http/parse-body.js';

const signal = () => new AbortController().signal;
/** @param {string} text @param {unknown} [limits] @param {AbortSignal} [cancel] */
const parse = (text, limits = {}, cancel = signal()) => parseJSONTask(Buffer.from(text), limits, cancel);
/** @param {string} reason @param {number|null} [limit] */
const rejected = (reason, limit = null) => (/** @type {unknown} */ error) => error instanceof ParserFailure && error.reason === reason && error.limit === limit;

test('parser limits reject missing effective values, unknown fields, coercion and accessors', () => {
  assert.deepEqual(parserLimits(), { bytes: 10485760, depth: 64, entries: 100000, timeMs: 2000 });
  assert.deepEqual(parserLimits({ bytes: 1, depth: 1, entries: 1, timeMs: 1 }), { bytes: 1, depth: 1, entries: 1, timeMs: 1 });
  for (const config of [null, [], false, 2, { extra: 1 }, { bytes: undefined }, { bytes: '2' }, { depth: 0 },
    { entries: -1 }, { timeMs: NaN }, { timeMs: Infinity }, { bytes: 10485761 }, { depth: 65 }, { entries: 100001 }, { timeMs: 2001 }, { entries: 1.1 }, { [Symbol('x')]: 1 }]) assert.throws(() => parserLimits(config));
  let reads = 0;
  assert.throws(() => parserLimits({ get bytes() { reads++; return 1; } }));
  assert.equal(reads, 0);
  const config = parserLimits(); assert.ok(Object.isFrozen(config));
});

test('real fixed worker enforces exact input, depth and entry budgets before returning syntax facts', async () => {
  assert.deepEqual(await parse('{"safe":false,"items":[1,2]}'), { safe: false, items: [1,2] });
  assert.deepEqual(await parse('[]', { bytes: 2, depth: 1, entries: 1 }), []);
  await assert.rejects(parse('[] ', { bytes: 2 }), rejected('bytes', 2));
  assert.deepEqual(await parse('[[]]', { depth: 2, entries: 2 }), [[]]);
  await assert.rejects(parse('[[]]', { depth: 1 }), rejected('depth', 1));
  assert.deepEqual(await parse('[0,1]', { entries: 3 }), [0,1]);
  await assert.rejects(parse('[0,1]', { entries: 2 }), rejected('entries', 2));
  await assert.rejects(parse('"é"', { bytes: 3 }), rejected('bytes', 3));
  assert.equal(await parse('"é"', { bytes: 4 }), 'é');
  for (const text of ['{"x":1,"x":2}', '{"__proto__":{}}', '{"constructor":{}}', '{"prototype":1}',
    '{"n":9007199254740993}', '"\\ud800"', '\uFEFF{}', '{"x":true,}', 'null null', '']) {
    await assert.rejects(parse(text), rejected('malformed'));
  }
  await assert.rejects(parseJSONTask(new Uint8Array([0xff]), {}, signal()), rejected('malformed'));
  await assert.rejects(parseJSONTask(new Uint8Array(new SharedArrayBuffer(8)), {}, signal()), rejected('bytes', 10485760));
  assert.deepEqual(await parse('['.repeat(64) + '0' + ']'.repeat(64)), JSON.parse('['.repeat(64) + '0' + ']'.repeat(64)));
  await assert.rejects(parse('['.repeat(65) + '0' + ']'.repeat(65)), rejected('depth', 64));
  const exact = '[0' + ',0'.repeat(99998) + ']';
  assert.equal(/** @type {unknown[]} */ (await parse(exact)).length, 99999);
  await assert.rejects(parse('[0' + ',0'.repeat(99999) + ']'), rejected('entries', 100000));
});

test('one pool caps actual worker starts at two, pending count at 100 and shares HTTP admission', async () => {
  const controllers = Array.from({ length: 102 }, () => new AbortController());
  const tasks = controllers.map(controller => parse('{}', {}, controller.signal));
  const settled = Promise.allSettled(tasks);
  assert.equal(parserStatus().active, 2); assert.equal(parserStatus().pending, 100); assert.equal(parserStatus().pendingBytes, 200);
  await assert.rejects(parse('{}'), rejected('overloaded', 100));
  await assert.rejects(parseJSONTask(Buffer.from('{}'), {}, signal(), false), error => error instanceof ParserFailure && error.limit === 2 && error.boundary === 'worker_count');
  await assert.rejects(parseBody(Buffer.from('{}'), undefined));
  for (const controller of controllers) controller.abort();
  const results = await settled;
  assert.ok(results.every(result => result.status === 'rejected' && rejected('canceled')(result.reason)));
  assert.equal(parserStatus().active, 0); assert.equal(parserStatus().pending, 0); assert.equal(parserStatus().pendingBytes, 0);
  assert.deepEqual(await parseBody(Buffer.from('{}'), undefined), {});
});

test('pending byte admission rejects before another copy and cancellation releases the queue charge', async () => {
  const controllers = Array.from({ length: 5 }, () => new AbortController());
  const blocker1 = parse('{}', {}, controllers[0].signal), blocker2 = parse('{}', {}, controllers[1].signal);
  const ten = Buffer.alloc(10 * 1024 * 1024, 32), six = Buffer.alloc(6 * 1024 * 1024, 32);
  const first = parseJSONTask(ten, {}, controllers[2].signal), second = parseJSONTask(six, {}, controllers[3].signal);
  const settled = Promise.allSettled([blocker1, blocker2, first, second]);
  assert.equal(parserStatus().pendingBytes, 16 * 1024 * 1024);
  await assert.rejects(parse('0'), rejected('overloaded', 16 * 1024 * 1024));
  controllers[2].abort();
  assert.equal(parserStatus().pendingBytes, 6 * 1024 * 1024);
  const next = parse('0', {}, controllers[4].signal); const nextSettled = Promise.allSettled([next]);
  assert.equal(parserStatus().pendingBytes, 6 * 1024 * 1024 + 1);
  controllers.forEach(controller => controller.abort());
  await settled; await nextSettled;
  assert.equal(parserStatus().pendingBytes, 0); assert.equal(parserStatus().active, 0);
});

test('queued snapshots cannot be mutated, canceled tasks cannot return, and released capacity is reused', async () => {
  const first = parse('{}'), second = parse('{}');
  const mutable = Buffer.from('{"value":"before"}');
  const queued = parseJSONTask(mutable, {}, signal()); mutable.fill(120);
  const controller = new AbortController();
  const canceled = parse('{"private":"do-not-disclose"}', {}, controller.signal);
  const canceledCheck = assert.rejects(canceled, rejected('canceled'));
  controller.abort();
  await Promise.all([first, second, canceledCheck]);
  assert.deepEqual(await queued, { value: 'before' });
  const already = new AbortController(); already.abort();
  await assert.rejects(parse('{}', {}, already.signal), rejected('canceled'));
  const running = new AbortController(); const started = parse('{}', {}, running.signal);
  const runningCheck = assert.rejects(started, rejected('canceled')); running.abort(); await runningCheck;
  assert.equal(parserStatus().active, 0); assert.equal(parserStatus().pending, 0);
  assert.deepEqual(await parse('{"next":true}'), { next: true });
});

test('real worker deadline rejects late delivery even when the main event loop delayed its timer', async () => {
  const timeout = parse('{}', { timeMs: 1 });
  await assert.rejects(timeout, rejected('timeout', 1));
  const late = parse('{}', { timeMs: 50 });
  const handled = assert.rejects(late, rejected('timeout', 50));
  const deadline = performance.now() + 100;
  while (performance.now() < deadline) { /* Deliberately delay parent timer/message dispatch. */ }
  await handled;
  assert.equal(parserStatus().active, 0);
  assert.deepEqual(await parse('{}'), {});
});

test('fixed worker failure, invalid reply, premature exit and excessive JS heap never disclose a success', async t => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const root = await mkdtemp(join(tmpdir(), 'dread-parser-fault-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const canary = 'synthetic-worker-private-7713';
  const cases = [
    "import { parentPort, resourceLimits } from 'node:worker_threads'; parentPort.postMessage({kind:'parsed',value:{oldGenerationMiB:resourceLimits.maxOldGenerationSizeMb,environmentKeys:Object.keys(process.env).length,execArgv:process.execArgv}});",
    `throw new Error('${canary}');`,
    'process.exit(0);',
    "import { parentPort } from 'node:worker_threads'; parentPort.postMessage({kind:'unknown',private:'hidden'});",
    "import { parentPort } from 'node:worker_threads'; parentPort.postMessage(()=>{});",
    "import { parentPort } from 'node:worker_threads'; const retained=[]; for(let i=0;i<300;i++) retained.push(new Array(100000).fill(i)); parentPort.postMessage({kind:'parsed',value:'heap-limit-bypassed'});",
  ];
  for (let i = 0; i < cases.length; i++) {
    // Copy the actual owner unchanged. Only the fixed module's implementation in
    // this isolated test tree is replaced, never its runtime path/configuration.
    const fixture = join(root, String(i));
    await mkdir(join(fixture, 'src/workers'), { recursive: true }); await mkdir(join(fixture, 'src/http'));
    await writeFile(join(fixture, 'package.json'), '{"type":"module"}');
    for (const name of ['json-tasks.js', 'limits.js']) await writeFile(join(fixture, 'src/workers', name), await readFile(new URL(`../src/workers/${name}`, import.meta.url)));
    await writeFile(join(fixture, 'src/http/json-worker.js'), cases[i]);
    const owner = await import(pathToFileURL(join(fixture, 'src/workers/json-tasks.js')).href);
    if (i === 0) {
      assert.deepEqual(await owner.parseJSONTask(Buffer.from('{}'), {}, signal()), { oldGenerationMiB: 64, environmentKeys: 0, execArgv: [] });
      continue;
    }
    await assert.rejects(owner.parseJSONTask(Buffer.from('{}'), {}, signal()), (/** @type {unknown} */ error) => {
      assert.ok(error instanceof Error); assert.equal(error.message, 'Parser task rejected');
      assert.ok(!error.message.includes(canary)); return true;
    });
    assert.equal(owner.parserStatus().active, 0); assert.equal(owner.parserStatus().pending, 0);
  }
});
