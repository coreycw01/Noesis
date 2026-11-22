"use client";

import { ContextDrawers } from '@/components/ai/ContextDrawers';
import { AiUsageMeter } from '@/components/ai/AiUsageMeter';
import { ContextDrawerStack } from '@/components/ai/ContextDrawerStack';
import { ContextFolderStack } from '@/components/ai/ContextFolderStack';
import { deskComposition, deskSuggestions, proposeFromQuestion, type DeskItem } from '@/lib/context-desk-suggestions';
import { MAX_DESK_ITEMS, readDeskMembership } from '@/lib/saved-context-desks';
import { aiDepthFor } from '@/lib/ai-depth';
import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { contextDeskRecordIsExcluded, contextDeskReviewKey, contextDeskSourceIds, contextDeskStorageKeys, MAX_CONTEXT_ITEMS, normalizeContextDeskSelection, resolveDeskSelection } from '@/lib/context-desk-selection';
import { Check, Filter, FolderOpen, GripVertical, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { buildContextDeskMemory, CONTEXTUAL_AI_SUGGESTED_PROMPTS, type AiContextEnvelope, type ContextualAiAction } from '@/lib/contextual-ai';
import { contextDeskWorkDraft, type ContextDeskWorkOrigin } from '@/lib/context-desk-work';
import { deskExperimentId, isDeskFindingTarget, type DeskExperiment, type DeskFindingTarget } from '@/lib/context-desk-handoff';
import type { AiReviewResult } from '@/lib/contextual-ai';
import { EntityPicker } from '@/components/search/EntityPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { History, ScanSearch, Sparkles } from 'lucide-react';
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
  // Noesis AI holds three surfaces: a place to ask, the desk you build a
  // request on, and the record of what has already been run.
  const [surface, setSurface] = useState<'ask' | 'desk' | 'history'>('ask');
  /** The question, owned here so both Ask and the Desk show the same one. */
  const [question, setQuestion] = useState('');
  const [savingTo, setSavingTo] = useState('work');
  const [experiment, setExperiment] = useState<DeskExperiment>({ title: '', action: '', prediction: '', measure: '' });
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('noesis:ai-surface:v2');
      if (saved === 'ask' || saved === 'history' || saved === 'desk') setSurface(saved);
    } catch { /* View preference is optional. */ }
  }, []);
  const chooseSurface = (next: 'ask' | 'desk' | 'history') => {
    setSurface(next);
    try { window.localStorage.setItem('noesis:ai-surface:v2', next); } catch { /* View preference is optional. */ }
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
  /**
   * Narrowing the shelf by what a record is linked to. Only concepts and
   * positions: browsing by source is what the Library is for.
   */
  const [refine, setRefine] = useState<Array<{ relation: 'concept' | 'position'; value: string; mode: 'only' | 'not' }>>([]);
  useEffect(() => {
    // Changing the kind can retire a relationship; its chips go with it.
    setRefine((current) => current.filter((item) => (
      typeFilter === 'concept' ? false
        : item.relation === 'concept' || typeFilter === 'annotation' || typeFilter === 'practice'
    )));
  }, [typeFilter]);
  /**
   * Which relationships a kind can be narrowed by. An annotation fed a
   * position and a work did not, so the strip offers only what applies.
   */
  const refineRelations = useMemo<Array<'concept' | 'position'>>(() => {
    if (typeFilter === 'concept') return [];
    if (typeFilter === 'annotation' || typeFilter === 'practice') return ['concept', 'position'];
    return ['concept'];
  }, [typeFilter]);
  const positionTitleById = useMemo(() => new Map(positions.map((item) => [item.id, item.title])), [positions]);
  const refineLabel = (item: { relation: 'concept' | 'position'; value: string }) => {
    const name = item.relation === 'concept' ? conceptNameById.get(item.value) : positionTitleById.get(item.value);
    return (name || item.value).slice(0, 28);
  };
  /** Positions a record is tied to, for the "linked position" filter. */
  const positionsByRecordKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const position of positions) {
      const tags = (position.tags || []).map((tag) => tag.toLowerCase());
      for (const record of records) {
        if (record.type === 'position') { if (record.id === position.id) map.set(record.key, [position.id]); continue; }
        const shares = record.conceptTags.some((tag) => tags.includes(tag.toLowerCase()))
          || record.conceptIds.some((id) => tags.includes((conceptNameById.get(id) || '').toLowerCase()));
        if (shares) map.set(record.key, [...(map.get(record.key) || []), position.id]);
      }
    }
    return map;
  }, [conceptNameById, positions, records]);
  /** Does a record survive every refine chip? */
  const passesRefine = useCallback((record: ContextRecord) => refine.every((item) => {
    const linked = item.relation === 'concept'
      ? record.conceptIds.includes(item.value)
        || record.conceptTags.some((tag) => tag.toLowerCase() === (conceptNameById.get(item.value) || '').toLowerCase())
      : (positionsByRecordKey.get(record.key) || []).includes(item.value);
    return item.mode === 'only' ? linked : !linked;
  }), [conceptNameById, positionsByRecordKey, refine]);


  // Drawers live behind a panel so the Desk itself keeps the room it needs.
  const [drawersOpen, setDrawersOpen] = useState(false);
  /** Bumped after a review, so the usage meter re-reads rather than going stale. */
  const [usageKey, setUsageKey] = useState(0);
  /** Which drawer the desk came from, and what a folder carried in. */
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [carriedIn, setCarriedIn] = useState<Set<string>>(new Set());
  /** A record waiting to be put in a folder, chosen from its slip. */
  const [filingKey, setFilingKey] = useState<string | null>(null);
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
      .filter(passesRefine)
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
  }, [conceptFilter, conceptNameById, dateFilter, exclusionRules, passesRefine, query, records, sortBy, sourceFilter, typeFilter]);
  const visibleRecords = filtered.slice(0, visibleLimit);
  /** Ask offers matches when you search, and what you touched last otherwise. */
  const askCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const pool = normalized
      ? records.filter((record) => record.label.toLowerCase().includes(normalized))
      : [...records].sort((left, right) => dateValue(right.updatedAt) - dateValue(left.updatedAt));
    return pool.slice(0, 8);
  }, [query, records]);


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
  /** Records link to concepts by id or by tag; the rules need one of those. */
  const conceptIdByName = useMemo(
    () => new Map(concepts.map((concept) => [concept.name.toLowerCase(), concept.id])),
    [concepts],
  );
  const poolItems = useMemo<DeskItem[]>(() => records.map((record) => ({
    key: record.key, type: record.type, label: record.label,
    sourceIds: record.sourceIds,
    conceptIds: [...new Set([
      ...record.conceptIds,
      ...record.conceptTags.map((tag) => conceptIdByName.get(tag.toLowerCase())).filter((id): id is string => Boolean(id)),
    ])],
    open: record.type === 'inquiry'
      ? !/resolved|converted|no_longer_meaningful|archived/i.test(inquiryStatusByKey.get(record.key) || 'open')
      : undefined,
  })), [conceptIdByName, records, inquiryStatusByKey]);
  /**
   * What the question itself is asking for. This is the half of the work the
   * Desk makes you do by hand: name a concept and its open inquiries and the
   * positions arguing about it arrive with it, each saying why.
   */
  const proposed = useMemo(() => {
    const names = new Map(concepts.map((concept) => [concept.id, concept.name]));
    return proposeFromQuestion(question, poolItems, names)
      .map((hit) => ({ ...hit, record: recordsByKey.get(hit.key) }))
      .filter((hit): hit is typeof hit & { record: ContextRecord } => Boolean(hit.record))
      .filter((hit) => !selectedKeys.includes(hit.key));
  }, [concepts, poolItems, question, recordsByKey, selectedKeys]);

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
        title="Noesis AI"
        description={surface === 'history'
          ? 'Past runs, and what each one actually read. Reopening a run shows you the result; running it again is a separate step.'
          : surface === 'ask'
            ? 'Ask a question and pull in what it should read. For a set you want to build carefully, use the Context Desk.'
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
            label="Noesis AI views"
            items={[
              { id: 'ask', label: 'Ask Noesis', icon: Sparkles },
              { id: 'desk', label: 'Context Desk', icon: ScanSearch, count: selectedKeys.length || undefined },
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
      {surface === 'ask' && (
        /* Ask Noesis: the short way in. One question, a few records pulled from
           what you touched recently, and run. It shares the desk's selection,
           so this is the same request seen from the other end rather than a
           second place to keep context. */
        <div className="mx-auto grid w-full max-w-3xl gap-5 py-6">
          <div className="grid gap-3 rounded-[var(--card-radius)] border border-border bg-card p-5">
            <label htmlFor="ask-noesis" className="noesis-eyebrow">Your question</label>
            <Textarea
              id="ask-noesis"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What should Noesis examine across these records?"
              className="min-h-24 resize-y text-base leading-7"
            />
            <div className="flex flex-wrap gap-2">
              {CONTEXTUAL_AI_SUGGESTED_PROMPTS.review_selected_context.map((suggested) => (
                <Button key={suggested} type="button" variant="outline" size="sm" className="h-auto whitespace-normal rounded-[var(--radius-pill)] py-1 text-left text-xs" onClick={() => setQuestion(suggested)}>
                  {suggested}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[var(--card-radius)] border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="noesis-eyebrow">{question.trim() ? 'What it should read' : 'What it should read · ask something and Noesis will suggest'}</p>
              <span className="ml-auto noesis-figure noesis-figure--sm">{selected.length} on the desk · reads {analysisRecords.length}</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your records" className="h-10 pl-10" aria-label="Search your records" />
            </div>
            {/* What the question asks for comes first, each saying why. Recents
                are the fallback for a question that names nothing yet. */}
            {proposed.length > 0 && (
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="noesis-eyebrow noesis-eyebrow--sm">Noesis suggests</p>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs"
                    onClick={() => setSelectedKeys((current) => [...current, ...proposed.map((hit) => hit.key).filter((key) => !current.includes(key))])}>
                    Add all {proposed.length}
                  </Button>
                </div>
                {proposed.map((hit) => (
                  <div key={hit.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-[var(--radius-panel)] border border-dashed border-[hsl(var(--revise)/.5)] bg-[hsl(var(--revise)/.07)] px-3 py-2">
                    <i className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: `hsl(var(--kind-${hit.record.type}))` }} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-5">{hit.record.label}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{hit.why}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Add ${hit.record.label}`} onClick={() => toggleRecord(hit.record)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-1.5">
              <p className="text-xs leading-5 text-muted-foreground">
                {query.trim() ? 'Matching records' : proposed.length ? 'Or pick from recent' : 'Recently edited'}
              </p>
              {askCandidates.map((record) => {
                const active = selectedKeys.includes(record.key);
                return (
                  <button key={record.key} type="button"
                    className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius-panel)] border px-3 py-2 text-left',
                      active ? 'border-[hsl(var(--revise))] bg-[hsl(var(--revise)/.1)]' : 'border-border hover:border-[hsl(var(--revise)/.6)]')}
                    aria-pressed={active}
                    onClick={() => toggleRecord(record)}>
                    <span className="min-w-0">
                      <span className="block text-label uppercase" style={{ color: `hsl(var(--kind-${record.type}))` }}>{contextTypeLabels[record.type]}</span>
                      <span className="block truncate text-sm">{record.label}</span>
                    </span>
                    {active ? <Check className="size-4 text-[hsl(var(--revise))]" /> : <Plus className="size-4 text-muted-foreground" />}
                  </button>
                );
              })}
              {!askCandidates.length && <p className="py-4 text-center text-sm text-muted-foreground">Nothing matches that search.</p>}
            </div>
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => chooseSurface('desk')}>
              Build this carefully on the Context Desk →
            </Button>
          </div>

          <div className="grid gap-3 rounded-[var(--card-radius)] border border-border bg-card p-5">
            <AiUsageMeter owner={savedDeskOwner} refreshKey={usageKey} />
            <ContextualAiPanel
              actions={['review_selected_context']}
              enabled={aiSettings.aiAssistanceEnabled && selected.length > 0}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiDepthFor(aiSettings, 'context-desk')}
              reviewContextKey={contextDeskReviewKey(analysisRecords)}
              buttonLabel={selected.length ? 'Ask Noesis' : 'Add something to read first'}
              prompt={question}
              onPromptChange={setQuestion}
              buildEnvelope={buildEnvelope}
              onAccept={async (result, content) => {
                const created = await onAddDraft(contextDeskWorkDraft(result, content, analysisRecords), { result, records: analysisRecords });
                setUsageKey((key) => key + 1);
                onNavigate('writing', created.id);
              }}
            />
            {!aiSettings.aiAssistanceEnabled && <p className="text-xs text-muted-foreground">Contextual assistance is disabled in Settings.</p>}
          </div>
        </div>
      )}

      {surface === 'history' && <NoesisAiHistory items={aiHistory} onNavigate={onNavigate} />}
      {surface === 'desk' && (
      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* The cabinet: drawers above Find because choosing one scopes
            everything, folders below because they are what you reach for while
            already working. */}
        <section aria-labelledby="context-library-heading" className="min-w-0 space-y-5">
          <h2 id="context-library-heading" className="sr-only">Find records</h2>

          {/* Drawers and folders live in the account, so a review workspace sees
              the shelf they would sit on and the reason it is empty. */}
          {!savedDeskOwner && (
            <div className="grid gap-2">
              <p className="noesis-eyebrow">Drawers</p>
              <p className="text-xs leading-5 text-muted-foreground">Sign in to keep a desk as a drawer you can open again.</p>
            </div>
          )}
          {storageReady && savedDeskOwner && (
            <ContextDrawerStack
              uid={savedDeskOwner}
              openId={openDrawerId}
              membership={{ selected: selectedKeys, keys: excludedKeys, types: excludedTypes, sourceIds: excludedSourceIds }}
              onOpened={setOpenDrawerId}
              onOpen={(drawer) => {
                setSelectedKeys(drawer.selected); setExcludedKeys(drawer.keys);
                setExcludedTypes(drawer.types); setExcludedSourceIds(drawer.sourceIds);
                setMemberLimit(40); setCarriedIn(new Set());
              }}
            />
          )}

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <p className="noesis-eyebrow">Find</p>
              <span className="ml-auto noesis-figure noesis-figure--sm">{selectedKeys.length}/{MAX_DESK_ITEMS} on the desk</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your records" className="h-10 pl-10" aria-label="Search workspace records" />
            </div>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ContextRecordType | 'all')}>
              <SelectTrigger className="h-10 rounded-[var(--radius-panel)] bg-card text-sm" aria-label="Filter by item type"><SelectValue placeholder="All kinds" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {(Object.entries(contextTypeLabels) as Array<[ContextRecordType, string]>).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Narrow by what a record is linked to. Which relationships are on
                offer depends on the kind: an annotation fed a position, a work
                did not. Browsing by source is the Library's job, not the desk's. */}
            <div className="noesis-refine">
              <p className="noesis-eyebrow noesis-eyebrow--sm">
                {refineRelations.length
                  ? typeFilter === 'all' ? 'Refine by' : `Refine these ${contextTypeLabels[typeFilter].toLowerCase()} by`
                  : 'Nothing to refine by here'}
              </p>
              {refineRelations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {refineRelations.map((relation) => (
                    <Select key={relation} value="" onValueChange={(value) => { if (value) setRefine((current) => [...current, { relation, value, mode: 'only' }]); }}>
                      <SelectTrigger className="h-9 min-w-0 flex-1 basis-32 rounded-[var(--radius-panel)] bg-card text-xs" aria-label={relation === 'concept' ? 'On concept' : 'Linked position'}>
                        <SelectValue placeholder={relation === 'concept' ? 'On concept…' : 'Linked position…'} />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {(relation === 'concept' ? concepts.map((item) => ({ id: item.id, name: item.name })) : positions.map((item) => ({ id: item.id, name: item.title })))
                          .filter((option) => !refine.some((item) => item.relation === relation && item.value === option.id))
                          .map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ))}
                </div>
              )}
              {refine.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {refine.map((item, index) => (
                    <span key={`${item.relation}:${item.value}`} className="noesis-chip" data-mode={item.mode}>
                      <span>{item.mode === 'only' ? 'only' : 'not'} {refineLabel(item)}</span>
                      <button type="button" aria-label={`Switch to ${item.mode === 'only' ? 'excluding' : 'including'} ${refineLabel(item)}`}
                        onClick={() => setRefine((current) => current.map((entry, at) => at === index ? { ...entry, mode: entry.mode === 'only' ? 'not' : 'only' } : entry))}>
                        {item.mode === 'only' ? '↔ not' : '↔ only'}
                      </button>
                      <button type="button" aria-label="Remove this filter"
                        onClick={() => setRefine((current) => current.filter((_, at) => at !== index))}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {refineRelations.length > 0 && !refine.length && (
                <p className="text-xs leading-5 text-muted-foreground">Pick one above, then flip it between only and not.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="noesis-figure noesis-figure--sm">
                {filtered.length} of {records.length} records{refine.length ? ` · ${refine.length} filter${refine.length === 1 ? '' : 's'}` : ''}
              </span>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addVisibleRecords} disabled={!filtered.length || selectedKeys.length >= MAX_DESK_ITEMS}>Add visible</Button>
            </div>

            <ScrollArea className="h-[min(42vh,26rem)] overflow-hidden rounded-[var(--card-radius)] border border-border bg-card/25">
              <div className="divide-y divide-border/70 px-3">
                {visibleRecords.map((record) => {
                  const active = selectedKeys.includes(record.key);
                  return (
                    <div key={record.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="text-label uppercase" style={{ color: `hsl(var(--kind-${record.type}))` }}>{contextTypeLabels[record.type]}</p>
                        <p className="text-sm leading-5">{record.label}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="size-8" disabled={!active && selectedKeys.length >= MAX_DESK_ITEMS}
                        aria-label={active ? `Take ${record.label} off the desk` : `Add ${record.label} to the desk`}
                        onClick={() => toggleRecord(record)}>
                        {active ? <Check className="size-4" /> : <Plus className="size-4" />}
                      </Button>
                    </div>
                  );
                })}
                {!visibleRecords.length && <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches. Loosen a filter or flip one back to only.</p>}
              </div>
            </ScrollArea>
          </div>

          {!savedDeskOwner && (
            <div className="grid gap-2">
              <p className="noesis-eyebrow">Folders</p>
              <p className="text-xs leading-5 text-muted-foreground">Sign in to keep the handful of records you always reach for.</p>
            </div>
          )}
          {storageReady && savedDeskOwner && (
            <ContextFolderStack
              uid={savedDeskOwner}
              onDesk={selectedKeys}
              filing={filingKey}
              onFiled={() => setFilingKey(null)}
              onAdd={(keys) => { setSelectedKeys((current) => [...current, ...keys.filter((key) => !current.includes(key))]); setCarriedIn((current) => new Set([...current, ...keys])); }}
              onRemove={(keys) => { setSelectedKeys((current) => current.filter((key) => !keys.includes(key))); setCarriedIn((current) => { const next = new Set(current); keys.forEach((key) => next.delete(key)); return next; }); }}
            />
          )}
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

            {/* The same question Ask holds, so a request reads whole here too. */}
            <div className="grid gap-2 border-t border-border/60 pt-3">
              <label htmlFor="desk-question" className="noesis-eyebrow noesis-eyebrow--sm">The question</label>
              <Textarea id="desk-question" value={question} onChange={(event) => setQuestion(event.target.value)}
                placeholder="What should Noesis examine across these records?" className="min-h-16 resize-y text-sm leading-6" />
              <div className="flex flex-wrap gap-1.5">
                {CONTEXTUAL_AI_SUGGESTED_PROMPTS.review_selected_context.map((suggested) => (
                  <Button key={suggested} type="button" variant="outline" size="sm"
                    className="h-auto whitespace-normal rounded-[var(--radius-pill)] px-2.5 py-1 text-left text-xs"
                    onClick={() => setQuestion(suggested)}>{suggested}</Button>
                ))}
              </div>
            </div>

            <AiUsageMeter className="border-t border-border/60 pt-3" owner={savedDeskOwner} refreshKey={usageKey} />

            <ContextualAiPanel
              actions={['review_selected_context']}
              enabled={aiSettings.aiAssistanceEnabled && selected.length > 0}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiDepthFor(aiSettings, 'context-desk')}
              reviewContextKey={contextDeskReviewKey(analysisRecords)}
              buttonLabel={selected.length ? 'Analyze next review' : 'Select context first'}
              prompt={question}
              onPromptChange={setQuestion}
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
                    data-carried={carriedIn.has(record.key) || undefined}
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
                    <Button type="button" variant="ghost" size="icon" className="size-9" aria-pressed={filingKey === record.key}
                      title={`Keep ${record.label} in a folder`} aria-label={`Keep ${record.label} in a folder`}
                      onClick={() => setFilingKey((current) => current === record.key ? null : record.key)}>
                      <FolderOpen className={cn('size-4', filingKey === record.key && 'text-[hsl(var(--kind-concept))]')} />
                    </Button>
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
