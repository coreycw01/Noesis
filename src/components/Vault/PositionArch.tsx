"use client";

import { InstrumentHelp } from '@/components/shared/InstrumentHelp';

import { useRef, useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * The foundation represents recorded support, not its strength. Assumptions
 * can be pulled for a thought experiment without scoring or writing anything.
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
  assumptions, confidence, supportCount, challengeCount, onSaveAssumptions, className,
}: {
  assumptions: string[];
  confidence: number;
  supportCount: number;
  challengeCount: number;
  onSaveAssumptions?: (assumptions: string[]) => Promise<void>;
  className?: string;
}) {
  const stones = assumptions.map((text) => text.trim()).filter(Boolean);
  const [pulled, setPulled] = useState<Set<number>>(new Set());
  const [addedText, setAddedText] = useState('');
  const [edit, setEdit] = useState<{ index: number; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const spans = archSpans(stones.length);

  const toggle = (index: number) => setPulled((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  const load = Math.min(challengeCount, MAX_LOAD);

  const save = async (next: string[]) => {
    if (!onSaveAssumptions || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSaveAssumptions(next);
      setEdit(null);
      setAddedText('');
      setPulled(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this assumption. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = (edit ? edit.text : addedText).trim();
    if (!text) return;
    void save(edit ? stones.map((stone, index) => index === edit.index ? text : stone) : [...stones, text]);
  };

  return (
    <section className={cn('noesis-arch', className)} data-tone="position" aria-label="What holds this claim up">
      <div className="noesis-arch__head">
        <Eyebrow as="h3">What holds it up</Eyebrow>
        <div className="flex items-center gap-2">
          {stones.length > 0 && <span className="noesis-arch__hint">Test an assumption</span>}
          <InstrumentHelp instrument="arch" />
        </div>
      </div>

      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" className="noesis-arch__draw"
        aria-label={`Position arch: ${supportCount} supporting grounds, ${stones.length} recorded assumptions, and ${challengeCount} recorded challenges.`}>
        {spans.map((span, index) => (
          <path key={index} d={wedge(span.from, span.to)} className="noesis-arch__stone"
            data-pulled={pulled.has(span.stone) || undefined} />
        ))}
        {!stones.length && <path d={`M${CX - R_OUT} ${GROUND} A${R_OUT} ${R_OUT} 0 0 1 ${CX + R_OUT} ${GROUND}`} className="noesis-arch__absent" />}
        <path d={wedge(90 + KEY_HALF, 90 - KEY_HALF)} className="noesis-arch__key" />
        <rect x={CX - 168} y={GROUND} width="336" height="16" rx="2" className="noesis-arch__foundation" data-recorded={supportCount > 0} />
        <text x={CX} y={GROUND + 34} className="noesis-arch__keylabel" textAnchor="middle">SUPPORTING GROUNDS</text>

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
      </svg>

      <div className="noesis-arch__read">
        <span>
          <Eyebrow>Stated confidence</Eyebrow>
          <b className="noesis-arch__figure">{confidence}%</b>
        </span>
        <span>
          <Eyebrow>Supporting grounds</Eyebrow>
          <b className="noesis-arch__verdict">{supportCount}</b>
        </span>
        {challengeCount > 0 && (
          <span>
            <Eyebrow>Under load</Eyebrow>
            <b className="noesis-arch__verdict">{challengeCount} {challengeCount === 1 ? 'challenge' : 'challenges'}</b>
          </span>
        )}
      </div>

      <div aria-live="polite">
        {pulled.size > 0 ? <p className="noesis-arch__note">
          {pulled.size === 1 ? 'If this assumption did not hold, which grounds would still support the claim?' : 'If these assumptions did not hold, which grounds would still support the claim?'} Your stated confidence is unchanged.
        </p> : !stones.length ? <p className="noesis-arch__note">No explicit assumptions recorded.</p> : null}
      </div>
      {stones.length > 0 && <ul aria-label="Assumptions" className="noesis-arch__stones max-h-60 overflow-y-auto overscroll-contain">
        {stones.map((text, index) => (
          <li key={index} className="flex min-w-0 items-start gap-1">
            {edit?.index === index ? (
              <form onSubmit={submit} className="grid min-w-0 flex-1 gap-2">
                <Textarea aria-label={`Edit assumption ${index + 1}`} value={edit.text}
                  onChange={event => setEdit({ index, text: event.target.value })} rows={2} disabled={saving} />
                <div className="flex flex-wrap gap-1">
                  <Button type="submit" size="sm" disabled={saving || !edit.text.trim() || edit.text.trim() === text}>Save</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { setEdit(null); setError(''); }}>Cancel</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={saving} className="text-destructive" onClick={() => void save(stones.filter((_, i) => i !== index))}>Remove</Button>
                </div>
              </form>
            ) : <>
              <button type="button" className="noesis-arch__pull min-w-0 flex-1" aria-pressed={pulled.has(index)}
                onClick={() => toggle(index)}>
                <span className="noesis-arch__n">{index + 1}</span>
                <span className="noesis-arch__text break-words">{text}</span>
                <span className="noesis-arch__state" aria-hidden="true">{pulled.has(index) ? 'pulled' : 'bearing'}</span>
              </button>
              {onSaveAssumptions && <IconButton label={`Edit assumption ${index + 1}`} variant="ghost" disabled={saving || Boolean(edit)}
                onClick={() => { setEdit({ index, text }); setError(''); }}><Pencil className="size-4" /></IconButton>}
            </>}
          </li>
        ))}
      </ul>}

      {onSaveAssumptions && !edit && <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
        <Textarea aria-label="New assumption" placeholder="What does this claim depend on?" value={addedText}
          onChange={event => setAddedText(event.target.value)} rows={2} disabled={saving} className="min-w-32 flex-1" />
        <Button type="submit" size="sm" disabled={saving || !addedText.trim()}>Add assumption</Button>
      </form>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
