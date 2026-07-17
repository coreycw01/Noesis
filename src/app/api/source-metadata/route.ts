import { NextResponse } from 'next/server';
import { metadataFromUrl } from '@/lib/server/source-providers';
import { noesisUserError } from '@/lib/user-facing-errors';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A URL is required.' }, { status: 400 });
    }

    const result = await metadataFromUrl(url);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: noesisUserError(error, 'Unable to read source metadata. You can still enter the source details manually.') },
      { status: 500 },
    );
  }
}
