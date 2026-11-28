'use client';

import { useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { useLocalDay } from '@/hooks/use-local-day';
import { useToast } from '@/hooks/use-toast';
import { canBackfillPracticeCheckIn, savedPracticeCheckIns, type PracticeCheckInEdit } from '@/lib/practice-observations';
import { practiceCalendarDate } from '@/lib/practice-state';
import type { Practice, PracticeLog } from '@/lib/types';

const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const noteFor = (log: PracticeLog) => log.observations || log.outcome || '';

export function PracticeCheckInNotes({ practice, busy, onChange }: {
  practice: Practice;
  busy: boolean;
  onChange: (edit: PracticeCheckInEdit) => Promise<void>;
}) {
  const today = useLocalDay();
  const [date, setDate] = useState('');
  const [kept, setKept] = useState(true);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<PracticeLog | null>(null);
  const [deleting, setDeleting] = useState<PracticeLog | null>(null);
  const [limit, setLimit] = useState(8);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);
  const { toast } = useToast();
  const history = savedPracticeCheckIns(practice);
  const start = practiceCalendarDate(practice.startDate);
  const end = practiceCalendarDate(practice.endDate);
  const lastDay = end && end < today ? end : today;
  const day = date || lastDay;
  const exists = history.some(log => practiceCalendarDate(log.date) === day);
  const allowed = canBackfillPracticeCheckIn(practice, day, today);

  function reset() {
    setDate('');
    setKept(true);
    setNote('');
    setEditing(null);
  }

  async function save() {
    if (lock.current || busy || (!editing && (!allowed || exists))) return;
    lock.current = true;
    try {
      await onChange(editing ? { kind: 'edit', id: editing.id, kept, note } : { kind: 'add', day, kept, note });
      toast({ title: editing ? 'Check-in updated' : 'Check-in saved' });
      reset();
    } catch (error) {
      toast({ title: 'Check-in not saved', description: error instanceof Error ? error.message : 'Your changes are still here. Please retry.', variant: 'destructive' });
    } finally {
      lock.current = false;
    }
  }

  return <div className="space-y-5">
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void save(); }}>
      {editing && <p className="text-sm font-medium">Editing {formatDay(practiceCalendarDate(editing.date))}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {!editing && <label className="grid gap-1 text-sm font-medium">Check-in date
          <Input type="date" value={day} min={start || undefined} max={lastDay} onChange={event => setDate(event.target.value)} />
        </label>}
        <label className="grid gap-1 text-sm font-medium">Status
          <select value={kept ? 'kept' : 'missed'} onChange={event => setKept(event.target.value === 'kept')} className="min-h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm">
            <option value="kept">Kept</option>
            <option value="missed">Missed</option>
          </select>
        </label>
      </div>
      {!editing && (exists || !allowed) && <p className="text-sm text-muted-foreground" role="status">{exists ? 'This day already has a check-in. You can edit it below.' : 'Choose a date within the practice run, no later than today.'}</p>}
      <label className="grid gap-1 text-sm font-medium">Note (optional)
        <Textarea ref={noteInput} value={note} onChange={event => setNote(event.target.value)} className="min-h-20" />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {editing && <Button type="button" variant="ghost" disabled={busy} onClick={reset}>Cancel edit</Button>}
        <Button type="submit" className="min-h-11" disabled={busy || (!editing && (!allowed || exists))}>{editing ? 'Save changes' : 'Save check-in'}</Button>
      </div>
    </form>
    {history.length > 0 && <div className="border-t border-border/60 pt-4">
      <h3 className="text-sm font-semibold">Saved check-ins</h3>
      <ul className="divide-y divide-border/60">
        {history.slice(0, limit).map(log => {
          const label = formatDay(practiceCalendarDate(log.date));
          return <li key={log.id} className="flex items-start gap-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{label} · {log.actionCompleted ? 'Kept' : 'Missed'}</p>
              {noteFor(log) && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{noteFor(log)}</p>}
            </div>
            <IconButton type="button" label={`Edit check-in for ${label}`} disabled={busy} onClick={() => {
              setEditing(log); setKept(log.actionCompleted); setNote(noteFor(log));
              window.requestAnimationFrame(() => noteInput.current?.focus());
            }}><Pencil aria-hidden="true" /></IconButton>
            <IconButton type="button" label={`Delete check-in for ${label}`} disabled={busy} onClick={() => setDeleting(log)}><Trash2 aria-hidden="true" /></IconButton>
          </li>;
        })}
      </ul>
      {history.length > limit && <Button type="button" variant="outline" onClick={() => setLimit(current => current + 8)}>Show more check-ins</Button>}
    </div>}
    <ConfirmActionDialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null); }}
      title="Delete this check-in?" description="This removes the entry and its note. The Practice Path will recalculate from the remaining check-ins."
      confirmLabel="Delete check-in" destructive returnFocusRef={noteInput} onConfirm={async () => {
        if (!deleting) return;
        await onChange({ kind: 'delete', id: deleting.id });
        if (editing?.id === deleting.id) reset();
        toast({ title: 'Check-in deleted' });
      }} />
  </div>;
}
