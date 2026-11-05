/** @param {unknown} value @returns {'system'|'light'|'dark'} */
export function themeValue(value) {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Demo display only: these claims grant no authority.
 * @param {{name?:unknown, preferred_username?:unknown, email?:unknown, email_verified?:unknown}} claims
 */
export function displayName(claims) {
  for (const value of [claims.name, claims.preferred_username, claims.email_verified === true ? claims.email : null]) {
    if (typeof value === 'string' && value.trim() && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value)) return value.trim();
  }
  return 'Signed-in user';
}

/** @typedef {{id:string,title:string,source:string,kind:string,severity:string,status:string,reason:string,time:string,description:string}} FeedItem */
/** Entirely invented records, not reports about real vendors or vulnerabilities. @type {FeedItem[]} */
export const feed = [
  { id: 'DEMO-2026-0142', title: 'Authentication bypass in Harbor Gateway', source: 'Harbor Security', kind: 'Vulnerability', severity: 'Critical', status: 'Exploitation reported', reason: 'An affected dependency appears in the sample checkout service. Exploitation is reported in this fictional advisory.', time: '09:42', description: 'A specially crafted request may bypass authentication when the legacy integration is enabled. Update to the corrected release and review access logs.' },
  { id: 'DEMO-2026-0141', title: 'Cedar Cloud investigates unauthorized access', source: 'Cedar Trust Center', kind: 'Vendor incident', severity: 'Unknown', status: 'Suspected', reason: 'Cedar Cloud is on the sample company watchlist. Scope and customer impact have not been established.', time: '09:16', description: 'We are investigating unusual activity in a support environment. Our investigation is ongoing; the affected scope has not yet been confirmed.' },
  { id: 'DEMO-2026-0140', title: 'Template injection in Finch Render', source: 'Finch Advisory Database', kind: 'Vulnerability', severity: 'High', status: 'Confirmed', reason: 'The sample dependency inventory contains Finch Render. Runtime reachability still needs review.', time: '08:55', description: 'Untrusted template expressions can escape the expected rendering context in affected versions. A corrected version is available.' },
  { id: 'DEMO-2026-0139', title: 'Willow Identity corrects session advisory', source: 'Willow Security', kind: 'Correction', severity: 'Medium', status: 'Corrected', reason: 'The affected version range changed. Existing findings should be reassessed against the revised evidence.', time: '08:20', description: 'The previously published affected range was too broad. This revision narrows the range and records the reason for the correction.' },
];

/** @param {FeedItem[]} items @param {unknown} query @param {unknown} kind */
export function filterFeed(items, query, kind) {
  if (typeof query !== 'string' || query.length > 160 || typeof kind !== 'string' || !['All', 'Vulnerability', 'Vendor incident', 'Correction'].includes(kind)) return [];
  const needle = query.trim().toLocaleLowerCase('en');
  return items.filter(item => (kind === 'All' || item.kind === kind) && `${item.title} ${item.source} ${item.id}`.toLocaleLowerCase('en').includes(needle));
}
