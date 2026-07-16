
"use client";

import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Edit, Plus, Repeat, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { NextPhilosophicalActionPanel } from '@/components/Philosophy/NextPhilosophicalActionPanel';
import type { Concept, Draft, Media, PhilosophicalLink, Practice, PracticeStatus, PracticeType, Question, VaultEntry } from '@/lib/types';
import { allQuestions, normalizeConceptTags, PRACTICE_LABELS, today } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';

interface PracticesWorkspaceProps {
  practices: Practice[];
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  onAddPractice: (data: Partial<Practice>) => void;
  onUpdatePractice: (practice: Practice) => void;
  onDeletePractice: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  focusedPracticeId?: string | null;
  onOpenPracticeRoute?: (id: string | null) => void;
}

const practiceTypes: PracticeType[] = ['habit', 'experiment', 'discipline', 'reflection_prompt', 'commitment', 'observation', 'rule', 'challenge'];
const statuses: PracticeStatus[] = ['proposed', 'planned', 'active', 'completed', 'failed', 'integrated', 'paused', 'abandoned'];

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function currentStreak(logDates?: string[]) {
  const logged = new Set((logDates || []).map((date) => date.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = dateKey(cursor);
    if (!logged.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function practiceExperimentShape(practice: Practice, linkedQuestions: Question[], linkedPositions: VaultEntry[]) {
  const hasBasis = linkedPositions.length > 0 || linkedQuestions.length > 0 || (practice.conceptTags || []).length > 0 || (practice.sourceIds || []).length > 0;
  const logCount = (practice.logDates || []).length;
  const concluded = ['completed', 'failed', 'integrated', 'abandoned'].includes(practice.status);
  const needsOutcome = concluded && !practice.notes?.trim();
  const hypothesis = linkedPositions[0]
    ? `If this is lived seriously, it should test: ${linkedPositions[0].title}`
    : linkedQuestions[0]
      ? `This practice should produce evidence for: ${linkedQuestions[0].text}`
      : 'State the position, inquiry, or concept this behavior is meant to test.';
  const observation = logCount
    ? `${logCount} logged observation${logCount === 1 ? '' : 's'} available for review.`
    : 'No observations logged yet. A practice becomes evidence only after contact with reality.';
  const nextStep = needsOutcome
    ? 'Write the conclusion review: what happened, what changed, and whether the tested idea survived.'
    : !hasBasis
      ? 'Link the practice to a position, inquiry, source, or concept so it has an intellectual basis.'
      : logCount === 0 && practice.status === 'active'
        ? 'Log the first result so this stops being an intention and becomes evidence.'
        : practice.status === 'planned' || practice.status === 'proposed'
          ? 'Activate the practice when the method and observation criteria are clear.'
          : practice.status === 'active'
            ? 'Keep logging observations until a pattern is visible.'
            : 'Compare expected outcome with observed outcome and update the related thinking.';

  return { hypothesis, observation, nextStep, needsOutcome, hasBasis, logCount };
}

export function PracticesWorkspace({ practices, concepts, media, questions, positions, drafts, onAddPractice, onUpdatePractice, onDeletePractice, onAddConcept, onCreateLink, focusedPracticeId, onOpenPracticeRoute }: PracticesWorkspaceProps) {
  const [statusFilter, setStatusFilter] = useState<PracticeStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PracticeType | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Practice>>({ title: '', description: '', type: 'experiment', status: 'planned', durationDays: 7, conceptTags: [] });
  const questionList = useMemo(() => allQuestions(media, questions), [media, questions]);
  const activePractices = practices.filter((practice) => practice.status === 'active' || practice.status === 'planned');
  const filtered = practices.filter((practice) => (statusFilter === 'all' || practice.status === statusFilter) && (typeFilter === 'all' || practice.type === typeFilter));
  const practiceStats = useMemo(() => ({
    total: practices.length,
    active: practices.filter((practice) => practice.status === 'active').length,
    planned: practices.filter((practice) => practice.status === 'planned').length,
    testedPositions: new Set(practices.flatMap((practice) => practice.positionIds || [])).size,
  }), [practices]);

  const clearPracticeFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const practiceFiltersActive = statusFilter !== 'all' || typeFilter !== 'all';

  const openEditor = (practice?: Practice) => {
    setDraft(practice ? { ...practice } : { title: '', description: '', type: 'experiment', status: 'planned', durationDays: 7, startDate: today().slice(0, 10), endDate: '', conceptTags: [] });
    setEditorOpen(true);
  };

  React.useEffect(() => {
    if (!focusedPracticeId) return;
    const focused = practices.find((practice) => practice.id === focusedPracticeId);
    if (focused) openEditor(focused);
  }, [focusedPracticeId, practices]);

  const handleSave = () => {
    if (!draft.title?.trim()) return;
    const payload = { ...draft, conceptTags: normalizeConceptTags(draft.conceptTags) };
    if (draft.id) onUpdatePractice(payload as Practice);
    else onAddPractice(payload);
    setEditorOpen(false);
    if (draft.id) onOpenPracticeRoute?.(draft.id);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-7xl mx-auto w-full font-body">
      <PageHeader
        title="Practices"
        description="Turn understanding into habits, experiments, disciplines, commitments, and lived tests."
        actions={
          <>
            <PracticeStat label="Total" value={practiceStats.total} />
            <PracticeStat label="Active" value={practiceStats.active} />
            <PracticeStat label="Planned" value={practiceStats.planned} />
            <PracticeStat label="Positions Tested" value={practiceStats.testedPositions} />
            <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 px-6 shadow-md shadow-accent/20 rounded-full h-9 font-bold">
              <Plus className="size-4 mr-1.5" /> NEW PRACTICE
            </Button>
          </>
        }
      />

      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Repeat className="size-4 text-accent" />
          <h2 className="font-headline text-2xl font-bold italic text-primary/80">Active Loop</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(activePractices.length ? activePractices : practices.slice(0, 3)).map((practice) => (
            <PracticeCard key={practice.id} practice={practice} questions={questionList} positions={positions} onEdit={() => { openEditor(practice); onOpenPracticeRoute?.(practice.id); }} onDelete={() => onDeletePractice(practice.id)} onUpdatePractice={onUpdatePractice} onCreateLink={onCreateLink} />
          ))}
          {!practices.length && (
            <Card className="p-12 border-dashed border-border/60 text-center md:col-span-2 xl:col-span-3 bg-muted/5 rounded-xl shadow-inner">
              <Repeat className="size-16 mx-auto mb-6 text-muted-foreground/30" />
              <h3 className="font-headline text-2xl italic mb-3 text-primary/60">No lived tests initiated</h3>
              <p className="max-w-sm mx-auto text-sm text-muted-foreground italic mb-8">What does your current understanding require of you? Create the first behavioral loop to find out.</p>
              <Button variant="outline" onClick={() => openEditor()} className="rounded-full px-8 font-bold border-border/60 shadow-sm bg-white">Initiate Practice</Button>
            </Card>
          )}
        </div>
      </section>

      <FilterToolbar
        resultCount={filtered.length}
        resultLabel="practices"
        onClear={clearPracticeFilters}
        clearDisabled={!practiceFiltersActive}
        className="mb-8"
      >
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PracticeStatus | 'all')}>
          <SelectTrigger className="w-48 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-white shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[9px] uppercase">All Statuses</SelectItem>
            {statuses.map((status) => <SelectItem key={status} value={status} className="font-code text-[9px] uppercase">{status}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as PracticeType | 'all')}>
          <SelectTrigger className="w-56 h-9 font-code text-[9px] uppercase tracking-widest rounded-full bg-white shadow-sm border-border/60 px-4 font-bold"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[9px] uppercase">All Practice Types</SelectItem>
            {practiceTypes.map((type) => <SelectItem key={type} value={type} className="font-code text-[9px] uppercase">{PRACTICE_LABELS[type]}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterToolbar>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((practice) => (
          <PracticeCard key={practice.id} practice={practice} questions={questionList} positions={positions} onEdit={() => { openEditor(practice); onOpenPracticeRoute?.(practice.id); }} onDelete={() => onDeletePractice(practice.id)} onUpdatePractice={onUpdatePractice} onCreateLink={onCreateLink} />
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <PageEmptyState
              icon={Repeat}
              title="No practices found"
              description="Clear filters or create a lived test that connects a position to behavior."
              action={practiceFiltersActive ? <Button variant="outline" onClick={clearPracticeFilters} className="rounded-full">Clear filters</Button> : <Button onClick={() => openEditor()} className="rounded-full"><Plus className="mr-1.5 size-4" /> New practice</Button>}
            />
          </div>
        )}
      </div>

      <PracticeEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open && focusedPracticeId) onOpenPracticeRoute?.(null);
        }}
        draft={draft}
        setDraft={setDraft}
        concepts={concepts}
        media={media}
        questions={questionList}
        positions={positions}
        drafts={drafts}
        onAddConcept={onAddConcept}
        onSave={handleSave}
      />
    </div>
  );
}

function PracticeStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-2 text-right shadow-sm">
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{label}</div>
      <div className="font-headline text-xl font-bold italic leading-none text-primary">{value}</div>
    </div>
  );
}

function PracticeCard({ practice, questions, positions, onEdit, onDelete, onUpdatePractice, onCreateLink }: {
  practice: Practice;
  questions: Question[];
  positions: VaultEntry[];
  onEdit: () => void;
  onDelete: () => void;
  onUpdatePractice: (practice: Practice) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
}) {
  const linkedQuestions = questions.filter((question) => (practice.questionIds || []).includes(question.id));
  const linkedPositions = positions.filter((position) => (practice.positionIds || []).includes(position.id));
  const firstLinkedPosition = linkedPositions[0];
  const todayKey = dateKey();
  const logDates = Array.from(new Set(practice.logDates || [])).sort();
  const hasLoggedToday = logDates.includes(todayKey);
  const streak = currentStreak(logDates);
  const experimentShape = practiceExperimentShape(practice, linkedQuestions, linkedPositions);
  const setStatus = (status: PracticeStatus) => onUpdatePractice({ ...practice, status, dateUpdated: today() });
  const logToday = () => onUpdatePractice({ ...practice, logDates: Array.from(new Set([...logDates, todayKey])), dateUpdated: today() });
  return (
    <Card className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-accent/20 bg-white/95 p-5 rounded-xl shadow-md">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/80 rounded-full font-bold px-2.5 py-0.5 shadow-sm">{PRACTICE_LABELS[practice.type]}</Badge>
            <Badge variant="outline" className="font-code text-[8px] uppercase tracking-widest border-border/60 bg-white shadow-sm rounded-full font-bold px-2.5 py-0.5 shadow-sm">{practice.status}</Badge>
          </div>
          <h3 className="font-headline text-xl font-bold italic leading-tight group-hover:text-accent transition-colors text-primary truncate">{practice.title}</h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive rounded-full" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="size-3.5" /></Button>
        </div>
      </div>
      
      <p className="text-[13px] leading-relaxed text-muted-foreground font-body line-clamp-2 italic mb-6">
        {practice.description || 'No requirement explicitly defined.'}
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <MiniStat label="DAYS" value={practice.durationDays || 0} />
        <MiniStat label="STREAK" value={`${streak}d`} />
        <MiniStat label="INQUIRIES" value={linkedQuestions.length} />
        <MiniStat label="POSITIONS" value={linkedPositions.length} />
      </div>

      <div className="mb-5 rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="size-3.5 text-accent" />
            <span className="font-code text-[8px] uppercase tracking-[0.22em] text-muted-foreground font-bold">Field Experiment</span>
          </div>
          <Badge variant={experimentShape.hasBasis ? 'outline' : 'secondary'} className="font-code text-[8px] uppercase tracking-widest rounded-full">
            {experimentShape.hasBasis ? 'basis linked' : 'needs basis'}
          </Badge>
        </div>
        <div className="grid gap-3 text-[12px] leading-relaxed">
          <div>
            <div className="font-code text-[7px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold mb-1">Hypothesis</div>
            <p className="text-primary/80 italic line-clamp-2">{experimentShape.hypothesis}</p>
          </div>
          <div>
            <div className="font-code text-[7px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold mb-1">Observation</div>
            <p className="text-muted-foreground italic line-clamp-2">{experimentShape.observation}</p>
          </div>
          <div className={cn("rounded-lg border p-3", experimentShape.needsOutcome ? "border-amber-300 bg-amber-50 text-amber-950" : "border-border/30 bg-white/70")}>
            <div className="flex items-start gap-2">
              <ClipboardList className="mt-0.5 size-3.5 shrink-0 text-accent" />
              <p className="text-[11px] leading-relaxed font-medium">{experimentShape.nextStep}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border/30">
        {(practice.conceptTags || []).slice(0, 4).map((tag) => (
          <Badge key={tag} variant="outline" className="font-code text-[8px] uppercase tracking-tighter bg-muted/10 border-transparent rounded-full font-bold shadow-sm">{tag}</Badge>
        ))}
      </div>

      <div className="mt-5">
        <NextPhilosophicalActionPanel
          compact
          status={practice.status}
          title="What does this test?"
          description="Practices close the loop by testing positions in lived behavior."
          actions={[
            {
              label: hasLoggedToday ? 'Logged' : 'Log Today',
              tone: 'support',
              disabled: hasLoggedToday,
              icon: <CheckCircle2 className="size-3" />,
              onClick: logToday,
            },
            {
              label: 'Activate',
              disabled: practice.status === 'active',
              onClick: () => setStatus('active'),
            },
            {
              label: 'Complete',
              tone: 'support',
              disabled: practice.status === 'completed',
              onClick: () => setStatus('completed'),
            },
            {
              label: 'Failed',
              tone: 'challenge',
              disabled: practice.status === 'failed',
              onClick: () => setStatus('failed'),
            },
            {
              label: 'Link Test',
              disabled: !firstLinkedPosition,
              description: firstLinkedPosition ? `Mark ${practice.title} as testing ${firstLinkedPosition.title}.` : 'Choose a linked position first.',
              onClick: () => firstLinkedPosition && onCreateLink({
                fromType: 'position',
                fromId: firstLinkedPosition.id,
                fromLabel: firstLinkedPosition.title,
                toType: 'practice',
                toId: practice.id,
                toLabel: practice.title,
                type: 'tested_by',
                note: 'Practice tests this position in lived behavior.',
              }),
            },
          ]}
        />
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3 text-center border border-border/10 shadow-sm">
      <div className="font-headline font-bold text-xl text-primary/80 leading-none mb-1">{value}</div>
      <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60 font-bold">{label}</div>
    </div>
  );
}

function PracticeEditor({ open, onOpenChange, draft, setDraft, concepts, media, questions, positions, drafts, onAddConcept, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Partial<Practice>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Practice>>>;
  concepts: Concept[];
  media: Media[];
  questions: Question[];
  positions: VaultEntry[];
  drafts: Draft[];
  onAddConcept: (data: Partial<Concept>) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto bg-white border-none shadow-2xl rounded-2xl p-0">
        <div className="p-8">
          <DialogHeader className="mb-8"><DialogTitle className="font-headline text-3xl italic">{draft.id ? 'Refine Practice' : 'Initiate Practice'}</DialogTitle></DialogHeader>
          <div className="space-y-8">
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="size-4 text-accent" />
                <h3 className="font-headline text-xl italic font-bold text-primary">Field Experiment Design</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground italic">
                A practice should name the idea being tested, the action required, the observation method, and the conclusion that would matter later.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="PRACTICE TITLE"><Input value={draft.title || ''} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="italic text-base rounded-full" /></Field>
              <Field label="DURATION (DAYS)"><Input type="number" min={0} value={draft.durationDays || 0} onChange={(event) => setDraft((prev) => ({ ...prev, durationDays: Math.max(0, Number(event.target.value) || 0) }))} className="font-code rounded-full" /></Field>
              <Field label="PRACTICE TYPE">
                <Select value={draft.type || 'experiment'} onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as PracticeType }))}>
                  <SelectTrigger className="rounded-full bg-white border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{practiceTypes.map((type) => <SelectItem key={type} value={type} className="font-code text-[10px] uppercase">{PRACTICE_LABELS[type]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="STATUS">
                <Select value={draft.status || 'planned'} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as PracticeStatus }))}>
                  <SelectTrigger className="rounded-full bg-white border-border/60 shadow-sm font-code text-[10px] uppercase h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status} className="font-code text-[10px] uppercase">{status}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="START DATE"><Input type="date" value={draft.startDate || ''} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
              <Field label="END DATE (EXPECTED)"><Input type="date" value={draft.endDate || ''} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} className="h-11 font-code rounded-full" /></Field>
            </div>
            <Field label="HYPOTHESIS / CORE REQUIREMENT"><Textarea value={draft.description || ''} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-[120px] italic text-base" placeholder="If I do this practice, what do I expect it to reveal, strengthen, challenge, or change?" /></Field>
            <Field label="OBSERVATION METHOD / CONCLUSION REVIEW"><Textarea value={draft.notes || ''} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[140px] italic text-base" placeholder="How will you know what happened? Afterward, record what happened, alternative explanations, and what changed intellectually." /></Field>
            <Field label="CONCEPTS TESTED"><ConceptTagPicker concepts={concepts} value={draft.conceptTags || []} onChange={(conceptTags) => setDraft((prev) => ({ ...prev, conceptTags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} /></Field>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <LinkGrid title="Linked Sources" items={media.map((item) => ({ id: item.id, label: item.title }))} selected={draft.sourceIds || []} onChange={(sourceIds) => setDraft((prev) => ({ ...prev, sourceIds }))} />
              <LinkGrid title="Linked Inquiries" items={questions.map((item) => ({ id: item.id, label: item.text }))} selected={draft.questionIds || []} onChange={(questionIds) => setDraft((prev) => ({ ...prev, questionIds }))} />
              <LinkGrid title="Linked Positions" items={positions.map((item) => ({ id: item.id, label: item.title }))} selected={draft.positionIds || []} onChange={(positionIds) => setDraft((prev) => ({ ...prev, positionIds }))} />
              <LinkGrid title="Linked Works" items={drafts.map((item) => ({ id: item.id, label: item.title }))} selected={draft.draftIds || []} onChange={(draftIds) => setDraft((prev) => ({ ...prev, draftIds }))} />
            </div>
          </div>
        </div>
        <div className="p-8 pt-4 bg-muted/10 border-t flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-11 px-8 rounded-full font-bold text-muted-foreground hover:bg-transparent">CANCEL</Button>
          <Button onClick={onSave} className="h-11 px-10 bg-accent shadow-xl shadow-accent/20 rounded-full font-bold uppercase tracking-widest text-[11px]">Initiate Practice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="font-code text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60 font-bold">{label}</Label>{children}</div>;
}

function LinkGrid({ title, items, selected, onChange }: { title: string; items: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <Field label={title}>
      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-white p-4 shadow-inner">
        {items.length ? items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 text-sm cursor-pointer group py-1">
            <input 
              type="checkbox" 
              checked={selected.includes(item.id)} 
              onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} 
              className="accent-accent size-4 rounded border-border/60"
            />
            <span className="font-body italic text-primary/80 line-clamp-1 group-hover:text-accent transition-colors">{item.label}</span>
          </label>
        )) : <p className="text-[11px] text-muted-foreground italic p-2">No items discovered in vault.</p>}
      </div>
    </Field>
  );
}
