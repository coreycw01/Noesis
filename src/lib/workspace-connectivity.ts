export const NOESIS_WORKSPACE_SYNC_EVENT = 'noesis:workspace-sync';
export type WorkspaceSyncState = 'saving' | 'waiting' | 'saved' | 'error';

export class WorkspaceOfflineError extends Error {
  constructor() {
    super('You are offline. Reconnect before saving this change.');
    this.name = 'WorkspaceOfflineError';
  }
}

export function requireWorkspaceConnection(online = typeof navigator === 'undefined' || navigator.onLine !== false) {
  if (!online) throw new WorkspaceOfflineError();
}

export function reportSlowAcknowledgement(notify: () => void, delayMs = 8000) {
  const timer = setTimeout(notify, delayMs);
  return () => clearTimeout(timer);
}
