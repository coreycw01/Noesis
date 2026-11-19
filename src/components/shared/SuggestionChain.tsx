"use client";

import { useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { PraxisMethodShape } from '@/components/Practices/PraxisMethodShape';

export type ChainKind = 'inquiry' | 'position' | 'practice';

export interface ChainSuggestion {
  kind: ChainKind;
  /** The record this would become, prefilled from the one you are on. */
  title: string;
  /** One line on why it is the natural next step. */
  why: string;
  /** Creates (or opens) the record. Resolve to finish; reject to stay put. */
  act: () => void | Promise<unknown>;
  /** Label for the button; defaults by kind. */
  actionLabel?: string;
}

const KIND: Record<ChainKind, { label: string; tone: string; verb: string }> = {
  inquiry: { label: 'Inquiry', tone: 'examine', verb: 'Open as inquiry' },
  position: { label: 'Position', tone: 'claim', verb: 'Form the position' },
  practice: { label: 'Praxis', tone: 'act', verb: 'Test it in practice' },
};

function Glyph({ kind }: { kind: ChainKind }) {
  if (kind === 'practice') return <PraxisMethodShape shape="triangle" size={18} />;
  if (kind === 'position') return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 16V2.5l9 3.5-9 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M6 6.5a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1-1.2 1.8v.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="9" cy="14.5" r="1.1" fill="currentColor" /></svg>;
}

/**
 * Where this could go next: the loop made concrete. Each card is a prefilled
 * next record (an inquiry, a position, a practice) drawn from the one you are
 * looking at. Nothing is created until you choose it.
 */
export function SuggestionChain({ suggestions, title = 'Where this could go next' }: { suggestions: ChainSuggestion[]; title?: string }) {
  const [state, setState] = useState<Record<number, 'busy' | 'done'>>({});
  if (!suggestions.length) return null;
  return (
    <section className="noesis-chain" aria-label={title}>
      <div className="noesis-chain__head">{title}</div>
      <ol className="noesis-chain__row">
        {suggestions.map((item, index) => (
          <li key={`${item.kind}-${index}`} data-stage-tone={KIND[item.kind].tone} className="noesis-chain__card">
            <span className="noesis-chain__kind"><Glyph kind={item.kind} />{KIND[item.kind].label}</span>
            <span className="noesis-chain__title">{item.title}</span>
            <span className="noesis-chain__why">{item.why}</span>
            <button
              type="button"
              className="noesis-chain__go"
              disabled={state[index] === 'busy' || state[index] === 'done'}
              onClick={async () => {
                setState((current) => ({ ...current, [index]: 'busy' }));
                try { await item.act(); setState((current) => ({ ...current, [index]: 'done' })); }
                catch { setState((current) => { const next = { ...current }; delete next[index]; return next; }); }
              }}
            >
              {state[index] === 'busy' ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : state[index] === 'done' ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {state[index] === 'done' ? 'Done' : item.actionLabel || KIND[item.kind].verb}
              {!state[index] && <ArrowRight className="size-3.5" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A short title for a suggestion, from free text. */
export function chainTitle(text: string, max = 90) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : clean;
}
