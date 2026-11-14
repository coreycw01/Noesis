import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inquiryCandidateCount,
  inquiryAiItemMemory,
  inquiryFormation,
  inquiryNeedsCandidateAnswers,
  inquiryPositionEvidence,
  assignInquiryEvidence,
  inquiryHasRecordedObjection,
  inquiryNeedsEvidence,
  inquirySourceIds,
  isInquiryActive,
  indexAnnotationInquiries,
} from '../../src/lib/inquiry-state';
import type { InquiryEvidence, Question } from '../../src/lib/types';

test('annotation inquiry connections include evidence, prefer the created inquiry, and ignore stale links', () => {
  const lookup = indexAnnotationInquiries([
    { id: 'evidence', evidenceIds: ['note', 'note'], sourceIds: ['source'] },
    { id: 'created', evidenceIds: ['note'], sourceIds: ['source'], sourceAnnotationId: 'note' },
    { id: 'other-source', evidenceIds: ['note'], sourceIds: ['different'] },
    { id: 'legacy-origin', sourceAnnotationId: 'note' },
  ] as Question[]);
  assert.deepEqual(lookup('note', 'source', 'created').map(({ id }) => id), ['created', 'evidence', 'legacy-origin']);
  assert.deepEqual(lookup('missing', 'source', 'deleted'), []);
});

function inquiry(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    text: 'What should change?',
    status: 'open',
    evidenceIds: [],
    conceptIds: [],
    dateCreated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('evidence can remain unassigned, then carry into the explicitly selected answer', () => {
  const evidence: InquiryEvidence = {
    id: 'e1', claim: 'Observed a counterexample', type: 'counterexample', origin: 'Journal',
    direction: 'challenges', strength: 'strong', reliability: 'moderate', candidateId: '',
    notes: 'Only one case', date: '2026-01-01',
  };
  const value = inquiry({ currentIntuition: 'My view', candidateAnswers: [{ id: 'c1', statement: 'Start small' }], evidenceRecords: [evidence] });
  assert.equal(inquiryNeedsEvidence(value), false);
  assert.equal(inquiryHasRecordedObjection(value), false);
  assert.equal(assignInquiryEvidence(value, evidence, '').candidateId, '');
  assert.throws(() => assignInquiryEvidence(value, evidence, 'missing'), /existing candidate/);
  assert.deepEqual(inquiryPositionEvidence(value, 'Start small').evidenceAgainst, []);
  const assigned = { ...value, evidenceRecords: [assignInquiryEvidence(value, evidence, 'c1')] };
  assert.equal(inquiryHasRecordedObjection(assigned), true);
  assert.match(inquiryPositionEvidence(assigned, 'Start small').evidenceAgainst[0], /Journal; notes: Only one case/);
  assert.match(inquiryAiItemMemory(assigned).join('\n'), /challenges; candidate: Start small/);
  assert.equal(assigned.currentIntuition, 'My view');
  const unknown = { ...value, evidenceRecords: [{ ...evidence, type: 'unknown' as const, candidateId: 'c1' }] };
  assert.equal(inquiryNeedsEvidence(unknown), true);
  assert.equal(inquiryHasRecordedObjection(unknown), false);
  assert.deepEqual(inquiryPositionEvidence(unknown, 'Start small').evidenceAgainst, []);
});

test('a saved leading answer counts as a candidate answer', () => {
  const value = inquiry({ answer: 'A provisional answer.' });
  assert.equal(inquiryCandidateCount(value), 1);
  assert.equal(inquiryNeedsCandidateAnswers(value), false);
  assert.ok(inquiryFormation(value).complete >= 3);
});

test('forming a position only carries evidence assessed against the adopted answer', () => {
  const value = inquiry({ candidateAnswers: [
    { id: 'a', statement: 'Start small.', support: 'Observed in practice', objection: 'May not generalize' },
    { id: 'b', statement: 'Start big.', support: 'A different experiment', objection: 'High cost' },
    { id: 'c', statement: 'start   small.', support: ' Observed in practice ' },
  ] });
  assert.deepEqual(inquiryPositionEvidence(value, ' Start small. '), {
    evidenceFor: ['Observed in practice'],
    evidenceAgainst: ['May not generalize'],
  });
  assert.deepEqual(inquiryPositionEvidence(value, 'A different answer.'), { evidenceFor: [], evidenceAgainst: [] });
});

test('empty candidate records do not inflate candidate totals', () => {
  const value = inquiry({ candidateAnswers: [{ id: 'c1', statement: '   ' }] });
  assert.equal(inquiryCandidateCount(value), 0);
  assert.equal(inquiryNeedsCandidateAnswers(value), true);
});

test('source and legacy evidence references are merged without duplicates', () => {
  const value = inquiry({ sourceIds: ['source-1'], evidenceIds: ['source-1', 'source-2'] });
  assert.deepEqual(inquirySourceIds(value), ['source-1', 'source-2']);
});

test('partial and provisional answers stay active; suspended and closed inquiries do not', () => {
  assert.equal(isInquiryActive(inquiry({ status: 'suspended' })), false);
  assert.equal(isInquiryActive(inquiry({ status: 'provisionally_answered' })), true);
  assert.equal(isInquiryActive(inquiry({ status: 'partially_answered' })), true);
  assert.equal(isInquiryActive(inquiry({ status: 'answered' })), false);
  assert.equal(isInquiryActive(inquiry({ status: 'gathering_evidence' })), true);
});

test('question-only inquiries produce a valid bounded AI memory', () => {
  assert.deepEqual(inquiryAiItemMemory(inquiry()), ['Inquiry: What should change?', 'Status: open']);
});

test('AI memory includes saved context and advanced inquiry material', () => {
  const memory = inquiryAiItemMemory(inquiry({
    whyItMatters: 'It changes how I act.',
    currentIntuition: 'I think restraint matters.',
    uncertainty: 'I do not know when restraint becomes avoidance.',
    assumptions: ['Action reveals commitment.'],
    candidateAnswers: [{ id: 'c1', statement: 'Act despite uncertainty.' }],
    answer: 'Begin with a reversible action.',
  }));

  assert.deepEqual(memory, [
    'Inquiry: What should change?',
    'Status: open',
    'Why it matters: It changes how I act.',
    'Current view: I think restraint matters.',
    'Remaining uncertainty: I do not know when restraint becomes avoidance.',
    'Assumptions: Action reveals commitment.',
    'Candidate 1 (unrated): Act despite uncertainty.; support: none; objection: none; consequence: none',
    'Current answer: Begin with a reversible action.',
  ]);
});
