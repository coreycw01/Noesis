import type { PhilosophicalLink, VaultEntry } from './types';

type Side = 'for' | 'against';
type PositionGroundsInput = Pick<VaultEntry, 'id' | 'evidenceFor' | 'evidenceAgainst'>;
const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/** Only explicit, reasoned links count. Other relations remain in Connections. */
export function resolvePositionGrounds(position: PositionGroundsInput, links: readonly PhilosophicalLink[]) {
  const written = { for: position.evidenceFor ?? [], against: position.evidenceAgainst ?? [] };
  const counts = { for: 0, against: 0 };
  const linked: Record<Side, PhilosophicalLink[]> = { for: [], against: [] };
  for (const side of ['for', 'against'] as const) {
    const notes = new Set(written[side].map(normalize).filter(Boolean));
    const records = new Set<string>();
    counts[side] = notes.size;
    for (const link of links) {
      if (link.toType !== 'position' || link.toId !== position.id) continue;
      if (link.fromType === 'position' && link.fromId === position.id) continue;
      if (link.acceptedByUser === false || (link.createdFrom === 'suggestion' && !link.acceptedByUser)) continue;
      const direction = link.type === 'supports' || link.type === 'strengthens' ? 'for'
        : ['challenges', 'contradicts', 'weakens'].includes(link.type) ? 'against' : null;
      const reason = normalize(link.note ?? '');
      if (direction !== side || !reason) continue;
      const key = `${link.fromType}:${link.fromId}`;
      if (records.has(key) || notes.has(reason)) continue;
      records.add(key);
      notes.add(reason);
      linked[side].push(link);
      counts[side]++;
    }
  }
  return { supportCount: counts.for, challengeCount: counts.against, linked };
}

/** Share of recorded grounds on the supporting side, not a truth probability. */
export function evidenceBalance(supportCount: number, challengeCount: number) {
  const total = supportCount + challengeCount;
  return total ? Math.round(supportCount / total * 100) : null;
}

export function distinctPositionStatement(title: string, statement: string) {
  const comparable = (text: string) => normalize(text).replace(/[.!?]+$/, '').trim();
  return comparable(title) === comparable(statement) ? '' : statement.trim();
}

export function positionReviewCue(confidence: number, support: number, challenges: number) {
  if (!support && !challenges) return 'Add evidence';
  if (!support) return 'Look for supporting evidence';
  if (!challenges) return 'Consider a counterargument';
  const gap = confidence - evidenceBalance(support, challenges)!;
  return Math.abs(gap) > 10 ? `Review confidence: ${Math.abs(gap)} points ${gap > 0 ? 'above' : 'below'} evidence balance` : '';
}
