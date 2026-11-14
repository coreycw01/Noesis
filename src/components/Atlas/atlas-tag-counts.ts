import { conceptKey } from '@/lib/readex';

export function countAtlasConceptTags(tagLists: Iterable<readonly string[] | undefined>) {
  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const key of new Set(tags?.map(conceptKey))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
