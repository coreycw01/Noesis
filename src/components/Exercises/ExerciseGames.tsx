"use client";

import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Panel } from '@/components/ui/panel';
import { SectionEmpty } from '@/components/shared/SectionEmpty';
import { cn } from '@/lib/utils';
import type { Concept, Practice, Question, VaultEntry } from '@/lib/types';
import {
  buildBlanks, buildChain, buildMatch, buildOdd, buildSort, seededShuffle,
  SORT_BINS, type SortCard, type StatementKind,
} from '@/lib/exercise-games';

/** One verdict line, in the voice every game uses. */
function Verdict({ state, right, wrong }: { state: 'none' | 'right' | 'wrong'; right: string; wrong: string }) {
  if (state === 'none') return <p className="noesis-game__verdict" aria-live="polite" />;
  return (
    <p className={cn('noesis-game__verdict', state === 'right' ? 'is-right' : 'is-wrong')} aria-live="polite" data-tone={state === 'right' ? 'ok' : 'problem'}>
      {state === 'right' ? right : wrong}
    </p>
  );
}

/** Match the term: tap a term, then its definition. A line joins the pair. */
function MatchGame({ concepts, seed }: { concepts: Concept[]; seed: string }) {
  const pairs = useMemo(() => buildMatch(concepts, seed), [concepts, seed]);
  const definitions = useMemo(() => seededShuffle(pairs, `defs:${seed}`), [pairs, seed]);
  const [picked, setPicked] = useState<string | null>(null);
  const [joined, setJoined] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  if (pairs.length < 3) return <SectionEmpty title="Not enough defined concepts yet." hint="Define three concepts and this game opens." />;
  const right = Object.entries(joined).filter(([term, definition]) => term === definition).length;
  const join = (definitionId: string) => {
    if (!picked) return;
    setJoined((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([, value]) => value !== definitionId)), [picked]: definitionId }));
    setPicked(null); setChecked(false);
  };
  return (
    <div className="noesis-game">
      <div className="noesis-game__cols">
        <ul className="grid gap-2" aria-label="Terms">
          {pairs.map((pair) => (
            <li key={pair.id}>
              <button type="button" aria-pressed={picked === pair.id}
                className={cn('noesis-game__card noesis-game__card--term', joined[pair.id] && 'is-joined', checked && joined[pair.id] && (joined[pair.id] === pair.id ? 'is-right' : 'is-wrong'))}
                onClick={() => { if (joined[pair.id]) { setJoined((c) => { const next = { ...c }; delete next[pair.id]; return next; }); setChecked(false); return; } setPicked(picked === pair.id ? null : pair.id); }}>
                {pair.term}
              </button>
            </li>
          ))}
        </ul>
        <ul className="grid gap-2" aria-label="Definitions">
          {definitions.map((pair) => {
            const joinedTo = Object.entries(joined).find(([, value]) => value === pair.id)?.[0];
            return (
              <li key={pair.id}>
                <button type="button" disabled={!picked && !joinedTo}
                  className={cn('noesis-game__card', joinedTo && 'is-joined', checked && joinedTo && (joinedTo === pair.id ? 'is-right' : 'is-wrong'))}
                  onClick={() => join(pair.id)}>
                  {pair.definition}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="noesis-game__bar">
        <Button variant="primary" size="sm" disabled={Object.keys(joined).length < pairs.length} onClick={() => setChecked(true)}>Check my matches</Button>
        <Button variant="ghost" size="sm" onClick={() => { setJoined({}); setPicked(null); setChecked(false); }}>Start over</Button>
      </div>
      <Verdict state={!checked ? 'none' : right === pairs.length ? 'right' : 'wrong'} right={`All ${pairs.length} match.`} wrong={`${right} of ${pairs.length} right. The wrong ones are marked.`} />
    </div>
  );
}

/** Fill the blanks in one of your own definitions, from a short word bank. */
function BlanksGame({ concepts, seed }: { concepts: Concept[]; seed: string }) {
  const spec = useMemo(() => buildBlanks(concepts, seed), [concepts, seed]);
  const [filled, setFilled] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  if (!spec) return <SectionEmpty title="Not enough written definitions yet." hint="Write a definition of eight words or more and this game opens." />;
  const words = spec.text.split(/\s+/);
  const blankAt = new Map(spec.blanks.map((blank) => [blank.index, blank.word]));
  const rightCount = spec.blanks.filter((blank) => (filled[blank.index] || '').toLowerCase() === blank.word.toLowerCase()).length;
  return (
    <div className="noesis-game">
      <Eyebrow size="sm">From your definition of {spec.source}</Eyebrow>
      <p className="noesis-game__passage">
        {words.map((word, index) => blankAt.has(index) ? (
          <button key={index} type="button"
            className={cn('noesis-game__blank', filled[index] && 'is-filled', checked && filled[index] && ((filled[index] || '').toLowerCase() === blankAt.get(index)!.toLowerCase() ? 'is-right' : 'is-wrong'))}
            onClick={() => { if (picked) { setFilled((current) => ({ ...current, [index]: picked })); setPicked(null); setChecked(false); } else if (filled[index]) { setFilled((current) => { const next = { ...current }; delete next[index]; return next; }); setChecked(false); } }}>
            {filled[index] || ' '.repeat(8)}
          </button>
        ) : <span key={index}>{word} </span>)}
      </p>
      <div className="noesis-game__bank" role="group" aria-label="Word bank">
        {spec.bank.map((word) => (
          <button key={word} type="button" aria-pressed={picked === word}
            className={cn('noesis-game__word', picked === word && 'is-picked', Object.values(filled).includes(word) && 'is-used')}
            onClick={() => setPicked(picked === word ? null : word)}>{word}</button>
        ))}
      </div>
      <div className="noesis-game__bar">
        <Button variant="primary" size="sm" disabled={Object.keys(filled).length < spec.blanks.length} onClick={() => setChecked(true)}>Check</Button>
        <Button variant="ghost" size="sm" onClick={() => { setFilled({}); setPicked(null); setChecked(false); }}>Start over</Button>
      </div>
      <Verdict state={!checked ? 'none' : rightCount === spec.blanks.length ? 'right' : 'wrong'} right="Both right: that is how you wrote it." wrong={`${rightCount} of ${spec.blanks.length} right.`} />
    </div>
  );
}

/** Sort statements from your workspace back into the kind of thing they are. */
function SortGame({ concepts, inquiries, positions, practices, seed }: { concepts: Concept[]; inquiries: Question[]; positions: VaultEntry[]; practices: Practice[]; seed: string }) {
  const cards = useMemo(() => buildSort(concepts, inquiries, positions, practices, seed), [concepts, inquiries, positions, practices, seed]);
  const [placed, setPlaced] = useState<Record<string, StatementKind>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const dragged = useRef<string | null>(null);
  if (cards.length < 4) return <SectionEmpty title="Not enough records yet." hint="A position, an inquiry, a concept and a practice are enough to start." />;
  const unplaced = cards.filter((card) => !placed[card.id]);
  const right = cards.filter((card) => placed[card.id] === card.kind).length;
  const drop = (kind: StatementKind, id: string | null) => {
    if (!id) return;
    setPlaced((current) => ({ ...current, [id]: kind }));
    setPicked(null); setChecked(false);
  };
  const cardFace = (card: SortCard) => (
    <button key={card.id} type="button" aria-pressed={picked === card.id} draggable
      onDragStart={() => { dragged.current = card.id; }}
      className={cn('noesis-game__card noesis-game__card--sort', picked === card.id && 'is-picked', checked && placed[card.id] && (placed[card.id] === card.kind ? 'is-right' : 'is-wrong'))}
      onClick={() => { if (placed[card.id]) { setPlaced((c) => { const next = { ...c }; delete next[card.id]; return next; }); setChecked(false); return; } setPicked(picked === card.id ? null : card.id); }}>
      “{card.text}”
    </button>
  );
  return (
    <div className="noesis-game">
      <div className="noesis-game__deck">{unplaced.map(cardFace)}{!unplaced.length && <span className="text-sm text-muted-foreground">All sorted. Check your answer.</span>}</div>
      <div className="noesis-game__bins">
        {SORT_BINS.map((bin) => (
          <div key={bin.kind} data-tone={bin.tone} className="noesis-game__bin"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); drop(bin.kind, dragged.current); dragged.current = null; }}
            onClick={() => drop(bin.kind, picked)}>
            <Eyebrow size="sm" tone={bin.tone}>{bin.label}</Eyebrow>
            <span className="text-xs text-muted-foreground">{bin.hint}</span>
            {cards.filter((card) => placed[card.id] === bin.kind).map(cardFace)}
          </div>
        ))}
      </div>
      <div className="noesis-game__bar">
        <Button variant="primary" size="sm" disabled={unplaced.length > 0} onClick={() => setChecked(true)}>Check</Button>
        <Button variant="ghost" size="sm" onClick={() => { setPlaced({}); setPicked(null); setChecked(false); }}>Start over</Button>
      </div>
      <Verdict state={!checked ? 'none' : right === cards.length ? 'right' : 'wrong'} right={`All ${cards.length} sorted.`} wrong={`${right} of ${cards.length}. Each card came from the part of the workspace that names its kind.`} />
    </div>
  );
}

/** Put a position's grounds in order, ending at the claim they support. */
function ChainGame({ positions, seed }: { positions: VaultEntry[]; seed: string }) {
  const spec = useMemo(() => buildChain(positions, seed), [positions, seed]);
  const shuffled = useMemo(() => spec ? seededShuffle(spec.steps, `order:${seed}`) : [], [spec, seed]);
  const [order, setOrder] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  React.useEffect(() => { setOrder(shuffled.map((step) => step.id)); setChecked(false); }, [shuffled]);
  if (!spec) return <SectionEmpty title="No position with two recorded grounds yet." hint="Add support to a position and this game opens." />;
  const byId = new Map(spec.steps.map((step) => [step.id, step]));
  const correct = spec.steps.map((step) => step.id);
  const isRight = order.join() === correct.join();
  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next); setChecked(false);
  };
  return (
    <div className="noesis-game">
      <Eyebrow size="sm">Grounds first, then what they support · from “{spec.title}”</Eyebrow>
      <ol className="grid gap-2">
        {order.map((id, index) => {
          const step = byId.get(id)!;
          const place = checked && (correct[index] === id ? 'is-right' : 'is-wrong');
          return (
            <li key={id} className={cn('noesis-game__step', place)}>
              <span className="min-w-0 flex-1">{step.text}</span>
              <span className="flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Move “${step.text.slice(0, 30)}” up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Move “${step.text.slice(0, 30)}” down`} disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</Button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="noesis-game__bar">
        <Button variant="primary" size="sm" onClick={() => setChecked(true)}>Check the order</Button>
        <Button variant="ghost" size="sm" onClick={() => { setOrder(shuffled.map((step) => step.id)); setChecked(false); }}>Start over</Button>
      </div>
      <Verdict state={!checked ? 'none' : isRight ? 'right' : 'wrong'} right="That is the order you recorded: grounds, then the claim." wrong="Not yet. The claim comes last; everything above it should be what holds it up." />
    </div>
  );
}

/** Spot the statement that counts against the claim, among its supports. */
function OddGame({ positions, seed }: { positions: VaultEntry[]; seed: string }) {
  const spec = useMemo(() => buildOdd(positions, seed), [positions, seed]);
  const [choice, setChoice] = useState<string | null>(null);
  if (!spec) return <SectionEmpty title="No position with both support and a challenge yet." hint="Record a challenge on a position and this game opens." />;
  return (
    <div className="noesis-game">
      <p className="noesis-game__claim">“{spec.claim}”</p>
      <Eyebrow size="sm">One of these you filed as a challenge. Which one?</Eyebrow>
      <ol className="grid gap-2">
        {spec.cards.map((card) => (
          <li key={card.id}>
            <button type="button" aria-pressed={choice === card.id}
              className={cn('noesis-game__step w-full text-left', choice && (card.against ? 'is-right' : choice === card.id && 'is-wrong'))}
              onClick={() => setChoice(card.id)}>
              {card.text}
            </button>
          </li>
        ))}
      </ol>
      <div className="noesis-game__bar"><Button variant="ghost" size="sm" onClick={() => setChoice(null)}>Start over</Button></div>
      <Verdict state={!choice ? 'none' : choice === spec.againstId ? 'right' : 'wrong'}
        right="Yes: that is the one you recorded as a challenge to this claim."
        wrong="No: that one supports the claim. The challenge is marked in green." />
    </div>
  );
}

const GAMES = [
  { id: 'match', title: 'Match the term', hint: 'Tap a term, then the definition you wrote for it.' },
  { id: 'blanks', title: 'Fill the blanks', hint: 'Put the missing words back into your own definition.' },
  { id: 'sort', title: 'What kind of statement is it?', hint: 'Drag each card into a bin, or tap a card and then a bin.' },
  { id: 'chain', title: 'Build the argument', hint: 'Order the grounds so they lead to the claim.' },
  { id: 'odd', title: 'Spot the objection', hint: 'Among a claim\u2019s grounds, one is the challenge you recorded against it.' },
] as const;

/**
 * Five exercises played on the person's own records. They are games, not
 * worksheets: everything here is tapped, dragged or reordered, and every
 * answer is one the workspace already knows.
 */
export function ExerciseGames({ concepts, inquiries, positions, practices, seed }: {
  concepts: Concept[];
  inquiries: Question[];
  positions: VaultEntry[];
  practices: Practice[];
  seed: string;
}) {
  const [open, setOpen] = useState<(typeof GAMES)[number]['id']>('match');
  return (
    <section aria-label="Exercises">
      <div className="noesis-game__tabs" role="tablist" aria-label="Choose an exercise">
        {GAMES.map((game) => (
          <button key={game.id} role="tab" type="button" aria-selected={open === game.id} className="noesis-pill" onClick={() => setOpen(game.id)}>{game.title}</button>
        ))}
      </div>
      {GAMES.filter((game) => game.id === open).map((game) => (
        <Panel key={game.id} size="lg" className="mt-3" title={game.title} description={game.hint} headingLevel="h2">
          {game.id === 'match' && <MatchGame concepts={concepts} seed={seed} />}
          {game.id === 'blanks' && <BlanksGame concepts={concepts} seed={seed} />}
          {game.id === 'sort' && <SortGame concepts={concepts} inquiries={inquiries} positions={positions} practices={practices} seed={seed} />}
          {game.id === 'chain' && <ChainGame positions={positions} seed={seed} />}
          {game.id === 'odd' && <OddGame positions={positions} seed={seed} />}
        </Panel>
      ))}
    </section>
  );
}
