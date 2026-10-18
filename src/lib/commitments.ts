import type { CommitmentFrequency, GoalItem } from '@/lib/types';

export function localCommitmentDateKey(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
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
    .map((entry) => localCommitmentDateKey(new Date(entry.date)))
    .filter(Boolean))];
}

export function commitmentDueToday(item: GoalItem, now = new Date()) {
  if (!['active', 'under_review', 'stalled'].includes(item.status)) return false;
  const todayKey = localCommitmentDateKey(now);
  if ((item.commitmentCheckIns || []).some((entry) => localCommitmentDateKey(new Date(entry.date)) === todayKey)) return false;
  if (item.commitmentReviewDate && item.commitmentReviewDate <= todayKey) return true;
  const completedDates = completedCommitmentDates(item).sort();
  if (!completedDates.length) return true;
  const last = Date.parse(`${completedDates[completedDates.length - 1]}T00:00:00`);
  const age = Number.isFinite(last) ? Math.floor((now.getTime() - last) / 86_400_000) : Number.POSITIVE_INFINITY;
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
