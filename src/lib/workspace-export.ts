import { READEX_COLLECTIONS } from './firestore-schema';
import { collection, getDocFromServer, getDocsFromServer, type DocumentReference } from 'firebase/firestore';
import { requireWorkspaceConnection } from './workspace-connectivity';

export const workspaceRecordCollections = Object.keys(READEX_COLLECTIONS).filter(
  (name): name is Exclude<keyof typeof READEX_COLLECTIONS, 'settings'> => name !== 'settings',
);

export type ExportRecord = { id: string } & Record<string, unknown>;
type ReadCollection = (name: (typeof workspaceRecordCollections)[number] | 'settings' | 'profile') => Promise<ExportRecord[]>;

export async function buildWorkspaceExport(uid: string, readCollection: ReadCollection, readAccount: () => Promise<ExportRecord | null>) {
  const [account, settings, profile, ...records] = await Promise.all([
    readAccount(),
    readCollection('settings'),
    readCollection('profile'),
    ...workspaceRecordCollections.map(readCollection),
  ]);
  const documentsById = (items: ExportRecord[]) => Object.fromEntries(items.map(({ id, ...data }) => [id, data]));
  return {
    format: 'noesis-workspace',
    version: 1,
    exportedAt: new Date().toISOString(),
    includesUploadedFiles: false,
    user: { uid, account },
    profile: documentsById(profile),
    settings: documentsById(settings),
    collections: Object.fromEntries(workspaceRecordCollections.map((name, index) => [name, records[index]])),
  };
}

export function exportSavedWorkspace(accountRef: DocumentReference) {
  requireWorkspaceConnection();
  return buildWorkspaceExport(accountRef.id, async (name) => {
    const result = await getDocsFromServer(collection(accountRef, name));
    return result.docs.map((record) => ({ ...record.data(), id: record.id }));
  }, async () => {
    const record = await getDocFromServer(accountRef);
    return record.exists() ? { ...record.data(), id: record.id } : null;
  });
}
