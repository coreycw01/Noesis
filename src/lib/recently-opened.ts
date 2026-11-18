import { readBrowserPreference, workspacePreferenceKey, writeBrowserPreference } from '@/lib/browser-preferences';
import type { NoesisRouteTargetType } from '@/lib/noesis-routes';

/**
 * Records the user opened most recently, kept on this device per workspace.
 * Used for the "Recently opened" strip on index pages; never synced.
 */
export interface RecentlyOpenedItem {
  type: NoesisRouteTargetType;
  id: string;
  label: string;
  at: string;
  annotationSourceId?: string;
}

export const RECENTLY_OPENED_EVENT = 'noesis:recently-opened';
const LIMIT = 24;

export function recentlyOpenedKey(workspaceKey: string | null) {
  return workspacePreferenceKey(workspaceKey, 'recently-opened');
}

export function readRecentlyOpened(workspaceKey: string | null): RecentlyOpenedItem[] {
  const key = recentlyOpenedKey(workspaceKey);
  if (!key) return [];
  try {
    const parsed: unknown = JSON.parse(readBrowserPreference(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is RecentlyOpenedItem => Boolean(item && typeof item === 'object' && 'id' in item && 'type' in item)) : [];
  } catch {
    return [];
  }
}

export function mergeRecentlyOpened(list: RecentlyOpenedItem[], item: RecentlyOpenedItem, limit = LIMIT) {
  return [item, ...list.filter((entry) => !(entry.type === item.type && entry.id === item.id))].slice(0, limit);
}

export function recordRecentlyOpened(workspaceKey: string | null, item: Omit<RecentlyOpenedItem, 'at'>, now = new Date()) {
  const key = recentlyOpenedKey(workspaceKey);
  if (!key || !item.label.trim()) return;
  writeBrowserPreference(key, JSON.stringify(mergeRecentlyOpened(readRecentlyOpened(workspaceKey), { ...item, label: item.label.trim().slice(0, 120), at: now.toISOString() })));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(RECENTLY_OPENED_EVENT));
}
