import type { Concept } from './types';

export type BoundaryZone = 'fits' | 'edge' | 'outside';

export const CONCEPT_BOUNDARY_ZONES = [
  { id: 'fits', label: 'Fits', hint: 'Clearly inside the concept', field: 'examples' },
  { id: 'edge', label: 'Not sure', hint: 'Could go either way', field: 'edgeCases' },
  { id: 'outside', label: "Doesn't fit", hint: 'Clearly outside it', field: 'counterexamples' },
] as const;

export type BoundaryCases = Record<BoundaryZone, string[]>;

export function boundaryCases(concept: Pick<Concept, 'examples' | 'edgeCases' | 'counterexamples'>): BoundaryCases {
  const clean = (items?: string[]) => [...new Set((items || []).map(item => item.trim()).filter(Boolean))];
  return { fits: clean(concept.examples), edge: clean(concept.edgeCases), outside: clean(concept.counterexamples) };
}

export function boundaryNumbering(concept: Pick<Concept, 'examples' | 'edgeCases' | 'counterexamples' | 'boundaryCaseNumbers' | 'boundaryNextNumber'>, next = boundaryCases(concept)) {
  const numbers = new Map<string, number>();
  const used = new Set<number>();
  let nextNumber = Number.isSafeInteger(concept.boundaryNextNumber) && concept.boundaryNextNumber! > 0 ? concept.boundaryNextNumber! : 1;
  for (const entry of concept.boundaryCaseNumbers || []) {
    if (!entry || !entry.text || !Number.isSafeInteger(entry.number) || entry.number < 1 || numbers.has(entry.text) || used.has(entry.number)) continue;
    numbers.set(entry.text, entry.number);
    used.add(entry.number);
    nextNumber = Math.max(nextNumber, entry.number + 1);
  }
  // Old records did not track cross-zone insertion order. Seed from the
  // original groups before applying a move, then persist new numbers.
  for (const text of [...Object.values(boundaryCases(concept)).flat(), ...Object.values(next).flat()]) {
    if (!numbers.has(text)) numbers.set(text, nextNumber++);
  }
  const active = new Set(Object.values(next).flat());
  return {
    numbers,
    patch: {
      boundaryCaseNumbers: [...numbers].filter(([text]) => active.has(text)).map(([text, number]) => ({ text, number })),
      boundaryNextNumber: nextNumber,
    },
  };
}

/**
 * Where a concept's edge is recorded.
 *
 * Three fields mark it: the concepts this one is explicitly not the same as,
 * the cases that fall outside it, and the cases sitting on its line. What
 * *fits* is not an edge — it is the inside of the shape — so `examples` is
 * deliberately absent here while remaining one of the bench's sorting zones.
 *
 * This list is the single definition of what each field means. Anything that
 * draws a concept's boundary reads it from here rather than naming the fields
 * again, so the Atlas and the concept page can never disagree about which
 * records count.
 */
export const CONCEPT_EDGE_FIELDS = [
  { field: 'notSameAs', kind: 'not the same as' },
  { field: 'counterexamples', kind: 'counterexample' },
  { field: 'edgeCases', kind: 'edge case' },
] as const;

export type BoundaryKind = typeof CONCEPT_EDGE_FIELDS[number]['kind'];
export interface ConceptBoundaryMark { kind: BoundaryKind; text: string; reason?: string }

type EdgeSource = Pick<Concept, 'notSameAs' | 'counterexamples' | 'edgeCases' | 'caseReasons'>;

/**
 * Everything a concept records about its own edge, whether or not the person
 * wrote down why. A boundary exists the moment it is drawn; the reasoning is
 * welcome but not the thing that makes it real — which is why this is a wider
 * set than `conceptBoundaryFindings`, and why the two are not interchangeable.
 * Nothing is inferred: a concept with none of these fields filled has no edge
 * recorded, and surfaces that draw one should draw nothing.
 */
export function conceptBoundaryMarks(concept: EdgeSource): ConceptBoundaryMark[] {
  const seen = new Set<string>();
  return CONCEPT_EDGE_FIELDS.flatMap(({ field, kind }) => (concept[field] ?? []).flatMap((value) => {
    const text = (value ?? '').trim();
    if (!text || seen.has(text)) return [];
    seen.add(text);
    const reason = concept.caseReasons?.[text]?.trim();
    return [{ kind, text, ...(reason ? { reason } : {}) }];
  }));
}

/**
 * The subset of the edge that the person has reasoned about: a sorted case
 * with a saved reason. This is what the definition review reads, because a
 * review has nothing to work with until there is a stated why. It counts the
 * `fits` zone as well — a review is about the whole sorting, not only the edge.
 */
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
