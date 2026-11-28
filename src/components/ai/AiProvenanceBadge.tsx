'use client';

import { useContext, useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { commitDemoChanges } from '@/lib/demo-session';
import { readAiProvenance } from '@/lib/ai-provenance-read';
import { requireWorkspaceConnection } from '@/lib/workspace-connectivity';
import { CONTEXTUAL_AI_LABELS } from '@/lib/contextual-ai';
import { sourceAnnotationReviewTarget, type AiProvenanceRecord, type AnnotationOrigin, type ProvenanceRef } from '@/lib/ai-provenance';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContextualAiDocument } from './ContextualAiPanel';

type OriginState = 'loading' | 'unavailable' | AiProvenanceRecord;

export function PromotedAnnotationOrigins({ origins }: { origins?: AnnotationOrigin[] }) {
  if (!origins?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {origins.map(({ annotationId, provenance }, index) => (
        <AiProvenanceBadge key={annotationId} provenance={provenance}
          target={sourceAnnotationReviewTarget(annotationId)}
          title={origins.length > 1 ? `Original annotation ${index + 1}` : 'Original annotation'}
          label="AI-assisted source annotation" />
      ))}
    </div>
  );
}

export function AiProvenanceBadge({ provenance, target, title, label = 'AI-assisted' }: {
  provenance: ProvenanceRef;
  target: AiProvenanceRecord['targets'][number];
  title: string;
  label?: string;
}) {
  const db = useFirestore();
  const workspace = useContext(NoesisWorkspaceKeyContext);
  const opener = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const removing = useRef(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<OriginState>('loading');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removalError, setRemovalError] = useState('');
  const uid = workspace?.slice(0, workspace.lastIndexOf(':'));
  const load = async () => {
    const current = ++request.current;
    setState('loading');
    try {
      const data = await readAiProvenance(db, workspace, provenance, target);
      if (current !== request.current) return;
      setState(data || 'unavailable');
    } catch {
      if (current === request.current) setState('unavailable');
    }
  };
  const record = typeof state === 'object' ? state : null;
  const removeSuggestion = async () => {
    if (!record || record.state !== 'active' || !record.precursor || !uid || removing.current) return;
    const current = request.current;
    removing.current = true;
    setSaving(true);
    setRemovalError('');
    const patch = { precursor: null, state: 'redacted' as const };
    try {
      const path = `users/${uid}/aiProvenance/${record.id}`;
      if (workspace?.endsWith(':demo')) commitDemoChanges(uid, [{ path, operation: 'update', data: patch }]);
      else {
        requireWorkspaceConnection();
        await updateDoc(doc(db, path), patch);
      }
      if (current === request.current) {
        setState({ ...record, ...patch });
        setConfirmRemoval(false);
      }
    } catch {
      if (current === request.current) setRemovalError('The original suggestion could not be removed. Check your connection and try again.');
    } finally {
      removing.current = false;
      setSaving(false);
    }
  };
  const date = record?.acceptedAt as { toDate?: () => Date } | string | undefined;
  const accepted = typeof date === 'string' ? new Date(date) : date?.toDate?.();
  return (
    <>
      <Button ref={opener} type="button" variant="outline" size="sm" className="min-h-11" aria-haspopup="dialog"
        aria-label={`${label}: ${title}`} onClick={() => { setConfirmRemoval(false); setRemovalError(''); setOpen(true); void load(); }}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!next) request.current++; setOpen(next); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto" onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus({ preventScroll: true });
        }}>
          <DialogHeader>
            <DialogTitle>AI-assisted content</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          {state === 'loading' && <p role="status">Loading origin details...</p>}
          {state === 'unavailable' && <div className="space-y-3"><p role="status">Origin details could not be loaded.</p><Button type="button" variant="outline" onClick={() => void load()}>Retry</Button></div>}
          {record && <>
            <dl className="grid gap-2 text-sm">
              <div><dt className="font-medium">Origin</dt><dd>{CONTEXTUAL_AI_LABELS[record.origin.action]}</dd></div>
              {accepted && Number.isFinite(accepted.getTime()) && <div><dt className="font-medium">Accepted</dt><dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(accepted)}</dd></div>}
              <div><dt className="font-medium">Saved to</dt><dd>{target.type === 'inquiry' ? 'Inquiry investigation note' : title}</dd></div>
            </dl>
            {record.acceptedText && <section className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Approved synthesis</h3>
              <div className="break-words"><ContextualAiDocument content={record.acceptedText} /></div>
            </section>}
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Original suggestion</h3>
              {record.state === 'active' && record.precursor
                ? <>
                  <div className="break-words"><ContextualAiDocument content={record.precursor} /></div>
                  {confirmRemoval ? <div className="space-y-2">
                    <p className="text-sm">Remove the original suggestion from this AI history entry? The content you kept will stay saved.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" disabled={saving} onClick={() => { setConfirmRemoval(false); setRemovalError(''); }}>Cancel</Button>
                      <Button type="button" variant="destructive" disabled={saving} onClick={() => void removeSuggestion()}>{saving ? 'Removing...' : 'Remove original suggestion'}</Button>
                    </div>
                    {removalError && <p role="alert" className="text-sm text-destructive">{removalError}</p>}
                  </div> : <Button type="button" variant="outline" onClick={() => setConfirmRemoval(true)}>Remove original</Button>}
                </>
                : <p role={record.state === 'redacted' ? 'status' : undefined} className="text-sm text-muted-foreground">{record.state === 'redacted' ? 'The original suggestion was removed.' : 'No original suggestion is available.'}</p>}
            </section>
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
