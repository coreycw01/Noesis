export const MARKUP_TONES: Record<string, string> = {
  highlight: 'encounter', excerpt: 'encounter', evidence: 'encounter',
  question: 'examine', objection: 'claim', definition: 'outline',
  claim: 'act', connection: 'integrate', revisit: 'more',
};

export function markupTone(kind: string) {
  return MARKUP_TONES[kind] || 'more';
}
