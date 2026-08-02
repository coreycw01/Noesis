'use client';

import { authenticatedFetch } from '@/lib/authenticated-fetch';
import type { AiContextEnvelope, AiReviewResult } from '@/lib/contextual-ai';

export async function requestContextualAi(envelope: AiContextEnvelope): Promise<AiReviewResult> {
  const response = await authenticatedFetch('/api/contextual-ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Noesis assistance is unavailable right now.');
  return data.result as AiReviewResult;
}

