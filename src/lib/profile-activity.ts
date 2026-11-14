import { runTransaction, type DocumentReference } from 'firebase/firestore';
import { localDateKey, recordDateKey } from './calendar';
import type { UserProfile } from './types';

type Activity = Pick<UserProfile, 'dailyActivityDates' | 'lastActiveDate'>;

export function profileActivityPatch(current: Activity, day: string): Activity | null {
  if (!day || recordDateKey(day) !== day) return null;
  const dates = [...new Set([...(current.dailyActivityDates || []).map(recordDateKey).filter(Boolean), day])]
    .sort().slice(-400);
  const lastActiveDate = dates[dates.length - 1];
  if (lastActiveDate === current.lastActiveDate && dates.length === current.dailyActivityDates?.length
    && dates.every((value, index) => value === current.dailyActivityDates?.[index])) return null;
  return { dailyActivityDates: dates, lastActiveDate };
}

export async function recordProfileActivity(ref: DocumentReference, legacyRef: DocumentReference, day = localDateKey()) {
  const record = () => runTransaction(ref.firestore, async (transaction) => {
    const stored = (await transaction.get(ref)).data() as Activity | undefined;
    const activity = stored?.dailyActivityDates?.length
      ? stored
      : (await transaction.get(legacyRef)).data() as Activity | undefined;
    const patch = profileActivityPatch(activity || {}, day);
    if (patch) transaction.set(ref, patch, { merge: true });
  });
  try {
    await record();
  } catch (error) {
    // An identity save can create the profile after our first read.
    if ((error as { code?: string } | null)?.code !== 'already-exists') throw error;
    await record();
  }
}
