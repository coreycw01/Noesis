"use client";

import { useState } from 'react';
import type { Concept } from '@/lib/types';
import { cn } from '@/lib/utils';

export type BoundaryZone = 'fits' | 'edge' | 'outside';

const ZONES: Array<{ id: BoundaryZone; label: string; hint: string; field: 'examples' | 'edgeCases' | 'counterexamples' }> = [
  { id: 'fits', label: 'Fits', hint: 'Clearly inside the concept', field: 'examples' },
  { id: 'edge', label: 'Edge case', hint: 'Could go either way', field: 'edgeCases' },
  { id: 'outside', label: "Doesn't fit", hint: 'Clearly outside it', field: 'counterexamples' },
];

const clean = (values?: string[]) => Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean)));

/**
 * The boundary caliper: sort cases into Fits / Edge case / Doesn't fit by
 * dragging them or choosing a zone. Moving a case across the edge of "Fits"
 * is checking the definition, so it asks why, once, and lets you skip. The
 * definition itself never changes here.
 */
export function ConceptBoundaryBench({ concept, onSave, disabled }: {
  concept: Concept;
  onSave: (next: Concept) => unknown;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [draftZone, setDraftZone] = useState<BoundaryZone>('edge');
  const [moved, setMoved] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ text: string; from: BoundaryZone; to: BoundaryZone } | null>(null);
  const [reason, setReason] = useState('');
  const [over, setOver] = useState<BoundaryZone | null>(null);

  const lists: Record<BoundaryZone, string[]> = {
    fits: clean(concept.examples),
    edge: clean(concept.edgeCases),
    outside: clean(concept.counterexamples),
  };
  const zoneOf = (text: string) => (Object.keys(lists) as BoundaryZone[]).find((zone) => lists[zone].includes(text));

  const write = (next: Record<BoundaryZone, string[]>, reasons = concept.caseReasons) => onSave({
    ...concept,
    examples: next.fits,
    edgeCases: next.edge,
    counterexamples: next.outside,
    caseReasons: reasons,
    philosophyStatus: concept.philosophyStatus === 'undefined' && (next.fits.length || next.outside.length) ? 'emerging' : concept.philosophyStatus,
    dateUpdated: new Date().toISOString(),
  });

  const move = (text: string, to: BoundaryZone) => {
    const from = zoneOf(text);
    if (!from || from === to) return;
    const next = { ...lists, [from]: lists[from].filter((item) => item !== text), [to]: [...lists[to], text] } as Record<BoundaryZone, string[]>;
    void write(next);
    setMoved(text);
    window.setTimeout(() => setMoved((current) => (current === text ? null : current)), 700);
    // Crossing the edge of "Fits" is where the definition gets tested: ask why.
    if (from === 'fits' || to === 'fits') { setAsking({ text, from, to }); setReason(concept.caseReasons?.[text] || ''); }
  };

  const remove = (text: string) => {
    const from = zoneOf(text);
    if (!from) return;
    const reasons = { ...(concept.caseReasons || {}) };
    delete reasons[text];
    void write({ ...lists, [from]: lists[from].filter((item) => item !== text) }, reasons);
  };

  const add = () => {
    const text = draft.trim();
    if (!text || zoneOf(text)) { setDraft(''); return; }
    void write({ ...lists, [draftZone]: [...lists[draftZone], text] });
    setDraft('');
    setMoved(text);
  };

  const saveReason = () => {
    if (!asking) return;
    const reasons = { ...(concept.caseReasons || {}) };
    if (reason.trim()) reasons[asking.text] = reason.trim(); else delete reasons[asking.text];
    void write(lists, reasons);
    setAsking(null);
    setReason('');
  };

  const zoneLabel = (zone: BoundaryZone) => ZONES.find((item) => item.id === zone)?.label || zone;

  return (
    <section className="noesis-caliper-bench" aria-label={`Boundary of ${concept.name}`}>
      <div className="noesis-caliper-bench__zones">
        {ZONES.map((zone) => (
          <div
            key={zone.id}
            className={cn('noesis-caliper-zone', `noesis-caliper-zone--${zone.id}`, over === zone.id && 'is-over')}
            onDragOver={(event) => { if (event.dataTransfer.types.includes('text/x-noesis-case')) { event.preventDefault(); setOver(zone.id); } }}
            onDragLeave={() => setOver((current) => (current === zone.id ? null : current))}
            onDrop={(event) => { event.preventDefault(); setOver(null); const text = event.dataTransfer.getData('text/x-noesis-case'); if (text) move(text, zone.id); }}
          >
            <div className="noesis-caliper-zone__head">
              <span className="noesis-caliper-zone__label">{zone.label}</span>
              <span className="noesis-caliper-zone__hint">{zone.hint}</span>
            </div>
            <ul className="grid gap-1.5" aria-label={`${zone.label}: ${lists[zone.id].length} case${lists[zone.id].length === 1 ? '' : 's'}`}>
              {lists[zone.id].map((text) => (
                <li key={text} className={cn('noesis-case', moved === text && 'is-moved')} draggable={!disabled} onDragStart={(event) => { event.dataTransfer.setData('text/x-noesis-case', text); event.dataTransfer.effectAllowed = 'move'; }}>
                  <span className="min-w-0 flex-1">{text}{concept.caseReasons?.[text] && <span className="noesis-case__reason">{concept.caseReasons[text]}</span>}</span>
                  <select
                    aria-label={`Move “${text}”`}
                    value={zone.id}
                    disabled={disabled}
                    onChange={(event) => (event.target.value === 'remove' ? remove(text) : move(text, event.target.value as BoundaryZone))}
                    className="noesis-case__move"
                  >
                    {ZONES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    <option value="remove">Remove</option>
                  </select>
                </li>
              ))}
              {!lists[zone.id].length && <li className="noesis-case noesis-case--empty">Drop a case here</li>}
            </ul>
          </div>
        ))}
      </div>

      {asking && (
        <div className="noesis-caliper-why" role="group" aria-label="Why did this case move?">
          <p className="text-sm"><b>“{asking.text}”</b> moved from {zoneLabel(asking.from)} to {zoneLabel(asking.to)}. What does that say about the definition?</p>
          <div className="flex flex-wrap gap-2">
            <input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveReason(); if (event.key === 'Escape') setAsking(null); }} placeholder="Optional: the reason, in a sentence" aria-label="Reason for the move" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
            <button type="button" onClick={saveReason} className="noesis-record-tool noesis-record-tool--primary">Save reason</button>
            <button type="button" onClick={() => setAsking(null)} className="noesis-record-tool">Skip</button>
          </div>
        </div>
      )}

      <form className="noesis-caliper-add" onSubmit={(event) => { event.preventDefault(); add(); }}>
        <input id={`add-case-${concept.id}`} value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} placeholder="Add a case to test the boundary" aria-label="Add a case" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
        <select value={draftZone} onChange={(event) => setDraftZone(event.target.value as BoundaryZone)} aria-label="Where does it go?" className="noesis-case__move">
          {ZONES.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
        </select>
        <button type="submit" disabled={disabled || !draft.trim()} className="noesis-record-tool noesis-record-tool--primary">Add</button>
      </form>
    </section>
  );
}
