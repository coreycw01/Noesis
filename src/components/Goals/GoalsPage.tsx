"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { PraxisCardGroup, PraxisIndexHeader } from '@/components/Practices/PraxisIndex';
import { CommitmentGauge } from '@/components/Practices/CommitmentGauge';
import { Check, Minus, Plus, Save, SkipForward, Target, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageEmptyState } from '@/components/shared/PageState';
import { FooterSection, RecordFooter, RecordHeader, RecordSection } from '@/components/shared/record/RecordPage';
import { ItemWorkspace } from '@/components/shared/record/ItemWorkspace';
import { Connections } from '@/components/shared/record/RecordParts';
import { ItemHistoryTimeline } from '@/components/shared/record/ItemHistoryPanel';
import { EntityMeta } from '@/components/shared/IntellectualStructures';
import { SortPill } from '@/components/shared/FilterToolbar';
import { COLLECTION_SORT_OPTIONS, sortCollection, type CollectionOrder } from '@/lib/collection-sort';
import { useToast } from '@/hooks/use-toast';
import { useLocalDay } from '@/hooks/use-local-day';
import { MEDIA_LABELS, MEDIA_TYPES, today, uid } from '@/lib/readex';
import type { CommitmentFrequency, CommitmentTracking, Concept, Draft, GoalItem, GoalSettings, GoalType, InquiryGoalMeasure, IntellectualGoalKind, IntellectualGoalStatus, Media, MediaType, PositionGoalMeasure, Practice, PracticeGoalMeasure, Question, SourceGoalMeasure, UserProfile, VaultEntry, WorkGoalMeasure } from '@/lib/types';
import { commitmentDueToday, commitmentPlanReadings, commitmentPositionFocusPatch, commitmentPositionIds, commitmentReviewDue, completedCommitmentDates, localCommitmentDateKey } from '@/lib/commitments';
import { preserveSavedGoalCheckIns, type SaveGoalCheckIn, type SaveGoalPlan } from '@/lib/goal-persistence';
import { AUTOMATIC_COMMITMENT_KINDS, deriveGoalProgress, goalCategories, goalCategoryChange, goalItems, goalMeasureLabel, questKindForGoal, supportsAutomaticCommitment } from '@/lib/goal-progress';
import { NOESIS_ICONS, PRAXIS_METHOD_ICONS } from '@/lib/noesis-icons';

const QUEST_KIND_OPTIONS: Array<{ value: IntellectualGoalKind; label: string; description: string }> = [
  { value: 'consumption', label: 'Consumption', description: 'Complete and reflect on sources.' },
  { value: 'understanding', label: 'Understanding', description: 'Develop command of a concept or field.' },
  { value: 'inquiry', label: 'Inquiry', description: 'Move a question toward clarity.' },
  { value: 'position', label: 'Position', description: 'Develop, test, or revise a belief.' },
  { value: 'expression', label: 'Expression', description: 'Create a work.' },
  { value: 'practice', label: 'Practice', description: 'Apply or test an idea.' },
  { value: 'transformation', label: 'Transformation', description: 'Pursue a broader change in thinking or conduct.' },
  { value: 'reflection', label: 'Reflection', description: 'Maintain a review cadence.' },
  { value: 'custom', label: 'Custom', description: 'Define a personal intellectual quest.' },
];


interface GoalsPageProps {
  goal: GoalSettings;
  goalProgress: Partial<Record<MediaType, number>>;
  concepts: Concept[];
  inquiries: Question[];
  sources: Media[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  profile: UserProfile;
  onSaveGoal: SaveGoalPlan;
  onSaveCheckIn: SaveGoalCheckIn;
  focusedGoalId: string | null;
  onOpenCommitment: (goalId: string | null) => void;
  onOpenPraxis: (method: 'practices' | 'experiments') => void;
}


function questTypeForGoal(item: GoalItem, type?: GoalType) {
  const kind = questKindForGoal(item, type);
  return QUEST_KIND_OPTIONS.find((option) => option.value === kind)?.label || 'Custom';
}

function goalIconForKind(kind: IntellectualGoalKind) {
  if (kind === 'consumption') return NOESIS_ICONS.source;
  if (kind === 'understanding') return NOESIS_ICONS.concept;
  if (kind === 'inquiry') return NOESIS_ICONS.inquiry;
  if (kind === 'position') return NOESIS_ICONS.position;
  if (kind === 'expression') return NOESIS_ICONS.work;
  if (kind === 'practice') return NOESIS_ICONS.practice;
  if (kind === 'reflection' || kind === 'transformation') return NOESIS_ICONS.evolution;
  return NOESIS_ICONS.commitment;
}

function goalProgressDescription(item: GoalItem, type?: GoalType) {
  if (item.commitmentTracking === 'manual') return 'Each completed check-in counts once. Skips do not count toward your target.';
  const kind = questKindForGoal(item, type);
  if (kind === 'consumption') return item.sourceMeasure === 'fully_reflected'
    ? 'Progress updates when a matching finished source has complete details and reflection.'
    : 'Progress updates when a matching source is marked Finished.';
  if (kind === 'inquiry') return item.inquiryMeasure === 'resolved'
    ? 'Progress updates when a matching inquiry is resolved with a saved answer.'
    : item.inquiryMeasure === 'answered'
      ? 'Counts matching inquiries deliberately answered, resolved, or converted with a saved answer.'
      : item.inquiryMeasure === 'provisional'
        ? 'Counts matching inquiries with a saved provisional answer.'
      : 'Progress updates from active inquiries, optionally narrowed to one inquiry or concept.';
  if (kind === 'position') return item.positionMeasure === 'confident'
    ? 'Counts matching current positions at 100% confidence.'
    : item.positionMeasure === 'revised'
      ? 'Progress updates when a matching position is revised.'
      : 'Progress updates when a matching position has a real review, challenge, or revision.';
  if (kind === 'practice') return item.practiceMeasure === 'log_streak'
    ? 'Progress updates from the longest consecutive log streak among matching practices.'
    : item.practiceMeasure === 'logged_days'
      ? 'Progress updates for every distinct day a matching practice is logged.'
      : 'Progress updates when a matching practice is completed, concluded, or integrated.';
  if (kind === 'expression') return item.workMeasure === 'published'
    ? 'Progress updates when a matching work is published.'
    : 'Progress updates when a matching work is complete, final, or published.';
  return 'Progress updates from the activity selected for this goal.';
}

function goalNeedsPurpose(item: GoalItem) {
  return !commitmentPositionIds(item).length && !item.commitmentInquiryId && !item.purpose?.trim();
}

function defaultQuestMilestones(item: GoalItem, type?: GoalType) {
  const questType = questKindForGoal(item, type);
  if (questType === 'consumption') return [
    'Name the question or position this source work should affect.',
    'Choose the next source and state why it matters.',
    'Capture useful annotations while studying.',
    'Write a reflection on what changed or resisted change.',
    'Connect the source to at least one inquiry, concept, position, work, or practice.',
  ];
  if (questType === 'understanding') return [
    'Write a provisional working definition.',
    'List neighboring concepts and likely confusions.',
    'Run a boundary test with edge cases.',
    'Revise the definition after evidence or use cases.',
    'Use the concept in an inquiry, position, or work.',
  ];
  if (questType === 'inquiry') return [
    'Clarify the central question and why it matters.',
    'Identify assumptions behind the question.',
    'Collect evidence for at least two possible answers.',
    'Compare candidate answers and objections.',
    'Write a provisional conclusion or transform the inquiry.',
  ];
  if (questType === 'position') return [
    'State the position in its strongest form.',
    'Add supporting evidence.',
    'Add the strongest objection or counterposition.',
    'Complete a stress test.',
    'Revise, keep, challenge, or abandon the position with a note.',
  ];
  if (questType === 'expression') return [
    'Choose the claim, question, or concept the work expresses.',
    'Build an argument skeleton.',
    'Draft the first complete version.',
    'Run a coherence review.',
    'Publish, archive, or revise with a reflection on what changed.',
  ];
  if (questType === 'practice') return [
    'Choose the idea or position being tested.',
    'Define the hypothesis and observation method.',
    'Perform the practice long enough to gather evidence.',
    'Complete a theory-versus-reality review.',
    'Update the linked position, inquiry, or unknown.',
  ];
  if (questType === 'reflection') return [
    'Choose a review rhythm.',
    'Collect the meaningful changes from the period.',
    'Name what remains unclear.',
    'Decide whether priorities should change.',
    'Record a review note.',
  ];
  return [
    'Name the desired change.',
    'Define evidence of progress.',
    'Create the first concrete step.',
    'Review what changed.',
    'Transform, continue, complete, or abandon the quest.',
  ];
}

export function GoalsPage({ goal, goalProgress, concepts, inquiries, sources, positions, works, practices, profile, onSaveGoal, onSaveCheckIn, focusedGoalId, onOpenCommitment, onOpenPraxis }: GoalsPageProps) {
  const localDay = useLocalDay();
  const dayAnchor = useMemo(() => new Date(`${localDay}T12:00:00`), [localDay]);
  const [draft, setDraft] = useState<GoalSettings>(goal);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const saveLock = useRef(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [commitmentOrder, setCommitmentOrder] = useState<CollectionOrder | 'manual'>('manual');
  const sortCommitments = <T extends { title: string; updatedAt?: string; createdAt?: string }>(items: T[]) =>
    commitmentOrder === 'manual' ? items : sortCollection(items, commitmentOrder, item => item.title, item => item.updatedAt || item.createdAt);
  const [localPlanningGoalId, setPlanningGoalId] = useState<string | null>(null);
  const planningGoalId = focusedGoalId || localPlanningGoalId;
  const [skipGoalId, setSkipGoalId] = useState<string | null>(null);
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const [leavingTo, setLeavingTo] = useState<'practices' | 'experiments' | null>(null);
  const savedDraftRef = useRef(goal);
  const receivedGoalRef = useRef<GoalSettings | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (receivedGoalRef.current === goal) return;
    receivedGoalRef.current = goal;
    const goalTypes = goalCategories(goal);
    const next = {
      ...goal,
      goalTypes,
      goals: goalItems(goal, goalTypes),
    };
    if (draft === savedDraftRef.current) {
      savedDraftRef.current = next;
      setDraft(next);
    } else {
      setDraft((current) => preserveSavedGoalCheckIns(current, next));
    }
    // React to incoming saves, not to each edit of the local draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  const goalTypes = useMemo(() => [...(draft.goalTypes || [])].sort((a, b) => a.sortOrder - b.sortOrder), [draft.goalTypes]);
  const activeGoalTypes = goalTypes.filter((type) => !type.archivedAt);
  const goals = useMemo(() => [...(draft.goals || [])].sort((a, b) => a.sortOrder - b.sortOrder), [draft.goals]);

  const progressContext = useMemo(() => ({ concepts, inquiries, sources, positions, works, practices }),
    [concepts, inquiries, sources, positions, works, practices]);
  const withProgress = useCallback((item: GoalItem, categories: GoalType[]) => {
    const type = categories.find((goalType) => goalType.id === item.typeId);
    return {
      ...item,
      type,
      manualProgress: item.currentProgress,
      ...deriveGoalProgress(item, type, progressContext, goalProgress, dayAnchor),
    };
  }, [dayAnchor, goalProgress, progressContext]);
  const enrichedGoals = useMemo(() => goals.map((item) => withProgress(item, goalTypes)), [goals, goalTypes, withProgress]);
  const savedGoals = useMemo(() => {
    const categories = goalCategories(goal);
    return goalItems(goal, categories).map((item) => withProgress(item, categories));
  }, [goal, withProgress]);

  const focusedGoal = focusedGoalId ? enrichedGoals.find((item) => item.id === focusedGoalId) : undefined;

  const activeGoals = useMemo(
    () => savedGoals.filter((item) => ['active', 'under_review', 'stalled'].includes(item.status)),
    [savedGoals]
  );
  const todayCommitments = useMemo(
    () => savedGoals.filter((item) => commitmentDueToday(item, dayAnchor)),
    [dayAnchor, savedGoals]
  );
  const completedToday = useMemo(() => {
    return savedGoals.filter((item) => completedCommitmentDates(item).includes(localDay));
  }, [savedGoals, localDay]);
  const openCommitment = (id: string) => {
    if (draft === savedDraftRef.current) onOpenCommitment(id);
    else setPlanningGoalId(id);
  };

  const updateGoal = (id: string, patch: Partial<GoalItem>) => {
    setDraft((prev) => ({
      ...prev,
      goals: (prev.goals || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: today() } : item),
    }));
  };

  const recordCommitmentCheckIn = async (item: GoalItem, status: 'completed' | 'skipped', note?: string) => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const now = new Date();
      await onSaveCheckIn(item.id, { id: uid(), date: now.toISOString(), day: localCommitmentDateKey(now), status, ...(note?.trim() ? { note: note.trim() } : {}) });
      setSkipGoalId(null);
      setSkipReasons((reasons) => {
        const { [item.id]: _saved, ...remaining } = reasons;
        return remaining;
      });
      toast({
        title: status === 'completed' ? 'Commitment logged' : 'Skip recorded',
        description: status === 'completed' ? 'Today now counts toward this commitment.' : 'The reason will remain available for review.',
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Check-in not saved', description: error instanceof Error ? error.message : 'Try logging the action again.' });
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const deleteGoal = (id: string) => {
    setDraft((prev) => ({ ...prev, goals: (prev.goals || []).filter((item) => item.id !== id) }));
    setPlanningGoalId((current) => current === id ? null : current);
    if (focusedGoalId === id) onOpenCommitment(null);
    toast({ title: 'Goal removed', description: 'It will be removed when you save your goals.' });
  };

  const addGoal = (commitmentTracking: CommitmentTracking) => {
    const typeId = activeGoalTypes[0]?.id || goalTypes[0]?.id || '';
    const now = today();
    const id = uid();
    setPlanningGoalId(id);
    setDraft((prev) => ({
      ...prev,
      goals: [
        ...(prev.goals || []),
        {
          id,
          title: commitmentTracking === 'automatic' ? 'New automatic commitment' : 'New manual commitment',
          typeId,
          currentProgress: 0,
          targetProgress: 5,
          sortOrder: goals.length,
          status: 'active',
          goalKind: commitmentTracking === 'automatic' ? 'consumption' : 'transformation',
          commitmentTracking,
          commitmentPositionId: null,
          reviewCadence: 'weekly',
          commitmentFrequency: commitmentTracking === 'manual' ? 'daily' : 'weekly',
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    setCreateOpen(false);
  };

  const reorderGoal = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ordered = [...goals];
    const from = ordered.findIndex((item) => item.id === fromId);
    const to = ordered.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setDraft((prev) => ({
      ...prev,
      goals: ordered.map((item, index) => ({ ...item, sortOrder: index, updatedAt: today() })),
    }));
  };

  const updateMilestone = (goalId: string, index: number, value: string) => {
    const target = goals.find((item) => item.id === goalId);
    if (!target) return;
    const milestones = [...(target.milestones || [])];
    milestones[index] = value;
    updateGoal(goalId, { milestones });
  };

  const addMilestone = (goalId: string) => {
    const target = goals.find((item) => item.id === goalId);
    if (!target) return;
    updateGoal(goalId, { milestones: [...(target.milestones || []), ''] });
  };

  const removeMilestone = (goalId: string, index: number) => {
    const target = goals.find((item) => item.id === goalId);
    if (!target) return;
    updateGoal(goalId, { milestones: (target.milestones || []).filter((_, itemIndex) => itemIndex !== index) });
  };

  const adoptQuestPath = (item: GoalItem & { type?: GoalType }) => {
    updateGoal(item.id, { milestones: defaultQuestMilestones(item, item.type) });
    toast({ title: 'Quest path added', description: 'Milestones now define how this goal becomes intellectual development.' });
  };

  const addGoalReview = (item: GoalItem) => {
    const text = reviewDrafts[item.id]?.trim();
    if (!text) return;
    updateGoal(item.id, {
      reviewNotes: [...(item.reviewNotes || []), `${today()}: ${text}`],
      lastReviewAt: today(),
    });
    setReviewDrafts((prev) => ({ ...prev, [item.id]: '' }));
    toast({ title: 'Goal review recorded', description: 'The review now shows what changed, what remains unclear, and whether the path still fits.' });
  };

  const saveGoals = async () => {
    if (saveLock.current) return;
    const trimmedLabel = draft.label.trim() || 'Intellectual Commitments';
    const cleanedTypes = (draft.goalTypes || []).map((type) => ({ ...type, name: type.name.trim() }));
    const duplicateNames = new Set<string>();
    for (const type of cleanedTypes) {
      if (!type.name) {
        toast({ variant: 'destructive', title: 'Goal category name required', description: 'Every goal category needs a name.' });
        return;
      }
      const key = type.name.toLowerCase();
      if (duplicateNames.has(key)) {
        toast({ variant: 'destructive', title: 'Duplicate goal category', description: 'Goal category names need to stay distinct.' });
        return;
      }
      duplicateNames.add(key);
      if (new Set(type.mediaTypes || []).size !== (type.mediaTypes || []).length) {
        toast({ variant: 'destructive', title: 'Duplicate media type', description: `Remove repeated media types from ${type.name}.` });
        return;
      }
    }
    const needsSetup = (item: GoalItem, missing: (value: GoalItem) => boolean) => {
      const previous = savedDraftRef.current.goals?.find((value) => value.id === item.id);
      const isLive = (value: GoalItem) => ['active', 'under_review', 'stalled'].includes(value.status);
      return isLive(item) && missing(item) && (!previous || previous.commitmentTracking !== item.commitmentTracking || !isLive(previous) || !missing(previous));
    };
    const commitmentWithoutAction = (draft.goals || []).find((item) => needsSetup(item, (value) => value.commitmentTracking !== 'automatic' && !value.commitmentAction?.trim()));
    if (commitmentWithoutAction) {
      toast({
        variant: 'destructive',
        title: 'Observable action required',
        description: `Describe what you will actually do for “${commitmentWithoutAction.title}”.`,
      });
      return;
    }
    const commitmentWithoutGrounding = (draft.goals || []).find((item) => needsSetup(item, value => !value.commitmentTracking && goalNeedsPurpose(value)));
    if (commitmentWithoutGrounding) {
      toast({
        variant: 'destructive',
        title: 'Ground this commitment',
        description: `Link “${commitmentWithoutGrounding.title}” to a position or inquiry, or briefly explain why it matters.`,
      });
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const next = { ...draft, label: trimmedLabel, goalTypes: cleanedTypes };
      const saved = await onSaveGoal(next, savedDraftRef.current);
      savedDraftRef.current = saved;
      setDraft((current) => current === draft ? saved : preserveSavedGoalCheckIns(current, saved));
      setSaveError('');
      toast({ title: 'Commitments updated', description: 'Your commitments and their measured practice are now synced.' });
      if (!focusedGoalId && localPlanningGoalId && draft.goals?.some(item => item.id === localPlanningGoalId)) onOpenCommitment(localPlanningGoalId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Noesis could not update your commitments.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const progressSettings = (
    <section className="mb-6" aria-label="Basic goal settings">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          {!focusedGoalId && <h3 className="font-headline text-xl font-bold italic">Your commitments</h3>}
          {!focusedGoalId && <p className="mt-1 text-sm text-muted-foreground">Open one commitment to define its action, grounding, rhythm, and evidence.</p>}
        </div>
        {!focusedGoalId && <span className="text-sm text-muted-foreground">
          {enrichedGoals.length} commitment{enrichedGoals.length === 1 ? '' : 's'}{enrichedGoals.length !== savedGoals.length ? ' in draft' : ''}
        </span>}
      </div>
      <div className="divide-y divide-border border-y border-border">
        {sortCommitments(enrichedGoals.filter((row) => !focusedGoalId || row.id === focusedGoalId)).map((row) => (
          <article key={row.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(150px,.7fr)_minmax(170px,.8fr)_auto] lg:items-end">
            <div>
              <Label htmlFor={`goal-title-${row.id}`} className="readex-kicker flex items-center gap-1.5">{React.createElement(goalIconForKind(questKindForGoal(row, row.type)), { className: 'size-3.5 text-accent', 'aria-hidden': true })} Commitment</Label>
              <Input id={`goal-title-${row.id}`} value={row.title} onChange={(event) => updateGoal(row.id, { title: event.target.value })} className="mt-2 h-10 font-medium" placeholder="What are you working toward?" />
            </div>
            <div>
              {row.commitmentTracking ? <Badge tone="practice">{row.commitmentTracking === 'automatic' ? 'Automatic' : 'Manual'}</Badge> : <>
              <Label htmlFor={`goal-category-${row.id}`} className="readex-kicker">Progress comes from</Label>
              <Select value={row.typeId} onValueChange={(value) => {
                const category = activeGoalTypes.find((type) => type.id === value);
                if (category) updateGoal(row.id, goalCategoryChange(row, row.type, category));
              }}>
                <SelectTrigger id={`goal-category-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{activeGoalTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
              </Select>
              </>}
            </div>
            <div>
              <Label htmlFor={`goal-target-${row.id}`} className="readex-kicker">{row.commitmentTracking ? 'Target' : 'Manual count / target'}</Label>
              <div className="mt-2 flex items-center gap-2">
                {!row.commitmentTracking && <>
                <Button variant="outline" size="icon" onClick={() => updateGoal(row.id, { currentProgress: Math.max(0, row.manualProgress - 1) })} aria-label={`Decrease ${row.title} manual count`}><Minus className="size-3.5" /></Button>
                <Input type="number" min={0} value={row.manualProgress} onChange={(event) => updateGoal(row.id, { currentProgress: Math.max(0, Number(event.target.value) || 0) })} className="h-10 min-w-0 text-center" aria-label={`${row.title} manual count`} />
                <span className="text-muted-foreground">/</span>
                </>}
                <Input id={`goal-target-${row.id}`} type="number" min={1} value={row.targetProgress} onChange={(event) => updateGoal(row.id, { targetProgress: Math.max(1, Number(event.target.value) || 1) })} className="h-10 min-w-0 text-center" aria-label={`${row.title} target progress`} />
                {!row.commitmentTracking &&
                <Button variant="outline" size="icon" onClick={() => updateGoal(row.id, { currentProgress: row.manualProgress + 1 })} aria-label={`Increase ${row.title} manual count`}><Plus className="size-3.5" /></Button>
                }
              </div>
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
              <span className="text-xs text-muted-foreground">{row.currentProgress} total progress</span>
              {!focusedGoalId && <Button variant="outline" size="sm" onClick={() => setPlanningGoalId((current) => current === row.id ? null : row.id)} className="min-h-10 rounded-full px-3">
                {planningGoalId === row.id ? 'Close details' : 'Refine goal'}
              </Button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const checkInControls = (item: GoalItem, due: boolean) => (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {due ? <>
          <Button size="sm" onClick={() => void recordCommitmentCheckIn(item, 'completed')} disabled={saving} aria-label={`Done: log ${item.title} as completed today`}><Check className="size-4" /> Done</Button>
          <Button size="sm" variant="ghost" disabled={saving} aria-expanded={skipGoalId === item.id} onClick={() => setSkipGoalId(current => current === item.id ? null : item.id)}><SkipForward className="size-4" /> Can&apos;t today</Button>
        </> : completedToday.some(done => done.id === item.id) ? <Badge tone="practice">Checked in today</Badge> : null}
        {commitmentReviewDue(item) && <Badge tone="caution">Review due</Badge>}
      </div>
      {due && skipGoalId === item.id && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input className="min-w-0 flex-1" value={skipReasons[item.id] || ''} onChange={event => setSkipReasons(reasons => ({ ...reasons, [item.id]: event.target.value }))} placeholder="Why are you skipping today?" aria-label={`Reason for skipping ${item.title}`} />
          <Button size="sm" variant="outline" disabled={!skipReasons[item.id]?.trim() || saving} onClick={() => void recordCommitmentCheckIn(item, 'skipped', skipReasons[item.id])}>Record</Button>
        </div>
      )}
    </>
  );

  const commitmentWorkspace = (body: React.ReactNode) => focusedGoal ? (
    <ItemWorkspace key={focusedGoal.id} history={<ItemHistoryTimeline title="Commitment history"
      entries={(focusedGoal.commitmentCheckIns || []).map((checkIn) => ({ id: checkIn.id, date: checkIn.day || checkIn.date, title: checkIn.status === 'skipped' ? 'Skipped' : 'Kept', text: checkIn.note }))}
      empty="No check-ins yet. Each one you record lands here." />}>
      {focusedGoal.commitmentTracking !== 'automatic' && <RecordSection id="cmt-keep" title="Keep the commitment">
        {focusedGoal.commitmentAction?.trim() && <p className="mb-3 break-words text-base">{focusedGoal.commitmentAction}</p>}
        {!focusedGoal.commitmentAction?.trim() ? <p className="text-sm text-muted-foreground">Choose the action you want to commit to below.</p>
          : !todayCommitments.some(item => item.id === focusedGoal.id) && !completedToday.some(item => item.id === focusedGoal.id) && <p className="mb-2 text-sm text-muted-foreground">No check-in due today.</p>}
        {checkInControls(focusedGoal, todayCommitments.some(item => item.id === focusedGoal.id))}
      </RecordSection>}
      {body}
    </ItemWorkspace>
  ) : body;

  const sortControl = <SortPill label="Sort commitments" value={commitmentOrder} onChange={setCommitmentOrder} options={[{ value: 'manual', label: 'Default order' }, ...COLLECTION_SORT_OPTIONS]} />;

  return (
    <div className="noesis-page noesis-praxis-scroll noesis-commitments-page" data-noesis-scroll-region data-noesis-identity="commitment-ledger" data-stage-tone={focusedGoal ? 'act' : undefined}>
      <div className="noesis-page-inner">
        {focusedGoal ? (
          <>
            <RecordHeader
              backLabel="Back to commitments"
              onBack={() => { setPlanningGoalId(null); onOpenCommitment(null); }}
              view="Praxis"
              kind="commitment"
              icon={PRAXIS_METHOD_ICONS.commitment}
              status={<Badge tone={focusedGoal.status === 'active' ? 'practice' : commitmentReviewDue(focusedGoal) ? 'caution' : 'neutral'}>{commitmentReviewDue(focusedGoal) ? 'review due' : focusedGoal.status.replace('_', ' ')}</Badge>}
              title={focusedGoal.title}
              subtitle={focusedGoal.commitmentTracking === 'automatic' ? 'Automatic · Counts matching workspace activity' : focusedGoal.commitmentTracking === 'manual' ? 'Manual · Counts your completed check-ins' : 'Keep a promise to yourself.'}
              trailing={<Button onClick={saveGoals} disabled={saving || draft === savedDraftRef.current}><Save className="mr-2 size-4" /> {saving ? 'Saving' : 'Save changes'}</Button>}
            />
          </>
        ) : focusedGoalId ? <PageHeader title="Commitment unavailable" description="This commitment may have been removed."
          actions={<Button variant="outline" onClick={() => onOpenCommitment(null)}>All commitments</Button>} />
        : <PraxisIndexHeader
          method="commitments"
          description="Track a workspace target automatically, or check in on a promise yourself."
          createLabel="New commitment"
          onCreate={() => setCreateOpen(true)}
          onPick={method => {
            if (method === 'commitments' || saving) return;
            if (draft === savedDraftRef.current) onOpenPraxis(method);
            else setLeavingTo(method);
          }}
          secondary={draft !== savedDraftRef.current && <Button variant="outline" onClick={saveGoals} disabled={saving}><Save className="size-4" /> {saving ? 'Saving' : 'Save changes'}</Button>}
        />}
        {saveError && (
          <div className="mb-4 flex flex-wrap items-center gap-3 border border-destructive/50 p-3">
            <p role="alert" className="flex-1 text-sm text-destructive">{saveError}</p>
            <Button type="button" variant="outline" disabled={saving} onClick={() => {
              const goalTypes = goalCategories(goal);
              const latest = { ...goal, goalTypes, goals: goalItems(goal, goalTypes) };
              savedDraftRef.current = latest;
              setDraft(latest);
              setPlanningGoalId(null);
              setSaveError('');
            }}>Discard draft</Button>
          </div>
        )}

        {!planningGoalId && (
          <div className="space-y-5">
            {([
              { title: 'Due today', items: todayCommitments, due: true },
              { title: 'Ongoing check-ins', items: activeGoals.filter(item => item.commitmentTracking !== 'automatic' && !todayCommitments.some(due => due.id === item.id)), due: false },
              { title: 'Automatic', items: activeGoals.filter(item => item.commitmentTracking === 'automatic'), due: false },
            ]).filter(group => group.items.length > 0).map((group, index) => (
              <PraxisCardGroup key={group.title} title={group.title} count={group.items.length} actions={index === 0 ? sortControl : undefined}>
                {sortCommitments(group.items).map(item => (
                  <Card key={item.id} className="flex min-w-0 flex-col gap-3 self-start p-4" data-stage-tone="act">
                    <div className="flex items-start gap-2">
                      <PRAXIS_METHOD_ICONS.commitment className="mt-1 size-4 shrink-0 text-[hsl(var(--stage))]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <button type="button" className="text-left font-headline text-lg font-semibold leading-tight italic break-words hover:underline" onClick={() => openCommitment(item.id)}>{item.title}</button>
                        {item.commitmentAction && <p className="mt-1 break-words text-sm text-muted-foreground">{item.commitmentAction}</p>}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>{goalMeasureLabel(item, item.type)}</span><span>{item.currentProgress}/{item.targetProgress}</span></div>
                      <Progress value={item.percent} aria-label={`Progress for ${item.title}`} aria-valuetext={`${item.currentProgress} of ${item.targetProgress}`} className="h-2" />
                    </div>
                    {item.commitmentTracking !== 'automatic' && checkInControls(item, group.due)}
                  </Card>
                ))}
              </PraxisCardGroup>
            ))}
            {!activeGoals.length && !todayCommitments.length && <PageEmptyState title="No active commitments" description="Choose an action to keep or a workspace target to track." />}
            {savedGoals.some(item => !activeGoals.some(active => active.id === item.id)) && <FooterSection title="Past commitments">
              {!activeGoals.length && !todayCommitments.length && <div className="mb-2 flex justify-end">{sortControl}</div>}
              <ul className="space-y-1">{sortCommitments(savedGoals.filter(item => !activeGoals.some(active => active.id === item.id))).map(item => (
                <li key={item.id}><Button type="button" variant="link" className="h-auto min-h-10 whitespace-normal px-0 text-left" onClick={() => openCommitment(item.id)}>{item.title}</Button></li>
              ))}</ul>
            </FooterSection>}
          </div>
        )}

        {planningGoalId && (!focusedGoalId || focusedGoal) && commitmentWorkspace(
          <>

            {planningGoalId && (() => {
              const planningGoal = enrichedGoals.find((item) => item.id === planningGoalId);
              if (!planningGoal) return null;
              const lastCheckIn = planningGoal.commitmentCheckIns?.at(-1);
              return (
              <section className="border-y border-border py-5" aria-label={`Plan ${planningGoal.title}`}>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {!focusedGoalId && <>
                      <div className="noesis-eyebrow font-bold text-accent">Goal details</div>
                      <h2 className="mt-1 font-headline text-2xl font-bold italic">{planningGoal.title}</h2>
                    </>}
                    {!focusedGoalId && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Choose what counts toward this commitment.</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={planningGoal.status} onValueChange={(value) => updateGoal(planningGoal.id, { status: value as IntellectualGoalStatus })}>
                      <SelectTrigger className="min-h-10 w-[150px] rounded-full" aria-label={`Status for ${planningGoal.title}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="stalled">Paused</SelectItem>
                        <SelectItem value="under_review">Reviewing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" tone="problem" onClick={() => deleteGoal(planningGoal.id)} className="min-h-10 rounded-full">Delete commitment</Button>
                    {!focusedGoalId && <Button variant="ghost" size="sm" onClick={() => setPlanningGoalId(null)} className="min-h-10 rounded-full">Close details</Button>}
                  </div>
                </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]">
          {enrichedGoals.filter((row) => row.id === planningGoalId).map((row) => (
            <React.Fragment key={`simple-plan:${row.id}`}>
              <RecordSection id="cmt-commit" title={row.commitmentTracking === 'automatic' ? 'Automatic tracking' : 'Define the promise'} className="self-start" defaultOpen={!focusedGoalId || row.commitmentTracking === 'automatic' || !row.commitmentAction?.trim()}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label htmlFor={`commitment-mode-${row.id}`}>Tracking mode</Label>
                    <Select value={row.commitmentTracking || 'existing'} onValueChange={(value) => {
                      if (value !== 'automatic' && value !== 'manual') return;
                      const kind = questKindForGoal(row, row.type);
                      updateGoal(row.id, {
                        commitmentTracking: value,
                        ...(value === 'automatic' && { goalKind: supportsAutomaticCommitment(kind) ? kind : 'consumption' }),
                        ...(value === 'automatic' && !row.commitmentTracking && kind === 'consumption' && !row.sourceType && row.type?.mediaTypes?.length === 1 && { sourceType: row.type.mediaTypes[0] }),
                      });
                    }}>
                      <SelectTrigger id={`commitment-mode-${row.id}`} className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {!row.commitmentTracking && <SelectItem value="existing" disabled>Existing tracking</SelectItem>}
                        <SelectItem value="automatic">Automatic · Workspace activity</SelectItem>
                        <SelectItem value="manual">Manual · Completed check-ins</SelectItem>
                      </SelectContent>
                    </Select>
                    {!row.commitmentTracking && <p className="mt-2 text-xs text-muted-foreground">Existing totals keep their current tracking until you choose a mode. Switching recalculates progress without removing check-in history.</p>}
                  </div>
                  {row.commitmentTracking && <>
                    <label className="grid content-start gap-2 text-sm font-medium">Commitment name
                      <Input value={row.title} onChange={event => updateGoal(row.id, { title: event.target.value })} />
                    </label>
                    <label className="grid content-start gap-2 text-sm font-medium">Target
                      <Input type="number" min={1} value={row.targetProgress} onChange={event => updateGoal(row.id, { targetProgress: Math.max(1, Number(event.target.value) || 1) })} />
                    </label>
                  </>}
                  {row.commitmentTracking === 'automatic' && <div className="md:col-span-2">
                    <Label htmlFor={`commitment-kind-${row.id}`}>Workspace activity</Label>
                    <Select value={questKindForGoal(row, row.type)} onValueChange={(value) => {
                      const goalKind = AUTOMATIC_COMMITMENT_KINDS.find(kind => kind === value);
                      if (!goalKind) return;
                      updateGoal(row.id, {
                        goalKind,
                        commitmentPositionId: row.commitmentPositionId === undefined ? commitmentPositionIds(row)[0] ?? null : row.commitmentPositionId,
                        relatedObjectIds: { conceptIds: row.relatedObjectIds?.conceptIds || [] },
                      });
                    }}>
                      <SelectTrigger id={`commitment-kind-${row.id}`} className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>{AUTOMATIC_COMMITMENT_KINDS.map((kind, index) => <SelectItem key={kind} value={kind}>{['Library sources', 'Inquiries', 'Positions', 'Praxis', 'Works'][index]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>}
                  {row.commitmentTracking !== 'automatic' && <div>
                    <Label htmlFor={`commitment-action-${row.id}`} className="text-sm font-medium">Action promised</Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Write one observable action, not an intention or paragraph.</p>
                    <Input id={`commitment-action-${row.id}`} value={row.commitmentAction || ''} onChange={(event) => updateGoal(row.id, { commitmentAction: event.target.value })} className="mt-2 h-10" placeholder="For example: Read for 20 minutes without my phone" />
                  </div>}
                  <div>
                    <Label htmlFor={`commitment-position-${row.id}`} className="text-sm font-medium">Position this expresses</Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Link a position this action puts into practice.</p>
                    <Select value={commitmentPositionIds(row)[0] || 'no-linked-position'} onValueChange={(value) => updateGoal(row.id, { commitmentPositionId: value === 'no-linked-position' ? null : value })}>
                      <SelectTrigger id={`commitment-position-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="no-linked-position">No linked position</SelectItem>{positions.filter((position) => position.status !== 'abandoned').map((position) => <SelectItem key={position.id} value={position.id}>{position.title || position.statement}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`commitment-inquiry-${row.id}`} className="text-sm font-medium">Inquiry this follows up on</Label>
                    <Select value={row.commitmentInquiryId || 'no-linked-inquiry'} onValueChange={value => updateGoal(row.id, { commitmentInquiryId: value === 'no-linked-inquiry' ? null : value })}>
                      <SelectTrigger id={`commitment-inquiry-${row.id}`} className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="no-linked-inquiry">No linked inquiry</SelectItem>{inquiries.map(inquiry => <SelectItem key={inquiry.id} value={inquiry.id}>{inquiry.text}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {row.commitmentTracking !== 'automatic' && <div>
                    <Label htmlFor={`commitment-frequency-${row.id}`} className="text-sm font-medium">How often?</Label>
                    <Select value={row.commitmentFrequency || 'weekly'} onValueChange={(value) => updateGoal(row.id, { commitmentFrequency: value as CommitmentFrequency })}>
                      <SelectTrigger id={`commitment-frequency-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="custom">Flexible</SelectItem></SelectContent>
                    </Select>
                  </div>}
                  <div>
                    <Label htmlFor={`commitment-review-${row.id}`} className="text-sm font-medium">Review date</Label>
                    <Input id={`commitment-review-${row.id}`} type="date" value={row.commitmentReviewDate || ''} onChange={(event) => updateGoal(row.id, { commitmentReviewDate: event.target.value || undefined })} className="mt-2 h-10" />
                  </div>
                </div>
                {row.commitmentTracking !== 'manual' && (supportsAutomaticCommitment(questKindForGoal(row, row.type)) ? (
                  <FooterSection title="What counts toward progress" defaultOpen={row.commitmentTracking === 'automatic'}>
                    <div className="mb-3 flex items-center gap-2">
                      <Target className="size-4 text-accent" aria-hidden="true" />
                      <div>
                        <h4 className="text-sm font-medium">{questTypeForGoal(row, row.type)}</h4>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label className="text-sm font-medium">Count</Label>
                        <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">Choose the result that moves the number.</p>
                        {questKindForGoal(row, row.type) === 'consumption' && <Select value={row.sourceMeasure || 'finished'} onValueChange={(value) => updateGoal(row.id, { sourceMeasure: value as SourceGoalMeasure })}><SelectTrigger className="mt-2 h-10" aria-label="Source result counted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="finished">Finished sources</SelectItem><SelectItem value="fully_reflected">Complete source records</SelectItem></SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'inquiry' && <Select value={row.inquiryMeasure || 'active'} onValueChange={(value) => updateGoal(row.id, { inquiryMeasure: value as InquiryGoalMeasure })}><SelectTrigger className="mt-2 h-10" aria-label="Inquiry result counted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active inquiries</SelectItem><SelectItem value="provisional">Inquiries with provisional answers</SelectItem><SelectItem value="answered">Deliberately answered inquiries</SelectItem><SelectItem value="resolved">Resolved inquiries</SelectItem></SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'position' && <Select value={row.positionMeasure || 'reviewed'} onValueChange={(value) => updateGoal(row.id, { positionMeasure: value as PositionGoalMeasure })}><SelectTrigger className="mt-2 h-10" aria-label="Position result counted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reviewed">Positions reviewed</SelectItem><SelectItem value="revised">Positions revised</SelectItem><SelectItem value="confident">Positions at 100% confidence</SelectItem></SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'practice' && <Select value={row.practiceMeasure || 'completed'} onValueChange={(value) => updateGoal(row.id, { practiceMeasure: value as PracticeGoalMeasure })}><SelectTrigger className="mt-2 h-10" aria-label="Practice result counted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">Completed practices</SelectItem><SelectItem value="logged_days">Days logged</SelectItem><SelectItem value="log_streak">Longest log streak</SelectItem></SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'expression' && <Select value={row.workMeasure || 'completed'} onValueChange={(value) => updateGoal(row.id, { workMeasure: value as WorkGoalMeasure })}><SelectTrigger className="mt-2 h-10" aria-label="Work result counted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">Completed works</SelectItem><SelectItem value="published">Published works</SelectItem></SelectContent></Select>}
                      </div>

                      <div>
                        <Label htmlFor={`goal-concept-${row.id}`} className="text-sm font-medium">Content focus</Label>
                        <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">Optional. Count only activity tagged with one concept.</p>
                        <Select value={row.relatedObjectIds?.conceptIds?.[0] || 'all-concepts'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, conceptIds: value === 'all-concepts' ? [] : [value] } })}>
                          <SelectTrigger id={`goal-concept-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all-concepts">Any concept</SelectItem>
                            {row.relatedObjectIds?.conceptIds?.[0] && !concepts.some((concept) => concept.id === row.relatedObjectIds?.conceptIds?.[0]) && (
                              <SelectItem value={row.relatedObjectIds.conceptIds[0]} disabled>Selected concept unavailable</SelectItem>
                            )}
                            {concepts.map((concept) => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Item focus</Label>
                        <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">Optional. Narrow progress to one item or source type.</p>
                        {questKindForGoal(row, row.type) === 'consumption' && <Select value={row.sourceType || 'all-source-types'} onValueChange={(value) => updateGoal(row.id, { sourceType: value === 'all-source-types' ? undefined : value as MediaType })}><SelectTrigger className="mt-2 h-10" aria-label="Source type focus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-source-types">{row.type?.mediaTypes?.length ? `Category default: ${row.type.mediaTypes.map((type) => MEDIA_LABELS[type]).join(', ')}` : 'Any source type'}</SelectItem>{MEDIA_TYPES.map((mediaType) => <SelectItem key={mediaType} value={mediaType}>{MEDIA_LABELS[mediaType]}</SelectItem>)}</SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'inquiry' && <Select value={row.relatedObjectIds?.inquiryIds?.[0] || 'all-inquiries'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, inquiryIds: value === 'all-inquiries' ? [] : [value] } })}><SelectTrigger className="mt-2 h-10" aria-label="Inquiry focus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-inquiries">Any inquiry</SelectItem>{inquiries.filter((inquiry) => !['archived', 'no_longer_meaningful'].includes(inquiry.status)).map((inquiry) => <SelectItem key={inquiry.id} value={inquiry.id}>{inquiry.text}</SelectItem>)}</SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'position' && <Select value={row.relatedObjectIds?.positionIds?.[0] || 'all-positions'} onValueChange={(value) => updateGoal(row.id, commitmentPositionFocusPatch(row, value === 'all-positions' ? null : value))}><SelectTrigger className="mt-2 h-10" aria-label="Position focus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-positions">Any position</SelectItem>{positions.filter((position) => position.status !== 'abandoned').map((position) => <SelectItem key={position.id} value={position.id}>{position.title || position.statement}</SelectItem>)}</SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'practice' && <Select value={row.relatedObjectIds?.practiceIds?.[0] || 'all-practices'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, practiceIds: value === 'all-practices' ? [] : [value] } })}><SelectTrigger className="mt-2 h-10" aria-label="Practice focus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-practices">Any practice</SelectItem>{practices.filter((practice) => practice.status !== 'abandoned').map((practice) => <SelectItem key={practice.id} value={practice.id}>{practice.title}</SelectItem>)}</SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'expression' && <Select value={row.relatedObjectIds?.workIds?.[0] || 'all-works'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, workIds: value === 'all-works' ? [] : [value] } })}><SelectTrigger className="mt-2 h-10" aria-label="Work focus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-works">Any work</SelectItem>{works.filter((work) => !['archived', 'abandoned'].includes(work.status)).map((work) => <SelectItem key={work.id} value={work.id}>{work.title}</SelectItem>)}</SelectContent></Select>}
                      </div>
                    </div>
                  </FooterSection>
                ) : null)}
              </RecordSection>

              <RecordSection id="cmt-progress" title="Progress" className="self-start">
                <CommitmentGauge key={row.id} target={row.targetProgress} readings={commitmentPlanReadings(row, row, dayAnchor)}
                  measureLabel={goalMeasureLabel(row, row.type)} paced={row.commitmentTracking === 'manual'} />
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="font-headline text-4xl font-bold italic leading-none">{Math.round(row.percent)}%</div>
                  <span className="text-sm text-muted-foreground">{row.currentProgress} of {row.targetProgress}</span>
                </div>
                <Progress value={row.percent} aria-label={`Progress for ${row.title}`} aria-valuetext={`${row.currentProgress} of ${row.targetProgress}`} className="mt-3 h-2" />
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{goalProgressDescription(row, row.type)}</p>
                {row.commitmentTracking !== 'automatic' && lastCheckIn && <div className="mt-4 border-t border-border pt-3 text-sm">
                  <p className="font-medium">{lastCheckIn.status === 'skipped' ? 'Last check-in: skipped' : 'Last check-in: completed'}</p>
                  {lastCheckIn.note && <p className="mt-1 break-words text-muted-foreground">{lastCheckIn.note}</p>}
                </div>}
              </RecordSection>

              <RecordSection id="cmt-review" title="Review the commitment" className="lg:col-span-2" defaultOpen={commitmentReviewDue(row)}>
                  <div className="grid gap-4">
                    <div className="hidden border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><h4 className="text-sm font-medium">Milestones</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Break the goal into a few meaningful steps.</p></div>
                        {!(row.milestones || []).length ? <Button variant="outline" size="sm" onClick={() => adoptQuestPath(row)} className="min-h-9 rounded-full">Suggest steps</Button> : <Button variant="outline" size="sm" onClick={() => addMilestone(row.id)} className="min-h-9 rounded-full"><Plus className="mr-1 size-3.5" /> Add step</Button>}
                      </div>
                      <div className="mt-3 space-y-2">
                        {((row.milestones || []).length ? row.milestones || [] : defaultQuestMilestones(row, row.type)).map((milestone, index) => (
                          <div key={`${row.id}:simple-milestone:${index}`} className="flex items-center gap-2 text-sm">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border noesis-figure noesis-figure--sm">{index + 1}</span>
                            {(row.milestones || []).length ? <Input value={milestone} onChange={(event) => updateMilestone(row.id, index, event.target.value)} className="h-9" /> : <span className="leading-5 text-muted-foreground">{milestone}</span>}
                            {(row.milestones || []).length ? <Button variant="ghost" size="icon" onClick={() => removeMilestone(row.id, index)} className="size-9 shrink-0" aria-label={`Remove milestone ${index + 1}`}><Trash2 className="size-3.5" /></Button> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`commitment-reflection-${row.id}`}>Does this promise still fit?</Label>
                      <Textarea id={`commitment-reflection-${row.id}`} value={reviewDrafts[row.id] || ''} onChange={(event) => setReviewDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))} className="mt-2 min-h-24" placeholder="What helped you keep it? Would you change anything?" />
                      <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{row.lastReviewAt ? `Last review ${new Date(row.lastReviewAt).toLocaleDateString()}` : 'No review yet'}</span><Button size="sm" onClick={() => addGoalReview(row)} className="min-h-9 rounded-full">Save reflection</Button></div>
                    </div>
                  </div>
              </RecordSection>
            </React.Fragment>
          ))}
        </div>
              </section>
              );
            })()}
            {focusedGoalId && !focusedGoal?.commitmentTracking && <FooterSection title="Progress settings">{progressSettings}</FooterSection>}
            {focusedGoal && (
              <RecordFooter>
                <FooterSection title="Connections">
                  <Connections groups={[
                    { type: 'Positions', tone: 'position', items: positions.filter((item) => commitmentPositionIds(focusedGoal).includes(item.id) || (focusedGoal.relatedObjectIds?.positionIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.title || item.statement, meta: commitmentPositionIds(focusedGoal).includes(item.id) ? 'Position this expresses' : 'Count filter' })) },
                    { type: 'Inquiries', tone: 'inquiry', items: inquiries.filter((item) => item.id === focusedGoal.commitmentInquiryId || (focusedGoal.relatedObjectIds?.inquiryIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.text, meta: item.id === focusedGoal.commitmentInquiryId ? 'Follow-up inquiry' : 'Count filter' })) },
                    { type: 'Praxis', tone: 'practice', items: practices.filter((item) => (focusedGoal.relatedObjectIds?.practiceIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.title, meta: item.status.replace(/_/g, ' '), onOpen: () => onOpenPraxis(item.type === 'experiment' ? 'experiments' : 'practices') })) },
                    { type: 'Works', tone: 'work', items: works.filter((item) => (focusedGoal.relatedObjectIds?.workIds || []).includes(item.id)).map((item) => ({ id: item.id, label: item.title || 'Untitled' })) },
                  ]} />
                </FooterSection>
                <FooterSection title="Record">
                  <EntityMeta items={[
                    { label: 'Counts', value: goalMeasureLabel(focusedGoal, focusedGoal.type) },
                    { label: 'Status', value: focusedGoal.status.replace(/_/g, ' ') },
                    { label: 'Progress', value: `${focusedGoal.currentProgress} of ${focusedGoal.targetProgress}` },
                    { label: 'Review', value: focusedGoal.commitmentReviewDate?.slice(0, 10) || '—' },
                  ]} />
                </FooterSection>
              </RecordFooter>
            )}
          </>
        )}
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New commitment</DialogTitle><DialogDescription>How should progress be tracked?</DialogDescription></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-auto min-h-16 flex-col items-start whitespace-normal py-3 text-left" onClick={() => addGoal('automatic')}>
              <strong>Automatic</strong><span className="text-xs text-muted-foreground">Count matching Noesis records.</span>
            </Button>
            <Button variant="outline" className="h-auto min-h-16 flex-col items-start whitespace-normal py-3 text-left" onClick={() => addGoal('manual')}>
              <strong>Manual</strong><span className="text-xs text-muted-foreground">Log what you did yourself.</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={leavingTo !== null}
        onOpenChange={(next) => { if (!next) setLeavingTo(null); }}
        title="Leave without saving?"
        description="Your commitment changes have not been saved. Leaving now discards them."
        confirmLabel="Leave without saving"
        destructive
        onConfirm={() => { const target = leavingTo; setLeavingTo(null); if (target) onOpenPraxis(target); }}
      />
      </div>
  );
}
