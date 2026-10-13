"use client";

import { useEffect, useState } from 'react';
import { MediaLibrary } from '@/components/Library/MediaLibrary';
import { SourceIndex } from '@/components/Library/SourceIndex';
import { Button } from '@/components/ui/button';
import { BookOpen, TableProperties } from 'lucide-react';
import type { AiSettings, Concept, Draft, Media, Practice, Question, TimelineEvent, VaultEntry } from '@/lib/types';
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
  onCreateClaim: (data: { title: string; body: string; tags: string[]; sourceIds: string[] }) => void;
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
  onDeleteMedia,
  onAddConcept,
  onCreateClaim,
  onDeleteVaultEntry,
  onNavigate,
  aiSettings,
}: LibraryRoutePageProps) {
  const [surface, setSurface] = useState<'library' | 'index'>('library');

  useEffect(() => {
    const saved = window.localStorage.getItem('noesis:library-surface');
    if (saved === 'index' || saved === 'library') setSurface(saved);
  }, []);

  const chooseSurface = (next: 'library' | 'index') => {
    setSurface(next);
    window.localStorage.setItem('noesis:library-surface', next);
  };

  if (!focusedSourceId && surface === 'index') {
    return (
      <>
        <div className="px-4 pt-3 sm:px-6 lg:px-8">
          <div className="noesis-page-inner pb-0">
            <LibrarySurfaceTabs surface={surface} onChange={chooseSurface} />
          </div>
        </div>
        <SourceIndex
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
      {!focusedSourceId && (
        <div className="px-4 pt-3 sm:px-6 lg:px-8">
          <div className="noesis-page-inner pb-0">
            <LibrarySurfaceTabs surface={surface} onChange={chooseSurface} />
          </div>
        </div>
      )}
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
    <div className="mb-4 flex items-center gap-1 border-b border-border" role="tablist" aria-label="Library views">
      <Button type="button" variant="ghost" role="tab" aria-selected={surface === 'library'} onClick={() => onChange('library')} className="min-h-11 rounded-none border-b-2 border-transparent px-3 data-[selected=true]:border-accent" data-selected={surface === 'library'}>
        <BookOpen className="mr-2 size-4" aria-hidden="true" /> Library
      </Button>
      <Button type="button" variant="ghost" role="tab" aria-selected={surface === 'index'} onClick={() => onChange('index')} className="min-h-11 rounded-none border-b-2 border-transparent px-3 data-[selected=true]:border-accent" data-selected={surface === 'index'}>
        <TableProperties className="mr-2 size-4" aria-hidden="true" /> Source Index
      </Button>
    </div>
  );
}
