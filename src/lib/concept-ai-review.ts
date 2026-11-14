import { doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { acceptedTextHash, type AiProvenanceRecord } from './ai-provenance';
import { aiHistoryEntry, type AiReviewResult } from './contextual-ai';
import { appendAiReviewHistory } from './collection-integrity';
import { makeThinkingEventPayload, type WriteThinkingEventInput } from './thinkingEvents/writeThinkingEvent';
import type { Concept } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type ConceptReviewApproval = { result: AiReviewResult; text: string; baseline: Concept };
export type ConceptReviewField = 'description' | 'boundaryReview';

export function conceptReviewTarget(id: string, fieldPath: ConceptReviewField, entryId: string) {
  return { type: 'concept', id, fieldPath, subrecordId: entryId };
}

export async function prepareConceptReview(uid: string, approval: ConceptReviewApproval, date: string, acceptedAt: unknown) {
  const { result, text, baseline } = approval;
  if (result.targetType !== 'concept' || result.targetId !== baseline.id || !result.reviewId
    || !/^[\w-]{1,100}$/.test(result.reviewId) || !text.trim()
    || !['refine_concept_definition', 'clarify_concept_boundaries'].includes(result.action)) {
    throw new Error('This review does not belong to this concept.');
  }
  const field: ConceptReviewField = result.action === 'refine_concept_definition' ? 'description' : 'boundaryReview';
  const provenanceId = `ai-review-${result.reviewId}`;
  const provenance = { provenanceId, kind: 'ai-assisted' as const };
  const record: AiProvenanceRecord = {
    ...provenance, id: provenanceId, userId: uid, schemaVersion: 1, sourceActionId: provenanceId,
    targets: [conceptReviewTarget(baseline.id, field, provenanceId)],
    origin: { feature: 'concept', action: result.action },
    generatedAt: result.generatedAt, acceptedAt, precursor: result.content.slice(0, 32000) || null,
    acceptedTextHash: await acceptedTextHash(text), state: 'active',
  };
  const patch: Partial<Concept> = {
    [field]: text.trim(), dateUpdated: date,
    [field === 'description' ? 'definitionProvenance' : 'boundaryProvenance']: provenance,
    aiReviewHistory: appendAiReviewHistory(baseline.aiReviewHistory, { ...aiHistoryEntry(result, text, date), id: provenanceId }),
    ...(field === 'description' && baseline.createdFrom === 'tag' ? { createdFrom: 'manual' } : {}),
  };
  return { field, patch, record };
}

export function assertConceptReviewBaseline(current: Partial<Concept>, baseline: Concept, field: ConceptReviewField) {
  if ((current[field] ?? '') !== (baseline[field] ?? '')
    || JSON.stringify(current.aiReviewHistory ?? []) !== JSON.stringify(baseline.aiReviewHistory ?? [])
    || (field === 'description' && current.createdFrom !== baseline.createdFrom)) {
    throw new Error('This concept changed before the review could be saved. Run assistance on the latest version.');
  }
}

export function conceptReviewEvent(event: WriteThinkingEventInput, record: AiProvenanceRecord): WriteThinkingEventInput {
  return { ...event, idempotencyKey: record.id, sourceActionId: record.id,
    metadata: { provenanceId: record.id, fieldPath: record.targets[0].fieldPath, contextualAiAction: record.origin.action } };
}

export async function writeConceptReview(ref: DocumentReference, approval: ConceptReviewApproval, date: string, event: WriteThinkingEventInput) {
  requireWorkspaceConnection();
  const account = ref.parent.parent;
  if (account?.path !== `users/${event.userId}` || ref.id !== approval.baseline.id) throw new Error('Invalid concept workspace.');
  const { field, patch, record } = await prepareConceptReview(event.userId, approval, date, serverTimestamp());
  const origin = doc(account, 'aiProvenance', record.id);
  const { eventRef, payload } = makeThinkingEventPayload(conceptReviewEvent(event, record));
  await runTransaction(ref.firestore, async (tx) => {
    const [current, previousOrigin, previousEvent] = await Promise.all([tx.get(ref), tx.get(origin), tx.get(eventRef)]);
    if (!current.exists()) throw new Error('This concept is no longer available.');
    if (previousOrigin.exists() || previousEvent.exists()) {
      if (previousOrigin.data()?.acceptedTextHash === record.acceptedTextHash
        && previousOrigin.data()?.targets?.[0]?.id === ref.id
        && previousOrigin.data()?.targets?.[0]?.fieldPath === field
        && previousEvent.data()?.metadata?.provenanceId === record.id) return;
      throw new Error('This review was already saved with different content.');
    }
    assertConceptReviewBaseline(current.data(), approval.baseline, field);
    tx.update(ref, patch);
    tx.set(origin, record);
    tx.set(eventRef, payload);
  });
}
