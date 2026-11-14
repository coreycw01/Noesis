import assert from 'node:assert/strict';
import test from 'node:test';
import { appearanceSnapshot, workspaceScrollBehavior, persistAppearanceSettings, readPersistedAppearanceSettings, type AppearanceSnapshot } from '../../src/lib/appearance';

test('manual and system reduced motion both disable animated scrolling', () => {
  assert.equal(workspaceScrollBehavior(false, false), 'smooth');
  assert.equal(workspaceScrollBehavior(true, false), 'instant');
  assert.equal(workspaceScrollBehavior(false, true), 'instant');
  assert.equal(workspaceScrollBehavior(true, true), 'instant');
});

test('blocked browser storage still notifies the current workspace of saved appearance', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const appearance: AppearanceSnapshot = {
    themeMode: 'system', accentTheme: 'violet', headerFont: 'editorial', fontSize: 'md',
    interfaceShape: 'pills', defaultCollectionView: 'cards', reducedMotion: true, highContrastMode: false,
  };
  const events: Event[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { get localStorage() { throw new Error('Blocked'); }, dispatchEvent: (event: Event) => events.push(event) },
  });
  try {
    const saved = { ...appearance, dateUpdated: '2026-11-13', ownerId: 'private' };
    assert.doesNotThrow(() => persistAppearanceSettings(appearanceSnapshot(saved)));
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'noesis:appearance-change');
    assert.deepEqual((events[0] as CustomEvent).detail, appearance);
    assert.deepEqual(readPersistedAppearanceSettings(), appearance);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
