'use client';

import { useContext, useId, useRef, useState } from 'react';
import { Archive, FolderOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useContextShelf } from '@/components/ai/use-context-shelf';
import { useToast } from '@/hooks/use-toast';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { NOESIS_ICONS } from '@/lib/noesis-icons';
import { EMPTY_DESK, MAX_DESK_ITEMS, MAX_SAVED_DESKS, replaceSavedDesk } from '@/lib/saved-context-desks';
import { MAX_FOLDER_ITEMS, MAX_FOLDERS, replaceFolder } from '@/lib/context-folders';
import { addContextDeskSelection } from '@/lib/context-desk-selection';

export function ContextDeskFiling({ recordKey, label = 'File in Context Desk' }: { recordKey: string; label?: string }) {
  const workspace = useContext(NoesisWorkspaceKeyContext);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const mode = workspace?.split(':').at(-1);
  const uid = workspace?.slice(0, workspace.lastIndexOf(':'));
  if (!uid || (mode !== 'demo' && (mode !== 'account' || /^\/(demo|review)(\/|$)/.test(path)))) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton type="button" variant="ghost" label={label}><NOESIS_ICONS.context className="size-5" aria-hidden="true" /></IconButton>
      </PopoverTrigger>
      <PopoverContent aria-label="File in Context Desk" align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        {open && <FilingPicker key={recordKey} uid={uid} recordKey={recordKey} onSaved={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function FilingPicker({ uid, recordKey, onSaved }: { uid: string; recordKey: string; onSaved: () => void }) {
  const [kind, setKind] = useState<'drawer' | 'folder'>('drawer');
  const [destination, setDestination] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const id = useId();
  const { toast } = useToast();
  const drawers = useContextShelf(uid, 'drawer');
  const folders = useContextShelf(uid, 'folder');
  const shelf = kind === 'drawer' ? drawers : folders;
  const max = kind === 'drawer' ? MAX_SAVED_DESKS : MAX_FOLDERS;

  async function save() {
    if (!destination || (destination === 'new' && !name.trim()) || lock.current || shelf.loading || shelf.error) return;
    const creating = destination === 'new';
    const item = shelf.entries.find(entry => entry.id === destination);
    if (!creating && !item) return;
    const containerId = creating ? crypto.randomUUID() : destination;
    const revision = crypto.randomUUID();
    const label = item?.name || name.trim();
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (kind === 'drawer') {
        await drawers.update(current => {
          const drawer = current.find(entry => entry.id === containerId);
          if (!drawer && !creating) throw new Error('That drawer no longer exists.');
          if (drawer?.selected.includes(recordKey)) return current;
          if (drawer?.keys.includes(recordKey) || drawer?.types.some(type => recordKey.startsWith(`${type}:`))) {
            throw new Error('This drawer excludes the item. Change its exclusions on Context Desk first.');
          }
          const selected = addContextDeskSelection(drawer?.selected ?? [], recordKey, MAX_DESK_ITEMS);
          if (!selected) throw new Error('This drawer is full.');
          return replaceSavedDesk(current, containerId, drawer?.revision ?? null, { ...(drawer ?? EMPTY_DESK), id: containerId, revision, name: drawer?.name ?? label, selected });
        });
      } else {
        await folders.update(current => {
          const folder = current.find(entry => entry.id === containerId);
          if (!folder && !creating) throw new Error('That folder no longer exists.');
          if (folder?.items.includes(recordKey)) return current;
          const items = addContextDeskSelection(folder?.items ?? [], recordKey, MAX_FOLDER_ITEMS);
          if (!items) throw new Error('This folder is full.');
          return replaceFolder(current, containerId, folder?.revision ?? null, { id: containerId, revision, name: folder?.name ?? label, items });
        });
      }
      toast({ title: `Filed in ${label}` });
      onSaved();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not file this item.');
    } finally { lock.current = false; setBusy(false); }
  }

  return (
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void save(); }}>
      <h2 className="text-sm font-semibold">File in Context Desk</h2>
      <div className="grid grid-cols-2 gap-1" role="group" aria-label="Destination type">
        {([['drawer', Archive], ['folder', FolderOpen]] as const).map(([value, Icon]) => (
          <Button key={value} type="button" disabled={busy} aria-pressed={kind === value} variant={kind === value ? 'secondary' : 'ghost'} onClick={() => { setKind(value); setDestination(''); setName(''); setError(''); }}><Icon className="size-4" aria-hidden="true" />{value === 'drawer' ? 'Drawer' : 'Folder'}</Button>
        ))}
      </div>
      <label htmlFor={id} className="sr-only">Choose a {kind}</label>
      <select id={id} value={destination} disabled={busy || shelf.loading || !!shelf.error} onChange={event => { setDestination(event.target.value); setError(''); }} className="min-h-11 min-w-0 rounded-[var(--button-radius)] border border-border bg-background px-2 text-sm">
        <option value="">{shelf.loading ? 'Loading...' : `Choose a ${kind}`}</option>
        {shelf.entries.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        {shelf.entries.length < max && <option value="new">New {kind}</option>}
      </select>
      {destination === 'new' && <Input value={name} onChange={event => setName(event.target.value)} maxLength={40} aria-label={`New ${kind} name`} placeholder={`Name this ${kind}`} disabled={busy} />}
      {(error || shelf.error) && <p role="alert" className="text-sm text-destructive">{error || 'Saved context is unavailable right now.'}</p>}
      <Button type="submit" disabled={busy || shelf.loading || !!shelf.error || !destination || (destination === 'new' && !name.trim())}>
        {busy ? 'Filing...' : `Add to ${kind}`}
      </Button>
    </form>
  );
}
