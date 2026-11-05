import { createRetrievalTransport } from '../src/adapters/outbound/retrieve.js';
import { parseJSONTask } from '../src/workers/json-tasks.js';
import { closedRecord } from '../src/contracts/http-results.js';
import { advisory } from './live-model.js';

const keys=['ghsa_id','cve_id','url','html_url','summary','description','type','severity','repository_advisory_url','source_code_location','identifiers','references','published_at','updated_at','github_reviewed_at','nvd_published_at','withdrawn_at','vulnerabilities','cvss_severities','cwes','credits','comments','cvss','epss'];
const userKeys=['login','id','node_id','avatar_url','gravatar_id','url','html_url','followers_url','following_url','gists_url','starred_url','subscriptions_url','organizations_url','repos_url','events_url','received_events_url','type','user_view_type','site_admin'];
/** Only the documented public facts used by the demo leave this adapter. Known
 * unused API fields are discarded, never interpreted as links or instructions.
 * @param {unknown} input @param {string} type */
export function projectPublicAdvisory(input,type) {
  if(!closedRecord(input,keys,['ghsa_id','cve_id','html_url','summary','description','type','severity','published_at','updated_at','withdrawn_at','credits','vulnerabilities']) || input.type!==type)return null;
  if(!Array.isArray(input.credits) || input.credits.length>100 || !Array.isArray(input.vulnerabilities) || input.vulnerabilities.length>100)return null;
  const credits=[],vulnerabilities=[];
  for(const credit of input.credits){
    if(!closedRecord(credit,['user','type']) || !closedRecord(credit.user,userKeys,['login']))return null;
    credits.push({name:credit.user.login,type:credit.type});
  }
  for(const item of input.vulnerabilities){
    if(!closedRecord(item,['package','vulnerable_version_range','first_patched_version','vulnerable_functions'],['package','vulnerable_version_range','first_patched_version']) || !closedRecord(item.package,['name','ecosystem']))return null;
    vulnerabilities.push({package:item.package.name,ecosystem:item.package.ecosystem,range:item.vulnerable_version_range,patched:item.first_patched_version});
  }
  return advisory({id:input.ghsa_id,cve:input.cve_id,title:input.summary,description:input.description,url:input.html_url,severity:input.severity,type:input.type,
    published:input.published_at,updated:input.updated_at,withdrawn:input.withdrawn_at,credits,vulnerabilities});
}
/** This isolated public demo has no private company/service authority. Its
 * unforgeable composition token permits only these three fixed public requests.
 * @param {Parameters<typeof createRetrievalTransport>[3]} [ports] */
export function createPublicAdvisories(ports={}) {
  const context=Object.freeze({purpose:'local_public_demo'});
  const transport=createRetrievalTransport({id:'demo_public_advisories',revision:'1',companyId:'synthetic_demo',endpoints:[{origin:'https://api.github.com',paths:['/advisories'],queryKeys:['type','per_page','sort','direction']}]},
    candidate=>candidate===context?'allowed':'denied',{wireBytes:2097152,decodedBytes:2097152,totalMs:30000,readMs:5000,redirects:0},ports);
  return Object.freeze({
    close:()=>transport.retire(),
    /** @param {AbortSignal} signal */
    async read(signal) {
      const op=transport.begin({context,signal});
      if(op.kind!=='operation')return {kind:/** @type {const} */('unavailable')};
      const items=[];let omitted=0;
      try {
        for(const type of ['reviewed','unreviewed','malware']) {
          const result=await op.read(`https://api.github.com/advisories?type=${type}&per_page=10&sort=published&direction=desc`);
          // Do not shorten an unknown/long provider delay or retry access denials.
          if(result.kind==='wait' || result.kind==='failed' && result.wait || result.kind==='status' && result.status===403)return {kind:/** @type {const} */('paused')};
          if(result.kind!=='retrieved' || result.status!==200 || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(result.contentType??''))return {kind:/** @type {const} */('unavailable')};
          if(result.pollAfterMs!==null && result.pollAfterMs>Date.now()+300000)return {kind:/** @type {const} */('paused')};
          const rows=await parseJSONTask(result.body,{bytes:2097152,depth:32,entries:30000,timeMs:1000},signal,false);
          if(!Array.isArray(rows) || rows.length>10)return {kind:/** @type {const} */('unavailable')};
          for(const row of rows){const item=projectPublicAdvisory(row,type);if(item)items.push(item);else omitted++;}
        }
        if(signal.aborted || !items.length || new Set(items.map(item=>item.id)).size!==items.length)return {kind:/** @type {const} */('unavailable')};
        const data={retrievedAt:new Date().toISOString(),items};
        if(new TextEncoder().encode(JSON.stringify(data)).length>1000000)return {kind:/** @type {const} */('unavailable')};
        return {kind:/** @type {const} */('updated'),data,omitted};
      }catch{return {kind:/** @type {const} */('unavailable')};}
      finally{op.close();}
    },
  });
}
