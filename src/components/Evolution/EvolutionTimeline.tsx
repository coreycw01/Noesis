"use client";

import { BeliefRivers } from '@/components/Evolution/BeliefRivers';
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronDown,
  History,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Media, ThinkingEvent, ThinkingPattern, TimelineEvent, Unknown } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { FilterToolbar, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ContextualAiDocument, ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiProvenanceBadge } from '@/components/ai/AiProvenanceBadge';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { localDateKey } from '@/lib/calendar';
import { NOESIS_ICONS } from '@/lib/noesis-icons';
import { EVOLUTION_SYNTHESIS_SAMPLE_LIMIT, evolutionActionKey, evolutionDateMatches, evolutionDisplayDate, evolutionSynthesisExcerpt, evolutionSynthesisReviewKey, evolutionSynthesisSourceIds, evolutionValueChange, indexEvolutionSources, isEvolutionDateOnly, isEvolutionSynthesis, isEvolutionTurningPoint, normalizeEvolutionDate, olderEvolutionHistoryMayMatch, readEvolutionSynthesis, unmatchedEvolutionMilestones } from '@/lib/evolution-history';

interface EvolutionTimelineProps {
  aiSettings: import('@/lib/types').AiSettings;
  events: TimelineEvent[];
  media: Media[];
  thinkingEvents: ThinkingEvent[];
  thinkingEventsHasMore: boolean;
  loadMoreThinkingEvents: () => void;
  historyLoadingOlder: boolean;
  historyOlderError: boolean;
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  onSaveSynthesis: (event: TimelineEvent, result?: import('@/lib/contextual-ai').AiReviewResult, eventIds?: readonly string[]) => void | Promise<void>;
  positions?: import('@/lib/types').VaultEntry[];
  onOpenPosition?: (id: string) => void;
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
  isTurningPoint?: boolean;
  sourceIds?: string[];
  turningPoint?: string;
  trigger?: string;
  significance?: string;
  synthesisProvenance?: TimelineEvent['synthesisProvenance'];
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

const EVENT_FILTERS: EvolutionFilter[] = ['belief_revisions', 'confidence', 'unknowns', 'contradictions', 'patterns', 'questions', 'replacements', 'links'];
const OBJECT_FILTERS: EvolutionFilter[] = ['positions', 'concepts', 'inquiries', 'works', 'practices', 'sources'];

const VIEW_OPTIONS: Array<{ value: EvolutionView; label: string; description: string }> = [
  { value: 'turning_points', label: 'Turning Points', description: 'Major revisions, discoveries, abandonments, and resolutions.' },
  { value: 'timeline', label: 'Timeline', description: 'Chronological meaningful events, paged for review.' },
  { value: 'belief_rivers', label: 'Belief Rivers', description: 'Follow positions through origin, challenge, revision, and current state.' },
  { value: 'periods', label: 'Periods', description: 'Group events into emerging intellectual chapters.' },
  { value: 'before_after', label: 'Before / After', description: 'Use a date scrubber to compare recorded thought across time.' },
  { value: 'change_map', label: 'Change Map', description: 'See which areas gained, weakened, fractured, or stabilized.' },
];

const NOTABLE_THINKING_EVENT_TYPES = new Set<string>([
  'position_created',
  'position_formed',
  'position_revised',
  'position_replaced',
  'position_abandoned',
  'confidence_changed',
  'evidence_added',
  'challenge_added',
  'assumption_challenged',
  'contradiction_detected',
  'contradiction_resolved',
  'unknown_created',
  'unknown_resolved',
  'question_resolved',
  'question_promoted',
  'concept_defined',
  'concept_redefined',
  'source_distilled',
  'work_revised',
  'practice_concluded',
  'link_removed',
  'stress_test_answered',
  'suggestion_accepted',
  'thinking_pattern_acknowledged',
]);


/** Each change takes the color of the stage its record belongs to. */
function eventStageTone(targetType: string) {
  const type = targetType.toLowerCase();
  if (type.includes('position') || type.includes('belief')) return 'claim';
  if (type.includes('concept') || type.includes('inquiry') || type.includes('question') || type.includes('unknown')) return 'examine';
  if (type.includes('source') || type.includes('media') || type.includes('annotation')) return 'encounter';
  if (type.includes('practice') || type.includes('commitment') || type.includes('goal')) return 'act';
  if (type.includes('work') || type.includes('draft')) return 'more';
  return 'integrate';
}
function isRoutineDeletion(summary?: string, metadata?: Record<string, unknown>) {
  const text = String(summary || '').trim().toLowerCase();
  return text.startsWith('deleted ')
    || text.includes('hard delete')
    || metadata?.operation === 'delete';
}

function isNotableThinkingEvent(event: ThinkingEvent) {
  const eventType = evolutionActionKey(String(event.eventType || event.actionType || ''));
  if (!eventType || isRoutineDeletion(event.summary, event.metadata)) return false;
  return event.importance === 'major'
    || event.importance === 'high'
    || isEvolutionTurningPoint(eventType, event.confidenceBefore, event.confidenceAfter)
    || NOTABLE_THINKING_EVENT_TYPES.has(eventType);
}

function isNotableTimelineEvent(event: TimelineEvent) {
  const text = `${event.eventType || ''} ${event.reason || ''} ${event.entityTitle || ''}`.toLowerCase();
  if (text.includes('deleted') || text.includes('removed')) return false;
  return [
    'revised',
    'resolved',
    'abandoned',
    'replaced',
    'challenged',
    'confidence',
    'contradiction',
    'position formed',
    'source distilled',
    'practice concluded',
  ].some((signal) => text.includes(signal));
}

function mapThinkingEventToFilter(action: string, object: string): EvolutionFilter {
  const eventType = evolutionActionKey(action);
  const position = object === 'position' || object === 'vault';
  if (position && ['revised', 'abandoned', 'position_revised', 'position_abandoned'].includes(eventType)) return 'belief_revisions';
  if (eventType === 'confidence_changed') return 'confidence';
  if (['unknown_created', 'unknown_resolved'].includes(eventType)) return 'unknowns';
  if (['contradiction_detected', 'contradiction_resolved'].includes(eventType)) return 'contradictions';
  if (['thinking_pattern_inferred', 'thinking_pattern_acknowledged', 'thinking_pattern_dismissed'].includes(eventType)) return 'patterns';
  if (['question_created', 'question_promoted', 'question_resolved', 'position_formed'].includes(eventType)) return 'questions';
  if (['replaced', 'position_replaced'].includes(eventType)) return 'replacements';
  if (['link_created', 'link_removed', 'linked', 'unlinked'].includes(eventType)) return 'links';
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
  const eventType = String(event.eventType || event.actionType || 'change');
  const eventText = eventType.replace(/_/g, ' ');
  const turningPoint = event.importance === 'major' && isEvolutionTurningPoint(eventType, event.confidenceBefore, event.confidenceAfter)
    ? 'Major Turning Point'
    : eventType.includes('revised') || eventType === 'confidence_changed'
      ? 'Revision'
      : eventType.includes('resolved')
        ? 'Resolution'
        : eventType.includes('abandoned') || eventType.includes('replaced')
          ? 'Abandonment / Replacement'
          : eventType.includes('challenge') || eventType.includes('contradiction')
            ? 'Challenge'
            : eventType.includes('created')
              ? 'Origin'
              : 'Meaningful Change';
  const trigger = event.userReason || event.aiReason || event.systemReason || event.metadata?.reason || `${event.sourceType} recorded ${eventText}`;
  const significance = event.diff
    ? `Changed fields: ${Object.keys(event.diff).slice(0, 4).join(', ')}`
    : event.confidenceBefore != null || event.confidenceAfter != null
      ? `Confidence moved from ${event.confidenceBefore ?? 'unknown'} to ${event.confidenceAfter ?? 'unknown'}.`
      : event.epistemicStatus
        ? `Epistemic status: ${event.epistemicStatus.replace(/_/g, ' ')}.`
        : undefined;

  return {
    turningPoint,
    trigger: String(trigger),
    significance,
    ...(evolutionValueChange(event) ?? { beforeLabel: summarizeSnapshot(event.before), afterLabel: summarizeSnapshot(event.after) }),
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
      : undefined);

  return { turningPoint, trigger, significance };
}

function eventTime(value: string) {
  const time = evolutionDisplayDate(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function eventMonthKey(value: string) {
  const date = evolutionDisplayDate(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function eventMonthLabel(value: string) {
  const date = evolutionDisplayDate(value);
  return Number.isNaN(date.getTime()) ? 'Undated' : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function groupEventsByMonth(events: DisplayEvent[]) {
  const groups: Array<{ key: string; label: string; events: DisplayEvent[] }> = [];
  events.forEach((event) => {
    const key = eventMonthKey(event.date);
    const latest = groups[groups.length - 1];
    if (latest?.key === key) latest.events.push(event);
    else groups.push({ key, label: eventMonthLabel(event.date), events: [event] });
  });
  return groups;
}

function EventTypeIcon({ targetType, className }: { targetType: string; className?: string }) {
  const normalized = targetType.toLowerCase();
  const Icon = normalized === 'vault' || normalized === 'position' ? NOESIS_ICONS.position
    : normalized === 'concept' ? NOESIS_ICONS.concept
    : ['question', 'inquiry', 'unknown'].includes(normalized) ? NOESIS_ICONS.inquiry
    : normalized === 'practice' ? NOESIS_ICONS.practice
    : ['work', 'draft'].includes(normalized) ? NOESIS_ICONS.work
    : ['source', 'media'].includes(normalized) ? NOESIS_ICONS.source
    : normalized === 'annotation' ? NOESIS_ICONS.annotation
    : History;
  return <Icon className={className} aria-hidden="true" />;
}

function eventEvidenceQuality(event: DisplayEvent) {
  if (event.kind === 'timeline' && event.targetType === 'evolution') {
    return {
      label: 'Reviewed synthesis',
      detail: 'This interpretation was generated from a bounded period of recorded events and saved after user review.',
      className: 'noesis-status-badge',
    };
  }

  const hasBeforeAfter = Boolean(event.beforeLabel || event.afterLabel || event.changedFields?.length);

  if (event.kind === 'thinking' && hasBeforeAfter) {
    return {
      label: 'Event-backed change',
      detail: 'This change has a thinking event plus before/after or changed-field evidence.',
      className: 'noesis-status-badge',
    };
  }

  if (event.kind === 'thinking') {
    return {
      label: 'Event-backed',
      detail: 'This came from the thinkingEvents layer and is stronger evidence than legacy activity.',
      className: 'noesis-status-badge',
    };
  }

  if (event.kind === 'unknown' || event.kind === 'pattern') {
    return {
      label: 'Provisional interpretation',
      detail: 'This is useful for reflection, but should remain reviewable and revisable.',
      className: 'border-accent-border bg-accent-muted text-foreground',
    };
  }

  return {
    label: 'Legacy context',
    detail: 'This is older timeline context. Prefer thinkingEvents for reliable before/after history.',
    className: 'noesis-status-badge',
  };
}

function targetTypeMatches(event: DisplayEvent, types: string[]) {
  const target = String(event.targetType || '').toLowerCase();
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

export function EvolutionTimeline({ aiSettings, events, media, thinkingEvents, thinkingEventsHasMore, loadMoreThinkingEvents, historyLoadingOlder, historyOlderError, unknowns, thinkingPatterns, onSaveSynthesis, positions = [], onOpenPosition }: EvolutionTimelineProps) {
  const [view, setView] = useState<EvolutionView>('belief_rivers');
  const [explainedRiver, setExplainedRiver] = useState<string | null>(null);
  const [timelineLayout, setTimelineLayout] = useEntityViewPreference('evolution');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EvolutionFilter>('all');
  const [visibleCount, setVisibleCount] = useState(12);
  const [scrubberDate, setScrubberDate] = useState(() => localDateKey());
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const periodErrorId = React.useId();
  const sourcesForEvent = useMemo(() => indexEvolutionSources(media), [media]);

  const displayEvents = useMemo<DisplayEvent[]>(() => {
    const notableThinking = thinkingEvents.filter((event) => !readEvolutionSynthesis(event) && isNotableThinkingEvent(event));
    const fromThinking = notableThinking.map((event) => ({
      id: event.eventId || event.id,
      kind: 'thinking' as const,
      targetId: event.targetId || event.entityId,
      targetType: String(event.entityType || event.targetType || 'evolution'),
      title: event.summary || 'Recorded intellectual milestone',
      detail: event.userReason || event.aiReason || event.systemReason || '',
      date: normalizeEvolutionDate(event.createdAt ?? event.updatedAt) || '',
      filter: mapThinkingEventToFilter(event.eventType || event.actionType || '', String(event.entityType || event.targetType || '')),
      chips: [String(event.actionType || event.eventType || 'revised').replace(/_/g, ' '), event.sourceType || event.origin || 'system', String(event.targetType || event.entityType || 'evolution')],
      isTurningPoint: isEvolutionTurningPoint(String(event.eventType || event.actionType || ''), event.confidenceBefore, event.confidenceAfter),
      sourceIds: event.relatedEntityIds?.sourceIds,
      changedFields: event.changedFields,
      ...thinkingEventMeaning(event),
    })).filter((event) => Boolean(event.date));

    const savedSyntheses = thinkingEvents.map(readEvolutionSynthesis).filter((event): event is TimelineEvent => event !== null);
    const synthesizedIds = new Set(savedSyntheses.map((event) => event.id));
    const milestones = unmatchedEvolutionMilestones(events, notableThinking);
    const fromTimeline = [...savedSyntheses, ...milestones.filter((event) => !synthesizedIds.has(event.id)
      && (isEvolutionSynthesis(event) || isNotableTimelineEvent(event)))].map((event) => ({
      id: event.id,
      kind: 'timeline' as const,
      targetId: event.entityId,
      targetType: event.entityType || 'evolution',
      title: event.entityTitle || 'Recorded milestone',
      detail: event.reason || (event.synthesisProvenance ? '' : 'Legacy intellectual milestone.'),
      date: normalizeEvolutionDate(event.date) || '',
      filter: mapThinkingEventToFilter(event.eventType, event.entityType),
      chips: [event.eventType, isEvolutionSynthesis(event) ? 'ai-assisted' : event.entityType],
      synthesisProvenance: event.synthesisProvenance,
      isTurningPoint: !isEvolutionSynthesis(event) && isEvolutionTurningPoint(event.eventType),
      sourceIds: event.influencedBy,
      trigger: isEvolutionSynthesis(event) ? 'Created after the user reviewed and accepted a contextual synthesis.' : event.reason,
      significance: isEvolutionSynthesis(event) ? 'This is an AI-assisted interpretation of recorded changes, reviewed and saved by the user.' : undefined,
    })).filter((event) => Boolean(event.date));

    const resolvedUnknowns = new Set(notableThinking.filter((event) => event.eventType === 'unknown_resolved').map((event) => event.entityId));
    const acknowledgedPatterns = new Set(notableThinking.filter((event) => event.eventType === 'thinking_pattern_acknowledged').map((event) => event.entityId));
    const fromUnknowns = unknowns.filter((item) => item.status === 'resolved' && !resolvedUnknowns.has(item.unknownId)).map((item) => ({
      id: item.unknownId,
      kind: 'unknown' as const,
      targetId: item.unknownId,
      targetType: 'unknown',
      title: item.title,
      detail: item.resolutionSummary || item.description || 'Unknown recorded in the system.',
      date: normalizeEvolutionDate(item.resolvedAt || item.dateUpdated || item.dateCreated) || '',
      filter: 'unknowns' as const,
      chips: [item.status, item.importance, item.createdFrom],
      sourceIds: item.sourceIds,
    })).filter((event) => Boolean(event.date));

    const fromPatterns = thinkingPatterns.filter((pattern) => pattern.status === 'acknowledged' && !acknowledgedPatterns.has(pattern.patternId)).map((pattern) => ({
      id: pattern.patternId,
      kind: 'pattern' as const,
      targetId: pattern.patternId,
      targetType: 'thinking_pattern',
      title: pattern.label,
      detail: pattern.description,
      date: normalizeEvolutionDate(pattern.dateUpdated || pattern.dateCreated) || '',
      filter: 'patterns' as const,
      chips: [String(pattern.patternType || 'pattern').replace(/_/g, ' '), pattern.status, pattern.trendDirection],
    })).filter((event) => Boolean(event.date));

    return [...fromThinking, ...fromTimeline, ...fromUnknowns, ...fromPatterns].sort(
      (a, b) => eventTime(b.date) - eventTime(a.date)
    );
  }, [events, thinkingEvents, thinkingPatterns, unknowns]);

  const hasDateFilter = Boolean(periodStart || periodEnd);
  const dateRangeIsValid = !(periodStart && periodEnd && periodStart > periodEnd);
  const completePeriod = Boolean(periodStart && periodEnd && dateRangeIsValid);
  const searchTerm = search.trim();

  const filteredEvents = useMemo(() => {
    if (view !== 'timeline' || !dateRangeIsValid) return [];
    const query = searchTerm.toLowerCase();
    return displayEvents.filter((event) => {
      const filterOk = filter === 'all' ||
        event.filter === filter ||
        (filter === 'positions' && targetTypeMatches(event, ['position', 'vault'])) ||
        (filter === 'concepts' && targetTypeMatches(event, ['concept'])) ||
        (filter === 'inquiries' && targetTypeMatches(event, ['question', 'inquiry'])) ||
        (filter === 'works' && targetTypeMatches(event, ['work', 'draft'])) ||
        (filter === 'practices' && targetTypeMatches(event, ['practice'])) ||
        (filter === 'sources' && targetTypeMatches(event, ['source', 'media']));
      return filterOk && (!query || `${event.title} ${event.detail} ${event.chips.join(' ')}`.toLowerCase().includes(query))
        && evolutionDateMatches(event.date, periodStart, periodEnd);
    });
  }, [dateRangeIsValid, displayEvents, filter, periodEnd, periodStart, searchTerm, view]);

  const turningPoints = useMemo(() => {
    return view === 'turning_points' ? displayEvents.filter((event) => event.isTurningPoint).slice(0, 8) : [];
  }, [displayEvents, view]);

  const beliefRivers = useMemo(() => {
    if (view !== 'belief_rivers') return [];
    const grouped = new Map<string, DisplayEvent[]>();
    displayEvents
      .filter((event) => targetTypeMatches(event, ['position', 'vault']))
      .forEach((event) => {
        const key = event.targetId || event.title;
        const group = grouped.get(key);
        if (group) group.push(event);
        else grouped.set(key, [event]);
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
  }, [displayEvents, view]);

  const periods = useMemo(() => {
    if (view !== 'periods') return [];
    const grouped = new Map<string, DisplayEvent[]>();
    displayEvents.forEach((event) => {
      const key = eventMonthLabel(event.date);
      const group = grouped.get(key);
      if (group) group.push(event);
      else grouped.set(key, [event]);
    });
    return Array.from(grouped.entries()).slice(0, 8).map(([label, items]) => {
      const revisionCount = items.filter((event) => event.filter === 'belief_revisions' || event.filter === 'confidence').length;
      const uncertaintyCount = items.filter((event) => event.filter === 'unknowns' || event.filter === 'questions').length;
      const structureCount = items.filter((event) => event.filter === 'links' || event.filter === 'contradictions' || event.filter === 'patterns').length;
      const tone = revisionCount >= uncertaintyCount && revisionCount >= structureCount
        ? 'Worldview reconstruction'
        : uncertaintyCount >= structureCount
          ? 'Uncertainty and inquiry'
          : 'Structural integration';
      return { label, items, revisionCount, uncertaintyCount, structureCount, tone };
    });
  }, [displayEvents, view]);

  const changeMap = useMemo(() => {
    if (view !== 'change_map') return [];
    const grouped = new Map<string, DisplayEvent[]>();
    displayEvents.forEach((event) => {
      const area = changeAreaForEvent(event);
      const group = grouped.get(area);
      if (group) group.push(event);
      else grouped.set(area, [event]);
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
        const latest = items[0];
        const dominant = (Object.entries(movements).sort((a, b) => b[1] - a[1])[0]?.[0] || 'gained') as keyof typeof movements;
        const status =
          dominant === 'fractured' ? 'fractured' :
          dominant === 'weakened' ? 'weakened' :
          dominant === 'stabilized' ? 'stabilized' :
          'gained';
        return { area, items, movements, latest, status };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [displayEvents, view]);

  const scrubberSummary = useMemo(() => {
    const throughDate: DisplayEvent[] = [];
    const afterDate: DisplayEvent[] = [];
    if (view === 'before_after' && scrubberDate) {
      for (const event of displayEvents) {
        if (evolutionDateMatches(event.date, '', scrubberDate)) throughDate.push(event);
        else if (afterDate.length < 4) afterDate.push(event);
      }
    }
    const positionEvents = throughDate.filter((event) => targetTypeMatches(event, ['position', 'vault']));
    const conceptEvents = throughDate.filter((event) => targetTypeMatches(event, ['concept']));
    const inquiryEvents = throughDate.filter((event) => targetTypeMatches(event, ['question', 'inquiry']));
    const atlasEvents = throughDate.filter((event) =>
      targetTypeMatches(event, ['link', 'relationship', 'pattern', 'unknown']) ||
      ['links', 'contradictions', 'patterns', 'unknowns'].includes(event.filter)
    );
    return {
      positionEvents,
      conceptEvents,
      inquiryEvents,
      atlasEvents,
      currentDifferences: afterDate,
    };
  }, [displayEvents, scrubberDate, view]);

  useEffect(() => {
    setVisibleCount(12);
  }, [filter, periodEnd, periodStart, searchTerm]);

  const pagedEvents = filteredEvents.slice(0, visibleCount);
  const rangeEnd = Math.min(filteredEvents.length, visibleCount);
  const clearEvolutionFilters = () => {
    setSearch('');
    setFilter('all');
    setPeriodStart('');
    setPeriodEnd('');
  };
  const evolutionFiltersActive = Boolean(searchTerm || filter !== 'all' || hasDateFilter);
  const activeEvolutionFilterLabels = [
    searchTerm ? `Search: ${searchTerm}` : null,
    filter !== 'all' ? `Change type: ${FILTER_OPTIONS.find((option) => option.value === filter)?.label || filter.replace(/_/g, ' ')}` : null,
    periodStart ? `From: ${periodStart}` : null,
    periodEnd ? `To: ${periodEnd}` : null,
  ].filter(Boolean) as string[];
  const selectedPeriodEvents = useMemo(() => {
    if (view !== 'timeline' || !completePeriod || !aiSettings.aiAssistanceEnabled) return [];
    return displayEvents.filter((event) => event.targetType !== 'evolution' && evolutionDateMatches(event.date, periodStart, periodEnd));
  }, [view, completePeriod, aiSettings.aiAssistanceEnabled, displayEvents, periodStart, periodEnd]);
  const periodSample = selectedPeriodEvents.slice(0, EVOLUTION_SYNTHESIS_SAMPLE_LIMIT);
  const periodHasOlderMatches = useMemo(
    () => olderEvolutionHistoryMayMatch(thinkingEventsHasMore, periodStart, thinkingEvents),
    [thinkingEventsHasMore, periodStart, thinkingEvents],
  );
  const olderHistoryControl = thinkingEventsHasMore && (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button type="button" variant="outline" size="sm" disabled={historyLoadingOlder} onClick={loadMoreThinkingEvents}>
        {historyLoadingOlder ? 'Loading older history' : historyOlderError ? 'Retry older history' : 'Load older history'}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {historyLoadingOlder ? 'Showing previously loaded changes.' : historyOlderError ? 'Older history could not be loaded. Previously loaded changes are still visible.' : 'Older changes may not be included in this view.'}
      </span>
    </div>
  );

  return (
    <div className="noesis-page noesis-evolution-page" data-noesis-identity="chronology">
      <PageHeader
        title="Evolution"
        description="Trace meaningful changes in positions, concepts, inquiries, practices, unknowns, and thinking patterns over time."
        tabs={(
          <WorkspaceTabs
            value={view}
            onChange={setView}
            label="Evolution views"
            items={VIEW_OPTIONS.map((option) => ({ id: option.value, label: option.label }))}
          />
        )}
      />

      {view !== 'timeline' && olderHistoryControl}

      {view === 'turning_points' && (
        <section className="mb-8 border-y border-border/60 py-6">
          <div className="mb-5">
            <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Turning Points</div>
            <h2 className="mt-1 font-headline text-2xl font-bold italic text-primary">The moments that changed the system</h2>
          </div>
          {turningPoints.length > 0 && <TurningSpine events={turningPoints.map((event) => ({ id: event.id, title: event.title, date: event.date, tone: eventStageTone(event.targetType) }))} />}
          <div className="grid gap-4 md:grid-cols-2">
            {turningPoints.length ? turningPoints.map((event) => {
              const meaning = displayEventMeaning(event);
              return (
                <article key={event.id} className="border-l-2 border-accent/50 py-1 pl-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{meaning.turningPoint}</Badge>
                    <Badge variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">{event.targetType.replace(/_/g, ' ')}</Badge>
                  </div>
                  <h3 className="mt-3 font-headline text-xl font-bold italic leading-tight text-primary">{event.title}</h3>
                  {meaning.significance && <p className="mt-2 line-clamp-3 text-sm italic leading-6 text-muted-foreground">{meaning.significance}</p>}
                  <div className="mt-4 border-t border-border/50 pt-3">
                    <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Trigger</div>
                    <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">{meaning.trigger}</p>
                  </div>
                </article>
              );
            }) : (
              <PageEmptyState icon={History} title="No turning points yet" description="Major revisions, abandonments, resolutions, and challenges will appear here once recorded." />
            )}
          </div>
        </section>
      )}

      {view === 'belief_rivers' && (
        <section className="mb-8 border-y border-border/60 py-6">
          <div className="mb-4 rounded-[14px] border border-border bg-card p-5">
            <BeliefRivers positions={positions} thinkingEvents={thinkingEvents} onOpen={(id) => onOpenPosition?.(id)} onExplain={setExplainedRiver} />
          </div>
          <p className="text-sm text-muted-foreground">Tap a river to open its position or see what moved it.</p>
          {explainedRiver && (() => {
            const position = positions.find((item) => item.id === explainedRiver);
            const river = beliefRivers.find((item) => item.id === explainedRiver);
            const events = river?.events || [];
            return (
              <div className="noesis-river-sheet" data-stage-tone="claim" role="region" aria-label={`What moved ${position?.title || 'this river'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-code text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--stage))]">What moved this river</div>
                    <h3 className="mt-1 font-headline text-xl font-semibold italic">{position?.title || river?.title || 'Position'}</h3>
                  </div>
                  <div className="flex gap-2">
                    {position && <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onOpenPosition?.(position.id)}>Open the position</Button>}
                    <Button type="button" size="sm" variant="ghost" aria-label="Close" onClick={() => setExplainedRiver(null)}>×</Button>
                  </div>
                </div>
                {river && (() => {
                  const parts: Array<[string, string, number]> = [['Confidence changes', 'act', river.confidenceMoves.length], ['Challenges', 'claim', river.challenges.length], ['Revisions', 'integrate', river.revisions.length], ['Other events', 'more', Math.max(0, events.length - river.confidenceMoves.length - river.challenges.length - river.revisions.length)]];
                  return (
                    <div className="mt-3 grid gap-2">
                      <div className="noesis-flowbar__bar" role="img" aria-label={parts.map(([label, , count]) => `${label} ${count}`).join(', ')}>
                        {parts.filter((part) => part[2]).map(([label, tone, count]) => <span key={label} data-stage-tone={tone} style={{ flexGrow: count }} />)}
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">{parts.map(([label, tone, count]) => <span key={label} data-stage-tone={tone} className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: 'hsl(var(--stage))' }} />{label} {count}</span>)}</div>
                    </div>
                  );
                })()}
                {events.length ? (
                  <ol className="mt-3 grid max-h-[40vh] gap-2 overflow-y-auto">
                    {[...events].reverse().map((event) => (
                      <li key={event.id} className="border-l-2 border-[hsl(var(--stage)/.5)] py-1 pl-3">
                        <div className="font-code text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{evolutionDisplayDate(event.date).toLocaleDateString()} · {event.chips[0]}</div>
                        <p className="mt-0.5 text-sm">{event.title}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-sm text-muted-foreground">No recorded events moved this river yet. Challenge, revise or test the position and they will appear here.</p>}
              </div>
            );
          })()}
        </section>
      )}

      {view === 'periods' && (
        <section className="mb-8 border-y border-border/60 py-6">
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
                {(() => {
                  const parts: Array<[string, string, number]> = [['Revision', 'claim', period.revisionCount], ['Inquiry', 'examine', period.uncertaintyCount], ['Structure', 'act', period.structureCount]];
                  return (
                    <div className="mt-4 grid gap-2">
                      <div className="noesis-flowbar__bar" role="img" aria-label={parts.map(([label, , count]) => `${label} ${count}`).join(', ')}>
                        {parts.some((part) => part[2]) ? parts.filter((part) => part[2]).map(([label, tone, count]) => <span key={label} data-stage-tone={tone} style={{ flexGrow: count }} />) : <span style={{ flexGrow: 1, background: 'hsl(var(--muted))' }} />}
                      </div>
                      <div className="flex flex-wrap gap-x-3 font-code text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{parts.map(([label, tone, count]) => <span key={label} data-stage-tone={tone} className="inline-flex items-center gap-1"><i className="size-2 rounded-sm" style={{ background: 'hsl(var(--stage))' }} />{label} {count}</span>)}</div>
                    </div>
                  );
                })()}
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
              Counts show recorded changes through the selected date, not how many items were active at the time.
            </p>
          </div>
          <input
            type="date"
            aria-label="Compare history through date"
            value={scrubberDate}
            onChange={(event) => setScrubberDate(event.target.value)}
            className="h-10 rounded-full border border-border/60 bg-background px-4 font-code text-[10px] uppercase tracking-widest text-foreground shadow-sm"
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ScrubberCard
            label="Position Changes"
            value={scrubberSummary.positionEvents.length}
            items={scrubberSummary.positionEvents.slice(0, 3).map((event) => event.title)}
            empty="No position events recorded by this date."
          />
          <ScrubberCard
            label="Concept Changes"
            value={scrubberSummary.conceptEvents.length}
            items={scrubberSummary.conceptEvents.slice(0, 3).map((event) => event.title)}
            empty="No concept changes recorded by this date."
          />
          <ScrubberCard
            label="Inquiry Changes"
            value={scrubberSummary.inquiryEvents.length}
            items={scrubberSummary.inquiryEvents.slice(0, 3).map((event) => event.title)}
            empty="No inquiry events recorded by this date."
          />
          <ScrubberCard
            label="Atlas Changes"
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
                const statusClass = 'border-border bg-card';
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
                    <MovementBar movements={area.movements} />
                    <div className="mt-4 rounded-xl border border-white/60 bg-card/50 p-3 dark:border-white/10 dark:bg-black/10">
                      <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Latest Evidence</div>
                      {area.latest ? (
                        <>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{area.latest.title}</p>
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            {evolutionDisplayDate(area.latest.date).toLocaleDateString()} · {area.latest.kind === 'thinking' ? 'thinking event' : area.latest.kind}
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
        sortLabel="Newest meaningful changes first"
        activeFilterLabels={activeEvolutionFilterLabels}
        onClear={clearEvolutionFilters}
        clearDisabled={!evolutionFiltersActive}
        viewControl={
          <ViewModeToggle
            value={timelineLayout === 'table' ? 'table' : 'grid'}
            modes={['grid', 'table']}
            onChange={(nextView) => setTimelineLayout(nextView === 'table' ? 'table' : 'cards')}
          />
        }
        className="mb-5"
      >
        <label className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
          Change filter
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as EvolutionFilter)}
            className="min-h-11 max-w-full rounded-[var(--button-radius)] border border-border bg-surface px-3 font-interface text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 sm:text-sm"
          >
            <option value="all">All changes</option>
            <optgroup label="Event type">
              {FILTER_OPTIONS.filter((option) => EVENT_FILTERS.includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </optgroup>
            <optgroup label="Object type">
              {FILTER_OPTIONS.filter((option) => OBJECT_FILTERS.includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </optgroup>
          </select>
        </label>
      </FilterToolbar>

      <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Meaningful Change Feed</div>
          <p role="status" className="mt-1 font-headline text-xl font-semibold text-foreground sm:text-2xl">
            {!dateRangeIsValid ? 'Choose a valid date range' : filteredEvents.length
              ? `Showing ${rangeEnd} of ${filteredEvents.length} ${periodHasOlderMatches ? 'loaded ' : ''}${filteredEvents.length === 1 ? 'change' : 'changes'}`
              : periodHasOlderMatches ? 'No matches in loaded history' : 'No matching changes'}
          </p>
        </div>
        <div className="flex w-fit max-w-full flex-wrap items-center gap-2">
          <CalendarRange className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
          <label className="flex min-h-11 max-w-full items-center gap-1.5 rounded-[var(--button-radius)] border border-border bg-surface px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring sm:min-h-8">
            <span className="text-xs font-medium">From</span>
            <input
              aria-label="Evolution period start"
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              aria-invalid={!dateRangeIsValid}
              aria-describedby={!dateRangeIsValid ? periodErrorId : undefined}
              className="min-h-10 w-[8rem] min-w-0 border-0 bg-transparent p-0 text-base text-foreground outline-none sm:min-h-7 sm:w-[7.6rem] sm:text-sm"
            />
          </label>
          <label className="flex min-h-11 max-w-full items-center gap-1.5 rounded-[var(--button-radius)] border border-border bg-surface px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring sm:min-h-8">
            <span className="text-xs font-medium">To</span>
            <input
              aria-label="Evolution period end"
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              aria-invalid={!dateRangeIsValid}
              aria-describedby={!dateRangeIsValid ? periodErrorId : undefined}
              className="min-h-10 w-[8rem] min-w-0 border-0 bg-transparent p-0 text-base text-foreground outline-none sm:min-h-7 sm:w-[7.6rem] sm:text-sm"
            />
          </label>
          {!dateRangeIsValid && <p id={periodErrorId} className="basis-full text-xs text-destructive" role="alert">The end date must be on or after the start date.</p>}
          {aiSettings.aiAssistanceEnabled && completePeriod && (
            <p className="basis-full px-1 text-xs text-muted-foreground" role="status">
              {selectedPeriodEvents.length === 0
                ? 'No loaded changes in this date range are available for synthesis.'
                : `Synthesis uses ${periodSample.length} of ${selectedPeriodEvents.length} loaded changes in this date range. It excludes previous syntheses.`}
              {(searchTerm || filter !== 'all') && ' Timeline search and change filters do not affect synthesis.'}
              {periodHasOlderMatches && ' Older history may not be loaded.'}
            </p>
          )}
          {aiSettings.aiAssistanceEnabled && completePeriod && (
            <ContextualAiPanel
              enabled={selectedPeriodEvents.length > 0}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiSettings.defaultReasoningDepth}
              actions={['synthesize_evolution_period']}
              reviewContextKey={evolutionSynthesisReviewKey(periodSample)}
              buttonLabel="Synthesize Period"
              promptLabel="What should Noesis examine in this period?"
              promptPlaceholder="For example: Did my confidence change faster than my evidence, or did I resolve a recurring tension?"
              buildEnvelope={(_, userPrompt) => ({
                action: 'synthesize_evolution_period',
                scope: 'selected_period',
                targetType: 'evolution',
                targetId: `${periodStart}:${periodEnd}`,
                selectedRange: { from: periodStart, to: periodEnd },
                userPrompt,
                itemMemory: [
                  `Selected period: ${periodStart} through ${periodEnd}`,
                  `Provided sample: ${periodSample.length} of ${selectedPeriodEvents.length} loaded matching changes. ${periodHasOlderMatches ? 'Older history may not be loaded; do not treat the sample as exhaustive.' : 'Use only the supplied events as evidence.'}`,
                  `Change areas in sample: ${Array.from(new Set(periodSample.map(changeAreaForEvent))).join(', ') || 'none'}`,
                  `Event types in sample: ${Array.from(new Set(periodSample.flatMap((event) => event.chips.slice(0, 1)))).join(', ') || 'none'}`,
                ],
                linkedMemory: periodSample.map((event) => evolutionSynthesisExcerpt({
                  ...event,
                  action: event.chips[0],
                  actor: event.kind === 'thinking' ? event.chips[1] : undefined,
                })),
              })}
              onAccept={async (result, content) => {
                if (!result.reviewId) throw new Error('This review could not be identified. Run assistance again.');
                const id = `period-review-${result.reviewId}`;
                await onSaveSynthesis({
                  id,
                  entityId: `${periodStart}:${periodEnd}`,
                  entityType: 'evolution',
                  entityTitle: `Period synthesis · ${periodStart} to ${periodEnd}`,
                  eventType: 'refined',
                  reason: content,
                  influencedBy: evolutionSynthesisSourceIds(periodSample),
                  date: new Date().toISOString(),
                }, result, periodSample.map(({ id }) => id));
              }}
            />
          )}
        </div>
      </div>

      {dateRangeIsValid && periodHasOlderMatches && olderHistoryControl}

      {timelineLayout === 'table' && pagedEvents.length > 0 && (
        <div className="mb-6 min-w-0 rounded-lg border border-border/60 bg-card">
          <Table className="table-fixed xl:table-auto">
            <caption className="sr-only">Evolution changes</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[5.5rem] sm:w-[9rem]">Date</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="hidden w-[9rem] lg:table-cell">Object</TableHead>
                <TableHead className="hidden w-[10rem] xl:table-cell">Before / after</TableHead>
                <TableHead className="hidden w-[15rem] xl:table-cell">Why it matters</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedEvents.map((event) => {
                const meaning = displayEventMeaning(event);
                const eventDate = evolutionDisplayDate(event.date);
                return (
                  <TableRow key={event.id}>
                    <TableCell className="align-top font-code text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      <time dateTime={event.date}>{eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="noesis-event-kind flex items-center gap-2" data-stage-tone={eventStageTone(event.targetType)}>
                        <EventTypeIcon targetType={event.targetType} className="size-4 shrink-0 stroke-[2.4]" />
                        <span className="font-code text-[9px] font-bold uppercase tracking-[0.14em]">
                          {event.chips[0] || event.targetType.replace(/_/g, ' ')}
                        </span>
                        {event.chips[1] === 'ai-assisted' && <span className="text-xs text-muted-foreground">AI-assisted</span>}
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer rounded-sm font-headline text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{event.title}</summary>
                        <p className="mt-2 text-xs capitalize text-muted-foreground lg:hidden">{event.targetType.replace(/_/g, ' ')}{event.kind === 'thinking' && event.chips[1] ? ` / ${event.chips[1]}` : ''}</p>
                        {meaning.significance && <p className="mt-2 text-sm text-muted-foreground xl:hidden">{meaning.significance}</p>}
                        <EvolutionEventDetails event={event} influencedSources={sourcesForEvent(event.sourceIds)} className="mt-3" />
                      </details>
                    </TableCell>
                    <TableCell className="hidden align-top text-sm text-muted-foreground lg:table-cell">
                      <span className="capitalize">{event.targetType.replace(/_/g, ' ')}</span>
                      {event.kind === 'thinking' && event.chips[1] && <span className="mt-1 block text-xs">{event.chips[1]}</span>}
                    </TableCell>
                    <TableCell className="hidden align-top text-sm leading-5 text-foreground/75 xl:table-cell">
                      {event.beforeLabel || event.afterLabel ? (
                        <>
                          <div className="line-clamp-2">{event.beforeLabel || 'Previous state not recorded'}</div>
                          <div className="mt-1 line-clamp-2 text-accent">{event.afterLabel || 'Current state not recorded'}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No state comparison</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden align-top text-sm leading-5 text-foreground/75 xl:table-cell">
                      <p className="line-clamp-3">{meaning.significance || 'No significance note recorded.'}</p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="space-y-1">
        {timelineLayout !== 'table' && groupEventsByMonth(pagedEvents).map((group) => (
          <section key={group.key} className="relative ml-2 border-l border-border/70 pl-6 sm:pl-8">
            <div className="relative border-b border-border/60 py-3">
              <span className="absolute -left-[1.9rem] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground/50 sm:-left-[2.15rem]" aria-hidden="true" />
              <h2 className="font-code text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{group.label}</h2>
            </div>
            <div>
              {group.events.map((event) => {
                const meaning = displayEventMeaning(event);
                const movement = changeMovementForEvent(event);
                const eventDate = evolutionDisplayDate(event.date);
                return (
                  <details key={event.id} className="group relative border-b border-border/55 open:bg-card/35">
                    <span
                      className={cn(
                        'absolute -left-[1.83rem] top-7 size-2.5 rounded-full border-2 border-background sm:-left-[2.08rem]',
                        movement === 'fractured' ? 'bg-destructive' : movement === 'weakened' ? 'bg-muted-foreground' : 'bg-accent'
                      )}
                      aria-hidden="true"
                    />
                    <summary className="relative grid cursor-pointer list-none gap-3 py-4 pr-7 outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:grid-cols-[7rem_minmax(0,1fr)_1.5rem] sm:items-start sm:px-3 sm:pr-3 lg:grid-cols-[7rem_minmax(0,1fr)_minmax(8rem,13rem)_1.5rem] [&::-webkit-details-marker]:hidden">
                      <time dateTime={event.date} className="font-code text-[9px] uppercase leading-5 tracking-[0.14em] text-muted-foreground">
                        <span className="block font-bold text-foreground/80">
                          {eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {!isEvolutionDateOnly(event.date) && <span className="block">
                          {eventDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </span>}
                      </time>
                      <div className="min-w-0">
                        <div className="noesis-event-kind flex min-w-0 items-center gap-2" data-stage-tone={eventStageTone(event.targetType)}>
                          <EventTypeIcon targetType={event.targetType} className="size-[18px] shrink-0 stroke-[2.4]" />
                          <span className="min-w-0 break-words font-code text-[9px] font-bold uppercase tracking-[0.16em] lg:whitespace-nowrap">
                            {event.chips[0] || event.targetType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h3 className="mt-1 max-w-3xl font-headline text-lg font-semibold leading-snug text-foreground sm:text-xl">{event.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{event.targetType.replace(/_/g, ' ')} · {event.chips[1] || event.kind}</p>
                        {event.beforeLabel && event.afterLabel && (
                          <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-muted-foreground group-open:hidden">
                            <span>Before: {event.beforeLabel}</span>
                            {' '}<span className="mx-1" aria-hidden="true">&rarr;</span>{' '}
                            <span className="text-foreground">After: {event.afterLabel}</span>
                          </p>
                        )}
                      </div>
                      {meaning.significance && (
                        <div className="border-t border-border/40 pt-3 sm:col-start-2 sm:col-end-3 sm:row-start-2 lg:col-auto lg:row-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                          <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Why it matters</div>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-foreground/75">{meaning.significance}</p>
                        </div>
                      )}
                      <ChevronDown className="absolute right-1 top-5 size-4 stroke-[2.4] text-muted-foreground transition-transform group-open:rotate-180 sm:static sm:col-start-3 sm:row-start-1 sm:mt-1 lg:col-auto lg:row-auto" aria-hidden="true" />
                    </summary>

                    <EvolutionEventDetails event={event} influencedSources={sourcesForEvent(event.sourceIds)} className="sm:ml-[7rem] sm:grid-cols-3 sm:px-3" />
                  </details>
                );
              })}
            </div>
          </section>
        ))}

        {dateRangeIsValid && filteredEvents.length === 0 && (
          <div>
            <PageEmptyState
              icon={History}
              title={periodHasOlderMatches ? 'No matches in loaded history' : evolutionFiltersActive ? 'No changes match these filters' : 'No evolution recorded'}
              description={periodHasOlderMatches ? 'Load older history to check for more changes.' : evolutionFiltersActive ? 'Adjust the dates or clear your filters.' : 'Revisions, resolutions, and other meaningful changes will appear here.'}
              action={evolutionFiltersActive ? <Button variant="outline" onClick={clearEvolutionFilters} className="rounded-full">Clear filters</Button> : undefined}
            />
          </div>
        )}
      </div>
      {rangeEnd < filteredEvents.length && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((count) => count + 12)}
            className="rounded-full px-5 font-code text-[10px] uppercase tracking-widest"
          >
            Show more loaded changes
          </Button>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function EvolutionEventDetails({ event, influencedSources, className }: { event: DisplayEvent; influencedSources: Media[]; className?: string }) {
  const meaning = displayEventMeaning(event);
  const evidence = eventEvidenceQuality(event);
  return (
    <div className={cn('grid gap-4 break-words border-t border-border/45 py-4', className)}>
    <div>
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Evidence quality</div>
      <p className="mt-1 text-sm leading-5 text-foreground/75"><span className="font-semibold text-foreground">{evidence.label}.</span> {evidence.detail}</p>
    </div>
    <div>
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{event.isTurningPoint ? 'Turning point' : 'Change type'}</div>
      <p className="mt-1 text-sm leading-5 text-foreground/75">{meaning.turningPoint}</p>
    </div>
    <div>
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Trigger</div>
      <p className="mt-1 text-sm leading-5 text-foreground/75">{meaning.trigger}</p>
    </div>

    {(event.beforeLabel || event.afterLabel) && (
      <div className="grid gap-3 border-t border-border/40 pt-4 sm:col-span-3 sm:grid-cols-2">
        <div>
          <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Before</div>
          <p className="mt-1 text-sm leading-5 text-foreground/70">{event.beforeLabel || 'Previous state not recorded.'}</p>
        </div>
        <div>
          <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-accent">After</div>
          <p className="mt-1 text-sm leading-5 text-foreground/80">{event.afterLabel || 'Current state not recorded.'}</p>
        </div>
      </div>
    )}

    {event.synthesisProvenance && <AiProvenanceBadge provenance={event.synthesisProvenance}
      target={{ type: 'evolution', id: event.id, fieldPath: 'synthesis', subrecordId: event.id }}
      title="Period synthesis" label="Open AI-assisted synthesis" />}
    {event.kind === 'timeline' && event.targetType === 'evolution' && !event.synthesisProvenance && event.detail.trim() && (
      <div className="border-t border-border/40 pt-4 sm:col-span-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Saved period review</div>
          <Badge variant="outline" className="rounded-md font-code text-[8px] uppercase tracking-wider">AI-assisted</Badge>
        </div>
        <ContextualAiDocument content={event.detail} />
      </div>
    )}

    {((event.changedFields?.length ?? 0) > 0 || influencedSources.length > 0) && (
      <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4 sm:col-span-3">
        {event.changedFields?.slice(0, 10).map((field) => (
          <Badge key={field} variant="outline" className="rounded-md font-code text-[8px] uppercase tracking-widest">
            {field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
          </Badge>
        ))}
        {influencedSources.map((source) => (
          <Badge key={source.id} variant="secondary" className="flex items-center gap-1.5 rounded-md font-code text-[8px] uppercase tracking-wider">
            <NOESIS_ICONS.source className="size-3 opacity-60" aria-hidden="true" />
            {source.title}
          </Badge>
        ))}
      </div>
    )}
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

/** An area's recorded movement as one bar: gained, stabilized, weakened, fractured. */
function MovementBar({ movements }: { movements: { gained: number; weakened: number; fractured: number; stabilized: number } }) {
  const parts = [
    { key: 'gained', label: 'Gained', value: movements.gained, tone: 'act' },
    { key: 'stabilized', label: 'Stabilized', value: movements.stabilized, tone: 'examine' },
    { key: 'weakened', label: 'Weakened', value: movements.weakened, tone: 'encounter' },
    { key: 'fractured', label: 'Fractured', value: movements.fractured, tone: 'claim' },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div className="noesis-movement mt-4">
      <div className="noesis-movement__bar" role="img" aria-label={parts.map((part) => `${part.label} ${part.value}`).join(', ')}>
        {total ? parts.map((part) => part.value ? <span key={part.key} data-stage-tone={part.tone} style={{ flexGrow: part.value }} title={`${part.label}: ${part.value}`} /> : null) : <span className="noesis-movement__none" />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((part) => (
          <span key={part.key} data-stage-tone={part.tone} className="noesis-flowbar__key"><i />{part.label} <b>{part.value}</b></span>
        ))}
      </div>
    </div>
  );
}

/** Turning points on one time axis: when the system turned, coloured by stage. */
function TurningSpine({ events }: { events: Array<{ id: string; title: string; date: string; tone: string }> }) {
  const times = events.map((event) => Date.parse(event.date)).filter(Number.isFinite);
  if (!times.length) return null;
  const min = Math.min(...times); const max = Math.max(...times); const span = Math.max(1, max - min);
  const fmt = (value: number) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
  return (
    <div className="noesis-spine mb-6" role="img" aria-label={`${events.length} turning points from ${fmt(min)} to ${fmt(max)}`}>
      <span className="noesis-spine__axis" />
      {events.map((event, index) => {
        const time = Date.parse(event.date);
        if (!Number.isFinite(time)) return null;
        const at = (time - min) / span;
        return (
          <span key={event.id} data-edge={at < 0.15 ? 'start' : at > 0.85 ? 'end' : undefined} className="noesis-spine__dot" data-stage-tone={event.tone} style={{ left: `${4 + ((time - min) / span) * 92}%`, top: `${index % 2 ? 58 : 22}%` }} title={`${fmt(time)} · ${event.title}`}>
            <em>{event.title.length > 34 ? `${event.title.slice(0, 33)}…` : event.title}</em>
          </span>
        );
      })}
      <span className="noesis-spine__date" style={{ left: '4%' }}>{fmt(min)}</span>
      <span className="noesis-spine__date" style={{ left: '96%' }}>{fmt(max)}</span>
    </div>
  );
}
