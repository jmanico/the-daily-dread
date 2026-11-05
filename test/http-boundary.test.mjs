import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createApplication, operationSignal } from '../src/http/application.js';
import { parseBody } from '../src/http/parse-body.js';
import { parseQuery } from '../src/http/input.js';

const canary = 'private-company-secret-7942';
const bodySchema = { type: 'object', additionalProperties: false, required: ['enabled', 'revision'], properties: {
  enabled: { type: 'boolean', default: false }, revision: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
  note: { type: 'string', maxLength: 128 }, nested: { type: 'object', additionalProperties: false, properties: { flag: { type: 'boolean' } } },
} };
/** @param {import('node:test').TestContext} t @param {(request: import('fastify').FastifyRequest) => Promise<import('../src/http/application.js').Access>} [authorize] */
async function fixture(t, authorize = async () => 'allowed') {
  const app = createApplication(authorize); let effects = 0; let delayedStarted = false;
  app.post('/command', { schema: { body: bodySchema, querystring: { type: 'object', additionalProperties: false,
    properties: { page: { type: 'string', maxLength: 3, pattern: '^[1-9][0-9]{0,2}$' } } },
    response: { 200: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } } } } },
  async () => { effects++; return { ok: true }; });
  app.get('/throw', async () => { throw new Error(canary); });
  app.get('/peer', async request => ({ ip: request.ip, protocol: request.protocol, id: request.id }));
  app.get('/parameter/:id', async () => ({ ok: true }));
  app.post('/slow', { schema: { body: bodySchema } }, async request => { await delay(10040); if (!operationSignal(request).aborted) effects++; return { ok: false }; });
  app.post('/disconnect', { schema: { body: bodySchema } }, async request => {
    delayedStarted = true; await delay(60); if (!operationSignal(request).aborted) effects++; return { ok: false };
  });
  t.after(() => app.close());
  await app.ready();
  return { app, effects: () => effects, delayedStarted: () => delayedStarted };
}
/** @param {number} port @param {string | Buffer} request */
function wire(port, request) {
  return new Promise((resolve, reject) => {
    const socket = connect({ port, host: '127.0.0.1' }); let result = '';
    socket.setTimeout(12000, () => { socket.destroy(); reject(new Error('Test socket deadline')); });
    socket.on('error', reject); socket.on('data', chunk => { result += chunk.toString(); if (result.length > 65536) socket.destroy(); });
    socket.on('close', () => resolve(result)); socket.once('connect', () => socket.write(request));
  });
}

test('registered command parser preserves valid types and rejects malformed, duplicate and poisoned JSON', async t => {
  const { app, effects } = await fixture(t);
  const good = await app.inject({ method: 'POST', url: '/command?page=50', headers: { 'content-type': 'application/json' }, payload: '{"enabled":false,"revision":1}' });
  assert.equal(good.statusCode, 200); assert.deepEqual(good.json(), { ok: true });
  for (const payload of ['{"enabled":true,"enabled":false,"revision":1}', '{"enabl\\u0065d":true,"enabled":false}',
    '{"nested":{"flag":true,"flag":false}}', '{"__proto__":{"polluted":true}}', '{"nested":{"constructor":{}}}',
    '{"prototype":{}}', '{"revision":9007199254740993}', '{"revision":1.0000000000000001}', '{"revision":1e400}',
    '{"revision":1e-400}', '{"revision":-0}', '{"note":"\\ud800"}', '{"enabled":true,}', '{/*comment*/"enabled":true}',
    '', 'true false', 'NaN', '\uFEFF{}', '['.repeat(65) + '0' + ']'.repeat(65)]) {
    const reply = await app.inject({ method: 'POST', url: '/command', headers: { 'content-type': 'application/json' }, payload });
    assert.equal(reply.statusCode, 400, payload); assert.equal(reply.json().code, 'malformed_request');
  }
  assert.equal(effects(), 1); assert.equal(Object.getPrototypeOf({}).polluted, undefined);
});

test('strict schema rejects unknown fields, string booleans, defaults and repeated query singletons', async t => {
  const { app, effects } = await fixture(t);
  for (const payload of [{ enabled: 'false', revision: 1 }, { enabled: true, revision: '1' },
    { enabled: true, revision: 1, company: canary }, { enabled: true, revision: 1, nested: { role: canary } },
    { revision: 1 }, { enabled: true }, { enabled: true, revision: 1, note: 'a'.repeat(129) }]) {
    const reply = await app.inject({ method: 'POST', url: '/command', payload });
    assert.equal(reply.statusCode, 422); assert.ok(reply.json().fieldErrors.length); assert.ok(!reply.body.includes(canary));
  }
  for (const query of ['page=1&page=2', 'page=1&p%61ge=2', 'owner=private', 'page=01']) {
    assert.equal((await app.inject({ method: 'POST', url: `/command?${query}`, payload: { enabled: true, revision: 1 } })).statusCode, 422);
  }
  for (const query of ['x=%ZZ', 'x=%C0%AF', '__proto__=a', 'constructor=a', 'x=' + 'a'.repeat(4096), Array(101).fill('x=1').join('&')]) {
    assert.equal((await app.inject({ method: 'POST', url: `/command?${query}`, payload: { enabled: true, revision: 1 } })).statusCode, 400);
  }
  assert.equal(effects(), 0);
  assert.deepEqual(parseQuery('tag=one&tag=two').tag, ['one', 'two']);
});

test('media, encoding, invalid UTF-8 and streaming byte limits fail before effects', async t => {
  const { app, effects } = await fixture(t);
  for (const headers of [{ 'content-type': 'text/plain' }, { 'content-type': 'application/json; charset=latin1' },
    { 'content-type': 'application/json', 'content-encoding': 'gzip' }, { 'content-type': 'application/json-bogus' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/command', headers, payload: '{}' })).statusCode, 415);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/command' })).statusCode, 415);
  const invalid = await app.inject({ method: 'POST', url: '/command', headers: { 'content-type': 'application/json' }, payload: Buffer.from([0xff]) });
  assert.equal(invalid.statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/command', headers: { 'content-type': 'application/json' }, payload: ' '.repeat(65537) })).statusCode, 413);
  assert.equal(effects(), 0);
});

test('coarse access denies before parsing and translates unavailable policies without disclosure', async t => {
  for (const [decision, status] of [['unauthenticated', 401], ['forbidden', 403], ['unavailable', 404], ['conflict', 409]]) {
    const { app, effects } = await fixture(t, async () => /** @type {import('../src/http/application.js').Access} */ (decision));
    const reply = await app.inject({ method: 'POST', url: '/command', headers: { 'content-type': 'application/json', 'x-request-id': canary }, payload: '{' });
    assert.equal(reply.statusCode, status); assert.equal(effects(), 0); assert.ok(!reply.body.includes(canary));
    assert.match(reply.json().requestId, /^[0-9a-f-]{36}$/);
  }
  const { app, effects } = await fixture(t, async () => { throw new Error(canary); });
  const failed = await app.inject({ method: 'POST', url: '/command', payload: { enabled: true, revision: 1 } });
  assert.equal(failed.statusCode, 503); assert.ok(!failed.body.includes(canary)); assert.equal(effects(), 0);
});

test('actual socket parser rejects ambiguous framing, duplicate headers, excess headers and chunked oversize', async t => {
  const { app, effects } = await fixture(t); await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const start = 'POST /command HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\n';
  const valid = '{"enabled":false,"revision":1}';
  const atHeaderLimit = Array.from({ length: 96 }, (_, i) => `X-${i}: a\r\n`).join('');
  assert.match(String(await wire(address.port, start + `Content-Length: ${Buffer.byteLength(valid)}\r\n${atHeaderLimit}\r\n${valid}`)), /^HTTP\/1.1 200/);
  for (const extra of ['Content-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n{}',
    'Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}', 'Transfer-Encoding: gzip, chunked\r\n\r\n0\r\n\r\n',
    'Authorization: a\r\nauthorization: b\r\nContent-Length: 2\r\n\r\n{}',
    'Content-Length: 2\r\n' + Array.from({ length: 97 }, (_, i) => `X-${i}: a\r\n`).join('') + '\r\n{}',
    'Expect: 100-continue\r\nContent-Length: 2\r\n\r\n{}',
    'Expect: unexpected\r\nContent-Length: 2\r\n\r\n{}',
    'Transfer-Encoding: chunked\r\nTrailer: X-Secret\r\n\r\n0\r\nX-Secret: private\r\n\r\n',
    'X-Large: ' + 'a'.repeat(16384) + '\r\nContent-Length: 2\r\n\r\n{}',
    'Transfer-Encoding: chunked\r\n\r\nZ\r\n{}\r\n0\r\n\r\n']) {
    assert.match(String(await wire(address.port, start + extra)), /^HTTP\/1.1 400/);
  }
  const large = ' '.repeat(65537);
  assert.match(String(await wire(address.port, start + `Transfer-Encoding: chunked\r\n\r\n${large.length.toString(16)}\r\n${large}\r\n0\r\n\r\n`)), /^HTTP\/1.1 413/);
  assert.equal(effects(), 1);
});

test('safe errors, forwarding distrust and handler cancellation hold at the actual factory', async t => {
  const { app, effects } = await fixture(t);
  const error = await app.inject('/throw'); assert.equal(error.statusCode, 503); assert.ok(!error.body.includes(canary));
  assert.equal(error.headers['cache-control'], 'no-store');
  for (const url of [`/bad%ZZ${canary}`, `/parameter/${canary.repeat(10)}`]) {
    const invalid = await app.inject(url); assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().code, 'malformed_request'); assert.ok(!invalid.body.includes(canary));
    assert.equal(invalid.headers['cache-control'], 'no-store'); assert.match(invalid.json().requestId, /^[0-9a-f-]{36}$/);
  }
  const peer = await app.inject({ url: '/peer', headers: { 'x-forwarded-for': '11.0.0.1', 'x-forwarded-proto': 'https', 'x-request-id': canary } });
  assert.equal(peer.json().ip, '127.0.0.1'); assert.equal(peer.json().protocol, 'http'); assert.notEqual(peer.json().id, canary);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const payload = '{"enabled":true,"revision":1}'; const began = performance.now();
  const timeout = await wire(address.port, `POST /slow HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${payload.length}\r\n\r\n${payload}`);
  assert.match(String(timeout), /^HTTP\/1.1 503/); assert.ok(performance.now() - began >= 9900);
  await delay(80); assert.equal(effects(), 0);
  const canceled = new AbortController(); canceled.abort(); await assert.rejects(parseBody(Buffer.from('{}'), canceled.signal));
  const controller = new AbortController(); const pending = parseBody(Buffer.from('{}'), controller.signal); controller.abort(); await assert.rejects(pending);
  const first = parseBody(Buffer.from('{}'), undefined); const second = parseBody(Buffer.from('{}'), undefined);
  await assert.rejects(parseBody(Buffer.from('{}'), undefined)); await Promise.all([first, second]);
  assert.deepEqual(await parseBody(Buffer.from('{"n":1.25,"s":"safe"}'), undefined), { n: 1.25, s: 'safe' });
});

test('worker enforces depth and byte boundaries and fences a result after a blocked event-loop deadline', async () => {
  assert.deepEqual(await parseBody(Buffer.from(' '.repeat(65534) + '{}'), undefined), {});
  await assert.rejects(parseBody(Buffer.alloc(65537, 32), undefined));
  const atDepth = '['.repeat(64) + '0' + ']'.repeat(64);
  assert.ok(Array.isArray(await parseBody(Buffer.from(atDepth), undefined)));
  await assert.rejects(parseBody(Buffer.from('[' + atDepth + ']'), undefined));
  const late = parseBody(Buffer.from('{}'), undefined);
  const rejected = assert.rejects(late, /unavailable/);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2050);
  await rejected;
  assert.deepEqual(await parseBody(Buffer.from('{}'), undefined), {});
});

test('actual client disconnect cancels before authorization completes and after a complete upload', async t => {
  let started = false;
  const { app, effects } = await fixture(t, async () => { started = true; await delay(60); return 'allowed'; });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const socket = connect({ port: address.port, host: '127.0.0.1' });
  t.after(() => socket.destroy());
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  socket.write('POST /command HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 29\r\n\r\n{"enabled":true,"revision":1}');
  for (let i = 0; i < 50 && !started; i++) await delay(2);
  assert.equal(started, true); socket.destroy(); await delay(100); assert.equal(effects(), 0);
  const later = await fixture(t); await later.app.listen({ host: '127.0.0.1', port: 0 });
  const peer = later.app.server.address(); assert.ok(peer && typeof peer !== 'string');
  const connection = connect({ port: peer.port, host: '127.0.0.1' }); t.after(() => connection.destroy());
  await new Promise((resolve, reject) => { connection.once('connect', resolve); connection.once('error', reject); });
  const body = '{"enabled":true,"revision":1}';
  connection.write(`POST /disconnect HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`);
  for (let i = 0; i < 100 && !later.delayedStarted(); i++) await delay(2);
  assert.equal(later.delayedStarted(), true); connection.destroy(); await delay(100); assert.equal(later.effects(), 0);
});
