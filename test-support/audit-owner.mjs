import { createTransactionBoundary } from '../src/persistence/transactions.js';
import { createAuditReceiver,receiverStatements } from '../src/persistence/audit-receiver.js';
/** Synthetic producer namespace binding backed by current locked PostgreSQL rows.
 * Real installation composition must establish its producer identity; no payload
 * field is promoted into this fixture's authenticated principal.
 * @param {import('../src/persistence/transactions.js').Configuration} config @param {string} actor */
export function auditFixture(config,actor) {
  const boundary=createTransactionBoundary(config,{...receiverStatements,
    producer_authority:'select actor_id from fixture.producers where company_id=$1 and actor_id=$2 and producer_ref=$3 and mode=$4 and enabled for share',
  });
  const receiver=createAuditReceiver(boundary,{producerRef:'producer_a',environment:'test'},async(tx,mode)=>{
    const rows=await tx.query('producer_authority',[actor,'producer_a',mode]);return rows.length===1?'allowed':'denied';
  });
  return {boundary,receiver};
}
