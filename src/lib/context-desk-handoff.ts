import type { AiReviewResult } from './contextual-ai';
import { acceptedTextHash, type AiProvenanceRecord } from './ai-provenance';
import { inquiryExperimentSetup } from './inquiry-state';

export type DeskFindingType = 'position' | 'inquiry' | 'practice';
export type DeskFindingTarget = { type: DeskFindingType; id: string };
export type DeskFinding = { id: string; content: string; date: string };
export type DeskExperiment = { title: string; prediction: string; action: string; measure: string };
const REVIEW_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export function deskExperimentId(reviewId?: string) {
  if (!reviewId || !REVIEW_ID.test(reviewId)) throw new Error('This review has no valid identity.');
  return `desk-experiment-${reviewId}`;
}

export function isDeskFindingTarget(record: { type: string; id: string }): record is DeskFindingTarget {
  return record.type === 'position' || record.type === 'inquiry' || record.type === 'practice';
}

export async function prepareDeskFinding(uid: string, target: DeskFindingTarget, result: AiReviewResult, edited: string, records: ReadonlyArray<{ type: string; id: string }>, acceptedAt: unknown, experiment?: DeskExperiment) {
  const content = edited.trim();
  const draft = experiment ? inquiryExperimentSetup(experiment) : null;
  const newExperiment = Boolean(draft && experiment?.title.trim() && target.type === 'practice' && target.id === deskExperimentId(result.reviewId));
  if (result.action !== 'review_selected_context' || result.targetType !== 'context_desk'
    || !result.reviewId || !REVIEW_ID.test(result.reviewId)
    || !content || content.length > 8_000 || !isDeskFindingTarget(target)
    || (experiment ? !newExperiment : !records.some(record => record.type === target.type && record.id === target.id))) {
    throw new Error('Choose a record this review actually read and keep the text within 8,000 characters.');
  }
  const id = `desk-finding-${result.reviewId}-${(await acceptedTextHash(JSON.stringify([target.type, target.id]))).slice(0, 16)}`;
  const finding: DeskFinding = { id, content, date: new Date().toISOString() };
  const origin: AiProvenanceRecord = {
    id, provenanceId: id, userId: uid, schemaVersion: 1, kind: 'ai-assisted', state: 'active',
    targets: [{ type: target.type, id: target.id, fieldPath: 'contextDeskFindings.content', subrecordId: id }],
    origin: { feature: 'context_desk', action: result.action },
    sourceActionId: id, generatedAt: result.generatedAt, acceptedAt,
    precursor: result.content.slice(0, 32_000) || null,
    acceptedTextHash: await acceptedTextHash(content),
    contextRefs: records.map(({ type, id }) => ({ type, id })),
  };
  const linkedIds = (type: string) => [...new Set(records.filter(record => record.type === type).map(record => record.id))];
  const practice = newExperiment && experiment && draft ? {
    ...draft, id: target.id, title: experiment.title.trim(), type: 'experiment' as const, status: 'proposed' as const,
    description: '', durationMode: 'repeated' as const, durationDays: 7, startDate: '', endDate: '',
    sourceIds: linkedIds('source'), questionIds: linkedIds('inquiry'), positionIds: linkedIds('position'), conceptTags: [], draftIds: [],
    notes: '', logs: [], logDates: [], dateCreated: finding.date, dateUpdated: finding.date, contextDeskFindings: [finding],
  } : null;
  return { finding, origin, practice };
}
