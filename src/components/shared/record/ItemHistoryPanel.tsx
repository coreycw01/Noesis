import { useId, useState, type ReactNode } from 'react';
import { RevisionEvent } from '@/components/shared/IntellectualStructures';
import type { HistoryEntry } from './RecordParts';

export function ItemHistoryPanel({ title, controls, entries, background, scrollKey }: {
  title: string;
  controls?: ReactNode;
  entries: ReactNode;
  background?: ReactNode;
  scrollKey?: string;
}) {
  const heading = useId();
  return (
    <section className="space-y-3" aria-labelledby={heading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={heading} className="font-headline text-lg font-semibold">{title}</h2>
        {controls}
      </div>
      <div key={scrollKey} role="region" aria-label={`${title} entries`} tabIndex={0} className="h-64 space-y-3 overflow-y-auto overscroll-y-contain rounded-[var(--radius-panel)] border border-border bg-background/45 p-3 [scrollbar-gutter:stable] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:h-80">
        {entries}
      </div>
      {background}
    </section>
  );
}

export function ItemHistoryTimeline({ title, entries, empty, background }: {
  title: string;
  entries: readonly HistoryEntry[];
  empty: string;
  background?: ReactNode;
}) {
  const ordered = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return <ItemHistoryPanel title={title} background={background} entries={ordered.length
    ? ordered.map(({ id, date, title: action, text }) => <RevisionEvent key={id} date={date?.slice(0, 10)} action={action} description={text} />)
    : <p className="noesis-inline-empty">{empty}</p>} />;
}

export function ItemHistoryBackground({ title, children, lazy = false }: { title: string; children: ReactNode; lazy?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="text-sm" onToggle={lazy ? event => setOpen(event.currentTarget.open) : undefined}>
      <summary className="min-h-11 cursor-pointer py-2 font-medium">{title}</summary>
      {(!lazy || open) && <div className="mt-2 grid gap-3">{children}</div>}
    </details>
  );
}
