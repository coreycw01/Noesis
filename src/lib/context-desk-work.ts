import { appendAiHistoryEntry, type AiReviewResult } from './contextual-ai';
import { escapeTextAsHtml } from './sanitize';
import type { Draft } from './types';
import { acceptedTextHash, aiCreationPrompt, type AiProvenanceRecord } from './ai-provenance';

export type ContextDeskWorkOrigin = {
  result: AiReviewResult;
  records: ReadonlyArray<{ type: string; id: string }>;
};

export function contextDeskWorkTarget(id: string): AiProvenanceRecord['targets'][number] {
  return { type: 'work', id, fieldPath: 'body', subrecordId: id };
}

export async function contextDeskWorkProvenance(id: string, userId: string, origin: ContextDeskWorkOrigin, reviewedText: string, acceptedAt: unknown): Promise<AiProvenanceRecord> {
  const { result, records } = origin;
  if (result.action !== 'review_selected_context' || result.targetType !== 'context_desk' || contextDeskReviewWorkId(result.reviewId) !== id) {
    throw new Error('This review does not belong to this Work.');
  }
  return {
    id, provenanceId: id, userId, kind: 'ai-assisted', schemaVersion: 1,
    targets: [contextDeskWorkTarget(id)],
    origin: { feature: 'context_desk', action: result.action },
    sourceActionId: id, generatedAt: result.generatedAt, acceptedAt,
    precursor: result.content.slice(0, 32000) || null,
    ...aiCreationPrompt(result),
    contextRefs: records.slice(0, 12).map(({ type, id: recordId }) => ({ type, id: recordId })),
    acceptedTextHash: await acceptedTextHash(reviewedText), state: 'active',
  };
}

export function contextDeskReviewWorkId(reviewId?: string) {
  return reviewId && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(reviewId)
    ? `context-review-${reviewId}` : undefined;
}

export function isContextDeskReviewRetry(existing: Partial<Draft>, requested: Partial<Draft>) {
  const accepted = requested.aiReviewHistory?.[0];
  return Boolean(accepted && accepted.action === 'review_selected_context'
    && existing.id === requested.id && existing.body === requested.body
    && (['conceptIds', 'conceptTags', 'sourceIds', 'questionIds', 'beliefIds'] as const).every((field) => {
      const actual = new Set(existing[field] || []);
      const expected = new Set(requested[field] || []);
      return actual.size === expected.size && [...expected].every((value) => actual.has(value));
    })
    && existing.aiReviewHistory?.some((entry) => entry.id === accepted.id && entry.action === accepted.action && entry.content === accepted.content));
}

export function contextDeskWorkDraft(result: AiReviewResult, content: string, records: ReadonlyArray<{
  type: string; id: string; label: string; sourceIds: string[];
}>, reviewedAt = new Date()): Partial<Draft> {
  const ids = (type: string) => records.filter((record) => record.type === type).map((record) => record.id);
  const body = `<p>${escapeTextAsHtml(content)}</p>`;
  const id = contextDeskReviewWorkId(result.reviewId);
  return {
    ...(id ? { id } : {}),
    title: `Context review - ${reviewedAt.toLocaleDateString()}`,
    body,
    draftContent: body,
    type: 'reflection',
    status: 'drafting',
    workCategory: 'writing',
    workPurpose: 'synthesize',
    conceptTags: records.filter((record) => record.type === 'concept').map((record) => record.label),
    sourceIds: [...new Set([...ids('source'), ...records.filter((record) => record.type === 'annotation').flatMap((record) => record.sourceIds)])],
    questionIds: ids('inquiry'),
    beliefIds: ids('position'),
    aiReviewHistory: appendAiHistoryEntry([], result, content, reviewedAt.toISOString())
      .map((entry) => id ? { ...entry, id } : entry),
  };
}
