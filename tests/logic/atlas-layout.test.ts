import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasAutoNodePosition, atlasCanDrag, atlasCompactNodes, atlasMapScope, atlasMapTerms, atlasStoredZoom, atlasVisibleNodePosition, atlasZoomPlane } from '../../src/components/Atlas/atlas-layout';

test('inline Atlas reserves touch gestures for page scroll while full screen allows dragging', () => {
  const touch = { pointerType: 'touch', button: 0, isPrimary: true };
  assert.equal(atlasCanDrag(touch, false), false);
  assert.equal(atlasCanDrag(touch, true), true);
  assert.equal(atlasCanDrag({ ...touch, pointerType: 'mouse' }, false), true);
  assert.equal(atlasCanDrag({ ...touch, pointerType: 'pen' }, false), true);
  assert.equal(atlasCanDrag({ ...touch, pointerType: 'mouse', button: 2 }, true), false);
  assert.equal(atlasCanDrag({ ...touch, isPrimary: false }, true), false);
});

test('Atlas fits whole nodes below the toolbar and inside the viewport at supported zooms', () => {
  const node = { width: 152, height: 72 };
  for (const viewport of [{ width: 358, height: 384 }, { width: 960, height: 268 }]) {
    for (const scale of [0.5, 1, 2.125]) {
      for (const original of [{ x: 8, y: 10 }, { x: 92, y: 90 }]) {
        const { x, y } = atlasVisibleNodePosition(original, viewport, node, scale);
        const centerX = x / 100 * viewport.width;
        const centerY = y / 100 * viewport.height;
        assert.ok(centerX - node.width * scale / 2 >= 7.99);
        assert.ok(centerX + node.width * scale / 2 <= viewport.width - 7.99);
        assert.ok(centerY - node.height * scale / 2 >= 71.99);
        assert.ok(centerY + node.height * scale / 2 <= viewport.height - 7.99);
      }
    }
  }
  assert.deepEqual(atlasVisibleNodePosition({ x: 50, y: 50 }, { width: 960, height: 500 }, node, 1), { x: 50, y: 50 });
});

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

test('Atlas zoom plane continues to fill the viewport at every zoom level', () => {
  assert.deepEqual(atlasZoomPlane(0.8, 0.8), { scale: 1, extentPercent: 100 });
  assert.deepEqual(atlasZoomPlane(0.4, 0.8), { scale: 0.5, extentPercent: 200 });
  const enlarged = atlasZoomPlane(1.2, 0.8);
  assert.ok(Math.abs(enlarged.scale - 1.5) < 0.0001);
  assert.ok(Math.abs(enlarged.extentPercent - (100 / 1.5)) < 0.0001);
});

test('custom maps keep their own nodes and layout regardless of the selected region', () => {
  const terms = ['agency', 'identity', 'attention'];
  const regionTerms = new Set(['agency']);
  assert.deepEqual(atlasMapTerms({ terms, regionTerms }), ['agency']);
  assert.deepEqual(atlasMapTerms({ terms, regionTerms, customTerms: ['identity', 'attention', 'identity'] }), ['identity', 'attention']);
  assert.deepEqual(atlasMapTerms({ terms, regionTerms, customTerms: [] }), []);
  assert.equal(atlasMapScope('custom', 'map-1', 'region-1'), atlasMapScope('custom', 'map-1', 'region-2'));
  assert.notEqual(atlasMapScope('custom', 'map-1'), atlasMapScope('custom', 'map-2'));
  assert.notEqual(atlasMapScope('auto', 'map-1', 'region-1'), atlasMapScope('auto', 'map-1', 'region-2'));
});

test('saved zoom is restored within the supported range', () => {
  for (const value of [null, '', 'invalid', 'Infinity']) assert.equal(atlasStoredZoom(value, 0.8, 0.4, 1.6), 0.8);
  assert.equal(atlasStoredZoom('0.5', 0.8, 0.4, 1.6), 0.5);
  assert.equal(atlasStoredZoom('0.1', 0.8, 0.4, 1.6), 0.4);
  assert.equal(atlasStoredZoom('2', 0.8, 0.4, 1.6), 1.6);
});

test('a focused concept remains visible in the mobile preview without changing custom-map membership', () => {
  const nodes = Array.from({ length: 10 }, (_, index) => ({ key: String(index), count: index }));
  assert.deepEqual(atlasCompactNodes(nodes).map(({ key }) => key), ['9', '8', '7', '6', '5', '4', '3', '2']);
  assert.deepEqual(atlasCompactNodes(nodes, '0').map(({ key }) => key), ['9', '8', '7', '6', '5', '4', '3', '0']);
  assert.deepEqual(atlasCompactNodes(nodes, '4'), atlasCompactNodes(nodes));
  const terms = ['agency', 'identity', 'attention'];
  const regionTerms = new Set(['agency']);
  assert.deepEqual(atlasMapTerms({ terms, regionTerms, focusedTerm: 'attention' }), ['agency', 'attention']);
  assert.deepEqual(atlasMapTerms({ terms, regionTerms, focusedTerm: 'attention', customTerms: ['agency'] }), ['agency']);
});
