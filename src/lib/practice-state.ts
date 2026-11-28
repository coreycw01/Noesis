import type { Practice, PracticeType, Question, VaultEntry } from './types';
import { localDateKey, previousCalendarDay, recordDateKey } from './calendar';
import { normalizePracticeStatusForSave } from './workflow-integrity';

export function practicePraxisMethod(type?: PracticeType) {
  return type === 'experiment' || type === 'challenge' || type === 'exposure' || type === 'decision_rule'
    ? 'experiments' : 'practices';
}

export function isPracticeConcluded(practice: Partial<Practice>) {
  return ['completed', 'concluded', 'failed', 'failed_productively', 'integrated', 'abandoned'].includes(practice.status || '');
}

export function completedPracticeResult(practice: Practice) {
  if (practice.status === 'abandoned' || !isPracticeConcluded(practice)) return null;
  const observation = practice.conclusion?.whatHappened?.trim() || practice.observedOutcome?.trim();
  if (!observation || /^(kept|missed)$/i.test(observation)) return null;
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

export function practiceReviewDestination(practice: Practice, questions: readonly Question[], positions: readonly VaultEntry[]) {
  if (!completedPracticeResult(practice)) return null;
  const question = questions.find(item => practice.questionIds?.includes(item.id) || item.practiceIds?.includes(practice.id));
  if (question) return { view: 'questions' as const, targetId: question.id, label: question.text };
  const position = positions.find(item => practice.positionIds?.includes(item.id));
  return position ? { view: 'vault' as const, targetId: position.id, label: position.title } : null;
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

export function practiceCheckInDays(practice: Pick<Practice, 'logs' | 'logDates'>) {
  const days = new Map<string, { kept: boolean; note?: string }>();
  for (const value of practice.logDates ?? []) {
    const day = practiceCalendarDate(value);
    if (day) days.set(day, { kept: true });
  }
  const logs = [...(practice.logs ?? [])].sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
  for (const log of logs) {
    const day = practiceCalendarDate(log.date);
    if (day && typeof log.actionCompleted === 'boolean') days.set(day, { kept: log.actionCompleted, note: log.observations?.trim() || log.outcome?.trim() });
  }
  return days;
}

export function practiceLogDates(practice: Pick<Practice, 'logs' | 'logDates'>) {
  return [...practiceCheckInDays(practice)].filter(([, entry]) => entry.kept).map(([day]) => day).sort();
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
