"use client";

import type { InquiryEvidence } from '@/lib/types';

export const EVIDENCE_WEIGHT: Record<InquiryEvidence['strength'], number> = { weak: 1, moderate: 2, strong: 3 };
export const letter = (index: number) => String.fromCharCode(65 + index);

/** Net weight on an answer: support presses down, challenges lift, context weighs nothing. */
export function answerWeight(evidence: InquiryEvidence[], candidateId: string) {
  return evidence.filter((item) => item.candidateId === candidateId)
    .reduce((sum, item) => sum + (item.direction === 'challenges' ? -1 : item.direction === 'contextualizes' ? 0 : 1) * EVIDENCE_WEIGHT[item.strength], 0);
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const SUP = 'hsl(var(--kind-practice))';
const CTX = 'hsl(var(--muted-foreground))';
const CHAL = 'hsl(var(--kind-position))';
const ARM = 'hsl(var(--kind-inquiry))';

function PanContents({ x, panY, evidence, candidateId, perRow = 4 }: { x: number; panY: number; evidence: InquiryEvidence[]; candidateId: string; perRow?: number }) {
  const weights = evidence.filter((item) => item.candidateId === candidateId && item.direction !== 'challenges');
  const balloons = evidence.filter((item) => item.candidateId === candidateId && item.direction === 'challenges');
  return (
    <>
      {weights.map((item, index) => (
        <circle key={item.id} cx={x - 24 + (index % perRow) * 16} cy={panY + 8 - Math.floor(index / perRow) * 9} r={3 + EVIDENCE_WEIGHT[item.strength] * 1.5} fill={item.direction === 'contextualizes' ? CTX : SUP} opacity={item.direction === 'contextualizes' ? 0.55 : 1} />
      ))}
      {balloons.map((item, index) => (
        <g key={item.id}>
          <path d={`M${x - 14 + index * 14} ${panY} Q${x - 8 + index * 18} ${panY - 18} ${x - 18 + index * 22} ${panY - 30}`} stroke={CHAL} fill="none" />
          <ellipse cx={x - 18 + index * 22} cy={panY - 38 - index * 4} rx={5 + EVIDENCE_WEIGHT[item.strength] * 1.4} ry={7 + EVIDENCE_WEIGHT[item.strength] * 1.8} fill={CHAL} />
        </g>
      ))}
    </>
  );
}

/**
 * The evidence scale, in three tiers as approved in the prototype:
 *   2 answers  → a balance beam that tips toward the heavier side
 *   3–4        → one hanging spring scale per answer, side by side
 *   5 or more  → a meter per answer
 * Below two answers, an empty beam with what to do.
 */
export function InquiryScale({ answers, evidence }: { answers: Array<{ id: string; statement: string }>; evidence: InquiryEvidence[] }) {
  const n = answers.length;
  const weights = answers.map((answer) => answerWeight(evidence, answer.id));
  if (n < 2) {
    return (
      <div className="noesis-section-empty" style={{ textAlign: 'center' }}>
        <svg viewBox="0 0 300 90" width="100%" aria-hidden="true" style={{ opacity: .5, maxWidth: 320, margin: '0 auto' }}>
          <path d="M140 86 L150 30 L160 86Z" fill="hsl(var(--muted))" />
          <line x1="40" y1="30" x2="260" y2="30" stroke="hsl(var(--border))" strokeWidth="4" strokeDasharray="6 6" strokeLinecap="round" />
        </svg>
        <span>Add {n ? 'a second' : 'two'} possible answer{n ? '' : 's'} and the scale will tip toward the better supported one.</span>
      </div>
    );
  }
  let drawing: React.ReactNode;
  if (n === 2) {
    const d = clamp(weights[0] - weights[1], -6, 6);
    const ang = (d * 4 * Math.PI) / 180; const L = 130;
    const yL = 70 + L * Math.sin(ang); const yR = 70 - L * Math.sin(ang); const xL = 200 - L * Math.cos(ang); const xR = 200 + L * Math.cos(ang);
    const pan = (x: number, y: number, index: number) => (
      <g key={index}>
        <line x1={x} y1={y} x2={x - 34} y2={y + 50} stroke={ARM} />
        <line x1={x} y1={y} x2={x + 34} y2={y + 50} stroke={ARM} />
        <path d={`M${x - 42} ${y + 50} Q${x} ${y + 76} ${x + 42} ${y + 50}Z`} fill="hsl(var(--kind-inquiry) / .15)" stroke={ARM} />
        <PanContents x={x} panY={y + 50} evidence={evidence} candidateId={answers[index].id} />
        <text x={x} y={y + 100} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="13">{letter(index)}  net {weights[index] > 0 ? '+' : ''}{weights[index]}</text>
      </g>
    );
    drawing = (
      <svg viewBox="0 -10 400 220" width="100%" role="img" aria-label={`Evidence scale: A net ${weights[0]}, B net ${weights[1]}`}>
        <path d="M178 205 L200 76 L222 205Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
        <line x1={xL} y1={yL} x2={xR} y2={yR} stroke={ARM} strokeWidth="5" strokeLinecap="round" />
        <circle cx="200" cy="70" r="7" fill={ARM} />
        {pan(xL, yL, 0)}{pan(xR, yR, 1)}
      </svg>
    );
  } else if (n <= 4) {
    drawing = (
      <div className="noesis-springs" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} role="group" aria-label="One hanging scale per answer">
        {answers.map((answer, index) => {
          const x = 75; const panY = 100 + clamp(weights[index], -5, 5) * 14; const top = 34; const bot = panY - 14; const seg = 8;
          let zig = `M${x} 18 L${x} ${top}`;
          for (let k = 0; k < seg; k++) { const y = top + ((bot - top) * (k + 1)) / seg; zig += ` L${x + (k % 2 ? -9 : 9)} ${y - (bot - top) / seg / 2}`; }
          zig += ` L${x} ${bot}`;
          return (
            <div key={answer.id} className="noesis-spring">
              <svg viewBox="0 0 150 215" width="100%" role="img" aria-label={`Answer ${letter(index)}: net ${weights[index]}`}>
                <line x1="20" y1="18" x2="130" y2="18" stroke={ARM} strokeWidth="5" strokeLinecap="round" />
                <path d={zig} fill="none" stroke={ARM} strokeWidth="1.6" />
                <line x1={x} y1={bot} x2={x - 32} y2={panY} stroke={ARM} />
                <line x1={x} y1={bot} x2={x + 32} y2={panY} stroke={ARM} />
                <path d={`M${x - 40} ${panY} Q${x} ${panY + 28} ${x + 40} ${panY}Z`} fill="hsl(var(--kind-inquiry) / .15)" stroke={ARM} />
                <PanContents x={x} panY={panY} evidence={evidence} candidateId={answer.id} />
              </svg>
              <div className="noesis-spring__cap">
                <span className="noesis-letter">{letter(index)}</span>
                <span className="noesis-spring__name">{answer.statement}</span>
                <span className="noesis-eyebrow noesis-eyebrow--sm">net {weights[index] > 0 ? '+' : ''}{weights[index]}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    const max = Math.max(1, ...weights.map(Math.abs));
    drawing = (
      <div className="noesis-meter" role="group" aria-label="Answers as a meter">
        <span className="noesis-eyebrow noesis-eyebrow--sm">Five or more answers: shown as a meter</span>
        {answers.map((answer, index) => (
          <div key={answer.id} className="noesis-row">
            <span className="noesis-letter">{letter(index)}</span>
            <span className="noesis-row__text">{answer.statement}</span>
            <span className="noesis-meter__bar" aria-hidden="true"><i style={{ width: `${Math.max(4, 50 + (weights[index] / max) * 50)}%` }} /></span>
            <span className="noesis-eyebrow noesis-eyebrow--sm">{weights[index] > 0 ? '+' : ''}{weights[index]}</span>
          </div>
        ))}
      </div>
    );
  }
  const lead = weights.indexOf(Math.max(...weights));
  const margin = Math.max(...weights) - Math.max(...weights.filter((_, index) => index !== lead));
  return (
    <div className="grid gap-1">
      {drawing}
      <p className="noesis-lean">{margin >= 2 ? <>Leaning toward <b>{letter(lead)}</b> by {margin}.</> : 'No clear lean yet.'}</p>
      <div className="noesis-legend">
        <span><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4.5" fill={SUP} /></svg>supports weighs down</span>
        <span style={{ color: CHAL }}><svg width="10" height="12" aria-hidden="true"><ellipse cx="5" cy="6" rx="4" ry="5.5" fill={CHAL} /></svg>challenges lift</span>
        <span><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4.5" fill={CTX} opacity=".55" /></svg>context: no weight</span>
      </div>
    </div>
  );
}

/** Which answer leads, and by how much; null below two answers. */
export function inquiryLead(answers: Array<{ id: string; statement: string }>, evidence: InquiryEvidence[]) {
  if (answers.length < 2) return null;
  const weights = answers.map((answer) => answerWeight(evidence, answer.id));
  const index = weights.indexOf(Math.max(...weights));
  const margin = weights[index] - Math.max(...weights.filter((_, i) => i !== index));
  return { index, answer: answers[index], margin, weights };
}
