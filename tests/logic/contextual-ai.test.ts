import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTEXTUAL_AI_POLICIES, isContextualAiRequestCompatible, parseAiReviewItems, parseAssumptionSuggestions, serializeAiReviewItems } from '../../src/lib/contextual-ai';
import {
  NOESIS_DETAIL_DATA_REQUIREMENTS,
  NOESIS_PAGE_DATA_REQUIREMENTS,
} from '../../src/lib/noesis-page-definitions';

test('allows each contextual action only on its intended object and scope', () => {
  assert.equal(isContextualAiRequestCompatible({ action: 'summarize_source', targetType: 'source', scope: 'linked_items' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'reflect_on_source', targetType: 'source', scope: 'linked_items' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'socratic_inquiry_challenge', targetType: 'inquiry', scope: 'linked_items' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'compare_selected_positions', targetType: 'position', scope: 'selected_pair' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'synthesize_evolution_period', targetType: 'evolution', scope: 'selected_period' }), true);
  assert.equal(isContextualAiRequestCompatible({ action: 'synthesize_profile_philosophy', targetType: 'profile', scope: 'linked_items' }), true);
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
    'reflect_on_source',
    'socratic_inquiry_challenge',
    'suggest_annotation_effect',
    'summarize_source',
    'synthesize_evolution_period',
    'synthesize_practice_outcome',
    'synthesize_profile_philosophy',
  ]);
  assert.equal('stress_test_position' in CONTEXTUAL_AI_POLICIES, false);
});

test('loads AI settings only on routes that expose contextual assistance', () => {
  for (const view of ['concepts', 'questions', 'library', 'annotations', 'vault', 'practices', 'evolution', 'profile'] as const) {
    assert.ok(NOESIS_PAGE_DATA_REQUIREMENTS[view].includes('aiSettings'), `${view} must load AI settings`);
  }

  for (const target of ['concept', 'inquiry', 'source', 'position', 'practice'] as const) {
    assert.ok(NOESIS_DETAIL_DATA_REQUIREMENTS[target].includes('aiSettings'), `${target} details must load AI settings`);
  }

  assert.equal(NOESIS_PAGE_DATA_REQUIREMENTS.home.includes('aiSettings'), false);
  assert.equal(NOESIS_PAGE_DATA_REQUIREMENTS.atlas.includes('aiSettings'), false);
  assert.equal(NOESIS_PAGE_DATA_REQUIREMENTS.writing.includes('aiSettings'), false);
});

test('parses assumptions into independently reviewable suggestions', () => {
  assert.deepEqual(parseAssumptionSuggestions([
    'ASSUMPTION: Comfort always reduces growth || WHY: The position depends on comfort and growth moving in opposite directions.',
    'ASSUMPTION: Discomfort reliably reveals reality || WHY: Otherwise discomfort would not be a useful corrective.',
  ].join('\n')), [
    { assumption: 'Comfort always reduces growth', reason: 'The position depends on comfort and growth moving in opposite directions.' },
    { assumption: 'Discomfort reliably reveals reality', reason: 'Otherwise discomfort would not be a useful corrective.' },
  ]);
});

test('parses every contextual result into editable review units', () => {
  assert.deepEqual(parseAiReviewItems('extract_source_claims', '- Freedom requires responsibility.\n- Power changes what people notice.'), [
    { title: 'claim 1', content: 'Freedom requires responsibility.' },
    { title: 'claim 2', content: 'Power changes what people notice.' },
  ]);
  assert.deepEqual(parseAiReviewItems('socratic_inquiry_challenge', '## Questions\nWhat would disprove this?\n\n## Next step\nCompare the strongest alternative.'), [
    { title: 'Questions', content: 'What would disprove this?' },
    { title: 'Next step', content: 'Compare the strongest alternative.' },
  ]);
  assert.equal(serializeAiReviewItems('clarify_concept_boundaries', [
    { title: 'boundary 1', content: 'It is not mere preference.' },
    { title: 'boundary 2', content: 'It does not require certainty.' },
  ]), 'It is not mere preference.\nIt does not require certainty.');
});
