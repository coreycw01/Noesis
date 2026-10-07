
"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ArrowLeft, ChevronDown, Edit, Plus, Search, Trash2, MessageSquare, X, Loader2, Triangle, BookOpen, FileText, Check, Globe, Link2, Clock, Pause, Play, Square, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import type { AiSettings, Annotation, Concept, Media, MediaStatus, MediaType, VaultEntry, Draft, Question, TimelineEvent, Practice, PhilosophicalLink, ReadingSession } from '@/lib/types';
import { MEDIA_LABELS, MEDIA_STATUS_LABELS, MEDIA_TYPES, MEDIA_ICONS_COMP, normalizeConceptTags, today, uid, conceptKey, conceptRelated } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sourceResultToMediaPatch, type NormalizedSourceResult } from '@/lib/source-intake';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { noesisUserError } from '@/lib/user-facing-errors';
import { searchMatches } from '@/lib/search';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import type { ContextualAiAction } from '@/lib/contextual-ai';
import { inquirySourceIds } from '@/lib/inquiry-state';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MediaLibraryProps {
  media: Media[];
  concepts: Concept[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  onAddMedia: (data: Partial<Media>) => void;
  onUpdateMedia: (media: Media) => void;
  onDeleteMedia: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateClaim: (data: { title: string; body: string; tags: string[]; sourceIds: string[] }) => void;
  onDeleteVaultEntry: (id: string) => Promise<void>;
  focusedSourceId?: string | null;
  onFocusedSourceHandled?: () => void;
  onOpenSourceRoute?: (id: string | null) => void;
  aiSettings?: AiSettings;
}

const statuses: MediaStatus[] = ['Want to Read', 'Consuming', 'Finished', 'Paused', 'Abandoned'];
type LibraryViewFilter = 'all' | 'continue' | 'needs_intent' | 'needs_session' | 'needs_annotations' | 'awaiting_reflection' | 'inquiry_driven' | 'recently_added' | 'paused_or_abandoned' | 'influential';

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
  influential: 'Influential',
};

const LIBRARY_VIEW_STORAGE_KEY = 'noesis:library-view-filter';

function sourceNeedsReflection(item: Media) {
  return item.status === 'Finished' && !item.capture?.after?.coreArgument && !item.capture?.after?.beliefChange;
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

function generatedListItems(content: string, maxItems = 8) {
  const lines = content
    .split(/\n+|(?<=\?)\s+(?=[A-Z])/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 3 && !/^(claims?|questions?|inquiry prompts?)\s*:?s*$/i.test(line));
  return Array.from(new Set(lines.length ? lines : [content.trim()])).slice(0, maxItems);
}

const TYPE_TERMINOLOGY: Record<MediaType, { creator: string; publisher: string; genre: string; identifier: string }> = {
  book: { creator: 'Author', publisher: 'Publisher', genre: 'Genre', identifier: 'ISBN' },
  audiobook: { creator: 'Author/Narrator', publisher: 'Publisher', genre: 'Genre', identifier: 'ISBN' },
  podcast: { creator: 'Host', publisher: 'Platform', genre: 'Topic', identifier: 'Feed URL' },
  video: { creator: 'Creator/Channel', publisher: 'Platform', genre: 'Topic', identifier: 'Video URL' },
  movie: { creator: 'Director', publisher: 'Studio', genre: 'Genre', identifier: 'IMDb ID' },
  article: { creator: 'Author', publisher: 'Publication', genre: 'Topic', identifier: 'Article URL' },
  course: { creator: 'Instructor', publisher: 'Institution', genre: 'Subject', identifier: 'Course URL' },
  lecture: { creator: 'Speaker', publisher: 'Institution', genre: 'Subject', identifier: 'Event/URL' },
  documentary: { creator: 'Director', publisher: 'Production', genre: 'Subject', identifier: 'IMDb ID' },
  interview: { creator: 'Participants', publisher: 'Host/Event', genre: 'Topic', identifier: 'URL' },
  conversation: { creator: 'Participants', publisher: 'Context', genre: 'Topic', identifier: 'Date/URL' },
  paper: { creator: 'Authors', publisher: 'Journal/Conference', genre: 'Field of Study', identifier: 'DOI' },
  other: { creator: 'Creator', publisher: 'Publisher', genre: 'Genre', identifier: 'Identifier' },
};

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
  onDeleteMedia, 
  onAddConcept,
  onCreateClaim,
  onDeleteVaultEntry,
  focusedSourceId,
  onFocusedSourceHandled,
  onOpenSourceRoute,
  aiSettings,
}: MediaLibraryProps) {
  const [filter, setFilter] = useState<MediaType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<MediaStatus | 'active' | 'all'>('all');
  const [viewFilter, setViewFilter] = useState<LibraryViewFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readingRoomOpen, setReadingRoomOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Media>>({ type: 'book', title: '', creator: '', status: 'Want to Read', tags: [] });
  const [annotationDraft, setAnnotationDraft] = useState({ type: 'thought' as Annotation['type'], text: '' });
  const [insightOpen, setInsightOpen] = useState(false);
  const [insightDraft, setInsightDraft] = useState({ title: '', body: '', tags: [] as string[] });
  const [conceptPopupName, setConceptPopupName] = useState<string | null>(null);
  const [showSourceConceptPicker, setShowSourceConceptPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'source'; item: Media } | { type: 'claim'; item: VaultEntry } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const saved = window.localStorage.getItem(LIBRARY_VIEW_STORAGE_KEY) as LibraryViewFilter | null;
    if (saved && Object.prototype.hasOwnProperty.call(LIBRARY_VIEW_LABELS, saved)) setViewFilter(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LIBRARY_VIEW_STORAGE_KEY, viewFilter);
  }, [viewFilter]);

  const selected = media.find((item) => item.id === selectedId) || null;
  const [captureDraft, setCaptureDraft] = useState<Media['capture'] | null>(null);
  const [activeSession, setActiveSession] = useState<ReadingSession | null>(null);
  const [sessionTick, setSessionTick] = useState(0);
  const [sessionTargetMinutes, setSessionTargetMinutes] = useState('');
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [endSessionNotes, setEndSessionNotes] = useState('');
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
    if (!focusedSourceId) {
      setSelectedId(null);
      return;
    }
    if (media.some((item) => item.id === focusedSourceId)) {
      setSelectedId(focusedSourceId);
      onFocusedSourceHandled?.();
    }
  }, [focusedSourceId, media, onFocusedSourceHandled]);

  const openEditor = (item?: Media) => {
    setDraft(item ? { ...item } : { type: 'book', title: '', creator: '', status: 'Want to Read', tags: [] });
    setEditorOpen(true);
  };

  const saveMedia = () => {
    if (!draft.title?.trim()) return;
    if (draft.id) {
      onUpdateMedia({ ...(draft as Media), tags: normalizeConceptTags(draft.tags), dateUpdated: today() });
    } else {
      onAddMedia({ ...draft, tags: normalizeConceptTags(draft.tags), annotations: [], capture: { sessions: [] } });
    }
    setEditorOpen(false);
  };

  const updateSelected = (patch: Partial<Media>) => {
    if (!selected) return;
    onUpdateMedia({ ...selected, ...patch, dateUpdated: today() });
  };

  useEffect(() => {
    setCaptureDraft(selected?.capture || { sessions: [] });
    setActiveSession(null);
    setSessionTargetMinutes('');
    setEndSessionOpen(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;
    const interval = window.setInterval(() => setSessionTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, [activeSession?.id, activeSession?.status]);

  const sessionElapsedSeconds = (session: ReadingSession | null) => {
    if (!session?.startedAt) return 0;
    const started = new Date(session.startedAt).getTime();
    const now = session.status === 'paused' && session.pauseStartedAt ? new Date(session.pauseStartedAt).getTime() : Date.now();
    const wallSeconds = Math.max(0, Math.floor((now - started) / 1000));
    return Math.max(0, wallSeconds - (session.totalPausedSeconds || 0));
  };

  const elapsed = sessionElapsedSeconds(activeSession);

  useEffect(() => {
    if (!activeSession?.countdownTargetSeconds || activeSession.status !== 'active' || targetAlerted) return;
    if (elapsed >= activeSession.countdownTargetSeconds) {
      setTargetAlerted(true);
      toast({ title: 'Session target reached', description: 'Your session will keep counting until you end it.' });
    }
  }, [activeSession, elapsed, targetAlerted, toast]);

  const startSession = () => {
    if (!selected) return;
    const target = Number(sessionTargetMinutes);
    setActiveSession({
      id: uid(),
      sourceId: selected.id,
      startedAt: today(),
      status: 'active',
      countdownTargetSeconds: target > 0 ? target * 60 : 0,
      totalPausedSeconds: 0,
      createdAt: today(),
      updatedAt: today(),
    });
    setTargetAlerted(false);
    setSessionTick(0);
  };

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
    setEndSessionNotes('');
    setEndSessionOpen(true);
  };

  const saveSession = (notes?: string) => {
    if (!selected || !activeSession) return;
    const completed: ReadingSession = {
      ...activeSession,
      endedAt: today(),
      date: today(),
      durationSeconds: elapsed,
      totalElapsedSeconds: activeSession.startedAt ? Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000) : elapsed,
      notes: notes || '',
      status: 'completed',
      updatedAt: today(),
    };
    const capture = captureDraft || selected.capture || { sessions: [] };
    const nextCapture = { ...capture, sessions: [completed, ...(capture.sessions || [])] };
    setCaptureDraft(nextCapture);
    updateSelected({ capture: nextCapture });
    setActiveSession(null);
    setEndSessionOpen(false);
    setSessionTargetMinutes('');
    toast({ title: 'Session saved', description: `${formatDuration(completed.durationSeconds)} added to this source history.` });
  };

  useEffect(() => {
    if (!selected || !captureDraft) return;
    if (JSON.stringify(captureDraft) === JSON.stringify(selected.capture || { sessions: [] })) return;
    const timeout = window.setTimeout(() => {
      updateSelected({ capture: captureDraft });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [captureDraft, selected?.id]);

  const updateCaptureDraft = (capture: Media['capture']) => {
    setCaptureDraft({ ...capture, sessions: capture?.sessions || [] });
  };

  const openSelectedSource = (id: string) => {
    setSelectedId(id);
    onOpenSourceRoute?.(id);
  };

  const closeSelectedSource = () => {
    setSelectedId(null);
    onOpenSourceRoute?.(null);
  };

  const addAnnotation = () => {
    if (!selected || !annotationDraft.text.trim()) return;
    const annotation: Annotation = {
      id: uid(),
      type: annotationDraft.type,
      text: annotationDraft.text.trim(),
      date: today(),
      conceptTags: selected.tags,
      philosophyStatus: annotationDraft.type === 'question' ? 'questioned' : 'raw',
    };
    updateSelected({ annotations: [annotation, ...(selected.annotations || [])] });
    setAnnotationDraft({ type: 'thought', text: '' });
  };

  const saveClaim = () => {
    if (!selected || !insightDraft.title.trim()) return;
    onCreateClaim({
      ...insightDraft,
      sourceIds: [selected.id]
    });
    setInsightDraft({ title: '', body: '', tags: [] });
    setInsightOpen(false);
    toast({ title: 'Claim saved', description: 'A developing position was anchored to this source for later review.' });
  };

  if (selected) {
    const linkedInsights = vault.filter((entry) => (entry.sourceIds || []).includes(selected.id));
    const linkedConcepts = concepts.filter((concept) => (selected.tags || []).some((tag) => conceptKey(tag) === conceptKey(concept.name) || (concept.aliases || []).some((alias) => conceptKey(tag) === conceptKey(alias))))
      .sort((a, b) => new Date(b.dateUpdated || b.dateCreated).getTime() - new Date(a.dateUpdated || a.dateCreated).getTime())
      .slice(0, 3);
    const capture = captureDraft || selected.capture || { sessions: [] };
    const relatedQuestions = questions.filter((question) => inquirySourceIds(question).includes(selected.id));
    const relatedDrafts = drafts.filter((draft) => (draft.sourceIds || []).includes(selected.id));
    const relatedPractices = practices.filter((practice) => (practice.sourceIds || []).includes(selected.id));
    const sourcePurpose = capture.before?.reasonForAdding || capture.before?.openQuestion || capture.before?.expectation || selected.description || 'This source still needs a clear reason for being studied.';
    
    return (
      <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={closeSelectedSource} className="font-code text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center transition-colors">
              <ArrowLeft className="size-3 mr-2" /> LIBRARY
            </button>
            <span className="font-code text-[11px] uppercase tracking-widest text-primary/30">/</span>
            <span className="font-code text-[11px] uppercase tracking-widest text-primary/80 font-bold">
              {MEDIA_LABELS[selected.type]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ContextualAiPanel
              actions={['summarize_source', 'extract_source_claims', 'propose_inquiry_prompts']}
              enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
              showContextBeforeSending={aiSettings?.showContextBeforeSending}
              reasoningDepth={aiSettings?.defaultReasoningDepth}
              retainAcceptedProvenance={aiSettings?.retainAcceptedAiProvenance}
              buildEnvelope={(action: ContextualAiAction) => ({
                action,
                targetType: 'source',
                targetId: selected.id,
                scope: 'linked_items',
                itemMemory: [
                  `Source: ${selected.title}${selected.creator ? ` by ${selected.creator}` : ''}`,
                  `Description: ${selected.description || 'None.'}`,
                  `Main idea: ${selected.capture?.after?.coreArgument || 'Not recorded.'}`,
                  `What stays with me: ${selected.capture?.after?.lasting || 'Not recorded.'}`,
                  `What remains open: ${selected.capture?.after?.remainsUnanswered || 'Not recorded.'}`,
                  `How my view changed: ${selected.capture?.after?.beliefChange || 'Not recorded.'}`,
                  ...((selected.capture?.sessions || []).slice(0, 4).map((session) => `Source session: ${session.notes || 'No session note.'}`)),
                  ...(selected.annotations || []).slice(0, 8).map((annotation) => `${annotation.type}: ${annotation.text}`),
                ],
                linkedMemory: [
                  ...vault.filter((entry) => (entry.sourceIds || []).includes(selected.id)).slice(0, 6).map((entry) => `Position: ${entry.statement || entry.title}`),
                  ...questions.filter((question) => inquirySourceIds(question).includes(selected.id)).slice(0, 6).map((question) => `Inquiry: ${question.text}`),
                ],
              })}
              onAccept={(result, content) => {
                if (result.action === 'summarize_source') updateSelected({ description: content });
                else if (result.action === 'reflect_on_source') {
                  const currentCapture = captureDraft || selected.capture || { sessions: [] };
                  const nextCapture = { ...currentCapture, after: { ...currentCapture.after, aiReflection: content }, sessions: currentCapture.sessions || [] };
                  setCaptureDraft(nextCapture);
                  updateSelected({ capture: nextCapture });
                }
                else if (result.action === 'extract_source_claims') updateSelected({
                  annotations: [
                    ...generatedListItems(content).map((text) => ({ id: uid(), type: 'claim' as const, text, date: today(), conceptTags: selected.tags || [], philosophyStatus: 'raw' as const })),
                    ...(selected.annotations || []),
                  ],
                });
                else updateSelected({
                  annotations: [
                    ...generatedListItems(content, 6).map((text) => ({ id: uid(), type: 'question' as const, text, date: today(), conceptTags: selected.tags || [], philosophyStatus: 'questioned' as const })),
                    ...(selected.annotations || []),
                  ],
                });
              }}
            />
            <Select value={selected.status} onValueChange={(value) => updateSelected({ status: value as MediaStatus })}>
              <SelectTrigger className="w-36 sm:w-44 font-code text-[10px] uppercase h-9 bg-card shadow-sm border-border/60 rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className="font-code text-[10px] uppercase">{MEDIA_STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Source actions" className="size-9 rounded-full bg-card"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openEditor(selected)}><Edit className="mr-2 size-4" /> Edit source</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteTarget({ type: 'source', item: selected })} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 size-4" /> Delete source</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="mb-6 flex flex-col gap-5 rounded-xl border border-border/50 bg-card p-5 shadow-sm sm:flex-row sm:p-6">
          <div className="h-40 w-full shrink-0 overflow-hidden rounded-lg border border-border/30 bg-accent/5 shadow-inner sm:size-44">
            {selected.thumbnailUrl ? (
              <img src={selected.thumbnailUrl} alt={selected.title} className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent/10">
                {React.createElement(MEDIA_ICONS_COMP[selected.type], { className: "size-10 text-accent/40" })}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="noesis-page-title mb-3 break-words text-3xl sm:text-4xl">{selected.title}</h1>
            <div className="flex items-center gap-4 mb-5">
              <span className="font-body text-xl italic text-muted-foreground">{selected.creator}</span>
              {selected.year && <span className="font-code text-xs text-muted-foreground/40 font-bold tracking-widest">{selected.year}</span>}
            </div>
            <p className="mb-5 max-w-3xl font-body text-base italic leading-relaxed text-primary/80 sm:text-lg">
              {selected.description || "A placeholder for the central thesis or importance of this scholarly source."}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {(selected.tags || []).map(tag => (
                <button
                  key={tag}
                  onClick={() => setConceptPopupName(tag)}
                  className="inline-flex items-center rounded-full border px-4 py-1.5 font-code text-[9px] uppercase tracking-[0.18em] font-bold bg-card text-muted-foreground border-border/60 shadow-sm hover:bg-accent/10 hover:text-accent hover:border-accent/20 transition-all"
                >
                  {tag}
                </button>
              ))}
              <Badge variant="outline" className="font-code text-[9px] uppercase tracking-[0.18em] px-4 py-1.5 bg-card border-border/60 shadow-sm rounded-full font-bold">
                {selected.annotations?.length || 0} NOTES
              </Badge>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 h-14 w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border/50 bg-transparent p-0 sm:gap-8">
            <TabsTrigger value="overview" className="readex-kicker data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent rounded-none bg-transparent px-0 h-full text-[11px] font-bold">OVERVIEW</TabsTrigger>
            <TabsTrigger value="capture" className="readex-kicker data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent rounded-none bg-transparent px-0 h-full text-[11px] font-bold">ENGAGE &amp; REFLECT</TabsTrigger>
            <TabsTrigger value="annotations" className="readex-kicker data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent rounded-none bg-transparent px-0 h-full text-[11px] font-bold">NOTES</TabsTrigger>
            <TabsTrigger value="connections" className="readex-kicker data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-accent rounded-none bg-transparent px-0 h-full text-[11px] font-bold">CONNECTIONS</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <Card className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
                <div className="readex-kicker mb-3 opacity-50 font-bold">MEDIA SUMMARY</div>
                <div className="grid gap-3 text-sm">
                  {[
                    { label: 'Type', value: MEDIA_LABELS[selected.type] },
                    { label: 'Creator', value: selected.creator || selected.creators?.join(', ') || 'Unknown creator' },
                    { label: 'Year', value: selected.year || selected.dateAdded || 'No year recorded' },
                    { label: 'Publisher / Platform', value: selected.publisher || selected.platform || selected.sourceProvider || 'No publisher recorded' },
                    { label: 'Locator', value: selected.isbn || selected.doi || selected.url || selected.externalIds?.url || selected.externalIds?.doi || 'No locator recorded' },
                    { label: 'Status', value: MEDIA_STATUS_LABELS[selected.status] },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-background/70 px-4 py-3">
                      <span className="font-code text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</span>
                      <span className="max-w-[70%] text-right text-foreground/80 break-words">{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
                <div className="readex-kicker mb-3 opacity-50 font-bold">SOURCE PURPOSE</div>
                <p className="font-headline text-2xl italic leading-snug text-primary/90">{sourcePurpose}</p>
                <p className="mt-6 text-sm leading-6 text-muted-foreground">
                  Open <span className="font-medium text-foreground">Engage &amp; Reflect</span> to track progress and save what this source changed for you.
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="readex-kicker opacity-50 font-bold">KEY CONCEPTS</div>
                  <span className="text-xs text-muted-foreground">Latest {linkedConcepts.length}</span>
                </div>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">The three most recently updated concepts linked to this source.</p>
                <div className="flex flex-wrap gap-2">
                  {linkedConcepts.map((concept) => {
                    return (
                      <button key={concept.id} type="button" onClick={() => setConceptPopupName(concept.name)} className="rounded-full border border-border/50 bg-background/70 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-accent">
                        {concept.name}
                      </button>
                    );
                  })}
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowSourceConceptPicker((value) => !value)} className="h-8 rounded-full px-3 text-xs"><Plus className="mr-1 size-3.5" /> Add concept</Button>
                </div>
                {showSourceConceptPicker && <div className="mt-4 max-w-md"><ConceptTagPicker concepts={concepts} value={selected.tags || []} onChange={(tags) => updateSelected({ tags })} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} /></div>}
              </Card>

              <Card className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
                <div className="readex-kicker mb-2 opacity-50 font-bold">CURRENT TAKEAWAY</div>
                <p className="font-body text-lg italic leading-7 text-foreground/85">
                  {capture.after?.lasting || capture.after?.coreArgument || 'No takeaway saved yet.'}
                </p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {capture.after?.remainsUnanswered || 'After engaging with this source, name the question that is still worth carrying forward.'}
                </p>
                <Button variant="outline" onClick={() => setInsightOpen(true)} className="mt-5 rounded-full bg-card">Create position from this source</Button>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="capture" className="space-y-12">
            <p className="max-w-2xl font-body text-sm leading-6 text-muted-foreground">
              Use this space while you engage with the source. Start with a reason, log time only when it helps, then save the one or two ideas worth carrying forward.
            </p>

            <section>
              <h3 className="readex-kicker flex items-center gap-3 mb-6 opacity-40 font-bold">
                <Plus className="size-2.5" /> SET YOUR INTENTION
              </h3>
              <div className="bg-muted/5 border border-border/30 rounded-xl overflow-hidden shadow-sm">
                <CaptureRow label="WHY ARE YOU HERE?" value={capture.before?.reasonForAdding} placeholder="What made this source worth your attention?" onChange={(val) => updateCaptureDraft({ ...capture, before: { ...capture.before, reasonForAdding: val }, sessions: capture.sessions || [] })} />
                <CaptureRow label="WHAT QUESTION ARE YOU BRINGING?" value={capture.before?.openQuestion} placeholder="What would you like this source to help you understand?" onChange={(val) => updateCaptureDraft({ ...capture, before: { ...capture.before, openQuestion: val }, sessions: capture.sessions || [] })} />
                <details className="border-t border-border/30 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">More context (optional)</summary>
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/30 bg-card">
                    <CaptureRow label="CURRENT VIEW" value={capture.before?.priorBeliefs} placeholder="What do you currently think about this?" onChange={(val) => updateCaptureDraft({ ...capture, before: { ...capture.before, priorBeliefs: val }, sessions: capture.sessions || [] })} />
                    <CaptureRow label="POSITION THAT MAY CHANGE" value={capture.before?.affectedPosition} placeholder="Which position could this complicate or strengthen?" onChange={(val) => updateCaptureDraft({ ...capture, before: { ...capture.before, affectedPosition: val }, sessions: capture.sessions || [] })} />
                    <CaptureRow label="WHAT WOULD MAKE THIS WORTHWHILE?" value={capture.before?.worthwhileIf} placeholder="What would make this attention worthwhile?" onChange={(val) => updateCaptureDraft({ ...capture, before: { ...capture.before, worthwhileIf: val }, sessions: capture.sessions || [] })} />
                  </div>
                </details>
              </div>
              {capture.after?.aiReflection && (
                <div className="mt-4 rounded-xl border border-accent/25 bg-accent/5 p-4">
                  <div className="mb-2 flex items-center gap-2"><Badge variant="outline" className="rounded-full border-accent/30 text-accent">AI-assisted reflection</Badge><span className="text-xs text-muted-foreground">Based on your saved notes</span></div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{capture.after.aiReflection}</p>
                </div>
              )}
            </section>

            <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="readex-kicker flex items-center gap-3 opacity-40 font-bold">
                  <Plus className="size-2.5" /> SESSIONS
                </h3>
                {!activeSession && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Target min"
                      value={sessionTargetMinutes}
                      onChange={(event) => setSessionTargetMinutes(event.target.value)}
                      className="h-8 w-28 rounded-full text-right font-code text-[10px]"
                    />
                    <Button variant="outline" size="sm" onClick={startSession} className="h-8 px-5 font-code text-[10px] tracking-widest uppercase border-border/60 shadow-sm bg-card rounded-full font-bold">
                      <Play className="mr-2 size-3.5" /> Start Session
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {activeSession && (
                  <Card className="rounded-xl border-accent/25 bg-accent/[0.04] p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex size-12 items-center justify-center rounded-full bg-card text-accent shadow-sm">
                          <Clock className="size-5" />
                        </div>
                        <div>
                          <div className="font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            {activeSession.status === 'paused' ? 'Paused' : 'Session Active'}
                          </div>
                          <div className="font-headline text-3xl font-bold italic">{formatDuration(elapsed)}</div>
                          {activeSession.countdownTargetSeconds && (
                            <p className="text-xs italic text-muted-foreground">
                              Target {formatDuration(activeSession.countdownTargetSeconds)} {elapsed >= activeSession.countdownTargetSeconds ? 'reached' : 'remaining target active'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {activeSession.status === 'paused' ? (
                          <Button onClick={resumeSession} className="rounded-full"><Play className="mr-2 size-4" /> Resume</Button>
                        ) : (
                          <Button variant="outline" onClick={pauseSession} className="rounded-full bg-card"><Pause className="mr-2 size-4" /> Pause</Button>
                        )}
                        <Button variant="destructive" onClick={openEndSession} className="rounded-full"><Square className="mr-2 size-4" /> End</Button>
                      </div>
                    </div>
                  </Card>
                )}

                {(capture.sessions || []).length > 0 ? (
                  <div className="space-y-3">
                    {[...(capture.sessions || [])]
                      .sort((a, b) => new Date(b.endedAt || b.date || b.startedAt || '').getTime() - new Date(a.endedAt || a.date || a.startedAt || '').getTime())
                      .map((session) => (
                        <Card key={session.id} className="rounded-xl border-border/40 bg-card p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                {new Date(session.endedAt || session.date || session.startedAt || today()).toLocaleDateString()}
                              </div>
                              <div className="mt-1 font-headline text-xl font-bold italic">{formatDuration(session.durationSeconds || 0)}</div>
                            </div>
                            <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{session.status || 'completed'}</Badge>
                          </div>
                          {session.notes && <p className="mt-3 text-sm italic leading-6 text-muted-foreground">{session.notes}</p>}
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

            <section>
              <h3 className="readex-kicker flex items-center gap-3 mb-6 opacity-40 font-bold">
                <Plus className="size-2.5" /> WHAT DID YOU TAKE FROM IT?
              </h3>
              <div className="bg-muted/5 border border-border/30 rounded-xl overflow-hidden shadow-sm">
                <CaptureRow label="MAIN IDEA" value={capture.after?.coreArgument} placeholder="What is this source really saying?" onChange={(val) => updateCaptureDraft({ ...capture, after: { ...capture.after, coreArgument: val }, sessions: capture.sessions || [] })} />
                <CaptureRow label="WHAT STAYS WITH YOU?" value={capture.after?.lasting} placeholder="What is the one idea you want to carry forward?" onChange={(val) => updateCaptureDraft({ ...capture, after: { ...capture.after, lasting: val }, sessions: capture.sessions || [] })} />
                <CaptureRow label="WHAT REMAINS OPEN?" value={capture.after?.remainsUnanswered} placeholder="What question remains after this source?" onChange={(val) => updateCaptureDraft({ ...capture, after: { ...capture.after, remainsUnanswered: val }, sessions: capture.sessions || [] })} />
                <details className="border-t border-border/30 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">Go deeper (optional)</summary>
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/30 bg-card">
                    <CaptureRow label="STRONGEST POINT" value={capture.after?.strongestArgument} placeholder="What was most convincing?" onChange={(val) => updateCaptureDraft({ ...capture, after: { ...capture.after, strongestArgument: val }, sessions: capture.sessions || [] })} />
                    <CaptureRow label="WEAKEST POINT" value={capture.after?.weakestArgument} placeholder="What felt weak, incomplete, or unconvincing?" onChange={(val) => updateCaptureDraft({ ...capture, after: { ...capture.after, weakestArgument: val }, sessions: capture.sessions || [] })} />
                    <CaptureRow label="WHAT CHANGED FOR YOU?" value={capture.after?.beliefChange} placeholder="How did this affect your view?" onChange={(val) => updateCaptureDraft({ ...capture, after: { ...capture.after, beliefChange: val }, sessions: capture.sessions || [] })} />
                    <CaptureRow label="NEXT STEP" value={capture.after?.nextAction} placeholder="What should you do with this next?" onChange={(val) => updateCaptureDraft({ ...capture, after: { ...capture.after, nextAction: val }, sessions: capture.sessions || [] })} />
                  </div>
                </details>
              </div>
              <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Source reflection</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Use your saved notes to surface what you learned, what changed, and what remains uncertain.</p>
                  </div>
                  <ContextualAiPanel
                    actions={['reflect_on_source']}
                    enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
                    showContextBeforeSending={aiSettings?.showContextBeforeSending}
                    reasoningDepth={aiSettings?.defaultReasoningDepth}
                    retainAcceptedProvenance={aiSettings?.retainAcceptedAiProvenance}
                    buttonLabel="Reflect on this source"
                    promptLabel="What do you want to understand about your response to this source?"
                    promptPlaceholder="For example: What tension keeps appearing in my notes, and what should I examine next?"
                    buildEnvelope={(_action, userPrompt) => ({
                      action: 'reflect_on_source',
                      targetType: 'source',
                      targetId: selected.id,
                      scope: 'linked_items',
                      itemMemory: [
                        `Source: ${selected.title}${selected.creator ? ` by ${selected.creator}` : ''}`,
                        `Main idea: ${capture.after?.coreArgument || 'Not recorded.'}`,
                        `What stays with me: ${capture.after?.lasting || 'Not recorded.'}`,
                        `What remains open: ${capture.after?.remainsUnanswered || 'Not recorded.'}`,
                        `How my view changed: ${capture.after?.beliefChange || 'Not recorded.'}`,
                        ...(capture.sessions || []).slice(0, 4).map((session) => `Source session: ${session.notes || 'No session note.'}`),
                      ],
                      linkedMemory: (selected.annotations || []).slice(0, 8).map((annotation) => `${annotation.type}: ${annotation.text}`),
                      userPrompt,
                    })}
                    onAccept={(_, content) => {
                      const nextCapture = { ...capture, after: { ...capture.after, aiReflection: content }, sessions: capture.sessions || [] };
                      setCaptureDraft(nextCapture);
                      updateSelected({ capture: nextCapture });
                    }}
                  />
                </div>
                {capture.after?.aiReflection && (
                  <p className="mt-4 whitespace-pre-wrap border-t border-accent/15 pt-4 text-sm leading-6 text-foreground">{capture.after.aiReflection}</p>
                )}
              </div>
            </section>

            <div className="flex gap-4 pt-10 border-t border-border/30">
              <Button onClick={() => updateSelected({ capture })} className="bg-accent px-10 h-11 font-code text-[11px] tracking-widest uppercase shadow-lg shadow-accent/20 rounded-full font-bold">SAVE CAPTURE</Button>
            </div>
          </TabsContent>

          <TabsContent value="annotations" className="max-w-4xl">
            <div>
              <div className="space-y-8">
                <div>
                  <h3 className="readex-kicker font-bold text-muted-foreground">NOTES FROM THIS SOURCE</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Save a highlight, your own thought, a question, or a connection. Keep each note to one idea.</p>
                </div>
                <div className="flex gap-3">
                  <Select value={annotationDraft.type} onValueChange={(value) => setAnnotationDraft((prev) => ({ ...prev, type: value as Annotation['type'] }))}>
                    <SelectTrigger className="w-48 font-code text-[10px] uppercase h-11 border-border/60 bg-card shadow-sm rounded-full font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="highlight" className="font-code text-[10px] uppercase">Highlight</SelectItem>
                      <SelectItem value="thought" className="font-code text-[10px] uppercase">Thought</SelectItem>
                      <SelectItem value="question" className="font-code text-[10px] uppercase">Question</SelectItem>
                      <SelectItem value="connection" className="font-code text-[10px] uppercase">Connection</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={annotationDraft.text} onChange={(event) => setAnnotationDraft((prev) => ({ ...prev, text: event.target.value }))} placeholder="Extract highlight, thought, or connection..." className="font-body italic text-base h-11" />
                  <Button onClick={addAnnotation} size="sm" className="h-11 px-8 rounded-full font-bold">ADD</Button>
                </div>
                <div className="space-y-5">
                  {(selected.annotations || []).map((annotation) => (
                    <div key={annotation.id} className="rounded-xl border border-border/30 bg-card p-8 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <Badge variant="outline" className="font-code text-[9px] uppercase tracking-widest bg-muted/5 border-border/40 rounded-full font-bold">
                          {annotation.type}
                        </Badge>
                        <time className="font-code text-[9px] text-muted-foreground/50 font-bold uppercase">{new Date(annotation.date).toLocaleDateString()}</time>
                      </div>
                      <p className="font-body italic leading-relaxed text-[17px] text-primary/90">"{annotation.text}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="connections" className="space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="readex-kicker font-bold text-muted-foreground">WHERE THIS SOURCE IS USED</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">These are the objects that explicitly cite, question, test, or develop this source. A source claim stays separate from your position until you create one.</p>
              </div>
              <Button onClick={() => setInsightOpen(true)} className="rounded-full">Create position</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: 'Positions', items: linkedInsights.map((item) => item.title), empty: 'No positions have been created from this source.' },
                { label: 'Inquiries', items: relatedQuestions.map((item) => item.text), empty: 'No inquiries are linked to this source.' },
                { label: 'Works', items: relatedDrafts.map((item) => item.title), empty: 'No works use this source.' },
                { label: 'Practices', items: relatedPractices.map((item) => item.title), empty: 'No practices test ideas from this source.' },
              ].map((group) => (
                <Card key={group.label} className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                  <div className="font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</div>
                  {group.items.length ? (
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground/85">{group.items.slice(0, 4).map((item) => <li key={item}>- {item}</li>)}</ul>
                  ) : <p className="mt-3 text-sm leading-6 text-muted-foreground">{group.empty}</p>}
                </Card>
              ))}
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

        <Dialog open={endSessionOpen} onOpenChange={setEndSessionOpen}>
          <DialogContent className="max-w-lg border-none bg-card shadow-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-3xl italic">End Source Session</DialogTitle>
              <p className="text-sm italic text-muted-foreground">Total active time: {formatDuration(elapsed)}</p>
            </DialogHeader>
            <div className="space-y-3 pt-3">
              <Label className="readex-kicker text-[9px] font-bold uppercase">Reflection Notes</Label>
              <Textarea
                value={endSessionNotes}
                onChange={(event) => setEndSessionNotes(event.target.value)}
                placeholder="What did you encounter, notice, question, or connect?"
                className="min-h-[130px] italic"
              />
            </div>
            <DialogFooter className="gap-2 pt-4">
              <Button variant="ghost" onClick={() => setEndSessionOpen(false)} className="rounded-full">Cancel</Button>
              <Button variant="outline" onClick={() => saveSession('')} className="rounded-full bg-card">Skip Notes</Button>
              <Button onClick={() => saveSession(endSessionNotes)} className="rounded-full bg-accent px-8">Save Session</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={insightOpen} onOpenChange={setInsightOpen}>
          <DialogContent className="max-w-xl border-none shadow-2xl rounded-2xl">
            <DialogHeader><DialogTitle className="font-headline text-3xl italic">New Position</DialogTitle></DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label className="readex-kicker">Claim title</Label>
                <Input value={insightDraft.title} onChange={(e) => setInsightDraft(prev => ({ ...prev, title: e.target.value }))} placeholder="Brief synthesis of the breakthrough..." />
              </div>
              <div className="space-y-2">
                <Label className="readex-kicker">Reasoning / Statement</Label>
                <Textarea value={insightDraft.body} onChange={(e) => setInsightDraft(prev => ({ ...prev, body: e.target.value }))} className="min-h-[140px]" placeholder="Elaborate on the discovery..." />
              </div>
              <div className="space-y-2">
                <Label className="readex-kicker">Concepts</Label>
                <ConceptTagPicker concepts={concepts} value={insightDraft.tags} onChange={(tags) => setInsightDraft(prev => ({ ...prev, tags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} />
              </div>
            </div>
            <DialogFooter className="pt-6"><Button onClick={saveClaim} className="rounded-full px-10 h-11 font-bold">Save developing claim</Button></DialogFooter>
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
        <MediaEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draft} setDraft={setDraft} onSave={saveMedia} />
      </div>
    );
  }

  return (
    <div className="noesis-page">
      <PageHeader
        title="Library"
        description="Engage actively, capture what matters, and trace what each source changes."
        meta={
          <span className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            {media.length} sources · {libraryStats.consuming} in progress · {libraryStats.annotations} annotations
          </span>
        }
        className="mb-6"
        actions={
          <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 h-9 px-6 shadow-md shadow-accent/20 rounded-full font-bold">
            <Plus className="size-4 mr-1.5" /> ADD SOURCE
          </Button>
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
        className="mb-6"
      >
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as LibraryViewFilter)}>
          <SelectTrigger className="w-56 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Attention" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LIBRARY_VIEW_LABELS) as LibraryViewFilter[]).map((value) => (
              <SelectItem key={value} value={value} className="font-code text-[10px] uppercase">{LIBRARY_VIEW_LABELS[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MediaStatus | 'active' | 'all')}>
          <SelectTrigger className="w-48 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[10px] uppercase">Status: All</SelectItem>
            <SelectItem value="active" className="font-code text-[10px] uppercase">In Progress</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status} className="font-code text-[10px] uppercase">{MEDIA_STATUS_LABELS[status]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(value) => setFilter(value as MediaType | 'all')}>
          <SelectTrigger className="w-48 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[10px] uppercase">Type: All</SelectItem>
            {MEDIA_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="font-code text-[10px] uppercase">{MEDIA_LABELS[type]}</SelectItem>
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
            <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Active Sources</div>
            <p className="mt-1 text-xs text-muted-foreground">Continue, reflect, or develop active source threads.</p>
          </div>
          <span className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full">{filtered.length} shown</Badge>
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
                <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60 font-bold">
                  {column.label} - {column.items.length}
                </div>
                {column.items.length > 2 && (
                  <button type="button" onClick={() => setViewFilter(column.label === 'Reflect' ? 'awaiting_reflection' : column.label === 'Develop' ? 'inquiry_driven' : column.label === 'Recent' ? 'recently_added' : 'continue')} className="font-code text-[8px] uppercase tracking-widest text-accent">
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
                        <span className="font-code text-[8px] uppercase tracking-widest text-accent">{column.action}</span>
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

      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
        {filtered.map((item) => {
          const influence = sourceInfluenceCount(item, vault, drafts, practices, questions);
          return (
          <Card
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={`Open ${item.title}`}
            className="cursor-pointer border-none shadow-none bg-transparent group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => openSelectedSource(item.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              openSelectedSource(item.id);
            }}
          >
            <div className="aspect-[4/5] overflow-hidden rounded-lg border border-border/30 bg-card shadow-sm mb-3 transition-all group-hover:-translate-y-1 group-hover:shadow-lg">
              <SourceCover item={item} />
            </div>
            <div className="space-y-1.5">
              <div className="readex-kicker opacity-50 font-bold text-[9px]">{MEDIA_LABELS[item.type].toUpperCase()}</div>
              <h3 className="line-clamp-2 font-headline text-base font-bold italic leading-snug text-foreground transition-colors group-hover:text-accent">
                {item.title}
              </h3>
              <p className="readex-kicker text-muted-foreground truncate text-[9px] font-bold tracking-widest">{item.creator.toUpperCase()}</p>
              {!!item.tags?.[0] && (
                <div className="line-clamp-1 text-sm font-semibold text-accent">{item.tags[0]}</div>
              )}
              <div className="flex items-center justify-between pt-1">
                <Badge variant="outline" className="rounded-full border-border/60 bg-card px-2 py-0.5 font-code text-[8px] font-bold uppercase tracking-widest">
                  {MEDIA_STATUS_LABELS[item.status]}
                </Badge>
                <div className="flex items-center gap-3 text-muted-foreground/70">
                  {item.annotations?.length > 0 && <span className="flex items-center gap-1" title={`${item.annotations.length} annotations`} aria-label={`${item.annotations.length} annotations`}><MessageSquare className="size-3.5" /><span className="font-code text-[9px] font-bold">{item.annotations.length}</span></span>}
                  {influence > 0 && <span className="flex items-center gap-1" title={`${influence} connected objects`} aria-label={`${influence} connected objects`}><Link2 className="size-3.5" /><span className="font-code text-[9px] font-bold">{influence}</span></span>}
                </div>
              </div>
            </div>
          </Card>
          );
        })}

        <Card 
          className="aspect-[2/3] rounded-xl border-2 border-dashed border-border/50 bg-card/50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-card transition-all group shadow-sm hover:shadow-xl hover:-translate-y-2"
          onClick={() => openEditor()}
        >
          <div className="size-12 rounded-full bg-card flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md border border-border/30">
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <div className="readex-kicker text-muted-foreground font-bold text-[10px]">ADD MEDIA</div>
        </Card>

        {filtered.length === 0 && (
          <div className="col-span-full">
            <PageEmptyState
              icon={BookOpen}
              title="No active sources found"
              description="Library is for sources you are actively capturing or reflecting on. Clear filters or add a new source to begin."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {libraryFiltersActive && <Button variant="outline" onClick={clearLibraryFilters} className="rounded-full">Clear filters</Button>}
                  <Button onClick={() => openEditor()} className="rounded-full"><Plus className="mr-1.5 size-4" /> Add source</Button>
                </div>
              }
            />
          </div>
        )}
      </div>

      <MediaEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draft} setDraft={setDraft} onSave={saveMedia} />
    </div>
  );
}

function SourceCover({ item }: { item: Media }) {
  const [failed, setFailed] = useState(false);
  if (item.thumbnailUrl && !failed) {
    return <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30 p-5 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border border-border/50 bg-background/80 shadow-sm">
        {React.createElement(MEDIA_ICONS_COMP[item.type], { className: 'size-7 text-accent/70' })}
      </div>
      <div className="mt-4 line-clamp-3 font-headline text-sm font-semibold italic leading-5 text-foreground/80">{item.title}</div>
      <div className="mt-2 font-code text-[8px] uppercase tracking-widest text-muted-foreground">{MEDIA_LABELS[item.type]}</div>
    </div>
  );
}

function SourceStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-2 text-right shadow-sm">
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{label}</div>
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
          <div className="font-code text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">{label}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="font-headline text-3xl font-bold italic leading-none text-primary">{value}</div>
      </div>
    </button>
  );
}

function CaptureRow({ label, value, placeholder, onChange }: { label: string; value?: string; placeholder: string; onChange: (val: string) => void }) {
  return (
    <div className="flex items-center border-b border-border/30 last:border-b-0 min-h-[70px] bg-card">
      <div className="w-60 px-8 shrink-0">
        <span className="font-code text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold">{label}</span>
      </div>
      <div className="flex-1 p-0 h-full flex items-center">
        <Textarea 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent border-none shadow-none focus-visible:ring-0 font-body text-[17px] italic text-primary/90 placeholder:text-muted-foreground/30 py-5 h-auto min-h-0 resize-none rounded-none"
        />
      </div>
    </div>
  );
}

function MediaEditor({ open, onOpenChange, draft, setDraft, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Partial<Media>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Media>>>;
  onSave: () => void;
}) {
  const { toast } = useToast();
  const [tagInput, setTagInput] = useState('');
  const [locatorQuery, setLocatorQuery] = useState('');
  const [locatorResults, setLocatorResults] = useState<NormalizedSourceResult[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const terms = TYPE_TERMINOLOGY[draft.type || 'book'];

  const isDigital = ['video', 'podcast', 'article', 'course', 'lecture', 'documentary', 'interview', 'conversation', 'other'].includes(draft.type || 'book');
  const isPaper = draft.type === 'paper';

  const showSearch = true;
  const showImport = isDigital || isPaper || ['book', 'audiobook', 'movie'].includes(draft.type || 'book');

  const handleLocateSource = useCallback(async (query: string) => {
    if (query.trim().length < 3) return;
    setIsLocating(true);
    try {
      const resp = await authenticatedFetch(`/api/source-search?query=${encodeURIComponent(query)}&type=${draft.type}`);
      const data = await resp.json();
      if (data.results) {
        setLocatorResults(data.results);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error("Locator failed", error);
    } finally {
      setIsLocating(false);
    }
  }, [draft.type]);

  const handleImportUrl = useCallback(async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    try {
      const response = await authenticatedFetch('/api/source-metadata', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim(), type: draft.type || 'article' }),
      });
      const data = await response.json();
      if (data.result) {
        const patch = sourceResultToMediaPatch(data.result);
        setDraft((prev) => ({
          ...prev,
          ...patch,
          tags: normalizeConceptTags([...(prev.tags || []), ...(patch.tags || [])]),
        }));
        toast({ title: "Source Imported", description: "Metadata harvested from the provided URL." });
      } else {
        throw new Error(data.error || "Could not read metadata from URL.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Failed", description: noesisUserError(error, "Noesis could not archive this URL automatically.") });
    } finally {
      setIsImporting(false);
    }
  }, [draft.type, importUrl, setDraft, toast]);

  const addTag = () => {
    if (!tagInput.trim()) return;
    const next = normalizeConceptTags([...(draft.tags || []), tagInput]);
    setDraft(prev => ({ ...prev, tags: next }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const next = (draft.tags || []).filter(t => conceptKey(t) !== conceptKey(tag));
    setDraft(prev => ({ ...prev, tags: normalizeConceptTags(next) }));
  };

  const selectLocatedSource = (item: NormalizedSourceResult) => {
    const patch = sourceResultToMediaPatch(item);
    setDraft(prev => ({
      ...prev,
      ...patch,
    }));
    setLocatorResults([]);
    setShowDropdown(false);
    setLocatorQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-none rounded-2xl shadow-2xl bg-card font-body">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-8">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-4xl font-headline italic mb-2">Add to Library</DialogTitle>
              <p className="text-muted-foreground text-sm font-body italic">Archiving {MEDIA_LABELS[draft.type || 'book']}.</p>
            </DialogHeader>

            <div className="space-y-8">
              {!draft.id && (
                <>
                  {showSearch && (
                    <section className="bg-muted/5 p-5 rounded-xl border border-dashed border-border/60">
                      <Label className="readex-kicker block mb-4 font-bold text-[10px] text-accent flex items-center gap-2">
                        <Globe className="size-3" /> INTELLECTUAL LOCATOR
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
                        <Input 
                          placeholder={`Search ${MEDIA_LABELS[draft.type || 'book']} locator...`} 
                          value={locatorQuery}
                          onChange={(e) => {
                            setLocatorQuery(e.target.value);
                            handleLocateSource(e.target.value);
                          }}
                          className="pl-9 h-11 text-sm italic rounded-full bg-card"
                        />
                        {isLocating && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 size-4 animate-spin text-accent" />}
                      </div>
                      {showDropdown && locatorResults.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-border/20 pt-4 animate-fade-in-up">
                          {locatorResults.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => selectLocatedSource(item)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-card hover:shadow-md transition-all text-left group border border-transparent hover:border-border/40"
                            >
                              <div className="size-12 bg-muted/20 rounded shrink-0 overflow-hidden border border-border/20 flex items-center justify-center">
                                {item.thumbnailUrl ? (
                                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Globe className="size-5 text-muted-foreground/30" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-headline font-bold italic truncate group-hover:text-accent">{item.title}</div>
                                <div className="text-[10px] text-muted-foreground truncate uppercase font-code tracking-tighter">{item.creators.join(', ')} {item.year && `(${item.year})`}</div>
                              </div>
                              <Check className="size-3.5 opacity-0 group-hover:opacity-100 text-accent" />
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {showImport && (
                    <section className="bg-muted/5 p-5 rounded-xl border border-dashed border-border/60">
                      <Label className="readex-kicker block mb-4 font-bold text-[10px] text-accent flex items-center gap-2">
                        <Link2 className="size-3" /> PASTE URL
                      </Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Paste source URL for auto-metadata..." 
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          className="h-11 text-sm italic rounded-full bg-card"
                        />
                        <Button variant="outline" onClick={handleImportUrl} disabled={isImporting || !importUrl.trim()} className="h-11 px-6 rounded-full font-bold">
                          {isImporting ? <Loader2 className="size-4 animate-spin" /> : 'IMPORT'}
                        </Button>
                      </div>
                    </section>
                  )}
                </>
              )}

              <section>
                <Label className="readex-kicker block mb-4 font-bold text-[10px]">MEDIA TYPE</Label>
                <div className="flex flex-wrap gap-2">
                  {MEDIA_TYPES.map((type) => {
                    const Icon = MEDIA_ICONS_COMP[type];
                    const isActive = draft.type === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setDraft(prev => ({ ...prev, type }))}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full border transition-all font-code text-[9px] font-bold uppercase tracking-widest shadow-sm",
                          isActive 
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-card text-muted-foreground border-border/60 hover:border-accent hover:text-accent"
                        )}
                      >
                        <Icon className="size-3.5" />
                        {MEDIA_LABELS[type]}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">SOURCE TITLE</Label>
                  <Input 
                    value={draft.title || ''} 
                    onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
                    className="h-11 text-base italic"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.creator.toUpperCase()}</Label>
                  <Input 
                    value={draft.creator || ''} 
                    onChange={(e) => setDraft(prev => ({ ...prev, creator: e.target.value }))}
                    className="h-11 text-base italic"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">YEAR</Label>
                    <Input 
                      value={draft.year || ''} 
                      onChange={(e) => setDraft(prev => ({ ...prev, year: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.genre.toUpperCase()}</Label>
                    <Input 
                      value={draft.genre || ''} 
                      onChange={(e) => setDraft(prev => ({ ...prev, genre: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.publisher.toUpperCase()}</Label>
                  <Input 
                    value={draft.publisher || ''} 
                    onChange={(e) => setDraft(prev => ({ ...prev, publisher: e.target.value }))}
                    className="h-11 text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.identifier.toUpperCase()}</Label>
                    <Input 
                      value={draft.isbn || draft.doi || ''} 
                      onChange={(e) => setDraft(prev => ({ ...prev, isbn: e.target.value, doi: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">URL</Label>
                    <Input
                      value={draft.url || ''}
                      onChange={(e) => setDraft(prev => ({ ...prev, url: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONCEPTS</Label>
                  <div className="flex flex-wrap gap-2">
                    {(draft.tags || []).map(tag => (
                      <Badge key={tag} variant="secondary" className="px-4 py-1.5 font-code text-[9px] uppercase tracking-widest rounded-full border-border/60 bg-card shadow-sm font-bold">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="ml-2 hover:text-destructive transition-colors"><X className="size-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Input 
                      placeholder="Add concept vocabulary..." 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                      className="h-11 text-sm rounded-full"
                    />
                    <Button variant="outline" onClick={addTag} className="h-11 font-code text-[10px] font-bold uppercase tracking-widest bg-card shadow-sm border-border/60 rounded-full px-6">ADD</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">INTERNAL NOTES</Label>
                  <Textarea 
                    placeholder="Brief rationale for adding this source..."
                    value={draft.description || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value }))}
                    className="min-h-[120px] resize-none p-4 italic text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONSUMPTION STATUS</Label>
                  <select 
                    value={draft.status || 'Want to Read'}
                    onChange={(e) => setDraft(prev => ({ ...prev, status: e.target.value as MediaStatus }))}
                    className="w-full h-11 rounded-full border border-border/60 bg-card px-5 text-sm font-body appearance-none focus:outline-none focus:ring-2 focus:ring-accent shadow-sm"
                  >
                    {statuses.map(status => <option key={status} value={status}>{MEDIA_STATUS_LABELS[status]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-8 pt-4 bg-muted/10 border-t flex justify-end gap-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-11 px-8 font-code text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-transparent rounded-full">CANCEL</Button>
          <Button onClick={onSave} className="h-11 px-10 bg-accent font-code text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-accent/20 rounded-full">ADD TO LIBRARY</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConceptDetailDialog({ name, onClose, concepts, media, vault, drafts, questions, timeline, practices }: {
  name: string | null;
  onClose: () => void;
  concepts: Concept[];
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  questions: Question[];
  timeline: TimelineEvent[];
  practices: Practice[];
}) {
  const [activeTab, setActiveTab] = useState('sources');
  const related = useMemo(() => name ? conceptRelated(name, { media, insights: [], vault, drafts, questions, timeline, practices }) : null, [name, media, vault, drafts, questions, timeline, practices]);

  if (!name || !related) return null;

  const tabs = [
    { id: 'sources', label: 'SOURCES', count: related.sources.length },
    { id: 'notes', label: 'NOTES', count: related.annotations.length },
    { id: 'questions', label: 'QUESTIONS', count: related.questions.length },
    { id: 'beliefs', label: 'BELIEFS', count: related.beliefs.length },
    { id: 'writing', label: 'WRITING', count: related.drafts.length },
    { id: 'practices', label: 'PRACTICES', count: related.practices.length },
    { id: 'evolution', label: 'EVOLUTION', count: related.events.length },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'sources':
        return (
          <div className="space-y-4">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">INPUTS: SOURCES</h4>
            {related.sources.map(s => (
              <Card key={s.id} className="p-5 bg-card border-border/40 flex gap-5 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <div className="size-12 rounded-lg bg-muted/20 flex items-center justify-center shrink-0 shadow-inner">
                  {React.createElement(MEDIA_ICONS_COMP[s.type] || BookOpen, { className: "size-6 text-accent/40" })}
                </div>
                <div>
                  <h5 className="font-headline font-bold text-xl leading-tight text-primary">{s.title}</h5>
                  <p className="text-xs font-body italic text-muted-foreground mt-1">{s.creator} · {s.type}</p>
                </div>
              </Card>
            ))}
            {related.sources.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked sources discovered.</p>}
          </div>
        );
      case 'notes':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">INPUTS: ANNOTATIONS</h4>
            {related.annotations.map((a, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl">
                <Badge variant="outline" className="mb-3 font-code text-[9px] uppercase tracking-widest border-border/60 shadow-sm bg-card rounded-full font-bold">{a.type}</Badge>
                <p className="font-body italic text-base text-primary/90 leading-relaxed">"{a.text}"</p>
              </Card>
            ))}
            {related.annotations.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked annotations discovered.</p>}
          </div>
        );
      case 'beliefs':
        const items = related.beliefs;
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">{activeTab.toUpperCase()}</h4>
            {items.map((item, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <h5 className="font-headline font-bold text-xl italic mb-3 text-primary leading-tight">{item.title}</h5>
                <p className="font-body text-base text-muted-foreground leading-relaxed italic">{item.description || item.statement || ''}</p>
              </Card>
            ))}
            {items.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked items discovered.</p>}
          </div>
        );
      case 'questions':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">INQUIRIES</h4>
            {related.questions.map((q, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl">
                <p className="font-headline font-bold italic text-lg leading-relaxed text-primary">"{q.text}"</p>
                {q.answer && <p className="font-body text-base text-muted-foreground mt-4 border-t border-border/20 pt-4 italic leading-relaxed">{q.answer}</p>}
              </Card>
            ))}
            {related.questions.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked inquiries discovered.</p>}
          </div>
        );
      case 'writing':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">WORKS</h4>
            {related.drafts.map((d, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-headline font-bold text-xl italic text-primary leading-tight">{d.title}</h5>
                  <Badge variant="outline" className="text-[9px] border-border/60 bg-card shadow-sm rounded-full font-bold uppercase tracking-widest">{d.status}</Badge>
                </div>
                <p className="text-[10px] font-code opacity-50 uppercase font-bold tracking-widest">{d.type}</p>
              </Card>
            ))}
            {related.drafts.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked works discovered.</p>}
          </div>
        );
      case 'practices':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">PRACTICES</h4>
            {related.practices.map((practice, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-headline font-bold text-xl italic text-primary leading-tight">{practice.title}</h5>
                  <Badge variant="outline" className="text-[9px] border-border/60 bg-card shadow-sm rounded-full font-bold uppercase tracking-widest">{practice.status}</Badge>
                </div>
                <p className="font-body text-sm text-muted-foreground italic leading-relaxed">{practice.description || practice.type}</p>
              </Card>
            ))}
            {related.practices.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked practices discovered.</p>}
          </div>
        );
      case 'evolution':
        return (
          <div className="space-y-6">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">EVOLUTION</h4>
            {related.events.map((e, i) => (
              <div key={i} className="flex gap-5 items-start border-l-2 border-accent/20 pl-6 py-2 transition-colors hover:border-accent">
                <div className="pt-2">
                   <div className="size-2.5 rounded-full bg-accent shadow-sm" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-headline font-bold text-lg italic text-primary">{e.entityTitle}</h5>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">{e.eventType}: {e.reason}</p>
                  <time className="text-[10px] font-code opacity-40 font-bold uppercase tracking-widest">{new Date(e.date).toLocaleDateString()}</time>
                </div>
              </div>
            ))}
            {related.events.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked evolution events discovered.</p>}
          </div>
        );
      default:
        return <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked content discovered for this filter.</p>;
    }
  };

  return (
    <Dialog open={!!name} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-background font-body">
        <div className="p-10">
          <DialogHeader className="mb-10">
            <DialogTitle className="text-5xl font-headline italic mb-2 text-primary/90 leading-tight">{name}</DialogTitle>
            <p className="text-muted-foreground text-sm font-body italic opacity-60">Complete audit of linked inputs and outputs for this conceptual node.</p>
          </DialogHeader>

          <div className="flex flex-wrap gap-2.5 mb-10 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-5 py-2 rounded-full border transition-all font-code text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm",
                  activeTab === tab.id 
                    ? "bg-accent text-accent-foreground border-accent shadow-md"
                    : "bg-card text-muted-foreground border-border/60 hover:border-accent/40"
                )}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold",
                    activeTab === tab.id ? "bg-card/20 text-white" : "bg-muted/50 text-muted-foreground/60"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Separator className="bg-border/30 mb-10" />

          <ScrollArea className="h-[380px] pr-5">
            {renderContent()}
          </ScrollArea>
        </div>

        <div className="p-8 pt-4 bg-muted/5 border-t border-border/20 flex justify-end">
          <Button variant="outline" onClick={onClose} className="h-11 px-10 font-code text-[11px] font-bold uppercase tracking-widest bg-card border-border/60 shadow-sm rounded-full">CLOSE AUDIT</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
