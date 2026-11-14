import assert from 'node:assert/strict';
import test from 'node:test';
import { addedAiReviewEvent } from '../../src/lib/accepted-ai-event';

const existing = { id: 'existing', action: 'reflect_on_source', content: 'Original' };
const reviewed = { id: 'accepted', action: 'reflect_on_source', content: 'Do not copy into the event' };

test('accepted review events have stable identity and carry no reviewed text', () => {
  const event = addedAiReviewEvent([existing], [reviewed, existing]);
  assert.equal(event?.eventType, 'suggestion_accepted');
  assert.equal(event?.origin, 'ai-assisted');
  assert.equal(event?.idempotencyKey, 'ai-review-accepted');
  assert.equal(event?.metadata.reviewEntryId, reviewed.id);
  assert.doesNotMatch(JSON.stringify(event), /Do not copy/);
  assert.deepEqual(event, addedAiReviewEvent([existing], [existing, reviewed]));
});

test('review edits and removals are not new AI acceptances', () => {
  const edited = { ...existing, content: 'User revised this' };
  assert.equal(addedAiReviewEvent([existing], [edited]), null);
  assert.equal(addedAiReviewEvent([existing], []), null);
  assert.equal(addedAiReviewEvent(undefined, undefined), null);
});
