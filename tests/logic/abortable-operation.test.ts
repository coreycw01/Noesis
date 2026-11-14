import assert from 'node:assert/strict';
import test from 'node:test';
import { abortableOperation } from '../../src/lib/abortable-operation';
import { aiResponseError } from '../../src/lib/ai-response';

test('a timed-out credential wait releases the caller even if the credential never arrives', async () => {
  const controller = new AbortController();
  const timeout = new Error('Assistance timed out.');
  let started = false;
  const pending = abortableOperation(() => {
    started = true;
    return new Promise<string>(() => {});
  }, controller.signal);
  await Promise.resolve();
  assert.equal(started, true);
  controller.abort(timeout);
  await assert.rejects(pending, (error) => error === timeout);
});

test('canceling before credential preparation does not start the operation', async () => {
  const controller = new AbortController();
  let calls = 0;
  const start = async () => ++calls;
  const pending = abortableOperation(start, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(abortableOperation(start, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
  assert.equal(await abortableOperation(start, new AbortController().signal), 1);
});

test('malformed AI error bodies fall back to readable feedback', () => {
  for (const body of [null, [], 'bad gateway', { error: '' }, { error: { code: 503 } }]) {
    assert.equal(aiResponseError(body), 'Noesis assistance is unavailable right now.');
  }
  assert.equal(aiResponseError({ error: 'Noesis assistance is temporarily at capacity.' }), 'Noesis assistance is temporarily at capacity.');
});
