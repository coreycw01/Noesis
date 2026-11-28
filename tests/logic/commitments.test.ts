import assert from 'node:assert/strict';
import test from 'node:test';
import { millisecondsUntilLocalMidnight, localDateKey } from '../../src/lib/calendar';

test('the commitment day clock targets the next local date at midnight', () => {
  const now = new Date(2026, 10, 14, 23, 59, 59, 800);
  const delay = millisecondsUntilLocalMidnight(now);
  assert.equal(delay, 200);
  assert.equal(localDateKey(new Date(now.getTime() + delay)), '2026-11-15');
});
import {
  commitmentActivityToDate,
  commitmentGaugeReadings,
  commitmentDueToday,
  commitmentExpectedDuration,
  commitmentFrequencyDays,
  commitmentPlanReadings,
  commitmentReviewDue,
  completedCommitmentDates,
} from '../../src/lib/commitments';

import type { GoalItem } from '../../src/lib/types';
import { applyGoalCheckIn, applyGoalPlan } from '../../src/lib/goal-persistence';

function commitment(overrides: Partial<GoalItem> = {}): GoalItem {
  return {
    id: 'commitment-1',
    title: 'Practice deliberate attention',
    typeId: 'practice',
    goalKind: 'practice',
    currentProgress: 0,
    targetProgress: 10,
    sortOrder: 0,
    status: 'active',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

test('automatic commitments reject check-ins and manual pacing uses only user logs', () => {
  const automatic = commitment({ commitmentTracking: 'automatic' });
  const manual = commitment({ commitmentTracking: 'manual', commitmentFrequency: 'daily' });
  const checkIn = { id: 'logged', date: '2026-10-02', day: '2026-10-02', status: 'completed' as const };
  const settings = { label: 'Commitments', types: [], targets: {}, goals: [automatic] };
  assert.throws(() => applyGoalCheckIn(settings, automatic.id, checkIn), /do not take check-ins/);
  const saved = applyGoalCheckIn({ ...settings, goals: [manual] }, manual.id, checkIn).goals![0];
  assert.equal(commitmentActivityToDate(saved, ['2026-10-01', '2026-10-02'], new Date(2026, 9, 2, 12)).loggedDays, 1);
});

test('the gauge browses recorded dates and recomputes the amount expected at each point', () => {
  const item = commitment({
    createdAt: '2026-10-01',
    commitmentFrequency: 'daily',
    commitmentCheckIns: [
      { id: 'kept', date: '2026-10-01', status: 'completed' },
      { id: 'skip', date: '2026-10-03', status: 'skipped' },
      { id: 'future', date: '2026-10-08', status: 'completed' },
    ],
  });
  const readings = commitmentGaugeReadings(item, ['2026-10-01', '2026-10-04'], new Date('2026-10-05T12:00:00'));
  assert.deepEqual(readings.map(({ day, loggedDays, expectedSoFar }) => [day, loggedDays, expectedSoFar]), [
    ['2026-10-01', 1, 1], ['2026-10-03', 1, 3], ['2026-10-04', 2, 4], ['2026-10-05', 2, 5],
  ]);
});

test('Say / Do compares the date-paced manual plan against distinct completed check-ins only', () => {
  const manual = commitment({
    createdAt: '2026-10-01', commitmentTracking: 'manual', commitmentFrequency: 'daily', targetProgress: 30,
    commitmentPositionId: 'a-position', relatedObjectIds: { practiceIds: ['a-practice'] },
    commitmentCheckIns: [
      { id: 'early', date: '2026-09-30', status: 'completed' },
      { id: 'first', date: '2026-10-01', status: 'completed' },
      { id: 'duplicate', date: '2026-10-01', status: 'completed' },
      { id: 'skip', date: '2026-10-02', status: 'skipped' },
      { id: 'future', date: '2026-10-03', status: 'completed' },
    ],
  });
  const progress = { currentProgress: 99, targetProgress: 30 };
  assert.deepEqual(commitmentPlanReadings(manual, progress, new Date(2026, 9, 2, 12)), [
    { day: '2026-10-01', planned: 1, recorded: 1 },
    { day: '2026-10-02', planned: 2, recorded: 1 },
  ]);
  assert.deepEqual(commitmentPlanReadings(manual, progress, new Date(2026, 8, 29, 12)), [{ day: '2026-09-29', planned: 0, recorded: 0 }]);
});

test('automatic and legacy Say / Do use the displayed progress without inventing check-in history', () => {
  const now = new Date(2026, 9, 2, 12);
  const progress = { currentProgress: 4, targetProgress: 10 };
  for (const tracking of ['automatic', undefined] as const) {
    assert.deepEqual(commitmentPlanReadings(commitment({ commitmentTracking: tracking }), progress, now), [{ day: '2026-10-02', planned: 10, recorded: 4 }]);
  }
  assert.deepEqual(commitmentPlanReadings(commitment({ targetProgress: 0 }), progress, now), []);
});

test('plan saves preserve concurrent check-ins but reject a stale plan edit', () => {
  const goal = commitment();
  const baseline = { label: 'Commitments', types: [], targets: {}, goals: [goal] };
  const checkIn = { id: 'done', date: '2026-10-17T02:00:00.000Z', day: '2026-10-16', status: 'completed' as const };
  const current = applyGoalCheckIn(baseline, goal.id, checkIn);
  const draft = { ...baseline, goals: [{ ...goal, title: 'A better action' }] };
  const saved = applyGoalPlan(draft, baseline, current);
  assert.equal(saved.goals?.[0].title, 'A better action');
  assert.deepEqual(saved.goals?.[0].commitmentCheckIns, [checkIn]);
  assert.throws(() => applyGoalPlan(baseline, baseline, saved), /changed in another/);
});

test('check-ins retain the recorded local day and reject another check-in for it', () => {
  const goal = commitment({ commitmentFrequency: 'daily' });
  const settings = { label: 'Commitments', types: [], targets: {}, goals: [goal] };
  const checkIn = { id: 'first', date: '2026-10-17T02:00:00.000Z', day: '2026-10-16', status: 'completed' as const };
  const saved = applyGoalCheckIn(settings, goal.id, checkIn);
  assert.deepEqual(completedCommitmentDates(saved.goals![0]), ['2026-10-16']);
  assert.equal(commitmentDueToday(saved.goals![0], new Date('2026-10-16T23:00:00')), false);
  assert.equal(commitmentDueToday(saved.goals![0], new Date('2026-10-17T00:01:00')), true);
  assert.throws(() => applyGoalCheckIn(saved, goal.id, { ...checkIn, id: 'duplicate' }), /already has a check-in/);
  assert.throws(() => applyGoalCheckIn(saved, goal.id, { ...checkIn, id: 'invalid', day: '2026-02-30' }), /not due/);
});

test('Say/Do counts completed days only within the commitment window and paces across midnight', () => {
  const item = commitment({
    createdAt: '2026-10-01T23:50:00',
    commitmentFrequency: 'daily',
    targetProgress: 30,
    commitmentCheckIns: [
      { id: 'done', date: '2026-10-01', status: 'completed' },
      { id: 'skip', date: '2026-10-02', status: 'skipped' },
      { id: 'future', date: '2026-10-03', status: 'completed' },
    ],
  });
  assert.deepEqual(commitmentActivityToDate(item, ['2026-09-30', '2026-10-01', '2026-10-04'], new Date('2026-10-02T00:15:00')), {
    loggedDays: 1, expectedSoFar: 2, livedPercent: 50,
  });
});

test('a commitment is due until the user records a check-in for the local day', () => {
  const now = new Date('2026-10-17T12:00:00');
  assert.equal(commitmentDueToday(commitment({ commitmentFrequency: 'daily' }), now), true);
  assert.equal(commitmentDueToday(commitment({
    commitmentFrequency: 'daily',
    commitmentCheckIns: [{ id: 'entry-1', date: '2026-10-17T10:00:00', status: 'completed' }],
  }), now), false);
  assert.equal(commitmentDueToday(commitment({
    commitmentFrequency: 'daily',
    commitmentCheckIns: [{ id: 'entry-1', date: '2026-10-17T10:00:00', status: 'skipped', note: 'Travel day' }],
  }), now), false);
});

test('weekly commitments return only after the cadence has elapsed', () => {
  const base = commitment({
    commitmentFrequency: 'weekly',
    commitmentCheckIns: [{ id: 'entry-1', date: '2026-10-10T12:00:00', status: 'completed' }],
  });
  assert.equal(commitmentDueToday(base, new Date('2026-10-16T12:00:00')), false);
  assert.equal(commitmentDueToday(base, new Date('2026-10-17T12:00:00')), true);
});

test('a skipped occurrence delays the next action without earning progress', () => {
  const item = commitment({ commitmentFrequency: 'weekly', commitmentCheckIns: [
    { id: 'skip', date: '2026-10-17', status: 'skipped' },
    { id: 'future', date: '2026-12-01', status: 'skipped' },
  ] });
  assert.equal(commitmentDueToday(item, new Date(2026, 9, 18)), false);
  assert.equal(commitmentDueToday(item, new Date(2026, 9, 24)), true);
  assert.deepEqual(completedCommitmentDates(item), []);
});

test('reviews and paused commitments do not create unscheduled action check-ins', () => {
  const now = new Date(2026, 9, 17, 12);
  const item = commitment({ commitmentFrequency: 'weekly', commitmentReviewDate: '2026-10-16', commitmentCheckIns: [
    { id: 'done', date: '2026-10-15', status: 'completed' },
  ] });
  assert.equal(commitmentDueToday(item, now), false);
  assert.equal(commitmentReviewDue(item, now), true);
  assert.equal(commitmentReviewDue({ ...item, lastReviewAt: '2026-10-16' }, now), false);
  assert.equal(commitmentDueToday({ ...item, status: 'stalled', commitmentCheckIns: [] }, now), false);
  assert.equal(commitmentReviewDue({ ...item, status: 'stalled' }, now), true);
});

test('completed check-ins count unique local days only', () => {
  assert.deepEqual(completedCommitmentDates(commitment({
    commitmentCheckIns: [
      { id: 'entry-1', date: '2026-10-15T08:00:00', status: 'completed' },
      { id: 'entry-2', date: '2026-10-15T18:00:00', status: 'completed' },
      { id: 'entry-3', date: '2026-10-16T08:00:00', status: 'skipped' },
    ],
  })), ['2026-10-15']);
});

test('expected duration respects an explicit review date and otherwise follows cadence', () => {
  assert.equal(commitmentExpectedDuration(commitment({ commitmentReviewDate: '2026-10-30' })), 30);
  assert.equal(commitmentExpectedDuration(commitment({ targetProgress: 8, commitmentFrequency: 'weekly' })), 56);
  assert.equal(commitmentFrequencyDays('monthly'), 30);
});

test('date-only check-ins preserve their chosen day and ignore malformed dates', () => {
  const item = commitment({ commitmentFrequency: 'daily', commitmentCheckIns: [
    { id: 'date-only', date: '2026-11-06', status: 'completed' },
    { id: 'bad', date: 'invalid', status: 'completed' },
    { id: 'bad-calendar-day', date: '2026-02-30', status: 'completed' },
  ] });
  assert.deepEqual(completedCommitmentDates(item), ['2026-11-06']);
  assert.equal(commitmentDueToday(item, new Date(2026, 10, 6, 0, 15)), false);
});

test('weekly reminders become due at the local calendar boundary across daylight saving', () => {
  const item = commitment({ commitmentFrequency: 'weekly', commitmentCheckIns: [{ id: 'before-dst', date: '2026-03-08', status: 'completed' }] });
  assert.equal(commitmentDueToday(item, new Date(2026, 2, 14, 23, 59)), false);
  assert.equal(commitmentDueToday(item, new Date(2026, 2, 15, 0, 15)), true);
});
