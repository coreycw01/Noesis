
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
import { InquiryBalance, answerWeight } from '@/components/Questions/InquiryBalance';
import { NextMove, RecordTools } from '@/components/shared/RecordDetail';
import { activateEntityOnKey, isEntitySurfaceClick } from '@/lib/entity-activation';
import { StageBadge } from '@/components/shared/StageBadge';
import { useToast } from '@/hooks/use-toast';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { DetailLabel, PageHeader } from '@/components/shared/PageHeader';
import { ToolOption, ToolOptions, WorkbenchPanel } from '@/components/shared/WorkbenchPanel';
import { FilterToolbar, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { WorkbenchFlow } from '@/components/shared/WorkbenchFlow';
import { ContextRail, EntityMeta, IntellectualRoleLabel } from '@/components/shared/IntellectualStructures';
import { searchMatches } from '@/lib/search';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { PromotedAnnotationOrigins } from '@/components/ai/AiProvenanceBadge';
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

export function QuestionsWorkspace({ aiSettings, questions, media, vault, drafts, practices, concepts, onAddQuestion, onUpdateQuestion, onSaveAiReview, onDeleteQuestion, onAddVaultEntry, onAddDraft, onLinkItem, onAddPractice, onOpenWork, onOpenPractice, onOpenPosition, onFormPositionFromInquiry, focusedQuestionId, onFocusedQuestionHandled, onOpenQuestionRoute }: QuestionsWorkspaceProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useEntityViewPreference('inquiries');
  const [filter, setFilter] = usePersistentView<FilterType>('noesis:inquiries-filter', 'all', Object.keys(INQUIRY_FILTER_LABELS) as FilterType[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailSection, setDetailSection] = useState<'investigation' | 'answer'>('investigation');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ text: '', sourceIds: [] as string[] });
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
  const filtered = all.filter((question) => {
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
  });
  const selected = all.find((question) => question.id === (onOpenQuestionRoute ? focusedQuestionId : selectedId)) || null;

  const openQuestion = (id: string, section: 'investigation' | 'answer' = 'investigation') => {
    setDetailSection(section);
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
      const created = await onAddQuestion({ text: newQuestion.text.trim(), status: 'captured', sourceIds: newQuestion.sourceIds });
      setNewQuestion({ text: '', sourceIds: [] });
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
    const relatedDrafts = drafts.filter((draft) => (draft.questionIds || []).includes(selected.id) || (draft.conceptTags || []).some((tag) => conceptNames.map(conceptKey).includes(conceptKey(tag))));
    const relatedPractices = practices.filter((practice) => (practice.questionIds || []).includes(selected.id));
    return (
        <QuestionDetail
          aiSettings={aiSettings}
          question={selected}
          sources={relatedSources}
          concepts={conceptNames}
          beliefs={relatedBeliefs}
          drafts={relatedDrafts}
          practices={relatedPractices}
          availableDrafts={drafts}
          availablePractices={practices}
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
          onFormPositionFromInquiry={onFormPositionFromInquiry}
          onAiFeedback={(title, description, variant) => toast({ title, description, ...(variant ? { variant } : {}) })}
          routeOwned={focusedQuestionId === selected.id}
          initialSection={detailSection}
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
        resultLabel="inquiries"
        activeFilterLabels={activeFilterLabels}
        onClear={clearInquiryFilters}
        clearDisabled={!inquiryFiltersActive}
        viewControl={<ViewModeToggle value={viewMode === 'table' ? 'table' : 'grid'} modes={['grid', 'table']} onChange={(value) => setViewMode(value === 'table' ? 'table' : 'cards')} label="Inquiry view" />}
        className="mb-3"
      >
        <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
          <SelectTrigger aria-label="Inquiry view filter" className="w-56 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Inquiry View" />
          </SelectTrigger>
          <SelectContent>
            {PRIMARY_INQUIRY_FILTERS.map((value) => (
              <SelectItem key={value} value={value} className="font-code text-[10px] uppercase">{INQUIRY_FILTER_LABELS[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">
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
              'shrink-0 rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-widest transition-colors',
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
            <TableHeader><TableRow className="bg-muted/25 hover:bg-muted/25"><TableHead>Inquiry</TableHead><TableHead className="w-24 sm:w-32 xl:w-40">State</TableHead><TableHead className="hidden w-48 xl:table-cell">Source context</TableHead><TableHead className="hidden xl:table-cell">Next step</TableHead><TableHead className="hidden w-32 xl:table-cell"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map((question) => {
              const sources = media.filter((source) => inquirySourceIds(question).includes(source.id));
              const closed = isInquiryClosed(question);
              return <TableRow key={question.id} className="cursor-pointer" onClick={(event) => { if (isEntitySurfaceClick(event)) openQuestion(question.id); }}>
                <TableCell className="max-w-xl py-2 font-headline text-base font-semibold leading-6"><button type="button" className="min-h-11 w-full rounded-sm text-left [overflow-wrap:anywhere] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => openQuestion(question.id)} onKeyDown={(event) => activateEntityOnKey(event, () => openQuestion(question.id))}>{question.text}</button><p className="pb-2 text-xs font-normal text-muted-foreground xl:hidden">{inquiryCardNextStep(question)}</p></TableCell>
                <TableCell><StageBadge type="inquiry" stage={question.stage} status={question.status} /></TableCell>
                <TableCell className="hidden text-xs leading-5 text-muted-foreground xl:table-cell">{sources.length ? sources.map((source) => source.title).join(', ') : 'No source linked'}</TableCell>
                <TableCell className="hidden text-xs leading-5 text-muted-foreground xl:table-cell">{inquiryCardNextStep(question)}</TableCell>
                <TableCell className="hidden xl:table-cell"><Button size="sm" variant={closed ? 'outline' : 'default'} onClick={() => openQuestion(question.id, closed ? 'answer' : 'investigation')} className="min-h-9 rounded-full px-4 font-code text-[8px] uppercase tracking-widest">{closed ? 'Review' : 'Investigate'}</Button></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {viewMode !== 'table' && filtered.map((question) => {
          const sources = media.filter(m => inquirySourceIds(question).includes(m.id));
          const nextStep = inquiryCardNextStep(question);
          const closed = isInquiryClosed(question);

          return (
            <Card key={question.id} className="noesis-inquiry-card p-4">
              <StageBadge type="inquiry" stage={question.stage} status={question.status} className="mb-2" />
              <h2 className="mb-3 font-headline text-xl font-bold italic leading-snug text-primary">
                <button type="button" className="w-full text-left transition-colors hover:text-accent" onClick={() => openQuestion(question.id)}>{question.text}</button>
              </h2>

              <div className="font-body text-xs text-muted-foreground italic flex items-center gap-2 border-t border-border/20 pt-3 mb-3">
                {sources.length > 0 ? (
                  <span className="truncate">From {sources.map(s => s.title).join(', ')}</span>
                ) : (
                  <span>Synthesized from various internal connections</span>
                )}
              </div>

              <div className="mb-4" title={nextStep}>
                <InquiryLean question={question} />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/50 pt-3">
                <div className="flex flex-wrap gap-2">
                  {closed ? (
                    <Button size="sm" variant="outline" onClick={() => openQuestion(question.id, 'answer')} className="h-8 rounded-full px-4 font-code text-[8px] uppercase tracking-widest">
                      Review inquiry
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => openQuestion(question.id, 'investigation')} className="h-8 rounded-full px-4 font-code text-[8px] uppercase tracking-widest">
                        Investigate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={question.id.startsWith('open:') || question.id.startsWith('annotation:')}
                        onClick={() => openQuestion(question.id, 'answer')}
                        className="h-8 rounded-full px-4 font-code text-[8px] uppercase tracking-widest"
                      >
                        Write answer
                      </Button>
                    </>
                  )}
                </div>
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
              action={inquiryFiltersActive ? <Button variant="outline" onClick={clearInquiryFilters} className="rounded-full">Clear filters</Button> : undefined}
            />
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-3xl italic">Formulate Inquiry</DialogTitle>
            <DialogDescription className="sr-only">Enter the question you want to investigate. Sources are optional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-8 pt-4">
            <div className="space-y-2">
              <Label className="readex-kicker">THE QUESTION</Label>
              <Textarea
                value={newQuestion.text}
                onChange={(event) => setNewQuestion(prev => ({ ...prev, text: event.target.value }))}
                placeholder="What core problem or mystery are you exploring?"
                className="min-h-[140px] font-body text-xl italic bg-muted/5 leading-relaxed"
              />
            </div>
            <SourceLinker
              media={media}
              selectedIds={newQuestion.sourceIds}
              onToggle={toggleNewQuestionSource}
              label="INFLUENCED BY SOURCE(S)"
            />
          </div>
          <DialogFooter className="pt-8"><Button onClick={createQuestion} disabled={creatingQuestion || !newQuestion.text.trim()} className="w-full h-12 rounded-full font-bold">{creatingQuestion ? 'Saving…' : 'Open Investigation'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type InquiryTool = 'Clarify question' | 'Add evidence' | 'Compare answers' | 'Test in practice' | 'Develop a work' | 'Decide outcome';

const INQUIRY_TOOL_COPY: Record<InquiryTool, { description: string; instruction: string }> = {
  'Clarify question': {
    description: 'Name one term or assumption that needs to be clearer.',
    instruction: 'Write the term or assumption you need to make explicit.',
  },
  'Add evidence': {
    description: 'Save one source, observation, counterexample, or unknown.',
    instruction: 'Write what you found, then say whether it supports or challenges the inquiry.',
  },
  'Compare answers': {
    description: 'Put possible answers beside each other before choosing one.',
    instruction: 'Write one possible answer. Support and objection are optional, but useful.',
  },
  'Test in practice': {
    description: 'Turn the question into a concrete action or observation.',
    instruction: 'Say what you want to learn and what you will do or observe.',
  },
  'Develop a work': {
    description: 'Explore this question through writing, a note, a drawing, or a recording.',
    instruction: 'Create a new Work or attach one you already started.',
  },
  'Decide outcome': {
    description: 'Choose an honest next status after you have written an answer.',
    instruction: 'Add a short summary, then choose the outcome that best fits right now.',
  },
};

function investigationTools(question: Question, drafts: Draft[], practices: Practice[]) {
  const tools: InquiryTool[] = ['Clarify question', 'Add evidence', 'Compare answers', 'Test in practice', 'Develop a work'];
  if (question.answer?.trim()) tools.push('Decide outcome');
  const recommended: InquiryTool = inquiryNeedsEvidence(question)
    ? 'Add evidence'
    : inquiryCandidateCount(question) < 2
      ? 'Compare answers'
      : practices.length === 0
        ? 'Test in practice'
        : drafts.length === 0
          ? 'Develop a work'
          : question.answer?.trim()
            ? 'Decide outcome'
            : 'Clarify question';
  return { tools, recommended };
}

function QuestionDetail({ aiSettings, question, sources, concepts, beliefs, drafts, practices, availableDrafts, availablePractices, onBack, onUpdateQuestion: persistQuestion, onSaveAiReview, onDeleteQuestion, onAddDraft, onLinkItem, onAddPractice, onOpenWork, onOpenPractice, onOpenPosition, onFormPositionFromInquiry, onAiFeedback, routeOwned = false, initialSection = 'investigation' }: {
  aiSettings: import('@/lib/types').AiSettings;
  question: Question;
  sources: Media[];
  concepts: string[];
  beliefs: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  availableDrafts: Draft[];
  availablePractices: Practice[];
  onBack: () => void;
  onUpdateQuestion: (question: Question) => void | Promise<void>;
  onSaveAiReview: QuestionsWorkspaceProps['onSaveAiReview'];
  onDeleteQuestion: (id: string) => void | Promise<void>;
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onLinkItem: QuestionsWorkspaceProps['onLinkItem'];
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onOpenWork: (id: string) => void;
  onOpenPractice: (id: string) => void;
  onOpenPosition: (id: string) => void;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => Promise<VaultEntry>;
  onAiFeedback: (title: string, description: string, variant?: 'default' | 'destructive') => void;
  routeOwned?: boolean;
  initialSection?: 'investigation' | 'answer';
}) {
  const saveLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const onUpdateQuestion = async (next: Question, baseline = { version: question.dateUpdated }) => {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    try {
      await persistQuestion({ ...next, dateUpdated: baseline.version });
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.name : '';
      const description = reason === 'WorkspaceRecordChangedError'
        ? 'This inquiry changed in another session. Your input is still here; review the latest inquiry before saving again.'
        : reason === 'WorkspaceOfflineError'
          ? 'You are offline. Your input is still here; reconnect and try again.'
          : 'Your input is still here. Check your connection and try saving again.';
      onAiFeedback('Inquiry not saved', description, 'destructive');
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };
  const [answerDraft, setAnswerDraft] = useState<{ value: string; base: string } | null>(null);
  const savedAnswer = question.answer || '';
  const initialAnswer = answerDraft?.value ?? savedAnswer;
  const answerConflict = answerDraft !== null && answerDraft.base !== savedAnswer;
  const answerConflictNotice = answerConflict && (
    <div role="status" className="space-y-2 text-sm text-muted-foreground">
      <p>The saved answer changed while you were writing. Your draft is still in Answer.</p>
      <Button type="button" variant="outline" onClick={() => setAnswerDraft(null)}>Discard draft and load saved answer</Button>
    </div>
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState(question.text);
  const [selectedTool, setSelectedTool] = useState<InquiryTool | null>(null);
  const [workflowStep, setWorkflowStep] = useState<'scale' | 'frame' | 'answer' | 'investigate' | 'decide'>('scale');
  const [clarificationDraft, setClarificationDraft] = useState('');
  const [existingPracticeId, setExistingPracticeId] = useState('');
  const [existingWorkId, setExistingWorkId] = useState('');
  const [investigationDraft, setInvestigationDraft] = useState({
    whyItMatters: question.whyItMatters || '',
    currentIntuition: question.currentIntuition || '',
    uncertainty: question.uncertainty || '',
    resolutionSummary: question.resolutionSummary || '',
  });
  const [frameBase, setFrameBase] = useState<{ version: string | undefined } | null>(null);
  const frameConflict = frameBase !== null && frameBase.version !== question.dateUpdated;
  const editFrameField = (field: 'whyItMatters' | 'currentIntuition' | 'uncertainty', value: string) => {
    if (!frameBase) setFrameBase({ version: question.dateUpdated });
    setInvestigationDraft((previous) => ({
      ...previous,
      ...(!frameBase ? {
        whyItMatters: question.whyItMatters || '',
        currentIntuition: question.currentIntuition || '',
        uncertainty: question.uncertainty || '',
      } : {}),
      [field]: value,
    }));
  };
  const loadSavedFrame = () => {
    setFrameBase(null);
    setInvestigationDraft((previous) => ({
      ...previous,
      whyItMatters: question.whyItMatters || '',
      currentIntuition: question.currentIntuition || '',
      uncertainty: question.uncertainty || '',
    }));
  };
  const [candidateDraft, setCandidateDraft] = useState({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
  const [evidenceDraft, setEvidenceDraft] = useState(EMPTY_EVIDENCE);
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const [evidenceToRemove, setEvidenceToRemove] = useState<InquiryEvidence | null>(null);
  const evidenceInput = useRef<HTMLTextAreaElement>(null);
  const [testDraft, setTestDraft] = useState({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
  const [checkpointSkipReason, setCheckpointSkipReason] = useState('');
  const [positionConfidence, setPositionConfidence] = useState(50);
  React.useEffect(() => {
    setAnswerDraft(null);
    setQuestionDraft(question.text);
    setEditingQuestion(false);
    setFrameBase(null);
    setWorkflowStep(initialSection === 'answer' ? 'answer' : 'scale');
    setSelectedTool(null);
    setInvestigationDraft({
      whyItMatters: question.whyItMatters || '',
      currentIntuition: question.currentIntuition || '',
      uncertainty: question.uncertainty || '',
      resolutionSummary: question.resolutionSummary || '',
    });
    setClarificationDraft('');
    setCandidateDraft({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
    setEvidenceDraft(EMPTY_EVIDENCE);
    setEditingEvidenceId(null);
    setEvidenceToRemove(null);
    setTestDraft({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
    setCheckpointSkipReason('');
    setPositionConfidence(50);
  }, [initialSection, question.id]);
  const { tools, recommended } = investigationTools(question, drafts, practices);
  const candidateAnswers = question.candidateAnswers || [];
  const evidenceRecords = question.evidenceRecords || [];
  const candidateAnswerCount = inquiryCandidateCount(question);
  const recommendedMove = INQUIRY_TOOL_COPY[recommended].description;
  const openWorkflowStep = (step: 'scale' | 'frame' | 'answer' | 'investigate' | 'decide') => {
    setWorkflowStep(step);
    if (step === 'decide') setSelectedTool('Decide outcome');
    if (step === 'investigate' && (!selectedTool || selectedTool === 'Decide outcome')) {
      setSelectedTool(recommended === 'Decide outcome' ? 'Clarify question' : recommended);
    }
  };

  const saveProvisionalAnswer = async (status: Question['status'] = 'provisionally_answered') => {
    if (answerConflict) return;
    if (!initialAnswer.trim()) {
      onAiFeedback('Answer required', 'Write a provisional answer before saving this inquiry.', 'destructive');
      return;
    }
    const requiresSummary = ['resolved', 'suspended', 'converted', 'no_longer_meaningful'].includes(status);
    if (requiresSummary && !investigationDraft.resolutionSummary.trim()) {
      onAiFeedback('Resolution summary required', 'Add a short resolution summary before choosing this inquiry outcome.', 'destructive');
      return;
    }
    const hasSteelman = inquiryHasRecordedObjection(question);
    if (requiresSummary && !hasSteelman && !checkpointSkipReason.trim()) {
      onAiFeedback('Steelman checkpoint', 'Record the strongest objection under Compare answers, or explain why you are skipping this checkpoint.', 'destructive');
      return;
    }
    const checkpointSkips = requiresSummary && !hasSteelman && checkpointSkipReason.trim()
      ? [...(question.checkpointSkips || []), { id: uid(), transition: 'question_to_resolution', reason: checkpointSkipReason.trim(), date: today() }]
      : question.checkpointSkips;
    const next = {
      ...question,
      answer: initialAnswer.trim(),
      status,
      resolutionSummary: requiresSummary ? investigationDraft.resolutionSummary.trim() : question.resolutionSummary || '',
      checkpointSkips,
      dateUpdated: today(),
    };
    if (status === 'converted') {
      if (saveLock.current) return;
      saveLock.current = true;
      setSaving(true);
      try {
        const title = initialAnswer.trim().replace(/\s+/g, ' ');
        const formed = await onFormPositionFromInquiry({ ...next, dateUpdated: question.dateUpdated }, {
          title: title.length > 100 ? `${title.slice(0, 97).trimEnd()}...` : title,
          statement: initialAnswer.trim(),
          description: investigationDraft.resolutionSummary.trim(),
          confidence: positionConfidence,
        }, initialAnswer);
        onAiFeedback('Position formed', 'The position and inquiry are linked.');
        onOpenPosition(formed.id);
      } catch (error) {
        onAiFeedback('Position not saved', error instanceof Error && error.name === 'WorkspaceRecordChangedError'
          ? 'The inquiry changed before the position could be formed. Your draft is still here.'
          : 'Your answer and decision are still here. Check your connection and try again.', 'destructive');
      } finally {
        saveLock.current = false;
        setSaving(false);
      }
      return;
    }
    if (!await onUpdateQuestion(next)) return;
    setAnswerDraft(null);
    onAiFeedback(status === 'resolved' ? 'Inquiry resolved.' : 'Inquiry outcome saved.', status === 'resolved' ? 'The resolution summary is now stored on this inquiry.' : `Marked as ${status.replace(/_/g, ' ')} without pretending the question is fully closed.`);
  };

  const saveInvestigationFrame = async () => {
    if (frameConflict) return;
    if (!await onUpdateQuestion({
      ...question,
      whyItMatters: investigationDraft.whyItMatters.trim(),
      currentIntuition: investigationDraft.currentIntuition.trim(),
      uncertainty: investigationDraft.uncertainty.trim(),
      dateUpdated: today(),
    }, frameBase ?? undefined)) return;
    setFrameBase(null);
    onAiFeedback('Context saved.', 'Your stakes, current view, and remaining uncertainty are now part of this inquiry.');
  };

  const addClarification = async () => {
    const clarification = clarificationDraft.trim();
    if (!clarification) {
      onAiFeedback('Clarification required', 'Name one term or assumption before saving it.', 'destructive');
      return;
    }
    if (!await onUpdateQuestion({
      ...question,
      assumptions: Array.from(new Set([...(question.assumptions || []), clarification])),
      dateUpdated: today(),
    })) return;
    setClarificationDraft('');
    onAiFeedback('Clarification saved.', 'This term or assumption is now part of the inquiry record.');
  };

  const addCandidateAnswer = async () => {
    if (!candidateDraft.statement.trim()) {
      onAiFeedback('Candidate answer required', 'Write the candidate answer before adding it.', 'destructive');
      return;
    }
    const nextCandidate = {
      id: crypto.randomUUID(),
      statement: candidateDraft.statement.trim(),
      confidence: candidateDraft.confidence,
      support: candidateDraft.support.trim(),
      objection: candidateDraft.objection.trim(),
      consequence: candidateDraft.consequence.trim(),
    };
    if (!await onUpdateQuestion({
      ...question,
      candidateAnswers: [...(question.candidateAnswers || []), nextCandidate],
      status: question.status === 'open' ? 'comparing_answers' as Question['status'] : question.status,
      dateUpdated: today(),
    })) return;
    setCandidateDraft({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
    onAiFeedback('Candidate answer added.', 'You can compare this answer against evidence and objections.');
  };

  const removeCandidateAnswer = (id: string) => {
    onUpdateQuestion({
      ...question,
      candidateAnswers: (question.candidateAnswers || []).filter((candidate) => candidate.id !== id),
      evidenceRecords: evidenceRecords.map((item) => item.candidateId === id ? { ...item, candidateId: '' } : item),
      dateUpdated: today(),
    });
  };

  const addEvidenceRecord = async () => {
    if (!evidenceDraft.claim.trim()) {
      onAiFeedback('Evidence claim required', 'Write the claim, observation, excerpt, or unknown before adding it.', 'destructive');
      return;
    }
    const previous = evidenceRecords.find((item) => item.id === editingEvidenceId);
    if (!previous && evidenceRecords.length >= MAX_INQUIRY_EVIDENCE) {
      onAiFeedback('Evidence limit reached', 'Edit or remove a saved evidence record before adding another.', 'destructive');
      return;
    }
    if (evidenceDraft.candidateId && !candidateAnswers.some((item) => item.id === evidenceDraft.candidateId)) {
      onAiFeedback('Answer no longer available', 'Choose another answer or leave the evidence unassigned.', 'destructive');
      return;
    }
    const next = assignInquiryEvidence(question, {
      ...evidenceDraft,
      id: previous?.id || uid(),
      date: previous?.date || today(),
      claim: evidenceDraft.claim.trim(),
      origin: evidenceDraft.origin.trim(),
      notes: evidenceDraft.notes.trim(),
    }, evidenceDraft.candidateId);
    if (!await onUpdateQuestion({
      ...question,
      evidenceRecords: previous ? evidenceRecords.map((item) => item.id === previous.id ? next : item) : [next, ...evidenceRecords],
      status: !isInquiryClosed(question) && inquiryNeedsEvidence(question) ? 'gathering_evidence' : question.status,
      dateUpdated: today(),
    })) return;
    setEvidenceDraft(EMPTY_EVIDENCE);
    setEditingEvidenceId(null);
    onAiFeedback('Evidence saved', next.candidateId ? 'Assigned to the selected answer.' : 'Saved without assigning it to an answer.');
  };

  const createTestRecord = async () => {
    if (saving) return;
    if (!testDraft.tested.trim() || !testDraft.method.trim()) {
      onAiFeedback('Test required', 'Name the test or describe what action, observation, conversation, or research would test this inquiry.', 'destructive');
      return;
    }
    const title = testDraft.title.trim() || `Test for: ${question.text.slice(0, 60)}`;
    setSaving(true);
    try {
    const created = await onAddPractice({
      title,
      description: `A test created from the inquiry: ${question.text}`,
      type: testDraft.method.trim().toLowerCase().includes('repeat') ? 'observation' : 'experiment',
      status: testDraft.result.trim() ? 'concluded' : 'proposed',
      hypothesis: testDraft.tested.trim() || question.text,
      action: testDraft.method.trim(),
      observationMethod: [testDraft.predictionA.trim(), testDraft.predictionB.trim()].filter(Boolean).join('\n'),
      expectedOutcome: testDraft.predictionA.trim(),
      observedOutcome: testDraft.result.trim(),
      durationMode: testDraft.method.trim().toLowerCase().includes('repeat') ? 'repeated' : 'one_time',
      questionIds: [question.id],
      conceptTags: concepts,
      sourceIds: sources.map((source) => source.id),
      positionIds: beliefs.filter((belief) => question.beliefIds?.includes(belief.id)).map((belief) => belief.id),
      notes: testDraft.reviewDate.trim() ? `Review date: ${testDraft.reviewDate.trim()}` : '',
    });
    if (!created.id) throw new Error('The new practice was not saved.');
    setTestDraft({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
    onAiFeedback('Test created.', 'A linked practice was created so the inquiry can be tested through action or observation.');
    } catch {
      onAiFeedback('Test not saved', 'Your test details are still here. Please try again.', 'destructive');
    } finally {
      setSaving(false);
    }
  };

  const linkExistingPractice = async () => {
    const practice = availablePractices.find((item) => item.id === existingPracticeId);
    if (!practice || saving) return;
    setSaving(true);
    try {
    await onLinkItem(question.id, 'practice', practice.id);
    setExistingPracticeId('');
    onAiFeedback('Practice linked.', `"${practice.title}" now tests this inquiry.`);
    } catch {
      onAiFeedback('Link not saved', 'Neither record was updated. Please try again.', 'destructive');
    } finally { setSaving(false); }
  };

  const createExpandedWork = async () => {
    if (saving) return;
    setSaving(true);
    try {
    const created = await onAddDraft({
      title: `Exploring: ${question.text.slice(0, 72)}`,
      type: 'essay',
      status: 'seed',
      body: question.answer?.trim() || question.currentIntuition?.trim() || question.text,
      questionIds: [question.id],
      sourceIds: sources.map((source) => source.id),
      beliefIds: beliefs.filter((belief) => question.beliefIds?.includes(belief.id)).map((belief) => belief.id),
      conceptTags: concepts,
    });
    onOpenWork(created.id);
    } catch {
      onAiFeedback('Work not created', 'Please try again. Your inquiry is unchanged.', 'destructive');
    } finally {
      setSaving(false);
    }
  };

  const linkExistingWork = async () => {
    const work = availableDrafts.find((item) => item.id === existingWorkId);
    if (!work || saving) return;
    setSaving(true);
    try {
    await onLinkItem(question.id, 'work', work.id);
    setExistingWorkId('');
    onAiFeedback('Work linked.', `"${work.title}" now develops this inquiry.`);
    } catch {
      onAiFeedback('Link not saved', 'Neither record was updated. Please try again.', 'destructive');
    } finally { setSaving(false); }
  };

  const updateInvestigationStatus = async (status: Question['status']) => {
    if (!await onUpdateQuestion({ ...question, status, dateUpdated: today() })) return;
    onAiFeedback('Inquiry status updated.', `Marked as ${status.replace(/_/g, ' ')}.`);
  };

  const buildAiEnvelope = (_action?: unknown, userPrompt?: string): AiContextEnvelope => ({
    action: 'socratic_inquiry_challenge',
    scope: 'linked_items',
    targetType: 'inquiry',
    targetId: question.id,
    itemMemory: inquiryAiItemMemory(question),
    linkedMemory: [
      ...sources.slice(0, 6).map((source) => `Source: ${source.title}; main idea: ${source.capture?.after?.coreArgument || source.description || 'not recorded'}; relevant notes: ${(source.annotations || []).slice(0, 3).map((item) => item.text).join(' | ') || 'none'}`),
      ...beliefs.slice(0, 6).map((position) => `Position (${position.confidence}% confidence): ${position.statement || position.title}; support: ${(position.evidenceFor || []).length}; challenges: ${(position.evidenceAgainst || []).length}`),
      ...practices.slice(0, 4).map((practice) => `Practice: ${practice.title}; hypothesis: ${practice.hypothesis || 'not recorded'}; outcome: ${practice.observedOutcome || practice.status}`),
      ...drafts.slice(0, 3).map((draft) => `Linked work: ${draft.title}; excerpt: ${(draft.body || '').slice(0, 240) || 'empty'}`),
    ],
    userPrompt,
  });

  if (question.status === 'archived') {
    return (
      <div className="noesis-gutter flex-1 w-full overflow-y-auto pb-8 pt-[var(--page-top)] font-body" data-noesis-scroll-region>
        <div className="noesis-detail-toolbar">
          <button type="button" onClick={onBack} className="noesis-back-link">
            <ArrowLeft aria-hidden="true" /> Inquiries
          </button>
        </div>
        <Card className="noesis-workbench-panel space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-3 rounded-full">Archived inquiry</Badge>
              <h1 className="noesis-page-title text-3xl sm:text-4xl">{question.text}</h1>
              <PromotedAnnotationOrigins origins={question.annotationOrigins} />
              <p className="mt-4 text-sm leading-7 text-muted-foreground">This inquiry is preserved as a read-only record. Reopen it before changing its investigation or answer.</p>
            </div>
            <Button onClick={() => updateInvestigationStatus('reopened')} className="rounded-full">Reopen Inquiry</Button>
          </div>
          <section className="rounded-xl border border-border bg-background/60 p-5">
            <div className="readex-kicker">Saved answer</div>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-foreground">{question.answer?.trim() || 'No answer was saved before this inquiry was archived.'}</p>
          </section>
          {question.resolutionSummary?.trim() && (
            <section className="rounded-xl border border-border bg-background/60 p-5">
              <div className="readex-kicker">Resolution context</div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{question.resolutionSummary}</p>
            </section>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <ContextPanel title="Evidence Sources" items={sources.map((source) => source.title)} />
            <ContextPanel title="Related Positions" items={beliefs.map((belief) => belief.title)} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="noesis-inquiry-detail noesis-gutter flex-1 w-full overflow-y-auto pb-8 pt-[var(--page-top)] font-body" data-noesis-scroll-region data-noesis-identity="investigation">
      <header className="mb-8 border-b border-[var(--hairline)] pb-6">
        <div className="noesis-detail-toolbar">
          <button type="button" onClick={onBack} className="noesis-back-link">
            <ArrowLeft aria-hidden="true" /> Inquiries
          </button>
          <div className="flex items-center gap-2">
          </div>
        </div>
        {editingQuestion ? (
          <div className="mt-5 max-w-5xl space-y-3">
            <Label htmlFor={`question-title-${question.id}`}>Inquiry question</Label>
            <Textarea
              id={`question-title-${question.id}`}
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              className="min-h-[96px] text-xl font-semibold leading-snug sm:text-2xl"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-full"
                disabled={saving || !questionDraft.trim()}
                onClick={async () => {
                  if (!await onUpdateQuestion({ ...question, text: questionDraft.trim(), dateUpdated: today() })) return;
                  setEditingQuestion(false);
                  onAiFeedback('Inquiry updated.', 'The question was saved without changing its investigation state.');
                }}
              >
                <Check className="mr-2 size-4" /> Save question
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setQuestionDraft(question.text); setEditingQuestion(false); }}>
                <X className="mr-2 size-4" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DetailLabel view="questions" kind="Inquiry" status={question.status.replace(/_/g, ' ')} extra={sources.length ? `From ${sources[0].title}` : undefined} />
            <h1 className="noesis-page-title noesis-detail-title max-w-5xl">{question.text}</h1>
            <PromotedAnnotationOrigins origins={question.annotationOrigins} />
          </>
        )}
      </header>

      {(() => {
        const weights = candidateAnswers.map((candidate) => answerWeight(evidenceRecords, candidate.id));
        const lead = weights.length >= 2 ? candidateAnswers[weights.indexOf(Math.max(...weights))] : null;
        const next = candidateAnswers.length < 2
          ? { text: candidateAnswers.length ? 'Add a second possible answer to start weighing' : 'Add two possible answers to weigh', step: 'scale' as const }
          : evidenceRecords.some((item) => !item.candidateId) ? { text: 'Place your unassigned evidence on an answer', step: 'scale' as const }
          : !question.answer?.trim() && lead ? { text: `Write a working answer: the scale leans toward “${lead.statement.slice(0, 60)}”`, step: 'answer' as const }
          : beliefs.length ? { text: `Carry the answer back to “${beliefs[0].title.slice(0, 60)}”`, step: null }
          : question.answer?.trim() ? { text: 'Decide whether this answer is ready to become a position', step: 'decide' as const } : null;
        return next ? <div data-stage-tone="examine"><NextMove text={next.text} onClick={() => (next.step ? openWorkflowStep(next.step) : onOpenPosition(beliefs[0].id))} /></div> : null;
      })()}

      <div data-stage-tone="examine">
        <RecordTools
          tools={[
            { label: 'Add answer', onClick: () => { openWorkflowStep('scale'); window.requestAnimationFrame(() => document.getElementById(`add-answer-${question.id}`)?.focus()); } },
            { label: 'Add evidence', onClick: () => { setWorkflowStep('investigate'); setSelectedTool('Add evidence'); } },
            { label: 'Test in practice', onClick: () => { setWorkflowStep('investigate'); setSelectedTool('Test in practice'); } },
            { label: 'Decide', onClick: () => openWorkflowStep('decide') },
          ]}
          trailing={<>
            <ContextualAiPanel
              enabled={aiSettings.aiAssistanceEnabled}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiDepthFor(aiSettings, 'inquiries')}
              actions={['socratic_inquiry_challenge']}
              buildEnvelope={buildAiEnvelope}
              buttonLabel="Socratic Challenge"
              promptLabel="What part of this inquiry should Noesis pressure?"
              promptPlaceholder="For example: Test whether my current answer actually follows from the evidence."
              onAccept={(result, content) => onSaveAiReview(question.id, result, content)}
            />
            {!question.id.startsWith('open:') && !question.id.startsWith('annotation:') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-9 rounded-full" aria-label="Inquiry actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditingQuestion(true)}>
                    <Pencil className="mr-2 size-4" /> Edit inquiry
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 size-4" /> Delete inquiry
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>}
        />
      </div>

      <div className="noesis-workbench space-y-5" data-stage-tone="examine">
        <WorkbenchFlow
          label="Inquiry workbench workflow"
          activeId={workflowStep}
          onSelect={(id) => openWorkflowStep(id as typeof workflowStep)}
          steps={[
            { id: 'scale', label: 'Scale', description: 'Weigh your possible answers against the evidence you have placed on them.' },
            { id: 'frame', label: 'Frame', description: 'Name why the question matters, your current view, and uncertainty.', progress: [question.whyItMatters, question.currentIntuition, question.uncertainty].filter((value) => value?.trim()).length / 3 },
            { id: 'investigate', label: 'Evidence', description: 'Clarify, add evidence, compare answers, or test in practice.', progress: Math.min(1, (evidenceRecords.length + Math.min(2, candidateAnswers.length)) / 5), meta: `${evidenceRecords.length} evidence · ${candidateAnswers.length} answers` },
            { id: 'answer', label: 'Working answer', description: 'Write the best provisional answer you can support now.', progress: question.answer?.trim() ? 1 : 0 },
            { id: 'decide', label: 'Decide', description: 'Resolve, suspend, transform, archive, or keep the inquiry open.', progress: ['resolved', 'archived', 'transformed'].includes(question.status) ? 1 : 0 },
          ]}
        />
        {workflowStep === 'scale' && (
            <InquiryBalance
              question={question}
              disabled={saving}
            addAnswerId={`add-answer-${question.id}`}
            onRemoveAnswer={removeCandidateAnswer}
            workingAnswer={question.answer || ''}
            onEditAnswer={() => openWorkflowStep('answer')}
              onAddAnswer={async (statement) => {
                await onUpdateQuestion({
                  ...question,
                  candidateAnswers: [...(question.candidateAnswers || []), { id: crypto.randomUUID(), statement, confidence: 3, support: '', objection: '', consequence: '' }],
                  status: question.status === 'open' ? 'comparing_answers' as Question['status'] : question.status,
                  dateUpdated: today(),
                });
              }}
              onAssign={(evidenceId, candidateId) => {
                void onUpdateQuestion({
                  ...question,
                  evidenceRecords: evidenceRecords.map((item) => item.id === evidenceId ? { ...item, candidateId } : item),
                  dateUpdated: today(),
                });
              }}
            />
        )}
        {workflowStep === 'frame' && <WorkbenchPanel
          eyebrow="Frame"
          title="Your thinking"
          headingLevel={2}
          description="Socratic Challenge can start from the question alone. Add only the context that makes the investigation more precise."
        >
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-6">
              <div className="space-y-2">
              <Label htmlFor={`why-${question.id}`}>Why does this matter?</Label>
              <Textarea id={`why-${question.id}`} value={frameBase ? investigationDraft.whyItMatters : question.whyItMatters || ''} onChange={(event) => editFrameField('whyItMatters', event.target.value)} placeholder="Name the stakes, if useful." className="min-h-[108px]" disabled={saving} />
              </div>
              <div className="space-y-2">
              <Label htmlFor={`view-${question.id}`}>What do you currently think?</Label>
              <Textarea id={`view-${question.id}`} value={frameBase ? investigationDraft.currentIntuition : question.currentIntuition || ''} onChange={(event) => editFrameField('currentIntuition', event.target.value)} placeholder="Your present view can be tentative." className="min-h-[108px]" disabled={saving} />
              </div>
              <div className="space-y-2">
              <Label htmlFor={`uncertainty-${question.id}`}>What remains uncertain?</Label>
              <Textarea id={`uncertainty-${question.id}`} value={frameBase ? investigationDraft.uncertainty : question.uncertainty || ''} onChange={(event) => editFrameField('uncertainty', event.target.value)} placeholder="Name the part you cannot settle yet." className="min-h-[108px]" disabled={saving} />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveInvestigationFrame} disabled={saving || !frameBase || frameConflict}>{saving ? 'Saving...' : 'Save Context'}</Button>
              </div>
            </div>
            <ContextRail title="Investigation context">
              <EntityMeta items={[
                { label: 'Status', value: question.status.replace(/_/g, ' ') },
                { label: 'Sources', value: sources.length },
                { label: 'Candidate answers', value: candidateAnswerCount },
                { label: 'Evidence records', value: evidenceRecords.length },
              ]} />
            </ContextRail>
            {frameConflict && <div role="status" className="space-y-2 text-sm text-muted-foreground">
              <p>This inquiry changed while you were editing. Copy any input you want to keep before loading the saved context.</p>
              <Button type="button" variant="outline" onClick={loadSavedFrame}>Discard draft and load saved context</Button>
            </div>}
          </div>
        </WorkbenchPanel>}

        {workflowStep === 'answer' && <WorkbenchPanel eyebrow="Provisional conclusion" title="Current answer" description="Write the answer that leads right now. Saving it marks the inquiry provisionally answered, not permanently settled.">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            {question.answer?.trim() && <span className="font-code text-[10px] uppercase tracking-widest text-accent">Saved answer</span>}
          </div>
          <Textarea aria-label="Current answer" value={initialAnswer} disabled={saving} onChange={(event) => {
            const value = event.target.value;
            setAnswerDraft((draft) => ({ value, base: draft?.base ?? savedAnswer }));
          }} className="min-h-[180px] text-base leading-8" placeholder="What answer currently leads, and why does it remain revisable?" />
          {answerConflictNotice}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">Next:</span> {recommendedMove}</p>
            <Button onClick={() => saveProvisionalAnswer('provisionally_answered')} disabled={saving || answerConflict || !initialAnswer.trim()}>{saving ? 'Saving...' : 'Save Answer'}</Button>
          </div>
        </WorkbenchPanel>}

        {workflowStep === 'investigate' && !!question.investigationNotes?.some((note) => note.origin === 'ai-assisted') && (
          <AiAssistedHistory
            title="Reviewed challenge notes"
            entries={(question.investigationNotes || []).filter((note) => note.origin === 'ai-assisted').map((note) => ({
              id: note.id,
              action: 'socratic_inquiry_challenge',
              title: note.title || 'Socratic challenge',
              content: note.text,
              date: note.date,
              originDetails: note.provenance ? {
                provenance: note.provenance,
                target: { type: 'inquiry', id: question.id, fieldPath: 'investigationNotes.text', subrecordId: note.id },
              } : undefined,
            }))}
            onChange={async (entries) => {
              const userNotes = (question.investigationNotes || []).filter((note) => note.origin !== 'ai-assisted');
              if (!await onUpdateQuestion({
                ...question,
                investigationNotes: [
                  ...userNotes,
                  ...entries.map((entry) => ({
                    ...question.investigationNotes?.find((note) => note.id === entry.id && note.origin === 'ai-assisted'),
                    id: entry.id, title: entry.title, text: entry.content, origin: 'ai-assisted' as const, date: entry.date,
                  })),
                ],
                dateUpdated: today(),
              })) throw new Error('The challenge-note history was not saved.');
            }}
          />
        )}

        {(workflowStep === 'investigate' || workflowStep === 'decide') && <section className="noesis-workbench-panel" aria-label="Inquiry investigation tools">
          <header className="noesis-workbench-panel__header">
            <div className="min-w-0 flex-1">
              <div className="noesis-workbench-panel__eyebrow">{workflowStep === 'decide' ? 'Decide' : 'Investigate'}</div>
              <h3 className="noesis-workbench-panel__title">{workflowStep === 'decide' ? 'Decide the inquiry' : 'Investigation tools'}</h3>
              <p className="noesis-workbench-panel__description">{workflowStep === 'decide' ? 'Choose the outcome that best reflects where the inquiry stands now.' : 'Choose one focused action and work on it without leaving this section.'}</p>
            </div>
          </header>
          <div className="noesis-workbench-panel__body">
            {workflowStep === 'investigate' && <section className="noesis-recommendation">
              <div className="noesis-workbench-panel__eyebrow">Recommended next step</div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm leading-6 text-foreground">{INQUIRY_TOOL_COPY[recommended].description}</p>
                <Button onClick={() => { setWorkflowStep(recommended === 'Decide outcome' ? 'decide' : 'investigate'); setSelectedTool(recommended); }}>Open {recommended}</Button>
              </div>
            </section>}

            {workflowStep === 'investigate' && <ToolOptions label="Investigation tools" className="mt-4">
              {tools.filter((tool) => tool !== 'Decide outcome').map((tool) => (
                <ToolOption
                  key={tool}
                  label={tool}
                  description={INQUIRY_TOOL_COPY[tool].description}
                  active={selectedTool === tool}
                  onClick={() => { setWorkflowStep('investigate'); setSelectedTool(tool); }}
                />
              ))}
            </ToolOptions>}

            {selectedTool && (
              <section className="mt-5 border-t border-[var(--hairline)] pt-5">
                <div className="mb-4">
                  <div className="noesis-workbench-panel__eyebrow">{selectedTool}</div>
                  <p className="noesis-workbench-panel__description">{INQUIRY_TOOL_COPY[selectedTool].instruction}</p>
                </div>

                {selectedTool === 'Clarify question' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`clarify-${question.id}`}>Term or assumption to clarify</Label>
                      <Textarea id={`clarify-${question.id}`} value={clarificationDraft} onChange={(event) => setClarificationDraft(event.target.value)} placeholder="For example: What does “growth” mean in this question?" className="min-h-[96px]" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{(question.assumptions || []).length} clarification{(question.assumptions || []).length === 1 ? '' : 's'} saved.</p>
                      <Button onClick={addClarification} disabled={!clarificationDraft.trim()} className="rounded-full px-4">Save clarification</Button>
                    </div>
                    {(question.assumptions || []).length > 0 && (
                      <div className="flex flex-wrap gap-2">{question.assumptions?.map((assumption) => <Badge key={assumption} variant="outline" className="max-w-full whitespace-normal text-left">{assumption}</Badge>)}</div>
                    )}
                  </div>
                )}

                {selectedTool === 'Add evidence' && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {evidenceRecords.length > 0 && <ul aria-label="Saved evidence" className="divide-y divide-border border-b border-border md:col-span-2">
                      {evidenceRecords.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium">{item.claim}</p>
                            <p className="mt-1 break-words text-xs text-muted-foreground">{item.direction} · {candidateAnswers.find((candidate) => candidate.id === item.candidateId)?.statement || 'Unassigned'} · {item.reliability} reliability</p>
                          </div>
                          <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Edit evidence: ${item.claim}`} title="Edit evidence" onClick={() => { setEditingEvidenceId(item.id); setEvidenceDraft(item); evidenceInput.current?.focus(); }}>
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`evidence-${question.id}`}>What did you find?</Label>
                      <Textarea ref={evidenceInput} id={`evidence-${question.id}`} value={evidenceDraft.claim} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, claim: event.target.value }))} placeholder="A source claim, observation, counterexample, or unanswered fact." maxLength={1000} className="min-h-[96px]" />
                    </div>
                    <div className="space-y-2">
                      <Label>How does it affect this inquiry?</Label>
                      <Select value={evidenceDraft.direction} onValueChange={(value: InquiryEvidence['direction']) => setEvidenceDraft((prev) => ({ ...prev, direction: value }))}>
                        <SelectTrigger aria-label="Evidence direction"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="supports">Supports an answer</SelectItem><SelectItem value="challenges">Challenges an answer</SelectItem><SelectItem value="contextualizes">Adds context</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`origin-${question.id}`}>Where is it from? <span className="font-normal text-muted-foreground">Optional</span></Label>
                      <Input id={`origin-${question.id}`} value={evidenceDraft.origin} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, origin: event.target.value }))} placeholder="Source, conversation, or observation" maxLength={200} />
                    </div>
                    {candidateAnswers.length > 0 && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Which answer does it affect? <span className="font-normal text-muted-foreground">Optional</span></Label>
                        <Select value={evidenceDraft.candidateId || 'none'} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, candidateId: value === 'none' ? '' : value }))}>
                          <SelectTrigger aria-label="Assign evidence to answer"><SelectValue placeholder="Leave unassigned for now" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Leave unassigned for now</SelectItem>{candidateAnswers.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.statement.slice(0, 72)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <details className="md:col-span-2 rounded-lg border border-border/70 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground">Optional evidence details</summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <Select value={evidenceDraft.type} onValueChange={(value: InquiryEvidence['type']) => setEvidenceDraft((prev) => ({ ...prev, type: value }))}><SelectTrigger aria-label="Evidence type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="source excerpt">Source excerpt</SelectItem><SelectItem value="personal observation">Personal observation</SelectItem><SelectItem value="counterexample">Counterexample</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent></Select>
                        <Select value={evidenceDraft.strength} onValueChange={(value: InquiryEvidence['strength']) => setEvidenceDraft((prev) => ({ ...prev, strength: value }))}><SelectTrigger aria-label="Evidence strength"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weak">Weak</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent></Select>
                        <Select value={evidenceDraft.reliability} onValueChange={(value: InquiryEvidence['reliability']) => setEvidenceDraft((prev) => ({ ...prev, reliability: value }))}><SelectTrigger aria-label="Evidence reliability"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low reliability</SelectItem><SelectItem value="moderate">Moderate reliability</SelectItem><SelectItem value="high">High reliability</SelectItem></SelectContent></Select>
                        <div className="space-y-2 md:col-span-3"><Label htmlFor={`evidence-notes-${question.id}`}>Notes</Label><Input id={`evidence-notes-${question.id}`} maxLength={300} value={evidenceDraft.notes} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, notes: event.target.value }))} /></div>
                      </div>
                    </details>
                    <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
                      {editingEvidenceId && <Button variant="ghost" disabled={saving} className="mr-auto text-destructive" onClick={() => setEvidenceToRemove(evidenceRecords.find((item) => item.id === editingEvidenceId) || null)}>Remove evidence</Button>}
                      {editingEvidenceId && <Button variant="ghost" onClick={() => { setEditingEvidenceId(null); setEvidenceDraft(EMPTY_EVIDENCE); }}>Cancel edit</Button>}
                      <Button onClick={addEvidenceRecord} disabled={saving || !evidenceDraft.claim.trim()}>{editingEvidenceId ? 'Save changes' : 'Save evidence'}</Button>
                    </div>
                  </div>
                )}

                {selectedTool === 'Compare answers' && (
                  <div className="space-y-4">
                    {candidateAnswers.length > 0 && <div className="grid gap-2">{candidateAnswers.map((candidate) => <div key={candidate.id} className="rounded-lg border border-border bg-card p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">{candidate.statement}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{candidate.support ? `Support: ${candidate.support}` : 'No supporting reason recorded.'}{candidate.objection ? ` · Objection: ${candidate.objection}` : ''}</p></div><Button type="button" variant="ghost" size="sm" onClick={() => removeCandidateAnswer(candidate.id)} className="text-destructive hover:text-destructive">Remove</Button></div></div>)}</div>}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2"><Label htmlFor={`candidate-${question.id}`}>Possible answer</Label><Textarea id={`candidate-${question.id}`} value={candidateDraft.statement} onChange={(event) => setCandidateDraft((prev) => ({ ...prev, statement: event.target.value }))} placeholder="One answer worth comparing, not a final conclusion." className="min-h-[88px]" /></div>
                      <div className="space-y-2"><Label htmlFor={`candidate-support-${question.id}`}>Why might it be true? <span className="font-normal text-muted-foreground">Optional</span></Label><Input id={`candidate-support-${question.id}`} value={candidateDraft.support} onChange={(event) => setCandidateDraft((prev) => ({ ...prev, support: event.target.value }))} placeholder="A reason or source" /></div>
                      <div className="space-y-2"><Label htmlFor={`candidate-objection-${question.id}`}>What could be wrong with it? <span className="font-normal text-muted-foreground">Optional</span></Label><Input id={`candidate-objection-${question.id}`} value={candidateDraft.objection} onChange={(event) => setCandidateDraft((prev) => ({ ...prev, objection: event.target.value }))} placeholder="A limitation or counterexample" /></div>
                      <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between"><Label htmlFor={`candidate-confidence-${question.id}`}>How likely does this currently seem?</Label><span className="text-sm font-semibold text-foreground">{candidateDraft.confidence * 20}%</span></div><input id={`candidate-confidence-${question.id}`} type="range" min="1" max="5" step="1" value={candidateDraft.confidence} onChange={(event) => setCandidateDraft((prev) => ({ ...prev, confidence: Number(event.target.value) }))} className="w-full accent-[hsl(var(--accent))]" aria-label="Candidate answer confidence" /></div>
                    </div>
                    <div className="flex justify-end"><Button onClick={addCandidateAnswer} disabled={!candidateDraft.statement.trim()} className="rounded-full px-4">Save possible answer</Button></div>
                  </div>
                )}

                {selectedTool === 'Test in practice' && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor={`test-question-${question.id}`}>What are you trying to learn?</Label><Textarea id={`test-question-${question.id}`} value={testDraft.tested} onChange={(event) => setTestDraft((prev) => ({ ...prev, tested: event.target.value }))} placeholder="The claim or pattern you want to test." className="min-h-[92px]" /></div>
                    <div className="space-y-2"><Label htmlFor={`test-method-${question.id}`}>What will you do or observe?</Label><Textarea id={`test-method-${question.id}`} value={testDraft.method} onChange={(event) => setTestDraft((prev) => ({ ...prev, method: event.target.value }))} placeholder="One concrete action, observation, conversation, or research step." className="min-h-[92px]" /></div>
                    <details className="md:col-span-2 rounded-lg border border-border/70 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground">Optional test details</summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`test-title-${question.id}`}>Practice name</Label>
                          <Input id={`test-title-${question.id}`} value={testDraft.title} onChange={(event) => setTestDraft((prev) => ({ ...prev, title: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`test-reviewDate-${question.id}`}>When will you review it?</Label>
                          <Input id={`test-reviewDate-${question.id}`} value={testDraft.reviewDate} onChange={(event) => setTestDraft((prev) => ({ ...prev, reviewDate: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`test-predictionA-${question.id}`}>What would you expect to see?</Label>
                          <Textarea id={`test-predictionA-${question.id}`} value={testDraft.predictionA} onChange={(event) => setTestDraft((prev) => ({ ...prev, predictionA: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`test-result-${question.id}`}>Result, if already known</Label>
                          <Textarea id={`test-result-${question.id}`} value={testDraft.result} onChange={(event) => setTestDraft((prev) => ({ ...prev, result: event.target.value }))} />
                        </div>
                      </div>
                    </details>
                    <div className="flex flex-wrap justify-end gap-2 md:col-span-2"><Button onClick={createTestRecord} disabled={!testDraft.tested.trim() || !testDraft.method.trim()} className="rounded-full px-4">Create practice</Button></div>
                    <div className="rounded-lg border border-border/70 p-3 md:col-span-2">
                      <Label className="mb-2 block" htmlFor="inquiry-existing-practice">Already have a practice?</Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Select value={existingPracticeId} onValueChange={setExistingPracticeId} disabled={saving}>
                          <SelectTrigger id="inquiry-existing-practice" className="flex-1"><SelectValue placeholder="Choose a practice to link" /></SelectTrigger>
                          <SelectContent>{availablePractices.filter((item) => !(question.practiceIds?.includes(item.id) && item.questionIds?.includes(question.id))).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="outline" onClick={linkExistingPractice} disabled={saving || !existingPracticeId}>Link practice</Button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTool === 'Develop a work' && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button onClick={createExpandedWork} disabled={saving}>Create a work</Button>
                      <Select value={existingWorkId} onValueChange={setExistingWorkId} disabled={saving}>
                        <SelectTrigger aria-label="Choose an existing work to link" className="flex-1"><SelectValue placeholder="Or choose a work to link" /></SelectTrigger>
                        <SelectContent>{availableDrafts.filter((item) => !(question.draftIds?.includes(item.id) && item.questionIds?.includes(question.id))).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="outline" onClick={linkExistingWork} disabled={saving || !existingWorkId}>Link work</Button>
                    </div>
                    {drafts.length > 0 && <p className="text-xs text-muted-foreground">Linked work: {drafts.map((work) => work.title).join(', ')}</p>}
                  </div>
                )}

                {selectedTool === 'Decide outcome' && (
                  <div className="space-y-3">
                    <div className="space-y-2"><Label htmlFor={`resolution-${question.id}`}>What led you here?</Label><Textarea id={`resolution-${question.id}`} value={investigationDraft.resolutionSummary} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, resolutionSummary: event.target.value }))} placeholder="What mattered most, and what remains open?" className="min-h-[96px]" /></div>
                    {!inquiryHasRecordedObjection(question) && (
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="text-sm font-semibold">Checkpoint: steelman before you settle</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Use Compare answers to record the strongest objection. If that would not help this inquiry, record why you are skipping it.</p>
                        <Input value={checkpointSkipReason} onChange={(event) => setCheckpointSkipReason(event.target.value)} className="mt-3" aria-label="Reason for skipping steelman checkpoint" placeholder="Why is this checkpoint not useful here?" />
                      </div>
                    )}
                    {!isInquiryClosed(question) && (
                      <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
                        <div className="space-y-2">
                          <Label htmlFor={`position-confidence-${question.id}`}>Position confidence (%)</Label>
                          <Input id={`position-confidence-${question.id}`} type="number" min={0} max={100} value={positionConfidence} onChange={(event) => setPositionConfidence(Math.min(100, Math.max(0, Number(event.target.value))))} className="w-24" />
                        </div>
                        <Button onClick={() => void saveProvisionalAnswer('converted')} disabled={saving || answerConflict || !initialAnswer.trim()}>
                          {saving ? 'Saving...' : 'Form Position from Answer'}
                        </Button>
                      </div>
                    )}
                    {beliefs.length > 0 && <div className="flex flex-wrap gap-2">{beliefs.map((belief) => <Button key={belief.id} variant="outline" onClick={() => onOpenPosition(belief.id)} className="h-auto min-h-11 max-w-full whitespace-normal text-left">Open position: {belief.title}</Button>)}</div>}
                    {answerConflictNotice}
                    <div className="grid gap-2 md:grid-cols-2">{RESOLUTION_OPTIONS.map((option) => <button key={option.status} type="button" onClick={() => void saveProvisionalAnswer(option.status)} disabled={saving || answerConflict || !initialAnswer.trim()} className={cn('rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50', question.status === option.status ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-accent/40 hover:bg-accent/5')}><div className="text-sm font-semibold text-foreground">{option.label}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p></button>)}</div>
                  </div>
                )}
              </section>
            )}
          </div>
        </section>}
      </div>
      <ConfirmActionDialog
        open={Boolean(evidenceToRemove)}
        onOpenChange={(open) => { if (!open) setEvidenceToRemove(null); }}
        title="Remove evidence?"
        description="This removes the evidence record from this inquiry. Linked sources and candidate answers are not deleted."
        confirmLabel="Remove evidence"
        destructive
        onConfirm={async () => {
          if (!evidenceToRemove) return;
          if (!await onUpdateQuestion({ ...question, evidenceRecords: evidenceRecords.filter((item) => item.id !== evidenceToRemove.id), dateUpdated: today() })) {
            throw new Error('The evidence could not be removed. Please retry.');
          }
          setEditingEvidenceId(null);
          setEvidenceDraft(EMPTY_EVIDENCE);
        }}
      />
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete inquiry?"
        description={`This removes "${question.text}" from Inquiries. Linked sources, positions, works, and Evolution history will remain.`}
        confirmLabel="Delete Inquiry"
        alternateLabel="Abandon instead"
        destructive
        onAlternate={async () => {
          if (!await onUpdateQuestion({
            ...question,
            status: 'archived',
            dateUpdated: new Date().toISOString(),
          })) throw new Error('The inquiry could not be archived. Please retry.');
        }}
        onConfirm={async () => {
          await onDeleteQuestion(question.id);
          onBack();
        }}
      />
    </div>
  );
}

function ContextPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-6 bg-card border border-accent/10 shadow-sm rounded-xl">
      <h3 className="font-code text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-5 font-bold">{title}</h3>
      <div className="space-y-3">
        {items.length ? items.map((item, index) => (
          <div key={`${item}-${index}`} className="rounded-lg bg-muted/20 p-4 text-[13px] italic border border-border/10 line-clamp-2 leading-relaxed text-primary/80">
            {item}
          </div>
        )) : (
          <p className="text-[12px] text-muted-foreground italic px-2 font-body">No linked evidence discovered.</p>
        )}
      </div>
    </Card>
  );
}
