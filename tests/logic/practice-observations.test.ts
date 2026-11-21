import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { appendPracticeObservation, practiceCheckInForDay, recordQuickPracticeCheckIn } from '../../src/lib/practice-observations';

test('practice observations count completed days, not attempts, and never start a schedule', () => {
  const practice = { ...buildDemoWorkspace('test').practices[0], status: 'planned' as const, logs: [], logDates: [] };
  const first = appendPracticeObservation(practice, { id: 'one', date: '2026-11-06', actionCompleted: true, outcome: 'Started the task first.' }, '2026-11-06');
  const second = appendPracticeObservation(first, { id: 'two', date: '2026-11-06', actionCompleted: true }, '2026-11-06');
  const third = appendPracticeObservation(second, { id: 'three', date: '2026-11-07', actionCompleted: false, outcome: 'Noticed a competing obligation.' }, '2026-11-07');
  assert.equal(third.status, 'planned');
  assert.equal(third.startDate, practice.startDate);
  assert.equal(third.logs?.length, 3);
  assert.deepEqual(third.logDates, ['2026-11-06']);
  assert.equal(third.observedOutcome, 'Noticed a competing obligation.');
  assert.equal(appendPracticeObservation(third, { id: 'three', date: '2026-11-07', actionCompleted: false }, '2026-11-07'), third);
});

test('Today check-in updates the daily log without overwriting a practice result', () => {
  const day = '2026-11-21';
  const practice = { ...buildDemoWorkspace('test').practices[0], status: 'active' as const, startDate: '2026-11-20', endDate: '2026-11-22', logDates: ['2026-11-20'], logs: [], observedOutcome: 'My earlier reflection.' };
  const next = recordQuickPracticeCheckIn(practice, day);
  assert.ok(next);
  assert.deepEqual(next.logs, [{ id: 'check-in-2026-11-21', date: day, actionCompleted: true }]);
  assert.deepEqual(next.logDates, ['2026-11-20', day]);
  assert.equal(next.observedOutcome, practice.observedOutcome);
  assert.equal(practiceCheckInForDay(next, day), 'kept');
  assert.equal(recordQuickPracticeCheckIn(next, day), null);
  assert.equal(recordQuickPracticeCheckIn(practice, '2026-11-20'), null);
});

test('Today cannot log before or after a run, while paused, or over a missed entry', () => {
  const practice = { ...buildDemoWorkspace('test').practices[0], status: 'active' as const, startDate: '2026-11-20', endDate: '2026-11-22', logDates: [], logs: [{ id: 'missed', date: '2026-11-21', actionCompleted: false }] };
  assert.equal(recordQuickPracticeCheckIn(practice, '2026-11-19'), null);
  assert.equal(recordQuickPracticeCheckIn(practice, '2026-11-23'), null);
  assert.equal(recordQuickPracticeCheckIn({ ...practice, status: 'paused' }, '2026-11-22'), null);
  assert.equal(practiceCheckInForDay(practice, '2026-11-21'), 'missed');
  assert.equal(recordQuickPracticeCheckIn(practice, '2026-11-21'), null);
});
