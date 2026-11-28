"use client";

import { useRef, useState } from 'react';
import type { Concept } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { boundaryCases, boundaryNumbering, CONCEPT_BOUNDARY_ZONES as ZONES, type BoundaryZone, type ConceptBoundaryFinding } from '@/lib/concept-boundary-findings';
import { BOUNDARY_LABELS, ConceptBoundaryMap } from '@/components/Concepts/ConceptBoundaryMap';
export function ConceptBoundaryBench({ concept, onSave, onReviewDefinition, disabled }: {
  concept: Concept;
  onSave: (next: Concept) => Promise<boolean>;
  onReviewDefinition: (finding: ConceptBoundaryFinding) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const lists = boundaryCases(concept);
  const { numbers } = boundaryNumbering(concept, lists);
  const [firstZone, setFirstZone] = useState<BoundaryZone>('fits');
  const [draftZone, setDraftZone] = useState<BoundaryZone>(() => ZONES.find(zone => lists[zone.id].length)?.id || 'edge');
  const [picked, setPicked] = useState<string>();
  const [asking, setAsking] = useState<{ text: string; from: BoundaryZone; to: BoundaryZone } | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const caseList = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const locked = disabled || pending;

  const selected = picked && lists[draftZone].includes(picked) ? picked : lists[draftZone][0];
  const activeZone = ZONES.find(zone => zone.id === draftZone)!;
  const selectCase = (zone: BoundaryZone, text?: string) => {
    setDraftZone(zone);
    setPicked(text);
    setAsking(null);
    setMessage('');
  };
  const zoneOf = (text: string) => ZONES.find(zone => lists[zone.id].includes(text))?.id;

  const write = async (next: Record<BoundaryZone, string[]>, reasons = concept.caseReasons) => {
    if (disabled || saving.current) return false;
    saving.current = true;
    setPending(true);
    setMessage('');
    try {
      if (await onSave({
        ...concept,
        ...boundaryNumbering(concept, next).patch,
        examples: next.fits,
        edgeCases: next.edge,
        counterexamples: next.outside,
        ...(reasons ? { caseReasons: reasons } : {}),
        philosophyStatus: concept.philosophyStatus === 'undefined' && (next.fits.length || next.outside.length) ? 'emerging' : concept.philosophyStatus,
        dateUpdated: new Date().toISOString(),
      })) return true;
    } catch { /* Keep the input available for another attempt. */ }
    finally { saving.current = false; setPending(false); }
    setMessage('The example could not be saved. Try again.');
    return false;
  };

  const move = async (text: string, to: BoundaryZone) => {
    const from = zoneOf(text);
    if (!from || from === to) return;
    const next = { ...lists, [from]: lists[from].filter((item) => item !== text), [to]: [...new Set([...lists[to], text])] };
    if (!await write(next)) return;
    selectCase(to, text);
    setMessage(`Example moved to ${BOUNDARY_LABELS[to]}.`);
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
    if (!text) return;
    const existing = zoneOf(text);
    if (existing) {
      selectCase(existing, text);
      setMessage('That example is already on the map.');
      return;
    }
    if (!await write({ ...lists, [draftZone]: [...lists[draftZone], text] })) return;
    setDraft('');
    selectCase(draftZone, text);
  };

  const saveReason = async () => {
    if (!asking) return;
    const reasons = { ...(concept.caseReasons || {}), [asking.text]: reason.trim() };
    if (!reason.trim()) delete reasons[asking.text];
    if (!await write(lists, reasons)) return;
    setAsking(null);
    setReason('');
  };

  const zoneLabel = (zone: BoundaryZone) => BOUNDARY_LABELS[zone];

  return (
    <section className="grid min-w-0 items-start gap-3 lg:grid-cols-2" aria-label={`Boundary of ${concept.name}`}>
      <ConceptBoundaryMap concept={concept} zone={draftZone} selectedCase={selected}
        onZone={zone => { if (!locked) selectCase(zone); }}
        onCase={(zone, text) => { if (!locked) selectCase(zone, text); }}
        onDropCase={(zone, event) => {
          const text = event.dataTransfer.getData('text/x-noesis-case');
          if (!text) return;
          event.preventDefault();
          void move(text, zone);
        }} />
      <div className="grid min-w-0 gap-3">
        <section className="noesis-record-instrument" data-tone="concept" aria-label="Examples to test">
          <label className="flex flex-wrap items-center justify-between gap-2 text-sm">Examples to test
            <select aria-label="Show boundary zone first" value={firstZone} onChange={event => {
              setFirstZone(event.target.value as BoundaryZone);
              if (caseList.current) caseList.current.scrollTop = 0;
            }} className="min-h-11 rounded-md border border-border bg-background px-2 text-sm">
              {ZONES.map(zone => <option key={zone.id} value={zone.id}>{zoneLabel(zone.id)} first</option>)}
            </select>
          </label>
          <div ref={caseList} tabIndex={0} role="region" aria-label="Example list" className="max-h-60 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-ring">
            {[...ZONES.filter(zone => zone.id === firstZone), ...ZONES.filter(zone => zone.id !== firstZone)].map(({ id }) => (
              <section key={id} aria-label={zoneLabel(id)} className="border-t border-border py-1.5">
                <h3 className="px-2 py-1 text-xs font-semibold text-tone">{zoneLabel(id)} · {lists[id].length}</h3>
                {lists[id].length ? <ul>
                  {[...lists[id]].sort((a, b) => numbers.get(a)! - numbers.get(b)!).map(text => (
                    <li key={text}><button type="button" disabled={locked} aria-pressed={draftZone === id && selected === text}
                      onClick={() => selectCase(id, text)} className="flex min-h-11 w-full min-w-0 items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted">
                      <span className="shrink-0 font-code text-tone">#{numbers.get(text)}</span>
                      <span className="min-w-0 break-words">{text}</span>
                    </button></li>
                  ))}
                </ul> : <p className="px-2 py-1 text-xs text-muted-foreground">No examples</p>}
              </section>
            ))}
          </div>
        </section>
        <section className="noesis-record-instrument" data-tone="concept" aria-label="Example details">
          <h3 className="noesis-eyebrow font-bold text-tone">{selected && `Example #${numbers.get(selected)} · `}{zoneLabel(draftZone)}</h3>
          {selected ? <>
            <p className="break-words font-headline text-base font-semibold" draggable={!locked}
              onDragStart={event => { event.dataTransfer.setData('text/x-noesis-case', selected); event.dataTransfer.effectAllowed = 'move'; }}>{selected}</p>
            {!asking && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{concept.caseReasons?.[selected]?.trim() || 'No reason recorded.'}</p>}
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Move to
              <select aria-label="Move example to another group" value={draftZone} disabled={locked}
                onChange={event => { if (event.target.value === 'remove') remove(selected); else void move(selected, event.target.value as BoundaryZone); }}
                className="min-h-11 rounded-md border border-border bg-background px-2 text-sm text-foreground">
                {ZONES.map(zone => <option key={zone.id} value={zone.id}>{zoneLabel(zone.id)}</option>)}
                <option value="remove">Remove from boundary</option>
              </select>
            </label>
            {!asking && <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => { setAsking({ text: selected, from: draftZone, to: draftZone }); setReason(concept.caseReasons?.[selected] || ''); }}>{concept.caseReasons?.[selected] ? 'Edit reason' : 'Add reason'}</Button>
              {concept.caseReasons?.[selected]?.trim() && <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => onReviewDefinition({ example: selected, reason: concept.caseReasons![selected].trim(), label: activeZone.label, zone: draftZone })}>Review definition</Button>}
            </div>}
          </> : <p className="text-sm text-muted-foreground">No examples here yet.</p>}
          {message && <p role="status" className="text-sm">{message}</p>}
        </section>

      {asking && (
        <div className="grid gap-2 border-l border-border pl-3" role="group" aria-label="Reason for classification">
          <p className="text-sm"><b>“{asking.text}”</b> {asking.from === asking.to ? `is classified as ${zoneLabel(asking.to)}.` : `moved from ${zoneLabel(asking.from)} to ${zoneLabel(asking.to)}.`} What does that say about the definition?</p>
          <div className="flex flex-wrap gap-2">
            <input autoFocus value={reason} disabled={locked} onChange={(event) => setReason(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveReason(); if (event.key === 'Escape') setAsking(null); }} placeholder="Optional: the reason, in a sentence" aria-label="Reason for this classification" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
            <Button variant="secondary" disabled={locked} onClick={saveReason}>Save reason</Button>
            <Button variant="outline" disabled={locked} onClick={() => setAsking(null)}>Skip</Button>
          </div>
        </div>
      )}

      <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void add(); }}>
        <input id={`add-case-${concept.id}`} value={draft} disabled={locked} onChange={(event) => setDraft(event.target.value)} placeholder="Describe a situation to test" aria-label="Example to test" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
        <select value={draftZone} disabled={locked} onChange={(event) => selectCase(event.target.value as BoundaryZone)} aria-label="Where does it go?" className="min-h-11 rounded-md border border-border bg-background px-2 text-sm">
          {ZONES.map((zone) => <option key={zone.id} value={zone.id}>{zoneLabel(zone.id)}</option>)}
        </select>
        <Button type="submit" variant="secondary" disabled={locked || !draft.trim()}>Add example</Button>
      </form>
      </div>
    </section>
  );
}
