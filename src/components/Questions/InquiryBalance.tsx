"use client";

import { useState } from 'react';
import type { InquiryEvidence, Question } from '@/lib/types';
import { cn } from '@/lib/utils';

const WEIGHT: Record<InquiryEvidence['strength'], number> = { weak: 1, moderate: 2, strong: 3 };
const letter = (index: number) => String.fromCharCode(65 + index);

/** Net weight on an answer: support presses down, challenges lift, context weighs nothing. */
export function answerWeight(evidence: InquiryEvidence[], candidateId: string) {
  return evidence.filter((item) => item.candidateId === candidateId)
    .reduce((sum, item) => sum + (item.direction === 'challenges' ? -1 : item.direction === 'contextualizes' ? 0 : 1) * WEIGHT[item.strength], 0);
}

function Pan({ x, y, label, statement, weight, evidence, candidateId, maxLabel = 26 }: { x: number; y: number; label: string; statement: string; weight: number; evidence: InquiryEvidence[]; candidateId: string; maxLabel?: number }) {
  const weights = evidence.filter((item) => item.candidateId === candidateId && item.direction !== 'challenges');
  const balloons = evidence.filter((item) => item.candidateId === candidateId && item.direction === 'challenges');
  return (
    <g>
      <line x1={x} y1={y} x2={x - 42} y2={y + 64} stroke="hsl(var(--stage-encounter))" strokeWidth="1" />
      <line x1={x} y1={y} x2={x + 42} y2={y + 64} stroke="hsl(var(--stage-encounter))" strokeWidth="1" />
      <path d={`M${x - 52} ${y + 64} Q${x} ${y + 94} ${x + 52} ${y + 64}Z`} fill="hsl(var(--stage-encounter) / .22)" stroke="hsl(var(--stage-encounter))" strokeWidth="1.5" />
      {weights.map((item, index) => (
        <circle key={item.id} cx={x - 28 + index * 18} cy={y + 74} r={4 + WEIGHT[item.strength] * 2} fill={item.direction === 'contextualizes' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--stage-examine))'} opacity={item.direction === 'contextualizes' ? 0.5 : 1} />
      ))}
      {balloons.map((item, index) => {
        const bx = x - 30 + index * 30; const r = 7 + WEIGHT[item.strength] * 3; const by = y - 30 - r - index * 6;
        return (
          <g key={item.id}>
            <path d={`M${x - 20 + index * 20} ${y + 64} Q${bx + 6} ${(y + 64 + by) / 2} ${bx} ${by + r}`} stroke="hsl(var(--stage-claim))" strokeWidth="1" fill="none" />
            <ellipse cx={bx} cy={by} rx={r * 0.85} ry={r} fill="hsl(var(--stage-claim))" opacity=".85" />
          </g>
        );
      })}
      <text x={x} y={y + 118} textAnchor="middle" fontSize="14" fill="hsl(var(--foreground))">{label}: {statement.length > maxLabel ? `${statement.slice(0, maxLabel)}…` : statement}</text>
      <text x={x} y={y + 136} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono, monospace">NET {weight > 0 ? '+' : ''}{weight}</text>
    </g>
  );
}

/**
 * The evidence balance, from the prototype. With two possible answers it is a
 * beam that tips toward the heavier side; with more, each answer hangs on its
 * own spring. Every piece of evidence can be placed on an answer from the list.
 */
/** The prototype's "Possible answers" list: each answer with its net weight, and a way to add one in place. */
function PossibleAnswers({ question, onAddAnswer, disabled, inputId }: { question: Question; onAddAnswer?: (statement: string) => unknown; disabled?: boolean; inputId?: string }) {
  const [draft, setDraft] = useState('');
  const candidates = question.candidateAnswers || [];
  const evidence = question.evidenceRecords || [];
  return (
    <section className="noesis-answers" aria-label="Possible answers">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="noesis-instrument__label">Possible answers · {candidates.length}</div>
        <span className="text-xs text-muted-foreground">Answers worth comparing, not a final conclusion.</span>
      </div>
      <ol className="grid gap-1.5">
        {candidates.map((candidate, index) => {
          const net = answerWeight(evidence, candidate.id);
          return (
            <li key={candidate.id} className="noesis-answers__row">
              <span className="noesis-answers__letter">{letter(index)}</span>
              <span className="min-w-0 flex-1">{candidate.statement}</span>
              <span className="font-code text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Net {net > 0 ? '+' : ''}{net}</span>
            </li>
          );
        })}
      </ol>
      {onAddAnswer && (
        <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); if (!draft.trim()) return; await onAddAnswer(draft.trim()); setDraft(''); }}>
          <input id={inputId} value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} placeholder={candidates.length < 2 ? `Add ${candidates.length ? 'a second' : 'a'} possible answer to start the balance` : 'Add another possible answer'} aria-label="Add a possible answer" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
          <button type="submit" disabled={disabled || !draft.trim()} className="rounded-full border border-[hsl(var(--stage-examine))] px-4 text-sm text-[hsl(var(--stage-examine))] disabled:opacity-50">Add</button>
        </form>
      )}
    </section>
  );
}

export function InquiryBalance({ question, onAssign, onAddAnswer, disabled, addAnswerId, workingAnswer, onEditAnswer }: {
  question: Question;
  onAssign: (evidenceId: string, candidateId: string) => void;
  onAddAnswer?: (statement: string) => unknown;
  disabled?: boolean;
  /** Id for the add-answer field, so a Tools button can focus it. */
  addAnswerId?: string;
  /** The provisional answer, kept beside the scale so the two can be compared. */
  workingAnswer?: string;
  onEditAnswer?: () => void;
}) {
  const answerCard = (
    <div className="noesis-working-answer">
      <div className="noesis-instrument__label">Working answer</div>
      {workingAnswer?.trim()
        ? <p className="font-headline text-[1.05rem] italic leading-snug">{workingAnswer}</p>
        : <p className="text-sm text-muted-foreground">No working answer yet.</p>}
      {onEditAnswer && <button type="button" onClick={onEditAnswer} className="noesis-working-answer__edit">{workingAnswer?.trim() ? 'Edit' : 'Write one'}</button>}
    </div>
  );
  const candidates = question.candidateAnswers || [];
  const evidence = question.evidenceRecords || [];
  if (candidates.length < 2) {
    return (
      <div className="noesis-scale-bench">
        <div className="grid content-start gap-3">
          <PossibleAnswers question={question} onAddAnswer={onAddAnswer} disabled={disabled} inputId={addAnswerId} />
        </div>
        <div className="grid content-start gap-3">
          <div className="noesis-balance noesis-balance--empty" role="img" aria-label="Empty scale: needs two possible answers">
            <div className="noesis-instrument__label">Evidence scale</div>
            <svg viewBox="0 0 300 120" className="h-auto w-full max-w-[320px] opacity-60" aria-hidden="true">
              <path d="M140 112 L150 40 L160 112Z" fill="hsl(var(--muted))" />
              <line x1="40" y1="40" x2="260" y2="40" stroke="hsl(var(--border))" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 6" />
              <circle cx="150" cy="40" r="6" fill="hsl(var(--border))" />
            </svg>
            <p className="text-sm text-muted-foreground">With two possible answers, the scale tips toward whichever the evidence supports. {evidence.length} piece{evidence.length === 1 ? '' : 's'} of evidence recorded so far.</p>
          </div>
          {answerCard}
        </div>
      </div>
    );
  }
  const weights = candidates.map((candidate) => answerWeight(evidence, candidate.id));
  let scale: React.ReactNode;
  if (candidates.length === 2) {
    const diff = Math.max(-6, Math.min(6, weights[0] - weights[1]));
    const angle = (diff * 4 * Math.PI) / 180; const L = 150;
    const yL = 110 + L * Math.sin(angle); const yR = 110 - L * Math.sin(angle); const xL = 230 - L * Math.cos(angle); const xR = 230 + L * Math.cos(angle);
    scale = (
      <svg viewBox="-80 10 620 290" className="h-auto w-full" role="img" aria-label={`Evidence balance: A net ${weights[0]}, B net ${weights[1]}`}>
        <path d="M205 290 L230 125 L255 290Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
        <line x1={xL} y1={yL} x2={xR} y2={yR} stroke="hsl(var(--stage-encounter))" strokeWidth="5" strokeLinecap="round" />
        <circle cx="230" cy="110" r="8" fill="hsl(var(--stage-encounter))" />
        <Pan x={xL} y={yL} label="A" statement={candidates[0].statement} weight={weights[0]} evidence={evidence} candidateId={candidates[0].id} />
        <Pan x={xR} y={yR} label="B" statement={candidates[1].statement} weight={weights[1]} evidence={evidence} candidateId={candidates[1].id} />
      </svg>
    );
  } else {
    const gap = Math.min(170, 520 / candidates.length); const width = gap * candidates.length + 40;
    scale = (
      <svg viewBox={`0 -40 ${width} 340`} className="h-auto w-full" role="img" aria-label="Evidence scales, one per answer">
        <line x1="10" y1="40" x2={width - 10} y2="40" stroke="hsl(var(--stage-encounter))" strokeWidth="4" strokeLinecap="round" />
        {candidates.map((candidate, index) => {
          const x = 30 + gap * index + gap / 2 - 10; const y = 90 + Math.max(-50, Math.min(60, weights[index] * 9));
          return (
            <g key={candidate.id}>
              <path d={`M${x} 40 C ${x + 8} ${(40 + y) / 2}, ${x - 8} ${(40 + y) / 2}, ${x} ${y}`} stroke="hsl(var(--stage-encounter))" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
              <Pan x={x} y={y} label={letter(index)} statement={candidate.statement} weight={weights[index]} evidence={evidence} candidateId={candidate.id} maxLabel={Math.max(6, Math.floor(gap / 11))} />
            </g>
          );
        })}
      </svg>
    );
  }
  const leader = weights.indexOf(Math.max(...weights));
  const lead = weights[leader] - Math.max(...weights.filter((_, index) => index !== leader));
  return (
    <div className="noesis-scale-bench">
      <div className="grid content-start gap-3">
        <PossibleAnswers question={question} onAddAnswer={onAddAnswer} disabled={disabled} inputId={addAnswerId} />
        <section className="noesis-answers" aria-label="Evidence to place">
          <div className="noesis-instrument__label">Evidence · place each on an answer</div>
          <ul className="grid content-start gap-2">
          {evidence.map((item) => (
            <li key={item.id} className={cn('noesis-balance__row', item.direction === 'challenges' && 'noesis-balance__row--challenge')}>
              <div className="min-w-0">
                <p className="text-[.95rem] leading-snug">{item.claim}</p>
                <p className="font-code text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{item.direction} · {item.strength} · {item.reliability} reliability · {item.type}</p>
              </div>
              <div className="flex shrink-0 gap-1" role="group" aria-label={`Place “${item.claim}” on an answer`}>
                {candidates.map((candidate, index) => (
                  <button key={candidate.id} type="button" disabled={disabled} aria-pressed={item.candidateId === candidate.id} title={candidate.statement} onClick={() => onAssign(item.id, item.candidateId === candidate.id ? '' : candidate.id)} className="noesis-balance__pick">{letter(index)}</button>
                ))}
              </div>
            </li>
          ))}
          {!evidence.length && <li className="text-sm text-muted-foreground">No evidence yet. Add some below, then place it on an answer.</li>}
        </ul>
        </section>
      </div>
      <section className="noesis-balance grid content-start gap-2" aria-label="Evidence scale">
        <div className="noesis-instrument__label">Evidence scale</div>
        <div className={cn(candidates.length > 2 && 'max-sm:hidden')}>{scale}</div>
        {candidates.length > 2 && (
          <ol className="grid gap-1.5 sm:hidden" aria-label="Answers ranked by net weight">
            {candidates.map((candidate, index) => ({ candidate, index, weight: weights[index] })).sort((x, y) => y.weight - x.weight).map(({ candidate, index, weight }) => (
              <li key={candidate.id} className="noesis-rank-row">
                <span className="noesis-answers__letter">{letter(index)}</span>
                <span className="min-w-0 flex-1 truncate">{candidate.statement}</span>
                <span className="noesis-rank-row__bar" style={{ width: `${Math.max(6, Math.min(100, 50 + weight * 8))}%` }} aria-hidden="true" />
                <span className="font-code text-[10px]">{weight > 0 ? '+' : ''}{weight}</span>
              </li>
            ))}
          </ol>
        )}
          {scale}
          <p className="text-sm text-muted-foreground">{lead >= 2 ? <>Leaning toward <span className="text-foreground">{letter(leader)}</span> by {lead}.</> : 'No clear lean yet.'}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="hsl(var(--stage-examine))" /></svg>supports: weighs down</span>
            <span className="inline-flex items-center gap-1.5"><svg width="12" height="14" aria-hidden="true"><ellipse cx="6" cy="7" rx="4.5" ry="5.5" fill="hsl(var(--stage-claim))" /></svg>challenges: lifts</span>
            <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="hsl(var(--muted-foreground))" opacity=".5" /></svg>context: no weight</span>
          </div>
        {answerCard}
      </section>
    </div>
  );
}
