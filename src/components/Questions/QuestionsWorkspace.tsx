
"use client";

import { aiDepthFor } from '@/lib/ai-depth';
import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, HelpCircle, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SourceLinker } from '@/components/SourceLinker';
import type { Concept, Draft, InquiryEvidence, Media, Practice, Question, VaultEntry } from '@/lib/types';
import { allQuestions, conceptKey, today, uid } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { InquiryLean } from '@/components/Questions/InquiryLean';
import { InquiryDetail } from '@/components/Questions/InquiryDetail';
import { NextMove, RecordTools } from '@/components/shared/RecordDetail';
import { activateEntityOnKey, isEntitySurfaceClick } from '@/lib/entity-activation';
import { StageBadge } from '@/components/shared/StageBadge';
import { useToast } from '@/hooks/use-toast';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { DetailLabel, PageHeader } from '@/components/shared/PageHeader';
import { ToolOption, ToolOptions, WorkbenchPanel } from '@/components/shared/WorkbenchPanel';
import { FilterToolbar, SortPill, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { COLLECTION_SORT_OPTIONS, sortCollection, type CollectionOrder } from '@/lib/collection-sort';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { ContextRail, EntityMeta, IntellectualRoleLabel } from '@/components/shared/IntellectualStructures';
import { searchMatches } from '@/lib/search';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import type { AiContextEnvelope } from '@/lib/contextual-ai';
import type { InquiryAiReview } from '@/lib/inquiry-ai-review';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  assignInquiryEvidence,
  inquiryHasRecordedObjection,
  MAX_INQUIRY_EVIDENCE,
  inquiryAiItemMemory,
  inquiryCandidateCount,
  inquiryFormation,
  inquiryFrameGaps,
  inquiryNeedsAssumptions,
  inquiryNeedsCandidateAnswers,
  inquiryNeedsEvidence,
  inquiryNextMove,
  inquiryReadyToResolve,
  inquirySourceIds,
  isInquiryActive,
  isInquiryClosed,
} from '@/lib/inquiry-state';

const EMPTY_EVIDENCE: Omit<InquiryEvidence, 'id' | 'date'> = { claim: '', type: 'source excerpt', origin: '', candidateId: '', direction: 'supports', strength: 'moderate', reliability: 'moderate', notes: '' };

interface QuestionsWorkspaceProps {
  aiSettings: import('@/lib/types').AiSettings;
  questions: Question[];
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  concepts: Concept[];
  onAddQuestion: (data: Partial<Question>) => Promise<Question>;
  onUpdateQuestion: (question: Question) => void | Promise<void>;
  onSaveAiReview: (inquiryId: string, review: InquiryAiReview, content: string) => Promise<void>;
  onDeleteQuestion: (id: string) => void | Promise<void>;
  onAddVaultEntry: (data: Partial<VaultEntry>) => void;
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onLinkItem: (inquiryId: string, type: 'work' | 'practice', itemId: string) => Promise<void>;
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onOpenWork: (id: string) => void;
  onOpenPractice: (id: string) => void;
  onOpenPosition: (id: string) => void;
  onOpenAnnotation: (sourceId: string, annotationId: string) => void;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => Promise<VaultEntry>;
  focusedQuestionId?: string | null;
  onFocusedQuestionHandled?: () => void;
  onOpenQuestionRoute?: (id: string | null) => void;
}

type FilterType = 'all' | 'active' | 'complete' | 'needs_frame' | 'awaiting_evidence' | 'needs_assumptions' | 'needs_candidates' | 'ready_to_resolve' | 'comparing_answers' | 'enduring' | 'partially_answered' | 'suspended' | 'resolved' | 'annotations';

const INQUIRY_FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  active: 'Active Investigations',
  complete: 'Complete',
  needs_frame: 'Needs Frame',
  awaiting_evidence: 'Awaiting Evidence',
  needs_assumptions: 'Needs Assumptions',
  needs_candidates: 'Needs Candidate Answers',
  ready_to_resolve: 'Ready To Resolve',
  comparing_answers: 'Comparing Answers',
  enduring: 'Enduring Questions',
  partially_answered: 'Partially Answered',
  suspended: 'Suspended / Archived',
  resolved: 'Resolved',
  annotations: 'From Annotations',
};

const PRIMARY_INQUIRY_FILTERS: FilterType[] = [
  'all',
  'active',
  'complete',
  'needs_frame',
  'awaiting_evidence',
  'ready_to_resolve',
];

const RESOLUTION_OPTIONS: Array<{ status: Question['status']; label: string; description: string }> = [
  { status: 'provisionally_answered', label: 'Provisionally Answered', description: 'The answer is useful, but still open to revision.' },
  { status: 'suspended', label: 'Suspend', description: 'Not enough evidence or attention to proceed right now.' },
  { status: 'enduring', label: 'Enduring Question', description: 'Keep this alive as a long-term question rather than closing it.' },
  { status: 'no_longer_meaningful', label: 'No Longer Meaningful', description: 'The question no longer frames the issue well.' },
  { status: 'resolved', label: 'Resolved', description: 'A resolution summary exists and the current investigation can close.' },
];

function inquiryCardNextStep(question: Question) {
  return inquiryNextMove(question);
}

function conceptReferenceLabel(reference: string, concepts: Concept[]) {
  const matched = concepts.find((concept) => concept.id === reference || conceptKey(concept.name) === conceptKey(reference));
  if (matched) return matched.name;
  return reference
    .replace(/^c[_-]/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const EMPTY_INQUIRY_DRAFT = { text: '', whyItMatters: '', uncertainty: '', sourceIds: [] as string[] };

export function QuestionsWorkspace({ aiSettings, questions, media, vault, drafts, practices, concepts, onAddQuestion, onUpdateQuestion, onSaveAiReview, onDeleteQuestion, onAddVaultEntry, onAddDraft, onLinkItem, onAddPractice, onOpenWork, onOpenPractice, onOpenPosition, onOpenAnnotation, onFormPositionFromInquiry, focusedQuestionId, onFocusedQuestionHandled, onOpenQuestionRoute }: QuestionsWorkspaceProps) {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = usePersistentView<CollectionOrder>('noesis:inquiry-sort', 'newest', ['newest', 'oldest', 'name']);
  const [viewMode, setViewMode] = useEntityViewPreference('inquiries');
  const [filter, setFilter] = usePersistentView<FilterType>('noesis:inquiries-filter', 'all', Object.keys(INQUIRY_FILTER_LABELS) as FilterType[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState(EMPTY_INQUIRY_DRAFT);
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const questionCreationLock = useRef(false);
  const { toast } = useToast();

  const all = useMemo(() => allQuestions(media, questions), [media, questions]);
  React.useEffect(() => {
    if (onOpenQuestionRoute) return;
    if (!focusedQuestionId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(focusedQuestionId);
    onFocusedQuestionHandled?.();
  }, [focusedQuestionId, onFocusedQuestionHandled, onOpenQuestionRoute]);
  const filtered = sortCollection(all.filter((question) => {
    let typeOk = true;
    if (filter === 'active') typeOk = isInquiryActive(question);
    if (filter === 'complete') typeOk = inquiryFormation(question).fullyFormed;
    if (filter === 'needs_frame') typeOk = inquiryFrameGaps(question).length > 0 && !isInquiryClosed(question);
    if (filter === 'awaiting_evidence') typeOk = question.status === 'gathering_evidence' || inquiryNeedsEvidence(question);
    if (filter === 'needs_assumptions') typeOk = inquiryNeedsAssumptions(question);
    if (filter === 'needs_candidates') typeOk = inquiryNeedsCandidateAnswers(question);
    if (filter === 'ready_to_resolve') typeOk = inquiryReadyToResolve(question);
    if (filter === 'comparing_answers') typeOk = question.status === 'comparing_answers' || inquiryCandidateCount(question) > 1;
    if (filter === 'enduring') typeOk = question.status === 'enduring';
    if (filter === 'partially_answered') typeOk = question.status === 'partially_answered' || question.status === 'provisionally_answered';
    if (filter === 'suspended') typeOk = question.status === 'suspended' || question.status === 'archived';
    if (filter === 'resolved') typeOk = isInquiryClosed(question);
    if (filter === 'annotations') typeOk = question.type === 'annotation';
    const relatedSources = media.filter((source) => inquirySourceIds(question).includes(source.id));
    const relatedConcepts = concepts.filter((concept) => (question.conceptIds || []).includes(concept.id));
    const searchOk = searchMatches(search, [
      { value: question.text, label: 'question' },
      { value: question.answer, label: 'answer' },
      { value: question.currentIntuition, label: 'intuition' },
      ...(question.candidateAnswers || []).flatMap((candidate) => [
        { value: candidate.statement, label: 'candidate answer' },
        { value: candidate.support, label: 'candidate support' },
        { value: candidate.objection, label: 'candidate objection' },
      ]),
      ...relatedSources.flatMap((source) => [
        { value: source.title, label: 'source' },
        { value: source.creator, label: 'source creator' },
      ]),
      ...relatedConcepts.map((concept) => ({ value: concept.name, label: 'concept' })),
    ]);
    return typeOk && searchOk;
  }), sortOrder, item => item.text, item => item.dateUpdated || item.dateCreated);
  const selected = all.find((question) => question.id === (onOpenQuestionRoute ? focusedQuestionId : selectedId)) || null;

  const openQuestion = (id: string) => {
    setSelectedId(id);
    onOpenQuestionRoute?.(id);
  };

  const closeQuestion = () => {
    setSelectedId(null);
    onOpenQuestionRoute?.(null);
  };

  const createQuestion = async () => {
    if (!newQuestion.text.trim() || questionCreationLock.current) return;
    questionCreationLock.current = true;
    setCreatingQuestion(true);
    try {
      const created = await onAddQuestion({
        text: newQuestion.text.trim(),
        whyItMatters: newQuestion.whyItMatters.trim(),
        uncertainty: newQuestion.uncertainty.trim(),
        status: 'captured',
        sourceIds: newQuestion.sourceIds,
      });
      setNewQuestion(EMPTY_INQUIRY_DRAFT);
      setIsAddOpen(false);
      openQuestion(created.id);
    } catch {
      toast({ title: 'Inquiry not saved', description: 'Your question is still here. Please retry.', variant: 'destructive' });
    } finally { questionCreationLock.current = false; setCreatingQuestion(false); }
  };

  const toggleNewQuestionSource = (id: string) => {
    setNewQuestion(prev => {
      const current = prev.sourceIds;
      const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
      return { ...prev, sourceIds: next };
    });
  };

  if (selected) {
    const sourceIds = inquirySourceIds(selected);
    const relatedSources = media.filter((item) => sourceIds.includes(item.id));
    const conceptReferences = selected.conceptIds?.length
      ? selected.conceptIds
      : relatedSources.flatMap((item) => item.tags || []);
    const conceptNames = conceptReferences.map((value) => conceptReferenceLabel(value, concepts));
    const relatedBeliefs = vault.filter((entry) => selected.beliefIds?.includes(entry.id) || entry.sourceInquiryId === selected.id
      || (entry.tags || []).some((tag) => conceptNames.map(conceptKey).includes(conceptKey(tag))) || (entry.sourceIds || []).some((id) => sourceIds.includes(id)));
    const relatedDrafts = drafts.filter((draft) => selected.draftIds?.includes(draft.id) || (draft.questionIds || []).includes(selected.id) || (draft.conceptTags || []).some((tag) => conceptNames.map(conceptKey).includes(conceptKey(tag))));
    const relatedPractices = practices.filter((practice) => practice.questionIds?.includes(selected.id) || selected.practiceIds?.includes(practice.id));
    return (
        <InquiryDetail
          aiSettings={aiSettings}
          question={selected}
          sources={relatedSources}
          concepts={conceptNames}
          beliefs={relatedBeliefs}
          drafts={relatedDrafts}
          practices={relatedPractices}
          availableDrafts={drafts}
          availablePractices={practices}
          allMedia={media}
          allPositions={vault}
          allConcepts={concepts}
          onBack={closeQuestion}
          onUpdateQuestion={onUpdateQuestion}
          onSaveAiReview={onSaveAiReview}
          onDeleteQuestion={(id) => {
            onDeleteQuestion(id);
            closeQuestion();
          }}
          onAddDraft={onAddDraft}
          onLinkItem={onLinkItem}
          onAddPractice={onAddPractice}
          onOpenWork={onOpenWork}
          onOpenPractice={onOpenPractice}
          onOpenPosition={onOpenPosition}
          onOpenAnnotation={onOpenAnnotation}
          onFormPositionFromInquiry={onFormPositionFromInquiry}
          onAiFeedback={(title, description, variant) => toast({ title, description, ...(variant ? { variant } : {}) })}
        />
    );
  }

  const needsFrameCount = all.filter((q) => inquiryFrameGaps(q).length > 0 && !isInquiryClosed(q)).length;
  const needsAssumptionsCount = all.filter(inquiryNeedsAssumptions).length;
  const needsEvidenceCount = all.filter(inquiryNeedsEvidence).length;
  const readyToResolveCount = all.filter(inquiryReadyToResolve).length;
  const completeCount = all.filter((question) => inquiryFormation(question).fullyFormed).length;
  const linkedDraftCount = drafts.filter(d => (d.questionIds || []).length > 0).length;
  const clearInquiryFilters = () => {
    setSearch('');
    setFilter('all');
  };
  const inquiryFiltersActive = Boolean(search || filter !== 'all');
  const activeFilterLabels = [
    search ? `Search: ${search}` : null,
    filter !== 'all' ? `View: ${INQUIRY_FILTER_LABELS[filter]}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="noesis-page">
      <PageHeader
        title="Inquiries"
        description="Work through returning questions as structured investigations with evidence, provisional answers, and resolution summaries."
        actions={
          <>
            <Button onClick={() => setIsAddOpen(true)} size="sm" className="bg-accent hover:bg-accent/90 rounded-full h-9 px-6 font-bold">
              <Plus className="size-4 mr-1.5" /> Add Inquiry
            </Button>
          </>
        }
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search inquiries, answers, evidence..."
        resultCount={filtered.length}
        sortControl={<SortPill label="Sort inquiries" value={sortOrder} onChange={setSortOrder} options={COLLECTION_SORT_OPTIONS} />}
        resultLabel="inquiries"
        activeFilterLabels={activeFilterLabels}
        onClear={clearInquiryFilters}
        clearDisabled={!inquiryFiltersActive}
        viewControl={<ViewModeToggle value={viewMode === 'table' ? 'table' : 'grid'} modes={['grid', 'table']} onChange={(value) => setViewMode(value === 'table' ? 'table' : 'cards')} label="Inquiry view" />}
        className="mb-3"
      >
        <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
          <SelectTrigger aria-label="Inquiry view filter" className="w-56 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Inquiry View" />
          </SelectTrigger>
          <SelectContent>
            {PRIMARY_INQUIRY_FILTERS.map((value) => (
              <SelectItem key={value} value={value} className="noesis-eyebrow">{INQUIRY_FILTER_LABELS[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="noesis-eyebrow text-muted-foreground">
          {linkedDraftCount} linked works
        </div>
      </FilterToolbar>

      <section className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0" aria-label="Inquiry summary filters">
        {[
          { label: 'Needs frame', value: needsFrameCount, filter: 'needs_frame' as FilterType },
          { label: 'Needs assumptions', value: needsAssumptionsCount, filter: 'needs_assumptions' as FilterType },
          { label: 'Needs evidence', value: needsEvidenceCount, filter: 'awaiting_evidence' as FilterType },
          { label: 'Ready to resolve', value: readyToResolveCount, filter: 'ready_to_resolve' as FilterType },
          { label: 'Complete', value: completeCount, filter: 'complete' as FilterType },
        ].filter((item) => item.value > 0).map((item) => (
          <button
            key={item.filter}
            type="button"
            onClick={() => setFilter(filter === item.filter ? 'all' : item.filter)}
            aria-pressed={filter === item.filter}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 noesis-eyebrow noesis-eyebrow--sm transition-colors',
              filter === item.filter
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground'
            )}
          >
            {item.label} ({item.value})
          </button>
        ))}
      </section>

      {viewMode === 'table' && filtered.length > 0 && (
        <section className="min-w-0 rounded-lg border border-border/60 bg-card">
          <Table className="table-fixed xl:table-auto">
            <caption className="sr-only">Inquiries</caption>
            <TableHeader><TableRow className="bg-muted/25 hover:bg-muted/25"><TableHead>Inquiry</TableHead><TableHead className="w-24 sm:w-32 xl:w-40">State</TableHead><TableHead className="hidden w-48 xl:table-cell">Source context</TableHead><TableHead className="hidden xl:table-cell">Next step</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map((question) => {
              const sources = media.filter((source) => inquirySourceIds(question).includes(source.id));
              return <TableRow key={question.id} className="cursor-pointer" onClick={(event) => { if (isEntitySurfaceClick(event)) openQuestion(question.id); }}>
                <TableCell className="max-w-xl py-2 font-headline text-base font-semibold leading-6"><button type="button" className="min-h-11 w-full rounded-sm text-left [overflow-wrap:anywhere] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => openQuestion(question.id)} onKeyDown={(event) => activateEntityOnKey(event, () => openQuestion(question.id))}>{question.text}</button><p className="pb-2 text-xs font-normal text-muted-foreground xl:hidden">{inquiryCardNextStep(question)}</p></TableCell>
                <TableCell><StageBadge type="inquiry" stage={question.stage} status={question.status} /></TableCell>
                <TableCell className="hidden text-xs leading-5 text-muted-foreground xl:table-cell">{sources.length ? sources.map((source) => source.title).join(', ') : 'No source linked'}</TableCell>
                <TableCell className="hidden text-xs leading-5 text-muted-foreground xl:table-cell">{inquiryCardNextStep(question)}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {viewMode !== 'table' && filtered.map((question) => {
          const sources = media.filter(m => inquirySourceIds(question).includes(m.id));
          const nextStep = inquiryCardNextStep(question);

          return (
            <Card key={question.id} className="noesis-inquiry-card relative self-start rounded-[var(--radius-panel)] p-4 transition-colors hover:border-accent/60 focus-within:border-accent">
              <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
              <StageBadge type="inquiry" stage={question.stage} status={question.status} className="mb-2" />
              <h2 className="mb-3 font-headline text-xl font-bold italic leading-snug text-primary">
                <button type="button" className="w-full text-left [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-[var(--radius-panel)] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" onClick={() => openQuestion(question.id)}>{question.text}</button>
              </h2>
              </div>
              </div>

              <div className="font-body text-xs text-muted-foreground italic flex items-center gap-2 border-t border-border/20 pt-3 mb-3">
                {sources.length > 0 ? (
                  <span className="truncate">From {sources.map(s => s.title).join(', ')}</span>
                ) : (
                  <span>Synthesized from various internal connections</span>
                )}
              </div>

              <div title={nextStep}>
                <InquiryLean question={question} sources={sources.length} />
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full">
            <PageEmptyState
              icon={HelpCircle}
              title="No inquiries found"
              description="Refine your search, clear the current view, or open a new investigation."
              action={inquiryFiltersActive ? <Button variant="outline" onClick={clearInquiryFilters}>Clear filters</Button> : undefined}
            />
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={open => { if (!questionCreationLock.current) setIsAddOpen(open); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">New inquiry</DialogTitle>
            <DialogDescription>Only the question is required.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void createQuestion(); }}>
            <fieldset className="grid min-w-0 gap-4" disabled={creatingQuestion}>
              <div className="grid gap-2">
                <Label htmlFor="new-inquiry-question">What are you trying to find out?</Label>
                <Textarea
                  id="new-inquiry-question"
                  value={newQuestion.text}
                  onChange={(event) => setNewQuestion(prev => ({ ...prev, text: event.target.value }))}
                  placeholder="Write one question."
                  required
                  className="min-h-20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="new-inquiry-stakes">Why does this matter? <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea id="new-inquiry-stakes" value={newQuestion.whyItMatters} onChange={event => setNewQuestion(prev => ({ ...prev, whyItMatters: event.target.value }))} placeholder="What might the answer change for you?" className="min-h-20" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-inquiry-uncertainty">What are you still unsure about? <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea id="new-inquiry-uncertainty" value={newQuestion.uncertainty} onChange={event => setNewQuestion(prev => ({ ...prev, uncertainty: event.target.value }))} placeholder="Name one thing you haven't figured out yet." className="min-h-20" />
                </div>
              </div>
              <SourceLinker media={media} selectedIds={newQuestion.sourceIds} onToggle={toggleNewQuestionSource} label="Related sources (optional)" />
            </fieldset>
            <DialogFooter><Button type="submit" disabled={creatingQuestion || !newQuestion.text.trim()}>{creatingQuestion ? 'Saving...' : 'Create inquiry'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
