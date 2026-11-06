import type { VaultEntry, VaultVersion } from './types';

type PositionHistory = Pick<VaultEntry, 'confidence' | 'versionHistory'>;

export function positionRevisionHistory(previous: PositionHistory | undefined, next: PositionHistory, date: string): VaultVersion[] {
  const history = next.versionHistory || [];
  if (!previous || previous.confidence === next.confidence) return history;
  const existing = new Set((previous.versionHistory || []).map((item) => JSON.stringify(item)));
  const alreadyRecorded = history.some((item) => !existing.has(JSON.stringify(item)) && item.eventType === 'revised' && item.confidence === next.confidence);
  if (alreadyRecorded) return history;
  return [...history, {
    date,
    eventType: 'revised',
    description: `Confidence changed from ${previous.confidence}% to ${next.confidence}%.`,
    confidence: next.confidence,
  }];
}
