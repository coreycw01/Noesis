import assert from 'node:assert/strict';
import test from 'node:test';
import { conceptBoundaryFindings, conceptBoundaryMarks } from '../../src/lib/concept-boundary-findings';

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

test('the edge of a concept is everything it records about its edge', () => {
  assert.deepEqual(conceptBoundaryMarks({}), []);
  const marks = conceptBoundaryMarks({
    notSameAs: ['Narrative Self'],
    counterexamples: ['A role dropped at home', ''],
    edgeCases: ['A conversion that keeps the habits'],
    caseReasons: { 'A role dropped at home': 'An audience maintains it.' },
  });
  assert.deepEqual(marks.map((mark) => mark.kind), ['not the same as', 'counterexample', 'edge case']);
  assert.equal(marks[1].reason, 'An audience maintains it.');
  // A boundary is real the moment it is drawn; the reasoning is optional.
  assert.equal(marks[0].reason, undefined);
});

test('a boundary is never listed twice, however it was recorded', () => {
  assert.equal(conceptBoundaryMarks({ notSameAs: ['Habit'], counterexamples: [' Habit '] }).length, 1);
});

test('what fits is not a boundary, though the review still counts it', () => {
  const concept = { examples: ['Reading a hard page'], caseReasons: { 'Reading a hard page': 'Sustained and deliberate.' } };
  assert.deepEqual(conceptBoundaryMarks(concept), []);
  assert.equal(conceptBoundaryFindings(concept).length, 1);
});

test('the two views agree on the cases they both cover', () => {
  const concept = {
    examples: [], notSameAs: ['Narrative Self'],
    counterexamples: ['A role dropped at home'], edgeCases: ['A conversion'],
    caseReasons: { 'A role dropped at home': 'An audience maintains it.', 'A conversion': 'The practice survived.' },
  };
  const reasoned = conceptBoundaryMarks(concept).filter((mark) => mark.reason).map((mark) => mark.text).sort();
  const findings = conceptBoundaryFindings(concept).map((finding) => finding.example).sort();
  assert.deepEqual(reasoned, findings);
});
