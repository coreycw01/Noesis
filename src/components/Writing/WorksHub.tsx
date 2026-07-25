"use client";

import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  CirclePlay,
  Cloud,
  NotebookPen,
  PencilLine,
  PenTool,
  Plus,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { FilterToolbar, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { PageHeader } from '@/components/shared/PageHeader';
import type { Concept, Draft, DraftStatus, DraftType, Media, Question, UserPreferences, VaultEntry, WorkCategory } from '@/lib/types';
import { DRAFT_LABELS, WRITING_STYLE_LABELS, today, workCategoryForDraft } from '@/lib/readex';
import { searchMatches } from '@/lib/search';
import { cn } from '@/lib/utils';

type HubCategory = WorkCategory | 'all';
type HubStatus = 'all' | 'needs_revision' | 'external_docs' | DraftStatus;
type HubSort = 'updated' | 'created' | 'title';
type HubView = 'grid' | 'list';

interface WorksHubProps {
  drafts: Draft[];
  media: Media[];
  vault: VaultEntry[];
  questions: Question[];
  concepts: Concept[];
  writingDefaults: UserPreferences['writingDefaults'];
  onAddDraft: (data: Partial<Draft>) => Draft;
  onDeleteDraft: (id: string) => void;
  onNavigate: (view: 'writing', options?: { workId?: string | null }) => void;
}

const CATEGORIES: Array<{ value: HubCategory; label: string }> = [
  { value: 'all', label: 'All works' },
  { value: 'writing', label: 'Writing' },
  { value: 'notes', label: 'Notes' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'recording', label: 'Recording' },
];

const STATUS_OPTIONS: Array<{ value: HubStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'needs_revision', label: 'Needs revision' },
  { value: 'external_docs', label: 'External documents' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'final', label: 'Final' },
];

const NOTE_OPTIONS: Array<{ type: DraftType; title: string; description: string }> = [
  { type: 'text_note', title: 'Text note', description: 'A quick fragment, definition, or observation.' },
  { type: 'voice_note', title: 'Voice note', description: 'Capture a spoken thought and keep the audio with it.' },
  { type: 'talk_to_text', title: 'Talk-to-text', description: 'Dictate a note and refine the transcript later.' },
  { type: 'drawing_note', title: 'Drawing note', description: 'Pair a small sketch with a lightweight note.' },
];

function cleanText(draft: Draft) {
  return (draft.body || draft.draftContent || draft.finalContent || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(draft: Draft) {
  return cleanText(draft).split(/\s+/).filter(Boolean).length;
}

function isNeedsRevision(draft: Draft) {
  return ['rough', 'drafting', 'developing', 'revising', 'revised'].includes(draft.status);
}

function updatedLabel(date?: string) {
  if (!date) return 'Edited recently';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Edited recently' : `Edited ${parsed.toLocaleDateString()}`;
}

function durationLabel(seconds?: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function workLabel(draft: Draft) {
  const category = draft.workCategory || workCategoryForDraft(draft.type);
  if (category === 'writing') return draft.type === 'essay' ? 'Writing' : DRAFT_LABELS[draft.type];
  if (category === 'notes') return DRAFT_LABELS[draft.type];
  return category === 'drawing' ? 'Drawing' : 'Recording';
}

function workIcon(draft: Draft) {
  const category = draft.workCategory || workCategoryForDraft(draft.type);
  if (category === 'writing') return PencilLine;
  if (category === 'drawing') return PenTool;
  if (category === 'recording') return CirclePlay;
  return NotebookPen;
}

function createDraftPayload(type: DraftType, defaults: UserPreferences['writingDefaults']): Partial<Draft> {
  const category = workCategoryForDraft(type) as WorkCategory;
  const title = type === 'recording'
    ? 'Untitled Recording'
    : type === 'drawing' || type === 'drawing_note'
      ? 'Untitled Drawing'
      : type === 'voice_note'
        ? 'Untitled Voice Note'
        : type === 'talk_to_text'
          ? 'Untitled Talk-to-Text'
          : type === 'text_note'
            ? 'Untitled Text Note'
            : 'Untitled Writing';
  return {
    title,
    type,
    label: DRAFT_LABELS[type],
    body: '',
    draftContent: '',
    finalContent: '',
    activeMode: 'draft',
    workCategory: category,
    paperType: defaults.writingStyle,
    activeRibbon: category === 'drawing' ? 'drawing' : 'writing',
    recordingType: type === 'recording' || type === 'voice_note' ? 'screen' : undefined,
    status: defaults.status,
    writingStyle: defaults.writingStyle,
    drawingState: type === 'drawing' || type === 'drawing_note' ? {
      version: 1,
      width: type === 'drawing_note' ? 720 : 1120,
      height: type === 'drawing_note' ? 420 : 680,
      background: '#ffffff',
      activeLayerId: 'layer-1',
      layers: [{ id: 'layer-1', name: 'Sketch', visible: true, strokes: [] }],
    } : undefined,
    conceptTags: [],
    sourceIds: [],
    questionIds: [],
    beliefIds: [],
    dateCreated: today(),
    dateUpdated: today(),
  };
}

export function WorksHub({ drafts, media, vault, questions, concepts, writingDefaults, onAddDraft, onDeleteDraft, onNavigate }: WorksHubProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<HubCategory>('all');
  const [status, setStatus] = useState<HubStatus>('all');
  const [sort, setSort] = useState<HubSort>('updated');
  const [view, setView] = useState<HubView>('grid');
  const [addOpen, setAddOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Draft | null>(null);

  const counts = useMemo(() => ({
    total: drafts.length,
    writing: drafts.filter((draft) => (draft.workCategory || workCategoryForDraft(draft.type)) === 'writing').length,
    notes: drafts.filter((draft) => (draft.workCategory || workCategoryForDraft(draft.type)) === 'notes').length,
    revision: drafts.filter(isNeedsRevision).length,
  }), [drafts]);

  const visibleDrafts = useMemo(() => drafts
    .filter((draft) => {
      const draftCategory = (draft.workCategory || workCategoryForDraft(draft.type)) as WorkCategory;
      if (category !== 'all' && draftCategory !== category) return false;
      if (status === 'needs_revision' && !isNeedsRevision(draft)) return false;
      if (status === 'external_docs' && !draft.externalDoc) return false;
      if (status !== 'all' && status !== 'needs_revision' && status !== 'external_docs' && draft.status !== status) return false;
      return searchMatches(search, [
        { value: draft.title, label: 'title' },
        { value: cleanText(draft), label: 'content' },
        { value: draft.type, label: 'type' },
        { value: draft.status, label: 'status' },
        ...(draft.conceptTags || []).map((tag) => ({ value: tag, label: 'concept' })),
        ...media.filter((source) => (draft.sourceIds || []).includes(source.id)).flatMap((source) => [
          { value: source.title, label: 'source' },
          { value: source.creator, label: 'source creator' },
        ]),
        ...questions.filter((question) => (draft.questionIds || []).includes(question.id)).map((question) => ({ value: question.text, label: 'inquiry' })),
        ...vault.filter((position) => (draft.beliefIds || []).includes(position.id)).map((position) => ({ value: position.title, label: 'position' })),
        ...concepts.filter((concept) => (draft.conceptTags || []).some((tag) => tag.toLowerCase() === concept.name.toLowerCase())).map((concept) => ({ value: concept.name, label: 'concept' })),
      ]);
    })
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const left = sort === 'created' ? a.dateCreated : a.dateUpdated;
      const right = sort === 'created' ? b.dateCreated : b.dateUpdated;
      return new Date(right).getTime() - new Date(left).getTime();
    }), [category, concepts, drafts, media, questions, search, sort, status, vault]);

  const hasFilters = Boolean(search || category !== 'all' || status !== 'all');
  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setStatus('all');
  };

  const openNewDraft = (type: DraftType) => {
    const created = onAddDraft(createDraftPayload(type, writingDefaults));
    setAddOpen(false);
    setNoteOpen(false);
    if (created) onNavigate('writing', { workId: created.id });
  };

  const activeFilterLabels = [
    search ? `Search: ${search}` : null,
    category !== 'all' ? `Category: ${category}` : null,
    status !== 'all' ? `Status: ${status.replace(/_/g, ' ')}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-full w-full overflow-y-auto bg-background px-4 py-6 font-body sm:px-6 lg:px-8 xl:px-10">
      <PageHeader
        title="Works"
        description="Make the ideas in your system tangible through writing, notes, drawings, and recordings."
        meta={(
          <span className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {counts.total} works · {counts.writing} writings · {counts.notes} notes · {counts.revision} need revision
          </span>
        )}
        actions={(
          <Button type="button" onClick={() => setAddOpen(true)} className="h-9 rounded-full bg-accent px-5 font-code text-[10px] font-bold uppercase tracking-[0.14em] text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-1.5 size-4" /> Add work
          </Button>
        )}
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search works, concepts, sources..."
        resultCount={visibleDrafts.length}
        resultLabel="works"
        activeFilterLabels={activeFilterLabels}
        onClear={clearFilters}
        clearDisabled={!hasFilters}
        viewControl={<ViewModeToggle value={view} onChange={(value) => setView(value === 'list' ? 'list' : 'grid')} />}
        className="mb-5"
      >
        <Select value={category} onValueChange={(value) => setCategory(value as HubCategory)}>
          <SelectTrigger className="h-9 w-36 rounded-full border-border/50 bg-card font-code text-[9px] uppercase tracking-widest shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value} className="font-code text-[10px] uppercase">{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value as HubStatus)}>
          <SelectTrigger className="h-9 w-40 rounded-full border-border/50 bg-card font-code text-[9px] uppercase tracking-widest shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value} className="font-code text-[10px] uppercase">{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as HubSort)}>
          <SelectTrigger className="h-9 w-32 rounded-full border-border/50 bg-card font-code text-[9px] uppercase tracking-widest shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated" className="font-code text-[10px] uppercase">Recently edited</SelectItem>
            <SelectItem value="created" className="font-code text-[10px] uppercase">Date created</SelectItem>
            <SelectItem value="title" className="font-code text-[10px] uppercase">Title</SelectItem>
          </SelectContent>
        </Select>
      </FilterToolbar>

      {visibleDrafts.length === 0 ? (
        <PageEmptyState
          icon={PencilLine}
          title={hasFilters ? 'No works match these filters' : 'Start a work'}
          description={hasFilters ? 'Clear a filter or try a broader search.' : 'Choose the form that fits the idea in front of you.'}
          belongsHere="Writing, notes, drawings, recordings, and external documents that give your thinking a form."
          whyItMatters="Works are where ideas become shareable, revisable, and alive outside the page they came from."
          firstAction="Start with the smallest form that lets the idea move."
          filterCause={hasFilters ? 'Current filters may be hiding existing works.' : undefined}
          action={<Button type="button" onClick={() => (hasFilters ? clearFilters() : setAddOpen(true))} className="rounded-full">{hasFilters ? 'Clear filters' : 'Add work'}</Button>}
        />
      ) : (
        <>
          {visibleDrafts.length > 1 && (
            <section className="mb-5 rounded-xl border border-border/50 bg-card/70 p-3" aria-label="Continue working">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Continue</span>
                <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60">Recently edited</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {visibleDrafts.slice(0, 4).map((draft) => {
                  const Icon = workIcon(draft);
                  return <button key={draft.id} type="button" onClick={() => onNavigate('writing', { workId: draft.id })} className="flex min-w-0 items-center gap-3 rounded-lg border border-border/45 bg-background p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/8 text-accent"><Icon className="size-4" /></div><span className="min-w-0"><span className="block truncate font-headline text-base font-bold italic">{draft.title || 'Untitled work'}</span><span className="mt-0.5 block truncate font-code text-[8px] uppercase tracking-widest text-muted-foreground">{updatedLabel(draft.dateUpdated)}</span></span></button>;
                })}
              </div>
            </section>
          )}
          <div className={cn(view === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2')}>
          {visibleDrafts.map((draft) => {
            const Icon = workIcon(draft);
            const categoryLabel = workLabel(draft);
            const text = cleanText(draft);
            const linkCount = (draft.conceptTags || []).length + (draft.sourceIds || []).length + (draft.questionIds || []).length + (draft.beliefIds || []).length;
            const thumbnail = draft.thumbnailUrl || draft.canvasData;
            const isRecording = draft.type === 'recording' || draft.type === 'voice_note';
            return (
              <Card
                key={draft.id}
                className={cn('group border-border/60 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-lg', view === 'grid' ? 'overflow-hidden rounded-2xl' : 'rounded-xl')}
                onClick={() => onNavigate('writing', { workId: draft.id })}
              >
                <div className={cn('flex gap-4', view === 'grid' ? 'flex-col' : 'items-center p-3')}>
                  {view === 'grid' && (
                    <div className="relative flex h-40 items-center justify-center overflow-hidden border-b border-border/50 bg-muted/15">
                      {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-contain" /> : <Icon className="size-12 text-accent/45" aria-hidden="true" />}
                      {isRecording && <span className="absolute bottom-3 left-3 rounded-full border border-border/60 bg-background/90 px-2.5 py-1 font-code text-[9px] font-bold uppercase tracking-widest text-foreground">{durationLabel(draft.durationSeconds)}</span>}
                    </div>
                  )}
                  <div className={cn('min-w-0 flex-1', view === 'grid' ? 'p-4' : 'flex items-center gap-3')}>
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/5 text-accent"><Icon className="size-5" aria-hidden="true" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{categoryLabel}</span>
                          <Badge variant="outline" className="rounded-full border-border/70 font-code text-[8px] uppercase tracking-wider">{draft.status}</Badge>
                          {draft.externalDoc && <Cloud className="size-3.5 text-accent" aria-label="External document linked" />}
                        </div>
                        <h2 className="mt-2 truncate font-headline text-xl font-bold italic text-foreground transition-colors group-hover:text-accent">{draft.title || 'Untitled work'}</h2>
                      </div>
                    </div>
                    <p className={cn('mt-3 text-sm leading-6 text-muted-foreground', view === 'list' && 'line-clamp-1 md:mt-0 md:max-w-xl')}>{text || 'A blank creative surface waiting for its first mark.'}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 font-code text-[9px] uppercase tracking-wider text-muted-foreground/70">
                      {categoryLabel === 'Writing' || draft.workCategory === 'writing' ? <span>{wordCount(draft)} words</span> : null}
                      {isRecording ? <span>{durationLabel(draft.durationSeconds)}</span> : null}
                      {linkCount > 0 && <span>{linkCount} linked</span>}
                      <span>{updatedLabel(draft.dateUpdated)}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {(draft.conceptTags || []).slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="rounded-full bg-muted/45 font-code text-[8px] uppercase tracking-wider text-muted-foreground">{tag}</Badge>)}
                        {draft.writingStyle && (draft.workCategory || workCategoryForDraft(draft.type)) === 'writing' && <Badge variant="secondary" className="rounded-full bg-accent/8 font-code text-[8px] uppercase tracking-wider text-accent">{WRITING_STYLE_LABELS[draft.writingStyle]}</Badge>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${draft.title || 'work'}`} onClick={(event) => { event.stopPropagation(); setDeleteTarget(draft); }}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </div>
                  {view === 'list' && <ArrowUpRight className="mr-4 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />}
                </div>
              </Card>
            );
          })}
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-border/60 bg-card">
          <DialogHeader><DialogTitle className="font-headline text-3xl italic">Start a work</DialogTitle><p className="text-sm italic text-muted-foreground">Choose a creative surface. Structure and links can come later.</p></DialogHeader>
          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <LauncherButton icon={PencilLine} title="Writing" description="A full document with formatting, paper styles, export, and pencil annotation." onClick={() => openNewDraft('essay')} />
            <LauncherButton icon={NotebookPen} title="Note" description="A lightweight text, voice, talk-to-text, or drawing note." onClick={() => { setAddOpen(false); setNoteOpen(true); }} />
            <LauncherButton icon={PenTool} title="Drawing" description="A visual canvas with drawing tools and a companion note." onClick={() => openNewDraft('drawing')} />
            <LauncherButton icon={Camera} title="Recording" description="A recording workspace with permissions, preview, retake, and save." onClick={() => openNewDraft('recording')} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-border/60 bg-card">
          <DialogHeader><DialogTitle className="font-headline text-3xl italic">Choose a note</DialogTitle><p className="text-sm italic text-muted-foreground">Keep the note small and let it become something larger only when it needs to.</p></DialogHeader>
          <div className="space-y-2 pt-3">{NOTE_OPTIONS.map((option) => <button key={option.type} type="button" onClick={() => openNewDraft(option.type)} className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background p-4 text-left transition-colors hover:border-accent/45 hover:bg-accent/5"><NotebookPen className="size-5 shrink-0 text-accent" /><span><span className="block font-headline text-xl font-bold italic">{option.title}</span><span className="block text-sm text-muted-foreground">{option.description}</span></span></button>)}</div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete this work?"
        description={`This removes “${deleteTarget?.title || 'Untitled work'}” from Works. Linked sources, positions, inquiries, and history remain.`}
        confirmLabel="Delete work"
        destructive
        onConfirm={() => { if (deleteTarget) onDeleteDraft(deleteTarget.id); setDeleteTarget(null); }}
      />
    </div>
  );
}

function LauncherButton({ icon: Icon, title, description, onClick }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group rounded-xl border border-border/60 bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-md"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/5 text-accent"><Icon className="size-5" /></div><span><span className="block font-headline text-xl font-bold italic text-foreground group-hover:text-accent">{title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span></span></div></button>;
}
