import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { ApiError } from './api-security';
import { adminFirestore } from './firebase-admin';

export type UsageAction = 'source_search' | 'source_metadata' | 'document_import';

const DEFAULT_LIMITS: Record<UsageAction, { minute: number; daily: number }> = {
  source_search: { minute: 30, daily: 1_000 },
  source_metadata: { minute: 10, daily: 300 },
  document_import: { minute: 5, daily: 100 },
};

function windowKeys(now: Date) {
  const minute = now.toISOString().slice(0, 16).replace(/[^0-9]/g, '');
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return { minute, day };
}

function safePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export async function enforceUsageLimit(
  uid: string,
  action: UsageAction,
  weight = 1,
) {
  const now = new Date();
  const windows = windowKeys(now);
  const limits = DEFAULT_LIMITS[action];
  const dailyLimit = limits.daily;
  const db = adminFirestore();
  const minuteRef = db.doc(`apiUsage/${safePart(uid)}_${action}_m_${windows.minute}`);
  const dayRef = db.doc(`apiUsage/${safePart(uid)}_${action}_d_${windows.day}`);

  await db.runTransaction(async (transaction) => {
    const [minuteSnap, daySnap] = await Promise.all([
      transaction.get(minuteRef),
      transaction.get(dayRef),
    ]);
    const minuteCount = Number(minuteSnap.data()?.count || 0);
    const dayCount = Number(daySnap.data()?.count || 0);
    if (minuteCount + weight > limits.minute) {
      throw new ApiError(429, 'Too many requests. Try again shortly.', 'minute_limit', 60);
    }
    if (dayCount + weight > dailyLimit) {
      throw new ApiError(429, 'Your daily usage limit has been reached.', 'daily_limit', 3_600);
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
