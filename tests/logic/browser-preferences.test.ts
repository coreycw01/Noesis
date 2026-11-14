import assert from 'node:assert/strict';
import test from 'node:test';
import { readBrowserPreference, workspacePreferenceKey, writeBrowserPreference } from '../../src/lib/browser-preferences';

test('optional preferences cannot throw when storage access is blocked', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get localStorage() { throw new Error('Blocked'); },
      get sessionStorage() { throw new Error('Blocked'); },
    },
  });
  try {
    assert.equal(readBrowserPreference('sidebar'), null);
    assert.equal(readBrowserPreference('drafts', 'sessionStorage'), null);
    assert.doesNotThrow(() => writeBrowserPreference('sidebar', 'true'));
    assert.doesNotThrow(() => writeBrowserPreference('demo', 'true', 'sessionStorage'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('tab preferences do not get written to persistent browser storage', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage(local), sessionStorage: storage(session) },
  });
  try {
    writeBrowserPreference('demo', 'true', 'sessionStorage');
    assert.equal(readBrowserPreference('demo', 'sessionStorage'), 'true');
    assert.equal(readBrowserPreference('demo'), null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('workspace preferences do not share account or demo activity', () => {
  assert.equal(workspacePreferenceKey(null, 'last-visit'), null);
  assert.notEqual(workspacePreferenceKey('owner:account', 'last-visit'), workspacePreferenceKey('owner:demo', 'last-visit'));
  assert.notEqual(workspacePreferenceKey('owner:account', 'last-visit'), workspacePreferenceKey('other:account', 'last-visit'));
});
