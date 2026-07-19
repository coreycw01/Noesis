import { NextResponse } from 'next/server';
import type { MediaType } from '@/lib/types';
import { MEDIA_TYPES } from '@/lib/readex';
import { metadataFromUrl } from '@/lib/server/source-providers';
import { noesisUserError } from '@/lib/user-facing-errors';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { url, type } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A URL is required.' }, { status: 400 });
    }

    const requestedType = type as MediaType;
    const sourceType = MEDIA_TYPES.includes(requestedType) ? requestedType : undefined;
    const result = await metadataFromUrl(url, sourceType);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: noesisUserError(error, 'Unable to read source metadata. You can still enter the source details manually.') },
      { status: 500 },
    );
  }
}
