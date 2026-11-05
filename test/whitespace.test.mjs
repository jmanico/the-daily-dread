import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkWhitespace } from '../scripts/check-whitespace.mjs';

/** @param {import('node:test').TestContext} t */
async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), 'dread-whitespace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const empty = join(root, 'empty-hooks'); await mkdir(empty);
  /** @param {string[]} args */
  const git = args => execFileSync('git', ['-c', `core.hooksPath=${empty}`, '-c', 'commit.gpgSign=false',
    '-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
  { cwd: root, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '-q', '-b', 'main']);
  await writeFile(join(root, 'file.txt'), 'base\n'); git(['add', 'file.txt']); git(['commit', '-qm', 'base']);
  const base = git(['rev-parse', 'HEAD']); git(['update-ref', 'refs/remotes/origin/main', base]);
  return { root, git, base };
}

test('committed whitespace is rejected even when the checkout is clean and the tip commit is unrelated', async t => {
  const { root, git, base } = await repository(t);
  await writeFile(join(root, 'file.txt'), 'base\nsynthetic-private-marker-5792  \n');
  git(['add', 'file.txt']); git(['commit', '-qm', 'bad whitespace']);
  await writeFile(join(root, 'other.txt'), 'unrelated\n'); git(['add', 'other.txt']); git(['commit', '-qm', 'later commit']);
  assert.equal(git(['status', '--porcelain']), '');
  assert.equal(git(['diff', '--check']), ''); // Reproduces the old vacuous CI check.
  for (const input of [base, '', '0'.repeat(40)]) {
    assert.throws(() => checkWhitespace(root, input), error => error instanceof Error &&
      error.message === 'Committed whitespace check failed or comparison history is unavailable' &&
      !JSON.stringify(error).includes('synthetic-private-marker'));
  }
  await writeFile(join(root, 'file.txt'), 'base\ncorrected\n'); git(['add', 'file.txt']); git(['commit', '-qm', 'correct whitespace']);
  for (const input of [base, '', '0'.repeat(40)]) assert.deepEqual(checkWhitespace(root, input), { base, head: git(['rev-parse', 'HEAD']) });
});

test('invalid or unavailable comparison history fails without executing supplied text', async t => {
  const { root, git, base } = await repository(t);
  for (const input of [undefined, null, {}, [], '--output=owned', 'HEAD', 'main..HEAD', 'a'.repeat(39), base + '\n', '$(touch owned)']) {
    assert.throws(() => checkWhitespace(root, input), /Invalid whitespace comparison base/);
  }
  assert.throws(() => checkWhitespace(root, 'f'.repeat(40)), /comparison history/);
  git(['update-ref', '-d', 'refs/remotes/origin/main']);
  assert.throws(() => checkWhitespace(root, ''), /comparison history/);
  assert.throws(() => checkWhitespace(root, '0'.repeat(40)), /comparison history/);
  assert.deepEqual(checkWhitespace(root, base), { base, head: base });
});
