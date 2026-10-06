import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasPracticeIntellectualBasis,
  normalizePositionConfidence,
  normalizePracticeStatusForSave,
  practiceDesignGaps,
  uniqueIds,
} from '../../src/lib/workflow-integrity';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';

test('position confidence is stored on one 0-100 scale', () => {
  assert.equal(normalizePositionConfidence(undefined), 60);
  assert.equal(normalizePositionConfidence(0.72), 72);
  assert.equal(normalizePositionConfidence(3), 60);
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
