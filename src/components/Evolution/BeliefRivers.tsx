"use client";

import type { VaultEntry } from '@/lib/types';

interface RiverPoint { time: number; confidence: number }

/** Each live position's confidence over time, from its recorded versions to now. */
export function beliefRiverSeries(positions: VaultEntry[], now = Date.now()) {
  return positions
    .filter((position) => !['abandoned', 'rejected', 'replaced'].includes(position.status))
    .map((position) => {
      const points: RiverPoint[] = (position.versionHistory || [])
        .filter((version) => typeof version.confidence === 'number' && Number.isFinite(Date.parse(version.date)))
        .map((version) => ({ time: Date.parse(version.date), confidence: Math.max(0, Math.min(100, version.confidence as number)) }));
      const start = Date.parse(position.dateCreated || '');
      if (!points.length && Number.isFinite(start)) points.push({ time: start, confidence: position.confidence });
      points.push({ time: now, confidence: Math.max(0, Math.min(100, position.confidence || 0)) });
      points.sort((a, b) => a.time - b.time);
      return { position, points, changes: points.length - 1 };
    })
    .sort((a, b) => b.changes - a.changes || b.position.confidence - a.position.confidence);
}

/**
 * Belief rivers: one band per position, flowing left to right through time.
 * The band's width is the confidence held at each moment; dots mark the
 * recorded changes, labelled with the confidence after each one.
 */
export function BeliefRivers({ positions, onOpen, limit = 6 }: { positions: VaultEntry[]; onOpen: (id: string) => void; limit?: number }) {
  const series = beliefRiverSeries(positions).slice(0, limit);
  if (!series.length) return <p className="text-sm text-muted-foreground">Rivers appear once you hold positions.</p>;
  const times = series.flatMap((river) => river.points.map((point) => point.time));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const width = 1000;
  const lane = 110;
  const left = 70;
  const right = 960;
  const x = (time: number) => max === min ? right : left + ((time - min) / (max - min)) * (right - left);
  const half = (confidence: number) => 6 + (confidence / 100) * 24;
  const tones = ['claim', 'integrate', 'examine', 'act', 'encounter', 'more'];
  return (
    <div className="noesis-rivers">
      <div className="noesis-instrument__label">Follow positions through time · width is confidence</div>
      <svg viewBox={`0 0 ${width} ${series.length * lane + 20}`} className="h-auto w-full" role="img" aria-label="Belief rivers: confidence in each position over time">
        {series.map((river, index) => {
          const mid = index * lane + 60;
          const top = river.points.map((point) => `${x(point.time)},${mid - half(point.confidence)}`);
          const bottom = [...river.points].reverse().map((point) => `${x(point.time)},${mid + half(point.confidence)}`);
          const tone = tones[index % tones.length];
          return (
            <g key={river.position.id} data-stage-tone={tone} className="cursor-pointer" onClick={() => onOpen(river.position.id)}>
              <polygon points={[...top, ...bottom].join(' ')} fill="hsl(var(--stage) / .3)" stroke="hsl(var(--stage))" strokeWidth="1.5" strokeLinejoin="round" />
              {river.points.slice(0, -1).map((point, pointIndex) => (
                <g key={pointIndex}>
                  <circle cx={x(point.time)} cy={mid} r="6" fill="hsl(var(--stage))" />
                  <text x={x(point.time)} y={mid - half(point.confidence) - 7} textAnchor="middle" className="fill-[hsl(var(--stage))] font-code text-[13px]">{Math.round(point.confidence)}</text>
                </g>
              ))}
              <text x={x(river.points[0].time) + 16} y={mid + 6} className="fill-foreground font-headline text-[17px] italic">{river.position.title.length > 46 ? `${river.position.title.slice(0, 45)}…` : river.position.title}</text>
              <text x={right} y={mid + 5} textAnchor="end" className="fill-muted-foreground font-code text-[12px] uppercase tracking-[0.12em]">{river.changes} change{river.changes === 1 ? '' : 's'}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
