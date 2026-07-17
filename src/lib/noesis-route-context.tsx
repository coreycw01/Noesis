"use client";

import React, { createContext, useContext, useMemo } from 'react';
import {
  NOESIS_PAGE_BY_VIEW,
  dataRequirementsForNoesisRoute,
  type NoesisPageDefinition,
  type NoesisWorkspaceDataKey,
} from '@/lib/noesis-page-definitions';
import { getNoesisRouteTarget, type NoesisRouteState, type NoesisRouteTarget } from '@/lib/noesis-routes';

export interface NoesisRouteContextValue {
  routeState: NoesisRouteState;
  activePage: NoesisPageDefinition;
  routeTarget: NoesisRouteTarget | null;
  isDetailRoute: boolean;
  dataRequirements: NoesisWorkspaceDataKey[];
}

const NoesisRouteContext = createContext<NoesisRouteContextValue | null>(null);

export function NoesisRouteProvider({
  routeState,
  children,
}: {
  routeState: NoesisRouteState;
  children: React.ReactNode;
}) {
  const value = useMemo<NoesisRouteContextValue>(() => {
    const routeTarget = getNoesisRouteTarget(routeState);
    return {
      routeState,
      activePage: NOESIS_PAGE_BY_VIEW[routeState.view],
      routeTarget,
      isDetailRoute: Boolean(routeTarget),
      dataRequirements: dataRequirementsForNoesisRoute(routeState),
    };
  }, [routeState]);

  return (
    <NoesisRouteContext.Provider value={value}>
      {children}
    </NoesisRouteContext.Provider>
  );
}

export function useNoesisRoute() {
  const context = useContext(NoesisRouteContext);
  if (!context) {
    throw new Error('useNoesisRoute must be used inside NoesisRouteProvider');
  }
  return context;
}
