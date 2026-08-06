import type { Question } from '@/lib/types';

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

export function inquiryCandidateCount(question: Question) {
  const saved = (question.candidateAnswers || []).filter((candidate) => candidate.statement.trim()).length;
  return saved || (question.answer?.trim() ? 1 : 0);
}

export function inquiryNeedsEvidence(question: Question) {
  return [...(question.sourceIds || []), ...(question.evidenceIds || [])].length === 0 && !isInquiryClosed(question);
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
  const candidates = question.candidateAnswers || [];
  const checks = [
    Boolean(question.text?.trim()),
    Boolean(question.whyItMatters?.trim()),
    Boolean(question.currentIntuition?.trim()),
    (question.assumptions || []).some((item) => item.trim()),
    [...(question.sourceIds || []), ...(question.evidenceIds || [])].length > 0
      || candidates.some((candidate) => Boolean(candidate.support?.trim() || candidate.objection?.trim())),
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
