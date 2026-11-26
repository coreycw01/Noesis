import test from 'node:test';
import assert from 'node:assert/strict';
import { soundingDepth } from '../../src/components/Library/SourceSounding';
import type { SourceJourneyState, SourceJourneyStep } from '../../src/lib/source-journey';

const at = (overview: number, capture: number, annotations: number, connections: number) => {
  const one = (progress: number): SourceJourneyState => ({ progress, meta: '', next: '' });
  return { overview: one(overview), capture: one(capture), annotations: one(annotations),
    connections: one(connections) } as Record<SourceJourneyStep, SourceJourneyState>;
};

test('an untouched source has paid out no line', () => {
  assert.equal(soundingDepth(at(0, 0, 0, 0)), 0);
});

test('a source taken all the way down reaches the fourth fathom', () => {
  assert.equal(soundingDepth(at(1, 1, 1, 1)), 4);
});

test('depth carries the part-done step rather than jumping a whole mark', () => {
  assert.equal(soundingDepth(at(1, 0.5, 0, 0)), 1.5);
  assert.equal(soundingDepth(at(1, 1, 0.25, 0)), 2.25);
});

test('depth never exceeds four fathoms or falls below none, whatever it is fed', () => {
  assert.equal(soundingDepth(at(2, 2, 2, 2)), 4);
  assert.equal(soundingDepth(at(-1, -1, 0, 0)), 0);
  assert.equal(soundingDepth(at(1.5, -0.5, 1, 0)), 2);
});

test('depth rises monotonically as work is added to any step', () => {
  let last = soundingDepth(at(0, 0, 0, 0));
  for (const step of [0.2, 0.4, 0.6, 0.8, 1]) {
    const now = soundingDepth(at(step, 0, 0, 0));
    assert.ok(now >= last, `depth fell from ${last} to ${now}`);
    last = now;
  }
});
