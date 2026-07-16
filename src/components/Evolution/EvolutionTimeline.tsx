"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Media, ThinkingEvent, ThinkingMetrics, ThinkingPattern, TimelineEvent, Unknown } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';

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
  turningPoint?: string;
  trigger?: string;
  significance?: string;
  beforeLabel?: string;
  afterLabel?: string;
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
  if (['created', 'edited', 'revised', 'abandoned', 'position_created', 'position_revised', 'position_abandoned'].includes(eventType)) return 'belief_revisions';
  if (eventType === 'confidence_changed') return 'confidence';
  if (['unknown_created', 'unknown_resolved'].includes(eventType)) return 'unknowns';
  if (['contradiction_detected', 'contradiction_resolved'].includes(eventType)) return 'contradictions';
  if (['thinking_pattern_inferred', 'thinking_pattern_acknowledged', 'thinking_pattern_dismissed'].includes(eventType)) return 'patterns';
  if (['question_created', 'question_promoted', 'question_resolved', 'position_formed'].includes(eventType)) return 'questions';
  if (['position_replaced'].includes(eventType)) return 'replacements';
  if (['link_created', 'linked', 'unlinked'].includes(eventType)) return 'links';
  return 'all';
}

function summarizeSnapshot(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred = record.title || record.statement || record.status || record.confidence || record.summary || record.description;
    if (preferred) return String(preferred);
    const keys = Object.keys(record).slice(0, 3);
    if (keys.length) return keys.map((key) => `${key}: ${summarizeSnapshot(record[key]) || 'changed'}`).join(' · ');
  }
  return undefined;
}

function thinkingEventMeaning(event: ThinkingEvent): Pick<DisplayEvent, 'turningPoint' | 'trigger' | 'significance' | 'beforeLabel' | 'afterLabel'> {
  const eventText = event.eventType.replace(/_/g, ' ');
  const turningPoint = event.importance === 'major'
    ? 'Major Turning Point'
    : event.eventType.includes('revised') || event.eventType === 'confidence_changed'
      ? 'Revision'
      : event.eventType.includes('resolved')
        ? 'Resolution'
        : event.eventType.includes('abandoned') || event.eventType.includes('replaced')
          ? 'Abandonment / Replacement'
          : event.eventType.includes('challenge') || event.eventType.includes('contradiction')
            ? 'Challenge'
            : event.eventType.includes('created')
              ? 'Origin'
              : 'Meaningful Change';
  const trigger = event.userReason || event.aiReason || event.systemReason || event.metadata?.reason || `${event.sourceType} recorded ${eventText}`;
  const significance = event.diff
    ? `Changed fields: ${Object.keys(event.diff).slice(0, 4).join(', ')}`
    : event.confidenceBefore != null || event.confidenceAfter != null
      ? `Confidence moved from ${event.confidenceBefore ?? 'unknown'} to ${event.confidenceAfter ?? 'unknown'}.`
      : event.epistemicStatus
        ? `Epistemic status: ${event.epistemicStatus.replace(/_/g, ' ')}.`
        : 'Recorded because this action may affect the user’s intellectual biography.';

  return {
    turningPoint,
    trigger: String(trigger),
    significance,
    beforeLabel: summarizeSnapshot(event.before),
    afterLabel: summarizeSnapshot(event.after),
  };
}

function displayEventMeaning(event: DisplayEvent) {
  const joined = event.chips.join(' ').toLowerCase();
  const turningPoint = event.turningPoint || (
    joined.includes('revised') || joined.includes('confidence') ? 'Revision' :
    joined.includes('resolved') ? 'Resolution' :
    joined.includes('unknown') ? 'Known Unknown' :
    joined.includes('contradiction') || joined.includes('challenge') ? 'Challenge' :
    joined.includes('created') ? 'Origin' :
    event.kind === 'pattern' ? 'Pattern Observation' :
    'Meaningful Change'
  );
  const trigger = event.trigger || (event.kind === 'thinking'
    ? 'Recorded through the thinking-event layer.'
    : event.kind === 'timeline'
      ? 'Legacy timeline record.'
      : event.kind === 'unknown'
        ? 'A gap in understanding entered the system.'
        : 'A provisional thinking pattern was recorded.');
  const significance = event.significance || (event.kind === 'timeline'
    ? 'This may be meaningful, but thinking events provide stronger evidence when available.'
    : event.kind === 'pattern'
      ? 'Treat this as provisional until reviewed, acknowledged, or dismissed.'
      : 'This item is part of the user’s recorded intellectual biography.');

  return { turningPoint, trigger, significance };
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
      ...thinkingEventMeaning(event),
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
  const clearEvolutionFilters = () => {
    setSearch('');
    setFilter('all');
  };
  const evolutionFiltersActive = Boolean(search || filter !== 'all');

  return (
    <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-7xl mx-auto w-full font-body">
      <PageHeader
        title="Evolution"
        description="Trace meaningful changes in positions, concepts, inquiries, practices, unknowns, and thinking patterns over time."
        actions={
          <>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as 5 | 10)}>
              <SelectTrigger className="h-9 w-40 rounded-full bg-muted/40 font-code text-[10px] uppercase tracking-widest">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5" className="font-code text-[10px] uppercase">Recent 5</SelectItem>
                <SelectItem value="10" className="font-code text-[10px] uppercase">Recent 10</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Beliefs Revised" value={metrics.beliefsRevised} />
        <MetricCard label="Contradictions Resolved" value={metrics.contradictionsResolved} />
        <MetricCard label="Unknowns Resolved" value={metrics.unknownsResolved} />
        <MetricCard label="Stress Tests Answered" value={metrics.positionsStressTested} />
      </div>

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search changes..."
        resultCount={filteredEvents.length}
        resultLabel="events"
        onClear={clearEvolutionFilters}
        clearDisabled={!evolutionFiltersActive}
        className="mb-8"
      >
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
      </FilterToolbar>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <div>
          <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Meaningful Change Feed</div>
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
          const meaning = displayEventMeaning(event);
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

                <div className="mt-4 grid gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm md:grid-cols-3">
                  <div>
                    <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Turning Point</div>
                    <p className="mt-1 text-sm font-semibold text-primary">{meaning.turningPoint}</p>
                  </div>
                  <div>
                    <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Trigger</div>
                    <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">{meaning.trigger}</p>
                  </div>
                  <div>
                    <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Why It Matters</div>
                    <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">{meaning.significance}</p>
                  </div>
                  {(event.beforeLabel || event.afterLabel) && (
                    <div className="md:col-span-3 grid gap-3 border-t border-border/40 pt-3 md:grid-cols-2">
                      <div className="rounded-xl bg-muted/20 p-3">
                        <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Before</div>
                        <p className="mt-1 text-sm italic text-muted-foreground">{event.beforeLabel || 'Previous state not recorded.'}</p>
                      </div>
                      <div className="rounded-xl bg-accent/5 p-3">
                        <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">After</div>
                        <p className="mt-1 text-sm italic text-primary/80">{event.afterLabel || 'Current state not recorded.'}</p>
                      </div>
                    </div>
                  )}
                </div>

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
          <div className="pl-0">
            <PageEmptyState
              icon={History}
              title="No evolution recorded"
              description="Once positions are revised, unknowns are named, and tensions are resolved, the memory-of-change layer will appear here."
              action={evolutionFiltersActive ? <Button variant="outline" onClick={clearEvolutionFilters} className="rounded-full">Clear filters</Button> : undefined}
            />
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
