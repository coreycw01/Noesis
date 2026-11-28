'use client';

import { inquirySounding } from '@/lib/instrument-readings';
import { InstrumentHelp } from '@/components/shared/InstrumentHelp';
import type { Question } from '@/lib/types';
import { useSectionDisclosure } from '@/components/shared/SectionDisclosure';

export function InquirySounding({ question, onOpen }: { question: Question; onOpen: (section: string) => void }) {
  const marks = inquirySounding(question);
  const depth = marks.reduce((reached, mark, index) => mark.recorded ? index + 1 : reached, 0);
  const bob = 26 + depth * 22;
  const { toggle, body } = useSectionDisclosure('the sounding line');
  return (
    <section className="noesis-record-instrument" aria-label="Inquiry sounding line" data-tone="inquiry">
      <div className="flex items-center justify-between gap-2">
        <h2 className="noesis-eyebrow font-bold text-tone">The sounding line</h2>
        <div className="flex items-center"><InstrumentHelp instrument="inquirySounding" />{toggle}</div>
      </div>
      <div {...body}><div className="grid grid-cols-[minmax(4rem,7rem)_minmax(0,1fr)] items-center gap-2">
        <svg viewBox="0 0 105 141" className="w-full text-tone" stroke="currentColor" fill="none" aria-hidden="true">
          <path d="M4 24q12-7 24 0t24 0t24 0t24 0" strokeWidth="2" />
          {marks.map((mark, index) => <path key={mark.target} d={`M36 ${48 + index * 22}h32`} strokeDasharray={mark.recorded ? undefined : '3 4'} opacity={mark.recorded ? .8 : .35} />)}
          <path d={`M52 24V${bob}`} strokeWidth="2" />
          <path d={`M52 ${bob}l7 10-7 10-7-10Z`} fill="currentColor" />
        </svg>
        <ol className="grid" role="list">
          {marks.map((mark, index) => <li key={mark.target}>
            <button type="button" onClick={() => onOpen(mark.target)} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-1 rounded-md px-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{index + 1}</span>
              <span className="min-w-0 flex-1">{mark.label}</span>
              <span className={mark.recorded ? 'text-tone' : 'text-muted-foreground'} aria-label={mark.recorded ? 'Recorded' : 'Not recorded'}>{mark.recorded ? '✓' : '–'}</span>
            </button>
          </li>)}
        </ol>
      </div></div>
    </section>
  );
}
