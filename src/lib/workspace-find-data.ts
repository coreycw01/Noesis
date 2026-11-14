import { collection, getDocsFromCache, getDocsFromServer, type DocumentReference } from 'firebase/firestore';
import { mergeSourceAnnotationRecords } from './collection-integrity';
import { abortableOperation } from './abortable-operation';
import { READEX_COLLECTIONS } from './firestore-schema';
import type { AnnotationRecord, Media } from './types';
import type { WorkspaceFindData } from './workspace-find-items';

export async function loadWorkspaceFindData(owner: DocumentReference, signal?: AbortSignal, mode: 'server' | 'cache' = 'server'): Promise<WorkspaceFindData> {
  const read = async <T>(name: keyof typeof READEX_COLLECTIONS) => {
    const target = collection(owner, READEX_COLLECTIONS[name]);
    const snapshot = await (mode === 'cache' ? getDocsFromCache(target) : getDocsFromServer(target));
    return snapshot.docs.flatMap((record) => {
      const data = record.data();
      const uid = data.userId || data.uid;
      return !uid || uid === owner.id ? [{ ...data, id: record.id, ...(name === 'unknowns' && { unknownId: record.id }) } as T] : [];
    });
  };
  const [media, annotations, concepts, drafts, links, practices, questions, unknowns, vault] = await abortableOperation(
    () => Promise.all([
      read<Media>('media'), read<AnnotationRecord>('annotations'), read<WorkspaceFindData['concepts'][number]>('concepts'),
      read<WorkspaceFindData['drafts'][number]>('drafts'), read<WorkspaceFindData['links'][number]>('links'),
      read<WorkspaceFindData['practices'][number]>('practices'), read<WorkspaceFindData['questions'][number]>('questions'),
      read<WorkspaceFindData['unknowns'][number]>('unknowns'), read<WorkspaceFindData['vault'][number]>('vault'),
    ]),
    signal,
  );
  return { media: mergeSourceAnnotationRecords(media, annotations), concepts, drafts, links, practices, questions, unknowns, vault };
}
