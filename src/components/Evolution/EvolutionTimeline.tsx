"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Media, ThinkingEvent, ThinkingMetrics, ThinkingPattern, TimelineEvent, Unknown } from '@/lib/types';
import { cn } from '@/lib/utils';

interface EvolutionTimelineProps {
  events: TimelineEvent[];
  media: Media[];
  thinkingEvents: ThinkingEvent[];
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  metrics: ThinkingMetrics;
}

type EvolutionFilter =
  | 'all'
  | 'belief_revisions'
  | 'confidence'
  | 'unknowns'
  | 'contradictions'
  | 'patterns'
  | 'questions'
  | 'replacements'
  | 'links';

type DisplayEvent = {
  id: string;
  kind: 'thinking' | 'timeline' | 'unknown' | 'pattern';
  title: string;
  detail: string;
  date: string;
  filter: EvolutionFilter;
  chips: string[];
  sourceIds?: string[];
};

const FILTER_OPTIONS: Array<{ value: EvolutionFilter; label: string }> = [
  { value: 'all', label: 'All Changes' },
  { value: 'belief_revisions', label: 'Belief Revisions' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'unknowns', label: 'Unknowns' },
  { value: 'contradictions', label: 'Contradictions' },
  { value: 'patterns', label: 'Patterns' },
  { value: 'questions', label: 'Questions' },
  { value: 'replacements', label: 'Replacements' },
  { value: 'links', label: 'Links' },
];

function mapThinkingEventToFilter(eventType: ThinkingEvent['eventType']): EvolutionFilter {
  if (['position_created', 'position_revised', 'position_abandoned'].includes(eventType)) return 'belief_revisions';
  if (eventType === 'confidence_changed') return 'confidence';
  if (['unknown_created', 'unknown_resolved'].includes(eventType)) return 'unknowns';
  if (['contradiction_detected', 'contradiction_resolved'].includes(eventType)) return 'contradictions';
  if (['thinking_pattern_inferred', 'thinking_pattern_acknowledged', 'thinking_pattern_dismissed'].includes(eventType)) return 'patterns';
  if (['question_created', 'question_promoted'].includes(eventType)) return 'questions';
  if (['position_replaced'].includes(eventType)) return 'replacements';
  if (['link_created'].includes(eventType)) return 'links';
  return 'all';
}

export function EvolutionTimeline({ events, media, thinkingEvents, unknowns, thinkingPatterns, metrics }: EvolutionTimelineProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EvolutionFilter>('all');
  const [pageSize, setPageSize] = useState<5 | 10>(5);
  const [page, setPage] = useState(0);

  const displayEvents = useMemo<DisplayEvent[]>(() => {
    const fromThinking = thinkingEvents.map((event) => ({
      id: event.eventId,
      kind: 'thinking' as const,
      title: event.summary,
      detail: typeof event.metadata === 'object' && event.metadata ? JSON.stringify(event.metadata) : `${event.targetType} · ${event.sourceType}`,
      date: event.createdAt,
      filter: mapThinkingEventToFilter(event.eventType),
      chips: [event.eventType.replace(/_/g, ' '), event.sourceType, event.targetType],
    }));

    const fromTimeline = events.map((event) => ({
      id: event.id,
      kind: 'timeline' as const,
      title: event.entityTitle,
      detail: event.reason,
      date: event.date,
      filter: 'all' as const,
      chips: [event.eventType, event.entityType],
      sourceIds: event.influencedBy,
    }));

    const fromUnknowns = unknowns.map((item) => ({
      id: item.unknownId,
      kind: 'unknown' as const,
      title: item.title,
      detail: item.resolutionSummary || item.description || 'Unknown recorded in the system.',
      date: item.resolvedAt || item.dateUpdated || item.dateCreated,
      filter: 'unknowns' as const,
      chips: [item.status, item.importance, item.createdFrom],
      sourceIds: item.sourceIds,
    }));

    const fromPatterns = thinkingPatterns.map((pattern) => ({
      id: pattern.patternId,
      kind: 'pattern' as const,
      title: pattern.label,
      detail: pattern.description,
      date: pattern.dateUpdated || pattern.dateCreated,
      filter: 'patterns' as const,
      chips: [pattern.patternType.replace(/_/g, ' '), pattern.status, pattern.trendDirection],
    }));

    return [...fromThinking, ...fromTimeline, ...fromUnknowns, ...fromPatterns].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [events, thinkingEvents, thinkingPatterns, unknowns]);

  const filteredEvents = useMemo(() => {
    return displayEvents.filter((event) => {
      const filterOk = filter === 'all' || event.filter === filter;
      const haystack = `${event.title} ${event.detail} ${event.chips.join(' ')}`.toLowerCase();
      const queryOk = !search || haystack.includes(search.toLowerCase());
      return filterOk && queryOk;
    });
  }, [displayEvents, filter, search]);

  useEffect(() => {
    setPage(0);
  }, [filter, pageSize, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pagedEvents = filteredEvents.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeStart = filteredEvents.length ? safePage * pageSize + 1 : 0;
  const rangeEnd = Math.min(filteredEvents.length, safePage * pageSize + pageSize);

  return (
    <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-7xl mx-auto w-full font-body">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-[28px] font-headline font-semibold italic text-foreground/80">Evolution</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Trace how your concepts, inquiries, positions, works, and practices change over time.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as 5 | 10)}>
            <SelectTrigger className="h-9 w-40 rounded-full bg-muted/40 font-code text-[10px] uppercase tracking-widest">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5" className="font-code text-[10px] uppercase">Recent 5</SelectItem>
              <SelectItem value="10" className="font-code text-[10px] uppercase">Recent 10</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search changes..." className="w-64 pl-9 bg-muted/40 font-code text-[11px] h-9" />
          </div>
        </div>
      </header>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Beliefs Revised" value={metrics.beliefsRevised} />
        <MetricCard label="Contradictions Resolved" value={metrics.contradictionsResolved} />
        <MetricCard label="Unknowns Resolved" value={metrics.unknownsResolved} />
        <MetricCard label="Stress Tests Answered" value={metrics.positionsStressTested} />
      </div>

      <div className="mb-10">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[10px] font-code font-bold uppercase tracking-[0.14em] transition-all whitespace-nowrap',
                filter === option.value ? 'bg-accent text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/50 bg-white p-4 shadow-sm">
        <div>
          <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Recent Changes</div>
          <p className="mt-1 text-sm italic text-muted-foreground">
            Showing {rangeStart}-{rangeEnd} of {filteredEvents.length} evolution events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="size-9 rounded-full bg-white" title="Newer events">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-20 text-center font-code text-[10px] uppercase tracking-widest text-muted-foreground">
            {safePage + 1} / {totalPages}
          </span>
          <Button variant="outline" size="icon" disabled={safePage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} className="size-9 rounded-full bg-white" title="Older events">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="relative pl-8 space-y-12 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-border/60">
        {pagedEvents.map((event, idx) => {
          const influencedSources = media.filter((item) => (event.sourceIds || []).includes(item.id));
          return (
            <div key={event.id} className="relative animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="absolute -left-[32px] top-1.5 size-2 rounded-full bg-accent ring-4 ring-background z-10" />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {event.chips.map((chip) => (
                    <Badge key={chip} variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                      {chip}
                    </Badge>
                  ))}
                </div>

                <h3 className="font-headline font-bold text-2xl text-primary leading-tight">{event.title}</h3>
                <p className="font-body italic text-[16px] text-muted-foreground leading-relaxed max-w-3xl">{event.detail}</p>

                {influencedSources.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {influencedSources.map((source) => (
                      <Badge key={source.id} variant="secondary" className="bg-muted/30 text-[9px] font-code uppercase tracking-tighter py-0.5 px-2 border-transparent hover:bg-muted/50 transition-colors flex items-center gap-1.5 rounded-full">
                        <BookIcon className="size-2.5 opacity-40" />
                        {source.title}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="pt-2">
                  <time className="font-code text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </time>
                </div>
              </div>
            </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="py-20 text-center opacity-30">
            <History className="size-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-headline italic mb-2">No evolution recorded</h2>
            <p className="max-w-xs mx-auto font-body">Once positions are revised, unknowns are named, and tensions are resolved, the memory-of-change layer will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-white p-4 shadow-sm">
      <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-headline text-3xl font-bold italic text-primary">{value}</div>
    </div>
  );
}

const BookIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    <path d="M6.5 2H20v20H6.5" />
    <path d="M6.5 18H20" />
  </svg>
);
