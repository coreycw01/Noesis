"use client";

import type { Practice } from '@/lib/types';
import { PRAXIS_METHOD_ICONS } from '@/lib/noesis-icons';
import { ExperimentTestBench, PracticePath } from '@/components/Practices/PraxisReadings';
import { useLocalDay } from '@/hooks/use-local-day';
import { recordDateKey } from '@/lib/calendar';
import { useSectionDisclosure } from '@/components/shared/SectionDisclosure';

export function PraxisInstrument({ practice, kind, onCheckIn }: {
  practice: Partial<Practice>;
  kind: 'practice' | 'experiment';
  onCheckIn?: (kept: boolean) => void;
}) {
  const today = useLocalDay();
  const loggedToday = [...(practice.logs || []).map(log => log.date), ...(practice.logDates ?? [])].some(date => recordDateKey(date) === today);
  const kindLabel = kind === 'experiment' ? 'Experiment' : 'Practice';
  const KindIcon = PRAXIS_METHOD_ICONS[kind];
  const { toggle, body } = useSectionDisclosure(`${kindLabel} instrument`);

  return (
    <section className="noesis-praxis-instrument" data-stage-tone="act" aria-label={`${kindLabel} instrument`}>
      <div className="noesis-praxis-instrument__action">
        <div className="flex items-center justify-between gap-2"><span className="noesis-praxis-instrument__kind"><KindIcon className="size-4 shrink-0" aria-hidden="true" />{kindLabel}</span>{toggle}</div>
        <p className="font-headline text-xl italic leading-snug">{practice.action?.trim() || practice.title || 'Name the action'}</p>
      </div>

      <div {...body}>{kind === 'practice' ? (
        <div className="grid gap-3">
          {(onCheckIn || loggedToday) && <div className="flex flex-wrap items-end justify-between gap-3">
            {onCheckIn && !loggedToday && (
              <div className="noesis-praxis-checkin" role="group" aria-label="Check in for today">
                <span>Today</span>
                <button type="button" onClick={() => onCheckIn(true)}>Kept</button>
                <button type="button" onClick={() => onCheckIn(false)}>Missed</button>
              </div>
            )}
            {loggedToday && <p className="text-sm text-muted-foreground">Checked in today.</p>}
          </div>}
          <PracticePath key={practice.id} practice={practice} today={today} />
        </div>
      ) : (
        <ExperimentTestBench key={practice.id} practice={practice} today={today} />
      )}</div>
    </section>
  );
}
