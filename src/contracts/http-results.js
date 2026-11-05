// Shared, browser-compatible response vocabulary; no identity, I/O or rendering authority.
const failures = new Map([
  [400, ['malformed_request', 'The request is malformed.']],
  [401, ['authentication_required', 'Authentication is required.']],
  [403, ['access_denied', 'This operation is not permitted.']],
  [404, ['unavailable_resource', 'The resource is unavailable.']],
  [409, ['revision_conflict', 'Reload the resource before retrying.']],
  [413, ['body_limit', 'The request exceeds the permitted body size.']],
  [415, ['unsupported_media', 'The request media type or encoding is unsupported.']],
  [422, ['invalid_fields', 'The submitted fields are invalid.']],
  [429, ['rate_limited', 'The request limit has been reached.']],
  [500, ['service_failure', 'The operation could not be completed.']],
  [502, ['operation_uncertain', 'The result could not be confirmed. Check its status before retrying.']],
  [503, ['service_unavailable', 'The operation could not be completed.']],
]);
export const errorStatuses = Object.freeze([...failures.keys()]);
const requestIdPattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
export const cursorPattern = '^[A-Za-z0-9_-]{1,256}$';
/** @param {number} status */
export function isErrorStatus(status) { return failures.has(status); }
/** Only code-owned field names may be supplied by a caller. @param {number} status @param {string} requestId @param {readonly string[]} [fields] */
export function errorProjection(status, requestId, fields = []) {
  if (typeof requestId !== 'string' || !new RegExp(requestIdPattern).test(requestId) || fields.length > 32 ||
    fields.some(field => typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(field))) throw new Error('Invalid error projection');
  const [code, message] = failures.get(status) ?? failures.get(503) ?? [];
  return { code, message, requestId, fieldErrors: fields.map(field => ({ field, code: 'invalid' })) };
}
export const errorSchema = {
  type: 'object', additionalProperties: false, required: ['code', 'message', 'requestId', 'fieldErrors'],
  properties: {
    code: { type: 'string', enum: [...failures.values()].map(([code]) => code), maxLength: 64 },
    message: { type: 'string', maxLength: 128 },
    requestId: { type: 'string', pattern: requestIdPattern, maxLength: 36 },
    fieldErrors: { type: 'array', maxItems: 32, items: { type: 'object', additionalProperties: false, required: ['field', 'code'],
      properties: { field: { type: 'string', maxLength: 128 }, code: { const: 'invalid' } } } },
  },
};
export const paginationQuerySchema = {
  type: 'object', additionalProperties: false,
  properties: { limit: { type: 'string', maxLength: 3, pattern: '^(?:[1-9][0-9]?|100)$' }, cursor: { type: 'string', maxLength: 256, pattern: cursorPattern } },
};
/** Reject accessors and inherited/unknown fields instead of treating arbitrary objects as data.
 * @param {unknown} value @param {readonly string[]} keys @param {readonly string[]} [required] @returns {value is Record<string, unknown>} */
export function closedRecord(value, keys, required = keys) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const names = Reflect.ownKeys(value);
  return names.length <= keys.length && names.every(key => typeof key === 'string' && keys.includes(key) &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value')) && required.every(key => Object.hasOwn(value, key));
}
/** @param {unknown} input */
export function parsePagination(input) {
  if (!closedRecord(input, ['limit', 'cursor'], [])) return { kind: 'invalid', fields: ['querystring'] };
  if (input.limit !== undefined && (typeof input.limit !== 'string' || !/^(?:[1-9][0-9]?|100)$/.test(input.limit))) return { kind: 'invalid', fields: ['limit'] };
  if (input.cursor !== undefined && (typeof input.cursor !== 'string' || !new RegExp(cursorPattern).test(input.cursor))) return { kind: 'invalid', fields: ['cursor'] };
  return { kind: 'valid', page: Object.freeze({ limit: input.limit === undefined ? 50 : Number(input.limit), cursor: input.cursor ?? null }) };
}
