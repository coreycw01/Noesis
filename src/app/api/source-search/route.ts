import { NextResponse } from 'next/server';
import type { MediaType } from '@/lib/types';
import { MEDIA_TYPES } from '@/lib/readex';
import { searchSources } from '@/lib/server/source-providers';
import { noesisUserError } from '@/lib/user-facing-errors';
import { apiErrorResponse, ApiError, requireApiUser } from '@/lib/server/api-security';
import { enforceUsageLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
const searchCache = new Map<string, { expiresAt: number; results: unknown[] }>();

export async function GET(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request);
    requestId = user.requestId;
    await enforceUsageLimit(user.uid, 'source_search');
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || '').trim();
    const requestedType = (searchParams.get('type') || 'book') as MediaType;
    const type = MEDIA_TYPES.includes(requestedType) ? requestedType : 'book';

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }
    if (query.length > 200) {
      throw new ApiError(400, 'Search queries must be 200 characters or fewer.', 'invalid_query');
    }

    const cacheKey = `${type}:${query.toLocaleLowerCase()}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ results: cached.results, cached: true, requestId });
    }
    const results = await searchSources(query, type);
    if (searchCache.size >= 200) searchCache.delete(searchCache.keys().next().value as string);
    searchCache.set(cacheKey, { results, expiresAt: Date.now() + 5 * 60_000 });
    return NextResponse.json({ results, requestId });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error, requestId);
    return NextResponse.json(
      { error: noesisUserError(error, 'Source search failed. You can still add this source manually.'), results: [], requestId },
      { status: 500 },
    );
  }
}
