"use client";

import {
  deleteDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type SetOptions,
} from 'firebase/firestore';
import { queueThinkingEvent, type WriteThinkingEventInput } from '@/lib/thinkingEvents/writeThinkingEvent';

type MutationOperation = 'set' | 'update' | 'delete';

interface CommitWorkspaceMutationInput<T extends DocumentData = DocumentData> {
  db: Firestore;
  ref: DocumentReference<T>;
  operation: MutationOperation;
  data?: Partial<T> | T;
  setOptions?: SetOptions;
  thinkingEvent?: WriteThinkingEventInput | null;
  thinkingEvents?: WriteThinkingEventInput[];
}

export async function commitWorkspaceMutation<T extends DocumentData = DocumentData>({
  db,
  ref,
  operation,
  data,
  setOptions,
  thinkingEvent,
  thinkingEvents,
}: CommitWorkspaceMutationInput<T>) {
  const mutationData = operation === 'delete'
    ? undefined
    : {
        ...(data as Record<string, unknown>),
        clientMutationId: crypto.randomUUID(),
        serverUpdatedAt: serverTimestamp(),
      };
  const eventQueue = [
    ...(thinkingEvent ? [thinkingEvent] : []),
    ...(thinkingEvents || []),
  ];

  if (!eventQueue.length) {
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
  return batch.commit();
}
