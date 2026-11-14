import type {
  Concept,
  Draft,
  GoalItem,
  GoalSettings,
  GoalType,
  IntellectualGoalKind,
  Media,
  Practice,
  Question,
  VaultEntry,
} from '@/lib/types';
import { commitmentPositionIds, completedCommitmentDates } from './commitments';
import { practiceLogDates } from './practice-state';
import { MEDIA_LABELS, today } from './readex';
import { isInquiryActive } from './inquiry-state';
import { isLivePosition } from './position-state';

export interface GoalProgressContext {
  concepts: Concept[];
  inquiries: Question[];
  sources: Media[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
}

export function goalKindForType(type?: GoalType, fallbackTitle = ''): IntellectualGoalKind {
  const name = `${type?.name || fallbackTitle}`.toLowerCase();
  if (type?.mediaTypes?.length) return 'consumption';
  if (name.includes('source') || name.includes('book') || name.includes('article') || name.includes('video')) return 'consumption';
  if (name.includes('concept') || name.includes('understand')) return 'understanding';
  if (name.includes('question') || name.includes('inquiry')) return 'inquiry';
  if (name.includes('position') || name.includes('belief')) return 'position';
  if (name.includes('work') || name.includes('writing') || name.includes('essay')) return 'expression';
  if (name.includes('practice') || name.includes('habit') || name.includes('experiment')) return 'practice';
  if (name.includes('reflect')) return 'reflection';
  return 'transformation';
}

export function questKindForGoal(item: Pick<GoalItem, 'title' | 'goalKind'>, type?: GoalType): IntellectualGoalKind {
  return item.goalKind || goalKindForType(type, item.title);
}

export function goalCategoryChange(item: GoalItem, previousType: GoalType | undefined, nextType: GoalType): Partial<GoalItem> {
  if (item.typeId === nextType.id) return {};
  const goalKind = goalKindForType(nextType);
  const next = { typeId: nextType.id, goalKind, sourceType: undefined };
  if (questKindForGoal(item, previousType) === goalKind) return next;
  return {
    ...next,
    // A legacy position focus may also be this commitment's grounding.
    commitmentPositionId: item.commitmentPositionId === undefined ? commitmentPositionIds(item)[0] ?? null : item.commitmentPositionId,
    relatedObjectIds: { conceptIds: item.relatedObjectIds?.conceptIds || [] },
    sourceMeasure: undefined,
    inquiryMeasure: undefined,
    positionMeasure: undefined,
    practiceMeasure: undefined,
    workMeasure: undefined,
  };
}

export function deriveGoalProgress(item: GoalItem, type: GoalType | undefined, context: GoalProgressContext, legacyProgress: Partial<Record<Media['type'], number>> = {}) {
  const automatic = deriveAutomaticGoalProgress(item, questKindForGoal(item, type), context, type?.mediaTypes);
  const legacy = (type?.mediaTypes || []).reduce((sum, mediaType) => sum + (legacyProgress[mediaType] || 0), 0);
  const currentProgress = Math.max(item.currentProgress || 0, automatic ?? legacy, completedCommitmentDates(item).length);
  const targetProgress = Math.max(1, item.targetProgress || 1);
  return { currentProgress, targetProgress, percent: Math.min(100, (currentProgress / targetProgress) * 100) };
}

export function goalCategories(settings: GoalSettings): GoalType[] {
  if (settings.goalTypes?.length) return settings.goalTypes;
  const types = settings.types?.length ? settings.types : ['book', 'audiobook', 'podcast'] as const;
  const now = today();
  return types.map((type, sortOrder) => ({
    id: `${type}-type`, name: MEDIA_LABELS[type], mediaTypes: [type], sortOrder, createdAt: now, updatedAt: now,
  }));
}

export function goalItems(settings: GoalSettings, categories: GoalType[]): GoalItem[] {
  if (settings.goals !== undefined) return settings.goals.map((item, sortOrder) => ({
    ...item, goalKind: questKindForGoal(item, categories.find((type) => type.id === item.typeId)), sortOrder: item.sortOrder ?? sortOrder,
  }));
  return categories.filter((type) => !type.archivedAt && type.mediaTypes?.length).map((type, sortOrder) => ({
    id: `${type.id}-goal`, title: type.name, typeId: type.id, goalKind: 'consumption',
    currentProgress: 0, targetProgress: (type.mediaTypes || []).reduce((sum, mediaType) => sum + (settings.targets?.[mediaType] || 12), 0),
    sortOrder, status: 'active', createdAt: type.createdAt, updatedAt: type.updatedAt,
  }));
}

function sourceHasCompleteDetails(source: Media) {
  const reflection = source.capture?.after;
  return Boolean(
    source.status === 'Finished' &&
    source.creator?.trim() &&
    source.description?.trim() &&
    source.tags?.length &&
    reflection?.coreArgument?.trim() &&
    reflection?.beliefChange?.trim() &&
    reflection?.nextAction?.trim()
  );
}

function positionHasReviewActivity(position: VaultEntry) {
  return Boolean(
    position.lastChallengedAt ||
    position.lastRevisedAt ||
    (position.versionHistory?.length || 0) > 1 ||
    ['revised', 'challenged', 'contested', 'unstable', 'uncertain'].includes(position.status)
  );
}

function completedPractice(practice: Practice) {
  return ['completed', 'concluded', 'integrated'].includes(practice.status);
}

function completedWork(work: Draft) {
  return ['complete', 'final', 'published'].includes(work.status);
}

function longestDateStreak(uniqueDates: string[]) {
  let longest = 0;
  let current = 0;
  let previous: number | undefined;
  uniqueDates.forEach((date) => {
    const day = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(day)) return;
    current = previous === day - 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  });
  return longest;
}

function countDistinctItems<T extends { id: string }>(items: readonly T[], matches: (item: T) => boolean) {
  const ids = new Set<string>();
  for (const item of items) if (item.id && matches(item)) ids.add(item.id);
  return ids.size;
}

export function deriveAutomaticGoalProgress(item: GoalItem, kind: IntellectualGoalKind, context: GoalProgressContext, categoryMediaTypes?: Media['type'][]): number | null {
  const conceptId = item.relatedObjectIds?.conceptIds?.[0];
  const scopedConcept = context.concepts.find((concept) => concept.id === conceptId);
  const conceptNames = scopedConcept
    ? [scopedConcept.name, ...(scopedConcept.aliases || [])].map((name) => name.trim().toLowerCase()).filter(Boolean)
    : [];
  const matchesConcept = (ids?: string[], tags?: string[]) => {
    if (!conceptId) return true;
    if (ids?.length) return ids.includes(conceptId);
    return Boolean(tags?.some((tag) => conceptNames.includes(tag.trim().toLowerCase())));
  };

  if (kind === 'consumption') {
    const sourceId = item.relatedObjectIds?.sourceIds?.[0];
    return countDistinctItems(context.sources, (source) => {
      if (sourceId && source.id !== sourceId) return false;
      if (item.sourceType && source.type !== item.sourceType) return false;
      if (!item.sourceType && categoryMediaTypes?.length && !categoryMediaTypes.includes(source.type)) return false;
      if (!matchesConcept(source.conceptIds, source.tags)) return false;
      return item.sourceMeasure === 'fully_reflected' ? sourceHasCompleteDetails(source) : source.status === 'Finished';
    });
  }

  if (kind === 'inquiry') {
    const inquiryId = item.relatedObjectIds?.inquiryIds?.[0];
    return countDistinctItems(context.inquiries, (inquiry) => {
      if (inquiryId && inquiry.id !== inquiryId) return false;
      if (!matchesConcept(inquiry.conceptIds)) return false;
      if (item.inquiryMeasure === 'answered') return Boolean(inquiry.answer?.trim());
      if (item.inquiryMeasure === 'resolved') return inquiry.status === 'resolved' && Boolean(inquiry.answer?.trim());
      return isInquiryActive(inquiry);
    });
  }

  if (kind === 'position') {
    const positionId = item.relatedObjectIds?.positionIds?.[0];
    return countDistinctItems(context.positions, (position) => {
      if (positionId && position.id !== positionId) return false;
      if (!matchesConcept(position.conceptIds, position.tags)) return false;
      if (item.positionMeasure === 'revised') return Boolean(position.lastRevisedAt || position.status === 'revised' || position.versionHistory?.some((version) => version.eventType === 'revised'));
      if (item.positionMeasure === 'confident') return isLivePosition(position) && position.confidence >= 100;
      return positionHasReviewActivity(position);
    });
  }

  if (kind === 'practice') {
    const practiceId = item.relatedObjectIds?.practiceIds?.[0];
    const positionId = item.relatedObjectIds?.positionIds?.[0];
    const matches = context.practices.filter((practice) => {
      if (practiceId && practice.id !== practiceId) return false;
      if (positionId && !(practice.positionIds || []).includes(positionId)) return false;
      return matchesConcept(practice.conceptIds, practice.conceptTags);
    });
    if (item.practiceMeasure === 'logged_days') return new Set(matches.flatMap(practiceLogDates)).size;
    if (item.practiceMeasure === 'log_streak') return matches.reduce((longest, practice) => Math.max(longest, longestDateStreak(practiceLogDates(practice))), 0);
    return countDistinctItems(matches, completedPractice);
  }

  if (kind === 'expression') {
    const workId = item.relatedObjectIds?.workIds?.[0];
    return countDistinctItems(context.works, (work) => {
      if (workId && work.id !== workId) return false;
      if (!matchesConcept(work.conceptIds, work.conceptTags)) return false;
      return item.workMeasure === 'published' ? work.status === 'published' : completedWork(work);
    });
  }

  return null;
}
