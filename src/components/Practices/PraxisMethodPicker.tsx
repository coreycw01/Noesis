'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PraxisMethodShape, praxisShapeFor } from './PraxisMethodShape';

const methods = [
  { id: 'practices', label: 'Practices', kind: 'habit' },
  { id: 'experiments', label: 'Experiments', kind: 'experiment' },
  { id: 'commitments', label: 'Commitments', kind: 'commitment' },
] as const;

export type PraxisMethod = typeof methods[number]['id'];

export function PraxisMethodPicker({ method, onChange }: { method: PraxisMethod; onChange: (method: PraxisMethod) => void }) {
  return <Select value={method} onValueChange={value => onChange(value as PraxisMethod)}>
    <SelectTrigger aria-label="Praxis method" className="w-44"><SelectValue /></SelectTrigger>
    <SelectContent>
      {methods.map(({ id, label, kind }) => {
        const shape = praxisShapeFor(kind);
        return <SelectItem key={id} value={id}>
          <span className="flex items-center gap-2" data-stage-tone={shape.tone}><PraxisMethodShape shape={shape.shape} size={15} />{label}</span>
        </SelectItem>;
      })}
    </SelectContent>
  </Select>;
}
