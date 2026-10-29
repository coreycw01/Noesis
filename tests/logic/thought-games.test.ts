import assert from 'node:assert/strict';
import test from 'node:test';
import { buildThoughtGames } from '../../src/lib/thought-games';
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
    assert.ok(game.target.targetId);
    assert.ok(game.target.view);
    assert.equal('mutation' in game, false);
  });
});
