import test from 'node:test';
import assert from 'node:assert/strict';
import { conceptBoundaries, inquiryFog, islandRadius, orderRegionConcepts } from '../../src/components/Atlas/AtlasTerritoryCanvas';

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

test('boundaries come only from what the concept records', () => {
  assert.deepEqual(conceptBoundaries({ id: 'c' }), []);
  const boundaries = conceptBoundaries({
    id: 'c',
    notSameAs: ['Narrative Self'],
    counterexamples: ['A role dropped at home', ''],
    edgeCases: ['A conversion that keeps the habits'],
    caseReasons: { 'A role dropped at home': 'An audience maintains it.' },
  });
  assert.deepEqual(boundaries.map((item) => item.kind), ['not the same as', 'counterexample', 'edge case']);
  assert.equal(boundaries[1].reason, 'An audience maintains it.');
  assert.equal(boundaries[0].reason, undefined);
});

test('a boundary is never listed twice', () => {
  const boundaries = conceptBoundaries({ id: 'c', notSameAs: ['Habit'], counterexamples: ['Habit'] });
  assert.equal(boundaries.length, 1);
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
  assert.ok(lots < bare * 4);
  // Clarity counts; confidence and repeated edits are not arguments here.
  assert.ok(islandRadius(0, 3) > bare);
});
