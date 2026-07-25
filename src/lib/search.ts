export type SearchField = {
  value?: string | number | null;
  label?: string;
};

export type SearchMatch = {
  matched: boolean;
  score: number;
  matchedField?: string;
};

export function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchSearch(query: string, fields: SearchField[]): SearchMatch {
  const needle = normalizeSearchText(query);
  if (!needle) return { matched: true, score: 0 };

  let best: SearchMatch = { matched: false, score: 0 };
  fields.forEach((field, index) => {
    const value = normalizeSearchText(field.value);
    if (!value) return;
    const score = value === needle
      ? 1000 - index
      : value.startsWith(needle)
        ? 800 - index
        : value.includes(needle)
          ? 500 - index
          : 0;
    if (score > best.score) {
      best = { matched: true, score, matchedField: field.label };
    }
  });
  return best;
}

export function searchMatches(query: string, fields: SearchField[]) {
  return matchSearch(query, fields).matched;
}
