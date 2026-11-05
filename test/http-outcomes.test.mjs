import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'node:http';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createApplication } from '../src/http/application.js';
import { createOutcomeResponder } from '../src/http/outcomes.js';
import { closedRecord, parsePagination, paginationQuerySchema } from '../src/contracts/http-results.js';

const canary = 'private-token-418371';
const schema = { type: 'object', additionalProperties: false, required: ['id', 'name', 'enabled', 'revision'], properties: {
  id: { type: 'string', minLength: 1, maxLength: 128 }, name: { type: 'string', maxLength: 128 }, enabled: { type: 'boolean' },
  revision: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
} };
const row = { id: 'resource-1', name: 'Sample resource', enabled: false, revision: 3, company: 'red', owner: 'alice', secret: canary };
/** @param {unknown} value */
function project(value) {
  if (!closedRecord(value, ['id', 'name', 'enabled', 'revision', 'company', 'owner', 'secret']) || typeof value.id !== 'string') throw new Error('Invalid resource');
  return { id: value.id, name: value.name, enabled: value.enabled, revision: value.revision };
}
/** @typedef {import('../src/http/application.js').Access} Access */
/** @param {import('node:test').TestContext} t
 * @param {{outcome?: unknown, project?: (value: unknown) => Record<string, unknown>, current?: (signal?: AbortSignal) => Promise<Access>}} [options] */
async function fixture(t, options = {}) {
  const contexts = new Map([
    ['alice', { company: 'red', owner: 'alice', role: 'user' }], ['admin', { company: 'red', owner: 'admin', role: 'admin' }],
    ['bob', { company: 'red', owner: 'bob', role: 'user' }], ['eve', { company: 'blue', owner: 'alice', role: 'admin' }],
    ['restricted', { company: 'red', owner: 'alice', role: 'restricted' }],
  ]);
  let calls = 0;
  const app = createApplication(async request => typeof request.headers['x-fixture-actor'] === 'string' && contexts.has(request.headers['x-fixture-actor']) ? 'allowed' : 'unauthenticated');
  const responder = createOutcomeResponder(schema, options.project ?? project, ['name', 'enabled', 'limit', 'cursor', 'querystring']);
  for (const path of ['/ui/fixture', '/api/fixture']) {
    app.get(path, { schema: { querystring: paginationQuerySchema, response: responder.response } }, async (request, reply) => {
      /** @returns {Promise<Access>} */
      const current = options.current ?? (async () => {
        const actor = contexts.get(String(request.headers['x-fixture-actor']));
        if (!actor) return 'unauthenticated';
        if (actor.role === 'restricted') return 'forbidden';
        if (actor.company !== row.company || (actor.owner !== row.owner && actor.role !== 'admin')) return 'unavailable';
        return 'allowed';
      });
      const access = await current();
      if (access !== 'allowed') return responder.send(request, reply, { kind: 'read', resource: row }, current);
      calls++;
      const page = parsePagination(request.query);
      const outcome = Object.hasOwn(options, 'outcome') ? options.outcome : (page.kind === 'valid' ? { kind: 'read', resource: row } : page);
      return responder.send(request, reply, outcome, current);
    });
  }
  t.after(() => app.close()); await app.ready();
  return { app, calls: () => calls, revoke: () => contexts.delete('alice') };
}

test('UI/API entry fixtures share scoped policy and explicit projections without creating another credential scheme', async t => {
  const { app, calls } = await fixture(t);
  for (const path of ['/ui/fixture', '/api/fixture']) {
    for (const [actor, status] of [['alice', 200], ['admin', 200], ['bob', 404], ['eve', 404], ['restricted', 403], ['missing', 401]]) {
      const response = await app.inject({ url: path, headers: { 'x-fixture-actor': actor, 'x-request-id': canary } });
      assert.equal(response.statusCode, status); assert.ok(!response.body.includes(canary));
      if (status === 200) assert.deepEqual(response.json(), { outcome: 'read', resource: { id: row.id, name: row.name, enabled: false, revision: 3 } });
      else { assert.match(response.json().requestId, /^[0-9a-f-]{36}$/); assert.ok(response.json().code); }
    }
  }
  assert.equal(calls(), 4);
});

test('typed success distinguishes created, updated, existing and queued resources', async t => {
  for (const [kind, status] of [['read', 200], ['updated', 200], ['existing', 200], ['created', 201]]) {
    const { app } = await fixture(t, { outcome: { kind, resource: row } });
    const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
    assert.equal(response.statusCode, status); assert.equal(response.json().outcome, kind); assert.equal(response.json().resource.id, row.id);
  }
  for (const status of ['queued', 'running']) {
    const { app } = await fixture(t, { outcome: { kind: 'accepted', jobId: 'job-1', status } });
    const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
    assert.equal(response.statusCode, 202); assert.deepEqual(response.json(), { outcome: 'accepted', job: { id: 'job-1', status } });
  }
});

test('closed failures preserve status and field vocabulary without provider text or uncertain retries', async t => {
  for (const [reason, status] of [['malformed', 400], ['unauthenticated', 401], ['forbidden', 403], ['unavailable', 404],
    ['conflict', 409], ['rate_limited', 429], ['internal', 500], ['uncertain', 502], ['dependency', 503]]) {
    const { app, calls } = await fixture(t, { outcome: { kind: 'failure', reason } });
    const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
    assert.equal(response.statusCode, status); assert.ok(!response.body.includes(canary)); assert.equal(calls(), 1);
    assert.deepEqual(response.json().fieldErrors, []);
    if (reason === 'uncertain') assert.equal(response.json().code, 'operation_uncertain');
  }
  const { app } = await fixture(t, { outcome: { kind: 'invalid', fields: ['name', 'enabled'] } });
  const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
  assert.equal(response.statusCode, 422); assert.deepEqual(response.json().fieldErrors, [{ field: 'name', code: 'invalid' }, { field: 'enabled', code: 'invalid' }]);
});

test('pagination defaults to 50, accepts at most 100 and rejects coercion, duplicate fields and unsafe cursors', async t => {
  assert.deepEqual(parsePagination({}), { kind: 'valid', page: { limit: 50, cursor: null } });
  for (const limit of ['1', '50', '100']) assert.equal(parsePagination({ limit }).page?.limit, Number(limit));
  for (const limit of [0, 100, '0', '101', '01', '-1', '1e2', '100.0', ' 50', ['50', '100']]) assert.equal(parsePagination({ limit }).kind, 'invalid');
  for (const cursor of ['', canary + '\n', 'x'.repeat(257), ['a'], 'a=b']) assert.equal(parsePagination({ cursor }).kind, 'invalid');
  assert.equal(parsePagination({ owner: 'other' }).kind, 'invalid');
  const { app } = await fixture(t, { outcome: { kind: 'list', items: [row], limit: 50, nextCursor: 'opaque_next-1' } });
  const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
  assert.equal(response.statusCode, 200); assert.equal(response.json().items.length, 1); assert.deepEqual(response.json().pagination, { limit: 50, nextCursor: 'opaque_next-1' });
  for (const query of ['limit=101', 'limit=50&limit=100', 'cursor=a&cursor=b', 'owner=another']) {
    assert.equal((await app.inject({ url: `/api/fixture?${query}`, headers: { 'x-fixture-actor': 'alice' } })).statusCode, 422);
  }
});

test('unknown/malformed owner outcomes cannot become an empty successful result', async t => {
  const cases = [undefined, null, false, {}, { kind: 'success' }, { kind: 'read' }, { kind: 'read', resource: row, secret: canary },
    { kind: 'accepted', jobId: '', status: 'queued' }, { kind: 'accepted', jobId: 'job', status: 'succeeded' },
    { kind: 'list', items: [row], limit: 0, nextCursor: null }, { kind: 'list', items: [row, row], limit: 1, nextCursor: null },
    { kind: 'list', items: Array(101).fill(row), limit: 101, nextCursor: null }, { kind: 'list', items: [], limit: 50 },
    { kind: 'list', items: [], limit: 50, nextCursor: canary + '\r\n' },
    { kind: 'failure', reason: 'clean' }, { kind: 'failure', reason: 'internal', message: canary }, { kind: 'invalid', fields: [canary] }];
  for (const outcome of cases) {
    const { app } = await fixture(t, { outcome });
    const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
    assert.equal(response.statusCode, 503); assert.equal(response.json().code, 'service_unavailable'); assert.ok(!response.body.includes(canary));
  }
});

test('projection and actual compiled response validation reject private fields, coercion, accessors and failed projectors', async t => {
  let getterCalls = 0;
  const getter = { id: row.id, name: row.name, enabled: false, revision: 3 };
  Object.defineProperty(getter, 'name', { get() { getterCalls++; return canary; }, enumerable: true });
  for (const projected of [row, { id: row.id, name: row.name, enabled: 'false', revision: 3 }, { id: row.id, name: 'x'.repeat(129), enabled: false, revision: 3 },
    { id: row.id, name: row.name, enabled: false, revision: 9007199254740992 }, getter, Object.create({ id: row.id }), Promise.resolve(row)]) {
    const { app } = await fixture(t, { project: () => projected });
    const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
    assert.equal(response.statusCode, 503); assert.ok(!response.body.includes(canary));
  }
  assert.equal(getterCalls, 0);
  const { app } = await fixture(t, { project: () => { throw new Error(canary); } });
  const failed = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
  assert.equal(failed.statusCode, 503); assert.ok(!failed.body.includes(canary));
});

test('revoked authority or policy failure between owner work and disclosure prevents resource bytes', async t => {
  let checks = 0; let projections = 0;
  const { app } = await fixture(t, { current: async () => ++checks < 3 ? 'allowed' : 'unavailable', project: value => { projections++; return project(value); } });
  const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
  assert.equal(response.statusCode, 404); assert.equal(projections, 1); assert.ok(!response.body.includes(row.id));
  const policy = await fixture(t, { current: async () => { throw new Error(canary); } });
  const failed = await policy.app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
  assert.equal(failed.statusCode, 503); assert.ok(!failed.body.includes(canary)); assert.equal(policy.calls(), 0);
});

test('actual wire response uses the projected schema and no-store headers', async t => {
  const { app } = await fixture(t); await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const response = await new Promise((resolve, reject) => {
    const request = get({ host: '127.0.0.1', port: address.port, path: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } }, reply => {
      let body = ''; reply.on('error', reject); reply.on('data', chunk => { body += chunk.toString(); });
      reply.on('end', () => resolve({ status: reply.statusCode, headers: reply.headers, body }));
    }); request.on('error', reject);
  });
  assert.equal(response.status, 200); assert.equal(response.headers['cache-control'], 'no-store'); assert.match(String(response.headers['content-type']), /application\/json/);
  assert.ok(!response.body.includes(canary)); assert.equal(JSON.parse(response.body).resource.id, row.id);
});

test('authorized projections are snapshots across asynchronous authority rechecks', async t => {
  const projected = { id: row.id, name: row.name, enabled: false, revision: 3 };
  let checks = 0;
  const { app } = await fixture(t, { project: () => projected, current: async () => {
    if (++checks === 3) projected.name = canary;
    return 'allowed';
  } });
  const response = await app.inject({ url: '/api/fixture', headers: { 'x-fixture-actor': 'alice' } });
  assert.equal(response.statusCode, 200); assert.equal(response.json().resource.name, row.name); assert.ok(!response.body.includes(canary));
});

test('actual disconnect cancels a pending final policy check and emits no resource bytes', async t => {
  let checks = 0; let waiting = false; let canceled = false; let bytes = '';
  const { app } = await fixture(t, { current: async signal => {
    if (++checks < 3) return 'allowed';
    assert.ok(signal); waiting = true;
    return await new Promise(resolve => signal.addEventListener('abort', () => { canceled = true; resolve('unauthenticated'); }, { once: true }));
  } });
  await app.listen({ host: '127.0.0.1', port: 0 }); const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const socket = connect({ host: '127.0.0.1', port: address.port }); t.after(() => socket.destroy());
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  socket.on('data', chunk => { bytes += chunk.toString(); });
  socket.write('GET /api/fixture HTTP/1.1\r\nHost: localhost\r\nX-Fixture-Actor: alice\r\n\r\n');
  for (let i = 0; i < 100 && !waiting; i++) await delay(2);
  assert.equal(waiting, true); socket.destroy();
  for (let i = 0; i < 100 && !canceled; i++) await delay(2);
  assert.equal(canceled, true); assert.equal(bytes, '');
});

test('response contracts copy schemas and fail closed on invalid composition', async t => {
  const copied = structuredClone(schema); const responder = createOutcomeResponder(copied, () => row);
  copied.additionalProperties = true; copied.required = [];
  const app = createApplication(async () => 'allowed'); t.after(() => app.close());
  app.get('/fixture', { schema: { response: responder.response } }, async (request, reply) => responder.send(request, reply, { kind: 'read', resource: row }, async () => 'allowed'));
  const response = await app.inject('/fixture'); assert.equal(response.statusCode, 503); assert.ok(!response.body.includes(canary));
  for (const invalid of [{}, { type: 'object', required: ['id'] }, { type: 'object', additionalProperties: false, required: [] }]) {
    assert.throws(() => createOutcomeResponder(invalid, project), /Invalid response contract/);
  }
  assert.throws(() => createOutcomeResponder(schema, project, ['unsafe\r\nfield']), /Invalid response contract/);
});
