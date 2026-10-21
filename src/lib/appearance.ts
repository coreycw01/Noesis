import type { AppearanceSettings } from '@/lib/types';

export const NOESIS_THEME_STORAGE_KEY = 'noesis:theme';

export type AppearanceSnapshot = Pick<
  AppearanceSettings,
  'themeMode' | 'accentTheme' | 'headerFont' | 'fontSize' | 'interfaceShape' | 'defaultCollectionView' | 'highContrastMode' | 'reducedMotion'
>;

export function readPersistedAppearanceSettings(): Partial<AppearanceSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(NOESIS_THEME_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
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
  window.localStorage.setItem(NOESIS_THEME_STORAGE_KEY, JSON.stringify(appearance));
  window.dispatchEvent(new CustomEvent('noesis:appearance-change', { detail: appearance }));
}
