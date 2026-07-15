import type { ThinkingEventImportance, ThinkingEventType, VaultEntry } from '@/lib/types';

export function classifyThinkingChange(before?: Partial<VaultEntry> | null, after?: Partial<VaultEntry> | null): {
  eventType: ThinkingEventType;
  importance: ThinkingEventImportance;
} {
  if (!before) return { eventType: 'position_created', importance: 'high' };
  if (!after) return { eventType: 'position_abandoned', importance: 'high' };

  if (before.status !== 'abandoned' && after.status === 'abandoned') {
    return { eventType: 'position_abandoned', importance: 'major' };
  }

  if ((before.confidence ?? null) !== (after.confidence ?? null) || (before.confidenceScore ?? null) !== (after.confidenceScore ?? null)) {
    return { eventType: 'confidence_changed', importance: 'medium' };
  }

  const meaningFieldsChanged =
    (before.statement || '') !== (after.statement || '') ||
    (before.description || '') !== (after.description || '') ||
    JSON.stringify(before.tags || []) !== JSON.stringify(after.tags || []);

  if (meaningFieldsChanged) {
    return { eventType: 'position_revised', importance: 'high' };
  }

  return { eventType: 'edited', importance: 'low' };
}
