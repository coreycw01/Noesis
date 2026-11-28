import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedAiContext, isContextualAiRequestCompatible, THOUGHT_DRAFT_LIMIT, thoughtDraftEnvelope, validAiSelection, type AiContextEnvelope } from '../../src/lib/contextual-ai';

const base: AiContextEnvelope = { action: 'socratic_inquiry_challenge', targetType: 'inquiry', targetId: 'q1', scope: 'linked_items', itemMemory: ['Question?'], linkedMemory: [] };

test('optional thought assistance accepts only one unsaved thought and no workspace context', () => {
  const input = thoughtDraftEnvelope('  What makes a habit worth keeping?  ');
  assert.deepEqual(input.itemMemory, ['What makes a habit worth keeping?']);
  assert.deepEqual(input.linkedMemory, []);
  assert.equal(isContextualAiRequestCompatible(input), true);
  assert.equal(isContextualAiRequestCompatible({ ...input, scope: 'linked_items' }), false);
  assert.equal(validAiSelection(input), true);
  assert.equal(validAiSelection({ ...input, linkedMemory: ['A workspace record'] }), false);
  assert.equal(validAiSelection({ ...input, targetId: 'a-record' }), false);
  assert.equal(validAiSelection({ ...input, itemMemory: ['Thought', 'Another record'] }), false);
  assert.equal(validAiSelection(thoughtDraftEnvelope('   ')), false);
  assert.equal(thoughtDraftEnvelope('x'.repeat(THOUGHT_DRAFT_LIMIT + 1)).itemMemory[0].length, THOUGHT_DRAFT_LIMIT);
});
test('AI context prioritizes the current item and stays within line and total limits', () => {
  const input = { ...base, itemMemory: Array(10).fill('x'.repeat(5000)), linkedMemory: ['linked'], userPrompt: 'y'.repeat(1200) };
  const bounded = boundedAiContext(input);
  assert.equal(bounded.itemMemory.join('').length, 32000);
  assert.equal(bounded.linkedMemory.length, 0);
  assert.ok(bounded.itemMemory.every((line) => line.length <= 4000));
  assert.equal(bounded.userPrompt?.length, 1000);
  assert.equal(input.itemMemory[0].length, 5000);
});
test('Evolution requires an exact, nonempty calendar period with a matching target', () => {
  const period: AiContextEnvelope = { ...base, action: 'synthesize_evolution_period', targetType: 'evolution', scope: 'selected_period', linkedMemory: ['A position was revised.'] };
  const select = (from: string, to: string): AiContextEnvelope => ({
    ...period, targetId: `${from}:${to}`, selectedRange: { from, to },
  });
  assert.equal(validAiSelection(period), false);
  assert.equal(validAiSelection(select('invalid', '2026-10-11')), false);
  assert.equal(validAiSelection(select('2026-10-11', '2026-10-01')), false);
  assert.equal(validAiSelection(select('2026-02-30', '2026-03-01')), false);
  assert.equal(validAiSelection(select('2026-10-01T00:00:00Z', '2026-10-11')), false);
  assert.equal(validAiSelection(select('2026-10-01', '2026-10-11')), true);
  assert.equal(validAiSelection(select('2024-02-29', '2024-02-29')), true);
  assert.equal(validAiSelection({ ...select('2026-10-01', '2026-10-11'), targetId: 'other-period' }), false);
  assert.equal(validAiSelection({ ...select('2026-10-01', '2026-10-11'), linkedMemory: [] }), false);
});
test('comparison requires another recorded position; ordinary actions reject secondary context', () => {
  const secondaryTarget = { targetType: 'position' as const, targetId: 'p1', label: 'Claim', memory: ['Claim context'] };
  const pair: AiContextEnvelope = { ...base, action: 'compare_selected_positions', targetType: 'position', targetId: 'p1', scope: 'selected_pair', secondaryTarget };
  assert.equal(validAiSelection(pair), false);
  assert.equal(validAiSelection({ ...pair, secondaryTarget: { ...secondaryTarget, targetId: 'p2' } }), true);
  assert.equal(validAiSelection({ ...base, secondaryTarget }), false);
});
