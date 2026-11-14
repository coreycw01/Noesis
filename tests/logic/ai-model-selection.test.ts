import assert from 'node:assert/strict';
import test from 'node:test';
import { tryAiModels } from '../../src/lib/server/ai-model-selection';

test('a working configured AI model needs one provider request and no catalog', async () => {
  const attempted: string[] = [];
  const result = await tryAiModels(['configured', 'fallback'], async () => {
    assert.fail('A working configured model does not need catalog discovery');
  }, async (model) => {
    attempted.push(model);
    return { available: true, value: 'Reviewed text' };
  });
  assert.deepEqual(attempted, ['configured']);
  assert.equal(result, 'Reviewed text');
});

test('a missing model discovers an available fallback without retrying the same model', async () => {
  const visited: string[] = [];
  const result = await tryAiModels(['configured', 'old', 'configured', 'compatible'], async () => {
    visited.push('catalog');
    return ['configured', 'compatible', 'other-flash'];
  }, async (model) => {
    visited.push(model);
    return model === 'compatible' ? { available: true, value: 'fallback' } : { available: false };
  });
  assert.deepEqual(visited, ['configured', 'catalog', 'compatible']);
  assert.equal(result, 'fallback');
});

test('unavailable catalog falls back to known models, but quota and cancellation errors are not retried', async () => {
  assert.equal(await tryAiModels(['configured', 'fallback'], async () => null, async (model) =>
    model === 'fallback' ? { available: true, value: 'fallback' } : { available: false }), 'fallback');
  for (const failure of [new Error('Provider rate limit'), new DOMException('Canceled', 'AbortError')]) {
    await assert.rejects(
      tryAiModels(['configured', 'fallback'], async () => assert.fail('No fallback on terminal errors'), async () => { throw failure; }),
      (error) => error === failure,
    );
  }
});
