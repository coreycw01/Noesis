
"use client";

import { aiDepthFor } from '@/lib/ai-depth';
import React, { useMemo, useState } from 'react';
import { useLocalDay } from '@/hooks/use-local-day';
import { CheckCircle2, ClipboardList, Edit, Eye, MoreHorizontal, PauseCircle, Play, Trash2 } from 'lucide-react';
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
import { appendPracticeObservation, changePracticeCheckIn, type PracticeCheckInEdit, type PracticeCheckInWrite } from '@/lib/practice-observations';
import { localDateKey as dateKey } from '@/lib/calendar';
import { completedPracticeResult, isPracticeConcluded, practiceCalendarDate, practiceLogDates, practiceNeedsConsequence, practiceNeedsLog, practiceNeedsOutcome, practicePraxisMethod, practiceRecentlyConcluded, practiceReviewDestination, practiceScheduleState } from '@/lib/practice-state';
import { DeskFindings } from '@/components/ai/DeskFindings';
import { ToastAction } from '@/components/ui/toast';
import { LabeledField } from '@/components/shared/LabeledField';
import { cn } from '@/lib/utils';
import { activateEntityOnKey, isEntitySurfaceClick } from '@/lib/entity-activation';
import { NOESIS_ICONS, PRAXIS_METHOD_ICONS } from '@/lib/noesis-icons';

const PracticeIcon = NOESIS_ICONS.practice;
import { StageBadge } from '@/components/shared/StageBadge';
import { FilterToolbar, SortPill, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { COLLECTION_SORT_OPTIONS, sortCollection, type CollectionOrder } from '@/lib/collection-sort';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { AiCreationHistory } from '@/components/ai/AiCreationHistory';
import { deskExperimentCreationRef } from '@/lib/context-desk-handoff';
import { itemAiHistory } from '@/lib/item-ai-history';
import { resolvedAiHistory, type AiReviewResult } from '@/lib/contextual-ai';
import { practiceReviewTarget, type PracticeReviewApproval } from '@/lib/practice-ai-review';
import { FooterSection, OptionalRecordActions, RecordFooter, RecordHeader, RecordPage, RecordSection, SuggestionCards, type Suggestion } from '@/components/shared/record/RecordPage';
import { ItemWorkspace } from '@/components/shared/record/ItemWorkspace';
import { RecordLinkPicker, type LinkableRecord } from '@/components/shared/record/RecordLinkPicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Connections } from '@/components/shared/record/RecordParts';
import { ItemHistoryTimeline } from '@/components/shared/record/ItemHistoryPanel';
import { EntityMeta } from '@/components/shared/IntellectualStructures';
import { Dictation } from '@/components/shared/Dictation';
import { PraxisInstrument } from '@/components/Practices/PraxisInstrument';
import { PracticeCheckInNotes } from '@/components/Practices/PracticeCheckInNotes';
import { Eyebrow } from '@/components/ui/eyebrow';
import { hasPracticeIntellectualBasis, isRepeatablePractice, normalizePracticeStatusForSave, practiceDesignGaps } from '@/lib/workflow-integrity';
import { useToast } from '@/hooks/use-toast';
import type { PraxisMethod } from '@/components/Practices/PraxisMethodPicker';
import { PraxisCardGroup, PraxisIndexHeader } from '@/components/Practices/PraxisIndex';
import { PraxisDayStrip, praxisShapeFor } from '@/components/Practices/PraxisMethodShape';
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
  onUpdatePractice: (practice: Practice, approval?: PracticeReviewApproval, checkInWrite?: PracticeCheckInWrite) => void | Promise<Practice | void>;
  onDeletePractice: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  focusedPracticeId?: string | null;
  onOpenPracticeRoute?: (id: string | null) => void;
  onNavigateTarget: (target: { view: NoesisView; targetId?: string | null }) => void;
  onAddQuestion?: (data: Partial<Question>) => unknown;
}

const practiceTypes: PracticeType[] = ['habit', 'experiment', 'observation', 'reflection'];
const praxisLinkFields = { source: 'sourceIds', inquiry: 'questionIds', position: 'positionIds', work: 'draftIds' } as const;
type PraxisLinkKind = keyof typeof praxisLinkFields;
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
  if (practicePraxisMethod(type) === 'experiments') return 'experiment';
  return 'habit';
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

export function PracticesWorkspace({ labTool, onPickMethod, aiSettings, practices, concepts, media, questions, positions, drafts, links, onAddPractice, onUpdatePractice: persistPractice, onDeletePractice, onAddConcept, onCreateLink, focusedPracticeId, onOpenPracticeRoute, onNavigateTarget, onAddQuestion }: PracticesWorkspaceProps) {
  const [sortOrder, setSortOrder] = useState<CollectionOrder>('newest');
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
  const onUpdatePractice: PracticesWorkspaceProps['onUpdatePractice'] = async (next, approval, checkInWrite) => {
    const previous = practices.find(practice => practice.id === next.id);
    const result = await persistPractice(next, approval, checkInWrite);
    if (!approval && previous && !completedPracticeResult(previous)) {
      const target = practiceReviewDestination(next, questions, positions);
      if (target) {
        const label = target.view === 'questions' ? 'Review in Inquiry' : 'Review in Position';
        toast({ title: 'Praxis result ready to review', description: target.label,
          action: <ToastAction altText={`${label}: ${target.label}`} onClick={() => onNavigateTarget(target)}>{label}</ToastAction> });
      }
    }
    return result;
  };
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
  const filtered = sortCollection(practices.filter((practice) => {
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
  }), sortOrder, item => item.title, item => item.dateUpdated || item.dateCreated);
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
    setDraft(practice ? { ...practice } : {
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
      setDraft({ ...focused });
      setEditorOpen(true);
    }
  }, [focusedPracticeId, practices]);

  const persistEditedPractice = async (next: Practice, draftPatch?: Partial<Practice>, checkInWrite?: PracticeCheckInWrite) => {
    if (savingRef.current) throw new Error('A practice save is already in progress.');
    savingRef.current = true;
    setSavingPractice(true);
    try {
      await onUpdatePractice(next, undefined, checkInWrite);
      setDraft((current) => draftPatch ? { ...current, ...draftPatch } : next);
    } finally { savingRef.current = false; setSavingPractice(false); }
  };

  const handleSave = async (conclude = false) => {
    if (savingRef.current) return;
    if (!draft.title?.trim()) return;
    const payload = {
      ...draft,
      title: draft.title.trim(),
      status: conclude ? 'concluded' as const : normalizePracticeStatusForSave(draft),
      conceptTags: normalizeConceptTags(draft.conceptTags),
    };
    savingRef.current = true;
    setSavingPractice(true);
    try {
      if (draft.id) {
        const saved = await onUpdatePractice(payload as Practice);
        setDraft(saved || payload);
        toast({ title: conclude ? 'Review saved and concluded' : practicePraxisMethod(payload.type) === 'experiments' ? 'Experiment saved' : 'Practice saved' });
      } else {
        const created = await onAddPractice({ ...payload, action: draft.action?.trim() || '', hypothesis: draft.hypothesis?.trim() || '' });
        setDraft(created);
        onOpenPracticeRoute?.(created.id);
        toast({ title: isExperiment ? 'Experiment draft created' : 'Practice draft created' });
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
    <div className={cn(practiceIsOpen ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden' : 'noesis-page noesis-praxis-scroll')} data-noesis-scroll-region={practiceIsOpen ? undefined : ''} data-noesis-identity="experiment-log">
      {!practiceIsOpen && (<>
      <PraxisIndexHeader
        method={labTool}
        description={isExperiment ? 'Make a prediction, record what happens, and review the result.' : 'Choose a repeatable action and check in when you do it.'}
        createLabel={`New ${noun}`}
        onPick={method => { clearPracticeFilters(); onPickMethod(method); }}
        onCreate={() => openEditor()}
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={labTool === 'experiments' ? 'Search experiments, hypotheses, outcomes...' : 'Search practices, actions, observations...'}
        searchLabel={`Search ${labTool}`}
        resultCount={filtered.length}
        sortControl={<SortPill label={`Sort ${labTool}`} value={sortOrder} onChange={setSortOrder} options={COLLECTION_SORT_OPTIONS} />}
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
          {(['practice', 'experiment', 'commitment'] as const).map((kind, index) => {
            const Icon = PRAXIS_METHOD_ICONS[kind];
            return <span key={kind} data-stage-tone="act" className="inline-flex items-center gap-1.5"><Icon className="size-3.5 shrink-0 text-[hsl(var(--stage))]" aria-hidden="true" />{['Practice (repeat an action)', 'Experiment (test an idea)', 'Commitment (uphold a principle)'][index]}</span>;
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
          if (!open && savingRef.current) return;
          setEditorOpen(open);
          if (!open && focusedPracticeId) onOpenPracticeRoute?.(null);
        }}
        draft={draft}
        setDraft={setDraft}
        savedRecord={practices.find(practice => practice.id === draft.id)}
        onLinkRecord={async ({ type, id, linked }) => {
          const saved = practices.find(practice => practice.id === draft.id);
          if (!saved) return false;
          const field = praxisLinkFields[type];
          const ids = saved[field] || [];
          const patch = { [field]: linked ? ids.filter(value => value !== id) : [...new Set([...ids, id])], dateUpdated: today() };
          try {
            await persistEditedPractice({ ...saved, ...patch }, patch);
            toast({ title: linked ? 'Record unlinked' : 'Record linked' });
            return true;
          } catch {
            toast({ title: 'Connection not saved', description: 'Please try again.', variant: 'destructive' });
            return false;
          }
        }}
        onOpenPosition={(id) => { setEditorOpen(false); onNavigateTarget({ view: 'vault', targetId: id }); }}
        onOpenWorks={() => { setEditorOpen(false); onNavigateTarget({ view: 'writing' }); }}
        onAddQuestion={onAddQuestion}
        concepts={concepts}
        media={media}
        questions={questionList}
        positions={positions}
        drafts={drafts}
        onAddConcept={onAddConcept}
        onChangeCheckIn={async (edit) => {
          const saved = practices.find(practice => practice.id === draft.id);
          if (!saved || practicePraxisMethod(saved.type) !== 'practices') throw new Error('Save this practice before changing check-ins.');
          const next = changePracticeCheckIn(saved, edit, dateKey(), today());
          await persistEditedPractice(next, { logs: next.logs, logDates: next.logDates, dateUpdated: next.dateUpdated }, {
            expectedUpdatedAt: saved.dateUpdated,
            removedLogId: edit.kind === 'delete' ? edit.id : undefined,
          });
        }}
        onRecordLog={async (log) => {
          const saved = practices.find(practice => practice.id === draft.id);
          if (!saved || practiceScheduleState(saved) !== 'running' || practiceDesignGaps(saved).length || !hasPracticeBasis(saved)) {
            throw new Error('Save the setup before logging.');
          }
          const next = appendPracticeObservation(saved, log, today());
          await persistEditedPractice(next, {
            logs: next.logs, logDates: next.logDates, dateUpdated: next.dateUpdated,
            ...(log.outcome?.trim() && draft.observedOutcome === saved.observedOutcome ? { observedOutcome: next.observedOutcome } : {}),
          });
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
        onSave={() => void handleSave()}
        onConclude={() => void handleSave(true)}
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
    <PraxisCardGroup title={title} count={practices.length}>
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
    </PraxisCardGroup>
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
  const MethodIcon = PRAXIS_METHOD_ICONS[practicePraxisMethod(practice.type) === 'experiments' ? 'experiment' : 'practice'];
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
    const nextLog: PracticeLog = { id: uid(), date: todayKey, actionCompleted: kept };
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
      <div className="flex items-start justify-between gap-2">
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
            <MethodIcon className="mt-1 size-[18px] shrink-0 text-[hsl(var(--stage))]" aria-hidden="true" />
            <h3 className="font-headline text-lg font-bold italic leading-tight group-hover:text-accent transition-colors text-primary whitespace-normal break-words">{practice.title}</h3>
          </div>
          <p className="mt-1 text-xs italic leading-5 text-muted-foreground whitespace-normal">
            {practice.action || practice.description || 'No action defined yet.'}
            {visibleType === 'experiment' && practice.hypothesis && <span className="mt-1 block not-italic"><strong>Prediction:</strong> {practice.hypothesis}</span>}
          </p>
        </div>
      </div>
        <div className="mt-3 flex flex-wrap items-center gap-1">
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
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/30 pt-3 text-xs leading-5 text-muted-foreground">
        <span className="min-w-0 max-w-xl truncate italic text-primary/80">{practice.intellectualBasis || firstLinkedPosition?.title || linkedQuestions[0]?.text}</span>
        <span className="noesis-eyebrow noesis-eyebrow--sm">{durationText}</span>
        <span className="noesis-eyebrow noesis-eyebrow--sm">{experimentShape.logCount} {experimentShape.logCount === 1 ? 'log' : 'logs'}</span>
        {setupNeed && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-label leading-4 text-foreground">{setupNeed}</span>
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
          <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
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

function PracticeEditor({ aiSettings, open, onOpenChange, draft, savedRecord, setDraft, concepts, media, questions, positions, drafts, onAddConcept, onRecordLog, onChangeCheckIn, onSaveAiOutcome, onSaveAiHistory, onSave, onConclude, busy, onOpenPosition, onAddQuestion, onOpenWorks, onLinkRecord }: {
  onConclude: () => void;
  onOpenPosition?: (id: string) => void;
  onAddQuestion?: (data: Partial<Question>) => unknown;
  onOpenWorks?: () => void;
  onLinkRecord: (record: LinkableRecord<PraxisLinkKind>) => Promise<boolean>;
  busy: boolean;
  aiSettings: import('@/lib/types').AiSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Partial<Practice>;
  savedRecord?: Practice;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Practice>>>;
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  onAddConcept: (data: Partial<Concept>) => void;
  onRecordLog: (log: PracticeLog) => Promise<void>;
  onChangeCheckIn: (edit: PracticeCheckInEdit) => Promise<void>;
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
  const readyToLog = Boolean(savedRecord && practiceScheduleState(savedRecord) === 'running' && practiceDesignGaps(savedRecord).length === 0 && hasPracticeBasis(savedRecord));
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
  // its own workspace. Only a brand-new
  // practice is a dialog, the same as adding an inquiry or a position.
  const asPage = Boolean(draft.id);
  const noun = practicePraxisMethod(draft.type) === 'experiments' ? 'experiment' : 'practice';
  const experiment = noun === 'experiment';
  const creationOrigin = draft.id ? deskExperimentCreationRef(draft) : undefined;
  const usesTestSetup = !isRepeatablePractice(draft.type);
  const concluded = isPracticeConcluded(draft);
  const needsSetup = !concluded && !readyToLog && schedule !== 'review' && schedule !== 'scheduled';
  const reviewing = concluded || schedule === 'review';
  const setupGap = practiceDesignGaps(draft)[0];
  const durationMode = draft.durationMode || 'repeated';
  const canSave = !busy && Boolean(draft.title?.trim());
  const aiPanel = (
    <ContextualAiPanel
      key={draft.id}
      itemHistory={itemAiHistory({ ...draft, aiReviewHistory: savedReviews })}
      enabled={Boolean(
        aiSettings.aiAssistanceEnabled
        && draft.id
        && isPracticeConcluded(draft as Practice)
        && ((draft.logs?.length || 0) > 0 || draft.observedOutcome?.trim())
      )}
      showContextBeforeSending={aiSettings.showContextBeforeSending}
      reasoningDepth={aiDepthFor(aiSettings, 'praxis')}
      actions={['synthesize_practice_outcome']}
      iconOnly
      actionPromptLabel={`What should Noesis review about this ${noun}?`}
      promptLabel={noun === 'experiment' ? 'What do you want to understand about the prediction or result?' : 'What do you want to understand about this practice or its check-ins?'}
      promptPlaceholder={experiment ? 'Did the observations support my prediction?' : 'When was the routine easiest to keep?'}
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
  const checkIn = async (kept: boolean) => {
    if (logLock.current || !readyToLog) return;
    logLock.current = true;
    setLogging(true);
    try {
      const date = dateKey();
      await onChangeCheckIn({ kind: 'add', day: date, kept, note: '' });
      toast({ title: kept ? 'Checked in' : 'Recorded as missed' });
    } catch {
      toast({ title: 'Check-in not saved', description: 'Please retry.', variant: 'destructive' });
    } finally {
      logLock.current = false;
      setLogging(false);
    }
  };
  const testFields = (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Prediction"><Textarea value={draft.hypothesis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, hypothesis: event.target.value }))} className="min-h-20" placeholder="If I try this, what do I expect to happen?" /></Field>
      <Field label="What you will record"><Textarea value={draft.observationMethod || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observationMethod: event.target.value }))} className="min-h-20" placeholder="What will you actually observe or measure?" /></Field>
      <Field label="What would support the prediction"><Textarea value={draft.expectedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, expectedOutcome: event.target.value }))} className="min-h-20" placeholder="What result would count in its favor?" /></Field>
    </div>
  );
  const statusField = (
    <Field label="Status">
      <Select value={draft.status || 'planned'} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as PracticeStatus }))}>
        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
        <SelectContent>{[...new Set([...statuses, ...(draft.status ? [draft.status] : [])])].map((status) => <SelectItem key={status} value={status}>{status.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
  const [selectedStep, setSelectedStep] = useState<{ id?: string; step: string }>();
  const step = selectedStep?.id === draft.id ? selectedStep?.step : undefined;
  const selectStep = (next: string) => setSelectedStep({ id: draft.id, step: next });
  const linkableRecords: LinkableRecord<PraxisLinkKind>[] = [
    ...media.map(item => ({ type: 'source' as const, label: 'Source', id: item.id, title: item.title })),
    ...questions.map(item => ({ type: 'inquiry' as const, label: 'Inquiry', id: item.id, title: item.text })),
    ...positions.map(item => ({ type: 'position' as const, label: 'Position', id: item.id, title: item.title })),
    ...drafts.map(item => ({ type: 'work' as const, label: 'Work', id: item.id, title: item.title || 'Untitled' })),
  ].map(record => ({ ...record, linked: (savedRecord?.[praxisLinkFields[record.type]] || []).includes(record.id) }));
  const setupPanel = (
      <RecordSection id="prx-action" title={experiment ? 'Test setup' : 'Routine'}>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <Field label={experiment ? 'Experiment name' : 'Practice name'}><Input value={draft.title || ''} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} /></Field>
          <Field label="Type">
            <Select value={draft.type || 'experiment'} onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as PracticeType }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{practiceTypes.map((type) => <SelectItem key={type} value={type}>{PRACTICE_LABELS[type]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {statusField}
        </div>
        <Field label={experiment ? 'What you will try' : 'What you will repeat'}><Textarea value={draft.action || ''} onChange={(event) => setDraft((prev) => ({ ...prev, action: event.target.value }))} className="min-h-20" placeholder={experiment ? 'What will you do differently?' : 'For example: Take a ten-minute walk after work.'} /></Field>
        {usesTestSetup && <Field label="Idea behind this activity"><Textarea value={draft.intellectualBasis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, intellectualBasis: event.target.value }))} className="min-h-20" placeholder="What question or claim is behind this activity?" /></Field>}
        {(usesTestSetup || draft.hypothesis || draft.observationMethod || draft.expectedOutcome) && testFields}
      </div>
      {needsSetup && <p className="mt-2 text-sm text-muted-foreground">
        {setupGap ? `Still needed: ${setupGap === 'hypothesis' ? 'prediction' : setupGap === 'observation method' ? 'what you will record' : setupGap === 'success signal' ? 'what would support the prediction' : 'action'}.`
          : !hasPracticeBasis(draft as Practice) ? 'Name the idea behind this activity or link a related record.'
          : 'Set the status to Active and save when you are ready to start.'}
      </p>}
      <FooterSection title="Schedule" defaultOpen={schedule === 'scheduled'}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Repeat">
            <Select value={durationMode} onValueChange={(value) => setDraft((prev) => ({ ...prev, durationMode: value as Practice['durationMode'] }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="one_time">One time</SelectItem><SelectItem value="repeated">Repeated</SelectItem><SelectItem value="open_ended">Open ended</SelectItem></SelectContent>
            </Select>
          </Field>
          {(durationMode === 'repeated' || (experiment && durationMode === 'one_time')) && <Field label={experiment ? 'Duration (days)' : 'Target days'}><Input type="number" min={0} value={draft.durationDays || 0} onChange={(event) => setDraft((prev) => ({ ...prev, durationDays: Math.max(0, Number(event.target.value) || 0) }))} /></Field>}
          <Field label="Start date"><Input type="date" value={practiceCalendarDate(draft.startDate)} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} /></Field>
          <Field label="End date (optional)"><Input type="date" value={practiceCalendarDate(draft.endDate)} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} /></Field>
        </div>
      </FooterSection>
      <FooterSection title="Notes and concepts">
        {/* The written fields run in the order you would answer them — why,
            what, when, then anything left over. Concepts came first and in a
            box of its own, which gave a tag list the same weight as the
            reasoning; it sits underneath now as its own pills and nothing
            more. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!usesTestSetup && <Field label="Why this matters"><Textarea value={draft.intellectualBasis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, intellectualBasis: event.target.value }))} className="min-h-20" /></Field>}
          <Field label="Description"><Textarea value={draft.description || ''} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-20" /></Field>
          <Field label="When and where"><Textarea value={draft.context || ''} onChange={(event) => setDraft((prev) => ({ ...prev, context: event.target.value }))} className="min-h-20" placeholder={experiment ? 'For example: At my desk, with my phone in another room.' : 'For example: After dinner, at the park.'} /></Field>
          <Field label="Notes"><Textarea value={draft.notes || ''} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-20" /></Field>
        </div>
        <div className="noesis-praxis-concepts">
          <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Concepts</span>
          <ConceptTagPicker concepts={concepts} value={draft.conceptTags || []} onChange={(conceptTags) => setDraft((prev) => ({ ...prev, conceptTags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} />
        </div>
      </FooterSection>
      <div className="mt-4 flex justify-end border-t border-border/60 pt-4">
        <Button type="button" onClick={onSave} disabled={!canSave} className="min-h-11">{busy ? 'Saving…' : `Save ${noun}`}</Button>
      </div>
      </RecordSection>
  );
  const logPanel = (
      <RecordSection id="prx-run" title={experiment ? 'Record an observation' : 'Check-in notes'}>
        {!experiment ? (savedRecord && <PracticeCheckInNotes key={savedRecord.id} practice={savedRecord} busy={busy || logging} onChange={onChangeCheckIn} />) : <section>
          {!readyToLog && <div className="mb-3 text-sm text-muted-foreground">
            {reviewing ? 'This run is no longer open for check-ins. Save past observations in Review.' : schedule === 'scheduled' ? `Logging opens on ${draft.startDate}.` : `Save the required setup and set this ${noun} to Active before logging.`}
            <Button type="button" variant="link" size="sm" onClick={() => selectStep(reviewing ? 'review' : 'setup')}>{reviewing ? 'Open review' : 'Open setup'}</Button>
          </div>}
          <div className="space-y-4">
            <Field label="WHAT HAPPENED?"><Textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="What did you do or notice? An unexpected result is useful too." className="min-h-28 text-base leading-7" /></Field>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} className="size-5 accent-accent" />I completed the action</label>
            <Button type="button" onClick={recordObservation} disabled={!readyToLog || logging || !observation.trim()} className="min-h-11">{logging ? 'Saving…' : 'Save observation'}</Button>
            {(draft.logs || []).slice(-3).reverse().map((log) => <div key={log.id} className="border-t border-border/40 pt-3"><div className="text-xs text-muted-foreground">{new Date(`${log.date.slice(0, 10)}T12:00:00`).toLocaleDateString()} · {log.actionCompleted ? 'Completed' : 'Not completed'}</div><p className="mt-1 text-sm leading-6">{log.outcome || log.observations}</p></div>)}
          </div>
        </section>}
      </RecordSection>
  );
  const reviewPanel = (
      <RecordSection id="prx-review" title={experiment ? 'Review the result' : 'Review the routine'}>
        {draft.id && <DeskFindings type="practice" id={draft.id} findings={draft.contextDeskFindings} />}
        <Dictation label="Dictate the review" hint="Dictates into the box you last typed in: what you expected, or what happened.">
          <div className={experiment ? 'noesis-pair' : undefined}>
            {experiment && <div className="min-w-0 break-words text-sm"><Eyebrow>Prediction</Eyebrow><p className="mt-2 whitespace-pre-wrap">{draft.hypothesis || draft.expectedOutcome || 'No prediction recorded.'}</p></div>}
            <Field label={experiment ? 'What actually happened?' : 'How did the routine go?'}><Textarea value={draft.observedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observedOutcome: event.target.value }))} className="min-h-24" placeholder={experiment ? 'Describe the result in your own words.' : 'What made it easier or harder to keep?'} /></Field>
          </div>
          <FooterSection title="Interpretation and implications">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="INTERPRETATION"><Textarea value={draft.interpretation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, interpretation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What do you think the result means?" /></Field>
            <Field label="ALTERNATIVE EXPLANATION"><Textarea value={draft.alternativeExplanation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, alternativeExplanation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What else could explain the result?" /></Field>
            <Field label="EFFECT ON POSITION"><Textarea value={draft.effectOnPosition || ''} onChange={(event) => setDraft((prev) => ({ ...prev, effectOnPosition: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What position, inquiry, or concept should change because of this?" /></Field>
          </div>
          </FooterSection>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
            {!concluded && <Button type="button" variant="outline" disabled={!canSave || !draft.observedOutcome?.trim()} onClick={onConclude} className="min-h-11">Save and conclude</Button>}
            <Button type="button" onClick={onSave} disabled={!canSave} className="min-h-11">{busy ? 'Saving…' : 'Save review'}</Button>
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
        {draft.id && reviewing && <OptionalRecordActions label="Use this result elsewhere"><PraxisCarryCards draft={draft} positions={positions} onOpenPosition={onOpenPosition} onAddQuestion={onAddQuestion} onOpenWorks={onOpenWorks} /></OptionalRecordActions>}
      </RecordSection>
  );
  if (asPage) {
    if (!open) return null;
    return (
      <RecordPage tone="act" identity={noun} className="noesis-page noesis-praxis-scroll">
        <RecordHeader
          backLabel={`Back to ${noun}s`}
          onBack={() => onOpenChange(false)}
          view="labs"
          kind={noun}
          icon={PRAXIS_METHOD_ICONS[noun]}
          status={<Badge tone={schedule === 'review' ? 'caution' : schedule === 'running' ? 'practice' : 'neutral'}>{schedule === 'review' ? 'Ready to review' : schedule === 'running' ? 'Active' : schedule === 'scheduled' ? 'Scheduled' : (draft.status || 'planned').replaceAll('_', ' ')}</Badge>}
          title={draft.title?.trim() || `Untitled ${noun}`}
          subtitle={experiment ? 'Test a prediction.' : 'Build a routine.'}
          trailing={aiPanel}
        />
        <ItemWorkspace key={draft.id} history={<ItemHistoryTimeline
          title={experiment ? 'Experiment history' : 'Practice history'}
          entries={(draft.logs || []).map((log) => ({
            id: log.id,
            date: log.date,
            title: experiment ? (log.actionCompleted ? 'Action completed' : 'Action not completed') : (log.actionCompleted ? 'Kept' : 'Missed'),
            text: [log.outcome, log.observations, log.unexpectedResult && `Unexpected: ${log.unexpectedResult}`].filter(Boolean).join(' · '),
          }))}
          empty={experiment ? 'No observations logged yet.' : 'No check-ins logged yet.'}
          background={creationOrigin && draft.id && <AiCreationHistory provenance={creationOrigin}
            target={{ type: 'practice', id: draft.id, fieldPath: 'contextDeskFindings.content', subrecordId: creationOrigin.provenanceId }}
            description="You saved this experiment draft from a Noesis AI review in Context Desk." />} />}>
        <Tabs value={step || (reviewing ? 'review' : needsSetup ? 'setup' : 'log')} onValueChange={selectStep} className="min-w-0">
          <div className="mb-5 flex min-w-0 flex-wrap items-center gap-2">
            <TabsList aria-label={`${noun} workflow`} className="flex h-auto w-fit max-w-full flex-wrap">
              <TabsTrigger value="setup" className="min-h-10">Setup</TabsTrigger>
              <TabsTrigger value="log" className="min-h-10">{experiment ? 'Observe' : 'Check in'}</TabsTrigger>
              <TabsTrigger value="review" className="min-h-10">Review</TabsTrigger>
            </TabsList>
            <RecordLinkPicker records={linkableRecords} disabled={busy || !savedRecord} onLink={onLinkRecord}
              description={`Connect a source, inquiry, position, or work to this ${noun}.`} />
          </div>
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">
              <TabsContent value="setup" forceMount className="mt-0 data-[state=inactive]:hidden">{setupPanel}</TabsContent>
              <TabsContent value="log" forceMount className="mt-0 data-[state=inactive]:hidden">{logPanel}</TabsContent>
              <TabsContent value="review" forceMount className="mt-0 data-[state=inactive]:hidden">{reviewPanel}</TabsContent>
            </fieldset>
            <div className="min-w-0"><PraxisInstrument practice={draft} kind={noun} onCheckIn={readyToLog && !busy && !logging ? (kept) => void checkIn(kept) : undefined} /></div>
          </div>
        </Tabs>
        <RecordFooter>
          <FooterSection title="Connections" count={(draft.sourceIds?.length || 0) + (draft.questionIds?.length || 0) + (draft.positionIds?.length || 0) + (draft.draftIds?.length || 0)}>
            <Connections groups={[
              { type: 'Sources', tone: 'source', items: media.filter((item) => (draft.sourceIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.title, meta: item.creator || undefined })) },
              { type: 'Inquiries', tone: 'inquiry', items: questions.filter((item) => (draft.questionIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.text, meta: item.status.replace(/_/g, ' ') })) },
              { type: 'Positions', tone: 'position', items: positions.filter((item) => (draft.positionIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.title, meta: `${item.confidence}% confidence`, onOpen: onOpenPosition ? () => onOpenPosition(item.id) : undefined })) },
              { type: 'Works', tone: 'work', items: drafts.filter((item) => (draft.draftIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.title || 'Untitled', onOpen: onOpenWorks })) },
              { type: 'Concepts', tone: 'concept', items: (draft.conceptTags || []).map((tag) => ({ id: tag, label: tag })) },
            ]} />
          </FooterSection>
          <FooterSection title="Record">
            <EntityMeta items={[
              { label: 'Kind', value: (draft.type || 'experiment').replace(/_/g, ' ') },
              { label: 'Status', value: (draft.status || 'planned').replace(/_/g, ' ') },
              { label: 'Started', value: draft.startDate?.slice(0, 10) || '—' },
              { label: 'Logs', value: (draft.logs || []).length },
            ]} />
          </FooterSection>
        </RecordFooter>
        </ItemWorkspace>
      </RecordPage>
    );
  }

  const isExperimentDraft = noun === 'experiment';
  const firstDetail = isExperimentDraft ? 'hypothesis' : 'action';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl italic">New {noun}</DialogTitle>
          <DialogDescription>Only the name is required. Finish setup in the workspace when you’re ready.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); onSave(); }}>
          <fieldset disabled={busy} className="grid min-w-0 gap-4">
            <LabeledField label={isExperimentDraft ? 'Experiment name' : 'Practice name'}>
              <Input required value={draft.title || ''} onChange={event => setDraft(prev => ({ ...prev, title: event.target.value }))}
                placeholder={isExperimentDraft ? 'Reading with my phone out of reach' : 'An evening walk'} />
            </LabeledField>
            <LabeledField label={isExperimentDraft ? 'What do you expect to happen? (optional)' : 'What will you do? (optional)'}>
              <Textarea value={draft[firstDetail] || ''} onChange={event => setDraft(prev => ({ ...prev, [firstDetail]: event.target.value }))}
                placeholder={isExperimentDraft ? 'I expect to read longer without checking my phone.' : 'Walk for ten minutes after dinner.'} className="min-h-20" />
            </LabeledField>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !draft.title?.trim()}>{busy ? 'Saving...' : `Create ${noun}`}</Button>
          </DialogFooter>
        </form>
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
