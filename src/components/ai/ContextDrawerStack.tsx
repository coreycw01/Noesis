'use client';

import { useRef, useState } from 'react';
import { Check, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { useContextShelf } from '@/components/ai/use-context-shelf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { MAX_SAVED_DESKS, readDeskMembership, replaceSavedDesk, type DeskMembership, type SavedContextDesk } from '@/lib/saved-context-desks';

/**
 * The cabinet. Each drawer is a whole saved desk: open one and it becomes what
 * you are working on, which is why they are drawer fronts stacked in a column
 * rather than a dropdown — you are choosing where to work, not setting a value.
 */
export function ContextDrawerStack({ uid, membership, openId, onOpen, onOpened }: {
  uid: string;
  membership: DeskMembership;
  openId: string | null;
  onOpen: (membership: DeskMembership, drawer: SavedContextDesk) => void;
  onOpened: (id: string | null) => void;
}) {
  const { entries: drawers, loading, error, update } = useContextShelf(uid, 'drawer');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState<SavedContextDesk | null>(null);
  const [deleting, setDeleting] = useState<SavedContextDesk | null>(null);
  const [manage, setManage] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const lock = useRef(false);
  const normalized = readDeskMembership(membership);
  const dirty = normalized.selected.length > 0;

  async function write(id: string, prior: SavedContextDesk | null, next: SavedContextDesk | null, note: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      await update(current => replaceSavedDesk(current, id, prior?.revision ?? null, next));
      setMessage(note);
    } catch (problem) {
      setMessage(problem instanceof Error && problem.message.startsWith('This desk changed')
        ? 'This drawer changed on another device. Open it again before saving.'
        : 'Could not update your drawers. Your desk is unchanged.');
    } finally { lock.current = false; setBusy(false); }
  }

  const create = async () => {
    const label = name.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    await write(id, null, { ...normalized, id, name: label, revision: crypto.randomUUID() }, `Saved “${label}”.`);
    setName(''); setNaming(false); onOpened(id);
  };

  const rename = async (drawer: SavedContextDesk) => {
    const label = renameTo.trim();
    if (!label || label === drawer.name) { setRenaming(null); return; }
    await write(drawer.id, drawer, { ...drawer, name: label, revision: crypto.randomUUID() }, `Renamed to “${label}”.`);
    setRenaming(null);
  };

  const open = (drawer: SavedContextDesk) => {
    onOpen(readDeskMembership(drawer), drawer);
    onOpened(drawer.id);
    setMessage(`Opened “${drawer.name}”. Nothing has been sent.`);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <p className="noesis-eyebrow">Drawers</p>
        <Button type="button" variant="ghost" size="icon" className="ml-auto size-7"
          aria-pressed={manage} aria-label={manage ? 'Done editing drawers' : 'Edit drawers'}
          title={manage ? 'Done' : 'Rename or delete drawers'}
          onClick={() => { setManage((open) => !open); setRenaming(null); }}>
          {manage ? <Check className="size-3.5" /> : <Settings2 className="size-3.5" />}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
          disabled={drawers.length >= MAX_SAVED_DESKS || !!error}
          title={drawers.length >= MAX_SAVED_DESKS ? `You already have ${MAX_SAVED_DESKS} drawers` : 'Save this desk as a new drawer'}
          onClick={() => setNaming((open) => !open)}>
          <Plus className="size-3.5" aria-hidden="true" />New
        </Button>
      </div>

      {naming && (
        <div className="flex gap-2">
          <Input value={name} maxLength={40} placeholder="Name this drawer" aria-label="Name this drawer"
            className="h-9" disabled={busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void create(); } }} />
          <Button type="button" variant="secondary" tone="ai" size="sm" disabled={busy || !name.trim()} onClick={() => void create()}>Save</Button>
        </div>
      )}

      <div className="noesis-cabinet">
        {drawers.map((drawer) => (
          manage ? (
            <div key={drawer.id} className="noesis-drawer" data-on={drawer.id === openId || undefined}>
              {renaming === drawer.id ? (
                <Input value={renameTo} maxLength={40} autoFocus aria-label={`Rename ${drawer.name}`}
                  className="h-7 min-w-0 flex-1 text-sm" disabled={busy}
                  onChange={(event) => setRenameTo(event.target.value)}
                  onBlur={() => void rename(drawer)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); void rename(drawer); }
                    if (event.key === 'Escape') setRenaming(null);
                  }} />
              ) : (
                <span className="min-w-0 flex-1 truncate">{drawer.name}</span>
              )}
              <small className="noesis-figure noesis-figure--sm">{drawer.selected.length}</small>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Rename ${drawer.name}`}
                onClick={() => { setRenaming(drawer.id); setRenameTo(drawer.name); }}>
                <Pencil className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-[hsl(var(--problem))]"
                aria-label={`Delete ${drawer.name}`} onClick={() => setDeleting(drawer)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : (
            <button key={drawer.id} type="button" className="noesis-drawer" data-on={drawer.id === openId || undefined}
              onClick={() => { if (dirty && drawer.id !== openId) setConfirming(drawer); else open(drawer); }}>
              <span className="min-w-0 flex-1 truncate">{drawer.name}</span>
              <small className="noesis-figure noesis-figure--sm">{drawer.selected.length}</small>
            </button>
          )
        ))}
        {!drawers.length && !loading && <p className="text-xs leading-5 text-muted-foreground">No drawers yet. Build a desk, then save it as one.</p>}
      </div>

      <ConfirmActionDialog
        open={confirming !== null}
        onOpenChange={(next) => { if (!next) setConfirming(null); }}
        title={`Open “${confirming?.name ?? ''}”?`}
        description="Opening a drawer replaces what is on the desk now. Your records are not changed either way."
        confirmLabel="Open the drawer"
        onConfirm={async () => { if (confirming) open(confirming); setConfirming(null); }}
      />
      <ConfirmActionDialog
        open={deleting !== null}
        onOpenChange={(next) => { if (!next) setDeleting(null); }}
        title={`Delete the drawer “${deleting?.name ?? ''}”?`}
        description="This deletes the saved drawer only. Every record it held stays exactly where it is, and whatever is on the desk now is untouched."
        confirmLabel="Delete the drawer"
        destructive
        onConfirm={async () => {
          if (deleting) {
            await write(deleting.id, deleting, null, `Deleted “${deleting.name}”. Its records are untouched.`);
            if (openId === deleting.id) onOpened(null);
          }
          setDeleting(null);
        }}
      />
      <p role="status" className="text-xs leading-5 text-muted-foreground">
        {loading ? 'Loading your drawers…' : error ? 'Drawers are unavailable right now.' : message}
      </p>
    </div>
  );
}
