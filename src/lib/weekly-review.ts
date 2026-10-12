import type { ThinkingEvent } from './types';

export function weeklyReviewEvents(events: ThinkingEvent[], now = Date.now()) {
  const since = now - 7 * 24 * 60 * 60 * 1000;
  const unique = new Map<string, ThinkingEvent>();
  for (const event of events) {
    const time = Date.parse(event.createdAt);
    if (!Number.isFinite(time) || time < since || time > now || event.importance === 'low') continue;
    if (['deleted', 'restored', 'edited', 'created'].includes(event.eventType)) continue;
    unique.set(event.eventId || event.id, event);
  }
  return [...unique.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
