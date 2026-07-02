"use client";

import { doc, setDoc, type CollectionReference, type WriteBatch } from 'firebase/firestore';
import type { ThinkingEvent, ThinkingEventEntityType, ThinkingEventEpistemicStatus, ThinkingEventImportance, ThinkingEventOrigin, ThinkingEventType } from '@/lib/types';
import { today, uid } from '@/lib/readex';

type RelatedEntityIds = NonNullable<ThinkingEvent['relatedEntityIds']>;

export interface WriteThinkingEventInput {
  collection: CollectionReference<any>;
  userId: string;
  eventType: ThinkingEventType;
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
  const after = sanitizeEventSnapshot(input.after);
  const payload: ThinkingEvent = {
    id: eventRef.id,
    eventId: eventRef.id,
    userId: input.userId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    relatedEntityIds: input.relatedEntityIds || {},
    before,
    after,
    diff: buildObjectDiff(before, after),
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
    createdAt: today(),
  };
  return { eventRef, payload };
}

export async function writeThinkingEvent(input: WriteThinkingEventInput) {
  const { eventRef, payload } = makeThinkingEventPayload(input);
  await setDoc(eventRef, payload, { merge: false });
  return eventRef.id;
}

export function queueThinkingEvent(batch: WriteBatch, input: WriteThinkingEventInput) {
  const { eventRef, payload } = makeThinkingEventPayload(input);
  batch.set(eventRef, payload, { merge: false });
  return { eventRef, payload };
}
