'use client';

import { useEffect, useState } from 'react';

export function usePersistentView<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const saved = window.localStorage.getItem(key) as T | null;
      return saved && allowed.includes(saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // View preference is optional and must never block the workspace.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
