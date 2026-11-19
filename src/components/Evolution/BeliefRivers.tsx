"use client";

import { useState } from 'react';
import type { ThinkingEvent, VaultEntry } from '@/lib/types';

interface RiverPoint { time: number; confidence: number }
interface RiverMark { time: number; kind: 'support' | 'challenge' | 'revision' | 'other' }

const time = (value?: string) => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : NaN; };
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function markKind(type: string): RiverMark['kind'] {
  if (/support|evidence_added|strength/.test(type)) return 'support';
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
  return positions
    .filter((position) => !['abandoned', 'rejected', 'replaced'].includes(position.status))
    .map((position) => {
      const points: RiverPoint[] = (position.versionHistory || [])
        .filter((version) => typeof version.confidence === 'number' && Number.isFinite(time(version.date)))
        .map((version) => ({ time: time(version.date), confidence: clamp(version.confidence as number) }));
      const events = thinkingEvents.filter((event) => event.targetId === position.id || event.entityId === position.id);
      const marks: RiverMark[] = [];
      for (const event of events) {
        const at = time(event.createdAt);
        if (!Number.isFinite(at)) continue;
        if (typeof event.confidenceBefore === 'number') points.push({ time: at - 1, confidence: clamp(event.confidenceBefore) });
        if (typeof event.confidenceAfter === 'number') points.push({ time: at, confidence: clamp(event.confidenceAfter) });
        if (typeof event.confidenceAfter !== 'number') marks.push({ time: at, kind: markKind(event.eventType) });
      }
      const start = time(position.dateCreated);
      if (Number.isFinite(start) && !points.some((point) => point.time <= start)) {
        const firstKnown = [...points].sort((a, b) => a.time - b.time)[0];
        points.push({ time: start, confidence: firstKnown ? firstKnown.confidence : clamp(position.confidence || 0) });
      }
      points.push({ time: now, confidence: clamp(position.confidence || 0) });
      points.sort((a, b) => a.time - b.time);
      const changes = points.filter((point, index) => index > 0 && point.confidence !== points[index - 1].confidence).length;
      return { position, points, marks, changes, events: events.length };
    })
    .sort((a, b) => (b.changes + b.events) - (a.changes + a.events) || b.position.confidence - a.position.confidence);
}

/**
 * Belief rivers: one band per position, flowing left to right through time.
 * The band's width is the confidence held at each moment, so a river that
 * narrows is losing confidence. Tapping a river offers to open the position
 * or to show what moved it.
 */
export function BeliefRivers({ positions, thinkingEvents = [], onOpen, onExplain, limit = 6 }: {
  positions: VaultEntry[];
  thinkingEvents?: ThinkingEvent[];
  onOpen: (id: string) => void;
  onExplain?: (id: string) => void;
  limit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [choice, setChoice] = useState<{ id: string; title: string; top: number } | null>(null);
  const all = beliefRiverSeries(positions, thinkingEvents);
  const series = showAll ? all : all.slice(0, limit);
  if (!series.length) return <p className="text-sm text-muted-foreground">Rivers appear once you hold positions.</p>;
  const times = series.flatMap((river) => river.points.map((point) => point.time));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const width = 1000;
  const lane = 104;
  const left = 70;
  const right = 960;
  const height = series.length * lane + 20;
  const x = (at: number) => max === min ? right : left + ((at - min) / (max - min)) * (right - left);
  // The prototype's scale: thin below 20, about 33 either side at full confidence.
  const half = (confidence: number) => Math.max(3, (confidence - 20) / 2.4);
  const tones = ['claim', 'integrate', 'examine', 'act', 'encounter', 'more'];
  const markTone: Record<RiverMark['kind'], string> = { support: 'act', challenge: 'claim', revision: 'integrate', other: 'more' };

  return (
    <div className="noesis-rivers relative">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="noesis-instrument__label">Follow positions through time · width is confidence</div>
        {all.length > limit && <button type="button" className="font-code text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground" onClick={() => setShowAll(!showAll)}>{showAll ? `Show the ${limit} most active` : `Show all ${all.length}`}</button>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="group" aria-label="Belief rivers: confidence in each position over time">
        {series.map((river, index) => {
          const mid = index * lane + 60;
          const top = river.points.map((point) => `${x(point.time)},${mid - half(point.confidence)}`);
          const bottom = [...river.points].reverse().map((point) => `${x(point.time)},${mid + half(point.confidence)}`);
          const tone = tones[index % tones.length];
          const selected = choice?.id === river.position.id;
          const pick = () => setChoice(selected ? null : { id: river.position.id, title: river.position.title, top: (mid + 34) / height });
          return (
            <g
              key={river.position.id}
              data-stage-tone={tone}
              className="noesis-river cursor-pointer"
              data-selected={selected || undefined}
              role="button"
              tabIndex={0}
              aria-label={`${river.position.title}: ${Math.round(river.position.confidence)}% now, ${river.changes} recorded change${river.changes === 1 ? '' : 's'}`}
              onClick={pick}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } }}
            >
              <polygon points={[...top, ...bottom].join(' ')} fill="hsl(var(--stage) / .28)" stroke="hsl(var(--stage))" strokeWidth="1.5" strokeLinejoin="round" />
              {river.points.map((point, pointIndex) => pointIndex > 0 && point.confidence !== river.points[pointIndex - 1].confidence && (
                <g key={`p${pointIndex}`}>
                  <circle cx={x(point.time)} cy={mid} r="6" fill="hsl(var(--stage))" />
                  <text x={x(point.time)} y={mid - half(point.confidence) - 7} textAnchor="middle" className="fill-[hsl(var(--stage))] font-code text-[13px]">{Math.round(point.confidence)}</text>
                </g>
              ))}
              {river.marks.map((mark, markIndex) => (
                <circle key={`m${markIndex}`} data-stage-tone={markTone[mark.kind]} cx={x(mark.time)} cy={mid + half(river.points[0].confidence) + 9} r="4" fill="hsl(var(--stage))" />
              ))}
              <text x={x(river.points[0].time) + 16} y={mid + 6} className="pointer-events-none fill-foreground font-headline text-[17px] italic">{river.position.title.length > 46 ? `${river.position.title.slice(0, 45)}…` : river.position.title}</text>
              <text x={right} y={mid + 5} textAnchor="end" className="pointer-events-none fill-muted-foreground font-code text-[12px] uppercase tracking-[0.12em]">{Math.round(river.position.confidence)}% · {river.events} event{river.events === 1 ? '' : 's'}</text>
            </g>
          );
        })}
      </svg>
      {choice && (
        <div className="noesis-river-choice" style={{ top: `${choice.top * 100}%` }} role="dialog" aria-label={`What to do with “${choice.title}”`}>
          <span className="noesis-river-choice__title">{choice.title}</span>
          <button type="button" onClick={() => { setChoice(null); onOpen(choice.id); }}>Open the position</button>
          {onExplain && <button type="button" onClick={() => { setChoice(null); onExplain(choice.id); }}>What moved this river</button>}
          <button type="button" aria-label="Close" onClick={() => setChoice(null)}>×</button>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Numbers mark recorded confidence changes.</span>
        {(['support', 'challenge', 'revision'] as const).map((kind) => (
          <span key={kind} data-stage-tone={markTone[kind]} className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: 'hsl(var(--stage))' }} />{kind}</span>
        ))}
      </div>
    </div>
  );
}
