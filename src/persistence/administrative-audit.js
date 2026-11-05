import { randomUUID } from 'node:crypto';
import { closedRecord } from '../contracts/http-results.js';
import { serializeFoundationEvent } from '../audit/envelope.js';
import { TransactionRejection } from './transactions.js';

/** @typedef {import('./transactions.js').Transaction} Transaction */
/** @typedef {import('./transactions.js').Context} Context */
/** @typedef {ReturnType<typeof import('./transactions.js').createTransactionBoundary>} Boundary */
/** @typedef {{actorRef:string,actorKind:'user'|'service',provenance:'verified_session'|'validated_token'|'authenticated_service'|'trusted_internal_assertion',configRef:string,revisionRef:string,changeKind:'configure'|'reconfigure'|'disable'}} Grant */
/** @typedef {{kind:'allowed',grant:Grant,mutation:(tx:Transaction,grant:Readonly<Grant>)=>Promise<void>}|{kind:'denied'|'not_found'|'conflict'|'invalid'|'unavailable'}} Decision */
/** @typedef {{authorize:(tx:Transaction,command:unknown)=>Promise<Decision>,read:(tx:Transaction)=>Promise<'allowed'|'denied'|'unavailable'>}} Owner */
/** @typedef {{companyId:string,operationId:string,eventId:string,json:string}} Snapshot */
const identity=/^[A-Za-z0-9_-]{1,128}$/;

export const auditStatements=Object.freeze({
  audit_durability:"select current_setting('fsync'),current_setting('synchronous_commit') where $1::text is not null",
  audit_append:'insert into dread_audit.events(company_id,producer_ref,event_id,operation_ref,encoded) values($1,$2,$3::uuid,$4,$5) returning event_id::text',
  audit_receipt:'insert into dread_audit.mutation_receipts(company_id,producer_ref,operation_ref,event_id) values($1,$2,$3,$4::uuid)',
  audit_reconcile:'select event_id::text from dread_audit.mutation_receipts where company_id=$1 and producer_ref=$2 and operation_ref=$3',
});

/** Trusted composition supplies installation namespace and authenticated owner.
 * The owner validates commands, scopes/locks the current actor and target, and
 * binds the new revision before returning a grant. Its returned mutation closure captures validated command primitives and includes all
 * revision and work-intent writes on tx; external calls are prohibited. This
 * Wave-0 owner supports audit configuration only, not later event categories.
 * @param {Boundary} boundary @param {unknown} configuration @param {Owner} owner */
export function createAdministrativeAudit(boundary,configuration,owner) {
  if(!closedRecord(configuration,['producerRef','environment']) || typeof configuration.producerRef!=='string' || !identity.test(configuration.producerRef) ||
    !['development','test','staging','production'].includes(/** @type {string} */(configuration.environment)))throw new Error('Invalid audit configuration');
  const producerRef=configuration.producerRef,environment=configuration.environment;

  /** No caller-chosen event ID, producer, timestamp, company, actor or outcome.
   * Materialize the grant before awaiting further owner work.
   * @param {Transaction} tx @param {unknown} input */
  function snapshot(tx,input) {
    if(!closedRecord(input,['actorRef','actorKind','provenance','configRef','revisionRef','changeKind']))throw new TransactionRejection('invalid');
    const eventId=randomUUID();
    const projected=serializeFoundationEvent('dread.audit.config_change',{
      event_id:eventId,producer_ref:producerRef,timestamp:new Date().toISOString(),environment,
      actor_kind:input.actorKind,actor_ref:input.actorRef,actor_provenance:input.provenance,
      tenant_ref:tx.companyId,operation_ref:tx.operationId,target_ref:input.configRef,
    },{outcome:'success',reason_code:'committed',config_ref:input.configRef,revision_ref:input.revisionRef,change_kind:input.changeKind});
    if(projected.status!=='accepted')throw new TransactionRejection('invalid');
    const value=Object.freeze({companyId:tx.companyId,operationId:tx.operationId,eventId,json:projected.json});
    return value;
  }

  /** Private transactional append. Success projections cannot be obtained or
   * appended separately from the authorized mutation. Reconciliation reads a
   * receipt; this API never retransmits an event or repeats an unknown mutation.
   * @param {Transaction} tx @param {Snapshot} value */
  async function appendInTransaction(tx,value) {
    const settings=await tx.query('audit_durability');
    if(settings.length!==1 || settings[0]?.[0]!=='on' || settings[0]?.[1]!=='on')throw new Error('Audit durability unavailable');
    const inserted=await tx.query('audit_append',[producerRef,value.eventId,value.operationId,value.json]);
    if(inserted.length!==1 || inserted[0]?.[0]!==value.eventId)throw new Error('Audit append unavailable');
  }

  /** @param {Transaction} tx @param {unknown} command */
  async function prepare(tx,command) {
    const decision=await owner.authorize(tx,command);
    if(!closedRecord(decision,['kind','grant','mutation'],['kind']))throw new Error('Audit authority unavailable');
    if(decision.kind!=='allowed') {
      if(!closedRecord(decision,['kind']))throw new Error('Audit authority unavailable');
      if(['denied','not_found','conflict','invalid'].includes(decision.kind))throw new TransactionRejection(/** @type {'denied'|'not_found'|'conflict'|'invalid'} */(decision.kind));
      throw new Error('Audit authority unavailable');
    }
    if(typeof decision.mutation!=='function')throw new Error('Audit authority unavailable');
    const value=snapshot(tx,decision.grant);
    // Copy only after snapshot validation. Neither a mutable authority object
    // nor submitted fields can change the queued event or mutation grant.
    const g=decision.grant;
    const grant=Object.freeze({actorRef:g.actorRef,actorKind:g.actorKind,provenance:g.provenance,configRef:g.configRef,revisionRef:g.revisionRef,changeKind:g.changeKind});
    return Object.freeze({snapshot:value,grant,mutation:decision.mutation});
  }

  return Object.freeze({
    /** Success is returned only by the transaction boundary after COMMIT ack.
     * Unknown commit outcomes retain operationId for authorized reconciliation;
     * never repeat the mutation automatically.
     * @param {Context} context @param {unknown} command */
    async change(context,command) {
      return boundary.run(context,async tx=>{
        const prepared=await prepare(tx,command);
        if((await tx.query('audit_reconcile',[producerRef,tx.operationId])).length!==0)throw new TransactionRejection('conflict');
        await prepared.mutation(tx,prepared.grant);
        await appendInTransaction(tx,prepared.snapshot);
        await tx.query('audit_receipt',[producerRef,tx.operationId,prepared.snapshot.eventId]);
        return Object.freeze({eventId:prepared.snapshot.eventId});
      });
    },
    /** Minimal scoped receipt consumer, never a general audit-history export.
     * Current read authority is required even when the operation ID is known.
     * @param {Context} context */
    reconcile:(context)=>boundary.run(context,async tx=>{
      const authority=await owner.read(tx);
      if(authority==='denied')throw new TransactionRejection('denied');
      if(authority!=='allowed')throw new Error('Audit authority unavailable');
      const rows=await tx.query('audit_reconcile',[producerRef,tx.operationId]);
      if(rows.length===0)throw new TransactionRejection('not_found');
      const eventId=rows[0]?.[0];
      if(typeof eventId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(eventId))throw new Error('Invalid audit receipt');
      return Object.freeze({eventId,outcome:'success'});
    }),
  });
}
