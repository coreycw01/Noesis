import { doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { acceptedTextHash, type AiProvenanceRecord } from './ai-provenance';
import { aiHistoryEntry, type AiReviewResult } from './contextual-ai';
import { appendAiReviewHistory } from './collection-integrity';
import { isPracticeConcluded } from './practice-state';
import { makeThinkingEventPayload, type WriteThinkingEventInput } from './thinkingEvents/writeThinkingEvent';
import type { Practice } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type PracticeReviewApproval = { result: AiReviewResult; text: string };

export function practiceReviewTarget(id: string, provenanceId: string) {
  return { type: 'practice', id, fieldPath: 'aiOutcomeReview', subrecordId: provenanceId };
}

export async function preparePracticeReview(uid: string, baseline: Practice, { result, text }: PracticeReviewApproval, date: string, acceptedAt: unknown) {
  if (result.action !== 'synthesize_practice_outcome' || result.targetType !== 'practice' || result.targetId !== baseline.id
    || !result.reviewId || !/^[\w-]{1,100}$/.test(result.reviewId) || !text.trim()) throw new Error('This review does not belong to this practice.');
  const id = `ai-review-${result.reviewId}`;
  const ref = { provenanceId: id, kind: 'ai-assisted' as const };
  const record: AiProvenanceRecord = {
    ...ref, id, userId: uid, schemaVersion: 1, sourceActionId: id,
    targets: [practiceReviewTarget(baseline.id, id)], origin: { feature: 'practice', action: result.action },
    generatedAt: result.generatedAt, acceptedAt, precursor: result.content.slice(0, 32000) || null,
    acceptedTextHash: await acceptedTextHash(text), state: 'active',
  };
  const patch = (current: Practice): Partial<Practice> => {
    if (!isPracticeConcluded(current) || current.status === 'abandoned') throw new Error('Only a concluded practice can receive an outcome review.');
    if (current.aiOutcomeReview !== baseline.aiOutcomeReview || current.outcomeProvenance?.provenanceId !== baseline.outcomeProvenance?.provenanceId) {
      throw new Error('The saved outcome review changed. Review the latest version first.');
    }
    return { aiOutcomeReview: text.trim(), outcomeProvenance: ref, dateUpdated: date,
      aiReviewHistory: appendAiReviewHistory(current.aiReviewHistory, { ...aiHistoryEntry(result, text, date), id }) };
  };
  return { record, patch };
}

export function practiceReviewEvent(event: WriteThinkingEventInput, record: AiProvenanceRecord): WriteThinkingEventInput {
  return { ...event, sourceActionId: record.id, idempotencyKey: record.id,
    metadata: { provenanceId: record.id, fieldPath: 'aiOutcomeReview', contextualAiAction: record.origin.action } };
}

export function matchesPracticeReview(existing: Partial<AiProvenanceRecord> | undefined, record: AiProvenanceRecord) {
  return existing?.acceptedTextHash === record.acceptedTextHash && existing.origin?.action === record.origin.action
    && existing.targets?.[0]?.id === record.targets[0].id && existing.targets?.[0]?.fieldPath === 'aiOutcomeReview';
}

export async function writePracticeReview(ref: DocumentReference, baseline: Practice, approval: PracticeReviewApproval, date: string, event: WriteThinkingEventInput) {
  requireWorkspaceConnection();
  const account = ref.parent.parent;
  if (account?.path !== `users/${event.userId}` || ref.id !== baseline.id) throw new Error('Invalid practice workspace.');
  const { record, patch } = await preparePracticeReview(event.userId, baseline, approval, date, serverTimestamp());
  const origin = doc(account, 'aiProvenance', record.id);
  const { eventRef, payload } = makeThinkingEventPayload(practiceReviewEvent(event, record));
  return runTransaction(ref.firestore, async (tx) => {
    const [current, savedOrigin, savedEvent] = await Promise.all([tx.get(ref), tx.get(origin), tx.get(eventRef)]);
    if (!current.exists()) throw new Error('This practice is no longer available.');
    const practice = current.data() as Practice;
    if (savedOrigin.exists() || savedEvent.exists()) {
      if (matchesPracticeReview(savedOrigin.data(), record) && savedEvent.data()?.metadata?.provenanceId === record.id) return practice;
      throw new Error('This review was already saved with different content.');
    }
    const update = patch(practice);
    tx.update(ref, update);
    tx.set(origin, record);
    tx.set(eventRef, payload);
    return { ...practice, ...update };
  });
}
