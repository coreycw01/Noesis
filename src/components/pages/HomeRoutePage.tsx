"use client";

import { ThinkingDesk } from '@/components/Home/ThinkingDesk';
import type {
  Concept,
  Draft,
  Media,
  PhilosophicalLink,
  Practice,
  Question,
  ThinkingEvent,
  TimelineEvent,
  Unknown,
  UserProfile,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

type HomeRouteTarget = {
  view: NoesisView;
  targetId?: string | null;
};

export interface HomeRoutePageProps {
  profile: UserProfile;
  concepts: Concept[];
  media: Media[];
  inquiries: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  timeline: TimelineEvent[];
  thinkingEvents: ThinkingEvent[];
  unknowns: Unknown[];
  links: PhilosophicalLink[];
  onCreateInquiry: (data: Partial<Question>) => Question;
  onNavigate: (view: NoesisView, options?: {
    conceptId?: string | null;
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
  }) => void;
}

function routeOptionsForHomeTarget(target: HomeRouteTarget) {
  return {
    conceptId: target.view === 'concepts' ? target.targetId : null,
    questionId: target.view === 'questions' ? target.targetId : null,
    sourceId: target.view === 'library' ? target.targetId : null,
    positionId: target.view === 'vault' ? target.targetId : null,
    workId: target.view === 'writing' ? target.targetId : null,
    practiceId: target.view === 'practices' ? target.targetId : null,
  };
}

export function HomeRoutePage({
  profile,
  concepts,
  media,
  inquiries,
  positions,
  works,
  practices,
  timeline,
  thinkingEvents,
  unknowns,
  links,
  onCreateInquiry,
  onNavigate,
}: HomeRoutePageProps) {
  return (
    <ThinkingDesk
      profile={profile}
      concepts={concepts}
      media={media}
      inquiries={inquiries}
      positions={positions}
      works={works}
      practices={practices}
      timeline={timeline}
      thinkingEvents={thinkingEvents}
      unknowns={unknowns}
      links={links}
      onCreateInquiry={onCreateInquiry}
      onNavigate={(target) => onNavigate(target.view, routeOptionsForHomeTarget(target))}
    />
  );
}
