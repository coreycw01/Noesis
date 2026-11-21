import { normalizeContextDeskSelection } from './context-desk-selection';

export const MAX_DESK_ITEMS = 300;
export const MAX_SAVED_DESKS = 8;
export const MAX_DESK_PAYLOAD_BYTES = 750_000;
export const CONTEXT_DESK_TYPES = ['source', 'annotation', 'concept', 'inquiry', 'position', 'work', 'practice'] as const;
export type DeskRecordType = typeof CONTEXT_DESK_TYPES[number];

export interface DeskMembership {
  selected: string[];
  keys: string[];
  types: DeskRecordType[];
  sourceIds: string[];
}
export interface SavedContextDesk extends DeskMembership {
  id: string;
  name: string;
  revision: string;
}
export const EMPTY_DESK: DeskMembership = { selected: [], keys: [], types: [], sourceIds: [] };

export function readDeskMembership(value: unknown): DeskMembership {
  const raw = value && typeof value === 'object' ? value as Partial<DeskMembership> : {};
  return {
    selected: normalizeContextDeskSelection(raw.selected, MAX_DESK_ITEMS),
    keys: normalizeContextDeskSelection(raw.keys, Infinity),
    types: CONTEXT_DESK_TYPES.filter(type => Array.isArray(raw.types) && raw.types.includes(type)),
    sourceIds: normalizeContextDeskSelection(raw.sourceIds, Infinity),
  };
}

export function readSavedDesks(value: unknown): SavedContextDesk[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(raw => {
    if (!raw || typeof raw.id !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(raw.id) || seen.has(raw.id)
      || typeof raw.revision !== 'string' || !raw.revision || typeof raw.name !== 'string' || !raw.name.trim()) return [];
    seen.add(raw.id);
    return [{ ...readDeskMembership(raw), id: raw.id, name: raw.name.trim().slice(0, 80), revision: raw.revision }];
  }).slice(0, MAX_SAVED_DESKS);
}

export function replaceSavedDesk(current: SavedContextDesk[], id: string, expectedRevision: string | null, replacement: SavedContextDesk | null) {
  const existing = current.find(desk => desk.id === id);
  if ((existing?.revision ?? null) !== expectedRevision) throw new Error('This desk changed on another device. Reopen it before saving again.');
  if (replacement && !existing && current.length >= MAX_SAVED_DESKS) throw new Error('Delete a Drawer before creating another.');
  const next = replacement
    ? existing ? current.map(desk => desk.id === id ? replacement : desk) : [...current, replacement]
    : current.filter(desk => desk.id !== id);
  if (new TextEncoder().encode(JSON.stringify(next)).length > MAX_DESK_PAYLOAD_BYTES) throw new Error('Your Drawers are too large to save. Remove some records and try again.');
  return next;
}
