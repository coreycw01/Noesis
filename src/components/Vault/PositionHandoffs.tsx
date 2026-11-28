'use client';

import { useRef, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Tool } from '@/components/shared/record/RecordParts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { inquiryExperimentSetup, isInquiryClosed } from '@/lib/inquiry-state';
import { NOESIS_ICONS } from '@/lib/noesis-icons';
import { conceptKey } from '@/lib/readex';
import { noesisUserError } from '@/lib/user-facing-errors';
import type { Concept, Draft, Practice, Question, VaultEntry } from '@/lib/types';

interface PositionHandoffsProps {
  position: VaultEntry;
  inquiries: Question[];
  concepts: Concept[];
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onAddQuestion: (data: Partial<Question>) => Promise<Question>;
  onUpdateQuestion: (question: Question) => void | Promise<void>;
  onOpenPractice?: (id: string) => void;
  onOpenWork?: (id: string) => void;
  onOpenQuestion?: (id: string) => void;
}

export function PositionHandoffs({
  position, inquiries, concepts, onAddPractice, onAddDraft, onAddQuestion, onUpdateQuestion,
  onOpenPractice, onOpenWork, onOpenQuestion,
}: PositionHandoffsProps) {
  const { toast } = useToast();
  const saveLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [experiment, setExperiment] = useState({ action: '', prediction: '', measure: '' });
  const [question, setQuestion] = useState('');
  const claim = position.statement?.trim() || position.title;
  const sourceIds = position.sourceIds || [];
  const conceptTags = position.tags || [];
  const experimentSetup = inquiryExperimentSetup(experiment, claim);

  const run = async (action: string, save: () => Promise<void>) => {
    if (saveLock.current) return;
    saveLock.current = true;
    setBusy(true);
    try { await save(); }
    catch (error) {
      toast({ title: 'Change not saved', description: noesisUserError(error, action), variant: 'destructive' });
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Tool label="Design an experiment" icon={FlaskConical} tone="practice">
        <form className="grid min-w-0 gap-3" onSubmit={event => {
          event.preventDefault();
          if (!experimentSetup) return;
          void run('draft this experiment', async () => {
            const created = await onAddPractice({
              ...experimentSetup, title: `Test: ${position.title.slice(0, 72)}`, description: claim,
              type: 'experiment', status: 'proposed', durationMode: 'repeated', durationDays: 7,
              positionIds: [position.id], sourceIds, conceptTags,
            });
            setExperiment({ action: '', prediction: '', measure: '' });
            onOpenPractice?.(created.id);
          });
        }}>
          {([['action', 'What will you try?'], ['prediction', 'What do you expect to happen?'], ['measure', 'What will you look for?']] as const).map(([field, label]) => (
            <label key={field} className="grid min-w-0 gap-1 text-sm">{label}
              <Textarea value={experiment[field]} maxLength={600} disabled={busy} onChange={event => setExperiment(current => ({ ...current, [field]: event.target.value }))} />
            </label>
          ))}
          {inquiryExperimentSetup(experiment) && !experimentSetup && <p className="text-sm text-muted-foreground">Describe a concrete action and prediction rather than repeating the claim.</p>}
          <Button type="submit" variant="secondary" tone="practice" className="justify-self-start" disabled={busy || !experimentSetup}>Draft experiment</Button>
        </form>
      </Tool>
      <Tool label="Draft a work" icon={NOESIS_ICONS.work} tone="work">
        <p className="text-sm text-muted-foreground">Starts a linked draft with your position statement.</p>
        <Button type="button" variant="secondary" size="sm" tone="work" disabled={busy} onClick={() => void run('start this draft', async () => {
          const created = await onAddDraft({
            title: position.title, body: claim, type: 'essay', status: 'seed',
            beliefIds: [position.id], sourceIds, conceptTags,
          });
          onOpenWork?.(created.id);
        })}>Start draft</Button>
      </Tool>
      <Tool label="Form an inquiry" icon={NOESIS_ICONS.inquiry} tone="inquiry">
        {inquiries.length > 0 && (
          <ul className="grid gap-2">
            {inquiries.map(inquiry => {
              const closed = isInquiryClosed(inquiry);
              return (
                <li key={inquiry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <span className="min-w-0 break-words text-sm">{inquiry.text}</span>
                  <Button type="button" variant="outline" size="sm" tone="inquiry" disabled={busy} onClick={() => {
                    if (!closed) { onOpenQuestion?.(inquiry.id); return; }
                    void run('reopen this inquiry', async () => {
                      await onUpdateQuestion({ ...inquiry, status: 'reopened' });
                      onOpenQuestion?.(inquiry.id);
                    });
                  }}>{closed ? 'Reopen inquiry' : 'Continue inquiry'}</Button>
                </li>
              );
            })}
          </ul>
        )}
        <form className="grid gap-2" onSubmit={event => {
          event.preventDefault();
          if (!question.trim()) return;
          void run('start this inquiry', async () => {
            const names = new Set(conceptTags.map(conceptKey));
            const created = await onAddQuestion({
              text: question.trim(), status: 'open', beliefIds: [position.id], sourceIds,
              conceptIds: concepts.filter(concept => names.has(conceptKey(concept.name))).map(concept => concept.id),
            });
            setQuestion('');
            onOpenQuestion?.(created.id);
          });
        }}>
          <label className="grid min-w-0 gap-1 text-sm">New follow-up question
            <Textarea value={question} maxLength={1000} disabled={busy} onChange={event => setQuestion(event.target.value)} />
          </label>
          <Button type="submit" size="sm" variant="secondary" tone="inquiry" className="justify-self-start" disabled={busy || !question.trim()}>Start inquiry</Button>
        </form>
      </Tool>
    </>
  );
}
