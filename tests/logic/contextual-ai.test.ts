import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_CONTEXT_MEMORY_LIMIT, aiContextMemorySize, validAiSelection } from '../../src/lib/contextual-ai';
import { boundedAiContext, buildContextDeskMemory, CONTEXTUAL_AI_LABELS, CONTEXTUAL_AI_POLICIES, CONTEXTUAL_AI_SUGGESTED_PROMPTS, isContextualAiRequestCompatible, parseAiReviewItems, parseAssumptionSuggestions, profileStatementFromSynthesis, serializeAiReviewItems } from '../../src/lib/contextual-ai';
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
  assert.equal(isContextualAiRequestCompatible({ action: 'review_selected_context', targetType: 'context_desk', scope: 'linked_items' }), true);
});

test('uses concise review language for selected context', () => {
  assert.equal(CONTEXTUAL_AI_LABELS.review_selected_context, 'Review Context');
});

test('a large first position cannot crowd the second out of the comparison budget', () => {
  const input = boundedAiContext({
    action: 'compare_selected_positions', targetType: 'position', targetId: 'a', scope: 'selected_pair',
    itemMemory: Array(20).fill('a'.repeat(4_000)), linkedMemory: ['Related context'],
    secondaryTarget: { targetType: 'position', targetId: 'b', label: 'Second position', memory: Array(12).fill('b'.repeat(4_000)) },
  });
  assert.equal(input.itemMemory.join('').length, 16_000);
  assert.equal(input.secondaryTarget?.memory.join('').length, 16_000);
  assert.equal(aiContextMemorySize(input), AI_CONTEXT_MEMORY_LIMIT);
  assert.ok(validAiSelection(input));
});

test('Context Desk sends a bounded excerpt for each of twelve selected records', () => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    type: 'source', label: `Source ${index + 1}`, memory: ['A'.repeat(8_000), 'Later notes'],
  }));
  const envelope = boundedAiContext({
    action: 'review_selected_context', targetType: 'context_desk', targetId: 'selection', scope: 'linked_items',
    ...buildContextDeskMemory(records),
  });
  const excerpts = [...envelope.itemMemory, ...envelope.linkedMemory];
  assert.equal(excerpts.length, 12);
  assert.ok(excerpts.every((excerpt, index) => excerpt.startsWith(`Selected source: Source ${index + 1}\n`) && excerpt.length <= 4_000));
  assert.ok(excerpts.reduce((sum, excerpt) => sum + excerpt.length, 0) <= 32_000);
});

test('rejects cross-page or overly broad contextual action combinations', () => {
  assert.equal(isContextualAiRequestCompatible({ action: 'summarize_source', targetType: 'position', scope: 'linked_items' }), false);
  assert.equal(isContextualAiRequestCompatible({ action: 'compare_selected_positions', targetType: 'position', scope: 'linked_items' }), false);
  assert.equal(isContextualAiRequestCompatible({ action: 'synthesize_evolution_period', targetType: 'evolution', scope: 'linked_items' }), false);
  assert.equal(isContextualAiRequestCompatible({ action: 'find_position_assumptions', targetType: 'position', scope: 'current_item' }), false);
});

test('exposes only the approved contextual assistance tools', () => {
  assert.deepEqual(Object.keys(CONTEXTUAL_AI_POLICIES).sort(), [
    'clarify_concept_boundaries',
    'compare_selected_positions',
    'explore_thought_draft',
    'extract_source_claims',
    'find_position_assumptions',
    'generate_position_counterargument',
    'identify_missing_position_evidence',
    'propose_inquiry_prompts',
    'refine_concept_definition',
    'reflect_on_source',
    'review_selected_context',
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
  for (const view of ['home', 'concepts', 'questions', 'library', 'annotations', 'vault', 'labs', 'evolution', 'profile', 'context-desk'] as const) {
    assert.ok(NOESIS_PAGE_DATA_REQUIREMENTS[view].includes('aiSettings'), `${view} must load AI settings`);
  }

  for (const target of ['concept', 'inquiry', 'source', 'position', 'practice'] as const) {
    assert.ok(NOESIS_DETAIL_DATA_REQUIREMENTS[target].includes('aiSettings'), `${target} details must load AI settings`);
  }

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

test('provides a concise editable question set for every contextual action', () => {
  assert.deepEqual(Object.keys(CONTEXTUAL_AI_SUGGESTED_PROMPTS).sort(), Object.keys(CONTEXTUAL_AI_POLICIES).sort());
  for (const [action, prompts] of Object.entries(CONTEXTUAL_AI_SUGGESTED_PROMPTS)) {
    if (action === 'explore_thought_draft') {
      assert.deepEqual(prompts, [], 'The thought starter sends only the thought, without a separate prompt');
      continue;
    }
    assert.ok(prompts.length >= 4 && prompts.length <= 6, `${action} should expose four to six suggested questions`);
    assert.equal(new Set(prompts).size, prompts.length, `${action} prompts should be unique`);
    assert.ok(prompts.every((prompt) => prompt.endsWith('?')), `${action} prompts should read as questions`);
  }
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
    { title: 'Falls outside', content: 'It is not mere preference.' },
    { title: 'Unresolved boundary', content: 'It does not require certainty.' },
  ]), '## Falls outside\nIt is not mere preference.\n\n## Unresolved boundary\nIt does not require certainty.');
});

test('removes Markdown notation from editable context-review items', () => {
  assert.deepEqual(parseAiReviewItems('review_selected_context', [
    '## **Contradiction**',
    '**Confidence** is *higher* than the recorded evidence supports.',
    '- `Position A` has no supporting source.',
    '- __Position B__ has one unresolved assumption.',
  ].join('\n')), [{
    title: 'Contradiction',
    content: [
      'Confidence is higher than the recorded evidence supports.',
      '• Position A has no supporting source.',
      '• Position B has one unresolved assumption.',
    ].join('\n'),
  }]);

  assert.deepEqual(parseAiReviewItems('find_position_assumptions', [
    '- ASSUMPTION: **Discomfort reveals truth** || WHY: *The claim depends on it.*',
  ].join('\n')), [{
    title: 'Assumption 1',
    content: 'Discomfort reveals truth',
    detail: 'The claim depends on it.',
  }]);
});

test('profile synthesis promotes only the reviewed working statement', () => {
  const review = [
    '## Working statement',
    'Human dignity should constrain every pursuit of control.',
    '',
    '## Possible names',
    'Revisable Humanism',
    '',
    '## Tensions',
    'Discipline may conflict with freedom.',
  ].join('\n');

  assert.equal(profileStatementFromSynthesis(review), 'Human dignity should constrain every pursuit of control.');
  assert.equal(profileStatementFromSynthesis('## Possible names\nRevisable Humanism'), undefined);
});
