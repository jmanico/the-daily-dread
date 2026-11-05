import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRuntime } from '../scripts/check-runtime.mjs';
import { validateDependencies } from '../scripts/check-dependencies.mjs';
import { checkArtifact, secretCanaries } from '../scripts/check-artifact.mjs';
import { assetNames } from '../scripts/demo-server.mjs';
import { buildDemo } from '../scripts/build.mjs';

/** @param {import('node:test').TestContext} t */
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(),'dread-build-guard-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'demo'));
  await writeFile(join(root,'jsconfig.json'),JSON.stringify({compilerOptions:{allowJs:true,checkJs:true,noEmit:true,target:'ES2023',module:'ESNext',jsx:'preserve'},include:['demo/**/*']}));
  return root;
}

test('runtime guard accepts owned work and approved imports in the actual checked source', async () => {
  assert.deepEqual(await checkRuntime(process.cwd()),[]);
});

test('real compiler rejects unsafe syntax patterns without printing fixture data', async t => {
  const root = await fixture(t);
  const canary = 'synthetic-private-canary-442971';
  const cases = [
    ['import x from "node:child_process";', 'unapproved-import'],
    ['export * from "node:fs";', 'unapproved-import'],
    ['await import("node:net");', 'dynamic-runtime-import'],
    ['const execute = eval; execute("1");', 'prohibited-runtime-capability'],
    ['const execute = globalThis["Function"];', 'prohibited-runtime-capability'],
    ['const key = "fetch"; window[key]("https://invalid.test");', 'computed-capability-access'],
    ['document.body["innerHTML"] = "unsafe";', 'prohibited-runtime-capability'],
    ['document.body.innerHTML = "unsafe";', 'html-or-code-sink'],
    ['const execute = (()=>{}).constructor;', 'html-or-code-sink'],
    ['const x = <div {...{title:"unsafe"}}/>;', 'jsx-prop-spread'],
    ['process.env.SECRET;', 'runtime-process-access'],
    ['async function work(){} work();', 'unowned-promise'],
    ['async function work(){} void work();', 'unowned-promise'],
    ['async function allowed(){return false;} if(allowed()){}', 'promise-as-decision'],
    ['[1].forEach(async ()=>{await Promise.resolve();});', 'async-for-each'],
    ['try { throw new Error("x"); } catch {}', 'empty-catch'],
    ['setTimeout("unsafe()",1);', 'string-timer'],
    ['export const = ;', 'invalid-runtime-syntax'],
  ];
  for (const [source, rule] of cases) {
    await writeFile(join(root,'demo/case.jsx'),`export {};\n${source}\n// ${canary}\n`);
    const findings = await checkRuntime(root,new Map([['demo/case.jsx',[]]]));
    assert.ok(findings.some(finding=>finding.rule === rule),rule);
    assert.ok(!JSON.stringify(findings).includes(canary));
  }
  await writeFile(join(root,'demo/case.jsx'),'export {}; async function work(){} await work(); function owner(){return work();} const values=[1]; values[0];');
  assert.deepEqual(await checkRuntime(root,new Map([['demo/case.jsx',[]]])),[]);
});

test('new, excluded and linked runtime files cannot evade review', async t => {
  const root = await fixture(t);
  await writeFile(join(root,'demo/new.js'),'export {};');
  assert.ok((await checkRuntime(root)).some(finding=>finding.rule === 'unreviewed-runtime-module'));
  await mkdir(join(root,'src'));
  await writeFile(join(root,'src/excluded.js'),'export {};');
  assert.ok((await checkRuntime(root)).some(finding=>finding.rule === 'unchecked-runtime-file'));
  await symlink(join(root,'demo/new.js'),join(root,'demo/linked.js'));
  await assert.rejects(checkRuntime(root),/symlinks/);
});

test('missing checked configuration fails closed', async t => {
  const root = await fixture(t);
  await writeFile(join(root,'demo/new.js'),'export {};');
  await rm(join(root,'jsconfig.json'));
  await assert.rejects(checkRuntime(root));
});

test('manifest, exact pins, reviewed graph and disabled lifecycle scripts are enforced', async () => {
  const originalManifest = JSON.parse(await readFile('package.json','utf8'));
  const originalLock = JSON.parse(await readFile('package-lock.json','utf8'));
  const config = await readFile('.npmrc','utf8');
  assert.doesNotThrow(()=>validateDependencies(originalManifest,originalLock,config));
  const cases = [
    (/** @type {any} */ manifest)=>{manifest.private=false;},
    (/** @type {any} */ manifest)=>{manifest.dependencies.react='^19.3.1';},
    (/** @type {any} */ manifest)=>{manifest.scripts.postinstall='unsafe';},
    (/** @type {any} */ manifest)=>{manifest.overrides={react:'19.3.0'};},
  ];
  for (const change of cases) { const manifest=structuredClone(originalManifest); change(manifest); assert.throws(()=>validateDependencies(manifest,originalLock,config)); }
  for (const field of ['integrity','resolved','version']) {
    const lock=structuredClone(originalLock);
    lock.packages['node_modules/react'][field]='unexpected';
    assert.throws(()=>validateDependencies(originalManifest,lock,config));
  }
  const lock=structuredClone(originalLock); lock.packages['node_modules/react'].link=true;
  assert.throws(()=>validateDependencies(originalManifest,lock,config));
  assert.throws(()=>validateDependencies(originalManifest,originalLock,'ignore-scripts=false\nsave-exact=true'));
  for (const invalid of [null,[],{},'bad']) assert.throws(()=>validateDependencies(invalid,originalLock,config));
});

test('artifact scan covers every allowed file and rejects extras, links, secrets and bounds', async t => {
  const root=await fixture(t);
  const out=join(root,'artifact'); await mkdir(join(out,'fonts'),{recursive:true});
  for (const name of assetNames) await writeFile(join(out,name),'public fixture');
  await checkArtifact(out,[]);
  const secret='synthetic-build-private-canary-74295';
  assert.deepEqual(secretCanaries({DREAD_SECRET:secret,PATH:'/public',TOKEN:'short'}),[secret]);
  for (const name of ['app.js','NOTICES.txt','fonts/Atkinson-Regular.woff2']) {
    await writeFile(join(out,name),secret);
    await assert.rejects(checkArtifact(out,[secret]),/canary/);
    await writeFile(join(out,name),'public fixture');
  }
  for (const content of ['-----BEGIN PRIVATE KEY-----','ghp_'+'a'.repeat(36),'//# sourceMappingURL=app.js.map','x'.repeat(2*1024*1024+1)]) {
    await writeFile(join(out,'app.js'),content);
    await assert.rejects(checkArtifact(out,[]));
  }
  await writeFile(join(out,'app.js'),'public fixture');
  await writeFile(join(out,'.env'),'unreviewed file');
  await assert.rejects(checkArtifact(out,[]),/Unexpected/);
  await rm(join(out,'.env'));
  await rm(join(out,'app.js'));
  await assert.rejects(checkArtifact(out,[]),/missing/);
  await symlink(join(out,'theme.js'),join(out,'app.js'));
  await assert.rejects(checkArtifact(out,[]),/Unexpected/);
});

test('failed, canceled and competing builds preserve the last valid artifact', async t => {
  const root=await fixture(t);
  const out=join(root,'dist-demo'); await mkdir(out);
  await writeFile(join(out,'marker'),'last complete artifact');
  await writeFile(join(root,'demo/app.jsx'),'export const = ;');
  await writeFile(join(root,'demo/theme.js'),'export {};');
  await assert.rejects(buildDemo(root));
  assert.equal(await readFile(join(out,'marker'),'utf8'),'last complete artifact');
  assert.ok(!(await readdir(root)).some(name=>name.startsWith('.build-')));
  await assert.rejects(buildDemo(root,AbortSignal.abort()));
  assert.equal(await readFile(join(out,'marker'),'utf8'),'last complete artifact');
  await mkdir(join(root,'.build-lock'));
  await assert.rejects(buildDemo(root));
  assert.equal(await readFile(join(out,'marker'),'utf8'),'last complete artifact');
});
