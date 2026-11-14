import type { CommitmentCheckIn, CommitmentFrequency, GoalItem } from '@/lib/types';
import { localDateKey, recordDateKey } from './calendar';
import { expectedCommitmentProgress } from './workflow-integrity';

export function localCommitmentDateKey(value = new Date()) {
  return localDateKey(value);
}

export function commitmentPositionIds(item: Pick<GoalItem, 'commitmentPositionId' | 'relatedObjectIds'>): string[] {
  if (item.commitmentPositionId === undefined) return item.relatedObjectIds?.positionIds ?? [];
  return item.commitmentPositionId ? [item.commitmentPositionId] : [];
}

export function commitmentPositionFocusPatch(item: Pick<GoalItem, 'commitmentPositionId' | 'relatedObjectIds'>, positionId: string | null) {
  // Preserve the old grounding before changing the formerly shared count filter.
  return {
    commitmentPositionId: item.commitmentPositionId === undefined ? commitmentPositionIds(item)[0] ?? null : item.commitmentPositionId,
    relatedObjectIds: { ...item.relatedObjectIds, positionIds: positionId ? [positionId] : [] },
  };
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
    .map(commitmentCheckInDay)
    .filter(Boolean))];
}

export function commitmentCheckInDay(entry: CommitmentCheckIn) {
  if (entry.day !== undefined) {
    return /^\d{4}-\d{2}-\d{2}$/.test(entry.day) ? recordDateKey(entry.day) : '';
  }
  return recordDateKey(entry.date);
}

export function withCommitmentCheckIn(item: GoalItem, checkIn: CommitmentCheckIn): GoalItem {
  const day = commitmentCheckInDay(checkIn);
  if (!day) throw new Error('The check-in needs a valid date.');
  return {
    ...item,
    commitmentCheckIns: [...(item.commitmentCheckIns || []).filter((entry) => commitmentCheckInDay(entry) !== day), { ...checkIn, day }],
    updatedAt: checkIn.date,
  };
}

export function commitmentDueToday(item: GoalItem, now = new Date()) {
  return commitmentDueOnDay(item, localCommitmentDateKey(now));
}

export function commitmentDueOnDay(item: GoalItem, todayKey: string) {
  if (!['active', 'under_review'].includes(item.status)) return false;
  if (!todayKey) return false;
  const last = (item.commitmentCheckIns || []).reduce((latest, entry) => {
    const day = commitmentCheckInDay(entry);
    return day <= todayKey && day > latest ? day : latest;
  }, '');
  return !last || calendarDaysBetween(last, todayKey) >= commitmentFrequencyDays(item.commitmentFrequency);
}

function calendarDaysBetween(start: string, end: string) {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
}

export function commitmentReviewDue(item: GoalItem, now = new Date()) {
  if (!['active', 'under_review', 'stalled'].includes(item.status)) return false;
  const todayKey = localCommitmentDateKey(now);
  if (!todayKey) return false;
  const scheduled = recordDateKey(item.commitmentReviewDate || '');
  const reviewed = recordDateKey(item.lastReviewAt || '');
  if (scheduled && scheduled <= todayKey && (!reviewed || reviewed < scheduled)) return true;
  const cadence = item.reviewCadence === 'monthly' ? 30 : item.reviewCadence === 'seasonal' ? 90 : item.reviewCadence === 'custom' ? 45 : 7;
  const baseline = reviewed || recordDateKey(item.createdAt || item.updatedAt || '');
  return Boolean(baseline && calendarDaysBetween(baseline, todayKey) >= cadence);
}

export function commitmentExpectedDuration(item: GoalItem) {
  const started = recordDateKey(item.createdAt || '');
  const review = recordDateKey(item.commitmentReviewDate || '');
  if (started && review && review >= started) {
    return calendarDaysBetween(started, review) + 1;
  }
  return Math.max(1, item.targetProgress * commitmentFrequencyDays(item.commitmentFrequency));
}

export function commitmentActivityToDate(item: GoalItem, practiceDays: string[], now = new Date()) {
  const today = localDateKey(now);
  const started = recordDateKey(item.createdAt || '') || today;
  const loggedDays = new Set([...practiceDays, ...completedCommitmentDates(item)]
    .filter((date) => date >= started && date <= today)).size;
  const expectedSoFar = expectedCommitmentProgress({
    target: item.targetProgress,
    createdAt: item.createdAt,
    cadenceDays: commitmentExpectedDuration(item),
    now,
  });
  return { loggedDays, expectedSoFar, livedPercent: Math.min(100, Math.round(loggedDays / expectedSoFar * 100)) };
}
