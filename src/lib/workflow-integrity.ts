import type { NoesisCondition, NoesisStage, PhilosophicalObjectType, Practice, PracticeStatus } from '@/lib/types';

const ACTIVE_PRACTICE_STATUSES = new Set<PracticeStatus>(['active']);

export function normalizePositionConfidence(value?: number, fallback = 60, scale: 'percent' | 'fraction' | 'five_point' = 'percent') {
  if (!Number.isFinite(value)) return fallback;
  const numeric = Number(value);
  const percent = scale === 'fraction' ? numeric * 100 : scale === 'five_point' ? numeric * 20 : numeric;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function practiceDesignGaps(practice: Partial<Practice>) {
  const gaps: string[] = [];
  if (!practice.hypothesis?.trim()) gaps.push('hypothesis');
  if (!practice.action?.trim()) gaps.push('action');
  if (!practice.observationMethod?.trim()) gaps.push('observation method');
  if (!practice.expectedOutcome?.trim()) gaps.push('success signal');
  return gaps;
}

export function hasPracticeIntellectualBasis(practice: Partial<Practice>) {
  return Boolean(
    practice.intellectualBasis?.trim()
      || practice.positionIds?.length
      || practice.questionIds?.length
      || practice.conceptTags?.length
      || practice.sourceIds?.length
  );
}

export function normalizePracticeStatusForSave(practice: Partial<Practice>): PracticeStatus {
  const requested = practice.status || 'planned';
  if (!ACTIVE_PRACTICE_STATUSES.has(requested)) return requested;
  if (practiceDesignGaps(practice).length || !hasPracticeIntellectualBasis(practice)) return 'planned';
  return requested;
}

export function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

const STAGE_BY_TYPE: Partial<Record<PhilosophicalObjectType, NoesisStage>> = {
  source: 'encounter',
  annotation: 'encounter',
  concept: 'question',
  inquiry: 'question',
  position: 'claim',
  practice: 'test',
  evolution: 'revise',
};

/** Maps legacy domain statuses into the one guided Noesis cycle. */
export function deriveNoesisStage(entityType: PhilosophicalObjectType, status?: string): NoesisStage {
  const normalized = status?.trim().toLowerCase();
  if (entityType === 'inquiry' && ['answered', 'resolved', 'archived', 'no_longer_meaningful'].includes(normalized || '')) return 'revise';
  if (entityType === 'position' && ['revised', 'split', 'abandoned', 'replaced', 'rejected'].includes(normalized || '')) return 'revise';
  if (entityType === 'practice' && ['completed', 'concluded', 'failed', 'failed_productively', 'integrated', 'abandoned'].includes(normalized || '')) return 'revise';
  return STAGE_BY_TYPE[entityType] || 'encounter';
}

export function deriveNoesisCondition(entityType: PhilosophicalObjectType, status?: string): NoesisCondition | undefined {
  const normalized = status?.trim().toLowerCase();
  if (['paused', 'suspended', 'stalled'].includes(normalized || '')) return 'stalled';
  if (['challenged', 'contested', 'under_tension', 'uncertain', 'unstable'].includes(normalized || '')) return 'under_challenge';
  if (entityType === 'inquiry' && ['captured', 'clarifying', 'open', 'investigating', 'gathering_evidence'].includes(normalized || '')) return 'needs_evidence';
  if (deriveNoesisStage(entityType, status) === 'revise') return 'ready_for_review';
  return undefined;
}

export function withNoesisStage<T extends { status?: string; stage?: NoesisStage; condition?: NoesisCondition; legacyStatus?: string }>(
  entityType: PhilosophicalObjectType,
  value: T,
): T {
  const legacyStatus = value.legacyStatus || value.status;
  return {
    ...value,
    stage: deriveNoesisStage(entityType, value.status),
    condition: deriveNoesisCondition(entityType, value.status),
    ...(legacyStatus ? { legacyStatus } : {}),
  };
}
