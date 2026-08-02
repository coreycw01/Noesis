import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, ApiError, parseBoundedJson, requireApiUser } from '@/lib/server/api-security';
import { enforceUsageLimit, withUserAiConcurrency } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

const actions = [
  'summarize_source', 'extract_source_claims', 'propose_inquiry_prompts',
  'suggest_annotation_effect', 'refine_concept_definition', 'clarify_concept_boundaries',
  'socratic_inquiry_challenge', 'find_position_assumptions',
  'generate_position_counterargument', 'identify_missing_position_evidence',
  'stress_test_position', 'compare_selected_positions', 'synthesize_practice_outcome',
  'synthesize_evolution_period',
] as const;

const memoryLine = z.string().trim().min(1).max(4_000);
const requestSchema = z.object({
  action: z.enum(actions),
  targetType: z.enum(['source', 'annotation', 'concept', 'inquiry', 'position', 'practice', 'evolution']),
  targetId: z.string().trim().min(1).max(256),
  scope: z.enum(['current_item', 'linked_items', 'selected_pair', 'selected_period']),
  itemMemory: z.array(memoryLine).max(20),
  linkedMemory: z.array(memoryLine).max(20),
  reasoningDepth: z.enum(['light', 'standard', 'deep']).optional(),
  selectedRange: z.object({ from: z.string().max(40), to: z.string().max(40) }).optional(),
  secondaryTarget: z.object({
    targetType: z.literal('position'),
    targetId: z.string().trim().min(1).max(256),
    label: z.string().trim().min(1).max(300),
    memory: z.array(memoryLine).max(12),
  }).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === 'compare_selected_positions' && (!value.secondaryTarget || value.scope !== 'selected_pair')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Position comparison requires one explicitly selected second position.' });
  }
  if (value.action === 'synthesize_evolution_period' && (!value.selectedRange || value.scope !== 'selected_period')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Evolution synthesis requires an explicit date range.' });
  }
});

const instructions: Record<(typeof actions)[number], string> = {
  summarize_source: 'Write a concise factual summary grounded only in the supplied source material. Separate uncertainty from fact.',
  extract_source_claims: 'List the source\'s central claims. Do not convert them into the user\'s beliefs.',
  propose_inquiry_prompts: 'Propose a small set of specific inquiry prompts grounded in unresolved parts of this source.',
  suggest_annotation_effect: 'Explain whether this annotation most plausibly supports, challenges, questions, clarifies, or remains reference material. Give reasons.',
  refine_concept_definition: 'Draft a clearer working definition while preserving the user\'s meaning and noting unresolved ambiguity.',
  clarify_concept_boundaries: 'State what belongs inside this concept, what does not, and the most important nearby distinction.',
  socratic_inquiry_challenge: 'Ask focused Socratic questions that pressure the inquiry\'s assumptions and candidate answers without answering for the user.',
  find_position_assumptions: 'Identify the hidden assumptions required by this position and explain why each matters.',
  generate_position_counterargument: 'Construct the strongest grounded counterargument to this exact position.',
  identify_missing_position_evidence: 'Identify the most important missing evidence and what would count as useful evidence.',
  stress_test_position: 'Give falsification, prediction, opposite-case, and weakening-evidence tests for this position.',
  compare_selected_positions: 'Compare only the two selected positions: agreement, conflict, dependency, and a possible distinction.',
  synthesize_practice_outcome: 'Synthesize what the completed practice logs support, weaken, or leave unresolved. Do not overclaim causality.',
  synthesize_evolution_period: 'Summarize meaningful changes in the selected period, using only the supplied event records.',
};

function buildPrompt(input: z.infer<typeof requestSchema>) {
  const item = input.itemMemory.map((line) => `- ${line}`).join('\n');
  const linked = input.linkedMemory.map((line) => `- ${line}`).join('\n');
  const second = input.secondaryTarget
    ? `\nSECOND SELECTED POSITION: ${input.secondaryTarget.label}\n${input.secondaryTarget.memory.map((line) => `- ${line}`).join('\n')}`
    : '';
  const range = input.selectedRange ? `\nSELECTED PERIOD: ${input.selectedRange.from} through ${input.selectedRange.to}` : '';
  const depth = input.reasoningDepth === 'light' ? 'Be brief and focus on the single strongest observation.' : input.reasoningDepth === 'deep' ? 'Examine competing interpretations carefully while staying inside the supplied context.' : 'Give a focused analysis with the main reasons and uncertainty.';
  return `${instructions[input.action]}\n${depth}\n\nCURRENT ITEM:\n${item || '- No authored detail supplied.'}\n\nDIRECTLY LINKED CONTEXT:\n${linked || '- None selected.'}${second}${range}\n\nReturn plain text with short headings and actionable bullets. Never claim access to anything outside this context. Never edit the user\'s data or state conclusions as settled truth.`;
}

async function generateText(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new ApiError(503, 'Noesis assistance is not connected.', 'ai_not_configured');
  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^googleai\//, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 1_500 },
      }),
    });
    if (!response.ok) {
      if (response.status === 429) throw new ApiError(429, 'Noesis assistance is temporarily at capacity.', 'provider_rate_limit', 60);
      throw new ApiError(503, 'Noesis assistance is temporarily unavailable.', 'provider_unavailable');
    }
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('\n').trim();
    if (!text) throw new ApiError(422, 'No usable assistance was returned.', 'empty_ai_result');
    return text;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error)?.name === 'AbortError') throw new ApiError(504, 'Noesis assistance timed out safely.', 'ai_timeout');
    throw new ApiError(503, 'Noesis assistance is temporarily unavailable.', 'provider_unavailable');
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request);
    requestId = user.requestId;
    return NextResponse.json({
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      status: process.env.GEMINI_API_KEY?.trim() ? 'configured' : 'not_configured',
      requestId,
    });
  } catch (error) {
    return apiErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  let requestId: string | undefined;
  try {
    const user = await requireApiUser(request);
    requestId = user.requestId;
    const input = await parseBoundedJson(request, requestSchema, 128 * 1_024);
    const contextLength = [...input.itemMemory, ...input.linkedMemory, ...(input.secondaryTarget?.memory || [])].join('\n').length;
    if (contextLength > 50_000) throw new ApiError(413, 'Narrow the selected context and try again.', 'context_too_large');
    await enforceUsageLimit(user.uid, 'ai', input.scope === 'selected_period' ? 3 : 1, {
      tester: Boolean(user.token.tester || user.token.demo),
    });
    const content = await withUserAiConcurrency(user.uid, () => generateText(buildPrompt(input)));
    return NextResponse.json({
      result: {
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        title: instructions[input.action].split('.')[0],
        content,
        contextSummary: `${input.itemMemory.length} item facts and ${input.linkedMemory.length} linked facts`,
        generatedAt: new Date().toISOString(),
      },
      requestId,
    });
  } catch (error) {
    return apiErrorResponse(error, requestId);
  }
}
