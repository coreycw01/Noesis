import type { UserProfile } from './types';
import { acceptedTextHash, type AiProvenanceRecord } from './ai-provenance';
import { aiHistoryEntry, profileStatementFromSynthesis, type AiReviewResult } from './contextual-ai';
import { appendAiReviewHistory } from './collection-integrity';
import { doc, runTransaction, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { makeThinkingEventPayload, type WriteThinkingEventInput } from './thinkingEvents/writeThinkingEvent';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type ProfileReviewApproval = { result: AiReviewResult; text: string; baseline: UserProfile };

export function profileReviewTarget(entryId: string, fieldPath: 'aiReviewHistory.content' | 'philosophyStatement'): AiProvenanceRecord['targets'][number] {
  return { type: 'profile', id: 'main', fieldPath, subrecordId: entryId };
}

export async function prepareProfileReview(userId: string, profile: UserProfile, result: AiReviewResult, text: string, reviewedAt: string, acceptedAt: unknown) {
  if (result.action !== 'synthesize_profile_philosophy' || result.targetType !== 'profile'
    || !result.reviewId || !/^[\w-]{1,100}$/.test(result.reviewId) || !text.trim()) {
    throw new Error('This review does not belong to your philosophy.');
  }
  const id = `ai-review-${result.reviewId}`;
  const statement = profileStatementFromSynthesis(text);
  const ref = { provenanceId: id, kind: 'ai-assisted' as const };
  const patch = {
    philosophySynthesisReview: text,
    philosophySynthesisReviewedAt: reviewedAt,
    dateUpdated: reviewedAt,
    aiReviewHistory: appendAiReviewHistory(profile.aiReviewHistory, { ...aiHistoryEntry(result, text, reviewedAt), id }),
    ...(statement ? { philosophyStatement: statement, philosophyStatementProvenance: ref } : {}),
  };
  const record: AiProvenanceRecord = {
    ...ref, id, userId, schemaVersion: 1, sourceActionId: id,
    origin: { feature: 'profile', action: result.action },
    targets: [profileReviewTarget(id, 'aiReviewHistory.content'), ...(statement ? [profileReviewTarget(id, 'philosophyStatement')] : [])],
    generatedAt: result.generatedAt, acceptedAt, precursor: result.content.slice(0, 32000) || null,
    acceptedTextHash: await acceptedTextHash(text), state: 'active',
  };
  return { patch, record };
}

export function profileReviewEvent(event: WriteThinkingEventInput, record: AiProvenanceRecord): WriteThinkingEventInput {
  return {
    ...event, sourceActionId: record.id, idempotencyKey: record.id,
    metadata: { ...event.metadata, provenanceId: record.id, fieldPaths: record.targets.map(({ fieldPath }) => fieldPath) },
  };
}

export function assertProfileReviewBaseline(current: Partial<UserProfile>, baseline: UserProfile, updatesStatement: boolean) {
  if (JSON.stringify(current.aiReviewHistory ?? []) !== JSON.stringify(baseline.aiReviewHistory ?? [])
    || (updatesStatement && (current.philosophyStatement ?? '') !== (baseline.philosophyStatement ?? ''))) {
    throw new Error('Your philosophy changed before this review could be saved. Reopen assistance to review the latest version.');
  }
}

export async function writeProfileReview(ref: DocumentReference, approval: ProfileReviewApproval, date: string, event: WriteThinkingEventInput) {
  requireWorkspaceConnection();
  const account = ref.parent.parent;
  if (account?.path !== `users/${event.userId}`) throw new Error('Invalid profile workspace.');
  const { patch, record } = await prepareProfileReview(event.userId, approval.baseline, approval.result, approval.text, date, serverTimestamp());
  const origin = doc(account, 'aiProvenance', record.id);
  const { eventRef, payload } = makeThinkingEventPayload(profileReviewEvent(event, record));
  await runTransaction(ref.firestore, async (tx) => {
    const [profile, savedOrigin, savedEvent, legacy] = await Promise.all([
      tx.get(ref), tx.get(origin), tx.get(eventRef), tx.get(doc(account, 'settings', 'profile')),
    ]);
    if (savedOrigin.exists() || savedEvent.exists()) {
      if (savedOrigin.data()?.acceptedTextHash === record.acceptedTextHash && savedEvent.data()?.metadata?.provenanceId === record.id) return;
      throw new Error('This review was already saved with different content.');
    }
    const current = { ...legacy.data(), ...profile.data() } as Partial<UserProfile>;
    assertProfileReviewBaseline(current, approval.baseline, Boolean(patch.philosophyStatement));
    tx.set(ref, patch, { merge: true });
    tx.set(origin, record);
    tx.set(eventRef, payload);
  });
}

const editableFields = ['displayName', 'bio', 'philosophyName', 'philosophyNameStatus', 'philosophyStatement'] as const;

export function profileEditPatch(saved: UserProfile, draft: UserProfile): Partial<UserProfile> {
  const patch: Partial<UserProfile> = {};
  for (const field of editableFields) {
    if ((draft[field] ?? '') !== (saved[field] ?? '')) Object.assign(patch, { [field]: draft[field] ?? '' });
  }
  const avatar = draft.avatarUrl ?? draft.photoURL ?? '';
  if (avatar !== (saved.avatarUrl ?? saved.photoURL ?? '')) {
    patch.avatarUrl = avatar;
    patch.photoURL = avatar;
  }
  return patch;
}
