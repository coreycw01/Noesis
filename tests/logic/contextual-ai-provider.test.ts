import assert from 'node:assert/strict';
import test from 'node:test';
import { generateContextualText } from '../../src/lib/server/contextual-ai-provider';

const signal = () => new AbortController().signal;
const prompt = 'Synthetic test context';

test('provider responses normalize malformed replies and quota errors without retries', async () => {
  for (const [status, body, expected] of [
    [200, '<html>invalid JSON</html>', { status: 422, code: 'empty_ai_result' }],
    [429, 'private provider response', { status: 429, code: 'provider_rate_limit', retryAfter: 60 }],
  ] as const) {
    let attempts = 0;
    const mockFetch: typeof fetch = async () => {
      attempts += 1;
      return new Response(body, { status });
    };
    await assert.rejects(generateContextualText(prompt, signal(), 'fake-key', mockFetch), expected);
    assert.equal(attempts, 1);
  }
});

test('provider response discards hidden thought parts and returns usable text', async () => {
  const mockFetch: typeof fetch = async () => Response.json({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Hidden', thought: true }, { text: 'Reviewed result' }] } }],
  });
  assert.equal(await generateContextualText(prompt, signal(), 'fake-key', mockFetch), 'Reviewed result');
});

test('provider distinguishes timeout from cancellation and never starts an already canceled request', async () => {
  const mockFetch: typeof fetch = async (_input, init) => new Promise((_, reject) => {
    const active = init?.signal;
    assert.ok(active);
    active.addEventListener('abort', () => reject(active.reason), { once: true });
  });
  await assert.rejects(generateContextualText(prompt, signal(), 'fake-key', mockFetch, 5), { status: 504, code: 'ai_timeout' });
  const controller = new AbortController();
  const pending = generateContextualText(prompt, controller.signal, 'fake-key', mockFetch);
  controller.abort();
  await assert.rejects(pending, { status: 408, code: 'ai_canceled' });
  await assert.rejects(generateContextualText(prompt, controller.signal, 'fake-key', async () => assert.fail('Provider should not run')), { code: 'ai_canceled' });
});
