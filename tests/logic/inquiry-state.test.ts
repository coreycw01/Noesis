import assert from 'node:assert/strict';
import test from 'node:test';
import { inquiryCandidateCount, inquiryFormation, inquiryNeedsCandidateAnswers } from '../../src/lib/inquiry-state';
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
