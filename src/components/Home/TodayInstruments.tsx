"use client";

import type { Practice, VaultEntry } from '@/lib/types';
import { evidenceBalance } from '@/components/Vault/PositionCalibration';
import { PraxisDayStrip, PraxisMethodShape, praxisShapeFor } from '@/components/Practices/PraxisMethodShape';

export interface PositionHeat { position: VaultEntry; gap: number; confidence: number; challenges: number }

/** Stated confidence minus what the recorded evidence supports, for live positions. */
export function positionHeat(positions: VaultEntry[]): PositionHeat[] {
  return positions
    .filter((position) => !['abandoned', 'rejected', 'replaced'].includes(position.status))
    .map((position) => {
      const support = (position.evidenceFor || []).length + (position.sourceIds || []).length;
      const challenges = (position.evidenceAgainst || []).length;
      const earned = evidenceBalance(support, challenges);
      const confidence = Math.round(position.confidence || 0);
      return { position, confidence, challenges, gap: earned === null ? confidence : confidence - earned };
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

/** An ember: size is confidence, the halo grows with unanswered heat. */
function Ember({ confidence, gap }: { confidence: number; gap: number }) {
  const core = 4 + (confidence / 100) * 6;
  const halo = Math.min(17, core + Math.abs(gap) / 6);
  return (
    <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden="true" data-stage-tone="claim">
      <circle cx="18" cy="18" r={halo} fill="hsl(var(--stage) / .18)" />
      <circle cx="18" cy="18" r={core} fill="hsl(var(--stage))" />
    </svg>
  );
}

export function PositionsUnderHeat({ positions, onOpen }: { positions: VaultEntry[]; onOpen: (id: string) => void }) {
  const heat = positionHeat(positions).slice(0, 5);
  return (
    <section className="noesis-instrument" aria-labelledby="heat-heading">
      <div id="heat-heading" className="noesis-instrument__label">Positions under heat</div>
      {heat.map(({ position, gap, confidence }) => (
        <button key={position.id} type="button" onClick={() => onOpen(position.id)} className="noesis-heat-row">
          <Ember confidence={confidence} gap={gap} />
          <span className="min-w-0 truncate font-headline text-[1rem] font-semibold italic">{position.title}</span>
          <span className="font-code text-xs tabular-nums" data-stage-tone={Math.abs(gap) > 12 ? 'claim' : 'act'} style={{ color: 'hsl(var(--stage))' }}>{gap > 0 ? '+' : ''}{gap}</span>
        </button>
      ))}
      {!heat.length && <p className="text-sm text-muted-foreground">State a position to see where confidence and evidence part ways.</p>}
      <p className="text-xs text-muted-foreground">Gap = stated confidence minus what your evidence supports.</p>
    </section>
  );
}

function keptRate(practice: Practice) {
  const logs = practice.logs || [];
  if (logs.length) return Math.round((logs.filter((log) => log.actionCompleted !== false).length / logs.length) * 100);
  const dates = practice.logDates || [];
  return practice.durationDays ? Math.round((Math.min(dates.length, practice.durationDays) / practice.durationDays) * 100) : null;
}

export function PraxisCheckIn({ practices, onOpen }: { practices: Practice[]; onOpen: (id: string) => void }) {
  const live = practices.filter((practice) => ['active', 'in_progress', 'running'].includes(String(practice.status)) || !practice.status).slice(0, 5);
  const shown = live.length ? live : practices.slice(0, 4);
  return (
    <section className="noesis-instrument" aria-labelledby="checkin-heading">
      <div id="checkin-heading" className="noesis-instrument__label">Praxis check-in</div>
      {shown.map((practice) => {
        const method = praxisShapeFor(practice.type);
        const rate = keptRate(practice);
        return (
          <button key={practice.id} type="button" onClick={() => onOpen(practice.id)} className="noesis-checkin-row" data-stage-tone={method.tone}>
            <PraxisMethodShape shape={method.shape} size={16} />
            <span className="min-w-0">
              <span className="block truncate text-[.95rem]">{practice.title}</span>
              <span className="font-code text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{method.intent}{rate !== null ? ` · ${rate}% kept` : ''}</span>
            </span>
            <PraxisDayStrip shape={method.shape} logDates={(practice.logDates || []).concat((practice.logs || []).map((log) => log.date))} days={practice.durationDays || 7} startDate={practice.startDate} />
          </button>
        );
      })}
      {!shown.length && <p className="text-sm text-muted-foreground">Start a practice to see its days here.</p>}
    </section>
  );
}
