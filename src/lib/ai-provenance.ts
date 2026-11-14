import type { ContextualAiAction } from './contextual-ai';
import type { Media } from './types';

export type ProvenanceRef = { provenanceId: string; kind: 'ai-assisted' };
export type AnnotationOrigin = { annotationId: string; provenance: ProvenanceRef };

export function sourceAnnotationReviewTarget(id: string) {
  return { type: 'annotation', id, fieldPath: 'text', subrecordId: id };
}

export function promotedAnnotationOrigins(
  media: readonly Pick<Media, 'id' | 'annotations'>[],
  refs: readonly { sourceId: string; annotationId: string }[],
): AnnotationOrigin[] {
  const origins = new Map<string, AnnotationOrigin>();
  for (const { sourceId, annotationId } of refs) {
    if (origins.has(annotationId)) continue;
    const provenance = media.find((source) => source.id === sourceId)
      ?.annotations?.find((annotation) => annotation.id === annotationId)?.textProvenance;
    if (provenance?.kind === 'ai-assisted' && provenance.provenanceId) {
      origins.set(annotationId, { annotationId, provenance });
    }
  }
  return [...origins.values()];
}

export interface AiProvenanceRecord extends ProvenanceRef {
  id: string;
  userId: string;
  schemaVersion: 1;
  targets: Array<{ type: string; id: string; fieldPath: string; subrecordId: string }>;
  origin: { feature: string; action: ContextualAiAction };
  sourceActionId: string;
  generatedAt: string;
  acceptedAt: unknown;
  precursor: string | null;
  acceptedText?: string;
  contextRefs?: Array<{ type: string; id: string }>;
  acceptedTextHash: string;
  state: 'active' | 'redacted' | 'target-deleted';
}

export async function acceptedTextHash(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
