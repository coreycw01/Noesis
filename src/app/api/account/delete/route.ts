import { NextResponse } from 'next/server';
import { apiErrorResponse, requireApiUser } from '@/lib/server/api-security';
import { adminAuth, adminFirestore, adminWorkspaceBucket } from '@/lib/server/firebase-admin';
import { removeOwnedPublicProfiles } from '@/lib/server/remove-public-profiles';
import { removeWorkspaceUploads } from '@/lib/server/remove-workspace-uploads';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request, { verifiedEmail: false });
    requestId = user.requestId;

    const firestore = adminFirestore();
    await removeWorkspaceUploads(adminWorkspaceBucket(), user.uid);
    await removeOwnedPublicProfiles(firestore, user.uid);
    await firestore.recursiveDelete(firestore.doc(`users/${user.uid}`));
    await adminAuth().deleteUser(user.uid);

    return NextResponse.json({ deleted: true, requestId });
  } catch (error) {
    return apiErrorResponse(error, requestId);
  }
}
