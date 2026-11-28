'use client';

import { Fragment, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { CONTEXT_DESK_TYPES } from '@/lib/saved-context-desks';
import { readBrowserPreference, writeBrowserPreference } from '@/lib/browser-preferences';
import { ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCopy, Eye, EyeOff, LayoutList, Loader2, Pencil, RotateCcw, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { requestContextualAi } from '@/lib/contextual-ai-client';
import { AI_USER_PROMPT_LIMIT, boundedAiContext, CONTEXTUAL_AI_LABELS, CONTEXTUAL_AI_REVIEW, CONTEXTUAL_AI_SUGGESTED_PROMPTS, parseAiReviewItems, serializeAiReviewItems, type AiContextEnvelope, type AiReviewResult, type ContextualAiAction } from '@/lib/contextual-ai';
import { NoesisAiMark } from '@/components/ai/NoesisAiMark';
import { ContextDeskFiling } from '@/components/ai/ContextDeskFiling';
import { AssistanceHistory, useSaveExchange } from './AssistanceHistory';
import { assistanceExchange, challengeClarification } from '@/lib/assistance-exchange';
import type { AiAssistedHistoryEntry } from '@/lib/types';
import { aiExcerptKey, contextualPromptCopy, prepareReviewedAiContext, type MemoryGroup } from '@/lib/contextual-ai-preview';

type IncludedAiContext = ReturnType<typeof prepareReviewedAiContext>['included'];

export interface ContextualAiPanelProps {
  itemHistory?: readonly AiAssistedHistoryEntry[];
  actions: ContextualAiAction[];
  buildEnvelope: (action: ContextualAiAction, userPrompt?: string) => AiContextEnvelope | null;
  enabled?: boolean;
  showContextBeforeSending?: boolean;
  reasoningDepth?: 'light' | 'standard' | 'deep';
  onAccept?: (result: AiReviewResult, editedContent: string, included: IncludedAiContext) => void | Promise<void>;
  acceptDestination?: ReactNode | ((included: IncludedAiContext) => ReactNode);
  acceptLabel?: string;
  reviewContextKey?: string;
  deskRecordKeys?: readonly string[];
  buttonLabel?: string;
  iconOnly?: boolean;
  showDeskFiling?: boolean;
  actionPromptLabel?: string;
  promptLabel?: string;
  promptPlaceholder?: string;
  /**
   * The question, when the surface around the panel owns it. Context Desk and
   * Ask Noesis put the question on the page itself, so the request can be read
   * whole before it is sent rather than half of it living inside the dialog.
   * Pass both to control it; leave them off and the panel keeps its own.
   */
  prompt?: string;
  onPromptChange?: (value: string) => void;
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
      blocks.push(<ol key={`steps-${index}`} className="space-y-3">{items.map((item, itemIndex) => <li key={itemIndex} className="grid grid-cols-[1.75rem_1fr] gap-2 text-sm leading-6 text-foreground/90"><span className="flex size-7 items-center justify-center rounded-full border border-border bg-background noesis-figure font-semibold text-muted-foreground">{itemIndex + 1}</span><span>{formattedInline(item)}</span></li>)}</ol>);
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

type AiDepth = 'light' | 'standard' | 'deep';
const AI_DEPTH_KEY = 'noesis:ai-depth-by-action';
const AI_DEPTHS: Array<{ id: AiDepth; label: string; hint: string }> = [
  { id: 'light', label: 'Quick', hint: 'The single strongest observation.' },
  { id: 'standard', label: 'Standard', hint: 'Main reasons and uncertainty.' },
  { id: 'deep', label: 'Deep', hint: 'Competing readings, weighed.' },
];

export function ContextualAiPanel({
  itemHistory,
  actions,
  buildEnvelope,
  enabled = true,
  showContextBeforeSending = true,
  reasoningDepth = 'standard',
  onAccept,
  acceptDestination,
  acceptLabel,
  reviewContextKey,
  deskRecordKeys,
  buttonLabel = 'Assistance',
  iconOnly = false,
  showDeskFiling = true,
  actionPromptLabel,
  promptLabel,
  promptPlaceholder = 'Ask a focused question about this item...',
  prompt: controlledPrompt,
  onPromptChange,
  suggestedPrompts = [],
}: ContextualAiPanelProps) {
  const { toast } = useToast();
  const workspaceKey = useContext(NoesisWorkspaceKeyContext);
  const promptId = useId();
  const requestRef = useRef<{ controller: AbortController; signature: string } | null>(null);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);
  const inlinePanel = useRef<HTMLDivElement | null>(null);
  const focusedEditor = useRef<HTMLTextAreaElement>(null);
  const focusedReviewHeading = useRef<HTMLHeadingElement>(null);
  const focusReviewHeading = useRef(false);
  const acceptLock = useRef(false);
  const reviewedRequest = useRef<string | null>(null);
  useLayoutEffect(() => () => {
    const pending = requestRef.current;
    requestRef.current = null;
    pending?.controller.abort();
  }, []);
  const [open, setOpen] = useState(false);
  const [historyView, setHistoryView] = useState<'assist' | 'exchanges' | 'applied'>('assist');
  const showHistory = historyView !== 'assist';
  const saveExchange = useSaveExchange();
  // Move focus into the panel when it opens, so keyboard users land in it.
  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      const panel = inlinePanel.current; if (!panel) return;
      // Open toward whichever side has room, so the panel never runs off-screen.
      const anchor = panel.parentElement?.getBoundingClientRect();
      if (anchor) panel.dataset.side = anchor.right < Math.min(980, window.innerWidth - 32) ? 'left' : 'right';
      panel.focus({ preventScroll: true });
    });
  }, [open]);
  const [action, setAction] = useState<ContextualAiAction>(actions[0]!);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const clarification = challengeClarification(result);
  const [editedContent, setEditedContent] = useState('');
  const [editingResult, setEditingResult] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItemState[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewWorkspaceMode>('overview');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [ownPrompt, setOwnPrompt] = useState('');
  const [hiddenContext, setHiddenContext] = useState<Set<string>>(new Set());
  // Controlled when the surface supplies both halves; its own otherwise.
  const controlled = typeof controlledPrompt === 'string' && typeof onPromptChange === 'function';
  const userPrompt = controlled ? controlledPrompt : ownPrompt;
  const setUserPrompt = controlled ? onPromptChange : setOwnPrompt;
  const promptTooShort = userPrompt.trim().length === 1;
  const rawEnvelope = useMemo(() => {
    const prompt = userPrompt.trim() || undefined;
    const next = buildEnvelope(action, prompt);
    return next && { ...next, userPrompt: prompt ?? next.userPrompt };
  }, [action, buildEnvelope, userPrompt]);
  const envelope = useMemo(() => rawEnvelope ? boundedAiContext(rawEnvelope) : null, [rawEnvelope]);
  const preview = useMemo(() => envelope ? prepareReviewedAiContext(envelope, hiddenContext, deskRecordKeys) : null, [envelope, hiddenContext, deskRecordKeys]);
  const actionAvailable = enabled && actions.includes(action);
  // Depth can be set per action (remembered on this device); the Settings default applies otherwise.
  const [depthByAction, setDepthByAction] = useState<Partial<Record<ContextualAiAction, AiDepth>>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(readBrowserPreference(AI_DEPTH_KEY) || '{}') as Partial<Record<ContextualAiAction, AiDepth>>;
      if (saved && typeof saved === 'object') setDepthByAction(saved);
    } catch { /* A malformed preference falls back to the default depth. */ }
  }, []);
  const effectiveDepth: AiDepth = depthByAction[action] || reasoningDepth;
  const chooseDepth = (depth: AiDepth) => {
    setDepthByAction((current) => {
      const next = { ...current, [action]: depth };
      writeBrowserPreference(AI_DEPTH_KEY, JSON.stringify(next));
      return next;
    });
  };
  const request = useMemo(() => preview?.isValid && actionAvailable && !promptTooShort ? { ...preview.envelope, reasoningDepth: effectiveDepth } : null, [preview, effectiveDepth, actionAvailable, promptTooShort]);
  const requestSignature = request ? JSON.stringify([request, reviewContextKey]) : null;
  const reviewIsStale = Boolean(result && (!request || result.targetId !== request.targetId || result.targetType !== request.targetType
    || result.action !== action || reviewedRequest.current !== requestSignature));
  const activeSuggestedPrompts = suggestedPrompts.length ? suggestedPrompts : CONTEXTUAL_AI_SUGGESTED_PROMPTS[action];
  const target = rawEnvelope ?? (actions[0] && buildEnvelope(actions[0]));
  const promptCopy = target ? contextualPromptCopy[target.targetType] : null;
  const contextDeskKey = showDeskFiling && target?.targetId && CONTEXT_DESK_TYPES.some(type => type === target.targetType)
    ? `${target.targetType}:${target.targetId}`
    : null;

  const reviewedContent = () => {
    if (clarification) return '';
    if (!result || !reviewItems.length) return editedContent.trim();
    return serializeAiReviewItems(result.action, reviewItems.filter((item) => (item.status === 'kept' || item.status === 'edited') && item.content.trim()));
  };
  const selectedReviewCount = reviewItems.filter((item) => (item.status === 'kept' || item.status === 'edited') && item.content.trim()).length;
  const reviewedItemCount = reviewItems.filter((item) => item.status !== 'unreviewed').length;
  const focusedItemIndex = Math.max(0, reviewItems.findIndex((item) => item.id === focusedItemId));
  const focusedItem = reviewItems[focusedItemIndex] || null;
  const reviewItemLabel = result ? CONTEXTUAL_AI_REVIEW[result.action].itemName : 'item';
  const destinationControl = typeof acceptDestination === 'function'
    ? preview && !reviewIsStale ? acceptDestination(preview.included) : null
    : acceptDestination;

  useLayoutEffect(() => {
    if (!focusReviewHeading.current) return;
    focusReviewHeading.current = false;
    focusedReviewHeading.current?.focus();
  }, [focusedItemId, reviewMode]);

  const cancelRequest = useCallback(() => {
    const pending = requestRef.current;
    requestRef.current = null;
    pending?.controller.abort();
    setLoading(false);
  }, []);

  useLayoutEffect(() => {
    if (requestRef.current && requestRef.current.signature !== requestSignature) {
      cancelRequest();
    }
  }, [cancelRequest, requestSignature]);

  const hasHistoryAccess = itemHistory !== undefined;
  if (!open && (!enabled || actions.length === 0) && !hasHistoryAccess && !(contextDeskKey && workspaceKey)) return null;

  const run = async () => {
    if (!request || !requestSignature || requestRef.current) return;
    const controller = new AbortController();
    const pending = { controller, signature: requestSignature };
    requestRef.current = pending;
    const timeout = window.setTimeout(() => controller.abort(new Error('Assistance timed out. Please try again.')), 90_000);
    setLoading(true);
    setRequestError('');
    setResult(null);
    try {
      const next = await requestContextualAi(request, controller.signal);
      if (requestRef.current !== pending) return;
      controller.signal.throwIfAborted();
      reviewedRequest.current = requestSignature;
      const id = crypto.randomUUID();
      setResult({ ...next, reviewId: id, userPromptAtGeneration: request.userPrompt });
      if (itemHistory !== undefined) {
        void saveExchange(assistanceExchange(request, next, id)).catch(() => toast({
          variant: 'destructive', title: 'Exchange not saved to assistance history',
          description: 'The response is still available in this review.',
        }));
      }
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
      if (requestRef.current !== pending) return;
      setRequestError(error instanceof Error ? error.message : 'Try again later. Your data was not changed.');
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === pending) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const accept = async () => {
    const acceptedContent = reviewedContent();
    if (!result || !acceptedContent || !onAccept || !preview || acceptLock.current) return;
    if (reviewIsStale) return;
    acceptLock.current = true;
    setAccepting(true);
    try {
      await onAccept(result, acceptedContent, preview.included);
      toast({ title: 'Reviewed result applied', description: 'The reviewed text was applied through this item\'s normal editing flow.' });
      if (itemHistory !== undefined) setHistoryView('applied');
      else setOpen(false);
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
  const staleReviewNotice = reviewIsStale && (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-y border-border bg-surface px-4 py-2 sm:px-6">
      <p role="status" className="min-w-0 flex-1 text-sm text-muted-foreground">
        {!enabled
          ? 'AI assistance is off. Copy any edits you want to keep before dismissing this review.'
          : 'The context changed. Copy any edits you want to keep, then dismiss this review and run assistance again.'}
      </p>
      {onAccept && <Button type="button" variant="outline" size="sm" onClick={copyResult} disabled={reviewItems.length ? !selectedReviewCount : !editedContent.trim()}>
        <ClipboardCopy aria-hidden="true" /> Copy reviewed text
      </Button>}
    </div>
  );

  const updateReviewItem = (id: string, updates: Partial<ReviewItemState>) => {
    const choosingChallenge = result?.action === 'generate_position_counterargument' && (updates.status === 'kept' || updates.status === 'edited');
    setReviewItems((current) => current.map((item) => item.id === id ? { ...item, ...updates }
      : choosingChallenge && (item.status === 'edited' || item.status === 'kept') ? { ...item, status: 'unreviewed' } : item));
  };

  const focusReviewItem = (id: string, enterFocus = false) => {
    if (enterFocus) focusReviewHeading.current = true;
    setFocusedItemId(id);
    if (enterFocus) setReviewMode('focus');
  };

  const moveFocus = (direction: -1 | 1) => {
    if (!reviewItems.length) return;
    const nextIndex = Math.min(reviewItems.length - 1, Math.max(0, focusedItemIndex + direction));
    if (nextIndex === focusedItemIndex) return;
    focusReviewHeading.current = true;
    setFocusedItemId(reviewItems[nextIndex]?.id || null);
  };

  const renderFocusedReview = () => {
    if (!result || !focusedItem) return null;
    const itemNumber = focusedItemIndex + 1;
    const dismissed = focusedItem.status === 'dismissed';
    return (
      <section key={focusedItem.id} className="flex h-full min-h-0 flex-col max-sm:[@media(max-height:600px)]:block max-sm:[@media(max-height:600px)]:overflow-y-auto max-sm:[@media(max-height:600px)]:overscroll-contain" aria-label={`Focused ${reviewItemLabel} review`}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 max-sm:[@media(max-height:600px)]:py-2">
          <div className="min-w-0">
            <div className="noesis-eyebrow font-bold text-muted-foreground">
              {reviewItemLabel} {itemNumber} of {reviewItems.length}
            </div>
            <h3 ref={focusedReviewHeading} tabIndex={-1} className="mt-2 break-words text-lg font-semibold leading-snug text-foreground">{formattedInline(focusedItem.title)}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-label font-medium capitalize text-muted-foreground">
            {focusedItem.status}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 max-sm:[@media(max-height:600px)]:overflow-visible max-sm:[@media(max-height:600px)]:py-2">
          <label htmlFor={`${promptId}-focused-review`} className="text-xs font-medium text-muted-foreground">Review and revise</label>
          <Textarea
            ref={focusedEditor}
            id={`${promptId}-focused-review`}
            value={focusedItem.content}
            disabled={accepting || dismissed}
            onChange={(event) => updateReviewItem(focusedItem.id, { content: event.target.value, status: 'edited' })}
            className="mt-2 min-h-[180px] resize-y bg-transparent text-base leading-7 sm:min-h-[220px]"
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
            <Button type="button" aria-pressed={focusedItem.status === 'kept'} variant={focusedItem.status === 'kept' ? 'default' : 'outline'} disabled={accepting || dismissed} onClick={() => updateReviewItem(focusedItem.id, { status: 'kept' })} className="min-h-11 [&_svg]:hidden min-[380px]:[&_svg]:inline">
              <Check className="mr-2 size-4" /> Keep
            </Button>
            <Button type="button" variant={focusedItem.status === 'edited' ? 'secondary' : 'outline'} disabled={accepting || dismissed} onClick={() => focusedEditor.current?.focus()} className="min-h-11 [&_svg]:hidden min-[380px]:[&_svg]:inline">
              <Pencil className="mr-2 size-4" /> Edit
            </Button>
            <Button type="button" variant={dismissed ? 'secondary' : 'outline'} disabled={accepting} onClick={() => updateReviewItem(focusedItem.id, { status: dismissed ? 'unreviewed' : 'dismissed' })} className="min-h-11 [&_svg]:hidden min-[380px]:[&_svg]:inline">
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


  const changeOpen = (next: boolean) => {
    if (acceptLock.current) return;
    setOpen(next);
    if (!next) {
      cancelRequest();
      setHiddenContext(new Set());
      setRequestError('');
      setResult(null);
      setEditedContent('');
      setEditingResult(false);
      setReviewItems([]);
      setFocusedItemId(null);
      setReviewMode('overview');
      const opener = dialogOpener.current;
      dialogOpener.current = null;
      if (opener?.isConnected && !opener.closest('[inert]')) window.requestAnimationFrame(() => opener.focus({ preventScroll: true }));
    }
  };

  const contextRows = (group: MemoryGroup, lines: string[]) => (
    <ul className="mt-2 divide-y divide-border/70 text-sm leading-6 text-muted-foreground">
      {lines.map((line, index) => {
        const key = aiExcerptKey(group, index, line);
        const hidden = hiddenContext.has(key);
        const label = `${group === 'itemMemory' ? 'current' : group === 'linkedMemory' ? 'linked' : 'comparison'} excerpt ${index + 1}`;
        return (
          <li key={key} className="flex min-w-0 items-start gap-2 py-1.5">
            <p className="min-w-0 flex-1 whitespace-pre-wrap break-words py-2">{hidden ? `Excerpt ${index + 1} hidden · not sent` : line}</p>
            <IconButton type="button" variant="ghost" label={hidden ? `Include ${label}` : `Hide ${label}`} aria-pressed={hidden} disabled={loading || accepting} onClick={() => {
              setHiddenContext(current => {
                const next = new Set(current);
                if (hidden) next.delete(key); else next.add(key);
                return next;
              });
              setRequestError('');
            }}>{hidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</IconButton>
          </li>
        );
      })}
    </ul>
  );

  return (
    <span className="noesis-aidock-anchor" data-open={open || undefined}>
      <span className="noesis-aidock">
        {((enabled && actions.length > 0) || hasHistoryAccess) && <Button variant="outline" size={iconOnly ? 'icon' : 'sm'} className={iconOnly ? 'noesis-ai-trigger noesis-ai-trigger--mark' : 'noesis-ai-trigger'} aria-haspopup="dialog" aria-expanded={open} aria-label={iconOnly ? 'Ask Noesis' : undefined} title={iconOnly ? 'Ask Noesis' : undefined} onClick={(event) => { dialogOpener.current = event.currentTarget; setHiddenContext(new Set()); setHistoryView(!enabled ? 'exchanges' : 'assist'); setOpen(true); }}>
          <NoesisAiMark className={iconOnly ? 'size-5' : 'mr-2 size-5'} /> {!iconOnly && buttonLabel}
        </Button>}
        {contextDeskKey && <ContextDeskFiling recordKey={contextDeskKey} />}
      </span>
      <Dialog open={open} onOpenChange={changeOpen}>
        {/* Centred over the page. It used to open anchored under its button,
            which meant a panel this tall landed below the fold and had to be
            scrolled to — and being rendered in the page rather than a portal,
            it moved with whatever was scrolling behind it. */}
        {open && <DialogContent
          ref={inlinePanel}
          tabIndex={-1}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); changeOpen(false); } }}
          className="noesis-ai-inline noesis-ai-dialog overflow-hidden p-0"
        >
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
                  <DialogTitle className="text-lg sm:text-xl">{historyView === 'exchanges' ? 'Assistance history' : showHistory ? 'Applied to item' : result ? 'Context Review' : 'Contextual Assistance'}</DialogTitle>
                  <DialogDescription className="mt-1 line-clamp-2 text-xs sm:text-sm">
                    {historyView === 'exchanges' ? 'Your questions and the original responses for this item.' : showHistory ? 'AI-assisted material saved to this item.' : result ? CONTEXTUAL_AI_REVIEW[result.action].guidance : hasHistoryAccess ? 'Questions and responses are saved in assistance history. Only what you approve is applied to this item.' : 'Choose a focused action. You can inspect the context before sending it.'}
                  </DialogDescription>
                </div>
                <Button type="button" variant="ghost" size="icon" className="ml-auto size-10 shrink-0" aria-label="Close Noesis assistance" onClick={() => changeOpen(false)}>
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
              {itemHistory !== undefined && <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Item assistance views">
                <Button type="button" size="sm" variant={showHistory ? 'ghost' : 'secondary'} aria-pressed={!showHistory} disabled={!enabled || accepting} onClick={() => setHistoryView('assist')}>Ask</Button>
                <Button type="button" size="sm" variant={historyView === 'exchanges' ? 'secondary' : 'ghost'} aria-pressed={historyView === 'exchanges'} disabled={loading || accepting} onClick={() => setHistoryView('exchanges')}>Assistance history</Button>
                <Button type="button" size="sm" variant={historyView === 'applied' ? 'secondary' : 'ghost'} aria-pressed={historyView === 'applied'} disabled={loading || accepting} onClick={() => setHistoryView('applied')}>Applied to item ({itemHistory.length})</Button>
              </div>}
            </DialogHeader>

            {!showHistory && staleReviewNotice}

            {historyView === 'exchanges' ? <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {target ? <AssistanceHistory itemKey={target.targetType + ':' + target.targetId} /> : <p>No item is selected for this action.</p>}
            </section> : showHistory && itemHistory !== undefined ? (
              <section aria-label="Saved AI reviews" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {!itemHistory.length && <p className="text-sm text-muted-foreground">No AI reviews saved to this item yet. Suggestions appear here only after you accept them.</p>}
                {itemHistory.map(entry => <details key={entry.id} className="border-b border-border py-2">
                  <summary className="cursor-pointer py-2 text-sm font-semibold">{entry.title} <time dateTime={entry.date} className="ml-2 font-normal text-muted-foreground">{Number.isFinite(Date.parse(entry.date)) ? new Date(entry.date).toLocaleDateString() : entry.date}</time></summary>
                  <ContextualAiDocument content={entry.content} />
                </details>)}
              </section>
            ) : clarification ? <section className="space-y-3 overflow-y-auto p-5"><h3 className="font-semibold">One question before suggesting challenges</h3>
              <ContextualAiDocument content={clarification} />
              <Button onClick={() => { setResult(null); setReviewItems([]); setUserPrompt((userPrompt.trim() + '\n' + clarification + '\nMy response: ').trimStart().slice(0, AI_USER_PROMPT_LIMIT)); requestAnimationFrame(() => document.getElementById(promptId)?.focus()); }}>Add my answer</Button>
            </section> : !result ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
                <div className="mx-auto max-w-3xl space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor={`${promptId}-action`}>{actionPromptLabel || promptCopy?.action || 'What should Noesis examine?'}</label>
                    <Select value={action} disabled={loading || accepting} onValueChange={(value) => { setAction(value as ContextualAiAction); setResult(null); setReviewItems([]); setFocusedItemId(null); }}>
                    <SelectTrigger id={`${promptId}-action`} className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {actions.map((item) => <SelectItem key={item} value={item}>{CONTEXTUAL_AI_LABELS[item]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-foreground">How deep should it go?</legend>
                    <div className="noesis-ai-depth" role="radiogroup" aria-label="Reasoning depth">
                      {AI_DEPTHS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={effectiveDepth === option.id}
                          disabled={loading || accepting}
                          onClick={() => { chooseDepth(option.id); setResult(null); setReviewItems([]); setFocusedItemId(null); }}
                          className="noesis-ai-depth__option"
                        >
                          <span className="font-semibold">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.id === 'light' && action === 'generate_position_counterargument' ? 'Brief, unranked alternatives.' : option.hint}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Remembered for {CONTEXTUAL_AI_LABELS[action]} on this device. The default is set in Settings.</p>
                  </fieldset>

                  {(promptLabel || promptCopy) && !controlled && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor={promptId}>{promptLabel || promptCopy?.question}</label>
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
                        maxLength={AI_USER_PROMPT_LIMIT}
                        aria-invalid={promptTooShort}
                        aria-describedby={`${promptId}-guidance`}
                        onChange={(event) => setUserPrompt(event.target.value)}
                        placeholder={promptPlaceholder}
                        className="min-h-[120px] resize-y text-base leading-6"
                      />
                      <p id={`${promptId}-guidance`} className="text-xs leading-5 text-muted-foreground">
                        {promptTooShort ? 'Use at least two characters or leave the question blank.' : `${userPrompt.length.toLocaleString()} of ${AI_USER_PROMPT_LIMIT.toLocaleString()} characters`}
                      </p>
                    </div>
                  )}

                  {envelope && (
                    <details open={showContextBeforeSending} className="border-y border-border open:pb-4">
                      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-foreground">Context being sent</summary>
                      {envelope.userPrompt && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-foreground">Your question</div>
                          <p className="mt-2 whitespace-pre-wrap break-words border-l border-border pl-3 text-sm leading-6 text-muted-foreground">{envelope.userPrompt}</p>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">Visible excerpts are included. Hidden excerpts won’t be sent in this request.</p>
                      <div className="mt-3">
                        <div className="text-xs font-medium text-foreground">Current item</div>
                        {contextRows('itemMemory', envelope.itemMemory)}
                      </div>
                      {envelope.secondaryTarget && (
                        <div className="mt-4">
                          <div className="break-words text-xs font-medium text-foreground">Comparison position: {envelope.secondaryTarget.label}</div>
                          {contextRows('secondaryMemory', envelope.secondaryTarget.memory)}
                        </div>
                      )}
                      {!!envelope.linkedMemory.length && (
                        <details className="mt-4">
                          <summary className="min-h-11 cursor-pointer py-2 text-xs font-medium text-foreground">{envelope.linkedMemory.length} {envelope.targetType === 'context_desk' ? 'additional selected records' : 'linked context excerpts'}</summary>
                          {contextRows('linkedMemory', envelope.linkedMemory)}
                        </details>
                      )}
                    </details>
                  )}

                  {!envelope && action === 'compare_selected_positions' && (
                    <p className="border-l-2 border-destructive px-3 py-2 text-sm leading-6 text-muted-foreground" role="status">Select another position in the detail header before running this comparison.</p>
                  )}

                  <div className="sticky bottom-0 space-y-2 bg-background py-3">
                    {preview && !preview.isValid && hiddenContext.size > 0 && <p role="status" className="text-sm text-muted-foreground">Include at least one excerpt from each required part before running this action.</p>}
                    {!enabled && <p role="status" className="text-sm text-muted-foreground">AI assistance is off in Settings.</p>}
                    {requestError && <p role="alert" className="break-words text-sm text-destructive">{requestError}</p>}
                    <div className="flex flex-wrap gap-2">
                    <Button onClick={run} disabled={!request || loading} className="min-h-12 flex-1 text-sm">
                      {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {loading ? 'Reviewing selected context' : CONTEXTUAL_AI_LABELS[action]}
                    </Button>
                    {loading && <Button type="button" variant="outline" onClick={cancelRequest} className="min-h-12">Cancel request</Button>}
                    </div>
                  </div>
                </div>
              </div>
            ) : reviewItems.length ? (
              <>
                <div className={`shrink-0 border-b border-border px-4 py-3 sm:px-6 ${reviewMode === 'focus' ? 'max-sm:[@media(max-height:600px)]:hidden' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{CONTEXTUAL_AI_REVIEW[result.action].heading}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{reviewedItemCount} of {reviewItems.length} reviewed · {selectedReviewCount} selected to save</p>
                    </div>
                    <div className="flex rounded-md border border-border p-1" role="group" aria-label="Review display mode">
                      <Button type="button" size="sm" aria-pressed={reviewMode === 'overview'} variant={reviewMode === 'overview' ? 'secondary' : 'ghost'} onClick={() => setReviewMode('overview')} className="min-h-9 rounded-sm">
                        <LayoutList className="mr-2 size-4" /> Overview
                      </Button>
                      <Button type="button" size="sm" aria-pressed={reviewMode === 'focus'} variant={reviewMode === 'focus' ? 'secondary' : 'ghost'} onClick={() => { if (focusedItem) focusReviewItem(focusedItem.id, reviewMode !== 'focus'); }} className="min-h-9 rounded-sm">
                        <Eye className="mr-2 size-4" /> Focus
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  {reviewMode === 'focus' ? renderFocusedReview() : (
                    <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
                      <div className="min-h-0 overflow-y-auto border-border px-4 py-4 lg:border-r sm:px-6">
                        <div className="space-y-2" role="group" aria-label={`${reviewItemLabel}s to review`}>
                          {reviewItems.map((item, index) => {
                            const active = item.id === focusedItem?.id;
                            const dismissed = item.status === 'dismissed';
                            return (
                              <article key={item.id} className={`border-b border-border py-4 first:pt-0 ${dismissed ? 'opacity-60' : ''}`}>
                                <button type="button" onClick={() => focusReviewItem(item.id, !window.matchMedia('(min-width: 1024px)').matches)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-current={active ? 'true' : undefined}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="noesis-eyebrow font-bold text-muted-foreground">{reviewItemLabel} {index + 1}</div>
                                      <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{formattedInline(item.title)}</h3>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-label font-medium capitalize ${item.status === 'kept' ? 'border-accent/50 text-accent' : 'border-border text-muted-foreground'}`}>{item.status}</span>
                                  </div>
                                  <p className="noesis-voice-ai mt-2 line-clamp-3">{formattedInline(item.content)}</p>
                                </button>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Button type="button" aria-pressed={item.status === 'kept'} variant="outline" size="sm" disabled={accepting || dismissed} onClick={() => updateReviewItem(item.id, { status: 'kept' })} className="min-h-10"><Check className="mr-2 size-4" />Keep</Button>
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
                  {destinationControl}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between max-sm:[@media(max-height:600px)]:flex-row max-sm:[@media(max-height:600px)]:flex-wrap max-sm:[@media(max-height:600px)]:justify-between">
                    <Button variant="ghost" disabled={accepting} onClick={() => { setResult(null); setEditedContent(''); setEditingResult(false); setReviewItems([]); setFocusedItemId(null); setReviewMode('overview'); }} className="min-h-11 sm:w-auto">
                      <X className="mr-2 size-4" /> Dismiss review
                    </Button>
                    {onAccept ? (
                      <Button onClick={accept} disabled={reviewIsStale || accepting || selectedReviewCount === 0} className="min-h-11 sm:w-auto">
                        {accepting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />} {acceptLabel || `Save ${selectedReviewCount} ${reviewItemLabel}${selectedReviewCount === 1 ? '' : 's'}`}
                      </Button>
                    ) : (
                      <Button onClick={copyResult} disabled={!selectedReviewCount} className="min-h-11 sm:w-auto">
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
                  {destinationControl}
                  <div className="sticky bottom-0 flex flex-col-reverse gap-2 bg-background py-3 sm:flex-row sm:justify-end">
                    <Button variant="ghost" disabled={accepting} onClick={() => { setResult(null); setEditedContent(''); setEditingResult(false); }} className="min-h-11"><X className="mr-2 size-4" />Dismiss review</Button>
                    {onAccept ? (
                      <Button onClick={accept} disabled={reviewIsStale || accepting || !editedContent.trim()} className="min-h-11">{accepting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}{acceptLabel || 'Apply reviewed text'}</Button>
                    ) : (
                      <Button onClick={copyResult} disabled={!editedContent.trim()} className="min-h-11"><ClipboardCopy className="mr-2 size-4" />Copy text</Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>}
      </Dialog>
    </span>
  );
}
