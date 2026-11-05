import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { displayName, filterFeed, feed, themeValue } from '../demo/model.js';
import { createDemoServer, loadAssets, assetNames, csp } from '../scripts/demo-server.mjs';

test('feed filters match title/source/id, reject invalid bounds and treat attacks as text', () => {
  assert.equal(filterFeed(feed, '', 'All').length, 4);
  assert.equal(filterFeed(feed, ' HARBOR ', 'Vulnerability')[0].id, feed[0].id);
  assert.equal(filterFeed(feed, 'Cedar Trust', 'Vendor incident').length, 1);
  assert.equal(filterFeed(feed, '0142', 'All').length, 1);
  assert.equal(filterFeed(feed, 'Harbor', 'Correction').length, 0);
  for (const value of [null, {}, 'a'.repeat(161), '<img src=x onerror=alert(1)>', '.*']) assert.deepEqual(filterFeed(feed, value, 'All'), []);
  assert.deepEqual(filterFeed(feed, '', '__proto__'), []);
  assert.deepEqual(filterFeed(feed, 'a'.repeat(160), 'All'), []);
});

test('display fallback never trusts unverified email or malformed claims', () => {
  assert.equal(displayName({name:' Alex ',preferred_username:'alias'}),'Alex');
  assert.equal(displayName({name:{},preferred_username:'alias'}),'alias');
  assert.equal(displayName({email:'example@example.test',email_verified:true}),'example@example.test');
  for (const claims of [{}, {name:''}, {name:'a'.repeat(121)}, {name:'bad\nname'}, {email:'example@example.test'}, {email:'example@example.test',email_verified:'true'}]) assert.equal(displayName(claims),'Signed-in user');
});

test('theme preferences form a closed vocabulary', () => {
  assert.equal(themeValue('dark'),'dark'); assert.equal(themeValue('light'),'light');
  for(const value of ['system',null,undefined,{},'Dark','__proto__','<script>']) assert.equal(themeValue(value),'system');
});

test('missing build fails closed before starting a server', async () => {
  const dir = await mkdtemp(join(tmpdir(),'dread-demo-test-'));
  try { await assert.rejects(loadAssets(pathToFileURL(`${dir}/`))); }
  finally { await rm(dir,{recursive:true,force:true}); }
});

test('real loopback HTTP boundary serves only built public assets', async t => {
  const assets = await loadAssets(new URL('../dist-demo/',import.meta.url));
  const server = createDemoServer(assets);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const port = address.port;
  /** @param {string} path @param {string} [method] @param {Record<string,string|undefined>} [headers] */
  const call = (path, method='GET', headers={}) => new Promise((resolve,reject) => {
    const req = request({host:'127.0.0.1',port,path,method,headers},res => {
      let body='';res.setEncoding('utf8');res.on('data',chunk => { body+=chunk; });
      res.on('error',reject); res.on('end',() => resolve({status:res.statusCode,headers:res.headers,body}));
    });req.on('error',reject);req.end();
  });
  const get = await call('/'); assert.equal(get.status,200);assert.match(get.body,/interactive demo/);
  assert.equal(get.headers['content-security-policy'],csp); assert.equal(get.headers['cache-control'],'no-store');assert.equal(get.headers['x-content-type-options'],'nosniff');
  const head = await call('/','HEAD'); assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(head.headers['content-length'],get.headers['content-length']);
  for(const path of ['/app.js','/app.css','/theme.js','/logo.svg','/NOTICES.txt','/fonts/Atkinson-Regular.woff2']) assert.equal((await call(path)).status,200);
  for(const path of ['/../package.json','/%2e%2e/AGENTS.md','/package.json','/.env','/demo/app.jsx','/app.js.map','//app.js','/app.js?x=1','/%00','/api/repositories','/fonts/../../SECURITY.md']) {
    const result=await call(path);assert.equal(result.status,404,path);assert.equal(result.body,'Demo request unavailable');
  }
  for(const method of ['POST','PUT','DELETE','PATCH','OPTIONS']) { const result=await call('/',method);assert.equal(result.status,405);assert.equal(result.headers.allow,'GET, HEAD'); }
  for(const headers of [{host:'attacker.test'}, {host:`localhost:${port}`}, {origin:'https://attacker.test'}, {'sec-fetch-site':'cross-site'}]) assert.equal((await call('/','GET',headers)).status,400);
  assert.equal(server.maxConnections,32);assert.equal(server.maxRequestsPerSocket,100);
});

test('built artifact excludes sources, remote loads and inline code; fonts are local',async () => {
  const root=new URL('../dist-demo/',import.meta.url);
  const html=await readFile(new URL('index.html',root),'utf8');
  assert.doesNotMatch(html,/<script[^>]*>\s*[^<\s]/i);
  assert.doesNotMatch(html,/(?:src|href)=["']https?:/i);
  const css=await readFile(new URL('app.css',root),'utf8');
  assert.doesNotMatch(css,/url\(["']?https?:/i);assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/focus-visible/);assert.match(css,/overflow-wrap:anywhere/);
  const entries=await readdir(root);assert.ok(entries.every(name => ['fonts',...assetNames].includes(name)));
  const app=await readFile(new URL('app.js',root),'utf8');
  assert.doesNotMatch(app,/sourceMappingURL|DREAD_SECRET_CANARY|react\.development\.js/);
  const notices=await readFile(new URL('NOTICES.txt',root),'utf8');assert.match(notices,/SIL OPEN FONT LICENSE/i);assert.match(notices,/Meta Platforms/);
});
