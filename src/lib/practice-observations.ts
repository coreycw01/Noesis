import type { Practice, PracticeLog } from './types';

export function appendPracticeObservation(practice: Practice, log: PracticeLog, updatedAt: string): Practice {
  if (practice.logs?.some((item) => item.id === log.id)) return practice;
  const logs = [...(practice.logs || []), log];
  return {
    ...practice,
    logs,
    logDates: Array.from(new Set([
      ...(practice.logDates || []).map((date) => date.slice(0, 10)),
      ...logs.filter((item) => item.actionCompleted).map((item) => item.date.slice(0, 10)),
    ])),
    observedOutcome: log.outcome?.trim() || practice.observedOutcome,
    dateUpdated: updatedAt,
  };
}
