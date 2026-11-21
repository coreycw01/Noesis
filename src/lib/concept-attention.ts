import type { Concept } from './types';

export function conceptAttentionReason(
  concept: Pick<Concept, 'description' | 'philosophyStatus'>,
  claimCount: number,
) {
  if (concept.philosophyStatus === 'contested') return 'Review the recorded tension around this concept.';
  if (claimCount > 0 && !concept.description?.trim()) return 'Set a working definition for a concept already used in a position.';
  return '';
}
