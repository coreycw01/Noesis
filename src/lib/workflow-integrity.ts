import type { Practice, PracticeStatus } from '@/lib/types';

const ACTIVE_PRACTICE_STATUSES = new Set<PracticeStatus>(['active']);

export function normalizePositionConfidence(value?: number, fallback = 60) {
  if (!Number.isFinite(value)) return fallback;
  const numeric = Number(value);
  if (numeric > 0 && numeric < 1) return Math.round(numeric * 100);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) return numeric * 20;
  return Math.max(0, Math.min(100, Math.round(numeric)));
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
