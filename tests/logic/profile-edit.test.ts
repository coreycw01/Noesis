import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareProfileReview, profileEditPatch } from '../../src/lib/profile-edit';
import type { UserProfile } from '../../src/lib/types';

const saved: UserProfile = {
  displayName: 'Thinker', email: 'private@example.test', bio: 'Original',
  avatarUrl: 'https://example.test/avatar.png', philosophyStatement: 'Saved statement', aiReviewHistory: [],
};

test('profile edits only patch changed authored fields, not AI or account fields', () => {
  const draft = { ...saved, bio: 'Revised', email: 'ignored@example.test', lastActiveDate: '2026-11-13' };
  const patch = profileEditPatch(saved, draft);
  assert.deepEqual(patch, { bio: 'Revised' });
  assert.deepEqual({ ...saved, philosophySynthesisReview: 'New AI review', ...patch }, {
    ...saved, bio: 'Revised', philosophySynthesisReview: 'New AI review',
  });
});

test('clearing a profile avatar and statement persists explicit empty values', () => {
  assert.deepEqual(profileEditPatch(saved, { ...saved, avatarUrl: '', philosophyStatement: '' }), {
    avatarUrl: '', photoURL: '', philosophyStatement: '',
  });
});

test('approving review findings alone does not rewrite or relabel the philosophy statement', async () => {
  const date = '2026-11-13T18:00:00Z';
  const content = '## Tensions\nKeep the tension open.';
  const { patch, record } = await prepareProfileReview('owner', saved, {
    action: 'synthesize_profile_philosophy', targetType: 'profile', targetId: 'owner',
    title: 'Review', content, generatedAt: date, reviewId: 'finding-only', contextSummary: '',
  }, content, date, date);
  assert.equal('philosophyStatement' in patch, false);
  assert.equal('philosophyStatementProvenance' in patch, false);
  assert.deepEqual(record.targets.map(({ fieldPath }) => fieldPath), ['aiReviewHistory.content']);
});
