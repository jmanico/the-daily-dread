import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeFoundationEvent } from '../src/audit/envelope.js';
const name = 'dread.audit.config_change';
const context = () => ({event_id:'12345678-1234-4234-8234-123456789abc',producer_ref:'producer_1',timestamp:'2026-11-05T10:00:00.000Z',environment:'test',actor_kind:'user',actor_ref:'actor_1',actor_provenance:'verified_session',tenant_ref:'company_1',operation_ref:'operation_1'});
const details = () => ({outcome:'success',reason_code:'committed',config_ref:'config_1',revision_ref:'revision_1',change_kind:'configure'});
/** @param {import('../src/audit/envelope.js').Result} result */
function accepted(result) { if (result.status !== 'accepted') assert.fail('Expected accepted projection'); return result; }

test('foundation catalog projects an immutable JSON snapshot with code-owned policy', () => {
  const c=context(),d=details(); const result=accepted(serializeFoundationEvent(name,c,d));
  c.actor_ref='changed'; d.revision_ref='changed';
  const parsed=JSON.parse(result.json);
  assert.equal(parsed.actor_ref,'actor_1'); assert.equal(parsed.revision_ref,'revision_1');
  assert.equal(parsed.schema_version,1);assert.equal(parsed.audit_required,true);assert.equal(parsed.security_relevant,true);assert.equal(parsed.severity,'info');
  assert.equal(Object.isFrozen(result.record),true);assert.deepEqual(parsed,result.record);
  assert.equal(result.json.includes('\n'),false);assert.ok(Buffer.byteLength(result.json)<=8192);
});
test('unknown events and fields cannot override catalog fields or leak canaries', () => {
  assert.deepEqual(serializeFoundationEvent('dread.auth.result',context(),details()),{status:'rejected',code:'invalid_event'});
  for (const key of ['severity','audit_required','schema_version','message','err','url','__proto__','toJSON']) {
    const c=context();Object.defineProperty(c,key,{value:'SECRET_CANARY',enumerable:true});
    const result=serializeFoundationEvent(name,c,details());assert.equal(result.status,'rejected');assert.ok(!JSON.stringify(result).includes('SECRET_CANARY'));
  }
  assert.equal(serializeFoundationEvent(name,context(),{...details(),body:'SECRET_CANARY'}).status,'rejected');
});
test('accessors, inherited data, symbol keys and nested values are rejected without reading getters', () => {
  let called=0;const c=context();Object.defineProperty(c,'actor_ref',{get(){called++;throw Error('SECRET_CANARY');}});
  assert.equal(serializeFoundationEvent(name,c,details()).status,'rejected');assert.equal(called,0);
  const hidden=context();Object.defineProperty(hidden,Symbol('secret'),{value:'SECRET_CANARY'});assert.equal(serializeFoundationEvent(name,hidden,details()).status,'rejected');
  assert.equal(serializeFoundationEvent(name,Object.create(context()),details()).status,'rejected');
  assert.equal(serializeFoundationEvent(name,{...context(),actor_ref:{value:'actor_1'}},details()).status,'rejected');
  const broken=new Proxy({}, {ownKeys(){throw Error('SECRET_CANARY');}});
  assert.deepEqual(serializeFoundationEvent(name,broken,details()),{status:'rejected',code:'invalid_context'});
});
test('required identity provenance and operation references fail closed', () => {
  /** @type {Array<[string,unknown]>} */
  const invalid = [['actor_ref',undefined],['tenant_ref',undefined],['operation_ref',undefined],['actor_provenance','trusted_internal_assertion'],['actor_kind','admin'],['environment','anything'],['producer_ref','https://private.example']];
  for (const [key,value] of invalid) {
    assert.equal(serializeFoundationEvent(name,{...context(),[key]:value},details()).status,'rejected',key);
  }
  const service={...context(),actor_kind:'service',actor_provenance:'authenticated_service'};
  assert.equal(serializeFoundationEvent(name,service,details()).status,'accepted');
  assert.equal(serializeFoundationEvent(name,{...service,actor_provenance:'verified_session'},details()).status,'rejected');
});
test('invalid optional context is omitted without discarding valid required audit', () => {
  const result=accepted(serializeFoundationEvent(name,{...context(),target_ref:'SECRET/CANARY\n',trace_id:'SECRET_CANARY'},details()));
  assert.equal(result.record.context_status,'optional_context_invalid');assert.equal('target_ref' in result.record,false);assert.equal('trace_id' in result.record,false);
  assert.ok(!result.json.includes('SECRET'));assert.equal(result.record.audit_required,true);
  const good=accepted(serializeFoundationEvent(name,{...context(),target_ref:'target_1',trace_id:'a'.repeat(32)},details()));
  assert.equal(good.record.target_ref,'target_1');assert.equal(good.record.trace_id,'a'.repeat(32));assert.equal('context_status' in good.record,false);
});
test('reference, timestamp and UUID boundaries reject malformed and injected strings', () => {
  assert.equal(serializeFoundationEvent(name,{...context(),producer_ref:'x'.repeat(128)},details()).status,'accepted');
  for(const value of ['x'.repeat(129),'\uD800','é'.repeat(65),'x\r\n"event":"forged"','a\u0000b','']) assert.equal(serializeFoundationEvent(name,{...context(),producer_ref:value},details()).status,'rejected');
  for(const value of ['2026-02-30T10:00:00.000Z','2026-11-05T10:00:00Z','not-a-date']) assert.equal(serializeFoundationEvent(name,{...context(),timestamp:value},details()).status,'rejected');
  for(const value of ['12345678-1234-4234-8234-123456789abx','submitted-correlation',123]) assert.equal(serializeFoundationEvent(name,{...context(),event_id:value},details()).status,'rejected');
});
test('outcome and reason cannot misrepresent a commit, denial or uncertain result', () => {
  const cases=[['attempted','requested','info'],['success','committed','info'],['denied','access_denied','warn'],['failure','storage_unavailable','error'],['rolled_back','canceled','error'],['unknown','outcome_unknown','error']];
  for(const [outcome,reason_code,severity] of cases) assert.equal(accepted(serializeFoundationEvent(name,context(),{...details(),outcome,reason_code})).record.severity,severity);
  for(const [outcome,reason_code] of [['success','requested'],['failure','committed'],['denied','requested'],['unknown','storage_unavailable']]) assert.equal(serializeFoundationEvent(name,context(),{...details(),outcome,reason_code}).status,'rejected');
});
test('validation health stays nonrecursive and uses only closed diagnostic codes and exact counters', () => {
  const c={event_id:context().event_id,producer_ref:'producer_1',timestamp:context().timestamp,environment:'test',actor_kind:'unknown'};
  const d={stage:'encoding',error_code:'encoded_limit',count:1};
  const result=accepted(serializeFoundationEvent('dread.audit.validation_failure',c,d));assert.equal(result.record.audit_required,false);assert.equal(result.record.actor_kind,'unknown');assert.equal('actor_ref' in result.record,false);
  for(const count of [-1,1.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1']) assert.equal(serializeFoundationEvent('dread.audit.validation_failure',c,{...d,count}).status,'rejected');
  for(const count of [0,Number.MAX_SAFE_INTEGER]) assert.equal(serializeFoundationEvent('dread.audit.validation_failure',c,{...d,count}).status,'accepted');
  assert.equal(serializeFoundationEvent('dread.audit.validation_failure',c,{...d,error_code:'SECRET_CANARY'}).status,'rejected');
  assert.equal(serializeFoundationEvent('dread.audit.validation_failure',{...c,actor_ref:'forged'},d).status,'rejected');
  assert.equal(serializeFoundationEvent('dread.audit.validation_failure',c,{...d,stage:'SECRET_CANARY'}).status,'rejected');
});

test('independent health uses SEC-086 fields, trusted service attribution and nonrecursive outcomes',async()=>{
  const {serializeMonitorHealth}=await import('../src/audit/envelope.js');
  const c={...context(),actor_kind:'service',actor_provenance:'authenticated_service'};
  for(const [status,errorCode,outcome,severity] of [['healthy','healthy','success','info'],['unknown','restart','unknown','error'],['unhealthy','heartbeat_silence','failure','error']]) {
    const value=accepted(serializeMonitorHealth(c,{status,errorCode,droppedCount:2,lagMs:30000}));
    assert.equal(value.record.event,'dread.audit.health');assert.equal(value.record.outcome,outcome);assert.equal(value.record.severity,severity);assert.equal(value.record.audit_required,false);assert.equal(value.record.dropped_count,2);assert.equal(value.record.lag_ms,30000);assert.equal(value.record.stage,'monitor');assert.equal('count' in value.record,false);
  }
  const valid={status:'unhealthy',errorCode:'queue_full',droppedCount:0,lagMs:0};
  for(const o of [{...valid,raw:'SECRET_CANARY'},{...valid,status:'healthy'},{...valid,errorCode:'SECRET_CANARY'},{...valid,droppedCount:-1},{...valid,lagMs:Infinity},{...valid,lagMs:Number.MAX_SAFE_INTEGER+1},Object.create(valid)])assert.equal(serializeMonitorHealth(c,o).status,'rejected');
  assert.equal(serializeMonitorHealth(context(),valid).status,'rejected');
});
