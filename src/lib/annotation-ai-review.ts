import { doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { acceptedTextHash, type AiProvenanceRecord } from './ai-provenance';
import { aiHistoryEntry, type AiReviewResult } from './contextual-ai';
import { annotationRecord, appendAiReviewHistory, boundedNestedAnnotations } from './collection-integrity';
import { makeThinkingEventPayload, type WriteThinkingEventInput } from './thinkingEvents/writeThinkingEvent';
import type { Annotation, AnnotationRecord, Media } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type AnnotationReviewApproval = { result: AiReviewResult; text: string };

export function annotationEffectTarget(id: string, provenanceId: string) {
  return { type: 'annotation', id, fieldPath: 'aiEffectReview', subrecordId: provenanceId };
}

export async function prepareAnnotationReview(uid: string, sourceId: string, baseline: Annotation, approval: AnnotationReviewApproval, date: string, acceptedAt: unknown) {
  const { result, text } = approval;
  if (result.action !== 'suggest_annotation_effect' || result.targetType !== 'annotation'
    || result.targetId !== `${sourceId}:${baseline.id}` || !result.reviewId
    || !/^[\w-]{1,100}$/.test(result.reviewId) || !text.trim()) throw new Error('This review does not belong to this annotation.');
  const id = `ai-review-${result.reviewId}`;
  const provenance = { provenanceId: id, kind: 'ai-assisted' as const };
  const record: AiProvenanceRecord = {
    ...provenance, id, userId: uid, schemaVersion: 1, sourceActionId: id,
    targets: [annotationEffectTarget(baseline.id, id)], origin: { feature: 'annotation', action: result.action },
    contextRefs: [{ type: 'source', id: sourceId }],
    generatedAt: result.generatedAt, acceptedAt, precursor: result.content.slice(0, 32000) || null,
    acceptedTextHash: await acceptedTextHash(text), state: 'active',
  };
  const patch = (source: Media, current: Annotation) => {
    if (current.text !== baseline.text || current.aiEffectReview !== baseline.aiEffectReview
      || current.effectProvenance?.provenanceId !== baseline.effectProvenance?.provenanceId) {
      throw new Error('This annotation changed before saving. Review the latest version first.');
    }
    const updated: Annotation = { ...current, aiEffectReview: text.trim(), effectProvenance: provenance,
      aiReviewHistory: appendAiReviewHistory(current.aiReviewHistory, { ...aiHistoryEntry(result, text, date), id }) };
    const { sourceId: _sourceId, userId: _uid, dateUpdated: _updated, ...nested } = updated as AnnotationRecord;
    return {
      source: { annotations: boundedNestedAnnotations([nested, ...(source.annotations || []).filter((item) => item.id !== baseline.id)]), dateUpdated: date },
      annotation: { ...annotationRecord(sourceId, nested, uid), dateUpdated: date },
    };
  };
  return { record, patch };
}

export function matchesAnnotationReview(existing: AiProvenanceRecord | undefined, record: AiProvenanceRecord) {
  return existing?.acceptedTextHash === record.acceptedTextHash
    && existing.origin.action === record.origin.action
    && existing.targets?.[0]?.id === record.targets[0].id
    && existing.contextRefs?.[0]?.id === record.contextRefs?.[0]?.id;
}

export function annotationReviewEvent(event: WriteThinkingEventInput, record: AiProvenanceRecord): WriteThinkingEventInput {
  return { ...event, idempotencyKey: record.id, sourceActionId: record.id,
    metadata: { provenanceId: record.id, fieldPath: 'aiEffectReview', contextualAiAction: record.origin.action } };
}

export async function writeAnnotationReview(sourceRef: DocumentReference, baseline: Annotation, approval: AnnotationReviewApproval, date: string, event: WriteThinkingEventInput) {
  requireWorkspaceConnection();
  const account = sourceRef.parent.parent;
  if (account?.path !== `users/${event.userId}`) throw new Error('Invalid annotation workspace.');
  const { record, patch } = await prepareAnnotationReview(event.userId, sourceRef.id, baseline, approval, date, serverTimestamp());
  const annotation = doc(account, 'annotations', baseline.id);
  const origin = doc(account, 'aiProvenance', record.id);
  const { eventRef, payload } = makeThinkingEventPayload(annotationReviewEvent(event, record));
  return runTransaction(sourceRef.firestore, async (tx) => {
    const [source, current, prior, history] = await Promise.all([tx.get(sourceRef), tx.get(annotation), tx.get(origin), tx.get(eventRef)]);
    if (!source.exists()) throw new Error('The annotation source is no longer available.');
    const media = source.data() as Media;
    const saved = current.data() as AnnotationRecord | undefined;
    if (saved && saved.sourceId !== sourceRef.id) throw new Error('This annotation belongs to another source.');
    const existing = saved ?? media.annotations?.find((item) => item.id === baseline.id);
    if (!existing) throw new Error('This annotation is no longer available.');
    if (prior.exists() || history.exists()) {
      if (matchesAnnotationReview(prior.data() as AiProvenanceRecord | undefined, record)
        && history.data()?.metadata?.provenanceId === record.id) return existing;
      throw new Error('This review was already saved with different content.');
    }
    const next = patch(media, existing);
    tx.update(sourceRef, next.source);
    tx.set(annotation, next.annotation);
    tx.set(origin, record);
    tx.set(eventRef, payload);
    return next.annotation;
  });
}
