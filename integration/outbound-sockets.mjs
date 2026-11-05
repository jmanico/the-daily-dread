import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createTLS, createSecureContext } from 'node:tls';
import { createServer as createTCP } from 'node:net';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDestinationConnector } from '../src/adapters/outbound/connect-destination.js';

// Run inside the isolated Linux namespace prepared by test-support/outbound-net.sh.
// No internet route exists. This public-format address belongs only to its loopback.
const address='11.0.0.1';
const hostname='fixture.example';
/** @param {import('node:test').TestContext} t @param {()=>void} [onSNI] */
async function fixture(t,onSNI) {
  const directory=await mkdtemp(join(tmpdir(),'dread-outbound-tls-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const keyFile=join(directory,'key.pem'), certFile=join(directory,'cert.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-subj','/CN='+hostname,'-addext','subjectAltName=DNS:'+hostname,'-days','1'],{stdio:'ignore'});
  const key=await readFile(keyFile),ca=await readFile(certFile);
  const secureContext=createSecureContext({key,cert:ca});
  /** @type {Set<import('node:net').Socket>} */ const sockets=new Set();
  let connections=0,bytes=0;
  /** @type {string[]} */ const sni=[];
  const server=createTLS({key,cert:ca,SNICallback:(name,callback)=>{sni.push(name);onSNI?.();callback(null,secureContext);}},socket=>{
    socket.on('data',data=>{bytes+=data.length;socket.write('fixture-reply');});
  });
  server.on('connection',socket=>{connections++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>socket.destroy());});
  server.on('tlsClientError',(_error,socket)=>socket.destroy());
  server.listen(0,address);await once(server,'listening');
  t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  const bound=server.address();assert.ok(bound && typeof bound !== 'string');
  const origin=`https://${hostname}:${bound.port}`;
  const config={id:'source',companyId:'company-a',revision:'1',endpoints:[{origin,paths:['/feed'],queryKeys:[]}]};
  const command={url:origin+'/feed',context:'company-a-reader',signal:new AbortController().signal};
  return {config,command,ca,server,sni,connections:()=>connections,bytes:()=>bytes};
}

test('real TCP destination and TLS SNI stay bound to the approved host; proxy settings cannot redirect',async t=>{
  const f=await fixture(t);
  const original=process.env.HTTPS_PROXY;
  process.env.HTTPS_PROXY='http://127.0.0.1:1';
  t.after(()=>{if(original===undefined)delete process.env.HTTPS_PROXY;else process.env.HTTPS_PROXY=original;});
  const connector=createDestinationConnector(f.config,()=> 'allowed',{ca:f.ca,resolve:async()=>[address]});
  const result=await connector.connect(f.command);assert.equal(result.kind,'connected');
  if(result.kind!=='connected')return;
  t.after(()=>result.socket.destroy());
  assert.equal(result.socket.remoteAddress,address);assert.equal(result.socket.authorized,true);
  assert.deepEqual(f.sni,[hostname]);
  const response=once(result.socket,'data');result.socket.write('synthetic-public-probe');
  assert.equal(String((await response)[0]),'fixture-reply');
  assert.equal(f.bytes(),22);
  connector.retire();await once(result.socket,'close');
  assert.deepEqual(await connector.connect(f.command),{kind:'failed',reason:'revoked'});
});

test('untrusted certificates and wrong hostnames never yield an application connection',async t=>{
  const f=await fixture(t);
  const untrusted=createDestinationConnector(f.config,()=> 'allowed',{resolve:async()=>[address]});
  assert.deepEqual(await untrusted.connect(f.command),{kind:'failed',reason:'tls'});
  const wrong=structuredClone(f.config);wrong.endpoints[0].origin=wrong.endpoints[0].origin.replace(hostname,'wrong.example');
  const mismatch=createDestinationConnector(wrong,()=> 'allowed',{ca:f.ca,resolve:async()=>[address]});
  assert.deepEqual(await mismatch.connect({...f.command,url:f.command.url.replace(hostname,'wrong.example')}),{kind:'failed',reason:'tls'});
  assert.equal(f.bytes(),0);
});

test('fresh DNS on every connection blocks rebinding and never shares another policy revision',async t=>{
  const f=await fixture(t);let lookup=0;
  const connector=createDestinationConnector(f.config,()=> 'allowed',{ca:f.ca,resolve:async()=>[++lookup===1 ? address : '127.0.0.1']});
  const first=await connector.connect(f.command);assert.equal(first.kind,'connected');
  if(first.kind==='connected'){first.socket.destroy();await once(first.socket,'close');}
  assert.deepEqual(await connector.connect(f.command),{kind:'failed',reason:'address'});
  assert.equal(f.connections(),1);
  connector.retire();
  const secondPolicy=structuredClone(f.config);secondPolicy.revision='2';
  const second=createDestinationConnector(secondPolicy,()=> 'allowed',{ca:f.ca,resolve:async()=>[address]});
  const next=await second.connect(f.command);assert.equal(next.kind,'connected');
  if(next.kind==='connected'){assert.equal(next.revision,'2');next.socket.destroy();await once(next.socket,'close');}
  assert.equal(f.connections(),2);
});

test('authority revoked during the actual TLS handshake cannot release a connected stream',async t=>{
  let current=true;const f=await fixture(t,()=>{current=false;});
  const connector=createDestinationConnector(f.config,()=>current ? 'allowed' : 'denied',{ca:f.ca,resolve:async()=>[address]});
  assert.deepEqual(await connector.connect(f.command),{kind:'failed',reason:'denied'});
  assert.equal(f.bytes(),0);
});

test('cancellation and the real five-second connect deadline destroy stalled sockets',async t=>{
  /** @type {Set<import('node:net').Socket>} */ const sockets=new Set();
  const server=createTCP(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>socket.destroy());});
  server.listen(0,address);await once(server,'listening');
  t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  const bound=server.address();assert.ok(bound && typeof bound !== 'string');
  const origin=`https://${hostname}:${bound.port}`;
  const config={id:'source',companyId:'a',revision:'1',endpoints:[{origin,paths:['/'],queryKeys:[]}]};
  const connector=createDestinationConnector(config,()=> 'allowed',{resolve:async()=>[address]});
  const controller=new AbortController();
  const incoming=once(server,'connection');const result=connector.connect({url:origin+'/',context:{},signal:controller.signal});
  await incoming;controller.abort();
  assert.deepEqual(await result,{kind:'failed',reason:'canceled'});
  const start=performance.now();
  assert.deepEqual(await connector.connect({url:origin+'/',context:{},signal:new AbortController().signal}),{kind:'failed',reason:'timeout'});
  assert.ok(performance.now()-start>=4500 && performance.now()-start<10000);
});
