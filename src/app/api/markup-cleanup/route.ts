import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, ApiError, parseBoundedJson, requireApiUser } from '@/lib/server/api-security';
import { enforceUsageLimit, withUserAiConcurrency } from '@/lib/server/rate-limit';
import { generateContextualText, requireActiveRequest } from '@/lib/server/contextual-ai-provider';
import { MARKUP_OCR_AI_LIMIT, markupOcrCleanupPrompt } from '@/lib/markup-ocr';

export const runtime = 'nodejs';
const schema = z.object({ text: z.string().trim().min(1).max(MARKUP_OCR_AI_LIMIT) }).strict();

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request);
    requestId = user.requestId;
    const { text } = await parseBoundedJson(request, schema, 64 * 1024);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new ApiError(503, 'Noesis assistance is not connected.', 'ai_not_configured');
    const cleaned = await withUserAiConcurrency(user.uid, async () => {
      requireActiveRequest(request.signal);
      await enforceUsageLimit(user.uid, 'ai', 1, { tester: Boolean(user.token.tester || user.token.demo) });
      return generateContextualText(markupOcrCleanupPrompt(text), request.signal, apiKey);
    });
    if (!cleaned.trim() || cleaned.length > MARKUP_OCR_AI_LIMIT * 2) throw new ApiError(422, 'No usable cleanup was returned. Keep the original text.', 'invalid_ocr_cleanup');
    return NextResponse.json({ text: cleaned, requestId }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiErrorResponse(error, requestId);
  }
}
