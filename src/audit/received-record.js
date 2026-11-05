import { closedRecord } from '../contracts/http-results.js';
import { serializeFoundationEvent } from './envelope.js';

const contextKeys=['event_id','producer_ref','timestamp','environment','actor_kind','actor_ref','actor_provenance','tenant_ref','target_ref','interaction_id','operation_ref','job_ref','risk_event_ref','trace_id'];
const keys=[...contextKeys,'schema_version','event','service','severity','security_relevant','audit_required','source','action','outcome','reason_code','policy_ref','context_status','config_ref','revision_ref','change_kind'];
/** Validate a received primitive projection before any queue or storage. Namespace
 * membership is separately authenticated by the receiver; field syntax is not
 * actor/service authority. Receiver metadata cannot replace producer fields.
 * @param {unknown} input @param {string} producer @param {string} environment @param {string} company */
export function receiveConfigurationRecord(input,producer,environment,company) {
  if(!closedRecord(input,keys,[]) || input.producer_ref!==producer || input.environment!==environment || input.tenant_ref!==company)return;
  /** @type {Record<string,unknown>} */const context=Object.create(null);
  for(const key of contextKeys)if(Object.hasOwn(input,key))context[key]=input[key];
  const projected=serializeFoundationEvent(input.event,context,{outcome:input.outcome,reason_code:input.reason_code,config_ref:input.config_ref,revision_ref:input.revision_ref,change_kind:input.change_kind});
  if(projected.status!=='accepted' || input.event!=='dread.audit.config_change')return;
  const record=projected.record;
  // A receiver must reject, not silently omit/coerce, a malformed projection.
  for(const key of Object.keys(record))if(record[key]!==input[key])return;
  for(const key of Object.keys(input))if(!Object.hasOwn(record,key) && !(key==='context_status' && input[key]==='optional_context_invalid'))return;
  /** @type {Record<string,import('./envelope.js').Primitive>} */const canonical=Object.create(null);
  for(const key of keys)if(Object.hasOwn(record,key))canonical[key]=record[key];
  if(input.context_status==='optional_context_invalid')canonical.context_status='optional_context_invalid';
  const json=JSON.stringify(canonical);
  if(new TextEncoder().encode(json).length>8192)return;
  return Object.freeze({json,eventId:/** @type {string} */(record.event_id),operationId:/** @type {string} */(record.operation_ref),outcome:/** @type {string} */(record.outcome),record:Object.freeze(canonical)});
}
