import { NextResponse } from 'next/server';
import type { MediaType } from '@/lib/types';
import { MEDIA_TYPES } from '@/lib/readex';
import { metadataFromUrl } from '@/lib/server/source-providers';
import { noesisUserError } from '@/lib/user-facing-errors';
import { apiErrorResponse, ApiError, parseBoundedJson, publicUrlSchema, requireApiUser } from '@/lib/server/api-security';
import { enforceUsageLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request);
    requestId = user.requestId;
    await enforceUsageLimit(user.uid, 'source_metadata');
    const { url, type } = await parseBoundedJson(request, publicUrlSchema, 4 * 1_024);

    const requestedType = type as MediaType;
    const sourceType = MEDIA_TYPES.includes(requestedType) ? requestedType : undefined;
    const result = await metadataFromUrl(url, sourceType);
    return NextResponse.json({ result, requestId });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error, requestId);
    return NextResponse.json(
      { error: noesisUserError(error, 'Unable to read source metadata. You can still enter the source details manually.'), requestId },
      { status: 500 },
    );
  }
}
