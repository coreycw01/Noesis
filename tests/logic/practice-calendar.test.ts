import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceCalendarDate, practiceScheduleState } from '../../src/lib/practice-state';

test('practice fields and schedule use the recorded calendar date without shifting time zones', () => {
  const legacyStart = '2026-06-23T23:55:00.000Z';
  assert.equal(practiceCalendarDate(legacyStart), '2026-06-23');
  assert.equal(practiceCalendarDate('2026-06-29'), '2026-06-29');
  assert.equal(practiceCalendarDate('2026-02-30'), '');
  assert.equal(practiceCalendarDate(), '');
  const practice = { status: 'active' as const, startDate: legacyStart, endDate: '2026-06-29T00:01:00.000Z' };
  assert.equal(practiceScheduleState(practice, new Date(2026, 5, 22, 12)), 'scheduled');
  assert.equal(practiceScheduleState(practice, new Date(2026, 5, 29, 12)), 'running');
  assert.equal(practiceScheduleState(practice, new Date(2026, 5, 30, 12)), 'review');
});
