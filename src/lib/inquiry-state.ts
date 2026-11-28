import type { InquiryEvidence, Media, Practice, Question } from '@/lib/types';

export const MAX_INQUIRY_EVIDENCE = 200;
export const INQUIRY_STARTING_OBSERVATION = 'Starting observation';

export type InquiryLinkType = 'work' | 'practice';

export function inquiryConnectionKey(type: InquiryLinkType, id: string) {
  return `${type}:${id}` as const;
}

export function isManualInquiryLink(inquiry: Question, type: InquiryLinkType, id: string) {
  return inquiry.manualConnectionKeys?.includes(inquiryConnectionKey(type, id)) ?? false;
}

export function isCompleteManualInquiryLink(inquiry: Question, type: InquiryLinkType, item: { id: string; questionIds?: string[] }) {
  const ids = type === 'work' ? inquiry.draftIds : inquiry.practiceIds;
  return Boolean(ids?.includes(item.id) && item.questionIds?.includes(inquiry.id) && isManualInquiryLink(inquiry, type, item.id));
}

export function inquiryStartingObservation(text: string) {
  return {
    claim: text.trim(),
    type: 'personal observation',
    origin: INQUIRY_STARTING_OBSERVATION,
    candidateId: '',
    direction: 'contextualizes',
    strength: 'moderate',
    reliability: 'moderate',
    notes: '',
  } satisfies Omit<InquiryEvidence, 'id' | 'date'>;
}

export function inquiryExperimentSetup(
  { prediction, action, measure, against }: { prediction: string; action: string; measure: string; against?: string },
  observation = '',
) {
  if (![prediction, action, measure].every(value => value.trim())) return null;
  const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (observation.trim() && [prediction, action].some(value => normalized(value) === normalized(observation))) return null;
  return {
    intellectualBasis: observation.trim(),
    hypothesis: prediction.trim(),
    action: action.trim(),
    observationMethod: `After each attempt, record what you did and compare what happened with this signal: ${measure.trim()}${against?.trim() ? `\nWhat would count against the prediction: ${against.trim()}` : ''}`,
    expectedOutcome: prediction.trim(),
  };
}

export function inquiryWeighedCount(question: Pick<Question, 'candidateAnswers' | 'evidenceRecords'>) {
  const candidateIds = new Set((question.candidateAnswers || []).map(answer => answer.id));
  return (question.evidenceRecords || []).filter(item => item.claim.trim() && candidateIds.has(item.candidateId) && (item.direction === 'supports' || item.direction === 'challenges')).length;
}

export function practiceEvidenceDraft(practice: Pick<Practice, 'title'>, observation: string) {
  return {
    claim: observation.trim().slice(0, 1000),
    origin: `Praxis · ${practice.title}`.slice(0, 200),
    candidateId: '',
    direction: 'contextualizes',
    strength: 'moderate',
    type: 'personal observation',
  } satisfies Partial<InquiryEvidence>;
}

export const INQUIRY_REVIEW_CRITERION_TITLE = 'What would change my mind';

export function latestInquiryReviewCriterion(question: Pick<Question, 'investigationNotes'>) {
  return question.investigationNotes?.find(note =>
    note.origin === 'user' && note.title === INQUIRY_REVIEW_CRITERION_TITLE && note.text.trim(),
  )?.text.trim() || '';
}

export function replacedInquiryAnswer(question: Pick<Question, 'answer' | 'resolutionSummary'>, nextAnswer: string) {
  const previous = question.answer?.trim();
  if (!previous || previous === nextAnswer.trim()) return '';
  const summary = question.resolutionSummary?.trim();
  return summary ? `${previous}\n\nWhat led to this answer: ${summary}` : previous;
}

export function indexAnnotationInquiries(inquiries: readonly Question[]) {
  const byAnnotation = new Map<string, Question[]>();
  const byId = new Map(inquiries.map((inquiry) => [inquiry.id, inquiry]));
  for (const inquiry of inquiries) {
    for (const id of new Set([inquiry.sourceAnnotationId, ...(inquiry.evidenceIds || [])])) {
      if (!id) continue;
      const list = byAnnotation.get(id) || [];
      list.push(inquiry);
      byAnnotation.set(id, list);
    }
  }
  return (annotationId: string, sourceId: string, createdInquiryId?: string) => {
    const created = createdInquiryId ? byId.get(createdInquiryId) : undefined;
    const evidence = (byAnnotation.get(annotationId) || []).filter((inquiry) =>
      inquiry.id !== created?.id && (inquiry.sourceAnnotationId === annotationId || inquiry.sourceIds?.includes(sourceId)));
    return created ? [created, ...evidence] : evidence;
  };
}

export function assignInquiryEvidence(question: Question, evidence: InquiryEvidence, candidateId: string): InquiryEvidence {
  if (candidateId && !question.candidateAnswers?.some((candidate) => candidate.id === candidateId)) {
    throw new Error('Choose an existing candidate answer.');
  }
  return { ...evidence, candidateId };
}

export function formatInquiryEvidence(evidence: InquiryEvidence) {
  return `${evidence.claim} (${evidence.type}; strength: ${evidence.strength}; reliability: ${evidence.reliability}${evidence.origin ? `; origin: ${evidence.origin}` : ''}${evidence.notes ? `; notes: ${evidence.notes}` : ''})`;
}

export const CLOSED_INQUIRY_STATUSES = new Set<Question['status']>([
  'answered',
  'resolved',
  'archived',
  'converted',
  'no_longer_meaningful',
]);

export function isInquiryClosed(question: Question) {
  return CLOSED_INQUIRY_STATUSES.has(question.status);
}

export function inquirySourceIds(question: Question) {
  return Array.from(new Set([...(question.sourceIds || []), ...(question.evidenceIds || [])]));
}

export function inquiryAnnotationOrigins(question: Question, media: readonly Media[]) {
  const explicit = new Set([question.sourceAnnotationId, ...(question.annotationOrigins || []).map(origin => origin.annotationId)].filter(Boolean));
  const origins = media.flatMap(source => (source.annotations || []).flatMap(annotation => {
    const transfer = annotation.marks?.find(mark => mark.movedTo === 'inquiry' && mark.movedId === question.id);
    const backlink = Boolean(transfer || annotation.createdInquiryId === question.id);
    if (!backlink && !explicit.has(annotation.id)) return [];
    return [{ source, annotation, excerpt: transfer?.text || annotation.text, backlink }];
  }));
  const linkedSources = new Set(inquirySourceIds(question));
  return origins.filter(origin => {
    if (origin.backlink) return true;
    const matches = origins.filter(candidate => candidate.annotation.id === origin.annotation.id);
    if (matches.some(candidate => candidate.backlink)) return false;
    if (matches.length === 1) return true;
    return linkedSources.has(origin.source.id) && matches.filter(candidate => linkedSources.has(candidate.source.id)).length === 1;
  });
}

export function inquiryPositionEvidence(question: Question, answer: string) {
  const key = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const matching = (question.candidateAnswers || []).filter((candidate) => key(candidate.statement) === key(answer));
  const adoptedIds = new Set(matching.map((candidate) => candidate.id));
  const assignedEvidence = (question.evidenceRecords || []).filter((item) => item.type !== 'unknown' && adoptedIds.has(item.candidateId));
  const unique = (values: (string | undefined)[]) => [...new Set(values.map((value) => value?.trim() || '').filter(Boolean))];
  return {
    evidenceFor: unique([...matching.map((candidate) => candidate.support), ...assignedEvidence.filter((item) => item.direction === 'supports').map(formatInquiryEvidence)]),
    evidenceAgainst: unique([...matching.map((candidate) => candidate.objection), ...assignedEvidence.filter((item) => item.direction === 'challenges').map(formatInquiryEvidence)]),
  };
}

export function isInquiryActive(question: Question) {
  return ['captured', 'clarifying', 'open', 'investigating', 'gathering_evidence', 'comparing_answers', 'reopened', 'under_tension', 'partially_answered', 'provisionally_answered']
    .includes(question.status);
}

export function inquiryCandidateCount(question: Question) {
  const saved = (question.candidateAnswers || []).filter((candidate) => candidate.statement.trim()).length;
  return saved || (question.answer?.trim() ? 1 : 0);
}

export function inquiryNeedsEvidence(question: Question) {
  return !inquiryHasEvidence(question) && !isInquiryClosed(question);
}

function inquiryHasEvidence(question: Question) {
  return inquirySourceIds(question).length > 0
    || (question.evidenceRecords || []).some((item) => item.type !== 'unknown' && item.claim.trim())
    || (question.candidateAnswers || []).some((item) => item.support?.trim() || item.objection?.trim());
}

export function inquiryHasRecordedObjection(question: Question) {
  return (question.candidateAnswers || []).some((item) => item.objection?.trim())
    || (question.evidenceRecords || []).some((item) => item.type !== 'unknown' && item.direction === 'challenges'
      && question.candidateAnswers?.some((candidate) => candidate.id === item.candidateId) && item.claim.trim());
}

export function inquiryNeedsAssumptions(question: Question) {
  return !(question.assumptions || []).some((assumption) => assumption.trim()) && !isInquiryClosed(question);
}

export function inquiryNeedsCandidateAnswers(question: Question) {
  return inquiryCandidateCount(question) === 0 && !isInquiryClosed(question);
}

export function inquiryReadyToResolve(question: Question) {
  return Boolean(question.answer?.trim()) && !question.resolutionSummary?.trim() && !isInquiryClosed(question);
}

export function inquiryFormation(question: Question) {
  const checks = [
    Boolean(question.text?.trim()),
    Boolean(question.whyItMatters?.trim()),
    Boolean(question.currentIntuition?.trim()),
    (question.assumptions || []).some((item) => item.trim()),
    inquiryHasEvidence(question),
    inquiryCandidateCount(question) > 0,
    Boolean(question.answer?.trim()),
    Boolean(question.resolutionSummary?.trim()),
  ];
  const complete = checks.filter(Boolean).length;
  return {
    complete,
    total: checks.length,
    fullyFormed: complete === checks.length,
    completeness: Math.round((complete / checks.length) * 100),
  };
}

export function inquiryFrameGaps(question: Question) {
  const gaps: string[] = [];
  if (!question.whyItMatters?.trim()) gaps.push('stakes');
  if (!question.currentIntuition?.trim() && !question.answer?.trim()) gaps.push('intuition');
  if (inquiryNeedsAssumptions(question)) gaps.push('assumptions');
  if (inquiryNeedsEvidence(question)) gaps.push('evidence');
  if (inquiryNeedsCandidateAnswers(question)) gaps.push('candidate answer');
  if (question.answer?.trim() && !question.resolutionSummary?.trim()) gaps.push('resolution summary');
  return gaps;
}

export function inquiryNextMove(question: Question) {
  if (isInquiryClosed(question)) return 'Review the saved answer or reopen this inquiry when new evidence appears.';
  if (!question.whyItMatters?.trim()) return 'Clarify why this question matters.';
  if (inquiryNeedsEvidence(question)) return 'Add one source, observation, or counterexample.';
  if (inquiryNeedsCandidateAnswers(question)) return 'Draft a possible answer to examine.';
  if (inquiryCandidateCount(question) > 1) return 'Compare the strongest candidate answers.';
  if (inquiryReadyToResolve(question)) return 'Write the resolution summary and choose an outcome.';
  return 'Continue developing the strongest unanswered part.';
}

export function inquiryAiItemMemory(question: Question) {
  return [
    `Inquiry: ${question.text}`,
    `Status: ${question.status.replace(/_/g, ' ')}`,
    question.whyItMatters?.trim() ? `Why it matters: ${question.whyItMatters.trim()}` : '',
    question.currentIntuition?.trim() ? `Current view: ${question.currentIntuition.trim()}` : '',
    question.uncertainty?.trim() ? `Remaining uncertainty: ${question.uncertainty.trim()}` : '',
    (question.assumptions || []).some((item) => item.trim())
      ? `Assumptions: ${(question.assumptions || []).filter((item) => item.trim()).join('; ')}`
      : '',
    ...(question.candidateAnswers || []).filter((item) => item.statement.trim()).slice(0, 5).map((item, index) =>
      `Candidate ${index + 1} (${item.confidence ?? 'unrated'}): ${item.statement.trim()}; support: ${item.support?.trim() || 'none'}; objection: ${item.objection?.trim() || 'none'}; consequence: ${item.consequence?.trim() || 'none'}`
    ),
    question.answer?.trim() ? `Current answer: ${question.answer.trim()}` : '',
    ...(question.evidenceRecords || []).slice(0, 5).map((item) => {
      const candidate = question.candidateAnswers?.find((entry) => entry.id === item.candidateId);
      return `Evidence (${item.direction}; ${candidate ? `candidate: ${candidate.statement.slice(0, 120)}` : 'unassigned'}): ${formatInquiryEvidence(item).slice(0, 520)}`;
    }),
    question.resolutionSummary?.trim() ? `Resolution context: ${question.resolutionSummary.trim()}` : '',
  ].filter(Boolean);
}
