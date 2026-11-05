import process from 'node:process';
import { workFixture } from './work-owner.mjs';

/** @param {import('../src/persistence/transactions.js').Configuration} config */
async function claimAndExit(config) {
  const {owner}=workFixture(config);
  const context={companyId:'company_a',operationId:'crashed_claim',signal:new AbortController().signal,timeoutMs:3000};
  const claimed=await owner.claim(context);
  if(claimed.kind!=='committed' || claimed.value.kind!=='claimed')throw new Error('Fixture claim failed');
  const job=claimed.value.job;
  const reserved=await owner.debit({...context,operationId:'crashed_debit'},{jobId:job.jobId,attemptToken:job.attemptToken,version:job.version},{decodedBytes:1024,treeEntries:3,activeMs:50});
  if(reserved.kind!=='committed' || reserved.value.kind!=='reserved')throw new Error('Fixture debit failed');
  const snapshot=reserved.value.job,send=process.send?.bind(process);
  if(!send)throw new Error('Missing fixture IPC');
  await new Promise((resolve,reject)=>send(snapshot,error=>error?reject(error):resolve(undefined)));
  process.kill(process.pid,'SIGKILL');
}
process.once('message',message=>claimAndExit(/** @type {import('../src/persistence/transactions.js').Configuration} */(message)).catch(()=>{process.exitCode=1;process.disconnect?.();}));
