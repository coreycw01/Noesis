"use client";

import { GoalsPage } from '@/components/Goals/GoalsPage';
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
  onSaveGoal: (goal: GoalSettings) => Promise<void>;
}

export function GoalsRoutePage({ goal, goalProgress, concepts, inquiries, sources, positions, works, practices, profile, onSaveGoal }: GoalsRoutePageProps) {
  return <GoalsPage goal={goal} goalProgress={goalProgress} concepts={concepts} inquiries={inquiries} sources={sources} positions={positions} works={works} practices={practices} profile={profile} onSaveGoal={onSaveGoal} />;
}
