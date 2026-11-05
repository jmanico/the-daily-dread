import { visit } from 'jsonc-parser';
import { parserLimits } from '../workers/limits.js';

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export class InputFailure extends Error {
  /** @param {'malformed'|'bytes'|'depth'|'entries'|'timeout'} [reason] */
  constructor(reason = 'malformed') { super('Malformed request'); this.reason = reason; }
}
/** Decimal equivalence without silently losing submitted precision. Grammar is validated by the visitor.
 * @param {string} token */
function decimal(token) {
  if (token.length > 128) throw new InputFailure();
  const [mantissa, power = '0'] = token.toLowerCase().split('e');
  const exponent = Number(power);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) throw new InputFailure();
  const [whole, fraction = ''] = mantissa.split('.');
  const negative = whole.startsWith('-');
  let digits = (negative ? whole.slice(1) : whole) + fraction;
  let scale = exponent - fraction.length;
  digits = digits.replace(/^0+/, '');
  while (digits.endsWith('0')) { digits = digits.slice(0, -1); scale++; }
  return digits ? `${negative ? '-' : ''}${digits}e${scale}` : '0';
}

/** Worker-only untrusted JSON boundary. @param {Uint8Array} bytes @returns {unknown} */
export function parseCommand(bytes) { return parseSyntax(bytes, { bytes: 65536 }); }

/** Fixed worker entry: configuration is code-owned, never read from document fields.
 * @param {Uint8Array} bytes @param {unknown} configuration @returns {unknown} */
export function parseSyntax(bytes, configuration) {
  const limits = parserLimits(configuration);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > limits.bytes) throw new InputFailure('bytes');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  /** @type {(Set<string> | null)[]} */ const stack = [];
  let entries = 0;
  const deadline = performance.now() + limits.timeMs;
  function tick() {
    if (++entries > limits.entries) throw new InputFailure('entries');
    if (performance.now() >= deadline) throw new InputFailure('timeout');
  }
  /** @param {Set<string> | null} keys */
  function begin(keys) { tick(); if (stack.length >= limits.depth) throw new InputFailure('depth'); stack.push(keys); }
  visit(text, {
    onObjectBegin() { begin(new Set()); }, onArrayBegin() { begin(null); },
    onObjectEnd() { stack.pop(); }, onArrayEnd() { stack.pop(); },
    onObjectProperty(name) {
      tick(); const keys = stack.at(-1);
      if (!keys || forbidden.has(name) || keys.has(name) || /[\uD800-\uDFFF]/u.test(name)) throw new InputFailure();
      keys.add(name);
    },
    onLiteralValue(value, offset, length) {
      tick();
      if (typeof value === 'number' && (!Number.isFinite(value) ||
        (Number.isInteger(value) && !Number.isSafeInteger(value)) || Object.is(value, -0) ||
        decimal(text.slice(offset, offset + length)) !== decimal(String(value)))) throw new InputFailure();
      if (typeof value === 'string' && /[\uD800-\uDFFF]/u.test(value)) throw new InputFailure();
    },
    onError() { throw new InputFailure(); },
  }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  const value = JSON.parse(text);
  if (performance.now() >= deadline) throw new InputFailure('timeout');
  return value;
}

/** Preserve repeated occurrences for route-specific cardinality validation. @param {string} text */
export function parseQuery(text) {
  if (Buffer.byteLength(text, 'utf8') > 4096) throw new InputFailure();
  /** @type {Record<string, string | string[]>} */ const query = Object.create(null);
  if (text === '') return query;
  const parts = text.split('&');
  if (parts.length > 100) throw new InputFailure();
  for (const part of parts) {
    const separator = part.indexOf('=');
    const key = decodeURIComponent((separator < 0 ? part : part.slice(0, separator)).replaceAll('+', ' '));
    const value = decodeURIComponent((separator < 0 ? '' : part.slice(separator + 1)).replaceAll('+', ' '));
    if (!key || forbidden.has(key) || /[\uD800-\uDFFF]/u.test(key) || /[\uD800-\uDFFF]/u.test(value)) throw new InputFailure();
    const previous = query[key];
    if (previous === undefined) query[key] = value;
    else if (Array.isArray(previous)) previous.push(value);
    else query[key] = [previous, value];
  }
  return query;
}
