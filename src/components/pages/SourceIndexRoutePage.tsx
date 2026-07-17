"use client";

import { SourceIndex } from '@/components/Library/SourceIndex';
import type { Draft, Media, Practice, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface SourceIndexRoutePageProps {
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  onNavigate: (view: NoesisView, options?: { sourceId?: string | null }) => void;
}

export function SourceIndexRoutePage({
  media,
  vault,
  drafts,
  practices,
  questions,
  onNavigate,
}: SourceIndexRoutePageProps) {
  return (
    <SourceIndex
      media={media}
      vault={vault}
      drafts={drafts}
      practices={practices}
      questions={questions}
      onOpenSource={(sourceId) => onNavigate('library', { sourceId })}
    />
  );
}
