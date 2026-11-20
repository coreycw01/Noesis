
"use client";

import { aiDepthFor } from '@/lib/ai-depth';
import React, { useMemo, useState } from 'react';
import { useLocalDay } from '@/hooks/use-local-day';
import { CheckCircle2, ClipboardList, Edit, Eye, MoreHorizontal, PauseCircle, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import type { Concept, Draft, Media, PhilosophicalLink, Practice, PracticeLog, PracticeStatus, PracticeType, Question, VaultEntry } from '@/lib/types';
import { allQuestions, normalizeConceptTags, PRACTICE_LABELS, today, uid } from '@/lib/readex';
import { appendPracticeObservation } from '@/lib/practice-observations';
import { localDateKey as dateKey } from '@/lib/calendar';
import { isPracticeConcluded, practiceCalendarDate, practiceLogDates, practiceNeedsConsequence, practiceNeedsLog, practiceNeedsOutcome, practiceRecentlyConcluded, practiceScheduleState } from '@/lib/practice-state';
import { LabeledField } from '@/components/shared/LabeledField';
import { cn } from '@/lib/utils';
import { activateEntityOnKey, isEntitySurfaceClick } from '@/lib/entity-activation';
import { NOESIS_ICONS } from '@/lib/noesis-icons';

const PracticeIcon = NOESIS_ICONS.practice;
import { StageBadge } from '@/components/shared/StageBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { resolvedAiHistory, type AiReviewResult } from '@/lib/contextual-ai';
import { practiceReviewTarget, type PracticeReviewApproval } from '@/lib/practice-ai-review';
import { RecordHeader, RecordPage, RecordPath, RecordSection, SuggestionCards, type Suggestion } from '@/components/shared/record/RecordPage';
import { Dictation } from '@/components/shared/Dictation';
import { PraxisInstrument } from '@/components/Practices/PraxisInstrument';
import { hasPracticeIntellectualBasis, isRepeatablePractice, normalizePracticeStatusForSave, practiceDesignGaps } from '@/lib/workflow-integrity';
import { useToast } from '@/hooks/use-toast';
import { PraxisMethodPicker, type PraxisMethod } from '@/components/Practices/PraxisMethodPicker';
import { PraxisDayStrip, PraxisMethodShape, praxisShapeFor } from '@/components/Practices/PraxisMethodShape';
import type { NoesisView } from '@/lib/noesis-routes';

interface PracticesWorkspaceProps {
  labTool: 'practices' | 'experiments';
  onPickMethod: (method: PraxisMethod) => void;
  aiSettings: import('@/lib/types').AiSettings;
  practices: Practice[];
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  links: PhilosophicalLink[];
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onUpdatePractice: (practice: Practice, approval?: PracticeReviewApproval) => void | Promise<Practice | void>;
  onDeletePractice: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  focusedPracticeId?: string | null;
  onOpenPracticeRoute?: (id: string | null) => void;
  onNavigateTarget: (target: { view: NoesisView; targetId?: string | null }) => void;
  onAddQuestion?: (data: Partial<Question>) => unknown;
}

const practiceTypes: PracticeType[] = ['habit', 'experiment', 'observation', 'reflection'];
const statuses: PracticeStatus[] = ['planned', 'active', 'paused', 'completed', 'abandoned'];
const simplifiedTypeLabels: Record<PracticeType, string> = {
  habit: 'Habit',
  experiment: 'Experiment',
  discipline: 'Habit',
  reflection_prompt: 'Reflection',
  commitment: 'Habit',
  observation: 'Observation',
  rule: 'Habit',
  challenge: 'Experiment',
  dialogue: 'Reflection',
  reflection: 'Reflection',
  restraint: 'Habit',
  exposure: 'Experiment',
  decision_rule: 'Experiment',
  ritual: 'Habit',
};

function normalizePracticeType(type?: PracticeType): PracticeType {
  if (type === 'observation') return 'observation';
  if (type === 'reflection' || type === 'reflection_prompt' || type === 'dialogue') return 'reflection';
  if (type === 'experiment' || type === 'challenge' || type === 'exposure' || type === 'decision_rule') return 'experiment';
  return 'habit';
}

export function practicePraxisMethod(type?: PracticeType) {
  return normalizePracticeType(type) === 'experiment' ? 'experiments' : 'practices';
}

function normalizePracticeStatus(status?: PracticeStatus): PracticeStatus {
  if (status === 'active') return 'active';
  if (status === 'paused') return 'paused';
  if (status === 'abandoned') return 'abandoned';
  if (status === 'completed' || status === 'concluded' || status === 'failed' || status === 'failed_productively' || status === 'integrated') return 'completed';
  return 'planned';
}

function hasPracticeBasis(practice: Practice, linkedQuestions: Question[] = [], linkedPositions: VaultEntry[] = []) {
  return isRepeatablePractice(practice.type) || hasPracticeIntellectualBasis(practice) || linkedPositions.length > 0 || linkedQuestions.length > 0;
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

export function PracticesWorkspace({ labTool, onPickMethod, aiSettings, practices, concepts, media, questions, positions, drafts, links, onAddPractice, onUpdatePractice, onDeletePractice, onAddConcept, onCreateLink, focusedPracticeId, onOpenPracticeRoute, onNavigateTarget, onAddQuestion }: PracticesWorkspaceProps) {
  const localDay = useLocalDay();
  const { toast } = useToast();
  const savingRef = React.useRef(false);
  const [savingPractice, setSavingPractice] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PracticeStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useEntityViewPreference('practices');
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Practice | null>(null);
  const [draft, setDraft] = useState<Partial<Practice>>({ title: '', description: '', type: 'experiment', status: 'planned', durationDays: 7, durationMode: 'repeated', conceptTags: [] });
  const questionList = useMemo(() => allQuestions(media, questions), [media, questions]);
  const isExperiment = labTool === 'experiments';
  const noun = isExperiment ? 'experiment' : 'practice';
  const practiceState = useMemo(() => {
    const day = new Date(`${localDay}T12:00:00`);
    const questionById = new Map(questionList.map((question) => [question.id, question]));
    const positionById = new Map(positions.map((position) => [position.id, position]));
    return new Map(practices.map((practice) => {
      const linkedQuestions = (practice.questionIds || []).map((id) => questionById.get(id)).filter(Boolean) as Question[];
      const linkedPositions = (practice.positionIds || []).map((id) => positionById.get(id)).filter(Boolean) as VaultEntry[];
      const schedule = practiceScheduleState(practice, day);
      return [practice.id, {
        linkedQuestions,
        linkedPositions,
        hasBasis: hasPracticeBasis(practice, linkedQuestions, linkedPositions),
        needsLog: practiceNeedsLog(practice, day),
        schedule,
        scheduleReview: schedule === 'review',
        needsDesign: practiceDesignGaps(practice).length > 0,
        needsOutcome: practiceNeedsOutcome(practice),
        needsConsequence: practiceNeedsConsequence(practice),
        recentlyConcluded: practiceRecentlyConcluded(practice),
      }];
    }));
  }, [localDay, practices, questionList, positions]);
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
    return practicePraxisMethod(practice.type) === labTool && matchesSearch
      && (statusFilter === 'all' || normalizePracticeStatus(practice.status) === statusFilter);
  });
  const otherPractices = filtered.filter(practice => normalizePracticeStatus(practice.status) !== 'active');
  const visibleActiveLoops = filtered.filter(practice => normalizePracticeStatus(practice.status) === 'active');
  const needsAttentionLoops = visibleActiveLoops.filter((practice) => {
    const state = practiceState.get(practice.id);
    return !state?.hasBasis || state?.needsDesign || state?.scheduleReview;
  });
  const todayLoops = visibleActiveLoops.filter((practice) => practiceState.get(practice.id)?.needsLog);
  const ongoingLoops = visibleActiveLoops.filter((practice) => !needsAttentionLoops.some((item) => item.id === practice.id) && !todayLoops.some((item) => item.id === practice.id));
  const clearPracticeFilters = () => { setStatusFilter('all'); setSearch(''); };
  const practiceFiltersActive = statusFilter !== 'all' || Boolean(search.trim());
  const activePracticeFilterLabels = statusFilter === 'all' ? [] : [`Status: ${statusFilter}`];

  const openEditor = (practice?: Practice, newType: 'practice' | 'experiment' = labTool === 'experiments' ? 'experiment' : 'practice') => {
    if (practice && onOpenPracticeRoute) {
      onOpenPracticeRoute(practice.id);
      return;
    }
    setDraft(practice ? { ...practice, type: normalizePracticeType(practice.type), status: normalizePracticeStatus(practice.status) } : {
      title: '',
      description: '',
      type: newType === 'experiment' ? 'experiment' : 'habit',
      status: 'planned',
      durationDays: newType === 'experiment' ? 7 : 30,
      durationMode: newType === 'experiment' ? 'one_time' : 'repeated',
      startDate: '',
      endDate: '',
      conceptTags: [],
    });
    setEditorOpen(true);
  };

  const openedPracticeId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!focusedPracticeId) {
      if (openedPracticeId.current) setEditorOpen(false);
      openedPracticeId.current = null;
      return;
    }
    if (openedPracticeId.current === focusedPracticeId) return;
    const focused = practices.find((practice) => practice.id === focusedPracticeId);
    if (focused) {
      openedPracticeId.current = focusedPracticeId;
      setDraft({ ...focused, type: normalizePracticeType(focused.type), status: normalizePracticeStatus(focused.status) });
      setEditorOpen(true);
    }
  }, [focusedPracticeId, practices]);

  const persistEditedPractice = async (next: Practice, draftPatch?: Partial<Practice>) => {
    if (savingRef.current) throw new Error('A practice save is already in progress.');
    savingRef.current = true;
    setSavingPractice(true);
    try {
      await onUpdatePractice(next);
      setDraft((current) => draftPatch ? { ...current, ...draftPatch } : next);
    } finally { savingRef.current = false; setSavingPractice(false); }
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!draft.title?.trim()) return;
    const payload = {
      ...draft,
      status: normalizePracticeStatusForSave(draft),
      conceptTags: normalizeConceptTags(draft.conceptTags),
    };
    savingRef.current = true;
    setSavingPractice(true);
    try {
      if (draft.id) {
        await onUpdatePractice(payload as Practice);
        setEditorOpen(false);
        if (focusedPracticeId) onOpenPracticeRoute?.(null);
      } else {
        const created = await onAddPractice(payload);
        setDraft(created);
        onOpenPracticeRoute?.(created.id);
        toast({ title: 'Practice created', description: 'Continue setup or start recording when it is active.' });
      }
    } catch {
      toast({ title: 'Practice not saved', description: 'Your changes are still here. Check your connection and try again.', variant: 'destructive' });
    } finally {
      savingRef.current = false;
      setSavingPractice(false);
    }
  };

  // An existing practice opens as its own page, so the index steps aside;
  // a new one is still a dialog over the index.
  const editorShown = editorOpen && (!onOpenPracticeRoute || (draft.id || null) === (focusedPracticeId || null));
  const practiceIsOpen = editorShown && Boolean(draft.id);

  return (
    <div className="noesis-page noesis-labs-page" data-noesis-identity="experiment-log">
      {!practiceIsOpen && (<>
      <PageHeader
        title="Praxis"
        description={isExperiment ? 'Make a prediction, record what happens, and review the result.' : 'Choose a repeatable action and check in when you do it.'}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <PraxisMethodPicker method={labTool} onChange={method => { clearPracticeFilters(); onPickMethod(method); }} />
            <Button onClick={() => openEditor()}><Plus className="size-4" /> New {noun}</Button>
          </div>
        )}
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={labTool === 'experiments' ? 'Search experiments, hypotheses, outcomes...' : 'Search practices, actions, observations...'}
        searchLabel={`Search ${labTool}`}
        resultCount={filtered.length}
        resultLabel={labTool}
        activeFilterLabels={activePracticeFilterLabels}
        onClear={clearPracticeFilters}
        clearDisabled={!practiceFiltersActive}
        viewControl={<ViewModeToggle value={viewMode === 'table' ? 'table' : 'grid'} modes={['grid', 'table']} onChange={(value) => setViewMode(value === 'table' ? 'table' : 'cards')} label="Praxis view" />}
        className="mb-3"
      >
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PracticeStatus | 'all')}>
          <SelectTrigger className="w-48 h-9 noesis-eyebrow noesis-eyebrow--sm rounded-full bg-card shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="noesis-eyebrow noesis-eyebrow--sm">All Statuses</SelectItem>
            {statuses.map((status) => <SelectItem key={status} value={status} className="noesis-eyebrow noesis-eyebrow--sm">{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterToolbar>

      <details className="mb-4 text-xs text-muted-foreground">
        <summary className="min-h-8 cursor-pointer">What the calendar shapes mean</summary>
        <div className="flex flex-wrap gap-x-4 gap-y-2 py-1">
          {(['habit', 'experiment', 'commitment'] as const).map((kind, index) => {
            const method = praxisShapeFor(kind);
            return <span key={kind} data-stage-tone={method.tone} className="inline-flex items-center gap-1.5"><PraxisMethodShape shape={method.shape} size={14} />{['Practice (repeat an action)', 'Experiment (test an idea)', 'Commitment (uphold a principle)'][index]}</span>;
          })}
        </div>
        <p className="py-1">Filled: kept. Dashed: missed. Faint outline: no check-in.</p>
      </details>

      {viewMode === 'table' && (
        <section className="mb-6 min-w-0 rounded-lg border border-border/60 bg-card">
          <Table className="table-fixed xl:table-auto" aria-label={`${labTool} table`}>
            <TableHeader><TableRow className="bg-muted/25 hover:bg-muted/25"><TableHead>{labTool === 'experiments' ? 'Experiment' : 'Practice'}</TableHead><TableHead className="hidden w-36 xl:table-cell">Type</TableHead><TableHead className="hidden w-36 lg:table-cell">Status</TableHead><TableHead className="hidden xl:table-cell">Action or hypothesis</TableHead><TableHead className="hidden w-40 xl:table-cell">Progress</TableHead><TableHead className="w-20 sm:w-24"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map((practice) => {
              const state = practiceState.get(practice.id);
              const progress = practice.status === 'abandoned' ? 'Record closed' : !isPracticeConcluded(practice) && (state?.needsDesign || !state?.hasBasis) ? 'Needs setup' : state?.schedule === 'scheduled' ? 'Scheduled' : state?.scheduleReview ? 'Review result' : state?.needsLog ? 'Log due' : state?.needsOutcome ? 'Review outcome' : state?.needsConsequence ? 'Connect result' : 'On track';
              const open = () => openEditor(practice);
              return <TableRow key={practice.id} className="cursor-pointer" onClick={(event) => { if (isEntitySurfaceClick(event)) open(); }}>
                <TableCell className="max-w-lg py-2 [overflow-wrap:anywhere]"><button type="button" className="min-h-11 w-full rounded-sm text-left font-headline text-base font-semibold text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={open} onKeyDown={(event) => activateEntityOnKey(event, open)}>{practice.title}</button><p className="text-xs text-muted-foreground xl:hidden">{progress}</p><p className="line-clamp-2 pb-2 text-xs text-muted-foreground">{practice.action || practice.hypothesis || practice.description || 'Action not defined'}</p></TableCell>
                <TableCell className="hidden noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground xl:table-cell">{simplifiedTypeLabels[normalizePracticeType(practice.type)]}</TableCell>
                <TableCell className="hidden lg:table-cell"><StageBadge type="practice" stage={practice.stage} status={practice.status} /></TableCell>
                <TableCell className="hidden text-xs leading-5 text-muted-foreground xl:table-cell">{practice.action || practice.hypothesis || 'Action not defined'}</TableCell>
                <TableCell className="hidden noesis-eyebrow noesis-eyebrow--sm text-muted-foreground xl:table-cell">{progress}</TableCell>
                <TableCell className="px-1 sm:px-4"><Button size="sm" variant="outline" className="min-h-11" onClick={open} onKeyDown={(event) => activateEntityOnKey(event, open)}>Open</Button></TableCell>
              </TableRow>;
            })}
            {!filtered.length && <TableRow><TableCell colSpan={6}>No {labTool} match this view.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>
      )}

      {viewMode !== 'table' && visibleActiveLoops.length > 0 && <section className="mb-6 rounded-2xl border border-border/50 bg-card/70 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {labTool === 'experiments' ? <NOESIS_ICONS.lab className="size-4 text-accent" /> : <PracticeIcon className="size-4 text-accent" />}
            <h2 className="font-headline text-xl font-bold italic text-primary/80">{labTool === 'experiments' ? 'Running experiments' : 'Active loops'}</h2>
          </div>
          <p className="max-w-xl text-xs italic leading-5 text-muted-foreground">
            {labTool === 'experiments' ? 'Record observations against the hypothesis, then conclude the bounded test.' : 'Log the action first. Reflect when the practice starts producing evidence.'}
          </p>
        </div>
        <div className="space-y-4">
          <ActiveLoopGroup title="Needs attention" practices={needsAttentionLoops} questions={questionList} positions={positions} onEdit={openEditor} onDelete={setDeleteTarget} onUpdatePractice={onUpdatePractice} />
          <ActiveLoopGroup title="Today" practices={todayLoops.filter((practice) => !needsAttentionLoops.some((item) => item.id === practice.id))} questions={questionList} positions={positions} onEdit={openEditor} onDelete={setDeleteTarget} onUpdatePractice={onUpdatePractice} />
          <ActiveLoopGroup title="Ongoing" practices={ongoingLoops} questions={questionList} positions={positions} onEdit={openEditor} onDelete={setDeleteTarget} onUpdatePractice={onUpdatePractice} />
        </div>
      </section>}



      {viewMode !== 'table' && otherPractices.length > 0 && <section className="rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-headline text-xl font-bold italic text-primary/80">Other {labTool}</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {otherPractices.map((practice) => (
            <PracticeCard key={practice.id} compact practice={practice} questions={questionList} positions={positions} onEdit={() => openEditor(practice)} onDelete={() => setDeleteTarget(practice)} onUpdatePractice={onUpdatePractice} onCreateLink={onCreateLink} />
          ))}
        </div>
      </section>}

      {viewMode !== 'table' && !filtered.length && <PageEmptyState icon={isExperiment ? NOESIS_ICONS.lab : PracticeIcon}
        title={`No ${labTool} found`}
        description={practiceFiltersActive ? 'Try a different search or status.' : isExperiment ? 'Start with a question and one observation that could help answer it.' : 'Start with one repeatable action, such as taking ten quiet minutes after work.'}
        action={practiceFiltersActive ? <Button variant="outline" onClick={clearPracticeFilters}>Clear filters</Button> : <Button onClick={() => openEditor()}>New {noun}</Button>}
      />}
      </>)}
      <PracticeEditor
        busy={savingPractice}
        aiSettings={aiSettings}
        open={editorShown}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open && focusedPracticeId) onOpenPracticeRoute?.(null);
        }}
        draft={draft}
        setDraft={setDraft}
        onOpenPosition={(id) => { setEditorOpen(false); onNavigateTarget({ view: 'vault', targetId: id }); }}
        onOpenWorks={() => { setEditorOpen(false); onNavigateTarget({ view: 'writing' }); }}
        onAddQuestion={onAddQuestion}
        concepts={concepts}
        media={media}
        questions={questionList}
        positions={positions}
        drafts={drafts}
        onAddConcept={onAddConcept}
        onRecordLog={async (log) => {
          if (!draft.id) throw new Error('Save the practice before recording an observation.');
          const next = appendPracticeObservation(draft as Practice, log, today());
          await persistEditedPractice(next);
        }}
        onSaveAiOutcome={async (result, content) => {
          const saved = practices.find((practice) => practice.id === draft.id);
          if (!saved) throw new Error('Save the practice before accepting an outcome review.');
          const next = await onUpdatePractice(saved, { result, text: content });
          if (next) setDraft((current) => current.id === next.id ? {
            ...current, aiOutcomeReview: next.aiOutcomeReview, aiReviewHistory: next.aiReviewHistory,
            outcomeProvenance: next.outcomeProvenance, dateUpdated: next.dateUpdated,
          } : current);
        }}
        onSaveAiHistory={async (aiReviewHistory) => {
          const saved = practices.find((practice) => practice.id === draft.id);
          if (!saved) throw new Error('This practice is no longer available.');
          const patch = { aiReviewHistory, dateUpdated: new Date().toISOString() };
          await persistEditedPractice({ ...saved, ...patch }, patch);
        }}
        onSave={handleSave}
      />
      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete practice?"
        description={`This removes "${deleteTarget?.title || 'this practice'}" and its logs from the practice workspace. Linked positions, inquiries, works, and sources will remain.`}
        confirmLabel="Delete Practice"
        alternateLabel="Abandon instead"
        destructive
        onAlternate={async () => {
          if (!deleteTarget) return;
          await onUpdatePractice({ ...deleteTarget, status: 'abandoned', dateUpdated: new Date().toISOString() });
          if (focusedPracticeId === deleteTarget.id) onOpenPracticeRoute?.(null);
          setDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await onDeletePractice(deleteTarget.id);
          setDeleteTarget(null);
          if (focusedPracticeId === deleteTarget.id) onOpenPracticeRoute?.(null);
        }}
      />
    </div>
  );
}

function ActiveLoopGroup({ title, practices, questions, positions, onEdit, onDelete, onUpdatePractice }: {
  title: string;
  practices: Practice[];
  questions: Question[];
  positions: VaultEntry[];
  onEdit: (practice?: Practice) => void;
  onDelete: (practice: Practice) => void;
  onUpdatePractice: (practice: Practice) => void;
}) {
  if (!practices.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">{title}</span>
        <span className="h-px flex-1 bg-border/60" />
        <Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{practices.length}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {practices.map((practice) => (
          <PracticeCard
            key={`${title}-${practice.id}`}
            practice={practice}
            questions={questions}
            positions={positions}
            onEdit={() => onEdit(practice)}
            onDelete={() => onDelete(practice)}
            onUpdatePractice={onUpdatePractice}
            onCreateLink={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

function PracticeCard({ practice, questions, positions, onEdit, onDelete, onUpdatePractice: persistPractice, onCreateLink, compact = false }: {
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
  const experimentShape = practiceExperimentShape(practice, linkedQuestions, linkedPositions);
  const needsLog = practiceNeedsLog(practice);
  const recentlyConcluded = practiceRecentlyConcluded(practice);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logDraft, setLogDraft] = useState<Partial<PracticeLog>>({ actionCompleted: true, confidence: 3 });
  const [reviewDraft, setReviewDraft] = useState({
    performedAsIntended: practice.conclusion?.performedAsIntended || '',
    whatHappened: practice.conclusion?.whatHappened || practice.observedOutcome || practice.notes || '',
    hypothesisSupported: practice.conclusion?.hypothesisSupported || '',
    alternativeExplanation: practice.conclusion?.alternativeExplanation || practice.alternativeExplanation || '',
    intellectualChange: practice.conclusion?.intellectualChange || practice.effectOnPosition || '',
    shouldContinue: practice.conclusion?.shouldContinue || '',
  });
  const { toast } = useToast();
  const saving = React.useRef(false);
  const onUpdatePractice = async (next: Practice) => {
    if (saving.current) return false;
    saving.current = true;
    try { await persistPractice(next); return true; }
    catch { toast({ title: 'Practice not saved', description: 'Your input is retained. Please try again.', variant: 'destructive' }); return false; }
    finally { saving.current = false; }
  };
  const setStatus = (status: PracticeStatus) => onUpdatePractice({ ...practice, status, dateUpdated: today() });
  const visibleType = normalizePracticeType(practice.type);
  const method = praxisShapeFor(practicePraxisMethod(practice.type) === 'experiments' ? 'experiment' : 'habit');
  const visibleStatus = normalizePracticeStatus(practice.status);
  const scheduleState = practiceScheduleState(practice);
  const durationText = practice.durationMode === 'open_ended' ? 'Open ended'
    : practice.durationMode === 'one_time' ? 'One-time action'
    : practice.durationDays ? `${logDates.length} of ${practice.durationDays} days logged`
    : 'Cadence unset';
  const setupNeed = isPracticeConcluded(practice) ? '' : !experimentShape.hasBasis
    ? 'Needs basis: link the idea, position, or inquiry this tests.'
    : experimentShape.designGaps.length
      ? `Needs setup: add ${experimentShape.designGaps[0]}.`
      : '';
  const canActivate = !setupNeed;
  const openLog = () => {
    if (canActivate) setLogOpen(true);
    else onEdit();
  };
  const nextAction =
    setupNeed ? { label: 'Finish setup', handler: onEdit, tone: 'setup' as const } :
    visibleStatus === 'planned' || visibleStatus === 'paused'
      ? { label: visibleStatus === 'paused' ? 'Resume' : 'Start', handler: () => setStatus('active'), tone: 'start' as const } :
    scheduleState === 'scheduled'
      ? { label: 'View schedule', handler: onEdit, tone: 'open' as const } :
    scheduleState === 'review' || experimentShape.needsOutcome || experimentShape.needsConsequence
      ? { label: 'Review evidence', handler: () => setReviewOpen(true), tone: 'review' as const } :
    visibleStatus === 'completed'
      ? { label: 'View conclusion', handler: () => setReviewOpen(true), tone: 'review' as const } :
    visibleStatus === 'active'
      ? { label: needsLog ? 'Log today' : 'Add observation', handler: openLog, tone: 'log' as const } :
      { label: 'View record', handler: onEdit, tone: 'open' as const };
  const saveLog = async () => {
    if (!canActivate) {
      onEdit();
      return;
    }
    if (visibleType !== 'habit' && ![logDraft.outcome, logDraft.observations].some((value) => value?.trim())) return;
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
    if (date > todayKey) {
      toast({ title: 'Choose today or an earlier date', description: 'An observation records what has already happened.', variant: 'destructive' });
      return;
    }
    if (!await onUpdatePractice(appendPracticeObservation(practice, nextLog, today()))) return;
    setLogDraft({ actionCompleted: true, confidence: 3 });
    setLogOpen(false);
  };
  // One-tap check-in, as in the prototype: today's log, kept or missed.
  const quickCheckIn = async (kept: boolean) => {
    const nextLog: PracticeLog = { id: uid(), date: todayKey, actionCompleted: kept, context: '', outcome: kept ? 'Kept' : 'Missed', observations: '', unexpectedResult: '', confidence: 3, mediaIds: [] };
    if (await onUpdatePractice(appendPracticeObservation(practice, nextLog, today()))) toast({ title: kept ? 'Checked in: kept' : 'Checked in: missed', description: 'Add an observation any time from the card.' });
  };
  const saveConclusionReview = async (status: PracticeStatus = 'completed') => {
    if (!reviewDraft.whatHappened.trim()) return;
    if (!await onUpdatePractice({
      ...practice,
      status,
      conclusion: reviewDraft,
      observedOutcome: reviewDraft.whatHappened.trim(),
      interpretation: reviewDraft.hypothesisSupported.trim(),
      alternativeExplanation: reviewDraft.alternativeExplanation.trim(),
      effectOnPosition: reviewDraft.intellectualChange.trim(),
      notes: reviewDraft.whatHappened.trim(),
      dateUpdated: today(),
    })) return;
    setReviewOpen(false);
  };
  return (
    <Card role="group" aria-label={`Practice: ${practice.title}`} tabIndex={0} onClick={(event) => {
      if (!isEntitySurfaceClick(event)) return;
      onEdit();
    }} onKeyDown={(event) => {
      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onEdit(); }
    }} className={cn("noesis-praxis-card group cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "p-3" : "p-4")} data-stage-tone={method.tone}>
      <div className={cn("flex flex-col gap-3", compact && "lg:flex-row lg:items-center lg:justify-between")}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <Badge variant="secondary" className="noesis-eyebrow noesis-eyebrow--sm bg-muted/20 border-transparent text-muted-foreground/80 rounded-full font-bold px-2.5 py-0.5 shadow-sm">{simplifiedTypeLabels[visibleType]}</Badge>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full px-2.5 py-0.5 noesis-eyebrow noesis-eyebrow--sm font-bold',
                setupNeed ? 'border-border bg-muted text-foreground' :
                  recentlyConcluded ? 'border-accent/30 bg-accent/5 text-accent' :
                    needsLog ? 'border-accent/40 bg-accent/10 text-accent' :
                      'border-border/60 bg-card text-muted-foreground',
              )}
            >
              {setupNeed ? 'Needs setup' : scheduleState === 'scheduled' ? 'Scheduled' : scheduleState === 'review' || recentlyConcluded ? 'Review result' : needsLog ? 'Log due' : visibleStatus}
            </Badge>
          </div>
          <div className="flex items-start gap-2.5" data-stage-tone={method.tone}>
            <PraxisMethodShape shape={method.shape} className="mt-1" title={method.intent} />
            <h3 className="font-headline text-lg font-bold italic leading-tight group-hover:text-accent transition-colors text-primary whitespace-normal break-words">{practice.title}</h3>
          </div>
          <p className="mt-1 text-[12px] italic leading-5 text-muted-foreground whitespace-normal">
            {practice.action || practice.description || 'No action defined yet.'}
            {visibleType === 'experiment' && practice.hypothesis && <span className="mt-1 block not-italic"><strong>Prediction:</strong> {practice.hypothesis}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant={nextAction.tone === 'open' ? 'outline' : 'default'} onClick={(event) => { event.stopPropagation(); void nextAction.handler(); }} className="h-10 rounded-full px-4">
            {nextAction.tone === 'log' ? <CheckCircle2 className="size-4" /> : nextAction.tone === 'start' ? <Play className="size-4" /> : nextAction.tone === 'review' ? <ClipboardList className="size-4" /> : nextAction.tone === 'open' ? <Eye className="size-4" /> : <Edit className="size-4" />} {nextAction.label}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${practice.title}`} className="size-10"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Edit className="mr-2 size-4" /> Edit practice</DropdownMenuItem>
              {visibleStatus === 'active' && <DropdownMenuItem onSelect={() => setStatus('paused')}><PauseCircle className="mr-2 size-4" /> Pause</DropdownMenuItem>}
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 size-4" /> Delete practice</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {!compact && (
        <div className="noesis-praxis-stats" data-stage-tone={method.tone}>
          {logDates.length > 0 && <details className="col-span-full text-sm">
            <summary className="min-h-8 cursor-pointer">{logDates.length} check-ins · Calendar</summary>
            <div className="noesis-praxis-grid"><PraxisDayStrip shape={method.shape} logDates={logDates} missedDates={(practice.logs || []).filter(log => log.actionCompleted === false).map(log => log.date)} days={practice.durationDays} startDate={practice.startDate} size={16} /></div>
          </details>}
          {visibleType === 'habit' && needsLog && canActivate && (
            <div className="noesis-praxis-checkin" role="group" aria-label={`Check in on ${practice.title} for today`}>
              <span>Check in</span>
              <button type="button" onClick={() => void quickCheckIn(true)}>Kept</button>
              <button type="button" onClick={() => void quickCheckIn(false)}>Missed</button>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/30 pt-3 text-[11px] leading-5 text-muted-foreground">
        <span className="min-w-0 max-w-xl truncate italic text-primary/80">{practice.intellectualBasis || firstLinkedPosition?.title || linkedQuestions[0]?.text}</span>
        <span className="noesis-eyebrow noesis-eyebrow--sm">{durationText}</span>
        <span className="noesis-eyebrow noesis-eyebrow--sm">{experimentShape.logCount} {experimentShape.logCount === 1 ? 'log' : 'logs'}</span>
        {setupNeed && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] leading-4 text-foreground">{setupNeed}</span>
        )}
      </div>

      {logOpen && (
        <div className="mt-5 rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-accent">Observation Log</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {visibleType === 'habit' ? 'Mark whether you did it today. Add a note only when something matters.' : visibleType === 'reflection' ? 'Write what you noticed or understood during this reflection.' : visibleType === 'observation' ? 'Record what you observed, even if the expected pattern did not appear.' : 'Record what happened and how it compares with your hypothesis.'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLogOpen(false)} className="h-7 rounded-full px-2.5 noesis-eyebrow noesis-eyebrow--sm">Hide</Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="DATE">
              <Input type="date" max={todayKey} value={logDraft.date || todayKey} onChange={(event) => setLogDraft((prev) => ({ ...prev, date: event.target.value }))} className="h-10 rounded-full bg-card font-code text-xs" />
            </Field>
            <div className="self-end text-xs text-muted-foreground">{logDates.length} completed {logDates.length === 1 ? 'log' : 'logs'} recorded</div>
            <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm font-medium text-foreground sm:col-span-2">
              <input
                type="checkbox"
                checked={logDraft.actionCompleted ?? true}
                onChange={(event) => setLogDraft((prev) => ({ ...prev, actionCompleted: event.target.checked }))}
                className="size-4 accent-accent"
              />
              Action completed as intended
            </label>
            <Field label={visibleType === 'habit' ? 'NOTE (OPTIONAL)' : visibleType === 'reflection' ? 'WHAT DID YOU REALIZE?' : visibleType === 'observation' ? 'WHAT DID YOU NOTICE?' : 'WHAT HAPPENED?'}>
              <Textarea value={logDraft.outcome || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, outcome: event.target.value }))} placeholder={visibleType === 'habit' ? 'What helped or got in the way?' : 'Record the result in your own words.'} className="min-h-20 bg-card" />
            </Field>
            <details className="rounded-xl border border-border/60 bg-card p-3 sm:col-span-2">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Add context or an unexpected result</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="CONTEXT"><Textarea value={logDraft.context || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, context: event.target.value }))} placeholder="When, where, under what conditions?" className="min-h-20 bg-card" /></Field>
                <Field label="OBSERVATIONS"><Textarea value={logDraft.observations || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, observations: event.target.value }))} placeholder="What else did you notice?" className="min-h-20 bg-card" /></Field>
                <Field label="UNEXPECTED RESULT"><Textarea value={logDraft.unexpectedResult || ''} onChange={(event) => setLogDraft((prev) => ({ ...prev, unexpectedResult: event.target.value }))} placeholder="What surprised you?" className="min-h-20 bg-card" /></Field>
              </div>
            </details>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setLogOpen(false)} className="h-8 rounded-full bg-card">Cancel</Button>
            <Button size="sm" onClick={saveLog} disabled={visibleType !== 'habit' && ![logDraft.outcome, logDraft.observations].some((value) => value?.trim())} className="h-8 rounded-full">Save log</Button>
          </div>
        </div>
      )}

      {reviewOpen && (
        <div className="mt-5 noesis-recommendation">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-accent">Conclusion Review</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Compare theory versus reality before this practice changes what you believe.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReviewOpen(false)} className="h-7 rounded-full px-2.5 noesis-eyebrow noesis-eyebrow--sm">Hide</Button>
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
            className="mt-3 min-h-24 rounded-xl bg-card"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Textarea value={reviewDraft.performedAsIntended} onChange={(event) => setReviewDraft((prev) => ({ ...prev, performedAsIntended: event.target.value }))} placeholder="Was the practice performed as intended?" className="min-h-20 rounded-xl bg-card" />
            <Textarea value={reviewDraft.hypothesisSupported} onChange={(event) => setReviewDraft((prev) => ({ ...prev, hypothesisSupported: event.target.value }))} placeholder="Was the hypothesis supported, weakened, or complicated?" className="min-h-20 rounded-xl bg-card" />
            <Textarea value={reviewDraft.alternativeExplanation} onChange={(event) => setReviewDraft((prev) => ({ ...prev, alternativeExplanation: event.target.value }))} placeholder="What alternative explanation exists?" className="min-h-20 rounded-xl bg-card" />
            <Textarea value={reviewDraft.intellectualChange} onChange={(event) => setReviewDraft((prev) => ({ ...prev, intellectualChange: event.target.value }))} placeholder="What changed intellectually?" className="min-h-20 rounded-xl bg-card" />
            <Textarea value={reviewDraft.shouldContinue} onChange={(event) => setReviewDraft((prev) => ({ ...prev, shouldContinue: event.target.value }))} placeholder="Should this continue, revise, integrate, or stop?" className="min-h-20 rounded-xl bg-card sm:col-span-2" />
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

function PracticeEditor({ aiSettings, open, onOpenChange, draft, setDraft, concepts, media, questions, positions, drafts, onAddConcept, onRecordLog, onSaveAiOutcome, onSaveAiHistory, onSave, busy, onOpenPosition, onAddQuestion, onOpenWorks }: {
  onOpenPosition?: (id: string) => void;
  onAddQuestion?: (data: Partial<Question>) => unknown;
  onOpenWorks?: () => void;
  busy: boolean;
  aiSettings: import('@/lib/types').AiSettings;
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
  onRecordLog: (log: PracticeLog) => Promise<void>;
  onSaveAiOutcome: (result: AiReviewResult, content: string) => void | Promise<void>;
  onSaveAiHistory: (entries: NonNullable<Practice['aiReviewHistory']>) => void | Promise<void>;
  onSave: () => void;
}) {
  const [observation, setObservation] = useState('');
  const [completed, setCompleted] = useState(true);
  const [logging, setLogging] = useState(false);
  const logLock = React.useRef(false);
  const { toast } = useToast();
  React.useEffect(() => {
    setObservation('');
    setCompleted(true);
  }, [draft.id]);
  const schedule = practiceScheduleState(draft);
  const savedReviews = resolvedAiHistory(draft.aiReviewHistory, {
    id: 'legacy-outcome-review', action: 'synthesize_practice_outcome', title: 'Outcome review',
    content: draft.aiOutcomeReview || '', date: draft.dateUpdated || draft.endDate || '',
  });
  const readyToLog = Boolean(draft.id && schedule === 'running' && practiceDesignGaps(draft).length === 0 && hasPracticeBasis(draft as Practice));
  const recordObservation = async () => {
    if (logLock.current || !readyToLog || !observation.trim()) return;
    logLock.current = true;
    setLogging(true);
    try {
      await onRecordLog({ id: uid(), date: dateKey(), actionCompleted: completed, outcome: observation.trim() });
      setObservation('');
      toast({ title: 'Observation saved' });
    } catch {
      toast({ title: 'Observation not saved', description: 'Your note is still here. Please retry.', variant: 'destructive' });
    } finally {
      logLock.current = false;
      setLogging(false);
    }
  };
  // The practice itself is a record, so an existing one opens as a page with
  // its own path (Action · Run · Review · Carry forward). Only a brand-new
  // practice is a dialog, the same as adding an inquiry or a position.
  const asPage = Boolean(draft.id);
  const noun = isRepeatablePractice(draft.type) ? 'practice' : 'experiment';
  const aiPanel = (
    <ContextualAiPanel
      enabled={Boolean(
        aiSettings.aiAssistanceEnabled
        && draft.id
        && isPracticeConcluded(draft as Practice)
        && ((draft.logs?.length || 0) > 0 || draft.observedOutcome?.trim())
      )}
      showContextBeforeSending={aiSettings.showContextBeforeSending}
      reasoningDepth={aiDepthFor(aiSettings, 'praxis')}
      actions={['synthesize_practice_outcome']}
      buttonLabel="Outcome review"
      promptLabel="What should Noesis examine?"
      promptPlaceholder="For example: Did the logs support my hypothesis, or is there a better explanation?"
      buildEnvelope={() => ({
        action: 'synthesize_practice_outcome',
        scope: 'linked_items',
        targetType: 'practice',
        targetId: draft.id || '',
        itemMemory: [
          `Practice: ${draft.title || 'Untitled'}`,
          `Status: ${draft.status || 'planned'}; type: ${draft.type || 'experiment'}; duration: ${draft.durationDays || 0} days`,
          draft.intellectualBasis ? `Intellectual basis: ${draft.intellectualBasis}` : '',
          draft.hypothesis ? `Hypothesis: ${draft.hypothesis}` : '',
          draft.action ? `Action performed: ${draft.action}` : '',
          draft.context ? `Planned context: ${draft.context}` : '',
          draft.observationMethod ? `Observation method: ${draft.observationMethod}` : '',
          draft.expectedOutcome ? `Expected: ${draft.expectedOutcome}` : '',
          draft.observedOutcome ? `Observed: ${draft.observedOutcome}` : '',
          draft.interpretation ? `Interpretation: ${draft.interpretation}` : '',
          draft.alternativeExplanation ? `User's alternative explanation: ${draft.alternativeExplanation}` : '',
          draft.effectOnPosition ? `Recorded intellectual effect: ${draft.effectOnPosition}` : '',
          ...(draft.logs || []).slice(-10).map((log) => [
            `Log ${log.date}`,
            `performed: ${log.actionCompleted ? 'yes' : 'no'}`,
            log.context ? `context: ${log.context}` : '',
            log.observations ? `observations: ${log.observations}` : '',
            log.outcome ? `outcome: ${log.outcome}` : '',
            log.unexpectedResult ? `unexpected: ${log.unexpectedResult}` : '',
            log.confidence != null ? `confidence: ${log.confidence}/5` : '',
          ].filter(Boolean).join('; ')),
        ].filter(Boolean),
        linkedMemory: [
          ...positions.filter((position) => (draft.positionIds || []).includes(position.id)).slice(0, 4).map((position) => `Position: ${position.statement || position.title}; confidence ${position.confidence}%; support ${position.evidenceFor?.length || 0}; challenges ${position.evidenceAgainst?.length || 0}`),
          ...questions.filter((question) => (draft.questionIds || []).includes(question.id)).slice(0, 4).map((question) => `Inquiry: ${question.text}; status ${question.status}; current answer ${question.answer || 'none'}; uncertainty ${question.uncertainty || 'not recorded'}`),
          ...media.filter((source) => (draft.sourceIds || []).includes(source.id)).slice(0, 3).map((source) => `Source: ${source.title}${source.creator ? ` by ${source.creator}` : ''}; engagement ${(source.capture?.after?.coreArgument || source.capture?.after?.lasting || source.description || 'none recorded').slice(0, 400)}`),
          ...drafts.filter((work) => (draft.draftIds || []).includes(work.id)).slice(0, 3).map((work) => `Work: ${work.title}; status ${work.status || 'not recorded'}; excerpt ${(work.body || work.draftContent || '').slice(0, 300) || 'none recorded'}`),
        ],
      })}
      onAccept={onSaveAiOutcome}
    />
  );
  const path = (
    <>
      {draft.id && (() => {
        const checkIn = async (kept: boolean) => {
          try {
            await onRecordLog({ id: uid(), date: dateKey(), actionCompleted: kept, outcome: kept ? 'Kept' : 'Missed' });
            toast({ title: kept ? 'Checked in' : 'Recorded as missed' });
          } catch {
            toast({ title: 'Check-in not saved', description: 'Please retry.', variant: 'destructive' });
          }
        };
        return (
          <div className="grid gap-3 pb-3">
            <PraxisInstrument practice={draft} positions={positions} questions={questions} onCheckIn={schedule === 'running' ? (kept) => void checkIn(kept) : undefined} onOpenPosition={onOpenPosition} />
          </div>
        );
      })()}
      {draft.id && (() => {
        const logs = draft.logs || [];
        const reviewed = Boolean(draft.observedOutcome?.trim());
        const here = !draft.action?.trim() ? 'prx-action'
          : practiceScheduleState(draft) === 'review' || reviewed ? 'prx-review'
            : logs.length ? 'prx-run'
              : 'prx-run';
        const guide = !draft.action?.trim() ? 'Name the action in a sentence.'
          : practiceScheduleState(draft) === 'review' && !reviewed ? 'The run is over: say what you expected and what happened.'
            : reviewed ? 'Reviewed. Carry what it shows back to a position, or write about it in Works.'
              : logs.length ? `${logs.length} log${logs.length === 1 ? '' : 's'} recorded. Keep going, then review.`
                : 'Do the action, then log what happened.';
        return <RecordPath label="Where you are with this practice" hereId={here} guide={guide}
          stops={[{ id: 'prx-action', label: 'Action' }, { id: 'prx-run', label: 'Run' }, { id: 'prx-review', label: 'Review' }, { id: 'prx-carry', label: 'Carry forward' }]} />;
      })()}
    </>
  );
  const sections = (
    <div className="space-y-6">
      <RecordSection id="prx-action" title="Action" description="What you will actually do, and why it is worth doing." headingLevel="h3">
      <Field label="PRACTICE TITLE"><Input value={draft.title || ''} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="italic text-base rounded-full" /></Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Field label="WHAT YOU WILL DO"><Textarea value={draft.action || ''} onChange={(event) => setDraft((prev) => ({ ...prev, action: event.target.value }))} className="min-h-[100px] italic text-base" placeholder={isRepeatablePractice(draft.type) ? "For example: Take a ten-minute walk after work without my phone." : "What will you do or observe?"} /></Field>
        <Field label={isRepeatablePractice(draft.type) ? "REASON (OPTIONAL)" : "LINKED IDEA / REASON"}><Textarea value={draft.intellectualBasis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, intellectualBasis: event.target.value }))} className="min-h-[100px] italic text-base" placeholder={isRepeatablePractice(draft.type) ? "What would make this action worthwhile?" : "What idea or question is this testing?"} /></Field>
      </div>
      <Field label="WHY THIS EXISTS (OPTIONAL)"><Textarea value={draft.description || ''} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-[72px] italic text-base" placeholder="Add context only if the action and linked idea do not explain the purpose." /></Field>
      <details className="rounded-2xl border border-border/50 bg-muted/10 p-4">
        <summary className="cursor-pointer noesis-eyebrow font-bold text-muted-foreground">Schedule and setup</summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="PRACTICE TYPE">
            <Select value={draft.type || 'experiment'} onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as PracticeType }))}>
              <SelectTrigger className="rounded-full bg-card border-border/60 shadow-sm noesis-eyebrow h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{practiceTypes.map((type) => <SelectItem key={type} value={type} className="noesis-eyebrow">{PRACTICE_LABELS[type]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="STATUS">
            <Select value={draft.status || 'planned'} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as PracticeStatus }))}>
              <SelectTrigger className="rounded-full bg-card border-border/60 shadow-sm noesis-eyebrow h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className="noesis-eyebrow">{status}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="DURATION MODE">
            <Select value={draft.durationMode || 'repeated'} onValueChange={(value) => setDraft((prev) => ({ ...prev, durationMode: value as Practice['durationMode'] }))}>
              <SelectTrigger className="rounded-full bg-card border-border/60 shadow-sm noesis-eyebrow h-11"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="one_time">One time</SelectItem><SelectItem value="repeated">Repeated</SelectItem><SelectItem value="open_ended">Open ended</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="DURATION (DAYS)"><Input type="number" min={0} value={draft.durationDays || 0} onChange={(event) => setDraft((prev) => ({ ...prev, durationDays: Math.max(0, Number(event.target.value) || 0) }))} className="font-code rounded-full" /></Field>
          <Field label="START DATE"><Input type="date" value={practiceCalendarDate(draft.startDate)} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
          <Field label="END DATE (EXPECTED)"><Input type="date" value={practiceCalendarDate(draft.endDate)} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
          <Field label="HYPOTHESIS"><Textarea value={draft.hypothesis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, hypothesis: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="If I do this, what do I expect to happen or discover?" /></Field>
          <Field label="CONTEXT"><Textarea value={draft.context || ''} onChange={(event) => setDraft((prev) => ({ ...prev, context: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="When, where, with whom, and under what conditions?" /></Field>
          <Field label="OBSERVATION METHOD"><Textarea value={draft.observationMethod || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observationMethod: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="How will you know what happened without overstating the evidence?" /></Field>
          <Field label="EXPECTED OUTCOME"><Textarea value={draft.expectedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, expectedOutcome: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What would support, weaken, or complicate the hypothesis?" /></Field>
          <Field label="GENERAL NOTES"><Textarea value={draft.notes || ''} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="Optional working notes." /></Field>
          <Field label="CONCEPTS TESTED"><ConceptTagPicker concepts={concepts} value={draft.conceptTags || []} onChange={(conceptTags) => setDraft((prev) => ({ ...prev, conceptTags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} /></Field>
        </div>
      </details>
      </RecordSection>
      <RecordSection id="prx-run" title="Run and log" description="Do it, then record what happened while it is fresh." headingLevel="h3">
        <section>
          <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">Current action</div>
          <p className="mt-2 text-base leading-7 text-foreground">{draft.action || 'Define the action in Design before beginning this practice.'}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-border/50 py-3">
            <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1 text-sm font-semibold capitalize">{draft.status || 'planned'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Logs</dt><dd className="mt-1 text-sm font-semibold">{draft.logs?.length || 0}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Schedule</dt><dd className="mt-1 text-sm font-semibold">{draft.durationMode === 'one_time' ? 'One time' : draft.durationMode === 'open_ended' ? 'Open ended' : `${draft.durationDays || 0} days`}</dd></div>
          </dl>
          {readyToLog ? <div className="mt-5 space-y-4 border-t border-border/50 pt-4">
            <Field label="WHAT HAPPENED?"><Textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="What did you do or notice? An unexpected result is useful too." className="min-h-28 text-base leading-7" /></Field>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} className="size-5 accent-accent" />I completed the action</label>
            <Button type="button" onClick={recordObservation} disabled={logging || !observation.trim()} className="min-h-11">{logging ? 'Saving…' : 'Save observation'}</Button>
            {(draft.logs || []).slice(-3).reverse().map((log) => <div key={log.id} className="border-t border-border/40 pt-3"><div className="text-xs text-muted-foreground">{new Date(`${log.date.slice(0, 10)}T12:00:00`).toLocaleDateString()} · {log.actionCompleted ? 'Completed' : 'Not completed'}</div><p className="mt-1 text-sm leading-6">{log.outcome || log.observations}</p></div>)}
          </div> : <div className="mt-4"><p className="text-sm text-muted-foreground">{schedule === 'review' ? 'The scheduled period has ended. Review the result or adjust the schedule.' : schedule === 'scheduled' ? `This practice starts on ${draft.startDate}.` : draft.id && draft.status !== 'active' ? 'Complete setup and save this practice as active before logging.' : isRepeatablePractice(draft.type) ? 'Save the action as active before logging.' : 'Save the action, hypothesis, observation method, and success signal before logging.'}</p></div>}
        </section>
      </RecordSection>
      <RecordSection id="prx-review" title="Review" description="What you expected, beside what happened. Kept apart so the two can be compared." headingLevel="h3">
        <Dictation label="Dictate the review" hint="Dictates into the box you last typed in: what you expected, or what happened.">
          <div className="noesis-pair">
            <Field label="WHAT YOU EXPECTED"><Textarea value={draft.expectedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, expectedOutcome: event.target.value }))} className="min-h-[110px] italic text-base" placeholder="Before you began: what did you think would happen?" /></Field>
            <Field label="WHAT HAPPENED"><Textarea value={draft.observedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observedOutcome: event.target.value }))} className="min-h-[110px] italic text-base" placeholder="What actually happened?" /></Field>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="INTERPRETATION"><Textarea value={draft.interpretation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, interpretation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What do you think the result means?" /></Field>
            <Field label="ALTERNATIVE EXPLANATION"><Textarea value={draft.alternativeExplanation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, alternativeExplanation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What else could explain the result?" /></Field>
            <Field label="EFFECT ON POSITION"><Textarea value={draft.effectOnPosition || ''} onChange={(event) => setDraft((prev) => ({ ...prev, effectOnPosition: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What position, inquiry, or concept should change because of this?" /></Field>
          </div>
          {savedReviews.length > 0 && (
            <div className="mt-5">
              <AiAssistedHistory
                title="Saved outcome reviews"
                entries={savedReviews.map((entry) => ({
                  ...entry,
                  originDetails: draft.id && entry.id.startsWith('ai-review-') ? {
                    provenance: { provenanceId: entry.id, kind: 'ai-assisted' },
                    target: practiceReviewTarget(draft.id, entry.id),
                  } : undefined,
                }))}
                onChange={onSaveAiHistory}
              />
            </div>
          )}
        </Dictation>
      </RecordSection>
      <RecordSection id="prx-carry" title="Carry forward" description="Where this result should land: the sources, inquiries, positions, and works it bears on." headingLevel="h3">
        {draft.id && <PraxisCarryCards draft={draft} positions={positions} onOpenPosition={onOpenPosition} onAddQuestion={onAddQuestion} onOpenWorks={onOpenWorks} />}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
          <LinkGrid title="Linked Sources" items={media.map((item) => ({ id: item.id, label: item.title }))} selected={draft.sourceIds || []} onChange={(sourceIds) => setDraft((prev) => ({ ...prev, sourceIds }))} />
          <LinkGrid title="Linked Inquiries" items={questions.map((item) => ({ id: item.id, label: item.text }))} selected={draft.questionIds || []} onChange={(questionIds) => setDraft((prev) => ({ ...prev, questionIds }))} />
          <LinkGrid title="Linked Positions" items={positions.map((item) => ({ id: item.id, label: item.title }))} selected={draft.positionIds || []} onChange={(positionIds) => setDraft((prev) => ({ ...prev, positionIds }))} />
          <LinkGrid title="Linked Works" items={drafts.map((item) => ({ id: item.id, label: item.title }))} selected={draft.draftIds || []} onChange={(draftIds) => setDraft((prev) => ({ ...prev, draftIds }))} />
        </div>
      </RecordSection>
    </div>
  );
  const saveBar = (
    <div className="flex shrink-0 justify-end gap-3 border-t bg-muted/10 p-4 sm:px-8 [@media(max-height:600px)]:py-2">
      <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-11 px-8 rounded-full font-bold text-muted-foreground hover:bg-transparent">Cancel</Button>
      <Button onClick={onSave} disabled={busy || !draft.title?.trim()}>{busy ? 'Saving…' : draft.id ? 'Save practice' : 'Create practice'}</Button>
    </div>
  );

  if (asPage) {
    if (!open) return null;
    return (
      <RecordPage tone="act" identity={noun} className="noesis-page">
        <RecordHeader
          backLabel={`Back to ${noun}s`}
          onBack={() => onOpenChange(false)}
          view="Praxis"
          kind={noun}
          status={<Badge tone={schedule === 'review' ? 'caution' : schedule === 'running' ? 'practice' : 'neutral'}>{schedule === 'review' ? 'ready to review' : schedule}</Badge>}
          title={draft.title?.trim() || `Untitled ${noun}`}
          subtitle={draft.action?.trim() || undefined}
          trailing={(
            <div className="flex flex-wrap items-center gap-2">
              {aiPanel}
              <Button onClick={onSave} disabled={busy || !draft.title?.trim()}>{busy ? 'Saving…' : `Save ${noun}`}</Button>
            </div>
          )}
        />
        {path}
        <fieldset disabled={busy} className="min-w-0 border-0 p-0">
          {sections}
        </fieldset>
      </RecordPage>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(88dvh,56rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-card border-none shadow-2xl rounded-2xl p-0 sm:p-0 max-sm:h-[calc(100dvh-1rem)] max-sm:w-[calc(100vw-1rem)] max-sm:max-w-none [@media(max-height:600px)]:h-[calc(100dvh-1rem)]">
        <div className="border-b px-4 pt-4 sm:px-8 sm:pt-6 [@media(max-height:600px)]:pt-2">
          <DialogHeader className="mb-3 text-left [@media(max-height:600px)]:mb-1">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <DialogTitle className="font-headline text-2xl italic sm:text-3xl [@media(max-height:600px)]:text-xl">New {noun}</DialogTitle>
              {aiPanel}
            </div>
            <DialogDescription className="[@media(max-height:600px)]:hidden">
              Define the action, evidence, and review conditions that make this {noun} a useful test of your thinking.
            </DialogDescription>
          </DialogHeader>
        </div>
        <fieldset disabled={busy} className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 sm:px-8 sm:py-5">
          {sections}
        </fieldset>
        {saveBar}
      </DialogContent>
    </Dialog>
  );
}

/**
 * What this practice should feed next, offered only when the record says
 * something specific: a position it bears on, a question its surprise raises,
 * and, once there is a result, writing about the experience in Works.
 */
function PraxisCarryCards({ draft, positions, onOpenPosition, onAddQuestion, onOpenWorks }: {
  draft: Partial<Practice>;
  positions: VaultEntry[];
  onOpenPosition?: (id: string) => void;
  onAddQuestion?: (data: Partial<Question>) => unknown;
  onOpenWorks?: () => void;
}) {
  const { toast } = useToast();
  const tested = positions.filter((position) => (draft.positionIds || []).includes(position.id));
  const result = draft.observedOutcome?.trim();
  const expected = draft.expectedOutcome?.trim();
  const logs = draft.logs || [];
  const suggestions: Suggestion[] = [];
  if (result && onOpenWorks) {
    suggestions.push({
      id: 'write-works', tone: 'work', title: 'Write about your experience',
      quote: `What ${draft.title?.trim() || 'this practice'} showed me, and what I now think because of it.`,
      because: 'You have a result. Works is where it becomes something you can read back.',
      actionLabel: 'Open Works', onAction: onOpenWorks,
    });
  }
  if (result && expected && onAddQuestion && draft.id) {
    suggestions.push({
      id: 'surprise', tone: 'inquiry', title: 'A question worth asking',
      quote: `Why did “${result.slice(0, 70)}” happen when I expected “${expected.slice(0, 70)}”?`,
      because: 'From the gap between what you expected and what happened.',
      actionLabel: 'Open as an inquiry',
      onAction: () => { void Promise.resolve(onAddQuestion({ text: `Why did "${result.slice(0, 90)}" happen when I expected "${expected.slice(0, 90)}"?`, status: 'open', practiceIds: [draft.id as string], beliefIds: draft.positionIds || [], sourceIds: draft.sourceIds || [], conceptIds: [], evidenceIds: [] })).then(() => toast({ title: 'Inquiry opened' })); },
    });
  }
  if (tested[0] && logs.length >= 3 && onOpenPosition) {
    suggestions.push({
      id: 'revisit', tone: 'position', title: 'Revisit a position',
      quote: tested[0].title,
      because: `You have ${logs.length} logs on a practice that tests it. Its confidence may need to move.`,
      actionLabel: 'Open the position', onAction: () => onOpenPosition(tested[0].id),
    });
  }
  return <SuggestionCards suggestions={suggestions} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <LabeledField label={label.charAt(0) + label.slice(1).toLocaleLowerCase()}>{children}</LabeledField>;
}

function LinkGrid({ title, items, selected, onChange }: { title: string; items: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <Field label={title}>
      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card p-4 shadow-inner">
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
