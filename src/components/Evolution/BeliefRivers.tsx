"use client";

import { useMemo, useState } from 'react';
import type { ThinkingEvent, VaultEntry } from '@/lib/types';

interface RiverPoint { time: number; confidence: number }
interface RiverMark { time: number; kind: 'support' | 'challenge' | 'revision' | 'other' }

const time = (value?: string) => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : NaN; };
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function markKind(type: string): RiverMark['kind'] {
  if (/support|strength/.test(type)) return 'support';
  if (/challeng|contradiction|stress_test|assumption_challenged/.test(type)) return 'challenge';
  if (/revis|replac|redefin|abandon/.test(type)) return 'revision';
  return 'other';
}

/**
 * Each live position's confidence over time. Recorded numbers come from the
 * position's versions and from confidence changes in its thinking events;
 * nothing is interpolated or invented. Other events on the position become
 * marks along the river.
 */
export function beliefRiverSeries(positions: VaultEntry[], thinkingEvents: ThinkingEvent[] = [], now = Date.now()) {
  const byPosition = new Map<string, ThinkingEvent[]>();
  for (const event of thinkingEvents) {
    for (const id of new Set([event.entityId, event.targetId])) {
      if (!id) continue;
      const group = byPosition.get(id);
      if (group) group.push(event); else byPosition.set(id, [event]);
    }
  }
  return positions
    .filter((position) => !['abandoned', 'rejected', 'replaced'].includes(position.status))
    .map((position) => {
      const points: RiverPoint[] = (position.versionHistory || [])
        .filter((version) => typeof version.confidence === 'number' && Number.isFinite(time(version.date)))
        .map((version) => ({ time: time(version.date), confidence: clamp(version.confidence as number) }));
      const events = byPosition.get(position.id) || [];
      const marks: RiverMark[] = [];
      for (const event of events) {
        const at = time(event.createdAt);
        if (!Number.isFinite(at)) continue;
        if (typeof event.confidenceBefore === 'number') points.push({ time: at - 1, confidence: clamp(event.confidenceBefore) });
        if (typeof event.confidenceAfter === 'number') points.push({ time: at, confidence: clamp(event.confidenceAfter) });
        if (typeof event.confidenceAfter !== 'number') marks.push({ time: at, kind: markKind(event.eventType) });
      }
      points.push({ time: now, confidence: clamp(position.confidence || 0) });
      points.sort((a, b) => a.time - b.time);
      const changes = points.filter((point, index) => index > 0 && point.confidence !== points[index - 1].confidence).length;
      return { position, points, marks, changes, events: events.length };
    })
    .sort((a, b) => (b.changes + b.events) - (a.changes + a.events) || b.position.confidence - a.position.confidence);
}

export function BeliefRivers({ positions, thinkingEvents, onOpen, onExplain }: {
  positions: VaultEntry[];
  thinkingEvents?: ThinkingEvent[];
  onOpen: (id: string) => void;
  onExplain?: (id: string | null) => void;
}) {
  const [choice, setChoice] = useState('');
  const all = useMemo(() => beliefRiverSeries(positions, thinkingEvents), [positions, thinkingEvents]);
  const river = all.find(item => item.position.id === choice) || all[0];
  if (!river) return <p className="text-sm text-muted-foreground">No current positions to follow yet.</p>;
  const { position, points, changes } = river;
  const first = points[0], last = points[points.length - 1];
  // A recorded before/after pair is a millisecond apart, so on an axis spanning
  // months both ends land on the same pixel and the river draws as a flat
  // rectangle. Keep the time order, but give every recorded point room to be
  // seen, so a change in confidence reads as the river narrowing or widening.
  const span = last.time - first.time || 1;
  const minGap = 1 / Math.max(points.length + 1, 8);
  const spread = points.reduce<number[]>((out, point, index) => {
    const at = (point.time - first.time) / span;
    out.push(index ? Math.max(at, out[index - 1] + minGap) : 0);
    return out;
  }, []);
  const full = spread[spread.length - 1] || 1;
  const x = (index: number) => 4 + 992 * (spread[index] / full);
  const half = (confidence: number) => 2 + confidence * 0.4;
  // Straight runs between points, so the taper between two confidences is
  // visible rather than a step hidden at one edge.
  const edge = (side: number) => points.map((point, index) =>
    `${index ? 'L' : 'M'}${x(index)},${48 + side * half(point.confidence)}`).join(' ');
  const outline = edge(-1) + ' ' + [...points].reverse().map((point, index) =>
    `L${x(points.length - 1 - index)},${48 + half(point.confidence)}`).join(' ') + ' Z';
  const date = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return <div className="grid min-w-0 gap-4" data-stage-tone="integrate">
    <label className="grid min-w-0 gap-1 text-sm font-medium">Follow a position
      <select className="min-h-11 w-full min-w-0 rounded-[var(--button-radius)] border border-border bg-background px-3 text-foreground" value={position.id}
        onChange={event => { setChoice(event.target.value); onExplain?.(null); }}>
        {all.map(item => <option key={item.position.id} value={item.position.id}>{item.position.title}</option>)}
      </select>
    </label>
    <header className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="min-w-0 break-words font-headline text-xl">{position.title}</h2>
      <span className="whitespace-nowrap text-sm tabular-nums">{Math.round(last.confidence)}% confidence now</span>
    </header>
    {points.length > 1 ? <figure>
      <svg viewBox="0 0 1000 96" preserveAspectRatio="none" className="h-24 w-full text-[hsl(var(--stage))]" role="img" aria-label={`Recorded confidence from ${Math.round(first.confidence)}% to ${Math.round(last.confidence)}%, with ${changes} changes`}>
        <path d={outline} fill="currentColor" fillOpacity=".22" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d="M4 48H996" stroke="currentColor" strokeOpacity=".45" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>{date(first.time)} · {Math.round(first.confidence)}%</span><span className="text-right">Today · {Math.round(last.confidence)}%</span></figcaption>
      <p className="mt-2 text-xs text-muted-foreground">Width is the confidence you recorded, in the order you recorded it · {changes} {changes === 1 ? 'change' : 'changes'}</p>
    </figure> : <p className="border-y border-border py-4 text-sm text-muted-foreground">Only the current confidence is recorded. A river appears once there is an earlier rating to compare.</p>}
    <div className="flex flex-wrap gap-4 text-sm font-medium">
      {onExplain && <button className="min-h-11 underline underline-offset-4" onClick={() => onExplain(position.id)}>What changed?</button>}
      <button className="min-h-11 underline underline-offset-4" onClick={() => onOpen(position.id)}>Open position</button>
    </div>
  </div>;
}
