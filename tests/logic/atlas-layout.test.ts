import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasAutoNodePosition, atlasViewportOffset } from '../../src/components/Atlas/atlas-layout';

test('desktop Atlas layouts use the full map instead of one quadrant', () => {
  const positions = Array.from({ length: 8 }, (_, index) => atlasAutoNodePosition(index, 8));
  const xs = positions.map((position) => position.x);
  const ys = positions.map((position) => position.y);

  assert.ok(Math.min(...xs) <= 10);
  assert.ok(Math.max(...xs) >= 90);
  assert.ok(Math.min(...ys) <= 12);
  assert.ok(Math.max(...ys) >= 88);
});

test('mobile Atlas layouts span both columns and most of the canvas height', () => {
  const positions = Array.from({ length: 8 }, (_, index) => atlasAutoNodePosition(index, 8, true));
  const xs = positions.map((position) => position.x);
  const ys = positions.map((position) => position.y);

  assert.deepEqual([...new Set(xs)].sort((left, right) => left - right), [24, 76]);
  assert.equal(Math.min(...ys), 18);
  assert.equal(Math.max(...ys), 86);
});

test('Atlas zoom remains centered in the viewport', () => {
  assert.deepEqual(atlasViewportOffset(1000, 600, 0.8, 0.8), { x: 0, y: 0 });
  assert.deepEqual(atlasViewportOffset(1000, 600, 0.4, 0.8), { x: 250, y: 150 });
  const enlarged = atlasViewportOffset(1000, 600, 1.2, 0.8);
  assert.ok(Math.abs(enlarged.x + 250) < 0.0001);
  assert.ok(Math.abs(enlarged.y + 150) < 0.0001);
});
