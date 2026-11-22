'use client';

import { useMemo, useRef, useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { MAX_SAVED_DESKS, readDeskMembership, readSavedDesks, replaceSavedDesk, type DeskMembership, type SavedContextDesk } from '@/lib/saved-context-desks';

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
  const ref = useMemo(() => doc(initializeFirebase().firestore, 'users', uid, 'settings', 'contextDesks'), [uid]);
  const { data, loading, error } = useDoc(ref);
  const drawers = useMemo(() => readSavedDesks(data?.desks), [data]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState<SavedContextDesk | null>(null);
  const lock = useRef(false);
  const normalized = readDeskMembership(membership);
  const dirty = normalized.selected.length > 0;

  async function write(id: string, prior: SavedContextDesk | null, next: SavedContextDesk | null, note: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      await runTransaction(ref.firestore, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const desks = replaceSavedDesk(readSavedDesks(snapshot.data()?.desks), id, prior?.revision ?? null, next);
        transaction.set(ref, { schemaVersion: 1, desks });
      });
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

  const open = (drawer: SavedContextDesk) => {
    onOpen(readDeskMembership(drawer), drawer);
    onOpened(drawer.id);
    setMessage(`Opened “${drawer.name}”. Nothing has been sent.`);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <p className="noesis-eyebrow">Drawers</p>
        <Button type="button" variant="outline" size="sm" className="ml-auto h-7 px-2 text-xs"
          disabled={drawers.length >= MAX_SAVED_DESKS || !!error}
          title={drawers.length >= MAX_SAVED_DESKS ? `You already have ${MAX_SAVED_DESKS} drawers` : 'Save this desk as a new drawer'}
          onClick={() => setNaming((open) => !open)}>
          <Plus className="size-3.5" aria-hidden="true" />New drawer
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
          <button key={drawer.id} type="button" className="noesis-drawer" data-on={drawer.id === openId || undefined}
            onClick={() => { if (dirty && drawer.id !== openId) setConfirming(drawer); else open(drawer); }}>
            <span className="min-w-0 truncate">{drawer.name}</span>
            <small className="noesis-figure noesis-figure--sm">{drawer.selected.length}</small>
          </button>
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
      <p role="status" className="text-xs leading-5 text-muted-foreground">
        {loading ? 'Loading your drawers…' : error ? 'Drawers are unavailable right now.' : message}
      </p>
    </div>
  );
}
