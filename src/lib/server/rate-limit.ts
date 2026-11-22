import 'server-only';

import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { apiUsageWindows } from '../api-usage-windows';
import { ApiError } from './api-security';
import { adminFirestore } from './firebase-admin';
import { reserveAiSlot } from './ai-concurrency';

export type UsageAction = 'ai' | 'source_search' | 'source_metadata' | 'document_import';

const DEFAULT_LIMITS: Record<UsageAction, { minute: number; daily: number }> = {
  ai: { minute: 5, daily: 50 },
  source_search: { minute: 30, daily: 1_000 },
  source_metadata: { minute: 10, daily: 300 },
  document_import: { minute: 5, daily: 100 },
};

function safePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export async function enforceUsageLimit(
  uid: string,
  action: UsageAction,
  weight = 1,
  options: { tester?: boolean } = {},
) {
  const now = new Date();
  const windows = apiUsageWindows(now);
  const limits = DEFAULT_LIMITS[action];
  const dailyLimit = options.tester && action === 'ai' ? 200 : limits.daily;
  const db = adminFirestore();
  const minuteRef = db.doc(`apiUsage/${safePart(uid)}_${action}_m_${windows.minute}`);
  const dayRef = db.doc(`apiUsage/${safePart(uid)}_${action}_d_${windows.day}`);

  await db.runTransaction(async (transaction: Transaction) => {
    const [minuteSnap, daySnap] = await Promise.all([
      transaction.get(minuteRef),
      transaction.get(dayRef),
    ]);
    const minuteCount = Number(minuteSnap.data()?.count || 0);
    const dayCount = Number(daySnap.data()?.count || 0);
    if (dayCount + weight > dailyLimit) {
      throw new ApiError(429, 'Your daily usage limit has been reached.', 'daily_limit', windows.dayRetryAfter);
    }
    if (minuteCount + weight > limits.minute) {
      throw new ApiError(429, 'Too many requests. Try again shortly.', 'minute_limit', windows.minuteRetryAfter);
    }
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1_000);
    transaction.set(minuteRef, {
      uid,
      action,
      count: minuteCount + weight,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    }, { merge: true });
    transaction.set(dayRef, {
      uid,
      action,
      count: dayCount + weight,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    }, { merge: true });
  });
}

/**
 * The same counters, read without spending one.
 *
 * The browser cannot see `apiUsage` — the rules refuse it outright — so a meter
 * on the page has to come through here. Reading is deliberately not a
 * transaction: a count a second out of date is fine for a bar, and a review
 * that would exceed the limit is still refused by `enforceUsageLimit`.
 */
export async function readUsage(uid: string, action: UsageAction, options: { tester?: boolean } = {}) {
  const windows = apiUsageWindows(new Date());
  const limits = DEFAULT_LIMITS[action];
  const db = adminFirestore();
  const [minuteSnap, daySnap] = await Promise.all([
    db.doc(`apiUsage/${safePart(uid)}_${action}_m_${windows.minute}`).get(),
    db.doc(`apiUsage/${safePart(uid)}_${action}_d_${windows.day}`).get(),
  ]);
  return {
    day: Number(daySnap.data()?.count || 0),
    minute: Number(minuteSnap.data()?.count || 0),
    dayLimit: options.tester && action === 'ai' ? 200 : limits.daily,
    minuteLimit: limits.minute,
    dayResetsIn: windows.dayRetryAfter,
    minuteResetsIn: windows.minuteRetryAfter,
  };
}

export async function withUserAiConcurrency<T>(uid: string, operation: () => Promise<T>) {
  const release = await reserveAiSlot(adminFirestore(), uid);
  if (!release) throw new ApiError(429, 'Two assistance requests are already running.', 'concurrency_limit', 5);
  try {
    return await operation();
  } finally {
    await release().catch(() => {
      // A failed release must not replace the provider result. The lease expires.
      console.warn('Unable to release contextual AI concurrency lease');
    });
  }
}
