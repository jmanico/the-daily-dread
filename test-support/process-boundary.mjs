import {PassThrough} from 'node:stream';
import {createApplication} from '../src/http/application.js';
import {installProcessBoundary} from '../src/lifecycle/process-boundary.js';
const secret='SYNTHETIC_FATAL_SECRET_password_private_repo';
const mode=process.argv[2];
async function main() {
  const app=createApplication(async()=> 'allowed');
  let drains=0;
  if(mode==='observer')process.on('uncaughtExceptionMonitor',()=>undefined);
  const boundary=installProcessBoundary(()=>{
    if(mode==='admission_throw')throw new Error(secret);
    app.getDecorator('stopAdmission')();
  },async signal=>{
    drains++;if(drains!==1)throw new Error(secret);
    if(mode==='drain_throw')throw new Error(secret);
    if(mode==='hang' || mode==='fatal_during_drain'){
      signal.addEventListener('abort',()=>{if(!signal.aborted)process.exit(99);},{once:true});
      if(mode==='fatal_during_drain')setTimeout(()=>{throw new Error(secret);},10);
      await new Promise(()=>undefined);
    }
    await app.close();
  });
  if(mode==='duplicate')installProcessBoundary(()=>undefined,async()=>undefined);
  if(mode==='startup')boundary.startupFailure();
  app.get('/ready',async()=>({ok:true}));
  await app.listen({host:'127.0.0.1',port:0});
  const address=app.server.address();
  if(!address || typeof address!=='object')throw new Error('Test listener unavailable');
  await new Promise((resolve,reject)=>{
    if(!process.send){reject(new Error('Test IPC unavailable'));return;}
    process.send({ready:true,port:address.port},error=>{if(error)reject(error);else resolve(undefined);});
  });
  if(mode==='uncaught')setTimeout(()=>{throw new Error(secret,{cause:new Error(secret)});},10);
  if(mode==='unhandled')Promise.reject(new Error(secret));
  if(mode==='stream'){
    const stream=new PassThrough();boundary.watchCriticalStream(stream);stream.destroy(new Error(secret));
  }
  if(['graceful','hang','drain_throw','admission_throw','fatal_during_drain'].includes(mode))await boundary.shutdown();
}
await main().catch(()=>process.exit(73));
