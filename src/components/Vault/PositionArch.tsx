"use client";

import { InstrumentHelp } from '@/components/shared/InstrumentHelp';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { cn } from '@/lib/utils';

/**
 * The arch: what a claim rests on, drawn as the thing it is.
 *
 * A position's assumptions are load-bearing — the schema says so — and
 * falsification is the condition under which the claim stops standing. Both
 * were text fields. Here they are structure: the keystone is the claim, each
 * voussoir is one assumption, recorded challenges press down from above, and
 * pulling a stone shows what the span does without it.
 *
 * Same drawing language as the evidence scale in Inquiries: stroke only,
 * fills under a third, colour from the kind token, so it re-tints with the
 * appearance theme and sits beside the balance as a sibling instrument.
 *
 * The cost of pulling a stone is the claim's confidence divided by the number
 * of assumptions. That is a deliberately flat rule: nothing in the record says
 * which assumption carries more, so each bears an equal share rather than a
 * weighting we would have invented.
 */

const VIEW = { w: 440, h: 232 };
const CX = VIEW.w / 2;
const GROUND = 186;
const R_OUT = 148;
const R_IN = 96;
const KEY_HALF = 15;      // degrees either side of the crown
const MAX_LOAD = 4;       // load arrows drawn before they stop being countable

const point = (angle: number, radius: number) => {
  const rad = (angle * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), GROUND - radius * Math.sin(rad)];
};

/** One voussoir, between two angles on the arc. */
function wedge(a1: number, a2: number) {
  const [ox1, oy1] = point(a1, R_OUT);
  const [ox2, oy2] = point(a2, R_OUT);
  const [ix2, iy2] = point(a2, R_IN);
  const [ix1, iy1] = point(a1, R_IN);
  return `M${ox1.toFixed(1)} ${oy1.toFixed(1)} A${R_OUT} ${R_OUT} 0 0 1 ${ox2.toFixed(1)} ${oy2.toFixed(1)}`
    + ` L${ix2.toFixed(1)} ${iy2.toFixed(1)} A${R_IN} ${R_IN} 0 0 0 ${ix1.toFixed(1)} ${iy1.toFixed(1)} Z`;
}

/**
 * Where each assumption sits on the arc.
 *
 * Splitting the count in two and giving each side the same stone width does
 * not work: with an odd count one side overruns and eats into the crown. So
 * the stones tile one continuous run of arc instead, all the same width, and
 * the keystone's wedge is cut out of the middle of it. A stone that would
 * straddle the crown is drawn as two wedges springing from either side —
 * which is how a single assumption still closes a whole arch.
 *
 * Returns one entry per wedge; `stone` says which assumption it belongs to,
 * so two wedges can share an index.
 */
export function archSpans(count: number) {
  if (count < 1) return [];
  const half = (180 - KEY_HALF * 2) / 2;        // arc available on each side
  const step = (half * 2) / count;              // every stone the same width
  // The run is continuous; the circle is not, because the keystone interrupts
  // it. So each side gets its own mapping, and they disagree at the seam by
  // exactly the keystone's width — which is the point.
  const left = (run: number) => 180 - run;                    // 0..half  -> 180..105
  const right = (run: number) => 180 - KEY_HALF * 2 - run;    // half..2*half -> 75..0
  const wedges: { stone: number; from: number; to: number }[] = [];
  for (let stone = 0; stone < count; stone++) {
    const start = stone * step;
    const end = start + step;
    if (end <= half + 1e-9) {
      wedges.push({ stone, from: left(start), to: left(end) });
    } else if (start >= half - 1e-9) {
      wedges.push({ stone, from: right(start), to: right(end) });
    } else {
      // Straddles the crown: spring one wedge from each side of the keystone.
      wedges.push({ stone, from: left(start), to: left(half) });
      wedges.push({ stone, from: right(half), to: right(end) });
    }
  }
  return wedges;
}

export function PositionArch({
  claim, assumptions, confidence, challengeCount, falsification, onAddAssumption, className,
}: {
  claim: string;
  assumptions: string[];
  confidence: number;
  challengeCount: number;
  falsification?: string;
  onAddAssumption?: () => void;
  className?: string;
}) {
  const stones = assumptions.map((text) => text.trim()).filter(Boolean);
  const [pulled, setPulled] = useState<Set<number>>(new Set());
  const spans = archSpans(stones.length);

  const share = stones.length ? Math.round(confidence / stones.length) : 0;
  const out = [...pulled];
  const without = Math.max(0, confidence - out.length * share);
  const toggle = (index: number) => setPulled((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  const load = Math.min(challengeCount, MAX_LOAD);
  const standing = out.length === 0;

  if (!stones.length) {
    // The instrument at rest: a claim with nothing drawn under it yet.
    return (
      <section className={cn('noesis-arch', className)} data-tone="position" aria-label="What holds this claim up">
        <div className="noesis-arch__head">
          <Eyebrow as="h3">What holds it up</Eyebrow>
          <InstrumentHelp instrument="arch" />
        </div>
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" className="noesis-arch__draw"
          aria-label="No assumptions recorded: the claim has nothing drawn under it.">
          <path d={wedge(90 + KEY_HALF, 90 - KEY_HALF)} className="noesis-arch__key" />
          <path d={`M${CX - 112} ${GROUND} H${CX + 112}`} className="noesis-arch__ground" />
          <path d={`M${CX - 70} ${GROUND - 2} A ${R_OUT} ${R_OUT} 0 0 1 ${CX + 70} ${GROUND - 2}`}
            className="noesis-arch__absent" />
        </svg>
        <p className="noesis-arch__note">
          No explicit assumptions recorded. The grounds for and against the claim are tracked separately.
        </p>
        {onAddAssumption && (
          <Button type="button" variant="outline" size="sm" onClick={onAddAssumption}>Name an assumption</Button>
        )}
      </section>
    );
  }

  return (
    <section className={cn('noesis-arch', className)} data-tone="position" aria-label="What holds this claim up">
      <div className="noesis-arch__head">
        <Eyebrow as="h3">What holds it up</Eyebrow>
        <div className="flex items-center gap-2">
          <span className="noesis-arch__hint">Pull a stone to test the span</span>
          <InstrumentHelp instrument="arch" />
        </div>
      </div>

      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" className="noesis-arch__draw"
        aria-label={`An arch of ${stones.length} load-bearing ${stones.length === 1 ? 'assumption' : 'assumptions'} under the claim, carrying ${challengeCount} recorded ${challengeCount === 1 ? 'challenge' : 'challenges'}.`}>
        {spans.map((span, index) => (
          <path key={index} d={wedge(span.from, span.to)} className="noesis-arch__stone"
            data-pulled={pulled.has(span.stone) || undefined} />
        ))}
        <path d={wedge(90 + KEY_HALF, 90 - KEY_HALF)} className="noesis-arch__key" data-failing={!standing || undefined} />

        <path d={`M${CX - 206} ${GROUND} H${CX + 206}`} className="noesis-arch__ground" />
        <g className="noesis-arch__hatch" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => {
            const x = CX - 190 + index * 54;
            return <path key={index} d={`M${x} ${GROUND} l-11 15`} />;
          })}
        </g>

        {/* Recorded challenges press on the extrados. */}
        <g className="noesis-arch__load" aria-hidden="true">
          {Array.from({ length: load }, (_, index) => {
            const x = CX - (load - 1) * 17 + index * 34;
            return (
              <g key={index}>
                <path d={`M${x} 6 v13`} />
                <path d={`M${x - 4} 20 l4 8 4 -8Z`} className="noesis-arch__head-fill" />
              </g>
            );
          })}
        </g>

        <text x={CX} y={GROUND - R_IN - 26} className="noesis-arch__keylabel" textAnchor="middle">THE CLAIM</text>
        {!standing && (
          <path d={`M${CX + 28} ${GROUND - R_OUT + 4} l-7 20 9 10 -7 24`} className="noesis-arch__crack" />
        )}
      </svg>

      <div className="noesis-arch__read">
        <span>
          <Eyebrow>Confidence</Eyebrow>
          <b className="noesis-arch__figure">{standing ? confidence : without}</b>
          {!standing && <small className="noesis-arch__was">was {confidence}</small>}
        </span>
        <span>
          <Eyebrow>Span</Eyebrow>
          <b className="noesis-arch__verdict">
            {standing ? 'Sound' : out.length >= stones.length ? 'Collapsed' : out.length > 1 ? 'Unsafe' : 'Weakened'}
          </b>
        </span>
        {challengeCount > 0 && (
          <span>
            <Eyebrow>Under load</Eyebrow>
            <b className="noesis-arch__verdict">{challengeCount} {challengeCount === 1 ? 'challenge' : 'challenges'}</b>
          </span>
        )}
      </div>

      <p className="noesis-arch__note">
        {standing
          ? `${stones.length === 1 ? 'One assumption carries' : `${stones.length} assumptions carry`} the span. The keystone holds while ${stones.length === 1 ? 'it does' : 'they do'}.`
          : `Without ${out.length === 1 ? 'that assumption' : 'those assumptions'}, ${claim ? `“${claim}”` : 'this claim'} rests on ${stones.length - out.length || 'nothing'}${stones.length - out.length ? ' of its stated grounds' : ''}.`}
      </p>

      <ul className="noesis-arch__stones">
        {stones.map((text, index) => (
          <li key={index}>
            <button type="button" className="noesis-arch__pull" aria-pressed={pulled.has(index)}
              onClick={() => toggle(index)}>
              <span className="noesis-arch__n">{index + 1}</span>
              <span className="noesis-arch__text">{text}</span>
              <span className="noesis-arch__state">{pulled.has(index) ? 'pulled' : 'bearing'}</span>
            </button>
          </li>
        ))}
      </ul>

      {falsification?.trim() && (
        <details className="noesis-fold noesis-arch__fold">
          <summary><span>What would change my mind</span></summary>
          <div className="noesis-fold__body"><p>{falsification}</p></div>
        </details>
      )}
    </section>
  );
}
