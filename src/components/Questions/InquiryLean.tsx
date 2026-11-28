import type { Question } from '@/lib/types';
import { inquiryNextMove, inquiryWeighedCount } from '@/lib/inquiry-state';

function daysOpen(question: Question) {
  const started = Date.parse(question.dateCreated || '');
  return Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 86400000)) : null;
}

export function InquiryLean({ question, sources }: { question: Question; sources: number }) {
  const candidates = question.candidateAnswers?.length || 0;
  const weighed = inquiryWeighedCount(question);
  const open = daysOpen(question);
  return (
    <div className="flex items-center gap-3" data-stage-tone="examine">
      <div className="min-w-0 text-sm">
        <div>{candidates} possible answer{candidates === 1 ? '' : 's'} · {sources} linked source{sources === 1 ? '' : 's'} · {weighed} weighed item{weighed === 1 ? '' : 's'}{open !== null && question.status === 'open' ? <span className="text-muted-foreground"> · open {open} days</span> : null}</div>
        <div className="text-muted-foreground">{inquiryNextMove(question)}</div>
      </div>
    </div>
  );
}
