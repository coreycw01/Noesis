"use client";

import { useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Shuffle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Concept, Media, PhilosophicalLink, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';
import { NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';
import {
  buildThoughtGames,
  THOUGHT_GAME_FAMILY_LABELS,
  THOUGHT_GAME_KIND_HINTS,
  thoughtGameDayKey,
  thoughtGameFamily,
  type ThoughtGame,
  type ThoughtGameFamily,
} from '@/lib/thought-games';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { readBrowserPreference, workspacePreferenceKey, writeBrowserPreference } from '@/lib/browser-preferences';

const FAMILY_NOTE: Record<ThoughtGameFamily, string> = {
  records: 'Built from your concepts, positions and sources. They get sharper as your workspace grows.',
  general: 'Reasoning, fallacies, thinkers and classic puzzles. They work from day one.',
};

/**
 * Exercises, as in the prototype: a card table with two decks. Pick any card,
 * or deal a round of five that mixes both decks. Answers stay private; every
 * card ends by pointing at the record or page it could change.
 */
export function ExercisesTable({ concepts, inquiries, positions, media, links, onNavigate }: {
  concepts: Concept[];
  inquiries: Question[];
  positions: VaultEntry[];
  media: Media[];
  links: PhilosophicalLink[];
  onNavigate: (target: { view: NoesisView; targetId?: string | null }) => void;
}) {
  const dayKey = thoughtGameDayKey();
  const workspaceKey = useContext(NoesisWorkspaceKeyContext);
  const completionKey = workspacePreferenceKey(workspaceKey, `thought-games:${dayKey}`);
  const games = useMemo(() => buildThoughtGames({ concepts, inquiries, positions, media, links, dayKey }), [concepts, dayKey, inquiries, links, media, positions]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [round, setRound] = useState<string[] | null>(null);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = completionKey ? readBrowserPreference(completionKey) : null;
      const values: unknown = stored ? JSON.parse(stored) : [];
      setDone(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []);
    } catch { setDone([]); }
  }, [completionKey]);

  const markDone = (id: string) => {
    const next = Array.from(new Set([...done, id]));
    setDone(next);
    if (completionKey) writeBrowserPreference(completionKey, JSON.stringify(next));
  };

  const deal = () => {
    const pool = [...games].sort(() => Math.random() - 0.5).slice(0, 5).map((game) => game.id);
    if (!pool.length) return;
    setRound(pool);
    setOpenId(pool[0]);
  };

  const open = games.find((game) => game.id === openId) || null;
  const roundIndex = open && round ? round.indexOf(open.id) : -1;
  const next = () => {
    if (round && roundIndex >= 0 && roundIndex < round.length - 1) setOpenId(round[roundIndex + 1]);
    else { setRound(null); setOpenId(null); }
  };

  const header = (
    <PageHeader
      title="Exercises"
      description="Short exercises that sharpen how you think. Answers stay private; each card ends with what it could change."
      meta={<span className="font-code text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{done.length} of {games.length} played today</span>}
      actions={<Button type="button" onClick={deal} disabled={!games.length} className="rounded-full"><Shuffle className="mr-1.5 size-4" aria-hidden="true" />Deal a round of five</Button>}
    />
  );

  if (open) {
    return (
      <div className="noesis-gutter mx-auto w-full max-w-[var(--page-measure)] pb-28">
        {header}
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOpenId(null); setRound(null); }}><ArrowLeft className="mr-1 size-4" aria-hidden="true" />All exercises</Button>
          {roundIndex >= 0 && round && <span className="font-code text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Round · card {roundIndex + 1} of {round.length}</span>}
        </div>
        <div className="noesis-gtable">
          <ExerciseCard
            key={open.id}
            game={open}
            completed={done.includes(open.id)}
            onComplete={() => markDone(open.id)}
            onFollow={() => onNavigate({ view: open.target.view, targetId: open.target.targetId || null })}
            onNext={next}
            nextLabel={round && roundIndex >= 0 ? (roundIndex < round.length - 1 ? 'Next card' : 'Finish the round') : 'Back to the table'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="noesis-gutter mx-auto w-full max-w-[var(--page-measure)] pb-28">
      {header}
      {(['records', 'general'] as ThoughtGameFamily[]).map((family) => {
        const deck = games.filter((game) => thoughtGameFamily(game.kind) === family);
        return (
          <section key={family} className="mb-8" aria-labelledby={`deck-${family}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`deck-${family}`} className="font-headline text-2xl font-semibold italic">{THOUGHT_GAME_FAMILY_LABELS[family]}</h2>
              <span className="text-sm text-muted-foreground">{FAMILY_NOTE[family]}</span>
            </div>
            {deck.length ? (
              <div className="noesis-gdeck">
                {deck.map((game, index) => (
                  <button key={game.id} type="button" onClick={() => setOpenId(game.id)} className="noesis-gcard" data-family={family} style={{ ['--tilt' as string]: `${((index % 5) - 2) * 0.6}deg` }}>
                    <span className="noesis-gcard__suit" aria-hidden="true">{family === 'records' ? '◆' : '♣'}</span>
                    <span className="noesis-gcard__name">{game.label}</span>
                    <span className="noesis-gcard__hint">{THOUGHT_GAME_KIND_HINTS[game.kind]}</span>
                    <span className="noesis-gcard__src">{game.sourceLabel}</span>
                    {done.includes(game.id) && <span className="noesis-gcard__done"><Check className="size-3.5" aria-hidden="true" />Played</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-[var(--card-radius)] border border-dashed border-border p-5 text-sm text-muted-foreground">Add a few concepts and positions and this deck deals itself.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ExerciseCard({ game, completed, onComplete, onFollow, onNext, nextLabel }: {
  game: ThoughtGame;
  completed: boolean;
  onComplete: () => void;
  onFollow: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const [bet, setBet] = useState(70);
  const [revealed, setRevealed] = useState(false);
  const family = thoughtGameFamily(game.kind);
  const isBet = game.kind === 'confidence_calibration' && !game.options?.length;
  const canTurn = isBet || Boolean(choice || text.trim());
  const turn = () => { setRevealed(true); onComplete(); };
  const followLabel = game.target.targetId ? 'Open the record' : NOESIS_PAGE_BY_VIEW[game.target.view]?.title || 'Open';

  return (
    <article className="noesis-gcard noesis-gcard--big" data-family={family}>
      <span className="noesis-gcard__suit" aria-hidden="true">{family === 'records' ? '◆' : '♣'}</span>
      <div className="font-code text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--deck))]">{game.label} · {game.sourceLabel}</div>
      <h2 className="mt-2 font-headline text-2xl font-semibold italic leading-tight">{game.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{game.instruction}</p>
      <blockquote className="noesis-gcard__prompt">{game.prompt}</blockquote>

      {game.options?.length ? (
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Answer choices">
          {game.options.map((option) => {
            const right = revealed && option === game.answer;
            const wrong = revealed && option === choice && option !== game.answer;
            return (
              <button key={option} type="button" disabled={revealed} aria-pressed={choice === option} onClick={() => setChoice(option)} className={cn('noesis-gopt', right && 'noesis-gopt--right', wrong && 'noesis-gopt--wrong')}>
                {option}
              </button>
            );
          })}
        </div>
      ) : isBet ? (
        <label className="flex items-center gap-3 text-sm">Your bet
          <input type="range" min={0} max={100} value={bet} disabled={revealed} onChange={(event) => setBet(Number(event.target.value))} className="flex-1 accent-[hsl(var(--deck))]" />
          <span className="w-10 font-code">{bet}%</span>
        </label>
      ) : (
        <Textarea value={text} disabled={revealed} onChange={(event) => setText(event.target.value)} placeholder="Write before you turn the card." aria-label="Your answer" className="min-h-24" />
      )}

      {!revealed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={turn} disabled={!canTurn} className="rounded-full">Turn the card</Button>
          <Button type="button" variant="ghost" onClick={onNext}>Skip</Button>
        </div>
      ) : (
        <div className="noesis-gcard__reveal" role="status">
          {game.answer && <p className="font-medium">{choice === game.answer ? 'Right.' : 'Not quite.'} <span className="text-muted-foreground">Answer: {game.answer}</span></p>}
          <p>{game.reveal}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onFollow} className="rounded-full">What this changes → {followLabel}<ArrowRight className="ml-1 size-4" aria-hidden="true" /></Button>
            <Button type="button" onClick={onNext} className="rounded-full">{nextLabel}</Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Play this card again" title="Play again" onClick={() => { setRevealed(false); setChoice(''); setText(''); }}><RotateCcw className="size-4" /></Button>
          </div>
          {completed && <p className="font-code text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Private practice: nothing was saved to your records.</p>}
        </div>
      )}
    </article>
  );
}
