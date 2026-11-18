/**
 * Export the workspace as a mind map in FreeMind's .mm format, which
 * FreeMind, Freeplane, XMind, MindNode, and most mind-mapping tools open.
 * Concepts are the branches (Noesis is organised around concepts); under each
 * sit the positions, inquiries, sources, and practices that use it. Records
 * that use no concept are gathered under "Not yet tied to a concept".
 */
type Row = Record<string, unknown> & { id: string };

const text = (value: unknown) => (typeof value === 'string' ? value : '').trim();
const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const key = (value: string) => value.trim().toLowerCase();

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
}

interface MindNode { text: string; note?: string; children?: MindNode[]; color?: string }

function render(node: MindNode, depth: number, position?: 'left' | 'right'): string {
  const attrs = [`TEXT="${escapeXml(node.text.slice(0, 240))}"`];
  if (position) attrs.push(`POSITION="${position}"`);
  if (node.color) attrs.push(`COLOR="${node.color}"`);
  if (depth <= 1 && node.children?.length) attrs.push('FOLDED="false"');
  const note = node.note ? `<richcontent TYPE="NOTE"><html><body><p>${escapeXml(node.note)}</p></body></html></richcontent>` : '';
  const children = (node.children || []).map((child) => render(child, depth + 1)).join('');
  return `<node ${attrs.join(' ')}>${note}${children}</node>`;
}

const STAGE_COLORS = { position: '#b2452a', inquiry: '#3b6e72', source: '#a8620c', practice: '#4d7531', concept: '#6d4d8c' };

export function workspaceMindMap(collections: Record<string, unknown>, title = 'Noesis') {
  const rows = (name: string) => (Array.isArray(collections[name]) ? collections[name] as Row[] : []);
  const concepts = rows('concepts').filter((concept) => text(concept.name));
  const positions = rows('vault').filter((position) => !['abandoned', 'rejected'].includes(text(position.status)));
  const inquiries = rows('questions');
  const sources = rows('media');
  const practices = rows('practices');
  const used = new Set<string>();

  const usesConcept = (row: Row, concept: Row) => {
    const name = key(text(concept.name));
    const tags = [...list(row.tags), ...list(row.conceptTags)].map(key);
    return tags.includes(name) || list(row.conceptIds).includes(concept.id);
  };
  const leaf = (kind: keyof typeof STAGE_COLORS, row: Row, label: string, note?: string): MindNode => {
    used.add(`${kind}:${row.id}`);
    return { text: label, note: note || undefined, color: STAGE_COLORS[kind] };
  };
  const group = (label: string, children: MindNode[]): MindNode[] => children.length ? [{ text: `${label} (${children.length})`, children }] : [];

  const branches: MindNode[] = concepts
    .map((concept) => {
      const children = [
        ...group('Positions', positions.filter((row) => usesConcept(row, concept)).map((row) => leaf('position', row, text(row.title) || 'Untitled position', [text(row.statement), typeof row.confidence === 'number' ? `Confidence ${Math.round(row.confidence)}%` : ''].filter(Boolean).join(' · ')))),
        ...group('Inquiries', inquiries.filter((row) => usesConcept(row, concept)).map((row) => leaf('inquiry', row, text(row.text) || 'Untitled inquiry', text(row.answer)))),
        ...group('Sources', sources.filter((row) => usesConcept(row, concept)).map((row) => leaf('source', row, text(row.title) || 'Untitled source', text(row.creator)))),
        ...group('Practices', practices.filter((row) => usesConcept(row, concept)).map((row) => leaf('practice', row, text(row.title) || 'Untitled practice', text(row.description)))),
      ];
      return { text: text(concept.name), note: text(concept.description) || undefined, color: STAGE_COLORS.concept, children, weight: children.length };
    })
    .sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text))
    .map(({ weight: _weight, ...node }) => node);

  const loose = [
    ...group('Positions', positions.filter((row) => !used.has(`position:${row.id}`)).map((row) => ({ text: text(row.title) || 'Untitled position', color: STAGE_COLORS.position }))),
    ...group('Inquiries', inquiries.filter((row) => !used.has(`inquiry:${row.id}`)).map((row) => ({ text: text(row.text) || 'Untitled inquiry', color: STAGE_COLORS.inquiry }))),
    ...group('Sources', sources.filter((row) => !used.has(`source:${row.id}`)).map((row) => ({ text: text(row.title) || 'Untitled source', color: STAGE_COLORS.source }))),
  ];
  if (loose.length) branches.push({ text: 'Not yet tied to a concept', children: loose });

  const body = branches.map((branch, index) => render(branch, 1, index % 2 === 0 ? 'right' : 'left')).join('');
  return `<map version="1.0.1"><node TEXT="${escapeXml(title)}">${body}</node></map>\n`;
}
