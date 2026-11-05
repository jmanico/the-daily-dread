/** Wave-0 projection only. The caller must establish authority and commit semantics.
 * This module does not authenticate context, emit an event or establish durability.
 * @typedef {string | number | boolean} Primitive
 * @typedef {{status:'accepted',json:string,record:Readonly<Record<string,Primitive>>} | {status:'rejected',code:'invalid_event'|'invalid_context'|'invalid_details'|'record_limit'}} Result
 */
const encoder = new TextEncoder();
const contextKeys = ['event_id','producer_ref','timestamp','environment','actor_kind','actor_ref','actor_provenance','tenant_ref','target_ref','interaction_id','operation_ref','job_ref','risk_event_ref','trace_id'];
const referenceKeys = ['actor_ref','tenant_ref','target_ref','interaction_id','operation_ref','job_ref','risk_event_ref'];
const provenance = ['verified_session','validated_token','authenticated_service','trusted_internal_assertion'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** @param {unknown} value @param {number} maximum */
function text(value, maximum) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum &&
    encoder.encode(JSON.stringify(value).slice(1,-1)).byteLength <= maximum;
}
/** Opaque internal identifiers, not arbitrary labels, URLs, addresses or code.
 * This syntax does not itself prove that an identifier has trusted provenance.
 * @param {unknown} value */
function reference(value) { return text(value,128) && /^[A-Za-z0-9_-]+$/.test(/** @type {string} */ (value)); }
/** Never invoke getters/toJSON. Not a sandbox for a developer-supplied Proxy.
 * @param {unknown} value @param {string[]} allowed
 * @returns {Record<string, unknown> | undefined} */
function fields(value, allowed) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return;
    const keys = Reflect.ownKeys(value);
    if (keys.length > allowed.length) return;
    /** @type {Record<string, unknown>} */
    const result = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string' || !allowed.includes(key)) return;
      const descriptor = Object.getOwnPropertyDescriptor(value,key);
      if (!descriptor || !Object.hasOwn(descriptor,'value')) return;
      result[key] = descriptor.value;
    }
    return result;
  } catch { return undefined; }
}
/** @param {unknown} value */
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
/** Closed Wave-0 catalog. Other ledger events remain unavailable to this projector.
 * Context is supplied by the future trusted owner, never taken from an HTTP body.
 * Invalid optional references are omitted with a marker; required identity fails closed.
 * @param {unknown} event @param {unknown} context @param {unknown} details
 * @returns {Result} */
export function serializeFoundationEvent(event, context, details) {
  if (event !== 'dread.audit.config_change' && event !== 'dread.audit.validation_failure') return {status:'rejected',code:'invalid_event'};
  const c = fields(context,contextKeys);
  if (!c || typeof c.event_id !== 'string' || !uuid.test(c.event_id) || !reference(c.producer_ref) ||
      !timestamp(c.timestamp) || !['development','test','staging','production'].includes(/** @type {string} */ (c.environment)) ||
      !['user','service','anonymous','unknown'].includes(/** @type {string} */ (c.actor_kind))) return {status:'rejected',code:'invalid_context'};
  const identified = c.actor_kind === 'user' || c.actor_kind === 'service';
  if ((identified && (!reference(c.actor_ref) || !reference(c.tenant_ref) || !provenance.includes(/** @type {string} */ (c.actor_provenance)))) ||
      (!identified && (c.actor_ref !== undefined || c.actor_provenance !== undefined))) return {status:'rejected',code:'invalid_context'};
  if (c.actor_kind === 'user' && !['verified_session','validated_token'].includes(/** @type {string} */ (c.actor_provenance))) return {status:'rejected',code:'invalid_context'};
  if (c.actor_kind === 'service' && !['authenticated_service','trusted_internal_assertion'].includes(/** @type {string} */ (c.actor_provenance))) return {status:'rejected',code:'invalid_context'};
  const configuration = event === 'dread.audit.config_change';
  const d = fields(details,configuration ? ['outcome','reason_code','config_ref','revision_ref','change_kind'] : ['stage','error_code','count']);
  if (!d) return {status:'rejected',code:'invalid_details'};
  if (configuration && (!identified || !reference(c.operation_ref) || !reference(d.config_ref) || !reference(d.revision_ref) ||
      !['attempted','success','failure','denied','rolled_back','unknown'].includes(/** @type {string} */ (d.outcome)) ||
      !['configure','reconfigure','disable'].includes(/** @type {string} */ (d.change_kind)) ||
      !['requested','committed','access_denied','revision_conflict','storage_unavailable','canceled','outcome_unknown'].includes(/** @type {string} */ (d.reason_code)))) return {status:'rejected',code:'invalid_details'};
  if (!configuration && (!['snapshot','encoding','consumer'].includes(/** @type {string} */ (d.stage)) ||
      !['required_field','optional_context','unknown_field','encoded_limit','unsupported_schema','conflicting_id'].includes(/** @type {string} */ (d.error_code)) ||
      typeof d.count !== 'number' || !Number.isSafeInteger(d.count) || d.count < 0)) return {status:'rejected',code:'invalid_details'};
  if (configuration) {
    /** @type {Record<string,string[]>} */
    const reasons = {attempted:['requested'],success:['committed'],failure:['storage_unavailable','canceled'],
      denied:['access_denied','revision_conflict'],rolled_back:['revision_conflict','storage_unavailable','canceled'],unknown:['outcome_unknown']};
    if (!reasons[/** @type {string} */(d.outcome)]?.includes(/** @type {string} */(d.reason_code))) return {status:'rejected',code:'invalid_details'};
  }
  /** @type {Record<string,Primitive>} */
  const record = {schema_version:1,event_id:c.event_id,producer_ref:/** @type {string} */(c.producer_ref),event,
    timestamp:/** @type {string} */(c.timestamp),service:'daily-dread',environment:/** @type {string} */(c.environment),
    severity:configuration ? (['failure','unknown','rolled_back'].includes(/** @type {string} */(d.outcome)) ? 'error' : d.outcome === 'denied' ? 'warn' : 'info') : 'error',
    security_relevant:true,audit_required:configuration,actor_kind:/** @type {string} */(c.actor_kind),
    source:'audit',action:configuration ? 'configure' : 'validate_event',
    outcome:configuration ? /** @type {string} */(d.outcome) : 'failure',
    reason_code:configuration ? /** @type {string} */(d.reason_code) : /** @type {string} */(d.error_code),policy_ref:'OD-004-2026-11-05'};
  let omitted = false;
  for (const key of referenceKeys) {
    if (c[key] === undefined) continue;
    if (!reference(c[key])) { omitted = true; continue; }
    record[key] = /** @type {string} */(c[key]);
  }
  if (identified) record.actor_provenance = /** @type {string} */(c.actor_provenance);
  if (c.trace_id !== undefined) {
    if (typeof c.trace_id === 'string' && /^[0-9a-f]{32}$/.test(c.trace_id)) record.trace_id = c.trace_id;
    else omitted = true;
  }
  if (omitted) record.context_status = 'optional_context_invalid';
  if (encoder.encode(JSON.stringify(record)).byteLength > 4096) return {status:'rejected',code:'record_limit'};
  for (const key of configuration ? ['config_ref','revision_ref','change_kind'] : ['stage','error_code','count']) record[key] = /** @type {Primitive} */(d[key]);
  const json = JSON.stringify(record);
  if (encoder.encode(json).byteLength > 8192) return {status:'rejected',code:'record_limit'};
  return {status:'accepted',json,record:Object.freeze(record)};
}

/** Independent monitor output uses the existing SEC-086 contract and never
 * recursively enters required audit storage. Context is the monitor's trusted
 * installation/service snapshot, not an application event or request body.
 * @param {unknown} context @param {unknown} observation @returns {Result} */
export function serializeMonitorHealth(context,observation) {
  const codes=['healthy','startup','unavailable','invalid_snapshot','queue_full','deadline','conflicting_id','shutdown','canceled','shutdown_timeout',
    'generation_mismatch','invalid_observation','probe_stalled','heartbeat_silence','pipeline_stalled','unrecorded','restart','probe_unavailable'];
  const o=fields(observation,['status','errorCode','droppedCount','lagMs']);
  if(!o || !['healthy','unhealthy','unknown'].includes(/** @type {string} */(o.status)) || !codes.includes(/** @type {string} */(o.errorCode)) ||
    (o.status==='healthy')!==(o.errorCode==='healthy') || (o.status==='unknown')!==(o.errorCode==='restart') ||
    ![o.droppedCount,o.lagMs].every(value=>typeof value==='number' && Number.isSafeInteger(value) && value>=0))return {status:'rejected',code:'invalid_details'};
  // Reuse the same context validation and exclusion rules. This intermediate
  // projection is data only; it is never emitted or queued as a validation event.
  const base=serializeFoundationEvent('dread.audit.validation_failure',context,{stage:'consumer',error_code:'required_field',count:0});
  if(base.status!=='accepted')return base;
  if(base.record.actor_kind!=='service')return {status:'rejected',code:'invalid_context'};
  /** @type {Record<string,Primitive>} */
  const record={schema_version:1,event_id:base.record.event_id,producer_ref:base.record.producer_ref,event:'dread.audit.health',
    timestamp:base.record.timestamp,service:'daily-dread',environment:base.record.environment,severity:o.status==='healthy'?'info':'error',
    security_relevant:true,audit_required:false,actor_kind:'service',source:'audit',action:'observe_health',
    outcome:o.status==='healthy'?'success':o.status==='unknown'?'unknown':'failure',reason_code:/** @type {string} */(o.errorCode),policy_ref:'OD-004-2026-11-05'};
  for(const key of [...referenceKeys,'actor_provenance','trace_id','context_status'])if(Object.hasOwn(base.record,key))record[key]=base.record[key];
  if(encoder.encode(JSON.stringify(record)).length>4096)return {status:'rejected',code:'record_limit'};
  record.stage='monitor';record.error_code=/** @type {string} */(o.errorCode);record.dropped_count=/** @type {number} */(o.droppedCount);record.lag_ms=/** @type {number} */(o.lagMs);
  const json=JSON.stringify(record);if(encoder.encode(json).length>8192)return {status:'rejected',code:'record_limit'};
  return {status:'accepted',json,record:Object.freeze(record)};
}
