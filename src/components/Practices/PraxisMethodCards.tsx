"use client";

import { PraxisMethodShape, type PraxisShape } from '@/components/Practices/PraxisMethodShape';

export type PraxisMethodId = 'practices' | 'experiments' | 'commitments';

const METHODS: Array<{ id: PraxisMethodId; shape: PraxisShape; tone: string; name: string; line: string }> = [
  { id: 'practices', shape: 'square', tone: 'encounter', name: 'Practices', line: 'Build consistency: repeat an action and learn from the pattern.' },
  { id: 'experiments', shape: 'triangle', tone: 'examine', name: 'Experiments', line: 'Test an idea: a bounded trial with a prediction to check.' },
  { id: 'commitments', shape: 'circle', tone: 'act', name: 'Commitments', line: 'Uphold a principle: see whether conduct matches what you say.' },
];

/**
 * The three ways of acting, as distinct cards rather than tabs: each keeps the
 * shape and colour it has everywhere in Praxis, a count, and what it is for.
 */
export function PraxisMethodCards({ active, counts, onPick }: {
  active: PraxisMethodId;
  counts: Partial<Record<PraxisMethodId, number>>;
  onPick: (method: PraxisMethodId) => void;
}) {
  return (
    <div className="noesis-method-cards" role="group" aria-label="Ways of acting">
      {METHODS.map((method) => (
        <button key={method.id} type="button" data-stage-tone={method.tone} aria-pressed={active === method.id} onClick={() => onPick(method.id)} className="noesis-method-card">
          <PraxisMethodShape shape={method.shape} size={30} />
          <span className="min-w-0">
            <span className="noesis-method-card__name">{method.name}{typeof counts[method.id] === 'number' && <span className="noesis-method-card__count">{counts[method.id]}</span>}</span>
            <span className="noesis-method-card__line">{method.line}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
