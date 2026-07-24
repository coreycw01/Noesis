"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  CirclePause,
  CirclePlay,
  Cloud,
  Download,
  Eraser,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  Mic,
  NotebookPen,
  PencilLine,
  PenTool,
  Plus,
  RefreshCw,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlink,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { FormattingToolbar } from './FormattingToolbar';
import { DocumentCanvas } from './DocumentCanvas';
import { PageViewControls } from './PageViewControls';
import type { Annotation, Concept, Draft, DraftStatus, DraftType, ExternalDocProvider, Media, Question, UserPreferences, VaultEntry, WorkPurpose, WritingStyle } from '@/lib/types';
import { DRAFT_LABELS, WORK_CATEGORY_LABELS, WRITING_STYLE_DESCRIPTIONS, WRITING_STYLE_LABELS, WRITING_STYLES, normalizeConceptTags, today, workCategoryForDraft } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { escapeTextAsHtml, sanitizeHtml } from '@/lib/sanitize';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';

export type PageViewMode = 'vertical-continuous' | 'vertical-single' | 'horizontal-single';
export type PageSize = 'letter' | 'a4';
export type PaperColor = 'blank' | 'warm' | 'sepia' | 'dark';
export type PaperPattern = 'none' | 'notebook' | 'grid' | 'dotted' | 'dotted_grid';
type WritingTool = 'text' | 'pencil' | 'eraser';
type WorkRailAnnotation = Annotation & { sourceTitle: string; sourceId: string };
type WorkFilter = 'all' | DraftType | DraftStatus | 'active_inquiries' | 'awaiting_revision' | 'needs_sources' | 'needs_positions' | 'unresolved' | 'external_docs';
type BrowserSpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface AtelierProps {
  drafts: Draft[];
  media: Media[];
  vault: VaultEntry[];
  questions: Question[];
  concepts: Concept[];
  writingDefaults: UserPreferences['writingDefaults'];
  onAddDraft: (data: Partial<Draft>) => Draft;
  onUpdateDraft: (draft: Draft) => void;
  onDeleteDraft: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  focusedDraftId?: string | null;
  onOpenDraftRoute?: (id: string | null) => void;
}

const statuses: DraftStatus[] = ['idea', 'rough', 'seed', 'drafting', 'developing', 'revising', 'revised', 'complete', 'final', 'published', 'archived', 'abandoned'];
const articulationTypes: DraftType[] = ['essay', 'script', 'field_note', 'manuscript', 'reflection', 'argument', 'source_analysis', 'text_note', 'voice_note', 'talk_to_text', 'drawing_note', 'drawing', 'recording'];
const workTabs = ['all', 'writing', 'notes', 'recording', 'drawing'] as const;
const writingLabels: DraftType[] = ['essay', 'script', 'field_note', 'manuscript', 'reflection', 'argument', 'source_analysis'];
type WorkTab = (typeof workTabs)[number];
const workViewFilters: Array<{ id: WorkFilter; label: string }> = [
  { id: 'all', label: 'All Works' },
  { id: 'drafting', label: 'Drafting' },
  { id: 'complete', label: 'Complete' },
  { id: 'published', label: 'Published' },
  { id: 'final', label: 'Final' },
  { id: 'active_inquiries', label: 'Active Inquiries' },
  { id: 'awaiting_revision', label: 'Awaiting Revision' },
  { id: 'needs_sources', label: 'Needs Sources' },
  { id: 'needs_positions', label: 'Needs Positions' },
  { id: 'unresolved', label: 'Unresolved' },
  { id: 'external_docs', label: 'External Docs' },
];

const workPurposes: Array<{ id: WorkPurpose; label: string; description: string }> = [
  { id: 'explore', label: 'Explore', description: 'Find what you think by working through the material.' },
  { id: 'explain', label: 'Explain', description: 'Make an idea legible to yourself or someone else.' },
  { id: 'persuade', label: 'Persuade', description: 'Argue for a position and answer objections.' },
  { id: 'synthesize', label: 'Synthesize', description: 'Combine sources, concepts, and positions into one artifact.' },
  { id: 'reflect', label: 'Reflect', description: 'Clarify experience, change, or uncertainty.' },
  { id: 'document', label: 'Document', description: 'Preserve an observation, recording, sketch, or process.' },
  { id: 'teach', label: 'Teach', description: 'Turn understanding into a teachable structure.' },
  { id: 'challenge', label: 'Challenge', description: 'Pressure-test a claim or assumption.' },
  { id: 'imagine', label: 'Imagine', description: 'Generate a possible world, image, metaphor, or scenario.' },
];

const providerLabels: Record<ExternalDocProvider, string> = {
  google_docs: 'Google Docs',
  notion: 'Notion',
  dropbox_paper: 'Dropbox Paper',
  microsoft_word: 'Microsoft Word',
  markdown: 'Markdown / Text',
  other: 'Other',
};

const DRAFT_SAVE_FIELDS: Array<keyof Draft> = [
  'title',
  'label',
  'workPurpose',
  'purposeNote',
  'atlasRegion',
  'argumentSkeleton',
  'completionReflection',
  'body',
  'draftContent',
  'finalContent',
  'activeMode',
  'workCategory',
  'paperType',
  'activeRibbon',
  'recordingType',
  'durationSeconds',
  'fileUrl',
  'storagePath',
  'thumbnailUrl',
  'canvasData',
  'writingOverlayData',
  'writingStyle',
  'externalDoc',
  'conceptTags',
  'sourceIds',
  'questionIds',
  'beliefIds',
  'status',
];

function detectProvider(url: string): ExternalDocProvider {
  if (url.includes('docs.google.com/document')) return 'google_docs';
  if (url.includes('notion.so')) return 'notion';
  if (url.includes('paper.dropbox.com')) return 'dropbox_paper';
  if (url.includes('office.com') || url.includes('sharepoint.com') || url.includes('onedrive.live.com')) return 'microsoft_word';
  if (url.endsWith('.md') || url.endsWith('.txt')) return 'markdown';
  return 'other';
}

function extractDocumentId(url: string) {
  const google = url.match(/docs\.google\.com\/document\/d\/([^/]+)/)?.[1];
  if (google) return google;
  const publishedGoogle = url.match(/docs\.google\.com\/document\/d\/e\/([^/]+)/)?.[1];
  if (publishedGoogle) return publishedGoogle;
  return undefined;
}

function canvasStyleForWriting(style: WritingStyle): { color: PaperColor; pattern: PaperPattern } {
  switch (style) {
    case 'ruled_notebook':
    case 'manuscript':
      return { color: 'blank', pattern: 'notebook' };
    case 'mind_map':
    case 'timeline':
      return { color: 'blank', pattern: 'grid' };
    case 'cornell_notes':
    case 'two_column_debate':
    case 'dialectic':
    case 'belief_audit':
    case 'source_analysis':
      return { color: 'warm', pattern: 'none' };
    default:
      return { color: 'blank', pattern: 'none' };
  }
}

function draftSaveSignature(draft: Draft | null | undefined) {
  if (!draft) return '';
  return JSON.stringify(
    DRAFT_SAVE_FIELDS.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = draft[key];
      return acc;
    }, {})
  );
}

function splitWorkLines(value?: string) {
  return (value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinWorkLines(value?: string[]) {
  return (value || []).join('\n');
}

function isWritingWork(draft: Draft) {
  return (draft.workCategory || workCategoryForDraft(draft.type)) === 'writing';
}

function plainTextFromDraft(draft: Draft) {
  return (draft.body || draft.draftContent || draft.finalContent || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCountForDraft(draft: Draft) {
  return plainTextFromDraft(draft).split(/\s+/).filter(Boolean).length;
}

function formatDuration(seconds?: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatEdited(date?: string) {
  if (!date) return 'Edited recently';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Edited recently';
  return `Edited ${value.toLocaleDateString()}`;
}

function workTypePresentation(draft: Draft): {
  label: string;
  ariaLabel: string;
  action: string;
  Icon: React.ComponentType<{ className?: string }>;
  BadgeIcon?: React.ComponentType<{ className?: string }>;
} {
  if (draft.type === 'recording') {
    return { label: 'Recording', ariaLabel: 'Video recording', action: 'Play recording', Icon: CirclePlay };
  }
  if (draft.type === 'drawing') {
    return { label: 'Drawing', ariaLabel: 'Drawing work', action: 'Edit drawing', Icon: PenTool };
  }
  if (draft.type === 'voice_note') {
    return { label: 'Quick Note - Voice', ariaLabel: 'Voice quick note', action: 'Play voice note', Icon: NotebookPen, BadgeIcon: CirclePlay };
  }
  if (draft.type === 'drawing_note') {
    return { label: 'Quick Note - Drawing', ariaLabel: 'Drawing quick note', action: 'Open drawing note', Icon: NotebookPen, BadgeIcon: PenTool };
  }
  if (draft.type === 'text_note' || draft.type === 'talk_to_text') {
    return { label: draft.type === 'talk_to_text' ? 'Quick Note - Talk' : 'Quick Note - Text', ariaLabel: 'Written quick note', action: 'Open note', Icon: NotebookPen, BadgeIcon: PencilLine };
  }
  return { label: 'Writing', ariaLabel: 'Writing work', action: 'Continue writing', Icon: PencilLine };
}

function WorkTypeMark({ draft }: { draft: Draft }) {
  const presentation = workTypePresentation(draft);
  const Icon = presentation.Icon;
  const BadgeIcon = presentation.BadgeIcon;
  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/5 shadow-sm" aria-label={presentation.ariaLabel} title={presentation.ariaLabel}>
      <Icon className="size-5 text-accent" aria-hidden="true" />
      {BadgeIcon && (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-background bg-accent text-accent-foreground shadow-sm">
          <BadgeIcon className="size-3" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

function workReadiness(draft: Draft, questions: Question[]) {
  const category = draft.workCategory || workCategoryForDraft(draft.type);
  const linkedActiveInquiry = (draft.questionIds || []).some((questionId) => {
    const question = questions.find((item) => item.id === questionId);
    return question && !['resolved', 'answered', 'archived', 'suspended', 'converted', 'no_longer_meaningful'].includes(question.status);
  });
  const structureParts = [
    draft.argumentSkeleton?.centralClaim,
    ...(draft.argumentSkeleton?.supportingClaims || []),
    ...(draft.argumentSkeleton?.objections || []),
    draft.argumentSkeleton?.conclusion,
  ].filter((item) => item && String(item).trim());
  const gaps: string[] = [];
  if (draft.type === 'source_analysis' && !(draft.sourceIds || []).length) gaps.push('sources');
  if (draft.type === 'argument' && !(draft.beliefIds || []).length) gaps.push('positions');
  if (linkedActiveInquiry && !draft.completionReflection?.unresolved?.trim()) gaps.push('unresolved question');

  let label = 'in progress';
  let nextAction = 'Keep creating. Add links, sources, or reflection only when they help the work.';
  if (gaps.includes('sources')) {
    label = 'needs sources';
    nextAction = 'Link the source material this analysis is responding to.';
  } else if (gaps.includes('positions')) {
    label = 'needs position';
    nextAction = 'Link the position this argument is expressing, challenging, or revising.';
  } else if (gaps.includes('unresolved question')) {
    label = 'unresolved';
    nextAction = 'Record what question remains open or what this work still cannot answer.';
  } else if (draft.completionReflection?.unresolved?.trim()) {
    label = 'awaiting revision';
    nextAction = 'Resolve, narrow, or preserve the unresolved thread before finalizing.';
  } else if (draft.status === 'final' || draft.status === 'published') {
    label = 'ready to review';
    nextAction = 'Review coherence against linked positions, sources, and objections.';
  }

  return {
    category,
    linkedActiveInquiry,
    structureCount: structureParts.length,
    gaps,
    label,
    nextAction,
  };
}

export function Atelier({ drafts, media, vault, questions, concepts, writingDefaults, onAddDraft, onUpdateDraft, onDeleteDraft, onAddConcept, focusedDraftId, onOpenDraftRoute }: AtelierProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<WorkFilter>('all');
  const [workTab, setWorkTab] = useState<WorkTab>('all');
  const [search, setSearch] = useState('');
  const [isWorkTypeOpen, setIsWorkTypeOpen] = useState(false);
  const [isNoteTypeOpen, setIsNoteTypeOpen] = useState(false);
  const [workLauncher, setWorkLauncher] = useState<{ purpose: WorkPurpose; note: string }>({ purpose: 'explore', note: '' });
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [docDraft, setDocDraft] = useState({ title: '', url: '', provider: 'google_docs' as ExternalDocProvider, autoSync: true });
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [draftBuffer, setDraftBuffer] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Draft | null>(null);

  const [viewMode, setViewMode] = useState<PageViewMode>('vertical-single');
  const [pageSize, setPageSize] = useState<PageSize>('letter');
  const [paperColor, setPaperColor] = useState<PaperColor>('blank');
  const [paperPattern, setPaperPattern] = useState<PaperPattern>('none');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [writingTool, setWritingTool] = useState<WritingTool>('text');
  const [writingStrokeColor, setWritingStrokeColor] = useState('#4c1d95');
  const [writingStrokeSize, setWritingStrokeSize] = useState(3);
  const [playingWorkId, setPlayingWorkId] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);

  const { toast } = useToast();
  const activeFromStore = drafts.find((draft) => draft.id === activeId) || null;
  const active = draftBuffer || activeFromStore;
  const activeCategory = active ? active.workCategory || workCategoryForDraft(active.type) : null;
  const activeStoreSignature = useMemo(() => draftSaveSignature(activeFromStore), [activeFromStore]);
  const draftBufferSignature = useMemo(() => draftSaveSignature(draftBuffer), [draftBuffer]);

  useEffect(() => {
    if (!focusedDraftId) {
      setActiveId(null);
      return;
    }
    if (drafts.some((draft) => draft.id === focusedDraftId)) {
      setActiveId(focusedDraftId);
    }
  }, [drafts, focusedDraftId]);

  const visibleDrafts = drafts
    .filter((draft) => {
      const category = draft.workCategory || workCategoryForDraft(draft.type);
      const readiness = workReadiness(draft, questions);
      if (workTab !== 'all' && category !== workTab) return false;
      if (filter === 'all') return true;
      if (filter === 'active_inquiries') {
        return (draft.questionIds || []).some((questionId) => {
          const question = questions.find((item) => item.id === questionId);
          return question && !['resolved', 'answered', 'archived', 'suspended', 'converted', 'no_longer_meaningful'].includes(question.status);
        });
      }
      if (filter === 'awaiting_revision') {
        return ['rough', 'drafting', 'developing', 'revising', 'revised'].includes(draft.status)
          || Boolean(draft.argumentSkeleton?.objections?.length)
          || Boolean(draft.completionReflection?.unresolved);
      }
      if (filter === 'needs_sources') return readiness.gaps.includes('sources');
      if (filter === 'needs_positions') return readiness.gaps.includes('positions');
      if (filter === 'unresolved') return Boolean(draft.completionReflection?.unresolved?.trim()) || readiness.gaps.includes('unresolved question');
      if (filter === 'external_docs') return Boolean(draft.externalDoc);
      return draft.type === filter || draft.status === filter;
    })
    .filter((draft) => !search || draft.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime());

  const workStats = useMemo(() => ({
    total: drafts.length,
    writing: drafts.filter((draft) => (draft.workCategory || workCategoryForDraft(draft.type)) === 'writing').length,
    notes: drafts.filter((draft) => (draft.workCategory || workCategoryForDraft(draft.type)) === 'notes').length,
    linkedDocs: drafts.filter((draft) => !!draft.externalDoc).length,
    awaitingRevision: drafts.filter((draft) =>
      ['rough', 'drafting', 'developing', 'revising', 'revised'].includes(draft.status)
      || Boolean(draft.argumentSkeleton?.objections?.length)
      || Boolean(draft.completionReflection?.unresolved)
    ).length,
    needsSources: drafts.filter((draft) => workReadiness(draft, questions).gaps.includes('sources')).length,
    needsPositions: drafts.filter((draft) => workReadiness(draft, questions).gaps.includes('positions')).length,
    unresolved: drafts.filter((draft) => Boolean(draft.completionReflection?.unresolved?.trim()) || workReadiness(draft, questions).gaps.includes('unresolved question')).length,
  }), [drafts, questions]);

  const clearWorkFilters = () => {
    setSearch('');
    setWorkTab('all');
    setFilter('all');
  };

  const workFiltersActive = Boolean(search || workTab !== 'all' || filter !== 'all');
  const workFilterLabel = workViewFilters.find((item) => item.id === filter)?.label
    || DRAFT_LABELS[filter as DraftType]
    || filter.replace(/_/g, ' ');
  const activeWorkFilterLabels = [
    search ? `Search: ${search}` : null,
    workTab !== 'all' ? `Category: ${WORK_CATEGORY_LABELS[workTab]}` : null,
    filter !== 'all' ? `View: ${workFilterLabel}` : null,
  ].filter(Boolean) as string[];

  const updateActive = useCallback((patch: Partial<Draft>) => {
    const base = draftBuffer || activeFromStore;
    if (!base) return;
    const next = { ...base, ...patch, dateUpdated: today() };
    if (draftSaveSignature(next) === draftSaveSignature(base)) return;
    setDraftBuffer(next);
    setDirty(true);
    setSaveStatus('unsaved');
  }, [activeFromStore, draftBuffer]);

  const openDraft = useCallback((id: string) => {
    setActiveId(id);
    onOpenDraftRoute?.(id);
  }, [onOpenDraftRoute]);

  const closeDraft = useCallback(() => {
    setActiveId(null);
    onOpenDraftRoute?.(null);
  }, [onOpenDraftRoute]);

  const saveActive = useCallback((patch?: Partial<Draft>) => {
    if (!active) return null;
    const nextDraft = { ...active, ...patch, dateUpdated: today() };
    setDraftBuffer(nextDraft);
    setSaveStatus('saving');
    onUpdateDraft(nextDraft);
    setDirty(false);
    window.setTimeout(() => setSaveStatus('saved'), 600);
    return nextDraft;
  }, [active, onUpdateDraft]);

  const handleUpdateContent = useCallback((newContent: string) => {
    const clean = sanitizeHtml(newContent);
    if (active?.activeMode === 'final') {
      updateActive({ body: clean, finalContent: clean });
    } else {
      updateActive({ body: clean, draftContent: clean });
    }
  }, [active?.activeMode, updateActive]);

  const exportManuscript = () => {
    if (!active) return;
    const content = `# ${active.title}\n\nType: ${DRAFT_LABELS[active.type]}\nStatus: ${active.status}\nConcepts: ${(active.conceptTags || []).join(', ')}\n\n---\n\n${active.body.replace(/<[^>]+>/g, '\n')}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${active.title.replace(/\s+/g, '_')}_Noesis_Export.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Manuscript Exported', description: 'Your synthesis is ready as a Markdown file.' });
  };

  const spawnDraft = (type: DraftType, title?: string) => {
    const category = workCategoryForDraft(type);
    const baseTitle =
      title ||
      (type === 'recording'
        ? 'Untitled Recording'
        : type === 'drawing' || type === 'drawing_note'
          ? 'Untitled Drawing'
          : type === 'voice_note'
            ? 'Untitled Voice Note'
            : type === 'talk_to_text'
              ? 'Untitled Talk-to-Text'
              : type === 'text_note'
                ? 'Untitled Text Note'
                : 'Untitled Writing');
    const created = onAddDraft({
      title: baseTitle,
      type,
      label: DRAFT_LABELS[type],
      workPurpose: workLauncher.purpose,
      purposeNote: workLauncher.note,
      body: '',
      draftContent: '',
      finalContent: '',
      activeMode: 'draft',
      workCategory: category,
      paperType: writingDefaults.writingStyle,
      activeRibbon: type === 'drawing' || type === 'drawing_note' ? 'drawing' : 'writing',
      recordingType: type === 'recording' || type === 'voice_note' ? 'screen' : undefined,
      status: writingDefaults.status,
      writingStyle: writingDefaults.writingStyle,
      conceptTags: [],
      sourceIds: [],
      questionIds: [],
      beliefIds: [],
      dateCreated: today(),
      dateUpdated: today(),
    });
    setIsWorkTypeOpen(false);
    setIsNoteTypeOpen(false);
    setWorkTab(category);
    setFilter('all');
    openDraft(created.id);
    toast({
      title: `${DRAFT_LABELS[type]} opened`,
      description:
        type === 'recording'
          ? 'The recording studio is ready.'
          : type === 'drawing' || type === 'drawing_note'
            ? 'Your drawing space is ready.'
            : type === 'voice_note'
              ? 'Voice capture is ready.'
              : 'Your new work is ready to develop.',
    });
  };

  const openDocDialog = () => {
    if (!active) return;
    setDocDraft({
      title: active.externalDoc?.title || active.title || '',
      url: active.externalDoc?.url || '',
      provider: active.externalDoc?.provider || 'google_docs',
      autoSync: active.externalDoc?.autoSync ?? true,
    });
    setIsDocOpen(true);
  };

  const connectExternalDoc = () => {
    if (!active || !docDraft.url.trim()) return;
    const url = docDraft.url.trim();
    const provider = docDraft.provider || detectProvider(url);
    updateActive({
      externalDoc: {
        provider,
        title: docDraft.title.trim() || active.title,
        url,
        documentId: extractDocumentId(url),
        autoSync: docDraft.autoSync,
        syncStatus: 'connected',
      },
    });
    setIsDocOpen(false);
  };

  const detachExternalDoc = () => {
    if (!active) return;
    const { externalDoc, ...rest } = active;
    setDraftBuffer(rest);
    setDirty(true);
    setSaveStatus('unsaved');
  };

  const syncExternalDoc = async (draft: Draft) => {
    if (!draft.externalDoc?.url || syncingId === draft.id) return;
    setSyncingId(draft.id);
    updateActive({ externalDoc: { ...draft.externalDoc, syncStatus: 'syncing', syncError: '' } });
    try {
      const response = await fetch('/api/import-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: draft.externalDoc.url, provider: draft.externalDoc.provider }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Document sync failed.');
      const importedBody = escapeTextAsHtml(result.text);
      updateActive({
        body: importedBody,
        ...(draft.activeMode === 'final' ? { finalContent: importedBody } : { draftContent: importedBody }),
        externalDoc: {
          ...draft.externalDoc,
          lastSyncedAt: result.importedAt || today(),
          syncStatus: 'synced',
          syncError: result.truncated ? 'Imported text was truncated to keep the draft responsive.' : '',
        },
      });
    } catch (error) {
      updateActive({
        externalDoc: {
          ...draft.externalDoc,
          syncStatus: 'error',
          syncError: error instanceof Error ? error.message : 'Document sync failed.',
        },
      });
    } finally {
      setSyncingId(null);
    }
  };

  useEffect(() => {
    if (!activeFromStore) {
      setDraftBuffer(null);
      setDirty(false);
      setSaveStatus('saved');
      return;
    }
    if (!draftBuffer || draftBuffer.id !== activeFromStore.id) {
      setDraftBuffer(activeFromStore);
      setDirty(false);
      setSaveStatus('saved');
      return;
    }
    if (!dirty && activeStoreSignature !== draftBufferSignature) {
      setDraftBuffer(activeFromStore);
      setSaveStatus('saved');
    }
  }, [activeFromStore, activeStoreSignature, draftBuffer, draftBufferSignature, dirty]);

  useEffect(() => {
    const style = active?.writingStyle || writingDefaults.writingStyle;
    const canvas = canvasStyleForWriting(style);
    setPaperColor(canvas.color);
    setPaperPattern(canvas.pattern);
  }, [active?.id, active?.writingStyle, writingDefaults.writingStyle]);

  useEffect(() => {
    if (!dirty || !draftBuffer) return;
    if (draftBufferSignature === activeStoreSignature) {
      setDirty(false);
      setSaveStatus('saved');
      return;
    }
    const timeout = window.setTimeout(() => {
      setSaveStatus('saving');
      onUpdateDraft({ ...draftBuffer, dateUpdated: today() });
      setDirty(false);
      window.setTimeout(() => setSaveStatus('saved'), 600);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [activeStoreSignature, draftBuffer, draftBufferSignature, dirty, onUpdateDraft]);

  useEffect(() => {
    if (!active?.externalDoc?.autoSync || active.externalDoc.syncStatus === 'syncing') return;
    const lastSynced = active.externalDoc.lastSyncedAt ? new Date(active.externalDoc.lastSyncedAt).getTime() : 0;
    if (Date.now() - lastSynced > 60_000) void syncExternalDoc(active);
    const interval = window.setInterval(() => {
      const latest = drafts.find((draft) => draft.id === active.id);
      if (latest?.externalDoc?.autoSync) void syncExternalDoc(latest);
    }, 120_000);
    return () => window.clearInterval(interval);
  }, [active?.id, active?.externalDoc?.autoSync]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeContent = active
    ? active.activeMode === 'final'
      ? active.finalContent || ''
      : active.draftContent || active.body || ''
    : '';

  const activeTypeLabel = active ? DRAFT_LABELS[active.type] : '';
  const showPaperControls = !!active && activeCategory === 'writing';
  const showExternalDocControls = !!active && activeCategory === 'writing';
  const activeSources = useMemo(() => {
    if (!active) return [];
    return media.filter((source) => (active.sourceIds || []).includes(source.id));
  }, [active, media]);
  const activePositions = useMemo(() => {
    if (!active) return [];
    return vault.filter((position) => (active.beliefIds || []).includes(position.id));
  }, [active, vault]);
  const activeInquiries = useMemo(() => {
    if (!active) return [];
    return questions.filter((question) => (active.questionIds || []).includes(question.id));
  }, [active, questions]);
  const workConcepts = useMemo(() => normalizeConceptTags(active?.conceptTags || []), [active?.conceptTags]);
  const unusedAnnotations = useMemo(() => {
    if (!active) return [];
    const linkedSourceIds = new Set(active.sourceIds || []);
    const activeConceptKeys = new Set(workConcepts.map((tag) => tag.toLowerCase()));
    return media
      .filter((source) => linkedSourceIds.has(source.id) || (source.tags || []).some((tag) => activeConceptKeys.has(tag.toLowerCase())))
      .flatMap((source) => (source.annotations || []).map((annotation) => ({ ...annotation, sourceTitle: source.title, sourceId: source.id })))
      .filter((annotation) => {
        const text = annotation.text || '';
        if (!text.trim()) return false;
        const annotationConcepts = normalizeConceptTags(annotation.conceptTags || []);
        return annotationConcepts.length === 0 || annotationConcepts.some((tag) => activeConceptKeys.has(tag.toLowerCase()));
      })
      .slice(0, 6);
  }, [active, media, workConcepts]);
  const coherenceSignals = useMemo(() => {
    if (!active) return [];
    const signals: Array<{ label: string; tone: 'support' | 'warning' | 'neutral'; detail: string }> = [];
    if (!activePositions.length) {
      signals.push({ label: 'No linked position', tone: 'warning', detail: 'This work may express claims that are not connected to Positions yet.' });
    }
    if (activePositions.some((position) => (position.evidenceAgainst || []).length > 0)) {
      signals.push({ label: 'Objection present', tone: 'warning', detail: 'At least one linked position has recorded opposition. Address it in the work.' });
    }
    if (!activeSources.length && activeCategory === 'writing') {
      signals.push({ label: 'No sources linked', tone: 'warning', detail: 'Long-form work should show what evidence or source material supports it.' });
    }
    if (!workConcepts.length) {
      signals.push({ label: 'No concepts linked', tone: 'neutral', detail: 'Add concepts so this artifact can reconnect to the rest of Noesis.' });
    }
    if (active.status === 'final' && (activePositions.length || activeSources.length)) {
      signals.push({ label: 'Ready to review', tone: 'support', detail: 'This work has linked material and can be checked for coherence.' });
    }
    return signals.slice(0, 5);
  }, [active, activeCategory, activePositions, activeSources, workConcepts]);

  if (active) {
    return (
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden font-body">
        <header className="px-8 pt-8 pb-4 border-b border-border/30 bg-background/80 backdrop-blur z-50">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <button
                onClick={closeDraft}
                className="font-code text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <ChevronLeft className="size-4" /> BACK TO WORKS
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-full border border-border/60 bg-card p-1 shadow-sm">
                  {(['draft', 'final'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateActive({ activeMode: mode, body: mode === 'final' ? active.finalContent || '' : active.draftContent || active.body || '' })}
                      className={cn(
                        'rounded-full px-3 py-1 font-code text-[9px] font-bold uppercase tracking-widest transition-colors',
                        (active.activeMode || 'draft') === mode ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {mode === 'draft' ? 'Drafting' : 'Final'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-code text-[9px] uppercase tracking-widest opacity-40 font-bold">STATUS</span>
                  <Select value={active.status} onValueChange={(value) => updateActive({ status: value as DraftStatus })}>
                    <SelectTrigger className="h-8 border-border/40 bg-background shadow-sm font-code text-[9px] uppercase tracking-wider rounded-full w-32 px-3 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s} className="font-code text-[9px] uppercase">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showPaperControls && (
                  <div className="flex items-center gap-3">
                    <span className="font-code text-[9px] uppercase tracking-widest opacity-40 font-bold">PAPER</span>
                    <Select value={active.writingStyle || writingDefaults.writingStyle} onValueChange={(value) => updateActive({ writingStyle: value as WritingStyle })}>
                      <SelectTrigger className="h-8 border-border/40 bg-background shadow-sm font-code text-[9px] uppercase tracking-wider rounded-full w-44 px-3 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WRITING_STYLES.map((style) => (
                          <SelectItem key={style} value={style} className="font-code text-[9px] uppercase">{WRITING_STYLE_LABELS[style]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {showExternalDocControls && (
                  <Button variant="outline" size="sm" onClick={openDocDialog} className="h-9 px-5 rounded-full font-bold shadow-sm bg-card border-border/60">
                    <Link2 className="size-4 mr-2" /> {active.externalDoc ? 'Doc' : 'Connect Doc'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => saveActive()} className="h-9 px-5 rounded-full font-bold shadow-sm bg-card border-border/60">
                  <Save className="size-4 mr-2" /> {dirty ? 'Save*' : 'Save'}
                </Button>
                {activeCategory === 'writing' && (
                  <Button variant="outline" size="sm" onClick={exportManuscript} className="h-9 px-5 rounded-full font-bold shadow-sm bg-card border-border/60">
                    <Download className="size-4 mr-2" /> Export
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(active)} className="h-9 w-9 rounded-full shadow-sm">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Input
                  className="bg-transparent border-none text-4xl font-headline font-bold focus-visible:ring-0 italic p-0 h-auto rounded-none shadow-none text-foreground placeholder:text-muted-foreground/20 flex-1"
                  value={active.title}
                  onChange={(event) => updateActive({ title: event.target.value })}
                  placeholder={`Enter ${activeTypeLabel} Title...`}
                />
                <div className="flex items-center gap-3 bg-muted/10 px-4 py-2 rounded-full border border-border/30">
                  <div className={cn('size-2 rounded-full', saveStatus === 'saved' ? 'bg-emerald-500' : saveStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-red-400')} />
                  <span className="font-code text-[9px] uppercase tracking-widest font-bold opacity-60">
                    {saveStatus === 'saved' ? 'Changes Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
                  </span>
                </div>
              </div>

              {showExternalDocControls && active.externalDoc && (
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-code text-[9px] uppercase tracking-widest text-accent font-bold">External Writing Source</div>
                    <p className="font-body text-sm italic text-foreground/80">
                      {providerLabels[active.externalDoc.provider]} - {active.externalDoc.title || active.title}
                    </p>
                    <p className="font-code text-[8px] uppercase tracking-widest text-muted-foreground mt-1">
                      {active.externalDoc.lastSyncedAt ? `Last synced ${new Date(active.externalDoc.lastSyncedAt).toLocaleString()}` : 'Not synced yet'}
                      {active.externalDoc.syncError ? ` - ${active.externalDoc.syncError}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => syncExternalDoc(active)} disabled={syncingId === active.id} className="rounded-full bg-card">
                      <RefreshCw className={cn('mr-2 size-4', syncingId === active.id && 'animate-spin')} /> Sync Now
                    </Button>
                    <Button variant="outline" size="sm" asChild className="rounded-full bg-card">
                      <a href={active.externalDoc.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 size-4" /> Open</a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={detachExternalDoc} className="rounded-full text-destructive hover:text-destructive">
                      <Unlink className="mr-2 size-4" /> Detach
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/10">
                <div className="flex items-center gap-4">
                  <span className="font-code text-[10px] uppercase tracking-widest opacity-40 font-bold">CONCEPTS</span>
                  <ConceptTagPicker
                    concepts={concepts}
                    value={active.conceptTags || []}
                    onChange={(tags) => updateActive({ conceptTags: normalizeConceptTags(tags) })}
                    onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
                    compact
                  />
                </div>

                {showPaperControls && (
                  <PageViewControls
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    paperColor={paperColor}
                    onPaperColorChange={setPaperColor}
                    paperPattern={paperPattern}
                    onPaperPatternChange={setPaperPattern}
                  />
                )}
              </div>
              {showPaperControls && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/30 bg-card/80 px-4 py-3">
                  <span className="font-code text-[9px] uppercase tracking-widest opacity-40 font-bold">PENCIL</span>
                  <Button variant={writingTool === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setWritingTool('text')} className="rounded-full">
                    <Type className="mr-2 size-4" /> Type
                  </Button>
                  <Button variant={writingTool === 'pencil' ? 'default' : 'outline'} size="sm" onClick={() => setWritingTool('pencil')} className="rounded-full">
                    <PencilLine className="mr-2 size-4" /> Pencil
                  </Button>
                  <Button variant={writingTool === 'eraser' ? 'default' : 'outline'} size="sm" onClick={() => setWritingTool('eraser')} className="rounded-full">
                    <Eraser className="mr-2 size-4" /> Erase
                  </Button>
                  <input type="color" value={writingStrokeColor} onChange={(event) => setWritingStrokeColor(event.target.value)} className="h-9 w-11 rounded border border-border bg-background p-1" aria-label="Pencil color" />
                  <input type="range" min={1} max={14} value={writingStrokeSize} onChange={(event) => setWritingStrokeSize(Number(event.target.value))} className="w-28" aria-label="Pencil size" />
                  <Button variant="outline" size="sm" onClick={() => updateActive({ writingOverlayData: '' })} className="rounded-full bg-card">
                    <Square className="mr-2 size-4" /> Clear Marks
                  </Button>
                </div>
              )}

            </div>
          </div>
        </header>

        <div className={cn(
          "grid min-h-0 flex-1 grid-cols-1 overflow-hidden",
          railCollapsed ? "lg:grid-cols-[minmax(0,1fr)_64px]" : "lg:grid-cols-[minmax(0,1fr)_340px]"
        )}>
          <div className="relative min-h-0 overflow-hidden">
            {activeCategory === 'writing' ? (
              <>
                <FormattingToolbar saveStatus={saveStatus} />
                <DocumentCanvas
                  content={activeContent}
                  onContentChange={handleUpdateContent}
                  viewMode={viewMode}
                  pageSize={pageSize}
                  paperColor={paperColor}
                  paperPattern={paperPattern}
                  writingStyle={active.writingStyle || writingDefaults.writingStyle}
                  title={active.title}
                  overlayData={active.writingOverlayData || ''}
                  onOverlayChange={(overlayData) => updateActive({ writingOverlayData: overlayData })}
                  overlayTool={writingTool}
                  overlayColor={writingStrokeColor}
                  overlayBrushSize={writingStrokeSize}
                />
              </>
            ) : active.type === 'recording' ? (
              <RecordingStudio draft={active} updateActive={updateActive} />
            ) : active.type === 'voice_note' ? (
              <RecordingStudio draft={active} updateActive={updateActive} audioOnly />
            ) : active.type === 'drawing' ? (
              <DrawingStudio draft={active} updateActive={updateActive} />
            ) : active.type === 'drawing_note' ? (
              <DrawingStudio draft={active} updateActive={updateActive} compact />
            ) : (
              <QuickNoteStudio draft={active} updateActive={updateActive} />
            )}
          </div>
          <WorkIntellectualRail
            active={active}
            sources={activeSources}
            positions={activePositions}
            inquiries={activeInquiries}
            concepts={workConcepts}
            annotations={unusedAnnotations}
            coherenceSignals={coherenceSignals}
            collapsed={railCollapsed}
            onCollapsedChange={setRailCollapsed}
          />
        </div>

        {showExternalDocControls && (
          <ExternalDocDialog
            open={isDocOpen}
            onOpenChange={setIsDocOpen}
            docDraft={docDraft}
            setDocDraft={setDocDraft}
            onConnect={connectExternalDoc}
          />
        )}
        <ConfirmActionDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="Delete work?"
          description={`This removes "${deleteTarget?.title || 'this work'}" from Works. Linked sources, inquiries, positions, practices, and Evolution history will remain.`}
          confirmLabel="Delete Work"
          destructive
          onConfirm={() => {
            if (!deleteTarget) return;
            onDeleteDraft(deleteTarget.id);
            if (activeId === deleteTarget.id) closeDraft();
            setDeleteTarget(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
      <PageHeader
        title="Works"
        description="Create writing, notes, drawings, and recordings that express the ideas gathered across Noesis."
        meta={
          <span className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            {workStats.total} works · {workStats.writing} writings · {workStats.notes} note{workStats.notes === 1 ? '' : 's'} · {workStats.awaitingRevision} need revision
          </span>
        }
        className="mb-5"
        actions={
          <Button onClick={() => setIsWorkTypeOpen(true)} size="sm" className="h-9 px-6 font-code text-[10px] tracking-widest rounded-full uppercase font-bold shadow-sm shadow-accent/20">
            <Plus className="mr-2 size-4" /> Add Work
          </Button>
        }
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search works..."
        resultCount={visibleDrafts.length}
        resultLabel="works"
        sortLabel="Updated newest first"
        activeFilterLabels={activeWorkFilterLabels}
        onClear={clearWorkFilters}
        clearDisabled={!workFiltersActive}
        className="mb-3"
      >
        <Select value={workTab} onValueChange={(value) => { setWorkTab(value as WorkTab); setFilter('all'); }}>
          <SelectTrigger className="w-48 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Work Category" />
          </SelectTrigger>
          <SelectContent>
            {workTabs.map((tab) => (
              <SelectItem key={tab} value={tab} className="font-code text-[10px] uppercase">
                {tab === 'all' ? 'All Categories' : WORK_CATEGORY_LABELS[tab]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(value) => setFilter(value as WorkFilter)}>
          <SelectTrigger className="w-48 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Work View" />
          </SelectTrigger>
          <SelectContent>
            {workViewFilters.map((item) => (
              <SelectItem key={item.id} value={item.id} className="font-code text-[10px] uppercase">{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterToolbar>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {workTab === 'notes' && ([
          { label: 'All notes', value: 'all' as WorkFilter },
          { label: 'Written', value: 'text_note' as WorkFilter },
          { label: 'Voice', value: 'voice_note' as WorkFilter },
          { label: 'Talk-to-text', value: 'talk_to_text' as WorkFilter },
          { label: 'Drawing', value: 'drawing_note' as WorkFilter },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(filter === item.value ? 'all' : item.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-widest transition-colors",
              filter === item.value ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        )))}
        {[
          { label: 'Needs sources', value: workStats.needsSources, filter: 'needs_sources' as WorkFilter },
          { label: 'Needs positions', value: workStats.needsPositions, filter: 'needs_positions' as WorkFilter },
          { label: 'Unresolved', value: workStats.unresolved, filter: 'unresolved' as WorkFilter },
          { label: 'Linked docs', value: workStats.linkedDocs, filter: 'external_docs' as WorkFilter },
        ].filter((item) => item.value > 0).map((item) => (
          <button
            key={item.filter}
            type="button"
            onClick={() => setFilter(filter === item.filter ? 'all' : item.filter)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-widest transition-colors",
              filter === item.filter ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
            )}
          >
            {item.label} {item.value}
          </button>
        ))}
      </div>

      {visibleDrafts.length > 0 && (
        <div className="mb-5 rounded-xl border border-border/50 bg-card/80 p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Continue</div>
            <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/50">Recently edited</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {visibleDrafts.slice(0, 4).map((draft) => {
              const presentation = workTypePresentation(draft);
              const ActionIcon = presentation.Icon;
              return (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => openDraft(draft.id)}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-background p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  <WorkTypeMark draft={draft} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-headline text-base font-bold italic text-foreground">{draft.title || 'Untitled Draft'}</span>
                    <span className="mt-1 block truncate font-code text-[8px] uppercase tracking-widest text-muted-foreground">{presentation.action} - {formatEdited(draft.dateUpdated)}</span>
                  </span>
                  <ActionIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleDrafts.map((draft) => (
          (() => {
            const hasActiveInquiry = (draft.questionIds || []).some((questionId) => {
              const question = questions.find((item) => item.id === questionId);
              return question && !['resolved', 'answered', 'archived', 'suspended', 'converted', 'no_longer_meaningful'].includes(question.status);
            });
            const needsRevision = ['rough', 'drafting', 'developing', 'revising', 'revised'].includes(draft.status)
              || Boolean(draft.argumentSkeleton?.objections?.length)
              || Boolean(draft.completionReflection?.unresolved);
            const readiness = workReadiness(draft, questions);
            const presentation = workTypePresentation(draft);
            const ActionIcon = presentation.Icon;
            const textPreview = plainTextFromDraft(draft);
            const wordCount = wordCountForDraft(draft);
            const linkCount = (draft.conceptTags || []).length + (draft.sourceIds || []).length + (draft.questionIds || []).length + (draft.beliefIds || []).length;
            const isPlayable = ['recording', 'voice_note'].includes(draft.type);
            const isPlaying = playingWorkId === draft.id;
            const thumbnail = draft.thumbnailUrl || (draft.type === 'drawing' || draft.type === 'drawing_note' ? draft.canvasData : undefined);
            const metadata =
              draft.type === 'recording'
                ? `${formatDuration(draft.durationSeconds)} - ${draft.fileUrl ? 'Saved recording' : 'No saved video'} - ${formatEdited(draft.dateUpdated)}`
                : draft.type === 'voice_note'
                  ? `${formatDuration(draft.durationSeconds)} - ${draft.fileUrl ? 'Saved audio' : 'No saved audio'} - ${linkCount} links`
                  : draft.type === 'drawing' || draft.type === 'drawing_note'
                    ? `${draft.canvasData ? 'Canvas saved' : 'Blank canvas'} - ${linkCount} links - ${formatEdited(draft.dateUpdated)}`
                    : `${wordCount} words - ${Math.max(1, Math.ceil(wordCount / 225))} min read - ${formatEdited(draft.dateUpdated)}`;
            return (
          <Card
            key={draft.id}
            className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-accent/20 bg-card p-4 rounded-xl shadow-md relative overflow-hidden md:p-5"
            onClick={() => openDraft(draft.id)}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <WorkTypeMark draft={draft} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/70 font-bold">
                      {presentation.label}
                    </span>
                    <Badge variant="outline" className="rounded-full border border-accent/20 bg-accent/5 font-code text-[8px] uppercase tracking-widest text-accent">
                      {draft.status}
                    </Badge>
                  </div>
                  {draft.workPurpose && (
                    <span className="mt-1 block font-code text-[8px] uppercase tracking-widest text-accent font-bold">
                      {draft.workPurpose}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {draft.externalDoc && <Cloud className="size-3.5 text-accent" aria-label="External document linked" />}
                {hasActiveInquiry && (
                  <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-tighter bg-accent/10 text-accent border-transparent rounded-full font-bold px-2 py-0.5">
                    Inquiry
                  </Badge>
                )}
                {needsRevision && (
                  <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-tighter bg-muted text-muted-foreground border-transparent rounded-full font-bold px-2 py-0.5">
                    Revise
                  </Badge>
                )}
                {!!readiness.gaps.length && (
                  <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-tighter bg-destructive/10 text-destructive border-transparent rounded-full font-bold px-2 py-0.5">
                    {readiness.gaps.length} gaps
                  </Badge>
                )}
              </div>
            </div>

            <h3 className="font-headline text-2xl font-bold italic leading-tight group-hover:text-accent transition-colors text-foreground mb-4">
              {draft.title || 'Untitled Draft'}
            </h3>

            <div className="mb-4 min-h-[150px] overflow-hidden rounded-xl border border-border/40 bg-muted/10">
              {isPlayable && isPlaying && draft.fileUrl ? (
                draft.type === 'recording' ? (
                  <video
                    src={draft.fileUrl}
                    controls
                    autoPlay
                    className="h-[150px] w-full bg-black object-contain"
                    onClick={(event) => event.stopPropagation()}
                    onPause={() => setPlayingWorkId((current) => current === draft.id ? null : current)}
                    onEnded={() => setPlayingWorkId(null)}
                  />
                ) : (
                  <div className="flex h-[150px] flex-col justify-center gap-3 p-4">
                    <audio
                      src={draft.fileUrl}
                      controls
                      autoPlay
                      className="w-full"
                      onClick={(event) => event.stopPropagation()}
                      onPause={() => setPlayingWorkId((current) => current === draft.id ? null : current)}
                      onEnded={() => setPlayingWorkId(null)}
                    />
                    <p className="line-clamp-2 text-sm italic text-muted-foreground">{textPreview || 'Voice note transcript or follow-up notes will appear here.'}</p>
                  </div>
                )
              ) : thumbnail ? (
                <div className="relative h-[150px]">
                  <img src={thumbnail} alt={`${presentation.label} preview for ${draft.title || 'untitled work'}`} className="h-full w-full object-contain bg-background" />
                  {isPlayable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <CirclePlay className="size-12 rounded-full bg-background/90 p-2 text-accent shadow-lg" />
                    </div>
                  )}
                </div>
              ) : isPlayable ? (
                <div className="flex h-[150px] flex-col items-center justify-center gap-3 p-4 text-center">
                  <CirclePlay className="size-12 text-accent/70" />
                  <p className="max-w-[18rem] text-sm italic text-muted-foreground">{draft.fileUrl ? 'Saved recording ready to play.' : 'Recording metadata exists, but no saved media file is attached yet.'}</p>
                </div>
              ) : draft.type === 'drawing' || draft.type === 'drawing_note' ? (
                <div className="flex h-[150px] flex-col items-center justify-center gap-3 p-4 text-center">
                  <PenTool className="size-10 text-accent/70" />
                  <p className="text-sm italic text-muted-foreground">{draft.canvasData ? 'Drawing preview saved.' : 'Blank drawing canvas.'}</p>
                </div>
              ) : (
                <div className="flex h-[150px] flex-col justify-between p-4">
                  <FileText className="size-6 text-accent/60" />
                  <p className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {textPreview || draft.purposeNote || 'No written content yet.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {(draft.workCategory || workCategoryForDraft(draft.type)) === 'writing' && (
                <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/60 rounded-full font-bold">
                  {WRITING_STYLE_LABELS[draft.writingStyle || writingDefaults.writingStyle]}
                </Badge>
              )}
              {(draft.conceptTags || []).slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/60 rounded-full font-bold">
                  {tag}
                </Badge>
              ))}
              {linkCount > 0 && (
                <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/60 rounded-full font-bold">
                  {linkCount} links
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/20 pt-4">
              <div className="min-w-0">
                <div className="truncate font-code text-[8px] uppercase tracking-widest text-muted-foreground/50 font-bold">
                  {metadata}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{readiness.label}</Badge>
                  {!!readiness.gaps.length && <span className="font-code text-[8px] uppercase tracking-widest text-destructive">{readiness.gaps.length} gaps</span>}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isPlaying ? 'default' : 'outline'}
                className="h-10 shrink-0 rounded-full px-3 font-code text-[9px] uppercase tracking-widest"
                aria-label={isPlaying ? `Pause ${presentation.ariaLabel}` : presentation.action}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isPlayable) {
                    if (!draft.fileUrl) {
                      openDraft(draft.id);
                      return;
                    }
                    setPlayingWorkId((current) => current === draft.id ? null : draft.id);
                    return;
                  }
                  openDraft(draft.id);
                }}
              >
                {isPlayable ? (isPlaying ? <CirclePause className="mr-1.5 size-4" /> : <CirclePlay className="mr-1.5 size-4" />) : <ActionIcon className="mr-1.5 size-4" />}
                {isPlayable ? (isPlaying ? 'Pause' : 'Play') : presentation.action}
              </Button>
            </div>
          </Card>
            );
          })()
        ))}

        <Card
          className="aspect-video rounded-xl border-2 border-dashed border-border/50 bg-card/70 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-card transition-all group shadow-sm hover:shadow-xl hover:-translate-y-1"
          onClick={() => setIsWorkTypeOpen(true)}
        >
          <div className="size-12 rounded-full bg-card flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md border border-border/30">
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <div className="readex-kicker text-muted-foreground font-bold text-[10px]">CREATE WORK</div>
        </Card>

        {visibleDrafts.length === 0 && (
          <div className="col-span-full">
            <PageEmptyState
              icon={PencilLine}
              title="No works found"
              description="Clear filters or create a writing, note, drawing, or recording to express what your system is producing."
              belongsHere="Essays, notes, recordings, drawings, external documents, and other artifacts where your philosophy becomes expression."
              whyItMatters="Works reveal ambiguity and force ideas to become shareable, revisable artifacts."
              firstAction="Create the smallest useful artifact: a note, draft, sketch, or recording. Let structure arrive after the idea starts moving."
              filterCause={workFiltersActive ? 'Current filters may be hiding existing works.' : undefined}
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {workFiltersActive && <Button variant="outline" onClick={clearWorkFilters} className="rounded-full">Clear filters</Button>}
                  <Button onClick={() => setIsWorkTypeOpen(true)} className="rounded-full"><Plus className="mr-1.5 size-4" /> Add work</Button>
                </div>
              }
            />
          </div>
        )}
      </div>

      <Dialog open={isWorkTypeOpen} onOpenChange={setIsWorkTypeOpen}>
        <DialogContent className="max-w-2xl border-none bg-card shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-3xl italic">Add Work</DialogTitle>
            <p className="text-sm italic text-muted-foreground">Choose the form first. You can link sources, positions, and structure later if the work asks for it.</p>
          </DialogHeader>
          <div className="grid gap-4 pt-4 sm:grid-cols-2">
            {[
              { title: 'Writing', description: 'Open a long-form writing document.', icon: PencilLine, onClick: () => spawnDraft('essay', 'Untitled Writing') },
              { title: 'Note', description: 'Choose a quick written, voice, or drawing note.', icon: NotebookPen, onClick: () => { setIsWorkTypeOpen(false); setIsNoteTypeOpen(true); } },
              { title: 'Recording', description: 'Open the video recording studio with camera and microphone.', icon: Camera, onClick: () => spawnDraft('recording') },
              { title: 'Drawing', description: 'Open a full visual thinking canvas.', icon: PenTool, onClick: () => spawnDraft('drawing') },
            ].map((option) => (
              <button
                key={option.title}
                onClick={option.onClick}
                className="rounded-full border border-border/60 bg-card px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-accent">
                    <option.icon className="size-5" />
                  </div>
                  <div>
                    <div className="font-headline text-2xl font-bold italic text-foreground">{option.title}</div>
                    <p className="mt-1 text-sm italic leading-5 text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoteTypeOpen} onOpenChange={setIsNoteTypeOpen}>
        <DialogContent className="max-w-xl border-none bg-card shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-3xl italic">Choose Note Type</DialogTitle>
            <p className="text-sm italic text-muted-foreground">Notes can start as voice, drawing, or text and stay lightweight.</p>
          </DialogHeader>
          <div className="grid gap-3 pt-4">
            {[
              { title: 'Voice Note', description: 'Capture a spoken thought.', type: 'voice_note' as DraftType },
              { title: 'Talk-to-Text', description: 'Dictate a note and refine the transcript.', type: 'talk_to_text' as DraftType },
              { title: 'Drawing Note', description: 'Sketch an idea or diagram.', type: 'drawing_note' as DraftType },
              { title: 'Text Note', description: 'Write a quick definition, fragment, or observation.', type: 'text_note' as DraftType },
            ].map((option) => (
              <button
                key={option.title}
                onClick={() => spawnDraft(option.type, `Untitled ${option.title}`)}
                className="rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="font-headline text-xl font-bold italic text-foreground">{option.title}</div>
                <p className="mt-1 text-sm italic leading-5 text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickNoteStudio({
  draft,
  updateActive,
}: {
  draft: Draft;
  updateActive: (patch: Partial<Draft>) => void;
}) {
  const recognitionRef = useRef<InstanceType<BrowserSpeechRecognitionCtor> | null>(null);
  const [dictationState, setDictationState] = useState<'idle' | 'listening' | 'unsupported' | 'error'>('idle');
  const [dictationError, setDictationError] = useState('');
  const isTalkToText = draft.type === 'talk_to_text';

  const startDictation = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionCtor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
    };
    const RecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setDictationState('unsupported');
      setDictationError('Speech-to-text is not supported in this browser.');
      return;
    }
    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      updateActive({
        body: transcript,
        draftContent: transcript,
      });
    };
    recognition.onerror = (event) => {
      setDictationState('error');
      setDictationError(event.error || 'Dictation could not continue.');
    };
    recognition.onend = () => setDictationState((current) => (current === 'error' ? current : 'idle'));
    recognitionRef.current = recognition;
    setDictationError('');
    setDictationState('listening');
    recognition.start();
  };

  const stopDictation = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setDictationState('idle');
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-8">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-accent">
            {draft.type === 'talk_to_text' ? <Mic className="size-5" /> : <Type className="size-5" />}
          </div>
          <div>
            <h2 className="font-headline text-2xl font-bold italic">
              {draft.type === 'talk_to_text' ? 'Talk-to-Text Note' : 'Quick Written Note'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {draft.type === 'talk_to_text'
                ? 'Dictate a thought, then clean it up without leaving Works.'
                : 'Fast capture for fragments, definitions, observations, and quick reflections.'}
            </p>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
        {isTalkToText && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
            <div>
              <p className="font-code text-[10px] font-bold uppercase tracking-widest text-accent">Dictation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dictationState === 'listening'
                  ? 'Listening now. Your transcript will update in the note body.'
                  : dictationState === 'unsupported'
                    ? 'Browser speech recognition is unavailable here.'
                    : 'Start dictation to capture a spoken draft, then refine it as text.'}
              </p>
              {dictationError && <p className="mt-1 text-sm text-destructive">{dictationError}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={startDictation} disabled={dictationState === 'listening'} className="rounded-full">
                <Mic className="mr-2 size-4" /> Start Dictation
              </Button>
              <Button onClick={stopDictation} disabled={dictationState !== 'listening'} variant="outline" className="rounded-full bg-background">
                Stop
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <Label className="readex-kicker text-[9px] font-bold uppercase">Note Body</Label>
          <textarea
            value={draft.body || ''}
            onChange={(event) => updateActive({ body: event.target.value, draftContent: event.target.value })}
            placeholder={isTalkToText ? 'Your dictated transcript will appear here. You can also type and revise it manually.' : 'Write the note you want to capture...'}
            className="min-h-[340px] w-full rounded-2xl border border-border bg-background px-4 py-4 text-base leading-7 text-foreground outline-none transition-colors focus:border-accent"
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-xs italic text-muted-foreground">
            Notes stay lightweight. You can still link concepts and reopen them later from Works.
          </p>
        </div>
      </Card>
    </div>
  );
}

function RecordingStudio({
  draft,
  updateActive,
  audioOnly = false,
}: {
  draft: Draft;
  updateActive: (patch: Partial<Draft>) => void;
  audioOnly?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [state, setState] = useState<'idle' | 'requesting' | 'ready' | 'recording' | 'stopped' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(draft.durationSeconds || 0);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (draft.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.fileUrl);
    };
  }, [draft.fileUrl]);

  useEffect(() => {
    let timer: number | undefined;
    if (state === 'recording') {
      timer = window.setInterval(() => setDuration((current) => current + 1), 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [state]);

  const requestMedia = async () => {
    setState('requesting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: audioOnly ? false : true,
        audio: true,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      setState('ready');
    } catch (err) {
      setState('error');
      setError(audioOnly ? 'Microphone access was denied. Please allow permission to record voice notes.' : 'Camera or microphone access was denied. Please allow permission to record video.');
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    try {
      chunksRef.current = [];
      const mimeType = audioOnly
        ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '')
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm');
      const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setState('saving');
        const blob = new Blob(chunksRef.current, { type: audioOnly ? 'audio/webm' : 'video/webm' });
        const fileUrl = await blobToDataUrl(blob);
        updateActive({
          fileUrl,
          durationSeconds: duration,
        });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (previewRef.current) {
          previewRef.current.src = fileUrl;
        }
        setState('stopped');
      };
      setDuration(0);
      recorder.start();
      setState('recording');
    } catch (err) {
      setState('error');
      setError(audioOnly ? 'Your browser does not support audio recording.' : 'Your browser does not support video recording.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setState('stopped');
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto p-8">
      <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-accent">
              {audioOnly ? <Mic className="size-5" /> : <Video className="size-5" />}
            </div>
            <div>
              <h2 className="font-headline text-2xl font-bold italic">{audioOnly ? 'Quick Voice Note' : 'Recording Studio'}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {audioOnly ? 'Capture an audio-only note without opening the full writing editor.' : 'Record video with camera and microphone, then save it back into Works.'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
            {state}
          </Badge>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          {!audioOnly ? (
            <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-black">
              {draft.fileUrl && (state === 'saved' || state === 'stopped') ? (
                <video ref={previewRef} src={draft.fileUrl} controls className="h-full w-full object-contain" />
              ) : (
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              )}
            </div>
          ) : (
            <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-border bg-background">
              {draft.fileUrl && (state === 'saved' || state === 'stopped') ? (
                <audio controls src={draft.fileUrl} className="w-full max-w-md" />
              ) : (
                <div className="text-center">
                  <Mic className="mx-auto size-10 text-accent" />
                  <p className="mt-3 text-sm text-muted-foreground">Microphone preview is ready once permission is granted.</p>
                </div>
              )}
            </div>
          )}
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </Card>

        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <div className="font-code text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recorder Status</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>{audioOnly ? 'Use this for fast audio capture inside Notes.' : 'Use this for camera + microphone recordings inside Works.'}</p>
            <p>Duration: <span className="font-code text-foreground">{duration}s</span></p>
            <p>{state === 'idle' && 'Waiting for permission.'}</p>
            <p>{state === 'ready' && 'Camera and microphone are ready.'}</p>
            <p>{state === 'recording' && 'Recording is in progress.'}</p>
            <p>{state === 'saving' && 'Preparing recorded media...'}</p>
            <p>{state === 'stopped' && 'Recording is staged. Use the top Save button to persist it.'}</p>
            <p>{state === 'saved' && 'Recording saved. You can reopen it later from Works.'}</p>
          </div>
          <div className="mt-6 space-y-2">
            <Label className="readex-kicker text-[9px] font-bold uppercase">Recording Notes</Label>
            <textarea
              value={draft.body || ''}
              onChange={(event) => updateActive({ body: event.target.value, draftContent: event.target.value })}
              placeholder={audioOnly ? 'Add a short summary or transcript note...' : 'Add context, notes, or a summary for this recording...'}
              className="min-h-[160px] w-full rounded-2xl border border-border bg-background px-4 py-4 text-sm leading-6 text-foreground outline-none transition-colors focus:border-accent"
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={requestMedia} variant="outline" className="rounded-full bg-background">
              <Camera className="mr-2 size-4" /> {audioOnly ? 'Enable Microphone' : 'Enable Camera'}
            </Button>
            <Button onClick={startRecording} disabled={state !== 'ready'} className="rounded-full">
              <Video className="mr-2 size-4" /> Start Recording
            </Button>
            <Button onClick={stopRecording} disabled={state !== 'recording'} variant="outline" className="rounded-full bg-background">
              Stop Recording
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
}

function DrawingStudio({
  draft,
  updateActive,
  compact = false,
}: {
  draft: Draft;
  updateActive: (patch: Partial<Draft>) => void;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#1f2937');
  const [brushSize, setBrushSize] = useState(4);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    setHistory((prev) => {
      const next = [...prev.slice(0, historyIndex + 1), data];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = compact ? 720 : 1120;
    const height = compact ? 420 : 680;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    if (draft.canvasData) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, width, height);
      image.src = draft.canvasData;
    } else {
      snapshot();
    }
  }, [compact, draft.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const point = getPoint(event);
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    snapshot();
    window.setTimeout(saveDrawing, 0);
  };

  const restoreHistory = (index: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !history[index]) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, parseInt(canvas.style.width, 10), parseInt(canvas.style.height, 10));
      window.setTimeout(saveDrawing, 0);
    };
    image.src = history[index];
    setHistoryIndex(index);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, parseInt(canvas.style.width, 10), parseInt(canvas.style.height, 10));
    snapshot();
    window.setTimeout(saveDrawing, 0);
  };

  const saveDrawing = () => {
    const data = canvasRef.current?.toDataURL('image/png');
    if (!data) return;
    updateActive({ canvasData: data, thumbnailUrl: data });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 overflow-y-auto p-8">
      <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl font-bold italic">{compact ? 'Quick Drawing Note' : 'Drawing Studio'}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {compact ? 'A lightweight sketch space for capturing visual ideas fast.' : 'A full visual thinking workspace for diagrams, sketches, and concept maps.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={tool === 'pen' ? 'default' : 'outline'} onClick={() => setTool('pen')} className="rounded-full">
              <PenTool className="mr-2 size-4" /> Pen
            </Button>
            <Button variant={tool === 'eraser' ? 'default' : 'outline'} onClick={() => setTool('eraser')} className="rounded-full">
              <Eraser className="mr-2 size-4" /> Eraser
            </Button>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-12 rounded border border-border bg-background p-1" />
            <input type="range" min={1} max={24} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="w-28" />
            <Button variant="outline" onClick={() => restoreHistory(Math.max(0, historyIndex - 1))} disabled={historyIndex <= 0} className="rounded-full bg-background">
              <Undo2 className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => restoreHistory(Math.min(history.length - 1, historyIndex + 1))} disabled={historyIndex >= history.length - 1} className="rounded-full bg-background">
              <Redo2 className="size-4" />
            </Button>
            <Button variant="outline" onClick={clearCanvas} className="rounded-full bg-background">
              <Square className="mr-2 size-4" /> Clear
            </Button>
          </div>
        </div>
      </Card>

      <div className={cn("grid gap-6", compact ? "xl:grid-cols-[1fr_320px]" : "xl:grid-cols-[1fr_360px]")}>
        <div className="overflow-auto rounded-2xl border border-border bg-muted/10 p-4">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              drawingRef.current = false;
            }}
            className="mx-auto block rounded-xl border border-border bg-white shadow-sm touch-none"
          />
        </div>
        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <div className="font-code text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Drawing Notes</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {compact ? 'Keep this quick. Use text for labels, context, or one sharp takeaway.' : 'Use text for labels, context, explanation, or the argument behind the sketch.'}
          </p>
          <textarea
            value={draft.body || ''}
            onChange={(event) => updateActive({ body: event.target.value, draftContent: event.target.value })}
            placeholder={compact ? 'Add a short note for this sketch...' : 'Explain the diagram, map the idea, or write the reasoning behind the drawing...'}
            className={cn(
              "mt-4 w-full rounded-2xl border border-border bg-background px-4 py-4 text-sm leading-6 text-foreground outline-none transition-colors focus:border-accent",
              compact ? "min-h-[220px]" : "min-h-[420px]"
            )}
          />
        </Card>
      </div>
    </div>
  );
}

function WorkIntellectualRail({
  active,
  sources,
  positions,
  inquiries,
  concepts,
  annotations,
  coherenceSignals,
  collapsed,
  onCollapsedChange,
}: {
  active: Draft;
  sources: Media[];
  positions: VaultEntry[];
  inquiries: Question[];
  concepts: string[];
  annotations: WorkRailAnnotation[];
  coherenceSignals: Array<{ label: string; tone: 'support' | 'warning' | 'neutral'; detail: string }>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const category = active.workCategory || workCategoryForDraft(active.type);
  const supportingMaterial = [
    ...sources.slice(0, 4).map((source) => `${source.title}${source.creator ? ` - ${source.creator}` : ''}`),
    ...positions.flatMap((position) => position.evidenceFor || []).slice(0, 3),
  ];
  const objections = [
    ...positions.flatMap((position) => position.evidenceAgainst || []),
    ...positions.filter((position) => ['challenged', 'uncertain', 'revised'].includes(position.status)).map((position) => `${position.title} is currently ${position.status}.`),
  ].slice(0, 5);
  const relatedClaims = positions.slice(0, 5).map((position) => position.statement || position.title);
  const unresolvedInquiries = inquiries
    .filter((question) => !['resolved', 'archived'].includes(question.status))
    .slice(0, 4)
    .map((question) => question.text);

  return (
    <aside className={cn(
      "hidden min-h-0 border-l border-border/40 bg-muted/10 lg:block",
      collapsed ? "overflow-hidden p-2" : "overflow-y-auto p-4"
    )}>
      {collapsed ? (
        <div className="flex h-full flex-col items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onCollapsedChange(false)}
            className="h-10 w-10 rounded-full bg-card"
            aria-label="Expand studio rail"
          >
            <ChevronLeft className="size-4 rotate-180" />
          </Button>
          <div className="h-px w-8 bg-border/60" />
          <div className="[writing-mode:vertical-rl] rotate-180 font-code text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
            Studio Rail
          </div>
          <Badge variant="outline" className="mt-auto rounded-full font-code text-[8px] uppercase tracking-widest">
            {sources.length + positions.length + inquiries.length + concepts.length}
          </Badge>
        </div>
      ) : (
      <div className="space-y-4">
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Studio Rail</div>
              <h3 className="mt-1 font-headline text-xl font-bold italic">Materials around this work</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                {WORK_CATEGORY_LABELS[category]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCollapsedChange(true)}
                className="h-8 w-8 rounded-full"
                aria-label="Collapse studio rail"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Use this rail when you want links and context nearby. The work itself stays first.
          </p>
        </Card>

        <RailSection
          title="Claims Expressed"
          empty="No linked positions yet. Link a Position when this work starts arguing for something."
          items={relatedClaims}
        />
        <RailSection
          title="Supporting Material"
          empty="No linked sources or supporting evidence yet."
          items={supportingMaterial}
        />
        <RailSection
          title="Unresolved Objections"
          empty="No objections are attached to the linked positions yet."
          items={objections}
          tone="warning"
        />
        <RailSection
          title="Relevant Concepts"
          empty="No concepts linked yet."
          items={concepts}
          compact
        />
        <RailSection
          title="Open Inquiries"
          empty="No inquiries are linked to this work."
          items={unresolvedInquiries}
        />
        <RailSection
          title="Unused Annotations"
          empty="No nearby annotations found from linked sources or concepts."
          items={annotations.map((annotation) => `${annotation.text} (${annotation.sourceTitle})`)}
        />

        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
          <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Coherence Review</div>
          <div className="mt-3 space-y-3">
            {coherenceSignals.length ? coherenceSignals.map((signal) => (
              <div
                key={`${signal.label}:${signal.detail}`}
                className={cn(
                  'rounded-xl border p-3',
                  signal.tone === 'warning' && 'border-destructive/30 bg-destructive/10 text-destructive',
                  signal.tone === 'support' && 'border-accent/30 bg-accent/10 text-accent',
                  signal.tone === 'neutral' && 'border-border/60 bg-muted/10 text-foreground'
                )}
              >
                <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] opacity-70">{signal.label}</div>
                <p className="mt-1 text-sm leading-5">{signal.detail}</p>
              </div>
            )) : (
              <p className="text-sm italic leading-6 text-muted-foreground">No coherence warnings yet. Add linked claims, concepts, sources, or inquiries to make the review sharper.</p>
            )}
          </div>
        </Card>
      </div>
      )}
    </aside>
  );
}

function RailSection({
  title,
  items,
  empty,
  tone = 'neutral',
  compact,
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: 'neutral' | 'warning';
  compact?: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{items.length}</Badge>
      </div>
      {items.length ? (
        <div className={cn('mt-3', compact ? 'flex flex-wrap gap-2' : 'space-y-2')}>
          {items.map((item, index) => compact ? (
            <Badge key={`${item}:${index}`} variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">
              {item}
            </Badge>
          ) : (
            <div
              key={`${item}:${index}`}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm leading-5',
                tone === 'warning' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border/50 bg-muted/10 text-foreground'
              )}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm italic leading-6 text-muted-foreground">{empty}</p>
      )}
    </Card>
  );
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function PaperPreview({ styleName }: { styleName: WritingStyle }) {
  return (
    <div className={cn(
      'relative h-24 overflow-hidden rounded-lg border border-border/50 bg-white',
      styleName === 'ruled_notebook' && 'bg-[linear-gradient(#e7dfd5_1px,transparent_1px)] bg-[length:100%_16px]',
      styleName === 'manuscript' && 'bg-[linear-gradient(#ece4da_1px,transparent_1px)] bg-[length:100%_22px]',
      styleName === 'cornell_notes' && 'after:absolute after:left-1/3 after:top-0 after:bottom-5 after:w-px after:bg-accent/30 before:absolute before:left-0 before:right-0 before:bottom-5 before:h-px before:bg-accent/30',
      styleName === 'two_column_debate' && 'after:absolute after:left-1/2 after:top-2 after:bottom-2 after:w-px after:bg-accent/30',
      styleName === 'dialectic' && 'bg-[linear-gradient(#e7dfd5_1px,transparent_1px)] bg-[length:100%_32%]',
      styleName === 'belief_audit' && 'after:absolute after:inset-3 after:rounded after:border after:border-dashed after:border-accent/30',
      styleName === 'source_analysis' && 'bg-[linear-gradient(#ece4da_1px,transparent_1px)] bg-[length:100%_33%]',
      styleName === 'mind_map' && 'after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-accent/40 before:absolute before:left-1/2 before:top-1/2 before:size-20 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-dashed before:border-accent/20',
      styleName === 'timeline' && 'before:absolute before:left-4 before:right-4 before:top-1/2 before:h-px before:bg-accent/40 after:absolute after:left-6 after:top-1/2 after:size-2 after:-translate-y-1/2 after:rounded-full after:bg-accent/50 after:shadow-[40px_0_0_hsl(var(--accent)/0.45),80px_0_0_hsl(var(--accent)/0.35)]'
    )}>
      <div className="absolute left-4 right-4 top-4 space-y-2 opacity-35">
        <div className="h-1.5 w-2/3 rounded bg-accent/30" />
        <div className="h-1 w-full rounded bg-accent/20" />
        <div className="h-1 w-3/4 rounded bg-accent/20" />
      </div>
    </div>
  );
}

function ExternalDocDialog({
  open,
  onOpenChange,
  docDraft,
  setDocDraft,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docDraft: { title: string; url: string; provider: ExternalDocProvider; autoSync: boolean };
  setDocDraft: React.Dispatch<React.SetStateAction<{ title: string; url: string; provider: ExternalDocProvider; autoSync: boolean }>>;
  onConnect: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-none shadow-2xl rounded-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="font-headline text-3xl italic">Connect External Document</DialogTitle>
          <p className="text-sm text-muted-foreground">Write in your preferred platform and let Noesis keep a synced copy when the document exposes readable text.</p>
        </DialogHeader>
        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">Platform</Label>
            <Select value={docDraft.provider} onValueChange={(value) => setDocDraft((prev) => ({ ...prev, provider: value as ExternalDocProvider }))}>
              <SelectTrigger className="h-11 rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(providerLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">Document Name</Label>
            <Input value={docDraft.title} onChange={(event) => setDocDraft((prev) => ({ ...prev, title: event.target.value }))} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">Document URL</Label>
            <Input
              value={docDraft.url}
              onChange={(event) => {
                const url = event.target.value;
                setDocDraft((prev) => ({ ...prev, url, provider: detectProvider(url) }));
              }}
              placeholder="Paste a Google Doc, Notion, Word, Markdown, or text link..."
              className="h-11"
            />
            <p className="text-xs text-muted-foreground italic">Auto-import works best with published Google Docs, public Markdown/text files, or pages that expose readable text.</p>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/10 p-4">
            <input type="checkbox" checked={docDraft.autoSync} onChange={(event) => setDocDraft((prev) => ({ ...prev, autoSync: event.target.checked }))} className="size-4 accent-accent" />
            <span className="text-sm font-body">Auto-sync while this draft is open</span>
          </label>
        </div>
        <DialogFooter className="pt-6 gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={onConnect} disabled={!docDraft.url.trim()} className="rounded-full bg-accent px-8">Connect Document</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
