import { conceptLabelKey } from './readex';
import type {
  AiAssistedHistoryEntry,
  Annotation,
  AnnotationRecord,
  Concept,
  Media,
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
  const byName = new Map<string, Concept>();
  const isPlaceholder = (concept: Concept) => concept.createdFrom === 'tag' || concept.createdFrom === 'fallback';
  for (const concept of concepts) {
    const key = conceptLabelKey(concept.name);
    const previous = byName.get(key);
    if (!previous || (isPlaceholder(previous) && !isPlaceholder(concept))) byName.set(key, concept);
  }
  return Array.from(new Set((labels || [])
    .map((label) => byName.get(conceptLabelKey(label))?.id)
    .filter((id): id is string => Boolean(id))));
}

export function tagConceptId(label: string) {
  const bytes = new TextEncoder().encode(conceptLabelKey(label));
  // Use a reversible, URL-safe key within Firestore's document ID limit.
  if (!bytes.length || bytes.length > 748) return null;
  return `tag-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function annotationRecord(sourceId: string, annotation: Annotation, userId?: string): AnnotationRecord {
  return {
    ...annotation,
    sourceId,
    userId,
    dateUpdated: new Date().toISOString(),
  };
}

export type AnnotationMarkTransfer = { sourceId: string; annotationId: string; markId: string; text: string };

export function annotationPromotionUpdates(
  sources: Pick<Media, 'id' | 'annotations' | 'dateUpdated'>[],
  references: ReadonlyArray<{ sourceId: string; annotationId: string }>,
  destination: 'inquiry' | 'position' | 'practice',
  recordId: string,
  transfer?: AnnotationMarkTransfer,
) {
  const bySource = new Map<string, Set<string>>();
  for (const { sourceId, annotationId } of transfer ? [...references, transfer] : references) {
    if (!bySource.has(sourceId)) bySource.set(sourceId, new Set());
    bySource.get(sourceId)!.add(annotationId);
  }
  return [...bySource].map(([sourceId, ids]) => {
    const source = sources.find((item) => item.id === sourceId);
    if (!source || [...ids].some((id) => !source.annotations?.some((annotation) => annotation.id === id))) {
      throw new Error('A selected annotation is no longer available. Refresh the selection and try again.');
    }
    const annotations = source.annotations.map((annotation): Annotation => {
      if (!ids.has(annotation.id)) return annotation;
      const next = destination === 'inquiry' ? {
        ...annotation, philosophyStatus: 'questioned' as const, createdInquiryId: annotation.createdInquiryId || recordId,
      } : destination === 'position' ? {
        ...annotation, philosophyStatus: 'used_in_position' as const, createdPositionId: annotation.createdPositionId || recordId,
        linkedPositionIds: [...new Set([...(annotation.linkedPositionIds || []), recordId])],
      } : { ...annotation };
      if (transfer?.sourceId === sourceId && transfer.annotationId === annotation.id) {
        const mark = annotation.marks?.find(item => item.id === transfer.markId);
        const expectedKind = destination === 'inquiry' ? 'question' : destination === 'position' ? 'claim' : 'action';
        if (!mark || mark.kind !== expectedKind) throw new Error('This mark changed. Reopen the annotation and try again.');
        if (mark.movedTo) throw new Error('This mark was already sent. Reopen the annotation to see its destination.');
        next.marks = annotation.marks?.map(item => item.id === mark.id
          ? { ...item, movedTo: destination, movedId: recordId, movedText: transfer.text }
          : item);
      }
      return next;
    });
    return { sourceId, sourceVersion: source.dateUpdated, annotations: boundedNestedAnnotations(annotations), updated: annotations.filter((annotation) => ids.has(annotation.id)) };
  });
}

export function inquiryAnnotationUpdates(
  sources: Parameters<typeof annotationPromotionUpdates>[0],
  references: Parameters<typeof annotationPromotionUpdates>[1],
  inquiryId: string,
  transfer?: AnnotationMarkTransfer,
) {
  return annotationPromotionUpdates(sources, references, 'inquiry', inquiryId, transfer);
}

export function mergeAnnotationRecords(nested: Annotation[], records: AnnotationRecord[]) {
  const merged = new Map(nested.map((annotation) => [annotation.id, annotation]));
  records.forEach((record) => {
    const { sourceId: _sourceId, userId: _userId, dateUpdated: _dateUpdated, ...annotation } = record;
    merged.set(record.id, annotation);
  });
  return newestFirst(Array.from(merged.values()), (entry) => entry.date);
}

export function mergeSourceAnnotationRecords<T extends { id: string; annotations?: Annotation[] }>(media: T[], annotations: AnnotationRecord[]): T[] {
  const bySource = new Map<string, AnnotationRecord[]>();
  for (const annotation of annotations) {
    const group = bySource.get(annotation.sourceId);
    if (group) group.push(annotation);
    else bySource.set(annotation.sourceId, [annotation]);
  }
  return media.map((source) => ({
    ...source,
    annotations: mergeAnnotationRecords(source.annotations || [], bySource.get(source.id) || []),
  }));
}
