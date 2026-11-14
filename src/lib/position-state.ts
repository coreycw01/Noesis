import type { VaultEntry } from './types';

const dormantStatuses = new Set(['abandoned', 'rejected', 'replaced', 'suspended']);

export function isLivePosition(position: Pick<VaultEntry, 'status'>) {
  return !dormantStatuses.has(position.status);
}
