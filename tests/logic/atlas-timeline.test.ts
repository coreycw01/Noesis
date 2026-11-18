import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasNodeTimelineState, atlasTimelineBounds } from '../../src/components/Atlas/atlas-timeline';

const day = (iso: string) => Date.parse(iso);

test('without a window every concept is present', () => {
  assert.equal(atlasNodeTimelineState('2026-03-01', null), 'present');
});

test('concepts created after the as-of date are hidden, those inside the window are new', () => {
  const window = { from: day('2026-02-01'), asOf: day('2026-03-01') };
  assert.equal(atlasNodeTimelineState('2026-01-15', window), 'present');
  assert.equal(atlasNodeTimelineState('2026-02-10', window), 'new');
  assert.equal(atlasNodeTimelineState('2026-03-01T18:00:00Z', window), 'new');
  assert.equal(atlasNodeTimelineState('2026-03-02', window), 'unborn');
});

test('undated concepts never disappear from the replay', () => {
  assert.equal(atlasNodeTimelineState(undefined, { from: 0, asOf: day('2020-01-01') }), 'present');
});

test('bounds span the earliest record to today', () => {
  const now = day('2026-06-01');
  const bounds = atlasTimelineBounds(['2026-01-10', 'not a date', '2025-12-31'], now);
  assert.equal(bounds.start, day('2025-12-31'));
  assert.equal(bounds.end, now);
});
