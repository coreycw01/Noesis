"use client";

import {
  deleteDoc,
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
  const eventQueue = [
    ...(thinkingEvent ? [thinkingEvent] : []),
    ...(thinkingEvents || []),
  ];

  if (!eventQueue.length) {
    if (operation === 'delete') return deleteDoc(ref);
    if (operation === 'update') return updateDoc(ref, data as any);
    return setDoc(ref, data as any, setOptions as any);
  }

  const batch = writeBatch(db);
  if (operation === 'delete') {
    batch.delete(ref);
  } else if (operation === 'update') {
    batch.update(ref, data as any);
  } else {
    batch.set(ref, data as any, setOptions as any);
  }
  eventQueue.forEach((event) => queueThinkingEvent(batch, event));
  return batch.commit();
}
