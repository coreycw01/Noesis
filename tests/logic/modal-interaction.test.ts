import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseStaleModalInteractionLock } from '../../src/lib/modal-interaction';

test('releases a stale pointer lock throughout the modal close animation', () => {
  const scheduled: Array<() => void> = [];
  const removed: string[] = [];
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  Object.assign(globalThis, {
    window: {
      queueMicrotask: (callback: () => void) => scheduled.push(callback),
      requestAnimationFrame: (callback: () => void) => {
        scheduled.push(callback);
        return 1;
      },
      setTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return 1;
      },
    },
    document: {
      querySelector: () => null,
      body: { style: { removeProperty: (property: string) => removed.push(`body:${property}`) } },
      documentElement: { style: { removeProperty: (property: string) => removed.push(`html:${property}`) } },
    },
  });

  try {
    releaseStaleModalInteractionLock();
    assert.equal(scheduled.length, 5);
    scheduled.forEach((callback) => callback());
    assert.equal(removed.filter((value) => value === 'body:pointer-events').length, 5);
    assert.equal(removed.filter((value) => value === 'html:pointer-events').length, 5);
  } finally {
    Object.assign(globalThis, { window: originalWindow, document: originalDocument });
  }
});

test('preserves the pointer lock while another modal layer remains open', () => {
  const scheduled: Array<() => void> = [];
  let removeCount = 0;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  Object.assign(globalThis, {
    window: {
      queueMicrotask: (callback: () => void) => scheduled.push(callback),
      requestAnimationFrame: (callback: () => void) => {
        scheduled.push(callback);
        return 1;
      },
      setTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return 1;
      },
    },
    document: {
      querySelector: () => ({ role: 'dialog' }),
      body: { style: { removeProperty: () => { removeCount += 1; } } },
      documentElement: { style: { removeProperty: () => { removeCount += 1; } } },
    },
  });

  try {
    releaseStaleModalInteractionLock();
    scheduled.forEach((callback) => callback());
    assert.equal(removeCount, 0);
  } finally {
    Object.assign(globalThis, { window: originalWindow, document: originalDocument });
  }
});
