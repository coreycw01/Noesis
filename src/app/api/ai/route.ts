import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGeminiApiKey } from '@/ai/genkit';
import { distillInsightsFromMedia } from '@/ai/flows/distill-insights-from-media';
import { generateReflectiveQuestions } from '@/ai/flows/generate-reflective-questions-flow';
import { suggestConceptDescription } from '@/ai/flows/suggest-concept-description';
import {
  detectBlindSpotPatterns,
  detectMissingPerspectives,
  detectMissingQuestions,
  generateStressTest,
  formPositionFromIdea,
  generateClarityCheck,
  generateIdeaQuestions,
  inferThinkingPatterns,
  socratesReflect,
  suggestAnnotationConsequences,
  suggestPositionDrafts,
} from '@/ai/flows/philosophy-suggestions';
import { noesisUserError } from '@/lib/user-facing-errors';
import { apiErrorResponse, ApiError, parseBoundedJson, requireApiUser } from '@/lib/server/api-security';
import { enforceUsageLimit, withUserAiConcurrency } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

type AiAction =
  | 'distillInsightsFromMedia'
  | 'generateReflectiveQuestions'
  | 'suggestAnnotationConsequences'
  | 'socratesReflect'
  | 'generateIdeaQuestions'
  | 'formPositionFromIdea'
  | 'suggestConceptDescription'
  | 'generateClarityCheck'
  | 'suggestPositionDrafts'
  | 'detectMissingPerspectives'
  | 'detectMissingQuestions'
  | 'generateStressTest'
  | 'inferThinkingPatterns'
  | 'detectBlindSpotPatterns';

const aiRequestSchema = z.object({
  action: z.enum([
    'distillInsightsFromMedia',
    'generateReflectiveQuestions',
    'suggestAnnotationConsequences',
    'socratesReflect',
    'generateIdeaQuestions',
    'formPositionFromIdea',
    'suggestConceptDescription',
    'generateClarityCheck',
    'suggestPositionDrafts',
    'detectMissingPerspectives',
    'detectMissingQuestions',
    'generateStressTest',
    'inferThinkingPatterns',
    'detectBlindSpotPatterns',
  ]),
  payload: z.record(z.unknown()),
}).strict();

const HEAVY_ACTIONS = new Set<AiAction>([
  'suggestPositionDrafts',
  'detectMissingPerspectives',
  'detectMissingQuestions',
  'inferThinkingPatterns',
  'detectBlindSpotPatterns',
]);

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 45_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new ApiError(504, 'The AI request timed out safely.', 'ai_timeout')),
          timeoutMs,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAiConfigured() {
  return Boolean(getGeminiApiKey());
}

function noUsableResult(result: unknown) {
  if (result == null) return true;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result === 'object') return Object.keys(result as Record<string, unknown>).length === 0;
  return false;
}

function aiConfigError() {
  return NextResponse.json(
    {
      error:
        'AI service is not configured. Add GEMINI_API_KEY to the Firebase App Hosting environment, then create a new rollout.',
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request);
    requestId = user.requestId;
    const { action, payload } = await parseBoundedJson(request, aiRequestSchema, 128 * 1_024);
    if (JSON.stringify(payload).length > 50_000) {
      throw new ApiError(413, 'The AI context is too large. Narrow the selected material.', 'context_too_large');
    }

    if (!isAiConfigured()) {
      return aiConfigError();
    }

    await enforceUsageLimit(user.uid, 'ai', HEAVY_ACTIONS.has(action) ? 3 : 1, {
      tester: Boolean(user.token.tester || user.token.demo),
    });

    const result = await withUserAiConcurrency(user.uid, () => withTimeout((async () => {
      let flowResult: unknown;
      switch (action) {
      case 'distillInsightsFromMedia':
        flowResult = await distillInsightsFromMedia(payload as Parameters<typeof distillInsightsFromMedia>[0]);
        break;
      case 'generateReflectiveQuestions':
        flowResult = await generateReflectiveQuestions(payload as Parameters<typeof generateReflectiveQuestions>[0]);
        break;
      case 'suggestAnnotationConsequences':
        flowResult = await suggestAnnotationConsequences(payload as Parameters<typeof suggestAnnotationConsequences>[0]);
        break;
      case 'socratesReflect':
        flowResult = await socratesReflect(payload as Parameters<typeof socratesReflect>[0]);
        break;
      case 'generateIdeaQuestions':
        flowResult = await generateIdeaQuestions(payload as Parameters<typeof generateIdeaQuestions>[0]);
        break;
      case 'formPositionFromIdea':
        flowResult = await formPositionFromIdea(payload as Parameters<typeof formPositionFromIdea>[0]);
        break;
      case 'suggestConceptDescription':
        flowResult = await suggestConceptDescription(payload as Parameters<typeof suggestConceptDescription>[0]);
        break;
      case 'generateClarityCheck':
        flowResult = await generateClarityCheck(payload as Parameters<typeof generateClarityCheck>[0]);
        break;
      case 'suggestPositionDrafts':
        flowResult = await suggestPositionDrafts(payload as Parameters<typeof suggestPositionDrafts>[0]);
        break;
      case 'detectMissingPerspectives':
        flowResult = await detectMissingPerspectives(payload as Parameters<typeof detectMissingPerspectives>[0]);
        break;
      case 'detectMissingQuestions':
        flowResult = await detectMissingQuestions(payload as Parameters<typeof detectMissingQuestions>[0]);
        break;
      case 'generateStressTest':
        flowResult = await generateStressTest(payload as Parameters<typeof generateStressTest>[0]);
        break;
      case 'inferThinkingPatterns':
        flowResult = await inferThinkingPatterns(payload as Parameters<typeof inferThinkingPatterns>[0]);
        break;
      case 'detectBlindSpotPatterns':
        flowResult = await detectBlindSpotPatterns(payload as Parameters<typeof detectBlindSpotPatterns>[0]);
        break;
      default:
        throw new ApiError(400, 'Unknown AI action requested.', 'unknown_action');
      }
      return flowResult;
    })()));

    if (noUsableResult(result)) {
      return NextResponse.json({ error: 'No usable AI response was returned.' }, { status: 422 });
    }

    return NextResponse.json({ result, requestId });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error, requestId);
    const rawMessage = error instanceof Error ? error.message : 'AI request failed. Please try again.';
    const message = noesisUserError(error, 'The AI request failed. Your workspace data was not changed; try again when the provider is available.');
    const status = /api key|configured|credential|quota|resource_exhausted|429/i.test(rawMessage) ? 503 : 500;
    console.error('[AI] Provider request failed', { requestId, status, error: rawMessage.slice(0, 300) });
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
