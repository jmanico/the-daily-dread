import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:tls';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createPublicAdvisories } from '../demo/provider.js';
const address='11.0.0.1';
// Only the isolated namespace prepared by outbound-net.sh has this address.
// No real DNS, private credentials or external network route is available.
test('fixed public advisory adapter crosses real TLS, parser and projection boundaries',{timeout:30000},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'dread-public-feed-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const keyPath=join(directory,'key.pem'),certPath=join(directory,'cert.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-subj','/CN=api.github.com','-addext','subjectAltName=DNS:api.github.com','-days','1'],{stdio:'ignore'});
  const key=await readFile(keyPath),ca=await readFile(certPath);
  let mode='valid',calls=0;
  /** @type {string[]} */const requests=[];
  /** @type {Set<import('node:net').Socket>} */const sockets=new Set();
  const server=createServer({key,cert:ca},socket=>{
    socket.on('error',()=>socket.destroy());let text='';
    socket.on('data',function receive(bytes){
      text+=bytes.toString('latin1');assert.ok(text.length<8192);
      if(!text.includes('\r\n\r\n'))return;socket.off('data',receive);calls++;requests.push(text);
      const type=/type=(reviewed|unreviewed|malware)&/.exec(text)?.[1];assert.ok(type);
      const id=type==='reviewed'?'GHSA-2345-2345-2345':type==='unreviewed'?'GHSA-3456-3456-3456':'GHSA-4567-4567-4567';
      const record={ghsa_id:id,cve_id:null,html_url:`https://github.com/advisories/${id}`,summary:'<img src=x onerror=alert(1)>',description:'Publisher statement',type,severity:'high',published_at:'2026-11-05T00:00:00Z',updated_at:'2026-11-05T00:00:00Z',withdrawn_at:null,credits:[],vulnerabilities:[]};
      let body=Buffer.from(JSON.stringify([record])),status=200,headers='Content-Type: application/json\r\n';
      if(mode==='duplicate')body=Buffer.from(JSON.stringify([record,record]));
      if(mode==='extra')body=Buffer.from(JSON.stringify([{...record,secret:'PRIVATE_CANARY'}]));
      if(mode==='partial')body=Buffer.from(JSON.stringify([record,{...record,secret:'PRIVATE_CANARY'}]));
      if(mode==='oversize')body=gzipSync(Buffer.from(' '.repeat(2097153)));
      if(mode==='oversize')headers+='Content-Encoding: gzip\r\n';
      if(mode==='bad_json')body=Buffer.from('[{"x":1,"x":2}]');
      if(mode==='deep')body=Buffer.from('['.repeat(40)+'0'+']'.repeat(40));
      if(mode==='count')body=Buffer.from(JSON.stringify(Array(11).fill(record)));
      if(mode==='mime')headers='Content-Type: text/html\r\n';
      if(mode==='error')status=500;
      if(mode==='denied')status=403;
      if(mode==='rate'){status=429;headers+='Retry-After: 7200\r\n';}
      if(mode==='poll')headers+='X-Poll-Interval: 7200\r\n';
      if(mode==='bad_poll')headers+='X-Poll-Interval: invalid\r\n';
      if(mode==='redirect'){status=302;headers+='Location: http://127.0.0.1/PRIVATE_CANARY\r\n';}
      if(mode==='stalled')return;
      socket.end(Buffer.concat([Buffer.from(`HTTP/1.1 ${status} Fixture\r\n${headers}Content-Length: ${body.length}\r\nConnection: close\r\n\r\n`),body]));
    });
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>socket.destroy());});server.on('tlsClientError',(_error,socket)=>socket.destroy());
  server.listen(443,address);await once(server,'listening');t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  const source=createPublicAdvisories({ca,resolve:async host=>{assert.equal(host,'api.github.com');return [address];}});t.after(()=>source.close());
  await t.test('three fixed serial credential-free requests preserve types and inert original text',async()=>{
    const result=await source.read(new AbortController().signal);assert.equal(result.kind,'updated');if(result.kind!=='updated')return;
    assert.equal(result.data.items.length,3);assert.equal(result.omitted,0);assert.equal(result.data.items[0].title,'<img src=x onerror=alert(1)>');
    assert.equal(calls,3);for(const [i,type] of ['reviewed','unreviewed','malware'].entries()){assert.match(requests[i],new RegExp(`GET /advisories\\?type=${type}&per_page=10&sort=published&direction=desc HTTP/1.1`));assert.doesNotMatch(requests[i],/authorization:|cookie:|PRIVATE_CANARY/i);}
  });
  for(const scenario of ['duplicate','extra','oversize','bad_json','deep','count','mime','error','redirect','denied','rate','poll','bad_poll'])await t.test(`provider ${scenario} fails closed without raw payload or destination expansion`,async()=>{
    mode=scenario;const before=calls,result=await source.read(new AbortController().signal);assert.equal(result.kind,['denied','rate','poll','bad_poll'].includes(scenario)?'paused':'unavailable');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_CANARY|127\.0\.0\.1/);assert.ok(calls-before<=3);if(scenario==='redirect')assert.equal(calls-before,1);
  });
  await t.test('invalid records are omitted and counted while valid source evidence survives',async()=>{
    mode='partial';const result=await source.read(new AbortController().signal);assert.equal(result.kind,'updated');if(result.kind!=='updated')return;
    assert.equal(result.omitted,3);assert.equal(result.data.items.length,3);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_CANARY/);
  });
  await t.test('cancellation destroys a stalled actual provider socket',async()=>{
    mode='stalled';const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),100);try{assert.equal((await source.read(controller.signal)).kind,'unavailable');}finally{clearTimeout(timer);}
  });
});
