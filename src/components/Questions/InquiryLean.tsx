import type { Question } from '@/lib/types';

const EVIDENCE_TO_LEAN = 4;

/** Which possible answer the evidence leans toward, if any. */
export function inquiryLean(question: Question) {
  const candidates = question.candidateAnswers || [];
  const evidence = question.evidenceRecords || [];
  const scores = candidates.map((candidate) => ({
    candidate,
    score: evidence.filter((item) => item.candidateId === candidate.id).reduce((sum, item) => sum + (item.direction === 'supports' ? 1 : item.direction === 'challenges' ? -1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const leading = scores[0];
  const lean = leading && leading.score > 0 && leading.score - (scores[1]?.score ?? 0) >= 2 ? leading.candidate : null;
  return { candidates: candidates.length, evidence: evidence.length || (question.evidenceIds || []).length, lean };
}

function daysOpen(question: Question) {
  const started = Date.parse(question.dateCreated || '');
  return Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 86400000)) : null;
}

/** A progress ring toward a lean, with answers, evidence, and age. */
export function InquiryLean({ question }: { question: Question }) {
  const { candidates, evidence, lean } = inquiryLean(question);
  const progress = Math.min(1, evidence / EVIDENCE_TO_LEAN);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const open = daysOpen(question);
  return (
    <div className="flex items-center gap-3" data-stage-tone="examine">
      <svg viewBox="0 0 40 40" width="42" height="42" role="img" aria-label={`${evidence} of ${EVIDENCE_TO_LEAN} pieces of evidence toward a lean`}>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
        <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--stage))" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${circumference * progress} ${circumference}`} transform="rotate(-90 20 20)" />
        <text x="20" y="24" textAnchor="middle" className="fill-foreground font-headline text-[11px] italic">{Math.min(evidence, EVIDENCE_TO_LEAN)}/{EVIDENCE_TO_LEAN}</text>
      </svg>
      <div className="min-w-0 text-sm">
        <div>{candidates} possible answer{candidates === 1 ? '' : 's'} · {evidence} evidence{open !== null ? <span className="text-muted-foreground"> · open {open} days</span> : null}</div>
        <div className="truncate text-muted-foreground">{lean ? <>Leaning toward <em className="text-foreground">“{lean.statement}”</em></> : candidates === 0 ? 'Draft a possible answer to examine' : candidates === 1 ? 'Add a second possible answer to compare' : 'No clear lean yet'}</div>
      </div>
    </div>
  );
}
