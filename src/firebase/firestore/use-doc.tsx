
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
  const latestDocRef = useRef(docRef);
  latestDocRef.current = docRef;
  const docPath = docRef?.path ?? null;

  useEffect(() => {
    const subscribedDocRef = latestDocRef.current;
    if (!subscribedDocRef) {
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
      subscribedDocRef,
      (snapshot: DocumentSnapshot<T>) => {
        if (!active) return;
        resolvedDocPathRef.current = subscribedDocRef.path;
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
        resolvedDocPathRef.current = subscribedDocRef.path;
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [docPath]);

  const hasResolvedCurrentDoc = !docPath || resolvedDocPathRef.current === docPath;
  return {
    data: hasResolvedCurrentDoc ? data : null,
    loading: docRef && !hasResolvedCurrentDoc ? true : loading,
    error: hasResolvedCurrentDoc ? error : null,
  };
}
