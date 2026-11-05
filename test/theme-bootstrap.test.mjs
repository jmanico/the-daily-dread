import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../dist-demo/theme.js', import.meta.url), 'utf8');
const key = 'dread-demo-theme';

/** Exercise the actual built bootstrap with controlled browser API failures.
 * This executes trusted project code only; VM is not a security sandbox or a browser.
 * @param {{saved?: unknown, dark?: boolean, denied?: 'access'|'read'|'write'}} [options]
 */
function page(options = {}) {
  const document = { documentElement: { dataset: { theme: '' } } };
  const media = Object.assign(new EventTarget(), { matches: options.dark ?? false });
  const window = Object.assign(new EventTarget(), {
    matchMedia(/** @type {string} */ query) {
      assert.equal(query, '(prefers-color-scheme: dark)');
      return media;
    }
  });
  /** @type {Array<[string, string]>} */
  const writes = [];
  const storage = {
    getItem(/** @type {string} */ name) {
      assert.equal(name, key);
      if (options.denied === 'read') throw new DOMException('Synthetic denial', 'SecurityError');
      return options.saved ?? null;
    },
    setItem(/** @type {string} */ name, /** @type {string} */ value) {
      if (options.denied === 'write') throw new DOMException('Synthetic quota', 'QuotaExceededError');
      writes.push([name, value]);
    }
  };
  const context = {
    window, document, CustomEvent,
    get localStorage() {
      if (options.denied === 'access') throw new DOMException('Synthetic denial', 'SecurityError');
      return storage;
    }
  };
  runInNewContext(source, context, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return {
    theme: () => document.documentElement.dataset.theme,
    writes,
    system: (/** @type {boolean} */ dark) => { media.matches = dark; media.dispatchEvent(new Event('change')); },
    choose: (/** @type {unknown} */ detail) => window.dispatchEvent(new CustomEvent(key, { detail })),
    storage: (/** @type {string|null} */ name, /** @type {string|null} */ value) => window.dispatchEvent(Object.assign(new Event('storage'), { key: name, newValue: value })),
    plainEvent: () => window.dispatchEvent(new Event(key))
  };
}

test('built theme initializes before interaction and follows System without overriding saved choices', () => {
  for (const dark of [false, true]) {
    for (const saved of [null, 'system', 'light', 'dark', '__proto__', '<script>', {}]) {
      const app = page({ saved, dark });
      const explicit = saved === 'light' || saved === 'dark';
      assert.equal(app.theme(), explicit ? saved : dark ? 'dark' : 'light');
      app.system(!dark);
      assert.equal(app.theme(), explicit ? saved : dark ? 'light' : 'dark');
      assert.deepEqual(app.writes, []);
    }
  }
});

test('built theme stays usable when storage access, read or write fails', () => {
  for (const denied of /** @type {const} */ (['access', 'read', 'write'])) {
    const app = page({ denied, dark: true });
    assert.equal(app.theme(), 'dark');
    app.choose('light'); assert.equal(app.theme(), 'light');
    app.system(true); assert.equal(app.theme(), 'light');
    app.choose('system'); assert.equal(app.theme(), 'dark');
    app.system(false); assert.equal(app.theme(), 'light');
    if (denied !== 'read') assert.deepEqual(app.writes, []);
  }
});

test('built theme accepts only the closed selection vocabulary and ignores a plain event', () => {
  const app = page({ dark: true });
  app.choose('light'); assert.equal(app.theme(), 'light');
  assert.deepEqual(app.writes, [[key, 'light']]);
  app.plainEvent(); assert.equal(app.theme(), 'light');
  assert.equal(app.writes.length, 1);
  for (const value of [undefined, null, {}, '__proto__', '<img onerror=alert(1)>']) {
    app.choose(value); assert.equal(app.theme(), 'dark');
    assert.deepEqual(app.writes.at(-1), [key, 'system']);
  }
});

test('built theme handles storage updates, removal and clear without echoing a write', () => {
  const app = page({ saved: 'light', dark: true });
  app.storage('unrelated', 'dark'); assert.equal(app.theme(), 'light');
  app.storage(key, 'dark'); assert.equal(app.theme(), 'dark');
  app.storage(key, 'light'); assert.equal(app.theme(), 'light');
  app.storage(key, null); assert.equal(app.theme(), 'dark');
  app.storage(key, 'light');
  app.storage(null, null); assert.equal(app.theme(), 'dark');
  app.storage(key, '<script>'); assert.equal(app.theme(), 'dark');
  assert.deepEqual(app.writes, []);
});
