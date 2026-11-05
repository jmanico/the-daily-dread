import { createAuditPipeline } from '../src/audit/pipeline.js';
import { receiveConfigurationRecord } from '../src/audit/received-record.js';
import { serializeFoundationEvent } from '../src/audit/envelope.js';
import { installProcessBoundary } from '../src/lifecycle/process-boundary.js';
const pipeline=createAuditPipeline({snapshot:(record,company)=>receiveConfigurationRecord(record,'producer_a','test',company),probe:async()=>true,
  append:async()=>process.argv[2]==='stuck'?new Promise(()=>{}):{kind:'committed',value:{kind:'appended'}},
},1);
installProcessBoundary(pipeline.stopAdmission,async signal=>{const clean=await pipeline.shutdown();if(!clean || signal.aborted)throw Error('Audit drain failed');});
// Keep the fixture alive until the parent sends the real OS signal, just as an
// application's listening socket would. An unresolved promise cannot do this.
if(!process.channel)throw Error('Missing fixture IPC');
process.channel.ref();
await pipeline.recover();
const event=serializeFoundationEvent('dread.audit.config_change',{event_id:'12345678-1234-4234-8234-123456789abc',producer_ref:'producer_a',timestamp:'2026-11-05T10:00:00.000Z',environment:'test',actor_kind:'service',actor_ref:'service_a',actor_provenance:'authenticated_service',tenant_ref:'company_a',operation_ref:'operation_a'},
  {outcome:'failure',reason_code:'storage_unavailable',config_ref:'config_a',revision_ref:'revision_a',change_kind:'configure'});
if(event.status!=='accepted')throw Error('Invalid fixture event');
const pending=pipeline.enqueue({companyId:'company_a',operationId:'operation_a',signal:new AbortController().signal,timeoutMs:1000},event.record);
await new Promise((resolve,reject)=>{if(!process.send){reject(Error('Missing fixture IPC'));return;}process.send({ready:true},error=>error?reject(Error('Fixture IPC failed')):resolve(undefined));});
await pending;
