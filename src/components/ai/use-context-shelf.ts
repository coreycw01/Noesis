'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { workspacePreferenceKey } from '@/lib/browser-preferences';
import { readSavedDesks } from '@/lib/saved-context-desks';
import { readFolders } from '@/lib/context-folders';

const shelves = {
  drawer: { path: 'contextDesks', field: 'desks', read: readSavedDesks },
  folder: { path: 'contextFolders', field: 'folders', read: readFolders },
} as const;

export function useContextShelf<K extends keyof typeof shelves>(uid: string | null, kind: K) {
  type Entries = ReturnType<typeof shelves[K]['read']>;
  const shelf = shelves[kind];
  const read = shelf.read as (value: unknown) => Entries;
  const workspace = useContext(NoesisWorkspaceKeyContext);
  const db = useFirestore();
  const local = workspace?.endsWith(':demo') ?? false;
  const localKey = local && uid ? workspacePreferenceKey(workspace, shelf.path) : null;
  const ref = useMemo(() => uid && !local ? doc(db, 'users', uid, 'settings', shelf.path) : null, [db, uid, local, shelf.path]);
  const { data, loading, error } = useDoc(ref);
  const [localData, setLocalData] = useState<{ key: string; entries?: Entries; error?: Error }>();

  useEffect(() => {
    if (!localKey) return;
    const refresh = () => {
      try {
        setLocalData({ key: localKey, entries: read(JSON.parse(window.localStorage.getItem(localKey) || '[]')) });
      } catch {
        setLocalData({ key: localKey, error: new Error('Saved context is unavailable in this browser.') });
      }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === localKey || event.key === null) refresh(); };
    refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener(localKey, refresh);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(localKey, refresh); };
  }, [localKey, read]);

  async function update(change: (current: Entries) => Entries) {
    if (localKey) {
      const next = change(read(JSON.parse(window.localStorage.getItem(localKey) || '[]')));
      window.localStorage.setItem(localKey, JSON.stringify(next));
      window.dispatchEvent(new Event(localKey));
    } else if (ref) {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        transaction.set(ref, { schemaVersion: 1, [shelf.field]: change(read(snapshot.data()?.[shelf.field])) });
      });
    } else {
      throw new Error('Sign in to file this item.');
    }
  }

  return {
    entries: local ? (localData?.key === localKey ? localData?.entries ?? read(null) : read(null)) : read(data?.[shelf.field]),
    loading: local ? !!localKey && localData?.key !== localKey : loading,
    error: local ? localData?.error : error,
    update,
  };
}
