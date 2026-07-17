"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Compass, GripVertical, Plus, Save, Target, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { MEDIA_LABELS, MEDIA_TYPES, today, uid } from '@/lib/readex';
import type { GoalItem, GoalSettings, GoalType, IntellectualGoalKind, IntellectualGoalStatus, MediaType } from '@/lib/types';
import { cn } from '@/lib/utils';

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

const GOAL_STATUS_OPTIONS: IntellectualGoalStatus[] = ['planned', 'active', 'stalled', 'under_review', 'completed', 'abandoned', 'transformed', 'archived'];
type QuestFilter = 'all' | 'needs_purpose' | 'needs_completion' | 'review_due' | 'needs_path' | 'stalled';

interface GoalsPageProps {
  goal: GoalSettings;
  goalProgress: Partial<Record<MediaType, number>>;
  onSaveGoal: (goal: GoalSettings) => Promise<void>;
}

function defaultTypesFromLegacy(goal: GoalSettings): GoalType[] {
  if (goal.goalTypes?.length) return goal.goalTypes;
  const legacyTypes: MediaType[] = goal.types?.length ? goal.types : ['book', 'audiobook', 'podcast'];
  return legacyTypes.map((type, index) => ({
    id: `${type}-type`,
    name: MEDIA_LABELS[type],
    mediaTypes: [type],
    sortOrder: index,
    createdAt: today(),
    updatedAt: today(),
  }));
}

function defaultGoalsFromLegacy(goal: GoalSettings, types: GoalType[], progress: Partial<Record<MediaType, number>>): GoalItem[] {
  if (goal.goals?.length) {
    return goal.goals.map((item, index) => ({ ...item, goalKind: item.goalKind || questKindForGoal(item, types.find((type) => type.id === item.typeId)), sortOrder: item.sortOrder ?? index }));
  }
  return types.map((type, index) => {
    const mediaTypes = type.mediaTypes?.length ? type.mediaTypes : [];
    const currentProgress = mediaTypes.reduce((sum, mediaType) => sum + (progress[mediaType] || 0), 0);
    const targetProgress = mediaTypes.reduce((sum, mediaType) => sum + (goal.targets?.[mediaType] || 12), 0) || 12;
    return {
      id: `${type.id}-goal`,
      title: type.name,
      typeId: type.id,
      goalKind: questKindForGoal({ title: type.name } as GoalItem, type),
      currentProgress,
      targetProgress,
      sortOrder: index,
      status: 'active' as const,
      purpose: `Develop intentional progress around ${type.name.toLowerCase()}.`,
      evidenceOfProgress: 'Recorded material, notes, reflections, or linked objects show movement.',
      completionCriteria: `Reach ${targetProgress} meaningful completions and write a short review.`,
      reviewCadence: 'weekly',
      createdAt: today(),
      updatedAt: today(),
    };
  });
}

function questKindForGoal(item: Pick<GoalItem, 'title' | 'goalKind'>, type?: GoalType): IntellectualGoalKind {
  if (item.goalKind) return item.goalKind;
  const name = `${type?.name || item.title}`.toLowerCase();
  if (name.includes('source') || name.includes('book') || name.includes('article') || name.includes('video')) return 'consumption';
  if (name.includes('concept') || name.includes('understand')) return 'understanding';
  if (name.includes('question') || name.includes('inquiry')) return 'inquiry';
  if (name.includes('position') || name.includes('belief')) return 'position';
  if (name.includes('work') || name.includes('writing') || name.includes('essay')) return 'expression';
  if (name.includes('practice') || name.includes('habit') || name.includes('experiment')) return 'practice';
  if (name.includes('reflect')) return 'reflection';
  return 'transformation';
}

function questTypeForGoal(item: GoalItem, type?: GoalType) {
  const kind = questKindForGoal(item, type);
  return QUEST_KIND_OPTIONS.find((option) => option.value === kind)?.label || 'Custom';
}

function questNextStep(item: GoalItem & { percent?: number }, type?: GoalType) {
  if (!item.purpose?.trim()) return 'Name why this goal matters before counting progress.';
  if (!item.completionCriteria?.trim()) return 'Define what would count as complete evidence.';
  if (!item.evidenceOfProgress?.trim()) return 'Define what evidence will prove real movement.';
  if ((item.percent || 0) >= 100 || item.status === 'completed') return 'Write a review: what changed, what remains unclear, and whether the goal should transform.';
  if ((item.currentProgress || 0) === 0) return `Begin the first ${questTypeForGoal(item, type)} action.`;
  return 'Review whether the current path still serves the desired intellectual change.';
}

function cadenceDays(item: GoalItem) {
  if (item.reviewCadence === 'monthly') return 30;
  if (item.reviewCadence === 'seasonal') return 90;
  if (item.reviewCadence === 'custom') return 45;
  return 7;
}

function dateAgeDays(value?: string) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24));
}

function goalNeedsPurpose(item: GoalItem) {
  return !item.purpose?.trim() || !item.reason?.trim();
}

function goalNeedsCompletionEvidence(item: GoalItem) {
  return !item.completionCriteria?.trim() || !item.evidenceOfProgress?.trim();
}

function goalNeedsPath(item: GoalItem) {
  return !(item.milestones || []).filter((milestone) => milestone.trim()).length;
}

function goalReviewDue(item: GoalItem) {
  if (!['active', 'stalled', 'under_review'].includes(item.status)) return false;
  return dateAgeDays(item.lastReviewAt || item.updatedAt || item.createdAt) >= cadenceDays(item);
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

export function GoalsPage({ goal, goalProgress, onSaveGoal }: GoalsPageProps) {
  const [draft, setDraft] = useState<GoalSettings>(goal);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IntellectualGoalStatus | 'all'>('active');
  const [questFilter, setQuestFilter] = useState<QuestFilter>('all');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    const goalTypes = defaultTypesFromLegacy(goal);
    setDraft({
      ...goal,
      goalTypes,
      goals: defaultGoalsFromLegacy(goal, goalTypes, goalProgress),
    });
  }, [goal, goalProgress]);

  const goalTypes = useMemo(() => [...(draft.goalTypes || [])].sort((a, b) => a.sortOrder - b.sortOrder), [draft.goalTypes]);
  const activeGoalTypes = goalTypes.filter((type) => !type.archivedAt);
  const goals = useMemo(() => [...(draft.goals || [])].sort((a, b) => a.sortOrder - b.sortOrder), [draft.goals]);

  const enrichedGoals = useMemo(() => goals.map((item) => {
    const type = goalTypes.find((goalType) => goalType.id === item.typeId);
    const mediaProgress = (type?.mediaTypes || []).reduce((sum, mediaType) => sum + (goalProgress[mediaType] || 0), 0);
    const currentProgress = Math.max(item.currentProgress || 0, mediaProgress);
    const targetProgress = Math.max(1, item.targetProgress || 1);
    return {
      ...item,
      type,
      currentProgress,
      targetProgress,
      percent: Math.min(100, (currentProgress / targetProgress) * 100),
    };
  }), [goals, goalProgress, goalTypes]);

  const visibleGoals = useMemo(
    () => enrichedGoals.filter((item) => {
      const statusOk = statusFilter === 'all' || item.status === statusFilter;
      const questOk =
        questFilter === 'all' ||
        (questFilter === 'needs_purpose' && goalNeedsPurpose(item)) ||
        (questFilter === 'needs_completion' && goalNeedsCompletionEvidence(item)) ||
        (questFilter === 'review_due' && goalReviewDue(item)) ||
        (questFilter === 'needs_path' && goalNeedsPath(item)) ||
        (questFilter === 'stalled' && item.status === 'stalled');
      return statusOk && questOk;
    }),
    [enrichedGoals, statusFilter, questFilter]
  );

  const featured = enrichedGoals.filter((item) => item.status === 'active').sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  }).slice(0, 3);

  const goalStats = {
    planned: goals.filter((item) => item.status === 'planned').length,
    active: goals.filter((item) => item.status === 'active').length,
    underReview: goals.filter((item) => item.status === 'under_review').length,
    completed: goals.filter((item) => item.status === 'completed').length,
    transformed: goals.filter((item) => item.status === 'transformed').length,
    averageProgress: Math.round(
      enrichedGoals.length
        ? enrichedGoals.reduce((sum, item) => sum + item.percent, 0) / enrichedGoals.length
        : 0
    ),
    needsPurpose: enrichedGoals.filter(goalNeedsPurpose).length,
    needsCompletion: enrichedGoals.filter(goalNeedsCompletionEvidence).length,
    needsPath: enrichedGoals.filter(goalNeedsPath).length,
    reviewDue: enrichedGoals.filter(goalReviewDue).length,
  };

  const updateGoal = (id: string, patch: Partial<GoalItem>) => {
    setDraft((prev) => ({
      ...prev,
      goals: (prev.goals || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: today() } : item),
    }));
  };

  const updateType = (id: string, patch: Partial<GoalType>) => {
    setDraft((prev) => ({
      ...prev,
      goalTypes: (prev.goalTypes || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: today() } : item),
    }));
  };

  const addGoalType = () => {
    const name = `New Goal Category ${goalTypes.length + 1}`;
    const typeId = uid();
    const now = today();
    setDraft((prev) => ({
      ...prev,
      goalTypes: [
        ...(prev.goalTypes || []),
        { id: typeId, name, mediaTypes: [], sortOrder: goalTypes.length, createdAt: now, updatedAt: now },
      ],
      goals: [
        ...(prev.goals || []),
        {
          id: uid(),
          title: name,
          typeId,
          currentProgress: 0,
          targetProgress: 1,
          sortOrder: goals.length,
          status: 'active',
          goalKind: 'transformation',
          purpose: `Use this quest to deliberately develop ${name.toLowerCase()}.`,
          evidenceOfProgress: 'Add linked material, reflections, or completed steps that show genuine movement.',
          completionCriteria: 'Define the concrete evidence that would make this goal complete.',
          reviewCadence: 'weekly',
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
  };

  const archiveType = (type: GoalType) => {
    const used = goals.some((item) => item.typeId === type.id && item.status !== 'archived');
    if (used) {
      updateType(type.id, { archivedAt: today() });
      toast({ title: 'Goal type archived', description: 'Existing goals keep their history and no longer become orphaned.' });
      return;
    }
    setDraft((prev) => ({ ...prev, goalTypes: (prev.goalTypes || []).filter((item) => item.id !== type.id) }));
  };

  const addGoal = () => {
    const typeId = activeGoalTypes[0]?.id || goalTypes[0]?.id;
    if (!typeId) return;
    if ((draft.goals || []).some((item) => item.typeId === typeId && item.status === 'active')) {
      toast({ title: 'Goal category already added', description: 'Each goal category can appear only once in this goal set.' });
      return;
    }
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
          targetProgress: 1,
          sortOrder: goals.length,
          status: 'active',
          goalKind: activeGoalTypes.find((type) => type.id === typeId) ? questKindForGoal({ title: activeGoalTypes.find((type) => type.id === typeId)?.name || '' } as GoalItem, activeGoalTypes.find((type) => type.id === typeId)) : 'custom',
          purpose: 'Name the desired intellectual change this quest is meant to produce.',
          evidenceOfProgress: 'Describe what evidence will show real progress, not just activity.',
          completionCriteria: 'Describe what would make this quest complete enough to review.',
          reviewCadence: 'weekly',
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
    const trimmedLabel = draft.label.trim();
    if (!trimmedLabel) {
      toast({ variant: 'destructive', title: 'Goal set name required', description: 'Give this goal set a name before saving.' });
      return;
    }
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
    setSaving(true);
    try {
      await onSaveGoal({ ...draft, label: trimmedLabel, goalTypes: cleanedTypes });
      toast({ title: 'Goal set updated', description: 'Your categories, targets, and ordering are now synced.' });
    } catch {
      toast({ variant: 'destructive', title: 'Goals not saved', description: 'Noesis could not update your goals.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 pt-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Goals"
          description="Define intellectual commitments across sources, inquiries, positions, works, practices, and reflection without making them primary workspace tabs."
          meta={(
            <>
              <GoalStat label="Active" value={goalStats.active} />
              <GoalStat label="Under Review" value={goalStats.underReview} />
              <GoalStat label="Completed" value={goalStats.completed} />
              <GoalStat label="Avg Progress" value={`${goalStats.averageProgress}%`} />
            </>
          )}
          actions={(
            <>
            <Button variant="outline" onClick={addGoalType} className="rounded-full bg-card">
              <Plus className="mr-2 size-4" /> New Goal Category
            </Button>
            <Button variant="outline" onClick={addGoal} className="rounded-full bg-card">
              <Plus className="mr-2 size-4" /> Add Goal Category
            </Button>
            <Button onClick={saveGoals} disabled={saving} className="rounded-full px-7 font-bold shadow-md shadow-accent/20">
              <Save className="mr-2 size-4" /> {saving ? 'Saving' : 'Save Goals'}
            </Button>
            </>
          )}
        />

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {featured.map((row) => (
            <Card key={row.id} className="rounded-xl border-accent/20 bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{questTypeForGoal(row, row.type)}</div>
                  <h2 className="mt-1 font-headline text-2xl font-bold italic">{row.title}</h2>
                </div>
                <Compass className="size-5 text-accent" />
              </div>
              <p className="mb-4 line-clamp-2 text-sm italic text-muted-foreground">{row.purpose || 'No desired change stated yet.'}</p>
              <div className="mb-3 flex items-end justify-between">
                <span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{Math.round(row.percent)}%</span>
                <span className="font-headline text-3xl font-bold italic">{row.currentProgress}/{row.targetProgress}</span>
              </div>
              <Progress value={row.percent} className="h-2" />
              <div className="mt-4 rounded-xl border border-border/50 bg-background/50 p-3 text-[12px] italic leading-relaxed text-muted-foreground">
                {questNextStep(row, row.type)}
              </div>
            </Card>
          ))}
          {!featured.length && (
            <Card className="rounded-xl border-dashed bg-card p-6 text-sm italic text-muted-foreground md:col-span-3">
              Add an active goal to see your top progress cards.
            </Card>
          )}
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Needs Purpose',
              value: goalStats.needsPurpose,
              description: 'Quests without a clear reason or desired intellectual change.',
              filter: 'needs_purpose' as QuestFilter,
            },
            {
              label: 'Needs Completion',
              value: goalStats.needsCompletion,
              description: 'Quests missing evidence of progress or completion criteria.',
              filter: 'needs_completion' as QuestFilter,
            },
            {
              label: 'Review Due',
              value: goalStats.reviewDue,
              description: 'Active commitments whose review cadence has gone stale.',
              filter: 'review_due' as QuestFilter,
            },
            {
              label: 'Needs Quest Path',
              value: goalStats.needsPath,
              description: 'Goals without milestones that show how development unfolds.',
              filter: 'needs_path' as QuestFilter,
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setQuestFilter(questFilter === item.filter ? 'all' : item.filter)}
              className={cn(
                "rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                questFilter === item.filter ? "border-accent/50 bg-accent/10 ring-2 ring-accent/15" : "border-border/50 bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-code text-[8px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">{item.label}</div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                </div>
                <div className="font-headline text-3xl font-bold italic leading-none text-primary">{item.value}</div>
              </div>
            </button>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <Label className="readex-kicker text-[9px] font-bold uppercase">Goal Set Name</Label>
              <Input value={draft.label} onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))} className="mt-2 h-11 max-w-xl rounded-full" />
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 p-3">
              <div>
                <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Commitments</div>
                <div className="mt-1 text-sm text-muted-foreground">{visibleGoals.length} shown from {goals.length} total goals</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={questFilter} onValueChange={(value) => setQuestFilter(value as QuestFilter)}>
                  <SelectTrigger className="w-[190px] rounded-full font-code text-[10px] uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All quest states</SelectItem>
                    <SelectItem value="needs_purpose">Needs Purpose</SelectItem>
                    <SelectItem value="needs_completion">Needs Completion</SelectItem>
                    <SelectItem value="review_due">Review Due</SelectItem>
                    <SelectItem value="needs_path">Needs Quest Path</SelectItem>
                    <SelectItem value="stalled">Stalled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="w-[180px] rounded-full font-code text-[10px] uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="stalled">Stalled</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                    <SelectItem value="transformed">Transformed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="all">All goals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3">
              {visibleGoals.map((row) => (
                <div
                  key={row.id}
                  draggable
                  onDragStart={() => setDraggedId(row.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggedId && reorderGoal(draggedId, row.id)}
                  className="grid gap-3 rounded-xl border border-border bg-background/50 p-3 transition-colors hover:border-accent/30 xl:grid-cols-[auto_1.4fr_180px_90px_90px_150px_auto]"
                >
                  <GripVertical className="size-4 cursor-grab text-muted-foreground/50" />
                  <div>
                    <Input value={row.title} onChange={(event) => updateGoal(row.id, { title: event.target.value })} className="h-9 rounded-full font-headline text-base italic" />
                    <div className="mt-2 flex flex-wrap items-center gap-2 font-code text-[8px] uppercase tracking-widest text-muted-foreground">
                      <span>{questTypeForGoal(row, row.type)}</span>
                      <span>{(row.type?.mediaTypes || []).length ? `Counts: ${(row.type?.mediaTypes || []).map((mediaType) => MEDIA_LABELS[mediaType]).join(', ')}` : 'No media types selected yet'}</span>
                      <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase">{row.status}</Badge>
                      {goalNeedsPurpose(row) && <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 font-code text-[8px] uppercase text-amber-800">needs purpose</Badge>}
                      {goalNeedsCompletionEvidence(row) && <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 font-code text-[8px] uppercase text-rose-800">needs criteria</Badge>}
                      {goalNeedsPath(row) && <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 font-code text-[8px] uppercase text-blue-800">needs path</Badge>}
                      {goalReviewDue(row) && <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 font-code text-[8px] uppercase text-emerald-800">review due</Badge>}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${row.percent}%` }} />
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Textarea value={row.purpose || ''} onChange={(event) => updateGoal(row.id, { purpose: event.target.value })} className="min-h-20 text-xs italic" placeholder="Why does this quest matter?" />
                      <Textarea value={row.reason || ''} onChange={(event) => updateGoal(row.id, { reason: event.target.value })} className="min-h-20 text-xs italic" placeholder="Why is this worth pursuing now?" />
                      <Textarea value={row.completionCriteria || ''} onChange={(event) => updateGoal(row.id, { completionCriteria: event.target.value })} className="min-h-20 text-xs italic" placeholder="What evidence would make this complete?" />
                      <Textarea value={row.evidenceOfProgress || ''} onChange={(event) => updateGoal(row.id, { evidenceOfProgress: event.target.value })} className="min-h-20 text-xs italic" placeholder="What counts as real progress?" />
                      <Textarea value={row.evidence || ''} onChange={(event) => updateGoal(row.id, { evidence: event.target.value })} className="min-h-20 text-xs italic" placeholder="What evidence has already accumulated?" />
                      <Textarea value={row.obstacles || ''} onChange={(event) => updateGoal(row.id, { obstacles: event.target.value })} className="min-h-20 text-xs italic" placeholder="What obstacle or uncertainty should the next review address?" />
                      <Textarea
                        value={(row.linkedObjectLabels || []).join('\n')}
                        onChange={(event) => updateGoal(row.id, { linkedObjectLabels: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })}
                        className="min-h-20 text-xs italic md:col-span-2"
                        placeholder="Linked objects, one per line: inquiry, position, source, work, practice, concept..."
                      />
                    </div>
                    <div className="mt-3 rounded-xl border border-border/50 bg-card p-3 text-[12px] italic text-muted-foreground">
                      <span className="font-code text-[8px] uppercase tracking-widest not-italic text-muted-foreground/70">Next review cue: </span>
                      {questNextStep(row, row.type)}
                    </div>
                    <div className="mt-3 rounded-xl border border-border/50 bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-code text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Quest Path</div>
                          <p className="mt-1 text-xs italic text-muted-foreground">Milestones should describe transformation, not just task completion.</p>
                        </div>
                        {!(row.milestones || []).length && (
                          <Button variant="outline" size="sm" onClick={() => adoptQuestPath(row)} className="h-8 rounded-full bg-background">
                            Adopt Path
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        {((row.milestones || []).length ? row.milestones || [] : defaultQuestMilestones(row, row.type)).map((milestone, index) => (
                          <div key={`${row.id}:milestone:${index}`} className="grid gap-2 sm:grid-cols-[24px_1fr]">
                            <div className={cn(
                              'mt-2 flex size-6 items-center justify-center rounded-full border font-code text-[9px] font-bold',
                              (row.currentProgress || 0) > index ? 'border-accent bg-accent text-white' : 'border-border bg-background text-muted-foreground'
                            )}>
                              {index + 1}
                            </div>
                            {(row.milestones || []).length ? (
                              <Input
                                value={milestone}
                                onChange={(event) => updateMilestone(row.id, index, event.target.value)}
                                className="h-9 rounded-full text-xs italic"
                              />
                            ) : (
                              <div className="rounded-xl border border-border/40 bg-background px-3 py-2 text-xs italic leading-5 text-muted-foreground">
                                {milestone}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-border/50 bg-card p-3">
                      <div className="font-code text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Goal Review</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="rounded-xl border border-border/40 bg-background p-3 text-xs leading-5 text-muted-foreground">
                          <p><span className="font-semibold text-foreground">Ask:</span> what progress occurred?</p>
                          <p><span className="font-semibold text-foreground">Ask:</span> what changed?</p>
                          <p><span className="font-semibold text-foreground">Ask:</span> what remains unclear?</p>
                          <p><span className="font-semibold text-foreground">Ask:</span> should the path change?</p>
                        </div>
                        <div>
                          <Textarea
                            value={reviewDrafts[row.id] || ''}
                            onChange={(event) => setReviewDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))}
                            className="min-h-24 text-xs italic"
                            placeholder="Write the review: progress, change, remaining uncertainty, and whether this quest should continue or transform."
                          />
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">
                              {row.lastReviewAt ? `Last reviewed ${new Date(row.lastReviewAt).toLocaleDateString()}` : 'No review yet'}
                            </span>
                            <Button size="sm" onClick={() => addGoalReview(row)} className="h-8 rounded-full">
                              Save Review
                            </Button>
                          </div>
                        </div>
                      </div>
                      {!!row.reviewNotes?.length && (
                        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                          {row.reviewNotes.slice(-2).map((note) => (
                            <div key={note} className="rounded-xl border border-border/40 bg-background px-3 py-2 text-xs italic leading-5 text-muted-foreground">
                              {note}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Select value={row.typeId} onValueChange={(value) => updateGoal(row.id, { typeId: value, goalKind: questKindForGoal(row, activeGoalTypes.find((type) => type.id === value)) })}>
                      <SelectTrigger className="h-9 rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeGoalTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={row.goalKind || questKindForGoal(row, row.type)} onValueChange={(value) => updateGoal(row.id, { goalKind: value as IntellectualGoalKind })}>
                      <SelectTrigger className="h-9 rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUEST_KIND_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-9 rounded-full border border-border bg-card px-4 font-code text-xs flex items-center justify-end">
                    {row.currentProgress}
                  </div>
                  <Input type="number" min={1} value={row.targetProgress} onChange={(event) => updateGoal(row.id, { targetProgress: Math.max(1, Number(event.target.value) || 1) })} className="h-9 rounded-full text-right font-code text-xs" />
                  <Select value={row.reviewCadence || 'weekly'} onValueChange={(value) => updateGoal(row.id, { reviewCadence: value as GoalItem['reviewCadence'] })}>
                    <SelectTrigger className="h-9 rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Select value={row.status} onValueChange={(value) => updateGoal(row.id, { status: value as IntellectualGoalStatus })}>
                      <SelectTrigger className="h-9 w-[150px] rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GOAL_STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => updateGoal(row.id, { status: 'archived' })} className="rounded-full text-muted-foreground hover:text-destructive">
                      <Archive className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
            <h2 className="font-code text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Goal Categories</h2>
            <p className="mt-2 text-xs italic text-muted-foreground">A goal category is a custom bucket like Books or Articles. Included media types determine what gets counted.</p>
            <div className="mt-4 rounded-xl border border-border/50 bg-background/50 p-3">
              <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Quest Types</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUEST_KIND_OPTIONS.map((type) => (
                  <Badge key={type.value} variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-tighter" title={type.description}>
                    {type.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {goalTypes.map((type) => (
                <div key={type.id} className={cn('rounded-xl border p-3', type.archivedAt ? 'bg-muted/20 opacity-55' : 'bg-background/50')}>
                  <div className="flex items-center gap-2">
                    <Input value={type.name} onChange={(event) => updateType(type.id, { name: event.target.value })} className="h-9 rounded-full text-sm font-bold" />
                    <Button variant="ghost" size="icon" onClick={() => archiveType(type)} className="rounded-full text-muted-foreground hover:text-destructive">
                      {type.archivedAt ? <Trash2 className="size-4" /> : <Archive className="size-4" />}
                    </Button>
                  </div>
                  <div className="mt-3 font-code text-[8px] uppercase tracking-widest text-muted-foreground">Included Media Types</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {MEDIA_TYPES.map((mediaType) => {
                      const active = (type.mediaTypes || []).includes(mediaType);
                      return (
                        <button
                          key={mediaType}
                          onClick={() => updateType(type.id, {
                            mediaTypes: active
                              ? (type.mediaTypes || []).filter((item) => item !== mediaType)
                              : [...(type.mediaTypes || []), mediaType],
                          })}
                          className={cn(
                            'rounded-full border px-2.5 py-1 font-code text-[8px] uppercase tracking-widest',
                            active ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-muted-foreground'
                          )}
                        >
                          {MEDIA_LABELS[mediaType]}
                        </button>
                      );
                    })}
                  </div>
                  {type.archivedAt && <Badge variant="outline" className="mt-3 rounded-full font-code text-[8px] uppercase">Archived</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
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
