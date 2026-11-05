import { randomUUID } from 'node:crypto';
import { closedRecord } from '../contracts/http-results.js';
import { receiveConfigurationRecord } from '../audit/received-record.js';
import { TransactionRejection } from './transactions.js';
/** @typedef {import('./transactions.js').Context} Context */
/** @typedef {import('./transactions.js').Transaction} Transaction */
/** @typedef {ReturnType<typeof import('./transactions.js').createTransactionBoundary>} Boundary */
const identity=/^[A-Za-z0-9_-]{1,128}$/;
export const receiverStatements=Object.freeze({
  receiver_durability:"select current_setting('fsync'),current_setting('synchronous_commit') where $1::text is not null",
  receiver_append:'insert into dread_audit.events(company_id,producer_ref,event_id,operation_ref,encoded) values($1,$2,$3::uuid,$4,$5) on conflict do nothing returning event_id::text',
  receiver_existing:'select encoded,operation_ref from dread_audit.events where company_id=$1 and producer_ref=$2 and event_id=$3::uuid',
  receiver_conflict:'insert into dread_audit.conflicts(company_id,producer_ref,original_operation_ref,event_id,conflict_id,candidate) values($1,$2,$3,$4::uuid,$5::uuid,$6)',
  receiver_checkpoint:'insert into dread_audit.checkpoints(company_id,producer_ref,sequence) values($1,$2,1) on conflict(company_id,producer_ref) do update set sequence=least(dread_audit.checkpoints.sequence+1,9007199254740991) returning sequence::text',
  receiver_probe:'insert into dread_audit.probes values($1,$2,1) on conflict(company_id,producer_ref) do update set sequence=least(dread_audit.probes.sequence+1,9007199254740991) returning sequence::text',
  receiver_boot:'insert into dread_audit.checkpoints(company_id,producer_ref,generation,sequence) values($1,$2,1,0) on conflict(company_id,producer_ref) do update set generation=dread_audit.checkpoints.generation+1 where dread_audit.checkpoints.generation<9007199254740991 returning generation::text',
  receiver_permissions:"select (has_table_privilege(current_user,'dread_audit.events','SELECT') and has_table_privilege(current_user,'dread_audit.events','INSERT')),has_table_privilege(current_user,'dread_audit.conflicts','INSERT'),(has_table_privilege(current_user,'dread_audit.checkpoints','SELECT') and has_table_privilege(current_user,'dread_audit.checkpoints','INSERT') and has_table_privilege(current_user,'dread_audit.checkpoints','UPDATE')) where $1::text is not null",
  receiver_progress:'select sequence::text,generation::text from dread_audit.checkpoints where company_id=$1 and producer_ref=$2',
});
/** Authenticate the deployment-established producer/monitor at the real owner
 * boundary. This is not an HTTP ingestion endpoint; input fields cannot select
 * the namespace or establish actor provenance. Current producer authority must
 * be scoped and locked in the same transaction by the injected owner.
 * @param {Boundary} boundary @param {unknown} configuration
 * @param {(tx:Transaction,mode:'append'|'probe')=>Promise<'allowed'|'denied'|'unavailable'>} authority */
export function createAuditReceiver(boundary,configuration,authority) {
  if(!closedRecord(configuration,['producerRef','environment']) || typeof configuration.producerRef!=='string' || !identity.test(configuration.producerRef) ||
    typeof configuration.environment!=='string' || !['development','test','staging','production'].includes(configuration.environment))throw new Error('Invalid audit receiver configuration');
  const producer=configuration.producerRef,environment=configuration.environment;
  /** @param {Transaction} tx @param {'append'|'probe'} mode */
  async function authorize(tx,mode) {
    const result=await authority(tx,mode);
    if(result==='denied')throw new TransactionRejection('denied');
    if(result!=='allowed')throw new Error('Audit authority unavailable');
    const settings=await tx.query('receiver_durability');
    if(settings.length!==1 || settings[0]?.[0]!=='on' || settings[0]?.[1]!=='on')throw new Error('Audit durability unavailable');
  }
  return Object.freeze({
    /** Validate before queue admission; not a claim of authentication or commit.
     * @param {unknown} record @param {string} company */
    snapshot:(record,company)=>receiveConfigurationRecord(record,producer,environment,company),
    /** Separate unsuccessful/attempt outcomes only. Successful administrative
     * mutation events must remain in the original owner's atomic transaction.
     * @param {Context} context @param {unknown} record */
    append:(context,record)=>boundary.run(context,async tx=>{
      await authorize(tx,'append');
      const value=receiveConfigurationRecord(record,producer,environment,tx.companyId);
      if(!value || value.operationId!==tx.operationId || value.outcome==='success')throw new TransactionRejection('invalid');
      const inserted=await tx.query('receiver_append',[producer,value.eventId,value.operationId,value.json]);
      let kind='appended';
      if(inserted.length===0) {
        const existing=await tx.query('receiver_existing',[producer,value.eventId]);
        // Never enrich a cross-company collision from an unscoped lookup.
        if(existing.length!==1)throw new TransactionRejection('conflict');
        const original=receiveConfigurationRecord(JSON.parse(/** @type {string} */(existing[0][0])),producer,environment,tx.companyId);
        if(!original || original.operationId!==existing[0][1])throw new Error('Stored audit projection unavailable');
        if(original.json===value.json)kind='duplicate';
        else {
          await tx.query('receiver_conflict',[producer,existing[0][1],value.eventId,randomUUID(),value.json]);
          return Object.freeze({kind:'conflicting_id'});
        }
      }
      const rows=await tx.query('receiver_checkpoint',[producer]);
      const checkpoint=Number(rows[0]?.[0]);
      if(rows.length!==1 || !Number.isSafeInteger(checkpoint) || checkpoint<1)throw new Error('Invalid audit checkpoint');
      return Object.freeze({kind,checkpoint});
    }),
    /** Allocate a durable boot counter before starting an application pipeline.
     * Exhaustion refuses startup instead of reusing an old process identity.
     * @param {Context} context */
    start:(context)=>boundary.run(context,async tx=>{
      await authorize(tx,'append');
      const rows=await tx.query('receiver_boot',[producer]);const generation=Number(rows[0]?.[0]);
      if(rows.length!==1 || !Number.isSafeInteger(generation) || generation<1)throw new Error('Boot generation unavailable');
      return Object.freeze({generation});
    }),
    /** Writer-side check must accompany the independent monitor's storage probe
     * before readiness can recover. A database probe alone cannot prove this
     * writer still has its required append/quarantine/checkpoint privileges.
     * @param {Context} context */
    check:(context)=>boundary.run(context,async tx=>{
      await authorize(tx,'append');
      const rows=await tx.query('receiver_permissions');
      return Object.freeze({ready:rows.length===1 && rows[0]?.length===3 && rows[0].every(value=>value==='t')});
    }),
    /** A separately credentialed monitor can update only synthetic probe state
     * and read a fixed-size checkpoint. No event bytes or identities are returned.
     * @param {Context} context */
    probe:(context)=>boundary.run(context,async tx=>{
      await authorize(tx,'probe');
      const probes=await tx.query('receiver_probe',[producer]);
      const progress=await tx.query('receiver_progress',[producer]);
      const sequence=Number(probes[0]?.[0]),checkpoint=progress.length===0?0:Number(progress[0]?.[0]),generation=progress.length===0?0:Number(progress[0]?.[1]);
      if(probes.length!==1 || !Number.isSafeInteger(sequence) || sequence<1 || !Number.isSafeInteger(checkpoint) || checkpoint<0 || !Number.isSafeInteger(generation) || generation<0)throw new Error('Invalid audit probe');
      return Object.freeze({sequence,checkpoint,generation});
    }),
  });
}
