"use client";

import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PhilosophicalLink, Practice, VaultEntry } from '@/lib/types';
import { resolvePositionGrounds } from '@/lib/position-grounds';
import { PraxisDayStrip, praxisShapeFor } from '@/components/Practices/PraxisMethodShape';
import { practiceCheckInForDay, recordQuickPracticeCheckIn } from '@/lib/practice-observations';
import { practiceLogDates, practicePraxisMethod, practiceScheduleState } from '@/lib/practice-state';
import { noesisUserError } from '@/lib/user-facing-errors';
import { ConfidenceEmber } from '@/components/Vault/ConfidenceEmber';
import { NOESIS_SOLID_DESK_ICONS, PRAXIS_METHOD_ICONS } from '@/lib/noesis-icons';
import { isRepeatablePractice } from '@/lib/workflow-integrity';

export interface PositionHeat { position: VaultEntry; confidence: number; supports: number; challenges: number }

/** Positions with recorded challenges, without estimating warranted confidence. */
export function positionHeat(positions: VaultEntry[], links: PhilosophicalLink[]): PositionHeat[] {
  return positions
    .filter((position) => !['abandoned', 'rejected', 'replaced'].includes(position.status))
    .flatMap((position) => {
      const { supportCount, challengeCount } = resolvePositionGrounds(position, links);
      if (!challengeCount) return [];
      const confidence = Math.round(position.confidence || 0);
      return [{ position, confidence, supports: supportCount, challenges: challengeCount }];
    })
    .sort((a, b) => b.challenges - a.challenges);
}

export function PositionsUnderHeat({ rows, onOpen }: { rows: PositionHeat[]; onOpen: (id: string) => void }) {
  const heat = rows.slice(0, 5);
  return (
    <section className="noesis-instrument noesis-today-desk__tape" aria-labelledby="heat-heading">
      <h2 id="heat-heading" className="noesis-eyebrow flex items-center gap-2 font-bold">
        <span className="relative grid size-8 shrink-0 place-items-center" data-tone="position" aria-hidden="true">
          <ConfidenceEmber confidence={heat[0]?.confidence ?? 0} size={32} decorative />
          <NOESIS_SOLID_DESK_ICONS.position className="absolute size-4 text-tone" />
        </span>
        Positions under heat
      </h2>
      {heat.map(({ position, supports, challenges, confidence }) => (
        <button key={position.id} type="button" onClick={() => onOpen(position.id)} className="noesis-heat-row w-full min-w-0">
          <ConfidenceEmber confidence={confidence} size={36} decorative />
          <span className="min-w-0 break-words font-headline text-base font-semibold italic">{position.title}</span>
          <span className="grid gap-0.5 text-right font-code text-xs tabular-nums">
            <span>{confidence}%<span className="sr-only"> confidence</span></span>
            <span className="text-muted-foreground">{supports} for · {challenges} against</span>
          </span>
        </button>
      ))}
      {!heat.length && <p className="text-sm text-muted-foreground">No active positions have recorded challenges.</p>}
      {heat.length > 0 && <p className="text-xs text-muted-foreground">Does the strongest challenge change how you see the claim?</p>}
    </section>
  );
}

function keptRate(practice: Practice) {
  const logs = practice.logs || [];
  if (logs.length) return Math.round((logs.filter((log) => log.actionCompleted !== false).length / logs.length) * 100);
  const dates = practice.logDates || [];
  return practice.durationDays ? Math.round((Math.min(dates.length, practice.durationDays) / practice.durationDays) * 100) : null;
}

export function PraxisCheckIn({ practices, day, onOpen, onUpdate, showLabel = true }: { practices: Practice[]; day: string; onOpen: (id: string) => void; onUpdate: (practice: Practice) => void | Promise<Practice | void>; showLabel?: boolean }) {
  const { toast } = useToast();
  const locks = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const now = new Date(`${day}T12:00:00`);
  const shown = practices.filter(practice => isRepeatablePractice(practice.type) && practiceScheduleState(practice, now) === 'running');

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
      <div id="checkin-heading" className={showLabel ? 'noesis-instrument__label' : 'sr-only'}>Praxis check-in</div>
      <div className={shown.length > 5 ? 'max-h-[30rem] overflow-y-auto overscroll-contain' : undefined}>
      {shown.map((practice) => {
        const experiment = practicePraxisMethod(practice.type) === 'experiments';
        const method = praxisShapeFor(experiment ? 'experiment' : 'habit');
        const MethodIcon = PRAXIS_METHOD_ICONS[experiment ? 'experiment' : 'practice'];
        const rate = keptRate(practice);
        const keptDates = practiceLogDates(practice);
        const missedDates = (practice.logs || []).filter(log => !log.actionCompleted && !keptDates.includes(log.date.slice(0, 10))).map(log => log.date);
        const checkInStatus = practiceCheckInForDay(practice, day) || (confirmed[practice.id] === day ? 'kept' : null);
        const isPending = pending.includes(practice.id);
        return (
          <div key={practice.id} className="noesis-checkin-row" data-stage-tone={method.tone}>
            <MethodIcon className="size-4 shrink-0 text-[hsl(var(--stage))]" aria-hidden="true" />
            <div className="min-w-0">
              <button type="button" onClick={() => onOpen(practice.id)} className="block min-h-8 max-w-full break-words text-left text-base hover:underline focus-visible:outline-2 focus-visible:outline-ring">{practice.title}</button>
              <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{method.intent}{rate !== null ? ` · ${rate}% kept` : ''}</span>
            </div>
            <div className="text-right" aria-live="polite">
              {checkInStatus ? (
                <span className="text-xs text-muted-foreground">{checkInStatus === 'kept' ? 'Checked in' : 'Missed today'}</span>
              ) : (
                <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={isPending} aria-label={`Log today for ${practice.title}`} onClick={() => void checkIn(practice)}><Check aria-hidden="true" />{isPending ? 'Saving…' : 'Log today'}</Button>
              )}
            </div>
            <div className="noesis-checkin-calendar col-start-2 col-span-2 min-w-0">
              <PraxisDayStrip shape={method.shape} logDates={keptDates} missedDates={missedDates} days={practice.durationDays || 7} startDate={practice.startDate} today={now} />
            </div>
          </div>
        );
      })}
      </div>
      {!shown.length && <p className="text-sm text-muted-foreground">No practices to check in on today.</p>}
    </section>
  );
}
