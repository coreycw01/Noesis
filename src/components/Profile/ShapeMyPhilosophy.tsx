"use client";

import { useContext, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NoesisWorkspaceKeyContext } from '@/lib/noesis-route-context';
import { readBrowserPreference, workspacePreferenceKey, writeBrowserPreference } from '@/lib/browser-preferences';
import {
  allProcessAnswers,
  CLEAN_QUESTIONS,
  EMPTY_PHILOSOPHY_PROCESS,
  fillQuestion,
  PHILOSOPHY_STEPS,
  philosophySurvey,
  recurringWords,
  SOCRATIC_QUESTIONS,
  splitWords,
  type PhilosophyProcessState,
  type PhilosophySurveyItem,
} from '@/lib/philosophy-process';
import type { Concept, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPE_TONE: Record<PhilosophySurveyItem['type'], string> = { position: 'claim', concept: 'examine', inquiry: 'examine', practice: 'act' };

function TypeTag({ type }: { type: PhilosophySurveyItem['type'] }) {
  return <span data-stage-tone={TYPE_TONE[type]} className="noesis-stage-badge inline-block border-l-2 pl-1.5 font-code text-[9px] font-bold uppercase tracking-[0.14em]">{type}</span>;
}

/**
 * Shape My Philosophy, as a six-step guided process. Noesis asks; the person
 * answers. Progress is kept on this device until the person saves the
 * statement they wrote, which is stored exactly as written.
 */
export function ShapeMyPhilosophy({ positions, concepts, inquiries, practices, links, initialStatement, onSaveStatement, onClose }: {
  positions: VaultEntry[];
  concepts: Concept[];
  inquiries: Question[];
  practices: Practice[];
  links: PhilosophicalLink[];
  initialStatement?: string;
  onSaveStatement: (statement: string) => Promise<void>;
  onClose: () => void;
}) {
  const workspaceKey = useContext(NoesisWorkspaceKeyContext);
  const storageKey = workspacePreferenceKey(workspaceKey, 'shape-my-philosophy');
  const [state, setState] = useState<PhilosophyProcessState>({ ...EMPTY_PHILOSOPHY_PROCESS, statement: initialStatement || '' });
  const [ladderDraft, setLadderDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = readBrowserPreference(storageKey);
      if (stored) setState({ ...EMPTY_PHILOSOPHY_PROCESS, ...(JSON.parse(stored) as Partial<PhilosophyProcessState>) });
    } catch { /* Start fresh if the stored draft is unreadable. */ }
  }, [storageKey]);

  const update = (change: (current: PhilosophyProcessState) => PhilosophyProcessState) => {
    setSaved(false);
    setState((current) => {
      const next = change(current);
      if (storageKey) writeBrowserPreference(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const survey = useMemo(() => philosophySurvey({ positions, concepts, inquiries, practices, links }), [positions, concepts, inquiries, practices, links]);
  const chosen = survey.filter((item) => state.picks[item.key] === 'yes');
  const focusOf = (item: PhilosophySurveyItem) => (state.focus[item.key]?.length ? state.focus[item.key].join(' ') : item.title);
  const threads = useMemo(() => recurringWords(allProcessAnswers(state)), [state]);
  const go = (step: number) => update((current) => ({ ...current, step }));
  const answer = (group: 'clean' | 'socratic', key: string, question: string, value: string) => update((current) => ({
    ...current,
    [group]: { ...current[group], [key]: { ...(current[group][key] || {}), [question]: value } },
  }));

  const step = state.step;
  return (
    <div className="noesis-philosophy-process space-y-5" data-stage-tone="integrate">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="noesis-stage-badge border-l-2 pl-2 font-code text-[10px] font-bold uppercase tracking-[0.16em]">Shape My Philosophy · a guided process</div>
        <div className="flex gap-2">
          {step > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => update(() => ({ ...EMPTY_PHILOSOPHY_PROCESS }))}>Start over</Button>}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
      <ol className="noesis-philosophy-steps" aria-label="Steps">
        {PHILOSOPHY_STEPS.map((label, index) => (
          <li key={label}>
            <button type="button" aria-current={index === step ? 'step' : undefined} disabled={index > 1 && !chosen.length} onClick={() => go(index)}>
              <span className="font-code text-[10px]">{index + 1}</span>{label}
            </button>
          </li>
        ))}
      </ol>
      <p className="noesis-philosophy-rule">Noesis asks; you answer. It uses your exact words, never paraphrases you, and never adds an interpretation without asking first. It will not write your philosophy for you.</p>

      {step === 0 && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">Noesis looked through your workspace for what appears most often in your thinking. These are counts and facts, not judgements about what matters.</p>
          {survey.map((item) => (
            <div key={item.key} className="noesis-philosophy-item">
              <TypeTag type={item.type} />
              <p className="font-headline text-lg italic leading-snug">“{item.words}”</p>
              <p className="text-xs text-muted-foreground">{item.facts.join(' · ')}</p>
            </div>
          ))}
          {!survey.length && <p className="text-sm text-muted-foreground">There is not enough recorded yet. Add a position, define a concept, or open an inquiry first.</p>}
          <Button type="button" onClick={() => go(1)} disabled={!survey.length}>Choose what belongs</Button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">Which of these belong in your philosophy? There is no right answer. “Not sure” is fine and will not be used.</p>
          {survey.map((item) => (
            <div key={item.key} className="noesis-philosophy-item">
              <TypeTag type={item.type} />
              <p className="font-headline text-lg italic leading-snug">“{item.words}”</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Does “${item.title}” belong?`}>
                {([['yes', 'Belongs'], ['unsure', 'Not sure'], ['no', 'Not part of it']] as const).map(([value, label]) => (
                  <Button key={value} type="button" size="sm" role="radio" aria-checked={state.picks[item.key] === value} variant={state.picks[item.key] === value ? 'default' : 'outline'} className="rounded-full" onClick={() => update((current) => ({ ...current, picks: { ...current.picks, [item.key]: value } }))}>{label}</Button>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" onClick={() => go(2)} disabled={!chosen.length}>Clarify {chosen.length} item{chosen.length === 1 ? '' : 's'}</Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">For each item, tap the word or words that matter most to you. Noesis builds its questions only from those words.</p>
          {chosen.map((item) => {
            const picked = state.focus[item.key] || [];
            const focus = focusOf(item);
            return (
              <div key={item.key} className="noesis-philosophy-item">
                <TypeTag type={item.type} />
                <div className="flex flex-wrap gap-1.5">
                  {splitWords(item.words).map((word, index) => (
                    <button key={`${word}-${index}`} type="button" aria-pressed={picked.includes(word)} className="noesis-philosophy-word" onClick={() => update((current) => {
                      const list = current.focus[item.key] || [];
                      return { ...current, focus: { ...current.focus, [item.key]: list.includes(word) ? list.filter((value) => value !== word) : [...list, word] } };
                    })}>{word}</button>
                  ))}
                </div>
                {CLEAN_QUESTIONS.map(([key, template]) => (
                  <label key={key} className="grid gap-1.5">
                    <span className="text-sm">{fillQuestion(template, focus)}</span>
                    <Textarea value={state.clean[item.key]?.[key] || ''} onChange={(event) => answer('clean', item.key, key, event.target.value)} placeholder="Answer in your own words, or leave blank." className="min-h-16" />
                  </label>
                ))}
              </div>
            );
          })}
          <Button type="button" onClick={() => go(3)}>Go deeper</Button>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">Why does each one matter to you? Keep answering “and why does that matter?” until it stops making sense to ask. The last answer is usually closest to what you value.</p>
          {chosen.map((item) => {
            const rungs = state.ladder[item.key] || [];
            const last = rungs[rungs.length - 1];
            const done = state.ladderDone[item.key];
            return (
              <div key={item.key} className="noesis-philosophy-item">
                <p className="font-headline text-lg italic">“{item.words}”</p>
                {rungs.length > 0 && (
                  <ol className="noesis-philosophy-ladder">
                    {rungs.map((rung, index) => (
                      <li key={index}>
                        <span className="text-xs text-muted-foreground">{index === 0 ? 'Why does this matter to you?' : `And why does “${rungs[index - 1]}” matter to you?`}</span>
                        <span className="font-medium">{rung}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {done ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Check className="size-4 text-[hsl(var(--stage-act))]" aria-hidden="true" /> Bottom rung: “{last}”
                    <Button type="button" variant="ghost" size="sm" onClick={() => update((current) => ({ ...current, ladderDone: { ...current.ladderDone, [item.key]: false } }))}>Keep going</Button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <label className="grid gap-1.5">
                      <span className="text-sm">{last ? `And why does “${last}” matter to you?` : 'Why does this matter to you?'}</span>
                      <Textarea value={ladderDraft[item.key] || ''} onChange={(event) => setLadderDraft((current) => ({ ...current, [item.key]: event.target.value }))} placeholder="Your answer" className="min-h-16" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={!ladderDraft[item.key]?.trim()} onClick={() => {
                        const text = ladderDraft[item.key]?.trim();
                        if (!text) return;
                        update((current) => ({ ...current, ladder: { ...current.ladder, [item.key]: [...(current.ladder[item.key] || []), text] } }));
                        setLadderDraft((current) => ({ ...current, [item.key]: '' }));
                      }}>Add rung</Button>
                      {rungs.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => update((current) => ({ ...current, ladderDone: { ...current.ladderDone, [item.key]: true } }))}>That’s as far down as it goes</Button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Button type="button" onClick={() => go(4)}>Examine (optional)</Button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">Optional. These questions test what you have said; they do not answer it. Skip any you like.</p>
          {chosen.map((item) => (
            <div key={item.key} className="noesis-philosophy-item">
              <p className="font-headline text-lg italic">“{item.words}”</p>
              {SOCRATIC_QUESTIONS.map(([kind, template]) => (
                <label key={kind} className="grid gap-1.5">
                  <span className="text-sm"><b className="noesis-stage-badge font-code text-[10px] uppercase tracking-[0.12em]">{kind}</b> · {fillQuestion(template, focusOf(item), item.words)}</span>
                  <Textarea value={state.socratic[item.key]?.[kind] || ''} onChange={(event) => answer('socratic', item.key, kind, event.target.value)} placeholder="Optional" className="min-h-14" />
                </label>
              ))}
            </div>
          ))}
          <Button type="button" onClick={() => go(5)}>Put it in your words</Button>
        </section>
      )}

      {step === 5 && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Everything here is what <b>you</b> said, quoted exactly. Noesis has not summarised it.</p>
            {chosen.map((item) => {
              const rungs = state.ladder[item.key] || [];
              const quotes = [...Object.values(state.clean[item.key] || {}), ...Object.values(state.socratic[item.key] || {})].filter((text) => text.trim());
              return (
                <div key={item.key} className="noesis-philosophy-item">
                  <TypeTag type={item.type} />
                  <p className="font-headline text-base italic">“{item.words}”</p>
                  {rungs.length > 0 && <p className="text-xs text-muted-foreground">Bottom rung: <span className="font-medium text-foreground">“{rungs[rungs.length - 1]}”</span></p>}
                  {quotes.map((quote, index) => <p key={index} className="border-l-2 border-border pl-3 text-sm">“{quote}”</p>)}
                </div>
              );
            })}
          </div>
          <div className="noesis-philosophy-item h-fit space-y-3">
            <div className="font-code text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your working statement · written by you</div>
            {threads.length > 0 && (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <b>A question, not a conclusion:</b> you used {threads.map(([word, count]) => `“${word}” (${count}×)`).join(', ')} in more than one answer. Is that a thread in your philosophy, or a coincidence? Only you can say.
              </p>
            )}
            <Textarea value={state.statement} onChange={(event) => update((current) => ({ ...current, statement: event.target.value }))} placeholder="Write it in your own words. Borrow your quotes if they fit." className="min-h-[9rem]" />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" disabled={!state.statement.trim() || saving} onClick={async () => {
                setSaving(true);
                try { await onSaveStatement(state.statement.trim()); setSaved(true); } finally { setSaving(false); }
              }}>{saving ? 'Saving' : 'Save as my working statement'}</Button>
              <span className={cn('text-xs', saved ? 'text-foreground' : 'text-muted-foreground')}>{saved ? 'Saved exactly as written.' : 'Saved as written. Noesis will not edit it.'}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
