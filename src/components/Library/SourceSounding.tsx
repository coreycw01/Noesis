"use client";

import { Eyebrow } from '@/components/ui/eyebrow';
import { cn } from '@/lib/utils';
import { nextSourceJourneyStep, type SourceJourneyState, type SourceJourneyStep } from '@/lib/source-journey';

/**
 * The sounding line: how far down a source you have actually been.
 *
 * sourceJourney() already measures four fathoms of a reader's own work —
 * Understand, Engage, Capture, Connect — and gives each a plain next move. It
 * was computed and never drawn. A bar chart would read as a score; a sounding
 * line reads as depth, which is the question a reader is actually asking: not
 * "how much of this did I finish" but "how far into it did I get".
 *
 * Marked every fathom. The bob hangs at the sum of the four, not at the
 * shallowest unfinished step, so it reads as total work rather than as a
 * blocked checklist. That has a wrinkle worth knowing: a reader who has
 * annotated heavily but barely reflected will see the bob hanging below a
 * mark that is not lit, because the depth is a total and the marks are each
 * step's own state. Both readings are true and they answer different
 * questions — how far in am I, and what have I actually finished.
 */

const STEPS: { key: SourceJourneyStep; label: string }[] = [
  { key: 'overview', label: 'Understand' },
  { key: 'capture', label: 'Engage' },
  { key: 'annotations', label: 'Capture' },
  { key: 'connections', label: 'Connect' },
];

const VIEW = { w: 260, h: 184 };
const SURFACE = 34;
const FATHOM = 32;              // vertical distance between marks

/** How deep the line has paid out, in fathoms, from the four measured steps. */
export function soundingDepth(state: Record<SourceJourneyStep, SourceJourneyState>) {
  // A fathom counts as reached once that step is mostly done; the part-done
  // step the bob rests in is carried as a fraction, so the line moves as work
  // is added rather than jumping a whole mark at a time.
  return STEPS.reduce((depth, { key }) => depth + Math.min(1, Math.max(0, state[key].progress)), 0);
}

export function SourceSounding({ state, className }: {
  state: Record<SourceJourneyStep, SourceJourneyState>;
  className?: string;
}) {
  const depth = soundingDepth(state);
  const next = nextSourceJourneyStep(state);
  const bob = SURFACE + depth * FATHOM;
  const struck = depth >= 3.9;
  const reached = Math.floor(depth + 1e-9);

  return (
    <section className={cn('noesis-sounding', className)} data-tone="source"
      aria-label={`Sounding: ${depth.toFixed(1)} of 4 fathoms taken`}>
      <div className="noesis-sounding__head">
        <Eyebrow as="h3">How far down you have been</Eyebrow>
        <span className="noesis-sounding__figure">{depth.toFixed(1)}<small> / 4</small></span>
      </div>

      <div className="noesis-sounding__body">
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="noesis-sounding__draw" role="img"
          aria-label={`The line is out ${depth.toFixed(1)} fathoms of four.`}>
          {/* surface */}
          <path d={`M12 ${SURFACE} q28 -8 56 0 t56 0 t56 0 t56 0`} className="noesis-sounding__surface" />
          {/* paid-out line */}
          <line x1={VIEW.w / 2} y1={SURFACE} x2={VIEW.w / 2} y2={bob} className="noesis-sounding__line" />
          {/* fathom marks */}
          {STEPS.map(({ key, label }, index) => {
            const y = SURFACE + (index + 1) * FATHOM;
            const done = state[key].progress >= 0.75;
            return (
              <g key={key} className="noesis-sounding__mark" data-done={done || undefined}>
                <line x1={VIEW.w / 2 - 13} y1={y} x2={VIEW.w / 2 + 13} y2={y} />
                <text x={VIEW.w / 2 + 20} y={y + 3.5}>{label.toUpperCase()}</text>
                <text x={VIEW.w / 2 - 20} y={y + 3.5} textAnchor="end">{index + 1}</text>
              </g>
            );
          })}
          {/* the bob */}
          <path d={`M${VIEW.w / 2} ${bob} l8 12 -8 14 -8 -14Z`} className="noesis-sounding__bob" />
          {struck && <path d={`M12 ${SURFACE + 4.4 * FATHOM} q28 -6 56 0 t56 0 t56 0 t56 0`} className="noesis-sounding__bed" />}
        </svg>

        <div className="noesis-sounding__read">
          <p className="noesis-sounding__meta">
            {STEPS.map(({ key, label }) => (
              <span key={key} data-done={state[key].progress >= 0.75 || undefined}>
                <b>{label}</b> {state[key].meta}
              </span>
            ))}
          </p>
          <p className="noesis-sounding__next">
            {next
              ? state[next].next
              : `Bottom found: ${reached} of 4 fathoms, and nothing left unread in this one.`}
          </p>
        </div>
      </div>
    </section>
  );
}
