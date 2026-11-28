import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { appendPracticeObservation, changePracticeCheckIn, practiceCheckInForDay, recordQuickPracticeCheckIn, savedPracticeCheckIns } from '../../src/lib/practice-observations';

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

test('an ended practice accepts a late check-in from its run and keeps the written review separate', () => {
  const now = '2026-11-25';
  const practice = { ...buildDemoWorkspace('test').practices[0], status: 'concluded' as const, startDate: '2026-11-20', endDate: '2026-11-22', logs: [], logDates: [], observedOutcome: 'My review.' };
  const next = changePracticeCheckIn(practice, { kind: 'add', day: '2026-11-21', kept: true, note: 'Forgot to check in.' }, now, now);
  assert.equal(practiceCheckInForDay(next, '2026-11-21'), 'kept');
  assert.equal(next.logs?.[0].observations, 'Forgot to check in.');
  assert.equal(next.observedOutcome, 'My review.');
  assert.equal(next.status, 'concluded');
  assert.throws(() => changePracticeCheckIn(next, { kind: 'add', day: '2026-11-21', kept: false, note: '' }, now, now), /already has a check-in/);
  for (const day of ['2026-11-19', '2026-11-24', '2026-11-26']) {
    assert.throws(() => changePracticeCheckIn(next, { kind: 'add', day, kept: false, note: '' }, now, now), /within the practice run/);
  }
});

test('editing and deleting check-ins recalculate kept days without dropping unrelated legacy dates', () => {
  const now = '2026-11-25';
  const practice = { ...buildDemoWorkspace('test').practices[0], logDates: ['2026-11-20', '2026-11-21'], logs: [{ id: 'entry', date: '2026-11-21', actionCompleted: true, outcome: 'old note' }] };
  const edited = changePracticeCheckIn(practice, { kind: 'edit', id: 'entry', kept: false, note: 'corrected' }, now, now);
  assert.equal(practiceCheckInForDay(edited, '2026-11-21'), 'missed');
  assert.deepEqual(edited.logDates, ['2026-11-20']);
  assert.equal(edited.logs?.[0].outcome, '');
  assert.equal(edited.logs?.[0].observations, 'corrected');
  const deleted = changePracticeCheckIn(edited, { kind: 'delete', id: 'entry' }, now, now);
  assert.equal(practiceCheckInForDay(deleted, '2026-11-21'), null);
  assert.equal(practiceCheckInForDay(deleted, '2026-11-20'), 'kept');
  const legacy = savedPracticeCheckIns(deleted)[0];
  assert.deepEqual(changePracticeCheckIn(deleted, { kind: 'delete', id: legacy.id }, now, now).logDates, []);
});
