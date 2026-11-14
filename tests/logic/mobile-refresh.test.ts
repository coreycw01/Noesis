import assert from 'node:assert/strict';
import test from 'node:test';
import { mobilePullDistance, shouldRefreshFromPull } from '../../src/lib/mobile-refresh';

test('pull to refresh clears its distance when the finger reverses direction', () => {
  assert.equal(shouldRefreshFromPull(mobilePullDistance(0, 160, true)!, true, false), true);
  assert.equal(mobilePullDistance(0, -5, true), 0);
  assert.equal(shouldRefreshFromPull(0, true, false), false);
});

test('horizontal pulls, scroll position, cancellation and save blocking cannot refresh', () => {
  assert.equal(mobilePullDistance(50, 15, true), null);
  assert.equal(mobilePullDistance(0, 160, false), null);
  assert.equal(shouldRefreshFromPull(80, false, false), false);
  assert.equal(shouldRefreshFromPull(80, true, true), false);
});
