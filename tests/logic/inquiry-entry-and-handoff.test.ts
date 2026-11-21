import assert from 'node:assert/strict';
import test from 'node:test';
import { inquiryExperimentSetup, inquiryStartingObservation } from '../../src/lib/inquiry-state';
import { conceptAttentionReason } from '../../src/lib/concept-attention';
import { practiceDesignGaps } from '../../src/lib/workflow-integrity';
import { answerWeight } from '../../src/components/Questions/InquiryScale';

test('a starter observation can be saved without committing to an explanation', () => {
  const observation = inquiryStartingObservation(' I said yes before checking my plans. ');
  assert.equal(observation.claim, 'I said yes before checking my plans.');
  assert.equal(observation.candidateId, '');
  assert.equal(answerWeight([{ ...observation, id: 'event', candidateId: 'a', date: '' }], 'a'), 0);
});

test('a Praxis draft keeps past evidence separate from runnable setup', () => {
  const past = 'My spreadsheet still got done the next day.';
  const planned = { action: 'Check the deadline before saying yes.', prediction: 'I expect to keep my deadlines.', measure: 'Did I offer help and keep the deadline?' };
  assert.equal(inquiryExperimentSetup({ ...planned, measure: ' ' }, past), null);
  const setup = inquiryExperimentSetup(planned, past);
  assert.ok(setup);
  assert.equal(setup.intellectualBasis, past);
  assert.equal(setup.action, planned.action);
  assert.equal(setup.hypothesis, planned.prediction);
  assert.deepEqual(practiceDesignGaps({ type: 'experiment', ...setup }), []);
});

test('concept attention distinguishes unused notes from undefined claims and explicit tension', () => {
  assert.equal(conceptAttentionReason({ description: '', philosophyStatus: 'undefined' }, 0), '');
  assert.ok(conceptAttentionReason({ description: ' ', philosophyStatus: 'undefined' }, 1));
  assert.equal(conceptAttentionReason({ description: 'A working definition.', philosophyStatus: 'emerging' }, 2), '');
  assert.ok(conceptAttentionReason({ description: 'A contested definition.', philosophyStatus: 'contested' }, 0));
});
