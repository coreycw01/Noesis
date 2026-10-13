import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasPracticeIntellectualBasis,
  deriveNoesisCondition,
  deriveNoesisStage,
  derivePositionLifecycleStage,
  expectedCommitmentProgress,
  normalizePositionConfidence,
  normalizePracticeStatusForSave,
  practiceDesignGaps,
  uniqueIds,
} from '../../src/lib/workflow-integrity';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';

test('position confidence is stored on one 0-100 scale', () => {
  assert.equal(normalizePositionConfidence(undefined), 60);
  assert.equal(normalizePositionConfidence(0.72, 60, 'fraction'), 72);
  assert.equal(normalizePositionConfidence(3, 60, 'five_point'), 60);
  for (const value of [0, 1, 2, 3, 4, 5, 100]) assert.equal(normalizePositionConfidence(value), value);
  assert.equal(normalizePositionConfidence(Number.NaN), 60);
  assert.equal(normalizePositionConfidence(-10), 0);
  assert.equal(normalizePositionConfidence(84), 84);
  assert.equal(normalizePositionConfidence(140), 100);
});

test('active practices require a complete design and an intellectual basis', () => {
  const incomplete = {
    status: 'active' as const,
    hypothesis: '',
    action: 'Walk without a phone.',
    observationMethod: '',
    expectedOutcome: '',
    conceptTags: [],
    sourceIds: [],
    questionIds: [],
    positionIds: [],
  };
  assert.deepEqual(practiceDesignGaps(incomplete), ['hypothesis', 'observation method', 'success signal']);
  assert.equal(hasPracticeIntellectualBasis(incomplete), false);
  assert.equal(normalizePracticeStatusForSave(incomplete), 'planned');

  const ready = {
    ...incomplete,
    hypothesis: 'Reduced interruption should improve sustained attention.',
    observationMethod: 'Record distraction count after each walk.',
    expectedOutcome: 'Fewer than three attention breaks.',
    positionIds: ['position-attention'],
  };
  assert.equal(normalizePracticeStatusForSave(ready), 'active');
});

test('relationship identifiers are trimmed and deduplicated', () => {
  assert.deepEqual(uniqueIds([' source-1 ', 'source-1', '', null, 'source-2']), ['source-1', 'source-2']);
});

test('legacy statuses map into one visible Noesis cycle', () => {
  assert.equal(deriveNoesisStage('source', 'Finished'), 'encounter');
  assert.equal(deriveNoesisStage('inquiry', 'investigating'), 'question');
  assert.equal(deriveNoesisStage('inquiry', 'resolved'), 'revise');
  assert.equal(deriveNoesisStage('position', 'active'), 'claim');
  assert.equal(deriveNoesisStage('position', 'revised'), 'claim');
  assert.equal(deriveNoesisStage('position', 'abandoned'), 'claim');
  assert.equal(deriveNoesisStage('practice', 'active'), 'test');
  assert.equal(deriveNoesisStage('practice', 'concluded'), 'revise');
});

test('position lifecycle and guided stage never contradict each other', () => {
  assert.equal(derivePositionLifecycleStage('revised'), 'current');
  assert.equal(derivePositionLifecycleStage('challenged'), 'under_review');
  assert.equal(derivePositionLifecycleStage('abandoned'), 'retired');
  assert.equal(deriveNoesisCondition('position', 'abandoned'), undefined);
});

test('say-do expectations grow with elapsed commitment time', () => {
  const now = new Date('2026-10-13T12:00:00.000Z');
  assert.equal(expectedCommitmentProgress({ target: 30, createdAt: '2026-10-12', now }), 2);
  assert.equal(expectedCommitmentProgress({ target: 30, createdAt: '2026-09-01', now }), 30);
  assert.equal(expectedCommitmentProgress({ target: 10, createdAt: '2026-10-12', now, cadenceDays: 20 }), 1);
});

test('conditions stay separate from lifecycle stage', () => {
  assert.equal(deriveNoesisCondition('inquiry', 'gathering_evidence'), 'needs_evidence');
  assert.equal(deriveNoesisCondition('position', 'challenged'), 'under_challenge');
  assert.equal(deriveNoesisCondition('practice', 'paused'), 'stalled');
  assert.equal(deriveNoesisCondition('position', 'active'), undefined);
});

test('the demo workspace never presents an incomplete practice as active', () => {
  const workspace = buildDemoWorkspace('demo-test-user');
  const invalidActive = workspace.practices.filter((practice) => (
    practice.status === 'active'
      && (practiceDesignGaps(practice).length > 0 || !hasPracticeIntellectualBasis(practice))
  ));
  assert.deepEqual(invalidActive, []);
});

test('the demo workspace populates focused inquiry context without inventing answers', () => {
  const workspace = buildDemoWorkspace('demo-test-user');

  for (const inquiry of workspace.questions) {
    assert.ok(inquiry.whyItMatters?.trim(), `${inquiry.id} needs a stake`);
    assert.ok(inquiry.currentIntuition?.trim(), `${inquiry.id} needs a current view`);
    assert.ok(inquiry.uncertainty?.trim(), `${inquiry.id} needs a remaining uncertainty`);
  }

  assert.equal(workspace.questions.find((inquiry) => inquiry.id === 'q_comfort_growth')?.answer, '');
});
