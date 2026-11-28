import assert from 'node:assert/strict';
import test from 'node:test';
import { inquiryAnnotationOrigins, inquiryExperimentSetup, inquiryStartingObservation, inquiryWeighedCount } from '../../src/lib/inquiry-state';
import type { Annotation, Media, Question } from '../../src/lib/types';
import { conceptAttentionReason } from '../../src/lib/concept-attention';
import { practiceDesignGaps } from '../../src/lib/workflow-integrity';
import { answerWeight } from '../../src/components/Questions/InquiryScale';

test('a starter observation can be saved without committing to an explanation', () => {
  const observation = inquiryStartingObservation(' I said yes before checking my plans. ');
  assert.equal(observation.claim, 'I said yes before checking my plans.');
  assert.equal(observation.candidateId, '');
  assert.equal(answerWeight([{ ...observation, id: 'event', candidateId: 'a', date: '' }], 'a'), 0);
});

test('inquiry history finds annotations outside the linked source list without mistaking evidence for an origin', () => {
  const question: Question = {
    id: 'q', text: 'What prompted this?', status: 'open', sourceAnnotationId: 'original',
    sourceIds: ['evidence-source'], evidenceIds: ['evidence-note'], conceptIds: [], dateCreated: '',
  };
  const note = (id: string, overrides: Partial<Annotation> = {}): Annotation => ({ id, type: 'thought', text: id, date: '', ...overrides });
  const media = [
    { id: 'original-source', annotations: [note('original'), note('older', { createdInquiryId: 'q' })] },
    { id: 'evidence-source', annotations: [note('evidence-note')] },
    { id: 'marked-source', annotations: [note('marked', {
      marks: [{ id: 'm', start: 0, end: 16, kind: 'question', text: 'Original excerpt', movedTo: 'inquiry', movedId: 'q', movedText: 'Edited question', date: '' }],
    })] },
  ] as Media[];
  assert.deepEqual(inquiryAnnotationOrigins(question, media).map(({ annotation, excerpt }) => [annotation.id, excerpt]), [
    ['original', 'original'], ['older', 'older'], ['marked', 'Original excerpt'],
  ]);
  const duplicate = { id: 'other-source', annotations: [note('original')] } as Media;
  assert.ok(!inquiryAnnotationOrigins(question, [...media, duplicate]).some(origin => origin.annotation.id === 'original'));
});

test('a Praxis draft keeps past evidence separate from runnable setup', () => {
  const past = 'My spreadsheet still got done the next day.';
  const planned = { action: 'Check the deadline before saying yes.', prediction: 'I expect to keep my deadlines.', measure: 'Did I offer help and keep the deadline?' };
  assert.equal(inquiryExperimentSetup({ ...planned, measure: ' ' }, past), null);
  assert.equal(inquiryExperimentSetup({ ...planned, prediction: ' MY  spreadsheet still got done the next day. ' }, past), null);
  const setup = inquiryExperimentSetup(planned, past);
  assert.ok(setup);
  assert.equal(setup.intellectualBasis, past);
  assert.equal(setup.action, planned.action);
  assert.equal(setup.hypothesis, planned.prediction);
  assert.equal(setup.expectedOutcome, planned.prediction);
  assert.ok(setup.observationMethod.includes(planned.measure));
  assert.deepEqual(practiceDesignGaps({ type: 'experiment', ...setup }), []);
  assert.match(inquiryExperimentSetup({ ...planned, against: 'I missed the deadline.' }, past)!.observationMethod, /count against.*I missed the deadline/);
});

test('only a recorded ground explicitly weighed against an existing answer counts', () => {
  const observation = { ...inquiryStartingObservation('A concrete example'), date: '' };
  assert.equal(inquiryWeighedCount({
    candidateAnswers: [{ id: 'a', statement: 'Answer A' }],
    evidenceRecords: [
      { ...observation, id: 'context', candidateId: 'a' },
      { ...observation, id: 'legacy', candidateId: 'deleted', direction: 'supports' },
      { ...observation, id: 'weighed', candidateId: 'a', direction: 'challenges' },
    ],
  }), 1);
});

test('concept attention distinguishes unused notes from undefined claims and explicit tension', () => {
  assert.equal(conceptAttentionReason({ description: '', philosophyStatus: 'undefined' }, 0), '');
  assert.ok(conceptAttentionReason({ description: ' ', philosophyStatus: 'undefined' }, 1));
  assert.equal(conceptAttentionReason({ description: 'A working definition.', philosophyStatus: 'emerging' }, 2), '');
  assert.ok(conceptAttentionReason({ description: 'A contested definition.', philosophyStatus: 'contested' }, 0));
});
