/**
 * What is missing from a set, and what the set is made of.
 *
 * The Context Desk is the only surface in Noesis that holds records from
 * different pages at once, so it is the only one that can say "two things here
 * cite a book you have not brought" or "this is all inquiries". Both answers
 * come from links the workspace already stores — nothing here calls a model.
 */

/** The parts of a desk record these rules read. */
export interface DeskItem {
  key: string;
  type: string;
  label: string;
  sourceIds: readonly string[];
  conceptIds: readonly string[];
  /** Inquiries only: still open, so still worth pulling in. */
  open?: boolean;
}

export interface DeskSuggestion {
  key: string;
  /** Why this one, in words a person can disagree with. */
  why: string;
}

/** A source two or more records lean on is probably worth having present. */
const SHARED_BY = 2;

/**
 * Records worth bringing onto the desk, newest rule last so the earlier ones
 * win a tie. Each rule names its reason; none of them guesses.
 */
export function deskSuggestions(
  onDesk: readonly DeskItem[],
  pool: readonly DeskItem[],
  nameFor: (key: string) => string,
  limit = 3,
): DeskSuggestion[] {
  const seated = new Set(onDesk.map((item) => item.key));
  const out: DeskSuggestion[] = [];
  const take = (key: string, why: string) => {
    if (seated.has(key) || out.some((item) => item.key === key)) return;
    out.push({ key, why });
  };

  // 1. A source several records on the desk cite, which is not itself here.
  const citedBy = new Map<string, number>();
  for (const item of onDesk) {
    for (const sourceId of new Set(item.sourceIds)) {
      // A source sitting on the desk cites itself; that is not a suggestion.
      if (item.type === 'source') continue;
      citedBy.set(sourceId, (citedBy.get(sourceId) || 0) + 1);
    }
  }
  const sources = pool.filter((item) => item.type === 'source');
  for (const [sourceId, count] of [...citedBy].sort((a, b) => b[1] - a[1])) {
    if (count < SHARED_BY) continue;
    const source = sources.find((item) => item.sourceIds.includes(sourceId) || item.key.endsWith(sourceId));
    if (source) take(source.key, `Cited by ${count} records on this desk, but not here`);
  }

  // 2. An inquiry still open on a concept that is on the desk.
  const concepts = new Set(onDesk.flatMap((item) => item.conceptIds));
  for (const item of pool) {
    if (item.type !== 'inquiry' || !item.open) continue;
    const shared = item.conceptIds.find((id) => concepts.has(id));
    if (shared) take(item.key, `Still open on ${nameFor(shared)}, which is on this desk`);
  }

  // 3. A concept two or more records are about, which is not here as a record
  //    of its own — the definition everything is leaning on, unstated.
  const aboutCount = new Map<string, number>();
  for (const item of onDesk) {
    if (item.type === 'concept') continue;
    for (const id of new Set(item.conceptIds)) aboutCount.set(id, (aboutCount.get(id) || 0) + 1);
  }
  const onDeskConcepts = new Set(onDesk.filter((item) => item.type === 'concept').flatMap((item) => item.conceptIds));
  for (const [conceptId, count] of [...aboutCount].sort((a, b) => b[1] - a[1])) {
    if (count < SHARED_BY || onDeskConcepts.has(conceptId)) continue;
    const concept = pool.find((item) => item.type === 'concept' && item.conceptIds.includes(conceptId));
    if (concept) take(concept.key, `${count} records here are about it, but the concept itself is not`);
  }

  return out.slice(0, limit);
}

export interface DeskComposition {
  /** Kinds present, most numerous first. */
  counts: Array<{ type: string; count: number }>;
  kinds: number;
  total: number;
  /** Whether the spread is worth remarking on, and what to say. */
  tone: 'empty' | 'thin' | 'fair' | 'good';
  verdict: string;
}

/**
 * What the desk is made of.
 *
 * A set drawn from one page is usually a weak request: a review finds tension
 * between things, and there is little tension among six annotations from the
 * same book. The count of *kinds* is the signal, not the count of records.
 */
export function deskComposition(onDesk: readonly DeskItem[], labelFor: (type: string) => string): DeskComposition {
  const counts = new Map<string, number>();
  for (const item of onDesk) counts.set(item.type, (counts.get(item.type) || 0) + 1);
  const ordered = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => ({ type, count }));
  const kinds = ordered.length;
  const total = onDesk.length;

  if (!total) return { counts: ordered, kinds, total, tone: 'empty', verdict: 'Nothing on the desk yet.' };
  if (kinds === 1) {
    const only = labelFor(ordered[0].type).toLowerCase();
    return {
      counts: ordered, kinds, total, tone: 'thin',
      verdict: `All ${only}${only.endsWith('s') ? '' : 's'}. A set drawn from one place rarely turns up a tension.`,
    };
  }
  if (kinds >= 4) {
    return {
      counts: ordered, kinds, total, tone: 'good',
      verdict: `${kinds} kinds of record from across the workspace — the kind of set worth a review.`,
    };
  }
  return {
    counts: ordered, kinds, total, tone: 'fair',
    verdict: `${kinds} kinds of record. Adding a different kind usually sharpens what comes back.`,
  };
}
