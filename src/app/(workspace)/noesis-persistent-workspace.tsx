"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { NoesisRouteProvider } from '@/lib/noesis-route-context';
import { parseNoesisRoute } from '@/lib/noesis-routes';
import { metadataForNoesisRouteState } from '@/lib/noesis-page-definitions';
import { workspaceRouteScrollTop, workspaceScrollRoute } from '@/lib/workspace-navigation';

const routeScroller = '.noesis-page, [data-noesis-scroll-region]';

function useWorkspaceRouteScroll(pathname: string, enabled: boolean) {
  const previousPath = useRef(pathname);
  const positions = useRef(new Map<string, number>());
  const pendingFocus = useRef<string | null>(null);

  useLayoutEffect(() => {
    const top = workspaceRouteScrollTop(previousPath.current, pathname, positions.current);
    previousPath.current = pathname;
    if (!enabled) return;
    const route = workspaceScrollRoute(pathname);
    if (top !== null) pendingFocus.current = route.path;
    const focusAtNavigation = document.activeElement;
    const getMain = () => document.getElementById('noesis-main-content');
    const currentScroller = () => Array.from(getMain()?.querySelectorAll<HTMLElement>(routeScroller) ?? []).find(
      (element) => !element.closest('[inert]'),
    );
    let observer: MutationObserver | undefined;
    let focusFrame = 0;
    let restoring = top !== null;
    const apply = () => {
      const main = getMain();
      const ready = main?.querySelector<HTMLElement>('[data-noesis-ready-path]');
      const readyForRoute = ready?.dataset.noesisReadyPath === route.path;
      const scroller = readyForRoute ? currentScroller() : undefined;
      if (restoring && top !== null && scroller) {
        scroller.scrollTop = top;
        restoring = false;
      }
      if (pendingFocus.current === route.path && readyForRoute && ready && main && !focusFrame) {
        // Data may be ready while the route's lazy component still renders nothing.
        const heading = ready.querySelector<HTMLElement>('h1, [role="heading"][aria-level="1"]');
        if (!heading && !scroller && !ready.querySelector('[role="alert"]')) return;
        focusFrame = window.requestAnimationFrame(() => {
          focusFrame = 0;
          if (!ready.isConnected || ready.dataset.noesisReadyPath !== route.path) return;
          pendingFocus.current = null;
          restoring = false;
          observer?.disconnect();
          if ((document.activeElement !== focusAtNavigation && ready.contains(document.activeElement))
            || document.activeElement?.closest('[role="dialog"], [role="alertdialog"]')) return;
          const destination = ready.querySelector<HTMLElement>('[data-noesis-route-focus]')
            || ready.querySelector<HTMLElement>('h1, [role="heading"][aria-level="1"]');
          const target = top === 0 && destination ? destination : main;
          if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
          target.focus({ preventScroll: true });
        });
      }
      if (!restoring && pendingFocus.current !== route.path) observer?.disconnect();
    };
    if (restoring) {
      window.scrollTo(0, 0);
      const main = getMain();
      if (main) main.scrollTop = 0;
    }
    apply();
    if (restoring || pendingFocus.current === route.path) {
      observer = new MutationObserver(apply);
      observer.observe(getMain() ?? document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['inert', 'data-noesis-ready-path'] });
    }
    const remember = (event: Event) => {
      if (route.detail || restoring) return;
      const scroller = currentScroller();
      if (scroller && event.target === scroller) positions.current.set(route.listPath, scroller.scrollTop);
    };
    document.addEventListener('scroll', remember, true);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('scroll', remember, true);
    };
  }, [pathname, enabled]);
}

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
    import('./noesis-workspace-entry').then((module) => {
      if (current) setWorkspace(() => module.NoesisWorkspaceEntry);
    }).catch(() => { if (current) setLoadFailed(true); });
    return () => { current = false; };
  }, [isWorkspace, Workspace]);

  useWorkspaceRouteScroll(pathname, isWorkspace && Boolean(Workspace));

  if (!isWorkspace) return <>{children}</>;
  if (loadFailed) return <main className="min-h-screen bg-background p-8 text-foreground" role="alert">The workspace could not load. <button className="underline" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!Workspace) return <WorkspaceFrameLoading />;

  return (
    <NoesisRouteProvider routeState={routeState}>
      <Workspace />
    </NoesisRouteProvider>
  );
}
