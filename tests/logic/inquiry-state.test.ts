import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inquiryCandidateCount,
  inquiryAiItemMemory,
  inquiryFormation,
  inquiryNeedsCandidateAnswers,
  inquirySourceIds,
  isInquiryActive,
} from '../../src/lib/inquiry-state';
import type { Question } from '../../src/lib/types';

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

test('a saved leading answer counts as a candidate answer', () => {
  const value = inquiry({ answer: 'A provisional answer.' });
  assert.equal(inquiryCandidateCount(value), 1);
  assert.equal(inquiryNeedsCandidateAnswers(value), false);
  assert.ok(inquiryFormation(value).complete >= 3);
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

test('suspended and provisionally answered inquiries are not active investigations', () => {
  assert.equal(isInquiryActive(inquiry({ status: 'suspended' })), false);
  assert.equal(isInquiryActive(inquiry({ status: 'provisionally_answered' })), false);
  assert.equal(isInquiryActive(inquiry({ status: 'gathering_evidence' })), true);
});

test('question-only inquiries produce a valid bounded AI memory', () => {
  assert.deepEqual(inquiryAiItemMemory(inquiry()), ['Inquiry: What should change?']);
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
    'Why it matters: It changes how I act.',
    'Current view: I think restraint matters.',
    'Remaining uncertainty: I do not know when restraint becomes avoidance.',
    'Assumptions: Action reveals commitment.',
    'Candidate answers: Act despite uncertainty.',
    'Current answer: Begin with a reversible action.',
  ]);
});
