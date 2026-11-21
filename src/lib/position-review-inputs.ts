import { latestCompletedPracticeResult } from './practice-state';
import type { Practice, VaultEntry } from './types';

export function positionReviewInputs(
  position: Pick<VaultEntry, 'id' | 'evidenceAgainst' | 'falsification' | 'lastRevisedAt' | 'dateCreated'>,
  practices: readonly Practice[],
  linkedChallenges: readonly { note?: string }[],
) {
  const criterion = position.falsification?.trim() || '';
  const objection = (position.evidenceAgainst || []).findLast(note => note.trim())?.trim()
    || linkedChallenges.find(link => link.note?.trim())?.note?.trim() || '';
  const result = latestCompletedPracticeResult(practices.filter(practice => practice.positionIds?.includes(position.id)));
  const resultNeedsReview = Boolean(result &&
    Date.parse(result.practice.dateUpdated) > Date.parse(position.lastRevisedAt || position.dateCreated));
  return { criterion, objection, result, resultNeedsReview };
}
