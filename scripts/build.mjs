import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const out = new URL('dist-demo/', root);
// A demo-only artifact; it does not implement REQ-PLATFORM-022's production CI gates.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({ absWorkingDir: fileURLToPath(root), entryPoints: { app: 'demo/app.jsx', theme: 'demo/theme.js' }, outdir: fileURLToPath(out), bundle: true, minify: true, sourcemap: false, platform: 'browser', format: 'iife', target: ['es2022'], jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof' });
await copyFile(new URL('demo/index.html', root), new URL('index.html', out));
await copyFile(new URL('demo/style.css', root), new URL('app.css', out));
await copyFile(new URL('logo.svg', root), new URL('logo.svg', out));
await mkdir(new URL('fonts/', out), { recursive: true });
for (const name of await readdir(new URL('demo/fonts/', root))) {
  if (name.endsWith('.woff2')) await copyFile(new URL(`demo/fonts/${name}`, root), new URL(`fonts/${name}`, out));
}
let notices = await readFile(new URL('LICENSE', root), 'utf8');
for (const name of ['react', 'react-dom', 'scheduler']) notices += `\n\n${name}\n${await readFile(new URL(`node_modules/${name}/LICENSE`, root), 'utf8')}`;
for (const name of ['atkinson', 'source-serif', 'plex']) notices += `\n\n${name}\n${await readFile(new URL(`demo/fonts/${name}-LICENSE.txt`, root), 'utf8')}`;
await writeFile(new URL('NOTICES.txt', out), notices);
console.log('Built local presentation demo in dist-demo; no production application built.');
