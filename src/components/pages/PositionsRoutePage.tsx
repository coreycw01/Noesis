"use client";

import { BeliefVault } from '@/components/Vault/BeliefVault';
import type {
  BeliefProfile,
  AiSettings,
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
  aiSettings: AiSettings;
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
  focusedEntryId?: string | null;
  onAddEntry: (data: Partial<VaultEntry>) => void;
  onUpdateEntry: (entry: VaultEntry) => void;
  onDeleteEntry: (id: string) => Promise<void>;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onAddDraft: (data: Partial<Draft>) => void;
  onAddPractice: (data: Partial<Practice>) => void;
  onAddQuestion: (data: Partial<Question>) => void;
  onUpdateLink: (link: PhilosophicalLink) => void;
  onNavigate: (view: NoesisView, options?: {
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
  }) => void;
}

export function PositionsRoutePage({
  aiSettings,
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
  focusedEntryId,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddConcept,
  onCreateLink,
  onAddDraft,
  onAddPractice,
  onAddQuestion,
  onUpdateLink,
  onNavigate,
}: PositionsRoutePageProps) {
  return (
    <BeliefVault
      aiSettings={aiSettings}
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
      onAddEntry={onAddEntry}
      onUpdateEntry={onUpdateEntry}
      onDeleteEntry={onDeleteEntry}
      onAddConcept={onAddConcept}
      onCreateLink={onCreateLink}
      onAddDraft={onAddDraft}
      onAddPractice={onAddPractice}
      onAddQuestion={onAddQuestion}
      onUpdateLink={onUpdateLink}
      onOpenSource={(id) => onNavigate('library', { sourceId: id })}
      onOpenQuestion={(id) => onNavigate('questions', { questionId: id })}
      onOpenPractice={(id) => onNavigate('practices', { practiceId: id })}
      onOpenWork={(id) => onNavigate('writing', { workId: id })}
      focusedEntryId={focusedEntryId}
      onOpenEntryRoute={(positionId) => onNavigate('vault', { positionId })}
    />
  );
}
