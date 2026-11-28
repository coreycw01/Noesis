import type { DragEvent } from 'react';
import { InstrumentHelp } from '@/components/shared/InstrumentHelp';
import type { Concept } from '@/lib/types';
import { NOESIS_ICONS } from '@/lib/noesis-icons';
import { CONCEPT_BOUNDARY_ZONES, boundaryCases, boundaryNumbering, type BoundaryZone } from '@/lib/concept-boundary-findings';

export const BOUNDARY_LABELS = Object.fromEntries(CONCEPT_BOUNDARY_ZONES.map(({ id, label }) => [id, label])) as Record<BoundaryZone, string>;

const points = { fits: [[139, 150], [222, 150], [146, 78], [216, 78]], edge: [[78, 108], [283, 108], [95, 159], [268, 159]], outside: [[39, 165], [322, 165], [49, 52], [308, 50]] };
const zonePaths = {
  outside: 'M48 53C89 11 248 4 303 37C345 62 348 145 319 182C289 219 209 215 156 212C85 209 37 198 24 158C13 126 18 84 48 53Z',
  edge: 'M86 66C112 35 224 24 264 53C298 77 308 129 276 164C244 199 152 198 104 173C63 152 57 101 86 66Z',
  fits: 'M115 77C135 55 217 51 240 76C263 101 266 133 244 154C216 181 159 175 123 157C95 141 94 103 115 77Z',
};

export function ConceptBoundaryMap({ concept, zone, selectedCase, onZone, onCase, onDropCase }: {
  concept: Concept;
  zone?: BoundaryZone;
  selectedCase?: string;
  onZone?: (zone: BoundaryZone) => void;
  onCase?: (zone: BoundaryZone, text: string) => void;
  onDropCase?: (zone: BoundaryZone, event: DragEvent<HTMLButtonElement>) => void;
}) {
  const cases = boundaryCases(concept);
  const { numbers } = boundaryNumbering(concept, cases);
  const ThoughtBubble = NOESIS_ICONS.concept;
  return (
    <figure className="noesis-record-instrument" data-tone="concept" aria-label="Concept boundary map">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="noesis-eyebrow font-bold text-tone">Boundary Map</span>
        <InstrumentHelp instrument="boundary" />
      </figcaption>
      <div className="relative isolate mx-auto aspect-[360/220] w-full max-w-lg">
        <svg viewBox="0 0 360 220" className="absolute inset-0 size-full text-tone" aria-hidden="true">
          {(['outside', 'edge', 'fits'] as const).map((kind) => (
            <path key={kind} d={zonePaths[kind]} fill="currentColor" fillOpacity={zone === kind ? '.15' : '.055'} stroke="currentColor" strokeOpacity={zone === kind ? '.85' : '.43'} strokeWidth={zone === kind ? 1.8 : 1.15} strokeDasharray={kind === 'edge' ? '4 4' : kind === 'outside' ? '1 4' : undefined} />
          ))}
        </svg>
        <div className="absolute left-1/2 top-[48%] w-[41%] -translate-x-1/2 -translate-y-1/2 text-center">
          <ThoughtBubble className="mx-auto mb-1 size-4 text-tone" />
          <span className="block truncate font-headline text-sm font-semibold sm:text-base">{concept.name}</span>
        </div>
        {CONCEPT_BOUNDARY_ZONES.flatMap(({ id }) => {
          const ordered = [...cases[id]].sort((a, b) => numbers.get(a)! - numbers.get(b)!);
          const visible = ordered.slice(0, points[id].length);
          if (zone === id && selectedCase && ordered.includes(selectedCase) && !visible.includes(selectedCase)) visible[visible.length - 1] = selectedCase;
          return visible.map((text, index) => {
          const [x, y] = points[id][index];
          const position = { left: `${x / 3.6}%`, top: `${y / 2.2}%` };
          return onCase ? (
            <button key={`${id}:${text}`} type="button" className="noesis-boundary-pin" data-zone={id} style={position}
              aria-label={`Example ${numbers.get(text)}, ${BOUNDARY_LABELS[id]}: ${text}`} aria-pressed={selectedCase === text && zone === id}
              onClick={() => onCase(id, text)}><span>{numbers.get(text)}</span></button>
          ) : <span key={`${id}:${text}`} className="noesis-boundary-pin" data-zone={id} style={position} aria-hidden="true"><span>{numbers.get(text)}</span></span>;
          });
        })}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {CONCEPT_BOUNDARY_ZONES.map(({ id }) => onZone ? (
          <button key={id} type="button" aria-pressed={zone === id} onClick={() => onZone(id)}
            onDragOver={onDropCase ? event => { if (event.dataTransfer.types.includes('text/x-noesis-case')) event.preventDefault(); } : undefined}
            onDrop={onDropCase ? event => onDropCase(id, event) : undefined}
            className="min-h-11 min-w-0 rounded-[var(--radius-panel)] border border-border p-1 text-xs focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-current aria-pressed:text-tone">
            {BOUNDARY_LABELS[id]} <b className="font-code">{cases[id].length}</b>
          </button>
        ) : <span key={id} className="text-center text-xs text-muted-foreground">{BOUNDARY_LABELS[id]} <b>{cases[id].length}</b></span>)}
      </div>
    </figure>
  );
}
