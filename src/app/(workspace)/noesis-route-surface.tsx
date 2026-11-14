import type { NoesisRouteState } from '@/lib/noesis-routes';

interface NoesisRouteSurfaceProps {
  routeState: NoesisRouteState;
}

/** Metadata-only route endpoint; the workspace layout owns the mounted shell. */
export function NoesisRouteSurface(_props: NoesisRouteSurfaceProps) {
  // The workspace layout derives its state from
  // the URL. Routes supply metadata only, never a second workspace instance.
  return null;
}
