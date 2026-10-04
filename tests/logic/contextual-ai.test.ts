import assert from 'node:assert/strict';
import test from 'node:test';
import { isContextualAiRequestCompatible } from '../../src/lib/contextual-ai';

test('allows each contextual action only on its intended object and scope', () => {
  assert.equal(isContextualAiRequestCompatible({ action: 'summarize_source', targetType: 'source', scope: 'linked_items' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'socratic_inquiry_challenge', targetType: 'inquiry', scope: 'linked_items' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'compare_selected_positions', targetType: 'position', scope: 'selected_pair' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'synthesize_evolution_period', targetType: 'evolution', scope: 'selected_period' }), true);
});

test('rejects cross-page or overly broad contextual action combinations', () => {
  assert.equal(isContextualAiRequestCompatible({ action: 'summarize_source', targetType: 'position', scope: 'linked_items' }), false);
  assert.equal(isContextualAiRequestCompatible({ action: 'compare_selected_positions', targetType: 'position', scope: 'linked_items' }), false);
  assert.equal(isContextualAiRequestCompatible({ action: 'synthesize_evolution_period', targetType: 'evolution', scope: 'linked_items' }), false);
  assert.equal(isContextualAiRequestCompatible({ action: 'find_position_assumptions', targetType: 'position', scope: 'current_item' }), false);
});
