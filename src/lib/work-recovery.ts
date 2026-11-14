import type { Draft } from './types';

const MAX_RECOVERY_CHARS = 750_000;
type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type WorkVersion = Pick<Draft, 'id' | 'revision' | 'dateUpdated'>;

export function sameWorkVersion(base: WorkVersion, other: WorkVersion) {
  return base.id === other.id && base.revision === other.revision && base.dateUpdated === other.dateUpdated;
}

export function isNewerWorkVersion(candidate: WorkVersion, base: WorkVersion) {
  if (candidate.id !== base.id) return false;
  const revisionDelta = (candidate.revision ?? 0) - (base.revision ?? 0);
  return revisionDelta ? revisionDelta > 0 : candidate.dateUpdated > base.dateUpdated;
}

export interface WorkRecovery {
  version: 1;
  baseRevision: number | null;
  baseUpdatedAt: string;
  draft: Draft;
}

export function tabRecoveryStorage() {
  try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; }
}

function recoveryKey(uid: string, id: string) {
  return `noesis:work-recovery:v1:${encodeURIComponent(uid)}:${encodeURIComponent(id)}`;
}

export function makeWorkRecovery(base: WorkVersion, draft: Draft): WorkRecovery {
  return { version: 1, baseRevision: base.revision ?? null, baseUpdatedAt: base.dateUpdated, draft };
}

export function canApplyWorkRecovery(base: WorkVersion, recovery: WorkRecovery) {
  return base.id === recovery.draft.id && (base.revision ?? null) === recovery.baseRevision
    && base.dateUpdated === recovery.baseUpdatedAt;
}

export function readWorkRecovery(storage: RecoveryStorage, uid: string, id: string): WorkRecovery | null {
  try {
    const value = JSON.parse(storage.getItem(recoveryKey(uid, id)) || 'null');
    if (value?.version !== 1 || value.draft?.id !== id || typeof value.draft.title !== 'string'
      || typeof value.draft.body !== 'string' || typeof value.baseUpdatedAt !== 'string'
      || (value.baseRevision !== null && !Number.isInteger(value.baseRevision))) return null;
    return value;
  } catch { return null; }
}

export function writeWorkRecovery(storage: RecoveryStorage, uid: string, recovery: WorkRecovery) {
  try {
    const value = JSON.stringify(recovery);
    if (value.length > MAX_RECOVERY_CHARS) return false;
    storage.setItem(recoveryKey(uid, recovery.draft.id), value);
    return true;
  } catch { return false; }
}

export function removeWorkRecovery(storage: RecoveryStorage, uid: string, id: string) {
  try { storage.removeItem(recoveryKey(uid, id)); } catch { /* Local storage can be disabled. */ }
}
