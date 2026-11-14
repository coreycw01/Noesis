import { recordDateKey } from './calendar';
import type { ThinkingEvent, TimelineEvent } from './types';

export function indexEvolutionSources<T extends { id: string }>(sources: readonly T[]) {
  const byId = new Map(sources.map((source, order) => [source.id, { source, order }]));
  return (ids?: readonly string[]) => [...new Set(ids)]
    .flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [entry] : [];
    })
    .sort((a, b) => a.order - b.order)
    .map(({ source }) => source);
}

export function thinkingHistoryDate(value: unknown): number {
  if (typeof value === 'string') return Date.parse(value);
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  return NaN;
}

export function mergeThinkingHistory(modern: readonly ThinkingEvent[], legacy: readonly ThinkingEvent[]) {
  return [...new Map([...legacy, ...modern].map((event) => [event.id, event])).values()]
    .map((event) => ({ event, date: thinkingHistoryDate(event.createdAt) }))
    .filter(({ date }) => Number.isFinite(date))
    .sort((a, b) => b.date - a.date || a.event.id.localeCompare(b.event.id))
    .map(({ event }) => event);
}

export function isEvolutionSynthesis(event: TimelineEvent) {
  return event.entityType === 'evolution' && event.entityTitle.toLowerCase().startsWith('period synthesis');
}

export function readEvolutionSynthesis(event: Pick<ThinkingEvent, 'entityType' | 'eventType' | 'after' | 'metadata'>): TimelineEvent | null {
  if (event.entityType !== 'evolution' || event.eventType !== 'synthesized') return null;
  const snapshot = event.after?.legacyTimelineEvent ?? event.metadata?.legacyTimelineEvent;
  if (!snapshot || typeof snapshot.id !== 'string' || typeof snapshot.entityTitle !== 'string'
    || typeof snapshot.date !== 'string' || typeof snapshot.reason !== 'string') return null;
  if (!snapshot.reason.trim() && (typeof snapshot.synthesisProvenance?.provenanceId !== 'string'
    || snapshot.synthesisProvenance.kind !== 'ai-assisted')) return null;
  return isEvolutionSynthesis(snapshot) ? snapshot : null;
}

export function evolutionDateMatches(value: string, from: string, to: string) {
  const key = recordDateKey(value);
  return Boolean(key && (!from || key >= from) && (!to || key <= to));
}

export function olderEvolutionHistoryMayMatch(
  historyHasMore: boolean,
  from: string,
  loadedHistory: readonly Pick<ThinkingEvent, 'createdAt'>[],
) {
  if (!historyHasMore) return false;
  if (!from) return true;
  let oldest = Infinity;
  for (const event of loadedHistory) {
    const time = thinkingHistoryDate(event.createdAt);
    if (Number.isFinite(time)) oldest = Math.min(oldest, time);
  }
  // The boundary day itself may still have older events.
  return !Number.isFinite(oldest) || recordDateKey(new Date(oldest).toISOString()) >= from;
}

export function isEvolutionDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeEvolutionDate(value: unknown): string | null {
  if (typeof value === 'string' && isEvolutionDateOnly(value)) return recordDateKey(value) || null;
  let date: Date | undefined;
  if (value instanceof Date) date = value;
  else if (typeof value === 'string' || typeof value === 'number') date = new Date(value);
  else if (value && typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof timestamp.toDate === 'function') date = timestamp.toDate();
    else {
      const seconds = timestamp.seconds ?? timestamp._seconds;
      if (typeof seconds === 'number') date = new Date(seconds * 1000);
    }
  }
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function evolutionDisplayDate(value: string) {
  // Local calendar dates must not shift to the previous day in western time zones.
  return new Date(isEvolutionDateOnly(value) ? `${value}T12:00:00` : value);
}

export function evolutionActionKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function milestoneIdentity(type: string, id: string, action: string, date: unknown) {
  const instant = thinkingHistoryDate(date);
  if (!type || !id || !action || !Number.isFinite(instant)) return null;
  const object = ({ vault: 'position', media: 'source', draft: 'work', question: 'inquiry' } as Record<string, string>)[type] || type;
  const event = evolutionActionKey(action).replace(/^(position|source|work|concept|practice|question|inquiry)_/, '');
  const normalized = ({ formed: 'created', redefined: 'revised', challenge_added: 'challenged' } as Record<string, string>)[event] || event;
  return JSON.stringify([object, id, normalized, instant]);
}

export function unmatchedEvolutionMilestones(legacy: readonly TimelineEvent[], thinking: readonly ThinkingEvent[]) {
  const canonical = new Set(thinking.map((event) => milestoneIdentity(
    event.entityType || event.targetType, event.entityId || event.targetId,
    event.eventType || event.actionType || '', event.createdAt,
  )).filter(Boolean));
  return legacy.filter((event) => !canonical.has(milestoneIdentity(event.entityType, event.entityId, event.eventType, event.date)));
}

export function evolutionSynthesisExcerpt(event: {
  date: string; title: string; targetType: string; actor?: string; action?: string;
  beforeLabel?: string; afterLabel?: string; trigger?: string; significance?: string;
}) {
  const text = (value: string | undefined, limit: number) => value?.replace(/\s+/g, ' ').trim().slice(0, limit);
  return [
    `${event.date}: ${text(event.title, 120)}`,
    `object: ${event.targetType}`,
    event.action && `change: ${text(event.action, 40)}`,
    event.actor && `actor: ${text(event.actor, 24)}`,
    event.beforeLabel && `before: ${text(event.beforeLabel, 95)}`,
    event.afterLabel && `after: ${text(event.afterLabel, 95)}`,
    event.trigger && `reason: ${text(event.trigger, 95)}`,
    event.significance && `significance: ${text(event.significance, 65)}`,
  ].filter(Boolean).join('; ');
}

const consequentialEventTypes = new Set([
  'revised', 'position_revised', 'work_revised', 'concept_redefined',
  'abandoned', 'position_abandoned', 'source_abandoned', 'concept_abandoned', 'work_abandoned', 'practice_abandoned',
  'replaced', 'position_replaced', 'contradiction_resolved', 'question_resolved', 'inquiry_resolved',
]);

export function isEvolutionTurningPoint(eventType: string, confidenceBefore?: number | null, confidenceAfter?: number | null) {
  const type = evolutionActionKey(eventType);
  if (type === 'confidence_changed' || type === 'confidence_change') {
    return typeof confidenceBefore === 'number' && typeof confidenceAfter === 'number'
      && Number.isFinite(confidenceBefore) && Number.isFinite(confidenceAfter)
      && Math.abs(confidenceAfter - confidenceBefore) >= 15;
  }
  return consequentialEventTypes.has(type);
}

export const EVOLUTION_SYNTHESIS_SAMPLE_LIMIT = 20;

type EvolutionSourceEvidence = { targetType: string; targetId: string; sourceIds?: string[] };

export function evolutionSynthesisSourceIds(events: ReadonlyArray<EvolutionSourceEvidence>) {
  return [...new Set(events.flatMap((event) => [
    ...(['source', 'media'].includes(event.targetType) ? [event.targetId] : []),
    ...(event.sourceIds || []),
  ]).filter(Boolean))].slice(0, EVOLUTION_SYNTHESIS_SAMPLE_LIMIT);
}

export function evolutionSynthesisReviewKey(events: ReadonlyArray<EvolutionSourceEvidence & { id: string }>) {
  return JSON.stringify([events.map((event) => [event.id, event.targetType, event.targetId]), evolutionSynthesisSourceIds(events)]);
}

export function evolutionValueChange(event: Pick<ThinkingEvent, 'before' | 'after' | 'confidenceBefore' | 'confidenceAfter'>) {
  const scalar = (value: unknown) => typeof value === 'number' || typeof value === 'boolean'
    ? String(value) : typeof value === 'string' ? value.trim() || undefined : undefined;
  if (event.confidenceBefore != null || event.confidenceAfter != null) {
    return {
      beforeLabel: event.confidenceBefore == null ? undefined : `Confidence: ${event.confidenceBefore}%`,
      afterLabel: event.confidenceAfter == null ? undefined : `Confidence: ${event.confidenceAfter}%`,
    };
  }
  if (!event.before || !event.after) return null;
  const fields = ['statement', 'claim', 'definition', 'answer', 'currentAnswer', 'status', 'type', 'title', 'name', 'confidence', 'description'];
  for (const key of fields) {
    const beforeLabel = scalar(event.before[key]);
    const afterLabel = scalar(event.after[key]);
    if (beforeLabel !== afterLabel && (beforeLabel || afterLabel)) return { beforeLabel, afterLabel };
  }
  return null;
}
