import type { Annotation, ThinkingEvent } from './types';
import { annotationRecord, MAX_NESTED_ANNOTATIONS } from './collection-integrity';

export function restoredItemHistorySnapshot(snapshot: object) {
  const { id, textProvenance, definitionProvenance, boundaryProvenance, summaryProvenance,
    reflectionProvenance, bodyProvenance, annotationOrigins } = snapshot as Record<string, unknown>;
  return { id, textProvenance, definitionProvenance, boundaryProvenance, summaryProvenance,
    reflectionProvenance, bodyProvenance, annotationOrigins };
}

export function sourceRecoveryAnnotations(snapshot: Record<string, unknown>, sourceId: string, ownerId: string) {
  const annotations = Array.isArray(snapshot.annotations) ? snapshot.annotations : [];
  const records = new Map<string, Annotation>();
  for (const item of annotations) {
    if (item && typeof item.id === 'string' && item.id && !item.id.includes('/') && typeof item.text === 'string') {
      records.set(item.id, item);
    }
  }
  return [...records.values()].slice(0, MAX_NESTED_ANNOTATIONS).map((item) => annotationRecord(sourceId, item, ownerId));
}

const recoverableTypes = new Set(['annotation', 'concept', 'source', 'position', 'inquiry', 'work', 'practice']);
export const RECOVERY_RETENTION_MS = 30 * 86_400_000;
export const RECOVERY_EVENT_TYPES = ['deleted', 'restored', 'created', 'source_created', 'question_created', 'position_created', 'position_formed', 'practice_created', 'concept_defined', 'work_created', 'annotation_created', 'abandoned'] as const;
const recoveryEventTypes = new Set<string>(RECOVERY_EVENT_TYPES);

export function deletedAnnotationSource(event: ThinkingEvent) {
  const sources = event.relatedEntityIds?.sourceIds;
  const source = sources?.length === 1 ? sources[0] : undefined;
  return event.entityType === 'annotation' && source && !source.includes('/') ? source : undefined;
}

export function recentRecoverableDeletions(events: readonly ThinkingEvent[], now = Date.now()) {
  const latest = new Map<string, { event: ThinkingEvent; time: number }>();
  for (const event of events) {
    if (!recoverableTypes.has(event.entityType) || !recoveryEventTypes.has(event.eventType)) continue;
    const sourceId = deletedAnnotationSource(event);
    if (event.entityType === 'annotation' && !sourceId) continue;
    const legacyDeletion = event.entityType === 'annotation' && event.eventType === 'abandoned' && event.summary === 'Deleted annotation.';
    if (event.eventType === 'abandoned' && !legacyDeletion) continue;
    const entry = legacyDeletion ? { ...event, eventType: 'deleted' as const } : event;
    const timestamp = event.createdAt as string | { toMillis?: () => number };
    const time = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp?.toMillis?.() ?? NaN;
    if (!Number.isFinite(time) || time > now) continue;
    const key = JSON.stringify([event.entityType, sourceId, event.entityId]);
    const previous = latest.get(key);
    if (!previous || time > previous.time || (time === previous.time && previous.event.eventType === 'deleted' && entry.eventType !== 'deleted')) {
      latest.set(key, { event: entry, time });
    }
  }
  return [...latest.values()]
    .filter(({ event, time }) => event.eventType === 'deleted' && event.before?.id === event.entityId
      && (event.entityType !== 'annotation' || typeof event.before.text === 'string')
      && now - time <= RECOVERY_RETENTION_MS)
    .sort((left, right) => right.time - left.time)
    .map(({ event, time }) => ({ ...event, createdAt: new Date(time).toISOString() }));
}
