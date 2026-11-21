import type { Practice, PracticeLog } from './types';
import { practiceCalendarDate, practiceLogDates, practiceScheduleState } from './practice-state';

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
