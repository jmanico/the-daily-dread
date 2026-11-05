/** @typedef {{id:string,cve:string|null,title:string,description:string,url:string,severity:string,type:string,published:string,updated:string,withdrawn:string|null,credits:{name:string,type:string}[],vulnerabilities:{package:string,ecosystem:string,range:string,patched:string|null}[]}} Advisory */
/** @param {unknown} value @returns {value is Record<string,unknown>} */
function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
/** @param {unknown} value @param {number} max @returns {value is string} */
function text(value,max) { return typeof value === 'string' && new TextEncoder().encode(value).length <= max; }
/** @param {unknown} value @returns {value is string} */
function timestamp(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value)); }

/** Strict display projection for the operator-fetched public snapshot; no URL fetching here.
 * @param {unknown} value @returns {Advisory|null}
 */
export function advisory(value) {
  if (!record(value) || !text(value.id,32) || !/^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/.test(value.id)) return null;
  if (!text(value.title,2048) || !value.title || !text(value.description,200000) || !text(value.url,200)) return null;
  if (value.url !== `https://github.com/advisories/${value.id}` || !timestamp(value.published) || !timestamp(value.updated) || value.withdrawn !== null && !timestamp(value.withdrawn)) return null;
  if (value.cve !== null && (!text(value.cve,32) || !/^CVE-\d{4}-\d{4,}$/.test(value.cve))) return null;
  if (typeof value.type !== 'string' || !['reviewed','unreviewed','malware'].includes(value.type) || typeof value.severity !== 'string' || !['unknown','low','medium','high','critical'].includes(value.severity)) return null;
  if (!Array.isArray(value.credits) || value.credits.length > 100 || !Array.isArray(value.vulnerabilities) || value.vulnerabilities.length > 100) return null;
  const credits=[]; const vulnerabilities=[];
  for (const credit of value.credits) {
    if(!record(credit) || !text(credit.name,200) || !text(credit.type,100)) return null;
    credits.push({name:credit.name,type:credit.type});
  }
  for (const entry of value.vulnerabilities) {
    if(!record(entry) || !text(entry.package,1000) || !text(entry.ecosystem,100) || !text(entry.range,2000) || entry.patched !== null && !text(entry.patched,500)) return null;
    vulnerabilities.push({package:entry.package,ecosystem:entry.ecosystem,range:entry.range,patched:entry.patched});
  }
  return {id:value.id,cve:value.cve,title:value.title,description:value.description,url:value.url,severity:value.severity,type:value.type,published:value.published,updated:value.updated,withdrawn:value.withdrawn,credits,vulnerabilities};
}

/** @param {unknown} value */
export function snapshot(value) {
  if (!record(value) || !timestamp(value.retrievedAt) || !Array.isArray(value.items) || value.items.length > 100) return null;
  const items = value.items.map(advisory);
  const valid = items.filter(item => item !== null);
  if (!valid.length) return null;
  if (new Set(valid.map(item => item.id)).size !== valid.length) return null;
  return {retrievedAt:value.retrievedAt,items:valid, rejected:items.length-valid.length};
}

/** @param {Advisory[]} items @param {string} query @param {string} type @param {string} severity */
export function filterAdvisories(items,query,type,severity) {
  if(query.length > 160 || !['all','reviewed','unreviewed','malware'].includes(type) || !['all','unknown','low','medium','high','critical'].includes(severity)) return [];
  const term=query.trim().toLocaleLowerCase('en');
  return items.filter(item => (type === 'all' || item.type === type) && (severity === 'all' || item.severity === severity) && `${item.title} ${item.id} ${item.cve ?? ''} ${item.vulnerabilities.map(v=>v.package).join(' ')}`.toLocaleLowerCase('en').includes(term));
}
