import test from 'node:test';
import assert from 'node:assert/strict';
import { aiDepthFor } from '../../src/lib/ai-depth';

test('a page uses its own depth, else the workspace default', () => {
  const settings = { defaultReasoningDepth: 'standard' as const, depthByPage: { library: 'light' as const, inquiries: 'deep' as const } };
  assert.equal(aiDepthFor(settings, 'library'), 'light');
  assert.equal(aiDepthFor(settings, 'inquiries'), 'deep');
  assert.equal(aiDepthFor(settings, 'positions'), 'standard');
  assert.equal(aiDepthFor(undefined, 'positions'), 'standard');
});
