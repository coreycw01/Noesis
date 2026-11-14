export function readBrowserPreference(key: string, kind: 'localStorage' | 'sessionStorage' = 'localStorage') {
  try { return typeof window === 'undefined' ? null : window[kind].getItem(key); }
  catch { return null; }
}

export function writeBrowserPreference(key: string, value: string, kind: 'localStorage' | 'sessionStorage' = 'localStorage') {
  try { if (typeof window !== 'undefined') window[kind].setItem(key, value); }
  catch { /* Optional preferences cannot block the workspace. */ }
}

export function workspacePreferenceKey(workspaceKey: string | null, key: string) {
  return workspaceKey ? `noesis:workspace:${encodeURIComponent(workspaceKey)}:${key}` : null;
}
