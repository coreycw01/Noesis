import test from 'node:test';
import assert from 'node:assert/strict';
import { conceptInvolvement, elevationRings } from '../../src/components/Atlas/AtlasTerritoryCanvas';

test('a concept rises one contour ring per doubling of what rests on it', () => {
  assert.equal(elevationRings(0), 1);
  assert.equal(elevationRings(1), 2);
  assert.equal(elevationRings(3), 3);
  assert.equal(elevationRings(7), 4);
  assert.equal(elevationRings(10_000), 8);
});

test('involvement counts records, notes and links that touch the concept', () => {
  const world = { concepts: [{ id: 'a' }, { id: 'b' }], records: [{ conceptId: 'a' }, { conceptId: 'a' }], notes: [{ conceptId: 'b' }] };
  const links = [{ fromType: 'concept', fromId: 'a', toType: 'concept', toId: 'b' }] as never;
  const counts = conceptInvolvement(world, links);
  assert.equal(counts.get('a'), 3);
  assert.equal(counts.get('b'), 2);
});
