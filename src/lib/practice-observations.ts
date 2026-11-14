import type { Practice, PracticeLog } from './types';
import { practiceLogDates } from './practice-state';

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
