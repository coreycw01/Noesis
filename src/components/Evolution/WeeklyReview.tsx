"use client";

import { useState } from 'react';
import { ArrowUpRight, CalendarRange } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { localDateKey } from '@/lib/calendar';
import { evolutionDisplayDate, normalizeEvolutionDate, olderEvolutionHistoryMayMatch } from '@/lib/evolution-history';
import { homeHistoryTarget } from '@/lib/home-history';
import { viewToPath } from '@/lib/noesis-routes';
import type { Media, ThinkingEvent } from '@/lib/types';
import { weeklyReviewEvents } from '@/lib/weekly-review';

function eventPath(event: ThinkingEvent, media: Media[], reviewMode: boolean) {
  const { view, targetId, annotationSourceId } = homeHistoryTarget(event, media);
  if (!targetId) return null;
  switch (view) {
    case 'concepts': return viewToPath(view, { reviewMode, conceptId: targetId });
    case 'questions': return viewToPath(view, { reviewMode, questionId: targetId });
    case 'vault': return viewToPath(view, { reviewMode, positionId: targetId });
    case 'library': return viewToPath(view, { reviewMode, sourceId: targetId });
    case 'writing': return viewToPath(view, { reviewMode, workId: targetId });
    case 'labs': return viewToPath(view, { reviewMode, practiceId: targetId });
    case 'annotations': return viewToPath(view, { reviewMode, annotationId: targetId, annotationSourceId });
    default: return null;
  }
}

export function WeeklyReview({ events, media, hasMore, loading, error, onLoadMore }: {
  events: ThinkingEvent[];
  media: Media[];
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
}) {
  const reviewMode = /^\/(demo|review)(\/|$)/.test(usePathname());
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const changes = open ? weeklyReviewEvents(events, now) : [];
  const moreThisWeek = open && olderEvolutionHistoryMayMatch(hasMore, localDateKey(new Date(now - 7 * 86_400_000)), events);

  return (
    <Dialog open={open} onOpenChange={next => { if (next) setNow(Date.now()); setOpen(next); }}>
      <DialogTrigger asChild><Button type="button" variant="outline"><CalendarRange aria-hidden="true" />Weekly review</Button></DialogTrigger>
      <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Weekly review</DialogTitle>
          <DialogDescription>Meaningful changes from the last seven days.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {changes.length ? <ul className="divide-y divide-border">
            {changes.map(event => {
              const href = eventPath(event, media, reviewMode);
              const date = normalizeEvolutionDate(event.createdAt);
              const text = event.summary || event.eventType.replaceAll('_', ' ');
              return (
                <li key={event.id} className="min-w-0">
                  {href ? <Link href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between gap-3 break-words px-1 py-2 text-sm hover:underline focus-visible:outline focus-visible:outline-ring focus-visible:outline-offset-[-2px]">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link> : <p className="break-words px-1 pb-1 pt-2 text-sm">{text}</p>}
                  {date && <time dateTime={date} className="block px-1 pb-2 text-xs text-muted-foreground">{evolutionDisplayDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>}
                </li>
              );
            })}
          </ul> : <p className="py-2 text-sm text-muted-foreground">{moreThisWeek ? 'No changes in the history loaded so far.' : 'No meaningful changes recorded in the last seven days.'}</p>}
          {moreThisWeek && <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={onLoadMore}>{loading ? 'Loading history...' : error ? 'Retry loading history' : 'Load more history'}</Button>
            {error && <p role="status" className="text-xs text-muted-foreground">Older changes could not be loaded.</p>}
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
