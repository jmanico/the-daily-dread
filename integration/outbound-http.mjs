import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:tls';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, deflateSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { createRetrievalTransport } from '../src/adapters/outbound/retrieve.js';

const address='11.0.0.1',hostname='fixture.example';
/** @param {import('node:test').TestContext} t @param {(socket:import('node:tls').TLSSocket,request:string,index:number)=>void} respond */
async function fixture(t,respond) {
  const directory=await mkdtemp(join(tmpdir(),'dread-http-tls-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const keyFile=join(directory,'key.pem'),certFile=join(directory,'cert.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-subj','/CN='+hostname,'-addext','subjectAltName=DNS:'+hostname,'-days','1'],{stdio:'ignore'});
  const key=await readFile(keyFile),ca=await readFile(certFile);
  /** @type {Set<import('node:net').Socket>} */const sockets=new Set();
  /** @type {string[]} */const requests=[];
  const server=createServer({key,cert:ca},socket=>{
    let header='';
    socket.on('data',function receive(data){
      header+=data.toString('latin1');
      assert.ok(header.length<8192);
      if(header.includes('\r\n\r\n')){socket.off('data',receive);requests.push(header);respond(socket,header,requests.length);}
    });
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>socket.destroy());});
  server.on('tlsClientError',(_error,socket)=>socket.destroy());
  server.listen(0,address);await once(server,'listening');
  t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  const bound=server.address();assert.ok(bound && typeof bound!=='string');
  const origin=`https://${hostname}:${bound.port}`;
  const policy={id:'source',companyId:'company-a',revision:'1',endpoints:[{origin,paths:['/start','/next'],queryKeys:[]}]};
  return {origin,policy,requests,ports:{ca,resolve:async()=>[address]},server,sockets};
}
/** @param {ReturnType<typeof createRetrievalTransport>} transport */
function begin(transport) {
  const operation=transport.begin({context:'company-a-reader',signal:new AbortController().signal});
  assert.equal(operation.kind,'operation');
  if(operation.kind!=='operation')throw new Error('Expected operation');
  return operation;
}
/** @param {import('node:tls').TLSSocket} socket @param {Buffer} body @param {string} [extra] @param {number} [status] */
function send(socket,body,extra='',status=200) {
  socket.end(Buffer.concat([Buffer.from(`HTTP/1.1 ${status} Fixture\r\nContent-Length: ${body.length}\r\n${extra}Connection: close\r\n\r\n`),body]));
}

test('actual approved TLS HTTP retrieval counts wire and decoded bytes and sends only code-owned GET headers',async t=>{
  const body=Buffer.from('synthetic-public-fact '.repeat(100));
  const f=await fixture(t,(socket,_request,index)=>{
    if(index===1)send(socket,gzipSync(body),'Content-Encoding: gzip\r\nContent-Type: application/json\r\n');
    else if(index===2)send(socket,deflateSync(body),'Content-Encoding: deflate\r\n');
    else socket.end(Buffer.concat([Buffer.from('HTTP/1.1 200 Fixture\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n'+body.length.toString(16)+'\r\n'),body,Buffer.from('\r\n0\r\n\r\n')]));
  });
  const transport=createRetrievalTransport(f.policy,()=> 'allowed',{},f.ports);t.after(()=>transport.retire());
  const op=begin(transport);t.after(()=>op.close());
  for(let i=0;i<3;i++){const result=await op.read(f.origin+'/start');assert.equal(result.kind,'retrieved');if(result.kind==='retrieved')assert.deepEqual(result.body,body);}
  assert.equal(op.snapshot().wireBytes,gzipSync(body).length+deflateSync(body).length+body.length);
  assert.equal(op.snapshot().decodedBytes,body.length*3);
  for(const request of f.requests){assert.match(request,/^GET \/start HTTP\/1.1\r\n/);assert.ok(request.includes('Host: '+new URL(f.origin).host));assert.doesNotMatch(request,/authorization:|cookie:|proxy-authorization:/i);}
});

test('real oversized wire, decoded and chunked responses fail before returning content',async t=>{
  const body=Buffer.alloc(2048,65);
  const f=await fixture(t,(socket,_request,index)=>{
    if(index===2)send(socket,gzipSync(body),'Content-Encoding: gzip\r\n');
    else if(index===3)socket.end(Buffer.concat([Buffer.from('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n800\r\n'),body,Buffer.from('\r\n0\r\n\r\n')]));
    else send(socket,body);
  });
  for(const limits of [{wireBytes:2047},{decodedBytes:2047},{wireBytes:2047}]) {
    const transport=createRetrievalTransport(f.policy,()=> 'allowed',limits,f.ports);t.after(()=>transport.retire());
    const op=begin(transport);const result=await op.read(f.origin+'/start');
    assert.deepEqual(result,{kind:'failed',reason:Object.hasOwn(limits,'decodedBytes') ? 'decoded_limit' : 'wire_limit'});op.close();
  }
});

test('native HTTP parser and closed header projection reject malformed framing and unsupported responses',async t=>{
  const fixtures=[
    'HTTP/1.1 200 OK\r\nContent-Length: 1\r\nContent-Length: 1\r\n\r\nx',
    'HTTP/1.1 200 OK\r\nContent-Length: 1\r\nTransfer-Encoding: chunked\r\n\r\n1\r\nx\r\n0\r\n\r\n',
    'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nnothex\r\nx',
    'HTTP/1.1 200 OK\r\nContent-Length: 999\r\n\r\nshort',
    'HTTP/1.1 200 OK\r\nX-Large: '+'a'.repeat(17000)+'\r\n\r\n',
    'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n'+Array.from({length:101},(_,i)=>`X-${i}: a\r\n`).join('')+'\r\n',
    'HTTP/1.1 200 OK\r\nContent-Length: 0\r\nContent-Encoding: gzip\r\nContent-Encoding: identity\r\n\r\n',
    'HTTP/1.1 200 OK\r\nContent-Length: 4\r\nContent-Encoding: br\r\n\r\nnope',
    'HTTP/1.1 200 OK\r\nContent-Length: 4\r\nContent-Encoding: gzip\r\n\r\nnope',
    'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: other\r\n\r\n',
    'HTTP/1.1 103 Early Hints\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n',
    'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nX-Untrusted: synthetic-private-canary\r\n\r\n',
  ];
  const f=await fixture(t,(socket,_request,index)=>socket.end(fixtures[index-1]));
  const transport=createRetrievalTransport(f.policy,()=> 'allowed',{},f.ports);t.after(()=>transport.retire());
  for(let i=0;i<fixtures.length;i++) {
    const op=begin(transport);const result=await op.read(f.origin+'/start');
    assert.equal(result.kind,'failed','fixture '+i);assert.doesNotMatch(JSON.stringify(result),/synthetic-private-canary|nothex|nope/);op.close();
  }
});

test('redirects default to off; enabled hops share counters and revalidate private or unknown destinations',async t=>{
  let mode='safe';
  const f=await fixture(t,(socket,request)=>{
    if(request.startsWith('GET /next '))send(socket,Buffer.from('last'));
    else send(socket,Buffer.from('hop'),`Location: ${mode==='safe' ? '/next' : mode==='private' ? 'https://127.0.0.1/next' : '/unapproved'}\r\n`,302);
  });
  const off=createRetrievalTransport(f.policy,()=> 'allowed',{},f.ports);t.after(()=>off.retire());
  const first=begin(off);assert.deepEqual(await first.read(f.origin+'/start'),{kind:'failed',reason:'redirect_limit'});first.close();assert.equal(f.requests.length,1);
  const on=createRetrievalTransport(f.policy,()=> 'allowed',{redirects:3},f.ports);t.after(()=>on.retire());
  const allowed=begin(on);const result=await allowed.read(f.origin+'/start');assert.equal(result.kind,'retrieved');assert.equal(allowed.snapshot().wireBytes,7);assert.equal(allowed.snapshot().redirects,1);allowed.close();
  for(const value of ['private','unknown']) {
    mode=value;
    const op=begin(on);
    /** @type {number} */
    const beforeRequests=f.requests.length;
    assert.deepEqual(await op.read(f.origin+'/start'),{kind:'failed',reason:'invalid'});
    assert.equal(f.requests.length,beforeRequests+1);op.close();
  }
});

test('caller-owned retries cannot reset bytes or total time',async t=>{
  let slow=false;
  const f=await fixture(t,socket=>{
    if(slow){socket.write('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n');const timer=setInterval(()=>socket.write('1\r\na\r\n'),10);socket.once('close',()=>clearInterval(timer));}
    else send(socket,Buffer.from('123456'));
  });
  const limited=createRetrievalTransport(f.policy,()=> 'allowed',{wireBytes:10},f.ports);t.after(()=>limited.retire());
  const op=begin(limited);assert.equal((await op.read(f.origin+'/start')).kind,'retrieved');assert.deepEqual(await op.read(f.origin+'/start'),{kind:'failed',reason:'wire_limit'});op.close();
  const timed=createRetrievalTransport(f.policy,()=> 'allowed',{totalMs:250,readMs:100},f.ports);t.after(()=>timed.retire());
  const timedOp=begin(timed);assert.equal((await timedOp.read(f.origin+'/start')).kind,'retrieved');await delay(150);slow=true;
  assert.deepEqual(await timedOp.read(f.origin+'/start'),{kind:'failed',reason:'timeout'});assert.equal(timedOp.snapshot().attempts,2);timedOp.close();
});

test('provider waits are typed facts without an automatic retry or response-body disclosure',async t=>{
  const f=await fixture(t,(socket,_request,index)=>{
    if(index===3)send(socket,Buffer.from('invalid-gzip'),'Retry-After: 3600\r\nContent-Encoding: gzip\r\n',503);
    else send(socket,Buffer.from('synthetic-private-canary'),index===1 ? 'Retry-After: 3600\r\n' : 'Retry-After: -1\r\n',429);
  });
  const transport=createRetrievalTransport(f.policy,()=> 'allowed',{},f.ports);t.after(()=>transport.retire());
  const op=begin(transport),start=Date.now();const result=await op.read(f.origin+'/start');
  assert.equal(result.kind,'wait');if(result.kind==='wait'){assert.ok(result.notBeforeMs!==null && result.notBeforeMs>=start+3600000);}
  assert.equal(f.requests.length,1);assert.doesNotMatch(JSON.stringify(result),/synthetic-private-canary/);
  assert.deepEqual(await op.read(f.origin+'/start'),result);assert.equal(f.requests.length,1);op.close();
  const invalid=begin(transport);
  assert.deepEqual(await invalid.read(f.origin+'/start'),{kind:'failed',reason:'provider_wait',wait:{kind:'wait',status:429,notBeforeMs:null}});
  assert.deepEqual(await invalid.read(f.origin+'/start'),{kind:'wait',status:429,notBeforeMs:null});assert.equal(f.requests.length,2);invalid.close();
  const damaged=begin(transport),failure=await damaged.read(f.origin+'/start');
  assert.equal(failure.kind,'failed');
  if(failure.kind==='failed'){assert.equal(failure.reason,'body');assert.equal(failure.wait?.status,503);assert.ok(failure.wait?.notBeforeMs && failure.wait.notBeforeMs>=start+3600000);assert.ok(Object.isFrozen(failure.wait));}
  assert.equal((await damaged.read(f.origin+'/start')).kind,'wait');assert.equal(f.requests.length,3);damaged.close();
});

test('actual HTTP read inactivity, cancellation and current-authority loss prevent a returned body',async t=>{
  let mode='stall',allowed=true;
  const f=await fixture(t,socket=>{
    if(mode==='deny'){allowed=false;send(socket,Buffer.from('synthetic-private-canary'));}
    else if(mode==='body')socket.write('HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\npartial');
  });
  const transport=createRetrievalTransport(f.policy,()=>allowed ? 'allowed' : 'denied',{readMs:50},f.ports);t.after(()=>transport.retire());
  const idle=begin(transport);assert.deepEqual(await idle.read(f.origin+'/start'),{kind:'failed',reason:'read_timeout'});idle.close();
  mode='body';const controller=new AbortController();const op=transport.begin({context:{},signal:controller.signal});assert.equal(op.kind,'operation');
  if(op.kind==='operation'){const result=op.read(f.origin+'/start');await delay(20);controller.abort();assert.deepEqual(await result,{kind:'failed',reason:'canceled'});op.close();}
  mode='deny';const denied=begin(transport);assert.deepEqual(await denied.read(f.origin+'/start'),{kind:'failed',reason:'denied'});denied.close();
});
