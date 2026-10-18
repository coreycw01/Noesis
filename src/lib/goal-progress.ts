import type {
  Concept,
  Draft,
  GoalItem,
  IntellectualGoalKind,
  Media,
  Practice,
  Question,
  VaultEntry,
} from '@/lib/types';

export interface GoalProgressContext {
  concepts: Concept[];
  inquiries: Question[];
  sources: Media[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
}

function hasConceptTag(tags: string[] | undefined, conceptNames: string[]) {
  return !conceptNames.length || (tags || []).some((tag) => conceptNames.includes(tag.toLowerCase()));
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

function longestDateStreak(values: string[]) {
  const uniqueDates = [...new Set(values.map((value) => value.slice(0, 10)).filter(Boolean))].sort();
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

function practiceLogValues(practices: Practice[]) {
  return practices.flatMap((practice) => [
    ...(practice.logDates || []),
    ...(practice.logs || []).filter((log) => log.actionCompleted).map((log) => log.date),
  ]);
}

export function deriveAutomaticGoalProgress(item: GoalItem, kind: IntellectualGoalKind, context: GoalProgressContext): number | null {
  const conceptId = item.relatedObjectIds?.conceptIds?.[0];
  const scopedConcept = context.concepts.find((concept) => concept.id === conceptId);
  const conceptNames = scopedConcept
    ? [scopedConcept.name, ...(scopedConcept.aliases || [])].map((name) => name.toLowerCase())
    : [];

  if (kind === 'consumption') {
    const sourceId = item.relatedObjectIds?.sourceIds?.[0];
    return context.sources.filter((source) => {
      if (sourceId && source.id !== sourceId) return false;
      if (item.sourceType && source.type !== item.sourceType) return false;
      if (!hasConceptTag(source.tags, conceptNames)) return false;
      return item.sourceMeasure === 'fully_reflected' ? sourceHasCompleteDetails(source) : source.status === 'Finished';
    }).length;
  }

  if (kind === 'inquiry') {
    const inquiryId = item.relatedObjectIds?.inquiryIds?.[0];
    return context.inquiries.filter((inquiry) => {
      if (inquiryId && inquiry.id !== inquiryId) return false;
      if (conceptId && !(inquiry.conceptIds || []).includes(conceptId)) return false;
      if (item.inquiryMeasure === 'answered') return ['answered', 'resolved'].includes(inquiry.status) && Boolean(inquiry.answer?.trim());
      if (item.inquiryMeasure === 'resolved') return inquiry.status === 'resolved' && Boolean(inquiry.answer?.trim());
      return !['archived', 'no_longer_meaningful'].includes(inquiry.status);
    }).length;
  }

  if (kind === 'position') {
    const positionId = item.relatedObjectIds?.positionIds?.[0];
    return context.positions.filter((position) => {
      if (positionId && position.id !== positionId) return false;
      if (!hasConceptTag(position.tags, conceptNames)) return false;
      if (item.positionMeasure === 'revised') return Boolean(position.lastRevisedAt || position.status === 'revised' || position.versionHistory?.some((version) => version.eventType === 'revised'));
      if (item.positionMeasure === 'confident') return position.status !== 'abandoned' && position.confidence >= 100;
      return positionHasReviewActivity(position);
    }).length;
  }

  if (kind === 'practice') {
    const practiceId = item.relatedObjectIds?.practiceIds?.[0];
    const positionId = item.relatedObjectIds?.positionIds?.[0];
    const matches = context.practices.filter((practice) => {
      if (practiceId && practice.id !== practiceId) return false;
      if (positionId && !(practice.positionIds || []).includes(positionId)) return false;
      return hasConceptTag(practice.conceptTags, conceptNames);
    });
    const logValues = practiceLogValues(matches);
    if (item.practiceMeasure === 'logged_days') return new Set(logValues.map((value) => value.slice(0, 10)).filter(Boolean)).size;
    if (item.practiceMeasure === 'log_streak') return longestDateStreak(logValues);
    return matches.filter(completedPractice).length;
  }

  if (kind === 'expression') {
    const workId = item.relatedObjectIds?.workIds?.[0];
    return context.works.filter((work) => {
      if (workId && work.id !== workId) return false;
      if (!hasConceptTag(work.conceptTags, conceptNames)) return false;
      return item.workMeasure === 'published' ? work.status === 'published' : completedWork(work);
    }).length;
  }

  return null;
}
