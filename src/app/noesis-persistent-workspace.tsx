"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { NoesisRouteProvider } from '@/lib/noesis-route-context';
import { parseNoesisRoute } from '@/lib/noesis-routes';
import { metadataForNoesisRouteState } from '@/lib/noesis-page-definitions';

function WorkspaceFrameLoading() {
  return (
    <div className="flex min-h-screen bg-background text-foreground" aria-busy="true" aria-live="polite">
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar px-6 py-8 text-sidebar-foreground md:flex md:flex-col">
        <div className="font-headline text-3xl font-semibold italic">Noesis.</div>
        <p className="mt-2 font-code text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Turn thought into understanding.</p>
        <div className="mt-10 space-y-3" aria-hidden="true">
          {[80, 64, 72, 58, 68, 52, 76, 60].map((width, index) => (
            <div key={index} className="h-8 rounded-md bg-sidebar-foreground/10" style={{ width: `${width}%` }} />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />
          <span>Loading your workspace</span>
        </div>
      </main>
    </div>
  );
}

const WORKSPACE_SECTIONS = new Set([
  '',
  'home',
  'atlas',
  'concepts',
  'inquiries',
  'library',
  'sources',
  'annotations',
  'positions',
  'works',
  'context-desk',
  'labs',
  'evolution',
  'profile',
  'goals',
  'settings',
  'demo',
  'review',
]);

function isNoesisWorkspacePath(pathname: string) {
  const firstSegment = pathname.split('/').filter(Boolean)[0] || '';
  return WORKSPACE_SECTIONS.has(firstSegment);
}

export function NoesisPersistentWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const routeState = useMemo(() => parseNoesisRoute(pathname), [pathname]);
  const isWorkspace = isNoesisWorkspacePath(pathname);
  const [Workspace, setWorkspace] = useState<React.ComponentType | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    if (!isWorkspace) return;
    const label = pathname.startsWith('/demo') ? 'Demo Workspace' : pathname.startsWith('/review') ? 'Review Workspace' : undefined;
    const title = metadataForNoesisRouteState(routeState, label).title;
    if (typeof title === 'string') document.title = title;
  }, [isWorkspace, pathname, routeState]);
  useEffect(() => {
    if (!isWorkspace || Workspace) return;
    let current = true;
    import('./noesis-home-page').then((module) => {
      if (current) setWorkspace(() => module.NoesisRoutePage);
    }).catch(() => { if (current) setLoadFailed(true); });
    return () => { current = false; };
  }, [isWorkspace, Workspace]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>('.noesis-app-main');
      const scrollRegion = main?.querySelector<HTMLElement>('[data-noesis-scroll-region]');
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      main?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (scrollRegion) scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  if (!isWorkspace) return <>{children}</>;
  if (loadFailed) return <main className="min-h-screen bg-background p-8 text-foreground" role="alert">The workspace could not load. <button className="underline" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!Workspace) return <WorkspaceFrameLoading />;

  return (
    <NoesisRouteProvider routeState={routeState}>
      <Workspace />
    </NoesisRouteProvider>
  );
}
