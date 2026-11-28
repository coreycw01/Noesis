"use client";

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Circle, Minus, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { InstrumentHelp } from '@/components/shared/InstrumentHelp';
import { experimentReadings, practiceRhythm } from '@/lib/instrument-readings';
import { PRAXIS_METHOD_ICONS } from '@/lib/noesis-icons';
import type { Practice } from '@/lib/types';

const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, options);
const shortDate = (day: string) => dateLabel(day, { month: 'short', day: 'numeric', year: 'numeric' });
const states = { kept: 'Kept', missed: 'Missed', unlogged: 'Not logged', upcoming: 'Upcoming', outside: 'Outside the run' };
const Steps = PRAXIS_METHOD_ICONS.practice;

function WalkingTrail({ keptSteps, targetSteps }: { keptSteps: number; targetSteps: number | null }) {
  const start = 28;
  const end = 324;
  const reached = targetSteps !== null && keptSteps >= targetSteps;
  const walker = targetSteps === null ? 176 : start + (end - start) * Math.min(1, keptSteps / targetSteps);
  return <svg viewBox="0 0 352 65" className="noesis-practice-trail" fill="none" aria-hidden="true">
    <path d="M14 51H338" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="3 5" />
    {targetSteps !== null && <path d={`M${start} 51H${walker}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    {targetSteps === null ? <path d="m331 45 7 6-7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M337 51V16h-17l4 5-4 5h17" fill={reached ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    <g className="noesis-instrument-jaw" style={{ transform: `translateX(${walker}px)` }}>
      <g key={keptSteps} className={keptSteps > 0 && !reached ? 'noesis-practice-trail__walker' : undefined} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="1" cy="17" r="4" fill="currentColor" stroke="none" />
        <path d="M0 25-3 36m3-11 5 7 6 1M0 25l-5 6-5 1" />
        <path className="noesis-practice-trail__rear" d="m-3 36-3 8-7 5" />
        <path className="noesis-practice-trail__front" d="m-3 36 8 5 5 8h3" />
      </g>
    </g>
  </svg>;
}

export function PracticePath({ practice, today }: { practice: Partial<Practice>; today: string }) {
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<string>();
  const { weekCount, week, keptSteps, targetSteps } = practiceRhythm(practice, today);
  const index = Math.max(0, weekCount - 1 - offset);
  const days = week(index);
  const reading = days.find(day => day.date === picked) ?? days.find(day => day.date === today)
    ?? days.findLast(day => day.state === 'kept' || day.state === 'missed') ?? days[0];
  const kept = days.filter(day => day.state === 'kept').length;
  const missed = days.filter(day => day.state === 'missed').length;
  return (
    <section className="noesis-record-instrument" data-tone="practice" aria-label="Practice path">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="noesis-eyebrow flex items-center gap-2 font-bold text-tone"><Steps className="size-4" aria-hidden="true" />Practice Path</h2>
          <p className="mt-1 text-sm font-medium" aria-live="polite">{keptSteps}{targetSteps !== null && ` of ${targetSteps}`} {keptSteps === 1 && (targetSteps === null || targetSteps === 1) ? 'step' : 'steps'} kept</p>
        </div>
        <InstrumentHelp instrument="rhythm" />
      </div>
      <WalkingTrail keptSteps={keptSteps} targetSteps={targetSteps} />
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="text-xs text-muted-foreground">Week {index + 1} of {weekCount} · {kept} kept · {missed} missed</p>
        <div className="flex items-center gap-1">
          <IconButton label="Previous practice week" type="button" disabled={index === 0} onClick={() => { setOffset(weekCount - index); setPicked(undefined); }}><ArrowLeft aria-hidden="true" /></IconButton>
          <IconButton label="Next practice week" type="button" disabled={index === weekCount - 1} onClick={() => { setOffset(weekCount - index - 2); setPicked(undefined); }}><ArrowRight aria-hidden="true" /></IconButton>
        </div>
      </div>
      <div className="noesis-practice-path grid grid-cols-7 gap-0.5 sm:gap-2" role="group" aria-label="Practice check-ins for this week">
        {days.map(day => {
          const Mark = day.state === 'kept' ? Steps : day.state === 'missed' ? X : day.state === 'upcoming' ? Circle : Minus;
          return <button key={day.date} type="button" aria-pressed={reading.date === day.date}
            aria-label={`${shortDate(day.date)}: ${states[day.state]}`} onClick={() => setPicked(day.date)}
            data-state={day.state}
            className="noesis-practice-path__day grid min-h-14 min-w-0 place-items-center gap-1 rounded-[var(--radius-panel)] border px-0.5 py-1.5 font-code text-xs focus-visible:ring-2 focus-visible:ring-ring">
            <Mark className="size-4" aria-hidden="true" />
            <span>{dateLabel(day.date, { day: 'numeric' })}</span>
          </button>;
        })}
      </div>
      <div aria-live="polite" className="min-h-10 break-words text-sm">
        <strong>{shortDate(reading.date)} · {states[reading.state]}</strong>
        {reading.note && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{reading.note}</p>}
      </div>
    </section>
  );
}

export function ExperimentTestBench({ practice, today }: { practice: Partial<Practice>; today: string }) {
  const readings = experimentReadings(practice, today);
  const [selected, setSelected] = useState<string>();
  const match = readings.findIndex(item => item.id === selected);
  const index = match < 0 ? readings.length - 1 : match;
  const sample = readings[index];
  const prediction = practice.hypothesis?.trim();
  const criterion = practice.expectedOutcome?.trim();
  const sampleLabel = sample?.label.match(/^\d{4}-\d{2}-\d{2}$/) ? shortDate(sample.label) : sample?.label;
  const lens = 156 + (readings.length > 1 ? index / (readings.length - 1) * 86 : 86);
  return (
    <section className="noesis-record-instrument" data-tone="practice" aria-label="Experiment test bench">
      <div className="flex items-center justify-between gap-2">
        <h2 className="noesis-eyebrow font-bold text-tone">The Test Bench</h2>
        <InstrumentHelp instrument="experiment" />
      </div>
      <svg viewBox="0 0 286 53" className="mx-auto w-full max-w-lg text-tone" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M25 34H260 M25 42H260 M25 27v21 M260 27v21" opacity=".55" />
        <path d="M46 13l12 10-12 10-12-10z" fill={prediction ? 'currentColor' : 'none'} />
        <path d="M65 23H145" strokeDasharray="3 4" opacity=".6" />
        {[156, 177.5, 199, 220.5, 242].map(x => <path key={x} d={`M${x} 35v7`} opacity=".65" />)}
        <g className="noesis-instrument-jaw" style={{ transform: `translateX(${lens}px)` }}>
          <circle cy="22" r="10" strokeWidth="2" opacity={sample ? 1 : .45} fill="hsl(var(--card))" />
          {sample && <circle cy="22" r="3" fill="currentColor" />}
        </g>
      </svg>
      <div className="noesis-praxis-pair min-w-0">
        <div className="min-w-0 break-words">
          <h3 className="noesis-instrument__label">Prediction</h3>
          <p className="whitespace-pre-wrap">{prediction || <span className="text-muted-foreground">No prediction written yet.</span>}</p>
          {criterion && <p className="mt-2 whitespace-pre-wrap text-sm"><strong>What would support it:</strong> {criterion}</p>}
        </div>
        <div className="min-w-0 break-words" aria-live="polite">
          <h3 className="noesis-instrument__label">Observation{sampleLabel && ` · ${sampleLabel}`}</h3>
          {sample?.text ? <p className="whitespace-pre-wrap">{sample.text}</p>
            : !sample && <p className="text-muted-foreground">No observations recorded yet.</p>}
          {sample?.unexpected && <p className="text-sm"><strong>Unexpected:</strong> {sample.unexpected}</p>}
        </div>
      </div>
      {readings.length > 1 && <label className="grid text-xs text-muted-foreground">
        Observation {index + 1} of {readings.length}
        <input type="range" min={0} max={readings.length - 1} value={index}
          aria-label="Browse experiment observations" aria-valuetext={`Observation ${index + 1} of ${readings.length}: ${sampleLabel}`}
          onChange={event => setSelected(readings[Number(event.target.value)]?.id)}
          className="h-11 w-full accent-[hsl(var(--tone))]" />
      </label>}
    </section>
  );
}
