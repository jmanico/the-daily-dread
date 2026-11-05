import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { setImmediate as turn } from 'node:timers/promises';
import { createPublicRefresh } from '../demo/refresh.js';
import { projectPublicAdvisory,createPublicAdvisories } from '../demo/provider.js';
import { feedState } from '../demo/feed-state.js';
import { subscribeFeed } from '../demo/stream.js';
import { createDemoServer } from '../scripts/demo-server.mjs';
import raw from '../demo/live-feed.json' with {type:'json'};
const good=raw.items[0],stamp='2026-11-05T10:00:00.000Z';
const data=()=>({retrievedAt:stamp,items:[good]});
const state=()=>({state:'live',checkedAt:stamp,nextCheckAt:stamp,data:data(),omitted:0});
function provider(){return {ghsa_id:good.id,cve_id:good.cve,html_url:good.url,summary:good.title,description:good.description,type:good.type,severity:good.severity,published_at:good.published,updated_at:good.updated,withdrawn_at:good.withdrawn,credits:[{user:{login:'reporter'},type:'reporter'}],vulnerabilities:[{package:{name:'example',ecosystem:'npm'},vulnerable_version_range:'<1',first_patched_version:'1'}]};}

test('public provider projection preserves source/credits and rejects unsupported fields, types, links and bounds',()=>{
  const accepted=projectPublicAdvisory(provider(),good.type);assert.ok(accepted);assert.equal(accepted.description,good.description);assert.equal(accepted.credits[0].name,'reporter');
  for(const delta of [{raw:'PRIVATE_CANARY'},{type:good.type==='malware'?'reviewed':'malware'},{html_url:'https://evil.test'},{summary:'x'.repeat(2049)},{description:'x'.repeat(200001)},{credits:Array(101).fill({})},{credits:[{user:{login:'reporter',unknown:true},type:'reporter'}]},{vulnerabilities:[{package:{name:'p',ecosystem:'npm'},first_patched_version:{identifier:'1'},vulnerable_version_range:'*'}]}])assert.equal(projectPublicAdvisory({...provider(),...delta},good.type),null);
  let accessed=false;assert.equal(projectPublicAdvisory(Object.defineProperty(provider(),'summary',{get(){accessed=true;return 'PRIVATE_CANARY';}}),good.type),null);assert.equal(accessed,false);
});

test('browser feed state rejects forged status, unknown keys, duplicates and malformed projections',()=>{
  assert.ok(feedState(state()));
  for(const bad of [{...state(),state:'safe'},{...state(),raw:'PRIVATE_CANARY'},{...state(),omitted:31},{...state(),omitted:-1},{...state(),checkedAt:'bad'},{...state(),state:'paused'},{...state(),data:null},{...state(),data:{...data(),raw:true}},{...state(),data:{...data(),items:[good,good]}},{...state(),data:{...data(),items:[{...good,token:'PRIVATE_CANARY'}]}}])assert.equal(feedState(bad),null);
});

test('one scheduled refresh preserves last evidence on failure and pauses on provider limits',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date']});
  let calls=0;
  const feed=createPublicRefresh({read:async()=>{calls++;return calls===1?{kind:'updated',data:data(),omitted:2}:calls===2?{kind:'unavailable'}:{kind:'paused'};}});
  t.after(()=>feed.stop());feed.start();feed.start();await turn();assert.equal(calls,1);assert.equal(JSON.parse(feed.current()).state,'live');
  t.mock.timers.tick(299999);await turn();assert.equal(calls,1);t.mock.timers.tick(1);await turn();assert.equal(calls,2);assert.equal(JSON.parse(feed.current()).state,'stale');assert.equal(JSON.parse(feed.current()).data.retrievedAt,stamp);
  t.mock.timers.tick(300000);await turn();assert.equal(calls,3);assert.equal(JSON.parse(feed.current()).state,'paused');t.mock.timers.tick(3600000);await turn();assert.equal(calls,3);
});

test('deadline aborts source work and prevents replacements; stopping fences late completion',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date']});let calls=0;
/** @type {AbortSignal} */let signal=new AbortController().signal;
/** @type {(value:unknown)=>void} */let complete=()=>{throw Error("Source not started");};
  const feed=createPublicRefresh({read:s=>{calls++;signal=s;return new Promise(resolve=>{complete=resolve;});}});
  feed.start();t.mock.timers.tick(30000);await turn();assert.ok(signal);assert.equal(signal.aborted,true);assert.equal(JSON.parse(feed.current()).state,'paused');t.mock.timers.tick(3600000);await turn();assert.equal(calls,1);
  await feed.stop();assert.ok(complete);complete({kind:'updated',data:data(),omitted:0});await turn();assert.equal(JSON.parse(feed.current()).data,null);
  /** @type {AbortSignal|undefined} */let stoppedSignal;const stopped=createPublicRefresh({read:s=>{stoppedSignal=s;return new Promise(()=>{});}});stopped.start();await stopped.stop();assert.ok(stoppedSignal);assert.equal(stoppedSignal.aborted,true);assert.equal(stopped.subscribe(()=>{}),null);
});

test('invalid/throwing sources and consumers cannot inject output or stop other subscribers',async t=>{
  const feed=createPublicRefresh({read:async()=>{throw Error('PRIVATE_CANARY');}});t.after(()=>feed.stop());let count=0;
  feed.subscribe(()=>{throw Error('PRIVATE_CANARY');});feed.subscribe(()=>count++);feed.start();await turn();assert.equal(JSON.parse(feed.current()).state,'stale');assert.ok(count>=2);assert.doesNotMatch(feed.current(),/PRIVATE_CANARY/);
});

test('actual fixed transport rejects private DNS, and closes on cancellation',async()=>{
  let resolves=0;const source=createPublicAdvisories({resolve:async()=>{resolves++;return ['127.0.0.1'];}});
  try{assert.equal((await source.read(new AbortController().signal)).kind,'unavailable');assert.equal(resolves,1);const c=new AbortController();c.abort();assert.equal((await source.read(c.signal)).kind,'unavailable');}finally{source.close();}
});

test('browser stream omits credentials, bounds frames, reconnects and fences reads after cleanup',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const original=globalThis.fetch;
  /** @type {{writer?:ReadableStreamDefaultController<Uint8Array>,signal?:AbortSignal}} */const captured={};
  let calls=0,canceled=0,received=0,failed=0;
  globalThis.fetch=async(url,options)=>{
    calls++;assert.equal(url,'/demo/feed-events');assert.equal(options?.credentials,'omit');assert.equal(options?.redirect,'error');assert.equal(options?.cache,'no-store');
    captured.signal=/** @type {AbortSignal} */(options?.signal);
    const stream=new ReadableStream({start(writer){captured.writer=writer;captured.signal?.addEventListener('abort',()=>{try{writer.error(Error('canceled'));}catch{canceled++;}},{once:true});},cancel(){canceled++;}});
    return new Response(stream,{headers:{'content-type':'text/event-stream; charset=utf-8'}});
  };
  let stop=()=>{};
  try {
    stop=subscribeFeed(()=>received++,()=>failed++);await turn();assert.ok(captured.writer);
    const frame='data: '+JSON.stringify(state())+'\n\n';captured.writer.enqueue(new TextEncoder().encode(frame.slice(0,100)));await turn();assert.equal(received,0);
    captured.writer.enqueue(new TextEncoder().encode(frame.slice(100)));await turn();assert.equal(received,1);
    captured.writer.enqueue(new TextEncoder().encode('data: '+ 'x'.repeat(1048601)));await turn();assert.equal(failed,1);assert.equal(captured.signal?.aborted,true);
    t.mock.timers.tick(10000);await turn();assert.equal(calls,2);t.mock.timers.tick(30000);await turn();assert.ok(failed>=2);stop();const before=failed;t.mock.timers.tick(60000);await turn();assert.equal(calls,2);assert.equal(failed,before);
  }finally{stop();globalThis.fetch=original;}
});

test('real loopback stream rejects cross-site/credentials/methods and bounds consumers without triggering fetches',async t=>{
  let calls=0;const feed=createPublicRefresh({read:async()=>{calls++;return {kind:'updated',data:data(),omitted:0};}});t.after(()=>feed.stop());
  const server=createDemoServer(new Map([['/',Buffer.from('demo')]]),feed);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});const address=server.address();assert.ok(address && typeof address==='object');
  /** @param {Record<string,string|undefined>} [headers] @param {string} [method] @param {string} [path] */
  const connect=(headers={},method='GET',path='/demo/feed-events')=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:address.port,path,method,headers},res=>resolve({req,res}));req.on('error',reject);req.end();});
  const clients=[];
  for(const headers of [{host:'evil.test'},{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'},{cookie:'private'},{authorization:'Bearer private'}]){const {req,res}=await connect(headers);assert.equal(res.statusCode,400);res.resume();req.destroy();}
  for(const [method,path,status] of /** @type {[string,string,number][]} */([['POST','/demo/feed-events',405],['GET','/demo/feed-events?url=https://evil.test',404],['HEAD','/demo/feed-events',200]])){const {req,res}=await connect({},method,path);assert.equal(res.statusCode,status);res.resume();req.destroy();}
  for(let i=0;i<8;i++){const client=await connect();assert.equal(client.res.statusCode,200);client.res.resume();clients.push(client);}
  const extra=await connect();assert.equal(extra.res.statusCode,503);extra.res.resume();extra.req.destroy();assert.equal(calls,0);
  for(const client of clients)client.req.destroy();await turn();await turn();
  const received=new Promise(resolve=>{const req=request({hostname:'127.0.0.1',port:address.port,path:'/demo/feed-events'},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.includes('"state":"live"')){req.destroy();resolve(text);}});});req.end();});
  feed.start();const bytes=await received;assert.match(String(bytes),/text|data:/);assert.match(String(bytes),/"omitted":0/);assert.equal(calls,1);
});
