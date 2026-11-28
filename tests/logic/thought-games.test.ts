import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDefinitionRound, buildInquiryExercise, buildThoughtGames, THOUGHT_GAME_TYPES, THOUGHT_GAME_KIND_LABELS, thoughtGameFamily } from '../../src/lib/thought-games';
import type { Concept, Media, VaultEntry } from '../../src/lib/types';

const concept = (id: string, name: string, description: string): Concept => ({
  id,
  name,
  description,
  links: [],
  sourceIds: [],
  dateCreated: '2026-01-01',
  x: 0,
  y: 0,
});

const position = (id: string, title: string, statement: string): VaultEntry => ({
  id,
  title,
  statement,
  description: statement,
  type: 'belief',
  confidence: 82,
  status: 'active',
  assumptions: ['Agency requires meaningful alternatives.'],
  tags: [],
  sourceIds: [],
  evidenceFor: [],
  evidenceAgainst: [],
  dateCreated: '2026-01-01',
  dateUpdated: '2026-01-02',
});

const source: Media = {
  id: 'source-1',
  title: 'Meditations',
  creator: 'Marcus Aurelius',
  type: 'book',
  status: 'Finished',
  tags: [],
  annotations: [],
  capture: { sessions: [], after: { coreArgument: 'Judgment shapes the experience of events.' } },
  dateAdded: '2026-01-01',
};

test('builds stable daily exercises from the user workspace', () => {
  const input = {
    dayKey: '2026-10-29',
    concepts: [
      concept('agency', 'Agency', 'The capacity to initiate and direct action.'),
      concept('identity', 'Identity', 'The pattern through which a person recognizes a self.'),
      concept('discipline', 'Discipline', 'Sustained action under a chosen standard.'),
    ],
    inquiries: [],
    positions: [position('position-1', 'Agency matters', 'People remain responsible when meaningful alternatives exist.')],
    media: [source],
    links: [],
  };

  const first = buildThoughtGames(input);
  const second = buildThoughtGames(input);
  assert.deepEqual(first, second);
  assert.ok(first.some((game) => game.kind === 'define_it'));
  assert.ok(first.some((game) => game.kind === 'statement_type'));
  assert.ok(first.some((game) => game.kind === 'source_recall'));
  first.filter((game) => game.answer && game.options).forEach((game) => {
    assert.ok(game.options?.includes(game.answer || ''), `${game.id} must retain its recorded answer`);
  });
});

test('keeps every exercise tied to a real item and never emits a mutation', () => {
  const games = buildThoughtGames({
    dayKey: '2026-10-29',
    concepts: [
      concept('agency', 'Agency', 'The capacity to initiate and direct action.'),
      concept('identity', 'Identity', 'The pattern through which a person recognizes a self.'),
      concept('discipline', 'Discipline', 'Sustained action under a chosen standard.'),
    ],
    inquiries: [],
    positions: [position('position-1', 'Agency matters', 'People remain responsible when meaningful alternatives exist.')],
    media: [source],
    links: [],
  });

  assert.ok(games.length >= 4);
  games.forEach((game) => {
    if (thoughtGameFamily(game.kind) === 'records') assert.ok(game.target.targetId, game.id);
    assert.ok(game.target.view);
    assert.equal('mutation' in game, false);
  });
});

test('new exercise kinds come only from what the user recorded', () => {
  const games = buildThoughtGames({
    concepts: [
      { id: 'c1', name: 'Courage', description: 'Acting well despite fear', examples: ['Speaking up in a meeting'], counterexamples: ['Reckless driving'], notSameAs: ['Recklessness'], links: [], sourceIds: [], dateCreated: '2026-01-01', x: 0, y: 0 },
    ] as never,
    inquiries: [{ id: 'q1', text: 'Why do I avoid conflict?', status: 'open', assumptions: [] }] as never,
    positions: [{ id: 'p1', title: 'Honesty first', statement: 'Honesty matters more than comfort', status: 'active', confidence: 70, evidenceAgainst: ['Kindness sometimes requires restraint'] }] as never,
    media: [
      { id: 's1', title: 'Book One', creator: 'A', annotations: [{ id: 'a1', type: 'highlight', text: 'The obstacle in the path becomes the path itself.', date: '2026-01-01' }] },
      { id: 's2', title: 'Book Two', annotations: [] },
      { id: 's3', title: 'Book Three', annotations: [] },
    ] as never,
    links: [],
    dayKey: '2026-02-02',
  });
  const kinds = new Set(games.map((game) => game.kind));
  for (const kind of ['steelman', 'boundary_sort', 'whose_words', 'question_assumption', 'not_same_as']) assert.ok(kinds.has(kind as never), kind);
  const whose = games.find((game) => game.kind === 'whose_words')!;
  assert.equal(whose.answer, 'Book One');
  assert.ok(whose.options!.includes('Book One'));
  const boundary = games.find((game) => game.kind === 'boundary_sort')!;
  assert.ok(['Speaking up in a meeting', 'Reckless driving'].includes(boundary.prompt));
});

test('the general-knowledge deck works from an empty workspace, one card per kind', () => {
  const games = buildThoughtGames({ dayKey: '2026-10-29', concepts: [], inquiries: [], positions: [], media: [], links: [] });
  const kinds = games.map((game) => game.kind).sort();
  assert.deepEqual(kinds, ['bias_check', 'fallacy_spotter', 'thought_experiment', 'valid_or_not', 'who_argued_it']);
  games.forEach((game) => { if (game.options) assert.ok(game.answer && game.options.includes(game.answer), game.id); });
});

test('five exercise types each contain distinct round kinds', () => {
  const types = Object.values(THOUGHT_GAME_TYPES);
  const kinds = types.flatMap(type => type.kinds);
  assert.equal(types.length, 5);
  assert.deepEqual(kinds.sort(), Object.keys(THOUGHT_GAME_KIND_LABELS).sort());
});

test('definition rounds only ask about concepts from the selected region', () => {
  const concepts = [
    concept('courage', 'Courage', 'Acting well despite fear.'),
    concept('identity', 'Identity', 'The pattern through which a person recognizes a self.'),
    concept('empty', 'Unwritten', ''),
  ];
  const round = buildDefinitionRound(concepts, '2026-10-29', new Set(['courage', 'empty']));
  assert.deepEqual(round.map(card => card.target.targetId), ['courage']);
  assert.deepEqual(buildDefinitionRound(concepts, '2026-10-29', new Set(['empty'])), []);
  assert.equal(round[0].answer, 'Courage');
});

test('a specifically chosen inquiry works outside the daily sample', () => {
  const chosen = { id: 'specific', text: 'What is a good reason to change a commitment?', assumptions: ['Commitments can be revised.'] } as Parameters<typeof buildInquiryExercise>[0];
  const card = buildInquiryExercise(chosen);
  assert.deepEqual(card.target, { view: 'questions', targetId: 'specific' });
  assert.equal(card.prompt, chosen.text);
  assert.deepEqual(card.savedNotes, ['Commitments can be revised.']);
  assert.equal(card.answer, undefined);
});

test('inquiry practice offers a worked example even without saved assumptions', () => {
  const inquiry = { id: 'open', text: 'When is a promise worth keeping?', assumptions: [' '] } as Parameters<typeof buildInquiryExercise>[0];
  const card = buildInquiryExercise(inquiry);
  assert.match(card.instruction, /already feels open/);
  assert.match(card.reveal, /avoids? conflict|avoid it/);
  assert.deepEqual(card.savedNotes, []);
  assert.equal(card.answer, undefined);
});

test('calibration shows saved arguments without counting source links as support', () => {
  const [card] = buildThoughtGames({
    concepts: [], inquiries: [], media: [], links: [], dayKey: '2026-10-29',
    positions: [{ id: 'p1', title: 'A claim', confidence: 80, sourceIds: ['s1'], evidenceAgainst: ['One exception'] }] as never,
  }).filter(game => game.kind === 'confidence_calibration');
  assert.match(card.reveal, /Recorded challenge: One exception/);
  assert.doesNotMatch(card.reveal, /support/i);
  assert.equal(card.answer, undefined);
});
