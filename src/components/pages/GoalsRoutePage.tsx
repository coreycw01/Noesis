"use client";

import { GoalsPage } from '@/components/Goals/GoalsPage';
import type { GoalSettings, MediaType } from '@/lib/types';

export interface GoalsRoutePageProps {
  goal: GoalSettings;
  goalProgress: Partial<Record<MediaType, number>>;
  onSaveGoal: (goal: GoalSettings) => Promise<void>;
}

export function GoalsRoutePage({ goal, goalProgress, onSaveGoal }: GoalsRoutePageProps) {
  return <GoalsPage goal={goal} goalProgress={goalProgress} onSaveGoal={onSaveGoal} />;
}
