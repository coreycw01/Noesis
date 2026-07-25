import { NextResponse } from 'next/server';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { apiErrorResponse, ApiError, parseBoundedJson, requireApiUser } from '@/lib/server/api-security';
import { fetchVerifiedPublicResource } from '@/lib/server/public-url';
import { enforceUsageLimit } from '@/lib/server/rate-limit';
import { noesisUserError } from '@/lib/user-facing-errors';

const MAX_IMPORTED_CHARS = 100_000;
const importSchema = z.object({
  url: z.string().trim().url().max(2_048),
}).strict();

export const runtime = 'nodejs';

function googleDocExportUrl(url: string) {
  const published = url.match(/docs\.google\.com\/document\/d\/e\/([^/]+)/)?.[1];
  if (published) return `https://docs.google.com/document/d/e/${published}/pub?output=txt`;
  const documentId = url.match(/docs\.google\.com\/document\/d\/([^/]+)/)?.[1];
  return documentId ? `https://docs.google.com/document/d/${documentId}/export?format=txt` : url;
}

function htmlToText(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: (text) => text,
  })
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request);
    requestId = user.requestId;
    await enforceUsageLimit(user.uid, 'document_import');
    const { url } = await parseBoundedJson(request, importSchema, 4 * 1_024);
    const resource = await fetchVerifiedPublicResource(new URL(googleDocExportUrl(url)), {
      headers: {
        accept: 'text/plain,text/markdown,text/html,application/xhtml+xml;q=0.8',
        'user-agent': 'Noesis document importer',
      },
      maxBytes: 5_000_000,
      timeoutMs: 12_000,
      allowedContentTypes: ['text/plain', 'text/markdown', 'text/html', 'application/xhtml+xml'],
    });

    if (!resource.ok) {
      throw new ApiError(
        422,
        `Document could not be read (${resource.status}). Make sure it is public or published.`,
        'document_unreadable',
      );
    }

    const contentType = resource.headers.get('content-type') || '';
    const text = contentType.includes('html') ? htmlToText(resource.text) : resource.text.trim();
    if (!text) throw new ApiError(422, 'No readable text was found in that document.', 'empty_document');

    return NextResponse.json({
      text: text.slice(0, MAX_IMPORTED_CHARS),
      truncated: text.length > MAX_IMPORTED_CHARS,
      importedAt: new Date().toISOString(),
      requestId,
    });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error, requestId);
    console.error('[Import] Document import failed', { requestId, error });
    return NextResponse.json({
      error: noesisUserError(error, 'Unable to import that public document.'),
      requestId,
    }, { status: 500 });
  }
}
