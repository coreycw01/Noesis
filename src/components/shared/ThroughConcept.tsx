"use client";

export interface ThroughColumn {
  label: string;
  tone: string;
  items: Array<{ id: string; label: string; onOpen?: () => void }>;
}

/**
 * "Through <concept>: everything that shares this concept", from the prototype.
 * One column per kind of record, so the concept reads as a crossroads.
 */
export function ThroughConcept({ concept, columns, limit = 4 }: { concept: string; columns: ThroughColumn[]; limit?: number }) {
  if (!concept || !columns.some((column) => column.items.length)) return null;
  return (
    <section className="noesis-through" aria-label={`Everything that shares ${concept}`}>
      <div className="noesis-instrument__label">Through {concept} · everything that shares this concept</div>
      <div className="noesis-through__grid">
        {columns.map((column) => (
          <div key={column.label} data-stage-tone={column.tone} className="noesis-through__col">
            <div className="noesis-through__head">{column.label} · {column.items.length}</div>
            {column.items.length ? column.items.slice(0, limit).map((item) => (
              <button key={item.id} type="button" disabled={!item.onOpen} onClick={item.onOpen} className="noesis-through__item">{item.label}</button>
            )) : <span className="text-sm text-muted-foreground">None yet</span>}
            {column.items.length > limit && <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">+{column.items.length - limit} more</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** A short dated history, oldest last, as in the prototype's position page. */
export function RecordHistory({ entries }: { entries: Array<{ date: string; text: string }> }) {
  const dated = entries.filter((entry) => entry.text?.trim()).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (!dated.length) return null;
  const fmt = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)) : value;
  return (
    <section className="noesis-history" aria-label="History">
      <div className="noesis-instrument__label">History</div>
      <ol>
        {dated.map((entry, index) => (
          <li key={`${entry.date}-${index}`}><span className="noesis-history__date">{fmt(entry.date)}</span><span>{entry.text}</span></li>
        ))}
      </ol>
    </section>
  );
}
