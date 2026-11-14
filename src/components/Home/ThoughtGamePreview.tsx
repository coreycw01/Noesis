"use client";

import { useMemo } from 'react';
import { ArrowRight, Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildThoughtGames, thoughtGameDayKey } from '@/lib/thought-games';

export function ThoughtGamePreview({ onOpen, concepts, inquiries, positions, media, links }: Omit<Parameters<typeof buildThoughtGames>[0], 'dayKey'> & { onOpen: () => void }) {
  const dayKey = thoughtGameDayKey();
  const [game] = useMemo(
    () => buildThoughtGames({ concepts, inquiries, positions, media, links, dayKey }),
    [concepts, inquiries, positions, media, links, dayKey],
  );
  if (!game) return null;
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between" aria-label={"Today\u2019s exercise"}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
          <Puzzle className="size-4 stroke-[2.4]" aria-hidden="true" />
          Today&apos;s exercise
        </div>
        <h2 className="mt-2 font-headline text-lg font-semibold italic leading-tight text-foreground">{game.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{game.instruction}</p>
      </div>
      <Button type="button" size="sm" onClick={onOpen} className="shrink-0 rounded-md">
        Open exercises
        <ArrowRight className="ml-1 size-4" aria-hidden="true" />
      </Button>
    </section>
  );
}
