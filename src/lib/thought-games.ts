import type { Concept, Media, PhilosophicalLink, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export type ThoughtGameKind =
  | 'statement_type'
  | 'define_it'
  | 'assumption_hunt'
  | 'confidence_calibration'
  | 'source_recall'
  | 'counterexample'
  | 'tension_test';

export interface ThoughtGame {
  id: string;
  kind: ThoughtGameKind;
  label: string;
  title: string;
  instruction: string;
  prompt: string;
  options?: string[];
  answer?: string;
  reveal: string;
  sourceLabel: string;
  target: { view: NoesisView; targetId: string };
}

interface ThoughtGameContext {
  concepts: Concept[];
  inquiries: Question[];
  positions: VaultEntry[];
  media: Media[];
  links: PhilosophicalLink[];
  dayKey?: string;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotate<T>(items: T[], seed: string) {
  if (items.length < 2) return items;
  const offset = stableHash(seed) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function distinct(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function choiceOptions(answer: string, alternatives: string[], seed: string, size = 4) {
  const distractors = rotate(distinct(alternatives).filter((item) => item !== answer), `${seed}:distractors`).slice(0, size - 1);
  return rotate([answer, ...distractors], `${seed}:options`);
}

export function buildThoughtGames({ concepts, inquiries, positions, media, links, dayKey = new Date().toISOString().slice(0, 10) }: ThoughtGameContext) {
  const games: ThoughtGame[] = [];
  const activePositions = positions.filter((position) => !['abandoned', 'rejected'].includes(position.status));
  const definedConcepts = concepts.filter((concept) => concept.name.trim() && concept.description.trim());
  const reflectedSources = media.filter((source) => (
    source.capture?.after?.coreArgument
    || source.capture?.after?.aiSummary
    || source.catalogSummary
    || source.description
  )?.trim());

  rotate(activePositions, `${dayKey}:statements`).slice(0, 2).forEach((position) => {
    games.push({
      id: `statement-type:${position.id}`,
      kind: 'statement_type',
      label: 'Statement Type',
      title: 'What kind of statement is this?',
      instruction: 'Classify the role this sentence currently plays in your workspace.',
      prompt: position.statement || position.title,
      options: rotate(['Claim', 'Evidence', 'Assumption', 'Definition'], `${dayKey}:${position.id}`),
      answer: 'Claim',
      reveal: 'This is recorded as a Position, so it currently functions as a claim you are prepared to examine and revise.',
      sourceLabel: position.title || 'Recorded position',
      target: { view: 'vault', targetId: position.id },
    });
  });

  rotate(definedConcepts, `${dayKey}:definitions`).slice(0, 2).forEach((concept) => {
    const alternatives = concepts.filter((item) => item.id !== concept.id).map((item) => item.name);
    if (alternatives.length < 2) return;
    games.push({
      id: `define-it:${concept.id}`,
      kind: 'define_it',
      label: 'Define It',
      title: 'Which concept matches this definition?',
      instruction: 'Choose the concept whose saved definition is shown below.',
      prompt: concept.description,
      options: choiceOptions(concept.name, alternatives, `${dayKey}:${concept.id}`),
      answer: concept.name,
      reveal: `This is your current definition of ${concept.name}. Open the Concept if the wording no longer fits how you use it.`,
      sourceLabel: concept.name,
      target: { view: 'concepts', targetId: concept.id },
    });
  });

  rotate(activePositions.filter((position) => position.assumptions?.some((item) => item.trim())), `${dayKey}:assumptions`).slice(0, 2).forEach((position) => {
    const assumptions = distinct(position.assumptions || []);
    games.push({
      id: `assumption-hunt:${position.id}`,
      kind: 'assumption_hunt',
      label: 'Assumption Hunt',
      title: 'What must be true for this position to hold?',
      instruction: 'Name the premise doing the most hidden work, then compare it with what you previously recorded.',
      prompt: position.statement || position.title,
      reveal: `Recorded assumption${assumptions.length === 1 ? '' : 's'}: ${assumptions.join(' • ')}`,
      sourceLabel: position.title || 'Recorded position',
      target: { view: 'vault', targetId: position.id },
    });
  });

  rotate(activePositions, `${dayKey}:confidence`).slice(0, 2).forEach((position) => {
    const supporting = (position.evidenceFor?.length || 0) + (position.sourceIds?.length || 0);
    const challenging = position.evidenceAgainst?.length || 0;
    const assumptions = position.assumptions?.length || 0;
    games.push({
      id: `confidence:${position.id}`,
      kind: 'confidence_calibration',
      label: 'Confidence Calibration',
      title: 'Does the recorded confidence fit the recorded support?',
      instruction: 'Make a judgment before seeing the evidence count. Your choice will not change the Position.',
      prompt: `${position.statement || position.title} — ${Math.round(position.confidence)}% confidence`,
      options: ['Confidence may be high', 'Confidence seems proportionate', 'Confidence may be low', 'Not enough context'],
      reveal: `${supporting} supporting reference${supporting === 1 ? '' : 's'}, ${challenging} recorded challenge${challenging === 1 ? '' : 's'}, and ${assumptions} explicit assumption${assumptions === 1 ? '' : 's'}. Counts do not settle the claim, but they make the confidence easier to inspect.`,
      sourceLabel: position.title || 'Recorded position',
      target: { view: 'vault', targetId: position.id },
    });
  });

  rotate(reflectedSources, `${dayKey}:sources`).slice(0, 2).forEach((source) => {
    const summary = source.capture?.after?.coreArgument
      || source.capture?.after?.aiSummary
      || source.catalogSummary
      || source.description
      || '';
    games.push({
      id: `source-recall:${source.id}`,
      kind: 'source_recall',
      label: 'Source Recall',
      title: 'What was the central idea?',
      instruction: 'Recall the source before revealing the summary already saved in Noesis.',
      prompt: `${source.title}${source.creator ? ` by ${source.creator}` : ''}`,
      reveal: summary,
      sourceLabel: source.title,
      target: { view: 'library', targetId: source.id },
    });
  });

  rotate(concepts.filter((concept) => concept.counterexamples?.some((item) => item.trim())), `${dayKey}:counterexamples`).slice(0, 2).forEach((concept) => {
    const counterexamples = distinct(concept.counterexamples || []);
    games.push({
      id: `counterexample:${concept.id}`,
      kind: 'counterexample',
      label: 'Counterexample',
      title: 'Where does this concept stop working?',
      instruction: 'Think of a case that exposes an overbroad boundary, then compare it with your saved examples.',
      prompt: `${concept.name}: ${concept.description}`,
      reveal: `Saved counterexample${counterexamples.length === 1 ? '' : 's'}: ${counterexamples.join(' • ')}`,
      sourceLabel: concept.name,
      target: { view: 'concepts', targetId: concept.id },
    });
  });

  const linkedPositionPairs = links.flatMap((link) => {
    const left = activePositions.find((position) => position.id === link.fromId);
    const right = activePositions.find((position) => position.id === link.toId);
    return left && right ? [{ link, left, right }] : [];
  });
  rotate(linkedPositionPairs, `${dayKey}:tensions`).slice(0, 2).forEach(({ link, left, right }) => {
    games.push({
      id: `tension:${link.id}`,
      kind: 'tension_test',
      label: 'Tension Test',
      title: 'How do these positions actually relate?',
      instruction: 'Judge the relationship before revealing the link currently recorded in Noesis.',
      prompt: `${left.statement || left.title}\n\n${right.statement || right.title}`,
      options: ['Contradict', 'Challenge', 'Refine', 'Can coexist', 'Need more context'],
      reveal: `The current recorded relationship is “${link.type.replace(/_/g, ' ')}.” That record is not automatically correct; open the Position if your judgment has changed.`,
      sourceLabel: `${left.title} / ${right.title}`,
      target: { view: 'vault', targetId: left.id },
    });
  });

  const inquiryFallback = rotate(inquiries.filter((inquiry) => !['resolved', 'archived'].includes(inquiry.status)), `${dayKey}:inquiries`)[0];
  if (!games.length && inquiryFallback) {
    games.push({
      id: `assumption-hunt:inquiry:${inquiryFallback.id}`,
      kind: 'assumption_hunt',
      label: 'Assumption Hunt',
      title: 'What is this question already assuming?',
      instruction: 'Name one premise built into the wording. Nothing is saved until you choose to work on the Inquiry.',
      prompt: inquiryFallback.text,
      reveal: inquiryFallback.assumptions?.length
        ? `You previously recorded: ${inquiryFallback.assumptions.join(' • ')}`
        : 'No assumptions are recorded yet. Open the Inquiry if this exercise uncovered one worth keeping.',
      sourceLabel: inquiryFallback.text,
      target: { view: 'questions', targetId: inquiryFallback.id },
    });
  }

  const workspaceSeed = [
    ...concepts.map((item) => item.id),
    ...positions.map((item) => item.id),
    ...media.map((item) => item.id),
  ].sort().join(':');
  return rotate(games, `${dayKey}:${workspaceSeed}`);
}

export function thoughtGameDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
