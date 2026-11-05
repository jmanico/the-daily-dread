import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,realpath,mkdir,rm,readFile,writeFile,chmod,lstat,symlink,link,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync,spawnSync } from 'node:child_process';
import { localManifest,prepareWorkspace } from '../src/local/workspace.js';
const uid=process.getuid?.() ?? -1;
const good=()=>({version:1,profile:'local-workstation-v1',origin:'http://127.0.0.1:4173',workspaceRef:'12345678-1234-4234-8234-123456789012',actorRef:'23456789-1234-4234-8234-123456789012',integrations:{oidc:false,github:false,ai:false,delivery:false}});
const signal=()=>new AbortController().signal;
/** @param {import('node:test').TestContext} t */
async function fixture(t){const home=await realpath(await mkdtemp(join(tmpdir(),'dread-local-owner-')));await chmod(home,0o700);t.after(()=>rm(home,{recursive:true,force:true}));return {home,uid};}
/** @param {{home:string,uid:number}} context */
const root=context=>join(context.home,'Library','Application Support','The Daily Dread');

test('local manifest is closed, immutable and cannot enable another origin, profile or integration',()=>{
  const value=localManifest(good());assert.ok(value);assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.integrations));
  for(const change of [{version:'1'},{profile:'hosted'},{origin:'http://0.0.0.0:4173'},{origin:'http://localhost:4173'},{origin:'https://evil.test'},{actorRef:good().workspaceRef},{actorRef:'owner'},{workspaceRef:'x'.repeat(4097)},{raw:'PRIVATE_CANARY'},{integrations:{...good().integrations,ai:true}},{integrations:{...good().integrations,unknown:false}},{integrations:{ai:false}}])assert.equal(localManifest({...good(),...change}),null);
  let accessed=false;const getter=Object.defineProperty(good(),'origin',{get(){accessed=true;return 'PRIVATE_CANARY';}});assert.equal(localManifest(getter),null);assert.equal(accessed,false);
  const nested={...good(),integrations:Object.defineProperty(good().integrations,'ai',{get(){accessed=true;return false;}})};assert.equal(localManifest(nested),null);assert.equal(accessed,false);
});

test('actual local initialization publishes private bounded config once and preserves identity on repeat/check',async t=>{
  const context=await fixture(t);
  assert.equal((await prepareWorkspace(context,false,signal())).kind,'missing');assert.deepEqual(await readdir(context.home),[]);
  const first=await prepareWorkspace(context,true,signal());assert.equal(first.kind,'ready');if(first.kind!=='ready')return;
  assert.equal(first.created,true);assert.equal(first.root,root(context));assert.ok(localManifest(first.manifest));
  const file=join(first.root,'workspace.json'),before=await readFile(file);assert.ok(before.length<=4096);
  assert.equal((await lstat(first.root)).mode&0o7777,0o700);assert.equal((await lstat(file)).mode&0o7777,0o600);assert.equal((await lstat(file)).nlink,1);
  for(const initialize of [true,false]){const next=await prepareWorkspace(context,initialize,signal());assert.equal(next.kind,'ready');if(next.kind==='ready'){assert.equal(next.created,false);assert.deepEqual(next.manifest,first.manifest);}}
  assert.deepEqual(await readFile(file),before);assert.deepEqual(await readdir(first.root),['workspace.json']);
});

test('invalid OS context and cancellation deny before creating any path or invoking accessors',async t=>{
  const context=await fixture(t);let accessed=false;
  const getter=Object.defineProperty({...context},'home',{get(){accessed=true;return context.home;}});
  for(const candidate of [getter,{...context,extra:true},{...context,uid:0},{...context,uid:-1},{...context,uid:1.5},{...context,home:'../relative'},{...context,home:context.home+'/..'},{...context,home:context.home+'\0secret'},{...context,home:'x'.repeat(2049)}])assert.equal((await prepareWorkspace(candidate,true,signal())).kind,'invalid');
  assert.equal(accessed,false);const c=new AbortController();c.abort();assert.equal((await prepareWorkspace(context,true,c.signal)).kind,'canceled');assert.deepEqual(await readdir(context.home),[]);
  assert.equal((await prepareWorkspace({...context,uid:uid+1},true,signal())).kind,'unsafe');assert.deepEqual(await readdir(context.home),[]);
});

test('real directory symlinks, unsafe parent modes and root modes never redirect initialization',async t=>{
  for(const location of ['home','Library','Application Support','The Daily Dread'])await t.test(location,async st=>{
    const context=await fixture(st),outside=await fixture(st);let path=context.home;
    if(location==='home'){const alias=join(outside.home,'alias');await symlink(context.home,alias);assert.equal((await prepareWorkspace({home:alias,uid},true,signal())).kind,'unsafe');}
    else {for(const part of ['Library','Application Support','The Daily Dread']){path=join(path,part);if(part===location){await symlink(outside.home,path);break;}await mkdir(path,{mode:0o700});}assert.equal((await prepareWorkspace(context,true,signal())).kind,'unsafe');}
    assert.deepEqual(await readdir(outside.home),location==='home'?['alias']:[]);
  });
  const context=await fixture(t);await chmod(context.home,0o770);assert.equal((await prepareWorkspace(context,true,signal())).kind,'unsafe');await chmod(context.home,0o700);
  assert.equal((await prepareWorkspace(context,true,signal())).kind,'ready');await chmod(root(context),0o750);assert.equal((await prepareWorkspace(context,false,signal())).kind,'unsafe');
});

test('actual manifest symlink, hardlink, directory and FIFO fail without reading or changing foreign data',async t=>{
  for(const kind of ['symlink','hardlink','directory','fifo'])await t.test(kind,async st=>{
    const context=await fixture(st);await mkdir(root(context),{recursive:true,mode:0o700});const target=join(root(context),'workspace.json');const other=join(context.home,'foreign');await writeFile(other,'PRIVATE_CANARY',{mode:0o600});
    if(kind==='symlink')await symlink(other,target);else if(kind==='hardlink')await link(other,target);else if(kind==='directory')await mkdir(target,{mode:0o700});else execFileSync('mkfifo',['-m','600',target]);
    const result=await prepareWorkspace(context,true,signal());assert.notEqual(result.kind,'ready');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_CANARY|foreign|dread-local-owner/);assert.equal(await readFile(other,'utf8'),'PRIVATE_CANARY');assert.equal((await readdir(root(context))).includes('workspace.pending'),false);
  });
});

test('bounded worker rejects malformed, duplicate, deep, oversized and forged local manifests without overwrite',async t=>{
  const context=await fixture(t);await mkdir(root(context),{recursive:true,mode:0o700});const target=join(root(context),'workspace.json');
  for(const bytes of ['{"version":1,"version":1}','{"raw":"PRIVATE_CANARY"}',JSON.stringify({...good(),origin:'http://evil.test'}),'['.repeat(20)+'0'+']'.repeat(20),' '.repeat(4097),new Uint8Array([255]),'']){
    await writeFile(target,bytes,{mode:0o600});const before=await readFile(target);assert.notEqual((await prepareWorkspace(context,true,signal())).kind,'ready');assert.deepEqual(await readFile(target),before);
  }
  await writeFile(target,JSON.stringify(good()));await chmod(target,0o644);assert.equal((await prepareWorkspace(context,true,signal())).kind,'unsafe');
});

test('concurrent initialization never overwrites identity; interrupted staging fails closed and stays intact',async t=>{
  const context=await fixture(t);const results=await Promise.all(Array.from({length:8},()=>prepareWorkspace(context,true,signal())));
  const successes=results.filter(result=>result.kind==='ready');assert.ok(successes.length>=1);assert.equal(successes.filter(result=>result.created).length,1);
  const final=await prepareWorkspace(context,false,signal());assert.equal(final.kind,'ready');if(final.kind!=='ready')return;
  for(const result of successes)assert.deepEqual(result.manifest,final.manifest);
  const pending=join(root(context),'workspace.pending');await writeFile(pending,'PRIVATE_CANARY',{mode:0o600});
  assert.equal((await prepareWorkspace(context,true,signal())).kind,'incomplete');assert.equal((await prepareWorkspace(context,false,signal())).kind,'incomplete');assert.equal(await readFile(pending,'utf8'),'PRIVATE_CANARY');
});

test('actual command rejects unsupported arguments safely without exposing state or enabling private access',()=>{
  for(const args of [[],['init','PRIVATE_CANARY'],['--home=/PRIVATE_CANARY'],['serve']]){
    const child=spawnSync(process.execPath,['scripts/local-workspace.mjs',...args],{encoding:'utf8'});assert.equal(child.status,1);assert.doesNotMatch(child.stdout+child.stderr,/PRIVATE_CANARY|\/Users\/|workspaceRef|actorRef|Error:|at /);assert.match(child.stderr,/Local workspace unavailable/);
  }
});

test('unavailable storage and cancellation during real setup preserve failure without publishing identity',async t=>{
  const context=await fixture(t);await chmod(context.home,0o500);
  try{assert.equal((await prepareWorkspace(context,true,signal())).kind,'unavailable');}finally{await chmod(context.home,0o700);}
  assert.deepEqual(await readdir(context.home),[]);
  const canceled=new AbortController();const operation=prepareWorkspace(context,true,canceled.signal);canceled.abort();assert.equal((await operation).kind,'canceled');assert.deepEqual(await readdir(context.home),[]);
  await writeFile(join(context.home,'Library'),'PRIVATE_CANARY',{mode:0o600});const result=await prepareWorkspace(context,true,signal());assert.equal(result.kind,'unsafe');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_CANARY/);assert.equal(await readFile(join(context.home,'Library'),'utf8'),'PRIVATE_CANARY');
});
