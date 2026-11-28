
"use client";

import { markupTone } from '@/lib/markup-kinds';
import { iconForNoesisView, NOESIS_ICONS } from '@/lib/noesis-icons';
import { MarkupVoice } from '@/components/shared/MarkupVoice';
import { aiDepthFor } from '@/lib/ai-depth';
import React, { useEffect, useMemo, useState, useRef, useId } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronDown, Edit, Plus, Trash2, MessageSquare, Triangle, BookOpen, Link2, Clock, Pause, Play, Square, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSectionDisclosure } from '@/components/shared/SectionDisclosure';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AiSettings, Annotation, Concept, Media, MediaCapture, MediaStatus, MediaType, VaultEntry, Draft, Question, TimelineEvent, Practice, PhilosophicalLink, ReadingSession } from '@/lib/types';
import { MEDIA_LABELS, MEDIA_STATUS_LABELS, MEDIA_TYPES, MEDIA_ICONS_COMP, normalizeConceptTags, today, uid } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { StageBadge } from '@/components/shared/StageBadge';
import { useToast } from '@/hooks/use-toast';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { buildCatalogSummary } from '@/lib/source-intake';
import { DetailLabel, PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar, SortPill } from '@/components/shared/FilterToolbar';
import { COLLECTION_SORT_OPTIONS, sortCollection, type CollectionOrder } from '@/lib/collection-sort';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { ItemHistoryTrigger } from '@/components/shared/record/ItemWorkspace';
import { History } from '@/components/shared/record/RecordParts';
import { noesisUserError } from '@/lib/user-facing-errors';
import { searchMatches } from '@/lib/search';
import { ContextualAiDocument, ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { SourceSounding } from '@/components/Library/SourceSounding';
import { sourceJourney } from '@/lib/source-journey';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { readBrowserPreference, writeBrowserPreference } from '@/lib/browser-preferences';
import type { ContextualAiAction } from '@/lib/contextual-ai';
import { sourceReviewTarget, type SourceReviewApproval } from '@/lib/source-ai-review';
import { AiProvenanceBadge } from '@/components/ai/AiProvenanceBadge';
import { inquirySourceIds } from '@/lib/inquiry-state';
import { viewToPath } from '@/lib/noesis-routes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConceptDetailDialog } from '@/components/Concepts/ConceptDetailDialog';
import { ContextDeskFiling } from '@/components/ai/ContextDeskFiling';
import { sourceReflectionDeskKey } from '@/lib/context-desk-selection';
import { sourceConnections, type SourceConnection } from '@/lib/source-connections';
import { recentSourceSessionExcerpts, SOURCE_SESSION_REFLECTION_PROMPTS, sourceSessionDate, sourceSessionReflectionEntries, sourceSessionSeconds, stopSourceSession } from '@/lib/source-session';

const MarkupIcon = iconForNoesisView('annotations');
const SourcePagePhotos = dynamic(() => import('./SourcePagePhotos').then(m => m.SourcePagePhotos));
const MediaEditor = dynamic(() => import('./MediaEditor').then((module) => module.MediaEditor), {
  loading: () => <p role="status" className="sr-only">Opening source editor</p>,
});

interface MediaLibraryProps {
  /** Sub-view tabs rendered in the shared page header. */
  headerActions?: React.ReactNode;
  addSourceRequested?: boolean;
  onAddSourceRequestHandled?: () => void;
  media: Media[];
  concepts: Concept[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  onAddMedia: (data: Partial<Media>) => void | Promise<unknown>;
  onUpdateMedia: (media: Media, base?: Pick<Partial<Media>, 'dateUpdated'>, approval?: SourceReviewApproval) => void | Promise<unknown>;
  onAttachSourcePhoto: (sourceId: string, photo: import('@/lib/types').StoredAsset) => Promise<void>;
  onDeleteMedia: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onDeleteVaultEntry: (id: string) => Promise<void>;
  focusedSourceId?: string | null;
  onFocusedSourceHandled?: () => void;
  onOpenSourceRoute?: (id: string | null) => void;
  aiSettings?: AiSettings;
}

const statuses: MediaStatus[] = ['Want to Read', 'Consuming', 'Finished', 'Paused', 'Abandoned'];
const connectionLabels = { concept: 'Concept', position: 'Position', inquiry: 'Inquiry', work: 'Work', practice: 'Practice' } as const;
type LibraryViewFilter = 'all' | 'continue' | 'needs_intent' | 'needs_session' | 'needs_annotations' | 'awaiting_reflection' | 'inquiry_driven' | 'recently_added' | 'paused_or_abandoned' | 'influential';
type SourceWorkbenchStep = 'overview' | 'capture' | 'annotations' | 'connections' | 'history';
type ReflectionPhase = 'before' | 'sessions' | 'after';

const LIBRARY_VIEW_LABELS: Record<LibraryViewFilter, string> = {
  all: 'All Attention',
  continue: 'Continue',
  needs_intent: 'Needs Context',
  needs_session: 'Needs Session',
  needs_annotations: 'Needs Notes',
  awaiting_reflection: 'Needs Reflection',
  inquiry_driven: 'Connected to Inquiry',
  recently_added: 'Recently Added',
  paused_or_abandoned: 'Paused / Abandoned',
  influential: 'Linked to other records',
};

function sourceNeedsReflection(item: Media) {
  return item.status === 'Finished' && !item.capture?.after?.coreArgument && !item.capture?.after?.beliefChange;
}

function sourceEngagementVerb(type: MediaType) {
  if (['audiobook', 'podcast'].includes(type)) return 'listen to';
  if (['video', 'movie', 'documentary'].includes(type)) return 'watch';
  if (['course', 'lecture', 'interview', 'conversation'].includes(type)) return 'engage with';
  if (['book', 'article', 'paper'].includes(type)) return 'read';
  return 'explore';
}

function sourceWorkGaps(item: Media) {
  const gaps: string[] = [];
  if (!item.capture?.before?.reasonForAdding && !item.capture?.before?.openQuestion && !item.capture?.before?.affectedPosition) gaps.push('intent');
  if (['Consuming', 'Paused', 'Finished'].includes(item.status) && !(item.capture?.sessions || []).length) gaps.push('session');
  if (!(item.annotations || []).length) gaps.push('annotations');
  if (sourceNeedsReflection(item)) gaps.push('reflection');
  if (item.status === 'Finished' && !item.capture?.after?.nextAction) gaps.push('next action');
  return gaps;
}

function sourceNextAction(item: Media) {
  const gaps = sourceWorkGaps(item);
  if (gaps.includes('intent')) return 'Write why this source entered the system and what it might challenge.';
  if (gaps.includes('session')) return 'Start or record a consumption session so progress is not just a status label.';
  if (gaps.includes('annotations')) return 'Capture at least one highlight, thought, question, claim, or connection.';
  if (gaps.includes('reflection')) return 'Finish the post-source reflection: core argument and belief change.';
  if (gaps.includes('next action')) return 'Name what should happen next: inquiry, position, work, practice, or follow-up source.';
  return 'Continue using this source as evidence, context, or pressure for other objects.';
}

function sourceIsRecentlyAdded(item: Media) {
  const date = new Date(item.dateAdded || item.dateUpdated || '').getTime();
  return Number.isFinite(date) && Date.now() - date <= 1000 * 60 * 60 * 24 * 30;
}

function sourceInfluenceCount(item: Media, vault: VaultEntry[], drafts: Draft[], practices: Practice[], questions: Question[]) {
  return vault.filter((entry) => (entry.sourceIds || []).includes(item.id)).length +
    drafts.filter((draft) => (draft.sourceIds || []).includes(item.id)).length +
    practices.filter((practice) => (practice.sourceIds || []).includes(item.id)).length +
    questions.filter((question) => inquirySourceIds(question).includes(item.id)).length;
}

function formatDuration(totalSeconds = 0) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}


export function MediaLibrary({ 
  media, 
  concepts, 
  vault, 
  drafts,
  practices,
  questions,
  timeline,
  onAddMedia, 
  onUpdateMedia, 
  onAttachSourcePhoto,
  onDeleteMedia, 
  onAddConcept,
  onDeleteVaultEntry,
  focusedSourceId,
  onFocusedSourceHandled,
  onOpenSourceRoute,
  aiSettings,
  headerActions,
  addSourceRequested,
  onAddSourceRequestHandled,
}: MediaLibraryProps) {
  const pathname = usePathname();
  const [filter, setFilter] = usePersistentView<MediaType | 'all'>('noesis:library-type', 'all', ['all', ...MEDIA_TYPES]);
  const [statusFilter, setStatusFilter] = usePersistentView<MediaStatus | 'active' | 'all'>('noesis:library-status', 'all', ['all', 'active', ...statuses]);
  const [viewFilter, setViewFilter] = usePersistentView<LibraryViewFilter>('noesis:library-view-filter', 'all', Object.keys(LIBRARY_VIEW_LABELS) as LibraryViewFilter[]);
  const [searchQuery, setSearchQuery] = useState('');
  const [covers, setCovers] = usePersistentView('noesis:library-covers', 'shown', ['shown', 'hidden']);
  const [sourceOrder, setSourceOrder] = usePersistentView<CollectionOrder>('noesis:library-sort', 'newest', ['newest', 'oldest', 'name']);
  const [readingRoomOpen, setReadingRoomOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceWorkbenchStep, setSourceWorkbenchStep] = useState<SourceWorkbenchStep>('overview');
  const [markupSourceId, setMarkupSourceId] = useState<string | null>(null);
  // Another page (Annotations > New annotation) can ask a source to open on a given step.
  useEffect(() => {
    if (!focusedSourceId) return;
    const requested = readBrowserPreference('noesis:source-open-step', 'sessionStorage');
    if (requested !== 'annotations') return;
    writeBrowserPreference('noesis:source-open-step', '', 'sessionStorage');
    setSourceWorkbenchStep('annotations');
  }, [focusedSourceId]);
  const [engagementPhase, setEngagementPhase] = useState<ReflectionPhase>('before');
  const [editorOpen, setEditorOpen] = useState(Boolean(addSourceRequested));
  useEffect(() => {
    if (addSourceRequested) onAddSourceRequestHandled?.();
  }, [addSourceRequested, onAddSourceRequestHandled]);
  const [savingSource, setSavingSource] = useState(false);
  const sourceSaveRef = useRef(false);
  const [draft, setDraft] = useState<Partial<Media>>({ type: 'book', title: '', creator: '', status: 'Want to Read', tags: [] });
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [markupSelection, setMarkupSelection] = useState('');
  const [savingMark, setSavingMark] = useState(false);
  const markLock = useRef(false);
  const [conceptPopupName, setConceptPopupName] = useState<string | null>(null);
  const [savingSourceConcepts, setSavingSourceConcepts] = useState(false);
  const sourceConceptSaveLock = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'source'; item: Media } | { type: 'claim'; item: VaultEntry } | null>(null);
  const { toast } = useToast();

  const selected = media.find((item) => item.id === (onOpenSourceRoute ? focusedSourceId : selectedId)) || null;
  const selectedRef = useRef<Media | null>(selected);
  selectedRef.current = selected;
  const [beforeDraft, setBeforeDraft] = useState<MediaCapture['before']>();
  const [afterDraft, setAfterDraft] = useState<MediaCapture['after']>();
  const [savingPhase, setSavingPhase] = useState<'before' | 'after' | 'consumed' | null>(null);
  const [activeSession, setActiveSession] = useState<ReadingSession | null>(null);
  const sessionHeading = useRef<HTMLHeadingElement>(null);
  const focusSessionHeading = useRef(false);
  const [sessionTick, setSessionTick] = useState(0);
  const [sessionTargetMinutes, setSessionTargetMinutes] = useState('');
  const [sessionSection, setSessionSection] = useState('');
  const [sessionIntent, setSessionIntent] = useState('');
  const [reflectionSession, setReflectionSession] = useState<ReadingSession | null>(null);
  const [endSessionNotes, setEndSessionNotes] = useState('');
  const [endSessionReflection, setEndSessionReflection] = useState<NonNullable<ReadingSession['reflection']>>({});
  const [savingReflection, setSavingReflection] = useState(false);
  const reflectionLock = useRef(false);
  const [targetAlerted, setTargetAlerted] = useState(false);
  
  const filtered = useMemo(() => media.filter((item) => {
    const typeOk = filter === 'all' || item.type === filter;
    const activeOk = ['Want to Read', 'Consuming', 'Paused'].includes(item.status);
    const statusOk = statusFilter === 'all' || (statusFilter === 'active' ? activeOk : item.status === statusFilter);
    const inquiryDriven = questions.some((question) => inquirySourceIds(question).includes(item.id) && !['resolved', 'answered', 'archived', 'converted'].includes(question.status));
    const viewOk =
      viewFilter === 'all' ||
      (viewFilter === 'continue' && (item.status === 'Consuming' || item.status === 'Paused')) ||
      (viewFilter === 'needs_intent' && sourceWorkGaps(item).includes('intent')) ||
      (viewFilter === 'needs_session' && sourceWorkGaps(item).includes('session')) ||
      (viewFilter === 'needs_annotations' && sourceWorkGaps(item).includes('annotations')) ||
      (viewFilter === 'awaiting_reflection' && sourceNeedsReflection(item)) ||
      (viewFilter === 'inquiry_driven' && inquiryDriven) ||
      (viewFilter === 'recently_added' && sourceIsRecentlyAdded(item)) ||
      (viewFilter === 'paused_or_abandoned' && (item.status === 'Paused' || item.status === 'Abandoned')) ||
      (viewFilter === 'influential' && sourceInfluenceCount(item, vault, drafts, practices, questions) > 0);
    const linkedPositions = vault.filter((entry) => (entry.sourceIds || []).includes(item.id));
    const linkedWorks = drafts.filter((draft) => (draft.sourceIds || []).includes(item.id));
    const linkedPractices = practices.filter((practice) => (practice.sourceIds || []).includes(item.id));
    const linkedConcepts = concepts.filter((concept) => (item.tags || []).some((tag) => concept.name.toLowerCase() === tag.toLowerCase() || (concept.aliases || []).some((alias) => alias.toLowerCase() === tag.toLowerCase())));
    const searchOk = searchMatches(searchQuery, [
      { value: item.title, label: 'title' },
      { value: item.creator, label: 'creator' },
      { value: item.type, label: 'media type' },
      { value: item.status, label: 'status' },
      { value: item.description, label: 'description' },
      { value: item.catalogSummary, label: 'summary' },
      { value: item.sourceNotes, label: 'notes' },
      ...(item.tags || []).map((tag) => ({ value: tag, label: 'tag' })),
      ...linkedPositions.map((position) => ({ value: position.title, label: 'position' })),
      ...linkedWorks.map((work) => ({ value: work.title, label: 'work' })),
      ...linkedPractices.map((practice) => ({ value: practice.title, label: 'practice' })),
      ...linkedConcepts.map((concept) => ({ value: concept.name, label: 'concept' })),
    ]);
    return typeOk && statusOk && viewOk && searchOk;
  }), [filter, media, searchQuery, statusFilter, viewFilter, vault, drafts, practices, questions]);

  const libraryStats = useMemo(() => ({
    active: media.filter((item) => ['Want to Read', 'Consuming', 'Paused'].includes(item.status)).length,
    consuming: media.filter((item) => item.status === 'Consuming').length,
    annotations: media.reduce((sum, item) => sum + (item.annotations?.length || 0), 0),
    needsIntent: media.filter((item) => sourceWorkGaps(item).includes('intent')).length,
    needsSession: media.filter((item) => sourceWorkGaps(item).includes('session')).length,
    needsAnnotations: media.filter((item) => sourceWorkGaps(item).includes('annotations')).length,
    awaitingReflection: media.filter(sourceNeedsReflection).length,
    inquiryDriven: media.filter((item) => questions.some((question) => inquirySourceIds(question).includes(item.id) && !['resolved', 'answered', 'archived', 'converted'].includes(question.status))).length,
    influential: media.filter((item) => sourceInfluenceCount(item, vault, drafts, practices, questions) > 0).length,
  }), [media, questions, vault, drafts, practices]);

  const readingRoomQueue = useMemo(() => {
    const needsReflection = (item: Media) => item.status === 'Finished' && !item.capture?.after?.coreArgument && !item.capture?.after?.beliefChange;
    const hasActiveQuestion = (item: Media) => questions.some((question) => inquirySourceIds(question).includes(item.id) && !['resolved', 'answered', 'archived', 'converted'].includes(question.status));
    return {
      continueConsuming: media
        .filter((item) => item.status === 'Consuming' || item.status === 'Paused')
        .sort((a, b) => new Date(b.dateUpdated || b.dateAdded).getTime() - new Date(a.dateUpdated || a.dateAdded).getTime()),
      awaitingReflection: media.filter(needsReflection),
      inquiryDriven: media.filter(hasActiveQuestion),
      recentlyAdded: media
        .slice()
        .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()),
    };
  }, [media, questions]);

  const clearLibraryFilters = () => {
    setSearchQuery('');
    setFilter('all');
    setStatusFilter('all');
    setViewFilter('all');
  };

  const libraryFiltersActive = Boolean(searchQuery || filter !== 'all' || statusFilter !== 'all' || viewFilter !== 'all');

  useEffect(() => {
    if (onOpenSourceRoute) return;
    if (!focusedSourceId) {
      setSelectedId(null);
      return;
    }
    if (media.some((item) => item.id === focusedSourceId)) {
      setSelectedId(focusedSourceId);
      onFocusedSourceHandled?.();
    }
  }, [focusedSourceId, media, onFocusedSourceHandled, onOpenSourceRoute]);

  const openEditor = (item?: Media) => {
    setDraft(item ? { ...item } : { type: 'book', title: '', creator: '', status: 'Want to Read', tags: [] });
    setEditorOpen(true);
  };

  const saveMedia = async () => {
    if (!draft.title?.trim()) return;
    if (sourceSaveRef.current) return;
    sourceSaveRef.current = true;
    setSavingSource(true);
    try {
      if (draft.id) {
        await onUpdateMedia({ ...(draft as Media), title: draft.title.trim(), tags: normalizeConceptTags(draft.tags) }, { dateUpdated: draft.dateUpdated });
      } else {
        await onAddMedia({ ...draft, title: draft.title.trim(), tags: normalizeConceptTags(draft.tags), annotations: [], capture: { sessions: [] } });
      }
      setEditorOpen(false);
      toast({ title: draft.id ? 'Source updated' : 'Source added' });
    } catch (error) {
      toast({ title: 'Source not saved', description: noesisUserError(error, 'save this source'), variant: 'destructive' });
    } finally {
      sourceSaveRef.current = false;
      setSavingSource(false);
    }
  };

  const updateSelected = (patch: Partial<Media>, rejectOnError = false) => {
    const current = selectedRef.current;
    if (!current) return;
    const { aiSummary: _summary, aiReflection: _reflection, ...authoredAfter } = patch.capture?.after || {};
    const { aiSummary, aiReflection } = current.capture?.after || {};
    const capture = patch.capture && {
      ...patch.capture,
      after: { ...authoredAfter, ...(aiSummary !== undefined ? { aiSummary } : {}), ...(aiReflection !== undefined ? { aiReflection } : {}) },
    };
    return Promise.resolve(onUpdateMedia({ ...current, ...patch, ...(capture ? { capture } : {}), dateUpdated: today() }, capture || patch.pagePhotos ? { dateUpdated: current.dateUpdated } : undefined))
      .then(() => true)
      .catch((error) => {
        toast({ title: 'Source not saved', description: noesisUserError(error, 'save this source'), variant: 'destructive' });
        if (rejectOnError) throw error;
        return false;
      });
  };

  const saveSourceConcepts = async (tags: string[]) => {
    if (sourceConceptSaveLock.current) return false;
    sourceConceptSaveLock.current = true;
    setSavingSourceConcepts(true);
    try {
      return await updateSelected({ tags });
    } finally {
      sourceConceptSaveLock.current = false;
      setSavingSourceConcepts(false);
    }
  };

  useEffect(() => {
    setBeforeDraft(undefined);
    setAfterDraft(undefined);
    setEngagementPhase('before');
    setActiveSession(null);
    setSessionTargetMinutes('');
    setSessionSection('');
    setSessionIntent('');
    setReflectionSession(null);
  }, [selected?.id]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;
    const interval = window.setInterval(() => setSessionTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, [activeSession?.id, activeSession?.status]);

  const elapsed = sourceSessionSeconds(activeSession);

  useEffect(() => {
    if (!activeSession?.countdownTargetSeconds || activeSession.status !== 'active' || targetAlerted) return;
    if (elapsed >= activeSession.countdownTargetSeconds) {
      setTargetAlerted(true);
      toast({ title: 'Session target reached', description: 'Your session will keep counting until you end it.' });
    }
  }, [activeSession, elapsed, targetAlerted, toast]);

  const startSession = () => {
    if (!selected || activeSession) return;
    const target = Number(sessionTargetMinutes);
    setActiveSession({
      id: uid(),
      sourceId: selected.id,
      startedAt: today(),
      status: 'active',
      countdownTargetSeconds: Number.isFinite(target) && target >= 1 ? Math.min(1440, target) * 60 : 0,
      totalPausedSeconds: 0,
      ...(sessionSection.trim() && { section: sessionSection.trim() }),
      ...(sessionIntent.trim() && { intent: sessionIntent.trim() }),
      createdAt: today(),
      updatedAt: today(),
    });
    setTargetAlerted(false);
    setSessionTick(0);
  };

  const openSessionFromShortcut = () => {
    if (!activeSession) startSession();
    focusSessionHeading.current = true;
    setEngagementPhase('sessions');
    setSourceWorkbenchStep('capture');
  };

  useEffect(() => {
    if (focusSessionHeading.current && sourceWorkbenchStep === 'capture' && engagementPhase === 'sessions') {
      focusSessionHeading.current = false;
      sessionHeading.current?.focus();
    }
  }, [sourceWorkbenchStep, engagementPhase]);

  const pauseSession = () => {
    if (!activeSession || activeSession.status !== 'active') return;
    setActiveSession({ ...activeSession, status: 'paused', pauseStartedAt: today(), updatedAt: today() });
  };

  const resumeSession = () => {
    if (!activeSession || activeSession.status !== 'paused') return;
    const pausedFor = activeSession.pauseStartedAt ? Math.floor((Date.now() - new Date(activeSession.pauseStartedAt).getTime()) / 1000) : 0;
    setActiveSession({
      ...activeSession,
      status: 'active',
      pauseStartedAt: '',
      totalPausedSeconds: (activeSession.totalPausedSeconds || 0) + Math.max(0, pausedFor),
      updatedAt: today(),
    });
  };

  const openEndSession = () => {
    if (!activeSession) return;
    const stopped = stopSourceSession(activeSession);
    if (activeSession.status === 'active') setActiveSession({ ...activeSession, status: 'paused', pauseStartedAt: stopped.endedAt });
    openSessionReflection(stopped);
  };

  const openSessionReflection = (session: ReadingSession) => {
    setEndSessionNotes(session.notes || '');
    setEndSessionReflection(session.reflection || {});
    setReflectionSession(session);
  };

  const saveSession = async (skipReflection = false) => {
    const current = selectedRef.current;
    if (!current || !reflectionSession || reflectionLock.current) return;
    reflectionLock.current = true;
    setSavingReflection(true);
    try {
      const { reflection: _previousReflection, ...session } = reflectionSession;
      const entries = skipReflection ? [] : sourceSessionReflectionEntries(endSessionReflection);
      const completed: ReadingSession = {
        ...session,
        notes: skipReflection ? '' : endSessionNotes.trim(),
        ...(entries.length ? { reflection: Object.fromEntries(entries.map(({ key, value }) => [key, value])) } : {}),
        updatedAt: today(),
      };
      const capture = current.capture || { sessions: [] };
      const savedSessions = capture.sessions || [];
      const existing = savedSessions.some(session => session.id === completed.id);
      const sessions = existing ? savedSessions.map(session => session.id === completed.id ? completed : session) : [completed, ...savedSessions];
      const nextCapture = { ...capture, sessions };
      if (!await updateSelected({ capture: nextCapture })) return;
      if (selectedRef.current?.id !== current.id) return;
      if (activeSession?.id === completed.id) {
        setActiveSession(null);
        setSessionTargetMinutes('');
        setSessionSection('');
        setSessionIntent('');
      }
      setReflectionSession(null);
      toast({ title: existing ? 'Session reflection saved' : 'Session saved' });
    } finally { reflectionLock.current = false; setSavingReflection(false); }
  };

  const saveSourceReflection = async (phase: 'before' | 'after', markConsumed = false) => {
    const current = selectedRef.current;
    if (!current || reflectionLock.current) return;
    const pending = phase === 'before' ? beforeDraft : afterDraft;
    if (!pending && !markConsumed) return;
    const saved = current.capture || { sessions: [] };
    const capture = phase === 'before' && beforeDraft ? { ...saved, before: { ...saved.before, ...beforeDraft } }
      : phase === 'after' && afterDraft ? { ...saved, after: { ...saved.after, ...afterDraft } } : undefined;
    reflectionLock.current = true;
    setSavingPhase(markConsumed ? 'consumed' : phase);
    try {
      if (!await updateSelected({ ...(capture && { capture }), ...(markConsumed && { status: 'Finished' }) })) return;
      if (selectedRef.current?.id !== current.id) return;
      if (phase === 'before') setBeforeDraft(draft => draft === beforeDraft ? undefined : draft);
      else setAfterDraft(draft => draft === afterDraft ? undefined : draft);
      toast({ title: markConsumed ? 'Source marked consumed' : phase === 'before' ? 'Preparation saved' : 'Reflection saved' });
    } finally {
      reflectionLock.current = false;
      setSavingPhase(null);
    }
  };

  const openSelectedSource = (id: string) => {
    setSourceWorkbenchStep('overview');
    setSelectedId(id);
    onOpenSourceRoute?.(id);
  };

  const closeSelectedSource = () => {
    setSourceWorkbenchStep('overview');
    setSelectedId(null);
    onOpenSourceRoute?.(null);
  };

  useEffect(() => { setAnnotationDraft(''); setMarkupSelection(''); }, [selected?.id]);
  useEffect(() => {
    if (sourceWorkbenchStep === 'annotations' && selected?.id) setMarkupSourceId(selected.id);
    else setMarkupSourceId(previous => previous === selected?.id ? previous : null);
  }, [selected?.id, sourceWorkbenchStep]);

  const addAnnotation = async (kind: Annotation['type'] | 'evidence', text: string, clearDraft = false) => {
    if (!selected || !text.trim() || markLock.current) return;
    markLock.current = true;
    setSavingMark(true);
    try {
    const type = kind === 'evidence' ? 'excerpt' : kind;
    const passage = text.trim();
    const capturedAt = today();
    const annotation: Annotation = {
      id: uid(),
      type,
      ...(kind === 'evidence' ? { consequenceKind: 'evidence' as const } : {}),
      text: passage,
      date: capturedAt,
      ...(type === 'question' ? { marks: [{ id: uid(), start: 0, end: passage.length, kind: 'question', text: passage, date: capturedAt }] } : {}),
      conceptTags: selected.tags,
      philosophyStatus: type === 'question' ? 'questioned' : 'raw',
    };
    if (!await updateSelected({ annotations: [annotation, ...(selected.annotations || [])] })) return;
    if (selectedRef.current?.id === selected.id) {
      if (clearDraft) setAnnotationDraft(current => current === text ? '' : current);
      setMarkupSelection('');
    }
    } finally { markLock.current = false; setSavingMark(false); }
  };

  if (selected) {
    const connections = sourceConnections(selected, { concepts, positions: vault, inquiries: questions, works: drafts, practices });
    const highlights = connections.slice(0, 3);
    const reviewMode = /^\/(demo|review)(\/|$)/.test(pathname);
    const connectionHref = ({ kind, id }: SourceConnection) => {
      switch (kind) {
        case 'concept': return viewToPath('concepts', { reviewMode, conceptId: id });
        case 'position': return viewToPath('vault', { reviewMode, positionId: id });
        case 'inquiry': return viewToPath('questions', { reviewMode, questionId: id });
        case 'work': return viewToPath('writing', { reviewMode, workId: id });
        case 'practice': return viewToPath('labs', { reviewMode, practiceId: id });
      }
    };
    const capture = selected.capture || { sessions: [] };
    const before = { ...capture.before, ...beforeDraft };
    const after = { ...capture.after, ...afterDraft };
    const catalogSummary = selected.catalogSummary || buildCatalogSummary(selected.description);
    const sourcePurpose = capture.before?.reasonForAdding || capture.before?.openQuestion || capture.before?.expectation || selected.sourceNotes || 'This source still needs a clear reason for being studied.';
    
    return (
      <div className="noesis-source-detail noesis-gutter flex-1 w-full overflow-y-auto pb-28 pt-[var(--page-top)] font-body sm:pb-8" data-noesis-scroll-region data-noesis-identity="research-record">
        <header className="noesis-detail-toolbar">
          <button type="button" onClick={closeSelectedSource} className="noesis-back-link">
            <ArrowLeft aria-hidden="true" /> Library
          </button>
          <div className="noesis-record__top-actions">
            <Select value={selected.status} onValueChange={(value) => updateSelected({ status: value as MediaStatus })}>
              <SelectTrigger aria-label="Source status" className="h-9 w-32 min-w-0 rounded-md border-border/60 bg-card noesis-eyebrow noesis-eyebrow--sm shadow-sm sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className="noesis-eyebrow">{MEDIA_STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
            </Select>
            <ContextualAiPanel
            key={selected.id}
            itemHistory={selected.aiReviewHistory || []}
            actions={['summarize_source', 'extract_source_claims', 'propose_inquiry_prompts']}
            iconOnly
            enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
            showContextBeforeSending={aiSettings?.showContextBeforeSending}
            reasoningDepth={aiDepthFor(aiSettings, 'library')}
            buildEnvelope={(action: ContextualAiAction) => ({
              action,
              targetType: 'source',
              targetId: selected.id,
              scope: 'linked_items',
              itemMemory: [
                `Source: ${selected.title}${selected.creator ? ` by ${selected.creator}` : ''}`,
                `Description: ${selected.description || 'None.'}`,
                `Reason for engaging: ${selected.capture?.before?.reasonForAdding || 'Not recorded.'}`,
                `Question brought to the source: ${selected.capture?.before?.openQuestion || 'Not recorded.'}`,
                `Prior view: ${selected.capture?.before?.priorBeliefs || 'Not recorded.'}`,
                `Main idea: ${selected.capture?.after?.coreArgument || 'Not recorded.'}`,
                `Strongest point: ${selected.capture?.after?.strongestArgument || 'Not recorded.'}`,
                `Weakest point: ${selected.capture?.after?.weakestArgument || 'Not recorded.'}`,
                `What stays with me: ${selected.capture?.after?.lasting || 'Not recorded.'}`,
                `What remains open: ${selected.capture?.after?.remainsUnanswered || 'Not recorded.'}`,
                `How my view changed: ${selected.capture?.after?.beliefChange || 'Not recorded.'}`,
                ...recentSourceSessionExcerpts(selected.capture?.sessions),
                ...(selected.annotations || []).slice(0, 8).map((annotation) => `${annotation.type}: ${annotation.text}`),
              ],
              linkedMemory: [
                ...vault.filter((entry) => (entry.sourceIds || []).includes(selected.id)).slice(0, 6).map((entry) => `Position (${entry.confidence}% confidence): ${entry.statement || entry.title}; support: ${(entry.evidenceFor || []).length}; challenges: ${(entry.evidenceAgainst || []).length}`),
                ...questions.filter((question) => inquirySourceIds(question).includes(selected.id)).slice(0, 6).map((question) => `Inquiry: ${question.text}`),
              ],
            })}
            onAccept={async (result, text) => { await onUpdateMedia(selected, undefined, { result, text, baseline: selected }); }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Source actions" className="size-10"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openEditor(selected)}><Edit className="mr-2 size-4" /> Edit source</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteTarget({ type: 'source', item: selected })} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 size-4" /> Delete source</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-border/60 pb-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5 sm:rounded-lg sm:border sm:border-border/50 sm:bg-card sm:p-6 sm:shadow-sm">
          <div className="h-28 w-[5.25rem] shrink-0 overflow-hidden rounded-md border border-border/40 bg-accent/5 sm:row-span-3 sm:size-44 sm:rounded-lg">
            <SourceCover item={selected} eager />
          </div>
          <div className="min-w-0 flex-1 self-center sm:self-auto">
            <DetailLabel view="library" kind="Source" status={MEDIA_LABELS[selected.type]} />
            <h1 className="noesis-page-title noesis-detail-title mb-2 break-words sm:mb-3">{selected.title}</h1>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-body text-base italic text-muted-foreground sm:text-xl">{selected.creator || 'Unknown creator'}</span>
              {selected.year && <span className="noesis-figure font-bold tracking-widest text-muted-foreground sm:text-xs">{selected.year}</span>}
            </div>
          </div>
          <p className="col-span-2 max-w-3xl text-sm italic leading-6 text-foreground/75 sm:col-span-1 sm:col-start-2 sm:text-lg">
            {catalogSummary || 'No provider summary recorded yet.'}
          </p>
          <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-2">
            {(selected.tags || []).map(tag => (
              <button key={tag} type="button" onClick={() => setConceptPopupName(tag)} className="noesis-source-concept-pill min-h-9 max-w-full break-words px-3 py-1 noesis-eyebrow noesis-eyebrow--sm font-bold">
                {tag}
              </button>
            ))}
            <ConceptTagPicker key={selected.id} concepts={concepts} value={selected.tags || []} onChange={saveSourceConcepts}
              onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} triggerOnly
              triggerClassName="noesis-source-concept-pill min-h-9 border-solid" disabled={savingSourceConcepts} />
            <Badge variant="outline" className="min-h-9 border-border/60 bg-card px-3 noesis-eyebrow noesis-eyebrow--sm font-bold">
              {selected.annotations?.length || 0} notes
            </Badge>
          </div>
        </section>

        <Tabs value={sourceWorkbenchStep} onValueChange={(value) => setSourceWorkbenchStep(value as SourceWorkbenchStep)} className="w-full">
          <div className="mb-5 flex min-w-0 flex-wrap items-center gap-2">
            <TabsList aria-label="Source sections" className="flex h-auto w-fit max-w-full flex-wrap">
              {([['overview', 'Overview'], ['capture', 'Reflection'], ['annotations', 'Markup'], ['connections', 'Connections']] as const).map(([id, label]) => <TabsTrigger key={id} value={id}>{id === 'annotations' && <MarkupIcon className="mr-1.5 size-4" aria-hidden="true" />}{label}</TabsTrigger>)}
              <ItemHistoryTrigger />
            </TabsList>
            {(sourceWorkbenchStep !== 'capture' || engagementPhase !== 'sessions') && (
              <Button type="button" size="sm" variant="secondary" onClick={openSessionFromShortcut}>
                {activeSession ? <Clock aria-hidden="true" /> : <Play aria-hidden="true" />}
                {activeSession ? 'View session' : 'Start session'}
              </Button>
            )}
          </div>

          <TabsContent value="overview" className="space-y-5 sm:space-y-8">
            <AiAssistedHistory
              entries={selected.aiReviewHistory || []}
              onChange={async (aiReviewHistory) => { if (!await updateSelected({ aiReviewHistory })) throw new Error('Review history was not saved.'); }}
            />
            {selected.capture?.after?.aiSummary && (
              <Card className="noesis-workbench-panel">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="noesis-workbench-panel__eyebrow">SAVED SOURCE SUMMARY</div>
                  {selected.summaryProvenance
                    ? <AiProvenanceBadge provenance={selected.summaryProvenance} target={sourceReviewTarget(selected.id, 'aiSummary', selected.summaryProvenance.provenanceId)} title="Source summary" />
                    : <Badge variant="outline">AI-assisted</Badge>}
                </div>
                <ContextualAiDocument content={selected.capture.after.aiSummary} />
              </Card>
            )}
            {(selected.description || selected.sourceNotes) && (
              <Card className="noesis-workbench-panel">
                {selected.description && <div>
                  <div className="noesis-workbench-panel__eyebrow mb-2">SOURCE DESCRIPTION</div>
                  <p className="text-sm leading-7 text-foreground/85">{selected.description}</p>
                </div>}
                {selected.sourceNotes && <div className={cn(selected.description && 'mt-5 border-t border-border/40 pt-5')}>
                  <div className="noesis-workbench-panel__eyebrow mb-2">YOUR NOTES</div>
                  <p className="text-sm italic leading-7 text-foreground/85">{selected.sourceNotes}</p>
                </div>}
              </Card>
            )}
            {(() => {
              const rows: Array<[string, string | undefined, boolean]> = [
                ['Came for', capture.before?.openQuestion || capture.before?.reasonForAdding, false],
                ['Central idea, in your words', capture.after?.coreArgument, true],
                ['What changed', capture.after?.beliefChange || capture.after?.heldUp, false],
                ['Still open', capture.after?.remainsUnanswered, false],
              ];
              const filled = rows.filter((row) => row[1]?.trim());
              return (
                <SourceOverviewPanel title="Your thinking on this source">
                  {filled.length ? (
                    <dl className="grid gap-3">
                      {filled.map(([label, value, emphasis]) => (
                        <div key={label}>
                          <dt className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{label}</dt>
                          <dd className={cn('mt-0.5 text-foreground/90', emphasis && 'font-headline text-lg italic')}>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing recorded yet. <button type="button" className="font-medium text-accent underline underline-offset-4" onClick={() => setSourceWorkbenchStep('capture')}>Open Reflection</button> to note why you came, the central idea in your words, and what changed.</p>
                  )}
                </SourceOverviewPanel>
              );
            })()}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <SourceOverviewPanel title="Media summary">
                <div className="grid gap-1 text-sm">
                  {[
                    { label: 'Type', value: MEDIA_LABELS[selected.type] },
                    { label: 'Creator', value: selected.creator || selected.creators?.join(', ') || 'Unknown creator' },
                    { label: 'Year', value: selected.year || selected.dateAdded || 'No year recorded' },
                    { label: 'Publisher / Platform', value: selected.publisher || selected.platform || selected.sourceProvider || 'No publisher recorded' },
                    { label: 'Locator', value: selected.isbn || selected.doi || selected.url || selected.externalIds?.url || selected.externalIds?.doi || 'No locator recorded' },
                    { label: 'Status', value: MEDIA_STATUS_LABELS[selected.status] },
                  ].map((item) => (
                    <div key={item.label} className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-3 py-0.5">
                      <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{item.label}</span>
                      <span className="min-w-0 break-words text-foreground/85">{item.value}</span>
                    </div>
                  ))}
                </div>
              </SourceOverviewPanel>

              <SourceOverviewPanel title="Source purpose" description={sourcePurpose}>
                <p className="mt-4 text-sm leading-6 text-muted-foreground sm:mt-6">
                  Open <button type="button" className="font-medium text-accent underline underline-offset-4" onClick={() => setSourceWorkbenchStep('capture')}>Reflection</button> to record your purpose, sessions, and reflection.
                </p>
              </SourceOverviewPanel>
            </div>

            {/* sourceJourney() measured four fathoms of the reader's own work
                and nothing drew them. The sounding line asks the question a
                reader actually has — how far into this did I get — rather than
                scoring how much of it is finished. */}
            <SourceSounding
              className="mb-6"
              state={sourceJourney(selected, sourceInfluenceCount(selected, vault, drafts, practices, questions))}
            />

            <div className="noesis-source-connection-grid grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <SourceOverviewPanel title="Most important connections">
                {highlights.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {highlights.map(connection => {
                    const Icon = NOESIS_ICONS[connection.kind];
                    return <Link key={`${connection.kind}:${connection.id}`} href={connectionHref(connection)} data-tone={connection.kind} className="noesis-connection-card noesis-source-connection min-w-0 break-words hover:bg-muted">
                      <span className="flex items-center gap-1.5 !text-tone"><Icon className="size-4" aria-hidden="true" />{connectionLabels[connection.kind]}</span>
                      <b>{connection.label}</b>
                      <span>{connection.reason}</span>
                    </Link>;
                  })}
                </div> : <p className="text-sm text-muted-foreground">No connections recorded yet.</p>}
              </SourceOverviewPanel>

              <SourceOverviewPanel title="Current takeaway">
                <p className="font-body text-lg italic leading-7 text-foreground/85">
                  {capture.after?.lasting || capture.after?.coreArgument || 'No takeaway saved yet.'}
                </p>
                {capture.after?.remainsUnanswered && <p className="mt-4 text-sm leading-6 text-muted-foreground">{capture.after.remainsUnanswered}</p>}
              </SourceOverviewPanel>
            </div>
          </TabsContent>

          <TabsContent value="capture" className="space-y-8 sm:space-y-12">
            <WorkspaceTabs value={engagementPhase} onChange={setEngagementPhase} label="Engagement phase" variant="segmented" items={[
              { id: 'before', label: 'Before engaging' },
              { id: 'sessions', label: 'Sessions' },
              { id: 'after', label: 'After engaging' },
            ]} />

            <section hidden={engagementPhase !== 'before'}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-headline text-lg font-semibold">Before engaging</h3>
                <Button type="button" size="sm" disabled={!beforeDraft || !!savingPhase || savingReflection} onClick={() => void saveSourceReflection('before')}>{savingPhase === 'before' ? 'Saving...' : 'Save preparation'}</Button>
              </div>
              <div className="bg-muted/5 border border-border/30 rounded-xl overflow-hidden shadow-sm">
                <CaptureRow label="WHAT BROUGHT YOU HERE?" value={before?.reasonForAdding} placeholder={`What made you choose to ${sourceEngagementVerb(selected.type)} this source?`} onChange={(val) => setBeforeDraft(draft => ({ ...draft, reasonForAdding: val }))} />
                <CaptureRow label="WHAT DO YOU EXPECT?" value={before?.expectation} placeholder="What do you expect this source to argue, reveal, or help you notice?" onChange={(val) => setBeforeDraft(draft => ({ ...draft, expectation: val }))} />
                <CaptureRow label="WHAT QUESTION MAKES THIS WORTH YOUR ATTENTION?" value={before?.openQuestion} placeholder="Name the question you want to carry into this source." onChange={(val) => setBeforeDraft(draft => ({ ...draft, openQuestion: val }))} />
                <details className="border-t border-border/30 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">More context (optional)</summary>
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/30 bg-card">
                    <CaptureRow label="WHAT DO YOU CURRENTLY THINK?" value={before?.priorBeliefs} placeholder="Record your current view so you can recognize what changes." onChange={(val) => setBeforeDraft(draft => ({ ...draft, priorBeliefs: val }))} />
                    <CaptureRow label="POSITION THAT MAY CHANGE" value={before?.affectedPosition} placeholder="Which position could this complicate or strengthen?" onChange={(val) => setBeforeDraft(draft => ({ ...draft, affectedPosition: val }))} />
                    <CaptureRow label="WHAT WOULD COUNT AS VALUE?" value={before?.worthwhileIf} placeholder="What would make the time you give this source worthwhile?" onChange={(val) => setBeforeDraft(draft => ({ ...draft, worthwhileIf: val }))} />
                  </div>
                </details>
              </div>
            </section>

            <section hidden={engagementPhase !== 'sessions'}>
              <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <h3 ref={sessionHeading} tabIndex={-1} className="readex-kicker flex items-center gap-3 opacity-40 font-bold focus-visible:outline focus-visible:outline-ring">
                  <Plus className="size-2.5" /> SESSIONS
                </h3>
                {!activeSession && (
                  <Button type="button" onClick={startSession}>
                    <Play className="size-4" aria-hidden="true" />Start session
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                {!activeSession && (
                  <section className="noesis-record-instrument" data-tone="source" aria-label="Prepare for this session">
                    <h4 className="noesis-eyebrow font-bold text-tone">Prepare for this session</h4>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                      <label className="grid min-w-0 gap-1.5 text-sm">Section or chapter (optional)
                        <Input value={sessionSection} onChange={event => setSessionSection(event.target.value)} maxLength={160} placeholder="Whole source, or e.g. Chapter 3" />
                      </label>
                      <label className="grid min-w-0 gap-1.5 text-sm">Target minutes
                        <Input type="number" min={1} max={1440} value={sessionTargetMinutes} onChange={event => setSessionTargetMinutes(event.target.value)} placeholder="Optional" />
                      </label>
                    </div>
                    <label className="grid gap-1.5 text-sm">What do you want to pay attention to? (optional)
                      <Textarea value={sessionIntent} onChange={event => setSessionIntent(event.target.value)} maxLength={1500} rows={2} />
                    </label>
                  </section>
                )}
                {activeSession && (
                  <Card className="rounded-xl border-accent/25 bg-accent/[0.04] p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-full bg-card text-accent shadow-sm">
                          <Clock className="size-5" />
                        </div>
                        <div>
                          <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">
                            {activeSession.status === 'paused' ? 'Paused' : 'Session Active'}
                          </div>
                          <div className="font-headline text-3xl font-bold italic">{formatDuration(elapsed)}</div>
                          <p className="break-words text-sm">{activeSession.section || 'Whole source'}</p>
                          {!!activeSession.countdownTargetSeconds && (
                            <p className="text-xs italic text-muted-foreground">
                              Target {formatDuration(activeSession.countdownTargetSeconds)} {elapsed >= activeSession.countdownTargetSeconds ? 'reached' : 'remaining target active'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        {activeSession.status === 'paused' ? (
                          <Button onClick={resumeSession}><Play className="mr-2 size-4" /> Resume</Button>
                        ) : (
                          <Button variant="outline" onClick={pauseSession}><Pause className="mr-2 size-4" /> Pause</Button>
                        )}
                        <Button onClick={openEndSession}><Square className="size-4" aria-hidden="true" />Stop &amp; reflect</Button>
                      </div>
                    </div>
                  </Card>
                )}

                {(capture.sessions || []).length > 0 ? (
                  <div className="space-y-3">
                    {[...(capture.sessions || [])]
                      .sort((a, b) => (Date.parse(sourceSessionDate(b)) || 0) - (Date.parse(sourceSessionDate(a)) || 0))
                      .map((session) => (
                        <Card key={session.id} className="rounded-xl border-border/40 bg-card p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">
                                {new Date(session.endedAt || session.date || session.startedAt || today()).toLocaleDateString()}
                              </div>
                              <div className="mt-1 font-headline text-xl font-bold italic">{formatDuration(session.durationSeconds || 0)}</div>
                            </div>
                            <Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{session.status || 'completed'}</Badge>
                          </div>
                          <p className="mt-2 break-words font-medium">{session.section || 'Whole source'}</p>
                          {session.intent && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground"><strong>Preparation:</strong> {session.intent}</p>}
                          {sourceSessionReflectionEntries(session.reflection).map(({ key, label, value }) => (
                            <p key={key} className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground"><strong>{label}:</strong> {value}</p>
                          ))}
                          {session.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm italic leading-6 text-muted-foreground">{session.notes}</p>}
                          <Button variant="ghost" size="sm" onClick={() => openSessionReflection(session)}>{session.notes || sourceSessionReflectionEntries(session.reflection).length ? 'Edit reflection' : 'Add reflection'}</Button>
                        </Card>
                      ))}
                  </div>
                ) : !activeSession && (
                  <div className="bg-card border border-border/30 rounded-xl p-8 shadow-sm text-center">
                    <p className="font-body text-base text-muted-foreground italic">Start a session to trace real engagement with this source.</p>
                  </div>
                )}
              </div>
            </section>

            <section hidden={engagementPhase !== 'after'}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-headline text-lg font-semibold">After engaging</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" disabled={!afterDraft || !!savingPhase || savingReflection} onClick={() => void saveSourceReflection('after')}>{savingPhase === 'after' ? 'Saving...' : 'Save reflection'}</Button>
                  {selected.status === 'Finished' ? <Badge variant="outline">{MEDIA_STATUS_LABELS.Finished}</Badge> :
                    <Button type="button" size="sm" variant="outline" disabled={!!savingPhase || savingReflection} onClick={() => void saveSourceReflection('after', true)}>{savingPhase === 'consumed' ? 'Marking consumed...' : 'Mark consumed'}</Button>}
                </div>
              </div>
              <div className="bg-muted/5 border border-border/30 rounded-xl overflow-hidden shadow-sm">
                <CaptureRow label="WHAT IS THE CENTRAL IDEA IN YOUR OWN WORDS?" value={after?.coreArgument} placeholder="State what you think the source is actually saying." onChange={(val) => setAfterDraft(draft => ({ ...draft, coreArgument: val }))} />
                <CaptureRow label="WHAT STRENGTHENED, CHALLENGED, OR CHANGED YOUR THINKING?" value={after?.beliefChange} placeholder="Describe the movement in your thinking, even if your view did not fully change." onChange={(val) => setAfterDraft(draft => ({ ...draft, beliefChange: val }))} />
                <CaptureRow label="WHAT EVIDENCE, EXAMPLE, OR MOMENT MATTERED MOST?" value={after?.strongestArgument} placeholder="Record the specific part that carried the most intellectual weight." onChange={(val) => setAfterDraft(draft => ({ ...draft, strongestArgument: val }))} />
                <CaptureRow label="WHAT DID NOT HOLD UP FOR YOU?" value={after?.weakestArgument} placeholder="Name what seemed weak, unsupported, incomplete, or unconvincing." onChange={(val) => setAfterDraft(draft => ({ ...draft, weakestArgument: val }))} />
                <CaptureRow label="WHAT QUESTION REMAINS WORTH CARRYING FORWARD?" value={after?.remainsUnanswered} placeholder="Keep the uncertainty that still deserves attention." onChange={(val) => setAfterDraft(draft => ({ ...draft, remainsUnanswered: val }))} />
                <details className="border-t border-border/30 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">Go deeper (optional)</summary>
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/30 bg-card">
                    <CaptureRow label="WHAT WILL YOU CARRY FORWARD?" value={after?.lasting} placeholder="Name the idea, distinction, or question you expect to keep using." onChange={(val) => setAfterDraft(draft => ({ ...draft, lasting: val }))} />
                    <CaptureRow label="NEXT STEP" value={after?.nextAction} placeholder="What should you do with this next?" onChange={(val) => setAfterDraft(draft => ({ ...draft, nextAction: val }))} />
                  </div>
                </details>
              </div>
              <div className="mt-4 noesis-recommendation">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Source reflection</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Use your saved notes to surface what you learned, what changed, and what remains uncertain.</p>
                  </div>
                  <ContextualAiPanel
                    key={selected.id}
                    itemHistory={selected.aiReviewHistory || []}
                    actions={['reflect_on_source']}
                    showDeskFiling={false}
                    actionPromptLabel="How should Noesis review your notes on this source?"
                    enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
                    showContextBeforeSending={aiSettings?.showContextBeforeSending}
                    reasoningDepth={aiDepthFor(aiSettings, 'library')}
                    iconOnly
                    promptLabel="What do you want to understand about your response to this source?"
                    promptPlaceholder="For example: What tension keeps appearing in my notes, and what should I examine next?"
                    buildEnvelope={(_action, userPrompt) => ({
                      action: 'reflect_on_source',
                      targetType: 'source',
                      targetId: selected.id,
                      scope: 'linked_items',
                      itemMemory: [
                        `Source: ${selected.title}${selected.creator ? ` by ${selected.creator}` : ''}`,
                        `Reason for engaging: ${capture.before?.reasonForAdding || 'Not recorded.'}`,
                        `Question brought to the source: ${capture.before?.openQuestion || 'Not recorded.'}`,
                        `Prior view: ${capture.before?.priorBeliefs || 'Not recorded.'}`,
                        `Main idea: ${capture.after?.coreArgument || 'Not recorded.'}`,
                        `Strongest point: ${capture.after?.strongestArgument || 'Not recorded.'}`,
                        `Weakest point: ${capture.after?.weakestArgument || 'Not recorded.'}`,
                        `What stays with me: ${capture.after?.lasting || 'Not recorded.'}`,
                        `What remains open: ${capture.after?.remainsUnanswered || 'Not recorded.'}`,
                        `How my view changed: ${capture.after?.beliefChange || 'Not recorded.'}`,
                        ...recentSourceSessionExcerpts(capture.sessions),
                      ],
                      linkedMemory: [
                        ...(selected.annotations || []).slice(0, 8).map((annotation) => `${annotation.type}: ${annotation.text}`),
                        ...vault.filter((entry) => (entry.sourceIds || []).includes(selected.id)).slice(0, 4).map((entry) => `Linked position (${entry.confidence}% confidence): ${entry.statement || entry.title}`),
                        ...questions.filter((question) => inquirySourceIds(question).includes(selected.id)).slice(0, 4).map((question) => `Linked inquiry: ${question.text}`),
                      ],
                      userPrompt,
                    })}
                    onAccept={async (result, text) => { await onUpdateMedia(selected, undefined, { result, text, baseline: selected }); }}
                  />
                </div>
                {selected.capture?.after?.aiReflection && (
                  <div className="mt-4 space-y-3 border-t border-accent/15 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      {selected.reflectionProvenance
                        ? <AiProvenanceBadge provenance={selected.reflectionProvenance} target={sourceReviewTarget(selected.id, 'aiReflection', selected.reflectionProvenance.provenanceId)} title="Source reflection" />
                        : <Badge variant="outline">AI-assisted</Badge>}
                      <ContextDeskFiling recordKey={sourceReflectionDeskKey(selected.id)} label="File this reflection in Context Desk" />
                    </div>
                    <ContextualAiDocument content={selected.capture.after.aiReflection} />
                  </div>
                )}
              </div>
            </section>

          </TabsContent>

          {(sourceWorkbenchStep === 'annotations' || markupSourceId === selected.id) && (
          <TabsContent key={selected.id} value="annotations" forceMount className="data-[state=inactive]:hidden">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.55fr)]">
              <section className="min-w-0 space-y-4" aria-label="Passage">
                <SourcePagePhotos key={selected.id} sourceId={selected.id} photos={selected.pagePhotos || []} allowSave={!/^\/(demo|review)(\/|$)/.test(pathname)} allowAiCleanup={Boolean(aiSettings?.aiAssistanceEnabled) && !/^\/(demo|review)(\/|$)/.test(pathname)} onSave={async photo => {
                  const source = selectedRef.current;
                  if (!source || source.id !== selected.id) return false;
                  await onAttachSourcePhoto(source.id, photo);
                  return true;
                }} onText={text => { setMarkupSelection(''); setAnnotationDraft(prev => [prev.trim(), text].filter(Boolean).join('\n\n')); }} />
                <div>
                  <label htmlFor="source-markup-passage" className="mb-2 block text-sm font-medium">Passage or note</label>
                  <Textarea id="source-markup-passage" value={annotationDraft}
                    onSelect={event => { const node = event.currentTarget; setMarkupSelection(node.value.slice(node.selectionStart, node.selectionEnd).trim()); }}
                    onChange={event => { setMarkupSelection(''); setAnnotationDraft(event.target.value); }}
                    placeholder="Paste a passage, extract text from a photo, or write a note."
                    className="min-h-52 font-body text-base leading-7" />
                </div>
                {sourceWorkbenchStep === 'annotations' && <MarkupVoice key={selected.id} text={markupSelection || annotationDraft} onTranscript={words => { setMarkupSelection(''); setAnnotationDraft(prev => [prev.trimEnd(), words].filter(Boolean).join(' ')); }} />}
                <Button variant="outline" size="sm" onClick={() => void addAnnotation('thought', annotationDraft, true)} disabled={savingMark || !annotationDraft.trim()}>Save as note</Button>
              </section>

              <aside className="min-w-0 space-y-4 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" aria-label="Markup rail">
                <h3 className="flex items-center gap-2 text-sm font-medium"><MarkupIcon className="size-4" aria-hidden="true" />Marks</h3>
                {markupSelection && <div className="space-y-2 border-b border-border pb-4">
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm italic">“{markupSelection}”</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Mark the selected passage">
                    {(['highlight', 'evidence', 'question', 'claim', 'definition', 'objection', 'connection'] as const).map(type => (
                      <button key={type} type="button" data-stage-tone={markupTone(type)} className="noesis-mark-kind min-h-10 capitalize" disabled={savingMark} onClick={() => void addAnnotation(type, markupSelection)}>{type}</button>
                    ))}
                  </div>
                </div>}
                <div className="grid gap-2">
                  {(selected.annotations || []).map(annotation => (
                    <Link key={annotation.id} data-stage-tone={markupTone(annotation.consequenceKind || annotation.type)} href={viewToPath('annotations', { reviewMode: /^\/(demo|review)(\/|$)/.test(pathname), annotationSourceId: selected.id, annotationId: annotation.id })}
                      className="noesis-markup-entry block min-w-0 break-words py-2 pl-3 text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="noesis-markup-entry__kind block text-xs font-semibold capitalize">{(annotation.consequenceKind || annotation.type).replaceAll('_', ' ')}</span>
                      <span className="mt-1 block whitespace-pre-wrap">{annotation.text}</span>
                    </Link>
                  ))}
                </div>
              </aside>
            </div>
          </TabsContent>
          )}

          <TabsContent value="history">
            <History entries={[
              ...timeline.filter(event => event.entityType === 'media' && event.entityId === selected.id && event.eventType !== 'created')
                .map(event => ({ id: event.id, date: event.date, title: event.eventType.replace(/_/g, ' '), text: event.reason })),
              ...(selected.capture?.sessions || []).filter(session => session.status === 'completed' || session.status === 'abandoned')
                .map(session => ({ id: `session:${session.id}`, date: session.endedAt || session.date, title: session.status === 'completed' ? 'Session finished' : 'Session stopped', text: session.section })),
              ...(selected.dateAdded ? [{ id: 'added', date: selected.dateAdded, title: 'Source added', text: undefined }] : []),
            ].sort((a, b) => (b.date || '').localeCompare(a.date || ''))} empty="No source activity recorded yet." />
          </TabsContent>
          <TabsContent value="connections" className="space-y-8">
            <h3 className="readex-kicker font-bold text-muted-foreground">WHERE THIS SOURCE IS USED</h3>
            <div className="noesis-source-connection-grid grid gap-4 md:auto-rows-fr md:grid-cols-2">
              {([
                { kind: 'position', label: 'Positions', empty: 'No positions use this source.' },
                { kind: 'inquiry', label: 'Inquiries', empty: 'No inquiries are linked to this source.' },
                { kind: 'work', label: 'Works', empty: 'No works use this source.' },
                { kind: 'practice', label: 'Practices', empty: 'No practices test ideas from this source.' },
              ] as const).map(group => {
                const items = connections.filter(item => item.kind === group.kind);
                const Icon = NOESIS_ICONS[group.kind];
                return <Card key={group.label} data-tone={group.kind} className="noesis-workbench-panel noesis-source-connection min-w-0">
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm font-semibold text-tone">
                    <h4 className="flex items-center gap-2"><Icon className="size-4" aria-hidden="true" />{group.label}</h4><span className="tabular-nums">{items.length}</span>
                  </div>
                  {items.length ? (
                    <ul className="mt-2 max-h-64 divide-y divide-border/40 overflow-y-auto overscroll-contain text-sm leading-6 text-foreground/85">{items.map(item => <li key={item.id}><Link href={connectionHref(item)} className="block min-h-11 break-words py-3 hover:text-tone hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">{item.label}</Link></li>)}</ul>
                  ) : <p className="mt-3 text-sm leading-6 text-muted-foreground">{group.empty}</p>}
                </Card>;
              })}
            </div>
          </TabsContent>

        </Tabs>
        
        <ConceptDetailDialog 
          name={conceptPopupName} 
          onClose={() => setConceptPopupName(null)}
          concepts={concepts}
          media={media}
          vault={vault}
          drafts={drafts}
          practices={practices}
          questions={questions}
          timeline={timeline}
        />

        <Dialog open={Boolean(reflectionSession)} onOpenChange={open => { if (!open && !reflectionLock.current) setReflectionSession(null); }}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto border-none bg-card shadow-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl italic">Reflect on this session</DialogTitle>
              <DialogDescription className="break-words">{reflectionSession?.section || 'Whole source'} · {formatDuration(reflectionSession?.durationSeconds || 0)} active</DialogDescription>
              {reflectionSession?.intent && <p className="break-words text-sm text-muted-foreground">You wanted to pay attention to: {reflectionSession.intent}</p>}
            </DialogHeader>
            <fieldset disabled={savingReflection} className="grid min-w-0 gap-3 pt-2">
              <legend className="text-xs text-muted-foreground">All questions are optional.</legend>
              {SOURCE_SESSION_REFLECTION_PROMPTS.map(({ key, label }) => (
                <label key={key} className="grid gap-1.5 text-sm font-medium">
                  {label}
                  <Textarea value={endSessionReflection[key] ?? ''} maxLength={1000} rows={2}
                    onChange={event => setEndSessionReflection(draft => ({ ...draft, [key]: event.target.value }))} />
                </label>
              ))}
              {reflectionSession?.notes && <label className="grid gap-1.5 text-sm font-medium">
                Existing reflection notes
                <Textarea value={endSessionNotes} maxLength={4000} rows={3} onChange={event => setEndSessionNotes(event.target.value)} />
              </label>}
            </fieldset>
            <DialogFooter className="gap-2 pt-4">
              {reflectionSession?.id === activeSession?.id
                ? <Button variant="outline" disabled={savingReflection} onClick={() => void saveSession(true)}>Save without reflection</Button>
                : <Button variant="outline" disabled={savingReflection} onClick={() => setReflectionSession(null)}>Cancel</Button>}
              <Button disabled={savingReflection} onClick={() => void saveSession()}>{savingReflection ? 'Saving...' : 'Save reflection'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmActionDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title={deleteTarget?.type === 'source' ? 'Delete source?' : 'Delete extracted claim?'}
          description={
            deleteTarget?.type === 'source'
              ? `This removes "${deleteTarget.item.title}" from Library. Annotations and source-specific capture notes on this source will be deleted with it.`
              : `This removes "${deleteTarget?.item.title || 'this claim'}" from Positions. The parent source will remain.`
          }
          confirmLabel={deleteTarget?.type === 'source' ? 'Delete Source' : 'Delete Claim'}
          destructive
          onConfirm={async () => {
            if (!deleteTarget) return;
            const target = deleteTarget;
            setDeleteTarget(null);
            try {
              if (target.type === 'source') {
                onDeleteMedia(target.item.id);
                if (selectedId === target.item.id) closeSelectedSource();
              } else {
                await onDeleteVaultEntry(target.item.id);
                toast({ title: 'Extracted claim deleted.' });
              }
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Item could not be deleted',
                description: noesisUserError(error, 'delete this item'),
              });
            }
          }}
        />
        {editorOpen && <MediaEditor open onOpenChange={setEditorOpen} draft={draft} setDraft={setDraft} onSave={saveMedia} saving={savingSource} />}
      </div>
    );
  }

  return (
    <div className="noesis-page noesis-library-index" data-noesis-identity="research-library">
      <PageHeader
        title="Library"
        description="Engage actively, capture what matters, and trace what each source changes."
        meta={
          <span className="noesis-eyebrow text-muted-foreground/60">
            {media.length} sources · {libraryStats.consuming} in progress · {libraryStats.annotations} annotations
          </span>
        }
        actions={
          <>
          {headerActions}
          <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 h-9 px-6 shadow-md shadow-accent/20 rounded-full font-bold">
            <Plus className="size-4 mr-1.5" /> Add Source
          </Button>
          </>
        }
      />

      <FilterToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search active sources..."
        resultCount={filtered.length}
        resultLabel="sources"
        onClear={clearLibraryFilters}
        clearDisabled={!libraryFiltersActive}
        sortControl={<SortPill label="Sort sources" value={sourceOrder} onChange={setSourceOrder} options={COLLECTION_SORT_OPTIONS} />}
        viewControl={<Button type="button" variant="outline" size="sm" aria-pressed={covers === 'shown'} onClick={() => setCovers(covers === 'shown' ? 'hidden' : 'shown')}>Covers</Button>}
        className="mb-6"
      >
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as LibraryViewFilter)}>
          <SelectTrigger aria-label="Library attention filter" className="w-56 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Attention" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LIBRARY_VIEW_LABELS) as LibraryViewFilter[]).map((value) => (
              <SelectItem key={value} value={value} className="noesis-eyebrow">{LIBRARY_VIEW_LABELS[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MediaStatus | 'active' | 'all')}>
          <SelectTrigger aria-label="Filter by source status" className="w-48 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="noesis-eyebrow">Status: All</SelectItem>
            <SelectItem value="active" className="noesis-eyebrow">In Progress</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status} className="noesis-eyebrow">{MEDIA_STATUS_LABELS[status]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(value) => setFilter(value as MediaType | 'all')}>
          <SelectTrigger aria-label="Filter by source type" className="w-48 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="noesis-eyebrow">Type: All</SelectItem>
            {MEDIA_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="noesis-eyebrow">{MEDIA_LABELS[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterToolbar>

      <section className="mb-6 rounded-xl border border-border/50 bg-card/70 shadow-sm">
        <button
          type="button"
          onClick={() => setReadingRoomOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
          aria-expanded={readingRoomOpen}
        >
          <div>
            <div className="noesis-eyebrow text-muted-foreground">Source activity</div>
            <p className="mt-1 text-xs text-muted-foreground">Continue, reflect, or develop active source threads.</p>
          </div>
          <span className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full">{readingRoomQueue.continueConsuming.length} to continue</Badge>
            <ChevronDown className={cn('size-4 transition-transform', readingRoomOpen && 'rotate-180')} />
          </span>
        </button>
        {readingRoomOpen && <div className="grid gap-3 border-t border-border/50 p-4 md:grid-cols-2 2xl:grid-cols-4">
          {[
            { label: 'Continue', action: 'Continue', items: readingRoomQueue.continueConsuming, empty: '0 active sources' },
            { label: 'Reflect', action: 'Reflect', items: readingRoomQueue.awaitingReflection, empty: '0 waiting' },
            { label: 'Develop', action: 'Develop', items: readingRoomQueue.inquiryDriven, empty: '0 inquiry-linked' },
            { label: 'Recent', action: 'Open', items: readingRoomQueue.recentlyAdded, empty: '0 recent' },
          ].map((column) => (
            <div key={column.label} className="rounded-xl border border-border/40 bg-background/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground/60 font-bold">
                  {column.label} - {column.items.length}
                </div>
                {column.items.length > 2 && (
                  <button type="button" onClick={() => setViewFilter(column.label === 'Reflect' ? 'awaiting_reflection' : column.label === 'Develop' ? 'inquiry_driven' : column.label === 'Recent' ? 'recently_added' : 'continue')} className="noesis-eyebrow noesis-eyebrow--sm text-accent">
                    View all {column.items.length}
                  </button>
                )}
              </div>
              {column.items.length ? (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1">
                  {column.items.slice(0, 2).map((item) => (
                    <button
                      key={`${column.label}-${item.id}`}
                      type="button"
                      onClick={() => openSelectedSource(item.id)}
                      className="w-full rounded-lg border border-border/40 bg-card px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
                    >
                      <div className="line-clamp-1 text-sm font-medium leading-5 text-foreground/85">{item.title}</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">{item.creator || MEDIA_LABELS[item.type]}</span>
                        <span className="noesis-eyebrow noesis-eyebrow--sm text-accent">{column.action}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/40 bg-card/60 px-3 py-2 text-xs leading-5 text-muted-foreground">{column.empty}</p>
              )}
            </div>
          ))}
        </div>}
      </section>

      <div className={covers === 'shown' ? 'grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}>
        {sortCollection(filtered, sourceOrder, item => item.title, item => item.dateUpdated || item.dateAdded).map((item) => {
          const influence = sourceInfluenceCount(item, vault, drafts, practices, questions);
          return (
          <Card
            key={item.id}
            className={covers === 'shown' ? 'group relative border-none bg-transparent shadow-none' : 'group relative min-w-0 border border-border bg-card p-3'}
          >
            {covers === 'shown' && <div className="aspect-[4/5] overflow-hidden rounded-lg border border-border/30 bg-card shadow-sm mb-3 transition-all group-hover:-translate-y-1 group-hover:shadow-lg">
              <SourceCover item={item} />
            </div>}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <div className="readex-kicker text-muted-foreground font-bold text-label-sm">{MEDIA_LABELS[item.type].toUpperCase()}</div>
              </div>
              <h2 className="font-headline text-base font-bold italic leading-snug text-foreground transition-colors group-hover:text-accent">
                <button type="button" onClick={() => openSelectedSource(item.id)} className="line-clamp-2 text-left outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring">{item.title}</button>
              </h2>
              <p className="readex-kicker text-muted-foreground truncate text-label-sm font-bold tracking-widest">{item.creator.toUpperCase()}</p>
              {!!item.tags?.length && <div className="flex flex-wrap gap-1">{item.tags.slice(0, 3).map(tag => <Badge key={tag} tone="concept">{tag}</Badge>)}</div>}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap gap-1"><Badge>{MEDIA_STATUS_LABELS[item.status]}</Badge><StageBadge type="source" stage={item.stage} status={item.status} /></div>
                <div className="flex items-center gap-3 text-muted-foreground/70">
                  {item.annotations?.length > 0 && <span className="flex items-center gap-1" title={`${item.annotations.length} annotations`} aria-label={`${item.annotations.length} annotations`}><MessageSquare className="size-3.5" /><span className="noesis-figure noesis-figure--sm font-bold">{item.annotations.length}</span></span>}
                  {influence > 0 && <span className="flex items-center gap-1" title={`${influence} connected objects`} aria-label={`${influence} connected objects`}><Link2 className="size-3.5" /><span className="noesis-figure noesis-figure--sm font-bold">{influence}</span></span>}
                </div>
              </div>
            </div>
          </Card>
          );
        })}

        {covers === 'shown' && filtered.length > 0 && <button type="button"
          className="aspect-[2/3] rounded-xl border-2 border-dashed border-border/50 bg-card/50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-card transition-all group shadow-sm hover:shadow-xl hover:-translate-y-2"
          onClick={() => openEditor()}
        >
          <div className="size-12 rounded-full bg-card flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md border border-border/30">
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <span className="readex-kicker text-muted-foreground font-bold text-label">Add source</span>
        </button>}

        {filtered.length === 0 && (
          <div className="col-span-full">
            <PageEmptyState
              icon={BookOpen}
              title="No active sources found"
              description="Library is for sources you are actively capturing or reflecting on. Clear filters or add a new source to begin."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {libraryFiltersActive && <Button variant="outline" onClick={clearLibraryFilters}>Clear filters</Button>}
                  <Button onClick={() => openEditor()} className="rounded-full"><Plus className="mr-1.5 size-4" /> Add source</Button>
                </div>
              }
            />
          </div>
        )}
      </div>

      {editorOpen && <MediaEditor open onOpenChange={setEditorOpen} draft={draft} setDraft={setDraft} onSave={saveMedia} saving={savingSource} />}
    </div>
  );
}

function SourceOverviewPanel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const { toggle, body } = useSectionDisclosure(title);
  return <Card className="noesis-workbench-panel self-start">
    <div className="flex items-center justify-between gap-2">
      <h3 className="noesis-workbench-panel__eyebrow">{title}</h3>
      {toggle}
    </div>
    {description && <p className="font-headline text-xl italic leading-snug text-primary/90 sm:text-2xl">{description}</p>}
    <div {...body} className="pt-2">{children}</div>
  </Card>;
}

function SourceCover({ item, eager = false }: { item: Media; eager?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = item.thumbnailUrl;
  if (url && failedUrl !== url) {
    return <img src={url} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover" onError={() => setFailedUrl(url)} />;
  }

  // Prototype cover: a cloth-bound spine in a hue taken from the title.
  const hue = Array.from(item.title || '').reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7);
  return (
    <div className="noesis-proto-cover" style={{ '--h': hue } as React.CSSProperties}>
      <div className="line-clamp-4 font-headline text-base font-semibold italic leading-tight">{item.title}</div>
      <div className="noesis-eyebrow noesis-eyebrow--sm opacity-80">{item.creator || MEDIA_LABELS[item.type]}</div>
    </div>
  );
}

function SourceStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-2 text-right shadow-sm">
      <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground/60">{label}</div>
      <div className="font-headline text-xl font-bold italic leading-none text-primary">{value}</div>
    </div>
  );
}

function SourceLane({ label, value, description, active, onClick }: { label: string; value: number; description: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        active ? "border-accent/50 bg-accent/10 ring-2 ring-accent/15" : "border-border/50 bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground/60">{label}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="font-headline text-3xl font-bold italic leading-none text-primary">{value}</div>
      </div>
    </button>
  );
}

function CaptureRow({ label, value, placeholder, onChange }: { label: string; value?: string; placeholder: string; onChange: (val: string) => void }) {
  const inputId = useId();
  return (
    <div className="flex min-w-0 flex-col border-b border-border/30 bg-card last:border-b-0 sm:grid sm:min-h-[92px] sm:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)] sm:items-stretch">
      <div className="px-4 pb-0 pt-4 sm:flex sm:items-start sm:px-6 sm:py-5">
        <Label htmlFor={inputId} className="text-sm font-medium leading-6 text-foreground">{label.charAt(0) + label.slice(1).toLocaleLowerCase()}</Label>
      </div>
      <div className="flex min-w-0 flex-1 items-stretch">
        <Textarea 
          id={inputId}
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[112px] w-full resize-y rounded-none border-0 bg-transparent px-4 py-3 font-body text-base leading-7 text-primary/90 shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0 sm:min-h-[92px] sm:px-6 sm:py-5"
        />
      </div>
    </div>
  );
}
