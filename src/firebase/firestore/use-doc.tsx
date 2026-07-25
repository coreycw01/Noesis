
'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!docRef) {
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
        setData(snapshot.exists() ? { ...snapshot.data()!, id: snapshot.id } : null);
        setLoading(false);
      },
      async (err) => {
        if (!active) return;
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [docRef]);

  return { data, loading, error };
}
