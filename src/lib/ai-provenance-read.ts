import { doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import { readDemoSession } from './demo-session';
import type { AiProvenanceRecord, ProvenanceRef } from './ai-provenance';

export async function readAiProvenance(db: Firestore, workspace: string | null | undefined, provenance: ProvenanceRef, target: AiProvenanceRecord['targets'][number]) {
  const uid = workspace?.slice(0, workspace.lastIndexOf(':'));
  if (!uid) return null;
  const data = (workspace?.endsWith(':demo')
    ? readDemoSession(uid).aiProvenance?.find(record => record.id === provenance.provenanceId)
    : (await getDocFromServer(doc(db, 'users', uid, 'aiProvenance', provenance.provenanceId))).data()) as AiProvenanceRecord | undefined;
  return data?.userId === uid && data.targets?.some(entry =>
    entry.type === target.type && entry.id === target.id && entry.fieldPath === target.fieldPath
    && entry.subrecordId === target.subrecordId) ? data : null;
}
