import { doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { acceptedTextHash, type AiProvenanceRecord } from './ai-provenance';
import { MAX_AI_REVIEW_HISTORY } from './collection-integrity';
import { parseAiReviewItems, type AiReviewResult } from './contextual-ai';
import { makeThinkingEventPayload, type WriteThinkingEventInput } from './thinkingEvents/writeThinkingEvent';
import type { Question } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type InquiryAiReview = Pick<AiReviewResult, 'action' | 'targetId' | 'targetType' | 'reviewId' | 'generatedAt'> & Partial<Pick<AiReviewResult, 'content'>>;

export function inquiryHistorySnapshot(question: Question | undefined) {
  if (!question) return null;
  const { investigationNotes, ...snapshot } = question;
  return { ...snapshot, investigationNotes: investigationNotes?.filter((note) => note.origin === 'user') || [] };
}

export function inquiryAiReviewPatch(question: Question, review: InquiryAiReview, content: string) {
  if (review.action !== 'socratic_inquiry_challenge' || review.targetType !== 'inquiry' || review.targetId !== question.id
    || !review.reviewId || !/^[\w-]{1,100}$/.test(review.reviewId)) throw new Error('This review does not belong to this inquiry.');
  if (question.status === 'archived') throw new Error('Reopen this inquiry before saving a challenge.');
  const reviewId = review.reviewId;
  const current = question.investigationNotes || [];
  const userNotes = current.filter((note) => note.origin !== 'ai-assisted');
  const olderAiNotes = current.filter((note) => note.origin === 'ai-assisted' && !note.id.startsWith(`${reviewId}:`));
  const notes = parseAiReviewItems(review.action, content).filter((item) => item.content.trim()).map((item, index) => ({
    id: `${reviewId}:${index}`, title: item.title, text: item.content, origin: 'ai-assisted' as const, date: review.generatedAt,
    provenance: { provenanceId: `ai-review-${reviewId}`, kind: 'ai-assisted' as const },
  }));
  if (!notes.length) throw new Error('Keep at least one challenge note to save.');
  return { investigationNotes: [...userNotes, ...[...notes, ...olderAiNotes].slice(0, MAX_AI_REVIEW_HISTORY)] };
}

export function makeInquiryAiProvenance(inquiryRef: DocumentReference, review: InquiryAiReview, patch: ReturnType<typeof inquiryAiReviewPatch>, userId: string, hash: string, acceptedAt: unknown) {
  const id = `ai-review-${review.reviewId}`;
  const account = inquiryRef.parent.parent;
  if (!account || account.path !== `users/${userId}`) throw new Error('Invalid inquiry workspace.');
  const record: AiProvenanceRecord = {
    id, provenanceId: id, kind: 'ai-assisted', userId, schemaVersion: 1,
    targets: patch.investigationNotes.flatMap((note) => note.provenance?.provenanceId === id
      ? [{ type: 'inquiry', id: inquiryRef.id, fieldPath: 'investigationNotes.text', subrecordId: note.id }] : []),
    origin: { feature: 'inquiry', action: review.action },
    sourceActionId: id, generatedAt: review.generatedAt, acceptedAt,
    precursor: review.content?.slice(0, 32000) || null, acceptedTextHash: hash, state: 'active',
  };
  return { provenanceRef: doc(account, 'aiProvenance', id), record };
}

export async function writeInquiryAiReview(
  inquiryRef: DocumentReference, review: InquiryAiReview, content: string, dateUpdated: string, event: WriteThinkingEventInput,
) {
  requireWorkspaceConnection();
  const hash = await acceptedTextHash(content);
  const provenanceId = `ai-review-${review.reviewId}`;
  const account = inquiryRef.parent.parent;
  if (!account || account.path !== `users/${event.userId}`) throw new Error('Invalid inquiry workspace.');
  const provenanceRef = doc(account, 'aiProvenance', provenanceId);
  const { eventRef, payload } = makeThinkingEventPayload({ ...event, sourceActionId: provenanceId, metadata: { ...event.metadata, provenanceId, fieldPath: 'investigationNotes.text' } });
  await runTransaction(inquiryRef.firestore, async (transaction) => {
    const [inquiry, previousEvent, existing] = await Promise.all([transaction.get(inquiryRef), transaction.get(eventRef), transaction.get(provenanceRef)]);
    if (!inquiry.exists()) throw new Error('This inquiry is no longer available.');
    if (previousEvent.exists()) {
      const saved = previousEvent.data();
      if (saved.entityId === inquiryRef.id && saved.origin === 'ai-assisted' && saved.metadata?.reviewEntryId === review.reviewId) {
        if (!saved.metadata.provenanceId) return; // Earlier acceptances did not store a hash.
        if (existing.data()?.acceptedTextHash === hash) return;
        throw new Error('This challenge was already saved with different content.');
      }
      throw new Error('This challenge could not be matched to its saved review.');
    }
    const patch = inquiryAiReviewPatch({ ...inquiry.data(), id: inquiryRef.id } as Question, review, content);
    if (existing.exists()) throw new Error('This challenge could not be matched to its saved review.');
    const { record } = makeInquiryAiProvenance(inquiryRef, review, patch, event.userId, hash, serverTimestamp());
    transaction.update(inquiryRef, { ...patch, dateUpdated });
    transaction.set(provenanceRef, record);
    transaction.set(eventRef, payload);
  });
}
