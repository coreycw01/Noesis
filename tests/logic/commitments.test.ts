import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commitmentDueToday,
  commitmentExpectedDuration,
  commitmentFrequencyDays,
  completedCommitmentDates,
} from '../../src/lib/commitments';
import type { GoalItem } from '../../src/lib/types';

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
