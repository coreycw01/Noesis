export function navigateWorkspace(history: Pick<History, 'pushState'>, destination: string) {
  // Next patches pushState to update usePathname. Never copy its private state
  // or synthesize popstate: both bypass the normal external-navigation path.
  history.pushState({ noesisPath: destination }, '', destination);
}

export function workspaceScrollRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const offset = segments[0] === 'demo' || segments[0] === 'review' ? 1 : 0;
  const section = segments[offset] || 'home';
  const prefix = offset ? `/${segments[0]}` : '';
  return {
    path: `${prefix}/${segments.slice(offset).join('/') || 'home'}`,
    listPath: `${prefix}/${section}`,
    detail: segments.length > offset + 1,
  };
}

export function workspaceRouteScrollTop(previousPath: string, nextPath: string, listPositions: ReadonlyMap<string, number>) {
  const previous = workspaceScrollRoute(previousPath);
  const next = workspaceScrollRoute(nextPath);
  if (previous.path === next.path) return null;
  return previous.detail && !next.detail && previous.listPath === next.listPath
    ? listPositions.get(next.listPath) ?? 0
    : 0;
}
