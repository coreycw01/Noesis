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

export function SavedContextDesks({ uid, membership, onOpen }: { uid: string; membership: DeskMembership; onOpen: (membership: DeskMembership) => void }) {
  const ref = useMemo(() => doc(initializeFirebase().firestore, 'users', uid, 'settings', 'contextDesks'), [uid]);
  const { data, loading, error } = useDoc(ref);
  const desks = useMemo(() => readSavedDesks(data?.desks), [data]);
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

  function openDesk() {
    const desk = desks.find(item => item.id === pick);
    if (!desk) return;
    onOpen(readDeskMembership(desk)); setOpened(desk); setName(desk.name); setMessage('Desk opened.');
  }
  function open() {
    if (!desks.some(item => item.id === pick)) return;
    if (dirty) { setConfirming('open'); return; }
    openDesk();
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
      setMessage(next ? 'Desk saved to your account.' : 'Saved desk deleted. Current selection is still on this device.');
    } catch (error) {
      setMessage(error instanceof Error && error.message.startsWith('This desk changed')
        ? error.message : 'Could not update saved desks. Check your connection and retry. Your current selection is unchanged.');
    } finally { lock.current = false; setBusy(false); }
  }

  return <section aria-label="Saved desks" className="my-4 grid gap-3 border-y border-border py-3">
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 basis-44">
        <label htmlFor="context-desk-name" className="mb-1 block text-xs text-muted-foreground">Desk name</label>
        <Input id="context-desk-name" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Name this desk" disabled={busy} />
      </div>
      <Button onClick={() => void change('save')} disabled={busy || loading || !!error || !name.trim() || (!opened && desks.length >= MAX_SAVED_DESKS)}><Save size={16} />Save desk</Button>
      {opened && <Button variant="outline" onClick={() => void change('copy')} disabled={busy || loading || !!error || !name.trim() || desks.length >= MAX_SAVED_DESKS}>Save as new</Button>}
    </div>
    {desks.length > 0 && <div className="flex flex-wrap items-center gap-2">
      <Select value={pick} onValueChange={setPick}><SelectTrigger aria-label="Saved desks" className="min-w-0 flex-1 basis-44"><SelectValue placeholder="Choose a saved desk" /></SelectTrigger><SelectContent>{desks.map(desk => <SelectItem value={desk.id} key={desk.id}>{desk.name}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" disabled={busy || !pick} onClick={open}><FolderOpen size={16} />Open</Button>
      {opened && <Button variant="destructive" onClick={() => setConfirming('delete')} disabled={busy || !!error}>Delete saved desk</Button>}
    </div>}
    <ConfirmActionDialog
      open={confirming !== null}
      onOpenChange={(next) => { if (!next) setConfirming(null); }}
      title={confirming === 'delete' ? 'Delete this saved desk?' : 'Replace your unsaved selection?'}
      description={confirming === 'delete'
        ? 'The desk is removed from your account. Its source records are not deleted.'
        : 'Opening this desk replaces the selection and exclusions you have not saved.'}
      confirmLabel={confirming === 'delete' ? 'Delete saved desk' : 'Open the desk'}
      destructive={confirming === 'delete'}
      onConfirm={async () => { if (confirming === 'delete') await change('delete'); else openDesk(); setConfirming(null); }}
    />
    <p role="status" className="text-xs text-muted-foreground">{loading ? 'Loading saved desks…' : error ? 'Saved desks are unavailable. You can still use this session’s selection.' : message || (dirty && opened ? 'Unsaved desk changes.' : desks.length >= MAX_SAVED_DESKS ? 'Saved desk limit reached.' : '')}</p>
  </section>;
}
