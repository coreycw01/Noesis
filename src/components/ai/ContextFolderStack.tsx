'use client';

import { useRef, useState } from 'react';
import { Check, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import { useContextShelf } from '@/components/ai/use-context-shelf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import {
  MAX_FOLDERS, MAX_FOLDER_ITEMS, folderAdditions, replaceFolder, toggleFolderItem,
  type ContextFolder,
} from '@/lib/context-folders';

/**
 * Folders: a few records you keep reaching for, carried into any drawer.
 *
 * Opening a folder and using a folder are different acts, so they are
 * different buttons. View shows what is inside without touching the desk; Add
 * to desk is the one that moves things. A folder that put its contents on the
 * desk just because you looked at it would make looking expensive.
 */
export function ContextFolderStack({ uid, onDesk, labelFor, onAdd, onRemove, filing, onFiled }: {
  uid: string;
  onDesk: readonly string[];
  /** A record's title, for showing what a folder holds. */
  labelFor: (key: string) => string | undefined;
  onAdd: (keys: string[]) => void;
  onRemove: (keys: string[]) => void;
  /** A single record waiting to be filed, from a slip's folder button. */
  filing?: string | null;
  onFiled?: () => void;
}) {
  const { entries: folders, loading, error, update } = useContextShelf(uid, 'folder');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [manage, setManage] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContextFolder | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);

  async function write(id: string, prior: ContextFolder | null, next: ContextFolder | null, note: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      await update(current => replaceFolder(current, id, prior?.revision ?? null, next));
      setMessage(note);
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : 'Could not update your folders.');
    } finally { lock.current = false; setBusy(false); }
  }

  const create = async () => {
    const label = name.trim();
    if (!label) return;
    const items = filing ? [filing] : [...onDesk].slice(0, MAX_FOLDER_ITEMS);
    const id = crypto.randomUUID();
    await write(id, null, { id, name: label, items, revision: crypto.randomUUID() }, `Saved “${label}”.`);
    setName(''); setNaming(false); onFiled?.();
  };

  const rename = async (folder: ContextFolder) => {
    const label = renameTo.trim();
    if (!label || label === folder.name) { setRenaming(null); return; }
    await write(folder.id, folder, { ...folder, name: label, revision: crypto.randomUUID() }, `Renamed to “${label}”.`);
    setRenaming(null);
  };

  const file = async (folder: ContextFolder) => {
    if (!filing) return;
    const next = toggleFolderItem(folder, filing);
    if (!next.items.includes(filing) && folder.items.length >= MAX_FOLDER_ITEMS && !folder.items.includes(filing)) {
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
      <div className="flex items-center gap-1">
        <p className="noesis-eyebrow">Folders</p>
        <Button type="button" variant="ghost" size="icon" className="ml-auto size-7"
          aria-pressed={manage} aria-label={manage ? 'Done editing folders' : 'Edit folders'}
          title={manage ? 'Done' : 'Rename or delete folders'}
          onClick={() => { setManage((open) => !open); setRenaming(null); }}>
          {manage ? <Check className="size-3.5" /> : <Settings2 className="size-3.5" />}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
          disabled={folders.length >= MAX_FOLDERS || !!error}
          title={folders.length >= MAX_FOLDERS ? `You already have ${MAX_FOLDERS} folders` : 'Keep these records in a new folder'}
          onClick={() => setNaming((open) => !open)}>
          <Plus className="size-3.5" aria-hidden="true" />New
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
          const open = viewing === folder.id;
          return (
            <div key={folder.id} className="noesis-folder" data-in={carried || undefined} data-open={open || undefined}>
              <span className="noesis-folder__mark" aria-hidden="true">{filing ? (holds ? '✓' : '+') : carried ? '✓' : '📁'}</span>

              {renaming === folder.id ? (
                <Input value={renameTo} maxLength={40} autoFocus aria-label={`Rename ${folder.name}`}
                  className="h-7 min-w-0 flex-1 text-sm" disabled={busy}
                  onChange={(event) => setRenameTo(event.target.value)}
                  onBlur={() => void rename(folder)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); void rename(folder); }
                    if (event.key === 'Escape') setRenaming(null);
                  }} />
              ) : (
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              )}
              <small className="noesis-figure noesis-figure--sm">{folder.items.length}</small>

              {/* Filing one record is its own mode: the whole row becomes the target. */}
              {filing ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void file(folder)}>
                  {holds ? 'Remove' : 'Keep here'}
                </Button>
              ) : manage ? (
                <span className="flex gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Rename ${folder.name}`}
                    onClick={() => { setRenaming(folder.id); setRenameTo(folder.name); }}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7 text-[hsl(var(--problem))]"
                    aria-label={`Delete ${folder.name}`} onClick={() => setDeleting(folder)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              ) : (
                <span className="flex gap-0.5">
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"
                    aria-expanded={open} onClick={() => setViewing(open ? null : folder.id)}>
                    {open ? 'Hide' : 'View'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"
                    onClick={() => {
                      if (carried) { onRemove(folder.items); setMessage(`Took “${folder.name}” back off the desk.`); return; }
                      const additions = folderAdditions(folder, onDesk);
                      onAdd(additions);
                      setMessage(`Carried ${additions.length} in from “${folder.name}”.`);
                    }}>
                    {carried ? 'Off desk' : 'Add to desk'}
                  </Button>
                </span>
              )}

              {open && !filing && !manage && (
                <ul className="mt-1 grid w-full basis-full gap-1 border-t border-[hsl(var(--kind-concept)/.35)] pt-2">
                  {folder.items.map((key) => (
                    <li key={key} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{labelFor(key) || 'No longer available'}</span>
                      <Button type="button" variant="ghost" size="icon" className="size-6" disabled={busy}
                        aria-label={`Take ${labelFor(key) || 'this record'} out of ${folder.name}`}
                        onClick={() => void write(folder.id, folder, { ...folder, items: folder.items.filter((item) => item !== key), revision: crypto.randomUUID() }, 'Taken out of the folder.')}>
                        <X className="size-3" />
                      </Button>
                    </li>
                  ))}
                  {!folder.items.length && <li className="text-xs text-muted-foreground">This folder is empty.</li>}
                </ul>
              )}
            </div>
          );
        })}
        {!folders.length && !loading && (
          <p className="text-xs leading-5 text-muted-foreground">No folders yet. Keep the handful you always reach for in one.</p>
        )}
      </div>

      <ConfirmActionDialog
        open={deleting !== null}
        onOpenChange={(next) => { if (!next) setDeleting(null); }}
        title={`Delete the folder “${deleting?.name ?? ''}”?`}
        description="This deletes the folder only. Every record it held stays exactly where it is — nothing in your Library, Positions, Inquiries or Works is removed."
        confirmLabel="Delete the folder"
        destructive
        onConfirm={async () => {
          if (deleting) await write(deleting.id, deleting, null, `Deleted “${deleting.name}”. Its records are untouched.`);
          setDeleting(null);
        }}
      />

      <p role="status" className="text-xs leading-5 text-muted-foreground">
        {loading ? 'Loading your folders…'
          : error ? 'Folders are unavailable right now.'
            : message || `${folders.length} of ${MAX_FOLDERS} folders · up to ${MAX_FOLDER_ITEMS} records each`}
      </p>
    </div>
  );
}
