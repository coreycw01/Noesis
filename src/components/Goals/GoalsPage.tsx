"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Award, CheckCircle2, ChevronDown, ChevronRight, Compass, Flag, GripVertical, Minus, Plus, Save, Settings2, Target, Trash2 } from 'lucide-react';
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
import type { Concept, Draft, GoalItem, GoalSettings, GoalType, InquiryGoalMeasure, IntellectualGoalKind, IntellectualGoalStatus, Media, MediaType, PositionGoalMeasure, Practice, PracticeGoalMeasure, Question, SourceGoalMeasure, UserProfile, VaultEntry, WorkGoalMeasure } from '@/lib/types';
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
type GoalsView = 'progress' | 'achievements' | 'goals';

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
      goalKind: goalKindForType(type, type.name),
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

function goalKindForType(type?: GoalType, fallbackTitle = ''): IntellectualGoalKind {
  const name = `${type?.name || fallbackTitle}`.toLowerCase();
  if (name.includes('source') || name.includes('book') || name.includes('article') || name.includes('video')) return 'consumption';
  if (name.includes('concept') || name.includes('understand')) return 'understanding';
  if (name.includes('question') || name.includes('inquiry')) return 'inquiry';
  if (name.includes('position') || name.includes('belief')) return 'position';
  if (name.includes('work') || name.includes('writing') || name.includes('essay')) return 'expression';
  if (name.includes('practice') || name.includes('habit') || name.includes('experiment')) return 'practice';
  if (name.includes('reflect')) return 'reflection';
  return 'transformation';
}

function questKindForGoal(item: Pick<GoalItem, 'title' | 'goalKind'>, type?: GoalType): IntellectualGoalKind {
  return item.goalKind || goalKindForType(type, item.title);
}

function hasConceptTag(tags: string[] | undefined, conceptNames: string[]) {
  return !conceptNames.length || (tags || []).some((tag) => conceptNames.includes(tag.toLowerCase()));
}

function positionHasReviewActivity(position: VaultEntry) {
  return Boolean(
    position.lastChallengedAt ||
    position.lastRevisedAt ||
    (position.versionHistory?.length || 0) > 1 ||
    ['revised', 'challenged', 'contested', 'unstable', 'uncertain'].includes(position.status)
  );
}

function completedPractice(practice: Practice) {
  return ['completed', 'concluded', 'integrated'].includes(practice.status);
}

function completedWork(work: Draft) {
  return ['complete', 'final', 'published'].includes(work.status);
}

function sourceHasCompleteDetails(source: Media) {
  const reflection = source.capture?.after;
  return Boolean(
    source.status === 'Finished' &&
    source.creator?.trim() &&
    source.description?.trim() &&
    source.tags?.length &&
    reflection?.coreArgument?.trim() &&
    reflection?.beliefChange?.trim() &&
    reflection?.nextAction?.trim()
  );
}

function fullyAnsweredInquiry(inquiry: Question) {
  return ['answered', 'resolved'].includes(inquiry.status) && Boolean(inquiry.answer?.trim());
}

function longestDateStreak(values: string[]) {
  const uniqueDates = [...new Set(values.map((value) => value.slice(0, 10)).filter(Boolean))].sort();
  let longest = 0;
  let current = 0;
  let previous: number | undefined;
  uniqueDates.forEach((date) => {
    const day = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(day)) return;
    current = previous === day - 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  });
  return longest;
}

function longestPracticeLogStreak(practices: Practice[]) {
  return longestDateStreak(practices.flatMap((practice) => [
    ...(practice.logDates || []),
    ...(practice.logs || []).filter((log) => log.actionCompleted).map((log) => log.date),
  ]));
}

function practiceLogDayCount(practices: Practice[]) {
  return new Set(practices.flatMap((practice) => [
    ...(practice.logDates || []),
    ...(practice.logs || []).filter((log) => log.actionCompleted).map((log) => log.date),
  ]).map((value) => value.slice(0, 10)).filter(Boolean)).size;
}

function questTypeForGoal(item: GoalItem, type?: GoalType) {
  const kind = questKindForGoal(item, type);
  return QUEST_KIND_OPTIONS.find((option) => option.value === kind)?.label || 'Custom';
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
    ? 'Progress updates when a matching position reaches 100% confidence.'
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
  if (!item.purpose?.trim()) return 'Name why this goal matters before counting progress.';
  if (!item.completionCriteria?.trim()) return 'Define what would count as complete evidence.';
  if (!item.evidenceOfProgress?.trim()) return 'Define what evidence will prove real movement.';
  if ((item.percent || 0) >= 100 || item.status === 'completed') return 'Write a review: what changed, what remains unclear, and whether the goal should transform.';
  if ((item.currentProgress || 0) === 0) return `Begin the first ${questTypeForGoal(item, type)} action.`;
  return 'Review whether the current path still serves the desired intellectual change.';
}

function goalCompletionPoints(target: number) {
  // Larger commitments earn more, but the logarithmic curve prevents inflated targets from becoming a points exploit.
  return Math.min(200, 75 + Math.round(25 * Math.log2(Math.max(1, target) + 1)));
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

export function GoalsPage({ goal, goalProgress, concepts, inquiries, sources, positions, works, practices, profile, onSaveGoal }: GoalsPageProps) {
  const [draft, setDraft] = useState<GoalSettings>(goal);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IntellectualGoalStatus | 'all'>('active');
  const [questFilter, setQuestFilter] = useState<QuestFilter>('all');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<GoalsView>('progress');
  const [planningGoalId, setPlanningGoalId] = useState<string | null>(null);
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
    const kind = questKindForGoal(item, type);
    const mediaProgress = (type?.mediaTypes || []).reduce((sum, mediaType) => sum + (goalProgress[mediaType] || 0), 0);
    const conceptId = item.relatedObjectIds?.conceptIds?.[0];
    const scopedConcept = concepts.find((concept) => concept.id === conceptId);
    const conceptNames = scopedConcept ? [scopedConcept.name, ...(scopedConcept.aliases || [])].map((name) => name.toLowerCase()) : [];
    const positionId = item.relatedObjectIds?.positionIds?.[0];
    const practiceId = item.relatedObjectIds?.practiceIds?.[0];
    const sourceMeasure: SourceGoalMeasure = item.sourceMeasure || 'finished';
    const inquiryMeasure: InquiryGoalMeasure = item.inquiryMeasure || 'active';
    const positionMeasure: PositionGoalMeasure = item.positionMeasure || 'reviewed';
    const practiceMeasure: PracticeGoalMeasure = item.practiceMeasure || 'completed';
    const workMeasure: WorkGoalMeasure = item.workMeasure || 'completed';
    const matchingSources = sources.filter((source) => (!item.sourceType || source.type === item.sourceType) && hasConceptTag(source.tags, conceptNames));
    const sourceProgress = kind === 'consumption'
      ? matchingSources.filter((source) => sourceMeasure === 'fully_reflected' ? sourceHasCompleteDetails(source) : source.status === 'Finished').length
      : null;
    const inquiryProgress = kind === 'inquiry'
      ? inquiries.filter((inquiry) => {
        const matchesFocus = (!conceptId || (inquiry.conceptIds || []).includes(conceptId)) && (!item.relatedObjectIds?.inquiryIds?.[0] || inquiry.id === item.relatedObjectIds.inquiryIds[0]);
        if (!matchesFocus) return false;
        if (inquiryMeasure === 'answered') return ['answered', 'resolved'].includes(inquiry.status) && Boolean(inquiry.answer?.trim());
        if (inquiryMeasure === 'resolved') return inquiry.status === 'resolved' && Boolean(inquiry.answer?.trim());
        return !['archived', 'no_longer_meaningful'].includes(inquiry.status);
      }).length
      : null;
    const positionProgress = kind === 'position'
      ? positions.filter((position) => {
        const matchesFocus = (!positionId || position.id === positionId) && hasConceptTag(position.tags, conceptNames);
        if (!matchesFocus) return false;
        if (positionMeasure === 'revised') return Boolean(position.lastRevisedAt || position.status === 'revised' || (position.versionHistory?.some((version) => version.eventType === 'revised')));
        if (positionMeasure === 'confident') return position.status !== 'abandoned' && position.confidence >= 100;
        return positionHasReviewActivity(position);
      }).length
      : null;
    const practiceProgress = kind === 'practice'
      ? (() => {
        const matchingPractices = practices.filter((practice) => (!practiceId || practice.id === practiceId) && (!positionId || (practice.positionIds || []).includes(positionId)) && hasConceptTag(practice.conceptTags, conceptNames));
        if (practiceMeasure === 'logged_days') return practiceLogDayCount(matchingPractices);
        if (practiceMeasure === 'log_streak') return longestPracticeLogStreak(matchingPractices);
        return matchingPractices.filter(completedPractice).length;
      })()
      : null;
    const workProgress = kind === 'expression'
      ? works.filter((work) => (workMeasure === 'published' ? work.status === 'published' : completedWork(work)) && hasConceptTag(work.conceptTags, conceptNames)).length
      : null;
    const automaticProgress = sourceProgress ?? inquiryProgress ?? positionProgress ?? practiceProgress ?? workProgress;
    const currentProgress = automaticProgress === null ? Math.max(item.currentProgress || 0, mediaProgress) : Math.max(item.currentProgress || 0, automaticProgress);
    const targetProgress = Math.max(1, item.targetProgress || 1);
    return {
      ...item,
      type,
      currentProgress,
      targetProgress,
      percent: Math.min(100, (currentProgress / targetProgress) * 100),
    };
  }), [concepts, goals, goalProgress, goalTypes, inquiries, positions, practices, sources, works]);

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

  const activeGoals = useMemo(
    () => enrichedGoals.filter((item) => ['active', 'under_review', 'stalled'].includes(item.status)),
    [enrichedGoals]
  );
  const focusGoal = useMemo(
    () => [...activeGoals].sort((a, b) => {
      const aNeedsAttention = Number(goalNeedsPurpose(a) || goalNeedsCompletionEvidence(a) || goalNeedsPath(a) || goalReviewDue(a));
      const bNeedsAttention = Number(goalNeedsPurpose(b) || goalNeedsCompletionEvidence(b) || goalNeedsPath(b) || goalReviewDue(b));
      if (bNeedsAttention !== aNeedsAttention) return bNeedsAttention - aNeedsAttention;
      if (a.percent !== b.percent) return a.percent - b.percent;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })[0],
    [activeGoals]
  );
  const progressScore = useMemo(() => enrichedGoals.reduce((total, item) => {
    const progressValue = Math.round(goalCompletionPoints(item.targetProgress) * (item.percent / 100));
    const reviewValue = Math.min(30, (item.reviewNotes?.length || 0) * 5);
    return total + progressValue + reviewValue;
  }, 0), [enrichedGoals]);
  const achievementItems = useMemo(() => {
    const thresholds = [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300];
    const confidenceThresholds = [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 75, 100, 125, 150];
    const streakThresholds = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 150, 180, 240, 300, 365];
    const dailyStreakThresholds = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 240, 300, 365, 500];
    const milestoneNames = ['1', '2', '3'];
    const family = (id: string, tiers: string[], detail: string, value: number, options?: { thresholds?: number[]; milestones?: string[] }) => (options?.thresholds || thresholds).map((target, index) => ({
      id: `${id}-${target}`,
      title: `${tiers[Math.min(tiers.length - 1, Math.floor(index / 3))]}: ${(options?.milestones || milestoneNames)[index % 3]}`,
      detail: `${detail} ${target}.`,
      earned: value >= target,
      progress: Math.min(value, target),
      target,
    }));
    const completedGoals = enrichedGoals.filter((item) => item.status === 'completed' || item.percent >= 100).length;
    const reviews = enrichedGoals.reduce((total, item) => total + (item.reviewNotes?.length || 0), 0);
    const finishedSources = sources.filter((source) => source.status === 'Finished').length;
    const fullyReflectedSources = sources.filter(sourceHasCompleteDetails).length;
    const fullyAnsweredInquiries = inquiries.filter(fullyAnsweredInquiry).length;
    const fullyConfidentPositions = positions.filter((position) => position.status !== 'abandoned' && position.confidence >= 100).length;
    const practiceStreak = longestPracticeLogStreak(practices);
    const dailyActivityStreak = longestDateStreak(profile.dailyActivityDates || []);
    return [
      ...family('source', ['Curious Reader', 'Explorer', 'Researcher', 'Archivist', 'Synthesist', 'Scholar'], 'Collect sources', sources.length),
      ...family('source-finished', ['Curious Reader', 'Explorer', 'Researcher', 'Archivist', 'Synthesist', 'Scholar'], 'Finish sources', finishedSources),
      ...family('source-reflection', ['Curious Reader', 'Explorer', 'Researcher', 'Archivist', 'Synthesist', 'Scholar'], 'Complete source records', fullyReflectedSources),
      ...family('inquiry', ['Questioner', 'Examiner', 'Investigator', 'Dialectician', 'Philosopher', 'Sage'], 'Develop inquiries', inquiries.length),
      ...family('inquiry-answered', ['Questioner', 'Examiner', 'Investigator', 'Dialectician', 'Philosopher', 'Sage'], 'Fully answer inquiries', fullyAnsweredInquiries),
      ...family('concept', ['Namemaker', 'Definer', 'Cartographer', 'Theorist', 'System Builder', 'Thinker'], 'Create concepts', concepts.length),
      ...family('position', ['Observer', 'Formulator', 'Advocate', 'Critic', 'Revisionist', 'Philosopher'], 'Write positions', positions.length),
      ...family('position-confident', ['Observer', 'Formulator', 'Advocate', 'Critic', 'Revisionist'], 'Develop positions to 100% confidence', fullyConfidentPositions, { thresholds: confidenceThresholds }),
      ...family('work', ['Note-taker', 'Draftsperson', 'Writer', 'Essayist', 'Author', 'Builder'], 'Create works', works.length),
      ...family('practice', ['Experimenter', 'Practitioner', 'Tester', 'Disciplined Thinker', 'Integrator', 'Embodied Philosopher'], 'Start practices', practices.length),
      ...family('practice-streak', ['Experimenter', 'Practitioner', 'Tester', 'Disciplined Thinker', 'Integrator', 'Embodied Philosopher'], 'Keep a practice log streak of', practiceStreak, { thresholds: streakThresholds }),
      ...family('goal', ['Starter', 'Steward', 'Finisher', 'Pathmaker', 'Commitment Keeper', 'Completer'], 'Complete goals', completedGoals),
      ...family('reflection', ['Noticer', 'Reflector', 'Reviewer', 'Interpreter', 'Integrator', 'Witness'], 'Save goal reflections', reviews),
      ...family('daily-streak', ['Steady Thinker', 'Ritual Thinker', 'Dedicated Thinker', 'Daily Philosopher', 'Enduring Thinker', 'Lifelong Thinker'], 'Return to Noesis for', dailyActivityStreak, { thresholds: dailyStreakThresholds }),
    ];
  }, [activeGoals.length, concepts.length, enrichedGoals, inquiries.length, positions.length, practices.length, profile.dailyActivityDates, sources.length, works.length]);
  const nextAchievements = useMemo(
    () => achievementItems.filter((item) => !item.earned).sort((a, b) => (b.progress / b.target) - (a.progress / a.target)).slice(0, 3),
    [achievementItems]
  );

  const updateGoal = (id: string, patch: Partial<GoalItem>) => {
    setDraft((prev) => ({
      ...prev,
      goals: (prev.goals || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: today() } : item),
    }));
  };

  const deleteGoal = (id: string) => {
    setDraft((prev) => ({ ...prev, goals: (prev.goals || []).filter((item) => item.id !== id) }));
    setPlanningGoalId((current) => current === id ? null : current);
    toast({ title: 'Goal removed', description: 'It will be removed when you save your goals.' });
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
          purpose: 'Choose a measurable Noesis milestone you want to reach.',
          evidenceOfProgress: 'Progress is counted from the selected app activity or adjusted manually.',
          completionCriteria: 'Reach the target and review what the milestone changed in your thinking.',
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
    <div className="noesis-page">
      <div className="noesis-page-inner">
        <PageHeader
          title="Goals & Achievements"
          description="See the intellectual work you are building, choose the next meaningful move, and mark the milestones that matter."
          meta={(
            <>
              <GoalStat label="Progress score" value={progressScore} />
              <GoalStat label="Active goals" value={activeGoals.length} />
              <GoalStat label="Completed" value={goalStats.completed} />
            </>
          )}
          actions={(
            <>
            <Button variant="outline" onClick={addGoal} className="rounded-full bg-card">
              <Plus className="mr-2 size-4" /> Add Goal
            </Button>
            <Button onClick={saveGoals} disabled={saving} className="rounded-full px-7 font-bold shadow-md shadow-accent/20">
              <Save className="mr-2 size-4" /> {saving ? 'Saving' : 'Save Goals'}
            </Button>
            </>
          )}
        />

        <div className="mb-6 flex flex-wrap items-center gap-1 border-y border-border/70 py-2" role="tablist" aria-label="Goals views">
          {([
            { id: 'progress', label: 'Progress', icon: Target },
            { id: 'achievements', label: 'Achievements', icon: Award },
            { id: 'goals', label: 'Goals', icon: Settings2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeView === id}
              onClick={() => setActiveView(id)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                activeView === id ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {activeView === 'progress' && (
          <div className="space-y-6" role="tabpanel" aria-label="Goal progress">
            <section className="border-y border-border bg-card/35 py-5 md:py-7">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                    <Compass className="size-4" aria-hidden="true" /> Today&apos;s focus
                  </div>
                  {focusGoal ? (
                    <>
                      <h2 className="mt-2 max-w-3xl font-headline text-2xl font-bold italic leading-tight md:text-3xl">{focusGoal.title}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{questNextStep(focusGoal, focusGoal.type)}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-2 font-headline text-2xl font-bold italic">Create your first meaningful goal</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Start with one concrete change you want your Noesis work to make visible.</p>
                    </>
                  )}
                </div>
                {focusGoal ? (
                  <div className="flex items-end gap-3 md:text-right">
                    <div>
                      <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Progress</div>
                      <div className="font-headline text-3xl font-bold italic">{Math.round(focusGoal.percent)}%</div>
                    </div>
                    <Button variant="outline" onClick={() => setActiveView('goals')} className="min-h-10 rounded-full">
                      Open goal <ChevronRight className="ml-1 size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={addGoal} className="min-h-10 rounded-full"><Plus className="mr-2 size-4" /> Add goal</Button>
                )}
              </div>
            </section>

            <section aria-labelledby="active-goals-heading">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="active-goals-heading" className="font-headline text-xl font-bold italic">Active goals</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Progress is based on your recorded work and the milestones you set.</p>
                </div>
                <span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{activeGoals.length} in motion</span>
              </div>
              {activeGoals.length ? (
                <div className="divide-y divide-border border-y border-border">
                  {activeGoals.map((item) => {
                    const path = (item.milestones || []).filter(Boolean);
                    const nextMilestone = path[Math.min(path.length - 1, Math.floor((item.percent / 100) * Math.max(path.length, 1)))] || questNextStep(item, item.type);
                    return (
                      <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-code text-[9px] font-bold uppercase tracking-widest text-accent">{questTypeForGoal(item, item.type)}</span>
                            {item.status === 'stalled' && <Badge variant="outline" className="rounded-full text-[9px] uppercase">Needs a restart</Badge>}
                            {goalReviewDue(item) && <Badge variant="outline" className="rounded-full text-[9px] uppercase">Review due</Badge>}
                          </div>
                          <h3 className="mt-1 text-base font-semibold leading-6 text-foreground">{item.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">Next: {nextMilestone}</p>
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 flex justify-between font-code text-[9px] uppercase tracking-widest text-muted-foreground"><span>Progress</span><span>{item.currentProgress}/{item.targetProgress}</span></div>
                          <Progress value={item.percent} className="h-2" />
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <Button variant="outline" size="icon" onClick={() => updateGoal(item.id, { currentProgress: Math.min(item.targetProgress, item.currentProgress + 1) })} className="size-10 rounded-full" aria-label={`Add progress to ${item.title}`}>
                            <Plus className="size-4" />
                          </Button>
                          <Button variant="ghost" onClick={() => setActiveView('goals')} className="min-h-10 px-2 text-sm">Details</Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed bg-card/50 p-6 text-sm text-muted-foreground">No active goals yet. Create one goal that helps you notice meaningful progress in your work.</Card>
              )}
            </section>

            <section className="grid gap-4 border-t border-border pt-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" aria-label="Progress score">
              {nextAchievements.length > 0 && (
                <div className="border-b border-border pb-5 md:col-span-2">
                  <div className="mb-3"><div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"><Award className="size-4" aria-hidden="true" /> Nearly earned</div><p className="mt-1 text-sm text-muted-foreground">Your closest achievements across Noesis.</p></div>
                  <div className="grid gap-px border border-border bg-border sm:grid-cols-3">
                    {nextAchievements.map((achievement) => (
                      <article key={achievement.id} className="bg-card p-3">
                        <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-medium">{achievement.title}</h3><span className="font-code text-[9px] text-muted-foreground">{achievement.progress}/{achievement.target}</span></div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{achievement.detail}</p>
                        <Progress value={(achievement.progress / achievement.target) * 100} className="mt-3 h-1.5" />
                      </article>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"><Award className="size-4" aria-hidden="true" /> Your progress score</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">A completed goal earns 100–200 points based on its target; larger targets earn more, with a cap that keeps scoring fair. Reflections add small bonuses. Points are private progress markers, never money or currency.</p>
              </div>
            </section>
          </div>
        )}

        {activeView === 'achievements' && (
          <div className="space-y-6" role="tabpanel" aria-label="Achievements">
            <section className="border-y border-border bg-card/35 py-5 md:py-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent"><Award className="size-4" aria-hidden="true" /> Progress score</div>
                  <div className="mt-2 font-headline text-5xl font-bold italic leading-none">{progressScore}</div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A quiet score for work you actually do in Noesis: progress, completion, and reflection. It cannot be bought, spent, or shared as currency.</p>
                </div>
                <div className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{achievementItems.filter((item) => item.earned).length} of {achievementItems.length} earned</div>
              </div>
            </section>
            <section className="divide-y divide-border border-y border-border" aria-label="Achievement progress">
              {[
                ['source', 'Sources'], ['inquiry', 'Inquiries'], ['concept', 'Concepts'], ['position', 'Positions'],
                ['work', 'Works'], ['practice', 'Practices'], ['goal', 'Goals'], ['reflection', 'Reflections'], ['daily', 'Daily return'],
              ].map(([groupId, groupLabel], index) => {
                const group = achievementItems.filter((item) => item.id.startsWith(`${groupId}-`));
                const earned = group.filter((item) => item.earned).length;
                return (
                  <details key={groupId} className="group py-1" open={index === 0}>
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-1 text-sm font-medium text-foreground">
                      <span className="flex items-center gap-3"><Award className="size-4 text-accent" aria-hidden="true" />{groupLabel}</span>
                      <span className="flex items-center gap-3"><span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{earned}/{group.length} earned</span><ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" /></span>
                    </summary>
                    <div className="grid gap-px border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                      {group.map((achievement) => (
                        <article key={achievement.id} className="bg-card p-4">
                          <div className="flex items-start justify-between gap-3"><div className={cn('flex size-8 items-center justify-center border', achievement.earned ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground')}>{achievement.earned ? <CheckCircle2 className="size-4" aria-label="Earned" /> : <Flag className="size-4" aria-label="In progress" />}</div><span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{achievement.progress}/{achievement.target}</span></div>
                          <h2 className="mt-4 font-headline text-lg font-bold italic">{achievement.title}</h2>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">{achievement.detail}</p>
                          <Progress value={(achievement.progress / achievement.target) * 100} className="mt-3 h-1.5" />
                        </article>
                      ))}
                    </div>
                  </details>
                );
              })}
            </section>
          </div>
        )}

        {activeView === 'goals' && (
          <>
            <section className="mb-6 border-y border-border py-5 md:py-6" aria-labelledby="goals-heading">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Goal setup</div>
                  <h2 id="goals-heading" className="mt-1 font-headline text-2xl font-bold italic">Set up goals in three small steps</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Start with a name and a target. Refine a goal only when you want to narrow what Noesis counts.</p>
                </div>
                <Button onClick={addGoal} className="min-h-10 rounded-full"><Plus className="mr-2 size-4" /> Add goal</Button>
              </div>
              <ol className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['1', 'Name it', 'What are you trying to make progress on?'],
                  ['2', 'Measure it', 'Choose a category and a target number.'],
                  ['3', 'Refine it', 'Optionally choose the exact result, item, or concept to track.'],
                ].map(([number, title, detail]) => (
                  <li key={number} className="flex gap-3 border-l border-border pl-3">
                    <span className="font-code text-[10px] font-bold text-accent">{number}</span>
                    <div><div className="text-sm font-medium">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mb-6" aria-label="Basic goal settings">
              <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                  <Label className="readex-kicker">Goal collection name</Label>
                  <Input value={draft.label} onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))} className="mt-2 h-10 max-w-xl" placeholder="For example, Autumn thinking goals" />
                </div>
                <span className="text-sm text-muted-foreground">{enrichedGoals.length} goal{enrichedGoals.length === 1 ? '' : 's'} in this collection</span>
              </div>
              <div className="divide-y divide-border border-y border-border">
                {enrichedGoals.map((row) => (
                  <article key={row.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(150px,.7fr)_minmax(170px,.8fr)_auto] lg:items-end">
                    <div>
                      <Label className="readex-kicker">Goal</Label>
                      <Input value={row.title} onChange={(event) => updateGoal(row.id, { title: event.target.value })} className="mt-2 h-10 font-medium" placeholder="What are you working toward?" />
                    </div>
                    <div>
                      <Label className="readex-kicker">Progress comes from</Label>
                      <Select value={row.typeId} onValueChange={(value) => updateGoal(row.id, { typeId: value, goalKind: goalKindForType(activeGoalTypes.find((type) => type.id === value)), sourceType: undefined })}>
                        <SelectTrigger className="mt-2 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>{activeGoalTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="readex-kicker">Target</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => updateGoal(row.id, { currentProgress: Math.max(0, row.currentProgress - 1) })} aria-label={`Decrease ${row.title} progress`}><Minus className="size-3.5" /></Button>
                        <Input type="number" min={0} value={row.currentProgress} onChange={(event) => updateGoal(row.id, { currentProgress: Math.max(0, Number(event.target.value) || 0) })} className="h-10 min-w-0 text-center" aria-label={`${row.title} current progress`} />
                        <span className="text-muted-foreground">/</span>
                        <Input type="number" min={1} value={row.targetProgress} onChange={(event) => updateGoal(row.id, { targetProgress: Math.max(1, Number(event.target.value) || 1) })} className="h-10 min-w-0 text-center" aria-label={`${row.title} target progress`} />
                        <Button variant="outline" size="icon" onClick={() => updateGoal(row.id, { currentProgress: Math.min(row.targetProgress, row.currentProgress + 1) })} aria-label={`Add progress to ${row.title}`}><Plus className="size-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 lg:justify-end">
                      <span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{Math.round(row.percent)}%</span>
                      <Button variant="outline" size="sm" onClick={() => setPlanningGoalId((current) => current === row.id ? null : row.id)} className="min-h-10 rounded-full px-3">
                        {planningGoalId === row.id ? 'Close details' : 'Refine goal'}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {planningGoalId && (() => {
              const planningGoal = enrichedGoals.find((item) => item.id === planningGoalId);
              if (!planningGoal) return null;
              return (
              <section className="border-y border-border py-5" aria-label={`Plan ${planningGoal.title}`}>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Goal details</div>
                    <h2 className="mt-1 font-headline text-2xl font-bold italic">{planningGoal.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose exactly what Noesis should count. You can still add progress manually from the goal list.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => deleteGoal(planningGoal.id)} className="min-h-10 rounded-full text-destructive hover:text-destructive">Delete goal</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPlanningGoalId(null)} className="min-h-10 rounded-full">Close details</Button>
                  </div>
                </div>
        <section className="hidden mb-8 grid-cols-1 gap-5 md:grid-cols-3">
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

        <section className="hidden mb-6 flex-wrap gap-2">
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
          ].filter((item) => item.value > 0).map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setQuestFilter(questFilter === item.filter ? 'all' : item.filter)}
              className={cn(
                "rounded-full border px-4 py-2 text-left shadow-sm transition-colors",
                questFilter === item.filter ? "border-accent/50 bg-accent/10 ring-2 ring-accent/15" : "border-border/50 bg-card"
              )}
            >
              <div className="flex items-center gap-2" title={item.description}>
                <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                <div className="font-headline text-lg font-bold italic leading-none text-primary">{item.value}</div>
              </div>
            </button>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]">
          {enrichedGoals.filter((row) => row.id === planningGoalId).map((row) => (
            <React.Fragment key={`simple-plan:${row.id}`}>
              <section className="border border-border bg-card p-4 md:p-5" aria-labelledby={`goal-intention-${row.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">Goal scope</div>
                    <h3 id={`goal-intention-${row.id}`} className="mt-1 font-headline text-xl font-bold italic">Focus this goal</h3>
                    <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">Choose only the activity that should move this goal forward. No paragraphs required.</p>
                  </div>
                  <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase">{questTypeForGoal(row, row.type)}</Badge>
                </div>
                {(['consumption', 'inquiry', 'position', 'practice', 'expression'].includes(questKindForGoal(row, row.type))) ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {questKindForGoal(row, row.type) === 'consumption' && (
                      <div>
                        <Label htmlFor={`goal-source-measure-${row.id}`} className="text-sm font-medium">Count</Label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the source milestone that advances this goal.</p>
                        <Select value={row.sourceMeasure || 'finished'} onValueChange={(value) => updateGoal(row.id, { sourceMeasure: value as SourceGoalMeasure })}>
                          <SelectTrigger id={`goal-source-measure-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="finished">Finished sources</SelectItem><SelectItem value="fully_reflected">Complete source records</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                    {questKindForGoal(row, row.type) === 'consumption' && (
                      <div>
                        <Label htmlFor={`goal-source-type-${row.id}`} className="text-sm font-medium">Source type</Label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Only finished sources of this type will count.</p>
                        <Select value={row.sourceType || 'all-source-types'} onValueChange={(value) => updateGoal(row.id, { sourceType: value === 'all-source-types' ? undefined : value as MediaType })}>
                          <SelectTrigger id={`goal-source-type-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all-source-types">Any source type</SelectItem>{MEDIA_TYPES.map((mediaType) => <SelectItem key={mediaType} value={mediaType}>{MEDIA_LABELS[mediaType]}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {questKindForGoal(row, row.type) === 'inquiry' && (
                      <>
                        <div>
                          <Label htmlFor={`goal-inquiry-measure-${row.id}`} className="text-sm font-medium">Count</Label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the inquiry result that advances this goal.</p>
                          <Select value={row.inquiryMeasure || 'active'} onValueChange={(value) => updateGoal(row.id, { inquiryMeasure: value as InquiryGoalMeasure })}>
                            <SelectTrigger id={`goal-inquiry-measure-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="active">Active inquiries</SelectItem><SelectItem value="answered">Inquiries with an answer</SelectItem><SelectItem value="resolved">Resolved inquiries</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`goal-inquiry-${row.id}`} className="text-sm font-medium">Inquiry focus</Label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Count one specific inquiry only.</p>
                          <Select value={row.relatedObjectIds?.inquiryIds?.[0] || 'all-inquiries'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, inquiryIds: value === 'all-inquiries' ? [] : [value] } })}>
                            <SelectTrigger id={`goal-inquiry-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="all-inquiries">Any inquiry</SelectItem>{inquiries.filter((inquiry) => !['archived', 'no_longer_meaningful'].includes(inquiry.status)).map((inquiry) => <SelectItem key={inquiry.id} value={inquiry.id}>{inquiry.text}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    {(['consumption', 'inquiry', 'position', 'practice', 'expression'].includes(questKindForGoal(row, row.type))) && (
                    <div>
                      <Label htmlFor={`goal-concept-${row.id}`} className="text-sm font-medium">Concept focus</Label>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Count only activity tagged with this concept.</p>
                      <Select value={row.relatedObjectIds?.conceptIds?.[0] || 'all-concepts'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, conceptIds: value === 'all-concepts' ? [] : [value] } })}>
                        <SelectTrigger id={`goal-concept-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all-concepts">Any concept</SelectItem>{concepts.map((concept) => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    )}
                    {questKindForGoal(row, row.type) === 'position' && (
                      <>
                        <div>
                          <Label htmlFor={`goal-position-measure-${row.id}`} className="text-sm font-medium">Count</Label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose what kind of position progress matters here.</p>
                          <Select value={row.positionMeasure || 'reviewed'} onValueChange={(value) => updateGoal(row.id, { positionMeasure: value as PositionGoalMeasure })}>
                            <SelectTrigger id={`goal-position-measure-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="reviewed">Reviewed positions</SelectItem><SelectItem value="revised">Revised positions</SelectItem><SelectItem value="confident">100% confidence positions</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`goal-position-${row.id}`} className="text-sm font-medium">Position focus</Label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Count progress on one specific position.</p>
                          <Select value={row.relatedObjectIds?.positionIds?.[0] || 'all-positions'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, positionIds: value === 'all-positions' ? [] : [value] } })}>
                            <SelectTrigger id={`goal-position-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="all-positions">Any position</SelectItem>{positions.filter((position) => position.status !== 'abandoned').map((position) => <SelectItem key={position.id} value={position.id}>{position.title}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    {questKindForGoal(row, row.type) === 'practice' && (
                      <>
                        <div>
                          <Label htmlFor={`goal-practice-measure-${row.id}`} className="text-sm font-medium">Count</Label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose whether completion, logged days, or consistency advances this goal.</p>
                          <Select value={row.practiceMeasure || 'completed'} onValueChange={(value) => updateGoal(row.id, { practiceMeasure: value as PracticeGoalMeasure })}>
                            <SelectTrigger id={`goal-practice-measure-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="completed">Completed practices</SelectItem><SelectItem value="logged_days">Days logged</SelectItem><SelectItem value="log_streak">Longest log streak</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`goal-practice-${row.id}`} className="text-sm font-medium">Practice focus</Label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Count one completed practice only.</p>
                          <Select value={row.relatedObjectIds?.practiceIds?.[0] || 'all-practices'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, practiceIds: value === 'all-practices' ? [] : [value] } })}>
                            <SelectTrigger id={`goal-practice-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="all-practices">Any practice</SelectItem>{practices.filter((practice) => practice.status !== 'abandoned').map((practice) => <SelectItem key={practice.id} value={practice.id}>{practice.title}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`goal-practice-position-${row.id}`} className="text-sm font-medium">Linked position</Label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Optional. Count completed practices that test this position.</p>
                          <Select value={row.relatedObjectIds?.positionIds?.[0] || 'all-linked-positions'} onValueChange={(value) => updateGoal(row.id, { relatedObjectIds: { ...row.relatedObjectIds, positionIds: value === 'all-linked-positions' ? [] : [value] } })}>
                            <SelectTrigger id={`goal-practice-position-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="all-linked-positions">Any linked position</SelectItem>{positions.filter((position) => position.status !== 'abandoned').map((position) => <SelectItem key={position.id} value={position.id}>{position.title}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    {questKindForGoal(row, row.type) === 'expression' && (
                      <div>
                        <Label htmlFor={`goal-work-measure-${row.id}`} className="text-sm font-medium">Count</Label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the work milestone that advances this goal.</p>
                        <Select value={row.workMeasure || 'completed'} onValueChange={(value) => updateGoal(row.id, { workMeasure: value as WorkGoalMeasure })}>
                          <SelectTrigger id={`goal-work-measure-${row.id}`} className="mt-2 h-10"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="completed">Completed works</SelectItem><SelectItem value="published">Published works</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : <p className="mt-4 text-sm leading-6 text-muted-foreground">This goal tracks {questTypeForGoal(row, row.type).toLowerCase()} activity across your workspace.</p>}
              </section>

              <aside className="border border-border bg-card p-4 md:p-5">
                <div className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Progress</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="font-headline text-4xl font-bold italic leading-none">{Math.round(row.percent)}%</div>
                  <span className="text-sm text-muted-foreground">{row.currentProgress} of {row.targetProgress}</span>
                </div>
                <Progress value={row.percent} className="mt-3 h-2" />
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{goalProgressDescription(row, row.type)}</p>
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
        <div className="hidden grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <Label className="readex-kicker text-[9px] font-bold uppercase">Goal Set Name</Label>
              <Input value={draft.label} onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))} className="mt-2 h-11 max-w-xl rounded-full" />
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 p-3">
              <div>
                <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Goals and challenges</div>
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
                    <SelectItem value="all">All goals</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="stalled">Stalled</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="abandoned">Abandoned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3">
              {enrichedGoals.filter((row) => row.id === planningGoalId).map((row) => (
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
                    <details className="group mt-3 rounded-xl border border-border/50 bg-card/60 p-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                        Goal details, milestones, and review
                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
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
                        {!!(row.milestones || []).length && (
                          <Button variant="outline" size="sm" onClick={() => addMilestone(row.id)} className="h-8 rounded-full bg-background">
                            <Plus className="mr-1 size-3" /> Step
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        {((row.milestones || []).length ? row.milestones || [] : defaultQuestMilestones(row, row.type)).map((milestone, index) => (
                          <div key={`${row.id}:milestone:${index}`} className="grid gap-2 sm:grid-cols-[24px_1fr_auto]">
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
                            {(row.milestones || []).length ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeMilestone(row.id, index)}
                                className="size-9 rounded-full text-muted-foreground hover:text-destructive"
                                aria-label={`Remove milestone ${index + 1}`}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
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
                    </details>
                  </div>
                  <div className="space-y-2">
                    <Select value={row.typeId} onValueChange={(value) => updateGoal(row.id, { typeId: value, goalKind: goalKindForType(activeGoalTypes.find((type) => type.id === value)), sourceType: undefined })}>
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
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-9 rounded-full" aria-label={`Decrease ${row.title} progress`} onClick={() => updateGoal(row.id, { currentProgress: Math.max(0, row.currentProgress - 1) })}>
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={row.currentProgress}
                      onChange={(event) => updateGoal(row.id, { currentProgress: Math.max(0, Number(event.target.value) || 0) })}
                      className="h-9 min-w-14 rounded-full text-center font-code text-xs"
                      aria-label={`${row.title} current progress`}
                    />
                    <Button variant="outline" size="icon" className="size-9 rounded-full" aria-label={`Increase ${row.title} progress`} onClick={() => updateGoal(row.id, { currentProgress: row.currentProgress + 1 })}>
                      <Plus className="size-3.5" />
                    </Button>
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

          <Card className="hidden rounded-2xl border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-code text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Goal Trackers</h2>
                <p className="mt-2 text-xs italic text-muted-foreground">Track a specific Noesis activity, such as books completed, inquiries resolved, works finished, or concepts clarified. Free-form life commitments belong in Practices.</p>
              </div>
              <Button variant="outline" size="sm" onClick={addGoalType} className="min-h-9 rounded-full"><Plus className="mr-1 size-3.5" /> Tracker</Button>
            </div>
            <details className="group mt-4 rounded-xl border border-border/50 bg-background/50 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
                Manage tracker types
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
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
            </details>
          </Card>
        </div>
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
