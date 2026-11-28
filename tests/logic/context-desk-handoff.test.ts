import assert from 'node:assert/strict';
import test from 'node:test';
import type { AiReviewResult } from '../../src/lib/contextual-ai';
import { deskExperimentCreationRef, deskExperimentId, prepareDeskFinding } from '../../src/lib/context-desk-handoff';
import { practiceReviewDestination } from '../../src/lib/practice-state';
import type { Practice, Question, VaultEntry } from '../../src/lib/types';

const result: AiReviewResult = {
  action: 'review_selected_context', targetType: 'context_desk', targetId: 'selection',
  title: 'Review', content: 'There may be a counterexample.', contextSummary: '',
  reviewId: '00112233-4455-4677-8899-aabbccddeeff', generatedAt: '2026-11-21',
  userPromptAtGeneration: '  How can I test this?  ',
};
const records = [{ type: 'position', id: 'p1' }, { type: 'inquiry', id: 'q1' }];

test('a finding keeps provenance on the exact record without changing its canonical fields', async () => {
  const target = { type: 'position' as const, id: 'p1', privateExcerpt: 'not destination metadata' };
  const { finding, origin, practice } = await prepareDeskFinding('user', target, result, ' A useful objection. ', records, 'timestamp');
  assert.equal(finding.content, 'A useful objection.');
  assert.deepEqual(origin.targets, [{ type: 'position', id: 'p1', fieldPath: 'contextDeskFindings.content', subrecordId: finding.id }]);
  assert.equal(practice, null);
  assert.equal(origin.userPrompt, undefined);
  assert.equal(deskExperimentCreationRef({ id: 'p1', contextDeskFindings: [finding] }), undefined);
  assert.equal((await prepareDeskFinding('user', { type: 'position', id: 'p1' }, result, finding.content, records, 'timestamp')).finding.id, finding.id);
  await assert.rejects(prepareDeskFinding('user', { type: 'practice', id: 'outside' }, result, 'test', records, 'timestamp'), /actually read/);
});

test('a reviewed experiment starts proposed, with user-entered setup and no invented result', async () => {
  const id = deskExperimentId(result.reviewId);
  const setup = { title: 'Compare two mornings', action: 'Put my phone away', prediction: 'I will read longer', measure: 'Minutes read' };
  const { practice, finding, origin } = await prepareDeskFinding('user', { type: 'practice', id }, result, 'A reason to try it.', records, null, setup);
  assert.equal(practice?.status, 'proposed');
  assert.equal(practice?.action, setup.action);
  assert.equal(practice?.contextDeskFindings[0].id, finding.id);
  assert.deepEqual(practice?.questionIds, ['q1']);
  assert.deepEqual(practice?.positionIds, ['p1']);
  assert.deepEqual(practice?.logs, []);
  assert.equal(origin.userPrompt, 'How can I test this?');
  assert.equal(practice?.creationProvenance.provenanceId, finding.id);
  assert.equal(deskExperimentCreationRef({ id, contextDeskFindings: [finding] })?.provenanceId, finding.id);
  assert.equal(practiceReviewDestination(practice as Practice, [], []), null);
});

test('a completed Praxis result links directly to a parent, while check-ins do not', () => {
  const practice = { id: 'run', status: 'concluded', questionIds: [], positionIds: ['p1'], observedOutcome: 'Read for twenty minutes.' } as unknown as Practice;
  const question = { id: 'q1', text: 'Can I read longer?', practiceIds: ['run'] } as Question;
  const position = { id: 'p1', title: 'Phones distract.' } as VaultEntry;
  assert.deepEqual(practiceReviewDestination(practice, [question], [position]), { view: 'questions', targetId: 'q1', label: question.text });
  assert.deepEqual(practiceReviewDestination(practice, [], [position]), { view: 'vault', targetId: 'p1', label: position.title });
  assert.equal(practiceReviewDestination({ ...practice, observedOutcome: 'Kept' }, [question], [position]), null);
});
