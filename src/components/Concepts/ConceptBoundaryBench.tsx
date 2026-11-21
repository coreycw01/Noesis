"use client";

import { useRef, useState } from 'react';
import type { Concept } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CONCEPT_BOUNDARY_ZONES as ZONES, type BoundaryZone, type ConceptBoundaryFinding } from '@/lib/concept-boundary-findings';

const clean = (values?: string[]) => Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean)));

/**
 * The boundary caliper: sort cases into Fits / Edge case / Doesn't fit by
 * dragging them or choosing a zone. Moving a case across the edge of "Fits"
 * is checking the definition, so it asks why, once, and lets you skip. The
 * definition itself never changes here.
 */
export function ConceptBoundaryBench({ concept, onSave, onReviewDefinition, disabled }: {
  concept: Concept;
  onSave: (next: Concept) => Promise<boolean>;
  onReviewDefinition: (finding: ConceptBoundaryFinding) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [draftZone, setDraftZone] = useState<BoundaryZone>('edge');
  const [moved, setMoved] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ text: string; from: BoundaryZone; to: BoundaryZone } | null>(null);
  const [reason, setReason] = useState('');
  const [over, setOver] = useState<BoundaryZone | null>(null);
  const saving = useRef(false);
  const [pending, setPending] = useState(false);
  const locked = disabled || pending;

  const lists: Record<BoundaryZone, string[]> = {
    fits: clean(concept.examples),
    edge: clean(concept.edgeCases),
    outside: clean(concept.counterexamples),
  };
  const zoneOf = (text: string) => (Object.keys(lists) as BoundaryZone[]).find((zone) => lists[zone].includes(text));

  const write = async (next: Record<BoundaryZone, string[]>, reasons = concept.caseReasons) => {
    if (disabled || saving.current) return false;
    saving.current = true;
    setPending(true);
    try {
      return await onSave({
        ...concept,
        examples: next.fits,
        edgeCases: next.edge,
        counterexamples: next.outside,
        ...(reasons ? { caseReasons: reasons } : {}),
        philosophyStatus: concept.philosophyStatus === 'undefined' && (next.fits.length || next.outside.length) ? 'emerging' : concept.philosophyStatus,
        dateUpdated: new Date().toISOString(),
      });
    } finally { saving.current = false; setPending(false); }
  };

  const move = async (text: string, to: BoundaryZone) => {
    const from = zoneOf(text);
    if (!from || from === to) return;
    const next = { ...lists, [from]: lists[from].filter((item) => item !== text), [to]: [...lists[to], text] } as Record<BoundaryZone, string[]>;
    if (!await write(next)) return;
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

  const add = async () => {
    const text = draft.trim();
    if (!text || zoneOf(text)) { setDraft(''); return; }
    if (!await write({ ...lists, [draftZone]: [...lists[draftZone], text] })) return;
    setDraft('');
    setMoved(text);
  };

  const saveReason = async () => {
    if (!asking) return;
    const reasons = { ...(concept.caseReasons || {}), [asking.text]: reason.trim() };
    if (!reason.trim()) delete reasons[asking.text];
    if (!await write(lists, reasons)) return;
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
                <li key={text} className={cn('noesis-case flex-wrap', moved === text && 'is-moved')} draggable={!locked} onDragStart={(event) => { event.dataTransfer.setData('text/x-noesis-case', text); event.dataTransfer.effectAllowed = 'move'; }}>
                  <span className="min-w-0 flex-1 break-words">{text}{concept.caseReasons?.[text] && <span className="noesis-case__reason">{concept.caseReasons[text]}</span>}</span>
                  <select
                    aria-label={`Move “${text}”`}
                    value={zone.id}
                    disabled={locked}
                    onChange={(event) => { if (event.target.value === 'remove') remove(text); else void move(text, event.target.value as BoundaryZone); }}
                    className="noesis-case__move"
                  >
                    {ZONES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    <option value="remove">Remove</option>
                  </select>
                  <div className="flex w-full flex-wrap gap-x-3">
                    <Button type="button" variant="link" size="sm" className="min-h-8 px-0" disabled={locked} onClick={() => { setAsking({ text, from: zone.id, to: zone.id }); setReason(concept.caseReasons?.[text] || ''); }}>{concept.caseReasons?.[text] ? 'Edit reason' : 'Add reason'}</Button>
                    {concept.caseReasons?.[text]?.trim() && <Button type="button" variant="link" size="sm" className="min-h-8 px-0" disabled={locked} onClick={() => onReviewDefinition({ example: text, reason: concept.caseReasons![text].trim(), label: zone.label, zone: zone.id })}>Review definition</Button>}
                  </div>
                </li>
              ))}
              {!lists[zone.id].length && <li className="noesis-case noesis-case--empty">Drop a case here</li>}
            </ul>
          </div>
        ))}
      </div>

      {asking && (
        <div className="noesis-caliper-why" role="group" aria-label="Why did this case move?">
          <p className="text-sm"><b>“{asking.text}”</b> {asking.from === asking.to ? `is classified as ${zoneLabel(asking.to)}.` : `moved from ${zoneLabel(asking.from)} to ${zoneLabel(asking.to)}.`} What does that say about the definition?</p>
          <div className="flex flex-wrap gap-2">
            <input autoFocus value={reason} disabled={locked} onChange={(event) => setReason(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveReason(); if (event.key === 'Escape') setAsking(null); }} placeholder="Optional: the reason, in a sentence" aria-label="Reason for this classification" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
            <Button variant="secondary" disabled={locked} onClick={saveReason}>Save reason</Button>
            <Button variant="outline" disabled={locked} onClick={() => setAsking(null)}>Skip</Button>
          </div>
        </div>
      )}

      <form className="noesis-caliper-add" onSubmit={(event) => { event.preventDefault(); add(); }}>
        <input id={`add-case-${concept.id}`} value={draft} disabled={locked} onChange={(event) => setDraft(event.target.value)} placeholder="Add a case to test the boundary" aria-label="Add a case" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
        <select value={draftZone} disabled={locked} onChange={(event) => setDraftZone(event.target.value as BoundaryZone)} aria-label="Where does it go?" className="noesis-case__move">
          {ZONES.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
        </select>
        <Button type="submit" variant="secondary" disabled={locked || !draft.trim()}>Add</Button>
      </form>
    </section>
  );
}
