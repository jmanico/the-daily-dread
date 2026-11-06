import test from 'node:test';
import assert from 'node:assert/strict';
import crypto,{randomUUID} from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { createLocalSessions } from '../src/persistence/local-sessions.js';

/** Fault-only seam: all state/concurrency/SQL acceptance is in the real PostgreSQL
 * suite. This seam exercises outcomes that the transaction boundary owns.
 * @param {Function} run @returns {import('../src/persistence/local-sessions.js').Boundary} */
function boundary(run){return /** @type {import('../src/persistence/local-sessions.js').Boundary} */(/** @type {unknown} */({run}));}
const configuration=()=>({workspaceRef:randomUUID(),actorRef:randomUUID(),revisionRef:randomUUID()});
const signal=()=>new AbortController().signal;

test('local identity rejects forged configuration without executing accessors or storage',()=>{
  const config=configuration();let called=false;
  const store=boundary(()=>{called=true;throw Error('Unexpected storage access');});
  const getter=Object.defineProperty({...config},'actorRef',{get(){called=true;return config.actorRef;}});
  for(const value of [null,{},getter,Object.create(config),{...config,role:'admin'},{...config,workspaceRef:'../unsafe'},{...config,actorRef:config.workspaceRef},{...config,revisionRef:'invalid'},Object.assign({...config},{[Symbol('extra')]:true})]){
    assert.throws(()=>createLocalSessions(store,value),/^Error: Invalid local identity configuration$/);
  }
  assert.equal(called,false);
});

test('local identity is unavailable before bootstrap; invalid/aborted signals never reach storage',async()=>{
  let calls=0;const owner=createLocalSessions(boundary(()=>{calls++;throw Error('SECRET_CANARY');}),configuration());
  assert.deepEqual(await owner.issue(signal()),{kind:'unavailable'});
  assert.deepEqual(await owner.start(/** @type {AbortSignal} */(/** @type {unknown} */({}))),{kind:'invalid'});
  const controller=new AbortController();controller.abort();assert.deepEqual(await owner.start(controller.signal),{kind:'cancelled'});assert.equal(calls,0);
  assert.deepEqual(await owner.start(signal()),{kind:'unavailable'});assert.equal(calls,1);
  assert.deepEqual(await owner.start(signal()),{kind:'unavailable'});assert.equal(calls,1);
});

test('unknown commit closes local admission without credentials, retries or raw transaction context',async()=>{
  let calls=0;const owner=createLocalSessions(boundary(()=>{calls++;return Promise.resolve({kind:'unknown',operationId:'SECRET_CANARY'});}),configuration());
  assert.deepEqual(await owner.start(signal()),{kind:'unavailable'});
  assert.deepEqual(await owner.issue(signal()),{kind:'unavailable'});
  assert.deepEqual(await owner.start(signal()),{kind:'unavailable'});assert.equal(calls,1);
});

test('clock exceptions and malformed clock results cannot establish authority or leak details',async()=>{
  const values=[{wall:NaN,tick:1},{wall:1,tick:Infinity},{wall:-1,tick:1},{wall:1,tick:0.5},{wall:Number.MAX_SAFE_INTEGER+1,tick:1},{wall:1,tick:1,extra:true}];
  for(const clock of [...values.map(value=>()=>value),()=>{throw Error('SECRET_CLOCK_CANARY');}]){
    let calls=0;const owner=createLocalSessions(boundary(()=>{calls++;throw Error('Unexpected storage');}),configuration(),clock);
    assert.deepEqual(await owner.start(signal()),{kind:'unavailable'});assert.equal(calls,0);
  }
});

test('native entropy failure returns a fixed failure without publishing a launch code',async t=>{
  const config=configuration();let generation='',writes=0;
  const owner=createLocalSessions(boundary(async(/** @type {{companyId:string,operationId:string}} */ context,/** @type {Function} */ work)=>{
    try{
      const value=await work({companyId:context.companyId,operationId:context.operationId,query:async(/** @type {string} */name,/** @type {string[]} */values=[])=>{
        if(name==='local_boot'){generation=values[2];return [[generation]];}
        if(name==='local_lock')return [[config.actorRef,config.revisionRef,generation,null,null,null,'']];
        if(name==='local_code')writes++;
        return [];
      }});return {kind:'committed',value};
    }catch{return {kind:'unavailable'};}
  }),config);
  assert.deepEqual(await owner.start(signal()),{kind:'ready'});
  const mocked=t.mock.method(crypto,'randomBytes',()=>{throw Error('SECRET_ENTROPY_CANARY');});syncBuiltinESMExports();
  try{assert.deepEqual(await owner.issue(signal()),{kind:'unavailable'});assert.equal(writes,0);}
  finally{mocked.mock.restore();syncBuiltinESMExports();owner.stop();}
});
