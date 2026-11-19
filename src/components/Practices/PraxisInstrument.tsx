"use client";

import type { Practice, PracticeLog, Question, VaultEntry } from '@/lib/types';
import { PraxisDayStrip, PraxisMethodShape, praxisShapeFor } from '@/components/Practices/PraxisMethodShape';

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * The Praxis workbench instrument, chosen by what kind of acting this is:
 * a practice shows its check-in and run of days; an experiment puts the
 * prediction beside what was observed; a commitment puts the principle beside
 * the action and what was actually upheld. The action always comes first.
 */
export function PraxisInstrument({ practice, positions, questions, onCheckIn, onOpenPosition }: {
  practice: Partial<Practice>;
  positions: VaultEntry[];
  questions: Question[];
  onCheckIn?: (kept: boolean) => void;
  onOpenPosition?: (id: string) => void;
}) {
  const method = praxisShapeFor(practice.type || 'habit');
  const logs = [...(practice.logs || [])].sort((a, b) => a.date.localeCompare(b.date));
  const kept = logs.filter((log) => log.actionCompleted !== false);
  const missed = logs.filter((log) => log.actionCompleted === false);
  const loggedToday = logs.some((log) => log.date.slice(0, 10) === todayKey());
  const bearsOn = [
    ...positions.filter((position) => (practice.positionIds || []).includes(position.id)).map((position) => ({ id: position.id, label: position.title, kind: 'position' as const })),
    ...questions.filter((question) => (practice.questionIds || []).includes(question.id)).map((question) => ({ id: question.id, label: question.text, kind: 'inquiry' as const })),
  ];
  const kindLabel = method.shape === 'triangle' ? 'Experiment' : method.shape === 'circle' ? 'Commitment' : 'Practice';
  const lastObservation = [...logs].reverse().find((log: PracticeLog) => (log.outcome || log.observations)?.trim());

  return (
    <section className="noesis-praxis-instrument" data-stage-tone={method.tone} aria-label={`${kindLabel} instrument`}>
      <div className="noesis-praxis-instrument__action">
        <span className="noesis-praxis-instrument__kind"><PraxisMethodShape shape={method.shape} size={16} />{kindLabel}</span>
        <p className="font-headline text-xl italic leading-snug">{practice.action?.trim() || practice.title || 'Name the action'}</p>
      </div>

      {method.shape === 'square' && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="noesis-instrument__label">Run of days</div>
              <PraxisDayStrip shape={method.shape} logDates={logs.map((log) => log.date)} missedDates={missed.map((log) => log.date)} days={Math.min(21, practice.durationDays || 21)} startDate={practice.startDate} size={20} />
              <p className="mt-1 text-xs text-muted-foreground">Filled: kept · dashed: missed · outline: not logged</p>
            </div>
            {onCheckIn && !loggedToday && (
              <div className="noesis-praxis-checkin" role="group" aria-label="Check in for today">
                <span>Today</span>
                <button type="button" onClick={() => onCheckIn(true)}>Kept</button>
                <button type="button" onClick={() => onCheckIn(false)}>Missed</button>
              </div>
            )}
            {loggedToday && <p className="text-sm text-muted-foreground">Checked in today.</p>}
          </div>
        </div>
      )}

      {method.shape === 'triangle' && (
        <div className="noesis-praxis-pair">
          <div>
            <div className="noesis-instrument__label">Prediction</div>
            <p>{practice.hypothesis?.trim() || practice.expectedOutcome?.trim() || <span className="text-muted-foreground">No prediction written yet.</span>}</p>
          </div>
          <div>
            <div className="noesis-instrument__label">Observed{lastObservation ? ` · ${lastObservation.date.slice(0, 10)}` : ''}</div>
            <p>{lastObservation ? (lastObservation.outcome || lastObservation.observations) : <span className="text-muted-foreground">Nothing observed yet.</span>}</p>
          </div>
        </div>
      )}

      {method.shape === 'circle' && (
        <div className="noesis-praxis-pair">
          <div>
            <div className="noesis-instrument__label">Principle</div>
            <p>{practice.intellectualBasis?.trim() || <span className="text-muted-foreground">Name the principle this upholds.</span>}</p>
          </div>
          <div>
            <div className="noesis-instrument__label">Upheld</div>
            <p><b className="font-headline text-2xl">{kept.length}</b> <span className="text-muted-foreground">of {logs.length} recorded time{logs.length === 1 ? '' : 's'}</span></p>
            {onCheckIn && !loggedToday && (
              <div className="noesis-praxis-checkin mt-2" role="group" aria-label="Did you uphold it today?">
                <span>Today</span>
                <button type="button" onClick={() => onCheckIn(true)}>Upheld</button>
                <button type="button" onClick={() => onCheckIn(false)}>Didn&apos;t</button>
              </div>
            )}
          </div>
        </div>
      )}

      {bearsOn.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Bears on:{' '}
          {bearsOn.map((item, index) => (
            <span key={item.id}>
              {index ? ' · ' : ''}
              {item.kind === 'position' && onOpenPosition
                ? <button type="button" className="underline underline-offset-4" onClick={() => onOpenPosition(item.id)}>{item.label}</button>
                : item.label}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
