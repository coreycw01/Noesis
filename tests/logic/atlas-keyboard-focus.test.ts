import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasFocusPan } from '../../src/components/Atlas/atlas-keyboard-focus';

const viewport = { left: 100, right: 500, top: 50, bottom: 350 };

test('keyboard focus reveals a clipped node without moving already visible nodes', () => {
  assert.deepEqual(atlasFocusPan(viewport, { left: 125, right: 200, top: 80, bottom: 120 }), { x: 0, y: 0 });
  assert.deepEqual(atlasFocusPan(viewport, { left: 70, right: 150, top: 300, bottom: 365 }), { x: 42, y: -27 });
  assert.deepEqual(atlasFocusPan(viewport, { left: 520, right: 600, top: 0, bottom: 40 }), { x: -112, y: 62 });
});

test('oversized focus targets are centered instead of oscillating between edges', () => {
  assert.deepEqual(atlasFocusPan(viewport, { left: 0, right: 500, top: 80, bottom: 120 }), { x: 50, y: 0 });
});
