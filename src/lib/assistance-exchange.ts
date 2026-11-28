import { CONTEXTUAL_AI_LABELS, type AiContextEnvelope, type AiReviewResult } from './contextual-ai';

export function assistanceExchange(request: AiContextEnvelope, result: AiReviewResult, id: string) {
  if (request.action !== result.action || request.targetType !== result.targetType || request.targetId !== result.targetId) throw new Error('Assistance returned for a different item.');
  return {
    id, itemKey: request.targetType + ':' + request.targetId, action: request.action,
    question: request.userPrompt?.trim() || '', task: CONTEXTUAL_AI_LABELS[request.action],
    answer: result.content, generatedAt: result.generatedAt,
  };
}

export type AssistanceExchange = ReturnType<typeof assistanceExchange>;

export function challengeClarification(result: AiReviewResult | null) {
  return result?.action === 'generate_position_counterargument'
    ? result.content.trim().match(/^CLARIFY:\s*([\s\S]+)$/i)?.[1]?.trim() : undefined;
}
