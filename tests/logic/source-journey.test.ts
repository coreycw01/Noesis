import assert from 'node:assert/strict';
import test from 'node:test';
import { nextSourceJourneyStep, sourceJourney } from '../../src/lib/source-journey';
import type { Media } from '../../src/lib/types';

const base = { id: 's1', title: 'A source', creator: 'Someone', type: 'Book', status: 'Reading', tags: [], annotations: [], dateAdded: '2026-01-01' } as unknown as Media;

test('an untouched source starts at Understand with zero progress', () => {
  const state = sourceJourney(base, 0);
  assert.equal(state.overview.progress, 0);
  assert.equal(state.overview.meta, 'No purpose yet');
  assert.equal(nextSourceJourneyStep(state), 'overview');
});

test('provider metadata does not count as the reader understanding a source', () => {
  const state = sourceJourney({ ...base, description: 'Publisher blurb', catalogSummary: 'Summary' } as Media, 0);
  assert.equal(state.overview.progress, 0);
});

test('undeveloped notes are named as the next capture move', () => {
  const annotations = [
    { id: 'a1', text: 'One', type: 'highlight', date: '2026-01-01' },
    { id: 'a2', text: 'Two', type: 'highlight', date: '2026-01-01', createdInquiryId: 'q1' },
  ];
  const state = sourceJourney({ ...base, annotations } as unknown as Media, 0);
  assert.equal(state.annotations.meta, '2 notes · 1 developed');
  assert.equal(state.annotations.next, '1 note waiting to be developed.');
});

test('a fully worked source has no next step', () => {
  const full = {
    ...base,
    tags: ['identity', 'habit'],
    sourceNotes: 'My notes',
    capture: {
      before: { reasonForAdding: 'r', expectation: 'e', openQuestion: 'q' },
      after: { coreArgument: 'c', beliefChange: 'b', strongestArgument: 's', weakestArgument: 'w', remainsUnanswered: 'u' },
      sessions: [{ id: 'x', durationSeconds: 600 }, { id: 'y', durationSeconds: 600 }],
    },
    annotations: [1, 2, 3, 4].map((n) => ({ id: `a${n}`, text: `${n}`, type: 'highlight', date: '2026-01-01', createdPositionId: 'p' })),
  } as unknown as Media;
  const state = sourceJourney(full, 3);
  for (const step of Object.values(state)) assert.equal(step.progress, 1);
  assert.equal(state.capture.meta, '2 sessions · 20 min · reflected');
  assert.equal(nextSourceJourneyStep(state), null);
});

test('an expectation counts as a stated purpose, as it does on the source page', () => {
  const state = sourceJourney({ ...base, capture: { before: { expectation: 'A counterweight' }, sessions: [] } } as unknown as Media, 0);
  assert.equal(state.overview.meta, 'Purpose set');
});
