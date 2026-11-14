"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { FirebaseProvider } from './provider';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageState';
import { localDemoFirebase } from './demo-services';

export function DemoFirebaseProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof localDemoFirebase>> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void localDemoFirebase().then((value) => { if (active) setInstances(value); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  if (failed) return <PageErrorState title="Demo workspace unavailable" onRetry={() => window.location.reload()} />;
  if (!instances) return <PageLoadingState title="Opening the local demo" />;
  return <FirebaseProvider {...instances}>{children}</FirebaseProvider>;
}
