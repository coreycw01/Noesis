export function apiUsageWindows(now: Date) {
  const timestamp = now.getTime();
  const iso = now.toISOString();
  const secondsUntilNext = (windowMs: number) => Math.ceil((windowMs - timestamp % windowMs) / 1_000);
  return {
    minute: iso.slice(0, 16).replace(/[^0-9]/g, ''),
    day: iso.slice(0, 10).replace(/-/g, ''),
    minuteRetryAfter: secondsUntilNext(60_000),
    dayRetryAfter: secondsUntilNext(86_400_000),
  };
}
