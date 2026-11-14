import assert from 'node:assert/strict';
import test from 'node:test';
import { localDateKey, previousCalendarDay } from '../../src/lib/calendar';
import { practiceCurrentStreak, practiceLogDates, practiceNeedsConsequence, practiceNeedsLog, practiceNeedsOutcome, practiceRecentlyConcluded, practiceScheduleState, practiceStartDateForSave } from '../../src/lib/practice-state';
import { hasPracticeIntellectualBasis, normalizePracticeStatusForSave } from '../../src/lib/workflow-integrity';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';

const now = new Date(2026, 10, 6, 10);
const practice = {
  ...buildDemoWorkspace('schedule-test').practices[0], status: 'active' as const,
  intellectualBasis: 'Attention needs deliberate protection.', hypothesis: 'A quiet interval reduces distraction.',
  action: 'Read without notifications.', observationMethod: 'Count interruptions.', expectedOutcome: 'At most two interruptions.',
  conceptTags: [], sourceIds: [], questionIds: [], positionIds: [], startDate: '', endDate: '', logs: [], logDates: [],
};

test('calendar keys follow the local day and cross daylight-saving boundaries by date', () => {
  assert.equal(localDateKey(new Date(2026, 10, 5, 23, 55)), '2026-11-05');
  assert.equal(previousCalendarDay('2026-03-09'), '2026-03-08');
  assert.equal(previousCalendarDay('2026-11-02'), '2026-11-01');
  assert.equal(previousCalendarDay('2026-01-01'), '2025-12-31');
  assert.equal(localDateKey(new Date('invalid')), '');
});

test('a written intellectual basis counts, while Unsorted Ideas does not satisfy setup', () => {
  assert.equal(hasPracticeIntellectualBasis(practice), true);
  assert.equal(normalizePracticeStatusForSave(practice), 'active');
  const placeholderOnly = { ...practice, intellectualBasis: '', conceptTags: ['Unsorted Ideas', ' '] };
  assert.equal(hasPracticeIntellectualBasis(placeholderOnly), false);
  assert.equal(normalizePracticeStatusForSave(placeholderOnly), 'planned');
});

test('planned and incomplete practices do not acquire an active start date', () => {
  assert.equal(practiceStartDateForSave({ ...practice, status: 'planned' }, now), '');
  assert.equal(practiceStartDateForSave({ ...practice, hypothesis: '' }, now), '');
  assert.equal(practiceStartDateForSave(practice, now), '2026-11-06');
  assert.equal(practiceStartDateForSave({ ...practice, startDate: '2026-11-10' }, now), '2026-11-10');
});

test('future and ended schedules never demand a daily log or change status', () => {
  const future = { ...practice, startDate: '2026-11-10' };
  const ended = { ...practice, endDate: '2026-11-05' };
  assert.equal(practiceScheduleState(future, now), 'scheduled');
  assert.equal(practiceNeedsLog(future, now), false);
  assert.equal(practiceScheduleState(ended, now), 'review');
  assert.equal(practiceNeedsLog(ended, now), false);
  assert.equal(ended.status, 'active');
  assert.equal(practiceNeedsLog({ ...practice, status: 'abandoned' }, now), false);
});

test('completed days count once and failed observations do not satisfy the daily action', () => {
  const failed = { ...practice, logs: [{ id: 'failed', date: '2026-11-06', actionCompleted: false }] };
  assert.equal(practiceNeedsLog(failed, now), true);
  const completed = { ...failed, logDates: ['2026-11-06T12:00:00Z'], logs: [...failed.logs, { id: 'done', date: '2026-11-06', actionCompleted: true }] };
  assert.deepEqual(practiceLogDates(completed), ['2026-11-06']);
  assert.equal(practiceNeedsLog(completed, now), false);
});

test('streaks remain intact before today is logged, but stop at a missed day', () => {
  assert.equal(practiceCurrentStreak(['2026-11-04', '2026-11-05'], now), 2);
  assert.equal(practiceCurrentStreak(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-06'], now), 3);
  assert.equal(practiceCurrentStreak(['2026-11-03', '2026-11-05'], now), 1);
  assert.equal(practiceCurrentStreak(['2026-11-04', '2026-11-07'], now), 0);
});

test('abandoned and integrated practices do not accumulate review obligations', () => {
  for (const status of ['abandoned', 'integrated'] as const) {
    const closed = { ...practice, status, conclusion: {}, observedOutcome: '', interpretation: '', effectOnPosition: '', notes: '', dateUpdated: now.toISOString() };
    assert.equal(practiceNeedsOutcome(closed), false);
    assert.equal(practiceNeedsConsequence(closed), false);
    assert.equal(practiceRecentlyConcluded(closed, now), false);
  }
  assert.equal(practiceRecentlyConcluded({ ...practice, status: 'completed', dateUpdated: '2026-12-01' }, now), false);
});
