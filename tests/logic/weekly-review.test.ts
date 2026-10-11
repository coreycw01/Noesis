import test from 'node:test';
import assert from 'node:assert/strict';
import type { ThinkingEvent } from '../../src/lib/types';
import { weeklyReviewEvents } from '../../src/lib/weekly-review';

test('weekly review uses unique recorded milestones within the selected week', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const event = { id: 'one', eventId: 'one', eventType: 'position_revised', importance: 'high', createdAt: '2026-10-10T12:00:00Z' } as ThinkingEvent;
  const events = [event, event, { ...event, id: 'old', eventId: 'old', createdAt: '2026-09-01' }, { ...event, id: 'future', eventId: 'future', createdAt: '2026-10-12' }, { ...event, id: 'deleted', eventId: 'deleted', eventType: 'deleted' as const }, { ...event, id: 'low', eventId: 'low', importance: 'low' as const }];
  assert.deepEqual(weeklyReviewEvents(events, now).map((item) => item.id), ['one']);
  assert.equal(events.length, 6);
});
