"use client";

import { doc, runTransaction, serverTimestamp, setDoc, type CollectionReference, type WriteBatch } from 'firebase/firestore';
import { requireWorkspaceConnection } from '@/lib/workspace-connectivity';
import type { ThinkingEvent, ThinkingEventEntityType, ThinkingEventEpistemicStatus, ThinkingEventImportance, ThinkingEventOrigin, ThinkingEventType } from '@/lib/types';
import { uid } from '@/lib/readex';
import type { AiProvenanceRecord } from '@/lib/ai-provenance';
import { restoredItemHistorySnapshot } from '@/lib/deleted-items';

type RelatedEntityIds = NonNullable<ThinkingEvent['relatedEntityIds']>;

export interface WriteThinkingEventInput {
  collection: CollectionReference<any>;
  userId: string;
  actorId?: string;
  eventType: ThinkingEventType;
  actionType?: ThinkingEventType;
  entityType: ThinkingEventEntityType;
  entityId: string;
  relatedEntityIds?: RelatedEntityIds;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  summary: string;
  userReason?: string | null;
  aiReason?: string | null;
  systemReason?: string | null;
  origin: ThinkingEventOrigin;
  confidenceBefore?: number | null;
  confidenceAfter?: number | null;
  epistemicStatus?: ThinkingEventEpistemicStatus | null;
  importance?: ThinkingEventImportance;
  sourceActionId?: string | null;
  idempotencyKey?: string | null;
  visibility?: 'private' | 'public_preview';
  metadata?: Record<string, any>;
}

function sanitizeEventSnapshot<T>(value: T): T | null {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function buildObjectDiff(before?: Record<string, any> | null, after?: Record<string, any> | null) {
  if (!before && !after) return null;
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const diff: Record<string, { before: any; after: any }> = {};
  keys.forEach((key) => {
    const left = before?.[key];
    const right = after?.[key];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diff[key] = { before: left ?? null, after: right ?? null };
    }
  });
  return Object.keys(diff).length ? diff : null;
}

function changedFieldsFromDiff(diff: Record<string, any> | null) {
  return diff ? Object.keys(diff).sort() : [];
}

function toLegacyTargetType(entityType: ThinkingEventEntityType): ThinkingEvent['targetType'] {
  if (entityType === 'source') return 'source';
  if (entityType === 'annotation') return 'annotation';
  if (entityType === 'concept') return 'concept';
  if (entityType === 'inquiry') return 'inquiry';
  if (entityType === 'position') return 'position';
  if (entityType === 'work') return 'work';
  if (entityType === 'practice') return 'practice';
  if (entityType === 'suggestion') return 'suggestion';
  if (entityType === 'unknown') return 'unknown';
  if (entityType === 'thinkingPattern') return 'thinking_pattern';
  return 'evolution';
}

export function makeThinkingEventPayload(input: WriteThinkingEventInput) {
  if (!input.userId) throw new Error('Missing userId');
  if (!input.eventType) throw new Error('Missing eventType');
  if (!input.entityType) throw new Error('Missing entityType');
  if (!input.entityId) throw new Error('Missing entityId');
  if (!input.summary) throw new Error('Missing summary');

  const eventId = input.idempotencyKey || uid();
  const eventRef = doc(input.collection, eventId);
  const before = sanitizeEventSnapshot(input.before);
  const after = sanitizeEventSnapshot(input.eventType === 'restored' && input.after
    ? restoredItemHistorySnapshot(input.after) : input.after);
  // Deletions keep a recovery snapshot; don't duplicate it in the event diff.
  const diff = input.eventType === 'deleted' || input.eventType === 'restored' ? null : buildObjectDiff(before, after);
  const payload: ThinkingEvent = {
    id: eventRef.id,
    eventId: eventRef.id,
    userId: input.userId,
    schemaVersion: 2,
    actorId: input.actorId || input.userId,
    eventType: input.eventType,
    actionType: input.actionType || input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    relatedEntityIds: input.relatedEntityIds || {},
    before,
    after,
    diff,
    changedFields: changedFieldsFromDiff(diff),
    targetType: toLegacyTargetType(input.entityType),
    targetId: input.entityId,
    sourceType: input.origin,
    summary: input.summary,
    userReason: input.userReason ?? null,
    aiReason: input.aiReason ?? null,
    systemReason: input.systemReason ?? null,
    origin: input.origin,
    confidenceBefore: input.confidenceBefore ?? null,
    confidenceAfter: input.confidenceAfter ?? null,
    epistemicStatus: input.epistemicStatus ?? null,
    importance: input.importance || 'medium',
    sourceActionId: input.sourceActionId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    visibility: input.visibility || 'private',
    metadata: input.metadata || {},
    createdAt: serverTimestamp() as any,
  };
  return { eventRef, payload };
}

export async function writeThinkingEvent(input: WriteThinkingEventInput) {
  const { eventRef, payload } = makeThinkingEventPayload(input);
  await setDoc(eventRef, payload, { merge: false });
  return eventRef.id;
}

type PeriodSynthesisRecord = Pick<ThinkingEvent, 'userId' | 'entityType' | 'entityId' | 'eventType' | 'origin' | 'summary' | 'after'>;

export function matchesPeriodSynthesis(existing: PeriodSynthesisRecord, intended: PeriodSynthesisRecord) {
  return existing.userId === intended.userId && existing.entityType === 'evolution' && intended.entityType === 'evolution'
    && existing.eventType === 'synthesized' && intended.eventType === 'synthesized'
    && existing.origin === 'ai-assisted' && intended.origin === 'ai-assisted'
    && existing.entityId === intended.entityId && existing.summary === intended.summary
    && existing.after?.legacyTimelineEvent?.reason === intended.after?.legacyTimelineEvent?.reason;
}

export async function writePeriodSynthesis(input: WriteThinkingEventInput, provenance?: AiProvenanceRecord) {
  requireWorkspaceConnection();
  const { eventRef, payload } = makeThinkingEventPayload(input);
  const owner = eventRef.parent.parent;
  if (provenance && (owner?.path !== `users/${input.userId}` || provenance.id !== eventRef.id)) throw new Error('Invalid period review destination.');
  const origin = provenance && owner ? doc(owner, 'aiProvenance', provenance.id) : undefined;
  await runTransaction(eventRef.firestore, async (transaction) => {
    const existing = await transaction.get(eventRef);
    const storedOrigin = origin ? await transaction.get(origin) : undefined;
    if (!existing.exists() && !storedOrigin?.exists()) {
      transaction.set(eventRef, payload);
      if (origin) transaction.set(origin, provenance!);
    } else if (!existing.exists() || !matchesPeriodSynthesis(existing.data(), payload)
      || (provenance && (storedOrigin?.data()?.acceptedTextHash !== provenance.acceptedTextHash
        || JSON.stringify(storedOrigin.data()?.contextRefs ?? []) !== JSON.stringify(provenance.contextRefs ?? [])))) {
      throw new Error('This review was already saved with different content. Start a new review to save another version.');
    }
  });
}

export function queueThinkingEvent(batch: WriteBatch, input: WriteThinkingEventInput) {
  const { eventRef, payload } = makeThinkingEventPayload(input);
  batch.set(eventRef, payload, { merge: false });
  return { eventRef, payload };
}
