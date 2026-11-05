import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { isPublicAddress, samePublicAddress } from '../src/adapters/outbound/address-policy.js';
import { destinationPolicy, parseDestination, permitsDestination } from '../src/adapters/outbound/destination-policy.js';
import { createDestinationConnector } from '../src/adapters/outbound/connect-destination.js';

const config = () => ({id:'public-source',companyId:'company-a',revision:'1',endpoints:[{origin:'https://feed.example',paths:['/feed'],queryKeys:['page']}]});
const signal = () => new AbortController().signal;

test('platform IP parser and explicit special-purpose policy reject alternate/private destinations',()=>{
  for (const address of ['8.8.8.8','1.1.1.1','11.0.0.1','172.15.255.255','172.32.0.0','2001:4860:4860::8888','2606:4700:4700::1111']) assert.equal(isPublicAddress(address),true,address);
  for (const address of [null,{},'', 'localhost','127.1','2130706433','0x7f000001','0177.0.0.1','0.0.0.0','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.0','172.31.255.255','192.0.0.9','192.0.2.1','192.31.196.1','192.52.193.1','192.88.99.1','192.168.1.1','192.175.48.1','198.18.0.1','198.19.255.255','198.51.100.1','203.0.113.1','224.0.0.1','240.0.0.1','255.255.255.255','::','::1','::ffff:127.0.0.1','::ffff:8.8.8.8','64:ff9b::7f00:1','2001::1','2001:db8::1','2002:7f00:1::','2620:4f:8000::1','3ffe::1','3fff::1','5f00::1','fc00::1','fe80::1','ff02::1','2001:4860::1%lo']) assert.equal(isPublicAddress(address),false,String(address));
  assert.equal(samePublicAddress('2001:4860::1','2001:4860:0:0:0:0:0:1'),true);
  assert.equal(samePublicAddress('8.8.8.8','1.1.1.1'),false);
  assert.equal(samePublicAddress('8.8.8.8',undefined),false);
});

test('URL and frozen policy validate exact origins, paths, singleton queries and configuration',()=>{
  const original=config(); const policy=destinationPolicy(original); assert.ok(policy);
  original.endpoints[0].paths.push('/private');
  assert.equal(permitsDestination(policy,new URL('https://feed.example/private')),false);
  for (const url of ['https://feed.example/feed','https://feed.example/feed?page=2']) {
    const parsed=parseDestination(url);assert.ok(parsed);assert.equal(permitsDestination(policy,parsed),true);
  }
  for (const url of ['https://feed.example.evil.test/feed','https://evil.test/feed','https://feed.example:444/feed','https://feed.example/other','https://feed.example/feed?page=1&page=2','https://feed.example/feed?next=http://localhost','https://feed.example/feed?page='+ 'a'.repeat(1025)]) assert.equal(permitsDestination(policy,new URL(url)),false,url);
  for (const url of [null,{},'https://feed.example/feed#fragment','https://user:secret@feed.example/feed','http://feed.example/feed','file:///etc/passwd','https://localhost/feed','https://host.local/feed','https://feed.example./feed','https://127.1/feed','https://0x7f000001/feed','https://2130706433/feed','https://[::ffff:127.0.0.1]/feed','https://feed.example\\@localhost/feed','https://feed.example/\nfeed','a'.repeat(4097)]) assert.equal(parseDestination(url),undefined);
  for (const invalid of [null,{}, {...config(),proxy:'http://localhost'}, {...config(),revision:1}, {...config(),revision:'0'}, {...config(),companyId:''}, {...config(),endpoints:[]},JSON.parse('{"id":"x","companyId":"a","revision":"1","endpoints":[],"__proto__":{}}')]) assert.equal(destinationPolicy(invalid),undefined);
  for (const path of ['//[bad','//evil.test/feed','/x/../feed','relative','/feed?x=1']) { const invalid=config();invalid.endpoints[0].paths=[path];assert.equal(destinationPolicy(invalid),undefined,path); }
  assert.throws(()=>createDestinationConnector({},()=> 'allowed'));
});

test('denied, throwing and unavailable authority never reaches DNS or a socket',async()=>{
  let resolutions=0;
  const resolve=async()=>{resolutions++;return ['8.8.8.8'];};
  const connector=createDestinationConnector(config(),context=>context === 'current-company-a-admin' ? 'allowed' : 'denied',{resolve});
  for (const context of [undefined,null,'company-b-admin','company-a-user','revoked-service','other-owner']) assert.deepEqual(await connector.connect({url:'https://feed.example/feed',context,signal:signal()}),{kind:'failed',reason:'denied'});
  for (const authorize of [()=>{throw new Error('synthetic-private-secret');},()=>/** @type {const} */('unavailable')]) {
    const denied=createDestinationConnector(config(),authorize,{resolve});
    assert.deepEqual(await denied.connect({url:'https://feed.example/feed',context:{},signal:signal()}),{kind:'failed',reason:'denied'});
  }
  for (const input of [{url:'https://feed.example/feed',context:{},signal:signal(),agent:{}},{url:'https://feed.example/feed',context:{}},null]) assert.deepEqual(await connector.connect(input),{kind:'failed',reason:'invalid'});
  assert.equal(resolutions,0);
});

test('actual private listener sees no connections for private or mixed DNS answers',async t=>{
  let connections=0;
  const server=createServer(socket=>{connections++;socket.destroy();});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const address=server.address();assert.ok(address && typeof address !== 'string');
  const origin=`https://feed.example:${address.port}`;
  const policy={id:'feed',companyId:'a',revision:'1',endpoints:[{origin,paths:['/feed'],queryKeys:[]}]};
  for (const answers of [[],['127.0.0.1'],['8.8.8.8','127.0.0.1'],['::ffff:127.0.0.1'],['169.254.169.254'],['invalid'],Array(17).fill('8.8.8.8')]) {
    const connector=createDestinationConnector(policy,()=> 'allowed',{resolve:async()=>answers});
    assert.deepEqual(await connector.connect({url:origin+'/feed',context:{},signal:signal()}),{kind:'failed',reason:'address'});
  }
  assert.equal(connections,0);
});

test('DNS failures, cancellation, retirement and changed authority fence late resolution',async()=>{
  const command={url:'https://feed.example/feed',context:{},signal:signal()};
  const failed=createDestinationConnector(config(),()=> 'allowed',{resolve:async()=>{throw new Error('secret-host.internal');}});
  assert.deepEqual(await failed.connect(command),{kind:'failed',reason:'dns'});
  assert.deepEqual(await failed.connect({...command,signal:AbortSignal.abort()}),{kind:'failed',reason:'canceled'});
  /** @type {(value:unknown)=>void} */ let release=()=>{};
  const pending=new Promise(resolve=>{release=resolve;});
  const retired=createDestinationConnector(config(),()=> 'allowed',{resolve:async()=>pending});
  const result=retired.connect(command);retired.retire();release(['8.8.8.8']);
  assert.deepEqual(await result,{kind:'failed',reason:'revoked'});
  assert.deepEqual(await retired.connect(command),{kind:'failed',reason:'revoked'});
  let current=true;
  const revoked=createDestinationConnector(config(),()=>current ? 'allowed' : 'denied',{resolve:async()=>{current=false;return ['8.8.8.8'];}});
  assert.deepEqual(await revoked.connect(command),{kind:'failed',reason:'denied'});
});

test('connection admission stays bounded during pending resolution and releases failed slots',async()=>{
  /** @type {(value:unknown)=>void} */ let release=()=>{};
  const pending=new Promise(resolve=>{release=resolve;});
  const connector=createDestinationConnector(config(),()=> 'allowed',{resolve:async()=>pending});
  const command={url:'https://feed.example/feed',context:{},signal:signal()};
  const calls=Array.from({length:32},()=>connector.connect(command));
  assert.deepEqual(await connector.connect(command),{kind:'failed',reason:'capacity'});
  release(['127.0.0.1']);
  assert.ok((await Promise.all(calls)).every(result=>result.kind === 'failed' && result.reason === 'address'));
  assert.deepEqual(await connector.connect(command),{kind:'failed',reason:'address'});
});

test('DNS completion after the real connect deadline cannot beat a delayed timer callback',async()=>{
  const connector=createDestinationConnector(config(),()=> 'allowed',{resolve:async()=>{
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5050);
    return ['127.0.0.1'];
  }});
  assert.deepEqual(await connector.connect({url:'https://feed.example/feed',context:{},signal:signal()}),{kind:'failed',reason:'timeout'});
});
