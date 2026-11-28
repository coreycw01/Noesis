import { inquirySourceIds } from './inquiry-state';
import { conceptKey } from './readex';
import type { Concept, Draft, Media, Practice, Question, VaultEntry } from './types';

export type SourceConnectionKind = 'concept' | 'position' | 'inquiry' | 'work' | 'practice';
export type SourceConnection = { kind: SourceConnectionKind; id: string; label: string; reason: string; weight: number; date?: string };

export function sourceConnections(source: Media, { concepts, positions, inquiries, works, practices }: {
  concepts: Concept[]; positions: VaultEntry[]; inquiries: Question[]; works: Draft[]; practices: Practice[];
}) {
  const notes = source.annotations || [];
  const positionsFromNotes = new Set(notes.map(note => note.createdPositionId));
  const positionsInNotes = new Set(notes.flatMap(note => note.linkedPositionIds || []));
  const inquiriesFromNotes = new Set(notes.map(note => note.createdInquiryId));
  const tags = new Set((source.tags || []).map(conceptKey));
  const noteTags = new Set(notes.flatMap(note => (note.conceptTags || []).map(conceptKey)));
  const rows: SourceConnection[] = [
    ...positions.flatMap((item): SourceConnection[] => {
      const origin = positionsFromNotes.has(item.id) || item.sourceDocumentId === source.id;
      const linked = positionsInNotes.has(item.id);
      if (!origin && !linked && !item.sourceIds?.includes(source.id)) return [];
      return [{ kind: 'position', id: item.id, label: item.title || item.statement, reason: origin ? 'Formed from this source' : linked ? 'Connected through an annotation' : 'Cites this source', weight: origin ? 4 : linked ? 3 : 2, date: item.dateUpdated || item.dateCreated }];
    }),
    ...inquiries.flatMap((item): SourceConnection[] => {
      const origin = inquiriesFromNotes.has(item.id);
      if (!origin && !inquirySourceIds(item).includes(source.id)) return [];
      return [{ kind: 'inquiry', id: item.id, label: item.text, reason: origin ? 'Grew from an annotation' : 'Uses this source to investigate', weight: origin ? 4 : 2, date: item.dateUpdated || item.dateCreated }];
    }),
    ...works.filter(item => item.sourceIds?.includes(source.id)).map((item): SourceConnection => ({
      kind: 'work', id: item.id, label: item.title, reason: 'Draws on this source', weight: 2, date: item.dateUpdated || item.dateCreated,
    })),
    ...practices.filter(item => item.sourceIds?.includes(source.id)).map((item): SourceConnection => ({
      kind: 'practice', id: item.id, label: item.title, reason: 'Takes this source into practice', weight: 2, date: item.dateUpdated || item.dateCreated,
    })),
    ...concepts.flatMap((item): SourceConnection[] => {
      const names = [item.name, ...(item.aliases || [])].map(conceptKey);
      const direct = item.sourceIds?.includes(source.id);
      const noted = names.some(name => noteTags.has(name));
      if (!direct && !noted && !source.conceptIds?.includes(item.id) && !names.some(name => tags.has(name))) return [];
      return [{ kind: 'concept', id: item.id, label: item.name, reason: direct ? 'Defined with this source' : noted ? 'Tagged in an annotation' : 'Tagged on this source', weight: direct ? 2 : noted ? 1 : 0, date: item.dateUpdated || item.dateCreated }];
    }),
  ];
  return rows.sort((a, b) => b.weight - a.weight || (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0)
    || a.label.localeCompare(b.label));
}
