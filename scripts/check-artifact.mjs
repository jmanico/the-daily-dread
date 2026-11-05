import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assetNames } from './demo-server.mjs';

/** @param {NodeJS.ProcessEnv} environment */
export function secretCanaries(environment) {
  return Object.entries(environment)
    .filter(([name,value])=> /(?:SECRET|PASSWORD|TOKEN|PRIVATE_KEY|CREDENTIAL|CANARY)/i.test(name) && value && Buffer.byteLength(value)>=8)
    .map(([,value])=>String(value));
}

/** Inspect every emitted byte before publishing a build. Never include matched data in errors.
 * @param {string} directory @param {string[]} canaries
 */
export async function checkArtifact(directory, canaries) {
  const remaining = new Set(assetNames);
  let total = 0;
  /** @param {string} path @param {string} prefix */
  async function visit(path, prefix) {
    for (const name of await readdir(path)) {
      const entry = join(path,name);
      const relative = prefix+name;
      const info = await lstat(entry);
      if (info.isDirectory() && relative === 'fonts') { await visit(entry,'fonts/'); continue; }
      if (!info.isFile() || !remaining.delete(relative)) throw new Error('Unexpected artifact entry');
      total += info.size;
      if (info.size > 2*1024*1024 || total > 16*1024*1024) throw new Error('Artifact byte budget exceeded');
      const bytes = await readFile(entry);
      const contents = bytes.toString('utf8');
      if (canaries.some(value=>value.length > 0 && bytes.includes(Buffer.from(value)))) throw new Error('Artifact secret canary detected');
      if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/.test(contents)) throw new Error('Artifact credential pattern detected');
      if (relative.endsWith('.js') && /sourceMappingURL=/.test(contents)) throw new Error('Artifact source map reference detected');
    }
  }
  if (!(await lstat(directory)).isDirectory()) throw new Error('Artifact directory required');
  await visit(directory,'');
  if (remaining.size) throw new Error('Required artifact missing');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await checkArtifact(resolve('dist-demo'),secretCanaries(process.env));
    console.log('Artifact allowlist, budget and secret checks passed.');
  } catch {
    console.error('Artifact verification failed.');
    process.exitCode = 1;
  }
}
