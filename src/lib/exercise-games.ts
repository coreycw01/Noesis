import type { Concept, Practice, Question, VaultEntry } from '@/lib/types';

/**
 * The material for the five exercises, drawn from the person's own records.
 * Nothing is invented: a concept's definition is the definition, a position's
 * statement is a claim, an inquiry is a question, a practice action is an
 * action. The games test whether you can still tell them apart and put them
 * back together.
 */

/** A stable shuffle, so a day's round is the same until the day changes. */
export function seededShuffle<T>(items: T[], seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  const out = [...items];
  for (let index = out.length - 1; index > 0; index--) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const swap = hash % (index + 1);
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

export interface MatchPair { id: string; term: string; definition: string }

/** Match the term: concepts you have defined, against their definitions. */
export function buildMatch(concepts: Concept[], seed: string, size = 4): MatchPair[] {
  const usable = concepts.filter((concept) => concept.name.trim() && (concept.description || '').trim().length > 20);
  return seededShuffle(usable, `match:${seed}`).slice(0, size).map((concept) => ({
    id: concept.id,
    term: concept.name,
    definition: concept.description.trim(),
  }));
}

export interface BlankSpec { id: string; text: string; blanks: Array<{ index: number; word: string }>; bank: string[]; source: string }

const SMALL_WORDS = new Set(['the', 'and', 'that', 'with', 'from', 'into', 'this', 'than', 'then', 'when', 'what', 'they', 'them', 'their', 'your', 'you', 'for', 'are', 'was', 'not', 'but', 'its', 'it', 'is', 'of', 'to', 'a', 'an', 'in', 'on', 'by', 'or', 'as', 'at', 'be', 'can', 'has', 'have']);

/** Fill the blanks: your own definition, with two of its load-bearing words taken out. */
export function buildBlanks(concepts: Concept[], seed: string): BlankSpec | null {
  const usable = concepts.filter((concept) => (concept.description || '').trim().split(/\s+/).length >= 8);
  const concept = seededShuffle(usable, `blanks:${seed}`)[0];
  if (!concept) return null;
  const words = concept.description.trim().split(/\s+/);
  const candidates = words
    .map((word, index) => ({ word: word.replace(/[^A-Za-z-]/g, ''), index }))
    .filter(({ word }) => word.length > 4 && !SMALL_WORDS.has(word.toLowerCase()));
  const chosen = seededShuffle(candidates, `pick:${seed}:${concept.id}`).slice(0, 2).sort((a, b) => a.index - b.index);
  if (chosen.length < 2) return null;
  const distractors = seededShuffle(
    concepts.flatMap((other) => (other.id === concept.id ? [] : (other.description || '').split(/\s+/)))
      .map((word) => word.replace(/[^A-Za-z-]/g, ''))
      .filter((word) => word.length > 4 && !SMALL_WORDS.has(word.toLowerCase())),
    `bank:${seed}`,
  ).slice(0, 2);
  return {
    id: concept.id,
    text: concept.description.trim(),
    blanks: chosen.map(({ word, index }) => ({ index, word })),
    bank: seededShuffle([...chosen.map((item) => item.word), ...distractors], `shuffle:${seed}`),
    source: concept.name,
  };
}

export type StatementKind = 'claim' | 'question' | 'definition' | 'action';
export interface SortCard { id: string; text: string; kind: StatementKind; from: string }

export const SORT_BINS: Array<{ kind: StatementKind; label: string; hint: string; tone: 'position' | 'inquiry' | 'concept' | 'practice' }> = [
  { kind: 'claim', label: 'A claim', hint: 'Something you hold', tone: 'position' },
  { kind: 'question', label: 'A question', hint: 'Something open', tone: 'inquiry' },
  { kind: 'definition', label: 'A definition', hint: 'What a word means', tone: 'concept' },
  { kind: 'action', label: 'An action', hint: 'Something you do', tone: 'practice' },
];

/**
 * Sort by kind. Each card came from a place in the workspace that already
 * knows its kind, so the answer is recorded, not guessed.
 */
export function buildSort(concepts: Concept[], inquiries: Question[], positions: VaultEntry[], practices: Practice[], seed: string, perKind = 2): SortCard[] {
  const take = <T>(items: T[], kind: StatementKind, text: (item: T) => string, from: string, id: (item: T) => string) =>
    seededShuffle(items.filter((item) => text(item).trim().length > 12), `${kind}:${seed}`).slice(0, perKind)
      .map((item) => ({ id: `${kind}:${id(item)}`, text: text(item).trim(), kind, from }));
  const cards = [
    ...take(positions, 'claim', (item) => item.statement || item.title, 'Positions', (item) => item.id),
    ...take(inquiries, 'question', (item) => item.text, 'Inquiries', (item) => item.id),
    ...take(concepts, 'definition', (item) => item.description, 'Concepts', (item) => item.id),
    ...take(practices, 'action', (item) => item.action || item.title, 'Praxis', (item) => item.id),
  ];
  return seededShuffle(cards, `sort:${seed}`);
}

export interface ChainStep { id: string; text: string; role: 'ground' | 'claim' }
export interface ChainSpec { id: string; title: string; steps: ChainStep[]; from: string }

/** Build the argument: a position's grounds, then the claim they lead to. */
export function buildChain(positions: VaultEntry[], seed: string): ChainSpec | null {
  const usable = positions.filter((position) => (position.evidenceFor || []).filter((item) => item.trim().length > 12).length >= 2);
  const position = seededShuffle(usable, `chain:${seed}`)[0];
  if (!position) return null;
  const grounds = (position.evidenceFor || []).filter((item) => item.trim().length > 12).slice(0, 3);
  return {
    id: position.id,
    title: position.title,
    from: 'Positions',
    steps: [
      ...grounds.map((text, index) => ({ id: `g${index}`, text: text.trim(), role: 'ground' as const })),
      { id: 'claim', text: position.statement || position.title, role: 'claim' as const },
    ],
  };
}

export interface OddSpec { id: string; claim: string; cards: Array<{ id: string; text: string; against: boolean }>; againstId: string; from: string }

/**
 * Spot the objection. A position records what supports it and what pushes
 * against it, so the answer is in the record: among these statements, one is
 * the one you yourself filed as a challenge.
 */
export function buildOdd(positions: VaultEntry[], seed: string): OddSpec | null {
  const usable = positions.filter((position) =>
    (position.evidenceFor || []).filter((item) => item.trim().length > 12).length >= 2 &&
    (position.evidenceAgainst || []).some((item) => item.trim().length > 12));
  const position = seededShuffle(usable, `odd:${seed}`)[0];
  if (!position) return null;
  const against = seededShuffle((position.evidenceAgainst || []).filter((item) => item.trim().length > 12), `a:${seed}`)[0];
  const supports = (position.evidenceFor || []).filter((item) => item.trim().length > 12).slice(0, 3);
  const cards = seededShuffle([
    ...supports.map((text, index) => ({ id: `s${index}`, text: text.trim(), against: false })),
    { id: 'against', text: against.trim(), against: true },
  ], `cards:${seed}`);
  return { id: position.id, claim: position.statement || position.title, cards, againstId: 'against', from: 'Positions' };
}
