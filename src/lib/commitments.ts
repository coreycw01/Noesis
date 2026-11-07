import type { CommitmentFrequency, GoalItem } from '@/lib/types';
import { localDateKey, recordDateKey } from './calendar';

export function localCommitmentDateKey(value = new Date()) {
  return localDateKey(value);
}

export function commitmentFrequencyDays(frequency?: CommitmentFrequency) {
  if (frequency === 'daily') return 1;
  if (frequency === 'monthly') return 30;
  if (frequency === 'custom') return 14;
  return 7;
}

export function completedCommitmentDates(item: GoalItem) {
  return [...new Set((item.commitmentCheckIns || [])
    .filter((entry) => entry.status === 'completed')
    .map((entry) => recordDateKey(entry.date))
    .filter(Boolean))];
}

export function commitmentDueToday(item: GoalItem, now = new Date()) {
  if (!['active', 'under_review', 'stalled'].includes(item.status)) return false;
  const todayKey = localCommitmentDateKey(now);
  if ((item.commitmentCheckIns || []).some((entry) => recordDateKey(entry.date) === todayKey)) return false;
  if (item.commitmentReviewDate && item.commitmentReviewDate <= todayKey) return true;
  const completedDates = completedCommitmentDates(item).sort();
  if (!completedDates.length) return true;
  // Compare calendar dates rather than local days that may be 23 or 25 hours.
  const last = Date.parse(`${completedDates[completedDates.length - 1]}T00:00:00Z`);
  const current = Date.parse(`${todayKey}T00:00:00Z`);
  const age = Number.isFinite(last) ? Math.floor((current - last) / 86_400_000) : Number.POSITIVE_INFINITY;
  return age >= commitmentFrequencyDays(item.commitmentFrequency);
}

export function commitmentExpectedDuration(item: GoalItem) {
  const started = Date.parse(item.createdAt || '');
  const review = Date.parse(item.commitmentReviewDate || '');
  if (Number.isFinite(started) && Number.isFinite(review) && review >= started) {
    return Math.max(1, Math.ceil((review - started) / 86_400_000) + 1);
  }
  return Math.max(1, item.targetProgress * commitmentFrequencyDays(item.commitmentFrequency));
}
