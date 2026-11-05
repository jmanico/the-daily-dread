import { createTransactionBoundary } from '../src/persistence/transactions.js';
import { createWorkOwner,workStatements } from '../src/persistence/durable-work.js';

export const fixtureStatements=Object.freeze({
  authority_scan:'select enabled::text from fixture.principals where company_id=$1 and principal_id=$2 for share',
  authority_binding:'select grant_id from fixture.grants where company_id=$1 and grant_id=$2 and principal_id=$3 for share',
  authority_target:'select g.grant_id from fixture.grants g join fixture.repositories r on r.company_id=g.company_id and r.repository_id=g.repository_id join fixture.events e on e.company_id=g.company_id where g.company_id=$1 and g.grant_id=$2 and e.event_id=$3 and e.revision=$4::bigint and r.repository_id=$5 and g.principal_id=$6 and g.revision=$7::bigint and r.revision=$8::bigint and g.enabled and r.enabled and e.enabled for share of g,r,e',
  event_create:'insert into fixture.events(company_id,event_id,revision,enabled) values($1,$2,1,true)',
  result_write:'insert into fixture.results(company_id,job_id,marker) values($1,$2::uuid,$3)',
  revoke:'update fixture.grants set enabled=false where company_id=$1 and grant_id=$2',
});
/** Synthetic authority fixture; the product identity/source/repository owners are
 * not implemented or certified by this test owner.
 * @param {import('../src/persistence/transactions.js').Configuration} config @param {string} [principal] */
export function workFixture(config,principal='worker_a') {
  const boundary=createTransactionBoundary(config,{...workStatements,...fixtureStatements});
  /** @type {import('../src/persistence/durable-work.js').Authority} */
  const authority=async(tx,target)=>{
    const coarse=await tx.query('authority_scan',[principal]);
    if(coarse[0]?.[0]!=='true')return 'denied';
    if(target===null)return 'allowed';
    const binding=await tx.query('authority_binding',[target.grantId,principal]);
    if(binding.length!==1)return 'denied';
    const rows=await tx.query('authority_target',[target.grantId,target.eventId,target.eventRevision,target.repositoryId,principal,target.grantRevision,target.repositoryRevision]);
    return rows.length===1?'allowed':'revoked';
  };
  return {boundary,authority,owner:createWorkOwner(boundary,authority)};
}
