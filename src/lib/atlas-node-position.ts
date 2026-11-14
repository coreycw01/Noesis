import { runTransaction, type DocumentReference } from 'firebase/firestore';
import { conceptKey } from './readex';
import type { AtlasMap } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type AtlasNodePosition = { x: number; y: number };

export function atlasNodePositionPatch(map: Pick<AtlasMap, 'nodeNames' | 'nodePositions'> | undefined, key: string, position: AtlasNodePosition, dateUpdated: string) {
  const nodeKey = conceptKey(key);
  if (!map?.nodeNames?.some((name) => conceptKey(name) === nodeKey)) {
    throw new Error('This node is no longer on the map.');
  }
  return { nodePositions: { ...map.nodePositions, [nodeKey]: position }, dateUpdated };
}

export async function writeAtlasNodePosition(ref: DocumentReference, key: string, position: AtlasNodePosition, dateUpdated: string) {
  requireWorkspaceConnection();
  await runTransaction(ref.firestore, async (transaction) => {
    const current = (await transaction.get(ref)).data() as AtlasMap | undefined;
    transaction.update(ref, atlasNodePositionPatch(current, key, position, dateUpdated));
  });
}
