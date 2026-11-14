import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

function liveLeases(data: unknown, now: number): Array<{ id: string; until: number }> {
  if (!Array.isArray(data)) return [];
  return data.filter((lease) => lease && typeof lease.id === 'string' && Number.isFinite(lease.until) && lease.until > now);
}

export async function reserveAiSlot(db: Firestore, uid: string, clock = Date.now) {
  const key = createHash('sha256').update(uid).digest('hex');
  const ref = db.doc(`apiUsage/ai_concurrency_${key}`);
  const id = randomUUID();
  // Outlast the provider timeout and recover automatically after a crash.
  const leaseMs = 120_000;
  const reserved = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = clock();
    const leases = liveLeases(snapshot.data()?.leases, now);
    if (leases.length >= 2) return false;
    transaction.set(ref, { leases: [...leases, { id, until: now + leaseMs }], expiresAt: new Date(now + leaseMs) });
    return true;
  });
  if (!reserved) return null;

  return async () => {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return;
      const before = liveLeases(snapshot.data()?.leases, clock());
      if (!before.some((lease) => lease.id === id)) return;
      const leases = before.filter((lease) => lease.id !== id);
      if (leases.length) transaction.update(ref, { leases, expiresAt: new Date(Math.max(...leases.map(({ until }) => until))) });
      else transaction.delete(ref);
    });
  };
}
