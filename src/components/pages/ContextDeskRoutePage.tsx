"use client";

import { ContextDrawers } from '@/components/ai/ContextDrawers';
import { AiUsageMeter } from '@/components/ai/AiUsageMeter';
import { deskComposition, deskSuggestions, type DeskItem } from '@/lib/context-desk-suggestions';
import { MAX_DESK_ITEMS, readDeskMembership } from '@/lib/saved-context-desks';
import { aiDepthFor } from '@/lib/ai-depth';
import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { contextDeskRecordIsExcluded, contextDeskReviewKey, contextDeskSourceIds, contextDeskStorageKeys, MAX_CONTEXT_ITEMS, normalizeContextDeskSelection, resolveDeskSelection } from '@/lib/context-desk-selection';
import { Check, Filter, FolderOpen, GripVertical, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { buildContextDeskMemory, type AiContextEnvelope, type ContextualAiAction } from '@/lib/contextual-ai';
import { contextDeskWorkDraft, type ContextDeskWorkOrigin } from '@/lib/context-desk-work';
import { deskExperimentId, isDeskFindingTarget, type DeskExperiment, type DeskFindingTarget } from '@/lib/context-desk-handoff';
import type { AiReviewResult } from '@/lib/contextual-ai';
import { EntityPicker } from '@/components/search/EntityPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { collectAiHistory, NoesisAiHistory } from '@/components/ai/NoesisAiHistory';
import { History, ScanSearch } from 'lucide-react';
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
  savedDeskOwner?: string;
  aiSettings: AiSettings;
  media: Media[];
  concepts: Concept[];
  questions: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  onAddDraft: (data: Partial<Draft>, origin?: ContextDeskWorkOrigin) => Promise<Draft>;
  onSaveFinding: (target: DeskFindingTarget, result: AiReviewResult, content: string, records: ReadonlyArray<{ type: string; id: string }>, experiment?: DeskExperiment) => Promise<void>;
  onNavigate: (view: string, targetId?: string | null, sourceId?: string) => void;
}

const viewForType: Record<ContextRecordType, string> = {
  source: 'library',
  annotation: 'annotations',
  concept: 'concepts',
  inquiry: 'questions',
  position: 'vault',
  work: 'writing',
  practice: 'labs',
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
  savedDeskOwner,
  aiSettings,
  media,
  concepts,
  questions,
  positions,
  works,
  practices,
  onAddDraft,
  onSaveFinding,
  onNavigate,
}: ContextDeskRoutePageProps) {
  const workspaceKey = useContext(NoesisWorkspaceKeyContext);
  // The Desk comes first, because it is the thing you work in; History is the
  // record of what has already been run.
  const [surface, setSurface] = useState<'history' | 'desk'>('desk');
  const [savingTo, setSavingTo] = useState('work');
  const [experiment, setExperiment] = useState<DeskExperiment>({ title: '', action: '', prediction: '', measure: '' });
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('noesis:context-desk-surface');
      if (saved === 'history' || saved === 'desk') setSurface(saved);
    } catch { /* View preference is optional. */ }
  }, []);
  const chooseSurface = (next: 'history' | 'desk') => {
    setSurface(next);
    try { window.localStorage.setItem('noesis:context-desk-surface', next); } catch { /* View preference is optional. */ }
  };
  const aiHistory = useMemo(() => collectAiHistory({ media, concepts, questions, positions, works, practices }), [media, concepts, questions, positions, works, practices]);
  const storageKeys = useMemo(() => workspaceKey ? contextDeskStorageKeys(workspaceKey) : null, [workspaceKey]);
  const conceptNameById = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept.name])), [concepts]);
  const knownSourceIds = useMemo(() => new Set(media.map((source) => source.id)), [media]);
  const sourceByAnnotation = useMemo(() => new Map(media.flatMap((source) =>
    (source.annotations || []).map((note) => [note.id, source.id] as const))), [media]);
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
      sourceIds: contextDeskSourceIds(
        [...(item.sourceIds || []), ...(item.evidenceIds || []).filter((id) => knownSourceIds.has(id))],
        [item.sourceAnnotationId, ...(item.evidenceIds || [])],
        sourceByAnnotation,
      ),
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
      sourceIds: contextDeskSourceIds(item.sourceIds, [item.sourceAnnotationId], sourceByAnnotation),
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
  ], [conceptNameById, concepts, knownSourceIds, media, positions, practices, questions, sourceByAnnotation, works]);

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
  const reviewButton = useRef<HTMLButtonElement>(null);
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => { setVisibleLimit(100); }, [query, typeFilter, sourceFilter, conceptFilter, dateFilter, sortBy]);

  useEffect(() => {
    try {
      const stored = storageKeys ? window.sessionStorage.getItem(storageKeys.selection) : null;
      const parsed = stored ? JSON.parse(stored) : [];
      setSelectedKeys(normalizeContextDeskSelection(parsed, MAX_DESK_ITEMS));
    } catch {
      setSelectedKeys([]);
    }
    try {
      const stored = storageKeys ? window.sessionStorage.getItem(storageKeys.exclusions) : null;
      const { keys, types, sourceIds } = readDeskMembership(stored ? JSON.parse(stored) : {});
      setExcludedKeys(keys);
      setExcludedTypes(types);
      setExcludedSourceIds(sourceIds);
    } catch {
      setExcludedKeys([]);
      setExcludedTypes([]);
      setExcludedSourceIds([]);
    }
    setStorageReady(true);
  }, [storageKeys]);

  useEffect(() => {
    if (!storageReady || !storageKeys) return;
    try { window.sessionStorage.setItem(storageKeys.selection, JSON.stringify(selectedKeys)); } catch { /* Selection remains usable in memory. */ }
  }, [selectedKeys, storageKeys, storageReady]);

  useEffect(() => {
    if (!storageReady || !storageKeys) return;
    try { window.sessionStorage.setItem(storageKeys.exclusions, JSON.stringify({ keys: excludedKeys, types: excludedTypes, sourceIds: excludedSourceIds })); } catch { /* Exclusions remain usable in memory. */ }
  }, [excludedKeys, excludedSourceIds, excludedTypes, storageKeys, storageReady]);

  const recordsByKey = useMemo(() => new Map(records.map((record) => [record.key, record])), [records]);
  const exclusionRules = useMemo(() => ({
    keys: new Set(excludedKeys), types: new Set(excludedTypes), sourceIds: new Set(excludedSourceIds),
  }), [excludedKeys, excludedSourceIds, excludedTypes]);
  const { available: selected, analysis: analysisRecords, unavailable: staleSelectionCount } = useMemo(
    () => resolveDeskSelection(selectedKeys, recordsByKey, exclusionRules),
    [exclusionRules, recordsByKey, selectedKeys],
  );
  const [memberLimit, setMemberLimit] = useState(40);
  // Drawers live behind a panel so the Desk itself keeps the room it needs.
  const [drawersOpen, setDrawersOpen] = useState(false);
  /** Bumped after a review, so the usage meter re-reads rather than going stale. */
  const [usageKey, setUsageKey] = useState(0);
  // Which slip is in hand, and which one it is hovering over.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  /**
   * Put one slip where another sits. Order is not decoration here: the first
   * records on the desk are the ones a request reads, so moving a slip up the
   * pile is how you decide what goes in.
   */
  const moveSelected = (from: string, to: string) => {
    if (from === to) return;
    setSelectedKeys((keys) => {
      const target = keys.indexOf(to);
      if (target < 0 || !keys.includes(from)) return keys;
      const next = keys.filter((key) => key !== from);
      next.splice(keys.indexOf(from) < target ? target : target, 0, from);
      return next;
    });
  };
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const dateWindow = dateFilter === 'all' ? 0 : ({ '7d': 7, '30d': 30, '90d': 90, year: 365 } as const)[dateFilter];
    const cutoff = dateWindow ? Date.now() - dateWindow * 24 * 60 * 60 * 1000 : 0;
    return records
      .filter((record) => !contextDeskRecordIsExcluded(record, exclusionRules))
      .filter((record) => typeFilter === 'all' || record.type === typeFilter)
      .filter((record) => sourceFilter === 'all' || record.sourceIds.includes(sourceFilter))
      .filter((record) => conceptFilter === 'all' || record.conceptIds.includes(conceptFilter) || record.conceptTags.some((tag) => tag.toLowerCase() === conceptNameById.get(conceptFilter)?.toLowerCase()))
      .filter((record) => !cutoff || dateValue(record.createdAt) >= cutoff)
      .filter((record) => !normalized || `${record.label} ${record.summary} ${record.type} ${record.conceptTags.join(' ')}`.toLowerCase().includes(normalized))
      .sort((left, right) => {
        if (sortBy === 'title') return left.label.localeCompare(right.label);
        if (sortBy === 'created') return dateValue(right.createdAt) - dateValue(left.createdAt);
        return dateValue(right.updatedAt) - dateValue(left.updatedAt);
      });
  }, [conceptFilter, conceptNameById, dateFilter, exclusionRules, query, records, sortBy, sourceFilter, typeFilter]);
  const visibleRecords = filtered.slice(0, visibleLimit);

  const activeFilterCount = [typeFilter !== 'all', sourceFilter !== 'all', conceptFilter !== 'all', dateFilter !== 'all'].filter(Boolean).length;
  const exclusionCount = excludedKeys.length + excludedTypes.length + excludedSourceIds.length;
  /** An inquiry is worth suggesting only while it is still open. */
  const inquiryStatusByKey = useMemo(
    () => new Map(questions.map((item) => [`inquiry:${item.id}`, String(item.status || 'open')])),
    [questions],
  );
  // What the desk is made of, and what is missing from it. Both read links
  // the workspace already stores; neither calls a model.
  const deskItems = useMemo<DeskItem[]>(() => selected.map((record) => ({
    key: record.key, type: record.type, label: record.label,
    sourceIds: record.sourceIds, conceptIds: record.conceptIds,
  })), [selected]);
  const poolItems = useMemo<DeskItem[]>(() => records.map((record) => ({
    key: record.key, type: record.type, label: record.label,
    sourceIds: record.sourceIds, conceptIds: record.conceptIds,
    open: record.type === 'inquiry'
      ? !/resolved|converted|no_longer_meaningful|archived/i.test(inquiryStatusByKey.get(record.key) || 'open')
      : undefined,
  })), [records, inquiryStatusByKey]);
  const composition = useMemo(
    () => deskComposition(deskItems, (type) => contextTypeLabels[type as ContextRecordType] || type),
    [deskItems],
  );
  const bringIn = useMemo(
    () => deskSuggestions(deskItems, poolItems, (id) => conceptNameById.get(id) || id)
      .map((hit) => ({ ...hit, record: recordsByKey.get(hit.key) }))
      .filter((hit): hit is typeof hit & { record: ContextRecord } => Boolean(hit.record)),
    [conceptNameById, deskItems, poolItems, recordsByKey],
  );

  const selectedGroups = useMemo(() => (Object.keys(contextTypeLabels) as ContextRecordType[]).map((type) => ({
    type,
    records: analysisRecords.filter((record) => record.type === type),
  })).filter((entry) => entry.records.length > 0), [analysisRecords]);
  const excludedRecords = useMemo(() => {
    const counts = new Map<ContextRecordType, number>();
    let total = 0;
    for (const record of records) {
      if (!contextDeskRecordIsExcluded(record, exclusionRules)) continue;
      total += 1;
      counts.set(record.type, (counts.get(record.type) ?? 0) + 1);
    }
    return { counts, total };
  }, [exclusionRules, records]);
  const sourceExclusionItems = useMemo(() => media.map((source) => ({
    id: source.id,
    label: source.title,
    secondary: [source.creator, source.type].filter(Boolean).join(' · '),
    searchText: [source.creator || '', source.type, ...(source.tags || [])],
  })), [media]);

  const toggleRecord = (record: ContextRecord) => {
    setSelectedKeys((current) => {
      if (current.includes(record.key)) return current.filter((key) => key !== record.key);
      if (contextDeskRecordIsExcluded(record, exclusionRules)) return current;
      if (current.length >= MAX_DESK_ITEMS) return current;
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
    if (willExclude) setSelectedKeys((current) => current.filter((key) => recordsByKey.get(key)?.type !== type));
  };

  const toggleExcludedSource = (sourceId: string) => {
    const willExclude = !excludedSourceIds.includes(sourceId);
    setExcludedSourceIds((current) => willExclude ? [...current, sourceId] : current.filter((value) => value !== sourceId));
    if (willExclude) setSelectedKeys((current) => current.filter((key) => !recordsByKey.get(key)?.sourceIds.includes(sourceId)));
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
      const next = [...current];
      for (const record of visibleRecords) {
        if (next.length >= MAX_DESK_ITEMS) break;
        if (!next.includes(record.key)) next.push(record.key);
      }
      return next;
    });
  };

  const buildEnvelope = (_action: ContextualAiAction, userPrompt?: string): AiContextEnvelope | null => {
    if (!selected.length) return null;
    return {
      action: 'review_selected_context',
      targetType: 'context_desk',
      targetId: `selection:${analysisRecords.map((record) => record.key).sort().join('|')}`.slice(0, 256),
      scope: 'linked_items',
      ...buildContextDeskMemory(analysisRecords),
      userPrompt,
    };
  };

  const activeSource = media.find((source) => source.id === sourceFilter);
  const activeConcept = concepts.find((concept) => concept.id === conceptFilter);
  return (
    <div className="noesis-context-desk min-h-0 flex-1 overflow-y-auto overscroll-contain" data-noesis-scroll-region>
      <div className="noesis-gutter w-full pb-28 pt-[var(--page-top)] lg:pb-12">
      <PageHeader
        title="Context Desk"
        description={surface === 'history'
          ? 'Past runs, and what each one actually read. Reopening a run shows you the result; running it again is a separate step.'
          : 'Build a set of records, then choose what a single request reads. Filtering finds records; it never sends them on its own.'}
        actions={surface === 'desk' && storageReady && savedDeskOwner ? (
          <Button type="button" variant="outline" onClick={() => setDrawersOpen(true)}>
            <FolderOpen size={16} aria-hidden="true" />Drawers
          </Button>
        ) : undefined}
        tabs={(
          <WorkspaceTabs
            value={surface}
            onChange={chooseSurface}
            label="Context Desk views"
            items={[
              { id: 'desk', label: 'Context Desk', icon: ScanSearch },
              { id: 'history', label: 'History', icon: History, count: aiHistory.length },
            ]}
          />
        )}
      />

      {/* Drawers open as a panel from the right: on a wide screen it sits
          beside the Desk, on a phone it fills the sheet. One implementation,
          so the controls and the wording cannot drift apart. */}
      {storageReady && savedDeskOwner && (
        <Sheet open={drawersOpen} onOpenChange={setDrawersOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Drawers</SheetTitle>
              <SheetDescription>A Drawer is a set you built here and named, so you can pick the thread back up later.</SheetDescription>
            </SheetHeader>
            <div className="mt-5">
              <ContextDrawers uid={savedDeskOwner}
                membership={{ selected: selectedKeys, keys: excludedKeys, types: excludedTypes, sourceIds: excludedSourceIds }}
                onOpen={drawer => {
                  setSelectedKeys(drawer.selected); setExcludedKeys(drawer.keys); setExcludedTypes(drawer.types); setExcludedSourceIds(drawer.sourceIds); setMemberLimit(40);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
      {surface === 'history' ? <NoesisAiHistory items={aiHistory} onNavigate={onNavigate} /> : (
      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
        <section aria-labelledby="context-library-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="context-library-heading" className="text-lg font-semibold">Choose context</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search your records, then add only what this review needs.</p>
            </div>
            <span className="font-code text-xs text-muted-foreground">{selectedKeys.length}/{MAX_DESK_ITEMS}</span>
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
                <Button type="button" variant="outline" className="min-w-0 justify-between text-xs font-normal">
                  <span className="flex min-w-0 items-center gap-2"><SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">Exclusions{exclusionCount ? ` (${exclusionCount})` : ''}</span></span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" scrollable className="w-72 [--noesis-menu-max-height:min(70dvh,32rem)]">
                <DropdownMenuLabel>Exclude item types</DropdownMenuLabel>
                {(Object.entries(contextTypeLabels) as Array<[ContextRecordType, string]>).map(([type, label]) => (
                  <DropdownMenuCheckboxItem key={type} checked={excludedTypes.includes(type)} onSelect={(event) => event.preventDefault()} onCheckedChange={() => toggleExcludedType(type)}>{label}</DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                {excludedKeys.length > 0 && <>
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
          <div className="mt-3 rounded-[var(--card-radius)] border border-border/60 bg-card/35 p-3">
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--card-radius)] border border-border/60 bg-card/35 px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Filter className="size-4 shrink-0" aria-hidden="true" />
              <span>Showing {visibleRecords.length} of {filtered.length} matching record{filtered.length === 1 ? '' : 's'}</span>
              {activeSource && <Badge variant="outline" className="max-w-56 truncate">Source: {activeSource.title}</Badge>}
              {activeConcept && <Badge variant="outline">Concept: {activeConcept.name}</Badge>}
              {exclusionCount > 0 && <Badge variant="outline">{exclusionCount} exclusion{exclusionCount === 1 ? '' : 's'}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              {(activeFilterCount > 0 || query) && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
              <Button type="button" variant="outline" size="sm" onClick={addVisibleRecords} disabled={!filtered.length || selectedKeys.length >= MAX_DESK_ITEMS}>Add visible</Button>
            </div>
          </div>
          <ScrollArea className="mt-3 h-[min(52vh,34rem)] overflow-hidden rounded-[var(--card-radius)] border border-border bg-card/25">
            <div className="divide-y divide-border">
              {visibleRecords.map((record) => {
                const active = selectedKeys.includes(record.key);
                const Icon = iconForNoesisView(viewForType[record.type]);
                return (
                  <div key={record.key} className={cn('grid grid-cols-[minmax(0,1fr)_2.5rem] items-stretch transition-colors', active && 'bg-accent/8')}>
                    <button
                      type="button"
                      onClick={() => toggleRecord(record)}
                      disabled={!active && selectedKeys.length >= MAX_DESK_ITEMS}
                      className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-45"
                      aria-pressed={active}
                    >
                      <span className="flex size-9 items-center justify-center text-muted-foreground"><Icon className="size-[18px]" aria-hidden="true" /></span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{record.label}</span><Badge variant="outline" className="text-label-sm uppercase">{record.type}</Badge></span>
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{record.summary}</span>
                        {formatRecordDate(sortBy === 'created' ? record.createdAt : record.updatedAt) && (
                          <span className="mt-1 block noesis-eyebrow text-muted-foreground">
                            {sortBy === 'created' ? 'Created' : 'Edited'} {formatRecordDate(sortBy === 'created' ? record.createdAt : record.updatedAt)}
                          </span>
                        )}
                      </span>
                      <span className={cn('mt-1 flex size-8 items-center justify-center rounded-[var(--button-radius)] border', active ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground')} aria-hidden="true">{active ? <Check className="size-4" /> : <Plus className="size-4" />}</span>
                    </button>
                    <Button type="button" variant="ghost" size="icon" className="my-2 size-9 self-start text-muted-foreground hover:text-destructive" onClick={() => excludeRecord(record)} aria-label={`Exclude ${record.label} from Context Desk`} title="Exclude from Context Desk"><X className="size-4" /></Button>
                  </div>
                );
              })}
              {!filtered.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No records match that search.</p>}
              {visibleRecords.length < filtered.length && <div className="p-3"><Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setVisibleLimit((limit) => limit + 100)}>Show more records</Button></div>}
            </div>
          </ScrollArea>
        </section>

        <section aria-labelledby="selected-context-heading" className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {/* What will be sent, what to check, and the run — kept at the top
              and still. As a sticky footer this panel slid under the cursor
              every time the selection changed length. */}
          <div className="space-y-3 rounded-[var(--card-radius)] border border-border bg-card/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">{selected.length} selected · {exclusionCount} exclusion{exclusionCount === 1 ? '' : 's'}</p>
              <Button ref={reviewButton} type="button" variant="secondary" tone="ai" size="sm" onClick={() => setReviewOpen(true)}>Review Context</Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              This request reads {analysisRecords.length} of {selected.length}. You choose where the finding lands when you accept it — the records themselves are never changed.
            </p>

            {/* What the desk is made of. A set drawn from one page rarely turns
                up a tension, and the count of kinds is what says so. */}
            {selected.length > 0 && (
              <div className="grid gap-1.5 border-t border-border/60 pt-3">
                <div className="flex h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-muted" aria-hidden="true">
                  {composition.counts.map(({ type, count }) => (
                    <span key={type} style={{ width: `${(count / composition.total) * 100}%`, background: `hsl(var(--kind-${type}))` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {composition.counts.map(({ type, count }) => (
                    <span key={type} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <i className="size-1.5 rounded-[2px]" style={{ background: `hsl(var(--kind-${type}))` }} aria-hidden="true" />
                      {contextTypeLabels[type as ContextRecordType]} {count}
                    </span>
                  ))}
                </div>
                <p className={cn('text-xs leading-5', composition.tone === 'thin' ? 'text-[hsl(var(--caution))]' : 'text-muted-foreground')}>
                  {composition.verdict}
                </p>
              </div>
            )}

            {/* What is missing, from links the workspace already holds. */}
            {bringIn.length > 0 && (
              <div className="grid gap-2 border-t border-border/60 pt-3">
                <p className="noesis-eyebrow noesis-eyebrow--sm">Bring in?</p>
                {bringIn.map((hit) => (
                  <div key={hit.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-[var(--radius-panel)] border border-dashed border-[hsl(var(--revise)/.5)] bg-[hsl(var(--revise)/.07)] px-3 py-2">
                    <i className="mt-1.5 size-1.5 rounded-full" style={{ background: `hsl(var(--kind-${hit.record.type}))` }} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-5">{hit.record.label}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{hit.why}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Bring ${hit.record.label} onto the desk`} onClick={() => toggleRecord(hit.record)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <AiUsageMeter className="border-t border-border/60 pt-3" owner={savedDeskOwner} refreshKey={usageKey} />

            <ContextualAiPanel
              actions={['review_selected_context']}
              enabled={aiSettings.aiAssistanceEnabled && selected.length > 0}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiDepthFor(aiSettings, 'context-desk')}
              reviewContextKey={contextDeskReviewKey(analysisRecords)}
              buttonLabel={selected.length ? 'Analyze next review' : 'Select context first'}
              promptLabel="What should Noesis examine across these records?"
              promptPlaceholder="For example: Where do these records contradict each other, and what should I investigate next?"
              buildEnvelope={buildEnvelope}
              acceptLabel={savingTo === 'work' ? 'Save as Work' : savingTo === 'experiment' ? 'Save experiment draft' : 'Save for review'}
              acceptDestination={<div className="mb-2 grid gap-2"><label className="grid gap-1 text-sm font-medium">
                Save reviewed text to
                <select value={savingTo} onChange={event => setSavingTo(event.target.value)} className="min-h-11 w-full rounded-md border border-border bg-background px-2">
                  <option value="work">New Work</option>
                  <option value="experiment">New experiment draft</option>
                  {analysisRecords.filter(isDeskFindingTarget).map(record => <option key={record.key} value={record.key}>{record.type === 'practice' ? 'Praxis' : record.type === 'position' ? 'Position' : 'Inquiry'}: {record.label}</option>)}
                </select>
              </label>
              {savingTo === 'experiment' && <div className="grid max-h-[25vh] gap-2 overflow-y-auto sm:grid-cols-2">
                {([['title', 'Experiment name'], ['action', 'What will you do?'], ['prediction', 'What do you expect?'], ['measure', 'What will you look for?']] as const).map(([field, label]) => (
                  <label key={field} className="grid gap-1 text-xs font-medium">{label}
                    <Input value={experiment[field]} maxLength={field === 'title' ? 160 : 600} onChange={event => setExperiment({ ...experiment, [field]: event.target.value })} />
                  </label>
                ))}
              </div>}
              </div>}
              onAccept={async (result, content) => {
                if (savingTo === 'experiment') {
                  if (Object.values(experiment).some(value => !value.trim())) throw new Error('Name the experiment and fill in its action, prediction, and signal.');
                  const id = deskExperimentId(result.reviewId);
                  await onSaveFinding({ type: 'practice', id }, result, content, analysisRecords, experiment);
                  onNavigate('labs', id);
                  return;
                }
                if (savingTo !== 'work') {
                  const target = analysisRecords.find(record => record.key === savingTo);
                  if (!target || !isDeskFindingTarget(target)) throw new Error('Choose a destination included in this review.');
                  await onSaveFinding(target, result, content, analysisRecords);
                  onNavigate(viewForType[target.type], target.id);
                  return;
                }
                const created = await onAddDraft(contextDeskWorkDraft(result, content, analysisRecords), { result, records: analysisRecords });
                setUsageKey((key) => key + 1);
                onNavigate('writing', created.id);
              }}
            />
            {!aiSettings.aiAssistanceEnabled && <p className="text-xs text-muted-foreground">Contextual assistance is disabled in Settings.</p>}
          </div>

          <div className="mt-6 flex items-end justify-between gap-3">
            <h2 id="selected-context-heading" className="text-lg font-semibold">Selected context</h2>
            {selected.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys([])}>Clear</Button>}
          </div>

          {/* The desk itself. Records are slips laid out on it, and the cut —
              where this request stops reading — is a line drawn across the
              surface rather than a sentence about one. Drag a slip over the
              line to put it in the request; the Plus button does the same
              thing from the keyboard. */}
          <div className="noesis-desk mt-4 min-h-36 overflow-hidden rounded-[var(--card-radius)] border border-border px-3">
            {selected.slice(0, memberLimit).map((record, index) => {
              const Icon = iconForNoesisView(viewForType[record.type]);
              const reads = index < MAX_CONTEXT_ITEMS;
              return (
                <Fragment key={record.key}>
                  {index === MAX_CONTEXT_ITEMS && (
                    <div className="noesis-desk__cut" role="separator" aria-label={`This request stops after ${MAX_CONTEXT_ITEMS} records`}>
                      <span>reads to here · {MAX_CONTEXT_ITEMS}</span>
                    </div>
                  )}
                  <div
                    draggable
                    onDragStart={(event) => { setDragKey(record.key); event.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOverKey(record.key); }}
                    onDragLeave={() => setOverKey((key) => key === record.key ? null : key)}
                    onDrop={(event) => { event.preventDefault(); if (dragKey) moveSelected(dragKey, record.key); setDragKey(null); setOverKey(null); }}
                    data-reads={reads || undefined}
                    data-dragging={dragKey === record.key || undefined}
                    data-over={overKey === record.key && dragKey !== record.key || undefined}
                    className="noesis-desk__slip grid grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_auto] items-start gap-2 py-3"
                  >
                    <GripVertical className="mt-1 size-4 cursor-grab text-muted-foreground/50 active:cursor-grabbing" aria-hidden="true" />
                    <Icon className="mt-1 size-4 text-muted-foreground" aria-hidden="true" />
                    <button type="button" className="min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onNavigate(viewForType[record.type], record.id, record.type === 'annotation' ? record.sourceIds[0] : undefined)}>
                      <span className="block text-sm font-medium leading-5 text-foreground">{record.label}</span>
                      <span className="mt-0.5 block text-label uppercase text-muted-foreground">{record.type}</span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{record.summary}</span>
                    </button>
                    <div className="flex items-start justify-end">
                    {!reads && <Button type="button" variant="ghost" size="icon" className="size-9" title="Send with next review" aria-label={`Move ${record.label} into this request`} onClick={() => setSelectedKeys(keys => [record.key, ...keys.filter(key => key !== record.key)])}><Plus className="size-4" /></Button>}
                    <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => toggleRecord(record)} aria-label={`Take ${record.label} off the desk`}><X className="size-4" /></Button>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {selected.length > memberLimit && <Button type="button" variant="outline" className="my-3" onClick={() => setMemberLimit(limit => limit + 40)}>Show more desk items</Button>}
            {!selected.length && <div className="flex min-h-36 items-center justify-center px-5 text-center text-sm leading-6 text-muted-foreground">The desk is clear. Add records from the left, then drag them into the order you want them read.</div>}
          </div>

          {staleSelectionCount > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 border-l-2 border-destructive/60 pl-3 text-xs leading-5 text-muted-foreground">
              <span>{staleSelectionCount} previously selected {staleSelectionCount === 1 ? 'record is' : 'records are'} no longer available and will not be sent.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(keys => keys.filter(key => recordsByKey.has(key)))}>Remove stale</Button>
            </div>
          )}
          {selectedKeys.length >= MAX_DESK_ITEMS && (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Selection limit reached. Remove an item before adding another; no unselected records will be included.</p>
          )}

        </section>
      </div>
      )}
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[min(84dvh,46rem)] max-w-2xl overflow-y-auto" onCloseAutoFocus={(event) => {
          if (!reviewButton.current?.isConnected) return;
          event.preventDefault();
          reviewButton.current.focus({ preventScroll: true });
        }}>
          <DialogHeader>
            <DialogTitle>Review Context</DialogTitle>
            <DialogDescription>Review the included records and exclusions. Opening or closing this preview sends nothing.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 sm:grid-cols-2">
            <section aria-labelledby="included-context-summary">
              <h3 id="included-context-summary" className="text-sm font-semibold">This request reads · {analysisRecords.length} of {selected.length}</h3>
              {/* What a Drawer holds and what one request reads are different
                  numbers. Say so here, and say which rule left the rest out. */}
              {selected.length > analysisRecords.length && (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  One request reads at most {MAX_CONTEXT_ITEMS} records. The {selected.length - analysisRecords.length} below the cut stay on the Desk and in any Drawer you save — reorder or deselect to change which ones go in.
                </p>
              )}
              <div className="mt-2 divide-y divide-border overflow-hidden rounded-[var(--card-radius)] border border-border px-3">
                {selectedGroups.map(({ type, records: group }) => (
                  <div key={type} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-3 font-medium">
                      <span>{contextTypeLabels[type]}</span><span className="font-code text-xs text-muted-foreground">{group.length}</span>
                    </div>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {group.map((record) => <li key={record.key} className="break-words">{record.label}</li>)}
                    </ul>
                  </div>
                ))}
                {!selected.length && <p className="py-4 text-sm text-muted-foreground">No records selected yet.</p>}
              </div>
            </section>
            <section aria-labelledby="excluded-context-summary">
              <h3 id="excluded-context-summary" className="text-sm font-semibold">Excluded · {excludedRecords.total} affected records</h3>
              {excludedRecords.total > 0 && (
                <dl className="mt-2 divide-y divide-border text-sm">
                  {[...excludedRecords.counts].map(([type, count]) => (
                    <div key={type} className="flex justify-between gap-3 py-2">
                      <dt>{contextTypeLabels[type]}</dt>
                      <dd className="font-code text-xs text-muted-foreground">{count}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <p>{excludedTypes.length} excluded item type{excludedTypes.length === 1 ? '' : 's'}</p>
                <p>{excludedSourceIds.length} excluded source{excludedSourceIds.length === 1 ? '' : 's'}</p>
                <p>{excludedKeys.length} individually excluded record{excludedKeys.length === 1 ? '' : 's'}</p>
              </div>
            </section>
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Back to selection</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
