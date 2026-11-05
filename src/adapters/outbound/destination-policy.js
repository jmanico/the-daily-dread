import { isIP } from 'node:net';
import { isPublicAddress } from './address-policy.js';

/** @typedef {{origin:string,paths:readonly string[],queryKeys:readonly string[]}} Endpoint */
/** @typedef {{id:string,revision:string,companyId:string,endpoints:readonly Endpoint[]}} DestinationPolicy */
/** @param {unknown} value @returns {value is Record<string,unknown>} */
export function plainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
/** @param {Record<string,unknown>} value @param {string[]} keys */
function exactKeys(value,keys) { return Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key)); }
/** @param {unknown} value @returns {value is string} */
function identifier(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }

/** Parse a hop once, with no base URL or caller-provided transport options.
 * @param {unknown} input @returns {URL | undefined}
 */
export function parseDestination(input) {
  if (typeof input !== 'string' || Buffer.byteLength(input)>4096 || /[\s\\\u0000-\u001f\u007f]/u.test(input)) return;
  let url;
  try { url = new URL(input); } catch { return; }
  if (url.protocol !== 'https:' || url.username || url.password || input.includes('#') || !url.hostname || url.hostname.endsWith('.') || url.port === '0') return;
  const host = url.hostname.startsWith('[') ? url.hostname.slice(1,-1) : url.hostname;
  if (isIP(host) && !isPublicAddress(host)) return;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.') && !isIP(host)) return;
  return url;
}

/** Copy and freeze reviewed configuration; mutation by its caller cannot widen it.
 * @param {unknown} input @returns {Readonly<DestinationPolicy> | undefined}
 */
export function destinationPolicy(input) {
  if (!plainRecord(input) || !exactKeys(input,['id','revision','companyId','endpoints'])) return;
  if (!identifier(input.id) || !identifier(input.companyId) || typeof input.revision !== 'string' || !/^[1-9][0-9]{0,18}$/.test(input.revision)) return;
  if (!Array.isArray(input.endpoints) || input.endpoints.length === 0 || input.endpoints.length > 32) return;
  /** @type {Endpoint[]} */
  const endpoints = [];
  const origins = new Set();
  for (const entry of input.endpoints) {
    if (!plainRecord(entry) || !exactKeys(entry,['origin','paths','queryKeys'])) return;
    const url = parseDestination(entry.origin);
    if (!url || url.origin !== entry.origin || url.pathname !== '/' || url.search || origins.has(url.origin)) return;
    origins.add(url.origin);
    if (!Array.isArray(entry.paths) || entry.paths.length === 0 || entry.paths.length>100 || !Array.isArray(entry.queryKeys) || entry.queryKeys.length>32) return;
    /** @type {string[]} */ const paths=[];
    for (const path of entry.paths) {
      if (typeof path !== 'string' || path.length>2048 || !path.startsWith('/') || /[?#\\\s\u0000-\u001f]/u.test(path)) return;
      let candidate;
      try { candidate=new URL(path,url.origin); } catch { return; }
      if (candidate.origin !== url.origin || candidate.pathname !== path || paths.includes(path)) return;
      paths.push(path);
    }
    /** @type {string[]} */ const queryKeys=[];
    for (const key of entry.queryKeys) {
      if (typeof key !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key) || ['__proto__','constructor','prototype'].includes(key) || queryKeys.includes(key)) return;
      queryKeys.push(key);
    }
    endpoints.push(Object.freeze({origin:url.origin,paths:Object.freeze(paths),queryKeys:Object.freeze(queryKeys)}));
  }
  return Object.freeze({id:input.id,revision:input.revision,companyId:input.companyId,endpoints:Object.freeze(endpoints)});
}

/** @param {Readonly<DestinationPolicy>} policy @param {URL} url */
export function permitsDestination(policy,url) {
  const endpoint = policy.endpoints.find(entry=>entry.origin === url.origin && entry.paths.includes(url.pathname));
  if (!endpoint) return false;
  const seen = new Set();
  for (const [key,value] of url.searchParams) {
    if (!endpoint.queryKeys.includes(key) || seen.has(key) || Buffer.byteLength(value)>1024) return false;
    seen.add(key);
  }
  return true;
}
