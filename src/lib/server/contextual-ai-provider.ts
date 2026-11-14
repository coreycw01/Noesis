import { readProviderText } from '../ai-response';
import { tryAiModels } from './ai-model-selection';
import { ApiError } from './api-error';

export function requireActiveRequest(signal: AbortSignal) {
  if (signal.aborted) throw new ApiError(408, 'The assistance request was canceled.', 'ai_canceled');
}

export async function generateContextualText(prompt: string, requestSignal: AbortSignal, apiKey: string, fetchProvider = fetch, timeoutMs = 45_000) {
  requireActiveRequest(requestSignal);
  const configuredModel = (process.env.GEMINI_MODEL || 'gemini-3.6-flash').replace(/^googleai\//, '').replace(/^models\//, '');
  const controller = new AbortController();
  const signal = AbortSignal.any([requestSignal, controller.signal]);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const preferredModels = [
      configuredModel,
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ];
    const content = await tryAiModels<string>(preferredModels, async () => {
      const modelResponse = await fetchProvider('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
        headers: { 'x-goog-api-key': apiKey },
        signal,
      });
      if (!modelResponse.ok) return null;
      const catalog = await modelResponse.json().catch(() => null) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      } | null;
      if (!Array.isArray(catalog?.models)) return null;
      return catalog.models
        .filter((model) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent'))
        .map((model) => typeof model.name === 'string' ? model.name.replace(/^models\//, '') : '')
        .filter(Boolean);
    }, async (model) => {
      const response = await fetchProvider(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 1_500 },
        }),
      });
      if (response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        signal.throwIfAborted();
        const text = readProviderText(payload);
        if (!text) throw new ApiError(422, 'No usable assistance was returned.', 'empty_ai_result');
        return { available: true, value: text };
      }
      if (response.status === 404) {
        console.warn('Contextual AI model unavailable for this key', { model });
        return { available: false };
      }
      if (response.status === 429) throw new ApiError(429, 'Noesis assistance is temporarily at capacity.', 'provider_rate_limit', 60);
      const providerError = await response.json().catch(() => null) as {
        error?: { status?: string; message?: string };
      } | null;
      console.error('Contextual AI provider request failed', {
        status: response.status,
        providerStatus: providerError?.error?.status || 'unknown',
        model,
      });
      throw new ApiError(503, 'Noesis assistance is temporarily unavailable.', 'provider_unavailable');
    });
    if (content !== null) return content;
    throw new ApiError(503, 'Noesis assistance is temporarily unavailable.', 'provider_unavailable');
  } catch (error) {
    requireActiveRequest(requestSignal);
    if (controller.signal.aborted) throw new ApiError(504, 'Noesis assistance timed out safely.', 'ai_timeout');
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'Noesis assistance is temporarily unavailable.', 'provider_unavailable');
  } finally {
    clearTimeout(timer);
  }
}
