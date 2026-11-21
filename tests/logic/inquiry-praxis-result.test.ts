import assert from 'node:assert/strict';
import test from 'node:test';
import { practiceEvidenceDraft } from '../../src/lib/inquiry-state';
import { completedPracticeResult, latestCompletedPracticeResult } from '../../src/lib/practice-state';
import { answerWeight } from '../../src/components/Questions/InquiryScale';
import type { Practice } from '../../src/lib/types';

const practice = (id: string, patch: Partial<Practice> = {}): Practice => ({
  id, title: id, description: '', type: 'experiment', status: 'completed',
  durationDays: 1, startDate: '', endDate: '', dateCreated: '2026-11-01',
  dateUpdated: '2026-11-06', observedOutcome: 'Focus improved only when the task was clear.',
  conceptTags: [], sourceIds: [], questionIds: ['inquiry'], positionIds: [], draftIds: [], notes: '',
  ...patch,
});

test('an Inquiry can bring back a completed Praxis result, but not a partial or abandoned record', () => {
  const result = latestCompletedPracticeResult([
    practice('running', { status: 'active', dateUpdated: '2026-11-19' }),
    practice('abandoned', { status: 'abandoned', dateUpdated: '2026-11-18' }),
    practice('empty', { observedOutcome: '', notes: 'Not a result.' }),
    practice('reviewed', { status: 'failed_productively', conclusion: {
      whatHappened: 'The result depended on the task.',
      intellectualChange: 'Narrow the answer.',
      alternativeExplanation: 'The task was easier.',
    } }),
  ]);
  assert.equal(result?.practice.id, 'reviewed');
  assert.equal(result?.observation, 'The result depended on the task.');
  assert.equal(result?.implication, 'Narrow the answer.');
  assert.equal(result?.alternative, 'The task was easier.');
  assert.equal(completedPracticeResult(practice('empty', { observedOutcome: '' })), null);
});

test('a reviewed Praxis result starts as context and adds weight only when explicitly classified', () => {
  const draft = practiceEvidenceDraft({ title: 'Focus experiment' }, '  Focus improved only when the task was clear. ');
  assert.equal(draft.origin, 'Praxis · Focus experiment');
  assert.equal(draft.candidateId, '');
  const placed = { ...draft, id: 'result', candidateId: 'answer', date: '', reliability: 'moderate' as const, notes: '' };
  assert.equal(answerWeight([placed], 'answer'), 0);
  assert.equal(answerWeight([{ ...placed, direction: 'challenges' }], 'answer'), -2);
});
