import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { applyDemoChanges, applyDemoOverrides } from '../../src/lib/demo-session';

const uid = 'demo-regression';
const base = buildDemoWorkspace(uid);
const inquiry = base.questions[0];
const path = `users/${uid}/questions/${inquiry.id}`;

test('demo practice creation and inquiry backlink commit together', () => {
  const practicePath = `users/${uid}/practices/new-test`;
  const changes = [
    { path: practicePath, operation: 'create' as const, data: { id: 'new-test', title: 'A test', questionIds: [inquiry.id] } },
    { path, operation: 'update' as const, data: { practiceIds: ['new-test'] } },
  ];
  const next = applyDemoOverrides(base, applyDemoChanges(base, {}, uid, changes));
  assert.equal(next.practices.filter((practice) => practice.id === 'new-test').length, 1);
  assert.deepEqual(next.questions.find((question) => question.id === inquiry.id)?.practiceIds, ['new-test']);
  const original = {};
  assert.throws(() => applyDemoChanges(base, original, uid, [...changes, { path: `users/${uid}/questions/missing`, operation: 'update', data: {} }]));
  assert.deepEqual(original, {});
});

test('deleted seeded works do not reappear after serialization or overwrite recovery', () => {
  const draft = base.drafts[0];
  const draftPath = `users/${uid}/drafts/${draft.id}`;
  const deleted = applyDemoChanges(base, {}, uid, [{ path: draftPath, operation: 'delete' }]);
  assert.equal(applyDemoOverrides(base, JSON.parse(JSON.stringify(deleted))).drafts.some((item) => item.id === draft.id), false);
  const restored = applyDemoChanges(base, deleted, uid, [{ path: draftPath, operation: 'create', data: draft }]);
  assert.equal(applyDemoOverrides(base, restored).drafts.filter((item) => item.id === draft.id).length, 1);
});

test('demo edits survive serialization without changing seeded records', () => {
  const overrides = applyDemoChanges(base, {}, uid, [{ path, operation: 'update', data: { uncertainty: 'What would disprove this?', answer: 'A provisional answer.' } }]);
  const reopened = applyDemoOverrides(base, JSON.parse(JSON.stringify(overrides)));
  assert.equal(reopened.questions.find((item) => item.id === inquiry.id)?.uncertainty, 'What would disprove this?');
  assert.equal(reopened.questions.find((item) => item.id === inquiry.id)?.answer, 'A provisional answer.');
  assert.notEqual(inquiry.uncertainty, 'What would disprove this?');
});

test('demo deletion and restore preserve IDs and reject overwriting a live item', () => {
  const deleted = applyDemoChanges(base, {}, uid, [{ path, operation: 'delete' }]);
  assert.equal(applyDemoOverrides(base, deleted).questions.some((item) => item.id === inquiry.id), false);
  const restored = applyDemoChanges(base, deleted, uid, [{ path, operation: 'create', data: inquiry }]);
  assert.equal(applyDemoOverrides(base, restored).questions.filter((item) => item.id === inquiry.id).length, 1);
  assert.throws(() => applyDemoChanges(base, restored, uid, [{ path, operation: 'create', data: inquiry }]), /already exists/);
});

test('demo changes reject other accounts and nonexistent updates atomically', () => {
  const overrides = {};
  assert.throws(() => applyDemoChanges(base, overrides, uid, [
    { path, operation: 'update', data: { uncertainty: 'Unsaved' } },
    { path: 'users/other/questions/q1', operation: 'set', data: { id: 'q1' } },
  ]), /another workspace/);
  assert.deepEqual(overrides, {});
  assert.throws(() => applyDemoChanges(base, {}, uid, [{ path: `users/${uid}/questions/missing`, operation: 'update', data: {} }]), /no longer available/);
});

test('two genuine inquiries with matching titles remain separate in the demo', () => {
  const overrides = applyDemoChanges(base, {}, uid, ['first', 'second'].map((id) => ({
    path: `users/${uid}/questions/${id}`, operation: 'create' as const, data: { ...inquiry, id, text: 'A shared question' },
  })));
  assert.equal(applyDemoOverrides(base, overrides).questions.filter((item) => item.text === 'A shared question').length, 2);
});
