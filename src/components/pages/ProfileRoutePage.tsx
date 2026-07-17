"use client";

import type { User } from 'firebase/auth';
import { ProfilePage } from '@/components/Profile/ProfilePage';
import type {
  BeliefProfile,
  Concept,
  Draft,
  Media,
  Practice,
  ProfileMetacognitionSummary,
  ProfilePrivacySettings,
  Question,
  ThinkingEvent,
  ThinkingMetrics,
  ThinkingPattern,
  Unknown,
  UserProfile,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface ProfileRoutePageProps {
  user: User | null;
  profile: UserProfile;
  privacy: ProfilePrivacySettings;
  summary: ProfileMetacognitionSummary;
  concepts: Concept[];
  inquiries: Question[];
  positions: VaultEntry[];
  sources: Media[];
  works: Draft[];
  practices: Practice[];
  thinkingEvents: ThinkingEvent[];
  beliefProfiles: BeliefProfile[];
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  thinkingMetrics: ThinkingMetrics;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onSavePrivacy: (privacy: ProfilePrivacySettings) => Promise<void>;
  onAddUnknown: (unknown: Partial<Unknown>) => Unknown;
  onUpdateUnknown: (unknown: Unknown) => void;
  onUpdateThinkingPattern: (pattern: ThinkingPattern) => void;
  onNavigate: (view: NoesisView, options?: {
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
  }) => void;
}

export function ProfileRoutePage({
  user,
  profile,
  privacy,
  summary,
  concepts,
  inquiries,
  positions,
  sources,
  works,
  practices,
  thinkingEvents,
  beliefProfiles,
  unknowns,
  thinkingPatterns,
  thinkingMetrics,
  onSaveProfile,
  onSavePrivacy,
  onAddUnknown,
  onUpdateUnknown,
  onUpdateThinkingPattern,
  onNavigate,
}: ProfileRoutePageProps) {
  return (
    <ProfilePage
      user={user}
      profile={profile}
      privacy={privacy}
      summary={summary}
      concepts={concepts}
      inquiries={inquiries}
      positions={positions}
      sources={sources}
      works={works}
      practices={practices}
      thinkingEvents={thinkingEvents}
      beliefProfiles={beliefProfiles}
      unknowns={unknowns}
      thinkingPatterns={thinkingPatterns}
      thinkingMetrics={thinkingMetrics}
      onSaveProfile={onSaveProfile}
      onSavePrivacy={onSavePrivacy}
      onAddUnknown={onAddUnknown}
      onUpdateUnknown={onUpdateUnknown}
      onUpdateThinkingPattern={onUpdateThinkingPattern}
      onNavigate={(nextView, targetId) => {
        onNavigate(nextView as NoesisView, {
          questionId: nextView === 'questions' ? targetId : null,
          positionId: nextView === 'vault' ? targetId : null,
          sourceId: nextView === 'library' ? targetId : null,
        });
      }}
    />
  );
}
