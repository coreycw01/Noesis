import { runTransaction, type DocumentReference } from 'firebase/firestore';
import { commitmentCheckInDay, commitmentDueOnDay, withCommitmentCheckIn } from './commitments';
import { goalCategories, goalItems } from './goal-progress';
import type { CommitmentCheckIn, GoalSettings } from './types';
import { requireWorkspaceConnection } from './workspace-connectivity';

export type SaveGoalCheckIn = (goalId: string, checkIn: CommitmentCheckIn) => Promise<GoalSettings>;
export type SaveGoalPlan = (goal: GoalSettings, baseline: GoalSettings) => Promise<GoalSettings>;

function goalPlanSignature(settings: GoalSettings) {
  const categories = goalCategories(settings);
  return JSON.stringify({
    label: settings.label,
    types: settings.types,
    targets: settings.targets,
    categories: categories.map(({ updatedAt: _updatedAt, createdAt: _createdAt, ...category }) => category),
    goals: goalItems(settings, categories).map(({ commitmentCheckIns: _checkIns, updatedAt: _updatedAt, createdAt: _createdAt, ...goal }) => goal),
  }, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value);
}

export function applyGoalPlan(draft: GoalSettings, baseline: GoalSettings, current: GoalSettings) {
  if (goalPlanSignature(baseline) !== goalPlanSignature(current)) {
    throw new Error('Commitments changed in another tab or device. Your draft was kept. Discard it to load the latest plan before editing again.');
  }
  return preserveSavedGoalCheckIns(draft, current);
}

export function applyGoalCheckIn(settings: GoalSettings, goalId: string, checkIn: CommitmentCheckIn): GoalSettings {
  const goals = goalItems(settings, goalCategories(settings));
  const goal = goals.find((item) => item.id === goalId);
  if (!goal) throw new Error('Save this commitment before logging it.');
  if (goal.commitmentCheckIns?.some((entry) => entry.id === checkIn.id)) return settings;
  if (!Number.isFinite(Date.parse(checkIn.date)) || !commitmentDueOnDay(goal, commitmentCheckInDay(checkIn))) {
    throw new Error('This commitment is not due or already has a check-in today.');
  }
  return { ...settings, goals: goals.map((item) => item.id === goalId ? withCommitmentCheckIn(item, checkIn) : item) };
}

export function preserveSavedGoalCheckIns(draft: GoalSettings, saved: GoalSettings): GoalSettings {
  if (!draft.goals) return draft;
  const savedById = new Map(goalItems(saved, goalCategories(saved)).map((item) => [item.id, item]));
  return {
    ...draft,
    goals: draft.goals.map((item) => {
      const checkIns = savedById.get(item.id)?.commitmentCheckIns;
      return checkIns ? { ...item, commitmentCheckIns: checkIns } : item;
    }),
  };
}

export function writeGoalSettings(
  ref: DocumentReference, fallback: GoalSettings, change: (current: GoalSettings) => GoalSettings,
) {
  requireWorkspaceConnection();
  return runTransaction(ref.firestore, async (transaction) => {
    const stored = await transaction.get(ref);
    const current = stored.exists() ? { ...fallback, ...stored.data() } as GoalSettings : fallback;
    const next = change(current);
    if (next !== current) transaction.set(ref, next, { merge: true });
    return next;
  });
}
