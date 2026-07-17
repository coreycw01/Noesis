"use client";

import { AnnotationsIndex } from '@/components/Library/AnnotationsIndex';
import type { AiSuggestion, Annotation, Concept, Media, PhilosophicalLink, Question, VaultEntry } from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export interface AnnotationsRoutePageProps {
  media: Media[];
  concepts: Concept[];
  positions: VaultEntry[];
  inquiries: Question[];
  onUpdateAnnotation: (sourceId: string, annotation: Annotation) => void;
  onDeleteAnnotation: (sourceId: string, annotationId: string) => void;
  onCreatePosition: (data: { title: string; body: string; tags: string[]; sourceIds: string[]; sourceAnnotationId?: string }) => { positionId: string; insightId: string; title: string };
  onCreateInquiry: (data: { text: string; conceptIds: string[]; sourceIds: string[]; evidenceIds: string[]; type: 'annotation'; sourceAnnotationId?: string }) => Question;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateSuggestion: (data: Partial<AiSuggestion>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onNavigate: (view: NoesisView, options?: {
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
  }) => void;
}

export function AnnotationsRoutePage({
  media,
  concepts,
  positions,
  inquiries,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onCreatePosition,
  onCreateInquiry,
  onAddConcept,
  onCreateSuggestion,
  onCreateLink,
  onNavigate,
}: AnnotationsRoutePageProps) {
  return (
    <AnnotationsIndex
      media={media}
      concepts={concepts}
      positions={positions}
      inquiries={inquiries}
      onUpdateAnnotation={onUpdateAnnotation}
      onDeleteAnnotation={onDeleteAnnotation}
      onOpenSource={(sourceId) => onNavigate('library', { sourceId })}
      onCreatePosition={onCreatePosition}
      onCreateInquiry={onCreateInquiry}
      onAddConcept={onAddConcept}
      onCreateSuggestion={onCreateSuggestion}
      onCreateLink={onCreateLink}
      onNavigate={(nextView, targetId) => {
        onNavigate(nextView as NoesisView, {
          positionId: nextView === 'vault' ? targetId : null,
          questionId: nextView === 'questions' ? targetId : null,
          sourceId: nextView === 'library' ? targetId : null,
        });
      }}
    />
  );
}
