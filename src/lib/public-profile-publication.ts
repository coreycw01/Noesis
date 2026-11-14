import { doc, runTransaction, type DocumentReference } from 'firebase/firestore';
import type { ProfilePrivacySettings, PublicProfileSnapshot } from './types';
import { isValidPublicProfileSlug, normalizePublicProfileSlug, publicSnapshotMatchesChoices } from './public-profile';
import { requireWorkspaceConnection } from './workspace-connectivity';

export async function publishProfileSelection({
  privacyRef, settingsRef, ownerId, privacy, snapshot, updatedAt, expectedVersion,
}: {
  privacyRef: DocumentReference;
  settingsRef: DocumentReference;
  ownerId: string;
  privacy: ProfilePrivacySettings;
  snapshot: PublicProfileSnapshot;
  updatedAt: string;
  expectedVersion?: { dateUpdated?: string };
}) {
  requireWorkspaceConnection();
  const slug = normalizePublicProfileSlug(privacy.shareSlug);
  if (privacy.publicProfileEnabled && !isValidPublicProfileSlug(slug)) {
    throw new Error('Choose a profile URL name with 3 to 60 letters, numbers, or hyphens.');
  }
  if (privacy.publicProfileEnabled && !publicSnapshotMatchesChoices(snapshot, privacy)) {
    throw new Error('The public preview no longer matches your sharing choices. Review it again before publishing.');
  }
  const db = privacyRef.firestore;
  try {
    await runTransaction(db, async (transaction) => {
      // Read the committed slug, not the copy another tab may have just replaced.
      const previousPrivacy = (await transaction.get(privacyRef)).data();
      if (expectedVersion && previousPrivacy?.dateUpdated !== expectedVersion.dateUpdated) {
        throw new Error('Sharing choices changed in another tab. Reload the saved choices and review them before publishing.');
      }
      const previous = previousPrivacy?.publicProfileEnabled === true ? previousPrivacy.shareSlug : undefined;
      const publishedSlug = privacy.publicProfileEnabled ? slug : '';
      if (typeof previous === 'string' && isValidPublicProfileSlug(previous) && previous !== publishedSlug) {
        transaction.delete(doc(db, 'publicProfiles', previous));
      }
      if (publishedSlug) {
        transaction.set(doc(db, 'publicProfiles', publishedSlug), {
          ...snapshot, id: publishedSlug, shareSlug: publishedSlug, ownerId, enabled: true, updatedAt,
        });
      }
      transaction.set(privacyRef, { ...privacy, shareSlug: slug, dateUpdated: updatedAt }, { merge: true });
      transaction.set(settingsRef, { shareableProfileLink: publishedSlug, dateUpdated: updatedAt }, { merge: true });
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'permission-denied') {
      throw new Error('The profile could not be published or withdrawn. If you changed the URL name, try a different one.');
    }
    throw error;
  }
}
