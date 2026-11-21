import assert from 'node:assert/strict';
import test from 'node:test';
import { conceptBoundaryFindings } from '../../src/lib/concept-boundary-findings';

test('definition review receives the actual classified cases and their saved reasons', () => {
  const concept = {
    description: 'Attention is directed focus.',
    examples: ['Reading a difficult page', 'Listening closely'],
    edgeCases: ['Watching for one sound'],
    counterexamples: ['A reflexive glance'],
    caseReasons: {
      'Watching for one sound': 'Depends on whether it is deliberate.',
      'A reflexive glance': 'Not necessarily sustained focus.',
      'Reading a difficult page': ' ',
      'Removed case': 'This should not resurface.',
    },
  };
  assert.deepEqual(conceptBoundaryFindings(concept), [
    { example: 'Watching for one sound', reason: 'Depends on whether it is deliberate.', label: 'Edge case', zone: 'edge' },
    { example: 'A reflexive glance', reason: 'Not necessarily sustained focus.', label: "Doesn't fit", zone: 'outside' },
  ]);
  assert.equal(concept.description, 'Attention is directed focus.');
});

test('changing the classification changes the review context without duplicating the case', () => {
  const result = conceptBoundaryFindings({ edgeCases: [' Glancing up ', 'Glancing up'], caseReasons: { 'Glancing up': 'Depends on intent.' } });
  assert.equal(result.length, 1);
  assert.equal(result[0].zone, 'edge');
});
