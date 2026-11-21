import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePositionGrounds } from '../../src/lib/position-grounds';
import { positionReviewInputs } from '../../src/lib/position-review-inputs';
import type { Practice } from '../../src/lib/types';

const position = {
  id: 'attention',
  dateCreated: '2026-11-01',
  lastRevisedAt: '2026-11-10',
  falsification: 'Focus does not improve when interruptions are blocked.',
  evidenceFor: ['My field notes record fewer distractions.'],
  evidenceAgainst: ['The work might just have been easier.', '', 'A clear task may matter more than the phone.'],
};

const practice = (id: string, patch: Partial<Practice> = {}): Practice => ({
  id, title: id, description: '', type: 'experiment', status: 'completed',
  durationDays: 1, startDate: '', endDate: '', dateCreated: '2026-11-02',
  dateUpdated: '2026-11-15', observedOutcome: 'No benefit on unclear tasks.',
  conceptTags: [], sourceIds: [], questionIds: [], positionIds: ['attention'], draftIds: [], notes: '',
  ...patch,
});

test('review brings back a criterion, saved objection, and the latest completed linked result', () => {
  const result = positionReviewInputs(position, [
    practice('unrelated', { positionIds: ['identity'], dateUpdated: '2026-11-20' }),
    practice('planned', { status: 'planned', dateUpdated: '2026-11-20' }),
    practice('abandoned', { status: 'abandoned', dateUpdated: '2026-11-20' }),
    practice('no observation', { observedOutcome: '', notes: 'I plan to try this.', dateUpdated: '2026-11-20' }),
    practice('older', { dateUpdated: '2026-11-11' }),
    practice('latest', {
      status: 'failed_productively',
      conclusion: { whatHappened: 'Fewer interruptions helped only on clear tasks.', intellectualChange: 'Narrow the claim.', alternativeExplanation: 'The second task was easier.' },
    }),
  ], []);
  assert.equal(result.criterion, position.falsification);
  assert.equal(result.objection, 'A clear task may matter more than the phone.');
  assert.equal(result.result?.practice.id, 'latest');
  assert.equal(result.result?.observation, 'Fewer interruptions helped only on clear tasks.');
  assert.equal(result.result?.implication, 'Narrow the claim.');
  assert.equal(result.result?.alternative, 'The second task was easier.');
  assert.equal(result.resultNeedsReview, true);
});

test('a review does not count a Praxis outcome as evidence or repeat the new-result cue after revision', () => {
  const reviewed = { ...position, evidenceAgainst: [], lastRevisedAt: '2026-11-16' };
  const before = resolvePositionGrounds(reviewed, []);
  const review = positionReviewInputs(reviewed, [practice('test')], [{ note: 'The linked counterexample is relevant.' }]);
  assert.equal(review.objection, 'The linked counterexample is relevant.');
  assert.equal(review.resultNeedsReview, false);
  assert.equal(review.result?.practice.id, 'test');
  assert.deepEqual(resolvePositionGrounds(reviewed, []), before);
  assert.equal(before.supportCount, 1);
  assert.equal(before.challengeCount, 0);
});
