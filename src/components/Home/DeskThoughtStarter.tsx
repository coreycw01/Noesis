"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NOESIS_SOLID_DESK_ICONS } from '@/lib/noesis-icons';
import { NoesisAiMark } from '@/components/ai/NoesisAiMark';
import { THOUGHT_DRAFT_LIMIT, thoughtDraftEnvelope } from '@/lib/contextual-ai';

const ThoughtSuggestion = dynamic(() => import('@/components/ai/ContextualAiPanel').then(module => module.ContextualAiDocument));

const destinations = [
  { kind: 'inquiry', label: 'Inquiry', cue: 'I have a question I want to answer.' },
  { kind: 'position', label: 'Position', cue: 'I have a stance I want to examine.' },
  { kind: 'concept', label: 'Concept', cue: 'I have an idea I want to define.' },
  { kind: 'experiment', label: 'Experiment', cue: 'I want to try something and see what happens.' },
  { kind: 'work', label: 'Work', cue: 'I want to write or develop this further.' },
] as const;

export type DeskThoughtKind = (typeof destinations)[number]['kind'];

export function DeskThoughtStarter({ onSave, aiEnabled }: { onSave: (kind: DeskThoughtKind, text: string, title: string) => Promise<void>; aiEnabled: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<DeskThoughtKind | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const aiRequest = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const options = useRef<HTMLFieldSetElement>(null);
  const thought = useRef<HTMLTextAreaElement>(null);
  const destination = destinations.find(item => item.kind === kind);
  useEffect(() => {
    if (open) (choosing ? options.current : thought.current)?.focus();
  }, [open, choosing]);
  useEffect(() => () => aiRequest.current?.abort(), []);

  function cancelAssistance() {
    aiRequest.current?.abort();
    aiRequest.current = null;
    setAsking(false);
  }

  async function askNoesis() {
    if (!aiEnabled || !text.trim() || aiRequest.current) return;
    const request = new AbortController();
    aiRequest.current = request;
    setAsking(true);
    setSuggestionError(false);
    try {
      const { requestContextualAi } = await import('@/lib/contextual-ai-client');
      const response = await requestContextualAi(thoughtDraftEnvelope(text), request.signal);
      if (!request.signal.aborted) setSuggestion(response.content);
    } catch {
      if (!request.signal.aborted) setSuggestionError(true);
    } finally {
      if (aiRequest.current === request) {
        aiRequest.current = null;
        setAsking(false);
      }
    }
  }

  async function save() {
    if (!kind || !text.trim() || (kind === 'concept' && !title.trim()) || lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(false);
    try {
      await onSave(kind, text.trim(), title.trim());
      setText('');
      setKind(null);
      setTitle('');
      setSuggestion('');
      setSuggestionError(false);
      setChoosing(false);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      if (lock.current) return;
      if (!next) cancelAssistance();
      setOpen(next);
    }}>
      <DialogTrigger asChild><Button type="button"><Plus className="size-4" aria-hidden="true" />Start with a real thought</Button></DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] !block overflow-y-auto" onOpenAutoFocus={event => {
        event.preventDefault();
        (choosing ? options.current : thought.current)?.focus();
      }}>
        <DialogHeader>
          <DialogTitle>{choosing ? 'Where does it belong?' : 'Start with a real thought'}</DialogTitle>
          <DialogDescription>{choosing ? 'Choose what you want to do with this thought.' : 'Write what’s on your mind. You don’t need a source to begin.'}</DialogDescription>
        </DialogHeader>
        <form className="mt-4 grid gap-4" onSubmit={event => {
          event.preventDefault();
          if (choosing) void save();
          else if (text.trim()) { cancelAssistance(); setChoosing(true); }
        }}>
          {choosing ? (
            <>
              <p className="line-clamp-2 break-words border-s-2 border-accent ps-3 text-sm italic text-muted-foreground">{text}</p>
              <fieldset ref={options} tabIndex={-1} disabled={saving} className="grid gap-2 outline-none" aria-label="Collection">
                {destinations.map(item => {
                  const Icon = NOESIS_SOLID_DESK_ICONS[item.kind === 'experiment' ? 'practice' : item.kind];
                  return (
                    <label key={item.kind} data-tone={item.kind === 'experiment' ? 'practice' : item.kind} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] border border-border px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                      <input type="radio" name={id} checked={kind === item.kind} onChange={() => { setKind(item.kind); setError(false); }} className="accent-[hsl(var(--accent))]" />
                      <Icon className="size-5 shrink-0 text-tone" aria-hidden="true" />
                      <span className="min-w-0"><strong className="block text-sm">{item.label}</strong><span className="block text-xs text-muted-foreground">{item.cue}</span></span>
                    </label>
                  );
                })}
              </fieldset>
              {kind && kind !== 'inquiry' && (
                <label className="grid gap-1.5 text-sm font-medium">
                  {kind === 'concept' ? 'Concept name' : 'Title (optional)'}
                  <Input maxLength={80} required={kind === 'concept'} value={title} onChange={event => setTitle(event.target.value)} disabled={saving} />
                </label>
              )}
              {error && <p role="alert" className="text-sm text-destructive">Your thought is still here. Try saving again.</p>}
              <div className="flex flex-wrap justify-between gap-2">
                <Button type="button" variant="ghost" disabled={saving} onClick={() => setChoosing(false)}><ArrowLeft className="size-4" aria-hidden="true" />Edit thought</Button>
                <Button type="submit" disabled={!destination || saving || (kind === 'concept' && !title.trim())}>{saving ? 'Saving...' : destination ? `Create ${destination.label.toLowerCase()}` : 'Create item'}</Button>
              </div>
            </>
          ) : (
            <>
              <label className="grid gap-2 text-sm font-medium">
                Your thought
                <Textarea ref={thought} rows={4} maxLength={THOUGHT_DRAFT_LIMIT} value={text} onChange={event => {
                  cancelAssistance();
                  setSuggestion('');
                  setSuggestionError(false);
                  setText(event.target.value);
                }} />
              </label>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {aiEnabled && <Button type="button" variant="outline" aria-describedby={`${id}-ai-context`}
                  disabled={!text.trim() || asking} onClick={() => void askNoesis()}>
                  <NoesisAiMark className="size-5" />{asking ? 'Asking Noesis...' : 'Ask Noesis'}
                </Button>}
                <Button type="submit" disabled={!text.trim()}>Continue<ArrowRight className="size-4" aria-hidden="true" /></Button>
              </div>
              {aiEnabled && <p id={`${id}-ai-context`} className="text-right text-xs text-muted-foreground">Optional. Only this thought is sent to Noesis AI.</p>}
              {aiEnabled && suggestionError && <p role="alert" className="text-sm text-muted-foreground">Noesis AI couldn't respond. You can still continue with your thought.</p>}
              {aiEnabled && suggestion && (
                <section aria-label="AI suggestion" aria-live="polite" className="min-w-0 space-y-2 border-s-2 border-border ps-3 [overflow-wrap:anywhere]">
                  <h3 className="text-sm font-semibold">AI suggestion</h3>
                  <ThoughtSuggestion content={suggestion} />
                </section>
              )}
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
