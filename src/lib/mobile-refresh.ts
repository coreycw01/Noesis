export const MOBILE_REFRESH_THRESHOLD = 64;

export function mobilePullDistance(deltaX: number, deltaY: number, atTop: boolean): number | null {
  if (!atTop || Math.abs(deltaX) > Math.max(12, deltaY)) return null;
  return Math.min(92, Math.max(0, deltaY) * 0.48);
}

export function shouldRefreshFromPull(distance: number, eligible: boolean, blocked: boolean) {
  return eligible && !blocked && distance >= MOBILE_REFRESH_THRESHOLD;
}
