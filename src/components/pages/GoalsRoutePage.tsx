"use client";

import { GoalsPage } from '@/components/Goals/GoalsPage';
import type { SaveGoalCheckIn } from '@/lib/goal-persistence';
import type { Concept, Draft, GoalSettings, Media, MediaType, Practice, Question, UserProfile, VaultEntry } from '@/lib/types';

export interface GoalsRoutePageProps {
  goal: GoalSettings;
  goalProgress: Partial<Record<MediaType, number>>;
  concepts: Concept[];
  inquiries: Question[];
  sources: Media[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  profile: UserProfile;
  onSaveGoal: import('@/lib/goal-persistence').SaveGoalPlan;
  onSaveCheckIn: SaveGoalCheckIn;
  focusedGoalId: string | null;
  onOpenCommitment: (goalId: string | null) => void;
  onOpenPraxis: (method: 'practices' | 'experiments') => void;
}

export function GoalsRoutePage(props: GoalsRoutePageProps) {
  return <GoalsPage {...props} />;
}
