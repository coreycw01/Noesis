import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { prepareSourceReview } from '../../src/lib/source-ai-review';

test('source inquiry prompts become question annotations, not answered inquiries', async () => {
  const source = { ...buildDemoWorkspace('owner').media[0], annotations: [] };
  const date = '2026-11-13T12:00:00Z';
  const text = '- What would change this interpretation?\n- What evidence is missing?';
  const prepared = await prepareSourceReview('owner', {
    baseline: source, text,
    result: { action: 'propose_inquiry_prompts', targetType: 'source', targetId: source.id,
      reviewId: 'prompts', title: 'Prompts', generatedAt: date, content: 'Original', contextSummary: '' },
  }, date, date);
  const saved = prepared.patch(source);
  assert.equal(saved.annotations.length, 2);
  assert.ok(saved.annotations.every((item) => item.type === 'question' && item.sourceId === source.id && !item.createdInquiryId));
  assert.deepEqual(saved.origin.targets.map(({ id }) => id), saved.annotations.map(({ id }) => id));
});
