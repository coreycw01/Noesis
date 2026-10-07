import type { Concept } from '@/lib/types';
import { conceptKey, UNSORTED_CONCEPT } from '@/lib/readex';

type IdentifiedRecord = { id?: string | null };

/**
 * Counts durable records by document id. Derived labels and duplicate client
 * entries are deliberately excluded from user-facing object totals.
 */
export function countPersistedRecords<T extends IdentifiedRecord>(records: readonly T[]) {
  return new Set(records.map((record) => record.id).filter((id): id is string => Boolean(id))).size;
}

/**
 * The canonical count used everywhere the interface says "Concepts".
 * Tag-only placeholders are intentionally excluded until the user develops
 * them into an actual concept record.
 */
export function countPersistedConcepts(concepts: readonly Pick<Concept, 'id' | 'name' | 'createdFrom'>[]) {
  return countPersistedRecords(concepts.filter((concept) => (
    conceptKey(concept.name) !== conceptKey(UNSORTED_CONCEPT)
    && concept.createdFrom !== 'tag'
  )));
}
