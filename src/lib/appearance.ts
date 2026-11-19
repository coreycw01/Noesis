import type { AppearanceSettings, StageColorKey } from '@/lib/types';

export const NOESIS_THEME_STORAGE_KEY = 'noesis:theme';

export type AppearanceSnapshot = Pick<
  AppearanceSettings,
  'themeMode' | 'accentTheme' | 'headerFont' | 'fontSize' | 'interfaceShape' | 'defaultCollectionView' | 'highContrastMode' | 'reducedMotion' | 'stageColors'
>;

let lastAppliedPreference: Partial<AppearanceSnapshot> = {};

export function appearanceSnapshot(appearance: AppearanceSnapshot): AppearanceSnapshot {
  const { themeMode, accentTheme, headerFont, fontSize, interfaceShape, defaultCollectionView, highContrastMode, reducedMotion, stageColors } = appearance;
  return { themeMode, accentTheme, headerFont, fontSize, interfaceShape, defaultCollectionView, highContrastMode, reducedMotion, ...(stageColors ? { stageColors } : {}) };
}

export function appearanceSettingsWrites(changes: Partial<AppearanceSnapshot>, dateUpdated: string) {
  const { themeMode, accentTheme } = changes;
  const preferences = {
    ...(themeMode !== undefined ? { themeMode } : {}),
    ...(accentTheme !== undefined ? { accentTheme } : {}),
  };
  // Firestore merges nested maps on save, so a reset colour is written as an
  // empty string rather than left out (which would keep the old colour).
  const stageColors = changes.stageColors
    ? Object.fromEntries(STAGE_COLOR_KEYS.map((key) => [key, changes.stageColors?.[key] || '']))
    : undefined;
  return {
    appearance: { ...changes, ...(stageColors ? { stageColors } : {}), dateUpdated },
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
  applyStageColors(appearance.stageColors);
}

export const STAGE_COLOR_KEYS: StageColorKey[] = ['encounter', 'outline', 'examine', 'claim', 'act', 'integrate', 'more'];

/** "#rrggbb" to the "h s% l%" triplet the theme tokens use, or null if it is not a colour. */
export function hexToHslTriplet(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2; const d = max - min;
  let h = 0; let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Each chosen stage colour replaces that stage's token on every page that uses it. */
export function applyStageColors(colors: AppearanceSettings['stageColors'] = {}) {
  if (typeof document === 'undefined') return;
  const style = document.documentElement.style;
  for (const key of STAGE_COLOR_KEYS) {
    const value = colors?.[key] ? hexToHslTriplet(colors[key] as string) : null;
    for (const token of [`--stage-${key}`, `--sidebar-stage-${key}`]) {
      if (value) style.setProperty(token, value); else style.removeProperty(token);
    }
  }
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
