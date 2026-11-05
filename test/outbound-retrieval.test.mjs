import test from 'node:test';
import assert from 'node:assert/strict';
import { createRetrievalTransport, providerWait } from '../src/adapters/outbound/retrieve.js';

const policy={id:'source',companyId:'a',revision:'1',endpoints:[{origin:'https://feed.example',paths:['/feed'],queryKeys:[]}]};
test('provider delay/date parsing preserves exact bounded waits and rejects invalid timing',()=>{
  const now=Date.parse('Wed, 04 Nov 2026 20:00:00 GMT');
  assert.equal(providerWait('3600',now),now+3600000);assert.equal(providerWait(null,now),null);
  assert.equal(providerWait('Wed, 04 Nov 2026 21:00:00 GMT',now),now+3600000);
  assert.equal(providerWait('Wed, 04 Nov 2026 19:00:00 GMT',now),now);
  for(const header of ['-1','1.5','Infinity','1e2','9999999999999999','Thu, 04 Nov 2026 21:00:00 GMT','2026-11-04','Wed, 04 Nov 2026 25:00:00 GMT','a'.repeat(1000)])assert.equal(providerWait(header,now),undefined);
});

test('invalid or denied operation admission has no DNS effect; abandoned slots release on cancel/close',async()=>{
  let lookups=0;
  const transport=createRetrievalTransport(policy,context=>context==='current-a' ? 'allowed' : 'denied',{}, {resolve:async()=>{lookups++;return ['127.0.0.1'];}});
  for(const context of [null,undefined,'company-b','revoked','wrong-role'])assert.deepEqual(transport.begin({context,signal:new AbortController().signal}),{kind:'failed',reason:'denied'});
  assert.deepEqual(transport.begin({context:'current-a',signal:new AbortController().signal,headers:{}}),{kind:'failed',reason:'invalid'});
  const controller=new AbortController();
  const operations=Array.from({length:4},()=>transport.begin({context:'current-a',signal:controller.signal}));
  assert.deepEqual(transport.begin({context:'current-a',signal:controller.signal}),{kind:'failed',reason:'capacity'});
  controller.abort();
  const next=transport.begin({context:'current-a',signal:new AbortController().signal});assert.equal(next.kind,'operation');
  if(next.kind==='operation'){assert.deepEqual(await next.read('https://unapproved.example/feed'),{kind:'failed',reason:'invalid'});next.close();}
  assert.equal(lookups,0);assert.equal(operations.length,4);transport.retire();
  assert.deepEqual(transport.begin({context:'current-a',signal:new AbortController().signal}),{kind:'failed',reason:'revoked'});
});

test('one logical operation cannot race concurrent reads or bypass an authority failure',async()=>{
  let lookups=0,current=true;
  const transport=createRetrievalTransport(policy,()=>{if(!current)throw new Error('synthetic-private-canary');return 'allowed';},{},
    {resolve:async(_host,signal)=>{lookups++;return new Promise(resolve=>signal.addEventListener('abort',()=>resolve([]),{once:true}));}});
  const op=transport.begin({context:{},signal:new AbortController().signal});assert.equal(op.kind,'operation');
  if(op.kind!=='operation')return;
  const pending=op.read('https://feed.example/feed');
  assert.deepEqual(await op.read('https://feed.example/feed'),{kind:'failed',reason:'busy'});
  assert.equal(lookups,1);op.close();assert.deepEqual(await pending,{kind:'failed',reason:'closed'});
  const next=transport.begin({context:{},signal:new AbortController().signal});assert.equal(next.kind,'operation');
  if(next.kind==='operation'){current=false;assert.deepEqual(await next.read('https://feed.example/feed'),{kind:'failed',reason:'denied'});next.close();}
  assert.equal(lookups,1);transport.retire();
});
