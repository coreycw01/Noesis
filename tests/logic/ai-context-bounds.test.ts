import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedAiContext, validAiSelection, type AiContextEnvelope } from '../../src/lib/contextual-ai';

const base: AiContextEnvelope = { action: 'socratic_inquiry_challenge', targetType: 'inquiry', targetId: 'q1', scope: 'linked_items', itemMemory: ['Question?'], linkedMemory: [] };
test('AI context prioritizes the current item and stays within line and total limits', () => {
  const input = { ...base, itemMemory: Array(10).fill('x'.repeat(5000)), linkedMemory: ['linked'], userPrompt: 'y'.repeat(1200) };
  const bounded = boundedAiContext(input);
  assert.equal(bounded.itemMemory.join('').length, 32000);
  assert.equal(bounded.linkedMemory.length, 0);
  assert.ok(bounded.itemMemory.every((line) => line.length <= 4000));
  assert.equal(bounded.userPrompt?.length, 1000);
  assert.equal(input.itemMemory[0].length, 5000);
});
test('Evolution rejects missing, invalid and reversed periods', () => {
  const period: AiContextEnvelope = { ...base, action: 'synthesize_evolution_period', targetType: 'evolution', scope: 'selected_period' };
  assert.equal(validAiSelection(period), false);
  assert.equal(validAiSelection({ ...period, selectedRange: { from: 'invalid', to: '2026-10-11' } }), false);
  assert.equal(validAiSelection({ ...period, selectedRange: { from: '2026-10-11', to: '2026-10-01' } }), false);
  assert.equal(validAiSelection({ ...period, selectedRange: { from: '2026-10-01', to: '2026-10-11' } }), true);
});
test('comparison requires another recorded position; ordinary actions reject secondary context', () => {
  const secondaryTarget = { targetType: 'position' as const, targetId: 'p1', label: 'Claim', memory: ['Claim context'] };
  const pair: AiContextEnvelope = { ...base, action: 'compare_selected_positions', targetType: 'position', targetId: 'p1', scope: 'selected_pair', secondaryTarget };
  assert.equal(validAiSelection(pair), false);
  assert.equal(validAiSelection({ ...pair, secondaryTarget: { ...secondaryTarget, targetId: 'p2' } }), true);
  assert.equal(validAiSelection({ ...base, secondaryTarget }), false);
});
