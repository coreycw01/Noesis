import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBlanks, buildChain, buildMatch, buildOdd, buildSort, seededShuffle } from '../../src/lib/exercise-games';
import type { Concept, Media, Practice, Question, VaultEntry } from '../../src/lib/types';

const concept = (id: string, name: string, description: string): Concept => ({
  id, name, description, links: [], sourceIds: [], dateCreated: '2026-01-01', x: 0, y: 0,
});
const concepts = [
  concept('c1', 'Agency', 'Agency is the felt and practiced capacity to direct action under constraints.'),
  concept('c2', 'Attention', 'Attention decides which realities become vivid enough to shape action.'),
  concept('c3', 'Discipline', 'Discipline is self-governance that becomes meaningful when tied to a valued end.'),
  concept('c4', 'Meaning', 'Meaning emerges when actions and interpretation converge into something worth sustaining.'),
];

test('a seeded shuffle is stable for a seed and keeps every item', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(seededShuffle(items, 'monday'), seededShuffle(items, 'monday'));
  assert.deepEqual([...seededShuffle(items, 'monday')].sort(), [...items].sort());
  assert.notDeepEqual(seededShuffle(items, 'monday'), seededShuffle(items, 'tuesday'));
});

test('match pairs each term with its own definition, and only defined concepts play', () => {
  const pairs = buildMatch([...concepts, concept('c5', 'Empty', '')], 'day');
  assert.equal(pairs.length, 4);
  for (const pair of pairs) {
    const source = concepts.find((item) => item.id === pair.id);
    assert.ok(source, 'every pair comes from a concept');
    assert.equal(pair.definition, source!.description);
  }
  assert.ok(!pairs.some((pair) => pair.term === 'Empty'));
});

test('fill the blanks takes words out of a real definition and offers them back', () => {
  const spec = buildBlanks(concepts, 'day');
  assert.ok(spec);
  const words = spec!.text.split(/\s+/);
  assert.equal(spec!.blanks.length, 2);
  for (const blank of spec!.blanks) {
    assert.ok(words[blank.index].includes(blank.word), 'the blank is at the word it removed');
    assert.ok(spec!.bank.includes(blank.word), 'the removed word is in the bank');
  }
  assert.ok(spec!.bank.length > spec!.blanks.length, 'the bank holds distractors too');
});

test('sort cards carry the kind of the place they came from', () => {
  const inquiries = [{ id: 'q1', text: 'Does narrative coherence help or distort agency?', status: 'open', evidenceIds: [], conceptIds: [], dateCreated: '' }] as unknown as Question[];
  const positions = [{ id: 'p1', title: 'Attention must be protected', statement: 'Attention must be protected before it can be directed.' }] as unknown as VaultEntry[];
  const practices = [{ id: 'x1', title: 'Morning walk', action: 'Walk for thirty minutes without a device.' }] as unknown as Practice[];
  const cards = buildSort(concepts, inquiries, positions, practices, 'day', 1);
  assert.equal(cards.length, 4);
  assert.deepEqual([...cards.map((card) => card.kind)].sort(), ['action', 'claim', 'definition', 'question']);
  assert.equal(cards.find((card) => card.kind === 'question')!.text, inquiries[0].text);
  assert.equal(cards.find((card) => card.kind === 'action')!.text, practices[0].action);
});

test('the argument chain ends at the claim and needs two recorded grounds', () => {
  const thin = [{ id: 'p1', title: 'Thin', statement: 'A claim', evidenceFor: ['only one ground recorded'] }] as unknown as VaultEntry[];
  assert.equal(buildChain(thin, 'day'), null);
  const full = [{ id: 'p2', title: 'Full', statement: 'Attention must be protected first.', evidenceFor: ['Morning rituals reduce drift', 'Captured notes show triggers precede distraction'] }] as unknown as VaultEntry[];
  const chain = buildChain(full, 'day');
  assert.ok(chain);
  assert.equal(chain!.steps.at(-1)!.role, 'claim');
  assert.equal(chain!.steps.filter((step) => step.role === 'ground').length, 2);
});

test('spot the objection uses the challenge the position itself recorded', () => {
  const noChallenge = [{ id: 'p0', title: 'No challenge', statement: 'A claim.', evidenceFor: ['one ground recorded here', 'another ground recorded'] }] as unknown as VaultEntry[];
  assert.equal(buildOdd(noChallenge, 'day'), null);
  const positions = [{
    id: 'p1', title: 'Ritual protects attention', statement: 'Ritual protects attention.',
    evidenceFor: ['Morning rituals reduce media-driven drift', 'Captured notes show triggers precede distraction'],
    evidenceAgainst: ['Some focus failures persist in good conditions'],
  }] as unknown as VaultEntry[];
  const spec = buildOdd(positions, 'day');
  assert.ok(spec);
  assert.equal(spec!.cards.length, 3);
  assert.equal(spec!.cards.filter((card) => card.against).length, 1);
  assert.equal(spec!.cards.find((card) => card.id === spec!.againstId)!.text, 'Some focus failures persist in good conditions');
});
