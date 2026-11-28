import assert from 'node:assert/strict';
import test from 'node:test';
import { distinctPositionStatement, evidenceBalance, positionReviewCue, resolvePositionGrounds } from '../../src/lib/position-grounds';
import type { PhilosophicalLink } from '../../src/lib/types';

const link = (id: string, fields: Partial<PhilosophicalLink> = {}): PhilosophicalLink => ({
  id, fromType: 'annotation', fromId: id, toType: 'position', toId: 'claim', type: 'supports',
  createdFrom: 'manual', note: 'The passage illustrates the claim.', dateCreated: '', dateUpdated: '', ...fields,
});

test('the balance counts written grounds and inward, reasoned links once', () => {
  const result = resolvePositionGrounds({ id: 'claim', evidenceFor: [' Field notes ', 'field notes', ' '], evidenceAgainst: ['One counterexample'] }, [
    link('passage'), link('same-passage', { fromId: 'passage', type: 'strengthens' }),
    link('copied-note', { note: 'field notes' }),
    link('objection', { type: 'challenges', note: 'It fails under a different condition.' }),
    link('review', { type: 'challenges', fromType: 'position', note: 'This reverses the direction of influence.', fromId: 'claim', toId: 'another' }),
    link('tested', { type: 'tested_by' }), link('expressed', { type: 'expressed_in' }),
    link('manual-reference', { type: 'references', createdFrom: 'manual', acceptedByUser: true, note: 'Relevant context, not weighed evidence.' }),
    link('source', { fromType: 'source', note: '' }),
    link('suggested', { createdFrom: 'suggestion', note: 'Not yet user accepted.' }),
  ]);
  assert.equal(result.supportCount, 2);
  assert.equal(result.challengeCount, 2);
  assert.deepEqual(result.linked.for.map(row => row.id), ['passage']);
  assert.deepEqual(result.linked.against.map(row => row.id), ['objection']);
  assert.equal(evidenceBalance(result.supportCount, result.challengeCount), 50);
});

test('missing and one-sided evidence do not produce a calibration warning', () => {
  assert.equal(evidenceBalance(0, 0), null);
  assert.equal(positionReviewCue(80, 0, 0), 'Add evidence');
  assert.equal(positionReviewCue(60, 1, 0), 'Consider a counterargument');
  assert.equal(positionReviewCue(70, 3, 1), '');
  assert.equal(positionReviewCue(63, 7, 2), 'Review confidence: 15 points below evidence balance');
});

test('the card keeps a useful statement without repeating its title', () => {
  assert.equal(distinctPositionStatement('Focus takes practice', 'focus  takes practice.'), '');
  assert.equal(distinctPositionStatement('Focus', 'Focus takes practice.'), 'Focus takes practice.');
});
