'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { BrainCircuit, Check, ClipboardCopy, Loader2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { requestContextualAi } from '@/lib/contextual-ai-client';
import { boundedAiContext, CONTEXTUAL_AI_LABELS, type AiContextEnvelope, type AiReviewResult, type ContextualAiAction } from '@/lib/contextual-ai';

export interface ContextualAiPanelProps {
  actions: ContextualAiAction[];
  buildEnvelope: (action: ContextualAiAction, userPrompt?: string) => AiContextEnvelope | null;
  enabled?: boolean;
  showContextBeforeSending?: boolean;
  reasoningDepth?: 'light' | 'standard' | 'deep';
  retainAcceptedProvenance?: boolean;
  onAccept?: (result: AiReviewResult, editedContent: string) => void | Promise<void>;
  buttonLabel?: string;
  promptLabel?: string;
  promptPlaceholder?: string;
}

function formattedInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-muted px-1 py-0.5 font-code text-[0.9em] text-foreground">{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function ReviewDocument({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() || '';
    if (!line || /^-{3,}$/.test(line)) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(<h3 key={`heading-${index}`} className={level === 1 ? 'text-lg font-semibold text-foreground' : 'text-sm font-semibold text-foreground'}>{formattedInline(heading[2])}</h3>);
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index]?.trim() || '')) {
        items.push((lines[index]?.trim() || '').replace(/^[-*+]\s+/, ''));
        index += 1;
      }
      blocks.push(<ul key={`list-${index}`} className="space-y-2 pl-1">{items.map((item, itemIndex) => <li key={itemIndex} className="flex gap-3 text-sm leading-6 text-foreground/90"><span aria-hidden="true" className="mt-[0.65rem] size-1.5 shrink-0 rounded-full bg-accent" /><span>{formattedInline(item)}</span></li>)}</ul>);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index]?.trim() || '')) {
        items.push((lines[index]?.trim() || '').replace(/^\d+[.)]\s+/, ''));
        index += 1;
      }
      blocks.push(<ol key={`steps-${index}`} className="space-y-3">{items.map((item, itemIndex) => <li key={itemIndex} className="grid grid-cols-[1.75rem_1fr] gap-2 text-sm leading-6 text-foreground/90"><span className="flex size-7 items-center justify-center rounded-full border border-border bg-background font-code text-[10px] font-semibold text-muted-foreground">{itemIndex + 1}</span><span>{formattedInline(item)}</span></li>)}</ol>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index]?.trim() || '';
      if (!candidate || /^(#{1,4})\s+/.test(candidate) || /^[-*+]\s+/.test(candidate) || /^\d+[.)]\s+/.test(candidate) || /^-{3,}$/.test(candidate)) break;
      paragraph.push(candidate.replace(/^>\s?/, ''));
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`} className="text-sm leading-7 text-foreground/90">{formattedInline(paragraph.join(' '))}</p>);
  }

  return <div className="space-y-4">{blocks}</div>;
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
  promptLabel,
  promptPlaceholder = 'Ask a focused question about this item...',
}: ContextualAiPanelProps) {
  const { toast } = useToast();
  const promptId = useId();
  const requestRef = useRef<AbortController | null>(null);
  const acceptLock = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ContextualAiAction>(actions[0]!);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [editingResult, setEditingResult] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const rawEnvelope = useMemo(() => buildEnvelope(action, userPrompt.trim() || undefined), [action, buildEnvelope, userPrompt]);
  const envelope = useMemo(() => rawEnvelope ? boundedAiContext(rawEnvelope) : null, [rawEnvelope]);

  if (!enabled || actions.length === 0) return null;

  const run = async () => {
    if (!envelope || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(new Error('Assistance timed out. Please try again.')), 90_000);
    setLoading(true);
    setResult(null);
    try {
      const next = await requestContextualAi({ ...envelope, reasoningDepth }, controller.signal);
      if (requestRef.current !== controller || controller.signal.aborted) return;
      setResult(next);
      setEditedContent(next.content);
      setEditingResult(false);
    } catch (error) {
      if (requestRef.current !== controller) return;
      toast({
        variant: 'destructive',
        title: 'Assistance unavailable',
        description: error instanceof Error ? error.message : 'Try again later. Your data was not changed.',
      });
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const accept = async () => {
    if (!result || !editedContent.trim() || !onAccept || acceptLock.current) return;
    if (!envelope || result.targetId !== envelope.targetId || result.targetType !== envelope.targetType || result.action !== action) {
      setResult(null);
      toast({ title: 'Context changed', description: 'Run assistance again for the current item.' });
      return;
    }
    acceptLock.current = true;
    setAccepting(true);
    try {
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
      toast({ title: 'Reviewed result applied', description: 'The reviewed text was applied through this item\'s normal editing flow.' });
      setOpen(false);
      setResult(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not apply reviewed text',
        description: error instanceof Error ? error.message : 'Your existing data was not changed.',
      });
    } finally {
      acceptLock.current = false;
      setAccepting(false);
    }
  };

  const copyResult = async () => {
    if (!editedContent.trim()) return;
    try {
      await navigator.clipboard.writeText(editedContent.trim());
      toast({ title: 'Result copied', description: 'Nothing was added to your workspace.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Select the text and copy it manually.' });
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <BrainCircuit className="mr-2 size-4" /> {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => {
        if (acceptLock.current) return;
        setOpen(next);
        if (!next) {
          requestRef.current?.abort();
          requestRef.current = null;
          setLoading(false);
          setResult(null);
          setEditedContent('');
          setEditingResult(false);
        }
      }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contextual Assistance</DialogTitle>
            <DialogDescription>Review the exact workspace context Noesis will use, then edit or dismiss the result before anything is saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={action} disabled={loading || accepting} onValueChange={(value) => { setAction(value as ContextualAiAction); setResult(null); }}>
              <SelectTrigger aria-label="Assistance action"><SelectValue /></SelectTrigger>
              <SelectContent>
                {actions.map((item) => <SelectItem key={item} value={item}>{CONTEXTUAL_AI_LABELS[item]}</SelectItem>)}
              </SelectContent>
            </Select>

            {promptLabel && !result && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor={promptId}>{promptLabel}</label>
                <Textarea
                  id={promptId}
                  disabled={loading}
                  value={userPrompt}
                  onChange={(event) => setUserPrompt(event.target.value)}
                  placeholder={promptPlaceholder}
                  className="min-h-[92px]"
                />
                <p className="text-xs leading-5 text-muted-foreground">Noesis answers from the context shown below. It does not search the rest of your workspace.</p>
              </div>
            )}

            {showContextBeforeSending && envelope && !result && (
              <Card className="space-y-3 border-border/60 bg-muted/10 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Context sent</div>
                {rawEnvelope && JSON.stringify(rawEnvelope) !== JSON.stringify(envelope) && <p className="text-xs text-muted-foreground">Long context has been shortened. Only the excerpts below will be sent.</p>}
                <div>
                  <div className="text-xs font-medium text-foreground">Current item</div>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {envelope.itemMemory.map((line, index) => <li key={`${index}-${line}`}>• {line}</li>)}
                  </ul>
                </div>
                {!!envelope.linkedMemory.length && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-foreground">{envelope.linkedMemory.length} linked context items</summary>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {envelope.linkedMemory.map((line, index) => <li key={`${index}-${line}`}>• {line}</li>)}
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
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Review Noesis&apos;s suggestion</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Based on {result.contextSummary}. Nothing is saved until you apply it.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={accepting} onClick={() => setEditingResult((current) => !current)} className="shrink-0 rounded-full">
                    <Pencil className="mr-2 size-3.5" /> {editingResult ? 'Preview response' : 'Edit response'}
                  </Button>
                </div>
                {editingResult ? (
                  <div className="space-y-2">
                    <label htmlFor={`${promptId}-result`} className="text-xs font-medium text-foreground">Edit the wording before saving</label>
                    <Textarea id={`${promptId}-result`} aria-label="Edit assistance response" disabled={accepting} value={editedContent} onChange={(event) => setEditedContent(event.target.value)} className="min-h-[280px] leading-7" />
                    <p className="text-xs text-muted-foreground">Formatting marks are visible here only so you can revise the structure.</p>
                  </div>
                ) : (
                  <div className="max-h-[48dvh] overflow-y-auto rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Assistance response preview">
                    <ReviewDocument content={editedContent} />
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" disabled={accepting} onClick={() => { setResult(null); setEditedContent(''); setEditingResult(false); }} className="rounded-full">
                    <X className="mr-2 size-4" /> Dismiss
                  </Button>
                  {onAccept ? (
                    <Button onClick={accept} disabled={accepting || !editedContent.trim()} className="rounded-full">
                      {accepting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />} Apply Reviewed Text
                    </Button>
                  ) : (
                    <Button onClick={copyResult} disabled={!editedContent.trim()} className="rounded-full">
                      <ClipboardCopy className="mr-2 size-4" /> Copy Text
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
