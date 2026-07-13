import type {
  Concept,
  Draft,
  Media,
  PhilosophicalLink,
  Practice,
  Question,
  ThinkingEvent,
  TimelineEvent,
  VaultEntry,
} from '@/lib/types';
import { conceptKey } from '@/lib/readex';

export type AtlasSection = 'overview' | 'health' | 'tensions' | 'position' | 'graph';

export type AtlasHealthLabel =
  | 'well-supported'
  | 'under-challenged'
  | 'unsupported'
  | 'untested'
  | 'contradicted'
  | 'stale'
  | 'overconfident'
  | 'needs definition'
  | 'needs practice'
  | 'recently strengthened'
  | 'recently weakened';

export interface AtlasHealthRow {
  position: VaultEntry;
  supportCount: number;
  challengeCount: number;
  practiceLinked: boolean;
  lastRevised: string;
  tensionLevel: number;
  evidenceQuality: 'low' | 'moderate' | 'high';
  healthLabel: AtlasHealthLabel;
  nextAction: string;
  contradictionCount: number;
  linkedConcepts: Concept[];
  linkedPractices: Practice[];
  linkedQuestions: Question[];
  linkedDrafts: Draft[];
  supportSources: Media[];
}

export type AtlasTensionColumn =
  | 'under_tension'
  | 'contradictory'
  | 'needs_evidence'
  | 'needs_practice'
  | 'under_challenged'
  | 'needs_definition'
  | 'stale_unused';

export interface AtlasTensionItem {
  id: string;
  column: AtlasTensionColumn;
  title: string;
  detail: string;
  positionId?: string;
  questionId?: string;
  conceptName?: string;
  severity: 'high' | 'medium' | 'low';
  actionLabel: string;
}

export interface AtlasOverviewSectionItem {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  positionId?: string;
  conceptName?: string;
  questionId?: string;
  practiceId?: string;
}

export interface AtlasOverviewData {
  corePositions: AtlasOverviewSectionItem[];
  coreConcepts: AtlasOverviewSectionItem[];
  activePractices: AtlasOverviewSectionItem[];
  currentTensions: AtlasOverviewSectionItem[];
  weakAreas: AtlasOverviewSectionItem[];
  untestedBeliefs: AtlasOverviewSectionItem[];
  recentChanges: AtlasOverviewSectionItem[];
  suggestedNextQuestions: AtlasOverviewSectionItem[];
}

const ACTIVE_QUESTION_STATUSES = new Set([
  'open',
  'investigating',
  'gathering_evidence',
  'under_tension',
  'partially_answered',
  'reopened',
]);

function parseDate(value?: string) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

function daysSince(value?: string) {
  const time = parseDate(value);
  if (!time) return 9999;
  const diff = Date.now() - time;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function summarizeEvidenceQuality(row: Pick<AtlasHealthRow, 'supportCount' | 'challengeCount'>): 'low' | 'moderate' | 'high' {
  if (row.supportCount >= 5 && row.challengeCount >= 1) return 'high';
  if (row.supportCount >= 2) return 'moderate';
  return 'low';
}

function firstLinkedConcept(position: VaultEntry, concepts: Concept[]) {
  return concepts.find((concept) =>
    (position.tags || []).some((tag) => conceptKey(tag) === conceptKey(concept.name))
  );
}

function titleCase(label: string) {
  return label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deriveAtlasHealthRows({
  vault,
  concepts,
  media,
  practices,
  questions,
  drafts,
  links,
  thinkingEvents,
}: {
  vault: VaultEntry[];
  concepts: Concept[];
  media: Media[];
  practices: Practice[];
  questions: Question[];
  drafts: Draft[];
  links: PhilosophicalLink[];
  thinkingEvents: ThinkingEvent[];
}): AtlasHealthRow[] {
  return vault.map((position) => {
    const supportLinks = links.filter((link) =>
      link.type === 'supports' &&
      ((link.fromType === 'position' && link.fromId === position.id) || (link.toType === 'position' && link.toId === position.id))
    ).length;
    const challengeLinks = links.filter((link) =>
      ['challenges', 'contradicts', 'weakens'].includes(link.type) &&
      ((link.fromType === 'position' && link.fromId === position.id) || (link.toType === 'position' && link.toId === position.id))
    ).length;
    const contradictionCount = links.filter((link) =>
      link.type === 'contradicts' &&
      ((link.fromType === 'position' && link.fromId === position.id) || (link.toType === 'position' && link.toId === position.id))
    ).length;
    const supportCount = (position.evidenceFor || []).length + supportLinks + (position.sourceIds || []).length;
    const challengeCount = (position.evidenceAgainst || []).length + challengeLinks;
    const linkedPractices = practices.filter((practice) => (practice.positionIds || []).includes(position.id));
    const linkedQuestions = questions.filter((question) => (question.beliefIds || []).includes(position.id));
    const linkedDrafts = drafts.filter((draft) => (draft.beliefIds || []).includes(position.id));
    const supportSources = media.filter((item) => (position.sourceIds || []).includes(item.id));
    const linkedConcepts = concepts.filter((concept) =>
      (position.tags || []).some((tag) => conceptKey(tag) === conceptKey(concept.name))
    );
    const confidence = Number(position.confidenceScore ?? position.confidence ?? 0);
    const lastRevised = position.lastRevisedAt || position.dateUpdated || position.dateCreated;
    const staleDays = daysSince(lastRevised);
    const recentlyStrengthened = thinkingEvents.some((event) =>
      event.targetType === 'position' &&
      event.targetId === position.id &&
      ['evidence_added', 'supported', 'strengthens'].includes(event.eventType) &&
      daysSince(event.createdAt) <= 14
    );
    const recentlyWeakened = thinkingEvents.some((event) =>
      event.targetType === 'position' &&
      event.targetId === position.id &&
      ['challenge_added', 'challenged', 'weakens', 'contradiction_detected'].includes(event.eventType) &&
      daysSince(event.createdAt) <= 14
    );

    const evidenceQuality = position.evidenceQuality || summarizeEvidenceQuality({ supportCount, challengeCount });
    const practiceLinked = linkedPractices.length > 0;
    const needsDefinition = linkedConcepts.some((concept) => !concept.description?.trim());
    const underChallenged = supportCount >= 2 && challengeCount === 0;
    const unsupported = supportCount === 0;
    const untested = !practiceLinked;
    const stale = staleDays > 45;
    const overconfident = confidence >= 85 && supportCount < 2;
    const contradicted = contradictionCount > 0 || challengeCount >= Math.max(2, supportCount);
    const needsPractice = !practiceLinked && position.status !== 'abandoned';

    let healthLabel: AtlasHealthLabel = 'well-supported';
    if (contradicted) healthLabel = 'contradicted';
    else if (unsupported) healthLabel = 'unsupported';
    else if (needsPractice) healthLabel = 'needs practice';
    else if (underChallenged) healthLabel = 'under-challenged';
    else if (needsDefinition) healthLabel = 'needs definition';
    else if (stale) healthLabel = 'stale';
    else if (overconfident) healthLabel = 'overconfident';
    else if (untested) healthLabel = 'untested';
    else if (recentlyWeakened) healthLabel = 'recently weakened';
    else if (recentlyStrengthened) healthLabel = 'recently strengthened';

    let nextAction = 'Review contradiction';
    if (unsupported) nextAction = 'Add evidence';
    else if (challengeCount === 0) nextAction = 'Add challenge';
    else if (!practiceLinked) nextAction = 'Link practice';
    else if (needsDefinition) nextAction = 'Define concept';
    else if (stale) nextAction = 'Revise position';
    else if (contradicted) nextAction = 'Review contradiction';
    else nextAction = 'Study opposing source';

    const tensionLevel =
      contradictionCount * 3 +
      (unsupported ? 3 : 0) +
      (needsPractice ? 2 : 0) +
      (underChallenged ? 2 : 0) +
      (stale ? 1 : 0);

    return {
      position,
      supportCount,
      challengeCount,
      practiceLinked,
      lastRevised,
      tensionLevel,
      evidenceQuality,
      healthLabel,
      nextAction,
      contradictionCount,
      linkedConcepts,
      linkedPractices,
      linkedQuestions,
      linkedDrafts,
      supportSources,
    };
  });
}

export function deriveAtlasTensions(rows: AtlasHealthRow[]): AtlasTensionItem[] {
  const items: AtlasTensionItem[] = [];

  rows.forEach((row) => {
    if (row.contradictionCount > 0) {
      items.push({
        id: `contradictory-${row.position.id}`,
        column: 'contradictory',
        title: row.position.title,
        detail: `${row.contradictionCount} contradiction link${row.contradictionCount > 1 ? 's' : ''} need review.`,
        positionId: row.position.id,
        conceptName: row.linkedConcepts[0]?.name,
        severity: 'high',
        actionLabel: 'Review contradiction',
      });
    }
    if (row.healthLabel === 'unsupported') {
      items.push({
        id: `evidence-${row.position.id}`,
        column: 'needs_evidence',
        title: row.position.title,
        detail: 'No real supporting evidence is linked yet.',
        positionId: row.position.id,
        conceptName: row.linkedConcepts[0]?.name,
        severity: 'high',
        actionLabel: 'Add evidence',
      });
    }
    if (!row.practiceLinked && row.position.status !== 'abandoned') {
      items.push({
        id: `practice-${row.position.id}`,
        column: 'needs_practice',
        title: row.position.title,
        detail: 'This belief has not been tested in practice.',
        positionId: row.position.id,
        conceptName: row.linkedConcepts[0]?.name,
        severity: 'medium',
        actionLabel: 'Start practice',
      });
    }
    if (row.challengeCount === 0 && row.supportCount > 0) {
      items.push({
        id: `challenge-${row.position.id}`,
        column: 'under_challenged',
        title: row.position.title,
        detail: 'This position needs a stronger objection.',
        positionId: row.position.id,
        conceptName: row.linkedConcepts[0]?.name,
        severity: 'medium',
        actionLabel: 'Add challenge',
      });
    }
    if (row.linkedConcepts.some((concept) => !concept.description?.trim())) {
      const concept = row.linkedConcepts.find((item) => !item.description?.trim());
      items.push({
        id: `definition-${row.position.id}-${concept?.id || 'concept'}`,
        column: 'needs_definition',
        title: row.position.title,
        detail: `${concept?.name || 'A linked concept'} still needs a clear definition.`,
        positionId: row.position.id,
        conceptName: concept?.name,
        severity: 'low',
        actionLabel: 'Define concept',
      });
    }
    if (daysSince(row.lastRevised) > 45) {
      items.push({
        id: `stale-${row.position.id}`,
        column: 'stale_unused',
        title: row.position.title,
        detail: 'This position has gone stale and needs a review.',
        positionId: row.position.id,
        conceptName: row.linkedConcepts[0]?.name,
        severity: 'low',
        actionLabel: 'Revisit position',
      });
    }
    if (row.challengeCount > 0 && row.supportCount > 0 && row.position.status !== 'abandoned') {
      items.push({
        id: `tension-${row.position.id}`,
        column: 'under_tension',
        title: row.position.title,
        detail: 'Support and challenge are both present; this idea needs refinement.',
        positionId: row.position.id,
        conceptName: row.linkedConcepts[0]?.name,
        severity: 'medium',
        actionLabel: 'Refine position',
      });
    }
  });

  return items;
}

export function groupTensions(items: AtlasTensionItem[]) {
  return {
    under_tension: items.filter((item) => item.column === 'under_tension'),
    contradictory: items.filter((item) => item.column === 'contradictory'),
    needs_evidence: items.filter((item) => item.column === 'needs_evidence'),
    needs_practice: items.filter((item) => item.column === 'needs_practice'),
    under_challenged: items.filter((item) => item.column === 'under_challenged'),
    needs_definition: items.filter((item) => item.column === 'needs_definition'),
    stale_unused: items.filter((item) => item.column === 'stale_unused'),
  };
}

export function deriveAtlasOverview({
  rows,
  tensions,
  concepts,
  practices,
  questions,
  timeline,
  thinkingEvents,
}: {
  rows: AtlasHealthRow[];
  tensions: AtlasTensionItem[];
  concepts: Concept[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  thinkingEvents: ThinkingEvent[];
}): AtlasOverviewData {
  const corePositions = [...rows]
    .sort((a, b) => (b.supportCount + b.linkedConcepts.length) - (a.supportCount + a.linkedConcepts.length))
    .slice(0, 4)
    .map((row) => ({
      id: row.position.id,
      title: row.position.title,
      subtitle: row.position.statement || row.position.description || 'No statement yet.',
      meta: `${row.healthLabel} · ${row.supportCount} support / ${row.challengeCount} challenge`,
      positionId: row.position.id,
      conceptName: row.linkedConcepts[0]?.name,
    }));

  const coreConcepts = [...concepts]
    .sort((a, b) => {
      const aCount = rows.filter((row) => row.linkedConcepts.some((concept) => concept.id === a.id)).length;
      const bCount = rows.filter((row) => row.linkedConcepts.some((concept) => concept.id === b.id)).length;
      return bCount - aCount;
    })
    .slice(0, 4)
    .map((concept) => ({
      id: concept.id,
      title: concept.name,
      subtitle: concept.description || 'Needs definition.',
      meta: `${rows.filter((row) => row.linkedConcepts.some((item) => item.id === concept.id)).length} linked positions`,
      conceptName: concept.name,
    }));

  const activePractices = practices
    .filter((practice) => ['active', 'planned', 'proposed'].includes(practice.status))
    .slice(0, 4)
    .map((practice) => ({
      id: practice.id,
      title: practice.title,
      subtitle: practice.description || practice.notes || 'No practice note yet.',
      meta: `${titleCase(practice.status)} · ${(practice.positionIds || []).length} positions linked`,
      practiceId: practice.id,
      positionId: practice.positionIds?.[0],
      conceptName: practice.conceptTags?.[0],
    }));

  const currentTensions = tensions.slice(0, 4).map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.detail,
    meta: titleCase(item.column),
    positionId: item.positionId,
    questionId: item.questionId,
    conceptName: item.conceptName,
  }));

  const weakAreas = rows
    .filter((row) => ['unsupported', 'needs practice', 'overconfident', 'needs definition'].includes(row.healthLabel))
    .slice(0, 4)
    .map((row) => ({
      id: row.position.id,
      title: row.position.title,
      subtitle: row.nextAction,
      meta: titleCase(row.healthLabel),
      positionId: row.position.id,
      conceptName: row.linkedConcepts[0]?.name,
    }));

  const untestedBeliefs = rows
    .filter((row) => !row.practiceLinked)
    .slice(0, 4)
    .map((row) => ({
      id: row.position.id,
      title: row.position.title,
      subtitle: 'No linked practice yet.',
      meta: `${row.supportCount} support / ${row.challengeCount} challenge`,
      positionId: row.position.id,
      conceptName: row.linkedConcepts[0]?.name,
    }));

  const recentChanges = [...timeline]
    .sort((a, b) => parseDate(b.date) - parseDate(a.date))
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.entityTitle,
      subtitle: item.reason,
      meta: titleCase(item.eventType),
      positionId: item.entityType === 'vault' ? item.entityId : undefined,
    }));

  const suggestedNextQuestions: AtlasOverviewSectionItem[] = questions
    .filter((question) => ACTIVE_QUESTION_STATUSES.has(question.status))
    .sort((a, b) => {
      const aEvidence = a.evidenceIds?.length || 0;
      const bEvidence = b.evidenceIds?.length || 0;
      return aEvidence - bEvidence;
    })
    .slice(0, 4)
    .map((question) => ({
      id: question.id,
      title: question.text,
      subtitle: 'Active inquiry that needs more work.',
      meta: `${question.evidenceIds?.length || 0} evidence items`,
      questionId: question.id,
      conceptName: concepts.find((concept) => question.conceptIds.includes(concept.id))?.name,
    }));

  if (!suggestedNextQuestions.length) {
    const suggestionEvent = [...thinkingEvents]
      .filter((event) => ['question_created', 'question_promoted', 'suggestion_created'].includes(event.eventType))
      .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))[0];
    if (suggestionEvent) {
      suggestedNextQuestions.push({
        id: suggestionEvent.eventId,
        title: suggestionEvent.summary,
        subtitle: 'Recent event suggests a new line of inquiry.',
        meta: titleCase(suggestionEvent.eventType),
      });
    }
  }

  return {
    corePositions,
    coreConcepts,
    activePractices,
    currentTensions,
    weakAreas,
    untestedBeliefs,
    recentChanges,
    suggestedNextQuestions,
  };
}
