
'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Query, 
  onSnapshot, 
  QuerySnapshot, 
  DocumentData 
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

const activeDevelopmentListeners = new Map<string, number>();

function listenerKey(query: Query<unknown>) {
  return (query as any)._query?.path?.canonicalString?.()
    || (query as any)._query?.path?.toString?.()
    || 'unknown';
}

export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setData([]);
    setLoading(true);
    setError(null);
    const key = listenerKey(query as Query<unknown>);
    if (process.env.NODE_ENV === 'development') {
      const nextCount = (activeDevelopmentListeners.get(key) || 0) + 1;
      activeDevelopmentListeners.set(key, nextCount);
      if (nextCount > 1) {
        console.info('[Firestore listeners] Duplicate active subscription', { path: key, count: nextCount });
      }
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        if (!active) return;
        const items = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setData(items);
        setLoading(false);
      },
      async (err) => {
        if (!active) return;
        if ((err as { code?: string }).code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: (query as any)._query?.path?.toString() || 'unknown',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
      if (process.env.NODE_ENV === 'development') {
        const nextCount = Math.max(0, (activeDevelopmentListeners.get(key) || 1) - 1);
        if (nextCount === 0) activeDevelopmentListeners.delete(key);
        else activeDevelopmentListeners.set(key, nextCount);
      }
    };
  }, [query]);

  return { data, loading, error };
}
