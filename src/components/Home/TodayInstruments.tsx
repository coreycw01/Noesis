"use client";

import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PhilosophicalLink, Practice, VaultEntry } from '@/lib/types';
import { evidenceBalance, resolvePositionGrounds } from '@/lib/position-grounds';
import { PraxisDayStrip, PraxisMethodShape, praxisShapeFor } from '@/components/Practices/PraxisMethodShape';
import { practiceCheckInForDay, recordQuickPracticeCheckIn } from '@/lib/practice-observations';
import { practiceLogDates, practiceScheduleState } from '@/lib/practice-state';
import { noesisUserError } from '@/lib/user-facing-errors';

export interface PositionHeat { position: VaultEntry; gap: number; confidence: number; challenges: number }

/** Stated confidence minus what the recorded evidence supports, for live positions. */
export function positionHeat(positions: VaultEntry[], links: PhilosophicalLink[]): PositionHeat[] {
  return positions
    .filter((position) => !['abandoned', 'rejected', 'replaced'].includes(position.status))
    .flatMap((position) => {
      const { supportCount, challengeCount } = resolvePositionGrounds(position, links);
      if (!supportCount || !challengeCount) return [];
      const earned = evidenceBalance(supportCount, challengeCount);
      const confidence = Math.round(position.confidence || 0);
      return earned === null ? [] : [{ position, confidence, challenges: challengeCount, gap: confidence - earned }];
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

export function PositionsUnderHeat({ rows, onOpen }: { rows: PositionHeat[]; onOpen: (id: string) => void }) {
  const heat = rows.slice(0, 5);
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
      {!heat.length && <p className="text-sm text-muted-foreground">Add support and a challenge to a position to compare your confidence with its evidence balance.</p>}
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

export function PraxisCheckIn({ practices, day, onOpen, onUpdate }: { practices: Practice[]; day: string; onOpen: (id: string) => void; onUpdate: (practice: Practice) => void | Promise<Practice | void> }) {
  const { toast } = useToast();
  const locks = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const now = new Date(`${day}T12:00:00`);
  const live = practices.filter(practice => practiceScheduleState(practice, now) === 'running').slice(0, 5);
  const shown = live.length ? live : practices.filter(practice => practice.status === 'active').slice(0, 4);

  async function checkIn(practice: Practice) {
    const next = recordQuickPracticeCheckIn(practice, day);
    if (!next || locks.current.has(practice.id)) return;
    locks.current.add(practice.id);
    setPending(current => [...current, practice.id]);
    try {
      await onUpdate(next);
      setConfirmed(current => ({ ...current, [practice.id]: day }));
      toast({ title: 'Check-in saved', description: practice.title });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Check-in not saved', description: noesisUserError(error, 'Try checking in again.') });
    } finally {
      locks.current.delete(practice.id);
      setPending(current => current.filter(id => id !== practice.id));
    }
  }

  return (
    <section className="noesis-instrument" aria-labelledby="checkin-heading">
      <div id="checkin-heading" className="noesis-instrument__label">Praxis check-in</div>
      {shown.map((practice) => {
        const method = praxisShapeFor(practice.type);
        const rate = keptRate(practice);
        const keptDates = practiceLogDates(practice);
        const missedDates = (practice.logs || []).filter(log => !log.actionCompleted && !keptDates.includes(log.date.slice(0, 10))).map(log => log.date);
        const checkInStatus = practiceCheckInForDay(practice, day) || (confirmed[practice.id] === day ? 'kept' : null);
        const isPending = pending.includes(practice.id);
        const canCheckIn = practiceScheduleState(practice, now) === 'running';
        return (
          <div key={practice.id} className="noesis-checkin-row" data-stage-tone={method.tone}>
            <PraxisMethodShape shape={method.shape} size={16} />
            <div className="min-w-0">
              <button type="button" onClick={() => onOpen(practice.id)} className="block min-h-8 max-w-full break-words text-left text-[.95rem] hover:underline focus-visible:outline-2 focus-visible:outline-ring">{practice.title}</button>
              <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{method.intent}{rate !== null ? ` · ${rate}% kept` : ''}</span>
            </div>
            <div className="text-right" aria-live="polite">
              {checkInStatus ? (
                <span className="text-xs text-muted-foreground">{checkInStatus === 'kept' ? 'Checked in' : 'Missed today'}</span>
              ) : canCheckIn ? (
                <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={isPending} aria-label={`Check in for ${practice.title}`} onClick={() => void checkIn(practice)}><Check aria-hidden="true" />{isPending ? 'Saving…' : 'Check in'}</Button>
              ) : null}
            </div>
            <div className="noesis-checkin-calendar col-start-2 col-span-2 min-w-0">
              <PraxisDayStrip shape={method.shape} logDates={keptDates} missedDates={missedDates} days={practice.durationDays || 7} startDate={practice.startDate} today={now} />
            </div>
          </div>
        );
      })}
      {!shown.length && <p className="text-sm text-muted-foreground">Start a practice to see its days here.</p>}
    </section>
  );
}
