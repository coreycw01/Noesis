import type { NoesisRouteState } from '@/lib/noesis-routes';

interface NoesisRouteSurfaceProps {
  routeState: NoesisRouteState;
}

/** Metadata-only route endpoint; the root layout owns the mounted workspace. */
export function NoesisRouteSurface(_props: NoesisRouteSurfaceProps) {
  // The root layout owns the persistent workspace and derives its state from
  // the URL. Routes supply metadata only, never a second workspace instance.
  return null;
}
