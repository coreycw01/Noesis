"use client";

import { Atelier } from '@/components/Writing/Atelier';
import { WorksHub } from '@/components/Writing/WorksHub';
import type { Concept, Draft, Media, Question, UserPreferences, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface WorksRoutePageProps {
  drafts: Draft[];
  media: Media[];
  vault: VaultEntry[];
  questions: Question[];
  concepts: Concept[];
  writingDefaults: UserPreferences['writingDefaults'];
  focusedDraftId?: string | null;
  onAddDraft: (data: Partial<Draft>) => Draft;
  onUpdateDraft: (draft: Draft) => void;
  onDeleteDraft: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onNavigate: (view: NoesisView, options?: { workId?: string | null }) => void;
}

export function WorksRoutePage({
  drafts,
  media,
  vault,
  questions,
  concepts,
  writingDefaults,
  focusedDraftId,
  onAddDraft,
  onUpdateDraft,
  onDeleteDraft,
  onAddConcept,
  onNavigate,
}: WorksRoutePageProps) {
  if (!focusedDraftId) {
    return (
      <WorksHub
        drafts={drafts}
        media={media}
        vault={vault}
        questions={questions}
        concepts={concepts}
        writingDefaults={writingDefaults}
        onAddDraft={onAddDraft}
        onDeleteDraft={onDeleteDraft}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <Atelier
      drafts={drafts}
      media={media}
      vault={vault}
      questions={questions}
      concepts={concepts}
      writingDefaults={writingDefaults}
      onAddDraft={onAddDraft}
      onUpdateDraft={onUpdateDraft}
      onDeleteDraft={onDeleteDraft}
      onAddConcept={onAddConcept}
      focusedDraftId={focusedDraftId}
      onOpenDraftRoute={(workId) => onNavigate('writing', { workId })}
    />
  );
}
