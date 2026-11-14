'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { FirebaseClientProvider, initializeFirebase } from './index';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageState';

export function WorkspaceFirebaseProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<ReturnType<typeof initializeFirebase>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    try {
      setInstances(initializeFirebase());
    } catch {
      setFailed(true);
    }
  }, []);

  if (failed) return <PageErrorState title="Could not connect to your workspace" onRetry={() => window.location.reload()} />;
  if (!instances) return <PageLoadingState title="Opening your workspace" />;
  return <FirebaseClientProvider {...instances}>{children}</FirebaseClientProvider>;
}
