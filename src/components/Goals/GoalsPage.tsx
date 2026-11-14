"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clock3, Compass, Minus, Plus, Puzzle, Save, Settings2, SkipForward, Target, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { useToast } from '@/hooks/use-toast';
import { useLocalDay } from '@/hooks/use-local-day';
import { MEDIA_LABELS, MEDIA_TYPES, today, uid } from '@/lib/readex';
import type { CommitmentFrequency, Concept, Draft, GoalItem, GoalSettings, GoalType, InquiryGoalMeasure, IntellectualGoalKind, IntellectualGoalStatus, Media, MediaType, PositionGoalMeasure, Practice, PracticeGoalMeasure, Question, SourceGoalMeasure, UserProfile, VaultEntry, WorkGoalMeasure } from '@/lib/types';
import { commitmentActivityToDate, commitmentDueToday, commitmentPositionFocusPatch, commitmentPositionIds, commitmentReviewDue, completedCommitmentDates, localCommitmentDateKey } from '@/lib/commitments';
import { preserveSavedGoalCheckIns, type SaveGoalCheckIn, type SaveGoalPlan } from '@/lib/goal-persistence';
import { deriveGoalProgress, goalCategories, goalCategoryChange, goalItems, goalKindForType, questKindForGoal } from '@/lib/goal-progress';
import { practiceLogDates } from '@/lib/practice-state';
import { NOESIS_ICONS } from '@/lib/noesis-icons';

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

type GoalsView = 'today' | 'active' | 'review';

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
  onOpenPraxis: (method: 'exercises' | 'practices' | 'experiments') => void;
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
  const kind = questKindForGoal(item, type);
  if (kind === 'consumption') return item.sourceMeasure === 'fully_reflected'
    ? 'Progress updates when a matching finished source has complete details and reflection.'
    : 'Progress updates when a matching source is marked Finished.';
  if (kind === 'inquiry') return item.inquiryMeasure === 'resolved'
    ? 'Progress updates when a matching inquiry is resolved with a saved answer.'
    : item.inquiryMeasure === 'answered'
      ? 'Progress updates when a matching inquiry has a saved answer.'
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

function questNextStep(item: GoalItem & { percent?: number }, type?: GoalType) {
  if (!item.commitmentAction?.trim()) return 'Define one observable action for this commitment.';
  if (!commitmentPositionIds(item).length && !item.purpose?.trim()) return 'Link the Position this commitment expresses.';
  if ((item.percent || 0) >= 100 || item.status === 'completed') return 'Write a review: what changed, what remains unclear, and whether the goal should transform.';
  if (commitmentDueToday(item)) return item.commitmentAction || `Complete the next ${questTypeForGoal(item, type)} action.`;
  return 'No action is due today. Review this commitment when its next interval arrives.';
}

function goalNeedsPurpose(item: GoalItem) {
  return !commitmentPositionIds(item).length && !item.purpose?.trim();
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
  const saveLock = useRef(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [listView, setActiveView] = useState<GoalsView>('today');
  const activeView = focusedGoalId ? 'active' : listView;
  const [localPlanningGoalId, setPlanningGoalId] = useState<string | null>(null);
  const planningGoalId = focusedGoalId || localPlanningGoalId;
  const [skipGoalId, setSkipGoalId] = useState<string | null>(null);
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const savedDraftRef = useRef(goal);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
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
      ...deriveGoalProgress(item, type, progressContext, goalProgress),
    };
  }, [goalProgress, progressContext]);
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
  const todayFocusGoal = todayCommitments[0];
  const completedToday = useMemo(() => {
    return savedGoals.filter((item) => completedCommitmentDates(item).includes(localDay));
  }, [savedGoals, localDay]);
  const sayDoRows = useMemo(() => activeGoals.flatMap((item) => {
    const linkedPositions = positions.filter((position) => commitmentPositionIds(item).includes(position.id));
    if (!linkedPositions.length) return [];
    const linkedPractices = practices.filter((practice) => (
      (item.relatedObjectIds?.practiceIds || []).includes(practice.id)
      || practice.positionIds.some((positionId) => linkedPositions.some((position) => position.id === positionId))
    ));
    const confidence = Math.round(linkedPositions.reduce((sum, position) => sum + position.confidence, 0) / linkedPositions.length);
    const { loggedDays, expectedSoFar, livedPercent } = commitmentActivityToDate(item, linkedPractices.flatMap(practiceLogDates), dayAnchor);
    return [{
      id: item.id,
      title: item.title,
      positionLabel: linkedPositions[0].title || linkedPositions[0].statement,
      confidence,
      loggedDays,
      expectedSoFar,
      livedPercent,
      gap: Math.max(0, confidence - livedPercent),
    }];
  }).sort((a, b) => b.gap - a.gap), [activeGoals, dayAnchor, positions, practices]);

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

  const addGoal = () => {
    const typeId = activeGoalTypes[0]?.id || goalTypes[0]?.id;
    if (!typeId) return;
    const now = today();
    setDraft((prev) => ({
      ...prev,
      goals: [
        ...(prev.goals || []),
        {
          id: uid(),
          title: activeGoalTypes.find((type) => type.id === typeId)?.name || 'New Goal Category',
          typeId,
          currentProgress: 0,
          targetProgress: 5,
          sortOrder: goals.length,
          status: 'active',
          goalKind: goalKindForType(activeGoalTypes.find((type) => type.id === typeId), activeGoalTypes.find((type) => type.id === typeId)?.name || ''),
          commitmentPositionId: null,
          purpose: 'Choose a measurable Noesis milestone you want to reach.',
          evidenceOfProgress: 'Progress is counted from the selected app activity or adjusted manually.',
          completionCriteria: 'Reach the target and review what the milestone changed in your thinking.',
          reviewCadence: 'weekly',
          commitmentFrequency: 'weekly',
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
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
      return isLive(item) && missing(item) && (!previous || !isLive(previous) || !missing(previous));
    };
    const commitmentWithoutAction = (draft.goals || []).find((item) => needsSetup(item, (value) => !value.commitmentAction?.trim()));
    if (commitmentWithoutAction) {
      toast({
        variant: 'destructive',
        title: 'Observable action required',
        description: `Describe what you will actually do for “${commitmentWithoutAction.title}”.`,
      });
      return;
    }
    const commitmentWithoutGrounding = (draft.goals || []).find((item) => needsSetup(item, goalNeedsPurpose));
    if (commitmentWithoutGrounding) {
      toast({
        variant: 'destructive',
        title: 'Ground this commitment',
        description: `Link “${commitmentWithoutGrounding.title}” to a Position or briefly explain why it matters.`,
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
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Noesis could not update your commitments.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="noesis-page noesis-commitments-page" data-noesis-identity="commitment-ledger">
      <div className="noesis-page-inner">
        <PageHeader
          title={focusedGoalId ? focusedGoal?.title || 'Commitment unavailable' : 'Praxis'}
          description={focusedGoalId
            ? focusedGoal ? `${focusedGoal.currentProgress} of ${focusedGoal.targetProgress} toward this commitment` : 'This commitment may have been removed.'
            : 'Commitments help you uphold a chosen principle and compare what you say matters with what you repeatedly do.'}
          meta={!focusedGoalId && (
            <>
              <GoalStat label="Active" value={activeGoals.length} />
              <GoalStat label="Completed" value={savedGoals.filter((item) => item.status === 'completed').length} />
            </>
          )}
          tabs={!focusedGoalId && (
            <div className="space-y-2">
              <WorkspaceTabs<'exercises' | 'practices' | 'experiments' | 'commitments'>
                activation="manual"
                value="commitments"
                onChange={(method) => {
                  if (method !== 'commitments') onOpenPraxis(method);
                }}
                label="Praxis methods"
                className="max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:overflow-hidden max-sm:[&>button]:min-w-0 max-sm:[&>button]:gap-1 max-sm:[&>button]:px-1.5 max-sm:[&>button]:text-xs"
                items={[
                  { id: 'exercises', label: 'Exercises', icon: Puzzle },
                  { id: 'practices', label: 'Practices', icon: NOESIS_ICONS.practice },
                  { id: 'experiments', label: 'Experiments', icon: NOESIS_ICONS.lab },
                  { id: 'commitments', label: 'Commitments', icon: NOESIS_ICONS.commitment },
                ]}
              />
              <WorkspaceTabs
                value={activeView}
                onChange={setActiveView}
                label="Commitment views"
                items={[
                  { id: 'today', label: 'Today', icon: NOESIS_ICONS.commitment },
                  { id: 'active', label: 'Active', icon: Settings2 },
                  { id: 'review', label: 'Insights', icon: Clock3 },
                ]}
              />
            </div>
          )}
          actions={(
            <>
            {focusedGoalId ? <Button variant="outline" onClick={() => onOpenCommitment(null)}>All commitments</Button> : <Button variant="outline" onClick={addGoal} className="rounded-full bg-card">
              <Plus className="mr-2 size-4" /> Add Commitment
            </Button>}
            {(!focusedGoalId || focusedGoal) && <Button onClick={saveGoals} disabled={saving} className="rounded-full px-7 font-bold shadow-md shadow-accent/20">
              <Save className="mr-2 size-4" /> {saving ? 'Saving' : 'Save Commitments'}
            </Button>}
            </>
          )}
        />
        {saveError && (
          <div className="mb-4 flex flex-wrap items-center gap-3 border border-destructive/50 p-3">
            <p role="alert" className="flex-1 text-sm text-destructive">{saveError}</p>
            <Button type="button" variant="outline" disabled={saving} onClick={() => {
              const goalTypes = goalCategories(goal);
              const latest = { ...goal, goalTypes, goals: goalItems(goal, goalTypes) };
              savedDraftRef.current = latest;
              setDraft(latest);
              setSaveError('');
            }}>Discard draft</Button>
          </div>
        )}

        {activeView === 'today' && (
          <div className="space-y-6" role="tabpanel" aria-label="Commitments due today">
            <section className="border-y border-border bg-card/35 py-5 md:py-7">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                    <Compass className="size-4" aria-hidden="true" /> Today&apos;s focus
                  </div>
                  {todayFocusGoal ? (
                    <>
                      <h2 className="mt-2 max-w-3xl font-headline text-2xl font-bold italic leading-tight md:text-3xl">{todayFocusGoal.commitmentAction || todayFocusGoal.title}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{todayFocusGoal.commitmentAction ? todayFocusGoal.title : questNextStep(todayFocusGoal, todayFocusGoal.type)}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-2 font-headline text-2xl font-bold italic">{activeGoals.length ? 'Nothing is due today' : 'Create your first meaningful commitment'}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{activeGoals.length ? 'Scheduled actions appear here. Review reminders are in Insights.' : 'Choose one Position you want your conduct to test, or state why the commitment matters.'}</p>
                    </>
                  )}
                </div>
                {todayFocusGoal ? (
                  <div className="flex items-end gap-3 md:text-right">
                    <div>
                      <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Progress</div>
                      <div className="font-headline text-3xl font-bold italic">{Math.round(todayFocusGoal.percent)}%</div>
                    </div>
                    <Button variant="outline" onClick={() => { setPlanningGoalId(todayFocusGoal.id); setActiveView('active'); }} className="min-h-10 rounded-full">
                      Open commitment <ChevronRight className="ml-1 size-4" />
                    </Button>
                  </div>
                ) : activeGoals.length ? (
                  <Button variant="outline" onClick={() => setActiveView('active')} className="min-h-10 rounded-full">View active commitments</Button>
                ) : (
                  <Button onClick={() => { addGoal(); setActiveView('active'); }} className="min-h-10 rounded-full"><Plus className="mr-2 size-4" /> Add commitment</Button>
                )}
              </div>
            </section>

            <section aria-labelledby="active-goals-heading">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="active-goals-heading" className="font-headline text-xl font-bold italic">Due today</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Record the promised action. Practice logs also count automatically when they are linked.</p>
                </div>
                <span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{todayCommitments.length} due · {completedToday.length} done</span>
              </div>
              {todayCommitments.length ? (
                <div className="divide-y divide-border border-y border-border">
                  {todayCommitments.map((item) => {
                    const ItemIcon = goalIconForKind(questKindForGoal(item, item.type));
                    return (
                      <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)_auto] sm:items-center">
                        <div className="flex min-w-0 items-start gap-3">
                          <ItemIcon className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2.25} aria-hidden="true" />
                          <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-code text-[9px] font-bold uppercase tracking-widest text-accent">{questTypeForGoal(item, item.type)}</span>
                            {commitmentReviewDue(item) && <Badge variant="outline" className="rounded-full text-[9px] uppercase">Review due</Badge>}
                          </div>
                          <h3 className="mt-1 text-base font-semibold leading-6 text-foreground">{item.title}</h3>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.commitmentAction || questNextStep(item, item.type)}</p>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 flex justify-between font-code text-[9px] uppercase tracking-widest text-muted-foreground"><span>Progress</span><span>{item.currentProgress}/{item.targetProgress}</span></div>
                          <Progress value={item.percent} aria-label={`Progress for ${item.title}`} aria-valuetext={`${item.currentProgress} of ${item.targetProgress}`} className="h-2" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Button onClick={() => void recordCommitmentCheckIn(item, 'completed')} disabled={saving} className="min-h-10 rounded-full px-4" aria-label={`Done: log ${item.title} as completed today`}>
                            <Check className="mr-1.5 size-4" /> Done
                          </Button>
                          <Button variant="ghost" disabled={saving} aria-expanded={skipGoalId === item.id} onClick={() => setSkipGoalId((current) => current === item.id ? null : item.id)} className="min-h-10 px-2 text-sm"><SkipForward className="mr-1 size-4" /> Can&apos;t today</Button>
                          <Button variant="ghost" onClick={() => { setPlanningGoalId(item.id); setActiveView('active'); }} className="min-h-10 px-2 text-sm">Details</Button>
                          {skipGoalId === item.id && (
                            <div className="flex w-full items-center gap-2 sm:max-w-md">
                              <Input value={skipReasons[item.id] || ''} onChange={(event) => setSkipReasons((reasons) => ({ ...reasons, [item.id]: event.target.value }))} placeholder="Why are you skipping today?" aria-label={`Reason for skipping ${item.title}`} />
                              <Button variant="outline" disabled={!skipReasons[item.id]?.trim() || saving} onClick={() => void recordCommitmentCheckIn(item, 'skipped', skipReasons[item.id])}>Record</Button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed bg-card/50 p-6 text-sm text-muted-foreground">Nothing is due today. Review your active commitments or return when the next action is due.</Card>
              )}
            </section>
          </div>
        )}

        {activeView === 'review' && (
          <div className="space-y-6" role="tabpanel" aria-label="Commitment review">
            <section className="border-y border-border py-5" aria-labelledby="review-due-heading">
              <div className="mb-4">
                <div className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Review</div>
                <h2 id="review-due-heading" className="mt-1 font-headline text-xl font-bold italic">What needs a decision</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Continue, revise, pause, complete, or abandon commitments based on what actually happened.</p>
              </div>
              <div className="divide-y divide-border border-y border-border">
                {activeGoals.filter((item) => commitmentReviewDue(item)).map((item) => {
                  const ItemIcon = goalIconForKind(questKindForGoal(item, item.type));
                  return (
                  <article key={item.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="flex items-start gap-3">
                      <ItemIcon className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2.25} aria-hidden="true" />
                      <div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{completedCommitmentDates(item).length} completed check-ins · {item.currentProgress} of {item.targetProgress} recorded</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => { setPlanningGoalId(item.id); setActiveView('active'); }} className="min-h-10 rounded-full">Review commitment</Button>
                  </article>
                )})}
                {!activeGoals.some((item) => commitmentReviewDue(item)) && (
                  <div className="py-6 text-sm text-muted-foreground">No commitment reviews are due.</div>
                )}
              </div>
            </section>

            {sayDoRows.length > 0 && (
              <section aria-labelledby="say-do-heading" className="border-y border-border py-5">
                <div className="mb-4">
                  <div className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Mirror</div>
                  <h2 id="say-do-heading" className="mt-1 font-headline text-xl font-bold italic">Say / Do gap</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Confidence is compared with the practice expected by today, not the commitment&apos;s full lifetime target.</p>
                </div>
                <div className="divide-y divide-border border-y border-border">
                  {sayDoRows.slice(0, 5).map((row) => (
                    <article key={row.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:items-center">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">{row.title}</h3>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{row.positionLabel}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 font-code text-[10px] uppercase tracking-wider text-muted-foreground">
                        <div><span className="block">Say</span><strong className="mt-1 block text-base text-foreground">{row.confidence}% confidence</strong></div>
                        <div><span className="block">Do</span><strong className="mt-1 block text-base text-foreground">{row.loggedDays} of {row.expectedSoFar} expected</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeView === 'active' && (!focusedGoalId || focusedGoal) && (
          <>
            {!focusedGoalId && <section className="mb-6 border-y border-border py-5 md:py-6" aria-labelledby="goals-heading">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Commitment setup</div>
                  <h2 id="goals-heading" className="mt-1 font-headline text-2xl font-bold italic">Make belief visible in practice</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Name the commitment, link the Position it expresses, and choose the practice evidence that counts.</p>
                </div>
                <Button onClick={addGoal} className="min-h-10 rounded-full"><Plus className="mr-2 size-4" /> Add commitment</Button>
              </div>
              <ol className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['1', 'Name it', 'What are you committing to do?'],
                  ['2', 'Ground it', 'Link the Position it expresses, or explain why it matters.'],
                  ['3', 'Measure it', 'Choose the practice evidence that shows you lived it.'],
                ].map(([number, title, detail]) => (
                  <li key={number} className="flex gap-3 border-l border-border pl-3">
                    <span className="font-code text-[10px] font-bold text-accent">{number}</span>
                    <div><div className="text-sm font-medium">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
                  </li>
                ))}
              </ol>
            </section>}

            <section className="mb-6" aria-label="Basic goal settings">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-headline text-xl font-bold italic">{focusedGoalId ? 'Progress settings' : 'Your commitments'}</h3>
                  {!focusedGoalId && <p className="mt-1 text-sm text-muted-foreground">Open one commitment to define its action, grounding, rhythm, and evidence.</p>}
                </div>
                {!focusedGoalId && <span className="text-sm text-muted-foreground">
                  {enrichedGoals.length} commitment{enrichedGoals.length === 1 ? '' : 's'}{enrichedGoals.length !== savedGoals.length ? ' in draft' : ''}
                </span>}
              </div>
              <p id="goal-manual-rule" className="mb-3 text-sm text-muted-foreground">Progress uses the highest of your manual count, matching activity, and completed check-ins. The counts are not added together.</p>
              <div className="divide-y divide-border border-y border-border">
                {enrichedGoals.filter((row) => !focusedGoalId || row.id === focusedGoalId).map((row) => (
                  <article key={row.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(150px,.7fr)_minmax(170px,.8fr)_auto] lg:items-end">
                    <div>
                      <Label htmlFor={`goal-title-${row.id}`} className="readex-kicker flex items-center gap-1.5">{React.createElement(goalIconForKind(questKindForGoal(row, row.type)), { className: 'size-3.5 text-accent', 'aria-hidden': true })} Commitment</Label>
                      <Input id={`goal-title-${row.id}`} value={row.title} onChange={(event) => updateGoal(row.id, { title: event.target.value })} className="mt-2 h-10 font-medium" placeholder="What are you working toward?" />
                    </div>
                    <div>
                      <Label htmlFor={`goal-category-${row.id}`} className="readex-kicker">Progress comes from</Label>
                      <Select value={row.typeId} onValueChange={(value) => {
                        const category = activeGoalTypes.find((type) => type.id === value);
                        if (category) updateGoal(row.id, goalCategoryChange(row, row.type, category));
                      }}>
                        <SelectTrigger id={`goal-category-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>{activeGoalTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`goal-manual-${row.id}`} className="readex-kicker">Manual count / target</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => updateGoal(row.id, { currentProgress: Math.max(0, row.manualProgress - 1) })} aria-label={`Decrease ${row.title} manual count`}><Minus className="size-3.5" /></Button>
                        <Input id={`goal-manual-${row.id}`} type="number" min={0} value={row.manualProgress} onChange={(event) => updateGoal(row.id, { currentProgress: Math.max(0, Number(event.target.value) || 0) })} className="h-10 min-w-0 text-center" aria-label={`${row.title} manual count`} aria-describedby="goal-manual-rule" />
                        <span className="text-muted-foreground">/</span>
                        <Input type="number" min={1} value={row.targetProgress} onChange={(event) => updateGoal(row.id, { targetProgress: Math.max(1, Number(event.target.value) || 1) })} className="h-10 min-w-0 text-center" aria-label={`${row.title} target progress`} />
                        <Button variant="outline" size="icon" onClick={() => updateGoal(row.id, { currentProgress: row.manualProgress + 1 })} aria-label={`Increase ${row.title} manual count`}><Plus className="size-3.5" /></Button>
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

            {planningGoalId && (() => {
              const planningGoal = enrichedGoals.find((item) => item.id === planningGoalId);
              if (!planningGoal) return null;
              const lastCheckIn = planningGoal.commitmentCheckIns?.at(-1);
              return (
              <section className="border-y border-border py-5" aria-label={`Plan ${planningGoal.title}`}>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Goal details</div>
                    <h2 className="mt-1 font-headline text-2xl font-bold italic">{planningGoal.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose exactly what Noesis should count. You can still add progress manually from the goal list.</p>
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
                    <Button variant="ghost" size="sm" onClick={() => deleteGoal(planningGoal.id)} className="min-h-10 rounded-full text-destructive hover:text-destructive">Delete goal</Button>
                    {!focusedGoalId && <Button variant="ghost" size="sm" onClick={() => setPlanningGoalId(null)} className="min-h-10 rounded-full">Close details</Button>}
                  </div>
                </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]">
          {enrichedGoals.filter((row) => row.id === planningGoalId).map((row) => (
            <React.Fragment key={`simple-plan:${row.id}`}>
              <section className="border border-border bg-card p-4 md:p-5" aria-labelledby={`goal-intention-${row.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">Commitment setup</div>
                    <h3 id={`goal-intention-${row.id}`} className="mt-1 font-headline text-xl font-bold italic">Define this commitment</h3>
                    <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">Choose the action, cadence, and evidence that will show whether you lived it.</p>
                  </div>
                  <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase">{questTypeForGoal(row, row.type)}</Badge>
                </div>
                <div className="mt-4 grid gap-4 border-y border-border py-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor={`commitment-action-${row.id}`} className="text-sm font-medium">Action promised</Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Write one observable action, not an intention or paragraph.</p>
                    <Input id={`commitment-action-${row.id}`} value={row.commitmentAction || ''} onChange={(event) => updateGoal(row.id, { commitmentAction: event.target.value })} className="mt-2 h-10" placeholder="For example: Read for 20 minutes without my phone" />
                  </div>
                  <div>
                    <Label htmlFor={`commitment-position-${row.id}`} className="text-sm font-medium">Position this expresses</Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the belief your behavior is meant to embody or test.</p>
                    <Select value={commitmentPositionIds(row)[0] || 'no-linked-position'} onValueChange={(value) => updateGoal(row.id, { commitmentPositionId: value === 'no-linked-position' ? null : value })}>
                      <SelectTrigger id={`commitment-position-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="no-linked-position">No linked position</SelectItem>{positions.filter((position) => position.status !== 'abandoned').map((position) => <SelectItem key={position.id} value={position.id}>{position.title || position.statement}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`commitment-frequency-${row.id}`} className="text-sm font-medium">How often?</Label>
                    <Select value={row.commitmentFrequency || 'weekly'} onValueChange={(value) => updateGoal(row.id, { commitmentFrequency: value as CommitmentFrequency })}>
                      <SelectTrigger id={`commitment-frequency-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="custom">Flexible</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`commitment-review-${row.id}`} className="text-sm font-medium">Review date</Label>
                    <Input id={`commitment-review-${row.id}`} type="date" value={row.commitmentReviewDate || ''} onChange={(event) => updateGoal(row.id, { commitmentReviewDate: event.target.value || undefined })} className="mt-2 h-10" />
                  </div>
                </div>
                {(['consumption', 'inquiry', 'position', 'practice', 'expression'].includes(questKindForGoal(row, row.type))) ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Target className="size-4 text-accent" aria-hidden="true" />
                      <div>
                        <h4 className="text-sm font-medium">What advances this commitment</h4>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label className="text-sm font-medium">Count</Label>
                        <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">Choose the result that moves the number.</p>
                        {questKindForGoal(row, row.type) === 'consumption' && <Select value={row.sourceMeasure || 'finished'} onValueChange={(value) => updateGoal(row.id, { sourceMeasure: value as SourceGoalMeasure })}><SelectTrigger className="mt-2 h-10" aria-label="Source result counted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="finished">Finished sources</SelectItem><SelectItem value="fully_reflected">Complete source records</SelectItem></SelectContent></Select>}
                        {questKindForGoal(row, row.type) === 'inquiry' && <Select value={row.inquiryMeasure || 'active'} onValueChange={(value) => updateGoal(row.id, { inquiryMeasure: value as InquiryGoalMeasure })}><SelectTrigger className="mt-2 h-10" aria-label="Inquiry result counted"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active inquiries</SelectItem><SelectItem value="answered">Inquiries with an answer</SelectItem><SelectItem value="resolved">Resolved inquiries</SelectItem></SelectContent></Select>}
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
                  </div>
                ) : <p className="mt-4 text-sm leading-6 text-muted-foreground">This goal tracks {questTypeForGoal(row, row.type).toLowerCase()} activity across your workspace.</p>}
              </section>

              <aside className="border border-border bg-card p-4 md:p-5">
                <div className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Progress</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="font-headline text-4xl font-bold italic leading-none">{Math.round(row.percent)}%</div>
                  <span className="text-sm text-muted-foreground">{row.currentProgress} of {row.targetProgress}</span>
                </div>
                <Progress value={row.percent} aria-label={`Progress for ${row.title}`} aria-valuetext={`${row.currentProgress} of ${row.targetProgress}`} className="mt-3 h-2" />
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{goalProgressDescription(row, row.type)}</p>
                {lastCheckIn && <div className="mt-4 border-t border-border pt-3 text-sm">
                  <p className="font-medium">{lastCheckIn.status === 'skipped' ? 'Last check-in: skipped' : 'Last check-in: completed'}</p>
                  {lastCheckIn.note && <p className="mt-1 break-words text-muted-foreground">{lastCheckIn.note}</p>}
                </div>}
              </aside>

              <section className="border-y border-border py-4 lg:col-span-2">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground">
                    <span>Reflection</span>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">Optional: keep a short note about what this goal helped you notice.</p>
                  <div className="mt-4 grid gap-4">
                    <div className="hidden border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><h4 className="text-sm font-medium">Milestones</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Break the goal into a few meaningful steps.</p></div>
                        {!(row.milestones || []).length ? <Button variant="outline" size="sm" onClick={() => adoptQuestPath(row)} className="min-h-9 rounded-full">Suggest steps</Button> : <Button variant="outline" size="sm" onClick={() => addMilestone(row.id)} className="min-h-9 rounded-full"><Plus className="mr-1 size-3.5" /> Add step</Button>}
                      </div>
                      <div className="mt-3 space-y-2">
                        {((row.milestones || []).length ? row.milestones || [] : defaultQuestMilestones(row, row.type)).map((milestone, index) => (
                          <div key={`${row.id}:simple-milestone:${index}`} className="flex items-center gap-2 text-sm">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border font-code text-[9px]">{index + 1}</span>
                            {(row.milestones || []).length ? <Input value={milestone} onChange={(event) => updateMilestone(row.id, index, event.target.value)} className="h-9" /> : <span className="leading-5 text-muted-foreground">{milestone}</span>}
                            {(row.milestones || []).length ? <Button variant="ghost" size="icon" onClick={() => removeMilestone(row.id, index)} className="size-9 shrink-0" aria-label={`Remove milestone ${index + 1}`}><Trash2 className="size-3.5" /></Button> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-border p-4">
                      <h4 className="text-sm font-medium">Reflection</h4>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">After meaningful progress, note what changed and whether this goal still fits.</p>
                      <Textarea value={reviewDrafts[row.id] || ''} onChange={(event) => setReviewDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))} className="mt-3 min-h-24" placeholder="What changed? What remains unclear? What should happen next?" />
                      <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{row.lastReviewAt ? `Last review ${new Date(row.lastReviewAt).toLocaleDateString()}` : 'No review yet'}</span><Button size="sm" onClick={() => addGoalReview(row)} className="min-h-9 rounded-full">Save reflection</Button></div>
                    </div>
                  </div>
                </details>
              </section>
            </React.Fragment>
          ))}
        </div>
              </section>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

function GoalStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-full border border-border bg-card px-3 py-1.5">
      <span className="font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="ml-2 font-headline text-sm font-semibold italic text-foreground">{value}</span>
    </div>
  );
}
