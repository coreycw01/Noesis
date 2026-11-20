"use client";

import React from 'react';
import { Compass, Hammer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Badge, type BadgeTone } from '@/components/ui/badge';

/**
 * Two named places on every record page.
 *
 * ToolsBand holds the instruments you use on your own — a stress test, a
 * steelman, a comparison. Nothing in it is sent anywhere; each tool writes
 * into the record. BenchBand marks where the writing happens, and where
 * Noesis may be asked in. The split is the point: the page should never
 * leave you guessing which of the two you are in.
 */
export function ToolsBand({ children, note = 'For you, not for Noesis. What you write here is saved to this record.' }: { children: React.ReactNode; note?: string }) {
  return (
    <section className="noesis-tools" aria-label="Thinking tools">
      <div className="noesis-tools__head">
        <Eyebrow as="h2"><Compass className="size-3.5" aria-hidden="true" /> Thinking tools</Eyebrow>
        <p>{note}</p>
      </div>
      <div className="noesis-tools__row">{children}</div>
    </section>
  );
}

/** One tool: a button that opens in place, so the page never changes under you. */
export function Tool({ label, icon: Icon, disabled, children }: { label: string; icon?: React.ComponentType<{ className?: string }>; disabled?: boolean; children: React.ReactNode }) {
  return (
    <details className="noesis-tool">
      <summary><Button asChild variant="secondary" size="sm" disabled={disabled}><span>{Icon && <Icon className="size-3.5" aria-hidden="true" />} {label}</span></Button></summary>
      <div className="noesis-fold__body">{children}</div>
    </details>
  );
}

export function BenchBand({ note }: { note: string }) {
  return (
    <div className="noesis-bench">
      <Eyebrow as="h2"><Hammer className="size-3.5" aria-hidden="true" /> Workbench</Eyebrow>
      <p>{note}</p>
    </div>
  );
}

export interface ConnectionItem { id: string; label: string; meta?: string; onOpen?: () => void }
export interface ConnectionGroup { type: string; tone: BadgeTone; items: ConnectionItem[]; empty?: string; action?: React.ReactNode }

/**
 * Connections, the same on every record: one disclosure per kind of record,
 * each carrying its count and its own colour, so the shape of what a record
 * is attached to reads the same everywhere.
 */
export function Connections({ groups }: { groups: ConnectionGroup[] }) {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  return (
    <div className="noesis-connections" aria-label={`Connections, ${total}`}>
      {groups.map((group) => (
        <details key={group.type} className="noesis-connections__group">
          <summary>
            <Badge tone={group.tone}>{group.type}</Badge>
            <span className="noesis-connections__count">{group.items.length}</span>
          </summary>
          <div className="noesis-connections__body noesis-scrollbox">
            {group.items.length ? (
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    {item.onOpen
                      ? <Button variant="link" size="sm" onClick={item.onOpen}>{item.label}</Button>
                      : <span>{item.label}</span>}
                    {item.meta && <small>{item.meta}</small>}
                  </li>
                ))}
              </ul>
            ) : <p className="noesis-connections__empty">{group.empty || `No ${group.type.toLowerCase()} yet.`}</p>}
            {group.action}
          </div>
        </details>
      ))}
    </div>
  );
}

export interface HistoryEntry { id: string; date?: string; title?: string; text?: React.ReactNode }

/** History: what happened to this record, newest first, in one shape. */
export function History({ entries, empty = 'Nothing recorded yet.' }: { entries: HistoryEntry[]; empty?: string }) {
  if (!entries.length) return <p className="noesis-connections__empty">{empty}</p>;
  return (
    <ol className="noesis-history-list noesis-scrollbox">
      {entries.map((entry) => (
        <li key={entry.id}>
          {entry.date && <time dateTime={entry.date}>{entry.date.slice(0, 10)}</time>}
          <div>
            {entry.title && <b>{entry.title}</b>}
            {entry.text && <span>{entry.text}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
