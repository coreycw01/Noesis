import { doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { acceptedTextHash, aiCreationPrompt, sourceAnnotationReviewTarget, type AiProvenanceRecord } from './ai-provenance';
import { aiHistoryEntry, parseAiReviewItems, type AiReviewResult } from './contextual-ai';
import { annotationRecord, appendAiReviewHistory, boundedNestedAnnotations } from './collection-integrity';
import { makeThinkingEventPayload, type WriteThinkingEventInput } from './thinkingEvents/writeThinkingEvent';
import type { Annotation, Media } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type SourceReviewApproval = { result: AiReviewResult; text: string; baseline: Media };
type SourceReviewField = 'aiSummary' | 'aiReflection';

export function sourceReviewTarget(id: string, field: SourceReviewField, provenanceId: string) {
  return { type: 'source', id, fieldPath: `capture.after.${field}`, subrecordId: provenanceId };
}

export async function prepareSourceReview(uid: string, approval: SourceReviewApproval, date: string, acceptedAt: unknown) {
  const { result, text, baseline } = approval;
  if (result.targetType !== 'source' || result.targetId !== baseline.id || !result.reviewId
    || !/^[\w-]{1,100}$/.test(result.reviewId) || !text.trim()
    || !['summarize_source', 'reflect_on_source', 'extract_source_claims', 'propose_inquiry_prompts'].includes(result.action)) {
    throw new Error('This review does not belong to this source.');
  }
  const field: SourceReviewField = result.action === 'summarize_source' ? 'aiSummary' : 'aiReflection';
  const id = `ai-review-${result.reviewId}`;
  const ref = { provenanceId: id, kind: 'ai-assisted' as const };
  const annotationType = result.action === 'extract_source_claims' ? 'claim'
    : result.action === 'propose_inquiry_prompts' ? 'question' : null;
  const record: AiProvenanceRecord = {
    ...ref, id, userId: uid, schemaVersion: 1, sourceActionId: id,
    targets: [sourceReviewTarget(baseline.id, field, id)],
    origin: { feature: 'source', action: result.action },
    generatedAt: result.generatedAt, acceptedAt, precursor: result.content.slice(0, 32000) || null,
    ...(annotationType ? aiCreationPrompt(result) : {}),
    acceptedTextHash: await acceptedTextHash(text), state: 'active',
  };
  const newAnnotations = annotationType ? parseAiReviewItems(result.action, text)
    .map(({ content }) => content.trim()).filter(Boolean).slice(0, annotationType === 'claim' ? 8 : 6) : [];
  if (annotationType) {
    if (!newAnnotations.length) throw new Error('No new annotations to save from this review.');
    record.targets = newAnnotations.map((_, index) => sourceAnnotationReviewTarget(`${id}-${index}`));
    record.contextRefs = [{ type: 'source', id: baseline.id }];
  }
  const patch = (current: Media) => {
    const history = appendAiReviewHistory(current.aiReviewHistory, { ...aiHistoryEntry(result, text, date), id });
    if (annotationType) {
      const existing = current.annotations || [];
      const seen = new Set(existing.filter((entry) => entry.type === annotationType).map((entry) => entry.text.trim().toLowerCase()));
      const added = newAnnotations.flatMap((content, index): Annotation[] => {
        const key = content.toLowerCase();
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ id: `${id}-${index}`, text: content, type: annotationType, date, textProvenance: ref,
          conceptTags: current.tags || [], philosophyStatus: annotationType === 'claim' ? 'raw' : 'questioned' }];
      });
      if (!added.length) throw new Error('No new annotations to save from this review.');
      return {
        data: { dateUpdated: date, annotations: boundedNestedAnnotations([...added, ...existing]), aiReviewHistory: history },
        annotations: added.map((item) => annotationRecord(baseline.id, item, uid)),
        origin: { ...record, targets: added.map(({ id: itemId }) => sourceAnnotationReviewTarget(itemId)) },
      };
    }
    if (current.capture?.after?.[field] !== baseline.capture?.after?.[field]) {
      throw new Error('This saved source review changed. Run assistance again using the latest source.');
    }
    const data: Partial<Media> = {
      dateUpdated: date,
      capture: { ...current.capture, sessions: current.capture?.sessions || [], after: { ...current.capture?.after, [field]: text.trim() } },
      [field === 'aiSummary' ? 'summaryProvenance' : 'reflectionProvenance']: ref,
      aiReviewHistory: history,
    };
    return { data, annotations: [], origin: record };
  };
  return { record, patch };
}

export function sourceReviewEvent(event: WriteThinkingEventInput, record: AiProvenanceRecord): WriteThinkingEventInput {
  return { ...event, idempotencyKey: record.id, sourceActionId: record.id,
    metadata: { provenanceId: record.id, fieldPath: record.targets[0]?.fieldPath, contextualAiAction: record.origin.action } };
}

export function matchesSourceReview(existing: AiProvenanceRecord | undefined, record: AiProvenanceRecord) {
  return existing?.acceptedTextHash === record.acceptedTextHash
    && existing.origin.action === record.origin.action
    && (record.targets[0]?.type === 'annotation'
      ? Boolean(existing.targets.length && existing.targets.every((target) => record.targets.some((candidate) => candidate.id === target.id))
        && existing.contextRefs?.[0]?.id === record.contextRefs?.[0]?.id)
      : existing.targets?.[0]?.id === record.targets[0]?.id && existing.targets?.[0]?.fieldPath === record.targets[0]?.fieldPath);
}

export async function writeSourceReview(ref: DocumentReference, approval: SourceReviewApproval, date: string, event: WriteThinkingEventInput) {
  requireWorkspaceConnection();
  const account = ref.parent.parent;
  if (account?.path !== `users/${event.userId}` || ref.id !== approval.baseline.id) throw new Error('Invalid source workspace.');
  const { record, patch } = await prepareSourceReview(event.userId, approval, date, serverTimestamp());
  const origin = doc(account, 'aiProvenance', record.id);
  const { eventRef } = makeThinkingEventPayload(sourceReviewEvent(event, record));
  await runTransaction(ref.firestore, async (tx) => {
    const [current, savedOrigin, savedEvent] = await Promise.all([tx.get(ref), tx.get(origin), tx.get(eventRef)]);
    if (!current.exists()) throw new Error('This source is no longer available.');
    if (savedOrigin.exists() || savedEvent.exists()) {
      if (matchesSourceReview(savedOrigin.data() as AiProvenanceRecord | undefined, record)
        && savedEvent.data()?.metadata?.provenanceId === record.id) return;
      throw new Error('This review was already saved with different content.');
    }
    const prepared = patch(current.data() as Media);
    const annotationRefs = prepared.annotations.map(({ id }) => doc(account, 'annotations', id));
    const existing = await Promise.all(annotationRefs.map((item) => tx.get(item)));
    if (existing.some((snapshot) => snapshot.exists())) throw new Error('An annotation from this review already exists.');
    const { payload } = makeThinkingEventPayload(sourceReviewEvent(event, prepared.origin));
    tx.update(ref, prepared.data);
    prepared.annotations.forEach((item, index) => tx.set(annotationRefs[index], item));
    tx.set(origin, prepared.origin);
    tx.set(eventRef, payload);
  });
}
