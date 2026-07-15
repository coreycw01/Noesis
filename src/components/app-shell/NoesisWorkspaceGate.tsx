"use client";

import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { LoginPage } from '@/components/Auth/LoginPage';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { PROTOTYPE_USER_ID } from '@/lib/firestore-schema';
import { REVIEW_ACCOUNT_EMAIL, REVIEW_WORKSPACE_UID } from '@/lib/demo-workspace';

interface WorkspaceContext {
  user: User | null;
  uid: string;
  reviewMode: boolean;
  reviewWorkspaceUid: string;
}

export function NoesisWorkspaceGate({
  reviewMode = false,
  children,
}: {
  reviewMode?: boolean;
  children: (context: WorkspaceContext) => React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const [demoMode, setDemoMode] = useState(false);
  const routeDemoMode = pathname === '/demo' || pathname.startsWith('/demo/');
  const allowDemo = reviewMode || process.env.NEXT_PUBLIC_ALLOW_PROTOTYPE_MODE === 'true';
  const isReviewIdentity = (user?.email || '').toLowerCase() === REVIEW_ACCOUNT_EMAIL.toLowerCase();
  const resolvedReviewWorkspaceUid = isReviewIdentity ? (user?.uid || REVIEW_WORKSPACE_UID) : REVIEW_WORKSPACE_UID;

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-accent" />
          <div className="font-code text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Syncing Mind</div>
        </div>
      </div>
    );
  }

  if (!user && !demoMode && !routeDemoMode) {
    return (
      <>
        <LoginPage allowDemo={allowDemo} onDemo={() => allowDemo && setDemoMode(true)} />
        <Toaster />
      </>
    );
  }

  const workspaceUid = (reviewMode || demoMode || routeDemoMode || isReviewIdentity)
    ? resolvedReviewWorkspaceUid
    : (user?.uid || PROTOTYPE_USER_ID);

  return (
    <>
      {children({
        user,
        uid: workspaceUid,
        reviewMode: reviewMode || demoMode || routeDemoMode || isReviewIdentity,
        reviewWorkspaceUid: resolvedReviewWorkspaceUid,
      })}
    </>
  );
}
