"use client";

import { BeliefVault } from '@/components/Vault/BeliefVault';
import type {
  AiSuggestion,
  BeliefProfile,
  Concept,
  Draft,
  Media,
  PhilosophicalLink,
  Practice,
  Question,
  TimelineEvent,
  Unknown,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface PositionsRoutePageProps {
  entries: VaultEntry[];
  media: Media[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  concepts: Concept[];
  links: PhilosophicalLink[];
  beliefProfiles: BeliefProfile[];
  unknowns: Unknown[];
  suggestions: AiSuggestion[];
  focusedEntryId?: string | null;
  onAddEntry: (data: Partial<VaultEntry>) => void;
  onUpdateEntry: (entry: VaultEntry) => void;
  onDeleteEntry: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onAddDraft: (data: Partial<Draft>) => void;
  onAddPractice: (data: Partial<Practice>) => void;
  onAddQuestion: (data: Partial<Question>) => void;
  onCreateIdea: (data: { title: string; body: string; tags: string[]; sourceIds: string[]; position?: { title: string; statement: string; description: string; confidence: number } }) => void;
  onUpdateLink: (link: PhilosophicalLink) => void;
  onAddUnknown: (data: Partial<Unknown>) => Unknown;
  onUpdateSuggestion: (suggestion: AiSuggestion) => void;
  onCreateSuggestion: (suggestion: Partial<AiSuggestion>) => void;
  onNavigate: (view: NoesisView, options?: {
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
  }) => void;
}

export function PositionsRoutePage({
  entries,
  media,
  drafts,
  practices,
  questions,
  timeline,
  concepts,
  links,
  beliefProfiles,
  unknowns,
  suggestions,
  focusedEntryId,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddConcept,
  onCreateLink,
  onAddDraft,
  onAddPractice,
  onAddQuestion,
  onCreateIdea,
  onUpdateLink,
  onAddUnknown,
  onUpdateSuggestion,
  onCreateSuggestion,
  onNavigate,
}: PositionsRoutePageProps) {
  return (
    <BeliefVault
      entries={entries}
      media={media}
      drafts={drafts}
      practices={practices}
      questions={questions}
      timeline={timeline}
      concepts={concepts}
      links={links}
      beliefProfiles={beliefProfiles}
      unknowns={unknowns}
      suggestions={suggestions}
      onAddEntry={onAddEntry}
      onUpdateEntry={onUpdateEntry}
      onDeleteEntry={onDeleteEntry}
      onAddConcept={onAddConcept}
      onCreateLink={onCreateLink}
      onAddDraft={onAddDraft}
      onAddPractice={onAddPractice}
      onAddQuestion={onAddQuestion}
      onCreateIdea={onCreateIdea}
      onUpdateLink={onUpdateLink}
      onAddUnknown={onAddUnknown}
      onUpdateSuggestion={onUpdateSuggestion}
      onCreateSuggestion={onCreateSuggestion}
      onOpenSource={(id) => onNavigate('library', { sourceId: id })}
      onOpenQuestion={(id) => onNavigate('questions', { questionId: id })}
      onOpenPractice={(id) => onNavigate('practices', { practiceId: id })}
      onOpenWork={(id) => onNavigate('writing', { workId: id })}
      focusedEntryId={focusedEntryId}
      onOpenEntryRoute={(positionId) => onNavigate('vault', { positionId })}
    />
  );
}
