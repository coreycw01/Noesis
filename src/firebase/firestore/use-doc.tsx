
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  DocumentReference, 
  onSnapshot, 
  DocumentSnapshot, 
  DocumentData 
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const resolvedDocPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!docRef) {
      resolvedDocPathRef.current = null;
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setData(null);
    setError(null);
    setLoading(true);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<T>) => {
        if (!active) return;
        resolvedDocPathRef.current = docRef.path;
        setData(snapshot.exists() ? { ...snapshot.data()!, id: snapshot.id } : null);
        setLoading(false);
      },
      async (err) => {
        if (!active) return;
        if ((err as { code?: string }).code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
        resolvedDocPathRef.current = docRef.path;
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [docRef]);

  const hasResolvedCurrentDoc = !docRef || resolvedDocPathRef.current === docRef.path;
  return {
    data: hasResolvedCurrentDoc ? data : null,
    loading: docRef && !hasResolvedCurrentDoc ? true : loading,
    error: hasResolvedCurrentDoc ? error : null,
  };
}
