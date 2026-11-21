import type { Practice } from './types';
import { localDateKey, previousCalendarDay, recordDateKey } from './calendar';
import { normalizePracticeStatusForSave } from './workflow-integrity';

export function isPracticeConcluded(practice: Partial<Practice>) {
  return ['completed', 'concluded', 'failed', 'failed_productively', 'integrated', 'abandoned'].includes(practice.status || '');
}

export function completedPracticeResult(practice: Practice) {
  if (practice.status === 'abandoned' || !isPracticeConcluded(practice)) return null;
  const observation = practice.conclusion?.whatHappened?.trim() || practice.observedOutcome?.trim();
  if (!observation) return null;
  return {
    practice,
    observation,
    implication: practice.conclusion?.intellectualChange?.trim() || practice.effectOnPosition?.trim() || '',
    alternative: practice.conclusion?.alternativeExplanation?.trim() || practice.alternativeExplanation?.trim() || '',
  };
}

export function latestCompletedPracticeResult(practices: readonly Practice[]) {
  return practices.map(completedPracticeResult).filter(result => result !== null).sort((a, b) =>
    (Date.parse(b.practice.dateUpdated) || 0) - (Date.parse(a.practice.dateUpdated) || 0)
    || a.practice.id.localeCompare(b.practice.id),
  )[0];
}

export function practiceNeedsOutcome(practice: Practice) {
  return !['abandoned', 'integrated'].includes(practice.status) && isPracticeConcluded(practice)
    && !(practice.conclusion?.whatHappened || practice.observedOutcome || practice.notes)?.trim();
}

export function practiceNeedsConsequence(practice: Practice) {
  return !['abandoned', 'integrated'].includes(practice.status) && isPracticeConcluded(practice)
    && !(practice.effectOnPosition || practice.conclusion?.intellectualChange || practice.interpretation)?.trim();
}

export function practiceRecentlyConcluded(practice: Practice, now = new Date()) {
  if (['abandoned', 'integrated'].includes(practice.status) || !isPracticeConcluded(practice)) return false;
  const updated = Date.parse(practice.dateUpdated || '');
  const age = now.getTime() - updated;
  return Number.isFinite(updated) && age >= 0 && age <= 30 * 86_400_000;
}

export function practiceLogDates(practice: Pick<Practice, 'logs' | 'logDates'>) {
  return [...new Set([
    ...(practice.logDates || []),
    ...(practice.logs || []).filter((log) => log.actionCompleted).map((log) => log.date),
  ].map(practiceCalendarDate).filter(Boolean))].sort();
}

export function practiceCurrentStreak(dates: string[], now = new Date()) {
  const logged = new Set(dates.map(practiceCalendarDate).filter(Boolean));
  const today = localDateKey(now);
  let cursor = logged.has(today) ? today : previousCalendarDay(today);
  let streak = 0;
  while (cursor && logged.has(cursor)) {
    streak += 1;
    cursor = previousCalendarDay(cursor);
  }
  return streak;
}

export function practiceCalendarDate(value?: string) {
  return value ? recordDateKey(value.slice(0, 10)) : '';
}

export function practiceScheduleState(practice: Partial<Practice>, now = new Date()) {
  if (practice.status !== 'active') return 'inactive';
  const today = localDateKey(now);
  const start = practiceCalendarDate(practice.startDate);
  const end = practiceCalendarDate(practice.endDate);
  if (start && start > today) return 'scheduled';
  if (end && end < today) return 'review';
  return 'running';
}

export function practiceNeedsLog(practice: Practice, now = new Date()) {
  return practiceScheduleState(practice, now) === 'running'
    && normalizePracticeStatusForSave(practice) === 'active'
    && !practiceLogDates(practice).includes(localDateKey(now));
}

export function practiceStartDateForSave(practice: Partial<Practice>, now = new Date()) {
  if (practice.startDate) return practice.startDate;
  return normalizePracticeStatusForSave(practice) === 'active' ? localDateKey(now) : '';
}
