"use client";

import React, { lazy, Suspense, useState } from 'react';
import type { User } from 'firebase/auth';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageErrorState } from '@/components/shared/PageState';
import { REVIEW_ACCOUNT_EMAIL, REVIEW_WORKSPACE_UID } from '@/lib/review-workspace-config';

const LoginPage = lazy(() => import('@/components/Auth/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })));

interface WorkspaceContext {
  user: User | null;
  uid: string;
  reviewMode: boolean;
  reviewWorkspaceUid: string;
}

export function NoesisWorkspaceGate({
  reviewMode = false,
  onOpenLocalDemo,
  children,
}: {
  reviewMode?: boolean;
  onOpenLocalDemo?: () => void;
  children: (context: WorkspaceContext) => React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, unavailable, retry } = useUser();
  const [demoMode, setDemoMode] = useState(false);
  const routeDemoMode = pathname === '/demo' || pathname.startsWith('/demo/');
  const allowDemo = reviewMode || process.env.NEXT_PUBLIC_ALLOW_PROTOTYPE_MODE === 'true';
  const isReviewIdentity = (user?.email || '').toLowerCase() === REVIEW_ACCOUNT_EMAIL.toLowerCase();
  const resolvedReviewWorkspaceUid = isReviewIdentity ? (user?.uid || REVIEW_WORKSPACE_UID) : REVIEW_WORKSPACE_UID;

  if (unavailable) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-4">
        <PageErrorState title="Could not check your sign-in session"
          description="Check your connection and try again. Your saved workspace has not changed."
          onRetry={retry}
          alternateAction={onOpenLocalDemo && <Button variant="outline" onClick={onOpenLocalDemo}>Open local demo</Button>}
        />
      </main>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div role="status" className="flex flex-col items-center gap-4">
            <Loader2 className="size-8 animate-spin text-accent" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">Checking your sign-in session</span>
          </div>
          {onOpenLocalDemo && <Button variant="outline" onClick={onOpenLocalDemo}>Open local demo</Button>}
        </div>
      </div>
    );
  }

  if (!user && !demoMode && !routeDemoMode) {
    return (
      <Suspense fallback={
        <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
          <p role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            Loading sign-in
          </p>
        </main>
      }>
        <LoginPage allowDemo={allowDemo} onDemo={() => allowDemo && setDemoMode(true)} />
        <Toaster />
      </Suspense>
    );
  }

  const explicitDemoMode = reviewMode || demoMode || routeDemoMode;
  const useWritableReviewAccount = explicitDemoMode && isReviewIdentity && Boolean(user);
  const workspaceUid = explicitDemoMode
    ? (useWritableReviewAccount ? user!.uid : REVIEW_WORKSPACE_UID)
    : user!.uid;
  const workspaceUser = explicitDemoMode && !useWritableReviewAccount ? null : user;

  return (
    <>
      {children({
        user: workspaceUser,
        uid: workspaceUid,
        reviewMode: explicitDemoMode,
        reviewWorkspaceUid: resolvedReviewWorkspaceUid,
      })}
    </>
  );
}
