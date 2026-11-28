'use client';

import { PRAXIS_METHOD_ICONS } from '@/lib/noesis-icons';

const methods = [
  { id: 'practices', label: 'Practices', kind: 'practice' },
  { id: 'experiments', label: 'Experiments', kind: 'experiment' },
  { id: 'commitments', label: 'Commitments', kind: 'commitment' },
] as const;

export type PraxisMethod = typeof methods[number]['id'];

export function PraxisMethodTabs({ method, onChange }: { method: PraxisMethod; onChange: (method: PraxisMethod) => void }) {
  return (
    <div role="group" aria-label="Praxis views" className="noesis-praxis-methods" data-stage-tone="act">
      {methods.map(({ id, label, kind }) => {
        const Icon = PRAXIS_METHOD_ICONS[kind];
        return (
          <button key={id} type="button" aria-pressed={method === id} onClick={() => { if (method !== id) onChange(id); }}>
            <Icon size={15} className="shrink-0 text-[hsl(var(--stage))]" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
