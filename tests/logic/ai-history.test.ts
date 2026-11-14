import assert from 'node:assert/strict';
import test from 'node:test';
import { profileSynthesisPatch, resolvedAiHistory, type AiReviewResult } from '../../src/lib/contextual-ai';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import type { AiAssistedHistoryEntry } from '../../src/lib/types';

const legacy: AiAssistedHistoryEntry = { id: 'legacy', action: 'synthesize_profile_philosophy', title: 'Review', content: 'Earlier review', date: '2026-11-06' };
const result: AiReviewResult = { action: 'synthesize_profile_philosophy', targetType: 'profile', targetId: 'test', title: 'Philosophy review', content: '', contextSummary: '', generatedAt: '2026-11-06' };

test('legacy AI notes remain available until history is explicitly managed', () => {
  assert.deepEqual(resolvedAiHistory(undefined, legacy), [legacy]);
  assert.deepEqual(resolvedAiHistory(undefined, { ...legacy, content: ' ' }), []);
});

test('deleting the last AI note does not resurrect its legacy copy', () => {
  assert.deepEqual(resolvedAiHistory([], legacy), []);
  const edited = { ...legacy, content: 'My edited review' };
  assert.deepEqual(resolvedAiHistory([edited], legacy), [edited]);
});

test('accepted profile synthesis changes only its intended fields, not identity or sharing', () => {
  const profile = buildDemoWorkspace('profile-review-test').profile;
  const patch = profileSynthesisPatch(profile, result, '## Working statement\nProtect dignity while revising beliefs.', '2026-11-06T12:00:00Z');
  assert.equal(patch.philosophyStatement, 'Protect dignity while revising beliefs.');
  assert.equal(patch.aiReviewHistory?.at(-1)?.content, '## Working statement\nProtect dignity while revising beliefs.');
  assert.deepEqual(Object.keys(patch).sort(), ['aiReviewHistory', 'dateUpdated', 'philosophyStatement', 'philosophySynthesisReview', 'philosophySynthesisReviewedAt'].sort());
  const draft = { ...profile, displayName: 'An unsaved name' };
  assert.equal(({ ...profile, ...patch }).displayName, profile.displayName);
  assert.equal(({ ...draft, ...patch }).displayName, 'An unsaved name');
});

test('a review without an approved working statement never clears the current philosophy', () => {
  const profile = buildDemoWorkspace('profile-review-test').profile;
  const patch = profileSynthesisPatch(profile, result, '## Tensions\nTry another perspective.');
  assert.equal(Object.hasOwn(patch, 'philosophyStatement'), false);
});
