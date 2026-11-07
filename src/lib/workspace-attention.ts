import type { Annotation, Practice, Question, VaultEntry } from './types';
import { isPracticeConcluded, practiceNeedsLog } from './practice-state';
import { hasPracticeIntellectualBasis } from './workflow-integrity';

export interface WorkspaceAttentionMetrics {
  rawAnnotations: number;
  unsupportedPositions: number;
  openInquiries: number;
  unanchoredPractices: number;
  positionsWithoutPractice: number;
  uniqueTotal: number;
}

function uniqueRecords<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function deriveWorkspaceAttention<TAnnotation extends Annotation>({ annotations, positions, inquiries, practices }: {
  annotations: TAnnotation[];
  positions: VaultEntry[];
  inquiries: Question[];
  practices: Practice[];
}) {
  const currentPositions = uniqueRecords(positions).filter((item) => !['abandoned', 'rejected', 'replaced', 'suspended'].includes(item.status));
  const practiceRecords = uniqueRecords(practices);
  const rawAnnotations = uniqueRecords(annotations).filter((item) => (!item.philosophyStatus || item.philosophyStatus === 'raw') && !item.createdInquiryId && !item.createdPositionId);
  const unsupportedPositions = currentPositions.filter((item) => !item.evidenceFor?.length && !item.sourceIds?.length);
  const untestedPositions = currentPositions.filter((item) => !practiceRecords.some((practice) => practice.status !== 'abandoned' && practice.positionIds?.includes(item.id)));
  const openInquiries = uniqueRecords(inquiries).filter((item) => !item.answer?.trim() && !['answered', 'resolved', 'archived', 'suspended', 'converted', 'no_longer_meaningful'].includes(item.status));
  const unanchoredPractices = practiceRecords.filter((item) => !isPracticeConcluded(item) && !hasPracticeIntellectualBasis(item));
  const practicesNeedingLogs = practiceRecords.filter((item) => practiceNeedsLog(item));
  // Categories may overlap; the headline counts each record only once.
  const uniqueTotal = new Set([
    ...rawAnnotations.map((item) => `annotation:${item.id}`),
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
