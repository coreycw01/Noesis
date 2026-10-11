export function navigateWorkspace(history: Pick<History, 'pushState'>, destination: string) {
  // Next patches pushState to update usePathname. Never copy its private state
  // or synthesize popstate: both bypass the normal external-navigation path.
  history.pushState({ noesisPath: destination }, '', destination);
}
