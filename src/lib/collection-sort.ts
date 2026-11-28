export const COLLECTION_SORT_OPTIONS = [
  { value: 'newest', label: 'Recently updated' },
  { value: 'oldest', label: 'Oldest updated' },
  { value: 'name', label: 'Alphabetical' },
] as const;

export type CollectionOrder = typeof COLLECTION_SORT_OPTIONS[number]['value'];

export function sortCollection<T>(items: readonly T[], order: CollectionOrder, title: (item: T) => string, date: (item: T) => string | undefined) {
  const time = (item: T) => Date.parse(date(item) || '') || 0;
  return [...items].sort((a, b) => {
    const names = title(a).localeCompare(title(b));
    if (order === 'name') return names;
    return (order === 'newest' ? time(b) - time(a) : time(a) - time(b)) || names;
  });
}
