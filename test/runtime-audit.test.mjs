import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {spawnSync} from 'node:child_process';
import {assessRuntime,fetchAuditSource,sources} from '../scripts/audit-node.mjs';
const now=Date.parse('2026-11-05T10:00:00Z');
const schedule={v26:{start:'2026-05-05',end:'2029-04-30'}};
const advisory={cve:['CVE-2026-12345'],vulnerable:'>=26.0.0 <27.0.0',patched:'>=26.13.0 <27.0.0'};
const data={'1':advisory};
test('runtime audit checks vulnerable and patched ranges without severity/platform exemptions',()=>{
  assert.equal(assessRuntime('v26.12.0',data,schedule,now).matches.length,1);
  assert.equal(assessRuntime('26.13.0',data,schedule,now).matches.length,0);
  assert.equal(assessRuntime('26.12.0',{'1':{...advisory,severity:'low',affectedEnvironments:['win32']}},schedule,now).matches.length,1);
  assert.equal(assessRuntime('26.12.0',{'1':{...advisory,cve:[]}},schedule,now).matches[0].id,'1');
});
test('empty, malformed and incomplete advisory data never becomes a passing audit',()=>{
  for(const value of [null,[],{}, {'1':{}},{'bad-id':advisory}]) assert.throws(()=>assessRuntime('26.13.0',value,schedule,now));
  for(const value of ['', ' ', 'not a range', '^26.0.0\n', ' '.repeat(257),null]) {
    assert.throws(()=>assessRuntime('26.13.0',{'1':{...advisory,vulnerable:value}},schedule,now));
    assert.throws(()=>assessRuntime('26.13.0',{'1':{...advisory,patched:value}},schedule,now));
  }
  for(const cve of [undefined,'CVE-2026-12345',['SECRET\nCANARY']]) assert.throws(()=>assessRuntime('26.13.0',{'1':{...advisory,cve}},schedule,now));
});
test('unsupported, prerelease, unknown and invalid runtime/support dates fail closed',()=>{
  for(const version of ['26.13.0-beta.1','026.13.0','26.13','99.1.1','garbage']) assert.throws(()=>assessRuntime(version,data,schedule,now));
  for(const support of [{start:'2026-05-05'}, {start:'2026-02-30',end:'2029-04-30'}, {start:'2027-01-01',end:'2029-04-30'}, {start:'2026-05-05',end:'2026-11-05'}]) assert.throws(()=>assessRuntime('26.13.0',data,{v26:support},now));
  assert.throws(()=>assessRuntime('26.13.0',data,schedule,NaN));
});
/** @param {(req:import('node:http').IncomingMessage,res:import('node:http').ServerResponse)=>void} handler
 * @param {(transport:import('../scripts/audit-node.mjs').RequestFunction)=>Promise<void>} use */
async function endpoint(handler,use){
  const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(undefined)));
  const address=server.address();assert.ok(address && typeof address==='object');
  /** @type {import('../scripts/audit-node.mjs').RequestFunction} */
  const transport=(url,options,callback)=>{
    assert.equal(options.rejectUnauthorized,true);
    return request(`http://127.0.0.1:${address.port}`,/** @type {import('node:http').RequestOptions} */(options),callback);
  };
  try{await use(transport);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(()=>resolve(undefined)));}
}
test('bounded source transport reads real socket bytes and rejects caller destinations',async()=>{
  await endpoint((_req,res)=>res.end('{"ok":true}'),async requestImpl=>{
    const result=await fetchAuditSource(sources.schedule,{requestImpl});assert.deepEqual(result.data,{ok:true});assert.equal(result.sha256.length,64);assert.equal(result.bytes,11);
    await assert.rejects(fetchAuditSource('https://attacker.invalid',{requestImpl}),/invalid_source/);
  });
});
test('source redirects, errors, encoding and stale/future HTTP freshness fail closed',async()=>{
  for(const kind of ['redirect','error','encoded','stale','future','age','missing_date','empty']){
    let calls=0;
    await endpoint((_req,res)=>{
      calls++;
      if(kind==='redirect'){res.statusCode=302;res.setHeader('Location','http://127.0.0.1:1');}
      if(kind==='error')res.statusCode=500;
      if(kind==='encoded')res.setHeader('Content-Encoding','gzip');
      if(kind==='stale')res.setHeader('Date','Thu, 01 Jan 1970 00:00:00 GMT');
      if(kind==='future')res.setHeader('Date','Thu, 01 Jan 2099 00:00:00 GMT');
      if(kind==='age')res.setHeader('Age','86401');
      if(kind==='missing_date')res.sendDate=false;
      if(kind==='empty'){res.end();return;}
      res.end('{}');
    },async requestImpl=>{await assert.rejects(fetchAuditSource(sources.schedule,{requestImpl}));assert.equal(calls,1);});
  }
});
test('source size limits apply to declared and chunked bytes; hanging/truncated streams cancel',async()=>{
  for(const kind of ['declared','chunked','hanging','truncated']){
    await endpoint((_req,res)=>{
      if(kind==='declared'){res.setHeader('Content-Length',262145);res.end('{}');}
      if(kind==='chunked'){res.write(Buffer.alloc(131072,32));res.end(Buffer.alloc(131073,32));}
      if(kind==='truncated'){res.writeHead(200,{'Content-Length':100});res.write('{}');res.socket?.destroy();}
    },async requestImpl=>{await assert.rejects(fetchAuditSource(sources.schedule,{requestImpl,timeoutMs:100}));});
  }
});
test('actual worker parser rejects duplicate JSON keys, malformed bytes and nested excess',async()=>{
  for(const body of [Buffer.from('{"x":1,"x":2}'),Buffer.from([0xc3,0x28]),Buffer.from('['.repeat(17)+'0'+']'.repeat(17)),Buffer.from('not-json')]){
    await endpoint((_req,res)=>res.end(body),async requestImpl=>{await assert.rejects(fetchAuditSource(sources.schedule,{requestImpl}));});
  }
});
test('transport setup failures and invalid budgets fail without exposing exception content',async()=>{
  await assert.rejects(fetchAuditSource(sources.security,{requestImpl:()=>{throw new Error('SECRET_CANARY');}}),error=>error instanceof Error && error.message==='Runtime audit unavailable: transport_error');
  for(const timeoutMs of [0,-1,10001,Infinity,NaN,0.5]) await assert.rejects(fetchAuditSource(sources.security,{timeoutMs}),/invalid_source/);
});
test('CLI rejects a caller-selected runtime before fetching and reports no passing result',()=>{
  const result=spawnSync(process.execPath,['scripts/audit-node.mjs','--version=99.0.0'],{encoding:'utf8',timeout:5000});
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/No passing result/);
});
