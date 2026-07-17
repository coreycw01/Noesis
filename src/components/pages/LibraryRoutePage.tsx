"use client";

import { MediaLibrary } from '@/components/Library/MediaLibrary';
import type { Concept, Draft, Media, Practice, Question, TimelineEvent, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface LibraryRoutePageProps {
  media: Media[];
  concepts: Concept[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  focusedSourceId?: string | null;
  onAddMedia: (data: Partial<Media>) => void;
  onUpdateMedia: (media: Media) => void;
  onDeleteMedia: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateIdea: (data: { title: string; body: string; tags: string[]; sourceIds: string[] }) => void;
  onDeleteVaultEntry: (id: string) => void;
  onNavigate: (view: NoesisView, options?: { sourceId?: string | null }) => void;
}

export function LibraryRoutePage({
  media,
  concepts,
  vault,
  drafts,
  practices,
  questions,
  timeline,
  focusedSourceId,
  onAddMedia,
  onUpdateMedia,
  onDeleteMedia,
  onAddConcept,
  onCreateIdea,
  onDeleteVaultEntry,
  onNavigate,
}: LibraryRoutePageProps) {
  return (
    <MediaLibrary
      media={media}
      concepts={concepts}
      vault={vault}
      drafts={drafts}
      practices={practices}
      questions={questions}
      timeline={timeline}
      onAddMedia={onAddMedia}
      onUpdateMedia={onUpdateMedia}
      onDeleteMedia={onDeleteMedia}
      onAddConcept={onAddConcept}
      onCreateIdea={onCreateIdea}
      onDeleteVaultEntry={onDeleteVaultEntry}
      focusedSourceId={focusedSourceId}
      onOpenSourceRoute={(sourceId) => onNavigate('library', { sourceId })}
    />
  );
}
