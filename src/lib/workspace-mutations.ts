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
import { NOESIS_WORKSPACE_SYNC_EVENT, reportSlowAcknowledgement, requireWorkspaceConnection, type WorkspaceSyncState } from '@/lib/workspace-connectivity';

type MutationOperation = 'set' | 'update' | 'delete' | 'create';

export class WorkspaceRecordChangedError extends Error {
  constructor() {
    super('This record changed before it could be saved. Review the latest version and try again.');
    this.name = 'WorkspaceRecordChangedError';
  }
}

let activeWorkspaceMutations = 0;
let waitingWorkspaceMutations = 0;
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
    operation: MutationOperation;
    data?: DocumentData;
    setOptions?: SetOptions;
  }>;
  createIfMissing?: Array<{ ref: DocumentReference; data: DocumentData; thinkingEvent?: WriteThinkingEventInput }>;
  requireUnchanged?: { ref: DocumentReference; field: string; value: unknown };
  requireUnchangedRecords?: Array<{ ref: DocumentReference; field: string; value: unknown }>;
  acceptExistingCreate?: (existing: DocumentData) => boolean;
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
  createIfMissing = [],
  requireUnchanged,
  requireUnchangedRecords = [],
  acceptExistingCreate,
}: CommitWorkspaceMutationInput<T>) {
  requireWorkspaceConnection();
  if (activeWorkspaceMutations === 0) mutationBatchFailed = false;
  activeWorkspaceMutations += 1;
  reportWorkspaceSync(waitingWorkspaceMutations ? 'waiting' : 'saving');
  let waiting = false;
  const stopWaitingTimer = reportSlowAcknowledgement(() => {
    waiting = true;
    waitingWorkspaceMutations += 1;
    reportWorkspaceSync('waiting');
  });

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

  type MutationWriter = {
    set(ref: DocumentReference, data: DocumentData): unknown;
    set(ref: DocumentReference, data: DocumentData, options: SetOptions): unknown;
    update(ref: DocumentReference, data: DocumentData): unknown;
    delete(ref: DocumentReference): unknown;
  };
  const applyCompanionWrite = (writer: MutationWriter, write: typeof companionWrites[number]) => {
    if (write.operation === 'delete') writer.delete(write.ref);
    else if (write.operation === 'update') writer.update(write.ref, write.data || {});
    else if (write.setOptions) writer.set(write.ref, write.data || {}, write.setOptions);
    else writer.set(write.ref, write.data || {});
  };

  const guards = requireUnchanged ? [requireUnchanged, ...requireUnchangedRecords] : requireUnchangedRecords;
  const newCompanions = companionWrites.filter((write) => write.operation === 'create');
  if (operation === 'create' || createIfMissing.length || guards.length || newCompanions.length) {
    const events = eventQueue.map(makeThinkingEventPayload);
    const candidates = createIfMissing.map((candidate) => ({
      ...candidate,
      event: candidate.thinkingEvent ? makeThinkingEventPayload(candidate.thinkingEvent) : null,
    }));
    await runTransaction(db, async (transaction) => {
      if (operation === 'create') {
        const existing = await transaction.get(ref);
        if (existing.exists()) {
          if (acceptExistingCreate?.(existing.data())) return;
          throw new Error('This item already exists. Open the current item instead of restoring an older copy.');
        }
      }
      const guardedSnapshots = await Promise.all(guards.map(({ ref }) => transaction.get(ref)));
      for (const [index, guard] of guards.entries()) {
        const current = guardedSnapshots[index];
        if (!current.exists() || current.get(guard.field) !== guard.value) {
          throw new WorkspaceRecordChangedError();
        }
      }
      const snapshots = await Promise.all(candidates.map((candidate) => transaction.get(candidate.ref)));
      const companionSnapshots = await Promise.all([
        ...newCompanions.map((write) => transaction.get(write.ref)),
        ...(newCompanions.length ? events.filter(({ payload }) => payload.idempotencyKey).map(({ eventRef }) => transaction.get(eventRef)) : []),
      ]);
      if (companionSnapshots.some((snapshot) => snapshot.exists())) throw new WorkspaceRecordChangedError();
      applyCompanionWrite(transaction, { ref, operation: operation === 'create' ? 'set' : operation, data: mutationData, setOptions });
      candidates.forEach((candidate, index) => {
        if (snapshots[index].exists()) return;
        transaction.set(candidate.ref, candidate.data);
        if (candidate.event) transaction.set(candidate.event.eventRef, candidate.event.payload);
      });
      companionWrites.forEach((write) => applyCompanionWrite(transaction, write));
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
    stopWaitingTimer();
    if (waiting) waitingWorkspaceMutations -= 1;
    activeWorkspaceMutations = Math.max(0, activeWorkspaceMutations - 1);
    if (activeWorkspaceMutations === 0 && !mutationBatchFailed) reportWorkspaceSync('saved');
    else if (waiting && !waitingWorkspaceMutations && !mutationBatchFailed) reportWorkspaceSync('saving');
  }
}
