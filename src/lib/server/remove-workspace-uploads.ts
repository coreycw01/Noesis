import type { Storage } from 'firebase-admin/storage';

export async function removeWorkspaceUploads(bucket: ReturnType<Storage['bucket']>, ownerId: string) {
  if (!ownerId || ownerId.includes('/')) throw new Error('Invalid workspace owner.');
  await bucket.deleteFiles({ prefix: `users/${ownerId}/`, versions: true });
}
