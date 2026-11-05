import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransactionBoundary } from '../src/persistence/transactions.js';
import { createAdministrativeAudit,auditStatements } from '../src/persistence/administrative-audit.js';
const config={host:'localhost',port:1,database:'synthetic',user:'synthetic',password:'synthetic',ca:'-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----'};
const installation={producerRef:'producer_a',environment:'test'};

test('audit installation configuration rejects unknown, inherited, accessor and oversized producer fields without I/O',async()=>{
  const boundary=createTransactionBoundary(config,auditStatements);let getters=0;
  const owner={authorize:async()=>({kind:/** @type {const} */('denied')}),read:async()=>/** @type {const} */('denied')};
  try{
    for(const input of [null,{},Object.create(installation),{...installation,extra:'private'},{...installation,producerRef:'x'.repeat(129)},{...installation,producerRef:'private/name'},{...installation,environment:'unreviewed'},Object.defineProperty({...installation},'producerRef',{get(){getters++;return 'producer_a';}})])assert.throws(()=>createAdministrativeAudit(boundary,input,owner),/Invalid audit configuration/);
    assert.equal(getters,0);assert.equal(boundary.status().active,0);
  }finally{await boundary.close();}
});

test('invalid, pre-cancelled and closed audit operations cannot invoke authorization or mutation',async()=>{
  const boundary=createTransactionBoundary(config,auditStatements);let calls=0;
  const owner=createAdministrativeAudit(boundary,installation,{authorize:async()=>{calls++;return {kind:'denied'};},read:async()=>{calls++;return 'denied';}});
  const context={companyId:'company_a',operationId:'operation_a',signal:new AbortController().signal,timeoutMs:1000};
  for(const bad of [null,{},Object.create(context),{...context,companyId:'../private'},{...context,timeoutMs:0},{...context,extra:true}]) {
    const result=await Reflect.apply(owner.change,undefined,[bad,{}]);assert.equal(result.kind,'invalid');
  }
  const controller=new AbortController();controller.abort();assert.equal((await owner.change({...context,signal:controller.signal},{})).kind,'cancelled');
  await boundary.close();assert.equal((await owner.change(context,{})).kind,'unavailable');assert.equal((await owner.reconcile(context)).kind,'unavailable');assert.equal(calls,0);
});
