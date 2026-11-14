import { doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { acceptedTextHash, type AiProvenanceRecord } from './ai-provenance';
import { appendAiReviewHistory } from './collection-integrity';
import { aiHistoryEntry, type AiReviewResult } from './contextual-ai';
import { makeThinkingEventPayload, type WriteThinkingEventInput } from './thinkingEvents/writeThinkingEvent';
import type { VaultEntry } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

const destinations = {
  find_position_assumptions: 'assumptions',
  generate_position_counterargument: 'evidenceAgainst',
  identify_missing_position_evidence: 'missingEvidence',
  compare_selected_positions: 'comparisonReviews',
} as const;

export type PositionReviewApproval = { result: AiReviewResult; text: string; comparisonId?: string };

export function positionReviewTarget(id: string, action: string, subrecordId: string) {
  const fieldPath = destinations[action as keyof typeof destinations];
  return fieldPath ? { type: 'position', id, fieldPath, subrecordId } : undefined;
}

export async function preparePositionReview(uid: string, positionId: string, approval: PositionReviewApproval, date: string, acceptedAt: unknown) {
  const { result, text, comparisonId } = approval;
  const id = `ai-review-${result.reviewId}`;
  const target = positionReviewTarget(positionId, result.action, id);
  if (!target || result.targetType !== 'position' || result.targetId !== positionId || !result.reviewId
    || !/^[\w-]{1,100}$/.test(result.reviewId) || !text.trim()
    || (target.fieldPath === 'comparisonReviews' ? !comparisonId || comparisonId === positionId : comparisonId !== undefined)) {
    throw new Error('This review does not match the selected position.');
  }
  const record: AiProvenanceRecord = {
    id, userId: uid, schemaVersion: 1, provenanceId: id, kind: 'ai-assisted', targets: [target],
    origin: { feature: 'position', action: result.action }, sourceActionId: id,
    generatedAt: result.generatedAt, acceptedAt, precursor: result.content.slice(0, 32000) || null,
    acceptedTextHash: await acceptedTextHash(text), state: 'active',
    ...(comparisonId ? { contextRefs: [{ type: 'position', id: comparisonId }] } : {}),
  };
  const patch = (current: VaultEntry, comparison?: VaultEntry): Partial<VaultEntry> => {
    const value = text.trim();
    const fields: Partial<VaultEntry> = {};
    switch (target.fieldPath) {
      case 'comparisonReviews':
        if (!comparison || comparison.id !== comparisonId) throw new Error('The comparison position is no longer available.');
        fields.comparisonReviews = [...(current.comparisonReviews || []), { positionId: comparison.id, positionTitle: comparison.title, content: value, date }];
        break;
      case 'evidenceAgainst':
        fields.evidenceAgainst = [...new Set([...(current.evidenceAgainst || []), value])];
        break;
      default:
        fields[target.fieldPath] = [...new Set([...(current[target.fieldPath] || []), ...value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)])];
    }
    return { ...fields, dateUpdated: date, aiReviewHistory: appendAiReviewHistory(current.aiReviewHistory, { ...aiHistoryEntry(result, value, date), id }) };
  };
  return { record, patch };
}

export function matchesPositionReview(existing: Partial<AiProvenanceRecord> | undefined, record: AiProvenanceRecord) {
  return existing?.acceptedTextHash === record.acceptedTextHash && existing.origin?.action === record.origin.action
    && existing.targets?.[0]?.id === record.targets[0].id && existing.contextRefs?.[0]?.id === record.contextRefs?.[0]?.id;
}

export function positionReviewEvent(event: WriteThinkingEventInput, record: AiProvenanceRecord): WriteThinkingEventInput {
  return { ...event, idempotencyKey: record.id, sourceActionId: record.id,
    metadata: { provenanceId: record.id, fieldPath: record.targets[0].fieldPath, contextualAiAction: record.origin.action } };
}

export async function writePositionReview(ref: DocumentReference, approval: PositionReviewApproval, date: string, event: WriteThinkingEventInput) {
  requireWorkspaceConnection();
  const account = ref.parent.parent;
  if (account?.path !== `users/${event.userId}`) throw new Error('Invalid position workspace.');
  const { record, patch } = await preparePositionReview(event.userId, ref.id, approval, date, serverTimestamp());
  const origin = doc(account, 'aiProvenance', record.id);
  const { eventRef, payload } = makeThinkingEventPayload(positionReviewEvent(event, record));
  await runTransaction(ref.firestore, async (tx) => {
    const [current, savedOrigin, savedEvent] = await Promise.all([tx.get(ref), tx.get(origin), tx.get(eventRef)]);
    if (!current.exists()) throw new Error('This position is no longer available.');
    if (savedOrigin.exists() || savedEvent.exists()) {
      if (matchesPositionReview(savedOrigin.data(), record) && savedEvent.data()?.metadata?.provenanceId === record.id) return;
      throw new Error('This review was already saved with different content.');
    }
    const comparison = approval.comparisonId ? await tx.get(doc(ref.parent, approval.comparisonId)) : undefined;
    tx.update(ref, patch(current.data() as VaultEntry, comparison?.data() as VaultEntry | undefined));
    tx.set(origin, record);
    tx.set(eventRef, payload);
  });
}
