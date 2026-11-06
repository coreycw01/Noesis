import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { applyDemoChanges, applyDemoOverrides } from '../../src/lib/demo-session';

const uid = 'demo-regression';
const base = buildDemoWorkspace(uid);
const inquiry = base.questions[0];
const path = `users/${uid}/questions/${inquiry.id}`;

test('demo profile saves support the owning account identity without allowing another account', () => {
  const overrides = applyDemoChanges(base, {}, uid, [
    { path: `users/${uid}`, operation: 'set', merge: true, data: { displayName: 'Updated thinker' } },
    { path: `users/${uid}/profile/main`, operation: 'set', merge: true, data: { displayName: 'Updated thinker' } },
  ]);
  const restored = applyDemoOverrides(base, JSON.parse(JSON.stringify(overrides)));
  assert.equal(restored.userIdentity?.displayName, 'Updated thinker');
  assert.equal(restored.profile.displayName, 'Updated thinker');
  assert.throws(() => applyDemoChanges(base, {}, uid, [{ path: 'users/another-account', operation: 'set', data: {} }]), /another workspace/);
});

test('demo updates records with domain-specific identifiers without duplication', () => {
  const unknown = base.unknowns[0];
  const overrides = applyDemoChanges(base, {}, uid, [{ path: `users/${uid}/unknowns/${unknown.unknownId}`, operation: 'update', data: { status: 'resolved', resolutionSummary: 'A working distinction.' } }]);
  const restored = applyDemoOverrides(base, overrides);
  assert.equal(restored.unknowns.length, base.unknowns.length);
  assert.equal(restored.unknowns.find((item) => item.unknownId === unknown.unknownId)?.status, 'resolved');
});

test('source capture and first-class annotation writes commit together in the demo', () => {
  const source = base.media[0];
  const annotation = { id: 'captured-passage', text: 'A passage worth examining', type: 'thought', date: '2026-11-06' };
  const overrides = applyDemoChanges(base, {}, uid, [
    { path: `users/${uid}/media/${source.id}`, operation: 'update', data: { annotations: [annotation, ...source.annotations] } },
    { path: `users/${uid}/annotations/${annotation.id}`, operation: 'set', data: { ...annotation, sourceId: source.id } },
  ]);
  const restored = applyDemoOverrides(base, JSON.parse(JSON.stringify(overrides)));
  assert.equal(restored.media[0].annotations[0].text, annotation.text);
  assert.equal(restored.annotations?.find((item) => item.id === annotation.id)?.sourceId, source.id);
});

test('demo supports only the named related history collections', () => {
  const overrides = applyDemoChanges(base, {}, uid, [
    { path: `users/${uid}/practiceLogs/log-1`, operation: 'set', data: { practiceId: base.practices[0].id } },
    { path: `users/${uid}/positionVersions/version-1`, operation: 'set', data: { positionId: base.vault[0].id } },
  ]);
  const restored = applyDemoOverrides(base, overrides);
  assert.equal(restored.practiceLogs?.length, 1);
  assert.equal(restored.positionVersions?.length, 1);
  assert.throws(() => applyDemoChanges(base, {}, uid, [{ path: `users/${uid}/arbitrary/id`, operation: 'set', data: {} }]), /not supported/);
});

test('saving a demo work and its first revision persists both atomically', () => {
  const draft = base.drafts[0];
  const changes = [
    { path: `users/${uid}/drafts/${draft.id}`, operation: 'update' as const, data: { body: 'A revised passage', documentPages: [{ id: 'second', title: 'Page 2', content: '<p>A second page</p>' }] } },
    { path: `users/${uid}/workRevisions/revision-1`, operation: 'set' as const, data: { workId: draft.id, body: 'A revised passage' } },
  ];
  const overrides = applyDemoChanges(base, {}, uid, changes);
  const reopened = applyDemoOverrides(base, JSON.parse(JSON.stringify(overrides)));
  assert.equal(reopened.drafts.find((item) => item.id === draft.id)?.body, 'A revised passage');
  assert.equal(reopened.drafts.find((item) => item.id === draft.id)?.documentPages?.[0].id, 'second');
  assert.equal(reopened.workRevisions?.[0].workId, draft.id);
  assert.throws(() => applyDemoChanges(base, {}, uid, [...changes, { path: `users/${uid}/unrecognized/id`, operation: 'set', data: {} }]), /not supported/);
  assert.equal(base.drafts.find((item) => item.id === draft.id)?.body, draft.body);
});

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
