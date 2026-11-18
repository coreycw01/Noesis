import type { Concept, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';

/**
 * Shape My Philosophy: a guided process in which Noesis asks and the person
 * answers. Questions are built only from the person's own words, and nothing
 * here summarises, paraphrases, or interprets an answer.
 *
 * Question sets:
 * - Clean Language (David Grove): content-free questions that reuse the
 *   person's exact words, so the asker adds no framing of their own.
 * - Laddering (Hinkle, after Kelly's personal construct theory): repeated
 *   "why does that matter to you?" moves from a stated view to the value under it.
 * - Socratic questioning (Paul & Elder's six kinds): clarification,
 *   assumptions, reasons and evidence, viewpoints, implications, and the
 *   question itself. Optional, and it tests rather than answers.
 */
export const PHILOSOPHY_STEPS = ['Survey', 'Choose', 'Clarify', 'Ladder', 'Examine', 'In your words'] as const;

export const CLEAN_QUESTIONS: Array<[key: string, template: string]> = [
  ['kind', 'And what kind of %X% is that %X%?'],
  ['else', 'And is there anything else about %X%?'],
  ['where', 'And where does %X% come from?'],
  ['then', 'And when %X%, then what happens?'],
  ['want', 'And what would you like to have happen with %X%?'],
];

export const SOCRATIC_QUESTIONS: Array<[kind: string, template: string]> = [
  ['Clarification', 'What do you mean by “%X%”? Can you give an example from your own life?'],
  ['Assumptions', 'What are you assuming when you say “%S%”?'],
  ['Reasons and evidence', 'What would make you change your mind about this?'],
  ['Viewpoints', 'How would someone who disagrees with you put it, in their best words?'],
  ['Implications', 'If this is true, what follows for how you live this week?'],
  ['The question itself', 'Why is this question worth asking for you?'],
];

export type SurveyItemType = 'position' | 'concept' | 'inquiry' | 'practice';

export interface PhilosophySurveyItem {
  key: string;
  type: SurveyItemType;
  /** The person's own wording, quoted as recorded. */
  words: string;
  title: string;
  score: number;
  /** Counts and facts only, never judgements about importance. */
  facts: string[];
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const ACTIVE_POSITION = (position: VaultEntry) => !['abandoned', 'rejected', 'replaced'].includes(position.status);
const OPEN_INQUIRY = (question: Question) => !['resolved', 'archived'].includes(question.status);

/** The records that recur most in the workspace, ranked by use, not by meaning. */
export function philosophySurvey({ positions, concepts, inquiries, practices, links }: {
  positions: VaultEntry[];
  concepts: Concept[];
  inquiries: Question[];
  practices: Practice[];
  links: PhilosophicalLink[];
}, limit = 8): PhilosophySurveyItem[] {
  const items: PhilosophySurveyItem[] = [];
  const linkCount = (type: string, id: string) => links.filter((link) => (link.fromType === type && link.fromId === id) || (link.toType === type && link.toId === id)).length;

  for (const position of positions.filter(ACTIVE_POSITION)) {
    const linked = linkCount('position', position.id);
    const tested = practices.filter((practice) => (practice.positionIds || []).includes(position.id)).length;
    const changes = (position.versionHistory || []).length;
    items.push({
      key: `position:${position.id}`,
      type: 'position',
      words: position.statement || position.title,
      title: position.title,
      score: position.confidence / 10 + linked * 2 + tested * 3 + changes,
      facts: [`you hold it at ${Math.round(position.confidence)}%`, plural(changes, 'recorded change'), tested ? `${plural(tested, 'practice')} test it` : '', linked ? `${plural(linked, 'link')}` : ''].filter(Boolean),
    });
  }
  for (const concept of concepts) {
    const uses = positions.filter((position) => (position.tags || []).some((tag) => tag.toLowerCase() === concept.name.toLowerCase())).length
      + (concept.sourceIds || []).length + (concept.links || []).length;
    if (!uses && !concept.description?.trim()) continue;
    items.push({
      key: `concept:${concept.id}`,
      type: 'concept',
      words: concept.description?.trim() || concept.name,
      title: concept.name,
      score: uses * 1.5 + (concept.description?.trim() ? 2 : 0),
      facts: [`${plural(uses, 'record')} use it`, concept.description?.trim() ? 'you have defined it' : 'not yet defined'],
    });
  }
  for (const inquiry of inquiries.filter(OPEN_INQUIRY)) {
    const evidence = (inquiry.evidenceRecords || []).length || (inquiry.evidenceIds || []).length;
    items.push({
      key: `inquiry:${inquiry.id}`,
      type: 'inquiry',
      words: inquiry.text,
      title: inquiry.text,
      score: 3 + evidence,
      facts: ['still open', plural(evidence, 'piece') + ' of evidence'],
    });
  }
  for (const practice of practices) {
    const days = (practice.logDates || []).length || (practice.logs || []).length;
    if (days < 5) continue;
    items.push({
      key: `practice:${practice.id}`,
      type: 'practice',
      words: practice.title,
      title: practice.title,
      score: days / 3,
      facts: [plural(days, 'day') + ' logged'],
    });
  }
  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function splitWords(text: string) {
  return text.replace(/[“”".,;:!?()]/g, ' ').split(/\s+/).filter(Boolean);
}

/** Fill a question template with the person's own chosen words. */
export function fillQuestion(template: string, chosen: string, statement = chosen) {
  return template.replaceAll('%X%', chosen).replaceAll('%S%', statement);
}

const STOP = new Set('the a an and or of to in is it that this be for on with as are i my me you your what when how not but if then so do does by at from about more less than its was were have has had can will would should could one there their they them which who into out up just only like all any some because want feel really thing things something someone very much make made where here thats dont'.split(' '));

/**
 * Words the person used in more than one answer. Offered back as a question
 * ("is this a thread?"), never as a conclusion.
 */
export function recurringWords(answers: string[], limit = 5): Array<[word: string, count: number]> {
  const counts = new Map<string, number>();
  for (const answer of answers) {
    for (const word of new Set(splitWords(answer.toLowerCase()))) {
      if (word.length > 3 && !STOP.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

export interface PhilosophyProcessState {
  step: number;
  picks: Record<string, 'yes' | 'unsure' | 'no'>;
  focus: Record<string, string[]>;
  clean: Record<string, Record<string, string>>;
  ladder: Record<string, string[]>;
  ladderDone: Record<string, boolean>;
  socratic: Record<string, Record<string, string>>;
  statement: string;
}

export const EMPTY_PHILOSOPHY_PROCESS: PhilosophyProcessState = { step: 0, picks: {}, focus: {}, clean: {}, ladder: {}, ladderDone: {}, socratic: {}, statement: '' };

export function allProcessAnswers(state: PhilosophyProcessState) {
  return [
    ...Object.values(state.clean).flatMap((answers) => Object.values(answers)),
    ...Object.values(state.ladder).flat(),
    ...Object.values(state.socratic).flatMap((answers) => Object.values(answers)),
  ].filter((answer) => answer.trim());
}
