import test from 'node:test';
import assert from 'node:assert/strict';
import raw from '../demo/live-feed.json' with { type: 'json' };
import { advisory, snapshot, filterAdvisories } from '../demo/live-model.js';

test('actual retrieved public records pass closed projections and retain attribution',()=>{
  const result=snapshot(raw);assert.ok(result);assert.equal(result.items.length,15);assert.equal(result.rejected,1);
  for(const type of ['reviewed','unreviewed','malware']) assert.ok(result.items.some(item=>item.type === type));
  for(const item of result.items) { assert.equal(item.url,`https://github.com/advisories/${item.id}`);assert.ok(item.published);assert.ok(item.updated); }
  const credited=result.items.find(item=>item.credits.length);assert.ok(credited);
  assert.equal(credited.credits[0].name,raw.items.find(item=>item.id === credited.id)?.credits[0].name);
});

test('hostile destinations, malformed fields and excessive records fail closed',()=>{
  const good=raw.items[0];
  for(const url of ['javascript:alert(1)','https://github.com.attacker.test/advisories/'+good.id,'https://github.com@attacker.test/','https://github.com/advisories/../settings',good.url+'?x=1']) assert.equal(advisory({...good,url}),null);
  for(const delta of [{severity:'safe'},{type:'verified'},{published:'yesterday'},{cve:'CVE-fake'},{withdrawn:'false'},{title:'x'.repeat(2049)},{description:'x'.repeat(200001)},{credits:[{}]},{vulnerabilities:[{}]}]) assert.equal(advisory({...good,...delta}),null);
  for(const bad of [null,[],{}, {...raw,items:[good,good]}, {...raw,items:Array(101).fill(good)}, {...raw,retrievedAt:'unknown'}]) assert.equal(snapshot(bad),null);
  const projected=advisory({...good,credential:'DREAD_SECRET_CANARY',innerHTML:'<img src=x>'});
  // Live network projections now reject unknown fields outright, rather than discard them.
  assert.equal(projected,null);
});

test('live filters keep types distinct and never evaluate search strings',()=>{
  const data=snapshot(raw);assert.ok(data);
  assert.equal(filterAdvisories(data.items,'','reviewed','all').length,7);
  assert.equal(filterAdvisories(data.items,'','unreviewed','all').length,4);
  assert.equal(filterAdvisories(data.items,'','malware','all').length,4);
  assert.equal(filterAdvisories(data.items,data.items[0].id,'all','all').length,1);
  for(const query of ['<img src=x onerror=alert(1)>','.*','x'.repeat(161)]) assert.deepEqual(filterAdvisories(data.items,query,'all','all'),[]);
  assert.deepEqual(filterAdvisories(data.items,'','__proto__','all'),[]);
  assert.deepEqual(filterAdvisories(data.items,'','all','safe'),[]);
});
