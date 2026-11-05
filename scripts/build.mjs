import { build } from 'esbuild';
import { mkdir, mkdtemp, readFile, writeFile, copyFile, readdir, rm, rename, lstat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { checkArtifact, secretCanaries } from './check-artifact.mjs';

/** Build only the implemented presentation surface. No production service is implied.
 * Publish only a complete verified artifact; preserve the previous build on failure.
 * @param {string} root @param {AbortSignal} [signal]
 */
export async function buildDemo(root, signal) {
  const lock = join(root,'.build-lock');
  await mkdir(lock); // Concurrent builds fail closed before changing any artifact.
  let stage = '';
  let previous = '';
  let published = false;
  const out = join(root,'dist-demo');
  try {
    signal?.throwIfAborted();
    stage = await mkdtemp(join(root,'.build-stage-'));
    await build({ absWorkingDir: root, entryPoints: { app: 'demo/app.jsx', theme: 'demo/theme.js' }, outdir: stage, bundle: true, minify: true, sourcemap: false, platform: 'browser', format: 'iife', target: ['es2022'], jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof', logLevel: 'silent' });
    await copyFile(join(root,'demo/index.html'),join(stage,'index.html'));
    await copyFile(join(root,'demo/style.css'),join(stage,'app.css'));
    await copyFile(join(root,'logo.svg'),join(stage,'logo.svg'));
    await mkdir(join(stage,'fonts'));
    for (const name of await readdir(join(root,'demo/fonts'))) {
      if (name.endsWith('.woff2')) await copyFile(join(root,'demo/fonts',name),join(stage,'fonts',name));
    }
    let notices = await readFile(join(root,'LICENSE'),'utf8');
    for (const name of ['react','react-dom','scheduler']) notices += `\n\n${name}\n${await readFile(join(root,'node_modules',name,'LICENSE'),'utf8')}`;
    for (const name of ['atkinson','source-serif','plex']) notices += `\n\n${name}\n${await readFile(join(root,`demo/fonts/${name}-LICENSE.txt`),'utf8')}`;
    await writeFile(join(stage,'NOTICES.txt'),notices);
    await checkArtifact(stage,secretCanaries(process.env));
    signal?.throwIfAborted();
    let exists = false;
    try {
      const info = await lstat(out);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid build destination');
      exists = true;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    if (exists) {
      previous = join(lock,'previous');
      await rename(out,previous);
    }
    try {
      signal?.throwIfAborted();
      await rename(stage,out);
      published = true;
      stage = '';
    } catch (error) {
      if (previous) { await rename(previous,out); previous = ''; }
      throw error;
    }
  } finally {
    if (stage) await rm(stage,{recursive:true,force:true});
    // A failed restore preserves the recovery copy for operator inspection.
    if (!previous || published) await rm(lock,{recursive:true,force:true});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  try {
    await buildDemo(fileURLToPath(new URL('../',import.meta.url)),controller.signal);
    console.log('Built verified local presentation demo; no production service built.');
  } catch {
    console.error('Build failed; no partial artifact published.');
    process.exitCode = 1;
  } finally {
    process.off('SIGINT',stop);
    process.off('SIGTERM',stop);
  }
}
