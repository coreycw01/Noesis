"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Puzzle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Concept, Media, PhilosophicalLink, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';
import { buildThoughtGames, thoughtGameDayKey } from '@/lib/thought-games';

interface ThoughtGamesPanelProps {
  concepts: Concept[];
  inquiries: Question[];
  positions: VaultEntry[];
  media: Media[];
  links: PhilosophicalLink[];
  onNavigate: (target: { view: NoesisView; targetId?: string | null }) => void;
}

export function ThoughtGamesPanel({ concepts, inquiries, positions, media, links, onNavigate }: ThoughtGamesPanelProps) {
  const dayKey = thoughtGameDayKey();
  const games = useMemo(
    () => buildThoughtGames({ concepts, inquiries, positions, media, links, dayKey }),
    [concepts, dayKey, inquiries, links, media, positions]
  );
  const [gameIndex, setGameIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [response, setResponse] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const game = games[gameIndex % Math.max(1, games.length)];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`noesis:thought-games:${dayKey}`);
      setCompletedIds(stored ? JSON.parse(stored) : []);
    } catch {
      setCompletedIds([]);
    }
  }, [dayKey]);

  const resetResponse = () => {
    setSelectedOption('');
    setResponse('');
    setRevealed(false);
  };

  const completeGame = () => {
    if (!game) return;
    const next = Array.from(new Set([...completedIds, game.id]));
    setCompletedIds(next);
    try {
      window.localStorage.setItem(`noesis:thought-games:${dayKey}`, JSON.stringify(next));
    } catch {
      // Completion is a convenience marker; the exercise remains usable without local storage.
    }
  };

  const advanceGame = (markComplete: boolean) => {
    if (markComplete) completeGame();
    setGameIndex((index) => (index + 1) % Math.max(1, games.length));
    resetResponse();
  };

  if (!game) return null;

  const canReveal = Boolean(selectedOption || response.trim());
  const completed = completedIds.includes(game.id);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            <Puzzle className="size-4 stroke-[2.4]" aria-hidden="true" />
            Daily Thought
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">A short exercise grounded in your own Noesis records.</p>
        </div>
        <div className="shrink-0 text-right font-code text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {completedIds.length} completed today
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">{game.label}</span>
          <span className="max-w-full truncate text-xs text-muted-foreground" title={game.sourceLabel}>{game.sourceLabel}</span>
        </div>
        <h2 className="mt-2 font-headline text-xl font-semibold italic leading-tight text-foreground">{game.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{game.instruction}</p>
        <div className="mt-4 whitespace-pre-line border-y border-border/70 py-4 text-base leading-7 text-foreground/90">{game.prompt}</div>

        {game.options?.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Answer choices">
            {game.options.map((option) => {
              const selected = selectedOption === option;
              const correct = revealed && game.answer === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setSelectedOption(option); setRevealed(false); }}
                  className={cn(
                    'min-h-12 rounded-md border px-3 py-2 text-left text-sm leading-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-accent bg-accent/10 text-foreground' : 'border-border hover:bg-muted/30',
                    correct && 'border-emerald-500 bg-emerald-500/10'
                  )}
                  aria-pressed={selected}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>{option}</span>
                    {(selected || correct) && <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Textarea
            value={response}
            onChange={(event) => { setResponse(event.target.value); setRevealed(false); }}
            placeholder="Write your answer before revealing what is already recorded..."
            className="mt-4 min-h-24 rounded-md"
          />
        )}

        {!revealed ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setRevealed(true)} disabled={!canReveal} className="rounded-md">
              Review answer
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => advanceGame(false)} className="rounded-md">
              Skip
            </Button>
          </div>
        ) : (
          <div className="mt-4 border-l-2 border-accent pl-4">
            {game.answer && (
              <div className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">
                Recorded answer: {game.answer}
              </div>
            )}
            <p className="mt-1 text-sm leading-6 text-foreground/85">{game.reveal}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Your response stays temporary unless you deliberately update the related record.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => advanceGame(true)} className="rounded-md">
                {completed ? 'Next exercise' : 'Complete and continue'}
                <ChevronRight className="ml-1 size-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onNavigate(game.target)} className="rounded-md">
                Open related item
                <ArrowRight className="ml-1 size-4" aria-hidden="true" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={resetResponse} className="size-9 rounded-md" aria-label="Try this exercise again" title="Try again">
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
