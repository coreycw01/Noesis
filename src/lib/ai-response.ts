import type { AiContextEnvelope, AiReviewResult } from './contextual-ai';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function aiResponseError(payload: unknown, retryAfter?: string | null) {
  const error = asRecord(payload)?.error;
  const message = typeof error === 'string' && error.trim() ? error : 'Noesis assistance is unavailable right now.';
  if (!retryAfter || !/^\d{1,5}$/.test(retryAfter)) return message;
  const seconds = Number(retryAfter);
  if (seconds < 1 || seconds > 86_400) return message;
  const [amount, unit] = seconds < 60 ? [seconds, 'second']
    : seconds < 3_600 ? [Math.ceil(seconds / 60), 'minute']
    : [Math.ceil(seconds / 3_600), 'hour'];
  const delay = `${amount} ${unit}${amount === 1 ? '' : 's'}`;
  return `${message.replace(/ Try again shortly\.$/, '')} Try again in about ${delay}.`;
}

export function readProviderText(payload: unknown): string | null {
  const candidates = asRecord(payload)?.candidates;
  if (!Array.isArray(candidates)) return null;
  const candidate = asRecord(candidates[0]);
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') return null;
  const parts = asRecord(candidate?.content)?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.flatMap((value) => {
    const part = asRecord(value);
    return part && part.thought !== true && typeof part.text === 'string' ? [part.text] : [];
  }).join('\n').trim();
  return text || null;
}

export function readAiReviewResult(payload: unknown, request: Pick<AiContextEnvelope, 'action' | 'targetType' | 'targetId'>): AiReviewResult | null {
  const result = asRecord(asRecord(payload)?.result);
  if (!result || result.action !== request.action || result.targetType !== request.targetType || result.targetId !== request.targetId
    || typeof result.content !== 'string' || !result.content.trim() || typeof result.title !== 'string' || !result.title.trim()
    || typeof result.contextSummary !== 'string' || typeof result.generatedAt !== 'string' || !Number.isFinite(Date.parse(result.generatedAt))) return null;
  return { action: request.action, targetType: request.targetType, targetId: request.targetId, content: result.content,
    title: result.title, contextSummary: result.contextSummary, generatedAt: result.generatedAt };
}
