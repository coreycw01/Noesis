import type { Concept, Media, PhilosophicalLink, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export type ThoughtGameKind =
  | 'statement_type'
  | 'define_it'
  | 'assumption_hunt'
  | 'confidence_calibration'
  | 'source_recall'
  | 'counterexample'
  | 'tension_test'
  | 'steelman'
  | 'boundary_sort'
  | 'whose_words'
  | 'question_assumption'
  | 'not_same_as'
  | 'odd_one_out'
  | 'bridge'
  | 'why_chain'
  | 'fallacy_spotter'
  | 'who_argued_it'
  | 'valid_or_not'
  | 'bias_check'
  | 'thought_experiment';

/** The two decks on the Exercises table. */
export type ThoughtGameFamily = 'records' | 'general';
export const THOUGHT_GAME_FAMILY_LABELS: Record<ThoughtGameFamily, string> = {
  records: 'From your records',
  general: 'General knowledge',
};
const GENERAL_KINDS: ThoughtGameKind[] = ['fallacy_spotter', 'who_argued_it', 'valid_or_not', 'bias_check', 'thought_experiment'];
export function thoughtGameFamily(kind: ThoughtGameKind): ThoughtGameFamily {
  return GENERAL_KINDS.includes(kind) ? 'general' : 'records';
}

/** Plain names for each exercise kind, in the order they are offered. */
export const THOUGHT_GAME_KIND_LABELS: Record<ThoughtGameKind, string> = {
  statement_type: 'Statement Type',
  define_it: 'Define It',
  assumption_hunt: 'Assumption Hunt',
  confidence_calibration: 'Confidence Calibration',
  source_recall: 'Source Recall',
  counterexample: 'Counterexample',
  tension_test: 'Tension Test',
  steelman: 'Steelman',
  boundary_sort: 'Boundary Sort',
  whose_words: 'Whose Words?',
  question_assumption: 'Question the Question',
  not_same_as: 'Not the Same As',
  odd_one_out: 'Odd One Out',
  bridge: 'Bridge',
  why_chain: 'Why Chain',
  fallacy_spotter: 'Fallacy Spotter',
  who_argued_it: 'Who Argued It',
  valid_or_not: 'Valid or Not',
  bias_check: 'Bias Check',
  thought_experiment: 'Thought Experiment',
};

export const THOUGHT_GAME_TYPES = {
  inquiry: { label: 'Question the Question', hint: 'Rewrite an inquiry so it leaves more than one possibility open.', kinds: ['question_assumption'] },
  definition: { label: 'Define It', hint: 'Recall definitions and test their boundaries.', kinds: ['define_it', 'boundary_sort', 'counterexample', 'not_same_as', 'odd_one_out', 'bridge'] },
  position: { label: 'Test a Position', hint: 'Examine the evidence and assumptions behind a view.', kinds: ['confidence_calibration', 'assumption_hunt', 'steelman', 'tension_test', 'why_chain'] },
  source: { label: 'Source Detective', hint: 'Recall what a source said and where an idea came from.', kinds: ['source_recall', 'whose_words', 'who_argued_it'] },
  reasoning: { label: 'Reasoning Lab', hint: 'Try a logic puzzle or explore a thought experiment.', kinds: ['valid_or_not', 'fallacy_spotter', 'bias_check', 'statement_type', 'thought_experiment'] },
} satisfies Record<string, { label: string; hint: string; kinds: ThoughtGameKind[] }>;

export type ThoughtGameType = keyof typeof THOUGHT_GAME_TYPES;

/** One line under each game's name on its card. */
export const THOUGHT_GAME_KIND_HINTS: Record<ThoughtGameKind, string> = {
  statement_type: 'Claim, evidence, assumption or definition?',
  define_it: 'Match the definition to the concept.',
  assumption_hunt: 'Find the premise doing hidden work.',
  confidence_calibration: 'Bet your confidence, then see your evidence.',
  source_recall: 'Which source said this?',
  counterexample: 'Find the case that breaks it.',
  tension_test: 'Two of your records pull apart.',
  steelman: 'Best case against your own position.',
  boundary_sort: 'Inside the concept or outside it?',
  whose_words: 'Your words or a source\u2019s?',
  question_assumption: 'Spot what the wording takes for granted.',
  not_same_as: 'Name the neighbour and the difference.',
  odd_one_out: 'Which concept doesn\u2019t belong?',
  bridge: 'Connect two distant concepts.',
  why_chain: 'Ask why three times.',
  fallacy_spotter: 'Name the reasoning error.',
  who_argued_it: 'Match the idea to the thinker.',
  valid_or_not: 'Does the conclusion follow?',
  bias_check: 'Which bias is at work?',
  thought_experiment: 'Take a side on a classic puzzle.',
};

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
  savedNotes?: string[];
  sourceLabel: string;
  /** The record this exercise is about. An empty targetId opens the page itself. */
  target: { view: NoesisView; targetId: string };
}

type GeneralCard = { kind: ThoughtGameKind; title: string; prompt: string; options?: string[]; answer?: string; reveal: string; then: NoesisView };

/** The general-knowledge deck: reasoning, fallacies, thinkers and classic puzzles. */
const GENERAL_DECK: GeneralCard[] = [
  { kind: 'fallacy_spotter', title: 'Name the reasoning error.', prompt: '\u201cEvery successful writer I know writes in the morning, so writing in the morning makes you successful.\u201d', options: ['Ad hominem', 'Survivorship bias / correlation taken as cause', 'Straw man', 'Slippery slope'], answer: 'Survivorship bias / correlation taken as cause', reveal: 'You only see the writers who succeeded, and morning writing could travel with something else that matters.', then: 'questions' },
  { kind: 'fallacy_spotter', title: 'Name the reasoning error.', prompt: '\u201cYou can\u2019t trust her view on discipline; she missed her own deadline last week.\u201d', options: ['Ad hominem (tu quoque)', 'False dilemma', 'Appeal to nature', 'Begging the question'], answer: 'Ad hominem (tu quoque)', reveal: 'Whether she keeps deadlines says nothing about whether her argument holds.', then: 'vault' },
  { kind: 'fallacy_spotter', title: 'Name the reasoning error.', prompt: '\u201cEither you commit fully or you don\u2019t really care.\u201d', options: ['Straw man', 'False dilemma', 'Equivocation', 'Red herring'], answer: 'False dilemma', reveal: 'Partial, provisional and experimental commitment all sit between those two options.', then: 'vault' },
  { kind: 'fallacy_spotter', title: 'Name the reasoning error.', prompt: '\u201cIf I skip one practice day, I\u2019ll skip them all, and then I\u2019ll have no discipline at all.\u201d', options: ['Slippery slope', 'Hasty generalisation', 'Appeal to authority', 'Circular reasoning'], answer: 'Slippery slope', reveal: 'Each step is assumed to follow inevitably. Your Praxis record is the evidence to test it against.', then: 'labs' },
  { kind: 'who_argued_it', title: 'Who argued this?', prompt: '\u201cMan is condemned to be free.\u201d', options: ['Aristotle', 'Jean-Paul Sartre', 'David Hume', 'Immanuel Kant'], answer: 'Jean-Paul Sartre', reveal: 'Sartre, in Existentialism Is a Humanism: once we exist, we are responsible for everything we do.', then: 'vault' },
  { kind: 'who_argued_it', title: 'Who argued this?', prompt: '\u201cWe are what we repeatedly do.\u201d (as the idea is usually summarised)', options: ['Aristotle', 'Epictetus', 'Friedrich Nietzsche', 'John Locke'], answer: 'Aristotle', reveal: 'The line is Will Durant\u2019s summary of Aristotle\u2019s view that virtue is formed by habit (Nicomachean Ethics, Book II).', then: 'labs' },
  { kind: 'who_argued_it', title: 'Who argued this?', prompt: '\u201cReason is, and ought only to be, the slave of the passions.\u201d', options: ['Ren\u00e9 Descartes', 'David Hume', 'Baruch Spinoza', 'Plato'], answer: 'David Hume', reveal: 'Hume, A Treatise of Human Nature: reason can direct us toward ends, but desire sets them.', then: 'concepts' },
  { kind: 'who_argued_it', title: 'Who argued this?', prompt: '\u201cSome things are within our power, while others are not.\u201d', options: ['Epictetus', 'Seneca the Younger', 'Kierkegaard', 'Confucius'], answer: 'Epictetus', reveal: 'The opening of Epictetus\u2019 Enchiridion: the Stoic division between what is up to us and what is not.', then: 'concepts' },
  { kind: 'valid_or_not', title: 'Does the conclusion follow?', prompt: 'All commitments require effort. Writing daily requires effort. So writing daily is a commitment.', options: ['Valid', 'Invalid: undistributed middle'], answer: 'Invalid: undistributed middle', reveal: 'Plenty of things need effort without being commitments. Sharing a property does not make two things the same kind.', then: 'concepts' },
  { kind: 'valid_or_not', title: 'Does the conclusion follow?', prompt: 'If I practise daily, I improve. I improved. So I practised daily.', options: ['Valid', 'Invalid: affirming the consequent'], answer: 'Invalid: affirming the consequent', reveal: 'Improvement could have another cause. Only the reverse inference (no improvement, so no daily practice) is valid.', then: 'labs' },
  { kind: 'valid_or_not', title: 'Does the conclusion follow?', prompt: 'If attention is trained by tools, then changing tools changes attention. Attention is trained by tools. So changing tools changes attention.', options: ['Valid (modus ponens)', 'Invalid'], answer: 'Valid (modus ponens)', reveal: 'The form is valid. Whether it is sound depends on the first premise, which is where your evidence belongs.', then: 'vault' },
  { kind: 'bias_check', title: 'Which bias is at work?', prompt: 'You notice every article saying phones ruin attention, and skim past the ones that don\u2019t.', options: ['Anchoring', 'Confirmation bias', 'Sunk cost', 'Dunning\u2013Kruger'], answer: 'Confirmation bias', reveal: 'Seeking what agrees with you is the quiet way confidence outruns evidence. The calibration gauge on a position shows that gap.', then: 'vault' },
  { kind: 'bias_check', title: 'Which bias is at work?', prompt: 'You keep a practice you no longer believe in because you have already done it for 90 days.', options: ['Sunk cost', 'Availability', 'Halo effect', 'Hindsight bias'], answer: 'Sunk cost', reveal: 'The 90 days are spent either way. The question is whether the next day is worth it.', then: 'labs' },
  { kind: 'bias_check', title: 'Which bias is at work?', prompt: 'After a position turns out wrong, you feel you \u201cknew it all along\u201d.', options: ['Hindsight bias', 'Optimism bias', 'Framing effect', 'Status quo bias'], answer: 'Hindsight bias', reveal: 'Your Evolution history records what you actually believed at the time, which is the cure for this one.', then: 'evolution' },
  { kind: 'thought_experiment', title: 'Ship of Theseus', prompt: 'Every plank of a ship is replaced over the years. Is it the same ship? Are you the same person who held your positions a year ago?', reveal: 'Your Evolution page is one answer: identity through change is what a version history records.', then: 'evolution' },
  { kind: 'thought_experiment', title: 'The experience machine', prompt: 'A machine could give you any experience you want, indistinguishable from reality, for life. Would you plug in? What does your answer say about what you value?', reveal: 'Nozick used this to argue we value doing and being, not only feeling. If your answer surprised you, it may belong in a position.', then: 'vault' },
  { kind: 'thought_experiment', title: 'The veil of ignorance', prompt: 'Design the rules of a society without knowing who you will be in it. What rule would you insist on first?', reveal: 'Rawls\u2019 device for fairness. The rule you reached for first often shows a value you have not yet stated.', then: 'vault' },
];

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

export function buildInquiryExercise(inquiry: Question): ThoughtGame {
  return {
    id: `question-assumption:${inquiry.id}`,
    kind: 'question_assumption',
    label: 'Question the Question',
    title: 'Does this question take anything for granted?',
    instruction: 'Pick one word or phrase that points toward an answer. Rewrite the question to leave that possibility open. If the wording already feels open, say why.',
    prompt: inquiry.text,
    reveal: 'For example, "Why do I avoid conflict?" takes for granted that I avoid it. "When do I avoid conflict, and when do I face it?" leaves both possibilities open. Check whether your rewrite lets different answers be true.',
    savedNotes: distinct(inquiry.assumptions || []),
    sourceLabel: inquiry.text,
    target: { view: 'questions', targetId: inquiry.id },
  };
}

function buildDefinitionCard(concept: Concept, concepts: Concept[], dayKey: string): ThoughtGame {
  const alternatives = distinct(concepts.filter(item => item.id !== concept.id).map(item => item.name)).filter(name => name !== concept.name);
  return {
    id: `define-it:${concept.id}`,
    kind: 'define_it',
    label: 'Define It',
    title: 'Which concept matches this definition?',
    instruction: alternatives.length > 0 ? 'Choose the concept whose saved definition is shown below.' : 'Recall the concept name before turning the card.',
    prompt: concept.description,
    options: alternatives.length ? choiceOptions(concept.name, alternatives, `${dayKey}:${concept.id}`) : undefined,
    answer: alternatives.length ? concept.name : undefined,
    reveal: `This is your current definition of ${concept.name}. Open the concept if the wording no longer fits how you use it.`,
    sourceLabel: concept.name,
    target: { view: 'concepts', targetId: concept.id },
  };
}

export function buildDefinitionRound(concepts: Concept[], dayKey: string, regionMembers?: ReadonlySet<string>) {
  const eligible = concepts.filter(concept => concept.name.trim() && concept.description.trim() && (!regionMembers || regionMembers.has(concept.id)));
  return rotate(eligible, `${dayKey}:definitions`).slice(0, 5).map(concept => buildDefinitionCard(concept, concepts, dayKey));
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

  games.push(...buildDefinitionRound(definedConcepts, dayKey).slice(0, 2));

  rotate(activePositions.filter((position) => position.assumptions?.some((item) => item.trim())), `${dayKey}:assumptions`).slice(0, 2).forEach((position) => {
    const assumptions = distinct(position.assumptions || []);
    games.push({
      id: `assumption-hunt:${position.id}`,
      kind: 'assumption_hunt',
      label: 'Assumption Hunt',
      title: 'What must be true for this position to hold?',
      instruction: 'Finish this sentence with one idea: "This claim depends on ___ being true." Then compare it with your saved assumptions.',
      prompt: position.statement || position.title,
      reveal: `Recorded assumption${assumptions.length === 1 ? '' : 's'}: ${assumptions.join(' • ')}`,
      sourceLabel: position.title || 'Recorded position',
      target: { view: 'vault', targetId: position.id },
    });
  });

  rotate(activePositions, `${dayKey}:confidence`).slice(0, 2).forEach((position) => {
    const supporting = distinct(position.evidenceFor || []);
    const challenging = distinct(position.evidenceAgainst || []);
    games.push({
      id: `confidence:${position.id}`,
      kind: 'confidence_calibration',
      label: 'Confidence Calibration',
      title: 'How sure would you be of this claim?',
      instruction: 'Compare your first impression with the saved confidence. Then look at one reason for and one reason against, where available.',
      prompt: `${position.statement || position.title} — ${Math.round(position.confidence)}% confidence`,
      options: ['Confidence may be high', 'Confidence seems proportionate', 'Confidence may be low', 'Not enough context'],
      reveal: [
        supporting[0] && `Recorded support: ${supporting[0]}`,
        challenging[0] && `Recorded challenge: ${challenging[0]}`,
        supporting.length || challenging.length
          ? 'Does what you read change your first impression? What would you check next?'
          : 'There are no saved reasons for or against this claim. What is one observation that would change how sure you are?',
      ].filter(Boolean).join('\n'),
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

  rotate(activePositions.filter((position) => position.evidenceAgainst?.some((item) => item.trim())), `${dayKey}:steelman`).slice(0, 2).forEach((position) => {
    const against = distinct(position.evidenceAgainst || []);
    games.push({
      id: `steelman:${position.id}`,
      kind: 'steelman',
      label: 'Steelman',
      title: 'State the strongest case against your own position.',
      instruction: 'Argue it as its best defender would, then compare it with the objections you have recorded.',
      prompt: position.statement || position.title,
      reveal: `Recorded objection${against.length === 1 ? '' : 's'}: ${against.join(' • ')}. If yours was stronger, add it to the Position.`,
      sourceLabel: position.title || 'Recorded position',
      target: { view: 'vault', targetId: position.id },
    });
  });

  rotate(concepts.filter((concept) => (concept.examples || []).some((item) => item.trim()) && (concept.counterexamples || []).some((item) => item.trim())), `${dayKey}:boundary`).slice(0, 2).forEach((concept) => {
    const inside = rotate(distinct(concept.examples || []), `${dayKey}:${concept.id}:in`)[0];
    const outside = rotate(distinct(concept.counterexamples || []), `${dayKey}:${concept.id}:out`)[0];
    const pickInside = stableHash(`${dayKey}:${concept.id}:side`) % 2 === 0;
    games.push({
      id: `boundary:${concept.id}`,
      kind: 'boundary_sort',
      label: 'Boundary Sort',
      title: `Is this inside or outside “${concept.name}”?`,
      instruction: 'Sort the case using your own definition, then see where you filed it before.',
      prompt: pickInside ? inside : outside,
      options: ['Inside the concept', 'Outside the concept', 'On the boundary'],
      answer: pickInside ? 'Inside the concept' : 'Outside the concept',
      reveal: `You recorded this as ${pickInside ? 'an example' : 'a counterexample'} of ${concept.name}. If you hesitated, the boundary may need sharpening.`,
      sourceLabel: concept.name,
      target: { view: 'concepts', targetId: concept.id },
    });
  });

  const quoted = media.flatMap((source) => (source.annotations || [])
    .filter((note) => note.text.trim().length > 30 && ['highlight', 'excerpt'].includes(note.type))
    .map((note) => ({ note, source })));
  rotate(quoted, `${dayKey}:quotes`).slice(0, 2).forEach(({ note, source }) => {
    const alternatives = media.filter((item) => item.id !== source.id).map((item) => item.title);
    if (alternatives.length < 2) return;
    games.push({
      id: `whose-words:${note.id}`,
      kind: 'whose_words',
      label: 'Whose Words?',
      title: 'Which source did you capture this from?',
      instruction: 'Remembering where an idea came from is part of owning it.',
      prompt: note.text,
      options: choiceOptions(source.title, alternatives, `${dayKey}:${note.id}`),
      answer: source.title,
      reveal: `You captured this from ${source.title}${source.creator ? ` by ${source.creator}` : ''}.`,
      sourceLabel: source.title,
      target: { view: 'library', targetId: source.id },
    });
  });

  rotate(inquiries.filter((inquiry) => !['resolved', 'archived', 'abandoned'].includes(inquiry.status)), `${dayKey}:question-assumptions`).slice(0, 2).forEach((inquiry) => {
    games.push(buildInquiryExercise(inquiry));
  });

  rotate(concepts.filter((concept) => (concept.notSameAs || []).some((item) => item.trim())), `${dayKey}:not-same`).slice(0, 2).forEach((concept) => {
    const distinctions = distinct(concept.notSameAs || []);
    games.push({
      id: `not-same:${concept.id}`,
      kind: 'not_same_as',
      label: 'Not the Same As',
      title: `What is “${concept.name}” easily confused with, and how do they differ?`,
      instruction: 'Name the neighbour and the difference before checking your recorded distinctions.',
      prompt: `${concept.name}: ${concept.description || 'no definition yet'}`,
      reveal: `You distinguished it from: ${distinctions.join(' • ')}.`,
      sourceLabel: concept.name,
      target: { view: 'concepts', targetId: concept.id },
    });
  });

  // Odd one out: three linked concepts and one with no link to any of them.
  const linked = (a: string, b: string) => links.some((link) => (link.fromId === a && link.toId === b) || (link.fromId === b && link.toId === a));
  for (const seed of rotate(concepts, `${dayKey}:odd`)) {
    const group = concepts.filter((item) => item.id !== seed.id && linked(seed.id, item.id)).slice(0, 2);
    if (group.length < 2) continue;
    const trio = [seed, ...group];
    const outsider = rotate(concepts.filter((item) => !trio.some((member) => member.id === item.id || linked(member.id, item.id))), `${dayKey}:odd:${seed.id}`)[0];
    if (!outsider) continue;
    games.push({
      id: `odd-one-out:${seed.id}:${outsider.id}`,
      kind: 'odd_one_out',
      label: 'Odd One Out',
      title: 'Which concept has no recorded link to the others?',
      instruction: 'Guess based on the links in your Atlas, not just which words seem related.',
      prompt: rotate([...trio, outsider].map((item) => item.name), `${dayKey}:odd:prompt`).join(' \u00b7 '),
      options: rotate([...trio, outsider].map((item) => item.name), `${dayKey}:odd:options`),
      answer: outsider.name,
      reveal: `${seed.name} links to ${group.map((item) => item.name).join(' and ')} in your Atlas. ${outsider.name} has no recorded link to any of them. That does not mean the ideas are unrelated.`,
      sourceLabel: 'Your concepts',
      target: { view: 'concepts', targetId: outsider.id },
    });
    break;
  }

  // Bridge: two concepts with no direct link.
  const bridgeOrder = rotate(concepts, `${dayKey}:bridge`);
  let pair: readonly [Concept, Concept] | undefined;
  for (let i = 0; i < bridgeOrder.length - 1 && !pair; i++) {
    const from = bridgeOrder[i];
    const to = bridgeOrder.find((candidate, j) => j > i && !linked(from.id, candidate.id));
    if (to) pair = [from, to];
  }
  if (pair) {
    const [from, to] = pair;
    games.push({
      id: `bridge:${from.id}:${to.id}`,
      kind: 'bridge',
      label: 'Bridge',
      title: `Connect ${from.name} to ${to.name}.`,
      instruction: 'Build a path in two or three steps and name each relationship.',
      prompt: `${from.name} \u2192 ? \u2192 ${to.name}`,
      reveal: 'If each step names a relationship you could defend, it is worth saving as a link. Your Atlas has no direct path between them yet.',
      sourceLabel: `${from.name} and ${to.name}`,
      target: { view: 'concepts', targetId: from.id },
    });
  }

  // Why chain: dig under a position three levels.
  rotate(activePositions, `${dayKey}:why`).slice(0, 1).forEach((position) => {
    games.push({
      id: `why-chain:${position.id}`,
      kind: 'why_chain',
      label: 'Why Chain',
      title: 'Ask why three times.',
      instruction: 'Why do you hold this? And why that? And why that? Write each answer on its own line.',
      prompt: position.statement || position.title,
      reveal: 'If the third why is a value, the position rests on it: is it stated anywhere? If it is a fact, it needs evidence.',
      sourceLabel: position.title || 'Recorded position',
      target: { view: 'vault', targetId: position.id },
    });
  });

  // The general-knowledge deck works from day one: one card of each kind, rotated daily.
  for (const kind of GENERAL_KINDS) {
    const card = rotate(GENERAL_DECK.filter((item) => item.kind === kind), `${dayKey}:${kind}`)[0];
    if (!card) continue;
    games.push({
      id: `${kind}:${stableHash(card.prompt)}`,
      kind,
      label: THOUGHT_GAME_KIND_LABELS[kind],
      title: card.title,
      instruction: card.options ? 'Pick one, then turn the card.' : 'Write your answer, then turn the card.',
      prompt: card.prompt,
      options: card.options,
      answer: card.answer,
      reveal: card.reveal,
      sourceLabel: 'General knowledge',
      target: { view: card.then, targetId: '' },
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
