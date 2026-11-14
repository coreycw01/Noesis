import assert from 'node:assert/strict';
import test from 'node:test';
import { aiResponseError, readAiReviewResult, readProviderText } from '../../src/lib/ai-response';

test('AI quota feedback shows a bounded and rounded retry time', () => {
  const minute = { error: 'Too many requests. Try again shortly.' };
  const daily = { error: 'Your daily usage limit has been reached.' };
  assert.equal(aiResponseError(minute, '1'), 'Too many requests. Try again in about 1 second.');
  assert.equal(aiResponseError(daily, '3700'), 'Your daily usage limit has been reached. Try again in about 2 hours.');
  assert.equal(aiResponseError(minute, '99999'), minute.error);
  assert.equal(aiResponseError(minute, '-1'), minute.error);
});

test('provider output rejects incomplete and malformed results without exposing thought parts', () => {
  const content = { parts: [null, { text: 4 }, { thought: true, text: 'private thought' }, { text: ' Usable review ' }] };
  assert.equal(readProviderText({ candidates: [{ finishReason: 'STOP', content }] }), 'Usable review');
  assert.equal(readProviderText({ candidates: [{ finishReason: 'MAX_TOKENS', content }] }), null);
  assert.equal(readProviderText({ candidates: [{ finishReason: 'SAFETY', content }] }), null);
  assert.equal(readProviderText({ candidates: [{ content: { parts: 'not an array' } }] }), null);
});

test('client review is accepted only when the result is complete and matches the request', () => {
  const request = { action: 'reflect_on_source', targetType: 'source', targetId: 'selected' } as const;
  const result = { ...request, title: 'Reflection', content: 'Reviewed text', contextSummary: 'One source', generatedAt: '2026-11-13T12:00:00Z' };
  assert.deepEqual(readAiReviewResult({ result }, request), result);
  assert.equal(readAiReviewResult({ result: { ...result, targetId: 'other' } }, request), null);
  assert.equal(readAiReviewResult({ result: { ...result, generatedAt: 'invalid' } }, request), null);
  assert.equal(readAiReviewResult({ result: { ...result, content: '  ' } }, request), null);
  assert.equal(readAiReviewResult(null, request), null);
});
