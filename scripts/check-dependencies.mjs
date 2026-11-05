import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Actual reviewed demo graph. Changes require NFR-5 evidence, not an automatic update.
const reviewedGraph = '6d70d5af747950e5a20a72bec9cad66691332a81dcf67d84d39457a748dd9095';
const approved = new Map([
  ['react','19.3.1'],['react-dom','19.3.1'],['@types/node','26.6.6'],
  ['@types/react','19.3.0'],['@types/react-dom','19.3.0'],
  ['esbuild','0.28.2'],['typescript','7.0.2'],
  ['fastify','5.12.8'],['jsonc-parser','3.3.1'],['semver','7.8.6'],
]);

/** @param {unknown} value @returns {value is Record<string,unknown>} */
function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }

/** @param {unknown} manifest @param {unknown} lock @param {string} npmrc */
export function validateDependencies(manifest, lock, npmrc) {
  if (!record(manifest) || !record(lock) || !record(lock.packages) || !record(lock.packages[''])) throw new Error('Invalid dependency records');
  if (manifest.private !== true || lock.lockfileVersion !== 3 || manifest.name !== lock.name || manifest.version !== lock.version) throw new Error('Invalid private package lock');
  if (manifest.overrides || manifest.resolutions || manifest.optionalDependencies || manifest.peerDependencies) throw new Error('Unreviewed dependency configuration');
  if (npmrc.trim() !== 'ignore-scripts=true\nsave-exact=true') throw new Error('Unsafe npm configuration');
  if (!record(manifest.scripts) || Object.keys(manifest.scripts).some(name=>/^(?:pre|post|install|prepare)/.test(name))) throw new Error('Unreviewed lifecycle script');
  const seen = new Set();
  const packages = lock.packages;
  const lockedRoot = packages[''];
  if (!record(lockedRoot)) throw new Error('Invalid lock root');
  for (const field of ['dependencies','devDependencies']) {
    const group = manifest[field];
    const lockedGroup = lockedRoot[field];
    if (!record(group) || !record(lockedGroup)) throw new Error('Missing dependency group');
    const values = Object.entries(group).sort();
    if (JSON.stringify(values) !== JSON.stringify(Object.entries(lockedGroup).sort())) throw new Error('Manifest and lock disagree');
    for (const [name,version] of values) {
      if (seen.has(name)) throw new Error('Duplicate dependency ownership');
      seen.add(name);
      if (approved.get(name) !== version) throw new Error('Unreviewed direct dependency');
      const resolvedPackage = packages[`node_modules/${name}`];
      if (!record(resolvedPackage) || resolvedPackage.version !== version) throw new Error('Unresolved direct dependency');
    }
  }
  if (seen.size !== approved.size) throw new Error('Reviewed dependency set changed');
  const rows = Object.entries(lock.packages).filter(([name])=>name).sort(([a],[b])=>a.localeCompare(b,'en')).map(([name,pkg])=> {
    if (!record(pkg) || pkg.link || typeof pkg.resolved !== 'string' || !pkg.resolved.startsWith('https://registry.npmjs.org/') || typeof pkg.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+=*$/.test(pkg.integrity)) throw new Error('Untrusted lock artifact');
    return [name,pkg.version,pkg.resolved,pkg.integrity];
  });
  if (createHash('sha256').update(JSON.stringify(rows)).digest('hex') !== reviewedGraph) throw new Error('Dependency graph requires review');
}

/** @param {string} root */
export async function checkDependencies(root) {
  const manifest = JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const lock = JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
  validateDependencies(manifest,lock,await readFile(join(root,'.npmrc'),'utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await checkDependencies(resolve('.')); console.log('Reviewed dependency graph and install policy passed.'); }
  catch { console.error('Dependency policy verification failed.'); process.exitCode = 1; }
}
