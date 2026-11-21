"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MediaLibrary } from '@/components/Library/MediaLibrary';
import { PageLoadingState } from '@/components/shared/PageState';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { BookOpen, TableProperties } from 'lucide-react';
import type { AiSettings, Concept, Draft, Media, Practice, Question, TimelineEvent, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

const SourceIndex = dynamic(() => import('@/components/Library/SourceIndex').then((module) => module.SourceIndex), {
  loading: () => <PageLoadingState title="Opening Source Index" />,
});

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
  onUpdateMedia: (media: Media, base?: Pick<Partial<Media>, 'dateUpdated'>, approval?: import('@/lib/source-ai-review').SourceReviewApproval) => void | Promise<unknown>;
  onAttachSourcePhoto: (sourceId: string, photo: import('@/lib/types').StoredAsset) => Promise<void>;
  onDeleteMedia: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateClaim: (data: { title: string; body: string; tags: string[]; sourceIds: string[] }) => void | Promise<unknown>;
  onDeleteVaultEntry: (id: string) => Promise<void>;
  onNavigate: (view: NoesisView, options?: { sourceId?: string | null }) => void;
  aiSettings?: AiSettings;
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
  onAttachSourcePhoto,
  onDeleteMedia,
  onAddConcept,
  onCreateClaim,
  onDeleteVaultEntry,
  onNavigate,
  aiSettings,
}: LibraryRoutePageProps) {
  const [surface, setSurface] = useState<'library' | 'index'>('library');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('noesis:library-surface');
      if (saved === 'index' || saved === 'library') setSurface(saved);
    } catch { /* The Library remains usable when browser storage is unavailable. */ }
  }, []);

  const chooseSurface = (next: 'library' | 'index') => {
    setSurface(next);
    try { window.localStorage.setItem('noesis:library-surface', next); } catch { /* Saving a view preference is optional. */ }
  };

  if (!focusedSourceId && surface === 'index') {
    return (
      <>
        <SourceIndex
          headerTabs={<LibrarySurfaceTabs surface={surface} onChange={chooseSurface} />}
          media={media}
          vault={vault}
          drafts={drafts}
          practices={practices}
          questions={questions}
          onOpenSource={(sourceId) => onNavigate('library', { sourceId })}
        />
      </>
    );
  }

  return (
    <>
      <MediaLibrary
        headerTabs={focusedSourceId ? undefined : <LibrarySurfaceTabs surface={surface} onChange={chooseSurface} />}
        media={media}
        concepts={concepts}
        vault={vault}
        drafts={drafts}
        practices={practices}
        questions={questions}
        timeline={timeline}
        onAddMedia={onAddMedia}
        onUpdateMedia={onUpdateMedia}
        onAttachSourcePhoto={onAttachSourcePhoto}
        onDeleteMedia={onDeleteMedia}
        onAddConcept={onAddConcept}
        onCreateClaim={onCreateClaim}
        onDeleteVaultEntry={onDeleteVaultEntry}
        focusedSourceId={focusedSourceId}
        onOpenSourceRoute={(sourceId) => onNavigate('library', { sourceId })}
        aiSettings={aiSettings}
      />
    </>
  );
}

function LibrarySurfaceTabs({ surface, onChange }: { surface: 'library' | 'index'; onChange: (value: 'library' | 'index') => void }) {
  return (
    <WorkspaceTabs
      value={surface}
      onChange={onChange}
      label="Library views"
      items={[
        { id: 'library', label: 'Library', icon: BookOpen },
        { id: 'index', label: 'Source Index', icon: TableProperties },
      ]}
    />
  );
}
