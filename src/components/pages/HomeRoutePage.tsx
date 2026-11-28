"use client";

import { ThinkingDesk } from '@/components/Home/ThinkingDesk';
import type {
  Concept,
  Draft,
  GoalSettings,
  Media,
  MediaType,
  PhilosophicalLink,
  Practice,
  Question,
  Unknown,
  UserProfile,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';
import type { HomeHistoryTarget } from '@/lib/home-history';

export interface HomeRoutePageProps {
  aiEnabled: boolean;
  profile: UserProfile;
  concepts: Concept[];
  media: Media[];
  inquiries: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  unknowns: Unknown[];
  links: PhilosophicalLink[];
  goal: GoalSettings;
  showCommitments: boolean;
  goalProgress: Partial<Record<MediaType, number>>;
  onCreateInquiry: (data: Partial<Question>) => Promise<Question>;
  onCreateWork: (data: Partial<Draft>) => Promise<Draft>;
  onCreatePosition: (data: Partial<VaultEntry>) => Promise<VaultEntry>;
  onCreateConcept: (data: Partial<Concept>) => Promise<boolean>;
  onCreatePractice: (data: Partial<Practice>) => Promise<Practice>;
  onUpdatePractice: (practice: Practice) => void | Promise<Practice | void>;
  onNavigate: (view: NoesisView, options?: {
    conceptId?: string | null;
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
    goalId?: string | null;
    annotationSourceId?: string | null;
    annotationId?: string | null;
  }) => void;
}

function routeOptionsForHomeTarget(target: HomeHistoryTarget) {
  return {
    conceptId: target.view === 'concepts' ? target.targetId : null,
    questionId: target.view === 'questions' ? target.targetId : null,
    sourceId: target.view === 'library' ? target.targetId : null,
    positionId: target.view === 'vault' ? target.targetId : null,
    workId: target.view === 'writing' ? target.targetId : null,
    practiceId: target.view === 'labs' ? target.targetId : null,
    goalId: target.view === 'goals' ? target.targetId : null,
    annotationSourceId: target.view === 'annotations' ? target.annotationSourceId : null,
    annotationId: target.view === 'annotations' ? target.targetId : null,
  };
}

export function HomeRoutePage({
  aiEnabled,
  profile,
  concepts,
  media,
  inquiries,
  positions,
  works,
  practices,
  unknowns,
  links,
  goal,
  showCommitments,
  goalProgress,
  onCreateInquiry,
  onCreateWork,
  onCreatePosition,
  onCreateConcept,
  onCreatePractice,
  onUpdatePractice,
  onNavigate,
}: HomeRoutePageProps) {
  return (
    <ThinkingDesk
      aiEnabled={aiEnabled}
      profile={profile}
      concepts={concepts}
      media={media}
      inquiries={inquiries}
      positions={positions}
      works={works}
      practices={practices}
      unknowns={unknowns}
      links={links}
      goal={goal}
      showCommitments={showCommitments}
      goalProgress={goalProgress}
      onCreateInquiry={onCreateInquiry}
      onCreateWork={onCreateWork}
      onCreatePosition={onCreatePosition}
      onCreateConcept={onCreateConcept}
      onCreatePractice={onCreatePractice}
      onUpdatePractice={onUpdatePractice}
      onNavigate={(target) => onNavigate(target.view, routeOptionsForHomeTarget(target))}
    />
  );
}
