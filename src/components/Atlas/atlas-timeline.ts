/**
 * Atlas timeline: replay the map as it stood on a date. A concept appears on
 * the date it was created; concepts created inside the chosen window are
 * marked as new. Concepts without a usable date are treated as always present.
 */
export interface AtlasTimelineWindow {
  /** Start of the "new since" window (inclusive), ms since epoch. */
  from: number;
  /** The date the map is shown as of (inclusive), ms since epoch. */
  asOf: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function atlasDate(value?: string | null) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

/** Earliest and latest dates the slider can reach, snapped to whole days. */
export function atlasTimelineBounds(dates: Array<string | undefined | null>, now = Date.now()) {
  const values = dates.map(atlasDate).filter((value): value is number => value !== null);
  const start = values.length ? Math.min(...values) : now;
  const end = Math.max(now, values.length ? Math.max(...values) : now);
  return { start: Math.floor(start / DAY) * DAY, end: Math.ceil(end / DAY) * DAY };
}

export function atlasNodeTimelineState(createdAt: string | undefined | null, window: AtlasTimelineWindow | null) {
  if (!window) return 'present' as const;
  const born = atlasDate(createdAt);
  if (born === null) return 'present' as const;
  if (born > window.asOf + DAY - 1) return 'unborn' as const;
  if (born >= window.from) return 'new' as const;
  return 'present' as const;
}

export function formatAtlasTimelineDate(value: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function atlasTimelineDayValue(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}
