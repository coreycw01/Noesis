"use client";

import { ConceptEncyclopedia } from '@/components/Concepts/ConceptEncyclopedia';
import type {
  Concept,
  Draft,
  Insight,
  Media,
  PhilosophicalLink,
  Practice,
  Question,
  TimelineEvent,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface ConceptsRoutePageProps {
  concepts: Concept[];
  media: Media[];
  insights: Insight[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  focusedConceptId?: string | null;
  onAddConcept: (data: Partial<Concept>) => void;
  onUpdateConcept: (concept: Concept) => void;
  onDeleteConcept: (id: string) => void;
  onCreateIdea: (data: { title: string; body: string; tags: string[]; sourceIds: string[] }) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>, options?: { creationMethod?: string }) => void;
  onNavigate: (view: NoesisView, options?: { conceptId?: string | null }) => void;
}

export function ConceptsRoutePage({
  concepts,
  media,
  insights,
  vault,
  drafts,
  practices,
  questions,
  timeline,
  focusedConceptId,
  onAddConcept,
  onUpdateConcept,
  onDeleteConcept,
  onCreateIdea,
  onCreateLink,
  onNavigate,
}: ConceptsRoutePageProps) {
  return (
    <ConceptEncyclopedia
      concepts={concepts}
      media={media}
      insights={insights}
      vault={vault}
      drafts={drafts}
      practices={practices}
      questions={questions}
      timeline={timeline}
      onAddConcept={onAddConcept}
      onUpdateConcept={onUpdateConcept}
      onDeleteConcept={onDeleteConcept}
      onCreateIdea={onCreateIdea}
      onCreateLink={onCreateLink}
      focusedConceptId={focusedConceptId}
      onOpenConceptRoute={(conceptId) => onNavigate('concepts', { conceptId })}
    />
  );
}
