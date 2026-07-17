"use client";

import { PracticesWorkspace } from '@/components/Practices/PracticesWorkspace';
import type { Concept, Draft, Media, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface PracticesRoutePageProps {
  practices: Practice[];
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  focusedPracticeId?: string | null;
  onAddPractice: (data: Partial<Practice>) => void;
  onUpdatePractice: (practice: Practice) => void;
  onDeletePractice: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onNavigate: (view: NoesisView, options?: { practiceId?: string | null }) => void;
}

export function PracticesRoutePage({
  practices,
  concepts,
  media,
  questions,
  positions,
  drafts,
  focusedPracticeId,
  onAddPractice,
  onUpdatePractice,
  onDeletePractice,
  onAddConcept,
  onCreateLink,
  onNavigate,
}: PracticesRoutePageProps) {
  return (
    <PracticesWorkspace
      practices={practices}
      concepts={concepts}
      media={media}
      questions={questions}
      positions={positions}
      drafts={drafts}
      onAddPractice={onAddPractice}
      onUpdatePractice={onUpdatePractice}
      onDeletePractice={onDeletePractice}
      onAddConcept={onAddConcept}
      onCreateLink={onCreateLink}
      focusedPracticeId={focusedPracticeId}
      onOpenPracticeRoute={(practiceId) => onNavigate('practices', { practiceId })}
    />
  );
}
