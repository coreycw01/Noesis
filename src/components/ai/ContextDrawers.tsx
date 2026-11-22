'use client';

import { useMemo, useRef, useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { FolderOpen, Save } from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { MAX_SAVED_DESKS, readDeskMembership, readSavedDesks, replaceSavedDesk, type DeskMembership, type SavedContextDesk } from '@/lib/saved-context-desks';

/**
 * Drawers: a named set you built on the Desk and can come back to.
 *
 * A Drawer remembers the records you picked and what you ruled out. It does
 * not own those records — they stay where they live, and the same record can
 * sit in as many Drawers as you like. Opening one brings its selection back on
 * to the Desk and runs nothing; it reads the records as they are now, says so
 * when some have since gone, and never quietly adds records that would match
 * today but were not in the Drawer when you saved it.
 */
export function ContextDrawers({ uid, membership, onOpen }: { uid: string; membership: DeskMembership; onOpen: (membership: DeskMembership) => void }) {
  const ref = useMemo(() => doc(initializeFirebase().firestore, 'users', uid, 'settings', 'contextDesks'), [uid]);
  const { data, loading, error } = useDoc(ref);
  const drawers = useMemo(() => readSavedDesks(data?.desks), [data]);
  const [opened, setOpened] = useState<SavedContextDesk | null>(null);
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  // Both confirmations go through the app's own dialog, so they look, read and
  // behave like every other confirmation.
  const [confirming, setConfirming] = useState<'open' | 'delete' | null>(null);
  const normalized = readDeskMembership(membership);
  const dirty = opened
    ? name.trim() !== opened.name || JSON.stringify(normalized) !== JSON.stringify(readDeskMembership(opened))
    : Boolean(name.trim() || normalized.selected.length || normalized.keys.length || normalized.sourceIds.length || normalized.types.length);

  function openDrawer() {
    const drawer = drawers.find(item => item.id === pick);
    if (!drawer) return;
    onOpen(readDeskMembership(drawer));
    setOpened(drawer); setName(drawer.name);
    setMessage(`Opened “${drawer.name}”. Nothing has been sent to Noesis.`);
  }
  function open() {
    if (!drawers.some(item => item.id === pick)) return;
    if (dirty) { setConfirming('open'); return; }
    openDrawer();
  }

  async function change(mode: 'save' | 'copy' | 'delete') {
    if (lock.current) return;
    const prior = mode === 'copy' ? null : opened;
    if (mode === 'delete' && !prior) return;
    if (mode !== 'delete' && !name.trim()) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const id = prior?.id ?? crypto.randomUUID();
      const next = mode === 'delete' ? null : { ...normalized, id, revision: crypto.randomUUID(), name: name.trim() };
      await runTransaction(ref.firestore, async transaction => {
        const doc = await transaction.get(ref);
        const desks = replaceSavedDesk(readSavedDesks(doc.data()?.desks), id, prior?.revision ?? null, next);
        transaction.set(ref, { schemaVersion: 1, desks });
      });
      setOpened(next); setPick(next?.id ?? '');
      if (!next) setName('');
      setMessage(next ? 'Drawer saved to your account.' : 'Drawer deleted. Its records are untouched, and your current selection is still on the Desk.');
    } catch (error) {
      setMessage(error instanceof Error && error.message.startsWith('This desk changed')
        ? 'This Drawer changed on another device. Open it again before saving.'
        : 'Could not update your Drawers. Check your connection and retry. Your current selection is unchanged.');
    } finally { lock.current = false; setBusy(false); }
  }

  return <div className="grid gap-4">
    <div className="grid gap-2">
      <label htmlFor="context-drawer-name" className="text-xs text-muted-foreground">Drawer name</label>
      <Input id="context-drawer-name" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="For example: Attention &amp; technology" disabled={busy} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void change('save')} disabled={busy || loading || !!error || !name.trim() || (!opened && drawers.length >= MAX_SAVED_DESKS)}><Save size={16} />{opened ? 'Save Drawer' : 'Save as Drawer'}</Button>
        {opened && <Button variant="outline" onClick={() => void change('copy')} disabled={busy || loading || !!error || !name.trim() || drawers.length >= MAX_SAVED_DESKS}>Save as new</Button>}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Saves what you picked and what you ruled out. The records themselves stay where they live, and can sit in more than one Drawer.</p>
    </div>

    {drawers.length > 0 && <div className="grid gap-2 border-t border-border pt-4">
      <label className="text-xs text-muted-foreground" id="context-drawer-pick">Your Drawers</label>
      <Select value={pick} onValueChange={setPick}>
        <SelectTrigger aria-labelledby="context-drawer-pick"><SelectValue placeholder="Choose a Drawer" /></SelectTrigger>
        <SelectContent>{drawers.map(drawer => <SelectItem value={drawer.id} key={drawer.id}>{drawer.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="outline" disabled={busy || !pick} onClick={open}><FolderOpen size={16} />Open on the Desk</Button>
      <p className="text-xs leading-5 text-muted-foreground">Opening brings the selection back and reads the records as they are now. It sends nothing to Noesis, and adds nothing that was not in the Drawer.</p>
      {opened && <Button variant="destructive" className="mt-1" onClick={() => setConfirming('delete')} disabled={busy || !!error}>Delete “{opened.name}”</Button>}
    </div>}

    <ConfirmActionDialog
      open={confirming !== null}
      onOpenChange={(next) => { if (!next) setConfirming(null); }}
      title={confirming === 'delete' ? `Delete the Drawer “${opened?.name ?? ''}”?` : 'Replace what is on the Desk?'}
      description={confirming === 'delete'
        ? 'This deletes the Drawer only. Every record it held stays exactly where it is — nothing in your Library, Positions, Inquiries or Works is removed.'
        : 'Opening this Drawer replaces the selection and exclusions you have not saved. Your records are not changed either way.'}
      confirmLabel={confirming === 'delete' ? 'Delete the Drawer' : 'Open the Drawer'}
      destructive={confirming === 'delete'}
      onConfirm={async () => { if (confirming === 'delete') await change('delete'); else openDrawer(); setConfirming(null); }}
    />
    <p role="status" className="text-xs leading-5 text-muted-foreground">{loading ? 'Loading your Drawers…' : error ? 'Drawers are unavailable right now. You can still build a selection on the Desk.' : message || (dirty && opened ? 'This Drawer has unsaved changes.' : drawers.length >= MAX_SAVED_DESKS ? `You have the maximum of ${MAX_SAVED_DESKS} Drawers. Delete one to add another.` : '')}</p>
  </div>;
}
