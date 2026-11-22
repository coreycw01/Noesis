/**
 * What a person has left of their AI allowance.
 *
 * The counts live in Firestore under `apiUsage/...`, written by the server with
 * admin credentials and unreadable from the browser by rule, so the numbers
 * reach the page through `/api/usage` rather than a listener. This module holds
 * only the arithmetic, so the meter can be tested without a network.
 */

export interface AiUsageCounts {
  /** Reviews run in the current day window. */
  day: number;
  /** Reviews run in the current minute window. */
  minute: number;
  dayLimit: number;
  minuteLimit: number;
  /** Seconds until the day window rolls over. */
  dayResetsIn?: number;
  /** Seconds until the minute window rolls over. */
  minuteResetsIn?: number;
}

export type AiUsageTone = 'ok' | 'caution' | 'problem';

export interface AiUsageMeter {
  used: number;
  limit: number;
  remaining: number;
  /** 0–1, for drawing the bar. Clamped, so an over-count never overflows it. */
  fraction: number;
  tone: AiUsageTone;
  /** One line a person can act on, naming the limit that actually binds. */
  message: string;
  /** True when the next review would be refused right now. */
  blocked: boolean;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const whole = (value: unknown) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** "in 45 seconds", "in 12 minutes", "in 3 hours" — never a bare number. */
export function formatResetsIn(seconds?: number) {
  if (!Number.isFinite(seconds) || (seconds as number) <= 0) return 'shortly';
  const value = Math.ceil(seconds as number);
  if (value < 90) return `in ${value} second${value === 1 ? '' : 's'}`;
  const minutes = Math.ceil(value / 60);
  if (minutes < 90) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Read the counts into something a meter can draw.
 *
 * The day allowance is what the bar shows, because that is the one a person
 * plans around. The minute limit is a short pause rather than a budget, so it
 * only takes over the message when it is the thing actually stopping you.
 */
export function aiUsageMeter(counts: AiUsageCounts): AiUsageMeter {
  const limit = Math.max(1, whole(counts.dayLimit));
  const used = clamp(whole(counts.day), 0, Number.MAX_SAFE_INTEGER);
  const remaining = Math.max(0, limit - used);
  const fraction = clamp(used / limit, 0, 1);

  const minuteLimit = Math.max(1, whole(counts.minuteLimit));
  const minuteUsed = whole(counts.minute);
  const minuteBlocked = minuteUsed >= minuteLimit;
  const dayBlocked = remaining <= 0;

  const tone: AiUsageTone = dayBlocked || minuteBlocked ? 'problem' : fraction >= 0.8 ? 'caution' : 'ok';

  let message: string;
  if (dayBlocked) {
    message = `No reviews left today. The allowance resets ${formatResetsIn(counts.dayResetsIn)}.`;
  } else if (minuteBlocked) {
    // A minute pause is not a shortage: say so, and say what is still there.
    message = `Too many just now — try again ${formatResetsIn(counts.minuteResetsIn)}. ${remaining} left today.`;
  } else if (tone === 'caution') {
    message = `${remaining} review${remaining === 1 ? '' : 's'} left today, of ${limit}.`;
  } else {
    message = `${used} of ${limit} used today.`;
  }

  return { used, limit, remaining, fraction, tone, message, blocked: dayBlocked || minuteBlocked };
}
