"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, Filter, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { aiHistoryEntry, type AiContextEnvelope, type ContextualAiAction } from '@/lib/contextual-ai';
import { EntityPicker } from '@/components/search/EntityPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { iconForNoesisView } from '@/lib/noesis-icons';
import { PageHeader } from '@/components/shared/PageHeader';
import type { AiSettings, Concept, Draft, Media, Practice, Question, VaultEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

type ContextRecordType = 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'work' | 'practice';
type ContextDateFilter = 'all' | '7d' | '30d' | '90d' | 'year';
type ContextSort = 'updated' | 'created' | 'title';

interface ContextRecord {
  key: string;
  id: string;
  type: ContextRecordType;
  label: string;
  summary: string;
  memory: string[];
  sourceIds: string[];
  conceptIds: string[];
  conceptTags: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface ContextDeskRoutePageProps {
  aiSettings: AiSettings;
  media: Media[];
  concepts: Concept[];
  questions: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onNavigate: (view: string, targetId?: string | null) => void;
}

const SESSION_KEY = 'noesis:context-desk:selected';
const EXCLUSION_SESSION_KEY = 'noesis:context-desk:excluded';
const MAX_CONTEXT_ITEMS = 12;

const viewForType: Record<ContextRecordType, string> = {
  source: 'library',
  annotation: 'annotations',
  concept: 'concepts',
  inquiry: 'questions',
  position: 'vault',
  work: 'writing',
  practice: 'practices',
};

const contextTypeLabels: Record<ContextRecordType, string> = {
  source: 'Sources',
  annotation: 'Annotations',
  concept: 'Concepts',
  inquiry: 'Inquiries',
  position: 'Positions',
  work: 'Works',
  practice: 'Practices',
};

function compact(value?: string, fallback = 'No additional context recorded.') {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function dateValue(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRecordDate(value?: string) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ContextDeskRoutePage({
  aiSettings,
  media,
  concepts,
  questions,
  positions,
  works,
  practices,
  onAddDraft,
  onNavigate,
}: ContextDeskRoutePageProps) {
  const conceptNameById = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept.name])), [concepts]);
  const records = useMemo<ContextRecord[]>(() => [
    ...media.map((item) => ({
      key: `source:${item.id}`,
      id: item.id,
      type: 'source' as const,
      label: item.title,
      summary: compact(item.description, `${item.type} by ${item.creator || 'unknown creator'}`),
      memory: [
        `Source: ${item.title}${item.creator ? ` by ${item.creator}` : ''}`,
        `Type and status: ${item.type}; ${item.status}`,
        `Description: ${item.description || 'Not recorded.'}`,
        `Main idea: ${item.capture?.after?.coreArgument || 'Not recorded.'}`,
        `User reflection: ${item.capture?.after?.lasting || item.capture?.after?.beliefChange || 'Not recorded.'}`,
      ],
      sourceIds: [item.id],
      conceptIds: [],
      conceptTags: item.tags || [],
      createdAt: item.dateAdded,
      updatedAt: item.dateUpdated || item.dateAdded,
    })),
    ...media.flatMap((source) => (source.annotations || []).map((annotation) => ({
      key: `annotation:${source.id}:${annotation.id}`,
      id: annotation.id,
      type: 'annotation' as const,
      label: compact(annotation.text, 'Untitled annotation'),
      summary: `${source.title} · ${annotation.type}`,
      memory: [
        `Annotation from ${source.title}: ${annotation.text}`,
        `Annotation type: ${annotation.type}`,
        `Surrounding context: ${annotation.context || 'Not recorded.'}`,
        `User interpretation: ${annotation.consequenceNote || 'Not recorded.'}`,
        `Concepts: ${(annotation.conceptTags || []).join(', ') || 'None linked.'}`,
      ],
      sourceIds: [source.id],
      conceptIds: [],
      conceptTags: annotation.conceptTags || [],
      createdAt: annotation.date,
      updatedAt: annotation.date,
    }))),
    ...concepts.map((item) => ({
      key: `concept:${item.id}`,
      id: item.id,
      type: 'concept' as const,
      label: item.name,
      summary: compact(item.description),
      memory: [
        `Concept: ${item.name}`,
        `Definition: ${item.description || 'Not recorded.'}`,
        `Aliases: ${(item.aliases || []).join(', ') || 'None recorded.'}`,
        `Not the same as: ${(item.notSameAs || []).join(', ') || 'Not recorded.'}`,
        `Examples: ${(item.examples || []).join('; ') || 'Not recorded.'}`,
      ],
      sourceIds: item.sourceIds || [],
      conceptIds: [item.id],
      conceptTags: [item.name, ...(item.aliases || [])],
      createdAt: item.dateCreated,
      updatedAt: item.dateUpdated || item.dateCreated,
    })),
    ...questions.map((item) => ({
      key: `inquiry:${item.id}`,
      id: item.id,
      type: 'inquiry' as const,
      label: item.text,
      summary: compact(item.answer || item.currentIntuition, `Status: ${item.status}`),
      memory: [
        `Inquiry: ${item.text}`,
        `Status: ${item.status}`,
        `Why it matters: ${item.whyItMatters || 'Not recorded.'}`,
        `Current view: ${item.currentIntuition || item.answer || 'Not recorded.'}`,
        `Remaining uncertainty: ${item.uncertainty || 'Not recorded.'}`,
      ],
      sourceIds: item.sourceIds || [],
      conceptIds: item.conceptIds || [],
      conceptTags: (item.conceptIds || []).map((id) => conceptNameById.get(id)).filter((name): name is string => Boolean(name)),
      createdAt: item.dateCreated,
      updatedAt: item.dateUpdated || item.dateCreated,
    })),
    ...positions.map((item) => ({
      key: `position:${item.id}`,
      id: item.id,
      type: 'position' as const,
      label: item.title || item.statement,
      summary: compact(item.statement || item.description),
      memory: [
        `Position: ${item.statement || item.title}`,
        `Status and confidence: ${item.status}; ${item.confidence}%`,
        `Rationale: ${item.rationale || item.description || 'Not recorded.'}`,
        `Assumptions: ${(item.assumptions || []).join('; ') || 'None recorded.'}`,
        `Supporting evidence: ${(item.evidenceFor || []).join('; ') || 'None recorded.'}`,
        `Challenging evidence: ${(item.evidenceAgainst || []).join('; ') || 'None recorded.'}`,
      ],
      sourceIds: item.sourceIds || [],
      conceptIds: [],
      conceptTags: item.tags || [],
      createdAt: item.dateCreated,
      updatedAt: item.dateUpdated || item.dateCreated,
    })),
    ...works.map((item) => ({
      key: `work:${item.id}`,
      id: item.id,
      type: 'work' as const,
      label: item.title,
      summary: compact(item.body || item.draftContent, `${item.type} in ${item.status}`),
      memory: [
        `Work: ${item.title}`,
        `Type, purpose, and status: ${item.type}; ${item.workPurpose || 'not specified'}; ${item.status}`,
        `Content: ${compact(item.body || item.draftContent, 'No written content recorded.')}`,
        `Concepts: ${(item.conceptTags || []).join(', ') || 'None linked.'}`,
      ],
      sourceIds: item.sourceIds || [],
      conceptIds: [],
      conceptTags: item.conceptTags || [],
      createdAt: item.dateCreated,
      updatedAt: item.dateUpdated || item.dateCreated,
    })),
    ...practices.map((item) => ({
      key: `practice:${item.id}`,
      id: item.id,
      type: 'practice' as const,
      label: item.title,
      summary: compact(item.action || item.description, `Status: ${item.status}`),
      memory: [
        `Practice: ${item.title}`,
        `Status and type: ${item.status}; ${item.type}`,
        `Hypothesis: ${item.hypothesis || 'Not recorded.'}`,
        `Action: ${item.action || item.description || 'Not recorded.'}`,
        `Observed outcome: ${item.observedOutcome || item.conclusion?.whatHappened || 'Not recorded.'}`,
        ...(item.logs || []).slice(-5).map((log) => `Log ${log.date}: performed ${log.actionCompleted ? 'yes' : 'no'}; ${log.observations || log.outcome || 'no observation recorded'}`),
      ],
      sourceIds: item.sourceIds || [],
      conceptIds: [],
      conceptTags: item.conceptTags || [],
      createdAt: item.dateCreated,
      updatedAt: item.dateUpdated || item.dateCreated,
    })),
  ], [conceptNameById, concepts, media, positions, practices, questions, works]);

  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<ContextRecordType | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [conceptFilter, setConceptFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<ContextDateFilter>('all');
  const [sortBy, setSortBy] = useState<ContextSort>('updated');
  const [excludedKeys, setExcludedKeys] = useState<string[]>([]);
  const [excludedTypes, setExcludedTypes] = useState<ContextRecordType[]>([]);
  const [excludedSourceIds, setExcludedSourceIds] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SESSION_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setSelectedKeys(parsed.filter((value): value is string => typeof value === 'string'));
    } catch {
      setSelectedKeys([]);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(EXCLUSION_SESSION_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      if (Array.isArray(parsed.keys)) setExcludedKeys(parsed.keys.filter((value: unknown): value is string => typeof value === 'string'));
      if (Array.isArray(parsed.types)) setExcludedTypes(parsed.types.filter((value: unknown): value is ContextRecordType => typeof value === 'string' && value in contextTypeLabels));
      if (Array.isArray(parsed.sourceIds)) setExcludedSourceIds(parsed.sourceIds.filter((value: unknown): value is string => typeof value === 'string'));
    } catch {
      setExcludedKeys([]);
      setExcludedTypes([]);
      setExcludedSourceIds([]);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(selectedKeys));
  }, [selectedKeys]);

  useEffect(() => {
    window.sessionStorage.setItem(EXCLUSION_SESSION_KEY, JSON.stringify({ keys: excludedKeys, types: excludedTypes, sourceIds: excludedSourceIds }));
  }, [excludedKeys, excludedSourceIds, excludedTypes]);

  const selected = useMemo(() => selectedKeys
    .map((key) => records.find((record) => record.key === key))
    .filter((record): record is ContextRecord => Boolean(record))
    .filter((record) => !excludedKeys.includes(record.key) && !excludedTypes.includes(record.type) && !record.sourceIds.some((id) => excludedSourceIds.includes(id))),
  [excludedKeys, excludedSourceIds, excludedTypes, records, selectedKeys]);
  const staleSelectionCount = selectedKeys.filter((key) => !records.some((record) => record.key === key)).length;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const dateWindow = dateFilter === 'all' ? 0 : ({ '7d': 7, '30d': 30, '90d': 90, year: 365 } as const)[dateFilter];
    const cutoff = dateWindow ? Date.now() - dateWindow * 24 * 60 * 60 * 1000 : 0;
    return records
      .filter((record) => !excludedKeys.includes(record.key))
      .filter((record) => !excludedTypes.includes(record.type))
      .filter((record) => !record.sourceIds.some((id) => excludedSourceIds.includes(id)))
      .filter((record) => typeFilter === 'all' || record.type === typeFilter)
      .filter((record) => sourceFilter === 'all' || record.sourceIds.includes(sourceFilter))
      .filter((record) => conceptFilter === 'all' || record.conceptIds.includes(conceptFilter) || record.conceptTags.some((tag) => tag.toLowerCase() === conceptNameById.get(conceptFilter)?.toLowerCase()))
      .filter((record) => !cutoff || dateValue(record.createdAt) >= cutoff)
      .filter((record) => !normalized || `${record.label} ${record.summary} ${record.type} ${record.conceptTags.join(' ')}`.toLowerCase().includes(normalized))
      .sort((left, right) => {
        if (sortBy === 'title') return left.label.localeCompare(right.label);
        if (sortBy === 'created') return dateValue(right.createdAt) - dateValue(left.createdAt);
        return dateValue(right.updatedAt) - dateValue(left.updatedAt);
      })
      .slice(0, 100);
  }, [conceptFilter, conceptNameById, dateFilter, excludedKeys, excludedSourceIds, excludedTypes, query, records, sortBy, sourceFilter, typeFilter]);

  const activeFilterCount = [typeFilter !== 'all', sourceFilter !== 'all', conceptFilter !== 'all', dateFilter !== 'all'].filter(Boolean).length;
  const exclusionCount = excludedKeys.length + excludedTypes.length + excludedSourceIds.length;
  const selectedCounts = useMemo(() => (Object.keys(contextTypeLabels) as ContextRecordType[]).map((type) => ({
    type,
    count: selected.filter((record) => record.type === type).length,
  })).filter((entry) => entry.count > 0), [selected]);
  const excludedRecordCount = useMemo(() => records.filter((record) => (
    excludedKeys.includes(record.key)
    || excludedTypes.includes(record.type)
    || record.sourceIds.some((id) => excludedSourceIds.includes(id))
  )).length, [excludedKeys, excludedSourceIds, excludedTypes, records]);
  const sourceExclusionItems = useMemo(() => media.map((source) => ({
    id: source.id,
    label: source.title,
    secondary: [source.creator, source.type].filter(Boolean).join(' · '),
    searchText: [source.creator || '', source.type, ...(source.tags || [])],
  })), [media]);

  const toggleRecord = (record: ContextRecord) => {
    setSelectedKeys((current) => {
      if (current.includes(record.key)) return current.filter((key) => key !== record.key);
      if (current.length >= MAX_CONTEXT_ITEMS) return current;
      return [...current, record.key];
    });
  };

  const excludeRecord = (record: ContextRecord) => {
    setExcludedKeys((current) => current.includes(record.key) ? current : [...current, record.key]);
    setSelectedKeys((current) => current.filter((key) => key !== record.key));
  };

  const toggleExcludedType = (type: ContextRecordType) => {
    const willExclude = !excludedTypes.includes(type);
    setExcludedTypes((current) => willExclude ? [...current, type] : current.filter((value) => value !== type));
    if (willExclude) setSelectedKeys((current) => current.filter((key) => records.find((record) => record.key === key)?.type !== type));
  };

  const toggleExcludedSource = (sourceId: string) => {
    const willExclude = !excludedSourceIds.includes(sourceId);
    setExcludedSourceIds((current) => willExclude ? [...current, sourceId] : current.filter((value) => value !== sourceId));
    if (willExclude) setSelectedKeys((current) => current.filter((key) => !records.find((record) => record.key === key)?.sourceIds.includes(sourceId)));
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setSourceFilter('all');
    setConceptFilter('all');
    setDateFilter('all');
    setQuery('');
  };

  const addVisibleRecords = () => {
    setSelectedKeys((current) => {
      const next = current.filter((key) => {
        const record = records.find((candidate) => candidate.key === key);
        return Boolean(record)
          && !excludedKeys.includes(key)
          && !excludedTypes.includes(record!.type)
          && !record!.sourceIds.some((id) => excludedSourceIds.includes(id));
      });
      for (const record of filtered) {
        if (next.length >= MAX_CONTEXT_ITEMS) break;
        if (!next.includes(record.key)) next.push(record.key);
      }
      return next;
    });
  };

  const buildEnvelope = (_action: ContextualAiAction, userPrompt?: string): AiContextEnvelope | null => {
    if (!selected.length) return null;
    const [primary, ...linked] = selected;
    return {
      action: 'review_selected_context',
      targetType: 'context_desk',
      targetId: `selection:${selected.map((record) => record.key).sort().join('|')}`.slice(0, 256),
      scope: 'linked_items',
      itemMemory: [`Primary selected record (${primary.type})`, ...primary.memory],
      linkedMemory: linked.flatMap((record) => [`Selected ${record.type}: ${record.label}`, ...record.memory]),
      userPrompt,
    };
  };

  const selectedConceptNames = selected.filter((record) => record.type === 'concept').map((record) => record.label);
  const selectedIds = (type: ContextRecordType) => selected.filter((record) => record.type === type).map((record) => record.id);
  const activeSource = media.find((source) => source.id === sourceFilter);
  const activeConcept = concepts.find((concept) => concept.id === conceptFilter);
  return (
    <main className="noesis-context-desk min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <PageHeader
        title="Context Desk"
        description="Choose the records Noesis may consider. Nothing else in your workspace is included, and no result is saved until you review it."
      />

      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
        <section aria-labelledby="context-library-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="context-library-heading" className="text-lg font-semibold">Choose context</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search your records, then add only what this review needs.</p>
            </div>
            <span className="font-code text-xs text-muted-foreground">{selected.length}/{MAX_CONTEXT_ITEMS}</span>
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a source, concept, inquiry, position, work, or practice" className="h-11 pl-10" aria-label="Search workspace records" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ContextRecordType | 'all')}>
              <SelectTrigger className="h-10 min-w-0 rounded-md bg-card text-xs" aria-label="Filter by item type"><SelectValue placeholder="Item type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All item types</SelectItem>
                {(Object.entries(contextTypeLabels) as Array<[ContextRecordType, string]>).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-10 min-w-0 rounded-md bg-card text-xs" aria-label="Filter by related source"><SelectValue placeholder="Related source" /></SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">All related sources</SelectItem>
                {media.map((source) => <SelectItem key={source.id} value={source.id}>{source.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={conceptFilter} onValueChange={setConceptFilter}>
              <SelectTrigger className="h-10 min-w-0 rounded-md bg-card text-xs" aria-label="Filter by concept or tag"><SelectValue placeholder="Concept or tag" /></SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">All concepts and tags</SelectItem>
                {concepts.map((concept) => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as ContextDateFilter)}>
              <SelectTrigger className="h-10 min-w-0 rounded-md bg-card text-xs" aria-label="Filter by creation date"><SelectValue placeholder="Date created" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Created anytime</SelectItem>
                <SelectItem value="7d">Created in last 7 days</SelectItem>
                <SelectItem value="30d">Created in last 30 days</SelectItem>
                <SelectItem value="90d">Created in last 90 days</SelectItem>
                <SelectItem value="year">Created in last year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as ContextSort)}>
              <SelectTrigger className="h-10 min-w-0 rounded-md bg-card text-xs" aria-label="Sort context records"><SelectValue placeholder="Sort records" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Latest edited</SelectItem>
                <SelectItem value="created">Newest created</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 min-w-0 justify-between rounded-md bg-card px-3 text-xs font-normal">
                  <span className="flex min-w-0 items-center gap-2"><SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">Exclusions{exclusionCount ? ` (${exclusionCount})` : ''}</span></span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-[min(70vh,32rem)] overflow-y-auto">
                <DropdownMenuLabel>Exclude item types</DropdownMenuLabel>
                {(Object.entries(contextTypeLabels) as Array<[ContextRecordType, string]>).map(([type, label]) => (
                  <DropdownMenuCheckboxItem key={type} checked={excludedTypes.includes(type)} onCheckedChange={() => toggleExcludedType(type)}>{label}</DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                {excludedKeys.length > 0 && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Individually excluded</DropdownMenuLabel>
                  {excludedKeys.map((key) => {
                    const record = records.find((candidate) => candidate.key === key);
                    return (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked
                        onCheckedChange={() => setExcludedKeys((current) => current.filter((value) => value !== key))}
                      >
                        {record?.label || 'Unavailable record'}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </>}
                {exclusionCount > 0 && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => { setExcludedKeys([]); setExcludedTypes([]); setExcludedSourceIds([]); }}>Clear all exclusions</DropdownMenuItem>
                </>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-3 border-y border-border/60 py-3">
            <EntityPicker
              items={sourceExclusionItems}
              selectedIds={excludedSourceIds}
              onToggle={toggleExcludedSource}
              label="Excluded sources"
              triggerLabel="Exclude sources"
              searchPlaceholder="Search title, author, type, or tag"
              emptySelectedLabel="No sources excluded."
              compact
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Excluding a source also excludes its annotations and any selected record directly tied to it.</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-y border-border/60 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Filter className="size-4 shrink-0" aria-hidden="true" />
              <span>Showing {filtered.length} matching record{filtered.length === 1 ? '' : 's'}</span>
              {activeSource && <Badge variant="outline" className="max-w-56 truncate">Source: {activeSource.title}</Badge>}
              {activeConcept && <Badge variant="outline">Concept: {activeConcept.name}</Badge>}
              {exclusionCount > 0 && <Badge variant="outline">{exclusionCount} exclusion{exclusionCount === 1 ? '' : 's'}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              {(activeFilterCount > 0 || query) && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
              <Button type="button" variant="outline" size="sm" onClick={addVisibleRecords} disabled={!filtered.length || selected.length >= MAX_CONTEXT_ITEMS}>Add visible</Button>
            </div>
          </div>
          <ScrollArea className="mt-3 h-[min(52vh,34rem)] border-y border-border">
            <div className="divide-y divide-border">
              {filtered.map((record) => {
                const active = selectedKeys.includes(record.key);
                const Icon = iconForNoesisView(viewForType[record.type]);
                return (
                  <div key={record.key} className={cn('grid grid-cols-[minmax(0,1fr)_2.5rem] items-stretch transition-colors', active && 'bg-accent/8')}>
                    <button
                      type="button"
                      onClick={() => toggleRecord(record)}
                      disabled={!active && selected.length >= MAX_CONTEXT_ITEMS}
                      className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-45"
                      aria-pressed={active}
                    >
                      <span className="flex size-9 items-center justify-center text-muted-foreground"><Icon className="size-[18px]" aria-hidden="true" /></span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{record.label}</span><Badge variant="outline" className="text-[9px] uppercase">{record.type}</Badge></span>
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{record.summary}</span>
                        {formatRecordDate(sortBy === 'created' ? record.createdAt : record.updatedAt) && (
                          <span className="mt-1 block font-code text-[10px] uppercase text-muted-foreground">
                            {sortBy === 'created' ? 'Created' : 'Edited'} {formatRecordDate(sortBy === 'created' ? record.createdAt : record.updatedAt)}
                          </span>
                        )}
                      </span>
                      <span className={cn('mt-1 flex size-8 items-center justify-center border', active ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground')} aria-hidden="true">{active ? <Check className="size-4" /> : <Plus className="size-4" />}</span>
                    </button>
                    <Button type="button" variant="ghost" size="icon" className="my-2 size-9 self-start text-muted-foreground hover:text-destructive" onClick={() => excludeRecord(record)} aria-label={`Exclude ${record.label} from Context Desk`} title="Exclude from Context Desk"><X className="size-4" /></Button>
                  </div>
                );
              })}
              {!filtered.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No records match that search.</p>}
            </div>
          </ScrollArea>
        </section>

        <section aria-labelledby="selected-context-heading" className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="selected-context-heading" className="text-lg font-semibold">Selected context</h2>
              <p className="mt-1 text-sm text-muted-foreground">This exact set is sent for review.</p>
            </div>
            {selected.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys([])}>Clear</Button>}
          </div>

          <div className="mt-4 min-h-36 divide-y divide-border border-y border-border">
            {selected.map((record) => {
              const Icon = iconForNoesisView(viewForType[record.type]);
              return (
                <div key={record.key} className="grid grid-cols-[1.75rem_minmax(0,1fr)_2.5rem] items-start gap-2 py-3">
                  <Icon className="mt-1 size-4 text-muted-foreground" aria-hidden="true" />
                  <button type="button" className="min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onNavigate(viewForType[record.type], record.id)}>
                    <span className="block text-sm font-medium leading-5 text-foreground">{record.label}</span>
                    <span className="mt-0.5 block text-[10px] uppercase text-muted-foreground">{record.type}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">Included: {record.summary}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => toggleRecord(record)} aria-label={`Remove ${record.label} from context`}><X className="size-4" /></Button>
                </div>
              );
            })}
            {!selected.length && <div className="flex min-h-36 items-center justify-center px-5 text-center text-sm leading-6 text-muted-foreground">Select at least one record to begin. Two or more records are best for comparison and contradiction checks.</div>}
          </div>

          {staleSelectionCount > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 border-l-2 border-destructive/60 pl-3 text-xs leading-5 text-muted-foreground">
              <span>{staleSelectionCount} previously selected {staleSelectionCount === 1 ? 'record is' : 'records are'} no longer available and will not be sent.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(selected.map((record) => record.key))}>Remove stale</Button>
            </div>
          )}
          {selected.length >= MAX_CONTEXT_ITEMS && (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Selection limit reached. Remove an item before adding another; no unselected records will be included.</p>
          )}

          <Separator className="my-5" />
          <div className="sticky bottom-3 z-10 space-y-3 border border-border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/88">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{selected.length} selected · {exclusionCount} exclusion{exclusionCount === 1 ? '' : 's'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Only the reviewed selection is sent.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setReviewOpen(true)}>Review Context</Button>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Review destination</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Approved findings become a new editable Work. The selected records remain unchanged.</p>
            </div>
            <ContextualAiPanel
              actions={['review_selected_context']}
              enabled={aiSettings.aiAssistanceEnabled && selected.length > 0}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiSettings.defaultReasoningDepth}
              retainAcceptedProvenance={aiSettings.retainAcceptedAiProvenance}
              buttonLabel={selected.length ? 'Analyze selected context' : 'Select context first'}
              promptLabel="What should Noesis examine across these records?"
              promptPlaceholder="For example: Where do these records contradict each other, and what should I investigate next?"
              buildEnvelope={buildEnvelope}
              onAccept={async (result, content) => {
                const created = await onAddDraft({
                  title: `Context review - ${new Date().toLocaleDateString()}`,
                  body: content,
                  draftContent: content,
                  type: 'reflection',
                  status: 'drafting',
                  workCategory: 'writing',
                  workPurpose: 'synthesize',
                  conceptTags: selectedConceptNames,
                  sourceIds: selectedIds('source'),
                  questionIds: selectedIds('inquiry'),
                  beliefIds: selectedIds('position'),
                  aiReviewHistory: [aiHistoryEntry(result, content)],
                });
                onNavigate('writing', created.id);
              }}
            />
            {!aiSettings.aiAssistanceEnabled && <p className="text-xs text-muted-foreground">Contextual assistance is disabled in Settings.</p>}
          </div>
        </section>
      </div>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[min(84vh,46rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Context</DialogTitle>
            <DialogDescription>Confirm the exact records Noesis may consider before starting the analysis.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 sm:grid-cols-2">
            <section aria-labelledby="included-context-summary">
              <h3 id="included-context-summary" className="text-sm font-semibold">Included · {selected.length}</h3>
              <div className="mt-2 divide-y divide-border border-y border-border">
                {selectedCounts.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{contextTypeLabels[type]}</span><span className="font-code text-xs text-muted-foreground">{count}</span>
                  </div>
                ))}
                {!selected.length && <p className="py-4 text-sm text-muted-foreground">No records selected yet.</p>}
              </div>
            </section>
            <section aria-labelledby="excluded-context-summary">
              <h3 id="excluded-context-summary" className="text-sm font-semibold">Excluded · {excludedRecordCount} affected records</h3>
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <p>{excludedTypes.length} excluded item type{excludedTypes.length === 1 ? '' : 's'}</p>
                <p>{excludedSourceIds.length} excluded source{excludedSourceIds.length === 1 ? '' : 's'}</p>
                <p>{excludedKeys.length} individually excluded record{excludedKeys.length === 1 ? '' : 's'}</p>
              </div>
            </section>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Continue selecting</Button>
            <Button type="button" onClick={() => setReviewOpen(false)} disabled={!selected.length}>Context confirmed</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
