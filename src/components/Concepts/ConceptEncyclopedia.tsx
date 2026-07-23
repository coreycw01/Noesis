
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, Brain, CheckCircle2, Edit, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { SourceLinker } from '@/components/SourceLinker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Concept, Draft, Insight, Media, PhilosophicalLink, PhilosophicalLinkType, Practice, Question, TimelineEvent, VaultEntry } from '@/lib/types';
import { conceptKey, conceptRelated, conceptTerms, UNSORTED_CONCEPT } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { aiClient, type ClarityCheckQuestion } from '@/lib/ai-client';
import { computeConceptDiagnosis, CLARITY_BG } from '@/lib/clarity';
import type { ClarityLevel } from '@/lib/clarity';
import { useToast } from '@/hooks/use-toast';
import { GenerativeAiIcon } from '@/components/GenerativeAiIcon';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { noesisUserError } from '@/lib/user-facing-errors';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';

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
  onCreateLink?: (data: Partial<PhilosophicalLink>, options?: { creationMethod?: string }) => void;
  focusedConceptId?: string | null;
  onOpenConceptRoute?: (id: string | null) => void;
}

type ConceptListView = 'all' | 'recent' | 'needs_attention' | 'connected' | 'undefined' | 'contested' | 'duplicates' | 'transformed' | 'neglected';

type ConceptListRow = {
  name: string;
  concept: Concept;
  related: ReturnType<typeof conceptRelated>;
  diagnosis: ReturnType<typeof computeConceptDiagnosis>;
  maturity: ConceptMaturity;
  connectionCount: number;
  lastActiveAt: number;
  why: string;
  possibleDuplicates: string[];
  repairFlags: ConceptRepairFlag[];
};

type BoundaryAnswer = 'inside' | 'outside' | 'depends';
type ConceptTensionDecision = Extract<PhilosophicalLinkType, 'coheres' | 'contradicts' | 'refines'>;
type ConceptListField = 'aliases' | 'notSameAs' | 'examples' | 'counterexamples';
type ConceptRepairFlag = {
  id: 'define' | 'boundaries' | 'examples' | 'evidence' | 'opposition' | 'practice' | 'drift' | 'duplicate' | 'neglected';
  label: string;
  detail: string;
  tone: 'urgent' | 'review' | 'growth' | 'stable';
};
type ConceptMaturity = {
  score: number;
  label: 'beginning' | 'emerging' | 'usable' | 'stable';
  nextStep: string;
  missing: string[];
};

const CONCEPT_LIST_VIEWS: Array<{ id: ConceptListView; label: string; description: string }> = [
  { id: 'all', label: 'All', description: 'Every defined concept in the vocabulary.' },
  { id: 'recent', label: 'Recently Active', description: 'Concepts with recent timeline movement or updated definitions.' },
  { id: 'needs_attention', label: 'Needs Attention', description: 'Concepts missing definition, evidence, distinctions, or practice.' },
  { id: 'connected', label: 'Most Connected', description: 'Concepts carrying the most sources, positions, works, or practices.' },
  { id: 'undefined', label: 'Undefined', description: 'Concepts that need a working definition or boundary.' },
  { id: 'contested', label: 'Contested', description: 'Concepts under tension, challenge, or contradictory usage.' },
  { id: 'duplicates', label: 'Possible Duplicates', description: 'Concepts whose names, aliases, or boundaries overlap and may need distinction or merge review.' },
  { id: 'transformed', label: 'Transformed', description: 'Concepts whose meaning has changed or stabilized through revision.' },
  { id: 'neglected', label: 'Neglected', description: 'Concepts with meaningful links but little recent movement.' },
];

const RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;
const NEGLECTED_WINDOW_MS = 1000 * 60 * 60 * 24 * 90;
const CONCEPT_TENSION_DECISIONS: Array<{ id: ConceptTensionDecision; label: string; description: string }> = [
  { id: 'coheres', label: 'Coheres', description: 'These positions can stand together.' },
  { id: 'contradicts', label: 'Contradicts', description: 'These positions oppose each other.' },
  { id: 'refines', label: 'Refines', description: 'One position clarifies or narrows the other.' },
];

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

function conceptFingerprint(concept: Concept | undefined, name: string) {
  return Array.from(new Set([
    name,
    ...(concept?.aliases || []),
    ...(concept?.notSameAs || []),
  ]
    .flatMap((value) => conceptKey(value).toLowerCase().split(/\s+/))
    .filter((token) => token.length > 3)));
}

function possibleDuplicateConcepts(concept: Concept | undefined, name: string, concepts: Concept[]) {
  const ownTerms = new Set(conceptFingerprint(concept, name));
  if (!ownTerms.size) return [];
  return concepts
    .filter((candidate) => candidate.id !== concept?.id)
    .map((candidate) => {
      const candidateTerms = conceptFingerprint(candidate, candidate.name);
      const overlap = candidateTerms.filter((term) => ownTerms.has(term)).length;
      const aliasHit = (candidate.aliases || []).some((alias) => conceptKey(alias) === conceptKey(name)) || (concept?.aliases || []).some((alias) => conceptKey(alias) === conceptKey(candidate.name));
      return { name: candidate.name, score: overlap + (aliasHit ? 3 : 0) };
    })
    .filter((candidate) => candidate.score >= 2)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 4)
    .map((candidate) => candidate.name);
}

function conceptRepairFlags({
  concept,
  related,
  diagnosis,
  connectionCount,
  lastActiveAt,
  possibleDuplicates,
}: {
  concept: Concept | undefined;
  related: ReturnType<typeof conceptRelated>;
  diagnosis: ReturnType<typeof computeConceptDiagnosis>;
  connectionCount: number;
  lastActiveAt: number;
  possibleDuplicates: string[];
}): ConceptRepairFlag[] {
  const flags: ConceptRepairFlag[] = [];
  if (!concept?.description?.trim() || concept.philosophyStatus === 'undefined' || diagnosis.clarity === 'beginning') {
    flags.push({ id: 'define', label: 'Define', detail: 'Write a provisional working definition before this concept carries more weight.', tone: 'urgent' });
  }
  if (!(concept?.notSameAs || []).length || !(concept?.counterexamples || []).length) {
    flags.push({ id: 'boundaries', label: 'Boundary', detail: 'Add distinctions or counterexamples so neighboring ideas do not collapse together.', tone: 'review' });
  }
  if (!(concept?.examples || []).length) {
    flags.push({ id: 'examples', label: 'Examples', detail: 'Add clear cases that belong inside the concept.', tone: 'growth' });
  }
  if (related.sources.length + related.annotations.length === 0) {
    flags.push({ id: 'evidence', label: 'Evidence', detail: 'Anchor the concept in at least one source, annotation, or captured example.', tone: 'urgent' });
  }
  if (related.beliefs.length > 1 && diagnosis.tension === 'high') {
    flags.push({ id: 'opposition', label: 'Tension', detail: 'Review whether positions using this concept cohere, contradict, or refine each other.', tone: 'review' });
  }
  if (!related.practices.length && related.beliefs.length > 0) {
    flags.push({ id: 'practice', label: 'Untested', detail: 'Link a practice if this concept should change behavior or lived judgment.', tone: 'growth' });
  }
  if (diagnosis.evolving && !(related.events || []).some((event) => /definition|boundary|concept/i.test(`${event.eventType} ${event.reason || ''}`))) {
    flags.push({ id: 'drift', label: 'Drift', detail: 'Recent use changed; record what shifted in the definition.', tone: 'review' });
  }
  if (possibleDuplicates.length > 0) {
    flags.push({ id: 'duplicate', label: 'Overlap', detail: `Compare with ${possibleDuplicates.slice(0, 2).join(', ')} before merging or separating.`, tone: 'review' });
  }
  if (connectionCount > 0 && lastActiveAt > 0 && lastActiveAt < Date.now() - NEGLECTED_WINDOW_MS) {
    flags.push({ id: 'neglected', label: 'Neglected', detail: 'This concept has links but has not moved recently.', tone: 'growth' });
  }
  return flags;
}

function conceptMaturityScore({
  concept,
  related,
  repairFlags,
}: {
  concept: Concept | undefined;
  related: ReturnType<typeof conceptRelated>;
  repairFlags: ConceptRepairFlag[];
}): ConceptMaturity {
  const missing: string[] = [];
  let score = 0;

  if (concept?.description?.trim()) score += 1;
  else missing.push('working definition');

  if ((concept?.aliases || []).length || (concept?.notSameAs || []).length) score += 1;
  else missing.push('aliases or distinctions');

  if ((concept?.examples || []).length && (concept?.counterexamples || []).length) score += 1;
  else missing.push('examples and counterexamples');

  if (related.sources.length || related.annotations.length) score += 1;
  else missing.push('source evidence');

  if (related.beliefs.length || related.questions.length) score += 1;
  else missing.push('position or inquiry use');

  if (related.practices.length || related.drafts.length) score += 1;
  else missing.push('practice or work expression');

  const urgentFlags = repairFlags.filter((flag) => flag.tone === 'urgent').length;
  const adjustedScore = Math.max(0, score - urgentFlags);
  const label = adjustedScore >= 5
    ? 'stable'
    : adjustedScore >= 4
      ? 'usable'
      : adjustedScore >= 2
        ? 'emerging'
        : 'beginning';
  const nextStep = repairFlags[0]?.detail || (missing[0] ? `Add ${missing[0]}.` : 'Review definition history and keep it stable through use.');

  return { score: adjustedScore, label, nextStep, missing };
}

export function ConceptEncyclopedia(props: ConceptEncyclopediaProps) {
  const { concepts, media, insights, vault, drafts, practices = [], questions, timeline, onAddConcept, onUpdateConcept, onDeleteConcept, onCreateIdea, onCreateLink, focusedConceptId, onOpenConceptRoute } = props;
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
  const [boundaryAnswers, setBoundaryAnswers] = useState<Record<string, BoundaryAnswer>>({});
  const [boundaryRefinement, setBoundaryRefinement] = useState('');
  const [tensionDecisions, setTensionDecisions] = useState<Record<string, ConceptTensionDecision>>({});
  const [isDefinitionEditing, setIsDefinitionEditing] = useState(false);
  const [definitionDraft, setDefinitionDraft] = useState('');
  const [conceptListDrafts, setConceptListDrafts] = useState<Record<ConceptListField, string>>({
    aliases: '',
    notSameAs: '',
    examples: '',
    counterexamples: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<Concept | null>(null);
  const { toast } = useToast();
  
  const allTerms = useMemo(() => conceptTerms(concepts, media, insights, vault, drafts, practices), [concepts, media, insights, vault, drafts, practices]);
  const selectedRelated = useMemo(() => selectedName ? conceptRelated(selectedName, { media, insights, vault, drafts, practices, questions, timeline }) : null, [selectedName, media, insights, vault, drafts, practices, questions, timeline]);

  useEffect(() => {
    if (!focusedConceptId) return;
    const focusedConcept = concepts.find((concept) => concept.id === focusedConceptId);
    if (focusedConcept && conceptKey(focusedConcept.name) !== conceptKey(selectedName || '')) {
      setSelectedName(focusedConcept.name);
      setPositionDrafts([]);
    }
  }, [concepts, focusedConceptId, selectedName]);
  
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
      const possibleDuplicates = possibleDuplicateConcepts(conceptDoc, name, concepts);
      const repairFlags = conceptRepairFlags({ concept: conceptDoc, related, diagnosis, connectionCount, lastActiveAt, possibleDuplicates });
      const maturity = conceptMaturityScore({ concept: conceptDoc, related, repairFlags });
      const needsAttention = repairFlags.length > 0 || maturity.label === 'beginning' || maturity.label === 'emerging';
      const searchText = `${name} ${conceptDoc.description || ''} ${(conceptDoc.aliases || []).join(' ')} ${(conceptDoc.notSameAs || []).join(' ')} ${(conceptDoc.examples || []).join(' ')} ${(conceptDoc.counterexamples || []).join(' ')} ${JSON.stringify(related)}`.toLowerCase();
      const matchesSearch = !search || searchText.includes(search.toLowerCase());
      const matchesView =
        listView === 'all' ||
        (listView === 'recent' && isRecent) ||
        (listView === 'needs_attention' && needsAttention) ||
        (listView === 'connected' && connectionCount > 0) ||
        (listView === 'undefined' && isUndefined) ||
        (listView === 'contested' && isContested) ||
        (listView === 'duplicates' && possibleDuplicates.length > 0) ||
        (listView === 'transformed' && isTransformed) ||
        (listView === 'neglected' && isNeglected);
      if (!matchesSearch || !matchesView) return null;

      let why = 'Part of the current concept vocabulary.';
      if (listView === 'recent') why = lastActiveAt ? `Last moved ${new Date(lastActiveAt).toLocaleDateString()}.` : 'Recently updated definition or linked event.';
      if (listView === 'needs_attention') why = 'Missing at least one definition, evidence, distinction, or practice signal.';
      if (listView === 'connected') why = `${connectionCount} linked object${connectionCount === 1 ? '' : 's'} depend on this concept.`;
      if (listView === 'undefined') why = 'Needs a clearer working definition or boundary test.';
      if (listView === 'contested') why = 'Shows tension, challenge, or inconsistent usage.';
      if (listView === 'duplicates') why = `Possible overlap with ${possibleDuplicates.join(', ')}. Distinguish, alias, or merge manually.`;
      if (listView === 'transformed') why = 'Has revision or transformation signals in its history.';
      if (listView === 'neglected') why = 'Has meaningful links but little recent movement.';

      return { name, concept: conceptDoc, related, diagnosis, maturity, connectionCount, lastActiveAt, why, possibleDuplicates, repairFlags };
    })
    .filter((row): row is ConceptListRow => Boolean(row))
    .sort((a, b) => {
      if (listView === 'recent' || listView === 'transformed') return b.lastActiveAt - a.lastActiveAt;
      if (listView === 'needs_attention') return b.repairFlags.length - a.repairFlags.length || a.maturity.score - b.maturity.score;
      if (listView === 'connected') return b.connectionCount - a.connectionCount;
      if (listView === 'neglected') return a.lastActiveAt - b.lastActiveAt;
      if (listView === 'duplicates') return b.possibleDuplicates.length - a.possibleDuplicates.length || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [allTerms, search, listView, concepts, media, insights, vault, drafts, practices, questions, timeline]);
  const conceptFiltersActive = Boolean(search.trim() || listView !== 'all');
  const activeConceptFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    listView !== 'all' ? `View: ${CONCEPT_LIST_VIEWS.find((item) => item.id === listView)?.label || listView}` : null,
  ].filter(Boolean) as string[];
  const clearConceptFilters = () => {
    setSearch('');
    setListView('all');
  };
  const totalConceptCount = allTerms.filter((name) => conceptKey(name) !== conceptKey(UNSORTED_CONCEPT)).length;
  const needsAttentionRows = conceptRows.filter((row) => row.repairFlags.length > 0 || row.maturity.label === 'beginning' || row.maturity.label === 'emerging');
  const matureConceptCount = conceptRows.filter((row) => row.maturity.label === 'stable').length;
  const developingConceptCount = conceptRows.filter((row) => row.maturity.label === 'usable').length;
  const emergingConceptCount = conceptRows.filter((row) => row.maturity.label === 'emerging' || row.maturity.label === 'beginning').length;
  const wellDevelopedCount = conceptRows.filter((row) => row.maturity.label === 'stable' || row.maturity.label === 'usable').length;
  const duplicateReviewCount = conceptRows.filter((row) => row.possibleDuplicates.length).length;
  const primaryConceptViews = CONCEPT_LIST_VIEWS.filter((view) => ['all', 'recent', 'needs_attention', 'connected'].includes(view.id));
  const moreConceptViews = CONCEPT_LIST_VIEWS.filter((view) => !primaryConceptViews.some((primary) => primary.id === view.id));
  const moreConceptViewActive = moreConceptViews.some((view) => view.id === listView);
  const maturitySummary = `${totalConceptCount} concepts · ${matureConceptCount} mature · ${developingConceptCount} developing · ${emergingConceptCount} emerging`;

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

  const openConceptDetail = (name: string, concept?: Concept | null) => {
    setSelectedName(name);
    setPositionDrafts([]);
    if (concept?.id) {
      onOpenConceptRoute?.(concept.id);
    }
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
      toast({ variant: "destructive", title: "Suggestion Failed", description: noesisUserError(error, "AI could not generate a description at this time.") });
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

  const conceptDeleteDialog = (
    <ConfirmActionDialog
      open={Boolean(deleteTarget)}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
      title="Delete concept?"
      description={`This removes "${deleteTarget?.name || 'this concept'}" from Concepts. Linked sources, inquiries, positions, works, and Evolution history will remain.`}
      confirmLabel="Delete Concept"
      destructive
      onConfirm={() => {
        if (!deleteTarget) return;
        onDeleteConcept(deleteTarget.id);
        if (selectedName && conceptKey(selectedName) === conceptKey(deleteTarget.name)) {
          setSelectedName(null);
          setPositionDrafts([]);
          setIsDefinitionEditing(false);
          onOpenConceptRoute?.(null);
        }
        setEditing(null);
        setEditorOpen(false);
        setDeleteTarget(null);
      }}
    />
  );

  const toggleConceptSource = (id: string) => {
    setDraftConcept(prev => {
      const current = prev.sourceIds || [];
      const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
      return { ...prev, sourceIds: next };
    });
  };

  const resolveConceptTension = (conceptName: string, a: VaultEntry, b: VaultEntry, type: ConceptTensionDecision) => {
    const decisionKey = `${a.id}-${b.id}`;
    setTensionDecisions((prev) => ({ ...prev, [decisionKey]: type }));
    onCreateLink?.({
      fromType: 'position',
      fromId: a.id,
      fromLabel: a.title || a.statement,
      toType: 'position',
      toId: b.id,
      toLabel: b.title || b.statement,
      type,
      note: `Concept tension review for "${conceptName}": ${a.title || a.statement} ${type.replace(/_/g, ' ')} ${b.title || b.statement}.`,
      createdFrom: 'manual',
      acceptedByUser: true,
    }, { creationMethod: 'concept_tension_resolution' });
    toast({
      title: 'Relationship recorded',
      description: `${type.replace(/_/g, ' ')} link created between these positions.`,
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
      toast({ variant: 'destructive', title: 'Check Failed', description: noesisUserError(error, 'Could not generate questions right now.') });
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
      toast({ variant: 'destructive', title: 'Builder Failed', description: noesisUserError(error, 'Noesis could not draft positions from this concept right now.') });
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
    const boundaryCases = Array.from(new Set([
      `A source uses ${selectedName} as a synonym for ${linkedConceptNames[0] || 'a neighboring idea'}.`,
      `A position depends on ${selectedName}, but only as a feeling or intuition rather than a clear claim.`,
      r.practices.length
        ? `A practice tries to test ${selectedName} through behavior instead of argument.`
        : `Someone claims ${selectedName} matters, but no lived test or practice is attached.`,
      r.annotations.length
        ? `An annotation uses ${selectedName} as a reaction to a passage rather than a defined idea.`
        : `A note mentions ${selectedName}, but gives no example, counterexample, or boundary.`,
      r.questions.length
        ? `An inquiry asks whether ${selectedName} changes when pressure, desire, or uncertainty enters.`
        : `A question could be formed from ${selectedName}, but the question has not been made explicit.`,
    ])).slice(0, 5);
    const boundaryKey = (boundaryCase: string) => `${conceptKey(selectedName)}:${boundaryCase}`;
    const answeredBoundaryCount = boundaryCases.filter((boundaryCase) => boundaryAnswers[boundaryKey(boundaryCase)]).length;
    const boundaryAnswerCounts = boundaryCases.reduce((acc, boundaryCase) => {
      const answer = boundaryAnswers[boundaryKey(boundaryCase)];
      if (answer) acc[answer] += 1;
      return acc;
    }, { inside: 0, outside: 0, depends: 0 } as Record<BoundaryAnswer, number>);
    const boundarySuggestion = boundaryAnswerCounts.depends > boundaryAnswerCounts.inside
      ? 'Your answers suggest this concept needs conditions: when does it apply, and what must be true first?'
      : boundaryAnswerCounts.outside > boundaryAnswerCounts.inside
        ? 'Your answers suggest the boundary may be too wide. Name what this concept is not.'
        : answeredBoundaryCount
          ? 'Your answers suggest the current boundary is usable, but examples and counterexamples would make it stronger.'
          : 'Classify edge cases to see whether the definition is too wide, too narrow, or condition-dependent.';
    const driftEvents = sortedEvents.filter((event) => /concept|definition|revise|transform|changed/i.test(`${event.eventType} ${event.reason || ''}`));
    const detailRepairFlags = conceptRepairFlags({
      concept,
      related: r,
      diagnosis,
      connectionCount: r.sources.length + r.annotations.length + r.questions.length + r.beliefs.length + r.drafts.length + r.practices.length,
      lastActiveAt: conceptActivityDate(concept, r.events),
      possibleDuplicates: possibleDuplicateConcepts(concept, selectedName, concepts),
    });
    const saveBoundaryRefinement = () => {
      if (!concept || !boundaryRefinement.trim()) return;
      const trimmed = boundaryRefinement.trim();
      const existingDefinition = concept.description?.trim() || '';
      onUpdateConcept({
        ...concept,
        description: `${existingDefinition}${existingDefinition ? '\n\n' : ''}Boundary note: ${trimmed}`,
        philosophyStatus: concept.philosophyStatus === 'undefined' ? 'emerging' : concept.philosophyStatus,
      });
      setBoundaryRefinement('');
      toast({ title: 'Boundary note added', description: 'The working definition now records this user-confirmed boundary refinement.' });
    };

    const back = () => {
      setSelectedName(null);
      setPositionDrafts([]);
      setIsDefinitionEditing(false);
      onOpenConceptRoute?.(null);
    };

    const startDefinitionEdit = () => {
      setDefinitionDraft(concept?.description || '');
      setIsDefinitionEditing(true);
    };

    const saveInlineDefinition = () => {
      if (!concept) return;
      const description = definitionDraft.trim();
      onUpdateConcept({
        ...concept,
        description,
        philosophyStatus: description ? (concept.philosophyStatus === 'undefined' ? 'emerging' : concept.philosophyStatus) : 'undefined',
        dateUpdated: new Date().toISOString(),
      });
      setIsDefinitionEditing(false);
      toast({ title: 'Definition updated', description: 'The concept definition was revised in place.' });
    };

    const updateConceptListField = (field: ConceptListField, nextValues: string[]) => {
      if (!concept) return;
      const normalized = Array.from(new Set(nextValues.map((value) => value.trim()).filter(Boolean)));
      onUpdateConcept({
        ...concept,
        [field]: normalized,
        philosophyStatus: concept.philosophyStatus === 'undefined' && normalized.length ? 'emerging' : concept.philosophyStatus,
        dateUpdated: new Date().toISOString(),
      });
    };

    const addConceptListItem = (field: ConceptListField) => {
      const value = conceptListDrafts[field]?.trim();
      if (!concept || !value) return;
      updateConceptListField(field, [...(concept[field] || []), value]);
      setConceptListDrafts((prev) => ({ ...prev, [field]: '' }));
      toast({ title: 'Concept boundary updated', description: `${value} was added to ${selectedName}.` });
    };

    const removeConceptListItem = (field: ConceptListField, value: string) => {
      if (!concept) return;
      updateConceptListField(field, (concept[field] || []).filter((item) => item !== value));
    };

    const conceptLanguageSections: Array<{ field: ConceptListField; title: string; prompt: string; placeholder: string }> = [
      { field: 'aliases', title: 'Aliases', prompt: 'Other words or phrases you use for this concept.', placeholder: 'Add alternate wording' },
      { field: 'notSameAs', title: 'Not The Same As', prompt: 'Neighboring ideas this concept should not collapse into.', placeholder: 'Add distinction' },
      { field: 'examples', title: 'Examples', prompt: 'Cases that clearly belong inside the concept.', placeholder: 'Add example' },
      { field: 'counterexamples', title: 'Counterexamples', prompt: 'Cases that test or fall outside the boundary.', placeholder: 'Add counterexample' },
    ];
    const isRoutedConcept = Boolean(concept && focusedConceptId === concept.id);
    const previewSource = (source: Media, reason = 'This source feeds the current concept.') => {
      openNoesisObjectPreview({
        id: `concept-source-${source.id}`,
        label: source.title,
        section: 'Related Source',
        description: source.description || source.creator || 'Source linked to this concept.',
        view: 'library',
        targetId: source.id,
        targetType: 'source',
        objectType: source.type || 'source',
        kind: 'object',
        intellectualStage: 'Encounter',
        hierarchyLevel: 'Raw',
        activityClass: 'orientation',
        currentState: source.status || 'source',
        summary: source.description || source.capture?.after?.coreArgument || source.capture?.before?.reasonForAdding || '',
        connectedConcepts: source.tags || [selectedName],
        relatedObjects: [selectedName],
        lastChangedAt: source.dateUpdated || source.dateAdded,
        matchedBecause: reason,
        quickActionLabel: 'Open Source',
      });
    };

    const previewInquiry = (question: Question) => {
      openNoesisObjectPreview({
        id: `concept-inquiry-${question.id}`,
        label: question.text,
        section: 'Related Inquiry',
        description: question.answer || 'Open question connected to this concept.',
        view: 'questions',
        targetId: question.id,
        targetType: 'inquiry',
        objectType: 'inquiry',
        kind: 'object',
        intellectualStage: 'Question',
        hierarchyLevel: 'Interpretive',
        activityClass: 'meaningful',
        thinkingEventHint: 'Opening or revising this inquiry should preserve its thinking history.',
        currentState: question.status || (question.answer ? 'partially_answered' : 'open'),
        summary: question.answer || question.currentIntuition || question.whyItMatters || '',
        connectedConcepts: [selectedName],
        relatedObjects: (question.sourceIds || []).length ? (question.sourceIds || []).map((id) => `Source: ${id}`) : [selectedName],
        lastChangedAt: question.dateUpdated || question.dateCreated,
        matchedBecause: 'This inquiry depends on the concept boundary or its evidence.',
        quickActionLabel: 'Open Inquiry',
      });
    };

    const previewPosition = (entry: VaultEntry) => {
      openNoesisObjectPreview({
        id: `concept-position-${entry.id}`,
        label: entry.title || entry.statement,
        section: 'Related Position',
        description: entry.statement || entry.description || 'Position using this concept as judgment.',
        view: 'vault',
        targetId: entry.id,
        targetType: 'position',
        objectType: entry.type || 'position',
        kind: 'object',
        intellectualStage: 'Judge',
        hierarchyLevel: 'Judgment',
        activityClass: 'meaningful',
        thinkingEventHint: 'Position changes should create thinking events and update belief biography.',
        currentState: entry.status || 'active',
        summary: entry.description || entry.statement || '',
        connectedConcepts: entry.tags || [selectedName],
        relatedObjects: [...(entry.sourceIds || []).map((id: string) => `Source: ${id}`), selectedName],
        lastChangedAt: entry.dateUpdated || entry.dateCreated,
        matchedBecause: 'This position uses the selected concept as part of its claim or scope.',
        quickActionLabel: 'Open Position',
      });
    };

    const previewWork = (draft: Draft) => {
      openNoesisObjectPreview({
        id: `concept-work-${draft.id}`,
        label: draft.title,
        section: 'Related Work',
        description: draft.body || 'Work expressing this concept.',
        view: 'writing',
        targetId: draft.id,
        targetType: 'work',
        objectType: draft.type || 'work',
        kind: 'object',
        intellectualStage: 'Express',
        hierarchyLevel: 'Expression',
        activityClass: 'meaningful',
        currentState: draft.status || 'draft',
        summary: draft.body || '',
        connectedConcepts: draft.conceptTags || [selectedName],
        relatedObjects: [...(draft.beliefIds || []).map((id) => `Position: ${id}`), ...(draft.questionIds || []).map((id) => `Inquiry: ${id}`)],
        lastChangedAt: draft.dateUpdated || draft.dateCreated,
        matchedBecause: 'This work expresses or develops the selected concept.',
        quickActionLabel: 'Open Work',
      });
    };

    const previewPractice = (practice: Practice) => {
      openNoesisObjectPreview({
        id: `concept-practice-${practice.id}`,
        label: practice.title,
        section: 'Related Practice',
        description: practice.description || practice.notes || 'Practice testing this concept in lived behavior.',
        view: 'practices',
        targetId: practice.id,
        targetType: 'practice',
        objectType: practice.type || 'practice',
        kind: 'object',
        intellectualStage: 'Test',
        hierarchyLevel: 'Expression',
        activityClass: 'meaningful',
        thinkingEventHint: 'Practice logs and outcomes should feed back into positions and evolution.',
        currentState: practice.status || 'planned',
        summary: practice.notes || practice.description || '',
        connectedConcepts: practice.conceptTags || [selectedName],
        relatedObjects: [...(practice.positionIds || []).map((id) => `Position: ${id}`), ...(practice.questionIds || []).map((id) => `Inquiry: ${id}`)],
        lastChangedAt: practice.dateUpdated || practice.dateCreated,
        matchedBecause: 'This practice tests the selected concept outside the page.',
        quickActionLabel: 'Open Practice',
      });
    };

    const previewAnnotationSource = (annotation: (typeof r.annotations)[number]) => {
      previewSource(annotation.source, `This ${annotation.type} annotation mentions or is tagged with ${selectedName}.`);
    };

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
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(concept)} className="h-8 shadow-sm rounded-full">
                  <Trash2 className="size-4 mr-2" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="p-8 pt-10 max-w-5xl mx-auto">
          {isRoutedConcept && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
              <div>
                <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-accent">Concepts Detail Route</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  This concept is opened directly from the URL. Browser refresh and back/forward keep this vocabulary page in focus.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={back} className="rounded-full bg-background">
                Return to Concepts
              </Button>
            </div>
          )}
          {/* Title + definition */}
          <div className="mb-8">
            <h1 className="text-[42px] font-headline font-bold italic text-primary leading-none mb-4">{selectedName}</h1>
            {isDefinitionEditing ? (
              <div className="max-w-3xl space-y-3 rounded-xl border border-accent/20 bg-white p-4 shadow-sm">
                <Textarea
                  value={definitionDraft}
                  onChange={(event) => setDefinitionDraft(event.target.value)}
                  className="min-h-[120px] text-base leading-7"
                  placeholder="Write the current working definition for this concept."
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={saveInlineDefinition} disabled={!concept} className="h-8 rounded-full px-5">
                    Save Definition
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsDefinitionEditing(false)} className="h-8 rounded-full px-5">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : concept?.description ? (
              <div className="max-w-3xl">
                <p className="text-lg text-muted-foreground font-body leading-relaxed">{concept.description}</p>
                <Button variant="ghost" size="sm" onClick={startDefinitionEdit} className="mt-2 h-8 rounded-full px-3 text-muted-foreground hover:text-foreground">
                  <Edit className="mr-2 size-3.5" /> Edit Definition
                </Button>
              </div>
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

            <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-widest text-accent/80 font-bold">Definition Diagnostics</div>
                  <p className="mt-1 text-sm text-muted-foreground">Concrete repairs that make this concept easier to use consistently.</p>
                </div>
                <Badge variant="outline" className="rounded-full">{detailRepairFlags.length || 1} signal{detailRepairFlags.length === 1 ? '' : 's'}</Badge>
              </div>
              {detailRepairFlags.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {detailRepairFlags.slice(0, 6).map((flag) => (
                    <div key={flag.id} className={cn(
                      "rounded-xl border px-3 py-2",
                      flag.tone === 'urgent' ? "border-rose-200 bg-rose-50 text-rose-950" :
                      flag.tone === 'review' ? "border-amber-200 bg-amber-50 text-amber-950" :
                      "border-border/40 bg-card text-foreground"
                    )}>
                      <div className="font-code text-[8px] uppercase tracking-widest font-bold">{flag.label}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{flag.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">No major repair signal is visible. Keep using the concept and record definition changes when its meaning shifts.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Working Definition</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {concept?.description || 'Undefined. Write a provisional definition before treating this concept as stable.'}
                </p>
                <Button variant="outline" size="sm" onClick={startDefinitionEdit} disabled={!concept} className="mt-3 h-8 rounded-full">
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
                          openConceptDetail(name, concepts.find((item) => conceptKey(item.name) === conceptKey(name)));
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
              <div className="mb-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold">Language & Boundaries</div>
                <p className="mt-1 text-sm text-muted-foreground">Name aliases, distinctions, examples, and counterexamples so this concept keeps its shape across the app.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {conceptLanguageSections.map((section) => {
                  const values = concept?.[section.field] || [];
                  return (
                    <div key={section.field} className="rounded-xl border border-border/30 bg-card p-3">
                      <div className="mb-2">
                        <div className="font-code text-[8px] uppercase tracking-widest text-foreground/60 font-bold">{section.title}</div>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{section.prompt}</p>
                      </div>
                      {values.length ? (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {values.map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => removeConceptListItem(section.field, value)}
                              className="rounded-full border border-border/50 bg-background px-2.5 py-1 text-left text-[11px] text-foreground/80 transition-colors hover:border-destructive/40 hover:text-destructive"
                              title="Remove this item"
                            >
                              {value} <span className="ml-1 text-muted-foreground">×</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-3 text-xs italic text-muted-foreground/60">No entries yet.</p>
                      )}
                      <div className="flex gap-2">
                        <Input
                          value={conceptListDrafts[section.field]}
                          onChange={(event) => setConceptListDrafts((prev) => ({ ...prev, [section.field]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addConceptListItem(section.field);
                            }
                          }}
                          placeholder={section.placeholder}
                          className="h-8 rounded-full text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addConceptListItem(section.field)}
                          disabled={!concept || !conceptListDrafts[section.field]?.trim()}
                          className="h-8 shrink-0 rounded-full px-3"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  );
                })}
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

          {/* Boundary Test */}
          <div className="rounded-xl border border-border/30 bg-white shadow-sm p-6 mb-10">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold">Boundary Test</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Classify edge cases so this concept becomes clearer without letting AI or the app decide the definition for you.
                </p>
              </div>
              <Badge variant="outline" className="w-fit rounded-full">
                {answeredBoundaryCount}/{boundaryCases.length} classified
              </Badge>
            </div>

            <div className="grid gap-3">
              {boundaryCases.map((boundaryCase, index) => {
                const key = boundaryKey(boundaryCase);
                const selected = boundaryAnswers[key];
                return (
                  <div key={boundaryCase} className="rounded-xl border border-border/40 bg-background/70 p-4">
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-code text-[10px] font-bold text-accent">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-foreground/80">{boundaryCase}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {([
                            ['inside', 'Inside'],
                            ['outside', 'Outside'],
                            ['depends', 'Depends'],
                          ] as Array<[BoundaryAnswer, string]>).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setBoundaryAnswers((prev) => ({ ...prev, [key]: value }))}
                              className={cn(
                                'rounded-full border px-3 py-1 font-code text-[9px] uppercase tracking-widest transition-colors',
                                selected === value
                                  ? 'border-accent bg-accent text-white'
                                  : 'border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground'
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="font-code text-[9px] uppercase tracking-widest text-accent font-bold">Refinement Prompt</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{boundarySuggestion}</p>
              <div className="mt-4 grid gap-3">
                <Textarea
                  value={boundaryRefinement}
                  onChange={(event) => setBoundaryRefinement(event.target.value)}
                  placeholder={`Example: ${selectedName} includes..., but it does not include...`}
                  className="min-h-24 rounded-xl"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Saving appends a user-written boundary note to the working definition and records the concept update through the normal concept flow.
                  </p>
                  <Button onClick={saveBoundaryRefinement} disabled={!concept || !boundaryRefinement.trim()} className="rounded-full">
                    Save Boundary Note
                  </Button>
                </div>
              </div>
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
                  <button key={s.id} type="button" onClick={() => previewSource(s)} className="w-full rounded-xl bg-card border border-border/40 shadow-sm p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">{s.type}{s.year ? ` · ${s.year}` : ''}</div>
                    <p className="text-sm font-body font-semibold text-primary leading-snug">{s.title}</p>
                    {s.creator && <p className="text-xs text-muted-foreground font-body mt-0.5">{s.creator}</p>}
                  </button>
                ))}
              </div>
            </ConceptPageSection>

            <ConceptPageSection title="Related Annotations" count={r.annotations.length} empty="No annotations tagged with this concept yet.">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {r.annotations.slice(0, 8).map((a, i) => (
                  <button key={`${a.source.id}-${i}`} type="button" onClick={() => previewAnnotationSource(a)} className="w-full rounded-xl bg-card border border-border/40 shadow-sm p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                    <span className="font-code text-[8px] uppercase tracking-widest text-accent/70 font-bold">{a.type}</span>
                    <p className="text-sm font-body italic text-primary/80 line-clamp-3 mt-1">"{a.text}"</p>
                    <p className="text-[10px] text-muted-foreground/40 font-body mt-1.5">{a.source.title}</p>
                  </button>
                ))}
              </div>
            </ConceptPageSection>
          </div>

          {/* Inquiries + Positions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <ConceptPageSection title="Related Inquiries" count={r.questions.length} empty="No inquiries linked to this concept.">
              <div className="space-y-3">
                {r.questions.map((q) => (
                  <button key={q.id} type="button" onClick={() => previewInquiry(q)} className="w-full rounded-xl bg-card border border-border/40 shadow-sm p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                    <p className="text-sm font-body text-primary/90 mb-2">{q.text}</p>
                    {q.answer ? (
                      <p className="text-xs text-muted-foreground font-body italic line-clamp-2 border-t border-border/20 pt-2">{q.answer}</p>
                    ) : (
                      <span className="font-code text-[8px] uppercase tracking-widest text-amber-600 font-bold">Open</span>
                    )}
                  </button>
                ))}
              </div>
            </ConceptPageSection>

            <ConceptPageSection title="Related Positions" count={r.beliefs.length} empty="No positions formed around this concept yet.">
              <div className="space-y-3">
                {r.beliefs.map((b) => (
                  <button key={b.id} type="button" onClick={() => previewPosition(b)} className="w-full rounded-xl bg-card border border-border/40 shadow-sm p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
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
                  </button>
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

          {/* Works + Practices */}
          {(r.drafts.length > 0 || r.practices.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <ConceptPageSection title="Related Works" count={r.drafts.length} empty="No works express this concept yet.">
                <div className="space-y-3">
                  {r.drafts.slice(0, 6).map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => previewWork(draft)}
                      className="w-full rounded-xl bg-card border border-border/40 shadow-sm p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">{draft.type || 'work'}{draft.status ? ` · ${draft.status}` : ''}</div>
                      <p className="text-sm font-headline font-bold italic text-primary mb-1">{draft.title}</p>
                      {draft.body && <p className="text-xs font-body text-muted-foreground line-clamp-2">{draft.body}</p>}
                    </button>
                  ))}
                </div>
              </ConceptPageSection>

              <ConceptPageSection title="Related Practices" count={r.practices.length} empty="No practices test this concept yet.">
                <div className="space-y-3">
                  {r.practices.slice(0, 6).map((practice) => (
                    <button
                      key={practice.id}
                      type="button"
                      onClick={() => previewPractice(practice)}
                      className="w-full rounded-xl bg-card border border-border/40 shadow-sm p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">{practice.type || 'practice'}{practice.status ? ` · ${practice.status}` : ''}</div>
                      <p className="text-sm font-body font-semibold text-primary leading-snug">{practice.title}</p>
                      {(practice.description || practice.notes) && (
                        <p className="mt-1 text-xs font-body text-muted-foreground line-clamp-2">{practice.description || practice.notes}</p>
                      )}
                    </button>
                  ))}
                </div>
              </ConceptPageSection>
            </div>
          )}

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
                        <div className="mt-4 border-t border-amber-100 pt-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="font-code text-[8px] uppercase tracking-widest text-amber-700/70 font-bold">Resolve Relationship</p>
                            {tensionDecisions[`${a.id}-${b.id}`] && (
                              <span className="rounded-full border border-amber-200 bg-amber-100/70 px-2 py-0.5 font-code text-[8px] uppercase tracking-widest text-amber-800">
                                {tensionDecisions[`${a.id}-${b.id}`].replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {CONCEPT_TENSION_DECISIONS.map((decision) => {
                              const selected = tensionDecisions[`${a.id}-${b.id}`] === decision.id;
                              return (
                                <Button
                                  key={decision.id}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resolveConceptTension(selectedName, a, b, decision.id)}
                                  className={cn(
                                    'h-auto justify-start rounded-lg px-3 py-2 text-left whitespace-normal border-amber-100 bg-white text-foreground hover:bg-amber-50',
                                    selected && 'border-amber-400 bg-amber-100 text-amber-950 shadow-sm'
                                  )}
                                >
                                  <span className="block">
                                    <span className="block font-code text-[9px] uppercase tracking-widest font-bold">{decision.label}</span>
                                    <span className="mt-0.5 block text-[11px] normal-case tracking-normal text-muted-foreground">{decision.description}</span>
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-[11px] text-amber-700/70">
                            Choosing one creates a typed link, so Atlas and Positions can remember how these claims relate.
                          </p>
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
                <Button variant="destructive" onClick={() => setDeleteTarget(editing)} className="rounded-full px-6">
                  <Trash2 className="size-4 mr-2" /> Delete
                </Button>
              )}
              <Button onClick={saveConcept} className="bg-accent shadow-md shadow-accent/20 rounded-full px-8">Anchor Concept</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {conceptDeleteDialog}

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
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-4xl">
          <h1 className="text-[28px] font-headline font-semibold italic text-foreground/80">Concepts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground font-body">Build the vocabulary lab for definitions, boundaries, consistency, and conceptual drift.</p>
          <p className="mt-3 font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">{maturitySummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 shadow-md shadow-accent/20 rounded-full h-9">
            <Plus className="size-4 mr-1.5" /> NEW CONCEPT
          </Button>
        </div>
      </header>

      <div className="mb-6 hidden grid-cols-1 gap-3 md:grid lg:grid-cols-[1fr_1.4fr]">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={totalConceptCount} label="Concepts" sub="Vocabulary size" />
          <Stat value={wellDevelopedCount} label="Well Developed" sub="Ready for argument" />
          <button
            type="button"
            onClick={() => setListView('needs_attention')}
            className={cn(
              "text-left transition-all",
              listView === 'needs_attention' && "ring-2 ring-accent/40 rounded-xl"
            )}
          >
            <Stat value={needsAttentionRows.length} label="Need Attention" sub="Definition, evidence, or tests" tone="warning" />
          </button>
        </div>
        {needsAttentionRows.length > 0 ? (
          <Card className="flex flex-col justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-code text-[9px] font-bold uppercase tracking-widest text-amber-800">
                {needsAttentionRows.length} concept{needsAttentionRows.length === 1 ? '' : 's'} need attention
              </div>
              <p className="mt-1 text-xs leading-5 text-amber-900/80">
                Most are missing distinctions, evidence, or practical tests.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setListView('needs_attention')}
              className="h-8 rounded-full border-amber-300 bg-white/70 font-code text-[9px] uppercase tracking-widest text-amber-900 hover:bg-white"
            >
              Review them
            </Button>
          </Card>
        ) : (
          <Card className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm">
            <div>
              <div className="font-code text-[9px] font-bold uppercase tracking-widest text-emerald-800">Vocabulary stable</div>
              <p className="mt-1 text-xs leading-5 text-emerald-900/75">Every visible concept has a usable definition path.</p>
            </div>
            <CheckCircle2 className="size-5 text-emerald-700" />
          </Card>
        )}
      </div>

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search concepts, aliases, boundaries..."
        searchLabel="Search concepts"
        resultCount={conceptRows.length}
        resultLabel="concepts"
        sortLabel={listView === 'recent' || listView === 'transformed' ? 'Recently changed first' : listView === 'connected' ? 'Most connected first' : 'Alphabetical'}
        activeFilterLabels={activeConceptFilterLabels}
        onClear={clearConceptFilters}
        clearDisabled={!conceptFiltersActive}
        className="mb-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          {primaryConceptViews.map((view) => {
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
          <Select value={moreConceptViewActive ? listView : 'more'} onValueChange={(value) => setListView(value as ConceptListView)}>
            <SelectTrigger className={cn(
              'h-8 w-[150px] rounded-full border bg-background/70 px-3 font-code text-[9px] uppercase tracking-[0.14em]',
              moreConceptViewActive ? 'border-accent text-accent' : 'border-border text-muted-foreground'
            )}>
              <SelectValue placeholder="More Filters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="more" disabled className="font-code text-[10px] uppercase">More Filters</SelectItem>
              {moreConceptViews.map((view) => (
                <SelectItem key={view.id} value={view.id} className="font-code text-[10px] uppercase">
                  {view.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterToolbar>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
        {conceptRows.map(({ name, concept, related, diagnosis: diag, maturity, connectionCount, possibleDuplicates, repairFlags }) => {

          return (
            <Card
              key={name}
              className="rounded-xl p-4 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group bg-card shadow-md border border-accent/20 md:p-5"
              onClick={() => {
                openConceptDetail(name, concept);
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
                    <span className={cn(
                      'font-code text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border',
                      maturity.label === 'stable'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : maturity.label === 'usable'
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : maturity.label === 'emerging'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                    )}>
                      {maturity.label}
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

              <div className="mb-4 rounded-xl border border-border/50 bg-background/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60">
                    {connectionCount} linked object{connectionCount === 1 ? '' : 's'}
                  </div>
                  <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                    {maturity.missing.length ? `${maturity.missing.length} gaps` : 'ready'}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground/75">
                  Next: {maturity.nextStep}
                </p>
              </div>

              {possibleDuplicates.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="font-code text-[8px] uppercase tracking-widest text-amber-700 font-bold">Duplicate Review</div>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Compare with {possibleDuplicates.join(', ')} before merging or treating these as separate ideas.
                  </p>
                </div>
              )}

              {repairFlags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {repairFlags.slice(0, 4).map((flag) => (
                    <span
                      key={flag.id}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-code text-[8px] font-bold uppercase tracking-widest",
                        flag.tone === 'urgent' ? "border-rose-200 bg-rose-50 text-rose-800" :
                        flag.tone === 'review' ? "border-amber-200 bg-amber-50 text-amber-800" :
                        "border-border/40 bg-muted/20 text-muted-foreground"
                      )}
                      title={flag.detail}
                    >
                      {flag.label}
                    </span>
                  ))}
                </div>
              )}

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
              <Button variant="destructive" onClick={() => setDeleteTarget(editing)} className="rounded-full px-6">
                <Trash2 className="size-4 mr-2" /> Delete
              </Button>
            )}
            <Button onClick={saveConcept} className="bg-accent shadow-md shadow-accent/20 rounded-full px-8">Anchor Concept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {conceptDeleteDialog}
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

function Stat({ value, label, sub, tone = 'default' }: { value: number | string; label: string; sub: string; tone?: 'default' | 'warning' }) {
  return (
    <Card className={cn(
      "bg-white border shadow-sm p-4 h-20 flex flex-col justify-center rounded-xl",
      tone === 'warning' ? "border-amber-200" : "border-accent/10"
    )}>
      <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">{label}</div>
      <div className={cn("mt-1 text-2xl font-headline font-bold leading-none", tone === 'warning' ? "text-amber-700" : "text-accent")}>{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground/40 truncate font-body">{sub}</div>
    </Card>
  );
}
