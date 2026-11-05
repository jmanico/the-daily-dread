import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransactionBoundary, TransactionRejection } from '../src/persistence/transactions.js';

const config={host:'localhost',port:5432,database:'synthetic',user:'synthetic',password:'synthetic-fixture',ca:'-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----\n'};
const statements={read:'select $1::text'};
const context=()=>({companyId:'company_a',operationId:'operation_a',signal:new AbortController().signal,timeoutMs:1000});

test('database configuration rejects URLs, TLS overrides, unknown/accessor fields and invalid bounded primitives',()=>{
  let invoked=0;
  const getter=Object.defineProperty({...config},'password',{get(){invoked++;return 'secret';}});
  for(const input of [null,'postgres://host/db',{...config,ssl:false},{...config,host:'https://example.test'},
    {...config,host:'/tmp/db'},{...config,port:0},{...config,port:65536},{...config,port:1.5},
    {...config,user:'user\0other'},{...config,password:''},{...config,password:'x'.repeat(4097)},
    {...config,ca:'not a certificate'},{...config,ca:'x'.repeat(65537)},getter,Object.create(config)]) {
    assert.throws(()=>createTransactionBoundary(input,statements),/Invalid database configuration/);
  }
  assert.equal(invoked,0);
});

test('fixed statement registry rejects malformed names, accessors, inheritance, excess and NUL SQL',()=>{
  let invoked=0;
  for(const registry of [{},{Read:'select 1'},{read:'select \0'},Object.create(statements),
    {read:'x'.repeat(16385)},Object.fromEntries(Array.from({length:101},(_,i)=>['q'+i,'select 1'])),
    Object.defineProperty({},'read',{enumerable:true,get(){invoked++;return 'select 1';}})]){
    assert.throws(()=>createTransactionBoundary(config,registry),/Invalid statement registry/);
  }
  assert.equal(invoked,0);
});

test('invalid, already cancelled and closed transaction calls never invoke the owner',async()=>{
  const boundary=createTransactionBoundary(config,statements);let calls=0;
  async function work(){calls++;return 'must not execute';}
  for(const input of [null,{...context(),companyId:'bad/name'},{...context(),operationId:''},
    {...context(),signal:{}},{...context(),timeoutMs:0},{...context(),timeoutMs:10001},
    {...context(),timeoutMs:NaN},{...context(),extra:true},Object.create(context())])assert.equal((await boundary.run(input,work)).kind,'invalid');
  const aborted=new AbortController();aborted.abort();
  assert.equal((await boundary.run({...context(),signal:aborted.signal},work)).kind,'cancelled');
  await boundary.close();assert.equal((await boundary.run(context(),work)).kind,'unavailable');
  assert.deepEqual(boundary.status(),{active:0,closed:true});assert.equal(calls,0);
  for(const kind of /** @type {const} */(['denied','not_found','conflict','invalid']))assert.equal(new TransactionRejection(kind).message,'Transaction rejected');
  assert.throws(()=>Reflect.construct(TransactionRejection,['private-secret']),/Invalid transaction rejection/);
});
