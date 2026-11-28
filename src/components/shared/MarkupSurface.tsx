"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, CircleHelp, Lightbulb, Footprints, BookOpen, List, Quote } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { InstrumentHelp } from '@/components/shared/InstrumentHelp';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AnnotationMark, AnnotationMarkKind } from '@/lib/types';

/**
 * The five kinds a piece of text can be marked as. The kind is the
 * destination: marking something a claim is what sends it toward a position.
 * Reference marks nothing onward; they stay in the passage.
 */
export const MARK_KINDS: Array<{
  kind: AnnotationMarkKind;
  label: string;
  /** Where the mark goes, in the words the app uses for that place. */
  destination: string;
  tone: 'position' | 'inquiry' | 'concept' | 'practice' | 'annotation';
  icon: React.ComponentType<{ className?: string }>;
  /** What the shaped text should become, shown above the editable field. */
  prompt: string;
}> = [
  { kind: 'claim', label: 'Claim', destination: 'Positions', tone: 'position', icon: Flag, prompt: 'The claim, in your own words. This becomes the position’s statement.' },
  { kind: 'question', label: 'Question', destination: 'Inquiries', tone: 'inquiry', icon: CircleHelp, prompt: 'The question this raises. This becomes the inquiry.' },
  { kind: 'definition', label: 'Definition', destination: 'Concepts', tone: 'concept', icon: Lightbulb, prompt: 'The meaning this gives. It is attached to the concept you name.' },
  { kind: 'action', label: 'Action', destination: 'Praxis', tone: 'practice', icon: Footprints, prompt: 'The action you would repeat or observe. This becomes the practice.' },
  { kind: 'reference', label: 'Reference', destination: 'Stays here', tone: 'annotation', icon: BookOpen, prompt: 'Kept as a reference inside this passage.' },
];

export const markKind = (kind: AnnotationMarkKind) => MARK_KINDS.find((item) => item.kind === kind) || MARK_KINDS[4];

/** First sentence of a passage, for a shaped suggestion that is not the whole thing. */
export function shapeMarkText(kind: AnnotationMarkKind, text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (kind === 'question') return /\?\s*$/.test(clean) ? clean : `${clean.replace(/[.;:,]+$/, '')}?`;
  if (kind === 'action') return clean.replace(/^(i|we)\s+(should|could|must)\s+/i, '').replace(/^./, (letter) => letter.toUpperCase());
  return clean;
}

interface Segment { start: number; end: number; kinds: AnnotationMarkKind[] }

/** Split the passage at every mark boundary, so nested marks can be drawn. */
function segments(text: string, marks: AnnotationMark[]): Segment[] {
  const bounds = new Set<number>([0, text.length]);
  for (const mark of marks) { bounds.add(Math.max(0, mark.start)); bounds.add(Math.min(text.length, mark.end)); }
  const points = [...bounds].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]; const end = points[index + 1];
    if (end <= start) continue;
    out.push({ start, end, kinds: marks.filter((mark) => mark.start <= start && mark.end >= end).map((mark) => mark.kind) });
  }
  return out;
}

/**
 * The markup tool. The passage stays whole; you select part of it and mark
 * that part as one of the five kinds. Marks may nest. Nothing is extracted
 * here: the list of marks is where a mark is sent onward.
 */
export function MarkupSurface({ text, marks, onAddMark, onSelect, disabled, label = 'Passage' }: {
  text: string;
  marks: AnnotationMark[];
  onAddMark: (kind: AnnotationMarkKind, start: number, end: number, marked: string) => void;
  onSelect?: (selection: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const passage = useRef<HTMLParagraphElement>(null);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [sentenceIndex, setSentenceIndex] = useState<number | null>(null);
  const [sentencePickerOpen, setSentencePickerOpen] = useState(false);

  const offsetsOf = useCallback(() => {
    const element = passage.current;
    const selection = window.getSelection();
    if (!element || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const selected = selection.getRangeAt(0);
    if (!element.contains(selected.commonAncestorContainer)) return null;
    const before = selected.cloneRange();
    before.selectNodeContents(element);
    before.setEnd(selected.startContainer, selected.startOffset);
    const start = before.toString().length;
    const end = start + selected.toString().length;
    return end > start ? { start, end } : null;
  }, []);

  useEffect(() => {
    const onChange = () => {
      const next = offsetsOf();
      setRange(next);
      if (next) { setSentenceIndex(null); onSelect?.(text.slice(next.start, next.end)); }
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, [offsetsOf, onSelect, text]);

  // Sentences give a keyboard and touch path to the same marks.
  const sentences = useMemo(() => {
    const out: Array<{ start: number; end: number; text: string }> = [];
    const pattern = /[^.!?]+[.!?]*\s*/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      if (!match[0].trim()) continue;
      out.push({ start: match.index, end: match.index + match[0].trimEnd().length, text: match[0].trim() });
    }
    return out.length ? out : [{ start: 0, end: text.length, text }];
  }, [text]);

  const active = range ?? (sentenceIndex !== null ? sentences[sentenceIndex] ?? null : null);
  const activeText = active ? text.slice(active.start, active.end) : '';

  const add = (kind: AnnotationMarkKind) => {
    if (!active || disabled) return;
    onAddMark(kind, active.start, active.end, activeText);
    window.getSelection()?.removeAllRanges();
    setRange(null); setSentenceIndex(null);
  };

  return (
    <div className="noesis-markup">
      <div className="noesis-markup__passage">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="h2" tone="annotation" className="inline-flex items-center gap-2"><Quote className="size-4" aria-hidden="true" />{label}</Eyebrow>
        <div className="flex items-center gap-1">
        <InstrumentHelp instrument="markup" />
        <Popover open={sentencePickerOpen} onOpenChange={setSentencePickerOpen}>
          <PopoverTrigger asChild><IconButton type="button" label="Pick a sentence" size="sm" disabled={disabled}><List aria-hidden="true" /></IconButton></PopoverTrigger>
          <PopoverContent aria-label="Pick a sentence" align="end" className="w-[min(23rem,calc(100vw-2rem))]">
            <ul className="grid max-h-[45dvh] gap-1.5 overflow-y-auto" aria-label="Sentences in this passage">
              {sentences.map((sentence, index) => (
                <li key={sentence.start}>
                  <button type="button" className="noesis-markup__sentence min-h-11 break-words" aria-pressed={sentenceIndex === index} onClick={() => {
                    window.getSelection()?.removeAllRanges();
                    setRange(null);
                    setSentenceIndex(index);
                    onSelect?.(text.slice(sentence.start, sentence.end));
                    setSentencePickerOpen(false);
                  }}>{sentence.text}</button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        </div>
      </div>
      <p ref={passage} className="noesis-markup__text">
        {segments(text, marks).map((segment) => {
          const inner = segment.kinds[segment.kinds.length - 1];
          const style: React.CSSProperties = {};
          if (inner) style.background = `hsl(var(--kind-${markKind(inner).tone}) / .2)`;
          if (segment.kinds.length) {
            // One rule per mark, stacked downward, so overlapping marks are
            // countable instead of blending into a single thick line.
            style.paddingBottom = `${segment.kinds.length * 4}px`;
            style.backgroundImage = [
              ...(inner ? [`linear-gradient(hsl(var(--kind-${markKind(inner).tone}) / .2), hsl(var(--kind-${markKind(inner).tone}) / .2))`] : []),
              ...segment.kinds.map((kind) => `linear-gradient(hsl(var(--kind-${markKind(kind).tone})), hsl(var(--kind-${markKind(kind).tone})))`),
            ].join(', ');
            style.backgroundRepeat = 'no-repeat';
            style.backgroundSize = [
              ...(inner ? ['100% 100%'] : []),
              ...segment.kinds.map(() => '100% 2px'),
            ].join(', ');
            style.backgroundPosition = [
              ...(inner ? ['0 0'] : []),
              ...segment.kinds.map((_, depth) => `0 calc(100% - ${depth * 4}px)`),
            ].join(', ');
            style.background = undefined;
          }
          return <span key={`${segment.start}-${segment.end}`} style={style} title={segment.kinds.length > 1 ? `${segment.kinds.length} marks: ${segment.kinds.map((kind) => markKind(kind).label).join(', ')}` : undefined}>{text.slice(segment.start, segment.end)}</span>;
        })}
      </p>
      </div>

      <div className="noesis-markup__bar">
        <span className="text-sm text-muted-foreground">{activeText ? `Marking “${activeText.length > 48 ? `${activeText.slice(0, 47)}…` : activeText}”` : 'Select text to mark it.'}</span>
        {active && <div className="flex flex-wrap gap-1.5">
          {MARK_KINDS.map(({ kind, label: name, tone, icon: Icon, destination }) => (
            <Button key={kind} variant="secondary" size="sm" tone={tone} disabled={disabled} onPointerDown={event => {
              if (range && event.pointerType === 'mouse') event.preventDefault();
            }} onClick={() => add(kind)} title={`Mark as ${name.toLowerCase()} → ${destination}`}>
              <Icon className="size-3.5" aria-hidden="true" /> {name}
            </Button>
          ))}
        </div>}
      </div>
    </div>
  );
}
