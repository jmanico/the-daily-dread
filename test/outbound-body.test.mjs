import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { gzipSync, deflateSync } from 'node:zlib';
import { createRetrievalBudget } from '../src/adapters/outbound/retrieval-budget.js';
import { readBoundedBody } from '../src/adapters/outbound/read-body.js';

test('wire and decoded counters observe distinct gzip/deflate stages before returning bytes',async()=>{
  const payload=Buffer.from('synthetic-public-record '.repeat(100));
  for(const encoding of ['identity','gzip','deflate']) {
    const input=encoding==='gzip' ? gzipSync(payload) : encoding==='deflate' ? deflateSync(payload) : payload;
    const budget=createRetrievalBudget({},new AbortController().signal);
    const result=await readBoundedBody(Readable.from([input]),encoding,budget);
    assert.equal(result.kind,'body');if(result.kind==='body')assert.deepEqual(result.body,payload);
    assert.equal(budget.snapshot().wireBytes,input.length);assert.equal(budget.snapshot().decodedBytes,payload.length);budget.close();
  }
});

test('wire excess, expanded excess, unsupported encoding and corrupt/truncated compressed streams fail closed',async()=>{
  const payload=Buffer.alloc(1000,65),compressed=gzipSync(payload);
  for(const [input,encoding,limits,reason] of /** @type {[Buffer,string,object,string][]} */([
    [payload,'identity',{wireBytes:999},'wire_limit'],[compressed,'gzip',{decodedBytes:999},'decoded_limit'],
    [payload,'br',{},'encoding'],[compressed,'gzip, gzip',{},'encoding'],[Buffer.from('synthetic-invalid'),'gzip',{},'body'],
    [compressed.subarray(0,compressed.length-4),'gzip',{},'body'],
  ])) {
    const budget=createRetrievalBudget(limits,new AbortController().signal),source=Readable.from([input]);
    assert.deepEqual(await readBoundedBody(source,encoding,budget),{kind:'failed',reason});assert.equal(source.destroyed,true);budget.close();
  }
});

test('tiny chunks assemble exactly and a second response consumes the same remaining budget',async()=>{
  const budget=createRetrievalBudget({wireBytes:70000,decodedBytes:70000},new AbortController().signal);
  const chunks=Array.from({length:66000},()=>Buffer.from('a'));
  const result=await readBoundedBody(Readable.from(chunks),'identity',budget);
  assert.equal(result.kind,'body');if(result.kind==='body'){assert.equal(result.body.length,66000);assert.ok(result.body.every(byte=>byte===97));}
  const next=await readBoundedBody(Readable.from([Buffer.alloc(4001)]),'identity',budget);
  assert.deepEqual(next,{kind:'failed',reason:'wire_limit'});assert.equal(budget.snapshot().wireBytes,70001);budget.close();
});

test('actual idle deadline and cancellation destroy stalled streams without a late body result',async()=>{
  const stalled=new Readable({read(){this.push(Buffer.from('one-chunk'));this._read=()=>{};}});
  const budget=createRetrievalBudget({readMs:20},new AbortController().signal);
  assert.deepEqual(await readBoundedBody(stalled,'identity',budget),{kind:'failed',reason:'read_timeout'});
  assert.equal(stalled.destroyed,true);
  const external=new AbortController(),canceled=createRetrievalBudget({},external.signal);
  const source=new Readable({read(){external.abort();}});
  assert.deepEqual(await readBoundedBody(source,'identity',canceled),{kind:'failed',reason:'canceled'});
  assert.equal(source.destroyed,true);
});
