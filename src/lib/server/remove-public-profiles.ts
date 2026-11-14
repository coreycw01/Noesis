import type { Firestore } from 'firebase-admin/firestore';

export async function removeOwnedPublicProfiles(firestore: Firestore, ownerId: string) {
  // Older clients could leave snapshots at slugs no longer recorded in the profile.
  const publicProfiles = firestore.collection('publicProfiles').where('ownerId', '==', ownerId);
  while (true) {
    const removed = await firestore.runTransaction(async (transaction) => {
      const page = await transaction.get(publicProfiles.limit(100));
      page.docs.forEach((snapshot) => transaction.delete(snapshot.ref));
      return page.size;
    });
    if (removed < 100) return;
  }
}
