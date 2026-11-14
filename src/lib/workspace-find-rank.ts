export function findMatchRank(query: string, label: string, searchable: string): number {
  if (!query) return 1;
  const title = label.toLowerCase();
  if (title === query) return 4;
  if (title.startsWith(query)) return 3;
  if (title.includes(query)) return 2;
  return searchable.toLowerCase().includes(query) ? 1 : 0;
}
