import type { VaultEntry, VaultVersion } from './types';
import { normalizePositionConfidence } from './workflow-integrity';
import { recordDateKey } from './calendar';

type PositionHistory = Pick<VaultEntry, 'confidence' | 'versionHistory'>;
export type PositionHistoryRange = { from: string; to: string };

export function positionHistoryDateMatches(value: string, { from, to }: PositionHistoryRange) {
  if (!from && !to) return true;
  const day = recordDateKey(value);
  return Boolean(day && (!from || day >= from) && (!to || day <= to));
}

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

export function positionConfidenceTrace(entry: PositionHistory & Pick<VaultEntry, 'dateUpdated' | 'dateCreated'>, range: PositionHistoryRange = { from: '', to: '' }) {
  const snapshots = (entry.versionHistory || []).flatMap(item =>
    typeof item.confidence === 'number' && Number.isFinite(item.confidence) && Number.isFinite(Date.parse(item.date))
      ? [{ date: item.date, value: normalizePositionConfidence(item.confidence), reason: item.description?.trim() || '' }]
      : [],
  ).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const current = normalizePositionConfidence(entry.confidence);
  if (snapshots.at(-1)?.value !== current) {
    snapshots.push({ date: entry.dateUpdated || entry.dateCreated, value: current, reason: '' });
  }
  return snapshots.filter(point => positionHistoryDateMatches(point.date, range));
}
