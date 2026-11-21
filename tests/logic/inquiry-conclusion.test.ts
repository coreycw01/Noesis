import assert from 'node:assert/strict';
import test from 'node:test';
import { INQUIRY_REVIEW_CRITERION_TITLE, latestInquiryReviewCriterion, replacedInquiryAnswer } from '../../src/lib/inquiry-state';

test('Conclude reads the latest saved, user-authored criterion', () => {
  assert.equal(latestInquiryReviewCriterion({ investigationNotes: [
    { id: 'ai', date: '', title: INQUIRY_REVIEW_CRITERION_TITLE, text: 'Suggested by AI', origin: 'ai-assisted' },
    { id: 'current', date: '', title: INQUIRY_REVIEW_CRITERION_TITLE, text: 'A repeated observation.', origin: 'user' },
    { id: 'earlier', date: '', title: INQUIRY_REVIEW_CRITERION_TITLE, text: 'An earlier criterion.', origin: 'user' },
  ] }), 'A repeated observation.');
});

test('a changed working answer preserves its predecessor and grounds', () => {
  const prior = { answer: 'Put the phone away.', resolutionSummary: 'It helped on tasks with a clear first step.' };
  assert.equal(replacedInquiryAnswer(prior, ' Put the phone away. '), '');
  assert.equal(replacedInquiryAnswer(prior, 'Only block interruptions.'), 'Put the phone away.\n\nWhat led to this answer: It helped on tasks with a clear first step.');
});
