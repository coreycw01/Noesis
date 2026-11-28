import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedAiContext, buildContextDeskMemory, type AiContextEnvelope } from '../../src/lib/contextual-ai';
import { aiExcerptKey, includedDeskRecords, prepareReviewedAiContext } from '../../src/lib/contextual-ai-preview';

const inquiry: AiContextEnvelope = {
  action: 'socratic_inquiry_challenge', scope: 'linked_items', targetType: 'inquiry', targetId: 'q',
  itemMemory: ['Question', 'Private note'], linkedMemory: ['Source detail', 'Useful excerpt'], userPrompt: 'My question',
};

test('hidden excerpts stay out of the request without changing the source envelope', () => {
  const hidden = new Set([aiExcerptKey('itemMemory', 1, 'Private note'), aiExcerptKey('linkedMemory', 0, 'Source detail')]);
  const reviewed = prepareReviewedAiContext(boundedAiContext(inquiry), hidden);
  assert.equal(reviewed.isValid, true);
  assert.deepEqual(reviewed.envelope.itemMemory, ['Question']);
  assert.deepEqual(reviewed.envelope.linkedMemory, ['Useful excerpt']);
  assert.deepEqual(inquiry.itemMemory, ['Question', 'Private note']);
  assert.equal(reviewed.envelope.userPrompt, 'My question');
});

test('removing required context disables an inquiry or comparison instead of sending it', () => {
  const hidden = new Set(inquiry.itemMemory.map((line, index) => aiExcerptKey('itemMemory', index, line)));
  assert.equal(prepareReviewedAiContext(inquiry, hidden).isValid, false);
  const compare: AiContextEnvelope = {
    ...inquiry, targetType: 'position', action: 'compare_selected_positions', scope: 'selected_pair',
    secondaryTarget: { targetType: 'position', targetId: 'p', label: 'Other position', memory: ['Other claim'] },
  };
  assert.equal(prepareReviewedAiContext(compare, new Set([aiExcerptKey('secondaryMemory', 0, 'Other claim')])).isValid, false);
});

test('hiding the first Desk slip promotes the next included one and removes hidden records from identity and provenance', () => {
  const keys = ['source:private', 'inquiry:q', 'position:hidden'];
  const input: AiContextEnvelope = {
    action: 'review_selected_context', scope: 'linked_items', targetType: 'context_desk', targetId: `selection:${keys.join('|')}`,
    ...buildContextDeskMemory([{ type: 'source', label: 'Private', memory: ['Do not send'] }, { type: 'inquiry', label: 'Question', memory: [] }, { type: 'position', label: 'Hide', memory: [] }]),
  };
  const result = prepareReviewedAiContext(input, new Set([
    aiExcerptKey('itemMemory', 0, input.itemMemory[0]), aiExcerptKey('linkedMemory', 1, input.linkedMemory[1]),
  ]), keys);
  assert.equal(result.isValid, true);
  assert.equal(result.envelope.targetId, 'selection:inquiry:q');
  assert.deepEqual(result.envelope.itemMemory, [input.linkedMemory[0]]);
  assert.deepEqual(result.envelope.linkedMemory, []);
  assert.deepEqual(includedDeskRecords(keys, result.included), ['inquiry:q']);
});
