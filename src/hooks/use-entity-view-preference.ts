'use client';

import { useCallback, useEffect, useState } from 'react';
import { readPersistedAppearanceSettings } from '@/lib/appearance';

export type EntityViewPreference = 'cards' | 'table';

export function useEntityViewPreference(key: string) {
  const storageKey = `noesis:${key}-view`;
  const [value, setValue] = useState<EntityViewPreference>(() => {
    if (typeof window === 'undefined') return 'cards';
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === 'cards' || saved === 'table') return saved;
      return readPersistedAppearanceSettings().defaultCollectionView || 'cards';
    } catch {
      return 'cards';
    }
  });

  useEffect(() => {
    const applyNewDefault = (event: Event) => {
      try {
        if (window.localStorage.getItem(storageKey)) return;
        const nextDefault = (event as CustomEvent<{ defaultCollectionView?: EntityViewPreference }>).detail?.defaultCollectionView;
        if (nextDefault === 'cards' || nextDefault === 'table') setValue(nextDefault);
      } catch {
        // Appearance defaults are optional and must never block the workspace.
      }
    };
    window.addEventListener('noesis:appearance-change', applyNewDefault);
    return () => window.removeEventListener('noesis:appearance-change', applyNewDefault);
  }, [storageKey]);

  const updateValue = useCallback((nextValue: EntityViewPreference) => {
    setValue(nextValue);
    try {
      window.localStorage.setItem(storageKey, nextValue);
    } catch {
      // A page view preference is optional and must never block the workspace.
    }
  }, [storageKey]);

  return [value, updateValue] as const;
}
