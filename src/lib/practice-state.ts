import type { Practice } from './types';
import { localDateKey, previousCalendarDay } from './calendar';
import { hasPracticeIntellectualBasis, normalizePracticeStatusForSave, practiceDesignGaps } from './workflow-integrity';

export function isPracticeConcluded(practice: Partial<Practice>) {
  return ['completed', 'concluded', 'failed', 'failed_productively', 'integrated', 'abandoned'].includes(practice.status || '');
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
  ].map((date) => date.slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

export function practiceCurrentStreak(dates: string[], now = new Date()) {
  const logged = new Set(dates.map((date) => date.slice(0, 10)));
  const today = localDateKey(now);
  let cursor = logged.has(today) ? today : previousCalendarDay(today);
  let streak = 0;
  while (cursor && logged.has(cursor)) {
    streak += 1;
    cursor = previousCalendarDay(cursor);
  }
  return streak;
}

export function practiceScheduleState(practice: Partial<Practice>, now = new Date()) {
  if (practice.status !== 'active') return 'inactive';
  const today = localDateKey(now);
  if (practice.startDate && practice.startDate.slice(0, 10) > today) return 'scheduled';
  if (practice.endDate && practice.endDate.slice(0, 10) < today) return 'review';
  return 'running';
}

export function practiceNeedsLog(practice: Practice, now = new Date()) {
  return practiceScheduleState(practice, now) === 'running'
    && !practiceDesignGaps(practice).length
    && hasPracticeIntellectualBasis(practice)
    && !practiceLogDates(practice).includes(localDateKey(now));
}

export function practiceStartDateForSave(practice: Partial<Practice>, now = new Date()) {
  if (practice.startDate) return practice.startDate;
  return normalizePracticeStatusForSave(practice) === 'active' ? localDateKey(now) : '';
}
