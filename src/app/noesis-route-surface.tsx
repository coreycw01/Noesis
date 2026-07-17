import { NoesisRoutePage } from './noesis-home-page';
import { NoesisRouteProvider } from '@/lib/noesis-route-context';
import type { NoesisRouteState } from '@/lib/noesis-routes';

interface NoesisRouteSurfaceProps {
  routeState: NoesisRouteState;
}

/**
 * Route-owned entrypoint for Noesis pages.
 *
 * Every App Router page enters through this surface with an explicit route
 * state. This wrapper owns route context before the authenticated workspace
 * renders, which keeps URL ownership explicit while page-by-page data ownership
 * continues to move out of the legacy mounted workspace.
 */
export function NoesisRouteSurface({ routeState }: NoesisRouteSurfaceProps) {
  return (
    <NoesisRouteProvider routeState={routeState}>
      <NoesisRoutePage />
    </NoesisRouteProvider>
  );
}
