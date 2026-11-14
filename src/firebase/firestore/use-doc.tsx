
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  DocumentReference, 
  onSnapshot, 
  DocumentSnapshot, 
  DocumentData,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null, retryVersion = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const resolvedKeyRef = useRef<string | null>(null);
  const latestDocRef = useRef(docRef);
  latestDocRef.current = docRef;
  const key = docRef ? `${retryVersion}:${docRef.path}` : null;

  useEffect(() => {
    const subscribedDocRef = latestDocRef.current;
    if (!subscribedDocRef) {
      resolvedKeyRef.current = null;
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    resolvedKeyRef.current = null;
    setData(null);
    setError(null);
    setLoading(true);
    const unsubscribe = onSnapshot(
      subscribedDocRef,
      (snapshot: DocumentSnapshot<T>) => {
        if (!active) return;
        resolvedKeyRef.current = key;
        setData(snapshot.exists() ? { ...snapshot.data()!, id: snapshot.id } : null);
        setLoading(false);
      },
      async (err) => {
        if (!active) return;
        if ((err as { code?: string }).code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: subscribedDocRef.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
        resolvedKeyRef.current = key;
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [key]);

  const hasResolvedCurrentDoc = !key || resolvedKeyRef.current === key;
  return {
    data: docRef && hasResolvedCurrentDoc ? data : null,
    loading: docRef ? !hasResolvedCurrentDoc || loading : false,
    error: docRef && hasResolvedCurrentDoc ? error : null,
  };
}
