'use client';

import { authenticatedFetch } from '@/lib/authenticated-fetch';
import type { AiContextEnvelope, AiReviewResult } from '@/lib/contextual-ai';
import { aiResponseError, readAiReviewResult } from '@/lib/ai-response';

export async function requestContextualAi(envelope: AiContextEnvelope, signal?: AbortSignal): Promise<AiReviewResult> {
  signal?.throwIfAborted();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Reconnect to use Noesis assistance. Your data was not changed.');
  }
  const response = await authenticatedFetch('/api/contextual-ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
    signal,
  });
  const data: unknown = await response.json().catch(() => null);
  signal?.throwIfAborted();
  if (!response.ok) {
    throw new Error(aiResponseError(data, response.status === 429 ? response.headers.get('retry-after') : null));
  }
  const result = readAiReviewResult(data, envelope);
  if (!result) {
    throw new Error('Noesis received an invalid assistance response. Your data was not changed.');
  }
  return result;
}

