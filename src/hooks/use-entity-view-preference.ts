'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readPersistedAppearanceSettings } from '@/lib/appearance';

export type EntityViewPreference = 'cards' | 'table';

export function useEntityViewPreference(key: string) {
  const storageKey = `noesis:${key}-view`;
  const hasLocalOverride = useRef(false);
  const [value, setValue] = useState<EntityViewPreference>(() => {
    if (typeof window === 'undefined') return 'cards';
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === 'cards' || saved === 'table') return saved;
    } catch { /* Fall back to the current account default. */ }
    return readPersistedAppearanceSettings().defaultCollectionView === 'table' ? 'table' : 'cards';
  });

  useEffect(() => {
    const applyNewDefault = (event: Event) => {
      if (hasLocalOverride.current) return;
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved === 'cards' || saved === 'table') return;
      } catch { /* The account default is still available in this tab. */ }
      const nextDefault = (event as CustomEvent<{ defaultCollectionView?: EntityViewPreference }>).detail?.defaultCollectionView;
      if (nextDefault === 'cards' || nextDefault === 'table') setValue(nextDefault);
    };
    window.addEventListener('noesis:appearance-change', applyNewDefault);
    return () => window.removeEventListener('noesis:appearance-change', applyNewDefault);
  }, [storageKey]);

  const updateValue = useCallback((nextValue: EntityViewPreference) => {
    hasLocalOverride.current = true;
    setValue(nextValue);
    try {
      window.localStorage.setItem(storageKey, nextValue);
    } catch {
      // A page view preference is optional and must never block the workspace.
    }
  }, [storageKey]);

  return [value, updateValue] as const;
}
