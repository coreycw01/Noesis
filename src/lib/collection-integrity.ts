import type {
  AiAssistedHistoryEntry,
  Annotation,
  AnnotationRecord,
  Concept,
  DraftRevision,
  PracticeLog,
  VaultVersion,
} from '@/lib/types';

export const COLLECTION_SCHEMA_VERSION = 5;
export const MAX_AI_REVIEW_HISTORY = 24;
export const MAX_NESTED_ANNOTATIONS = 200;
export const MAX_NESTED_PRACTICE_LOGS = 180;
export const MAX_NESTED_WORK_REVISIONS = 10;
export const MAX_POSITION_VERSION_HISTORY = 100;

function timeValue(value?: string) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function newestFirst<T>(items: T[], dateFor: (item: T) => string | undefined) {
  return [...items].sort((left, right) => timeValue(dateFor(right)) - timeValue(dateFor(left)));
}

export function boundedAiReviewHistory(entries: AiAssistedHistoryEntry[]) {
  return newestFirst(entries, (entry) => entry.date).slice(0, MAX_AI_REVIEW_HISTORY);
}

export function appendAiReviewHistory(entries: AiAssistedHistoryEntry[] | undefined, entry: AiAssistedHistoryEntry) {
  return boundedAiReviewHistory([entry, ...(entries || []).filter((item) => item.id !== entry.id)]);
}

export function boundedNestedAnnotations(entries: Annotation[]) {
  return newestFirst(entries, (entry) => entry.date).slice(0, MAX_NESTED_ANNOTATIONS);
}

export function boundedNestedPracticeLogs(entries: PracticeLog[]) {
  return newestFirst(entries, (entry) => entry.date).slice(0, MAX_NESTED_PRACTICE_LOGS);
}

export function boundedNestedWorkRevisions(entries: DraftRevision[]) {
  return newestFirst(entries, (entry) => entry.createdAt).slice(0, MAX_NESTED_WORK_REVISIONS).reverse();
}

export function boundedPositionVersionHistory(entries: VaultVersion[]) {
  return newestFirst(entries, (entry) => entry.date).slice(0, MAX_POSITION_VERSION_HISTORY).reverse();
}

export function conceptIdsForLabels(labels: string[] | undefined, concepts: Concept[]) {
  const byName = new Map(concepts.map((concept) => [concept.name.trim().toLocaleLowerCase(), concept.id]));
  return Array.from(new Set((labels || [])
    .map((label) => byName.get(label.trim().toLocaleLowerCase()))
    .filter((id): id is string => Boolean(id))));
}

export function annotationRecord(sourceId: string, annotation: Annotation, userId?: string): AnnotationRecord {
  return {
    ...annotation,
    sourceId,
    userId,
    dateUpdated: new Date().toISOString(),
  };
}

export function mergeAnnotationRecords(nested: Annotation[], records: AnnotationRecord[]) {
  const merged = new Map(nested.map((annotation) => [annotation.id, annotation]));
  records.forEach((record) => {
    const { sourceId: _sourceId, userId: _userId, dateUpdated: _dateUpdated, ...annotation } = record;
    merged.set(record.id, annotation);
  });
  return newestFirst(Array.from(merged.values()), (entry) => entry.date);
}
