import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { inquiryAiReviewPatch, inquiryHistorySnapshot, type InquiryAiReview } from '../../src/lib/inquiry-ai-review';

test('inquiry review keeps only approved notes and leaves answer fields outside the patch', () => {
  const question = buildDemoWorkspace('owner').questions[0];
  const review: InquiryAiReview = {
    action: 'socratic_inquiry_challenge', targetType: 'inquiry', targetId: question.id,
    reviewId: 'review-1', generatedAt: '2026-11-13T12:00:00Z',
  };
  const patch = inquiryAiReviewPatch(question, review, '## A question\nWhat would change your mind?');
  assert.deepEqual(Object.keys(patch), ['investigationNotes']);
  assert.equal(patch.investigationNotes.find((note) => note.id === 'review-1:0')?.text, 'What would change your mind?');
  assert.throws(() => inquiryAiReviewPatch(question, { ...review, targetId: 'other' }, 'A note'), /does not belong/);
  assert.throws(() => inquiryAiReviewPatch(question, review, '   '), /at least one/);
  assert.doesNotMatch(JSON.stringify(inquiryHistorySnapshot({ ...question, ...patch })), /What would change your mind/);
});
