"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, History } from 'lucide-react';
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
  | 'links'
  | 'positions'
  | 'concepts'
  | 'inquiries'
  | 'works'
  | 'practices'
  | 'sources';

type EvolutionView = 'turning_points' | 'timeline' | 'belief_rivers' | 'periods' | 'before_after' | 'change_map';

type DisplayEvent = {
  id: string;
  kind: 'thinking' | 'timeline' | 'unknown' | 'pattern';
  targetId: string;
  targetType: string;
  title: string;
  detail: string;
  date: string;
  filter: EvolutionFilter;
  chips: string[];
  importance?: string;
  sourceIds?: string[];
  turningPoint?: string;
  trigger?: string;
  significance?: string;
  beforeLabel?: string;
  afterLabel?: string;
  changedFields?: string[];
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
  { value: 'positions', label: 'Positions' },
  { value: 'concepts', label: 'Concepts' },
  { value: 'inquiries', label: 'Inquiries' },
  { value: 'works', label: 'Works' },
  { value: 'practices', label: 'Practices' },
  { value: 'sources', label: 'Sources' },
];

const VIEW_OPTIONS: Array<{ value: EvolutionView; label: string; description: string }> = [
  { value: 'turning_points', label: 'Turning Points', description: 'Major revisions, discoveries, abandonments, and resolutions.' },
  { value: 'timeline', label: 'Timeline', description: 'Chronological meaningful events, paged for review.' },
  { value: 'belief_rivers', label: 'Belief Rivers', description: 'Follow positions through origin, challenge, revision, and current state.' },
  { value: 'periods', label: 'Periods', description: 'Group events into emerging intellectual chapters.' },
  { value: 'before_after', label: 'Before / After', description: 'Use a date scrubber to compare recorded thought across time.' },
  { value: 'change_map', label: 'Change Map', description: 'See which areas gained, weakened, fractured, or stabilized.' },
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

function dateInputValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function eventTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function eventEvidenceQuality(event: DisplayEvent) {
  const hasBeforeAfter = Boolean(event.beforeLabel || event.afterLabel || event.changedFields?.length);

  if (event.kind === 'thinking' && hasBeforeAfter) {
    return {
      label: 'Event-backed change',
      detail: 'This change has a thinking event plus before/after or changed-field evidence.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (event.kind === 'thinking') {
    return {
      label: 'Event-backed',
      detail: 'This came from the thinkingEvents layer and is stronger evidence than legacy activity.',
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    };
  }

  if (event.kind === 'unknown' || event.kind === 'pattern') {
    return {
      label: 'Provisional interpretation',
      detail: 'This is useful for reflection, but should remain reviewable and revisable.',
      className: 'border-violet-200 bg-violet-50 text-violet-800',
    };
  }

  return {
    label: 'Legacy context',
    detail: 'This is older timeline context. Prefer thinkingEvents for reliable before/after history.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  };
}

function targetTypeMatches(event: DisplayEvent, types: string[]) {
  const target = event.targetType.toLowerCase();
  return types.some((type) => target === type || target.includes(type));
}

function changeAreaForEvent(event: DisplayEvent) {
  if (targetTypeMatches(event, ['position', 'vault'])) return 'Positions';
  if (targetTypeMatches(event, ['concept'])) return 'Concepts';
  if (targetTypeMatches(event, ['question', 'inquiry'])) return 'Inquiries';
  if (targetTypeMatches(event, ['practice'])) return 'Practices';
  if (targetTypeMatches(event, ['work', 'draft'])) return 'Works';
  if (targetTypeMatches(event, ['source', 'media'])) return 'Sources';
  if (targetTypeMatches(event, ['unknown'])) return 'Unknowns';
  if (targetTypeMatches(event, ['thinking_pattern', 'pattern'])) return 'Patterns';
  if (event.filter === 'links' || targetTypeMatches(event, ['link', 'relationship'])) return 'Relationships';
  return 'System';
}

function changeMovementForEvent(event: DisplayEvent): 'gained' | 'weakened' | 'fractured' | 'stabilized' {
  const text = `${event.filter} ${event.chips.join(' ')} ${event.turningPoint || ''} ${event.title}`.toLowerCase();
  if (text.includes('contradiction') || text.includes('challenge') || text.includes('tension')) return 'fractured';
  if (text.includes('abandoned') || text.includes('replaced') || text.includes('weaken') || text.includes('dismissed')) return 'weakened';
  if (text.includes('resolved') || text.includes('acknowledged') || text.includes('stress test') || text.includes('stabilized')) return 'stabilized';
  return 'gained';
}

export function EvolutionTimeline({ events, media, thinkingEvents, unknowns, thinkingPatterns, metrics }: EvolutionTimelineProps) {
  const [view, setView] = useState<EvolutionView>('turning_points');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EvolutionFilter>('all');
  const [pageSize, setPageSize] = useState<5 | 10>(5);
  const [page, setPage] = useState(0);
  const [scrubberDate, setScrubberDate] = useState(() => dateInputValue(new Date().toISOString()));

  const displayEvents = useMemo<DisplayEvent[]>(() => {
    const fromThinking = thinkingEvents.map((event) => ({
      id: event.eventId,
      kind: 'thinking' as const,
      targetId: event.targetId,
      targetType: event.targetType,
      title: event.summary,
      detail: typeof event.metadata === 'object' && event.metadata ? JSON.stringify(event.metadata) : `${event.targetType} · ${event.sourceType}`,
      date: event.createdAt,
      filter: mapThinkingEventToFilter(event.eventType),
      chips: [event.actionType?.replace(/_/g, ' ') || event.eventType.replace(/_/g, ' '), event.sourceType, event.targetType],
      importance: event.importance,
      changedFields: event.changedFields,
      ...thinkingEventMeaning(event),
    }));

    const fromTimeline = events.map((event) => ({
      id: event.id,
      kind: 'timeline' as const,
      targetId: event.entityId,
      targetType: event.entityType,
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
      targetId: item.unknownId,
      targetType: 'unknown',
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
      targetId: pattern.patternId,
      targetType: 'thinking_pattern',
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
      const filterOk = filter === 'all' ||
        event.filter === filter ||
        (filter === 'positions' && targetTypeMatches(event, ['position', 'vault'])) ||
        (filter === 'concepts' && targetTypeMatches(event, ['concept'])) ||
        (filter === 'inquiries' && targetTypeMatches(event, ['question', 'inquiry'])) ||
        (filter === 'works' && targetTypeMatches(event, ['work', 'draft'])) ||
        (filter === 'practices' && targetTypeMatches(event, ['practice'])) ||
        (filter === 'sources' && targetTypeMatches(event, ['source', 'media']));
      const haystack = `${event.title} ${event.detail} ${event.chips.join(' ')}`.toLowerCase();
      const queryOk = !search || haystack.includes(search.toLowerCase());
      return filterOk && queryOk;
    });
  }, [displayEvents, filter, search]);

  const eventCoverage = useMemo(() => {
    const thinkingCount = displayEvents.filter((event) => event.kind === 'thinking').length;
    const legacyCount = displayEvents.filter((event) => event.kind === 'timeline').length;
    const provisionalCount = displayEvents.filter((event) => event.kind === 'unknown' || event.kind === 'pattern').length;
    const beforeAfterCount = displayEvents.filter((event) => event.beforeLabel || event.afterLabel || event.changedFields?.length).length;
    const interpretedCount = displayEvents.length - legacyCount;
    const coverageLevel = thinkingCount === 0
      ? 'limited'
      : thinkingCount >= legacyCount
        ? 'strong'
        : 'mixed';
    return { thinkingCount, legacyCount, interpretedCount, provisionalCount, beforeAfterCount, coverageLevel };
  }, [displayEvents]);

  const turningPoints = useMemo(() => {
    return displayEvents.filter((event) => {
      const text = `${event.turningPoint || ''} ${event.chips.join(' ')} ${event.title}`.toLowerCase();
      return event.importance === 'major' ||
        event.importance === 'high' ||
        ['belief_revisions', 'confidence', 'unknowns', 'contradictions', 'replacements'].includes(event.filter) ||
        text.includes('revised') ||
        text.includes('resolved') ||
        text.includes('abandoned') ||
        text.includes('challenge') ||
        text.includes('contradiction');
    }).slice(0, 8);
  }, [displayEvents]);

  const beliefRivers = useMemo(() => {
    const grouped = new Map<string, DisplayEvent[]>();
    displayEvents
      .filter((event) => targetTypeMatches(event, ['position', 'vault']))
      .forEach((event) => {
        const key = event.targetId || event.title;
        grouped.set(key, [...(grouped.get(key) || []), event]);
      });
    return Array.from(grouped.entries())
      .map(([id, items]) => {
        const sorted = [...items].sort((a, b) => eventTime(a.date) - eventTime(b.date));
        const latest = sorted[sorted.length - 1];
        const challenges = sorted.filter((event) => `${event.chips.join(' ')} ${event.turningPoint || ''}`.toLowerCase().includes('challenge'));
        const revisions = sorted.filter((event) => `${event.chips.join(' ')} ${event.turningPoint || ''}`.toLowerCase().includes('revis'));
        const confidenceMoves = sorted.filter((event) => event.filter === 'confidence');
        return {
          id,
          title: latest?.title || id,
          origin: sorted[0],
          latest,
          events: sorted,
          challenges,
          revisions,
          confidenceMoves,
        };
      })
      .sort((a, b) => eventTime(b.latest.date) - eventTime(a.latest.date))
      .slice(0, 6);
  }, [displayEvents]);

  const periods = useMemo(() => {
    const grouped = new Map<string, DisplayEvent[]>();
    displayEvents.forEach((event) => {
      const date = new Date(event.date);
      const key = Number.isNaN(date.getTime()) ? 'Undated' : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      grouped.set(key, [...(grouped.get(key) || []), event]);
    });
    return Array.from(grouped.entries()).map(([label, items]) => {
      const sorted = [...items].sort((a, b) => eventTime(b.date) - eventTime(a.date));
      const revisionCount = sorted.filter((event) => event.filter === 'belief_revisions' || event.filter === 'confidence').length;
      const uncertaintyCount = sorted.filter((event) => event.filter === 'unknowns' || event.filter === 'questions').length;
      const structureCount = sorted.filter((event) => event.filter === 'links' || event.filter === 'contradictions' || event.filter === 'patterns').length;
      const tone = revisionCount >= uncertaintyCount && revisionCount >= structureCount
        ? 'Worldview reconstruction'
        : uncertaintyCount >= structureCount
          ? 'Uncertainty and inquiry'
          : 'Structural integration';
      return { label, items: sorted, revisionCount, uncertaintyCount, structureCount, tone };
    }).sort((a, b) => eventTime(b.items[0]?.date || '') - eventTime(a.items[0]?.date || '')).slice(0, 8);
  }, [displayEvents]);

  const changeMap = useMemo(() => {
    const grouped = new Map<string, DisplayEvent[]>();
    displayEvents.forEach((event) => {
      const area = changeAreaForEvent(event);
      grouped.set(area, [...(grouped.get(area) || []), event]);
    });

    return Array.from(grouped.entries())
      .map(([area, items]) => {
        const movements = items.reduce(
          (counts, event) => {
            counts[changeMovementForEvent(event)] += 1;
            return counts;
          },
          { gained: 0, weakened: 0, fractured: 0, stabilized: 0 }
        );
        const latest = [...items].sort((a, b) => eventTime(b.date) - eventTime(a.date))[0];
        const dominant = (Object.entries(movements).sort((a, b) => b[1] - a[1])[0]?.[0] || 'gained') as keyof typeof movements;
        const status =
          dominant === 'fractured' ? 'fractured' :
          dominant === 'weakened' ? 'weakened' :
          dominant === 'stabilized' ? 'stabilized' :
          'gained';
        return { area, items, movements, latest, status };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [displayEvents]);

  const scrubberSummary = useMemo(() => {
    const selectedEnd = new Date(`${scrubberDate}T23:59:59`).getTime();
    const throughDate = displayEvents.filter((event) => eventTime(event.date) <= selectedEnd);
    const afterDate = displayEvents.filter((event) => eventTime(event.date) > selectedEnd);
    const activePositionEvents = throughDate.filter((event) =>
      targetTypeMatches(event, ['position', 'vault']) &&
      !event.chips.join(' ').toLowerCase().includes('abandoned') &&
      !event.chips.join(' ').toLowerCase().includes('replaced')
    );
    const conceptEvents = throughDate.filter((event) => targetTypeMatches(event, ['concept']));
    const inquiryEvents = throughDate.filter((event) =>
      targetTypeMatches(event, ['question', 'inquiry']) &&
      !event.chips.join(' ').toLowerCase().includes('resolved')
    );
    const atlasEvents = throughDate.filter((event) =>
      targetTypeMatches(event, ['link', 'relationship', 'pattern', 'unknown']) ||
      ['links', 'contradictions', 'patterns', 'unknowns'].includes(event.filter)
    );
    return {
      throughDate,
      afterDate,
      activePositionEvents,
      conceptEvents,
      inquiryEvents,
      atlasEvents,
      currentDifferences: afterDate.slice(0, 4),
    };
  }, [displayEvents, scrubberDate]);

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
  const activeEvolutionFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    filter !== 'all' ? `Change type: ${FILTER_OPTIONS.find((option) => option.value === filter)?.label || filter.replace(/_/g, ' ')}` : null,
  ].filter(Boolean) as string[];

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

      <section className={cn(
        "mb-8 rounded-2xl border p-4 shadow-sm",
        eventCoverage.coverageLevel === 'strong' ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/80"
      )}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", eventCoverage.coverageLevel === 'strong' ? "text-emerald-700" : "text-amber-700")} />
            <div>
              <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Recorded History Coverage</div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                This view reflects recorded meaningful actions. Thinking events are strongest evidence; legacy timeline records are shown as context when event coverage is incomplete.
              </p>
            </div>
          </div>
          <div className="grid min-w-[320px] grid-cols-2 gap-2 lg:grid-cols-5">
            <MiniEvolutionStat label="Events" value={eventCoverage.thinkingCount} />
            <MiniEvolutionStat label="Timeline" value={eventCoverage.legacyCount} />
            <MiniEvolutionStat label="Interpreted" value={eventCoverage.interpretedCount} />
            <MiniEvolutionStat label="Before/After" value={eventCoverage.beforeAfterCount} />
            <MiniEvolutionStat label="Provisional" value={eventCoverage.provisionalCount} />
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-3 lg:grid-cols-5">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setView(option.value)}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all',
              view === option.value ? 'border-accent bg-accent/10 shadow-sm' : 'border-border/50 bg-card hover:border-accent/40'
            )}
          >
            <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{option.label}</div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{option.description}</p>
          </button>
        ))}
      </div>

      {view === 'turning_points' && (
        <section className="mb-8 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="mb-5">
            <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Turning Points</div>
            <h2 className="mt-1 font-headline text-2xl font-bold italic text-primary">The moments that changed the system</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {turningPoints.length ? turningPoints.map((event) => {
              const meaning = displayEventMeaning(event);
              return (
                <div key={event.id} className="rounded-2xl border border-border/50 bg-background p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{meaning.turningPoint}</Badge>
                    <Badge variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">{event.targetType.replace(/_/g, ' ')}</Badge>
                  </div>
                  <h3 className="mt-3 font-headline text-xl font-bold italic leading-tight text-primary">{event.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm italic leading-6 text-muted-foreground">{meaning.significance}</p>
                  <div className="mt-4 rounded-xl bg-muted/20 p-3">
                    <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Trigger</div>
                    <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">{meaning.trigger}</p>
                  </div>
                </div>
              );
            }) : (
              <PageEmptyState icon={History} title="No turning points yet" description="Major revisions, abandonments, resolutions, and challenges will appear here once recorded." />
            )}
          </div>
        </section>
      )}

      {view === 'belief_rivers' && (
        <section className="mb-8 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="mb-5">
            <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Belief Rivers</div>
            <h2 className="mt-1 font-headline text-2xl font-bold italic text-primary">Follow positions through time</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {beliefRivers.length ? beliefRivers.map((river) => (
              <div key={river.id} className="rounded-2xl border border-border/50 bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-headline text-xl font-bold italic text-primary">{river.title}</h3>
                  <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{river.events.length} events</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <MiniEvolutionStat label="Origin" value={river.origin ? new Date(river.origin.date).toLocaleDateString() : 'None'} />
                  <MiniEvolutionStat label="Revisions" value={river.revisions.length} />
                  <MiniEvolutionStat label="Challenges" value={river.challenges.length} />
                  <MiniEvolutionStat label="Confidence" value={river.confidenceMoves.length} />
                </div>
                <div className="mt-4 space-y-2">
                  {river.events.slice(-4).map((event) => (
                    <div key={event.id} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
                      <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">{event.chips[0]}</div>
                      <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">{event.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <PageEmptyState icon={History} title="No belief rivers yet" description="Create, revise, challenge, or abandon positions to build a visible belief biography." />
            )}
          </div>
        </section>
      )}

      {view === 'periods' && (
        <section className="mb-8 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="mb-5">
            <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Periods</div>
            <h2 className="mt-1 font-headline text-2xl font-bold italic text-primary">Emerging intellectual chapters</h2>
            <p className="mt-2 text-sm italic text-muted-foreground">These are provisional groupings from recorded events. Noesis should propose periods, not finalize them for you.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {periods.map((period) => (
              <div key={period.label} className="rounded-2xl border border-border/50 bg-background p-4">
                <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{period.label}</div>
                <h3 className="mt-2 font-headline text-xl font-bold italic text-primary">{period.tone}</h3>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniEvolutionStat label="Revision" value={period.revisionCount} />
                  <MiniEvolutionStat label="Inquiry" value={period.uncertaintyCount} />
                  <MiniEvolutionStat label="Structure" value={period.structureCount} />
                </div>
                <div className="mt-4 space-y-2">
                  {period.items.slice(0, 3).map((event) => (
                    <p key={event.id} className="line-clamp-2 rounded-xl bg-muted/10 px-3 py-2 text-sm italic text-muted-foreground">{event.title}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'before_after' && (
      <div className="mb-8 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Time Scrubber</div>
            <h2 className="mt-1 font-headline text-2xl font-bold italic text-primary">Recorded thought at a selected date</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              This is a recorded-state reconstruction from thinking events, unknowns, patterns, and timeline entries. It reflects what Noesis has evidence for, not everything you may have thought.
            </p>
          </div>
          <input
            type="date"
            value={scrubberDate}
            onChange={(event) => setScrubberDate(event.target.value)}
            className="h-10 rounded-full border border-border/60 bg-background px-4 font-code text-[10px] uppercase tracking-widest text-foreground shadow-sm"
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ScrubberCard
            label="Active Positions Then"
            value={scrubberSummary.activePositionEvents.length}
            items={scrubberSummary.activePositionEvents.slice(0, 3).map((event) => event.title)}
            empty="No position events recorded by this date."
          />
          <ScrubberCard
            label="Concept Definitions Then"
            value={scrubberSummary.conceptEvents.length}
            items={scrubberSummary.conceptEvents.slice(0, 3).map((event) => event.title)}
            empty="No concept changes recorded by this date."
          />
          <ScrubberCard
            label="Unresolved Inquiries Then"
            value={scrubberSummary.inquiryEvents.length}
            items={scrubberSummary.inquiryEvents.slice(0, 3).map((event) => event.title)}
            empty="No inquiry events recorded by this date."
          />
          <ScrubberCard
            label="Atlas Structure Then"
            value={scrubberSummary.atlasEvents.length}
            items={scrubberSummary.atlasEvents.slice(0, 3).map((event) => event.title)}
            empty="No relationship, unknown, or pattern events yet."
          />
        </div>

        <div className="mt-4 rounded-xl border border-border/50 bg-muted/10 p-4">
          <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Current Differences Since Then</div>
          {scrubberSummary.currentDifferences.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {scrubberSummary.currentDifferences.map((event) => (
                <div key={event.id} className="rounded-xl border border-border/50 bg-background px-3 py-2">
                  <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">{event.targetType.replace(/_/g, ' ')}</div>
                  <p className="mt-1 text-sm font-medium text-foreground">{event.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm italic text-muted-foreground">No later recorded changes. Move the date earlier to compare against newer events.</p>
          )}
        </div>
      </div>
      )}

      {view === 'change_map' && (
        <section className="mb-8 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Change Map</div>
              <h2 className="mt-1 font-headline text-2xl font-bold italic text-primary">Where the system is moving</h2>
              <p className="mt-2 max-w-3xl text-sm italic leading-6 text-muted-foreground">
                This groups recorded events by area and movement. It shows evidence-backed direction, not a final diagnosis of your thinking.
              </p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full font-code text-[8px] uppercase tracking-widest">
              {changeMap.length} areas with recorded movement
            </Badge>
          </div>

          {changeMap.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {changeMap.map((area) => {
                const statusClass =
                  area.status === 'fractured' ? 'border-rose-200 bg-rose-50/80' :
                  area.status === 'weakened' ? 'border-amber-200 bg-amber-50/80' :
                  area.status === 'stabilized' ? 'border-emerald-200 bg-emerald-50/80' :
                  'border-blue-200 bg-blue-50/80';
                return (
                  <div key={area.area} className={cn('rounded-2xl border p-4', statusClass)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">System Area</div>
                        <h3 className="mt-1 font-headline text-xl font-bold italic text-primary">{area.area}</h3>
                      </div>
                      <Badge variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                        {area.status}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <MiniEvolutionStat label="Gained" value={area.movements.gained} />
                      <MiniEvolutionStat label="Weakened" value={area.movements.weakened} />
                      <MiniEvolutionStat label="Fractured" value={area.movements.fractured} />
                      <MiniEvolutionStat label="Stabilized" value={area.movements.stabilized} />
                    </div>
                    <div className="mt-4 rounded-xl border border-white/60 bg-white/50 p-3 dark:border-white/10 dark:bg-black/10">
                      <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Latest Evidence</div>
                      {area.latest ? (
                        <>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{area.latest.title}</p>
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            {new Date(area.latest.date).toLocaleDateString()} · {area.latest.kind === 'thinking' ? 'thinking event' : area.latest.kind}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm italic text-muted-foreground">No latest event recorded.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <PageEmptyState icon={History} title="No change map yet" description="Recorded thinking events will reveal which areas gained, weakened, fractured, or stabilized." />
          )}
        </section>
      )}

      {view === 'timeline' && (
      <>
      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search changes..."
        resultCount={filteredEvents.length}
        resultLabel="events"
        sortLabel="Newest meaningful changes first"
        activeFilterLabels={activeEvolutionFilterLabels}
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
          const evidence = eventEvidenceQuality(event);
          return (
            <div key={event.id} className="relative animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="absolute -left-[32px] top-1.5 size-2 rounded-full bg-accent ring-4 ring-background z-10" />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full border font-code text-[8px] uppercase tracking-widest", evidence.className)}>
                    {evidence.label}
                  </Badge>
                  {event.chips.map((chip) => (
                    <Badge key={chip} variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                      {chip}
                    </Badge>
                  ))}
                </div>

                <h3 className="font-headline font-bold text-2xl text-primary leading-tight">{event.title}</h3>
                <p className="font-body italic text-[16px] text-muted-foreground leading-relaxed max-w-3xl">{event.detail}</p>

                <div className="mt-4 grid gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm md:grid-cols-3">
                  <div className="md:col-span-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                    <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Evidence Quality</div>
                    <p className="mt-1 text-sm italic text-muted-foreground">{evidence.detail}</p>
                  </div>
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
                  {event.changedFields?.length ? (
                    <div className="md:col-span-3 border-t border-border/40 pt-3">
                      <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Changed Fields</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {event.changedFields.slice(0, 10).map((field) => (
                          <Badge key={field} variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                            {field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
      </>
      )}
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

function MiniEvolutionStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-3 text-center">
      <div className="font-headline text-lg font-bold italic leading-none text-primary">{value}</div>
      <div className="mt-1 font-code text-[7px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    </div>
  );
}

function ScrubberCard({ label, value, items, empty }: { label: string; value: number; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="font-headline text-2xl font-bold italic text-primary">{value}</div>
      </div>
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item} className="line-clamp-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-sm italic leading-5 text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm italic leading-6 text-muted-foreground">{empty}</p>
      )}
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
