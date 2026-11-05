import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gitOptions = ['--no-lazy-fetch', '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'diff.external=',
  '-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab'];
const zero = '0'.repeat(40);
/** Inspect committed changes, including a PR checkout's merge result. No shell,
 * network fetch, working-tree filters, text conversion or external diff helper.
 * Missing history fails instead of falling back to an empty working-tree diff.
 * @param {string} root @param {unknown} suppliedBase */
export function checkWhitespace(root, suppliedBase) {
  if (typeof suppliedBase !== 'string' || suppliedBase !== '' && !/^[a-f0-9]{40}$/.test(suppliedBase)) throw new Error('Invalid whitespace comparison base');
  /** @param {string[]} args */
  const git = args => execFileSync('git', [...gitOptions, ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  }).trim();
  try {
    // A new branch has no push predecessor. This repository's fixed default
    // branch is main; checkout fetch-depth: 0 makes its remote ref available.
    const base = git(['rev-parse', '--verify', `${suppliedBase === '' || suppliedBase === zero ? 'refs/remotes/origin/main' : suppliedBase}^{commit}`]);
    const head = git(['rev-parse', '--verify', 'HEAD^{commit}']);
    if (![base, head].every(value => /^[a-f0-9]{40}$/.test(value))) throw new Error('Invalid commit identity');
    git(['diff', '--check', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', base, head, '--']);
    return { base, head };
  } catch { throw new Error('Committed whitespace check failed or comparison history is unavailable'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('One comparison base is required');
    const result = checkWhitespace(resolve('.'), process.argv[2]);
    console.log(`Committed whitespace check passed: ${result.base}..${result.head}`);
  } catch {
    console.error('Committed whitespace check failed; inspect the supplied commit range and available history.');
    process.exitCode = 1;
  }
}
