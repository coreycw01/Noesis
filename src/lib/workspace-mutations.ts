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
  type WriteBatch,
} from 'firebase/firestore';
import { makeThinkingEventPayload, queueThinkingEvent, type WriteThinkingEventInput } from '@/lib/thinkingEvents/writeThinkingEvent';
import { withNoesisStage } from '@/lib/workflow-integrity';
import type { PhilosophicalObjectType } from '@/lib/types';

type MutationOperation = 'set' | 'update' | 'delete' | 'create';

export const NOESIS_WORKSPACE_SYNC_EVENT = 'noesis:workspace-sync';
export type WorkspaceSyncState = 'saving' | 'saved' | 'error';

let activeWorkspaceMutations = 0;
let mutationBatchFailed = false;

function reportWorkspaceSync(state: WorkspaceSyncState) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOESIS_WORKSPACE_SYNC_EVENT, { detail: { state } }));
}

interface CommitWorkspaceMutationInput<T extends DocumentData = DocumentData> {
  db: Firestore;
  ref: DocumentReference<T>;
  operation: MutationOperation;
  data?: Partial<T> | T;
  setOptions?: SetOptions;
  thinkingEvent?: WriteThinkingEventInput | null;
  thinkingEvents?: WriteThinkingEventInput[];
  relatedUpdates?: Array<{ ref: DocumentReference; data: DocumentData }>;
  relatedWrites?: Array<{
    ref: DocumentReference;
    operation: 'set' | 'update' | 'delete';
    data?: DocumentData;
    setOptions?: SetOptions;
  }>;
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
  relatedWrites = [],
}: CommitWorkspaceMutationInput<T>) {
  if (activeWorkspaceMutations === 0) mutationBatchFailed = false;
  activeWorkspaceMutations += 1;
  reportWorkspaceSync('saving');

  try {
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
  const companionWrites = [
    ...relatedUpdates.map((update) => ({ ...update, operation: 'update' as const })),
    ...relatedWrites,
  ];

  const applyCompanionWrite = (writer: Pick<WriteBatch, 'set' | 'update' | 'delete'>, write: typeof companionWrites[number]) => {
    if (write.operation === 'delete') writer.delete(write.ref);
    else if (write.operation === 'update') writer.update(write.ref, write.data || {});
    else if (write.setOptions) writer.set(write.ref, write.data || {}, write.setOptions);
    else writer.set(write.ref, write.data || {});
  };

  if (operation === 'create') {
    const events = eventQueue.map(makeThinkingEventPayload);
    await runTransaction(db, async (transaction) => {
      if ((await transaction.get(ref)).exists()) {
        throw new Error('This item already exists. Open the current item instead of restoring an older copy.');
      }
      transaction.set(ref, mutationData as any);
      companionWrites.forEach((write) => applyCompanionWrite(transaction as any, write));
      events.forEach(({ eventRef, payload }) => transaction.set(eventRef, payload));
    });
    return;
  }

  if (!eventQueue.length && !companionWrites.length) {
    if (operation === 'delete') await deleteDoc(ref);
    else if (operation === 'update') await updateDoc(ref, mutationData as any);
    else await setDoc(ref, mutationData as any, setOptions as any);
    return;
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
  companionWrites.forEach((write) => applyCompanionWrite(batch, write));
  await batch.commit();
  } catch (error) {
    mutationBatchFailed = true;
    reportWorkspaceSync('error');
    throw error;
  } finally {
    activeWorkspaceMutations = Math.max(0, activeWorkspaceMutations - 1);
    if (activeWorkspaceMutations === 0 && !mutationBatchFailed) reportWorkspaceSync('saved');
  }
}
