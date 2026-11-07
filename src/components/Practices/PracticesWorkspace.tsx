
"use client";

import React, { useMemo, useState } from 'react';
import { Activity, CheckCircle2, ClipboardList, Edit, Eye, MoreHorizontal, PauseCircle, Play, Plus, Puzzle, Trash2 } from 'lucide-react';
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
import { isPracticeConcluded, practiceCurrentStreak as currentStreak, practiceLogDates, practiceNeedsConsequence, practiceNeedsLog, practiceNeedsOutcome, practiceRecentlyConcluded, practiceScheduleState } from '@/lib/practice-state';
import { LabeledField } from '@/components/shared/LabeledField';
import { cn } from '@/lib/utils';
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
import { appendAiHistoryEntry, type AiReviewResult } from '@/lib/contextual-ai';
import { WorkbenchFlow } from '@/components/shared/WorkbenchFlow';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { hasPracticeIntellectualBasis, normalizePracticeStatusForSave, practiceDesignGaps } from '@/lib/workflow-integrity';
import { useToast } from '@/hooks/use-toast';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { ThoughtGamesPanel } from '@/components/Home/ThoughtGamesPanel';
import type { NoesisView } from '@/lib/noesis-routes';

interface PracticesWorkspaceProps {
  aiSettings: import('@/lib/types').AiSettings;
  practices: Practice[];
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  links: PhilosophicalLink[];
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onUpdatePractice: (practice: Practice) => void;
  onDeletePractice: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  focusedPracticeId?: string | null;
  onOpenPracticeRoute?: (id: string | null) => void;
  onNavigateTarget: (target: { view: NoesisView; targetId?: string | null }) => void;
}

const practiceTypes: PracticeType[] = ['habit', 'experiment', 'observation', 'reflection'];
const statuses: PracticeStatus[] = ['planned', 'active', 'paused', 'completed', 'abandoned'];
type PracticeViewFilter = 'all' | 'awaiting_log' | 'needs_setup' | 'ready_review' | 'testing_positions';
type PraxisMethod = 'exercises' | 'practices' | 'experiments' | 'commitments';

const practiceViewFilters: Array<{ value: PracticeViewFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'awaiting_log', label: 'Log due' },
  { value: 'needs_setup', label: 'Needs setup' },
  { value: 'ready_review', label: 'Ready review' },
  { value: 'testing_positions', label: 'Testing positions' },
];

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

function normalizePracticeStatus(status?: PracticeStatus): PracticeStatus {
  if (status === 'active') return 'active';
  if (status === 'paused') return 'paused';
  if (status === 'abandoned') return 'abandoned';
  if (status === 'completed' || status === 'concluded' || status === 'failed' || status === 'failed_productively' || status === 'integrated') return 'completed';
  return 'planned';
}

function hasPracticeBasis(practice: Practice, linkedQuestions: Question[] = [], linkedPositions: VaultEntry[] = []) {
  return hasPracticeIntellectualBasis(practice) || linkedPositions.length > 0 || linkedQuestions.length > 0;
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

export function PracticesWorkspace({ aiSettings, practices, concepts, media, questions, positions, drafts, links, onAddPractice, onUpdatePractice, onDeletePractice, onAddConcept, onCreateLink, focusedPracticeId, onOpenPracticeRoute, onNavigateTarget }: PracticesWorkspaceProps) {
  const { toast } = useToast();
  const savingRef = React.useRef(false);
  const [savingPractice, setSavingPractice] = useState(false);
  const [statusFilter, setStatusFilter] = usePersistentView<PracticeStatus | 'all'>('noesis:practices-status', 'all', ['all', ...statuses]);
  const [typeFilter, setTypeFilter] = usePersistentView<PracticeType | 'all'>('noesis:practices-type', 'all', ['all', ...practiceTypes]);
  const [conceptFilter, setConceptFilter] = useState('all');
  const [viewFilter, setViewFilter] = usePersistentView<PracticeViewFilter>('noesis:practices-filter', 'all', practiceViewFilters.map((item) => item.value));
  const [otherStatus, setOtherStatus] = usePersistentView<PracticeStatus>('noesis:practices-other-status', 'planned', statuses);
  const [practiceSection, setPracticeSection] = usePersistentView<'active' | 'other'>('noesis:practices-section', 'active', ['active', 'other']);
  const [labTool, setLabTool] = usePersistentView<PraxisMethod>('noesis:labs-tool', 'practices', ['exercises', 'practices', 'experiments', 'commitments']);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useEntityViewPreference('practices');
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Practice | null>(null);
  const [draft, setDraft] = useState<Partial<Practice>>({ title: '', description: '', type: 'experiment', status: 'planned', durationDays: 7, durationMode: 'repeated', conceptTags: [] });
  React.useEffect(() => {
    if (labTool === 'commitments') onNavigateTarget({ view: 'goals' });
  }, [labTool, onNavigateTarget]);
  const questionList = useMemo(() => allQuestions(media, questions), [media, questions]);
  const conceptFilterOptions = useMemo(
    () => concepts
      .map((concept) => concept.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    [concepts]
  );
  const matchesLabTool = (practice: Practice) => labTool === 'experiments'
    ? normalizePracticeType(practice.type) === 'experiment'
    : labTool === 'practices' && normalizePracticeType(practice.type) !== 'experiment';
  const labRecords = practices.filter(matchesLabTool);
  const activeLoops = labRecords.filter((practice) => normalizePracticeStatus(practice.status) === 'active');
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
        schedule: practiceScheduleState(practice),
        scheduleReview: practiceScheduleState(practice) === 'review',
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
    const matchesConcept = conceptFilter === 'all' || (practice.conceptTags || []).some((tag) => tag.toLowerCase() === conceptFilter.toLowerCase());
    const matchesView =
      viewFilter === 'all' ||
      (viewFilter === 'awaiting_log' && state?.needsLog) ||
      (viewFilter === 'needs_setup' && !isPracticeConcluded(practice) && (!state?.hasBasis || state?.needsDesign)) ||
      (viewFilter === 'ready_review' && (state?.needsOutcome || state?.needsConsequence || state?.recentlyConcluded || state?.scheduleReview)) ||
      (viewFilter === 'testing_positions' && (practice.positionIds || []).length > 0);
    return matchesLabTool(practice) && matchesSearch && matchesConcept && matchesView && (statusFilter === 'all' || normalizePracticeStatus(practice.status) === statusFilter) && (typeFilter === 'all' || normalizePracticeType(practice.type) === typeFilter);
  });
  const otherPractices = filtered.filter((practice) => normalizePracticeStatus(practice.status) === otherStatus);
  const visibleActiveLoops = activeLoops.filter((practice) => filtered.some((item) => item.id === practice.id));
  const needsAttentionLoops = visibleActiveLoops.filter((practice) => {
    const state = practiceState.get(practice.id);
    return !state?.hasBasis || state?.needsDesign || state?.scheduleReview;
  });
  const todayLoops = visibleActiveLoops.filter((practice) => practiceNeedsLog(practice));
  const ongoingLoops = visibleActiveLoops.filter((practice) => !needsAttentionLoops.some((item) => item.id === practice.id) && !todayLoops.some((item) => item.id === practice.id));
  const practiceStats = useMemo(() => ({
    total: practices.length,
    active: practices.filter((practice) => normalizePracticeStatus(practice.status) === 'active').length,
    planned: practices.filter((practice) => normalizePracticeStatus(practice.status) === 'planned').length,
    readyForReview: practices.filter((practice) => {
      const state = practiceState.get(practice.id);
      return state?.needsOutcome || state?.needsConsequence || state?.recentlyConcluded || state?.scheduleReview;
    }).length,
    needsSetup: practices.filter((practice) => {
      const state = practiceState.get(practice.id);
      return !isPracticeConcluded(practice) && (!state?.hasBasis || state?.needsDesign);
    }).length,
    awaitingLog: practices.filter((practice) => practiceNeedsLog(practice)).length,
    needsDesign: practices.filter((practice) => practiceDesignGaps(practice).length > 0).length,
    needsOutcome: practices.filter((practice) => practiceNeedsOutcome(practice)).length,
    needsConsequence: practices.filter((practice) => practiceNeedsConsequence(practice)).length,
    needsBasis: practices.filter((practice) => {
      const state = practiceState.get(practice.id);
      return state ? !state.hasBasis : !hasPracticeBasis(practice);
    }).length,
  }), [practices, practiceState]);
  const labStats = useMemo(() => ({
    total: labRecords.length,
    active: labRecords.filter((practice) => normalizePracticeStatus(practice.status) === 'active').length,
    needsSetup: labRecords.filter((practice) => {
      const state = practiceState.get(practice.id);
      return !isPracticeConcluded(practice) && (!state?.hasBasis || state?.needsDesign);
    }).length,
    awaitingLog: labRecords.filter((practice) => practiceNeedsLog(practice)).length,
    readyForReview: labRecords.filter((practice) => {
      const state = practiceState.get(practice.id);
      return state?.needsOutcome || state?.needsConsequence || state?.recentlyConcluded || state?.scheduleReview;
    }).length,
  }), [labRecords, practiceState]);

  const clearPracticeFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setConceptFilter('all');
    setViewFilter('all');
    setSearch('');
  };

  const practiceFiltersActive = statusFilter !== 'all' || typeFilter !== 'all' || conceptFilter !== 'all' || viewFilter !== 'all' || Boolean(search.trim());
  const activePracticeFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    viewFilter !== 'all' ? `View: ${practiceViewFilters.find((item) => item.value === viewFilter)?.label || viewFilter.replace(/_/g, ' ')}` : null,
    statusFilter !== 'all' ? `Status: ${statusFilter.replace(/_/g, ' ')}` : null,
    typeFilter !== 'all' ? `Type: ${PRACTICE_LABELS[typeFilter] || typeFilter.replace(/_/g, ' ')}` : null,
    conceptFilter !== 'all' ? `Concept: ${conceptFilter}` : null,
  ].filter(Boolean) as string[];

  const openEditor = (practice?: Practice, newType: 'practice' | 'experiment' = labTool === 'experiments' ? 'experiment' : 'practice') => {
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

  const focusLabStage = (stage: 'setup' | 'active' | 'observe' | 'review') => {
    setSearch('');
    setConceptFilter('all');
    setTypeFilter('all');
    if (stage === 'setup') {
      setStatusFilter('all');
      setViewFilter('needs_setup');
      setPracticeSection('other');
      setOtherStatus('planned');
      return;
    }
    if (stage === 'active') {
      setStatusFilter('active');
      setViewFilter('all');
      setPracticeSection('active');
      return;
    }
    if (stage === 'observe') {
      setStatusFilter('all');
      setViewFilter('awaiting_log');
      setPracticeSection('active');
      return;
    }
    setStatusFilter('all');
    setViewFilter('ready_review');
    setPracticeSection(labRecords.some((practice) => practiceScheduleState(practice) === 'review') ? 'active' : 'other');
    setOtherStatus('completed');
  };

  const openedPracticeId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!focusedPracticeId) {
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

  return (
    <div className="noesis-page noesis-labs-page" data-noesis-identity="experiment-log">
      <PageHeader
        title="Praxis"
        description="Test an idea, build consistency, or uphold a principle—then carry what happens back into your thinking."
        meta={
          <span className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            {practiceStats.total} Praxis records · {practiceStats.active} active · {practiceStats.needsSetup} need setup · {practiceStats.readyForReview} ready for review
          </span>
        }
        tabs={(
          <WorkspaceTabs
            value={labTool}
            onChange={(value) => {
              if (value === 'commitments') {
                onNavigateTarget({ view: 'goals' });
                return;
              }
              setLabTool(value);
              setTypeFilter('all');
            }}
            label="Praxis methods"
            className="max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:overflow-hidden max-sm:[&>button]:min-w-0 max-sm:[&>button]:gap-1 max-sm:[&>button]:px-1.5 max-sm:[&>button]:text-xs"
            items={[
              { id: 'exercises', label: 'Exercises', icon: Puzzle },
              { id: 'practices', label: 'Practices', icon: PracticeIcon },
              { id: 'experiments', label: 'Experiments', icon: NOESIS_ICONS.lab },
              { id: 'commitments', label: 'Commitments', icon: NOESIS_ICONS.commitment },
            ]}
          />
        )}
        actions={labTool === 'exercises' ? undefined : (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 rounded-full bg-accent px-6 font-bold shadow-md shadow-accent/20 hover:bg-accent/90"><Plus className="mr-1.5 size-4" /> New Praxis</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onSelect={() => { setLabTool('experiments'); openEditor(undefined, 'experiment'); }} className="items-start gap-3 py-3">
                <NOESIS_ICONS.lab className="mt-0.5 size-4 shrink-0" />
                <span><strong className="block text-sm">Test an idea</strong><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Run a bounded experiment and observe what happens.</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setLabTool('practices'); openEditor(undefined, 'practice'); }} className="items-start gap-3 py-3">
                <PracticeIcon className="mt-0.5 size-4 shrink-0" />
                <span><strong className="block text-sm">Build consistency</strong><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Repeat an action and learn from the pattern.</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNavigateTarget({ view: 'goals' })} className="items-start gap-3 py-3">
                <NOESIS_ICONS.commitment className="mt-0.5 size-4 shrink-0" />
                <span><strong className="block text-sm">Uphold a principle</strong><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Create a commitment and check whether conduct aligns.</span></span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {labTool === 'exercises' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <ThoughtGamesPanel
            concepts={concepts}
            inquiries={questions}
            positions={positions}
            media={media}
            links={links}
            onNavigate={onNavigateTarget}
          />
          <aside className="h-fit rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              <Puzzle className="size-4" aria-hidden="true" />
              How exercises work
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Short activities draw only from records already in your workspace. They help you recall, distinguish, challenge, and connect your thinking.</p>
            <ul className="mt-4 space-y-3 text-sm leading-5 text-foreground/85">
              <li className="border-l-2 border-accent/60 pl-3">Answers stay temporary unless you deliberately update the related item.</li>
              <li className="border-l-2 border-border pl-3">Every exercise identifies the source record it uses.</li>
              <li className="border-l-2 border-border pl-3">Completion is private practice, not a score or canonical thinking event.</li>
            </ul>
          </aside>
        </div>
      ) : (
        <>
      <section className="relative mb-5 overflow-hidden border-y border-border/70 bg-card/45" aria-label={`${labTool === 'experiments' ? 'Experiment' : 'Practice'} cycle`}>
        <div className="flex flex-col gap-1 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="font-code text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">{labTool === 'experiments' ? 'Experiment cycle' : 'Practice cycle'}</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{labTool === 'experiments' ? 'Move a claim through contact with reality' : 'Move an intention into repeatable evidence'}</h2>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">Select a stage to focus the workspace.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            {
              id: 'setup' as const,
              label: 'Design',
              count: labStats.needsSetup,
              description: labTool === 'experiments' ? 'Hypothesis and measure' : 'Action and success signal',
              icon: ClipboardList,
              active: viewFilter === 'needs_setup',
            },
            {
              id: 'active' as const,
              label: labTool === 'experiments' ? 'Run' : 'Practice',
              count: labStats.active,
              description: labTool === 'experiments' ? 'Bounded test in progress' : 'Active repetition',
              icon: Activity,
              active: statusFilter === 'active' && viewFilter === 'all',
            },
            {
              id: 'observe' as const,
              label: 'Observe',
              count: labStats.awaitingLog,
              description: labTool === 'experiments' ? 'Evidence waiting to be logged' : 'Today\'s action and result',
              icon: Eye,
              active: viewFilter === 'awaiting_log',
            },
            {
              id: 'review' as const,
              label: labTool === 'experiments' ? 'Conclude' : 'Integrate',
              count: labStats.readyForReview,
              description: labTool === 'experiments' ? 'Compare result to prediction' : 'Carry learning into thought',
              icon: CheckCircle2,
              active: viewFilter === 'ready_review',
            },
          ].map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => focusLabStage(stage.id)}
              aria-pressed={stage.active}
              className={cn(
                'group relative min-h-28 border-border/60 px-4 py-4 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                index % 2 === 0 ? 'border-r' : '',
                index < 2 ? 'border-b sm:border-b-0' : '',
                index > 0 ? 'sm:border-l' : '',
                index === 2 ? 'border-r sm:border-r-0' : '',
                stage.active ? 'bg-accent/10' : 'hover:bg-muted/45'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <stage.icon className={cn('size-5', stage.active ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground')} aria-hidden="true" />
                <span className={cn('font-code text-xl font-semibold tabular-nums', stage.active ? 'text-accent' : 'text-foreground')}>{stage.count}</span>
              </div>
              <div className="mt-3 text-sm font-semibold text-foreground">{stage.label}</div>
              <div className="mt-1 text-xs leading-4 text-muted-foreground">{stage.description}</div>
              {stage.active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>


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
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as PracticeViewFilter)}>
          <SelectTrigger className="w-56 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-card shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Views" /></SelectTrigger>
          <SelectContent>
            {practiceViewFilters.map((filter) => <SelectItem key={filter.value} value={filter.value} className="font-code text-[9px] uppercase">{filter.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PracticeStatus | 'all')}>
          <SelectTrigger className="w-48 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-card shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[9px] uppercase">All Statuses</SelectItem>
            {statuses.map((status) => <SelectItem key={status} value={status} className="font-code text-[9px] uppercase">{status}</SelectItem>)}
          </SelectContent>
        </Select>
        {labTool === 'practices' && <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as PracticeType | 'all')}>
          <SelectTrigger className="w-56 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-card shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[9px] uppercase">All Practice Types</SelectItem>
            {practiceTypes.filter((type) => type !== 'experiment').map((type) => <SelectItem key={type} value={type} className="font-code text-[9px] uppercase">{simplifiedTypeLabels[type]}</SelectItem>)}
          </SelectContent>
        </Select>}
        <Select value={conceptFilter} onValueChange={setConceptFilter}>
          <SelectTrigger className="w-56 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-card shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Concepts" /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="all" className="font-code text-[9px] uppercase">All Concepts</SelectItem>
            {conceptFilterOptions.map((concept) => <SelectItem key={concept} value={concept} className="font-code text-[9px] uppercase">{concept}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterToolbar>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          { label: 'Needs setup', value: labStats.needsSetup, filter: 'needs_setup' as PracticeViewFilter },
          { label: 'Log due', value: labStats.awaitingLog, filter: 'awaiting_log' as PracticeViewFilter },
          { label: 'Ready for review', value: labStats.readyForReview, filter: 'ready_review' as PracticeViewFilter },
        ].filter((item) => item.value > 0).map((item) => (
          <button
            key={item.filter}
            type="button"
            onClick={() => setViewFilter(viewFilter === item.filter ? 'all' : item.filter)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-widest transition-colors",
              viewFilter === item.filter ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
            )}
          >
            {item.label} {item.value}
          </button>
        ))}
      </div>

      <WorkspaceTabs
        value={practiceSection}
        onChange={setPracticeSection}
        label="Practice groups"
        variant="segmented"
        className="mb-4"
        items={[
          { id: 'active', label: labTool === 'experiments' ? 'Running experiments' : 'Active loops', count: visibleActiveLoops.length },
          { id: 'other', label: `Other ${labTool}`, count: filtered.length - visibleActiveLoops.length },
        ]}
      />

      {viewMode === 'table' && (
        <section className="mb-6 hidden overflow-hidden rounded-lg border border-border/60 bg-card md:block" aria-label={`${practiceSection} ${labTool} table`}>
          <Table>
            <TableHeader><TableRow className="bg-muted/25 hover:bg-muted/25"><TableHead>{labTool === 'experiments' ? 'Experiment' : 'Practice'}</TableHead><TableHead className="w-36">Type</TableHead><TableHead className="w-36">Status</TableHead><TableHead>Action or hypothesis</TableHead><TableHead className="w-40">Progress</TableHead><TableHead className="w-24"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
            <TableBody>{(practiceSection === 'active' ? visibleActiveLoops : otherPractices).map((practice) => {
              const state = practiceState.get(practice.id);
              const progress = practice.status === 'abandoned' ? 'Record closed' : !isPracticeConcluded(practice) && (state?.needsDesign || !state?.hasBasis) ? 'Needs setup' : state?.schedule === 'scheduled' ? 'Scheduled' : state?.scheduleReview ? 'Review result' : state?.needsLog ? 'Log due' : state?.needsOutcome ? 'Review outcome' : state?.needsConsequence ? 'Connect result' : 'On track';
              return <TableRow key={practice.id} tabIndex={0} className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={(event) => { if ((event.target as HTMLElement).closest('button,a')) return; openEditor(practice); onOpenPracticeRoute?.(practice.id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openEditor(practice); onOpenPracticeRoute?.(practice.id); } }}>
                <TableCell className="max-w-lg py-4"><div className="font-headline text-base font-semibold text-foreground">{practice.title}</div><div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{practice.description || practice.intellectualBasis || 'Purpose not added'}</div></TableCell>
                <TableCell className="font-code text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{simplifiedTypeLabels[normalizePracticeType(practice.type)]}</TableCell>
                <TableCell><StageBadge type="practice" stage={practice.stage} status={practice.status} /></TableCell>
                <TableCell className="text-xs leading-5 text-muted-foreground">{practice.action || practice.hypothesis || 'Action not defined'}</TableCell>
                <TableCell className="font-code text-[9px] uppercase tracking-wider text-muted-foreground">{progress}</TableCell>
                <TableCell><Button size="sm" variant="outline" className="min-h-9 rounded-full" onClick={() => { openEditor(practice); onOpenPracticeRoute?.(practice.id); }}>{state?.needsLog ? 'Log' : 'Open'}</Button></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </section>
      )}

      {practiceSection === 'active' && <section className={cn("mb-6 rounded-2xl border border-border/50 bg-card/70 p-4 shadow-sm", viewMode === 'table' && "md:hidden")}>
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
          <ActiveLoopGroup title="Needs attention" practices={needsAttentionLoops} questions={questionList} positions={positions} onEdit={openEditor} onDelete={setDeleteTarget} onUpdatePractice={onUpdatePractice} onOpenPracticeRoute={onOpenPracticeRoute} />
          <ActiveLoopGroup title="Today" practices={todayLoops.filter((practice) => !needsAttentionLoops.some((item) => item.id === practice.id))} questions={questionList} positions={positions} onEdit={openEditor} onDelete={setDeleteTarget} onUpdatePractice={onUpdatePractice} onOpenPracticeRoute={onOpenPracticeRoute} />
          <ActiveLoopGroup title="Ongoing" practices={ongoingLoops} questions={questionList} positions={positions} onEdit={openEditor} onDelete={setDeleteTarget} onUpdatePractice={onUpdatePractice} onOpenPracticeRoute={onOpenPracticeRoute} />
          {!visibleActiveLoops.length && (
            <Card className="border-dashed border-border/60 bg-muted/5 p-8 text-center shadow-inner md:col-span-2 xl:col-span-3 2xl:col-span-4 rounded-xl">
              {labTool === 'experiments' ? <NOESIS_ICONS.lab className="size-12 mx-auto mb-4 text-muted-foreground/30" /> : <PracticeIcon className="size-12 mx-auto mb-4 text-muted-foreground/30" />}
              <h3 className="font-headline text-xl italic mb-2 text-primary/60">No active loops match</h3>
              <p className="max-w-sm mx-auto text-sm text-muted-foreground italic mb-5">Start a planned practice or adjust your filters.</p>
              <Button variant="outline" onClick={() => setPracticeSection('other')} className="rounded-full px-8 font-bold border-border/60 shadow-sm bg-card">View other {labTool}</Button>
            </Card>
          )}
        </div>
      </section>}

      {practiceSection === 'other' && <section className={cn("rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm", viewMode === 'table' && "md:hidden")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-headline text-xl font-bold italic text-primary/80">Other {labTool}</h2>
            <p className="text-xs italic text-muted-foreground">Planned, paused, completed, and abandoned {labTool} stay available without crowding the active surface.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.filter((status) => status !== 'active').map((status) => {
              const count = filtered.filter((practice) => normalizePracticeStatus(practice.status) === status).length;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setOtherStatus(status)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-widest transition-colors",
                    otherStatus === status ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
                  )}
                >
                  {status} {count}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {otherPractices.map((practice) => (
            <PracticeCard key={practice.id} compact practice={practice} questions={questionList} positions={positions} onEdit={() => { openEditor(practice); onOpenPracticeRoute?.(practice.id); }} onDelete={() => setDeleteTarget(practice)} onUpdatePractice={onUpdatePractice} onCreateLink={onCreateLink} />
          ))}
          {filtered.length === 0 && (
            <PageEmptyState
              icon={PracticeIcon}
              title="No practices found"
              description="Clear filters or create a lived test that connects a position to behavior."
              action={practiceFiltersActive ? <Button variant="outline" onClick={clearPracticeFilters} className="rounded-full">Clear filters</Button> : <Button onClick={() => openEditor()} className="rounded-full"><Plus className="mr-1.5 size-4" /> New practice</Button>}
            />
          )}
          {filtered.length > 0 && otherPractices.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/5 p-6 text-center text-sm italic text-muted-foreground">
              No {otherStatus} practices match the current filters.
            </div>
          )}
        </div>
      </section>}
        </>
      )}

      <PracticeEditor
        busy={savingPractice}
        aiSettings={aiSettings}
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
        onRecordLog={async (log) => {
          if (!draft.id) throw new Error('Save the practice before recording an observation.');
          const next = appendPracticeObservation(draft as Practice, log, today());
          await persistEditedPractice(next);
        }}
        onSaveAiOutcome={async (result, content) => {
          const saved = practices.find((practice) => practice.id === draft.id);
          if (!saved) throw new Error('Save the practice before accepting an outcome review.');
          const patch = { aiOutcomeReview: content, aiReviewHistory: appendAiHistoryEntry(saved.aiReviewHistory, result, content), dateUpdated: new Date().toISOString() };
          await persistEditedPractice({ ...saved, ...patch }, patch);
        }}
        onSaveAiHistory={async (aiReviewHistory) => {
          const saved = practices.find((practice) => practice.id === draft.id);
          if (!saved) throw new Error('This practice is no longer available.');
          const patch = { aiReviewHistory, dateUpdated: new Date().toISOString() };
          await persistEditedPractice({ ...saved, ...patch }, patch);
        }}
        onSave={handleSave}
        routeOwned={Boolean(focusedPracticeId && draft.id === focusedPracticeId)}
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

function ActiveLoopGroup({ title, practices, questions, positions, onEdit, onDelete, onUpdatePractice, onOpenPracticeRoute }: {
  title: string;
  practices: Practice[];
  questions: Question[];
  positions: VaultEntry[];
  onEdit: (practice?: Practice) => void;
  onDelete: (practice: Practice) => void;
  onUpdatePractice: (practice: Practice) => void;
  onOpenPracticeRoute?: (id: string | null) => void;
}) {
  if (!practices.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-code text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{title}</span>
        <span className="h-px flex-1 bg-border/60" />
        <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{practices.length}</Badge>
      </div>
      <div className="space-y-2">
        {practices.map((practice) => (
          <PracticeCard
            key={`${title}-${practice.id}`}
            compact
            practice={practice}
            questions={questions}
            positions={positions}
            onEdit={() => { onEdit(practice); onOpenPracticeRoute?.(practice.id); }}
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
  const visibleStatus = normalizePracticeStatus(practice.status);
  const scheduleState = practiceScheduleState(practice);
  const meaningfulStreak = visibleType === 'habit' || visibleType === 'experiment';
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
  const relationshipText = `Tests ${linkedPositions.length} position${linkedPositions.length === 1 ? '' : 's'} · connected to ${linkedQuestions.length} inquir${linkedQuestions.length === 1 ? 'y' : 'ies'}`;
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
    setLogDraft({ date: todayKey, actionCompleted: true, confidence: 3 });
    setLogOpen(false);
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
      if ((event.target as HTMLElement).closest('button,a,input,textarea,[role="checkbox"],[role="combobox"]')) return;
      onEdit();
    }} onKeyDown={(event) => {
      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onEdit(); }
    }} className={cn("group cursor-pointer transition-all border border-border/60 bg-card/95 rounded-xl shadow-sm hover:border-accent/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "p-3" : "p-4")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <StageBadge type="practice" stage={practice.stage} status={practice.status} />
            <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/80 rounded-full font-bold px-2.5 py-0.5 shadow-sm">{simplifiedTypeLabels[visibleType]}</Badge>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full px-2.5 py-0.5 font-code text-[8px] font-bold uppercase tracking-widest',
                setupNeed ? 'border-border bg-muted text-foreground' :
                  recentlyConcluded ? 'border-accent/30 bg-accent/5 text-accent' :
                    needsLog ? 'border-accent/40 bg-accent/10 text-accent' :
                      'border-border/60 bg-card text-muted-foreground',
              )}
            >
              {setupNeed ? 'Needs setup' : scheduleState === 'scheduled' ? 'Scheduled' : scheduleState === 'review' || recentlyConcluded ? 'Review result' : needsLog ? 'Log due' : visibleStatus}
            </Badge>
          </div>
          <h3 className="font-headline text-lg font-bold italic leading-tight group-hover:text-accent transition-colors text-primary whitespace-normal break-words">{practice.title}</h3>
          <p className="mt-1 text-[12px] italic leading-5 text-muted-foreground whitespace-normal">
            {practice.action || practice.description || 'No action defined yet.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant={nextAction.tone === 'open' ? 'outline' : 'default'} onClick={(event) => { event.stopPropagation(); void nextAction.handler(); }} className="h-10 rounded-full px-4">
            {nextAction.tone === 'log' ? <CheckCircle2 className="size-4" /> : nextAction.tone === 'start' ? <Play className="size-4" /> : nextAction.tone === 'review' ? <ClipboardList className="size-4" /> : nextAction.tone === 'open' ? <Eye className="size-4" /> : <Edit className="size-4" />} {nextAction.label}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${practice.title}`} className="size-10 rounded-full"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Edit className="mr-2 size-4" /> Edit practice</DropdownMenuItem>
              {visibleStatus === 'active' && <DropdownMenuItem onSelect={() => setStatus('paused')}><PauseCircle className="mr-2 size-4" /> Pause</DropdownMenuItem>}
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 size-4" /> Delete practice</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/30 pt-3 text-[11px] leading-5 text-muted-foreground">
        <span className="min-w-0 max-w-xl truncate italic text-primary/80">{practice.intellectualBasis || firstLinkedPosition?.title || linkedQuestions[0]?.text || 'No linked idea named yet.'}</span>
        <span className="font-code text-[8px] uppercase tracking-widest">{durationText}</span>
        <span className="font-code text-[8px] uppercase tracking-widest">{experimentShape.logCount} {experimentShape.logCount === 1 ? 'log' : 'logs'}</span>
        {meaningfulStreak && <span className="font-code text-[8px] uppercase tracking-widest">{streak}d streak</span>}
        <span className="hidden sm:inline">{relationshipText}</span>
        {setupNeed && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] leading-4 text-foreground">{setupNeed}</span>
        )}
      </div>

      {logOpen && (
        <div className="mt-5 rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-code text-[8px] font-bold uppercase tracking-[0.2em] text-accent">Observation Log</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {visibleType === 'habit' ? 'Mark whether you did it today. Add a note only when something matters.' : visibleType === 'reflection' ? 'Write what you noticed or understood during this reflection.' : visibleType === 'observation' ? 'Record what you observed, even if the expected pattern did not appear.' : 'Record what happened and how it compares with your hypothesis.'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLogOpen(false)} className="h-7 rounded-full px-2.5 font-code text-[8px] uppercase">Hide</Button>
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

function PracticeEditor({ aiSettings, open, onOpenChange, draft, setDraft, concepts, media, questions, positions, drafts, onAddConcept, onRecordLog, onSaveAiOutcome, onSaveAiHistory, onSave, busy, routeOwned = false }: {
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
  routeOwned?: boolean;
}) {
  const [practiceWorkflowStep, setPracticeWorkflowStep] = useState<'design' | 'run' | 'review' | 'integrate'>('design');
  const [observation, setObservation] = useState('');
  const [completed, setCompleted] = useState(true);
  const [logging, setLogging] = useState(false);
  const logLock = React.useRef(false);
  const { toast } = useToast();
  React.useEffect(() => {
    setObservation('');
    setCompleted(true);
    setPracticeWorkflowStep('design');
  }, [draft.id]);
  const schedule = practiceScheduleState(draft);
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(88dvh,56rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-card border-none shadow-2xl rounded-2xl p-0 sm:p-0 max-sm:h-[calc(100dvh-1rem)] max-sm:w-[calc(100vw-1rem)] max-sm:max-w-none [@media(max-height:600px)]:h-[calc(100dvh-1rem)]">
        <div className="border-b px-4 pt-4 sm:px-8 sm:pt-6 [@media(max-height:600px)]:pt-2">
          <DialogHeader className="mb-3 text-left [@media(max-height:600px)]:mb-1">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <DialogTitle className="font-headline text-2xl italic sm:text-3xl [@media(max-height:600px)]:text-xl">{draft.id ? 'Edit practice' : 'New practice'}</DialogTitle>
              <ContextualAiPanel
                enabled={Boolean(
                  aiSettings.aiAssistanceEnabled
                  && draft.id
                  && isPracticeConcluded(draft as Practice)
                  && ((draft.logs?.length || 0) > 0 || draft.observedOutcome?.trim())
                )}
                showContextBeforeSending={aiSettings.showContextBeforeSending}
                reasoningDepth={aiSettings.defaultReasoningDepth}
                retainAcceptedProvenance={aiSettings.retainAcceptedAiProvenance}
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
            </div>
            <DialogDescription className="[@media(max-height:600px)]:hidden">
              Define the action, evidence, and review conditions that make this practice a useful test of your thinking.
            </DialogDescription>
          </DialogHeader>
          <div className="pb-4 [@media(max-height:600px)]:pb-2">
            <WorkbenchFlow
              label="Practice workbench workflow"
              activeId={practiceWorkflowStep}
              onSelect={(id) => setPracticeWorkflowStep(id as typeof practiceWorkflowStep)}
              steps={[
                { id: 'design', label: 'Design', description: 'Define the action, reason, schedule, hypothesis, and success signal.' },
                { id: 'run', label: 'Run and log', description: 'Perform the practice and record observations as they happen.' },
                { id: 'review', label: 'Review', description: 'Compare the expected result with what actually happened.' },
                { id: 'integrate', label: 'Integrate', description: 'Connect the result to the position, inquiry, concept, or work it should change.' },
              ]}
            />
          </div>
        </div>
        <fieldset disabled={busy} className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 sm:px-8 sm:py-5">
          <div className="space-y-6">
            {practiceWorkflowStep === 'design' && <>
            <Field label="PRACTICE TITLE"><Input value={draft.title || ''} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="italic text-base rounded-full" /></Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="WHAT YOU WILL DO"><Textarea value={draft.action || ''} onChange={(event) => setDraft((prev) => ({ ...prev, action: event.target.value }))} className="min-h-[100px] italic text-base" placeholder="What exactly will you do, avoid, observe, ask, or commit to?" /></Field>
              <Field label="LINKED IDEA / REASON"><Textarea value={draft.intellectualBasis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, intellectualBasis: event.target.value }))} className="min-h-[100px] italic text-base" placeholder="What idea, position, inquiry, source, or uncertainty is this testing?" /></Field>
            </div>
            <Field label="WHY THIS EXISTS (OPTIONAL)"><Textarea value={draft.description || ''} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-[72px] italic text-base" placeholder="Add context only if the action and linked idea do not explain the purpose." /></Field>
            <details className="rounded-2xl border border-border/50 bg-muted/10 p-4">
              <summary className="cursor-pointer font-code text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Schedule and setup</summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="PRACTICE TYPE">
                  <Select value={draft.type || 'experiment'} onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as PracticeType }))}>
                    <SelectTrigger className="rounded-full bg-card border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{practiceTypes.map((type) => <SelectItem key={type} value={type} className="font-code text-[10px] uppercase">{PRACTICE_LABELS[type]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="STATUS">
                  <Select value={draft.status || 'planned'} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as PracticeStatus }))}>
                    <SelectTrigger className="rounded-full bg-card border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className="font-code text-[10px] uppercase">{status}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="DURATION MODE">
                  <Select value={draft.durationMode || 'repeated'} onValueChange={(value) => setDraft((prev) => ({ ...prev, durationMode: value as Practice['durationMode'] }))}>
                    <SelectTrigger className="rounded-full bg-card border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="one_time">One time</SelectItem><SelectItem value="repeated">Repeated</SelectItem><SelectItem value="open_ended">Open ended</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="DURATION (DAYS)"><Input type="number" min={0} value={draft.durationDays || 0} onChange={(event) => setDraft((prev) => ({ ...prev, durationDays: Math.max(0, Number(event.target.value) || 0) }))} className="font-code rounded-full" /></Field>
                <Field label="START DATE"><Input type="date" value={draft.startDate || ''} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
                <Field label="END DATE (EXPECTED)"><Input type="date" value={draft.endDate || ''} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
                <Field label="HYPOTHESIS"><Textarea value={draft.hypothesis || ''} onChange={(event) => setDraft((prev) => ({ ...prev, hypothesis: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="If I do this, what do I expect to happen or discover?" /></Field>
                <Field label="CONTEXT"><Textarea value={draft.context || ''} onChange={(event) => setDraft((prev) => ({ ...prev, context: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="When, where, with whom, and under what conditions?" /></Field>
                <Field label="OBSERVATION METHOD"><Textarea value={draft.observationMethod || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observationMethod: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="How will you know what happened without overstating the evidence?" /></Field>
                <Field label="EXPECTED OUTCOME"><Textarea value={draft.expectedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, expectedOutcome: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What would support, weaken, or complicate the hypothesis?" /></Field>
                <Field label="GENERAL NOTES"><Textarea value={draft.notes || ''} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="Optional working notes." /></Field>
                <Field label="CONCEPTS TESTED"><ConceptTagPicker concepts={concepts} value={draft.conceptTags || []} onChange={(conceptTags) => setDraft((prev) => ({ ...prev, conceptTags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} /></Field>
              </div>
            </details>
            </>}
            {practiceWorkflowStep === 'run' && (
              <section className="rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="font-code text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Current action</div>
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
                </div> : <div className="mt-4"><p className="text-sm text-muted-foreground">{schedule === 'review' ? 'The scheduled period has ended. Review the result or adjust the schedule.' : schedule === 'scheduled' ? `This practice starts on ${draft.startDate}.` : draft.id && draft.status !== 'active' ? 'Complete setup and save this practice as active before logging.' : 'Save a complete action, hypothesis, success signal, and intellectual basis before logging.'}</p><Button type="button" variant="outline" className="mt-3" onClick={() => setPracticeWorkflowStep(schedule === 'review' ? 'review' : 'design')}>{schedule === 'review' ? 'Review result' : 'Review setup'}</Button></div>}
              </section>
            )}
            {practiceWorkflowStep === 'review' && <details open className="rounded-xl border border-border/50 bg-muted/10 p-4">
              <summary className="cursor-pointer font-code text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Outcome review</summary>
              <div className="mt-4 rounded-2xl border border-border/50 bg-card p-4">
                <h3 className="mb-4 font-headline text-xl italic font-bold text-primary">Theory vs. reality review</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="OBSERVED OUTCOME"><Textarea value={draft.observedOutcome || ''} onChange={(event) => setDraft((prev) => ({ ...prev, observedOutcome: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What has actually happened so far?" /></Field>
                  <Field label="INTERPRETATION"><Textarea value={draft.interpretation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, interpretation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What do you think the result means?" /></Field>
                  <Field label="ALTERNATIVE EXPLANATION"><Textarea value={draft.alternativeExplanation || ''} onChange={(event) => setDraft((prev) => ({ ...prev, alternativeExplanation: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What else could explain the result?" /></Field>
                  <Field label="EFFECT ON POSITION"><Textarea value={draft.effectOnPosition || ''} onChange={(event) => setDraft((prev) => ({ ...prev, effectOnPosition: event.target.value }))} className="min-h-[90px] italic text-base" placeholder="What position, inquiry, or concept should change because of this?" /></Field>
                </div>
                {(draft.aiReviewHistory?.length || draft.aiOutcomeReview?.trim()) && (
                  <div className="mt-5">
                    <AiAssistedHistory
                      title="Saved outcome reviews"
                      entries={draft.aiReviewHistory?.length ? draft.aiReviewHistory : [{
                        id: 'legacy-outcome-review',
                        action: 'synthesize_practice_outcome',
                        title: 'Outcome review',
                        content: draft.aiOutcomeReview || '',
                        date: draft.dateUpdated || draft.endDate || new Date().toISOString(),
                      }]}
                      onChange={onSaveAiHistory}
                    />
                  </div>
                )}
              </div>
            </details>}
            {practiceWorkflowStep === 'integrate' && <details open className="rounded-xl border border-border/50 bg-muted/10 p-4">
              <summary className="cursor-pointer font-code text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Connections</summary>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Choose the sources, inquiries, positions, and works this practice tests or informs.</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                <LinkGrid title="Linked Sources" items={media.map((item) => ({ id: item.id, label: item.title }))} selected={draft.sourceIds || []} onChange={(sourceIds) => setDraft((prev) => ({ ...prev, sourceIds }))} />
                <LinkGrid title="Linked Inquiries" items={questions.map((item) => ({ id: item.id, label: item.text }))} selected={draft.questionIds || []} onChange={(questionIds) => setDraft((prev) => ({ ...prev, questionIds }))} />
                <LinkGrid title="Linked Positions" items={positions.map((item) => ({ id: item.id, label: item.title }))} selected={draft.positionIds || []} onChange={(positionIds) => setDraft((prev) => ({ ...prev, positionIds }))} />
                <LinkGrid title="Linked Works" items={drafts.map((item) => ({ id: item.id, label: item.title }))} selected={draft.draftIds || []} onChange={(draftIds) => setDraft((prev) => ({ ...prev, draftIds }))} />
              </div>
            </details>}
          </div>
        </fieldset>
        <div className="flex shrink-0 justify-end gap-3 border-t bg-muted/10 p-4 sm:px-8 [@media(max-height:600px)]:py-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-11 px-8 rounded-full font-bold text-muted-foreground hover:bg-transparent">Cancel</Button>
          <Button onClick={onSave} disabled={busy || !draft.title?.trim()} className="h-11 px-6">{busy ? 'Saving…' : draft.id ? 'Save practice' : 'Create practice'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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
