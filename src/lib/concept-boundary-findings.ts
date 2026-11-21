import type { Concept } from './types';

export type BoundaryZone = 'fits' | 'edge' | 'outside';

export const CONCEPT_BOUNDARY_ZONES = [
  { id: 'fits', label: 'Fits', hint: 'Clearly inside the concept', field: 'examples' },
  { id: 'edge', label: 'Edge case', hint: 'Could go either way', field: 'edgeCases' },
  { id: 'outside', label: "Doesn't fit", hint: 'Clearly outside it', field: 'counterexamples' },
] as const;

export function conceptBoundaryFindings(concept: Pick<Concept, 'examples' | 'edgeCases' | 'counterexamples' | 'caseReasons'>) {
  const seen = new Set<string>();
  return [...CONCEPT_BOUNDARY_ZONES].flatMap(zone => (concept[zone.field] ?? []).flatMap(value => {
    const example = value.trim();
    const reason = Object.hasOwn(concept.caseReasons ?? {}, example) ? concept.caseReasons?.[example]?.trim() : '';
    if (!example || !reason || seen.has(example)) return [];
    seen.add(example);
    return [{ example, reason, label: zone.label, zone: zone.id }];
  }));
}

export type ConceptBoundaryFinding = ReturnType<typeof conceptBoundaryFindings>[number];
