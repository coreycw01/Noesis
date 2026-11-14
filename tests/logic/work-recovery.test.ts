import assert from 'node:assert/strict';
import test from 'node:test';
import type { Draft } from '../../src/lib/types';
import { canApplyWorkRecovery, isNewerWorkVersion, makeWorkRecovery, readWorkRecovery, removeWorkRecovery, sameWorkVersion, writeWorkRecovery } from '../../src/lib/work-recovery';

const base = { id: 'work-1', title: 'A work', body: 'Saved', dateUpdated: '2026-11-13T00:00:00.000Z', revision: 2 } as Draft;

function tabStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}

test('an unsaved copy can be reopened only for its own account and document', () => {
  const storage = tabStorage();
  const recovery = makeWorkRecovery(base, { ...base, body: 'Unsaved', documentPages: [{ id: 'page-2', title: 'Next', content: '<p>More</p>' }] });
  assert.equal(writeWorkRecovery(storage, 'owner', recovery), true);
  assert.equal(readWorkRecovery(storage, 'other', base.id), null);
  assert.equal(readWorkRecovery(storage, 'owner', 'other-work'), null);
  const restored = readWorkRecovery(storage, 'owner', base.id);
  assert.deepEqual(restored, recovery);
  assert.ok(restored && canApplyWorkRecovery(base, restored));
  removeWorkRecovery(storage, 'owner', base.id);
  assert.equal(readWorkRecovery(storage, 'owner', base.id), null);
});

test('a newer revision or changed timestamp prevents applying an older local copy', () => {
  const recovery = makeWorkRecovery(base, { ...base, body: 'Unsaved' });
  assert.equal(canApplyWorkRecovery({ ...base, revision: 3 }, recovery), false);
  assert.equal(canApplyWorkRecovery({ ...base, dateUpdated: '2026-11-14' }, recovery), false);
});

test('a late store snapshot cannot replace an acknowledged save', () => {
  const acknowledged = { ...base, revision: 3 };
  assert.equal(isNewerWorkVersion({ ...base, dateUpdated: '2026-11-14' }, acknowledged), false);
  assert.equal(isNewerWorkVersion(acknowledged, acknowledged), false);
  assert.equal(isNewerWorkVersion({ ...base, revision: 4 }, acknowledged), true);
  assert.equal(isNewerWorkVersion({ ...acknowledged, dateUpdated: '2026-11-14' }, acknowledged), true);
  assert.equal(isNewerWorkVersion({ ...acknowledged, id: 'other', revision: 5 }, acknowledged), false);
  assert.equal(sameWorkVersion(base, acknowledged), false);
});

test('oversized copies and corrupt browser storage fail without clearing prior recovery data', () => {
  const storage = tabStorage();
  const original = makeWorkRecovery(base, { ...base, body: 'Unsaved' });
  assert.equal(writeWorkRecovery(storage, 'owner', original), true);
  assert.equal(writeWorkRecovery(storage, 'owner', makeWorkRecovery(base, { ...base, body: 'x'.repeat(750_000) })), false);
  assert.deepEqual(readWorkRecovery(storage, 'owner', base.id), original);
  assert.equal(readWorkRecovery({ ...storage, getItem: () => '{' }, 'owner', base.id), null);
});
