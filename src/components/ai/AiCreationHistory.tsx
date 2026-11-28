'use client';

import { useContext, useEffect, useState } from 'react';
import { useFirestore } from '@/firebase/provider';
import { sourceAnnotationReviewTarget, type AiProvenanceRecord, type AnnotationOrigin, type ProvenanceRef } from '@/lib/ai-provenance';
import { readAiProvenance } from '@/lib/ai-provenance-read';
import { CONTEXTUAL_AI_LABELS } from '@/lib/contextual-ai';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { ItemHistoryBackground } from '@/components/shared/record/ItemHistoryPanel';
import { AiProvenanceBadge } from './AiProvenanceBadge';

export function AiCreationDetails({ provenance, target, description }: {
  provenance: ProvenanceRef;
  target: AiProvenanceRecord['targets'][number];
  description: string;
}) {
  const db = useFirestore();
  const workspace = useContext(NoesisWorkspaceKeyContext);
  const { type, id, fieldPath, subrecordId } = target;
  const { provenanceId, kind } = provenance;
  const [record, setRecord] = useState<AiProvenanceRecord | null>();
  useEffect(() => {
    let current = true;
    void readAiProvenance(db, workspace, { provenanceId, kind }, { type, id, fieldPath, subrecordId })
      .then(data => { if (current) setRecord(data); })
      .catch(() => { if (current) setRecord(null); });
    return () => { current = false; };
  }, [db, workspace, provenanceId, kind, type, id, fieldPath, subrecordId]);
  const prompt = record?.userPrompt?.trim();
  const action = record?.origin?.action;

  return (
    <div className="space-y-2 border-l border-border pl-3 text-sm [overflow-wrap:anywhere]">
      <p>{description}</p>
      {record === undefined && <p role="status" className="text-muted-foreground">Loading AI origin...</p>}
      {record === null && <p className="text-muted-foreground">The saved AI details are not available.</p>}
      {action && <p className="text-muted-foreground"><strong>AI task:</strong> {CONTEXTUAL_AI_LABELS[action]}</p>}
      {prompt && <div><p className="font-medium">You asked</p><blockquote className="whitespace-pre-wrap text-muted-foreground">{prompt}</blockquote></div>}
      {record && <AiProvenanceBadge provenance={provenance} target={target} label="View AI details" title="Creation origin" />}
    </div>
  );
}

type CreationProps = Parameters<typeof AiCreationDetails>[0];

export function AiCreationHistory(props: CreationProps) {
  return <ItemHistoryBackground title="From Noesis AI" lazy><AiCreationDetails {...props} /></ItemHistoryBackground>;
}

export function PromotedAnnotationCreationDetails({ origins }: { origins?: AnnotationOrigin[] }) {
  return origins?.map(({ annotationId, provenance }) => (
    <AiCreationDetails key={annotationId} provenance={provenance} target={sourceAnnotationReviewTarget(annotationId)}
      description="Noesis AI helped create the source annotation. You then used that annotation to create this item." />
  ));
}
