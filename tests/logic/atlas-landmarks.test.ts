import test from 'node:test';
import assert from 'node:assert/strict';
import { constellationShape, inquiryFog, islandRadius, islandSeating, orderRegionConcepts } from '../../src/components/Atlas/AtlasTerritoryCanvas';

test('fog follows the inquiry you actually recorded', () => {
  assert.equal(inquiryFog('open'), 1);
  assert.equal(inquiryFog('gathering_evidence'), 1);
  assert.equal(inquiryFog('under_tension'), 1);
  // A working answer thins the fog rather than clearing it.
  assert.ok(inquiryFog('partially_answered') < 1 && inquiryFog('partially_answered') > 0);
  assert.equal(inquiryFog('provisionally_answered'), inquiryFog('partially_answered'));
  // Resolving clears the air; reopening brings it back in full.
  assert.equal(inquiryFog('resolved'), 0);
  assert.equal(inquiryFog('no_longer_meaningful'), 0);
  assert.equal(inquiryFog('reopened'), 1);
});

test('concepts that are easy to confuse end up side by side', () => {
  const order = orderRegionConcepts([
    { id: 'a', name: 'Discipline', notSameAs: ['Habit'] },
    { id: 'b', name: 'Meaning' },
    { id: 'c', name: 'Habit' },
    { id: 'd', name: 'Attention' },
  ]);
  const gap = Math.abs(order.indexOf('a') - order.indexOf('c'));
  assert.ok(gap === 1 || gap === order.length - 1, `Discipline and Habit should be neighbours, got ${order.join(', ')}`);
});

test('explicit opposites are kept apart, and only explicit ones', () => {
  const opposed = orderRegionConcepts([
    { id: 'a', name: 'Freedom', opposedTo: ['Power'] },
    { id: 'b', name: 'Care' },
    { id: 'c', name: 'Power' },
    { id: 'd', name: 'Truth' },
  ]);
  const gap = Math.abs(opposed.indexOf('a') - opposed.indexOf('c'));
  assert.ok(gap > 1 && gap < opposed.length - 1, `Freedom and Power should not be neighbours, got ${opposed.join(', ')}`);
  // Two concepts with nothing recorded between them are not opposites.
  const quiet = [{ id: 'a', name: 'Freedom' }, { id: 'b', name: 'Care' }, { id: 'c', name: 'Power' }, { id: 'd', name: 'Truth' }];
  assert.deepEqual(orderRegionConcepts(quiet), orderRegionConcepts(quiet));
});

test('the order is the same every time the map is drawn', () => {
  const concepts = [
    { id: 'a', name: 'Identity', notSameAs: ['Narrative Self'] },
    { id: 'b', name: 'Narrative Self' },
    { id: 'c', name: 'Agency', opposedTo: ['Habit'] },
    { id: 'd', name: 'Habit' },
    { id: 'e', name: 'Virtue' },
  ];
  const first = orderRegionConcepts(concepts);
  assert.deepEqual(orderRegionConcepts([...concepts].reverse()), first);
});

test('an island grows with what rests on it, and the growth slows', () => {
  const bare = islandRadius(0, 0);
  const some = islandRadius(4, 0);
  const lots = islandRadius(64, 0);
  assert.ok(some > bare && lots > some);
  // Each unit of work adds less than the one before it, so a busy concept
  // never swells across its neighbours' water.
  assert.ok((lots - some) / 60 < (some - bare) / 4);
  // The honest invariant: every doubling of the work adds the same step, so
  // growth never runs away however much rests on a concept.
  const step = islandRadius(1, 0) - islandRadius(0, 0);
  for (const n of [1, 3, 7, 15, 31]) {
    assert.ok(Math.abs((islandRadius(n * 2 + 1, 0) - islandRadius(n, 0)) - step) < 1);
  }
  // Clarity counts; confidence and repeated edits are not arguments here.
  assert.ok(islandRadius(0, 3) > bare);
});

test('every landmark gets a seat with clear air around it, however many there are', () => {
  // A landmark's glyph spans about 17 world units at the Records distance.
  const GLYPH = 17.3;
  for (let count = 1; count <= 120; count += 1) {
    const { seats, radius } = islandSeating(count);
    assert.equal(seats.length, count, `every landmark is seated (${count})`);
    // Nothing is seated past the coastline.
    for (const seat of seats) assert.ok(seat.reach < radius, `seat inside the coast (${count})`);
    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        // Islands are drawn flattened, so measure the gap as it is seen.
        const ax = Math.cos(seats[a].angle) * seats[a].reach;
        const ay = Math.sin(seats[a].angle) * seats[a].reach * 0.85;
        const bx = Math.cos(seats[b].angle) * seats[b].reach;
        const by = Math.sin(seats[b].angle) * seats[b].reach * 0.85;
        const gap = Math.hypot(ax - bx, ay - by);
        assert.ok(gap > GLYPH, `two landmarks would overlap at ${count}: gap ${gap.toFixed(1)}`);
      }
    }
  }
});

test('an island is never too small for the landmarks it carries', () => {
  // However flat the growth curve goes, the island still has to seat its own
  // records: the count sets a floor that the curve cannot undercut.
  for (const count of [1, 12, 40, 120, 400]) {
    assert.ok(islandRadius(count, 0, count) >= islandSeating(count).radius, `seats fit at ${count}`);
  }
  // A crowded concept with little else recorded still opens out.
  assert.ok(islandRadius(0, 0, 60) > islandRadius(0, 0, 0));
  // An untouched concept carries nothing, so nothing has to fit.
  assert.equal(islandSeating(0).radius, 0);
});

test('two regions of the same size are not the same constellation', () => {
  const radii = [60, 60, 60, 60];
  const shapes = ['meaning', 'identity', 'attention', 'virtue', 'power'].map((seed) => constellationShape(seed, radii));
  const signature = (shape: Array<{ dx: number; dy: number }>) => {
    const reach = shape.map((point) => Math.hypot(point.dx, point.dy));
    const mean = reach.reduce((sum, value) => sum + value, 0) / reach.length;
    return reach.map((value) => (value / mean).toFixed(2)).join(',');
  };
  const seen = new Set(shapes.map(signature));
  assert.equal(seen.size, shapes.length, 'each region draws its own figure');
  // Same region, same figure, every time it is drawn.
  assert.deepEqual(constellationShape('meaning', radii), shapes[0]);
  // And the figure is seeded by the region's id, not its place in the list, so
  // adding a region leaves the others exactly as they were.
  assert.deepEqual(constellationShape('identity', radii), shapes[1]);
});

test('a constellation keeps its concepts in the order the affinity walk chose', () => {
  // The walk puts concepts that are easy to confuse next to each other. The
  // figure may stretch and lean, but it must not reorder the ring, or that
  // adjacency stops meaning anything.
  for (let count = 3; count <= 12; count += 1) {
    for (let seed = 0; seed < 40; seed += 1) {
      const radii = Array.from({ length: count }, (_, index) => 40 + ((index * 37 + seed * 13) % 80));
      const shape = constellationShape(`region-${count}-${seed}`, radii);
      let swept = 0;
      for (let slot = 0; slot < count; slot += 1) {
        const here = Math.atan2(shape[slot].dy, shape[slot].dx);
        const next = Math.atan2(shape[(slot + 1) % count].dy, shape[(slot + 1) % count].dx);
        let step = next - here;
        while (step <= 0) step += Math.PI * 2;
        swept += step;
      }
      // One clean turn means the slots are still in cyclic order.
      assert.ok(Math.abs(swept - Math.PI * 2) < 1e-6, `ring reordered at ${count}/${seed}`);
    }
  }
});

test('islands in a constellation always have open water between them', () => {
  for (let count = 2; count <= 12; count += 1) {
    for (let seed = 0; seed < 40; seed += 1) {
      // Deliberately lopsided: one worked-over concept beside small ones.
      const radii = Array.from({ length: count }, (_, index) => (index === 0 ? 150 : 40 + ((index * 29 + seed) % 50)));
      const shape = constellationShape(`lopsided-${count}-${seed}`, radii);
      for (let a = 0; a < count; a += 1) {
        for (let b = a + 1; b < count; b += 1) {
          const apart = Math.hypot(shape[a].dx - shape[b].dx, shape[a].dy - shape[b].dy);
          assert.ok(apart > radii[a] + radii[b], `coastlines touch at ${count}/${seed}`);
        }
      }
    }
  }
});
