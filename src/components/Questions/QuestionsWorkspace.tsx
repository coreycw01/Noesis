
"use client";

import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, HelpCircle, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SourceLinker } from '@/components/SourceLinker';
import type { Concept, Draft, Media, Practice, Question, VaultEntry } from '@/lib/types';
import { allQuestions, conceptKey, today } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { searchMatches } from '@/lib/search';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import type { AiContextEnvelope } from '@/lib/contextual-ai';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
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

interface QuestionsWorkspaceProps {
  aiSettings: import('@/lib/types').AiSettings;
  questions: Question[];
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  concepts: Concept[];
  onAddQuestion: (data: Partial<Question>) => Question;
  onUpdateQuestion: (question: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onAddVaultEntry: (data: Partial<VaultEntry>) => void;
  onAddDraft: (data: Partial<Draft>) => Draft;
  onUpdateDraft: (draft: Draft) => void;
  onAddPractice: (data: Partial<Practice>) => Practice;
  onUpdatePractice: (practice: Practice) => void;
  onOpenWork: (id: string) => void;
  onOpenPractice: (id: string) => void;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => void;
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
  { status: 'converted', label: 'Converted', description: 'The inquiry has become a position, work, or another object.' },
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

export function QuestionsWorkspace({ aiSettings, questions, media, vault, drafts, practices, concepts, onAddQuestion, onUpdateQuestion, onDeleteQuestion, onAddVaultEntry, onAddDraft, onUpdateDraft, onAddPractice, onUpdatePractice, onOpenWork, onOpenPractice, onFormPositionFromInquiry, focusedQuestionId, onFocusedQuestionHandled, onOpenQuestionRoute }: QuestionsWorkspaceProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailSection, setDetailSection] = useState<'investigation' | 'answer'>('investigation');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ text: '', sourceIds: [] as string[] });
  const { toast } = useToast();

  const all = useMemo(() => allQuestions(media, questions), [media, questions]);
  React.useEffect(() => {
    if (!focusedQuestionId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(focusedQuestionId);
    onFocusedQuestionHandled?.();
  }, [focusedQuestionId, onFocusedQuestionHandled]);
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
  const selected = all.find((question) => question.id === selectedId) || null;

  const openQuestion = (id: string, section: 'investigation' | 'answer' = 'investigation') => {
    setDetailSection(section);
    setSelectedId(id);
    onOpenQuestionRoute?.(id);
  };

  const closeQuestion = () => {
    setSelectedId(null);
    onOpenQuestionRoute?.(null);
  };

  const createQuestion = () => {
    if (!newQuestion.text.trim()) return;
    const created = onAddQuestion({ text: newQuestion.text.trim(), status: 'captured', sourceIds: newQuestion.sourceIds, evidenceIds: newQuestion.sourceIds });
    setNewQuestion({ text: '', sourceIds: [] });
    setIsAddOpen(false);
    openQuestion(created.id);
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
    const relatedBeliefs = vault.filter((entry) => (entry.tags || []).some((tag) => conceptNames.map(conceptKey).includes(conceptKey(tag))) || (entry.sourceIds || []).some((id) => sourceIds.includes(id)));
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
          onDeleteQuestion={(id) => {
            onDeleteQuestion(id);
            closeQuestion();
          }}
          onAddDraft={onAddDraft}
          onUpdateDraft={onUpdateDraft}
          onAddPractice={onAddPractice}
          onUpdatePractice={onUpdatePractice}
          onOpenWork={onOpenWork}
          onOpenPractice={onOpenPractice}
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
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
      <PageHeader
        title="Inquiries"
        description="Work through returning questions as structured investigations with evidence, provisional answers, and resolution summaries."
        actions={
          <>
            <Button onClick={() => setIsAddOpen(true)} size="sm" className="bg-accent hover:bg-accent/90 rounded-full h-9 px-6 font-bold">
              <Plus className="size-4 mr-1.5" /> ADD INQUIRY
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
        className="mb-3"
      >
        <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
          <SelectTrigger className="w-56 h-10 font-code text-[10px] uppercase rounded-full bg-card shadow-sm border-border/60">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((question) => {
          const sources = media.filter(m => inquirySourceIds(question).includes(m.id));
          const nextStep = inquiryCardNextStep(question);
          const closed = isInquiryClosed(question);

          return (
            <Card key={question.id} className="border border-accent/15 bg-card/95 p-4 rounded-xl shadow-sm">
              <button className="w-full text-left group" onClick={() => openQuestion(question.id)}>
                <h3 className="text-xl font-headline font-bold italic group-hover:text-accent transition-colors leading-snug text-primary mb-3">
                  {question.text}
                </h3>
              </button>

              <div className="font-body text-xs text-muted-foreground italic flex items-center gap-2 opacity-70 border-t border-border/20 pt-3 mb-3">
                {sources.length > 0 ? (
                  <span className="truncate">From {sources.map(s => s.title).join(', ')}</span>
                ) : (
                  <span>Synthesized from various internal connections</span>
                )}
              </div>

              <div className="mb-4 border-l-2 border-accent bg-accent/5 px-3 py-2">
                <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Next investigation step</div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{nextStep}</p>
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
          <DialogHeader><DialogTitle className="font-headline text-3xl italic">Formulate Inquiry</DialogTitle></DialogHeader>
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
          <DialogFooter className="pt-8"><Button onClick={createQuestion} className="w-full h-12 rounded-full font-bold shadow-lg shadow-accent/20">OPEN INVESTIGATION</Button></DialogFooter>
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

function QuestionDetail({ aiSettings, question, sources, concepts, beliefs, drafts, practices, availableDrafts, availablePractices, onBack, onUpdateQuestion, onDeleteQuestion, onAddDraft, onUpdateDraft, onAddPractice, onUpdatePractice, onOpenWork, onOpenPractice, onFormPositionFromInquiry, onAiFeedback, routeOwned = false, initialSection = 'investigation' }: {
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
  onUpdateQuestion: (question: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onAddDraft: (data: Partial<Draft>) => Draft;
  onUpdateDraft: (draft: Draft) => void;
  onAddPractice: (data: Partial<Practice>) => Practice;
  onUpdatePractice: (practice: Practice) => void;
  onOpenWork: (id: string) => void;
  onOpenPractice: (id: string) => void;
  onFormPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => void;
  onAiFeedback: (title: string, description: string, variant?: 'default' | 'destructive') => void;
  routeOwned?: boolean;
  initialSection?: 'investigation' | 'answer';
}) {
  const answerRef = useRef<HTMLDivElement>(null);
  const [initialAnswer, setInitialAnswer] = useState(question.answer || '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<InquiryTool | null>(null);
  const [clarificationDraft, setClarificationDraft] = useState('');
  const [existingPracticeId, setExistingPracticeId] = useState('');
  const [existingWorkId, setExistingWorkId] = useState('');
  const [investigationDraft, setInvestigationDraft] = useState({
    whyItMatters: question.whyItMatters || '',
    currentIntuition: question.currentIntuition || '',
    uncertainty: question.uncertainty || '',
    resolutionSummary: question.resolutionSummary || '',
  });
  const [candidateDraft, setCandidateDraft] = useState({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
  const [evidenceDraft, setEvidenceDraft] = useState({ claim: '', type: 'source excerpt', origin: '', candidateId: '', direction: 'supports', strength: 'moderate', reliability: 'moderate', notes: '' });
  const [testDraft, setTestDraft] = useState({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
  React.useEffect(() => {
    if (initialSection !== 'answer') return;
    const target = answerRef.current;
    const frame = window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [initialSection, question.id]);
  React.useEffect(() => {
    setInitialAnswer(question.answer || '');
    setInvestigationDraft({
      whyItMatters: question.whyItMatters || '',
      currentIntuition: question.currentIntuition || '',
      uncertainty: question.uncertainty || '',
      resolutionSummary: question.resolutionSummary || '',
    });
    setClarificationDraft('');
    setCandidateDraft({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
    setEvidenceDraft({ claim: '', type: 'source excerpt', origin: '', candidateId: '', direction: 'supports', strength: 'moderate', reliability: 'moderate', notes: '' });
    setTestDraft({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
  }, [question.id]);
  const { tools, recommended } = investigationTools(question, drafts, practices);
  const candidateAnswers = question.candidateAnswers || [];
  const candidateAnswerCount = inquiryCandidateCount(question);
  const recommendedMove = INQUIRY_TOOL_COPY[recommended].description;

  const saveProvisionalAnswer = (status: Question['status'] = 'provisionally_answered') => {
    if (!initialAnswer.trim()) {
      onAiFeedback('Answer required', 'Write a provisional answer before saving this inquiry.', 'destructive');
      return;
    }
    const requiresSummary = ['resolved', 'suspended', 'converted', 'no_longer_meaningful'].includes(status);
    if (requiresSummary && !investigationDraft.resolutionSummary.trim()) {
      onAiFeedback('Resolution summary required', 'Add a short resolution summary before choosing this inquiry outcome.', 'destructive');
      return;
    }
    onUpdateQuestion({
      ...question,
      answer: initialAnswer.trim(),
      status,
      resolutionSummary: requiresSummary || investigationDraft.resolutionSummary.trim() ? investigationDraft.resolutionSummary.trim() : question.resolutionSummary || '',
      dateUpdated: today(),
    });
    onAiFeedback(status === 'resolved' ? 'Inquiry resolved.' : 'Inquiry outcome saved.', status === 'resolved' ? 'The resolution summary is now stored on this inquiry.' : `Marked as ${status.replace(/_/g, ' ')} without pretending the question is fully closed.`);
  };

  const saveInvestigationFrame = () => {
    onUpdateQuestion({
      ...question,
      whyItMatters: investigationDraft.whyItMatters.trim(),
      currentIntuition: investigationDraft.currentIntuition.trim(),
      uncertainty: investigationDraft.uncertainty.trim(),
      dateUpdated: today(),
    });
    onAiFeedback('Context saved.', 'Your stakes, current view, and remaining uncertainty are now part of this inquiry.');
  };

  const addClarification = () => {
    const clarification = clarificationDraft.trim();
    if (!clarification) {
      onAiFeedback('Clarification required', 'Name one term or assumption before saving it.', 'destructive');
      return;
    }
    onUpdateQuestion({
      ...question,
      assumptions: Array.from(new Set([...(question.assumptions || []), clarification])),
      dateUpdated: today(),
    });
    setClarificationDraft('');
    onAiFeedback('Clarification saved.', 'This term or assumption is now part of the inquiry record.');
  };

  const addCandidateAnswer = () => {
    if (!candidateDraft.statement.trim()) {
      onAiFeedback('Candidate answer required', 'Write the candidate answer before adding it.', 'destructive');
      return;
    }
    const nextCandidate = {
      id: `candidate-${Date.now()}`,
      statement: candidateDraft.statement.trim(),
      confidence: candidateDraft.confidence,
      support: candidateDraft.support.trim(),
      objection: candidateDraft.objection.trim(),
      consequence: candidateDraft.consequence.trim(),
    };
    onUpdateQuestion({
      ...question,
      candidateAnswers: [...(question.candidateAnswers || []), nextCandidate],
      status: question.status === 'open' ? 'comparing_answers' as Question['status'] : question.status,
      dateUpdated: today(),
    });
    setCandidateDraft({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
    onAiFeedback('Candidate answer added.', 'You can compare this answer against evidence and objections.');
  };

  const removeCandidateAnswer = (id: string) => {
    onUpdateQuestion({
      ...question,
      candidateAnswers: (question.candidateAnswers || []).filter((candidate) => candidate.id !== id),
      dateUpdated: today(),
    });
  };

  const addEvidenceRecord = () => {
    if (!evidenceDraft.claim.trim()) {
      onAiFeedback('Evidence claim required', 'Write the claim, observation, excerpt, or unknown before adding it.', 'destructive');
      return;
    }
    const targetCandidateId = evidenceDraft.candidateId || candidateAnswers[0]?.id || '';
    const nextCandidates = targetCandidateId
      ? candidateAnswers.map((candidate) => {
          if (candidate.id !== targetCandidateId) return candidate;
          const record = `${evidenceDraft.claim.trim()} (${evidenceDraft.type}; ${evidenceDraft.direction}; strength: ${evidenceDraft.strength}; reliability: ${evidenceDraft.reliability}${evidenceDraft.origin.trim() ? `; origin: ${evidenceDraft.origin.trim()}` : ''}${evidenceDraft.notes.trim() ? `; notes: ${evidenceDraft.notes.trim()}` : ''})`;
          if (evidenceDraft.direction === 'challenges') return { ...candidate, objection: [candidate.objection, record].filter(Boolean).join('\n') };
          if (evidenceDraft.direction === 'contextualizes') return { ...candidate, consequence: [candidate.consequence, record].filter(Boolean).join('\n') };
          return { ...candidate, support: [candidate.support, record].filter(Boolean).join('\n') };
        })
      : candidateAnswers;
    onUpdateQuestion({
      ...question,
      candidateAnswers: nextCandidates,
      currentIntuition: targetCandidateId ? question.currentIntuition : [question.currentIntuition, `Evidence to classify: ${evidenceDraft.claim.trim()}`].filter(Boolean).join('\n'),
      status: 'gathering_evidence',
      dateUpdated: today(),
    });
    setEvidenceDraft({ claim: '', type: 'source excerpt', origin: '', candidateId: '', direction: 'supports', strength: 'moderate', reliability: 'moderate', notes: '' });
    onAiFeedback('Evidence added.', targetCandidateId ? 'The evidence was attached to the selected candidate answer.' : 'Saved as inquiry evidence to classify later.');
  };

  const createTestRecord = () => {
    if (!testDraft.tested.trim() || !testDraft.method.trim()) {
      onAiFeedback('Test required', 'Name the test or describe what action, observation, conversation, or research would test this inquiry.', 'destructive');
      return;
    }
    const title = testDraft.title.trim() || `Test for: ${question.text.slice(0, 60)}`;
    const created = onAddPractice({
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
      positionIds: beliefs.map((belief) => belief.id),
      notes: testDraft.reviewDate.trim() ? `Review date: ${testDraft.reviewDate.trim()}` : '',
    });
    onUpdateQuestion({
      ...question,
      practiceIds: [...new Set([...(question.practiceIds || []), created.id])],
      status: question.status === 'captured' ? 'investigating' : question.status,
      dateUpdated: today(),
    });
    setTestDraft({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
    onAiFeedback('Test created.', 'A linked practice was created so the inquiry can be tested through action or observation.');
  };

  const linkExistingPractice = () => {
    const practice = availablePractices.find((item) => item.id === existingPracticeId);
    if (!practice) return;
    onUpdatePractice({ ...practice, questionIds: [...new Set([...(practice.questionIds || []), question.id])], dateUpdated: today() });
    onUpdateQuestion({ ...question, practiceIds: [...new Set([...(question.practiceIds || []), practice.id])], dateUpdated: today() });
    setExistingPracticeId('');
    onAiFeedback('Practice linked.', `"${practice.title}" now tests this inquiry.`);
  };

  const createExpandedWork = () => {
    const created = onAddDraft({
      title: `Exploring: ${question.text.slice(0, 72)}`,
      type: 'essay',
      status: 'seed',
      body: question.answer?.trim() || question.currentIntuition?.trim() || question.text,
      questionIds: [question.id],
      sourceIds: sources.map((source) => source.id),
      beliefIds: beliefs.map((belief) => belief.id),
      conceptTags: concepts,
    });
    onUpdateQuestion({ ...question, draftIds: [...new Set([...(question.draftIds || []), created.id])], dateUpdated: today() });
    onOpenWork(created.id);
  };

  const linkExistingWork = () => {
    const work = availableDrafts.find((item) => item.id === existingWorkId);
    if (!work) return;
    onUpdateDraft({ ...work, questionIds: [...new Set([...(work.questionIds || []), question.id])] });
    onUpdateQuestion({ ...question, draftIds: [...new Set([...(question.draftIds || []), work.id])], dateUpdated: today() });
    setExistingWorkId('');
    onAiFeedback('Work linked.', `"${work.title}" now develops this inquiry.`);
  };

  const updateInvestigationStatus = (status: Question['status']) => {
    onUpdateQuestion({ ...question, status, dateUpdated: today() });
    onAiFeedback('Inquiry status updated.', `Marked as ${status.replace(/_/g, ' ')}.`);
  };

  const buildAiEnvelope = (): AiContextEnvelope => ({
    action: 'socratic_inquiry_challenge',
    scope: 'linked_items',
    targetType: 'inquiry',
    targetId: question.id,
    itemMemory: inquiryAiItemMemory(question),
    linkedMemory: [
      ...sources.slice(0, 8).map((source) => `Source: ${source.title} - ${source.description || source.capture?.after?.coreArgument || 'No summary'}`),
      ...beliefs.slice(0, 6).map((position) => `Position: ${position.statement || position.title}`),
      ...practices.slice(0, 4).map((practice) => `Practice: ${practice.title} - ${practice.observedOutcome || practice.status}`),
    ],
  });

  if (question.status === 'archived') {
    return (
      <div className="flex-1 w-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 font-body" data-noesis-scroll-region>
        <Button variant="ghost" onClick={onBack} className="mb-5 h-9 rounded-full font-code text-[10px] uppercase tracking-widest">
          <ArrowLeft className="mr-2 size-4" /> Back to Inquiries
        </Button>
        <Card className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-3 rounded-full">Archived inquiry</Badge>
              <h1 className="noesis-page-title text-3xl sm:text-4xl">{question.text}</h1>
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
    <div className="flex-1 w-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 font-body" data-noesis-scroll-region>
      <header className="mb-6 border-b border-border/70 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={onBack} className="h-9 rounded-full px-3 font-code text-[10px] uppercase tracking-widest hover:bg-muted/50">
              <ArrowLeft className="mr-2 size-4" /> Back
            </Button>
            <Badge variant="outline" className="rounded-full capitalize">{question.status.replace(/_/g, ' ')}</Badge>
            {!!sources.length && <span className="max-w-[260px] truncate text-xs text-muted-foreground">From {sources[0].title}</span>}
          </div>
          <div className="flex items-center gap-2">
            <ContextualAiPanel
              enabled={aiSettings.aiAssistanceEnabled}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiSettings.defaultReasoningDepth}
              retainAcceptedProvenance={aiSettings.retainAcceptedAiProvenance}
              actions={['socratic_inquiry_challenge']}
              buildEnvelope={buildAiEnvelope}
              buttonLabel="Socratic Challenge"
              onAccept={(_result, content) => onUpdateQuestion({
                ...question,
                investigationNotes: [
                  ...(question.investigationNotes || []),
                  { id: crypto.randomUUID(), text: content, origin: 'ai-assisted', date: today() },
                ],
                dateUpdated: today(),
              })}
            />
            {!question.id.startsWith('open:') && !question.id.startsWith('annotation:') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-9 rounded-full" aria-label="Inquiry actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 size-4" /> Delete inquiry
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <h1 className="noesis-page-title mt-5 max-w-5xl text-3xl leading-tight sm:text-4xl">{question.text}</h1>
      </header>

      <div className="mx-auto max-w-5xl space-y-5">
        <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <div className="readex-kicker">Your thinking</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Socratic Challenge can start from the question alone. These optional fields make its challenge more precise without turning the inquiry into a worksheet.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`why-${question.id}`}>Why does this matter?</Label>
              <Textarea id={`why-${question.id}`} value={investigationDraft.whyItMatters} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, whyItMatters: event.target.value }))} placeholder="Name the stakes, if useful." className="min-h-[108px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`view-${question.id}`}>What do you currently think?</Label>
              <Textarea id={`view-${question.id}`} value={investigationDraft.currentIntuition} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, currentIntuition: event.target.value }))} placeholder="Your present view can be tentative." className="min-h-[108px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`uncertainty-${question.id}`}>What remains uncertain?</Label>
              <Textarea id={`uncertainty-${question.id}`} value={investigationDraft.uncertainty} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, uncertainty: event.target.value }))} placeholder="Name the part you cannot settle yet." className="min-h-[108px]" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveInvestigationFrame} className="rounded-full px-5">Save Context</Button>
          </div>
        </Card>

        <Card ref={answerRef} className="scroll-mt-6 rounded-2xl border border-accent/20 bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="readex-kicker text-accent">Current answer</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Write the answer that leads right now. Saving it marks the inquiry provisionally answered, not permanently settled.</p>
            </div>
            {question.answer?.trim() && <Badge variant="outline" className="rounded-full">Saved</Badge>}
          </div>
          <Textarea value={initialAnswer} onChange={(event) => setInitialAnswer(event.target.value)} className="min-h-[180px] text-base leading-8" placeholder="What answer currently leads, and why does it remain revisable?" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">Next:</span> {recommendedMove}</p>
            <Button onClick={() => saveProvisionalAnswer('provisionally_answered')} disabled={!initialAnswer.trim()} className="rounded-full px-5">Save Answer</Button>
          </div>
        </Card>

        {!!question.investigationNotes?.length && (
          <details className="rounded-2xl border border-border bg-card px-5 py-4">
            <summary className="cursor-pointer font-code text-[10px] uppercase tracking-widest text-muted-foreground">Reviewed challenge notes ({question.investigationNotes.length})</summary>
            <div className="mt-4 space-y-3">
              {question.investigationNotes.map((note) => (
                <div key={note.id} className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">{note.origin.replace('-', ' ')} · {note.date}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{note.text}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        <details className="group rounded-2xl border border-border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <div className="text-sm font-semibold text-foreground">More tools</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose one focused action when you are ready to take the inquiry further.</p>
            </div>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border p-4 sm:p-5">
            <section className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="readex-kicker text-accent">Recommended next step</div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm leading-6 text-foreground">{INQUIRY_TOOL_COPY[recommended].description}</p>
                <Button onClick={() => setSelectedTool(recommended)} className="rounded-full px-4">Open {recommended}</Button>
              </div>
            </section>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => setSelectedTool(tool)}
                  className={cn(
                    'min-h-20 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selectedTool === tool ? 'border-accent bg-accent/10' : 'border-border bg-background/60 hover:border-accent/50 hover:bg-accent/5'
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">{tool}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{INQUIRY_TOOL_COPY[tool].description}</span>
                </button>
              ))}
            </div>

            {selectedTool && (
              <section className="mt-4 rounded-xl border border-border bg-background/60 p-4">
                <div className="mb-4">
                  <div className="readex-kicker">{selectedTool}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{INQUIRY_TOOL_COPY[selectedTool].instruction}</p>
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
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`evidence-${question.id}`}>What did you find?</Label>
                      <Textarea id={`evidence-${question.id}`} value={evidenceDraft.claim} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, claim: event.target.value }))} placeholder="A source claim, observation, counterexample, or unanswered fact." className="min-h-[96px]" />
                    </div>
                    <div className="space-y-2">
                      <Label>How does it affect this inquiry?</Label>
                      <Select value={evidenceDraft.direction} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, direction: value }))}>
                        <SelectTrigger aria-label="Evidence direction"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="supports">Supports an answer</SelectItem><SelectItem value="challenges">Challenges an answer</SelectItem><SelectItem value="contextualizes">Adds context</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`origin-${question.id}`}>Where is it from? <span className="font-normal text-muted-foreground">Optional</span></Label>
                      <Input id={`origin-${question.id}`} value={evidenceDraft.origin} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, origin: event.target.value }))} placeholder="Source, conversation, or observation" />
                    </div>
                    {candidateAnswers.length > 0 && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Which answer does it affect? <span className="font-normal text-muted-foreground">Optional</span></Label>
                        <Select value={evidenceDraft.candidateId || 'none'} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, candidateId: value === 'none' ? '' : value }))}>
                          <SelectTrigger><SelectValue placeholder="Leave unassigned for now" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Leave unassigned for now</SelectItem>{candidateAnswers.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.statement.slice(0, 72)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <details className="md:col-span-2 rounded-lg border border-border/70 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground">Optional evidence details</summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <Select value={evidenceDraft.type} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, type: value }))}><SelectTrigger aria-label="Evidence type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="source excerpt">Source excerpt</SelectItem><SelectItem value="personal observation">Personal observation</SelectItem><SelectItem value="counterexample">Counterexample</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent></Select>
                        <Select value={evidenceDraft.strength} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, strength: value }))}><SelectTrigger aria-label="Evidence strength"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weak">Weak support</SelectItem><SelectItem value="moderate">Moderate support</SelectItem><SelectItem value="strong">Strong support</SelectItem></SelectContent></Select>
                        <Select value={evidenceDraft.reliability} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, reliability: value }))}><SelectTrigger aria-label="Evidence reliability"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low reliability</SelectItem><SelectItem value="moderate">Moderate reliability</SelectItem><SelectItem value="high">High reliability</SelectItem></SelectContent></Select>
                      </div>
                    </details>
                    <div className="flex justify-end md:col-span-2"><Button onClick={addEvidenceRecord} disabled={!evidenceDraft.claim.trim()} className="rounded-full px-4">Save evidence</Button></div>
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
                    <details className="md:col-span-2 rounded-lg border border-border/70 px-3 py-2"><summary className="cursor-pointer text-sm text-muted-foreground">Optional test details</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><Input value={testDraft.title} onChange={(event) => setTestDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Practice name" /><Input value={testDraft.reviewDate} onChange={(event) => setTestDraft((prev) => ({ ...prev, reviewDate: event.target.value }))} placeholder="When will you review it?" /><Textarea value={testDraft.predictionA} onChange={(event) => setTestDraft((prev) => ({ ...prev, predictionA: event.target.value }))} placeholder="What would you expect to see?" /><Textarea value={testDraft.result} onChange={(event) => setTestDraft((prev) => ({ ...prev, result: event.target.value }))} placeholder="Result, if already known" /></div></details>
                    <div className="flex flex-wrap justify-end gap-2 md:col-span-2"><Button onClick={createTestRecord} disabled={!testDraft.tested.trim() || !testDraft.method.trim()} className="rounded-full px-4">Create practice</Button></div>
                    <div className="rounded-lg border border-border/70 p-3 md:col-span-2"><Label className="mb-2 block">Already have a practice?</Label><div className="flex flex-col gap-2 sm:flex-row"><Select value={existingPracticeId} onValueChange={setExistingPracticeId}><SelectTrigger className="flex-1"><SelectValue placeholder="Choose a practice to link" /></SelectTrigger><SelectContent>{availablePractices.filter((item) => !(item.questionIds || []).includes(question.id)).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={linkExistingPractice} disabled={!existingPracticeId}>Link practice</Button></div></div>
                  </div>
                )}

                {selectedTool === 'Develop a work' && (
                  <div className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><Button onClick={createExpandedWork}>Create a work</Button><Select value={existingWorkId} onValueChange={setExistingWorkId}><SelectTrigger className="flex-1"><SelectValue placeholder="Or choose a work to link" /></SelectTrigger><SelectContent>{availableDrafts.filter((item) => !(item.questionIds || []).includes(question.id)).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={linkExistingWork} disabled={!existingWorkId}>Link work</Button></div>{drafts.length > 0 && <p className="text-xs text-muted-foreground">Linked work: {drafts.map((work) => work.title).join(', ')}</p>}</div>
                )}

                {selectedTool === 'Decide outcome' && (
                  <div className="space-y-3"><div className="space-y-2"><Label htmlFor={`resolution-${question.id}`}>What led you here?</Label><Textarea id={`resolution-${question.id}`} value={investigationDraft.resolutionSummary} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, resolutionSummary: event.target.value }))} placeholder="What mattered most, and what remains open?" className="min-h-[96px]" /></div><div className="grid gap-2 md:grid-cols-2">{RESOLUTION_OPTIONS.map((option) => <button key={option.status} type="button" onClick={() => saveProvisionalAnswer(option.status)} disabled={!initialAnswer.trim()} className={cn('rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50', question.status === option.status ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-accent/40 hover:bg-accent/5')}><div className="text-sm font-semibold text-foreground">{option.label}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p></button>)}</div></div>
                )}
              </section>
            )}
          </div>
        </details>
      </div>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete inquiry?"
        description={`This removes "${question.text}" from Inquiries. Linked sources, positions, works, and Evolution history will remain.`}
        confirmLabel="Delete Inquiry"
        destructive
        onConfirm={() => {
          onDeleteQuestion(question.id);
          setDeleteOpen(false);
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
