"use client";

import React, { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { NoesisRouteProvider } from '@/lib/noesis-route-context';
import { parseNoesisRoute } from '@/lib/noesis-routes';

const NoesisRoutePage = dynamic(
  () => import('./noesis-home-page').then((module) => module.NoesisRoutePage),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <span className="font-code text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Opening workspace
        </span>
      </div>
    ),
  },
);

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
  'practices',
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>('.noesis-app-main');
      const scrollRegion = main?.querySelector<HTMLElement>('[data-noesis-scroll-region], .overflow-y-auto');
      if (scrollRegion) scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
      else main?.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  if (!isNoesisWorkspacePath(pathname)) return <>{children}</>;

  return (
    <NoesisRouteProvider routeState={routeState}>
      <NoesisRoutePage />
    </NoesisRouteProvider>
  );
}
