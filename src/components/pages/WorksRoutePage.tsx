"use client";

import { Atelier } from '@/components/Writing/Atelier';
import { WorksHub } from '@/components/Writing/WorksHub';
import type { Concept, Draft, Media, Question, UserPreferences, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface WorksRoutePageProps {
  uid: string;
  drafts: Draft[];
  media: Media[];
  vault: VaultEntry[];
  questions: Question[];
  concepts: Concept[];
  writingDefaults: UserPreferences['writingDefaults'];
  focusedDraftId?: string | null;
  onAddDraft: (data: Partial<Draft>) => Draft;
  onUpdateDraft: (draft: Draft) => void | Promise<void>;
  onDeleteDraft: (id: string) => void;
  onMarkDraftOpened: (draft: Draft) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onNavigate: (view: NoesisView, options?: { workId?: string | null }) => void;
}

export function WorksRoutePage({
  uid,
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
  onMarkDraftOpened,
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
        onMarkDraftOpened={onMarkDraftOpened}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <Atelier
      uid={uid}
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
