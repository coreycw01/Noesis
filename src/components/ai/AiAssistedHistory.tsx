'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { ContextualAiDocument } from '@/components/ai/ContextualAiPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { AiAssistedHistoryEntry } from '@/lib/types';

interface AiAssistedHistoryProps {
  entries: AiAssistedHistoryEntry[];
  onChange: (entries: AiAssistedHistoryEntry[]) => void | Promise<void>;
  title?: string;
  description?: string;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function AiAssistedHistory({
  entries,
  onChange,
  title = 'AI-assisted history',
  description = 'Reviewed assistance saved for this item. Expand only the entry you need.',
}: AiAssistedHistoryProps) {
  const { toast } = useToast();
  const ordered = useMemo(() => [...entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), [entries]);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<AiAssistedHistoryEntry | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const visible = showAll ? ordered : ordered.slice(0, 3);

  if (!entries.length) return null;

  const openEditor = (entry: AiAssistedHistoryEntry) => {
    setEditing(entry);
    setDraft(entry.content);
    setConfirmDelete(false);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setDraft('');
    setConfirmDelete(false);
  };

  const save = async () => {
    if (!editing || !draft.trim()) return;
    setSaving(true);
    try {
      await onChange(entries.map((entry) => entry.id === editing.id ? { ...entry, content: draft.trim() } : entry));
      setEditing(null);
      setDraft('');
      setConfirmDelete(false);
      toast({ title: 'History note updated' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not update history', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await onChange(entries.filter((entry) => entry.id !== editing.id));
      setEditing(null);
      setDraft('');
      setConfirmDelete(false);
      toast({ title: 'History note deleted' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not delete history note', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-y border-border py-4" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="outline" className="rounded-full text-[9px] uppercase tracking-wider">{entries.length}</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {ordered.length > 3 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show recent' : `Show all ${ordered.length}`}
          </Button>
        )}
      </div>

      <div className="mt-3 divide-y divide-border border-y border-border">
        {visible.map((entry) => (
          <details key={entry.id} className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{formatHistoryDate(entry.date)}</div>
              </div>
              <Badge variant="outline" className="hidden shrink-0 rounded-full text-[9px] uppercase tracking-wider sm:inline-flex">AI-assisted</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0"
                aria-label={`Edit ${entry.title}`}
                onClick={(event) => {
                  event.preventDefault();
                  openEditor(entry);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="pb-4 pr-10">
              <ContextualAiDocument content={entry.content} />
            </div>
          </details>
        ))}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{confirmDelete ? 'Delete this history entry?' : 'Edit AI-assisted note'}</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? 'This removes only the saved assistance note. It does not undo changes you already accepted elsewhere on the item.'
                : 'Remove or rewrite any bullet, section, or sentence. The rest of the item remains unchanged.'}
            </DialogDescription>
          </DialogHeader>
          {confirmDelete ? (
            <p className="text-sm leading-6 text-muted-foreground">{editing?.title}</p>
          ) : (
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="AI-assisted note content"
              className="min-h-[45dvh] resize-y text-base leading-7"
            />
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {confirmDelete ? (
              <>
                <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmDelete(false)}>Keep note</Button>
                <Button type="button" variant="destructive" disabled={saving} onClick={remove}>Delete note</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 size-4" /> Delete
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={saving} onClick={closeEditor}>Cancel</Button>
                  <Button type="button" disabled={saving || !draft.trim()} onClick={save}>{saving ? 'Saving' : 'Save changes'}</Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
