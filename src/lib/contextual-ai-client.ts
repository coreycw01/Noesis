'use client';

import { authenticatedFetch } from '@/lib/authenticated-fetch';
import type { AiContextEnvelope, AiReviewResult } from '@/lib/contextual-ai';

export async function requestContextualAi(envelope: AiContextEnvelope, signal?: AbortSignal): Promise<AiReviewResult> {
  const response = await authenticatedFetch('/api/contextual-ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Noesis assistance is unavailable right now.');
  const result = data.result;
  if (!result || typeof result.content !== 'string' || !result.content.trim() || typeof result.title !== 'string' || result.action !== envelope.action || result.targetId !== envelope.targetId || result.targetType !== envelope.targetType) {
    throw new Error('Noesis received an invalid assistance response. Your data was not changed.');
  }
  return result as AiReviewResult;
}

