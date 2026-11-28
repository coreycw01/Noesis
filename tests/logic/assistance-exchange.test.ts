import assert from 'node:assert/strict';
import test from 'node:test';
import { assistanceExchange, challengeClarification } from '../../src/lib/assistance-exchange';
import type { AiContextEnvelope, AiReviewResult } from '../../src/lib/contextual-ai';
import { itemAiHistory } from '../../src/lib/item-ai-history';

const request: AiContextEnvelope = { targetType: 'position', targetId: 'one', action: 'generate_position_counterargument', scope: 'linked_items', itemMemory: ['private excerpt'], linkedMemory: [], userPrompt: 'Is there an exception?' };
const result: AiReviewResult = { targetType: 'position', targetId: 'one', action: request.action, title: '', content: 'CLARIFY: What was the situation?', generatedAt: '2026-01-01', contextSummary: '' };

test('original exchanges retain the question and reply but do not copy source excerpts or imply acceptance', () => {
  const exchange = assistanceExchange(request, result, 'run');
  assert.equal(exchange.question, request.userPrompt);
  assert.equal(exchange.answer, result.content);
  assert.equal(exchange.itemKey, 'position:one');
  assert.equal(challengeClarification(result), 'What was the situation?');
  assert.doesNotMatch(JSON.stringify(exchange), /private excerpt|accepted/);
  assert.throws(() => assistanceExchange(request, { ...result, targetId: 'two' }, 'run'));
  assert.equal(assistanceExchange({ ...request, userPrompt: undefined }, result, 'run').question, '');
});

test('accepted history reads reviewed inquiry notes, not the original AI exchange or ordinary notes', () => {
  assert.deepEqual(itemAiHistory({}), []);
  const notes = itemAiHistory({ investigationNotes: [
    { id: 'a', text: 'Kept question', date: '2026-01-02', origin: 'ai-assisted' },
    { id: 'b', text: 'My notes', date: '2026-01-03', origin: 'user' },
  ] });
  assert.deepEqual(notes.map(n => n.content), ['Kept question']);
});
