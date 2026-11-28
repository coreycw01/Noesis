'use client';

import { useId, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchField } from '@/components/shared/SearchField';
import { searchMatches } from '@/lib/search';

export interface LinkableRecord<T extends string> {
  id: string;
  type: T;
  title: string;
  label: string;
  linked?: boolean;
}

export function RecordLinkPicker<T extends string>({ records, onLink, disabled, description }: {
  records: readonly LinkableRecord<T>[];
  onLink: (record: LinkableRecord<T>) => Promise<boolean>;
  disabled?: boolean;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const group = useId();
  const matches = open ? records.filter(record => searchMatches(query, [{ value: record.title }, { value: record.label }])) : [];
  const keyOf = (record: LinkableRecord<T>) => `${record.type}:${record.id}`;
  const choice = matches.find(record => keyOf(record) === selected);
  const changeOpen = (next: boolean) => {
    if (!next && lock.current) return;
    setOpen(next);
    if (!next) { setQuery(''); setSelected(''); }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11 justify-self-start" disabled={disabled}>
          <Link2 className="size-4" aria-hidden="true" /> Link a record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto]">
        <DialogHeader><DialogTitle>Link a record</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <SearchField value={query} onChange={value => { setQuery(value); setSelected(''); }} label="Search linkable records" placeholder="Search by title or type" />
        <fieldset disabled={saving} className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
          <legend className="sr-only">Matching records</legend>
          {matches.length ? matches.map(record => (
            <label key={keyOf(record)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--button-radius)] px-2 py-1.5 hover:bg-muted has-[:checked]:bg-muted">
              <input type="radio" name={group} className="shrink-0 accent-primary" checked={selected === keyOf(record)} onChange={() => setSelected(keyOf(record))} />
              <span className="min-w-0 flex-1 break-words text-sm">{record.title}</span>
              <span className="shrink-0 text-xs font-medium text-tone" data-tone={record.type}>{record.label}{record.linked && ' · Linked'}</span>
            </label>
          )) : <p role="status" className="py-2 text-sm text-muted-foreground">{records.length ? 'No records match your search.' : 'No records available to link.'}</p>}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant={choice?.linked ? 'outline' : 'default'} disabled={!choice || saving || disabled} onClick={async () => {
            if (!choice || lock.current) return;
            lock.current = true; setSaving(true);
            try {
              if (await onLink(choice)) { lock.current = false; changeOpen(false); }
            } finally { lock.current = false; setSaving(false); }
          }}>{saving ? 'Saving...' : choice?.linked ? 'Unlink selected record' : 'Link selected record'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
