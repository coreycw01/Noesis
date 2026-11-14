import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase/firestore';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { homeHistoryTarget, recentHomeHistory } from '../../src/lib/home-history';
import { weeklyReviewEvents } from '../../src/lib/weekly-review';

const demo = buildDemoWorkspace('today-test');
const base = demo.thinkingEvents[0];

test('Today sorts mixed timestamp and legacy history without counting mirrored events twice', () => {
  const event = { ...base, createdAt: Timestamp.fromDate(new Date('2026-11-12T10:00:00Z')) as unknown as string };
  const mirror = { ...demo.timeline[0], date: '2026-11-12T10:00:00Z' };
  const later = { ...demo.timeline[1], date: '2026-11-13T10:00:00Z' };
  assert.deepEqual(recentHomeHistory([event], [mirror, later]).map(({ event }) => event.id), [later.id, base.id]);
  assert.deepEqual(weeklyReviewEvents([event], Date.parse('2026-11-13T12:00:00Z')), [event]);
});

test('Today uses annotation source identity and falls back to history if the annotation is gone', () => {
  const [source] = demo.media;
  const [annotation] = source.annotations;
  const event = { ...base, entityType: 'annotation' as const, entityId: annotation.id, relatedEntityIds: { sourceIds: [source.id] } };
  const other = { ...source, id: 'different-source' };
  assert.deepEqual(homeHistoryTarget(event, [source, other]), { view: 'annotations', targetId: annotation.id, annotationSourceId: source.id });
  assert.deepEqual(homeHistoryTarget(event, [other]), { view: 'evolution' });
});
