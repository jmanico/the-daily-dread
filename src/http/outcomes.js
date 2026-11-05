import { closedRecord, cursorPattern, errorProjection, errorSchema, errorStatuses } from '../contracts/http-results.js';
import { HttpFailure, operationSignal } from './application.js';

/** @typedef {import('fastify').FastifyRequest} Request */
/** @typedef {import('fastify').FastifyReply} Reply */
/** @typedef {import('./application.js').Access} Access */
/** @typedef {{kind: 'read'|'updated'|'existing'|'created', resource: unknown} |
 * {kind: 'accepted', jobId: string, status: 'queued'|'running'} |
 * {kind: 'list', items: unknown[], limit: number, nextCursor: string|null} |
 * {kind: 'invalid', fields: string[]} |
 * {kind: 'failure', reason: 'malformed'|'unauthenticated'|'forbidden'|'unavailable'|'conflict'|'rate_limited'|'internal'|'uncertain'|'dependency'}} Outcome */
const failureStatus = new Map([
  ['malformed', 400], ['unauthenticated', 401], ['forbidden', 403], ['unavailable', 404], ['conflict', 409],
  ['rate_limited', 429], ['internal', 500], ['uncertain', 502], ['dependency', 503],
]);
/** Only composition-owned schema data reaches this function, never imported/user schema definitions.
 * @param {unknown} value @param {Set<object>} [seen] */
function freezeSchema(value, seen = new Set()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value); for (const nested of Object.values(value)) freezeSchema(nested, seen);
  Object.freeze(value);
}
/** Projected data cannot run getters/toJSON during validation or serialization.
 * @param {unknown} value @param {{entries: number}} [budget] @param {number} [depth] */
function plainData(value, budget = { entries: 0 }, depth = 0) {
  if (++budget.entries > 100000 || depth > 64) throw new HttpFailure(503);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string' && !/[\uD800-\uDFFF]/u.test(value)) return;
  if (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return;
  if (typeof value !== 'object' || value === null) throw new HttpFailure(503);
  if (Array.isArray(value) && (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1)) throw new HttpFailure(503);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new HttpFailure(503);
  const keys = Reflect.ownKeys(value);
  if (keys.length > 100000) throw new HttpFailure(503);
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !Object.hasOwn(descriptor, 'value') ||
      key === '__proto__' || key === 'constructor' || key === 'prototype') throw new HttpFailure(503);
    plainData(descriptor.value, budget, depth + 1);
  }
}
/** Schema and projector are reviewed application code. The owner projects fields explicitly;
 * strict validation after projection rejects extra/private fields instead of silently stripping them.
 * @param {Record<string, unknown>} schema @param {(resource: unknown) => Record<string, unknown>} project @param {readonly string[]} [publicFields] */
export function createOutcomeResponder(schema, project, publicFields = []) {
  if (typeof project !== 'function' || schema.type !== 'object' || schema.additionalProperties !== false ||
    !Array.isArray(schema.required) || !schema.required.includes('id') || publicFields.length > 32 ||
    publicFields.some(field => !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(field))) throw new Error('Invalid response contract');
  const resourceSchema = structuredClone(schema);
  freezeSchema(resourceSchema);
  const fields = new Set(publicFields);
  const resource = { type: 'object', additionalProperties: false, required: ['outcome', 'resource'],
    properties: { outcome: { enum: ['read', 'updated', 'existing'] }, resource: resourceSchema } };
  const list = { type: 'object', additionalProperties: false, required: ['outcome', 'items', 'pagination'],
    properties: { outcome: { const: 'list' }, items: { type: 'array', maxItems: 100, items: resourceSchema },
      pagination: { type: 'object', additionalProperties: false, required: ['limit', 'nextCursor'], properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100 }, nextCursor: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 256, pattern: cursorPattern }] },
      } } } };
  /** @type {Record<string, object>} */
  const response = {
    200: { oneOf: [resource, list] },
    201: { type: 'object', additionalProperties: false, required: ['outcome', 'resource'], properties: { outcome: { const: 'created' }, resource: resourceSchema } },
    202: { type: 'object', additionalProperties: false, required: ['outcome', 'job'], properties: { outcome: { const: 'accepted' },
      job: { type: 'object', additionalProperties: false, required: ['id', 'status'], properties: {
        id: { type: 'string', minLength: 1, maxLength: 128 }, status: { enum: ['queued', 'running'] },
      } } } },
  };
  for (const status of errorStatuses) response[String(status)] = structuredClone(errorSchema);
  freezeSchema(response);

  /** @param {unknown} outcome @param {string} requestId */
  function translate(outcome, requestId) {
    if (!closedRecord(outcome, ['kind', 'resource', 'jobId', 'status', 'items', 'limit', 'nextCursor', 'fields', 'reason'], ['kind'])) throw new HttpFailure(503);
    if (typeof outcome.kind === 'string' && ['read', 'updated', 'existing', 'created'].includes(outcome.kind) && closedRecord(outcome, ['kind', 'resource'])) {
      return { status: outcome.kind === 'created' ? 201 : 200, body: { outcome: outcome.kind, resource: project(outcome.resource) } };
    }
    if (outcome.kind === 'accepted' && closedRecord(outcome, ['kind', 'jobId', 'status'])) {
      return { status: 202, body: { outcome: 'accepted', job: { id: outcome.jobId, status: outcome.status } } };
    }
    if (outcome.kind === 'list' && closedRecord(outcome, ['kind', 'items', 'limit', 'nextCursor'])) {
      if (!Array.isArray(outcome.items) || typeof outcome.limit !== 'number' || !Number.isInteger(outcome.limit) ||
        outcome.limit < 1 || outcome.limit > 100 || outcome.items.length > outcome.limit) throw new HttpFailure(503);
      const items = [];
      for (let i = 0; i < outcome.items.length; i++) {
        const item = Object.getOwnPropertyDescriptor(outcome.items, String(i));
        if (!item || !Object.hasOwn(item, 'value')) throw new HttpFailure(503);
        items.push(project(item.value));
      }
      return { status: 200, body: { outcome: 'list', items, pagination: { limit: outcome.limit, nextCursor: outcome.nextCursor } } };
    }
    if (outcome.kind === 'invalid' && closedRecord(outcome, ['kind', 'fields']) && Array.isArray(outcome.fields) &&
      outcome.fields.length > 0 && outcome.fields.length <= 32 && outcome.fields.every(field => typeof field === 'string' && fields.has(field))) {
      return { status: 422, body: errorProjection(422, requestId, outcome.fields) };
    }
    if (outcome.kind === 'failure' && closedRecord(outcome, ['kind', 'reason']) && typeof outcome.reason === 'string') {
      const status = failureStatus.get(outcome.reason);
      if (status !== undefined) return { status, body: errorProjection(status, requestId) };
    }
    throw new HttpFailure(503);
  }

  /** Recheck scoped authority immediately before disclosure. Effects/commits remain the use-case owner's responsibility.
   * @param {Request} request @param {Reply} reply @param {unknown} outcome @param {(signal: AbortSignal) => Promise<Access>} currentAuthority */
  async function send(request, reply, outcome, currentAuthority) {
    /** @returns {Promise<void>} */
    async function check() {
      const signal = operationSignal(request);
      if (signal.aborted) throw new HttpFailure(503);
      const access = await currentAuthority(signal);
      if (operationSignal(request).aborted) throw new HttpFailure(503);
      if (access !== 'allowed') throw new HttpFailure(access === 'unauthenticated' ? 401 : access === 'forbidden' ? 403 : access === 'unavailable' ? 404 : access === 'conflict' ? 409 : 503);
    }
    await check();
    const translated = translate(outcome, request.id);
    plainData(translated.body);
    const validate = request.compileValidationSchema(response[String(translated.status)]);
    if (validate(translated.body) !== true) throw new HttpFailure(503);
    const snapshot = structuredClone(translated.body);
    await check();
    return reply.code(translated.status).send(snapshot);
  }
  return Object.freeze({ response, send });
}
