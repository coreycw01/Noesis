import type { Annotation, Practice, Question, VaultEntry } from './types';
import { isPracticeConcluded, practiceNeedsLog } from './practice-state';
import { hasPracticeIntellectualBasis, isRepeatablePractice } from './workflow-integrity';
import { isInquiryActive } from './inquiry-state';
import { isLivePosition } from './position-state';

export interface WorkspaceAttentionMetrics {
  rawAnnotations: number;
  unsupportedPositions: number;
  openInquiries: number;
  unanchoredPractices: number;
  positionsWithoutPractice: number;
  uniqueTotal: number;
}

function uniqueRecords<T extends { id: string }>(items: T[], key = (item: T) => item.id) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

type AttentionAnnotation = Annotation & { source?: { id: string }; sourceId?: string };
const annotationKey = (item: AttentionAnnotation) => JSON.stringify([item.source?.id ?? item.sourceId, item.id]);

export function deriveWorkspaceAttention<TAnnotation extends AttentionAnnotation>({ annotations, positions, inquiries, practices, now }: {
  annotations: TAnnotation[];
  positions: VaultEntry[];
  inquiries: Question[];
  practices: Practice[];
  now?: Date;
}) {
  const currentPositions = uniqueRecords(positions).filter(isLivePosition);
  const practiceRecords = uniqueRecords(practices);
  const rawAnnotations = uniqueRecords(annotations, annotationKey).filter((item) => (!item.philosophyStatus || item.philosophyStatus === 'raw') && !item.createdInquiryId && !item.createdPositionId);
  const unsupportedPositions = currentPositions.filter((item) => !item.evidenceFor?.length && !item.sourceIds?.length);
  const practicedPositionIds = new Set<string>();
  for (const practice of practiceRecords) {
    if (practice.status === 'abandoned') continue;
    for (const positionId of practice.positionIds || []) practicedPositionIds.add(positionId);
  }
  const untestedPositions = currentPositions.filter((item) => !practicedPositionIds.has(item.id));
  const openInquiries = uniqueRecords(inquiries).filter(isInquiryActive);
  const unanchoredPractices = practiceRecords.filter((item) => !isPracticeConcluded(item) && !isRepeatablePractice(item.type) && !hasPracticeIntellectualBasis(item));
  const practicesNeedingLogs = practiceRecords.filter((item) => practiceNeedsLog(item, now));
  // Categories may overlap; the headline counts each record only once.
  const uniqueTotal = new Set([
    ...rawAnnotations.map((item) => `annotation:${annotationKey(item)}`),
    ...[...unsupportedPositions, ...untestedPositions].map((item) => `position:${item.id}`),
    ...openInquiries.map((item) => `inquiry:${item.id}`),
    ...unanchoredPractices.map((item) => `practice:${item.id}`),
  ]).size;

  return {
    currentPositions, rawAnnotations, unsupportedPositions, untestedPositions, openInquiries,
    unanchoredPractices, practicesNeedingLogs,
    metrics: {
      rawAnnotations: rawAnnotations.length,
      unsupportedPositions: unsupportedPositions.length,
      openInquiries: openInquiries.length,
      unanchoredPractices: unanchoredPractices.length,
      positionsWithoutPractice: untestedPositions.length,
      uniqueTotal,
    } satisfies WorkspaceAttentionMetrics,
  };
}
