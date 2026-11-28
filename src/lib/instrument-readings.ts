import type { Practice, Question } from './types';
import { practiceCalendarDate, practiceCheckInDays } from './practice-state';

function shiftDay(day: string, amount: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
}

export function practiceRhythm(practice: Partial<Practice>, today: string) {
  const days = new Map([...practiceCheckInDays(practice)].filter(([day]) => day <= today));
  const recorded = [...days.keys()].sort();
  const scheduledStart = practiceCalendarDate(practice.startDate);
  const first = [scheduledStart, recorded[0]].filter(Boolean).sort()[0] || shiftDay(today, -6);
  const scheduledEnd = practiceCalendarDate(practice.endDate);
  const last = [first, scheduledEnd && scheduledEnd < today ? scheduledEnd : today, recorded.at(-1)].filter(Boolean).sort().at(-1) || today;
  const weekCount = Math.floor((Date.parse(last) - Date.parse(first)) / (86_400_000 * 7)) + 1;
  const duration = practice.durationDays ?? 0;
  const targetSteps = practice.durationMode === 'open_ended' ? null
    : practice.durationMode === 'one_time' ? 1
    : Number.isFinite(duration) && duration >= 1 ? Math.floor(duration)
    : scheduledStart && scheduledEnd >= scheduledStart ? (Date.parse(scheduledEnd) - Date.parse(scheduledStart)) / 86_400_000 + 1 : null;
  const keptSteps = [...days].filter(([day, entry]) => entry.kept && (!scheduledStart || day >= scheduledStart)
    && (!scheduledEnd || day <= scheduledEnd)).length;
  return { weekCount, targetSteps, keptSteps, keptDays: [...days.values()].filter(entry => entry.kept).length, week(index: number) {
    return Array.from({ length: 7 }, (_, offset) => {
      const date = shiftDay(first, index * 7 + offset);
      const entry = days.get(date);
      const state = entry ? (entry.kept ? 'kept' : 'missed') : date > today ? 'upcoming' : date > last ? 'outside' : 'unlogged';
      return { date, state, note: entry?.note } as const;
    });
  } };
}

export function experimentReadings(practice: Partial<Practice>, asOf?: string) {
  const observed = (value?: string) => {
    const text = value?.trim();
    return text && !/^(kept|missed)$/i.test(text) ? text : '';
  };
  const records = [...(practice.logs || [])]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .flatMap(log => {
      const text = [observed(log.observations), observed(log.outcome)].filter(Boolean);
      const date = practiceCalendarDate(log.date);
      if (asOf && date && date > asOf) return [];
      const unexpected = observed(log.unexpectedResult);
      return text.length || unexpected ? [{ id: `log-${log.id}`, label: date || 'Observation', text: [...new Set(text)].join('\n'), unexpected }] : [];
    });
  const conclusion = observed(practice.conclusion?.whatHappened) || observed(practice.observedOutcome);
  return conclusion ? [...records, { id: 'result', label: 'Recorded result', text: conclusion, unexpected: '' }] : records;
}

export function inquirySounding(question: Question) {
  const reasons = [question.whyItMatters, question.currentIntuition, question.uncertainty, ...(question.assumptions || [])];
  const answers = (question.candidateAnswers || []).filter(item => item.statement.trim());
  const evidence = (question.evidenceRecords || []).filter(item => item.claim.trim());
  return [
    { label: 'Frame', target: 'inq-frame', recorded: reasons.some(value => Boolean(value?.trim())) || evidence.length > 0 },
    { label: 'Possible answers', target: 'inq-answers', recorded: answers.length > 0 },
    { label: 'Weighed evidence', target: 'inq-weigh', recorded: evidence.some(item => item.direction !== 'contextualizes' && answers.some(answer => answer.id === item.candidateId)) },
    { label: 'Saved answer', target: 'inq-conclude', recorded: Boolean(question.answer?.trim()) },
  ] as const;
}
