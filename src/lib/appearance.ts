import type { AppearanceSettings } from '@/lib/types';

export const NOESIS_THEME_STORAGE_KEY = 'noesis:theme';

export type AppearanceSnapshot = Pick<
  AppearanceSettings,
  'themeMode' | 'accentTheme' | 'headerFont' | 'fontSize' | 'interfaceShape' | 'defaultCollectionView' | 'highContrastMode' | 'reducedMotion'
>;

let lastAppliedPreference: Partial<AppearanceSnapshot> = {};

export function appearanceSnapshot(appearance: AppearanceSnapshot): AppearanceSnapshot {
  const { themeMode, accentTheme, headerFont, fontSize, interfaceShape, defaultCollectionView, highContrastMode, reducedMotion } = appearance;
  return { themeMode, accentTheme, headerFont, fontSize, interfaceShape, defaultCollectionView, highContrastMode, reducedMotion };
}

export function appearanceSettingsWrites(changes: Partial<AppearanceSnapshot>, dateUpdated: string) {
  const { themeMode, accentTheme } = changes;
  const preferences = {
    ...(themeMode !== undefined ? { themeMode } : {}),
    ...(accentTheme !== undefined ? { accentTheme } : {}),
  };
  return {
    appearance: { ...changes, dateUpdated },
    preferences: Object.keys(preferences).length ? { ...preferences, dateUpdated } : null,
  };
}

export function readPersistedAppearanceSettings(): Partial<AppearanceSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(NOESIS_THEME_STORAGE_KEY);
    if (!raw) return lastAppliedPreference;
    const saved = JSON.parse(raw);
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : lastAppliedPreference;
  } catch {
    return lastAppliedPreference;
  }
}

export function applyAppearanceSettings(
  appearance: AppearanceSnapshot,
  systemDark = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const dark = appearance.themeMode === 'dark' || (appearance.themeMode === 'system' && systemDark);

  root.classList.toggle('dark', dark);
  root.classList.toggle('high-contrast', appearance.highContrastMode);
  root.classList.toggle('reduce-motion', appearance.reducedMotion);
  root.dataset.theme = appearance.accentTheme;
  root.dataset.headerFont = appearance.headerFont;
  root.dataset.fontSize = appearance.fontSize;
  root.dataset.interfaceShape = appearance.interfaceShape;
  root.dataset.collectionView = appearance.defaultCollectionView;
}

export function persistAppearanceSettings(appearance: AppearanceSnapshot) {
  if (typeof window === 'undefined') return;
  lastAppliedPreference = { ...appearance };
  try {
    window.localStorage.setItem(NOESIS_THEME_STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // The account setting can still be saved if browser storage is disabled.
  }
  window.dispatchEvent(new CustomEvent('noesis:appearance-change', { detail: appearance }));
}

export function workspaceScrollBehavior(
  appReduced = typeof document !== 'undefined' && document.documentElement.classList.contains('reduce-motion'),
  systemReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
): ScrollBehavior {
  return appReduced || systemReduced ? 'instant' : 'smooth';
}
