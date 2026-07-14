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

export type AtlasSection = 'territory' | 'tensions' | 'development' | 'path' | 'map';

export type AtlasRegionLabel =
  | 'heavily-developed'
  | 'underdeveloped'
  | 'under-tested'
  | 'evidence-rich'
  | 'challenge-poor'
  | 'practice-poor'
  | 'question-heavy'
  | 'tension-heavy'
  | 'rapidly-evolving'
  | 'stale';

export type AtlasMaturityStatus =
  | 'emerging'
  | 'developing'
  | 'established'
  | 'imbalanced'
  | 'stalled';

export type AtlasNextAction =
  | 'define-concept'
  | 'add-challenge'
  | 'add-evidence'
  | 'create-practice'
  | 'study-opposing-source'
  | 'resolve-tension'
  | 'develop-position'
  | 'turn-into-work';

export interface AtlasRegionViewModel {
  id: string;
  name: string;
  description?: string;
  conceptIds: string[];
  positionIds: string[];
  practiceIds: string[];
  inquiryIds: string[];
  sourceIds: string[];
  workIds: string[];
  dominantConcepts: string[];
  activePositionsCount: number;
  practiceCount: number;
  openInquiryCount: number;
  sourceCount: number;
  annotationCount: number;
  supportCount: number;
  challengeCount: number;
  contradictionCount: number;
  tensionCount: number;
  recentActivityCount: number;
  lastActiveAt?: string;
  labels: AtlasRegionLabel[];
  maturityStatus: AtlasMaturityStatus;
  suggestedNextActions: AtlasNextAction[];
}

export interface AtlasTerritoryCard {
  id: string;
  name: string;
  description: string;
  dominantConcepts: string[];
  labels: AtlasRegionLabel[];
  maturityStatus: AtlasMaturityStatus;
  stats: {
    positions: number;
    practices: number;
    inquiries: number;
    tensions: number;
    recentActivity: number;
  };
  nextAction: AtlasNextAction | null;
}

export interface AtlasSystemTensionItem {
  id: string;
  type: 'region_conflict' | 'concept_ambiguity' | 'practice_gap' | 'one_sided_region';
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  regionIds: string[];
  conceptNames?: string[];
  positionIds?: string[];
  questionIds?: string[];
  recommendedAction: AtlasNextAction;
}

export interface AtlasDevelopmentBucket {
  id: 'most-developed' | 'underdeveloped' | 'under-tested' | 'practice-poor' | 'tension-heavy' | 'rapidly-evolving' | 'stale';
  title: string;
  description: string;
  regions: AtlasRegionViewModel[];
}

export interface AtlasPathRecommendation {
  id: string;
  title: string;
  reason: string;
  regionIds: string[];
  regionNames: string[];
  nextAction: AtlasNextAction;
  targetType: 'region' | 'position' | 'inquiry' | 'practice' | 'work' | 'source';
  targetId?: string;
}

const ACTIVE_QUESTION_STATUSES = new Set([
  'open',
  'investigating',
  'gathering_evidence',
  'under_tension',
  'partially_answered',
  'reopened',
]);

const REGION_DEFINITIONS = [
  {
    id: 'selfhood',
    name: 'Selfhood',
    description: 'Identity, agency, authenticity, self-mastery, ego, and the shape of the self.',
    keywords: ['self', 'identity', 'agency', 'authentic', 'ego', 'selfhood', 'character', 'self-mastery', 'narrative', 'discipline'],
  },
  {
    id: 'ethics',
    name: 'Ethics',
    description: 'Virtue, responsibility, moral action, justice, duty, and how a person ought to act.',
    keywords: ['ethic', 'moral', 'virtue', 'justice', 'duty', 'responsibility', 'care', 'good', 'ought'],
  },
  {
    id: 'meaning',
    name: 'Meaning',
    description: 'Purpose, suffering, value, significance, and the search for what makes life worth living.',
    keywords: ['meaning', 'purpose', 'significance', 'suffering', 'value', 'why live', 'worth', 'calling'],
  },
  {
    id: 'knowledge',
    name: 'Knowledge',
    description: 'Truth, evidence, uncertainty, learning, understanding, and what justifies belief.',
    keywords: ['knowledge', 'truth', 'evidence', 'uncertainty', 'understand', 'wisdom', 'belief', 'epistem', 'learn'],
  },
  {
    id: 'relationships',
    name: 'Relationships',
    description: 'Love, friendship, belonging, solitude, attachment, and the social demands of life.',
    keywords: ['relationship', 'love', 'friend', 'belong', 'community', 'solitude', 'family', 'intimacy', 'care'],
  },
  {
    id: 'spirituality',
    name: 'Spirituality',
    description: 'Transcendence, faith, reverence, sacred order, and metaphysical orientation.',
    keywords: ['spirit', 'faith', 'sacred', 'transcend', 'god', 'prayer', 'religion', 'reverence', 'metaphys'],
  },
  {
    id: 'power',
    name: 'Power',
    description: 'Influence, domination, hierarchy, status, control, and force in human systems.',
    keywords: ['power', 'status', 'domination', 'hierarchy', 'control', 'authority', 'politic', 'influence'],
  },
  {
    id: 'emotion',
    name: 'Emotion',
    description: 'Feeling, anxiety, desire, shame, courage, and the emotional texture of thought and action.',
    keywords: ['emotion', 'feeling', 'anxiety', 'desire', 'shame', 'fear', 'courage', 'anger', 'love'],
  },
  {
    id: 'discipline',
    name: 'Discipline',
    description: 'Habit, training, freedom through structure, attention, and repeatable effort.',
    keywords: ['discipline', 'habit', 'practice', 'attention', 'focus', 'training', 'routine', 'freedom', 'consistency'],
  },
  {
    id: 'society',
    name: 'Society',
    description: 'Institutions, culture, politics, media, community structure, and collective life.',
    keywords: ['society', 'culture', 'politic', 'institution', 'media', 'econom', 'public', 'civic', 'community'],
  },
  {
    id: 'creativity',
    name: 'Creativity',
    description: 'Art, expression, imagination, originality, making, and the responsibility of creative work.',
    keywords: ['creativity', 'art', 'imagination', 'expression', 'write', 'making', 'design', 'original', 'craft'],
  },
  {
    id: 'mortality',
    name: 'Mortality',
    description: 'Death, finitude, urgency, legacy, and what human limitation demands of thought.',
    keywords: ['mortality', 'death', 'finite', 'legacy', 'time', 'urgent', 'aging', 'end', 'finitude'],
  },
] as const;

function parseDate(value?: string) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

function daysSince(value?: string) {
  const time = parseDate(value);
  if (!time) return 9999;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
}

function titleCase(label: string) {
  return label.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value: string) {
  return conceptKey(value).replace(/[^a-z0-9]+/g, '-');
}

function getActiveQuestionCount(questions: Question[]) {
  return questions.filter((question) => ACTIVE_QUESTION_STATUSES.has(question.status)).length;
}

function collectKeywords(...values: Array<string | undefined>) {
  return values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function regionIdsForText(content: string) {
  const text = content.toLowerCase();
  return REGION_DEFINITIONS
    .filter((region) => region.keywords.some((keyword) => text.includes(keyword)))
    .map((region) => region.id);
}

function buildConceptRegionMap({
  concepts,
  vault,
  practices,
  questions,
}: {
  concepts: Concept[];
  vault: VaultEntry[];
  practices: Practice[];
  questions: Question[];
}) {
  const map = new Map<string, string[]>();

  concepts.forEach((concept) => {
    const directMatches = regionIdsForText(collectKeywords(concept.name, concept.description));
    const positionMatches = vault
      .filter((position) => (position.tags || []).some((tag) => conceptKey(tag) === conceptKey(concept.name)))
      .flatMap((position) => regionIdsForText(collectKeywords(position.title, position.statement, position.description, ...(position.tags || []))));
    const practiceMatches = practices
      .filter((practice) => (practice.conceptTags || []).some((tag) => conceptKey(tag) === conceptKey(concept.name)))
      .flatMap((practice) => regionIdsForText(collectKeywords(practice.title, practice.description, practice.notes, ...(practice.conceptTags || []))));
    const questionMatches = questions
      .filter((question) => question.conceptIds.includes(concept.id))
      .flatMap((question) => regionIdsForText(question.text));
    const derived = uniqueStrings([...directMatches, ...positionMatches, ...practiceMatches, ...questionMatches]);
    map.set(concept.id, derived.length ? derived : ['knowledge']);
  });

  return map;
}

function countAnnotationsForSource(source: Media, regionConceptNames: string[]) {
  const conceptNames = new Set(regionConceptNames.map((name) => conceptKey(name)));
  return (source.annotations || []).filter((annotation) =>
    (annotation.conceptTags || []).some((tag) => conceptNames.has(conceptKey(tag)))
  ).length;
}

function labelSetForRegion(region: Omit<AtlasRegionViewModel, 'labels' | 'maturityStatus' | 'suggestedNextActions'>): AtlasRegionLabel[] {
  const labels: AtlasRegionLabel[] = [];
  const objectDensity = region.conceptIds.length + region.positionIds.length + region.inquiryIds.length;
  const challengeDensity = region.supportCount > 0 ? region.challengeCount / Math.max(region.supportCount, 1) : 0;
  const practiceCoverage = region.activePositionsCount > 0 ? region.practiceCount / region.activePositionsCount : 0;

  if (objectDensity >= 14) labels.push('heavily-developed');
  if (objectDensity <= 4) labels.push('underdeveloped');
  if (region.activePositionsCount >= 2 && practiceCoverage < 0.45) labels.push('under-tested');
  if (region.supportCount >= Math.max(4, region.challengeCount + 2)) labels.push('evidence-rich');
  if (region.supportCount >= 3 && challengeDensity < 0.35) labels.push('challenge-poor');
  if (region.activePositionsCount >= 2 && practiceCoverage < 0.7) labels.push('practice-poor');
  if (region.openInquiryCount >= Math.max(3, region.activePositionsCount)) labels.push('question-heavy');
  if (region.tensionCount >= 3 || region.contradictionCount >= 2) labels.push('tension-heavy');
  if (region.recentActivityCount >= 4) labels.push('rapidly-evolving');
  if (!region.lastActiveAt || daysSince(region.lastActiveAt) > 75) labels.push('stale');

  return uniqueStrings(labels) as AtlasRegionLabel[];
}

function maturityForRegion(region: Omit<AtlasRegionViewModel, 'labels' | 'maturityStatus' | 'suggestedNextActions'>, labels: AtlasRegionLabel[]): AtlasMaturityStatus {
  if (labels.includes('stale')) return 'stalled';
  if (labels.includes('tension-heavy') || labels.includes('practice-poor')) return 'imbalanced';
  if (region.conceptIds.length >= 4 && region.activePositionsCount >= 3) return 'established';
  if (region.conceptIds.length >= 2 || region.activePositionsCount >= 1) return 'developing';
  return 'emerging';
}

function nextActionsForRegion(region: Omit<AtlasRegionViewModel, 'labels' | 'maturityStatus' | 'suggestedNextActions'>, labels: AtlasRegionLabel[]): AtlasNextAction[] {
  const actions: AtlasNextAction[] = [];
  if (labels.includes('under-tested') || labels.includes('practice-poor')) actions.push('create-practice');
  if (labels.includes('challenge-poor')) actions.push('add-challenge');
  if (region.supportCount === 0 && region.activePositionsCount > 0) actions.push('add-evidence');
  if (labels.includes('question-heavy')) actions.push('develop-position');
  if (region.contradictionCount > 0 || labels.includes('tension-heavy')) actions.push('resolve-tension');
  if (region.dominantConcepts.length && region.conceptIds.length > region.positionIds.length + 2) actions.push('define-concept');
  if (region.sourceCount > 0 && region.challengeCount === 0) actions.push('study-opposing-source');
  if (region.activePositionsCount >= 2 && region.workIds.length === 0) actions.push('turn-into-work');
  return uniqueStrings(actions).slice(0, 3) as AtlasNextAction[];
}

export function deriveAtlasRegions({
  concepts,
  media,
  vault,
  practices,
  questions,
  drafts,
  links,
  timeline,
  thinkingEvents,
}: {
  concepts: Concept[];
  media: Media[];
  vault: VaultEntry[];
  practices: Practice[];
  questions: Question[];
  drafts: Draft[];
  links: PhilosophicalLink[];
  timeline: TimelineEvent[];
  thinkingEvents: ThinkingEvent[];
}): AtlasRegionViewModel[] {
  const conceptRegionMap = buildConceptRegionMap({ concepts, vault, practices, questions });

  const regions = REGION_DEFINITIONS.map((regionDef) => {
    const regionConcepts = concepts.filter((concept) => (conceptRegionMap.get(concept.id) || []).includes(regionDef.id));
    const regionConceptNames = regionConcepts.map((concept) => concept.name);
    const regionConceptKeySet = new Set(regionConceptNames.map((name) => conceptKey(name)));

    const regionPositions = vault.filter((position) => {
      const directConcept = (position.tags || []).some((tag) => regionConceptKeySet.has(conceptKey(tag)));
      const fallbackText = regionIdsForText(collectKeywords(position.title, position.statement, position.description, ...(position.tags || []))).includes(regionDef.id);
      return directConcept || fallbackText;
    });
    const regionPositionIds = regionPositions.map((position) => position.id);

    const regionPractices = practices.filter((practice) => {
      const conceptMatch = (practice.conceptTags || []).some((tag) => regionConceptKeySet.has(conceptKey(tag)));
      const positionMatch = (practice.positionIds || []).some((id) => regionPositionIds.includes(id));
      const fallbackText = regionIdsForText(collectKeywords(practice.title, practice.description, practice.notes, ...(practice.conceptTags || []))).includes(regionDef.id);
      return conceptMatch || positionMatch || fallbackText;
    });

    const regionQuestions = questions.filter((question) => {
      const conceptMatch = (question.conceptIds || []).some((id) => regionConcepts.some((concept) => concept.id === id));
      const positionMatch = (question.beliefIds || []).some((id) => regionPositionIds.includes(id));
      const fallbackText = regionIdsForText(question.text).includes(regionDef.id);
      return conceptMatch || positionMatch || fallbackText;
    });

    const regionDrafts = drafts.filter((draft) => {
      const conceptMatch = (draft.conceptTags || []).some((tag) => regionConceptKeySet.has(conceptKey(tag)));
      const positionMatch = (draft.beliefIds || []).some((id) => regionPositionIds.includes(id));
      const questionMatch = (draft.questionIds || []).some((id) => regionQuestions.some((question) => question.id === id));
      const fallbackText = regionIdsForText(collectKeywords(draft.title, draft.body, ...(draft.conceptTags || []))).includes(regionDef.id);
      return conceptMatch || positionMatch || questionMatch || fallbackText;
    });

    const regionSources = media.filter((source) => {
      const tagMatch = (source.tags || []).some((tag) => regionConceptKeySet.has(conceptKey(tag)) || regionIdsForText(tag).includes(regionDef.id));
      const positionMatch = regionPositions.some((position) => (position.sourceIds || []).includes(source.id));
      const annotationMatch = (source.annotations || []).some((annotation) =>
        (annotation.conceptTags || []).some((tag) => regionConceptKeySet.has(conceptKey(tag)))
      );
      const fallbackText = regionIdsForText(collectKeywords(source.title, source.creator, source.description, ...(source.tags || []))).includes(regionDef.id);
      return tagMatch || positionMatch || annotationMatch || fallbackText;
    });

    const supportCount = regionPositions.reduce((sum, position) => (
      sum + (position.evidenceFor || []).length + (position.sourceIds || []).length
    ), 0) + links.filter((link) =>
      link.type === 'supports' &&
      ((link.fromType === 'position' && regionPositionIds.includes(link.fromId)) || (link.toType === 'position' && regionPositionIds.includes(link.toId)))
    ).length;

    const challengeCount = regionPositions.reduce((sum, position) => sum + (position.evidenceAgainst || []).length, 0) + links.filter((link) =>
      ['challenges', 'weakens', 'contradicts'].includes(link.type) &&
      ((link.fromType === 'position' && regionPositionIds.includes(link.fromId)) || (link.toType === 'position' && regionPositionIds.includes(link.toId)))
    ).length;

    const contradictionCount = links.filter((link) =>
      link.type === 'contradicts' &&
      (
        (link.fromType === 'position' && regionPositionIds.includes(link.fromId)) ||
        (link.toType === 'position' && regionPositionIds.includes(link.toId)) ||
        (link.fromType === 'concept' && regionConcepts.some((concept) => concept.id === link.fromId)) ||
        (link.toType === 'concept' && regionConcepts.some((concept) => concept.id === link.toId))
      )
    ).length;

    const lastActivityCandidates = [
      ...regionConcepts.map((concept) => concept.dateUpdated || concept.dateCreated),
      ...regionPositions.map((position) => position.lastRevisedAt || position.dateUpdated || position.dateCreated),
      ...regionPractices.map((practice) => practice.dateUpdated || practice.dateCreated),
      ...regionQuestions.map((question) => question.dateUpdated || question.dateCreated),
      ...regionDrafts.map((draft) => draft.dateUpdated || draft.dateCreated),
      ...regionSources.map((source) => source.dateUpdated || source.dateAdded),
      ...timeline
        .filter((event) => regionPositionIds.includes(event.entityId) || regionSources.some((source) => source.id === event.entityId))
        .map((event) => event.date),
      ...thinkingEvents
        .filter((event) =>
          regionPositionIds.includes(event.entityId) ||
          regionQuestions.some((question) => question.id === event.entityId) ||
          regionPractices.some((practice) => practice.id === event.entityId)
        )
        .map((event) => event.createdAt),
    ].filter(Boolean) as string[];

    const annotationCount = regionSources.reduce((sum, source) => sum + countAnnotationsForSource(source, regionConceptNames), 0);
    const recentActivityCount = lastActivityCandidates.filter((date) => daysSince(date) <= 30).length;
    const tensionCount = contradictionCount
      + regionPositions.filter((position) => (position.evidenceFor || []).length > 0 && (position.evidenceAgainst || []).length > 0).length
      + regionQuestions.filter((question) => ['under_tension', 'reopened'].includes(question.status)).length;

    const baseRegion = {
      id: regionDef.id,
      name: regionDef.name,
      description: regionDef.description,
      conceptIds: uniqueStrings(regionConcepts.map((concept) => concept.id)),
      positionIds: uniqueStrings(regionPositions.map((position) => position.id)),
      practiceIds: uniqueStrings(regionPractices.map((practice) => practice.id)),
      inquiryIds: uniqueStrings(regionQuestions.map((question) => question.id)),
      sourceIds: uniqueStrings(regionSources.map((source) => source.id)),
      workIds: uniqueStrings(regionDrafts.map((draft) => draft.id)),
      dominantConcepts: regionConcepts
        .sort((a, b) => {
          const aWeight = regionPositions.filter((position) => (position.tags || []).some((tag) => conceptKey(tag) === conceptKey(a.name))).length;
          const bWeight = regionPositions.filter((position) => (position.tags || []).some((tag) => conceptKey(tag) === conceptKey(b.name))).length;
          return bWeight - aWeight;
        })
        .slice(0, 4)
        .map((concept) => concept.name),
      activePositionsCount: regionPositions.filter((position) => position.status !== 'abandoned' && position.status !== 'rejected').length,
      practiceCount: regionPractices.filter((practice) => ['active', 'planned', 'proposed', 'integrated'].includes(practice.status)).length,
      openInquiryCount: getActiveQuestionCount(regionQuestions),
      sourceCount: regionSources.length,
      annotationCount,
      supportCount,
      challengeCount,
      contradictionCount,
      tensionCount,
      recentActivityCount,
      lastActiveAt: lastActivityCandidates.sort((a, b) => parseDate(b) - parseDate(a))[0],
    };

    const labels = labelSetForRegion(baseRegion);
    return {
      ...baseRegion,
      labels,
      maturityStatus: maturityForRegion(baseRegion, labels),
      suggestedNextActions: nextActionsForRegion(baseRegion, labels),
    };
  });

  return regions
    .filter((region) => region.conceptIds.length || region.positionIds.length || region.inquiryIds.length || region.practiceIds.length || region.sourceIds.length || region.workIds.length)
    .sort((a, b) => {
      const aScore = a.activePositionsCount * 4 + a.conceptIds.length * 2 + a.recentActivityCount + a.tensionCount;
      const bScore = b.activePositionsCount * 4 + b.conceptIds.length * 2 + b.recentActivityCount + b.tensionCount;
      return bScore - aScore;
    });
}

export function deriveAtlasTerritoryView(regions: AtlasRegionViewModel[]): AtlasTerritoryCard[] {
  return regions.map((region) => ({
    id: region.id,
    name: region.name,
    description: region.description || '',
    dominantConcepts: region.dominantConcepts,
    labels: region.labels,
    maturityStatus: region.maturityStatus,
    stats: {
      positions: region.activePositionsCount,
      practices: region.practiceCount,
      inquiries: region.openInquiryCount,
      tensions: region.tensionCount,
      recentActivity: region.recentActivityCount,
    },
    nextAction: region.suggestedNextActions[0] || null,
  }));
}

export function deriveAtlasSystemTensions({
  regions,
  concepts,
  vault,
  practices,
  links,
}: {
  regions: AtlasRegionViewModel[];
  concepts: Concept[];
  vault: VaultEntry[];
  practices: Practice[];
  links: PhilosophicalLink[];
}): AtlasSystemTensionItem[] {
  const items: AtlasSystemTensionItem[] = [];
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const regionIdsByConcept = new Map<string, string[]>();
  const regionIdsByPosition = new Map<string, string[]>();

  regions.forEach((region) => {
    region.conceptIds.forEach((id) => regionIdsByConcept.set(id, [...(regionIdsByConcept.get(id) || []), region.id]));
    region.positionIds.forEach((id) => regionIdsByPosition.set(id, [...(regionIdsByPosition.get(id) || []), region.id]));
  });

  links.forEach((link) => {
    if (!['contradicts', 'challenges', 'weakens'].includes(link.type)) return;
    const fromRegions = link.fromType === 'position'
      ? regionIdsByPosition.get(link.fromId) || []
      : link.fromType === 'concept'
        ? regionIdsByConcept.get(link.fromId) || []
        : [];
    const toRegions = link.toType === 'position'
      ? regionIdsByPosition.get(link.toId) || []
      : link.toType === 'concept'
        ? regionIdsByConcept.get(link.toId) || []
        : [];
    const uniqueRegionIds = uniqueStrings([...fromRegions, ...toRegions]);
    if (uniqueRegionIds.length >= 2) {
      const involved = uniqueRegionIds.map((id) => regionById.get(id)?.name).filter(Boolean) as string[];
      items.push({
        id: `region-conflict-${link.id}`,
        type: 'region_conflict',
        title: `${involved[0]} vs ${involved[1]}`,
        detail: `${link.fromLabel || 'One idea'} ${link.type.replace(/_/g, ' ')} ${link.toLabel || 'another idea'} across regions.`,
        severity: link.type === 'contradicts' ? 'high' : 'medium',
        regionIds: uniqueRegionIds,
        positionIds: [link.fromId, link.toId],
        recommendedAction: 'resolve-tension',
      });
    }
  });

  concepts.forEach((concept) => {
    const regionIds = uniqueStrings(regionIdsByConcept.get(concept.id) || []);
    if (regionIds.length >= 3) {
      items.push({
        id: `concept-ambiguity-${concept.id}`,
        type: 'concept_ambiguity',
        title: `${concept.name} spans too many territories`,
        detail: `${concept.name} currently appears across ${regionIds.length} regions and may need clearer framing.`,
        severity: 'medium',
        regionIds,
        conceptNames: [concept.name],
        recommendedAction: 'define-concept',
      });
    }
  });

  regions.forEach((region) => {
    if (region.activePositionsCount >= 2 && region.practiceCount === 0) {
      items.push({
        id: `practice-gap-${region.id}`,
        type: 'practice_gap',
        title: `${region.name} is belief-rich but practice-poor`,
        detail: 'This territory has active positions but no practices testing them in lived form.',
        severity: 'medium',
        regionIds: [region.id],
        recommendedAction: 'create-practice',
      });
    }

    if (region.supportCount >= 4 && region.challengeCount <= 1) {
      items.push({
        id: `one-sided-${region.id}`,
        type: 'one_sided_region',
        title: `${region.name} is under-challenged`,
        detail: 'This territory has support and articulation, but not enough real objection or opposing evidence.',
        severity: 'low',
        regionIds: [region.id],
        recommendedAction: 'add-challenge',
      });
    }
  });

  return items
    .slice(0, 16)
    .sort((a, b) => {
      const severityScore = { high: 3, medium: 2, low: 1 };
      return severityScore[b.severity] - severityScore[a.severity];
    });
}

export function deriveAtlasDevelopmentView(regions: AtlasRegionViewModel[]): AtlasDevelopmentBucket[] {
  const buckets: AtlasDevelopmentBucket[] = [
    {
      id: 'most-developed',
      title: 'Most Developed',
      description: 'Territories with the strongest concentration of concepts, positions, and recent activity.',
      regions: regions.filter((region) => region.labels.includes('heavily-developed')).slice(0, 4),
    },
    {
      id: 'underdeveloped',
      title: 'Underdeveloped',
      description: 'Territories with too little articulation or too few developed objects.',
      regions: regions.filter((region) => region.labels.includes('underdeveloped')).slice(0, 4),
    },
    {
      id: 'under-tested',
      title: 'Under-Tested',
      description: 'Thought regions that have positions but not enough practices touching reality.',
      regions: regions.filter((region) => region.labels.includes('under-tested')).slice(0, 4),
    },
    {
      id: 'practice-poor',
      title: 'Practice-Poor',
      description: 'Territories where beliefs outpace lived testing.',
      regions: regions.filter((region) => region.labels.includes('practice-poor')).slice(0, 4),
    },
    {
      id: 'tension-heavy',
      title: 'Tension-Heavy',
      description: 'Areas carrying contradiction, conflict, or unresolved pressure.',
      regions: regions.filter((region) => region.labels.includes('tension-heavy')).slice(0, 4),
    },
    {
      id: 'rapidly-evolving',
      title: 'Rapidly Evolving',
      description: 'Regions with strong recent change and high current movement.',
      regions: regions.filter((region) => region.labels.includes('rapidly-evolving')).slice(0, 4),
    },
    {
      id: 'stale',
      title: 'Stale',
      description: 'Territories that have gone dormant and need to be revisited or released.',
      regions: regions.filter((region) => region.labels.includes('stale')).slice(0, 4),
    },
  ];

  return buckets.filter((bucket) => bucket.regions.length);
}

export function deriveAtlasPathView(regions: AtlasRegionViewModel[]): AtlasPathRecommendation[] {
  return regions
    .flatMap((region) => {
      const action = region.suggestedNextActions[0];
      if (!action) return [];
      const actionMeta: Record<AtlasNextAction, { title: string; reason: string; targetType: AtlasPathRecommendation['targetType']; targetId?: string }> = {
        'define-concept': {
          title: `Clarify ${region.name}`,
          reason: `${region.name} has concepts outrunning clear definitions.`,
          targetType: 'region',
        },
        'add-challenge': {
          title: `Pressure-test ${region.name}`,
          reason: `${region.name} is carrying belief support without enough opposition.`,
          targetType: 'region',
        },
        'add-evidence': {
          title: `Strengthen ${region.name}`,
          reason: `${region.name} has active positions with thin support.`,
          targetType: 'region',
        },
        'create-practice': {
          title: `Test ${region.name} in practice`,
          reason: `${region.name} has beliefs that need lived experimentation.`,
          targetType: 'practice',
        },
        'study-opposing-source': {
          title: `Find an opposing source for ${region.name}`,
          reason: `${region.name} needs an external challenge, not just internal coherence.`,
          targetType: 'source',
        },
        'resolve-tension': {
          title: `Resolve a tension in ${region.name}`,
          reason: `${region.name} is carrying unresolved contradiction or internal pressure.`,
          targetType: 'region',
        },
        'develop-position': {
          title: `Turn inquiry into position in ${region.name}`,
          reason: `${region.name} is question-heavy and needs stronger claims.`,
          targetType: 'inquiry',
          targetId: region.inquiryIds[0],
        },
        'turn-into-work': {
          title: `Turn ${region.name} into a work`,
          reason: `${region.name} looks developed enough to become an essay, script, or field note.`,
          targetType: 'work',
        },
      };
      const meta = actionMeta[action];
      return [{
        id: `path-${region.id}-${action}`,
        title: meta.title,
        reason: meta.reason,
        regionIds: [region.id],
        regionNames: [region.name],
        nextAction: action,
        targetType: meta.targetType,
        targetId: meta.targetId,
      }];
    })
    .slice(0, 10);
}

export function regionLabelDisplay(label: AtlasRegionLabel) {
  return titleCase(label);
}

export function regionActionDisplay(action: AtlasNextAction) {
  return titleCase(action);
}
