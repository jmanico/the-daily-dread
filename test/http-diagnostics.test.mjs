import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnection} from 'node:net';
import {createApplication,operationSignal} from '../src/http/application.js';
import {createDiagnosticCapture,recordHttpOutcome,recordIngressRejection} from '../src/audit/http-diagnostics.js';
const secret='SYNTHETIC_SECRET_private_repo_person@example.invalid';
const id='12345678-1234-4123-8123-123456789abc';
/** @param {import('../src/audit/http-diagnostics.js').Capture} capture */
function records(capture) {
  const result=[];let line;
  while((line=capture.take())!==undefined){assert.ok(Buffer.byteLength(line)<=4096);assert.ok(!line.includes(secret));result.push(JSON.parse(line));}
  return result;
}
test('real Fastify logs only projected route/status/duration and its own request ID',async t=>{
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  app.post('/items/:id',async()=>({ok:true}));
  const reply=await app.inject({method:'POST',url:`/items/${secret}?q=${secret}`,headers:{authorization:`Bearer ${secret}`,cookie:`session=${secret}`,'x-request-id':secret,'content-type':'application/json'},payload:{password:secret}});
  assert.equal(reply.statusCode,200);
  const rows=records(capture);assert.equal(rows.length,1);
  assert.deepEqual(Object.keys(rows[0]).sort(),['kind','level','timestamp','request_id','method','route','status','duration_ms'].sort());
  assert.equal(rows[0].route,'/items/:id');assert.equal(rows[0].method,'POST');assert.equal(rows[0].status,200);
  assert.match(rows[0].request_id,/^[0-9a-f-]{36}$/);assert.ok(Number.isSafeInteger(rows[0].duration_ms));
  assert.ok(capture.status().suppressed>=2);assert.equal(capture.status().bytes,0);
});
test('raw log arguments, errors, accessors and nested child bindings never enter serialization',async t=>{
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  let accessed=0;
  const hostile={get req(){accessed++;throw new Error(secret);},get toJSON(){accessed++;throw new Error(secret);}};
  app.log.info(hostile,secret);app.log.error(new Error(secret,{cause:new Error(secret)}));
  const child=app.log.child(hostile,/** @type {import('fastify').FastifyLoggerOptions} */(hostile));
  assert.equal(child,app.log);child.child({password:secret}).warn(hostile,secret);
  /** @type {import('fastify').FastifyBaseLogger & {setBindings:(value:unknown)=>void}} */(app.log).setBindings(hostile);
  assert.equal(accessed,0);assert.equal(capture.status().queued,0);
  app.get('/safe',async()=>({ok:true}));
  app.log.level='silent';
  assert.equal((await app.inject('/safe')).statusCode,200);
  const rows=records(capture);assert.equal(rows.length,1);assert.equal(rows[0].level,'info');
  assert.equal(accessed,0);
});
test('parser, schema, media and body-limit failures are captured without their rejected bytes',async t=>{
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  app.post('/command',{schema:{body:{type:'object',additionalProperties:false,required:['name'],properties:{name:{type:'string',maxLength:4}}}}},async()=>({ok:true}));
  const cases=[
    {payload:`{"name":"${secret}","name":"other"}`,media:'application/json',status:400},
    {payload:JSON.stringify({name:secret}),media:'application/json',status:422},
    {payload:secret,media:'text/plain',status:415},
    {payload:JSON.stringify({name:secret+'x'.repeat(65536)}),media:'application/json',status:413},
  ];
  for(const input of cases){
    const reply=await app.inject({method:'POST',url:'/command',headers:{'content-type':input.media},payload:input.payload});
    assert.equal(reply.statusCode,input.status);const rows=records(capture);assert.equal(rows.length,1);assert.equal(rows[0].status,input.status);
  }
});
test('denied and failing actual handlers retain safe outcomes without private error content',async t=>{
  for(const access of ['unauthenticated','forbidden','unavailable','conflict','throws']){
    const capture=createDiagnosticCapture();
    const app=createApplication(async()=>{if(access==='throws')throw new Error(secret);return /** @type {'unauthenticated'|'forbidden'|'unavailable'|'conflict'} */(access);},capture);
    t.after(()=>app.close());app.get('/safe',async()=>{assert.fail('Unauthorized handler ran');});
    const reply=await app.inject({url:'/safe',headers:{authorization:secret}});
    assert.equal(reply.statusCode,access==='unauthenticated'?401:access==='forbidden'?403:access==='unavailable'?404:access==='conflict'?409:503);
    const rows=records(capture);assert.equal(rows.length,1);assert.equal(rows[0].status,reply.statusCode);
  }
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  app.get('/failure',async()=>{throw new Error(secret,{cause:{token:secret}});});
  assert.equal((await app.inject('/failure')).statusCode,503);assert.equal(records(capture)[0].status,503);
  assert.equal((await app.inject(`/${secret}`)).statusCode,404);assert.equal(records(capture)[0].route,'unmatched');
});
test('full bounded diagnostic buffer preserves HTTP behavior and admits again after consumption',async t=>{
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  app.get('/safe',async()=>({ok:true}));
  for(let i=0;i<40;i++)assert.equal((await app.inject('/safe')).statusCode,200);
  assert.equal(capture.status().queued,32);assert.equal(capture.status().dropped,8);assert.ok(capture.status().bytes<=131072);
  assert.ok(capture.take());assert.equal((await app.inject('/safe')).statusCode,200);
  assert.equal(capture.status().queued,32);assert.equal(capture.status().dropped,8);assert.equal(records(capture).length,32);
  assert.deepEqual([capture.status().queued,capture.status().bytes],[0,0]);
});
test('invalid snapshots and forged composition inputs fail closed without retaining payloads',async t=>{
  const capture=createDiagnosticCapture();
  assert.equal(recordHttpOutcome(capture,id,'GET','/safe',200,1),false);
  const app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  for(const args of [[secret,'GET','/safe',200,1],[id,secret,'/safe',200,1],[id,'GET',`/safe?${secret}`,200,1],[id,'GET','/'.repeat(257),200,1],[id,'GET','/safe',600,1],[id,'GET','/safe',200,-1],[id,'GET','/safe',200,0.1]]){
    assert.equal(recordHttpOutcome(capture,String(args[0]),String(args[1]),String(args[2]),Number(args[3]),Number(args[4])),false);
  }
  assert.equal(recordIngressRejection(capture,id,200),false);assert.equal(recordIngressRejection(capture,secret),false);
  assert.equal(capture.status().queued,0);assert.equal(capture.status().rejected,10);
  assert.throws(()=>createApplication(async()=> 'allowed',capture),/already bound/);
  assert.throws(()=>createApplication(async()=> 'allowed',{take:()=>undefined,status:()=>({queued:0,bytes:0,dropped:0,suppressed:0,rejected:0})}),/Invalid diagnostic capture/);
  assert.equal(recordIngressRejection(capture,id),true);assert.equal(records(capture)[0].kind,'http_ingress_rejected');
  assert.equal(recordIngressRejection(capture,id,503),true);assert.equal(records(capture)[0].level,'error');
});
test('native malformed HTTP framing captures no raw packet, headers or socket identity',async t=>{
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();assert.ok(address && typeof address==='object');
  const output=await new Promise((resolve,reject)=>{
    const socket=createConnection({host:'127.0.0.1',port:address.port});let received='';
    socket.setTimeout(2000,()=>{socket.destroy();reject(new Error('Test socket timeout'));});
    socket.once('error',reject);socket.on('data',chunk=>{received+=chunk;});socket.once('end',()=>resolve(received));
    socket.once('connect',()=>socket.write(`POST /${secret} HTTP/1.1\r\nHost: local\r\nAuthorization: ${secret}\r\nContent-Length: 1\r\nContent-Length: 2\r\n\r\nx`));
  });
  assert.match(String(output),/^HTTP\/1.1 400/);const rows=records(capture);assert.equal(rows.length,1);
  assert.deepEqual(Object.keys(rows[0]).sort(),['kind','level','timestamp','request_id','status'].sort());
  assert.equal(rows[0].kind,'http_ingress_rejected');
});
test('request metadata is snapshotted before handler mutations and isolated across concurrent requests',async t=>{
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  app.get('/items/:id',async request=>{request.id=secret;request.raw.method=secret;request.raw.url=secret;return {ok:true};});
  const replies=await Promise.all(Array.from({length:10},(_,i)=>app.inject(`/items/${i}`)));
  assert.ok(replies.every(reply=>reply.statusCode===200));const rows=records(capture);assert.equal(rows.length,10);
  assert.equal(new Set(rows.map(row=>row.request_id)).size,10);
  assert.ok(rows.every(row=>row.method==='GET' && row.route==='/items/:id'));
});
test('client cancellation records an aborted outcome without inventing an HTTP completion status',{timeout:5000},async t=>{
  const capture=createDiagnosticCapture(),app=createApplication(async()=> 'allowed',capture);t.after(()=>app.close());
  /** @type {()=>void} */ let entered=()=>undefined;
  /** @type {()=>void} */ let canceled=()=>undefined;
  const started=new Promise(resolve=>{entered=()=>resolve(undefined);});
  const aborted=new Promise(resolve=>{canceled=()=>resolve(undefined);});
  app.get('/slow',async request=>{
    const signal=operationSignal(request);entered();
    await new Promise(resolve=>signal.addEventListener('abort',()=>{canceled();resolve(undefined);},{once:true}));
    return {ok:false};
  });
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();assert.ok(address && typeof address==='object');
  const socket=createConnection({host:'127.0.0.1',port:address.port});t.after(()=>socket.destroy());
  socket.once('connect',()=>socket.write(`GET /slow?q=${secret} HTTP/1.1\r\nHost: local\r\n\r\n`));
  await started;socket.destroy();await aborted;await new Promise(resolve=>setImmediate(resolve));
  const rows=records(capture);assert.equal(rows.length,1);assert.equal(rows[0].kind,'http_aborted');assert.equal(rows[0].route,'/slow');assert.ok(!Object.hasOwn(rows[0],'status'));
});
