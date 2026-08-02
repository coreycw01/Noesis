
"use client";

import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, HelpCircle, Plus, Trash2 } from 'lucide-react';
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
  suspended: 'Suspended',
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

const CLOSED_INQUIRY_STATUSES = new Set<Question['status']>(['answered', 'resolved', 'archived', 'converted', 'no_longer_meaningful']);

function isInquiryClosed(question: Question) {
  return CLOSED_INQUIRY_STATUSES.has(question.status) || (!!question.answer && question.status === 'resolved');
}

function inquiryNeedsEvidence(question: Question) {
  return (question.sourceIds || question.evidenceIds || []).length === 0 && !isInquiryClosed(question);
}

function inquiryNeedsAssumptions(question: Question) {
  return (question.assumptions || []).length === 0 && !isInquiryClosed(question);
}

function inquiryNeedsCandidateAnswers(question: Question) {
  return (question.candidateAnswers || []).length === 0 && !question.answer?.trim() && !isInquiryClosed(question);
}

function inquiryReadyToResolve(question: Question) {
  return Boolean(question.answer?.trim()) && !question.resolutionSummary?.trim() && !isInquiryClosed(question);
}

function inquiryFormation(question: Question) {
  const candidates = question.candidateAnswers || [];
  const checks = [
    Boolean(question.text?.trim()),
    Boolean(question.whyItMatters?.trim()),
    Boolean(question.currentIntuition?.trim()),
    (question.assumptions || []).some((item) => item.trim()),
    [...(question.sourceIds || []), ...(question.evidenceIds || [])].length > 0 ||
      candidates.some((candidate) => Boolean(candidate.support?.trim() || candidate.objection?.trim())),
    candidates.some((candidate) => Boolean(candidate.statement?.trim())),
    Boolean(question.answer?.trim()),
    Boolean(question.resolutionSummary?.trim()),
  ];
  const complete = checks.filter(Boolean).length;
  return {
    complete,
    total: checks.length,
    fullyFormed: complete === checks.length,
    completeness: Math.round((complete / checks.length) * 100),
  };
}

function inquiryFrameGaps(question: Question) {
  const gaps: string[] = [];
  if (!question.whyItMatters?.trim()) gaps.push('stakes');
  if (!question.currentIntuition?.trim() && !question.answer?.trim()) gaps.push('intuition');
  if (inquiryNeedsAssumptions(question)) gaps.push('assumptions');
  if (inquiryNeedsEvidence(question)) gaps.push('evidence');
  if (inquiryNeedsCandidateAnswers(question)) gaps.push('candidate answer');
  if (question.answer?.trim() && !question.resolutionSummary?.trim()) gaps.push('resolution summary');
  return gaps;
}

function inquiryCardNextStep(question: Question) {
  if (isInquiryClosed(question)) return 'Review the saved answer or reopen this inquiry when new evidence appears.';
  if (!question.whyItMatters?.trim()) return 'Clarify why this question matters.';
  if (inquiryNeedsEvidence(question)) return 'Add one source, observation, or counterexample.';
  if (inquiryNeedsCandidateAnswers(question)) return 'Draft a possible answer to examine.';
  if ((question.candidateAnswers || []).length > 1) return 'Compare the strongest candidate answers.';
  if (inquiryReadyToResolve(question)) return 'Write the resolution summary and choose an outcome.';
  return 'Continue developing the strongest unanswered part.';
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
    if (filter === 'active') typeOk = ['captured', 'clarifying', 'open', 'investigating', 'reopened', 'under_tension'].includes(question.status) || (!question.answer && !isInquiryClosed(question));
    if (filter === 'complete') typeOk = inquiryFormation(question).fullyFormed;
    if (filter === 'needs_frame') typeOk = inquiryFrameGaps(question).length > 0 && !isInquiryClosed(question);
    if (filter === 'awaiting_evidence') typeOk = question.status === 'gathering_evidence' || inquiryNeedsEvidence(question);
    if (filter === 'needs_assumptions') typeOk = inquiryNeedsAssumptions(question);
    if (filter === 'needs_candidates') typeOk = inquiryNeedsCandidateAnswers(question);
    if (filter === 'ready_to_resolve') typeOk = inquiryReadyToResolve(question);
    if (filter === 'comparing_answers') typeOk = question.status === 'comparing_answers' || (question.candidateAnswers || []).length > 1;
    if (filter === 'enduring') typeOk = question.status === 'enduring';
    if (filter === 'partially_answered') typeOk = question.status === 'partially_answered' || question.status === 'provisionally_answered';
    if (filter === 'suspended') typeOk = question.status === 'suspended' || question.status === 'archived';
    if (filter === 'resolved') typeOk = isInquiryClosed(question) || question.status === 'provisionally_answered';
    if (filter === 'annotations') typeOk = question.type === 'annotation';
    const relatedSources = media.filter((source) => (question.sourceIds || question.evidenceIds || []).includes(source.id));
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
    const sourceIds = selected.sourceIds || selected.evidenceIds || [];
    const relatedSources = media.filter((item) => sourceIds.includes(item.id));
    const conceptNames = selected.conceptIds || relatedSources.flatMap((item) => item.tags || []);
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

      <section className="mb-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0" aria-label="Inquiry summary filters">
        {[
          { label: 'Needs frame', value: needsFrameCount, filter: 'needs_frame' as FilterType },
          { label: 'Needs assumptions', value: needsAssumptionsCount, filter: 'needs_assumptions' as FilterType },
          { label: 'Needs evidence', value: needsEvidenceCount, filter: 'awaiting_evidence' as FilterType },
          { label: 'Ready to resolve', value: readyToResolveCount, filter: 'ready_to_resolve' as FilterType },
          { label: 'Complete', value: completeCount, filter: 'complete' as FilterType },
        ].map((item) => (
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
          const sources = media.filter(m => (question.sourceIds || []).includes(m.id));
          const nextStep = inquiryCardNextStep(question);

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

function inferInquiryType(question: Question, concepts: string[], sources: Media[]) {
  const text = question.text.toLowerCase();
  if (/\bshould\b|\bought\b|\bright\b|\bwrong\b|\bmoral\b|\bethic/.test(text)) return 'normative';
  if (/\bmean\b|\bdefinition\b|\bwhat is\b|\bconcept\b/.test(text)) return 'conceptual';
  if (/\bhow do i\b|\bpractice\b|\bact\b|\bapply\b/.test(text)) return 'practical';
  if (/\bwho am i\b|\bmeaning\b|\bdeath\b|\bpurpose\b|\bexist/.test(text)) return 'existential';
  if (sources.length > 0 && concepts.length > 0) return 'mixed';
  return 'open';
}

function investigationBranches(question: Question, concepts: string[], sources: Media[], beliefs: VaultEntry[], drafts: Draft[], practices: Practice[]) {
  const branches = [
    {
      label: 'Clarify',
      state: (question.whyItMatters || question.currentIntuition || concepts.length) ? 'active' : 'needed',
      detail: question.whyItMatters ? 'The question has a working interpretation.' : 'Interpret what the question is really asking.',
    },
    {
      label: 'Investigate',
      state: sources.length || (question.candidateAnswers || []).some((candidate) => candidate.support || candidate.objection) ? 'active' : 'needed',
      detail: sources.length ? `${sources.length} source${sources.length === 1 ? '' : 's'} connected.` : 'Add support, challenge, context, or an unknown.',
    },
    {
      label: 'Compare',
      state: beliefs.length > 1 ? 'active' : beliefs.length === 1 ? 'available' : 'needed',
      detail: (question.candidateAnswers || []).length > 1 ? `${question.candidateAnswers?.length} candidate answers can be compared.` : 'Add another candidate answer before comparing.',
    },
    {
      label: 'Test',
      state: practices.length ? 'active' : question.answer ? 'available' : 'needed',
      detail: practices.length ? `${practices.length} linked practice${practices.length === 1 ? '' : 's'} testing this inquiry.` : 'Turn a prediction into a practice or observation.',
    },
    {
      label: 'Expand',
      state: drafts.length ? 'active' : question.answer ? 'available' : 'needed',
      detail: drafts.length ? `${drafts.length} linked work${drafts.length === 1 ? '' : 's'} developing this inquiry.` : 'Develop the inquiry as writing, a note, drawing, or recording.',
    },
  ];
  if (question.answer) {
    branches.push({
      label: 'Resolution Review',
      state: question.status === 'resolved' ? 'active' : 'available',
      detail: question.status === 'resolved' ? 'This inquiry has a stored resolution summary.' : 'Review whether the provisional answer is strong enough to resolve.',
    });
  }
  return branches;
}

function branchStatus(label: string): Question['status'] {
  if (label === 'Clarify') return 'clarifying';
  if (label === 'Investigate') return 'gathering_evidence';
  if (label === 'Compare') return 'comparing_answers';
  if (label === 'Test' || label === 'Expand') return 'investigating';
  if (label === 'Resolution Review') return 'partially_answered';
  return 'investigating';
}

function branchNextStep(label: string) {
  if (label === 'Clarify') return 'Define the question, key terms, scope, and what would count as an answer.';
  if (label === 'Investigate') return 'Add one evidence record and separate direction from reliability.';
  if (label === 'Compare') return 'Put candidate answers beside each other and name the real difference.';
  if (label === 'Test') return 'Design one action, observation, conversation, or research test.';
  if (label === 'Expand') return 'Develop this inquiry in a linked Work without treating the Work as a test.';
  if (label === 'Resolution Review') return 'Decide whether the answer should be provisional, suspended, transformed, or resolved.';
  return 'Choose the next concrete investigation move.';
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
  const investigationRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const [initialAnswer, setInitialAnswer] = useState(question.answer || '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBranchLabel, setSelectedBranchLabel] = useState('');
  const [existingPracticeId, setExistingPracticeId] = useState('');
  const [existingWorkId, setExistingWorkId] = useState('');
  const [investigationDraft, setInvestigationDraft] = useState({
    whyItMatters: question.whyItMatters || '',
    currentIntuition: question.currentIntuition || '',
    assumptionsText: (question.assumptions || []).join('\n'),
    resolutionSummary: question.resolutionSummary || '',
  });
  const [candidateDraft, setCandidateDraft] = useState({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
  const [evidenceDraft, setEvidenceDraft] = useState({ claim: '', type: 'source excerpt', origin: '', candidateId: '', direction: 'supports', strength: 'moderate', reliability: 'moderate', notes: '' });
  const [testDraft, setTestDraft] = useState({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
  React.useEffect(() => {
    const target = initialSection === 'answer' ? answerRef.current : investigationRef.current;
    const frame = window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [initialSection, question.id]);
  React.useEffect(() => {
    setInvestigationDraft({
      whyItMatters: question.whyItMatters || '',
      currentIntuition: question.currentIntuition || '',
      assumptionsText: (question.assumptions || []).join('\n'),
      resolutionSummary: question.resolutionSummary || '',
    });
    setCandidateDraft({ statement: '', support: '', objection: '', consequence: '', confidence: 3 });
    setEvidenceDraft({ claim: '', type: 'source excerpt', origin: '', candidateId: '', direction: 'supports', strength: 'moderate', reliability: 'moderate', notes: '' });
    setTestDraft({ title: '', tested: '', predictionA: '', predictionB: '', method: '', reviewDate: '', result: '' });
  }, [question.id, question.whyItMatters, question.currentIntuition, question.assumptions, question.resolutionSummary]);
  const inquiryType = inferInquiryType(question, concepts, sources);
  const branches = investigationBranches(question, concepts, sources, beliefs, drafts, practices);
  const selectedBranch = branches.find((branch) => branch.label === selectedBranchLabel) || null;
  const evidenceLanes = [
    {
      label: 'Supports candidate answer',
      items: [
        ...sources.slice(0, 4).map((source) => source.title),
        ...beliefs.filter((belief) => (belief.evidenceFor || []).length > 0).slice(0, 3).map((belief) => belief.title),
      ],
    },
    {
      label: 'Challenges candidate answer',
      items: beliefs.filter((belief) => (belief.evidenceAgainst || []).length > 0 || belief.status === 'challenged').slice(0, 4).map((belief) => belief.title),
    },
    {
      label: 'Unresolved / needs verification',
      items: [
        ...(!question.answer ? ['No provisional answer has been written yet.'] : []),
        ...(sources.length === 0 ? ['No evidence source is linked yet.'] : []),
        ...(beliefs.length === 0 ? ['No candidate position has formed from this inquiry.'] : []),
      ],
    },
  ];
  const storedAssumptions = question.assumptions || [];
  const assumptions = storedAssumptions.length ? storedAssumptions : [
    concepts.length ? `The key terms are stable enough to investigate: ${concepts.slice(0, 3).join(', ')}.` : 'The question needs at least one named concept before its terms are stable.',
    sources.length ? 'The connected sources are relevant enough to count as evidence.' : 'The inquiry can progress without outside evidence for now.',
    question.answer ? 'The provisional answer is worth stress-testing instead of only expanding.' : 'Progress requires a first answer, even if it is rough.',
  ];
  const candidateAnswers = question.candidateAnswers || [];
  const definedTerms = (question.assumptions || []).filter((item) => item.includes(':') || item.includes(' means '));
  const inquiryGaps = inquiryFrameGaps(question);
  const evidenceQualityScore = sources.length ? Math.min(25, 10 + sources.length * 5) : 4;
  const counterEvidenceScore = candidateAnswers.some((candidate) => candidate.objection?.trim()) ? 15 : 3;
  const comparisonScore = candidateAnswers.length > 1 ? 15 : candidateAnswers.length ? 7 : 0;
  const assumptionsScore = storedAssumptions.length ? Math.min(10, storedAssumptions.length * 3) : 0;
  const testingScore = drafts.length ? 15 : 0;
  const unknownScore = inquiryGaps.length ? 2 : 5;
  const inquiryStrength = Math.min(100, evidenceQualityScore + counterEvidenceScore + comparisonScore + assumptionsScore + testingScore + unknownScore);
  const strengthLabel = inquiryStrength >= 76 ? 'Strong' : inquiryStrength >= 52 ? 'Developing' : inquiryStrength >= 30 ? 'Early' : 'Thin';
  const strongestGap = inquiryGaps.includes('evidence')
    ? 'No evidence has been connected.'
    : candidateAnswers.length < 2
      ? 'Only one candidate answer is visible.'
      : !candidateAnswers.some((candidate) => candidate.objection?.trim())
        ? 'No serious challenge has been recorded.'
        : drafts.length === 0
          ? 'No test or work has been created.'
          : 'Ready for a sharper resolution decision.';
  const recommendedMove = inquiryGaps.includes('evidence')
    ? 'Investigate: add one strong source, observation, or counterexample.'
    : candidateAnswers.length < 2
      ? 'Compare: add a competing answer before resolving.'
      : !candidateAnswers.some((candidate) => candidate.objection?.trim())
        ? 'Investigate: add a credible challenge to the leading answer.'
        : drafts.length === 0
          ? 'Test: turn the inquiry into a concrete experiment or research action.'
          : 'Adopt a provisional answer or resolve honestly.';

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
      assumptions: investigationDraft.assumptionsText.split('\n').map((item) => item.trim()).filter(Boolean),
      resolutionSummary: investigationDraft.resolutionSummary.trim(),
      dateUpdated: today(),
    });
    onAiFeedback('Investigation frame saved.', 'The inquiry now has clearer stakes, intuition, assumptions, and resolution criteria.');
  };

  const saveClarifyBranch = () => {
    onUpdateQuestion({
      ...question,
      whyItMatters: investigationDraft.whyItMatters.trim(),
      currentIntuition: investigationDraft.currentIntuition.trim(),
      assumptions: investigationDraft.assumptionsText.split('\n').map((item) => item.trim()).filter(Boolean),
      status: 'clarifying',
      dateUpdated: today(),
    });
    onAiFeedback('Clarification saved.', 'The inquiry now has a clearer interpretation, scope, and working terms.');
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
    if (!testDraft.title.trim() && !testDraft.method.trim()) {
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

  const chooseBranch = (branch: ReturnType<typeof investigationBranches>[number]) => {
    setSelectedBranchLabel(branch.label);
    const status = branchStatus(branch.label);
    onUpdateQuestion({ ...question, status, dateUpdated: today() });
    onAiFeedback('Investigation branch selected.', `${branch.label}: ${branchNextStep(branch.label)}`);
  };

  const buildAiEnvelope = (): AiContextEnvelope => ({
    action: 'socratic_inquiry_challenge',
    scope: 'linked_items',
    targetType: 'inquiry',
    targetId: question.id,
    itemMemory: [
      `Inquiry: ${question.text}`,
      question.whyItMatters ? `Why it matters: ${question.whyItMatters}` : '',
      question.currentIntuition ? `Current intuition: ${question.currentIntuition}` : '',
      (question.assumptions || []).length ? `Assumptions: ${(question.assumptions || []).join('; ')}` : '',
      (question.candidateAnswers || []).length ? `Candidate answers: ${(question.candidateAnswers || []).map((item) => item.statement).join('; ')}` : '',
      question.answer ? `Current answer: ${question.answer}` : '',
    ].filter(Boolean),
    linkedMemory: [
      ...sources.slice(0, 8).map((source) => `Source: ${source.title} - ${source.description || source.capture?.after?.coreArgument || 'No summary'}`),
      ...beliefs.slice(0, 6).map((position) => `Position: ${position.statement || position.title}`),
      ...practices.slice(0, 4).map((practice) => `Practice: ${practice.title} - ${practice.observedOutcome || practice.status}`),
    ],
  });

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 font-body">
      <Button variant="ghost" onClick={onBack} className="mb-5 h-9 text-[10px] font-code uppercase tracking-widest rounded-full hover:bg-muted/50">
        <ArrowLeft className="size-4 mr-2" /> Back to Inquiries
      </Button>
      <div className="mb-5 flex justify-end">
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
            currentIntuition: [question.currentIntuition, `Reviewed challenge:\n${content}`].filter(Boolean).join('\n\n'),
            dateUpdated: today(),
          })}
        />
      </div>
      <Card className="mb-5 rounded-2xl border border-accent/15 bg-card p-4 shadow-sm">
        <div className="grid gap-3 text-sm md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
          <div>
            <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Current stage</div>
            <p className="mt-1 font-medium text-foreground">{question.status.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Strongest gap</div>
            <p className="mt-1 text-muted-foreground">{strongestGap}</p>
          </div>
          <div>
            <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Recommended next move</div>
            <p className="mt-1 text-muted-foreground">{recommendedMove}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-center">
            <div className="font-headline text-2xl font-bold italic text-accent">{inquiryStrength}</div>
            <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">Inquiry strength</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{strengthLabel}</div>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Card ref={investigationRef} className="mb-5 scroll-mt-6 rounded-2xl border border-accent/10 bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground/50">Inquiry Workbench</div>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Choose the next intellectual move this question needs, then add the minimum useful record.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{inquiryType}</Badge>
                {!question.id.startsWith('open:') && !question.id.startsWith('annotation:') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteOpen(true)}
                    className="size-9 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete inquiry"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-3 font-bold">Branches</div>
                <div className="grid gap-2">
                  {branches.map((branch) => (
                    <div key={branch.label} className={cn(
                      'rounded-lg border bg-card px-3 py-2 transition-colors',
                      selectedBranch?.label === branch.label ? 'border-accent/50 bg-accent/5' : 'border-border/30'
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-foreground/80">{branch.label}</div>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 font-code text-[8px] uppercase tracking-widest',
                          branch.state === 'active' ? 'bg-accent/10 text-accent' : branch.state === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                        )}>{branch.state}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{branch.detail}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] leading-5 text-muted-foreground">{branchNextStep(branch.label)}</p>
                        <Button
                          size="sm"
                          variant={selectedBranch?.label === branch.label ? 'default' : 'outline'}
                          onClick={() => chooseBranch(branch)}
                          className="h-7 rounded-full px-3 font-code text-[8px] uppercase tracking-widest"
                        >
                          {selectedBranch?.label === branch.label ? 'Chosen' : 'Choose'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <details>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold">Assumptions</div>
                        <p className="mt-1 text-sm font-medium text-foreground">{assumptions.length} to examine</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[9px]">Expand</Badge>
                    </div>
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {assumptions.map((assumption) => (
                      <li key={assumption} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-accent/15 bg-accent/5 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-accent">Active workspace</div>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedBranch?.label || 'Choose a branch'}</p>
                </div>
                <p className="max-w-xl text-xs leading-5 text-muted-foreground">{selectedBranch ? branchNextStep(selectedBranch.label) : 'Clarify, investigate, compare, or test. Each branch saves a real piece of inquiry work.'}</p>
              </div>
              {!selectedBranch && (
                <p className="rounded-xl border border-border/40 bg-card p-3 text-sm text-muted-foreground">Select one branch above to reveal its focused workspace.</p>
              )}
              {selectedBranch?.label === 'Clarify' && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="readex-kicker">Question interpretation</Label>
                    <Textarea value={investigationDraft.whyItMatters} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, whyItMatters: event.target.value }))} placeholder="What is this question actually asking?" className="min-h-[92px]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="readex-kicker">Scope</Label>
                    <Textarea value={investigationDraft.currentIntuition} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, currentIntuition: event.target.value }))} placeholder="What is included, excluded, or context-bound?" className="min-h-[92px]" />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="readex-kicker">Key terms and answer criteria</Label>
                    <Textarea value={investigationDraft.assumptionsText} onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, assumptionsText: event.target.value }))} placeholder="Identity: working meaning, still contested.&#10;What would count as an answer: ..." className="min-h-[110px]" />
                  </div>
                  <div className="lg:col-span-2 flex justify-end"><Button onClick={saveClarifyBranch} className="rounded-full px-5">Save Clarification</Button></div>
                </div>
              )}
              {selectedBranch?.label === 'Investigate' && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="readex-kicker">Claim, observation, excerpt, or unknown</Label>
                    <Textarea value={evidenceDraft.claim} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, claim: event.target.value }))} placeholder="What evidence or uncertainty should this inquiry now account for?" className="min-h-[90px]" />
                  </div>
                  <Input value={evidenceDraft.origin} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, origin: event.target.value }))} placeholder="Source or origin" />
                  <Select value={evidenceDraft.candidateId || 'none'} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, candidateId: value === 'none' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Candidate answer affected" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Classify later</SelectItem>
                      {candidateAnswers.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.statement.slice(0, 72)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={evidenceDraft.direction} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, direction: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supports">Supports</SelectItem>
                      <SelectItem value="challenges">Challenges</SelectItem>
                      <SelectItem value="contextualizes">Contextualizes</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Select value={evidenceDraft.type} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, type: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="source excerpt">Source excerpt</SelectItem>
                        <SelectItem value="personal observation">Personal observation</SelectItem>
                        <SelectItem value="counterexample">Counterexample</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={evidenceDraft.strength} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, strength: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="weak">Weak</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent>
                    </Select>
                    <Select value={evidenceDraft.reliability} onValueChange={(value) => setEvidenceDraft((prev) => ({ ...prev, reliability: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="low">Low reliability</SelectItem><SelectItem value="moderate">Moderate reliability</SelectItem><SelectItem value="high">High reliability</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="readex-kicker">Notes</Label>
                    <Textarea value={evidenceDraft.notes} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Why this matters, limits, or what needs verification." className="min-h-[80px]" />
                  </div>
                  <div className="lg:col-span-2 flex justify-end"><Button onClick={addEvidenceRecord} className="rounded-full px-5">Add Evidence Record</Button></div>
                </div>
              )}
              {selectedBranch?.label === 'Compare' && (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-muted/30 font-code text-[8px] uppercase tracking-widest text-muted-foreground">
                      <tr><th className="p-3">Dimension</th>{candidateAnswers.slice(0, 3).map((candidate) => <th key={candidate.id} className="p-3">{candidate.statement.slice(0, 38)}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {['Main claim', 'Strongest evidence', 'Main weakness', 'Assumptions required', 'Explains well', 'Fails to explain', 'Testability', 'Current confidence'].map((dimension) => (
                        <tr key={dimension}>
                          <td className="p-3 font-medium text-foreground">{dimension}</td>
                          {candidateAnswers.slice(0, 3).map((candidate) => (
                            <td key={`${candidate.id}-${dimension}`} className="p-3 text-muted-foreground">
                              {dimension === 'Main claim' ? candidate.statement : dimension === 'Strongest evidence' ? candidate.support || 'Not recorded.' : dimension === 'Main weakness' ? candidate.objection || 'Not recorded.' : dimension === 'Current confidence' ? `${candidate.confidence || 3}/5` : candidate.consequence || 'Not recorded.'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {candidateAnswers.length < 2 && <p className="p-4 text-sm text-muted-foreground">Add at least two candidate answers to make comparison meaningful.</p>}
                </div>
              )}
              {selectedBranch?.label === 'Test' && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <Input value={testDraft.title} onChange={(event) => setTestDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Test title" />
                  <Input value={testDraft.reviewDate} onChange={(event) => setTestDraft((prev) => ({ ...prev, reviewDate: event.target.value }))} placeholder="Review date" />
                  <Textarea value={testDraft.tested} onChange={(event) => setTestDraft((prev) => ({ ...prev, tested: event.target.value }))} placeholder="What is being tested?" className="min-h-[82px]" />
                  <Textarea value={testDraft.method} onChange={(event) => setTestDraft((prev) => ({ ...prev, method: event.target.value }))} placeholder="What action, observation, conversation, or research would test it?" className="min-h-[82px]" />
                  <Textarea value={testDraft.predictionA} onChange={(event) => setTestDraft((prev) => ({ ...prev, predictionA: event.target.value }))} placeholder="What would one answer predict?" className="min-h-[82px]" />
                  <Textarea value={testDraft.predictionB} onChange={(event) => setTestDraft((prev) => ({ ...prev, predictionB: event.target.value }))} placeholder="What would another answer predict?" className="min-h-[82px]" />
                  <div className="space-y-2 lg:col-span-2">
                    <Label className="readex-kicker">Result, if known</Label>
                    <Textarea value={testDraft.result} onChange={(event) => setTestDraft((prev) => ({ ...prev, result: event.target.value }))} placeholder="What happened, and what changed afterward?" className="min-h-[82px]" />
                  </div>
                  <div className="lg:col-span-2 flex flex-wrap justify-end gap-2"><Button onClick={createTestRecord} className="rounded-full px-5">Create Practice Test</Button></div>
                  <div className="lg:col-span-2 rounded-xl border border-border/50 bg-background/70 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select value={existingPracticeId} onValueChange={setExistingPracticeId}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Link an existing practice" /></SelectTrigger>
                        <SelectContent>
                          {availablePractices.filter((item) => !(item.questionIds || []).includes(question.id)).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={linkExistingPractice} disabled={!existingPracticeId}>Link Practice</Button>
                    </div>
                    {!!practices.length && <div className="mt-3 flex flex-wrap gap-2">{practices.map((practice) => <Button key={practice.id} variant="ghost" size="sm" onClick={() => onOpenPractice(practice.id)}>Open: {practice.title}</Button>)}</div>}
                  </div>
                </div>
              )}
              {selectedBranch?.label === 'Expand' && (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-muted-foreground">Develop this inquiry as a creative Work. The inquiry remains open until you write and save an answer here.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={createExpandedWork}>Create Work</Button>
                    <Select value={existingWorkId} onValueChange={setExistingWorkId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Link an existing work" /></SelectTrigger>
                      <SelectContent>
                        {availableDrafts.filter((item) => !(item.questionIds || []).includes(question.id)).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={linkExistingWork} disabled={!existingWorkId}>Link Work</Button>
                  </div>
                  {!!drafts.length && <div className="flex flex-wrap gap-2">{drafts.map((work) => <Button key={work.id} variant="ghost" size="sm" onClick={() => onOpenWork(work.id)}>Open: {work.title}</Button>)}</div>}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {evidenceLanes.map((lane) => (
                <div key={lane.label} className="rounded-xl border border-border/40 bg-background/70 p-4">
                  <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">{lane.label}</div>
                  <div className="space-y-2">
                    {lane.items.length ? lane.items.slice(0, 4).map((item) => (
                      <div key={item} className="rounded-lg border border-border/30 bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">{item}</div>
                    )) : (
                      <p className="text-xs leading-5 text-muted-foreground">No items in this lane yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mb-6 rounded-2xl border border-accent/10 bg-card p-6 shadow-sm">
            <div className="mb-5">
              <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">Candidate Answers</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep possible answers visible, compare them honestly, and only adopt one provisionally when the inquiry has enough shape.</p>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/40 bg-background/70 p-3">
                <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">What we have</div>
                <p className="mt-1 text-sm text-foreground">{candidateAnswers.length} candidate answers · {sources.length} sources · {definedTerms.length || storedAssumptions.length} clarified terms/assumptions</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/70 p-3">
                <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">What is missing</div>
                <p className="mt-1 text-sm text-foreground">{strongestGap}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/70 p-3">
                <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">What should happen next</div>
                <p className="mt-1 text-sm text-foreground">{recommendedMove}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-background/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold">Answer candidates</div>
                  <p className="mt-1 text-sm text-muted-foreground">A candidate answer is not a final position. It is an explanation currently under test.</p>
                </div>
                <Badge variant="outline" className="rounded-full">{candidateAnswers.length || 0} saved</Badge>
              </div>

              {candidateAnswers.length > 0 && (
                <div className="mb-4 grid gap-3">
                  {candidateAnswers.map((candidate) => (
                    <div key={candidate.id} className="rounded-xl border border-border/40 bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{candidate.statement}</p>
                          <div className="mt-2 grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-3">
                            <p><span className="font-semibold text-foreground/70">Support:</span> {candidate.support || 'Not named yet.'}</p>
                            <p><span className="font-semibold text-foreground/70">Objection:</span> {candidate.objection || 'Not named yet.'}</p>
                            <p><span className="font-semibold text-foreground/70">Consequence:</span> {candidate.consequence || 'Not named yet.'}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeCandidateAnswer(candidate.id)} className="rounded-full border border-border px-2 py-1 font-code text-[8px] uppercase tracking-widest text-muted-foreground hover:border-destructive/40 hover:text-destructive">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3">
                <Textarea
                  value={candidateDraft.statement}
                  onChange={(event) => setCandidateDraft((prev) => ({ ...prev, statement: event.target.value }))}
                  placeholder="Candidate answer statement"
                  className="min-h-[80px]"
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <Input value={candidateDraft.support} onChange={(event) => setCandidateDraft((prev) => ({ ...prev, support: event.target.value }))} placeholder="Support" />
                  <Input value={candidateDraft.objection} onChange={(event) => setCandidateDraft((prev) => ({ ...prev, objection: event.target.value }))} placeholder="Objection" />
                  <Input value={candidateDraft.consequence} onChange={(event) => setCandidateDraft((prev) => ({ ...prev, consequence: event.target.value }))} placeholder="Consequence" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Confidence</span>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCandidateDraft((prev) => ({ ...prev, confidence: value }))}
                        className={cn('size-7 rounded-full font-code text-[10px] font-bold', candidateDraft.confidence === value ? 'bg-accent text-accent-foreground' : 'bg-muted/30 text-muted-foreground')}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <Button type="button" variant="outline" onClick={addCandidateAnswer} disabled={!candidateDraft.statement.trim()} className="rounded-full px-5">
                    Add Candidate Answer
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card ref={answerRef} className="scroll-mt-6 space-y-6 rounded-2xl border border-accent/10 bg-card p-6 shadow-md sm:p-10">
              <Badge variant="outline" className="font-code text-[10px] uppercase tracking-widest bg-muted/20 border-border/30 rounded-full px-4 py-1 font-bold">
                {question.type || 'manual'}
              </Badge>
              <h1 className="noesis-page-title text-4xl">{question.text}</h1>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">Use this space only for the current leading answer. Dialogue can explore possibilities, but the inquiry record changes only when you save or resolve it.</p>
              <div>
                <Label className="readex-kicker mb-2 block">LEADING CANDIDATE ANSWER</Label>
                <Textarea
                  value={initialAnswer}
                  onChange={(e) => setInitialAnswer(e.target.value)}
                  className="min-h-[260px] text-[18px] leading-9 font-body italic"
                  placeholder="What answer currently leads, and why does it remain revisable?"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => saveProvisionalAnswer('provisionally_answered')}
                  disabled={!initialAnswer.trim()}
                  variant="outline"
                  className="h-12 rounded-full px-6 font-bold"
                >
                  Adopt As Provisional Answer
                </Button>
              </div>

              {candidateAnswers.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                <div className="mb-3">
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">Resolve inquiry</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Resolve only when at least one candidate answer exists. Add a resolution summary in the chosen outcome when the question is answered, reframed, suspended, or abandoned.
                  </p>
                </div>
                <div className="mb-3">
                  <Label className="readex-kicker mb-2 block">RESOLUTION SUMMARY</Label>
                  <Textarea
                    value={investigationDraft.resolutionSummary}
                    onChange={(event) => setInvestigationDraft((prev) => ({ ...prev, resolutionSummary: event.target.value }))}
                    placeholder="What evidence or reasoning mattered most? What remains uncertain?"
                    className="min-h-[90px]"
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {RESOLUTION_OPTIONS.map((option) => (
                    <button
                      key={option.status}
                      type="button"
                      onClick={() => saveProvisionalAnswer(option.status)}
                      disabled={!initialAnswer.trim()}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        question.status === option.status
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-card hover:border-accent/40 hover:bg-accent/5'
                      )}
                    >
                      <div className="font-code text-[9px] uppercase tracking-widest text-foreground/70 font-bold">{option.label}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              )}
            </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-6 bg-card border border-accent/10 shadow-sm rounded-xl">
            <h3 className="font-code text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-4 font-bold">Investigation State</h3>
            <Badge variant="outline" className="mb-4 rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{question.status.replace(/_/g, ' ')}</Badge>
            <div className="grid gap-2">
              <Button variant="outline" size="sm" onClick={() => updateInvestigationStatus('gathering_evidence')} className="justify-start rounded-full">Gathering evidence</Button>
              <Button variant="outline" size="sm" onClick={() => updateInvestigationStatus('comparing_answers')} className="justify-start rounded-full">Comparing answers</Button>
              <Button variant="outline" size="sm" onClick={() => updateInvestigationStatus('under_tension')} className="justify-start rounded-full">Under tension</Button>
              <Button variant="outline" size="sm" onClick={() => updateInvestigationStatus('suspended')} className="justify-start rounded-full">Suspend</Button>
              <Button variant="outline" size="sm" onClick={() => updateInvestigationStatus('enduring')} className="justify-start rounded-full">Enduring question</Button>
              <Button variant="outline" size="sm" onClick={() => updateInvestigationStatus('reopened')} className="justify-start rounded-full">Reopen</Button>
            </div>
          </Card>
          <ContextPanel title="Evidence Sources" items={sources.map((s) => s.title)} />
          <ContextPanel title="Active Concepts" items={Array.from(new Set(concepts))} />
          <ContextPanel title="Related Positions" items={beliefs.map((e) => e.title)} />
          <ContextPanel title="Linked Works" items={drafts.map((d) => d.title)} />
        </aside>
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
