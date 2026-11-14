import assert from 'node:assert/strict';
import test from 'node:test';
import { recentRecoverableDeletions, restoredItemHistorySnapshot, sourceRecoveryAnnotations } from '../../src/lib/deleted-items';
import type { ThinkingEvent } from '../../src/lib/types';

const now = Date.parse('2026-11-13T12:00:00Z');

test('restore history keeps provenance pointers and does not copy recovered private text', () => {
  const textProvenance = { kind: 'ai-assisted', provenanceId: 'ai-review' };
  const annotationOrigins = [{ annotationId: 'annotation', provenance: textProvenance }];
  const recovered = { id: 'annotation', text: 'private', textProvenance, annotationOrigins,
    aiReviewHistory: [{ content: 'private review' }] };
  assert.deepEqual(JSON.parse(JSON.stringify(restoredItemHistorySnapshot(recovered))),
    { id: 'annotation', textProvenance, annotationOrigins });
  assert.equal(recovered.text, 'private');
});
function event(id: string, eventType: ThinkingEvent['eventType'], daysAgo: number, entityId = 'work'): ThinkingEvent {
  return { id, eventId: id, entityType: 'work', entityId, eventType, userId: 'test', targetType: 'work', targetId: entityId,
    sourceType: 'user', origin: 'user', summary: id, before: { id: entityId }, createdAt: new Date(now - daysAgo * 86_400_000).toISOString() };
}

test('a second deletion after restore is recoverable and older snapshots are not offered', () => {
  const first = event('first', 'deleted', 3);
  const restored = event('restored', 'restored', 2);
  const second = event('second', 'deleted', 1);
  assert.deepEqual(recentRecoverableDeletions([first, restored, second], now), [second]);
  assert.deepEqual(recentRecoverableDeletions([restored, first], now), []);
});

test('expiry, replacement records and missing snapshots are not offered for recovery', () => {
  assert.deepEqual(recentRecoverableDeletions([
    event('expired', 'deleted', 31, 'old'), event('future', 'deleted', -1, 'future'),
    event('deleted', 'deleted', 2), event('recreated', 'created', 1),
    { ...event('unavailable', 'deleted', 0, 'unavailable'), before: null },
  ], now), []);
});

test('legacy source snapshots rebuild unique annotation records for the restored source', () => {
  const records = sourceRecoveryAnnotations({ annotations: [
    { id: 'note', text: 'Earlier snapshot' },
    { id: 'note', text: 'Latest snapshot', sourceId: 'wrong-source', userId: 'wrong-owner' },
    { id: 'bad/path', text: 'Invalid id' },
    { id: 'empty' },
    null,
  ] }, 'source', 'owner');
  assert.deepEqual(records.map(({ id, text, sourceId, userId }) => ({ id, text, sourceId, userId })), [
    { id: 'note', text: 'Latest snapshot', sourceId: 'source', userId: 'owner' },
  ]);
});

test('legacy annotation deletions remain recoverable and matching restores are source-scoped', () => {
  const legacy: ThinkingEvent = {
    ...event('deleted-note', 'abandoned', 2, 'note'),
    entityType: 'annotation', summary: 'Deleted annotation.',
    relatedEntityIds: { sourceIds: ['source-a'] }, before: { id: 'note', text: 'A saved passage' },
  };
  const unrelatedRestore: ThinkingEvent = {
    ...legacy, id: 'other-restore', eventType: 'restored',
    relatedEntityIds: { sourceIds: ['source-b'] }, createdAt: event('time', 'restored', 1).createdAt,
  };
  assert.deepEqual(recentRecoverableDeletions([legacy, unrelatedRestore], now), [{ ...legacy, eventType: 'deleted' }]);
  assert.deepEqual(recentRecoverableDeletions([legacy, { ...unrelatedRestore, relatedEntityIds: legacy.relatedEntityIds }], now), []);
  assert.deepEqual(recentRecoverableDeletions([
    { ...legacy, summary: 'Abandoned annotation.' },
    { ...legacy, relatedEntityIds: { sourceIds: ['source-a', 'source-b'] } },
    { ...legacy, before: { id: 'note' } },
  ], now), []);
});
