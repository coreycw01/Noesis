"use client";

import {
  deleteDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type SetOptions,
} from 'firebase/firestore';
import { makeThinkingEventPayload, queueThinkingEvent, type WriteThinkingEventInput } from '@/lib/thinkingEvents/writeThinkingEvent';
import { withNoesisStage } from '@/lib/workflow-integrity';
import type { PhilosophicalObjectType } from '@/lib/types';

type MutationOperation = 'set' | 'update' | 'delete' | 'create';

interface CommitWorkspaceMutationInput<T extends DocumentData = DocumentData> {
  db: Firestore;
  ref: DocumentReference<T>;
  operation: MutationOperation;
  data?: Partial<T> | T;
  setOptions?: SetOptions;
  thinkingEvent?: WriteThinkingEventInput | null;
  thinkingEvents?: WriteThinkingEventInput[];
  relatedUpdates?: Array<{ ref: DocumentReference; data: DocumentData }>;
}

export async function commitWorkspaceMutation<T extends DocumentData = DocumentData>({
  db,
  ref,
  operation,
  data,
  setOptions,
  thinkingEvent,
  thinkingEvents,
  relatedUpdates = [],
}: CommitWorkspaceMutationInput<T>) {
  const collectionType: Partial<Record<string, PhilosophicalObjectType>> = {
    media: 'source',
    concepts: 'concept',
    questions: 'inquiry',
    vault: 'position',
    practices: 'practice',
    timeline: 'evolution',
  };
  const pathSegments = ref.path.split('/');
  const entityType = pathSegments.map((segment) => collectionType[segment]).find(Boolean);
  const rawData = data as Record<string, unknown> | undefined;
  const stagedData = entityType && rawData?.status
    ? withNoesisStage(entityType, rawData as { status?: string })
    : rawData;
  const mutationData = operation === 'delete'
    ? undefined
    : {
        ...stagedData,
        clientMutationId: crypto.randomUUID(),
        serverUpdatedAt: serverTimestamp(),
      };
  const eventQueue = [
    ...(thinkingEvent ? [thinkingEvent] : []),
    ...(thinkingEvents || []),
  ];

  if (operation === 'create') {
    const events = eventQueue.map(makeThinkingEventPayload);
    return runTransaction(db, async (transaction) => {
      if ((await transaction.get(ref)).exists()) {
        throw new Error('This item already exists. Open the current item instead of restoring an older copy.');
      }
      transaction.set(ref, mutationData as any);
      relatedUpdates.forEach((update) => transaction.update(update.ref, update.data));
      events.forEach(({ eventRef, payload }) => transaction.set(eventRef, payload));
    });
  }

  if (!eventQueue.length && !relatedUpdates.length) {
    if (operation === 'delete') return deleteDoc(ref);
    if (operation === 'update') return updateDoc(ref, mutationData as any);
    return setDoc(ref, mutationData as any, setOptions as any);
  }

  const batch = writeBatch(db);
  if (operation === 'delete') {
    batch.delete(ref);
  } else if (operation === 'update') {
    batch.update(ref, mutationData as any);
  } else {
    batch.set(ref, mutationData as any, setOptions as any);
  }
  eventQueue.forEach((event) => queueThinkingEvent(batch, event));
  relatedUpdates.forEach((update) => batch.update(update.ref, update.data));
  return batch.commit();
}
