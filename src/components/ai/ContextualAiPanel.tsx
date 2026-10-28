'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCopy, Eye, Layers3, LayoutList, Loader2, Pencil, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { requestContextualAi } from '@/lib/contextual-ai-client';
import { boundedAiContext, CONTEXTUAL_AI_LABELS, CONTEXTUAL_AI_REVIEW, CONTEXTUAL_AI_SUGGESTED_PROMPTS, parseAiReviewItems, serializeAiReviewItems, type AiContextEnvelope, type AiReviewResult, type ContextualAiAction } from '@/lib/contextual-ai';
import { NoesisAiMark } from '@/components/ai/NoesisAiMark';

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
  suggestedPrompts?: string[];
}

type ReviewItemStatus = 'unreviewed' | 'kept' | 'edited' | 'dismissed';

interface ReviewItemState {
  id: string;
  title: string;
  content: string;
  detail?: string;
  status: ReviewItemStatus;
}

type ReviewWorkspaceMode = 'overview' | 'focus';

function formattedInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-muted px-1 py-0.5 font-code text-[0.9em] text-foreground">{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function ContextualAiDocument({ content }: { content: string }) {
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
  onAccept,
  buttonLabel = 'Assistance',
  promptLabel,
  promptPlaceholder = 'Ask a focused question about this item...',
  suggestedPrompts = [],
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
  const [reviewItems, setReviewItems] = useState<ReviewItemState[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewWorkspaceMode>('overview');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const rawEnvelope = useMemo(() => buildEnvelope(action, userPrompt.trim() || undefined), [action, buildEnvelope, userPrompt]);
  const envelope = useMemo(() => rawEnvelope ? boundedAiContext(rawEnvelope) : null, [rawEnvelope]);
  const activeSuggestedPrompts = suggestedPrompts.length ? suggestedPrompts : CONTEXTUAL_AI_SUGGESTED_PROMPTS[action];
  const contextDeskKey = rawEnvelope && ['source', 'annotation', 'concept', 'inquiry', 'position', 'practice'].includes(rawEnvelope.targetType)
    ? `${rawEnvelope.targetType}:${rawEnvelope.targetId}`
    : null;

  const reviewedContent = () => {
    if (!result || !reviewItems.length) return editedContent.trim();
    return serializeAiReviewItems(result.action, reviewItems.filter((item) => (item.status === 'kept' || item.status === 'edited') && item.content.trim()));
  };
  const selectedReviewCount = reviewItems.filter((item) => (item.status === 'kept' || item.status === 'edited') && item.content.trim()).length;
  const reviewedItemCount = reviewItems.filter((item) => item.status !== 'unreviewed').length;
  const focusedItemIndex = Math.max(0, reviewItems.findIndex((item) => item.id === focusedItemId));
  const focusedItem = reviewItems[focusedItemIndex] || null;
  const reviewItemLabel = result ? CONTEXTUAL_AI_REVIEW[result.action].itemName : 'item';

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
      const nextItems = parseAiReviewItems(next.action, next.content).map((item, index) => ({
        ...item,
        id: `${index}-${item.title}-${item.content.slice(0, 24)}`,
        status: 'unreviewed' as const,
      }));
      setReviewItems(nextItems);
      setFocusedItemId(nextItems[0]?.id || null);
      setReviewMode('overview');
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
    const acceptedContent = reviewedContent();
    if (!result || !acceptedContent || !onAccept || acceptLock.current) return;
    if (!envelope || result.targetId !== envelope.targetId || result.targetType !== envelope.targetType || result.action !== action) {
      setResult(null);
      toast({ title: 'Context changed', description: 'Run assistance again for the current item.' });
      return;
    }
    acceptLock.current = true;
    setAccepting(true);
    try {
      await onAccept(result, acceptedContent);
      window.dispatchEvent(new CustomEvent('noesis:ai-assisted-accepted', {
        detail: {
          action: result.action,
          targetType: result.targetType,
          targetId: result.targetId,
          content: acceptedContent,
        },
      }));
      toast({ title: 'Reviewed result applied', description: 'The reviewed text was applied through this item\'s normal editing flow.' });
      setOpen(false);
      setResult(null);
      setReviewItems([]);
      setFocusedItemId(null);
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
    const content = reviewedContent();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: 'Result copied', description: 'Nothing was added to your workspace.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Select the text and copy it manually.' });
    }
  };

  const updateReviewItem = (id: string, updates: Partial<ReviewItemState>) => {
    setReviewItems((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const focusReviewItem = (id: string, enterFocus = false) => {
    setFocusedItemId(id);
    if (enterFocus) setReviewMode('focus');
  };

  const moveFocus = (direction: -1 | 1) => {
    if (!reviewItems.length) return;
    const nextIndex = Math.min(reviewItems.length - 1, Math.max(0, focusedItemIndex + direction));
    setFocusedItemId(reviewItems[nextIndex]?.id || null);
  };

  const renderFocusedReview = () => {
    if (!result || !focusedItem) return null;
    const itemNumber = focusedItemIndex + 1;
    const dismissed = focusedItem.status === 'dismissed';
    return (
      <section className="flex h-full min-h-0 flex-col" aria-label={`Focused ${reviewItemLabel} review`}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="font-code text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {reviewItemLabel} {itemNumber} of {reviewItems.length}
            </div>
            <h3 className="mt-2 text-balance text-lg font-semibold leading-snug text-foreground">{focusedItem.title}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium capitalize text-muted-foreground">
            {focusedItem.status}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <label htmlFor={`${promptId}-focused-review`} className="text-xs font-medium text-muted-foreground">Review and revise</label>
          <Textarea
            id={`${promptId}-focused-review`}
            value={focusedItem.content}
            disabled={accepting || dismissed}
            onChange={(event) => updateReviewItem(focusedItem.id, { content: event.target.value, status: 'edited' })}
            className="mt-2 min-h-[180px] resize-y border-0 bg-transparent px-0 text-base leading-7 shadow-none focus-visible:ring-0 sm:min-h-[220px]"
          />
          {focusedItem.detail && (
            <div className="mt-5 border-l-2 border-accent/60 pl-4">
              <div className="text-xs font-medium text-foreground">Why this appeared</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{focusedItem.detail}</p>
            </div>
          )}
          <div className="mt-6 border-t border-border pt-4">
            <div className="text-xs font-medium text-foreground">Save destination</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">The {reviewItemLabel} will be saved to the {CONTEXTUAL_AI_REVIEW[result.action].destination} only after final approval.</p>
          </div>
        </div>
        <div className="border-t border-border bg-background px-4 py-3 sm:px-6">
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant={focusedItem.status === 'kept' ? 'default' : 'outline'} disabled={accepting} onClick={() => updateReviewItem(focusedItem.id, { status: 'kept' })} className="min-h-11">
              <Check className="mr-2 size-4" /> Keep
            </Button>
            <Button type="button" variant={focusedItem.status === 'edited' ? 'secondary' : 'outline'} disabled={accepting || dismissed} onClick={() => updateReviewItem(focusedItem.id, { status: 'edited' })} className="min-h-11">
              <Pencil className="mr-2 size-4" /> Edit
            </Button>
            <Button type="button" variant={dismissed ? 'secondary' : 'outline'} disabled={accepting} onClick={() => updateReviewItem(focusedItem.id, { status: dismissed ? 'unreviewed' : 'dismissed' })} className="min-h-11">
              {dismissed ? <RotateCcw className="mr-2 size-4" /> : <X className="mr-2 size-4" />}{dismissed ? 'Restore' : 'Dismiss'}
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" disabled={focusedItemIndex === 0} onClick={() => moveFocus(-1)}>
              <ChevronLeft className="mr-1 size-4" /> Previous
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={focusedItemIndex >= reviewItems.length - 1} onClick={() => moveFocus(1)}>
              Next <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <NoesisAiMark className="mr-2 size-5" /> {buttonLabel}
        </Button>
        {contextDeskKey && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Add this item to Context Desk"
            title="Add to Context Desk"
            onClick={() => {
              try {
                const stored = window.sessionStorage.getItem('noesis:context-desk:selected');
                const parsed = stored ? JSON.parse(stored) : [];
                const keys = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
                window.sessionStorage.setItem('noesis:context-desk:selected', JSON.stringify(Array.from(new Set([...keys, contextDeskKey])).slice(0, 12)));
              } catch {
                window.sessionStorage.setItem('noesis:context-desk:selected', JSON.stringify([contextDeskKey]));
              }
              const prefix = window.location.pathname.startsWith('/demo') ? '/demo' : '';
              window.location.assign(`${prefix}/context-desk`);
            }}
          >
            <Layers3 className="size-4" />
          </Button>
        )}
      </span>
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
          setReviewItems([]);
          setFocusedItemId(null);
          setReviewMode('overview');
        }
      }}>
        <DialogContent aria-describedby={`${promptId}-description`} className="h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 p-0 sm:h-[94dvh] sm:w-[calc(100vw-2rem)] sm:max-w-6xl sm:rounded-lg sm:border">
          <div className="flex h-full min-h-0 flex-col bg-background">
            <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                {result && reviewMode === 'focus' && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setReviewMode('overview')} aria-label="Return to review overview" className="size-10 shrink-0 lg:hidden">
                    <ArrowLeft className="size-5" />
                  </Button>
                )}
                <NoesisAiMark className="size-9 shrink-0" />
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg sm:text-xl">{result ? 'Context Review' : 'Contextual Assistance'}</DialogTitle>
                  <DialogDescription id={`${promptId}-description`} className="mt-1 line-clamp-2 text-xs sm:text-sm">
                    {result ? CONTEXTUAL_AI_REVIEW[result.action].guidance : 'Choose a focused action and review the exact context before anything is sent.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {!result ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
                <div className="mx-auto max-w-3xl space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor={`${promptId}-action`}>What should Noesis examine?</label>
                    <Select value={action} disabled={loading || accepting} onValueChange={(value) => { setAction(value as ContextualAiAction); setResult(null); setReviewItems([]); setFocusedItemId(null); }}>
                      <SelectTrigger id={`${promptId}-action`} aria-label="Assistance action" className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {actions.map((item) => <SelectItem key={item} value={item}>{CONTEXTUAL_AI_LABELS[item]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {promptLabel && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor={promptId}>{promptLabel}</label>
                      {!!activeSuggestedPrompts.length && (
                        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Suggested questions">
                          {activeSuggestedPrompts.slice(0, 6).map((prompt) => (
                            <Button key={prompt} type="button" variant="outline" size="sm" disabled={loading} onClick={() => setUserPrompt(prompt)} className="min-h-10 shrink-0 rounded-full text-left">
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      )}
                      <Textarea
                        id={promptId}
                        disabled={loading}
                        value={userPrompt}
                        onChange={(event) => setUserPrompt(event.target.value)}
                        placeholder={promptPlaceholder}
                        className="min-h-[120px] resize-y text-base leading-6"
                      />
                      <p className="text-xs leading-5 text-muted-foreground">Noesis answers only from the context shown below. It does not search the rest of your workspace.</p>
                    </div>
                  )}

                  {showContextBeforeSending && envelope && (
                    <section className="border-y border-border py-4" aria-labelledby={`${promptId}-context-heading`}>
                      <div id={`${promptId}-context-heading`} className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">Context being sent</div>
                      {rawEnvelope && JSON.stringify(rawEnvelope) !== JSON.stringify(envelope) && <p className="mt-2 text-xs text-muted-foreground">Long context has been shortened. Only the excerpts below will be sent.</p>}
                      <div className="mt-3">
                        <div className="text-xs font-medium text-foreground">Current item</div>
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                          {envelope.itemMemory.map((line, index) => <li key={`${index}-${line}`} className="border-l border-border pl-3">{line}</li>)}
                        </ul>
                      </div>
                      {!!envelope.linkedMemory.length && (
                        <details className="mt-4">
                          <summary className="min-h-11 cursor-pointer py-2 text-xs font-medium text-foreground">{envelope.linkedMemory.length} linked context items</summary>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                            {envelope.linkedMemory.map((line, index) => <li key={`${index}-${line}`} className="border-l border-border pl-3">{line}</li>)}
                          </ul>
                        </details>
                      )}
                    </section>
                  )}

                  {!envelope && action === 'compare_selected_positions' && (
                    <p className="border-l-2 border-destructive px-3 py-2 text-sm leading-6 text-muted-foreground" role="status">Select another position in the detail header before running this comparison.</p>
                  )}

                  <div className="sticky bottom-0 bg-background py-3">
                    <Button onClick={run} disabled={!envelope || loading} className="min-h-12 w-full text-sm">
                      {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {loading ? 'Reviewing selected context' : CONTEXTUAL_AI_LABELS[action]}
                    </Button>
                  </div>
                </div>
              </div>
            ) : reviewItems.length ? (
              <>
                <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{CONTEXTUAL_AI_REVIEW[result.action].heading}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{reviewedItemCount} of {reviewItems.length} reviewed · {selectedReviewCount} selected to save</p>
                    </div>
                    <div className="flex rounded-md border border-border p-1" aria-label="Review display mode">
                      <Button type="button" size="sm" variant={reviewMode === 'overview' ? 'secondary' : 'ghost'} onClick={() => setReviewMode('overview')} className="min-h-9 rounded-sm">
                        <LayoutList className="mr-2 size-4" /> Overview
                      </Button>
                      <Button type="button" size="sm" variant={reviewMode === 'focus' ? 'secondary' : 'ghost'} onClick={() => setReviewMode('focus')} className="min-h-9 rounded-sm">
                        <Eye className="mr-2 size-4" /> Focus
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  {reviewMode === 'focus' ? renderFocusedReview() : (
                    <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
                      <div className="min-h-0 overflow-y-auto border-border px-4 py-4 lg:border-r sm:px-6">
                        <div className="space-y-2" aria-label={`${reviewItemLabel}s to review`}>
                          {reviewItems.map((item, index) => {
                            const active = item.id === focusedItem?.id;
                            const dismissed = item.status === 'dismissed';
                            return (
                              <article key={item.id} className={`border-b border-border py-4 first:pt-0 ${dismissed ? 'opacity-60' : ''}`}>
                                <button type="button" onClick={() => focusReviewItem(item.id)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-current={active ? 'true' : undefined}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-code text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{reviewItemLabel} {index + 1}</div>
                                      <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{item.title}</h3>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium capitalize ${item.status === 'kept' ? 'border-accent/50 text-accent' : 'border-border text-muted-foreground'}`}>{item.status}</span>
                                  </div>
                                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.content}</p>
                                </button>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Button type="button" variant="outline" size="sm" disabled={accepting} onClick={() => updateReviewItem(item.id, { status: 'kept' })} className="min-h-10"><Check className="mr-2 size-4" />Keep</Button>
                                  <Button type="button" variant="ghost" size="sm" disabled={accepting || dismissed} onClick={() => focusReviewItem(item.id, true)} className="min-h-10"><Pencil className="mr-2 size-4" />Review</Button>
                                  <Button type="button" variant="ghost" size="sm" disabled={accepting} onClick={() => updateReviewItem(item.id, { status: dismissed ? 'unreviewed' : 'dismissed' })} className="min-h-10">{dismissed ? <RotateCcw className="mr-2 size-4" /> : <X className="mr-2 size-4" />}{dismissed ? 'Restore' : 'Dismiss'}</Button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                      <div className="hidden min-h-0 lg:block">{renderFocusedReview()}</div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="ghost" disabled={accepting} onClick={() => { setResult(null); setEditedContent(''); setEditingResult(false); setReviewItems([]); setFocusedItemId(null); setReviewMode('overview'); }} className="min-h-11 sm:w-auto">
                      <X className="mr-2 size-4" /> Dismiss review
                    </Button>
                    {onAccept ? (
                      <Button onClick={accept} disabled={accepting || selectedReviewCount === 0} className="min-h-11 sm:w-auto">
                        {accepting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />} Save {selectedReviewCount} {reviewItemLabel}{selectedReviewCount === 1 ? '' : 's'}
                      </Button>
                    ) : (
                      <Button onClick={copyResult} disabled={!editedContent.trim()} className="min-h-11 sm:w-auto">
                        <ClipboardCopy className="mr-2 size-4" /> Copy reviewed text
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="mx-auto max-w-3xl space-y-4">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Review the response</div>
                      <p className="mt-1 text-xs text-muted-foreground">Nothing is saved until you approve it.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={accepting} onClick={() => setEditingResult((current) => !current)}>
                      <Pencil className="mr-2 size-4" /> {editingResult ? 'Preview' : 'Edit'}
                    </Button>
                  </div>
                  {editingResult ? (
                    <Textarea id={`${promptId}-result`} aria-label="Edit assistance response" disabled={accepting} value={editedContent} onChange={(event) => setEditedContent(event.target.value)} className="min-h-[50dvh] text-base leading-7" />
                  ) : (
                    <ContextualAiDocument content={editedContent} />
                  )}
                  <div className="sticky bottom-0 flex flex-col-reverse gap-2 bg-background py-3 sm:flex-row sm:justify-end">
                    <Button variant="ghost" disabled={accepting} onClick={() => { setResult(null); setEditedContent(''); setEditingResult(false); }} className="min-h-11"><X className="mr-2 size-4" />Dismiss review</Button>
                    {onAccept ? (
                      <Button onClick={accept} disabled={accepting || !editedContent.trim()} className="min-h-11">{accepting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}Apply reviewed text</Button>
                    ) : (
                      <Button onClick={copyResult} disabled={!editedContent.trim()} className="min-h-11"><ClipboardCopy className="mr-2 size-4" />Copy text</Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
