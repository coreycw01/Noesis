"use client";

import React, { useEffect, useState } from 'react';
import {
  FirebaseClientProvider,
  initializeFirebase,
  isFirebaseConfigComplete,
  missingFirebaseConfigKeys,
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { noesisUserError } from '@/lib/user-facing-errors';

type FirebaseInstances = ReturnType<typeof initializeFirebase>;

export function NoesisProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [firebaseInstances, setFirebaseInstances] = useState<FirebaseInstances | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isFirebaseConfigComplete) return;
    try {
      setFirebaseInstances(initializeFirebase());
    } catch (error) {
      setInitError(noesisUserError(error, 'Firebase initialization failed. Check the public Firebase environment variables and restart the app.'));
    }
  }, [mounted]);

  if (mounted && !isFirebaseConfigComplete) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="max-w-xl rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
          <div className="font-code text-[10px] uppercase tracking-[0.22em] text-accent">Firebase setup required</div>
          <h1 className="mt-3 font-headline text-3xl font-semibold">Noesis needs your Firebase config.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Add these missing variables to `.env.local`, then restart the dev server.
          </p>
          <div className="mt-5 rounded-xl bg-muted/60 p-4 font-code text-xs leading-6 text-muted-foreground">
            {missingFirebaseConfigKeys.map((key) => <div key={key}>{key}</div>)}
          </div>
          <Button variant="outline" onClick={() => window.location.reload()} size="sm" className="mt-6 rounded-full">
            <RefreshCw className="mr-2 size-3.5" /> Reload Page
          </Button>
        </div>
      </div>
    );
  }

  if (mounted && initError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="max-w-xl rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm">
          <div className="font-code text-[10px] uppercase tracking-[0.22em] text-destructive">Firebase failed to start</div>
          <h1 className="mt-3 font-headline text-3xl font-semibold">Check your Firebase settings.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{initError}</p>
          <Button variant="outline" onClick={() => window.location.reload()} size="sm" className="mt-6 rounded-full">
            <RefreshCw className="mr-2 size-3.5" /> Reload Page
          </Button>
        </div>
      </div>
    );
  }

  if (!mounted || !firebaseInstances) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-6">
          <div className="font-code text-[10px] uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Initializing Noesis...</div>
          <Button variant="outline" onClick={() => window.location.reload()} size="sm" className="rounded-full">
            <RefreshCw className="size-3.5 mr-2" /> Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FirebaseClientProvider firebaseApp={firebaseInstances.firebaseApp} firestore={firebaseInstances.firestore} auth={firebaseInstances.auth}>
      {children}
    </FirebaseClientProvider>
  );
}
