"use client";

import { ConceptAtlas } from '@/components/Atlas/ConceptAtlas';
import type {
  AtlasMap,
  Concept,
  Draft,
  Insight,
  Media,
  PhilosophicalLink,
  Practice,
  Question,
  ThinkingEvent,
  TimelineEvent,
  Unknown,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface AtlasRoutePageProps {
  concepts: Concept[];
  media: Media[];
  insights: Insight[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  atlasMaps: AtlasMap[];
  links: PhilosophicalLink[];
  thinkingEvents: ThinkingEvent[];
  unknowns: Unknown[];
  uid: string;
  onAddConcept: (data: Partial<Concept>) => void;
  onUpdateConcept: (concept: Concept) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onAddAtlasMap: (data: Partial<AtlasMap>) => void;
  onUpdateAtlasMap: (map: AtlasMap) => void;
  onDeleteAtlasMap: (id: string) => void;
  onDeleteLink: (id: string, options?: { method?: string }) => void;
  onInteractLink: (id: string) => void;
  onNavigate: (view: NoesisView, options?: {
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
  }) => void;
}

export function AtlasRoutePage({
  concepts,
  media,
  insights,
  vault,
  drafts,
  practices,
  questions,
  timeline,
  atlasMaps,
  links,
  thinkingEvents,
  unknowns,
  uid,
  onAddConcept,
  onUpdateConcept,
  onCreateLink,
  onAddAtlasMap,
  onUpdateAtlasMap,
  onDeleteAtlasMap,
  onDeleteLink,
  onInteractLink,
  onNavigate,
}: AtlasRoutePageProps) {
  return (
    <ConceptAtlas
      concepts={concepts}
      media={media}
      insights={insights}
      vault={vault}
      drafts={drafts}
      practices={practices}
      questions={questions}
      timeline={timeline}
      atlasMaps={atlasMaps}
      links={links}
      thinkingEvents={thinkingEvents}
      unknowns={unknowns}
      onAddConcept={onAddConcept}
      onUpdateConcept={onUpdateConcept}
      onCreateLink={onCreateLink}
      onAddAtlasMap={onAddAtlasMap}
      onUpdateAtlasMap={onUpdateAtlasMap}
      onDeleteAtlasMap={onDeleteAtlasMap}
      onDeleteLink={onDeleteLink}
      onInteractLink={onInteractLink}
      uid={uid}
      onOpenPosition={(id) => onNavigate('vault', { positionId: id })}
      onOpenQuestion={(id) => onNavigate('questions', { questionId: id })}
      onOpenSource={(id) => onNavigate('library', { sourceId: id })}
      onOpenWriting={() => onNavigate('writing')}
      onOpenPractices={() => onNavigate('practices')}
    />
  );
}
