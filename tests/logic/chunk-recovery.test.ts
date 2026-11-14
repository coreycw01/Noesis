import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { CHUNK_RECOVERY_SCRIPT } from '../../src/lib/chunk-recovery';

function runRecovery({ open = false, online = true, blockedStorage = false, previous = '' } = {}) {
  const handlers = new Map<string, (event: object) => void>();
  let reloads = 0;
  const notice = { hidden: true };
  runInNewContext(CHUNK_RECOVERY_SCRIPT, {
    URL,
    Date: { now: () => 50_000 },
    document: {
      readyState: 'complete',
      querySelector: () => open ? {} : null,
      getElementById: () => notice,
    },
    window: {
      navigator: { onLine: online },
      location: { origin: 'https://noesis.example', href: 'https://noesis.example/home/', reload: () => { reloads += 1; } },
      sessionStorage: { getItem: () => previous, setItem: () => { if (blockedStorage) throw new Error('Storage disabled'); } },
      addEventListener: (name: string, handler: (event: object) => void) => handlers.set(name, handler),
    },
  });
  return { dispatch: (name: string, event: object) => handlers.get(name)?.(event), reloads: () => reloads, notice };
}

test('startup retries a same-origin app script once, but ignores unrelated resource failures', () => {
  const run = runRecovery();
  for (const target of [
    { tagName: 'IMG', src: '/cover.jpg' },
    { tagName: 'SCRIPT', src: 'https://example.org/_next/static/chunks/main.js' },
  ]) run.dispatch('error', { target });
  assert.equal(run.reloads(), 0);
  run.dispatch('error', { target: { tagName: 'SCRIPT', src: '/_next/static/chunks/main.js' } });
  run.dispatch('unhandledrejection', { reason: new Error('ChunkLoadError') });
  assert.equal(run.reloads(), 1);
});

test('startup recovery cannot reload an open workspace, an offline page or an unguarded tab', () => {
  for (const options of [{ open: true }, { online: false }, { blockedStorage: true }, { previous: '49000' }]) {
    const run = runRecovery(options);
    run.dispatch('unhandledrejection', { reason: new Error('Loading chunk 123 failed') });
    assert.equal(run.reloads(), 0);
    assert.equal(run.notice.hidden, Boolean('open' in options && options.open));
  }
});
