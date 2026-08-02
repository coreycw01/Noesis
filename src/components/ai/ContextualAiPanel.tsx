'use client';

import { useMemo, useState } from 'react';
import { BrainCircuit, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { requestContextualAi } from '@/lib/contextual-ai-client';
import { CONTEXTUAL_AI_LABELS, type AiContextEnvelope, type AiReviewResult, type ContextualAiAction } from '@/lib/contextual-ai';

export interface ContextualAiPanelProps {
  actions: ContextualAiAction[];
  buildEnvelope: (action: ContextualAiAction) => AiContextEnvelope | null;
  enabled?: boolean;
  showContextBeforeSending?: boolean;
  reasoningDepth?: 'light' | 'standard' | 'deep';
  retainAcceptedProvenance?: boolean;
  onAccept?: (result: AiReviewResult, editedContent: string) => void | Promise<void>;
  buttonLabel?: string;
}

export function ContextualAiPanel({
  actions,
  buildEnvelope,
  enabled = true,
  showContextBeforeSending = true,
  reasoningDepth = 'standard',
  retainAcceptedProvenance = true,
  onAccept,
  buttonLabel = 'Assistance',
}: ContextualAiPanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ContextualAiAction>(actions[0]!);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const envelope = useMemo(() => buildEnvelope(action), [action, buildEnvelope]);

  if (!enabled || actions.length === 0) return null;

  const run = async () => {
    if (!envelope || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const next = await requestContextualAi({ ...envelope, reasoningDepth });
      setResult(next);
      setEditedContent(next.content);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Assistance unavailable',
        description: error instanceof Error ? error.message : 'Try again later. Your data was not changed.',
      });
    } finally {
      setLoading(false);
    }
  };

  const accept = async () => {
    if (!result || !editedContent.trim() || !onAccept) return;
    await onAccept(result, editedContent.trim());
    if (retainAcceptedProvenance) {
      window.dispatchEvent(new CustomEvent('noesis:ai-assisted-accepted', {
        detail: {
          action: result.action,
          targetType: result.targetType,
          targetId: result.targetId,
          content: editedContent.trim(),
        },
      }));
    }
    toast({ title: 'Reviewed result applied', description: 'The accepted text was saved through the normal workspace flow.' });
    setOpen(false);
    setResult(null);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <BrainCircuit className="mr-2 size-4" /> {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setResult(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contextual Assistance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={action} onValueChange={(value) => { setAction(value as ContextualAiAction); setResult(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {actions.map((item) => <SelectItem key={item} value={item}>{CONTEXTUAL_AI_LABELS[item]}</SelectItem>)}
              </SelectContent>
            </Select>

            {showContextBeforeSending && envelope && !result && (
              <Card className="space-y-3 border-border/60 bg-muted/10 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Context sent</div>
                <div>
                  <div className="text-xs font-medium text-foreground">Current item</div>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {envelope.itemMemory.map((line) => <li key={line}>• {line}</li>)}
                  </ul>
                </div>
                {!!envelope.linkedMemory.length && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-foreground">{envelope.linkedMemory.length} linked context items</summary>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {envelope.linkedMemory.map((line) => <li key={line}>• {line}</li>)}
                    </ul>
                  </details>
                )}
              </Card>
            )}

            {!result ? (
              <Button onClick={run} disabled={!envelope || loading} className="w-full rounded-full">
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {loading ? 'Reviewing selected context' : CONTEXTUAL_AI_LABELS[action]}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
                  Generated from {result.contextSummary}. Review and edit before applying.
                </div>
                <Textarea value={editedContent} onChange={(event) => setEditedContent(event.target.value)} className="min-h-[280px] leading-7" />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => { setResult(null); setEditedContent(''); }} className="rounded-full">
                    <X className="mr-2 size-4" /> Dismiss
                  </Button>
                  {onAccept && (
                    <Button onClick={accept} className="rounded-full">
                      <Check className="mr-2 size-4" /> Apply Reviewed Text
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
