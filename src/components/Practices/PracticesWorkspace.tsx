
"use client";

import React, { useMemo, useState } from 'react';
import { Edit, Plus, Repeat, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import type { Concept, Draft, Media, PhilosophicalLink, Practice, PracticeLog, PracticeStatus, PracticeType, Question, VaultEntry } from '@/lib/types';
import { allQuestions, normalizeConceptTags, PRACTICE_LABELS, today, uid } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';

interface PracticesWorkspaceProps {
  practices: Practice[];
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  onAddPractice: (data: Partial<Practice>) => void;
  onUpdatePractice: (practice: Practice) => void;
  onDeletePractice: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  focusedPracticeId?: string | null;
  onOpenPracticeRoute?: (id: string | null) => void;
}

const practiceTypes: PracticeType[] = ['experiment', 'habit', 'commitment', 'observation', 'dialogue', 'reflection', 'restraint', 'exposure', 'decision_rule', 'ritual', 'challenge', 'discipline', 'reflection_prompt', 'rule'];
const primaryPracticeTypeFilters: PracticeType[] = ['experiment', 'habit', 'commitment', 'observation', 'reflection', 'challenge'];
const statuses: PracticeStatus[] = ['proposed', 'designed', 'planned', 'active', 'completed', 'concluded', 'failed', 'failed_productively', 'integrated', 'paused', 'abandoned'];
const primaryPracticeStatusFilters: PracticeStatus[] = ['planned', 'active', 'completed', 'paused', 'abandoned'];
type PracticeViewFilter = 'all' | 'awaiting_log' | 'needs_basis' | 'needs_design' | 'needs_outcome' | 'needs_consequence' | 'testing_positions' | 'recently_concluded';

const practiceViewFilters: Array<{ value: PracticeViewFilter; label: string }> = [
  { value: 'all', label: 'All Practices' },
  { value: 'awaiting_log', label: 'Awaiting Log' },
  { value: 'needs_design', label: 'Needs Design' },
  { value: 'needs_outcome', label: 'Needs Outcome' },
  { value: 'testing_positions', label: 'Testing Positions' },
  { value: 'recently_concluded', label: 'Recently Concluded' },
];

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function currentStreak(logDates?: string[]) {
  const logged = new Set((logDates || []).map((date) => date.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = dateKey(cursor);
    if (!logged.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function practiceLogDates(practice: Practice) {
  const structuredDates = (practice.logs || []).filter((log) => log.actionCompleted).map((log) => log.date.slice(0, 10));
  return Array.from(new Set([...(practice.logDates || []), ...structuredDates])).sort();
}

function isPracticeConcluded(practice: Practice) {
  return ['completed', 'concluded', 'failed', 'failed_productively', 'integrated', 'abandoned'].includes(practice.status);
}

function hasPracticeBasis(practice: Practice, linkedQuestions: Question[] = [], linkedPositions: VaultEntry[] = []) {
  return linkedPositions.length > 0 || linkedQuestions.length > 0 || (practice.conceptTags || []).length > 0 || (practice.sourceIds || []).length > 0;
}

function practiceNeedsOutcome(practice: Practice) {
  return isPracticeConcluded(practice) && !(practice.conclusion?.whatHappened || practice.observedOutcome || practice.notes)?.trim();
}

function practiceDesignGaps(practice: Practice) {
  const gaps: string[] = [];
  if (!practice.hypothesis?.trim()) gaps.push('hypothesis');
  if (!practice.action?.trim()) gaps.push('action');
  if (!practice.observationMethod?.trim()) gaps.push('observation');
  if (!practice.expectedOutcome?.trim()) gaps.push('expected outcome');
  return gaps;
}

function practiceNeedsConsequence(practice: Practice) {
  return isPracticeConcluded(practice) && !(practice.effectOnPosition || practice.conclusion?.intellectualChange || practice.interpretation)?.trim();
}

function practiceNeedsLog(practice: Practice) {
  if (practice.status !== 'active') return false;
  const logs = practiceLogDates(practice);
  return logs.length === 0 || !logs.includes(dateKey());
}

function practiceRecentlyConcluded(practice: Practice) {
  if (!isPracticeConcluded(practice)) return false;
  const updated = practice.dateUpdated ? new Date(practice.dateUpdated).getTime() : 0;
  if (!Number.isFinite(updated) || updated <= 0) return false;
  return Date.now() - updated <= 1000 * 60 * 60 * 24 * 30;
}

function practiceExperimentShape(practice: Practice, linkedQuestions: Question[], linkedPositions: VaultEntry[]) {
  const hasBasis = hasPracticeBasis(practice, linkedQuestions, linkedPositions);
  const logCount = Math.max(practice.logs?.length || 0, practiceLogDates(practice).length);
  const needsOutcome = practiceNeedsOutcome(practice);
  const designGaps = practiceDesignGaps(practice);
  const needsConsequence = practiceNeedsConsequence(practice);
  const hypothesis = practice.hypothesis?.trim() || (linkedPositions[0]
    ? `If this is lived seriously, it should test: ${linkedPositions[0].title}`
    : linkedQuestions[0]
      ? `This practice should produce evidence for: ${linkedQuestions[0].text}`
      : 'State the position, inquiry, or concept this behavior is meant to test.');
  const observation = logCount
    ? `${logCount} logged observation${logCount === 1 ? '' : 's'} available for review.`
    : (practice.observationMethod || 'No observations logged yet. A practice becomes evidence only after contact with reality.');
  const nextStep = needsOutcome
    ? 'Write the conclusion review: what happened, what changed, and whether the tested idea survived.'
    : needsConsequence
      ? 'Record the intellectual consequence: what position, inquiry, or concept should change because of this result.'
    : !hasBasis
      ? 'Link the practice to a position, inquiry, source, or concept so it has an intellectual basis.'
      : designGaps.length
        ? `Complete the practice design: add ${designGaps.slice(0, 2).join(' and ')}.`
      : logCount === 0 && practice.status === 'active'
        ? 'Log the first result so this stops being an intention and becomes evidence.'
        : practice.status === 'planned' || practice.status === 'proposed'
          ? 'Activate the practice when the method and observation criteria are clear.'
          : practice.status === 'active'
            ? 'Keep logging observations until a pattern is visible.'
            : 'Compare expected outcome with observed outcome and update the related thinking.';

  const readinessScore = Math.max(0, 4 - designGaps.length) + (hasBasis ? 1 : 0);
  return { hypothesis, observation, nextStep, needsOutcome, needsConsequence, designGaps, readinessScore, hasBasis, logCount };
}

export function PracticesWorkspace({ practices, concepts, media, questions, positions, drafts, onAddPractice, onUpdatePractice, onDeletePractice, onAddConcept, onCreateLink, focusedPracticeId, onOpenPracticeRoute }: PracticesWorkspaceProps) {
  const [statusFilter, setStatusFilter] = useState<PracticeStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PracticeType | 'all'>('all');
  const [viewFilter, setViewFilter] = useState<PracticeViewFilter>('all');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Practice | null>(null);
  const [draft, setDraft] = useState<Partial<Practice>>({ title: '', description: '', type: 'experiment', status: 'designed', durationDays: 7, durationMode: 'repeated', conceptTags: [] });
  const questionList = useMemo(() => allQuestions(media, questions), [media, questions]);
  const activePractices = practices.filter((practice) => practice.status === 'active' || practice.status === 'planned' || practice.status === 'designed');
  const practiceState = useMemo(() => {
    const questionById = new Map(questionList.map((question) => [question.id, question]));
    const positionById = new Map(positions.map((position) => [position.id, position]));
    return new Map(practices.map((practice) => {
      const linkedQuestions = (practice.questionIds || []).map((id) => questionById.get(id)).filter(Boolean) as Question[];
      const linkedPositions = (practice.positionIds || []).map((id) => positionById.get(id)).filter(Boolean) as VaultEntry[];
      return [practice.id, {
        linkedQuestions,
        linkedPositions,
        hasBasis: hasPracticeBasis(practice, linkedQuestions, linkedPositions),
        needsLog: practiceNeedsLog(practice),
        needsDesign: practiceDesignGaps(practice).length > 0,
        needsOutcome: practiceNeedsOutcome(practice),
        needsConsequence: practiceNeedsConsequence(practice),
        recentlyConcluded: practiceRecentlyConcluded(practice),
      }];
    }));
  }, [practices, questionList, positions]);
  const filtered = practices.filter((practice) => {
    const state = practiceState.get(practice.id);
    const haystack = [
      practice.title,
      practice.description,
      practice.intellectualBasis,
      practice.hypothesis,
      practice.action,
      practice.observationMethod,
      practice.expectedOutcome,
      practice.observedOutcome,
      practice.effectOnPosition,
      ...(practice.conceptTags || []),
      ...(state?.linkedQuestions || []).map((question) => question.text),
      ...(state?.linkedPositions || []).map((position) => position.title),
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesView =
      viewFilter === 'all' ||
      (viewFilter === 'awaiting_log' && state?.needsLog) ||
      (viewFilter === 'needs_basis' && !state?.hasBasis) ||
      (viewFilter === 'needs_design' && state?.needsDesign) ||
      (viewFilter === 'needs_outcome' && state?.needsOutcome) ||
      (viewFilter === 'needs_consequence' && state?.needsConsequence) ||
      (viewFilter === 'testing_positions' && (practice.positionIds || []).length > 0) ||
      (viewFilter === 'recently_concluded' && state?.recentlyConcluded);
    return matchesSearch && matchesView && (statusFilter === 'all' || practice.status === statusFilter) && (typeFilter === 'all' || practice.type === typeFilter);
  });
  const practiceStats = useMemo(() => ({
    total: practices.length,
    active: practices.filter((practice) => practice.status === 'active').length,
    planned: practices.filter((practice) => practice.status === 'planned').length,
    testedPositions: new Set(practices.flatMap((practice) => practice.positionIds || [])).size,
    awaitingLog: practices.filter((practice) => practiceNeedsLog(practice)).length,
    needsDesign: practices.filter((practice) => practiceDesignGaps(practice).length > 0).length,
    needsOutcome: practices.filter((practice) => practiceNeedsOutcome(practice)).length,
    needsConsequence: practices.filter((practice) => practiceNeedsConsequence(practice)).length,
    needsBasis: practices.filter((practice) => {
      const state = practiceState.get(practice.id);
      return state ? !state.hasBasis : !hasPracticeBasis(practice);
    }).length,
  }), [practices, practiceState]);

  const clearPracticeFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setViewFilter('all');
    setSearch('');
  };

  const practiceFiltersActive = statusFilter !== 'all' || typeFilter !== 'all' || viewFilter !== 'all' || Boolean(search.trim());
  const activePracticeFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    viewFilter !== 'all' ? `View: ${practiceViewFilters.find((item) => item.value === viewFilter)?.label || viewFilter.replace(/_/g, ' ')}` : null,
    statusFilter !== 'all' ? `Status: ${statusFilter.replace(/_/g, ' ')}` : null,
    typeFilter !== 'all' ? `Type: ${PRACTICE_LABELS[typeFilter] || typeFilter.replace(/_/g, ' ')}` : null,
  ].filter(Boolean) as string[];

  const openEditor = (practice?: Practice) => {
    setDraft(practice ? { ...practice } : { title: '', description: '', type: 'experiment', status: 'designed', durationDays: 7, durationMode: 'repeated', startDate: today().slice(0, 10), endDate: '', conceptTags: [] });
    setEditorOpen(true);
  };

  React.useEffect(() => {
    if (!focusedPracticeId) return;
    const focused = practices.find((practice) => practice.id === focusedPracticeId);
    if (focused) openEditor(focused);
  }, [focusedPracticeId, practices]);

  const handleSave = () => {
    if (!draft.title?.trim()) return;
    const payload = { ...draft, conceptTags: normalizeConceptTags(draft.conceptTags) };
    if (draft.id) onUpdatePractice(payload as Practice);
    else onAddPractice(payload);
    setEditorOpen(false);
    if (draft.id) onOpenPracticeRoute?.(draft.id);
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
      <PageHeader
        title="Practices"
        description="Turn understanding into habits, experiments, disciplines, commitments, and lived tests."
        meta={
          <span className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            {practiceStats.total} practices · {practiceStats.active} active · {practiceStats.needsDesign} need setup · {practiceStats.needsOutcome + practiceStats.needsConsequence} ready for review
          </span>
        }
        className="mb-5"
        actions={
          <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 px-6 shadow-md shadow-accent/20 rounded-full h-9 font-bold">
            <Plus className="size-4 mr-1.5" /> NEW PRACTICE
          </Button>
        }
      />


      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search practices, hypotheses, outcomes..."
        searchLabel="Search practices"
        resultCount={filtered.length}
        resultLabel="practices"
        activeFilterLabels={activePracticeFilterLabels}
        onClear={clearPracticeFilters}
        clearDisabled={!practiceFiltersActive}
        className="mb-3"
      >
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as PracticeViewFilter)}>
          <SelectTrigger className="w-56 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-white shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Views" /></SelectTrigger>
          <SelectContent>
            {practiceViewFilters.map((filter) => <SelectItem key={filter.value} value={filter.value} className="font-code text-[9px] uppercase">{filter.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PracticeStatus | 'all')}>
          <SelectTrigger className="w-48 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-white shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[9px] uppercase">All Statuses</SelectItem>
            {primaryPracticeStatusFilters.map((status) => <SelectItem key={status} value={status} className="font-code text-[9px] uppercase">{status}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as PracticeType | 'all')}>
          <SelectTrigger className="w-56 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-white shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[9px] uppercase">All Practice Types</SelectItem>
            {primaryPracticeTypeFilters.map((type) => <SelectItem key={type} value={type} className="font-code text-[9px] uppercase">{PRACTICE_LABELS[type]}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterToolbar>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          { label: 'Needs setup', value: practiceStats.needsDesign + practiceStats.needsBasis, filter: 'needs_design' as PracticeViewFilter },
          { label: 'Log due', value: practiceStats.awaitingLog, filter: 'awaiting_log' as PracticeViewFilter },
          { label: 'Ready for review', value: practiceStats.needsOutcome + practiceStats.needsConsequence, filter: 'needs_outcome' as PracticeViewFilter },
          { label: 'Testing positions', value: practiceStats.testedPositions, filter: 'testing_positions' as PracticeViewFilter },
        ].filter((item) => item.value > 0).map((item) => (
          <button
            key={item.filter}
            type="button"
            onClick={() => setViewFilter(viewFilter === item.filter ? 'all' : item.filter)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-widest transition-colors",
              viewFilter === item.filter ? "border-accent bg-accent text-accent-foreground" : "border-border bg-white text-muted-foreground hover:border-accent/40 hover:text-foreground"
            )}
          >
            {item.label} {item.value}
          </button>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-border/50 bg-card/70 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Repeat className="size-4 text-accent" />
          <h2 className="font-headline text-xl font-bold italic text-primary/80">Active Loop</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(activePractices.length ? activePractices.slice(0, 4) : practices.slice(0, 4)).map((practice) => (
            <PracticeCard key={`active-${practice.id}`} compact practice={practice} questions={questionList} positions={positions} onEdit={() => { openEditor(practice); onOpenPracticeRoute?.(practice.id); }} onDelete={() => setDeleteTarget(practice)} onUpdatePractice={onUpdatePractice} onCreateLink={onCreateLink} />
          ))}
          {!practices.length && (
            <Card className="border-dashed border-border/60 bg-muted/5 p-8 text-center shadow-inner md:col-span-2 xl:col-span-3 2xl:col-span-4 rounded-xl">
              <Repeat className="size-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-headline text-xl italic mb-2 text-primary/60">No lived tests initiated</h3>
              <p className="max-w-sm mx-auto text-sm text-muted-foreground italic mb-5">What does your current understanding require of you?</p>
              <Button variant="outline" onClick={() => openEditor()} className="rounded-full px-8 font-bold border-border/60 shadow-sm bg-white">Initiate Practice</Button>
            </Card>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((practice) => (
          <PracticeCard key={practice.id} practice={practice} questions={questionList} positions={positions} onEdit={() => { openEditor(practice); onOpenPracticeRoute?.(practice.id); }} onDelete={() => setDeleteTarget(practice)} onUpdatePractice={onUpdatePractice} onCreateLink={onCreateLink} />
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 2xl:col-span-4">
            <PageEmptyState
              icon={Repeat}
              title="No practices found"
              description="Clear filters or create a lived test that connects a position to behavior."
              action={practiceFiltersActive ? <Button variant="outline" onClick={clearPracticeFilters} className="rounded-full">Clear filters</Button> : <Button onClick={() => openEditor()} className="rounded-full"><Plus className="mr-1.5 size-4" /> New practice</Button>}
            />
          </div>
        )}
      </div>

      <PracticeEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open && focusedPracticeId) onOpenPracticeRoute?.(null);
        }}
        draft={draft}
        setDraft={setDraft}
        concepts={concepts}
        media={media}
        questions={questionList}
        positions={positions}
        drafts={drafts}
        onAddConcept={onAddConcept}
        onSave={handleSave}
        routeOwned={Boolean(focusedPracticeId && draft.id === focusedPracticeId)}
      />
      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete practice?"
        description={`This removes "${deleteTarget?.title || 'this practice'}" and its logs from the practice workspace. Linked positions, inquiries, works, and sources will remain.`}
        confirmLabel="Delete Practice"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          onDeletePractice(deleteTarget.id);
          setDeleteTarget(null);
          if (focusedPracticeId === deleteTarget.id) onOpenPracticeRoute?.(null);
        }}
      />
    </div>
  );
}

function PracticeCard({ practice, questions, positions, onEdit, onDelete, onUpdatePractice, onCreateLink, compact = false }: {
  practice: Practice;
  questions: Question[];
  positions: VaultEntry[];
  onEdit: () => void;
  onDelete: () => void;
  onUpdatePractice: (practice: Practice) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  compact?: boolean;
}) {
  const linkedQuestions = questions.filter((question) => (practice.questionIds || []).includes(question.id));
  const linkedPositions = positions.filter((position) => (practice.positionIds || []).includes(position.id));
  const firstLinkedPosition = linkedPositions[0];
  const todayKey = dateKey();
  const logDates = practiceLogDates(practice);
  const streak = currentStreak(logDates);
  const experimentShape = practiceExperimentShape(practice, linkedQuestions, linkedPositions);
  const needsLog = practiceNeedsLog(practice);
  const recentlyConcluded = practiceRecentlyConcluded(practice);
  const [reviewOpen, setReviewOpen] = useState(experimentShape.needsOutcome);
  const [logOpen, setLogOpen] = useState(false);
  const [logDraft, setLogDraft] = useState<Partial<PracticeLog>>({ date: todayKey, actionCompleted: true, confidence: 3 });
  const [reviewDraft, setReviewDraft] = useState({
    performedAsIntended: practice.conclusion?.performedAsIntended || '',
    whatHappened: practice.conclusion?.whatHappened || practice.observedOutcome || practice.notes || '',
    hypothesisSupported: practice.conclusion?.hypothesisSupported || '',
    alternativeExplanation: practice.conclusion?.alternativeExplanation || practice.alternativeExplanation || '',
    intellectualChange: practice.conclusion?.intellectualChange || practice.effectOnPosition || '',
    shouldContinue: practice.conclusion?.shouldContinue || '',
  });
  const setStatus = (status: PracticeStatus) => onUpdatePractice({ ...practice, status, dateUpdated: today() });
  const meaningfulStreak = ['habit', 'discipline', 'ritual', 'rule', 'challenge'].includes(practice.type);
  const durationText = practice.durationDays
    ? `Day ${Math.min(logDates.length || 0, practice.durationDays)} of ${practice.durationDays}`
    : practice.durationMode || 'Cadence unset';
  const setupNeed = !experimentShape.hasBasis
    ? 'Needs basis: link the idea, position, or inquiry this tests.'
    : experimentShape.designGaps.length
      ? `Needs setup: add ${experimentShape.designGaps[0]}.`
      : '';
  const relationshipText = `Tests ${linkedPositions.length} position${linkedPositions.length === 1 ? '' : 's'} · connected to ${linkedQuestions.length} inquir${linkedQuestions.length === 1 ? 'y' : 'ies'}`;
  const nextAction =
    setupNeed ? { label: 'Finish setup', handler: onEdit, tone: 'setup' as const } :
    practice.status === 'proposed' || practice.status === 'designed' || practice.status === 'planned' || practice.status === 'paused'
      ? { label: 'Start practice', handler: () => setStatus('active'), tone: 'start' as const } :
    practice.status === 'active' && needsLog
      ? { label: 'Log Observation', handler: () => setLogOpen(true), tone: 'log' as const } :
    isPracticeConcluded(practice) || experimentShape.needsOutcome || experimentShape.needsConsequence
      ? { label: 'Review evidence', handler: () => setReviewOpen(true), tone: 'review' as const } :
    practice.status === 'completed' || practice.status === 'integrated'
      ? { label: 'View conclusion', handler: () => setReviewOpen(true), tone: 'review' as const } :
      { label: 'Open', handler: onEdit, tone: 'open' as const };
  const saveLog = () => {
    const date = (logDraft.date || todayKey).slice(0, 10);
    const nextLog: PracticeLog = {
      id: uid(),
      date,
      actionCompleted: logDraft.actionCompleted ?? true,
      context: logDraft.context || '',
      outcome: logDraft.outcome || '',
      observations: logDraft.observations || '',
      unexpectedResult: logDraft.unexpectedResult || '',
      confidence: logDraft.confidence || 3,
      mediaIds: logDraft.mediaIds || [],
    };
    onUpdatePractice({
      ...practice,
      status: practice.status === 'planned' || practice.status === 'designed' || practice.status === 'proposed' ? 'active' : practice.status,
      logs: [...(practice.logs || []), nextLog],
      logDates: nextLog.actionCompleted ? Array.from(new Set([...logDates, date])) : logDates,
      observedOutcome: nextLog.outcome || practice.observedOutcome,
      dateUpdated: today(),
    });
    setLogDraft({ date: todayKey, actionCompleted: true, confidence: 3 });
    setLogOpen(false);
  };
  const saveConclusionReview = (status: PracticeStatus = 'completed') => {
    if (!reviewDraft.whatHappened.trim()) return;
    onUpdatePractice({
      ...practice,
      status,
      conclusion: reviewDraft,
      observedOutcome: reviewDraft.whatHappened.trim(),
      interpretation: reviewDraft.hypothesisSupported.trim(),
      alternativeExplanation: reviewDraft.alternativeExplanation.trim(),
      effectOnPosition: reviewDraft.intellectualChange.trim(),
      notes: reviewDraft.whatHappened.trim(),
      dateUpdated: today(),
    });
    setReviewOpen(false);
  };
  return (
    <Card className={cn("group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-accent/20 bg-white/95 rounded-xl shadow-md", compact ? "p-4" : "p-5")}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/80 rounded-full font-bold px-2.5 py-0.5 shadow-sm">{PRACTICE_LABELS[practice.type]}</Badge>
            <Badge variant="outline" className="font-code text-[8px] uppercase tracking-widest border-border/60 bg-white shadow-sm rounded-full font-bold px-2.5 py-0.5 shadow-sm">{practice.status}</Badge>
            {needsLog && <Badge className="font-code text-[8px] uppercase tracking-widest bg-emerald-100 text-emerald-900 hover:bg-emerald-100 rounded-full font-bold px-2.5 py-0.5">log due</Badge>}
            {setupNeed && <Badge className="font-code text-[8px] uppercase tracking-widest bg-sky-100 text-sky-950 hover:bg-sky-100 rounded-full font-bold px-2.5 py-0.5">needs setup</Badge>}
            {recentlyConcluded && <Badge variant="outline" className="font-code text-[8px] uppercase tracking-widest border-accent/30 bg-accent/5 text-accent rounded-full font-bold px-2.5 py-0.5">recent result</Badge>}
          </div>
          <h3 className="font-headline text-xl font-bold italic leading-tight group-hover:text-accent transition-colors text-primary truncate">{practice.title}</h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive rounded-full" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="size-3.5" /></Button>
        </div>
      </div>
      
      <p className="text-[13px] leading-relaxed text-muted-foreground font-body line-clamp-2 italic mb-4">
        {practice.description || 'No requirement explicitly defined.'}
      </p>

      <div className="mb-4 rounded-xl border border-border/40 bg-card/80 p-3 text-[12px] leading-relaxed">
        <div className="font-code text-[7px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold mb-1">Tests</div>
        <p className="line-clamp-2 text-primary/80 italic">{practice.intellectualBasis || firstLinkedPosition?.title || linkedQuestions[0]?.text || 'No source idea named yet.'}</p>
        <div className="mt-2 flex flex-wrap gap-2 font-code text-[8px] uppercase tracking-widest text-muted-foreground">
          <span>{durationText}</span>
          <span>{(practice.logs || []).length} observations</span>
          {meaningfulStreak && <span>{streak}d streak</span>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{relationshipText}</p>
        {setupNeed && (
          <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-950">{setupNeed}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/30 pt-4">
        <Button size="sm" onClick={(event) => { event.stopPropagation(); nextAction.handler(); }} className="h-8 rounded-full font-code text-[9px] uppercase tracking-widest">
          {nextAction.label}
        </Button>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 font-code text-[9px] uppercase tracking-widest" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            Open
          </Button>
          {practice.status === 'active' && (
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 font-code text-[9px] uppercase tracking-widest" onClick={(e) => { e.stopPropagation(); setStatus('paused'); }}>
              Pause
            </Button>
          )}
        </div>
      </div>

      {logOpen && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-700">Observation Log</div>
              <p className="mt-1 text-xs leading-5 text-emerald-950/70">
                Capture what actually happened. Routine logs stay quiet unless they change the intellectual outcome.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLogOpen(false)} className="h-7 rounded-full px-2.5 font-code text-[8px] uppercase">Hide</Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="DATE">
              <Input type="date" value={logDraft.date || todayKey} onChange={(event) => setLogDraft((prev) => ({ ...prev, date: event.target.value }))} className="h-10 rounded-full bg-white font-code text-xs" />
            </Field>
            <Field label="CONFIDENCE IN OBSERVATION">
              <Select value={String(logDraft.confidence || 3)} onValueChange={(value) => setLogDraft((prev) => ({ ...prev, confidence: Number(value) }))}>
                <SelectTrigger className="h-10 rounded-full bg-white font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)} className="font-code text-[10px] uppercase">{value} / 5</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3 text-sm font-medium text-emerald-950 sm:col-span-2">
              <input
                type="checkbox"
                checked={logDraft.actionCompleted ?? true}
                onChange={(event) => setLogDraft((prev) => ({ ...prev, actionCompleted: event.target.checked }))}
                className="size-4 accent-emerald-600"
              />
              Action completed as intended
            </label>
            <Field label="CONTEXT">
              <Textarea value={logDraft.context || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, context: event.target.value }))} placeholder="When, where, under what conditions?" className="min-h-20 bg-white" />
            </Field>
            <Field label="OUTCOME">
              <Textarea value={logDraft.outcome || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, outcome: event.target.value }))} placeholder="What happened?" className="min-h-20 bg-white" />
            </Field>
            <Field label="OBSERVATIONS">
              <Textarea value={logDraft.observations || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, observations: event.target.value }))} placeholder="Emotional, practical, or situational observations." className="min-h-20 bg-white" />
            </Field>
            <Field label="UNEXPECTED RESULT">
              <Textarea value={logDraft.unexpectedResult || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, unexpectedResult: event.target.value }))} placeholder="What surprised you or complicated the hypothesis?" className="min-h-20 bg-white" />
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setLogOpen(false)} className="h-8 rounded-full bg-white">Cancel</Button>
            <Button size="sm" onClick={saveLog} className="h-8 rounded-full bg-emerald-700 hover:bg-emerald-800">Save Observation</Button>
          </div>
        </div>
      )}

      {reviewOpen && (
        <div className="mt-5 rounded-xl border border-accent/20 bg-accent/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-accent">Conclusion Review</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Compare theory versus reality before this practice changes what you believe.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReviewOpen(false)} className="h-7 rounded-full px-2.5 font-code text-[8px] uppercase">Hide</Button>
          </div>
          <div className="mt-3 grid gap-2 text-[11px] leading-5 text-muted-foreground sm:grid-cols-2">
            <div className="rounded-lg border border-border/30 bg-card p-3">Was the practice performed as intended?</div>
            <div className="rounded-lg border border-border/30 bg-card p-3">What happened that you did not expect?</div>
            <div className="rounded-lg border border-border/30 bg-card p-3">Was the hypothesis supported, weakened, or complicated?</div>
            <div className="rounded-lg border border-border/30 bg-card p-3">What alternative explanation exists?</div>
            <div className="rounded-lg border border-border/30 bg-card p-3">What changed intellectually?</div>
            <div className="rounded-lg border border-border/30 bg-card p-3">Should this continue, revise, integrate, or stop?</div>
          </div>
          <Textarea
            value={reviewDraft.whatHappened}
            onChange={(event) => setReviewDraft((prev) => ({ ...prev, whatHappened: event.target.value }))}
            placeholder="What happened?"
            className="mt-3 min-h-24 rounded-xl bg-white"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Textarea value={reviewDraft.performedAsIntended} onChange={(event) => setReviewDraft((prev) => ({ ...prev, performedAsIntended: event.target.value }))} placeholder="Was the practice performed as intended?" className="min-h-20 rounded-xl bg-white" />
            <Textarea value={reviewDraft.hypothesisSupported} onChange={(event) => setReviewDraft((prev) => ({ ...prev, hypothesisSupported: event.target.value }))} placeholder="Was the hypothesis supported, weakened, or complicated?" className="min-h-20 rounded-xl bg-white" />
            <Textarea value={reviewDraft.alternativeExplanation} onChange={(event) => setReviewDraft((prev) => ({ ...prev, alternativeExplanation: event.target.value }))} placeholder="What alternative explanation exists?" className="min-h-20 rounded-xl bg-white" />
            <Textarea value={reviewDraft.intellectualChange} onChange={(event) => setReviewDraft((prev) => ({ ...prev, intellectualChange: event.target.value }))} placeholder="What changed intellectually?" className="min-h-20 rounded-xl bg-white" />
            <Textarea value={reviewDraft.shouldContinue} onChange={(event) => setReviewDraft((prev) => ({ ...prev, shouldContinue: event.target.value }))} placeholder="Should this continue, revise, integrate, or stop?" className="min-h-20 rounded-xl bg-white sm:col-span-2" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => saveConclusionReview('concluded')} disabled={!reviewDraft.whatHappened.trim()} className="h-8 rounded-full">
              Save as Concluded
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveConclusionReview('failed_productively')} disabled={!reviewDraft.whatHappened.trim()} className="h-8 rounded-full bg-card">
              Save as Failed Productively
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveConclusionReview('integrated')} disabled={!reviewDraft.whatHappened.trim()} className="h-8 rounded-full bg-card">
              Save as Integrated
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function PracticeEditor({ open, onOpenChange, draft, setDraft, concepts, media, questions, positions, drafts, onAddConcept, onSave, routeOwned = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Partial<Practice>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Practice>>>;
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  onAddConcept: (data: Partial<Concept>) => void;
  onSave: () => void;
  routeOwned?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto bg-white border-none shadow-2xl rounded-2xl p-0">
        <div className="p-8">
          <DialogHeader className="mb-8"><DialogTitle className="font-headline text-3xl italic">{draft.id ? 'Refine Practice' : 'Initiate Practice'}</DialogTitle></DialogHeader>
          <div className="space-y-8">
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="size-4 text-accent" />
                <h3 className="font-headline text-xl italic font-bold text-primary">Field Experiment Design</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground italic">
                A practice should name the idea being tested, the action required, the observation method, and the conclusion that would matter later.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="PRACTICE TITLE"><Input value={draft.title || ''} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="italic text-base rounded-full" /></Field>
              <Field label="DURATION (DAYS)"><Input type="number" min={0} value={draft.durationDays || 0} onChange={(event) => setDraft((prev) => ({ ...prev, durationDays: Math.max(0, Number(event.target.value) || 0) }))} className="font-code rounded-full" /></Field>
              <Field label="PRACTICE TYPE">
                <Select value={draft.type || 'experiment'} onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as PracticeType }))}>
                  <SelectTrigger className="rounded-full bg-white border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{practiceTypes.map((type) => <SelectItem key={type} value={type} className="font-code text-[10px] uppercase">{PRACTICE_LABELS[type]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="STATUS">
                <Select value={draft.status || 'planned'} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as PracticeStatus }))}>
                  <SelectTrigger className="rounded-full bg-white border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className="font-code text-[10px] uppercase">{status}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="DURATION MODE">
                <Select value={draft.durationMode || 'repeated'} onValueChange={(value) => setDraft((prev) => ({ ...prev, durationMode: value as Practice['durationMode'] }))}>
                  <SelectTrigger className="rounded-full bg-white border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time" className="font-code text-[10px] uppercase">One Time</SelectItem>
                    <SelectItem value="repeated" className="font-code text-[10px] uppercase">Repeated</SelectItem>
                    <SelectItem value="open_ended" className="font-code text-[10px] uppercase">Open Ended</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="START DATE"><Input type="date" value={draft.startDate || ''} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
              <Field label="END DATE (EXPECTED)"><Input type="date" value={draft.endDate || ''} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
            </div>
            <Field label="DESCRIPTION / PURPOSE"><Textarea value={draft.description || ''} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="Why this practice matters in the larger thinking system." /></Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="INTELLECTUAL BASIS"><Textarea value={draft.intellectualBasis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, intellectualBasis: event.target.value }))} className="min-h-[120px] italic text-base" placeholder="What idea, position, inquiry, source, or uncertainty inspired this practice?" /></Field>
              <Field label="HYPOTHESIS"><Textarea value={draft.hypothesis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, hypothesis: event.target.value }))} className="min-h-[120px] italic text-base" placeholder="If I do this, what do I expect to happen or discover?" /></Field>
              <Field label="ACTION"><Textarea value={draft.action || ''} onChange={(event) => setDraft((prev) => ({ ...prev, action: event.target.value }))} className="min-h-[120px] italic text-base" placeholder="What exactly will you do, avoid, observe, ask, or commit to?" /></Field>
              <Field label="CONTEXT"><Textarea value={draft.context || ''} onChange={(event) => setDraft((prev) => ({ ...prev, context: event.target.value }))} className="min-h-[120px] italic text-base" placeholder="When, where, with whom, and under what conditions?" /></Field>
              <Field label="OBSERVATION METHOD"><Textarea value={draft.observationMethod || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observationMethod: event.target.value }))} className="min-h-[120px] italic text-base" placeholder="How will you know what happened without overstating the evidence?" /></Field>
              <Field label="EXPECTED OUTCOME"><Textarea value={draft.expectedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, expectedOutcome: event.target.value }))} className="min-h-[120px] italic text-base" placeholder="What would support, weaken, or complicate the hypothesis?" /></Field>
            </div>
            <div className="rounded-2xl border border-border/50 bg-muted/10 p-5">
              <h3 className="mb-4 font-headline text-xl italic font-bold text-primary">Theory vs. Reality Review</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="OBSERVED OUTCOME"><Textarea value={draft.observedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observedOutcome: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What has actually happened so far?" /></Field>
                <Field label="INTERPRETATION"><Textarea value={draft.interpretation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, interpretation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What do you think the result means?" /></Field>
                <Field label="ALTERNATIVE EXPLANATION"><Textarea value={draft.alternativeExplanation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, alternativeExplanation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What else could explain the result?" /></Field>
                <Field label="EFFECT ON POSITION"><Textarea value={draft.effectOnPosition || ''} onChange={(event) => setDraft((prev) => ({ ...prev, effectOnPosition: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What position, inquiry, or concept should change because of this?" /></Field>
              </div>
            </div>
            <Field label="GENERAL NOTES"><Textarea value={draft.notes || ''} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[100px] italic text-base" placeholder="Optional working notes or reflection that does not fit the structured fields." /></Field>
            <Field label="CONCEPTS TESTED"><ConceptTagPicker concepts={concepts} value={draft.conceptTags || []} onChange={(conceptTags) => setDraft((prev) => ({ ...prev, conceptTags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} /></Field>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <LinkGrid title="Linked Sources" items={media.map((item) => ({ id: item.id, label: item.title }))} selected={draft.sourceIds || []} onChange={(sourceIds) => setDraft((prev) => ({ ...prev, sourceIds }))} />
              <LinkGrid title="Linked Inquiries" items={questions.map((item) => ({ id: item.id, label: item.text }))} selected={draft.questionIds || []} onChange={(questionIds) => setDraft((prev) => ({ ...prev, questionIds }))} />
              <LinkGrid title="Linked Positions" items={positions.map((item) => ({ id: item.id, label: item.title }))} selected={draft.positionIds || []} onChange={(positionIds) => setDraft((prev) => ({ ...prev, positionIds }))} />
              <LinkGrid title="Linked Works" items={drafts.map((item) => ({ id: item.id, label: item.title }))} selected={draft.draftIds || []} onChange={(draftIds) => setDraft((prev) => ({ ...prev, draftIds }))} />
            </div>
          </div>
        </div>
        <div className="p-8 pt-4 bg-muted/10 border-t flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-11 px-8 rounded-full font-bold text-muted-foreground hover:bg-transparent">CANCEL</Button>
          <Button onClick={onSave} className="h-11 px-10 bg-accent shadow-xl shadow-accent/20 rounded-full font-bold uppercase tracking-widest text-[11px]">Initiate Practice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="font-code text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60 font-bold">{label}</Label>{children}</div>;
}

function LinkGrid({ title, items, selected, onChange }: { title: string; items: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <Field label={title}>
      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-white p-4 shadow-inner">
        {items.length ? items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 text-sm cursor-pointer group py-1">
            <input 
              type="checkbox" 
              checked={selected.includes(item.id)} 
              onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} 
              className="accent-accent size-4 rounded border-border/60"
            />
            <span className="font-body italic text-primary/80 line-clamp-1 group-hover:text-accent transition-colors">{item.label}</span>
          </label>
        )) : <p className="text-[11px] text-muted-foreground italic p-2">No items discovered in vault.</p>}
      </div>
    </Field>
  );
}
