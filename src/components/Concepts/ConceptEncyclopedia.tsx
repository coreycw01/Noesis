
"use client";

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, Brain, CheckCircle2, Edit, Plus, Search, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { SourceLinker } from '@/components/SourceLinker';
import type { Concept, Draft, Insight, Media, Practice, Question, TimelineEvent, VaultEntry } from '@/lib/types';
import { allAnnotations, conceptKey, conceptRelated, conceptTerms, UNSORTED_CONCEPT } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { aiClient, type ClarityCheckQuestion } from '@/lib/ai-client';
import { computeConceptDiagnosis, CLARITY_BG } from '@/lib/clarity';
import type { ClarityLevel } from '@/lib/clarity';
import { useToast } from '@/hooks/use-toast';
import { GenerativeAiIcon } from '@/components/GenerativeAiIcon';

interface ConceptEncyclopediaProps {
  concepts: Concept[];
  media: Media[];
  insights: Insight[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  onAddConcept: (data: Partial<Concept>) => void;
  onUpdateConcept: (concept: Concept) => void;
  onDeleteConcept: (id: string) => void;
  onCreateIdea: (data: { title: string; body: string; tags: string[]; sourceIds: string[] }) => void;
}

type ConceptListView = 'all' | 'recent' | 'connected' | 'undefined' | 'contested' | 'transformed' | 'neglected';

type ConceptListRow = {
  name: string;
  concept: Concept;
  related: ReturnType<typeof conceptRelated>;
  diagnosis: ReturnType<typeof computeConceptDiagnosis>;
  connectionCount: number;
  lastActiveAt: number;
  why: string;
};

const CONCEPT_LIST_VIEWS: Array<{ id: ConceptListView; label: string; description: string }> = [
  { id: 'all', label: 'All', description: 'Every defined concept in the vocabulary.' },
  { id: 'recent', label: 'Recently Active', description: 'Concepts with recent timeline movement or updated definitions.' },
  { id: 'connected', label: 'Most Connected', description: 'Concepts carrying the most sources, positions, works, or practices.' },
  { id: 'undefined', label: 'Undefined', description: 'Concepts that need a working definition or boundary.' },
  { id: 'contested', label: 'Contested', description: 'Concepts under tension, challenge, or contradictory usage.' },
  { id: 'transformed', label: 'Transformed', description: 'Concepts whose meaning has changed or stabilized through revision.' },
  { id: 'neglected', label: 'Neglected', description: 'Concepts with meaningful links but little recent movement.' },
];

const RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;
const NEGLECTED_WINDOW_MS = 1000 * 60 * 60 * 24 * 90;

function dateValue(value?: string) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function conceptActivityDate(concept: Concept | undefined, events: TimelineEvent[]) {
  return Math.max(
    dateValue(concept?.dateUpdated || concept?.dateCreated),
    ...events.map((event) => dateValue(event.date))
  );
}

export function ConceptEncyclopedia(props: ConceptEncyclopediaProps) {
  const { concepts, media, insights, vault, drafts, practices = [], questions, timeline, onAddConcept, onUpdateConcept, onDeleteConcept, onCreateIdea } = props;
  const [search, setSearch] = useState('');
  const [listView, setListView] = useState<ConceptListView>('all');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [editing, setEditing] = useState<Concept | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftConcept, setDraftConcept] = useState<Partial<Concept>>({ name: '', description: '', sourceIds: [] });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isDraftingPositions, setIsDraftingPositions] = useState(false);
  const [positionDrafts, setPositionDrafts] = useState<Array<{ claim: string; confidence: 'low' | 'medium' | 'high'; supportSummary: string; challengeToConsider: string }>>([]);
  const [clarityCheckOpen, setClarityCheckOpen] = useState(false);
  const [clarityCheckQuestions, setClarityCheckQuestions] = useState<ClarityCheckQuestion[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [clarityAnswers, setClarityAnswers] = useState<Array<{ dimension: string; isClosest: boolean; feedback: string }>>([]);
  const [isLoadingCheck, setIsLoadingCheck] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const { toast } = useToast();
  
  const allTerms = useMemo(() => conceptTerms(concepts, media, insights, vault, drafts, practices), [concepts, media, insights, vault, drafts, practices]);
  const selectedRelated = useMemo(() => selectedName ? conceptRelated(selectedName, { media, insights, vault, drafts, practices, questions, timeline }) : null, [selectedName, media, insights, vault, drafts, practices, questions, timeline]);
  
  const conceptRows = useMemo<ConceptListRow[]>(() => {
    return allTerms
      .map((name) => {
      const isUnsorted = conceptKey(name) === conceptKey(UNSORTED_CONCEPT);
      if (isUnsorted) return null;
      const conceptDoc = concepts.find(c => conceptKey(c.name) === conceptKey(name));
      if (!conceptDoc) return null;
      const related = conceptRelated(name, { media, insights, vault, drafts, practices, questions, timeline });
      const diagnosis = computeConceptDiagnosis(name, related, conceptDoc.description);
      const connectionCount = related.sources.length + related.annotations.length + related.questions.length + related.beliefs.length + related.drafts.length + related.practices.length;
      const lastActiveAt = conceptActivityDate(conceptDoc, related.events);
      const isRecent = lastActiveAt > Date.now() - RECENT_WINDOW_MS;
      const isNeglected = connectionCount > 0 && lastActiveAt > 0 && lastActiveAt < Date.now() - NEGLECTED_WINDOW_MS;
      const isUndefined = !conceptDoc.description?.trim() || conceptDoc.philosophyStatus === 'undefined' || diagnosis.clarity === 'beginning';
      const isContested = conceptDoc.philosophyStatus === 'contested' || diagnosis.tension === 'high' || related.beliefs.some((entry) => entry.status === 'challenged');
      const isTransformed = related.events.some((event) => /transform|revise|definition|changed/i.test(`${event.eventType} ${event.reason || ''}`));
      const searchText = `${name} ${conceptDoc.description || ''} ${JSON.stringify(related)}`.toLowerCase();
      const matchesSearch = !search || searchText.includes(search.toLowerCase());
      const matchesView =
        listView === 'all' ||
        (listView === 'recent' && isRecent) ||
        (listView === 'connected' && connectionCount > 0) ||
        (listView === 'undefined' && isUndefined) ||
        (listView === 'contested' && isContested) ||
        (listView === 'transformed' && isTransformed) ||
        (listView === 'neglected' && isNeglected);
      if (!matchesSearch || !matchesView) return null;

      let why = 'Part of the current concept vocabulary.';
      if (listView === 'recent') why = lastActiveAt ? `Last moved ${new Date(lastActiveAt).toLocaleDateString()}.` : 'Recently updated definition or linked event.';
      if (listView === 'connected') why = `${connectionCount} linked object${connectionCount === 1 ? '' : 's'} depend on this concept.`;
      if (listView === 'undefined') why = 'Needs a clearer working definition or boundary test.';
      if (listView === 'contested') why = 'Shows tension, challenge, or inconsistent usage.';
      if (listView === 'transformed') why = 'Has revision or transformation signals in its history.';
      if (listView === 'neglected') why = 'Has meaningful links but little recent movement.';

      return { name, concept: conceptDoc, related, diagnosis, connectionCount, lastActiveAt, why };
    })
    .filter((row): row is ConceptListRow => Boolean(row))
    .sort((a, b) => {
      if (listView === 'recent' || listView === 'transformed') return b.lastActiveAt - a.lastActiveAt;
      if (listView === 'connected') return b.connectionCount - a.connectionCount;
      if (listView === 'neglected') return a.lastActiveAt - b.lastActiveAt;
      return a.name.localeCompare(b.name);
    });
  }, [allTerms, search, listView, concepts, media, insights, vault, drafts, practices, questions, timeline]);

  const openEditor = (concept?: Concept) => {
    if (concept) {
      setEditing(concept);
      setDraftConcept({ 
        name: concept.name, 
        description: concept.description || '', 
        sourceIds: concept.sourceIds || [] 
      });
    } else {
      setEditing(null);
      setDraftConcept({ name: '', description: '', sourceIds: [] });
    }
    setEditorOpen(true);
  };

  const handleSuggestDescription = async () => {
    if (!draftConcept.name) return;
    setIsSuggesting(true);
    try {
      const related = conceptRelated(draftConcept.name, { media, insights, vault, drafts, practices, questions, timeline });
      const { suggestedDescription } = await aiClient.suggestConceptDescription({
        conceptName: draftConcept.name,
        currentDescription: draftConcept.description,
        linkedSources: related.sources.map(s => ({ title: s.title, creator: s.creator, description: s.description })),
        linkedIdeas: related.ideas.map(i => ({ title: i.title, body: i.body })),
        linkedBeliefs: related.beliefs.map(b => ({ title: b.title, statement: b.statement, description: b.description }))
      });
      setDraftConcept(prev => ({ ...prev, description: suggestedDescription }));
      toast({ title: "AI description ready.", description: "Noesis drafted a concept definition from your linked evidence." });
    } catch (error) {
      toast({ variant: "destructive", title: "Suggestion Failed", description: error instanceof Error ? error.message : "AI could not generate a description at this time." });
    } finally {
      setIsSuggesting(false);
    }
  };

  const saveConcept = () => {
    const name = conceptKey(draftConcept.name);
    if (!name) return;
    if (editing) {
      onUpdateConcept({ 
        ...editing, 
        name, 
        description: draftConcept.description || '', 
        sourceIds: draftConcept.sourceIds || [],
        dateUpdated: new Date().toISOString() 
      });
    } else {
      onAddConcept({ 
        name, 
        description: draftConcept.description || '', 
        sourceIds: draftConcept.sourceIds || [],
        createdFrom: 'manual' 
      });
    }
    setEditing(null);
    setEditorOpen(false);
    setDraftConcept({ name: '', description: '', sourceIds: [] });
  };

  const toggleConceptSource = (id: string) => {
    setDraftConcept(prev => {
      const current = prev.sourceIds || [];
      const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
      return { ...prev, sourceIds: next };
    });
  };

  const handleStartClarityCheck = async () => {
    if (!selectedName || !selectedRelated) return;
    const concept = concepts.find(c => conceptKey(c.name) === conceptKey(selectedName));
    setClarityCheckOpen(true);
    setCurrentQIdx(0);
    setClarityAnswers([]);
    setShowReview(false);
    setClarityCheckQuestions([]);
    setIsLoadingCheck(true);
    try {
      const diagnosis = computeConceptDiagnosis(selectedName, selectedRelated, concept?.description);
      const result = await aiClient.generateClarityCheck({
        conceptName: selectedName,
        conceptDefinition: concept?.description,
        positionStatements: selectedRelated.beliefs.slice(0, 4).map(b => b.statement || b.title),
        annotationTexts: selectedRelated.annotations.slice(0, 5).map(a => a.text).filter((t): t is string => !!t),
        relatedConcepts: diagnosis.areasToReview,
      });
      setClarityCheckQuestions(result.questions);
      toast({ title: 'Clarity questions generated.', description: 'AI prepared a concept check based on your notes.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Check Failed', description: error instanceof Error ? error.message : 'Could not generate questions right now.' });
      setClarityCheckOpen(false);
    } finally {
      setIsLoadingCheck(false);
    }
  };

  const handleSelectOption = (question: ClarityCheckQuestion, isClosest: boolean) => {
    const newAnswers = [...clarityAnswers, { dimension: question.dimension, isClosest, feedback: question.feedback }];
    setClarityAnswers(newAnswers);
    if (currentQIdx + 1 < clarityCheckQuestions.length) {
      setCurrentQIdx(prev => prev + 1);
    } else {
      setShowReview(true);
    }
  };

  const handleSuggestPositions = async () => {
    if (!selectedName || !selectedRelated) return;
    const annotationTexts = selectedRelated.annotations.map((annotation) => annotation.text).filter(Boolean);
    if (!annotationTexts.length) {
      toast({ title: 'More evidence needed', description: 'Add annotations to this concept before drafting positions from it.' });
      return;
    }
    setIsDraftingPositions(true);
    try {
      const result = await aiClient.suggestPositionDrafts({
        conceptName: selectedName,
        annotations: annotationTexts.slice(0, 16),
        sourceTitles: selectedRelated.sources.map((source) => source.title).slice(0, 8),
      });
      setPositionDrafts(result.drafts);
      toast({ title: 'Position drafts ready.', description: 'Review the AI drafts and save only the claims you want to own.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Builder Failed', description: error instanceof Error ? error.message : 'Noesis could not draft positions from this concept right now.' });
    } finally {
      setIsDraftingPositions(false);
    }
  };

  const savePositionDraft = (claim: string, body: string) => {
    if (!selectedName || !selectedRelated) return;
    onCreateIdea({
      title: claim.slice(0, 90),
      body,
      tags: [selectedName],
      sourceIds: selectedRelated.sources.map((source) => source.id),
    });
    toast({ title: 'Position Saved', description: 'The draft is now a Position linked to this concept.' });
  };

  // ── Full concept detail page ──────────────────────────────────────
  if (selectedName && selectedRelated) {
    const r = selectedRelated;
    const concept = concepts.find((c) => conceptKey(c.name) === conceptKey(selectedName));
    const sortedEvents = [...r.events].sort((a, b) => b.date.localeCompare(a.date));
    const diagnosis = computeConceptDiagnosis(selectedName, r, concept?.description);
    const linkedConceptNames = Array.from(new Set([
      ...(concept?.links || []),
      ...diagnosis.areasToReview,
      ...r.annotations.flatMap((annotation) => annotation.conceptTags || annotation.source.tags || []),
      ...r.beliefs.flatMap((belief) => belief.tags || []),
      ...r.drafts.flatMap((draft) => draft.conceptTags || []),
      ...r.practices.flatMap((practice) => practice.conceptTags || []),
    ]
      .filter((name) => conceptKey(name) && conceptKey(name) !== conceptKey(selectedName))))
      .slice(0, 10);
    const usageRows = [
      { label: 'Annotations', value: r.annotations.length, note: 'raw language and captured meaning' },
      { label: 'Inquiries', value: r.questions.length, note: 'questions that depend on this idea' },
      { label: 'Positions', value: r.beliefs.length, note: 'claims using this concept as judgment' },
      { label: 'Works', value: r.drafts.length, note: 'places where the idea is expressed' },
      { label: 'Practices', value: r.practices.length, note: 'lived tests connected to the idea' },
    ];
    const boundarySignals = [
      concept?.description ? 'Current definition exists, but should be tested against edge cases.' : 'No stable definition yet.',
      r.beliefs.length > 1 ? 'Multiple positions use this concept, so scope may need tightening.' : 'Few formal claims depend on it yet.',
      diagnosis.tension === 'high' ? 'Related positions or inquiries suggest inconsistent usage.' : 'No strong inconsistency signal yet.',
      r.practices.length ? 'At least one practice tests how the idea behaves in life.' : 'No lived boundary test is attached yet.',
    ];
    const driftEvents = sortedEvents.filter((event) => /concept|definition|revise|transform|changed/i.test(`${event.eventType} ${event.reason || ''}`));

    const back = () => { setSelectedName(null); setPositionDrafts([]); };

    return (
      <div className="flex-1 overflow-y-auto font-body">
        {/* Sticky nav bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/20 px-8 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={back} className="h-8 font-code text-[10px] uppercase tracking-widest rounded-full">
            <ArrowLeft className="size-4 mr-2" /> Concepts
          </Button>
          <div className="flex gap-2">
            {concept && (
              <>
                <Button variant="outline" size="sm" onClick={() => openEditor(concept)} className="h-8 bg-white border-border/60 shadow-sm rounded-full">
                  <Edit className="size-4 mr-2" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { onDeleteConcept(concept.id); back(); }} className="h-8 shadow-sm rounded-full">
                  <Trash2 className="size-4 mr-2" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="p-8 pt-10 max-w-5xl mx-auto">
          {/* Title + definition */}
          <div className="mb-8">
            <h1 className="text-[42px] font-headline font-bold italic text-primary leading-none mb-4">{selectedName}</h1>
            {concept?.description ? (
              <p className="text-lg text-muted-foreground font-body leading-relaxed max-w-3xl">{concept.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground/40 italic font-body">No definition yet — use Edit to anchor this concept.</p>
            )}
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2 mb-10">
            {[
              { label: 'Sources', n: r.sources.length },
              { label: 'Annotations', n: r.annotations.length },
              { label: 'Inquiries', n: r.questions.length },
              { label: 'Positions', n: r.beliefs.length },
              { label: 'Works', n: r.drafts.length },
              { label: 'Practices', n: r.practices.length },
              { label: 'Events', n: r.events.length },
            ].map(({ label, n }) => (
              <div key={label} className="flex items-center gap-1.5 rounded-full border border-border/40 bg-white/80 px-3 py-1 shadow-sm">
                <span className="font-headline text-base font-bold text-accent">{n}</span>
                <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60 font-bold">{label}</span>
              </div>
            ))}
          </div>

          {/* Concept Anatomy */}
          <div className="rounded-xl border border-border/30 bg-white shadow-sm p-6 mb-10">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold">Concept Anatomy</h2>
                <p className="mt-1 text-sm text-muted-foreground">Definition, boundary, usage, and dependency signals for this idea.</p>
              </div>
              <Badge variant="outline" className="rounded-full">{diagnosis.level}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Working Definition</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {concept?.description || 'Undefined. Write a provisional definition before treating this concept as stable.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => concept && openEditor(concept)} disabled={!concept} className="mt-3 h-8 rounded-full">
                  <Edit className="mr-2 size-3.5" /> Edit Definition
                </Button>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Boundary Signals</div>
                <ul className="space-y-2">
                  {boundarySignals.map((signal) => (
                    <li key={signal} className="flex gap-2 text-sm leading-5 text-muted-foreground">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Usage Map</div>
                <div className="grid gap-2">
                  {usageRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-card px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-foreground/80">{row.label}</div>
                        <div className="text-xs text-muted-foreground">{row.note}</div>
                      </div>
                      <span className="font-headline text-lg font-bold text-accent">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Dependencies & Neighbors</div>
                {linkedConceptNames.length ? (
                  <div className="flex flex-wrap gap-2">
                    {linkedConceptNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setSelectedName(name);
                          setPositionDrafts([]);
                        }}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">No neighboring concepts are visible yet. Add aliases, linked sources, or related concepts to define the boundary.</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/40 bg-background/70 p-4">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Concept Drift</div>
              {driftEvents.length ? (
                <div className="grid gap-2">
                  {driftEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="rounded-lg border border-border/30 bg-card px-3 py-2">
                      <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/50">{event.date} · {event.eventType.replace(/_/g, ' ')}</div>
                      <div className="mt-1 text-sm text-foreground/80">{event.reason || event.entityTitle}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">No definition-change events are recorded yet. Future definition revisions should appear here as concept history.</p>
              )}
            </div>
          </div>

          {/* Growth Diagnosis */}
          <div className="rounded-xl border border-border/30 bg-white shadow-sm p-6 mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Brain className="size-4 text-muted-foreground/40" />
                <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold">Growth Diagnosis</h2>
              </div>
              <Button size="sm" onClick={handleStartClarityCheck} className="h-8 rounded-full bg-accent text-white shadow-sm font-code text-[10px] uppercase tracking-widest px-4">
                <GenerativeAiIcon className="mr-2 size-6" /> Clarity Check
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span className={cn('font-code text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border', CLARITY_BG[diagnosis.level])}>
                {diagnosis.level}
              </span>
              {diagnosis.evolving && (
                <span className="font-code text-[10px] uppercase tracking-widest text-accent font-bold">· Recently Changed</span>
              )}
            </div>

            <p className="text-sm font-body text-muted-foreground italic mb-5">{diagnosis.why}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
              {([
                { label: 'Clarity', value: diagnosis.clarity },
                { label: 'Evidence', value: diagnosis.evidence },
                { label: 'Tension', value: diagnosis.tension },
                { label: 'Embodiment', value: diagnosis.embodiment },
                { label: 'Expression', value: diagnosis.expression },
              ] as { label: string; value: string }[]).map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted/10 border border-border/20 px-3 py-2">
                  <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/50 font-bold mb-0.5">{label}</div>
                  <div className="font-code text-[10px] uppercase tracking-widest font-bold text-foreground/70">{value}</div>
                </div>
              ))}
            </div>

            {diagnosis.growthAreas.length > 0 && (
              <div className="mb-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Growth Areas</div>
                <ul className="space-y-1.5">
                  {diagnosis.growthAreas.map((area, i) => (
                    <li key={i} className="text-sm font-body text-foreground/80 flex items-start gap-2">
                      <span className="text-accent mt-0.5 shrink-0">→</span>{area}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg bg-accent/5 border border-accent/15 p-3.5 mb-4">
              <div className="font-code text-[9px] uppercase tracking-widest text-accent/70 mb-1 font-bold">Next Action</div>
              <p className="text-sm font-body text-primary">{diagnosis.suggestedNextAction}</p>
            </div>

            {diagnosis.areasToReview.length > 0 && (
              <div>
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Areas to Review</div>
                <div className="flex flex-wrap gap-1.5">
                  {diagnosis.areasToReview.map(area => (
                    <span key={area} className="font-code text-[9px] uppercase tracking-widest bg-muted/20 text-muted-foreground/70 rounded-full px-2.5 py-1 border border-border/30">{area}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sources + Annotations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <ConceptPageSection title="Related Sources" count={r.sources.length} empty="No sources tagged with this concept yet.">
              <div className="space-y-3">
                {r.sources.slice(0, 6).map((s) => (
                  <div key={s.id} className="rounded-xl bg-white border border-border/40 shadow-sm p-4">
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">{s.type}{s.year ? ` · ${s.year}` : ''}</div>
                    <p className="text-sm font-body font-semibold text-primary leading-snug">{s.title}</p>
                    {s.creator && <p className="text-xs text-muted-foreground font-body mt-0.5">{s.creator}</p>}
                  </div>
                ))}
              </div>
            </ConceptPageSection>

            <ConceptPageSection title="Related Annotations" count={r.annotations.length} empty="No annotations tagged with this concept yet.">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {r.annotations.slice(0, 8).map((a, i) => (
                  <div key={`${a.source.id}-${i}`} className="rounded-xl bg-white border border-border/40 shadow-sm p-4">
                    <span className="font-code text-[8px] uppercase tracking-widest text-accent/70 font-bold">{a.type}</span>
                    <p className="text-sm font-body italic text-primary/80 line-clamp-3 mt-1">"{a.text}"</p>
                    <p className="text-[10px] text-muted-foreground/40 font-body mt-1.5">{a.source.title}</p>
                  </div>
                ))}
              </div>
            </ConceptPageSection>
          </div>

          {/* Inquiries + Positions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <ConceptPageSection title="Related Inquiries" count={r.questions.length} empty="No inquiries linked to this concept.">
              <div className="space-y-3">
                {r.questions.map((q) => (
                  <div key={q.id} className="rounded-xl bg-white border border-border/40 shadow-sm p-4">
                    <p className="text-sm font-body text-primary/90 mb-2">{q.text}</p>
                    {q.answer ? (
                      <p className="text-xs text-muted-foreground font-body italic line-clamp-2 border-t border-border/20 pt-2">{q.answer}</p>
                    ) : (
                      <span className="font-code text-[8px] uppercase tracking-widest text-amber-600 font-bold">Open</span>
                    )}
                  </div>
                ))}
              </div>
            </ConceptPageSection>

            <ConceptPageSection title="Related Positions" count={r.beliefs.length} empty="No positions formed around this concept yet.">
              <div className="space-y-3">
                {r.beliefs.map((b) => (
                  <div key={b.id} className="rounded-xl bg-white border border-border/40 shadow-sm p-4">
                    <p className="text-sm font-headline font-bold italic text-primary mb-1">{b.title}</p>
                    <p className="text-xs font-body text-muted-foreground line-clamp-2 mb-2">{b.statement}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div key={n} className={cn('size-1.5 rounded-full', n <= (b.confidence || 3) ? 'bg-accent' : 'bg-muted')} />
                        ))}
                      </div>
                      <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/50">{b.status}</span>
                    </div>
                  </div>
                ))}

                {r.annotations.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSuggestPositions} disabled={isDraftingPositions} className="w-full h-9 rounded-full bg-white border-accent/20 text-accent hover:bg-accent/5 font-code text-[10px] uppercase tracking-widest">
                    {isDraftingPositions ? <Loader2 className="size-4 mr-2 animate-spin" /> : <GenerativeAiIcon className="mr-2 size-6" />}
                    {isDraftingPositions ? 'Drafting…' : 'Suggest Positions from AI'}
                  </Button>
                )}

                {positionDrafts.map((draft, i) => (
                  <div key={i} className="rounded-xl bg-accent/5 border border-accent/20 p-4">
                    <div className="font-code text-[8px] uppercase tracking-widest text-accent font-bold mb-2">AI Draft · {draft.confidence}</div>
                    <p className="text-sm font-body font-semibold text-primary mb-1">{draft.claim}</p>
                    <p className="text-xs text-muted-foreground font-body mb-2">{draft.supportSummary}</p>
                    <p className="text-[10px] text-amber-600/80 italic font-body mb-3">{draft.challengeToConsider}</p>
                    <Button size="sm" onClick={() => savePositionDraft(draft.claim, draft.supportSummary)} className="h-7 px-4 rounded-full bg-accent text-white font-code text-[9px] uppercase tracking-widest">
                      Save as Position
                    </Button>
                  </div>
                ))}
              </div>
            </ConceptPageSection>
          </div>

          {/* Tensions & Conflicts */}
          {r.beliefs.length >= 2 && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="size-4 text-amber-500" />
                <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold">Tensions & Conflicts</h2>
              </div>
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-5">
                <p className="text-xs text-amber-700/70 font-body mb-4 italic">
                  These positions all orbit <span className="font-bold">{selectedName}</span>. Do they cohere, contradict, or refine each other?
                </p>
                <div className="space-y-4">
                  {r.beliefs.slice(0, 4).map((a, ai) =>
                    r.beliefs.slice(ai + 1, ai + 2).map((b) => (
                      <div key={`${a.id}-${b.id}`} className="rounded-lg bg-white/80 border border-amber-100 p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">Position A</p>
                            <p className="text-sm font-headline font-bold italic text-primary">{a.title}</p>
                            <p className="text-xs text-muted-foreground italic font-body mt-1 line-clamp-2">"{a.statement}"</p>
                          </div>
                          <div>
                            <p className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">Position B</p>
                            <p className="text-sm font-headline font-bold italic text-primary">{b.title}</p>
                            <p className="text-xs text-muted-foreground italic font-body mt-1 line-clamp-2">"{b.statement}"</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Evolution over time */}
          {sortedEvents.length > 0 && (
            <section className="mb-10">
              <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold mb-6">Evolution Over Time</h2>
              <div className="relative pl-6 border-l-2 border-border/20 space-y-6">
                {sortedEvents.map((event) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[29px] size-3.5 rounded-full bg-white border-2 border-accent/40 shadow-sm" />
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">
                      {event.date} · {event.eventType.replace(/_/g, ' ')}
                    </div>
                    <p className="text-sm font-body font-semibold text-primary/90">{event.entityTitle}</p>
                    {event.reason && <p className="text-xs text-muted-foreground font-body italic mt-0.5">{event.reason}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Concept editor dialog (accessible from detail page too) */}
        <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) { setEditing(null); setDraftConcept({ name: '', description: '', sourceIds: [] }); } }}>
          <DialogContent className="max-w-xl bg-white border-none shadow-2xl rounded-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="font-headline text-2xl italic">{editing ? 'Edit Concept' : 'New Concept'}</DialogTitle>
                {draftConcept.name && (
                <Button variant="outline" size="sm" onClick={handleSuggestDescription} disabled={isSuggesting} className="h-8 font-code text-[10px] uppercase tracking-widest text-accent border-accent/20 bg-white shadow-sm rounded-full">
                    {isSuggesting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <GenerativeAiIcon className="mr-2 size-6" />}
                    Suggest Description
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="space-y-6 pt-2">
              <div className="space-y-2">
                <Label className="readex-kicker">Concept Name</Label>
                <Input value={draftConcept.name} onChange={(e) => setDraftConcept((p) => ({ ...p, name: e.target.value }))} className="rounded-full" />
              </div>
              <div className="space-y-2">
                <Label className="readex-kicker">Definition</Label>
                <Textarea value={draftConcept.description} onChange={(e) => setDraftConcept((p) => ({ ...p, description: e.target.value }))} className="min-h-[120px]" placeholder="What does this concept mean to you? How do you understand it?" />
              </div>
              <SourceLinker media={media} selectedIds={draftConcept.sourceIds || []} onToggle={toggleConceptSource} label="Root Evidence (Sources)" />
            </div>
            <DialogFooter className="gap-2 pt-4">
              {editing && (
                <Button variant="destructive" onClick={() => { onDeleteConcept(editing.id); setEditing(null); setEditorOpen(false); back(); }} className="rounded-full px-6">
                  <Trash2 className="size-4 mr-2" /> Delete
                </Button>
              )}
              <Button onClick={saveConcept} className="bg-accent shadow-md shadow-accent/20 rounded-full px-8">Anchor Concept</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clarity Check dialog */}
        <Dialog open={clarityCheckOpen} onOpenChange={(open) => { setClarityCheckOpen(open); if (!open) { setShowReview(false); setClarityCheckQuestions([]); setClarityAnswers([]); setCurrentQIdx(0); } }}>
          <DialogContent className="max-w-2xl border-none shadow-2xl rounded-2xl bg-white">
            {isLoadingCheck ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <Loader2 className="size-8 animate-spin text-accent/40" />
                <p className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">Generating questions…</p>
              </div>
            ) : showReview ? (
              <div className="space-y-6 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                  <span className="font-code text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Clarity Check Complete</span>
                </div>
                <h2 className="font-headline text-3xl italic text-primary">{selectedName}</h2>

                <div className="flex items-center gap-3">
                  <span className={cn('font-code text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border', CLARITY_BG[diagnosis.level])}>
                    {diagnosis.level}
                  </span>
                  <span className="font-code text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                    {clarityAnswers.filter(a => a.isClosest).length}/{clarityAnswers.length} closest matched
                  </span>
                </div>

                <p className="text-sm font-body text-muted-foreground italic">{diagnosis.why}</p>

                {clarityAnswers.some(a => a.isClosest) && (
                  <div className="space-y-2">
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold">What Your Answers Reveal</div>
                    {clarityAnswers.filter(a => a.isClosest).map((a, i) => (
                      <div key={i} className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm font-body text-emerald-800">{a.feedback}</div>
                    ))}
                  </div>
                )}

                {diagnosis.growthAreas.length > 0 && (
                  <div>
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Growth Areas</div>
                    <ul className="space-y-1.5">
                      {diagnosis.growthAreas.map((area, i) => (
                        <li key={i} className="text-sm font-body text-foreground/80 flex items-start gap-2">
                          <span className="text-accent mt-0.5 shrink-0">→</span>{area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg bg-accent/5 border border-accent/15 p-4">
                  <div className="font-code text-[9px] uppercase tracking-widest text-accent/70 mb-1 font-bold">Next Action</div>
                  <p className="text-sm font-body text-primary">{diagnosis.suggestedNextAction}</p>
                </div>

                {diagnosis.areasToReview.length > 0 && (
                  <div>
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Areas to Review</div>
                    <div className="flex flex-wrap gap-1.5">
                      {diagnosis.areasToReview.map(area => (
                        <span key={area} className="font-code text-[9px] uppercase tracking-widest bg-muted/20 text-muted-foreground/70 rounded-full px-2.5 py-1 border border-border/30">{area}</span>
                      ))}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button onClick={() => setClarityCheckOpen(false)} className="rounded-full px-8 font-bold">Done</Button>
                </DialogFooter>
              </div>
            ) : clarityCheckQuestions.length > 0 ? (
              <div className="space-y-6 py-2">
                <div className="flex items-center justify-between">
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">
                    {currentQIdx + 1} / {clarityCheckQuestions.length}
                  </div>
                  <div className="font-code text-[9px] uppercase tracking-widest text-accent/70 font-bold">
                    {clarityCheckQuestions[currentQIdx].dimension.replace('_', ' ')}
                  </div>
                </div>

                <div className="w-full h-1 bg-muted/20 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${((currentQIdx) / clarityCheckQuestions.length) * 100}%` }} />
                </div>

                <h2 className="font-headline text-2xl italic text-primary leading-tight">{clarityCheckQuestions[currentQIdx].text}</h2>

                <div className="space-y-3">
                  {clarityCheckQuestions[currentQIdx].options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSelectOption(clarityCheckQuestions[currentQIdx], option.isClosest)}
                      className="w-full text-left rounded-xl bg-white border border-border/40 p-4 hover:border-accent/40 hover:bg-accent/5 transition-all group"
                    >
                      <span className="font-code text-[9px] uppercase font-bold text-muted-foreground/50 mr-2 group-hover:text-accent/70">{option.id.toUpperCase()}.</span>
                      <span className="font-body text-[15px] text-primary">{option.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-7xl mx-auto w-full font-body">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-[28px] font-headline font-semibold italic text-foreground/80">Concepts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground font-body">Build the encyclopedia of recurring ideas that organize your thinking.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="w-64 pl-9 h-9 rounded-full" />
          </div>
          <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 shadow-md shadow-accent/20 rounded-full h-9">
            <Plus className="size-4 mr-1.5" /> NEW CONCEPT
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat value={allTerms.length} label="Total Terms" sub="Knowledge index size" />
        <Stat value={media.length} label="Sources" sub="Input library" />
        <Stat value={allAnnotations(media).length} label="Annotations" sub="Tagged excerpts" />
        <Stat value={vault.length + drafts.length + (practices?.length || 0)} label="Outputs" sub="Positions, works, practices" />
      </div>

      <div className="mb-6 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Concept Views</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {CONCEPT_LIST_VIEWS.find((item) => item.id === listView)?.description}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full">{conceptRows.length} shown</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {CONCEPT_LIST_VIEWS.map((view) => {
            const active = listView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setListView(view.id)}
                title={view.description}
                className={cn(
                  'rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-[0.14em] transition-colors',
                  active
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-background/70 text-muted-foreground hover:border-accent/40 hover:text-foreground'
                )}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {conceptRows.map(({ name, concept, related, diagnosis: diag, connectionCount, why }) => {

          return (
            <Card
              key={name}
              className="rounded-xl p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group bg-white/95 shadow-md border border-accent/20"
              onClick={() => {
                setSelectedName(name);
                setPositionDrafts([]);
              }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex gap-2 items-start">
                    <h3 className="font-headline text-xl font-bold flex-1 group-hover:text-accent transition-colors leading-tight">{name}</h3>
                    {concept && (
                      <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full" onClick={(event) => { event.stopPropagation(); openEditor(concept); }}>
                        <Edit className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn('font-code text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border', CLARITY_BG[diag.level])}>
                      {diag.level}
                    </span>
                    <span className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold">
                      {connectionCount} links
                    </span>
                  </div>
                </div>
                <div className="size-8 rounded-full flex items-center justify-center transition-colors shadow-sm bg-primary/10 text-primary">
                  <BookOpen className="size-4" />
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-muted-foreground font-body line-clamp-2 italic mb-5">
                {concept?.description || 'Inspect linked sources, positions, works, inquiries, and practices.'}
              </p>

              <div className="mb-4 rounded-xl border border-border/50 bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground/70">Why shown:</span> {why}
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-border/30 pt-4">
                <Badge variant="outline" className="text-[8px] font-code uppercase tracking-tighter bg-muted/10 border-transparent rounded-full px-2.5 py-0.5 font-bold shadow-sm">{related.sources.length} SOURCES</Badge>
                <Badge variant="outline" className="text-[8px] font-code uppercase tracking-tighter bg-muted/10 border-transparent rounded-full px-2.5 py-0.5 font-bold shadow-sm">{related.beliefs.length} POSITIONS</Badge>
                <Badge variant="outline" className="text-[8px] font-code uppercase tracking-tighter bg-muted/10 border-transparent rounded-full px-2.5 py-0.5 font-bold shadow-sm">{related.drafts.length} WORKS</Badge>
              </div>
            </Card>
          );
        })}

        {conceptRows.length === 0 && (
          <div className="col-span-full py-24 text-center opacity-40">
            <BookOpen className="size-16 mx-auto mb-6" />
            <h3 className="text-2xl font-headline italic">No concepts discovered</h3>
            <p className="text-sm font-body mt-2">Refine your search, change the concept view, or add new intellectual artifacts to the vault.</p>
          </div>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) { setEditing(null); setDraftConcept({ name: '', description: '', sourceIds: [] }); } }}>
        <DialogContent className="max-w-xl bg-white border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="font-headline text-2xl italic">{editing ? 'Edit Concept' : 'New Concept'}</DialogTitle>
              {draftConcept.name && (
                <Button variant="outline" size="sm" onClick={handleSuggestDescription} disabled={isSuggesting} className="h-8 font-code text-[10px] uppercase tracking-widest text-accent border-accent/20 bg-white shadow-sm rounded-full">
                  {isSuggesting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <GenerativeAiIcon className="mr-2 size-6" />}
                  Suggest Description
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="space-y-2">
              <Label className="readex-kicker">Concept Name</Label>
              <Input value={draftConcept.name} onChange={(event) => setDraftConcept((prev) => ({ ...prev, name: event.target.value }))} className="rounded-full" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker">Definition</Label>
              <Textarea value={draftConcept.description} onChange={(event) => setDraftConcept((prev) => ({ ...prev, description: event.target.value }))} className="min-h-[120px]" placeholder="What does this concept mean to you? How do you understand it?" />
            </div>
            <SourceLinker media={media} selectedIds={draftConcept.sourceIds || []} onToggle={toggleConceptSource} label="Root Evidence (Sources)" />
          </div>
          <DialogFooter className="gap-2 pt-4">
            {editing && (
              <Button variant="destructive" onClick={() => { onDeleteConcept(editing.id); setEditing(null); setEditorOpen(false); }} className="rounded-full px-6">
                <Trash2 className="size-4 mr-2" /> Delete
              </Button>
            )}
            <Button onClick={saveConcept} className="bg-accent shadow-md shadow-accent/20 rounded-full px-8">Anchor Concept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConceptPageSection({ title, count, empty, children }: { title: string; count: number; empty: string; children?: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-code text-[10px] uppercase tracking-[0.18em] text-foreground/50 font-bold">{title}</h2>
        <span className="font-code text-[9px] bg-muted/30 text-muted-foreground/50 rounded-full px-2 py-0.5 font-bold">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground/30 italic font-body">{empty}</p>
      ) : children}
    </section>
  );
}

function Stat({ value, label, sub }: { value: number | string; label: string; sub: string }) {
  return (
    <Card className="bg-white border border-accent/10 shadow-sm p-4 h-20 flex flex-col justify-center rounded-xl">
      <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">{label}</div>
      <div className="mt-1 text-2xl font-headline font-bold text-accent leading-none">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground/40 truncate font-body">{sub}</div>
    </Card>
  );
}
