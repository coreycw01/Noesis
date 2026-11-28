import type { Question } from '@/lib/types';
import { inquiryNextMove, inquirySourceIds, inquiryWeighedCount } from '@/lib/inquiry-state';

function daysOpen(question: Question) {
  const started = Date.parse(question.dateCreated || '');
  return Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 86400000)) : null;
}

/** How much weighed evidence an inquiry wants before it can lean either way. */
const WEIGHED_TO_LEAN = 4;

/**
 * The ring is the card's instrument, the way a position's card carries its
 * confidence. It went missing in the workspace refactor, which left Inquiries
 * the one collection whose cards say nothing at a glance.
 *
 * It draws two arcs, because attached and weighed are not the same thing. The
 * solid one is evidence actually weighed for or against an answer — the only
 * kind that moves an inquiry. The faint one behind it is material linked but
 * never weighed, so a question with four sources and no judgment reads as work
 * waiting rather than as nothing at all. The track is the full four, so a 1
 * and a 3 are told apart by eye.
 */
export function InquiryLean({ question, sources }: { question: Question; sources: number }) {
  const candidates = question.candidateAnswers?.length || 0;
  const weighed = inquiryWeighedCount(question);
  const open = daysOpen(question);
  const attached = inquirySourceIds(question).length;
  const progress = Math.min(1, weighed / WEIGHED_TO_LEAN);
  const waiting = Math.min(1, Math.max(weighed, attached) / WEIGHED_TO_LEAN);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-3" data-stage-tone="examine">
      <svg viewBox="0 0 40 40" width="42" height="42" className="shrink-0" role="img"
        aria-label={`${weighed} of ${WEIGHED_TO_LEAN} weighed toward a lean${attached > weighed ? `, ${attached} attached and not yet weighed` : ''}`}>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--stage) / .18)" strokeWidth="3.5" />
        {waiting > progress && (
          <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--stage) / .45)" strokeWidth="3.5"
            strokeLinecap="round" strokeDasharray={`${circumference * waiting} ${circumference}`}
            transform="rotate(-90 20 20)" />
        )}
        {progress > 0 && (
          <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--stage))" strokeWidth="3.5"
            strokeLinecap="round" strokeDasharray={`${circumference * progress} ${circumference}`}
            transform="rotate(-90 20 20)" />
        )}
        <text x="20" y="24" textAnchor="middle" className="fill-foreground font-headline text-xs italic">
          {Math.min(weighed, WEIGHED_TO_LEAN)}/{WEIGHED_TO_LEAN}
        </text>
      </svg>
      <div className="min-w-0 text-sm">
        <div>{candidates} possible answer{candidates === 1 ? '' : 's'} · {sources} linked source{sources === 1 ? '' : 's'} · {weighed} weighed item{weighed === 1 ? '' : 's'}{open !== null && question.status === 'open' ? <span className="text-muted-foreground"> · open {open} days</span> : null}</div>
        <div className="text-muted-foreground">{inquiryNextMove(question)}</div>
      </div>
    </div>
  );
}
