"use client";

import { InstrumentHelp } from '@/components/shared/InstrumentHelp';

import { useState } from 'react';
import type { CommitmentPlanReading } from '@/lib/commitments';

const measure = (fraction: number) => 24 + Math.max(0, Math.min(1, fraction)) * 272;
const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function CommitmentGauge({ target, readings, measureLabel, paced }: { target: number; readings: CommitmentPlanReading[]; measureLabel: string; paced: boolean }) {
  const [day, setDay] = useState<string>();
  const [inspect, setInspect] = useState<'say' | 'do'>();
  const index = readings.findIndex(reading => reading.day === day);
  const step = index < 0 ? readings.length - 1 : index;
  const reading = readings[step];
  if (!reading) return null;
  const maximum = Math.max(1, target, ...readings.map(item => item.recorded));
  const say = measure(reading.planned / maximum);
  const action = measure(reading.recorded / maximum);
  const gap = reading.recorded - reading.planned;
  const label = paced && reading.planned === 0 ? 'Not started' : gap === 0 ? (paced ? 'On pace' : 'Target met') : `${Math.abs(gap)} ${gap < 0 ? 'short of' : 'ahead of'} ${paced ? 'the plan' : 'the target'}`;
  return (
    <figure className="noesis-record-instrument" data-tone="practice" aria-label="Say / Do gauge">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <figcaption className="noesis-eyebrow font-bold text-tone">The Say / Do gauge</figcaption>
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold" aria-live="polite">{label}</p>
          <InstrumentHelp instrument="commitment" />
        </div>
      </div>
      <svg viewBox="0 0 320 83" className="mx-auto w-full max-w-md" aria-hidden="true">
        <rect x="12" y="25" width="296" height="28" rx="5" fill="hsl(var(--tone) / .09)" stroke="hsl(var(--border))" />
        <line x1="24" x2="296" y1="39" y2="39" stroke="hsl(var(--muted-foreground) / .6)" />
        {Array.from({ length: 21 }, (_, i) => {
          const x = measure(i / 20);
          return <path key={i} d={`M${x} 39v${i % 5 === 0 ? -9 : -4}`} stroke="hsl(var(--muted-foreground))" opacity={i % 5 === 0 ? 1 : .6} />;
        })}
        <line x1={say} x2={action} y1="39" y2="39" stroke="hsl(var(--tone))" strokeWidth="4" strokeLinecap="round" />
        <g className="noesis-instrument-jaw" style={{ transform: `translateX(${say}px)` }}>
          <path d="M-7 10H7V25L0 36-7 25Z" fill="hsl(var(--muted-foreground))" />
        </g>
        <g className="noesis-instrument-jaw" style={{ transform: `translateX(${action}px)` }}>
          <path d="M-7 62H7V53L0 42-7 53Z" fill="hsl(var(--tone))" />
        </g>
        {[0, maximum].map(value => <text key={value} x={measure(value / maximum)} y="80" textAnchor="middle" fontSize="10" className="fill-muted-foreground font-code">{value}</text>)}
      </svg>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={inspect === 'say'} onClick={() => setInspect(inspect === 'say' ? undefined : 'say')} className="min-h-11 rounded-[var(--radius-panel)] border border-border p-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted">
          <span className="block text-xs text-muted-foreground">Say</span><strong>{reading.planned} {paced ? 'planned by then' : 'target'}</strong>
        </button>
        <button type="button" aria-pressed={inspect === 'do'} onClick={() => setInspect(inspect === 'do' ? undefined : 'do')} className="min-h-11 rounded-[var(--radius-panel)] border border-border p-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted">
          <span className="block text-xs text-muted-foreground">Do</span><strong>{reading.recorded} recorded</strong>
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
        {inspect === 'say' ? (paced ? `${reading.planned} expected by ${step === readings.length - 1 ? 'today' : formatDay(reading.day)} based on your commitment schedule.` : 'Your saved target, not a daily pace.')
          : inspect === 'do' && paced ? 'Only your completed commitment check-ins count, once per day.' : measureLabel}
      </p>
      {readings.length > 1 && <label className="grid text-xs text-muted-foreground">
        Check-in history · {formatDay(reading.day)}
        <input type="range" min={0} max={readings.length - 1} value={step} onChange={event => setDay(readings[Number(event.target.value)]?.day)}
          aria-label="Browse check-in history" aria-valuetext={`${formatDay(reading.day)}: ${reading.recorded} recorded, ${reading.planned} expected`}
          className="h-11 w-full accent-[hsl(var(--tone))]" />
      </label>}
    </figure>
  );
}
