import type { Practice, PracticeLog } from './types';
import { practiceCalendarDate, practiceLogDates, practiceScheduleState } from './practice-state';

export type PracticeCheckInEdit = { kind: 'add'; day: string; kept: boolean; note: string }
  | { kind: 'edit'; id: string; kept: boolean; note: string }
  | { kind: 'delete'; id: string };

export type PracticeCheckInWrite = { expectedUpdatedAt: string; removedLogId?: string };

export function canBackfillPracticeCheckIn(practice: Partial<Practice>, day: string, today: string) {
  if (!day || practiceCalendarDate(day) !== day || day > today) return false;
  const start = practiceCalendarDate(practice.startDate);
  const end = practiceCalendarDate(practice.endDate);
  if ((start && day < start) || (end && day > end)) return false;
  if (day === today) return practiceScheduleState(practice, new Date(`${today}T12:00:00`)) === 'running';
  return practice.status === 'active' || Boolean(practice.status && practice.status !== 'planned'
    && (start || practice.logs?.length || practice.logDates?.length));
}

export function savedPracticeCheckIns(practice: Pick<Practice, 'logs' | 'logDates'>): PracticeLog[] {
  const logs = practice.logs || [];
  const covered = new Set(logs.map(log => practiceCalendarDate(log.date)));
  const legacy = [...new Set((practice.logDates || []).map(practiceCalendarDate))]
    .filter(day => day && !covered.has(day))
    .map(day => ({ id: `check-in-${day}`, date: day, actionCompleted: true }));
  return [...logs, ...legacy].sort((a, b) => b.date.localeCompare(a.date));
}

export function changePracticeCheckIn(practice: Practice, edit: PracticeCheckInEdit, today: string, updatedAt: string): Practice {
  const history = savedPracticeCheckIns(practice);
  const logs = practice.logs || [];
  if (edit.kind === 'add') {
    if (!canBackfillPracticeCheckIn(practice, edit.day, today)) throw new Error('Choose a date within the practice run, no later than today.');
    if (history.some(log => practiceCalendarDate(log.date) === edit.day)) throw new Error('This day already has a check-in. Edit the existing entry instead.');
    return appendPracticeObservation(practice, { id: `check-in-${edit.day}`, date: edit.day, actionCompleted: edit.kept, observations: edit.note.trim() }, updatedAt);
  }
  const previous = history.find(log => log.id === edit.id);
  if (!previous) throw new Error('This check-in is no longer available.');
  const day = practiceCalendarDate(previous.date);
  const nextLog = edit.kind === 'edit' ? { ...previous, actionCompleted: edit.kept, observations: edit.note.trim(), outcome: '' } : null;
  const persistedLogs = logs.flatMap(log => log.id === edit.id ? (nextLog ? [nextLog] : []) : [log]);
  if (nextLog && !logs.some(log => log.id === edit.id)) persistedLogs.push(nextLog);
  // logDates also holds legacy check-ins; rebuild this day from surviving entries only.
  const logDates = practiceLogDates({ logs: persistedLogs, logDates: (practice.logDates || []).filter(date => practiceCalendarDate(date) !== day) });
  return { ...practice, logs: persistedLogs, logDates, dateUpdated: updatedAt };
}

export function appendPracticeObservation(practice: Practice, log: PracticeLog, updatedAt: string): Practice {
  if (practice.logs?.some((item) => item.id === log.id)) return practice;
  const logs = [...(practice.logs || []), log];
  return {
    ...practice,
    logs,
    logDates: practiceLogDates({ ...practice, logs }),
    observedOutcome: log.outcome?.trim() || practice.observedOutcome,
    dateUpdated: updatedAt,
  };
}

export function practiceCheckInForDay(practice: Practice, day: string): 'kept' | 'missed' | null {
  if (practiceLogDates(practice).includes(day)) return 'kept';
  return practice.logs?.some(log => practiceCalendarDate(log.date) === day) ? 'missed' : null;
}

export function recordQuickPracticeCheckIn(practice: Practice, day: string): Practice | null {
  if (!day || practiceCalendarDate(day) !== day || practiceCheckInForDay(practice, day)) return null;
  if (practiceScheduleState(practice, new Date(`${day}T12:00:00`)) !== 'running') return null;
  return appendPracticeObservation(practice, { id: `check-in-${day}`, date: day, actionCompleted: true }, day);
}
