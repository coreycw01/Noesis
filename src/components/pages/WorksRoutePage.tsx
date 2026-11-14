"use client";

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { WorksHub } from '@/components/Writing/WorksHub';
import { PageLoadingState } from '@/components/shared/PageState';
import type { Concept, Draft, Media, Question, UserPreferences, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';
import type { WorkVersion } from '@/lib/work-recovery';

const Atelier = dynamic(() => import('@/components/Writing/Atelier').then((module) => module.Atelier), {
  loading: () => <PageLoadingState title="Opening your work" loadingLayout="studio" />,
});

export interface WorksRoutePageProps {
  uid: string;
  isReviewWorkspace?: boolean;
  drafts: Draft[];
  media: Media[];
  vault: VaultEntry[];
  questions: Question[];
  concepts: Concept[];
  writingDefaults: UserPreferences['writingDefaults'];
  focusedDraftId?: string | null;
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onUpdateDraft: (draft: Draft, expectedVersion?: WorkVersion) => Promise<Draft>;
  onDeleteDraft: (id: string) => void;
  onMarkDraftOpened: (draft: Draft) => void | Promise<void>;
  onAddConcept: (data: Partial<Concept>) => void;
  onNavigate: (view: NoesisView, options?: { workId?: string | null }) => void;
}

export function WorksRoutePage({
  uid,
  isReviewWorkspace = false,
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
  const openedKey = useRef<string | null>(null);
  const activeDraft = focusedDraftId ? drafts.find((draft) => draft.id === focusedDraftId) : undefined;
  useEffect(() => {
    if (!activeDraft) {
      openedKey.current = null;
      return;
    }
    const key = JSON.stringify([uid, activeDraft.id]);
    if (openedKey.current === key) return;
    openedKey.current = key;
    // Opening a document must not depend on recording its recency.
    void Promise.resolve().then(() => onMarkDraftOpened(activeDraft)).catch(() => {});
  }, [activeDraft, onMarkDraftOpened, uid]);

  if (!focusedDraftId) {
    return (
      <WorksHub
        drafts={drafts}
        media={media}
        vault={vault}
        questions={questions}
        writingDefaults={writingDefaults}
        onAddDraft={onAddDraft}
        onDeleteDraft={onDeleteDraft}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <Atelier
      uid={uid}
      isReviewWorkspace={isReviewWorkspace}
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
