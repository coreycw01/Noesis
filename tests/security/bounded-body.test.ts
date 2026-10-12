import test from 'node:test';
import assert from 'node:assert/strict';
import { readBoundedRequestBody, RequestBodyTooLarge } from '../../src/lib/bounded-request-body';

test('request limits use bytes, including when Content-Length is missing', async () => {
  const request = new Request('https://example.test', { method: 'POST', body: 'abcd' });
  await assert.rejects(readBoundedRequestBody(request, 3), RequestBodyTooLarge);
});
test('request text accepts the exact byte boundary', async () => {
  assert.equal(await readBoundedRequestBody(new Request('https://example.test', { method: 'POST', body: 'abcd' }), 4), 'abcd');
});
test('oversized streaming bodies are cancelled before the rest is consumed', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(10)); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://example.test', { method: 'POST', body, duplex: 'half' } as RequestInit);
  await assert.rejects(readBoundedRequestBody(request, 12), RequestBodyTooLarge);
  assert.equal(cancelled, true);
});
