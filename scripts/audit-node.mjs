import { request as httpsRequest } from 'node:https';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseJSONTask } from '../src/workers/json-tasks.js';

/** @typedef {(url:string,options:import('node:https').RequestOptions,callback:(response:import('node:http').IncomingMessage)=>void)=>import('node:http').ClientRequest} RequestFunction */

// Narrow checked contract for the reviewed CommonJS API; no custom semver parser.
/** @type {{valid:(v:string)=>string|null,validRange:(r:string)=>string|null,satisfies:(v:string,r:string)=>boolean}} */
const semver = createRequire(import.meta.url)('semver');
export const sources = Object.freeze({
  security:'https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json',
  schedule:'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json',
});
/** @param {string} code */
function failure(code) { return new Error(`Runtime audit unavailable: ${code}`); }
/** @param {unknown} value @returns {value is Record<string,unknown>} */
function object(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
/** @param {unknown} value */
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) throw failure('invalid_schedule');
  const time=Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10)!==value) throw failure('invalid_schedule');
  return time;
}
/** @param {unknown} value */
function range(value) {
  if (typeof value !== 'string' || value.length===0 || value.length>256 || !/^[0-9A-Za-z .<>=|*+~^_-]+$/.test(value) || semver.validRange(value)===null) throw failure('invalid_advisory_range');
  return value;
}
/** Evaluate complete fetched sources conservatively across all platforms.
 * No severity/platform exemptions; unrecognized or incomplete data fails closed.
 * @param {string} version @param {unknown} security @param {unknown} schedule @param {number} [now] */
export function assessRuntime(version,security,schedule,now=Date.now()) {
  if (!/^v?(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/.test(version) || version.length>32 || semver.valid(version)===null || !Number.isFinite(now)) throw failure('invalid_runtime');
  const normalized=version.replace(/^v/,'');
  if (!object(schedule) || Object.keys(schedule).length>100) throw failure('invalid_schedule');
  const support=schedule[`v${normalized.split('.')[0]}`];
  if (!object(support)) throw failure('unknown_runtime_support');
  const start=day(support.start),end=day(support.end);
  if (end<=start || now<start || now>=end) throw failure('unsupported_runtime');
  if (!object(security)) throw failure('invalid_advisories');
  const entries=Object.entries(security);
  if (entries.length===0 || entries.length>5000) throw failure('invalid_advisory_count');
  /** @type {{id:string,cves:string[],patched:string}[]} */
  const matches=[];
  const deadline=performance.now()+2000;
  for (const [id,item] of entries) {
    if (performance.now()>=deadline) throw failure('evaluation_deadline');
    if (!/^[0-9]{1,12}$/.test(id) || !object(item)) throw failure('invalid_advisory');
    const vulnerable=range(item.vulnerable),patched=range(item.patched);
    if (!Array.isArray(item.cve) || item.cve.length>64 || item.cve.some(v=>typeof v!=='string' || !/^CVE-[0-9]{4}-[0-9]{4,12}$/.test(v))) throw failure('invalid_advisory_id');
    if (semver.satisfies(normalized,vulnerable) && !semver.satisfies(normalized,patched)) matches.push({id,cves:item.cve.slice(),patched});
  }
  if (performance.now()>=deadline) throw failure('evaluation_deadline');
  return {version:normalized,advisoriesChecked:entries.length,matches};
}
/** No redirects, caching fallback, credentials or caller-selected destination in the CLI.
 * requestImpl exists solely for controlled transport tests; production uses native verified TLS.
 * @param {string} url
 * @param {{requestImpl?:RequestFunction,timeoutMs?:number,now?:number}} [options]
 */
export async function fetchAuditSource(url,{requestImpl=httpsRequest,timeoutMs=10000,now=Date.now()}={}) {
  if ((url!==sources.security && url!==sources.schedule) || !Number.isSafeInteger(timeoutMs) || timeoutMs<1 || timeoutMs>10000 || !Number.isFinite(now)) throw failure('invalid_source');
  const maximum=url===sources.security ? 2*1024*1024 : 256*1024;
  const bytes=await new Promise((/** @type {(bytes:Buffer)=>void} */ accept,reject)=>{
    /** @type {import('node:http').ClientRequest|undefined} */ let request;
    /** @type {import('node:http').IncomingMessage|undefined} */ let response;
    let done=false;
    const deadline=performance.now()+timeoutMs;
    /** @param {Error} error */
    const fail=error=>{if(done)return;done=true;clearTimeout(timer);response?.destroy();request?.destroy();reject(error);};
    const timer=setTimeout(()=>fail(failure('transport_deadline')),timeoutMs);
    try {
      request=requestImpl(url,{method:'GET',agent:false,headers:{Accept:'application/json','Accept-Encoding':'identity'}},res=>{
        response=res;
        res.once('error',()=>fail(failure('transport_error')));
        res.once('aborted',()=>fail(failure('truncated_response')));
        if(done){res.destroy();return;}
        if(performance.now()>=deadline){fail(failure('transport_deadline'));return;}
        const date=Date.parse(res.headers.date ?? '');
        const age=res.headers.age;
        if (res.statusCode!==200 || res.headers['content-encoding']!==undefined && res.headers['content-encoding']!=='identity') {fail(failure('source_response'));return;}
        if (!Number.isFinite(date) || now-date>86400000 || date-now>300000 ||
          (age!==undefined && (!/^[0-9]{1,8}$/.test(age) || Number(age)>86400))) {fail(failure('source_freshness'));return;}
        const length=res.headers['content-length'];
        if (length!==undefined && (!/^[0-9]{1,9}$/.test(length) || Number(length)>maximum)) {fail(failure('source_size'));return;}
        /** @type {Buffer[]} */ const chunks=[];let size=0;
        res.on('data',chunk=>{
          if(done)return;
          if(performance.now()>=deadline){fail(failure('transport_deadline'));return;}
          if(!Buffer.isBuffer(chunk) || chunk.length>maximum-size){fail(failure('source_size'));return;}
          size+=chunk.length;chunks.push(chunk);
        });
        res.once('end',()=>{
          if(done)return;
          if(performance.now()>=deadline){fail(failure('transport_deadline'));return;}
          if(!res.complete || size===0 || length!==undefined && size!==Number(length)){fail(failure('truncated_response'));return;}
          done=true;clearTimeout(timer);accept(Buffer.concat(chunks,size));
        });
      });
      request.once('error',()=>fail(failure('transport_error')));
      request.end();
    } catch {fail(failure('transport_error'));}
  });
  const hash=createHash('sha256').update(bytes).digest('hex');
  const data=await parseJSONTask(bytes,{bytes:maximum,depth:16,entries:100000,timeMs:2000},AbortSignal.timeout(3000),false);
  return {data,sha256:hash,bytes:bytes.length};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if(process.argv.length!==2)throw failure('unexpected_arguments');
    const security=await fetchAuditSource(sources.security);
    const schedule=await fetchAuditSource(sources.schedule);
    const result=assessRuntime(process.version,security.data,schedule.data);
    console.log(JSON.stringify({checkedAt:new Date().toISOString(),...result,sources:{security:{url:sources.security,sha256:security.sha256},schedule:{url:sources.schedule,sha256:schedule.sha256}}}));
    if(result.matches.length>0)process.exitCode=1;
  } catch {console.error('Runtime audit failed: advisory/support data unavailable, invalid, or runtime unsupported. No passing result.');process.exitCode=1;}
}
