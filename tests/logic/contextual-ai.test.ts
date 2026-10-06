import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTEXTUAL_AI_POLICIES, isContextualAiRequestCompatible } from '../../src/lib/contextual-ai';
import {
  NOESIS_DETAIL_DATA_REQUIREMENTS,
  NOESIS_PAGE_DATA_REQUIREMENTS,
} from '../../src/lib/noesis-page-definitions';

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

test('exposes only the approved detail-level assistance tools', () => {
  assert.deepEqual(Object.keys(CONTEXTUAL_AI_POLICIES).sort(), [
    'clarify_concept_boundaries',
    'compare_selected_positions',
    'extract_source_claims',
    'find_position_assumptions',
    'generate_position_counterargument',
    'identify_missing_position_evidence',
    'propose_inquiry_prompts',
    'refine_concept_definition',
    'socratic_inquiry_challenge',
    'suggest_annotation_effect',
    'summarize_source',
    'synthesize_evolution_period',
    'synthesize_practice_outcome',
  ]);
  assert.equal('stress_test_position' in CONTEXTUAL_AI_POLICIES, false);
});

test('loads AI settings only on routes that expose contextual assistance', () => {
  for (const view of ['concepts', 'questions', 'library', 'annotations', 'vault', 'practices', 'evolution'] as const) {
    assert.ok(NOESIS_PAGE_DATA_REQUIREMENTS[view].includes('aiSettings'), `${view} must load AI settings`);
  }

  for (const target of ['concept', 'inquiry', 'source', 'position', 'practice'] as const) {
    assert.ok(NOESIS_DETAIL_DATA_REQUIREMENTS[target].includes('aiSettings'), `${target} details must load AI settings`);
  }

  assert.equal(NOESIS_PAGE_DATA_REQUIREMENTS.home.includes('aiSettings'), false);
  assert.equal(NOESIS_PAGE_DATA_REQUIREMENTS.atlas.includes('aiSettings'), false);
  assert.equal(NOESIS_PAGE_DATA_REQUIREMENTS.writing.includes('aiSettings'), false);
});
