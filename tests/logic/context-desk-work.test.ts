import assert from 'node:assert/strict';
import test from 'node:test';
import { contextDeskWorkDraft, isContextDeskReviewRetry } from '../../src/lib/context-desk-work';

test('reviewed Context Desk text becomes safe Work content with history and selected references', () => {
  const text = 'Compare <evidence>\nThen revisit the claim.';
  const draft = contextDeskWorkDraft({ action: 'review_selected_context', targetType: 'context_desk', targetId: 'selection', title: 'Context review', content: 'Unedited', contextSummary: '', generatedAt: '2026-11-13' }, text, [
    { type: 'annotation', id: 'note', label: 'Note', sourceIds: ['book'] },
    { type: 'source', id: 'book', label: 'Book', sourceIds: ['book'] },
    { type: 'concept', id: 'concept', label: 'Agency', sourceIds: ['unselected'] },
    { type: 'inquiry', id: 'question', label: 'Question', sourceIds: [] },
    { type: 'position', id: 'position', label: 'Position', sourceIds: [] },
  ], new Date('2026-11-13T17:00:00Z'));
  assert.equal(draft.body, '<p>Compare &lt;evidence&gt;<br>Then revisit the claim.</p>');
  assert.equal(draft.draftContent, draft.body);
  assert.equal(draft.aiReviewHistory?.[0].content, text);
  assert.deepEqual(draft.sourceIds, ['book']);
  assert.deepEqual(draft.conceptTags, ['Agency']);
  assert.deepEqual(draft.questionIds, ['question']);
  assert.deepEqual(draft.beliefIds, ['position']);
});

test('an accepted review retries only against a Work with the same references', () => {
  const review = {
    reviewId: '91b13b7e-43cb-47cb-9a9d-7c5e12967f6f',
    action: 'review_selected_context' as const,
    targetType: 'context_desk' as const,
    targetId: 'selection',
    title: 'Context review',
    content: 'Unedited',
    contextSummary: '',
    generatedAt: '2026-11-13',
  };
  const requested = contextDeskWorkDraft(review, 'Reviewed', [
    { type: 'source', id: 'first', label: 'First', sourceIds: ['first'] },
    { type: 'source', id: 'second', label: 'Second', sourceIds: ['second'] },
    { type: 'inquiry', id: 'question', label: 'Question', sourceIds: [] },
  ]);
  assert.equal(isContextDeskReviewRetry({ ...requested, title: 'Renamed', sourceIds: ['second', 'first'] }, requested), true);
  assert.equal(isContextDeskReviewRetry({ ...requested, sourceIds: ['first', 'third'] }, requested), false);
  assert.equal(isContextDeskReviewRetry({ ...requested, questionIds: [] }, requested), false);
});
