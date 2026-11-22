'use client';

import { useMemo, useRef, useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MAX_FOLDERS, MAX_FOLDER_ITEMS, folderAdditions, readFolders, replaceFolder, toggleFolderItem,
  type ContextFolder,
} from '@/lib/context-folders';

/**
 * Folders: a few records you keep reaching for, carried into any drawer.
 *
 * Drawn as a stack of folders rather than a list, because that is what they
 * are — you pull one out, drop its contents on the desk, and push it back.
 * The same folder can sit in every drawer at once, which is the whole reason
 * it is not simply a smaller drawer.
 */
export function ContextFolderStack({ uid, onDesk, onAdd, onRemove, filing, onFiled }: {
  uid: string;
  onDesk: readonly string[];
  onAdd: (keys: string[]) => void;
  onRemove: (keys: string[]) => void;
  /** A single record waiting to be filed, from a slip's folder button. */
  filing?: string | null;
  onFiled?: () => void;
}) {
  const ref = useMemo(() => doc(initializeFirebase().firestore, 'users', uid, 'settings', 'contextFolders'), [uid]);
  const { data, loading, error } = useDoc(ref);
  const folders = useMemo(() => readFolders(data?.folders), [data]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  async function write(id: string, prior: ContextFolder | null, next: ContextFolder | null, note: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      await runTransaction(ref.firestore, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const updated = replaceFolder(readFolders(snapshot.data()?.folders), id, prior?.revision ?? null, next);
        transaction.set(ref, { schemaVersion: 1, folders: updated });
      });
      setMessage(note);
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : 'Could not update your folders.');
    } finally { lock.current = false; setBusy(false); }
  }

  const create = async () => {
    const label = name.trim();
    if (!label) return;
    // A folder made from a slip holds that one record; made from the button, it
    // takes what is on the desk, up to the cap.
    const items = filing ? [filing] : [...onDesk].slice(0, MAX_FOLDER_ITEMS);
    const id = crypto.randomUUID();
    await write(id, null, { id, name: label, items, revision: crypto.randomUUID() }, `Saved “${label}”.`);
    setName(''); setNaming(false); onFiled?.();
  };

  const carry = (folder: ContextFolder) => {
    const additions = folderAdditions(folder, onDesk);
    if (additions.length) { onAdd(additions); setMessage(`Carried ${additions.length} in from “${folder.name}”.`); }
    else { onRemove(folder.items); setMessage(`Took “${folder.name}” back off the desk.`); }
  };

  const file = async (folder: ContextFolder) => {
    if (!filing) return;
    const next = toggleFolderItem(folder, filing);
    if (next.items.length === folder.items.length && !next.items.includes(filing)) {
      setMessage(`“${folder.name}” already holds ${MAX_FOLDER_ITEMS} records.`);
      return;
    }
    await write(folder.id, folder, { ...next, revision: crypto.randomUUID() },
      next.items.includes(filing) ? `Kept in “${folder.name}”.` : `Removed from “${folder.name}”.`);
    onFiled?.();
  };

  const seated = new Set(onDesk);
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <p className="noesis-eyebrow">Folders</p>
        <Button type="button" variant="outline" size="sm" className="ml-auto h-7 px-2 text-xs"
          disabled={folders.length >= MAX_FOLDERS || !!error}
          title={folders.length >= MAX_FOLDERS ? `You already have ${MAX_FOLDERS} folders` : 'Keep these records in a new folder'}
          onClick={() => setNaming((open) => !open)}>
          <Plus className="size-3.5" aria-hidden="true" />New folder
        </Button>
      </div>

      {naming && (
        <div className="grid gap-1.5">
          <div className="flex gap-2">
            <Input value={name} maxLength={40} placeholder="Name this folder" aria-label="Name this folder"
              className="h-9" disabled={busy}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void create(); } }} />
            <Button type="button" variant="secondary" tone="ai" size="sm" disabled={busy || !name.trim()} onClick={() => void create()}>Save</Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {filing ? 'Holds the one record you are filing.' : `Takes what is on the desk, up to ${MAX_FOLDER_ITEMS}.`}
          </p>
        </div>
      )}

      {filing && !naming && <p className="text-xs leading-5 text-[hsl(var(--kind-concept))]">Choose a folder to keep this record in.</p>}

      <div className="noesis-folders">
        {folders.map((folder) => {
          const carried = folder.items.length > 0 && folder.items.every((key) => seated.has(key));
          const holds = filing ? folder.items.includes(filing) : false;
          return (
            <button key={folder.id} type="button" className="noesis-folder" data-in={carried || undefined} disabled={busy}
              title={filing ? `Keep this record in ${folder.name}` : carried ? 'Take these back off the desk' : 'Carry these onto the desk'}
              onClick={() => (filing ? void file(folder) : carry(folder))}>
              <span className="noesis-folder__mark" aria-hidden="true">{filing ? (holds ? '✓' : '+') : carried ? '✓' : '+'}</span>
              <span className="min-w-0 truncate">{folder.name}</span>
              <small className="noesis-figure noesis-figure--sm">{folder.items.length}</small>
            </button>
          );
        })}
        {!folders.length && !loading && (
          <p className="text-xs leading-5 text-muted-foreground">No folders yet. Keep the handful you always reach for in one.</p>
        )}
      </div>

      <p role="status" className="text-xs leading-5 text-muted-foreground">
        {loading ? 'Loading your folders…'
          : error ? 'Folders are unavailable right now.'
            : message || `${folders.length} of ${MAX_FOLDERS} folders · up to ${MAX_FOLDER_ITEMS} records each`}
      </p>
    </div>
  );
}
