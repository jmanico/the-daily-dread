import { readFile,writeFile,rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createAuditPipeline } from '../src/audit/pipeline.js';
import { independentObservations } from '../src/audit/independent-monitor.js';
import { serializeMonitorHealth } from '../src/audit/envelope.js';
import { auditFixture } from './audit-owner.mjs';
const controller=new AbortController();process.once('SIGTERM',()=>controller.abort());
/** @param {unknown} message */
async function send(message){await new Promise((resolve,reject)=>{if(!process.send){reject(Error('Missing fixture IPC'));return;}process.send(message,error=>error?reject(Error('Fixture IPC failed')):resolve(undefined));});}
/** Trusted parent fixture supplies only a private temporary path and synthetic
 * PostgreSQL configuration; this is not a deployment entry point.
 * @param {{mode:'producer'|'monitor',path:string,generation:number,config:import('../src/persistence/transactions.js').Configuration}} input */
async function run(input) {
  if(input.mode==='producer') {
    const pipeline=createAuditPipeline({snapshot:()=>undefined,append:async()=>({kind:'unavailable'}),probe:async()=>true},input.generation);
    await pipeline.recover();let first=true;
    try{for await(const value of pipeline.heartbeats(controller.signal)) {
      await writeFile(input.path+'.next',JSON.stringify(value),{mode:0o600});await rename(input.path+'.next',input.path);
      if(first){first=false;await send({kind:'ready'});}
    }}finally{await pipeline.shutdown();}
  }else {
    const fixture=auditFixture(input.config,'monitor_a');
    try {
      for await(const value of independentObservations({heartbeat:async signal=>{
        const bytes=await readFile(input.path,{signal});if(bytes.length>4096)throw Error('Fixture heartbeat limit');return JSON.parse(bytes.toString());
      },probe:async signal=>{
        const result=await fixture.receiver.probe({companyId:'company_a',operationId:'monitor_probe',signal,timeoutMs:2000});
        if(result.kind!=='committed')throw Error('Fixture probe unavailable');return result.value;
      }},controller.signal)) {
        const event=serializeMonitorHealth({event_id:randomUUID(),producer_ref:'monitor_a',timestamp:new Date().toISOString(),environment:'test',actor_kind:'service',actor_ref:'monitor_a',actor_provenance:'authenticated_service',tenant_ref:'company_a'},value);
        if(event.status!=='accepted')throw Error('Fixture health projection rejected');
        await send({kind:'observation',json:event.json});
        if(value.status==='unhealthy'){process.exitCode=1;break;}
      }
    }finally{await fixture.boundary.close();}
  }
}
process.once('message',message=>{
  const owned=run(/** @type {Parameters<typeof run>[0]} */(message)).then(()=>{process.disconnect?.();},()=>{process.exitCode=2;process.disconnect?.();});
  return owned;
});
