"use client";

import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { NoesisProviders } from '@/components/app-shell/NoesisProviders';
import { NoesisWorkspaceGate } from '@/components/app-shell/NoesisWorkspaceGate';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageState';
import { NoesisWorkspaceKeyContext, useNoesisRoute } from '@/lib/noesis-route-context';
import { loadDemoSession } from '@/lib/demo-session';
import { REVIEW_WORKSPACE_UID } from '@/lib/review-workspace-config';
import { readBrowserPreference, writeBrowserPreference } from '@/lib/browser-preferences';
import '../globals.css';
import '../prototype-skin.css';

const localDemoPreference = 'noesis:open-local-demo';
let workspaceModule: Promise<typeof import('./noesis-home-page')> | undefined;
const loadWorkspace = () => workspaceModule ??= import('./noesis-home-page');
let demoPreparation: Promise<unknown> | undefined;
const prepareDemo = () => demoPreparation ??= Promise.all([loadDemoSession(), loadWorkspace()]);
const ReadexWorkspace = lazy(() => loadWorkspace().then(({ ReadexWorkspace }) => ({ default: ReadexWorkspace })));
const DemoFirebaseProvider = lazy(() => import('@/firebase/demo-provider').then(({ DemoFirebaseProvider }) => ({ default: DemoFirebaseProvider })));
const SignedInWorkspace = lazy(async () => {
  const [{ ReadexWorkspace: Workspace }, { WorkspaceFirebaseProvider }] = await Promise.all([
    loadWorkspace(),
    import('@/firebase/workspace-provider'),
  ]);
  return {
    default: function SignedInWorkspaceContent(props: React.ComponentProps<typeof Workspace>) {
      return <WorkspaceFirebaseProvider><Workspace {...props} /></WorkspaceFirebaseProvider>;
    },
  };
});

type WorkspaceIdentity = Pick<React.ComponentProps<typeof ReadexWorkspace>, 'uid' | 'user' | 'reviewMode' | 'reviewWorkspaceUid'>;

function DemoWorkspaceLoader({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    void prepareDemo()
      .then(() => { if (active) setState('ready'); }, () => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);
  if (state === 'error') return <PageErrorState title="Demo workspace unavailable" onRetry={() => window.location.reload()} />;
  if (state === 'loading') return <PageLoadingState title="Loading the demo workspace" />;
  return children;
}

export function NoesisWorkspaceEntry() {
  const pathname = usePathname();
  const reviewMode = /^\/(demo|review)(\/|$)/.test(pathname);
  const { routeState } = useNoesisRoute();
  const [localDemoRequested, setLocalDemoRequested] = useState<boolean | null>(null);
  useEffect(() => {
    setLocalDemoRequested(readBrowserPreference(localDemoPreference, 'sessionStorage') === 'true');
  }, []);
  useEffect(() => {
    if (reviewMode) void prepareDemo().catch(() => {
      // The demo loader reports failures if the local workspace is opened.
    });
  }, [reviewMode]);
  const renderWorkspace = (workspace: WorkspaceIdentity) => {
    const workspaceKey = `${workspace.uid}:${workspace.user ? 'account' : 'demo'}`;
    const seeded = workspace.reviewMode && !workspace.user;
    const Workspace = seeded ? ReadexWorkspace : SignedInWorkspace;
    const content = (
      <NoesisWorkspaceKeyContext.Provider key={workspaceKey} value={workspaceKey}>
        <Suspense fallback={<PageLoadingState title="Opening your workspace" />}>
          <Workspace {...workspace} routeStateOverride={routeState} />
        </Suspense>
      </NoesisWorkspaceKeyContext.Provider>
    );
    return seeded ? <DemoWorkspaceLoader key={workspaceKey}>{content}</DemoWorkspaceLoader> : content;
  };

  const localDemo = reviewMode ? (
      <Suspense fallback={<PageLoadingState title="Opening the local demo" />}>
        <DemoFirebaseProvider>
          {renderWorkspace({ user: null, uid: REVIEW_WORKSPACE_UID, reviewMode: true, reviewWorkspaceUid: REVIEW_WORKSPACE_UID })}
        </DemoFirebaseProvider>
      </Suspense>
  ) : undefined;
  if (reviewMode && localDemoRequested === null) return <PageLoadingState title="Opening the demo workspace" />;
  if (localDemoRequested && localDemo) return localDemo;

  const openLocalDemo = () => {
    writeBrowserPreference(localDemoPreference, 'true', 'sessionStorage');
    setLocalDemoRequested(true);
  };
  return (
    <NoesisProviders unavailableFallback={localDemo}>
      <NoesisWorkspaceGate reviewMode={reviewMode} onOpenLocalDemo={reviewMode ? openLocalDemo : undefined}>
        {(workspace) => workspace.reviewMode && !workspace.user ? (
          <Suspense fallback={<PageLoadingState title="Opening the local demo" />}>
            <DemoFirebaseProvider>{renderWorkspace(workspace)}</DemoFirebaseProvider>
          </Suspense>
        ) : renderWorkspace(workspace)}
      </NoesisWorkspaceGate>
    </NoesisProviders>
  );
}
