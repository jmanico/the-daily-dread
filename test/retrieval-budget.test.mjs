import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createRetrievalBudget, retrievalLimits } from '../src/adapters/outbound/retrieval-budget.js';

test('retrieval limits reject unknown, prototype, nonfinite and oversized configuration',()=>{
  assert.equal(retrievalLimits().redirects,0);
  assert.equal(retrievalLimits({decodedBytes:2*1024*1024}).decodedBytes,2*1024*1024);
  for (const input of [null,[],{other:1},JSON.parse('{"__proto__":{}}'),{wireBytes:0},{wireBytes:-1},{wireBytes:'1'},{decodedBytes:Infinity},{totalMs:NaN},{readMs:10001},{redirects:4},{wireBytes:5242881},{decodedBytes:10485761},{totalMs:30001}]) assert.throws(()=>retrievalLimits(input));
});

test('wire and decoded counts accumulate over retries and redirects and abort before excess acceptance',()=>{
  const budget=createRetrievalBudget({wireBytes:10,decodedBytes:20,redirects:1},new AbortController().signal);
  assert.equal(budget.beginAttempt(),true);
  assert.equal(budget.charge('wire',6),true);assert.equal(budget.charge('decoded',12),true);
  assert.equal(budget.consumeRedirect(),true);assert.equal(budget.beginAttempt(),true);
  assert.equal(budget.charge('wire',4),true);assert.equal(budget.charge('decoded',8),true);
  assert.equal(budget.beginAttempt(),true);
  assert.equal(budget.charge('wire',1),false);assert.equal(budget.signal.aborted,true);
  assert.equal(budget.snapshot().failure,'wire_limit');assert.equal(budget.snapshot().wireBytes,11);
  assert.equal(budget.charge('decoded',1),false);budget.close();
  assert.equal(budget.snapshot().failure,'wire_limit');
  const decoded=createRetrievalBudget({decodedBytes:2},new AbortController().signal);
  assert.equal(decoded.charge('decoded',3),false);assert.equal(decoded.snapshot().failure,'decoded_limit');
});

test('redirect and attempt ceilings cannot be reset and invalid counters fail closed',()=>{
  const blocked=createRetrievalBudget({},new AbortController().signal);
  assert.equal(blocked.consumeRedirect(),false);assert.equal(blocked.snapshot().failure,'redirect_limit');
  const attempts=createRetrievalBudget({},new AbortController().signal);
  for(let i=0;i<32;i++)assert.equal(attempts.beginAttempt(),true);
  assert.equal(attempts.beginAttempt(),false);assert.equal(attempts.snapshot().failure,'attempt_limit');
  for(const count of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
    const budget=createRetrievalBudget({},new AbortController().signal);
    assert.equal(budget.charge('wire',count),false);assert.equal(budget.snapshot().failure,'invalid_count');
  }
});

test('actual elapsed deadlines and caller cancellation abort the operation signal',async()=>{
  const external=new AbortController();
  const canceled=createRetrievalBudget({},external.signal);external.abort();
  assert.equal(canceled.signal.aborted,true);assert.equal(canceled.snapshot().failure,'canceled');
  const already=createRetrievalBudget({},AbortSignal.abort());assert.equal(already.snapshot().failure,'canceled');
  const total=createRetrievalBudget({totalMs:30},new AbortController().signal);
  total.touchRead();await delay(60);assert.equal(total.snapshot().failure,'timeout');
  assert.equal(total.beginAttempt(),false);
  const idle=createRetrievalBudget({readMs:20},new AbortController().signal);
  idle.touchRead();await delay(50);assert.equal(idle.snapshot().failure,'read_timeout');
  const completed=createRetrievalBudget({readMs:20},new AbortController().signal);
  completed.touchRead();completed.endRead();await delay(50);assert.equal(completed.signal.aborted,false);completed.close();
  assert.equal(completed.beginAttempt(),false);assert.equal(completed.snapshot().failure,'closed');
});
