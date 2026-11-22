import { normalizeContextDeskSelection } from './context-desk-selection';

/**
 * Folders: a few records you keep reaching for, carried into any drawer.
 *
 * A Drawer is a whole saved desk — open it and it becomes what you are working
 * on. A Folder is the opposite shape: a handful of staples that can sit in
 * every drawer at once. That is why it is small and why there is a cap; a
 * folder you have to read is just a worse drawer.
 *
 * The records a folder drops are **copies**. Editing a folder later does not
 * reach back into a drawer you already saved, because a saved desk changing
 * behind your back is worse than keeping two of something.
 */

export const MAX_FOLDERS = 10;
export const MAX_FOLDER_ITEMS = 5;
export const MAX_FOLDER_PAYLOAD_BYTES = 120_000;

export interface ContextFolder {
  id: string;
  name: string;
  items: string[];
  revision: string;
}

export function readFolders(value: unknown): ContextFolder[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const folder = raw as Partial<ContextFolder>;
    if (typeof folder.id !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(folder.id) || seen.has(folder.id)) return [];
    if (typeof folder.revision !== 'string' || !folder.revision) return [];
    if (typeof folder.name !== 'string' || !folder.name.trim()) return [];
    seen.add(folder.id);
    return [{
      id: folder.id,
      name: folder.name.trim().slice(0, 80),
      items: normalizeContextDeskSelection(folder.items, MAX_FOLDER_ITEMS),
      revision: folder.revision,
    }];
  }).slice(0, MAX_FOLDERS);
}

/**
 * Put a folder in, take one out, or swap one for another, refusing the write
 * when the copy on this device is not the copy being replaced.
 */
export function replaceFolder(
  current: readonly ContextFolder[],
  id: string,
  expectedRevision: string | null,
  replacement: ContextFolder | null,
) {
  const existing = current.find((folder) => folder.id === id);
  if ((existing?.revision ?? null) !== expectedRevision) {
    throw new Error('This folder changed on another device. Open it again before saving.');
  }
  if (replacement && !existing && current.length >= MAX_FOLDERS) {
    throw new Error(`You already have ${MAX_FOLDERS} folders. Delete one before making another.`);
  }
  if (replacement && replacement.items.length > MAX_FOLDER_ITEMS) {
    throw new Error(`A folder holds up to ${MAX_FOLDER_ITEMS} records.`);
  }
  const next = replacement
    ? existing
      ? current.map((folder) => (folder.id === id ? replacement : folder))
      : [...current, replacement]
    : current.filter((folder) => folder.id !== id);
  if (new TextEncoder().encode(JSON.stringify(next)).length > MAX_FOLDER_PAYLOAD_BYTES) {
    throw new Error('Your folders are too large to save. Remove a few records and try again.');
  }
  return next;
}

/** Add or remove one record from a folder, within the cap. */
export function toggleFolderItem(folder: ContextFolder, key: string): ContextFolder {
  if (folder.items.includes(key)) {
    return { ...folder, items: folder.items.filter((item) => item !== key) };
  }
  if (folder.items.length >= MAX_FOLDER_ITEMS) return folder;
  return { ...folder, items: [...folder.items, key] };
}

/** The records a folder would add to this desk, in order, skipping duplicates. */
export function folderAdditions(folder: ContextFolder, onDesk: readonly string[]) {
  const seated = new Set(onDesk);
  return folder.items.filter((key) => !seated.has(key));
}
