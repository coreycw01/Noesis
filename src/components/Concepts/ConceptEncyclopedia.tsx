
"use client";

import { aiDepthFor } from '@/lib/ai-depth';
import { workspaceScrollBehavior } from '@/lib/appearance';

import React, { useEffect, useMemo, useState } from 'react';
import { persistedConceptRecords } from '@/lib/workspace-counts';
import { LabeledField } from '@/components/shared/LabeledField';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, ChevronDown, Edit, Plus, Trash2, MoreHorizontal } from 'lucide-react';
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
import { activateEntityOnKey, isEntitySurfaceClick } from '@/lib/entity-activation';
import { NOESIS_ICONS } from '@/lib/noesis-icons';

const ConceptIcon = NOESIS_ICONS.concept;
import { StageBadge } from '@/components/shared/StageBadge';
import { computeConceptDiagnosis, CLARITY_BG } from '@/lib/clarity';
import type { ClarityLevel } from '@/lib/clarity';
import { ConceptDiagnosisBars } from '@/components/Concepts/ConceptDiagnosisBars';
import { ConceptCaliper } from '@/components/Concepts/ConceptCaliper';
import { ThroughConcept } from '@/components/shared/ThroughConcept';
import { useToast } from '@/hooks/use-toast';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { FilterToolbar, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { WorkbenchFlow } from '@/components/shared/WorkbenchFlow';
import { DetailLabel } from '@/components/shared/PageHeader';
import { PageHeader } from '@/components/shared/PageHeader';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';
import { ContextualAiDocument, ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ContextualAiAction } from '@/lib/contextual-ai';
import { conceptReviewTarget, type ConceptReviewApproval } from '@/lib/concept-ai-review';
import { AiProvenanceBadge } from '@/components/ai/AiProvenanceBadge';
import type { AiSettings } from '@/lib/types';

interface ConceptEncyclopediaProps {
  concepts: Concept[];
  media: Media[];
  insights: Insight[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  onAddConcept: (data: Partial<Concept>) => void | boolean | Promise<void | boolean>;
  onUpdateConcept: (concept: Concept, approval?: ConceptReviewApproval) => void | Promise<void>;
  onDeleteConcept: (id: string) => void;
  onCreateIdea: (data: { title: string; body: string; tags: string[]; sourceIds: string[] }) => void;
  onCreateLink?: (data: Partial<PhilosophicalLink>, options?: { creationMethod?: string }) => void;
  focusedConceptId?: string | null;
  onOpenConceptRoute?: (id: string | null) => void;
  aiSettings?: AiSettings;
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
type ConceptListField = 'aliases' | 'opposedTo' | 'notSameAs' | 'examples' | 'counterexamples';
const RELATION_FIELDS: ConceptListField[] = ['aliases', 'opposedTo', 'notSameAs'];
const RELATION_TONES: Partial<Record<ConceptListField, string>> = { aliases: 'act', opposedTo: 'claim', notSameAs: 'encounter' };
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
    flags.push({ id: 'boundaries', label: 'Boundary', detail: 'Add distinctions or counterexamples so neighboring concepts do not collapse together.', tone: 'review' });
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
  const { concepts, media, insights, vault, drafts, practices = [], questions, timeline, onAddConcept, onUpdateConcept: persistConcept, onDeleteConcept, onCreateIdea, onCreateLink, focusedConceptId, onOpenConceptRoute, aiSettings } = props;
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useEntityViewPreference('concepts');
  // The prototype's list-and-detail split is the default way to browse concepts.
  const [cardLayout, setCardLayout] = usePersistentView<'split' | 'cards'>('noesis:concepts-card-layout', 'split', ['split', 'cards']);
  const splitView = cardLayout === 'split';
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [listView, setListView] = useState<ConceptListView>('all');
  const [localSelectedName, setSelectedName] = useState<string | null>(null);
  const focusedConcept = concepts.find((concept) => concept.id === focusedConceptId);
  const selectedName = onOpenConceptRoute ? focusedConcept?.name ?? null : localSelectedName;
  const [conceptWorkflowStep, setConceptWorkflowStep] = useState<'define' | 'boundaries' | 'diagnose' | 'connect' | 'history'>('define');
  const [editing, setEditing] = useState<Concept | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingConcept, setSavingConcept] = useState(false);
  const conceptSaveLock = React.useRef(false);
  const [draftConcept, setDraftConcept] = useState<Partial<Concept>>({ name: '', description: '', sourceIds: [] });
  const [boundaryAnswers, setBoundaryAnswers] = useState<Record<string, BoundaryAnswer>>({});
  const [boundaryRefinement, setBoundaryRefinement] = useState('');
  const [tensionDecisions, setTensionDecisions] = useState<Record<string, ConceptTensionDecision>>({});
  const [isDefinitionEditing, setIsDefinitionEditing] = useState(false);
  const [definitionDraft, setDefinitionDraft] = useState('');
  const [shelfQuery, setShelfQuery] = useState('');
  const [dropField, setDropField] = useState<ConceptListField | null>(null);
  const [conceptListDrafts, setConceptListDrafts] = useState<Record<ConceptListField, string>>({
    aliases: '',
    opposedTo: '',
    notSameAs: '',
    examples: '',
    counterexamples: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<Concept | null>(null);
  const { toast } = useToast();
  
  const allTerms = useMemo(() => conceptTerms(concepts, media, insights, vault, drafts, practices), [concepts, media, insights, vault, drafts, practices]);
  const countableConcepts = useMemo(() => persistedConceptRecords(concepts), [concepts]);
  const selectedRelated = useMemo(() => selectedName ? conceptRelated(selectedName, { media, insights, vault, drafts, practices, questions, timeline }) : null, [selectedName, media, insights, vault, drafts, practices, questions, timeline]);

  useEffect(() => {
    if (onOpenConceptRoute || !focusedConcept) return;
    if (focusedConcept && conceptKey(focusedConcept.name) !== conceptKey(selectedName || '')) {
      setSelectedName(focusedConcept.name);
    }
  }, [focusedConcept, onOpenConceptRoute, selectedName]);
  
  const conceptRows = useMemo<ConceptListRow[]>(() => {
    return allTerms
      .map((name) => {
      const isUnsorted = conceptKey(name) === conceptKey(UNSORTED_CONCEPT);
      if (isUnsorted) return null;
      const conceptDoc = countableConcepts.find(c => conceptKey(c.name) === conceptKey(name));
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
  }, [allTerms, countableConcepts, search, listView, concepts, media, insights, vault, drafts, practices, questions, timeline]);
  const conceptFiltersActive = Boolean(search.trim() || listView !== 'all');
  const activeConceptFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    listView !== 'all' ? `View: ${CONCEPT_LIST_VIEWS.find((item) => item.id === listView)?.label || listView}` : null,
  ].filter(Boolean) as string[];
  const clearConceptFilters = () => {
    setSearch('');
    setListView('all');
  };
  // The list already excludes tag-only placeholders and non-displayable
  // records. Its unfiltered default is the same user-ready set represented by
  // the shell count, so the page headline must use that set too.
  const totalConceptCount = conceptRows.length;
  const needsAttentionRows = conceptRows.filter((row) => row.repairFlags.length > 0 || row.maturity.label === 'beginning' || row.maturity.label === 'emerging');
  const matureConceptCount = conceptRows.filter((row) => row.maturity.label === 'stable').length;
  const developingConceptCount = conceptRows.filter((row) => row.maturity.label === 'usable').length;
  const emergingConceptCount = conceptRows.filter((row) => row.maturity.label === 'emerging' || row.maturity.label === 'beginning').length;
  const wellDevelopedCount = conceptRows.filter((row) => row.maturity.label === 'stable' || row.maturity.label === 'usable').length;
  const duplicateReviewCount = conceptRows.filter((row) => row.possibleDuplicates.length).length;
  const primaryConceptViews = CONCEPT_LIST_VIEWS.filter((view) => ['all', 'recent', 'needs_attention', 'connected'].includes(view.id));
  const moreConceptViews = CONCEPT_LIST_VIEWS.filter((view) => !primaryConceptViews.some((primary) => primary.id === view.id));
  const moreConceptViewActive = moreConceptViews.some((view) => view.id === listView);
  const maturitySummary = `${conceptFiltersActive ? `${totalConceptCount} matching of ${countableConcepts.length}` : totalConceptCount} concepts · ${matureConceptCount} mature · ${developingConceptCount} developing · ${emergingConceptCount} emerging`;

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
    setConceptWorkflowStep('define');
    if (onOpenConceptRoute && concept?.id) onOpenConceptRoute(concept.id);
    else setSelectedName(name);
  };

  const onUpdateConcept = async (concept: Concept) => {
    try {
      await persistConcept(concept);
      return true;
    } catch {
      toast({ title: 'Concept not saved', description: 'Your changes are still available. Please retry.', variant: 'destructive' });
      return false;
    }
  };

  const saveConcept = async () => {
    const name = (draftConcept.name || '').trim();
    if (!name || conceptSaveLock.current) return;
    conceptSaveLock.current = true;
    setSavingConcept(true);
    try {
      if (editing) {
        if (!await onUpdateConcept({
          ...editing,
          name,
          description: draftConcept.description || '',
          sourceIds: draftConcept.sourceIds || [],
          dateUpdated: new Date().toISOString()
        })) return;
      } else {
        const saved = await onAddConcept({
          name,
          description: draftConcept.description || '',
          sourceIds: draftConcept.sourceIds || [],
          createdFrom: 'manual'
        });
        if (saved === false) throw new Error('Concept was not persisted.');
      }
      setEditing(null);
      setEditorOpen(false);
      setDraftConcept({ name: '', description: '', sourceIds: [] });
    } catch {
      toast({ title: 'Concept not saved', description: 'Your draft is still here. Please retry.', variant: 'destructive' });
    } finally { conceptSaveLock.current = false; setSavingConcept(false); }
  };

  const conceptEditorDialog = (
    <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) { setEditing(null); setDraftConcept({ name: '', description: '', sourceIds: [] }); } }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto rounded-2xl border-none bg-card shadow-2xl">
        <DialogHeader><DialogTitle className="font-headline text-2xl italic">{editing ? 'Edit Concept' : 'New Concept'}</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">
          <LabeledField label="Concept name"><Input value={draftConcept.name} onChange={(event) => setDraftConcept((previous) => ({ ...previous, name: event.target.value }))} /></LabeledField>
          <LabeledField label="Definition"><Textarea value={draftConcept.description} onChange={(event) => setDraftConcept((previous) => ({ ...previous, description: event.target.value }))} className="min-h-[120px]" placeholder="What does this concept mean to you? How do you understand it?" /></LabeledField>
          <SourceLinker media={media} selectedIds={draftConcept.sourceIds || []} onToggle={(id) => toggleConceptSource(id)} label="Linked sources" />
        </div>
        <DialogFooter className="gap-2 pt-4">
          {editing && <Button variant="destructive" disabled={savingConcept} onClick={() => { setEditorOpen(false); setDeleteTarget(editing); }}><Trash2 className="mr-2 size-4" />Delete</Button>}
          <Button onClick={saveConcept} disabled={savingConcept || !draftConcept.name?.trim()}>{savingConcept ? 'Saving…' : 'Save concept'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

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
    const boundaryCases = Array.from(new Set([
      `A source uses ${selectedName} as a synonym for ${linkedConceptNames[0] || 'a neighboring concept'}.`,
      `A position depends on ${selectedName}, but only as a feeling or intuition rather than a clear claim.`,
      r.practices.length
        ? `A practice tries to test ${selectedName} through behavior instead of argument.`
        : `Someone claims ${selectedName} matters, but no lived test or practice is attached.`,
      r.annotations.length
        ? `An annotation uses ${selectedName} as a reaction to a passage rather than a defined concept.`
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
    const saveBoundaryRefinement = async () => {
      if (!concept || !boundaryRefinement.trim()) return;
      const trimmed = boundaryRefinement.trim();
      const existingDefinition = concept.description?.trim() || '';
      if (!await onUpdateConcept({
        ...concept,
        description: `${existingDefinition}${existingDefinition ? '\n\n' : ''}Boundary note: ${trimmed}`,
        philosophyStatus: concept.philosophyStatus === 'undefined' ? 'emerging' : concept.philosophyStatus,
      })) return;
      setBoundaryRefinement('');
      toast({ title: 'Boundary note added', description: 'The working definition now records this user-confirmed boundary refinement.' });
    };

    const back = () => {
      setSelectedName(null);
      setIsDefinitionEditing(false);
      onOpenConceptRoute?.(null);
    };

    const startDefinitionEdit = () => {
      setDefinitionDraft(concept?.description || '');
      setIsDefinitionEditing(true);
    };

    const saveInlineDefinition = async () => {
      if (!concept) return;
      const description = definitionDraft.trim();
      if (!await onUpdateConcept({
        ...concept,
        description,
        philosophyStatus: description ? (concept.philosophyStatus === 'undefined' ? 'emerging' : concept.philosophyStatus) : 'undefined',
        dateUpdated: new Date().toISOString(),
      })) return;
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

    const otherConceptNames = Array.from(new Set(concepts.map((item) => item.name).filter((name) => name && conceptKey(name) !== conceptKey(selectedName)))).sort((a, b) => a.localeCompare(b));
    const shelfConcepts = otherConceptNames.filter((name) => !shelfQuery.trim() || name.toLowerCase().includes(shelfQuery.trim().toLowerCase())).slice(0, 40);

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
      { field: 'aliases', title: 'Same as', prompt: 'Synonyms and close neighbours: other words you use for this concept.', placeholder: 'Add a synonym' },
      { field: 'opposedTo', title: 'Opposed to', prompt: 'Opposites and rivals: what this concept stands against.', placeholder: 'Add an opposite' },
      { field: 'notSameAs', title: 'Not the same as', prompt: 'Easily confused, but different: neighbours this should not collapse into.', placeholder: 'Add a distinction' },
      { field: 'examples', title: 'Examples', prompt: 'Cases that clearly belong inside the concept.', placeholder: 'Add example' },
      { field: 'counterexamples', title: 'Counterexamples', prompt: 'Cases that test or fall outside the boundary.', placeholder: 'Add counterexample' },
    ];
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
        view: 'labs',
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
      <div className="noesis-concept-entry flex-1 overflow-y-auto font-body" data-noesis-scroll-region data-noesis-identity="encyclopedia-entry">
        {/* Sticky nav bar */}
        <div className="noesis-gutter sticky top-0 z-10 bg-background/95 pt-[var(--page-top)] backdrop-blur-sm">
          <div className="noesis-detail-toolbar mb-0">
          <button type="button" onClick={back} className="noesis-back-link">
            <ArrowLeft aria-hidden="true" /> Concepts
          </button>
          <div className="flex gap-2">
            {concept && (
              <>
                <ContextualAiPanel
                  actions={['refine_concept_definition', 'clarify_concept_boundaries']}
                  enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
                  showContextBeforeSending={aiSettings?.showContextBeforeSending}
                  reasoningDepth={aiDepthFor(aiSettings, 'concepts')}
                  buttonLabel="Concept Assistance"
                  promptLabel="What should Noesis examine about this concept?"
                  promptPlaceholder="For example: Where does my use of this concept conflict with its definition?"
                  buildEnvelope={(action: ContextualAiAction, userPrompt) => ({
                    action,
                    targetType: 'concept',
                    targetId: concept.id,
                    scope: 'linked_items',
                    itemMemory: [
                      `Concept: ${concept.name}`,
                      `Working definition: ${concept.description || 'Not defined.'}`,
                      `Aliases: ${(concept.aliases || []).join('; ') || 'None recorded.'}`,
                      `Not the same as: ${(concept.notSameAs || []).join('; ') || 'None recorded.'}`,
                      `Examples: ${(concept.examples || []).join('; ') || 'None recorded.'}`,
                      `Counterexamples: ${(concept.counterexamples || []).join('; ') || 'None recorded.'}`,
                    ],
                    linkedMemory: [
                      ...r.annotations.slice(0, 8).map((item) => `Annotation (${item.type}): ${item.text}`),
                      ...r.beliefs.slice(0, 6).map((item) => `Position (${item.confidence}% confidence): ${item.statement || item.title}`),
                      ...r.questions.slice(0, 4).map((item) => `Inquiry: ${item.text}`),
                      ...linkedConceptNames.slice(0, 6).map((name) => `Neighboring concept: ${name}`),
                    ],
                    userPrompt,
                  })}
                  onAccept={(result, text) => persistConcept(concept, { result, text, baseline: concept })}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Concept actions" className="size-9 rounded-full bg-card"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEditor(concept)}><Edit className="mr-2 size-4" /> Edit concept</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDeleteTarget(concept)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 size-4" /> Delete concept</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
          </div>
        </div>

        <div className="noesis-gutter pb-10 pt-7">
          {/* Title + definition */}
          <div className="mb-8">
            <DetailLabel view="concepts" kind="Concept" status={concept?.philosophyStatus} />
            <h1 className="noesis-page-title noesis-detail-title mb-4">{selectedName}</h1>
            {isDefinitionEditing ? (
              <div className="max-w-3xl space-y-3 rounded-xl border border-accent/20 bg-card p-4 shadow-sm">
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
                {concept.definitionProvenance && <AiProvenanceBadge provenance={concept.definitionProvenance} target={conceptReviewTarget(concept.id, 'description', concept.definitionProvenance.provenanceId)} title="Concept definition" />}
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
              { label: 'Inquiries', n: r.questions.length },
              { label: 'Positions', n: r.beliefs.length },
            ].map(({ label, n }) => (
              <div key={label} className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/80 px-3 py-1 shadow-sm">
                <span className="font-headline text-base font-bold text-accent">{n}</span>
                <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60 font-bold">{label}</span>
              </div>
            ))}
          </div>

          {concept && (
            <div className="noesis-instrument-pair mb-6">
              <ConceptDiagnosisBars diagnosis={diagnosis} />
              <ConceptCaliper concept={concept} />
            </div>
          )}

          <ThroughConcept concept={selectedName} columns={[
            { label: 'Sources', tone: 'encounter', items: r.sources.map((source) => ({ id: source.id, label: source.title, onOpen: () => previewSource(source) })) },
            { label: 'Annotations', tone: 'encounter', items: r.annotations.map((note) => ({ id: `${note.source.id}:${note.id}`, label: note.text.length > 90 ? `${note.text.slice(0, 89)}\u2026` : note.text, onOpen: () => previewSource(note.source) })) },
            { label: 'Inquiries', tone: 'examine', items: r.questions.map((question) => ({ id: question.id, label: question.text, onOpen: () => previewInquiry(question) })) },
            { label: 'Positions', tone: 'claim', items: r.beliefs.map((entry) => ({ id: entry.id, label: entry.title, onOpen: () => previewPosition(entry) })) },
            { label: 'Works', tone: 'more', items: r.drafts.map((draft) => ({ id: draft.id, label: draft.title || 'Untitled', onOpen: () => previewWork(draft) })) },
          ]} />


          <WorkbenchFlow
            label="Concept workbench workflow"
            activeId={conceptWorkflowStep}
            className="mb-6"
            onSelect={(id) => {
              const step = id as typeof conceptWorkflowStep;
              setConceptWorkflowStep(step);
              window.requestAnimationFrame(() => {
                const target = document.getElementById(`concept-${step}`);
                if (target instanceof HTMLDetailsElement) target.open = true;
                target?.scrollIntoView({ behavior: workspaceScrollBehavior(), block: 'start' });
              });
            }}
            steps={[
              { id: 'define', label: 'Define', description: 'Write the working meaning and distinguish its use.', progress: concept?.description?.trim() ? 1 : 0 },
              { id: 'boundaries', label: 'Test boundaries', description: 'Classify edge cases and refine where the concept stops.', progress: Math.min(1, ((concept?.examples || []).length + (concept?.counterexamples || []).length + (concept?.notSameAs || []).length) / 4) },
              { id: 'diagnose', label: 'Diagnose', description: 'Review clarity, evidence, tension, expression, and next needs.', progress: concept?.description?.trim() ? 0.5 : 0 },
              { id: 'connect', label: 'Connect', description: 'Inspect the sources, notes, inquiries, positions, works, and practices using it.', progress: Math.min(1, (concept?.links || []).length / 4), meta: `${(concept?.links || []).length} links` },
              { id: 'history', label: 'History', description: 'Review only recorded changes to the concept over time.', progress: 0 },
            ]}
          />

          <details id="concept-define" open className={cn('noesis-workbench-panel group mb-5 scroll-mt-6', conceptWorkflowStep !== 'define' && 'hidden')}>
            <summary className="noesis-workbench-panel__header cursor-pointer list-none">
              <div className="min-w-0 flex-1">
                <div className="noesis-workbench-panel__eyebrow">Define</div>
                <h3 className="noesis-workbench-panel__title">Meaning and language</h3>
              </div>
              <ChevronDown className="noesis-workbench-panel__chevron" aria-hidden="true" />
            </summary>
            <div className="noesis-workbench-panel__body">
          <div className="p-2 sm:p-3">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold">Working meaning</h2>
                <p className="mt-1 text-sm text-muted-foreground">Define the concept and record the language that gives it a stable shape.</p>
              </div>
              <Badge variant="outline" className="rounded-full">{diagnosis.level}</Badge>
            </div>

            <div>
              <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-bold">Working Definition</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {concept?.description || 'Undefined. Write a provisional definition before treating this concept as stable.'}
                </p>
                <Button variant="outline" size="sm" onClick={startDefinitionEdit} disabled={!concept} className="mt-3 h-8 rounded-full">
                  <Edit className="mr-2 size-3.5" /> Edit Definition
                </Button>
              </div>

            </div>

            <div className="mt-4 rounded-xl border border-border/40 bg-background/70 p-4">
              <div className="mb-4">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold">Language & Boundaries</div>
                <p className="mt-1 text-sm text-muted-foreground">Name what it is the same as, opposed to, and easily confused with, then its examples and counterexamples, so this concept keeps its shape across the app.</p>
              </div>
              <div className="noesis-concept-shelf">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-code text-[8px] font-bold uppercase tracking-widest text-foreground/60">Your concepts · drag one into a box below</span>
                  <Input value={shelfQuery} onChange={(event) => setShelfQuery(event.target.value)} placeholder="Find a concept" aria-label="Find a concept to relate" className="h-7 w-44 rounded-full text-xs" />
                </div>
                <div className="noesis-concept-shelf__list" role="list">
                  {shelfConcepts.map((name) => (
                    <span
                      key={name}
                      role="listitem"
                      draggable
                      onDragStart={(event) => { event.dataTransfer.setData('text/plain', name); event.dataTransfer.effectAllowed = 'copy'; }}
                      className="noesis-concept-shelf__chip"
                      title={`Drag “${name}” into Same as, Opposed to, or Not the same as`}
                    >{name}</span>
                  ))}
                  {!shelfConcepts.length && <span className="text-xs italic text-muted-foreground">No other concepts match.</span>}
                </div>
              </div>
              <datalist id={`concept-names-${concept?.id || 'new'}`}>
                {otherConceptNames.map((name) => <option key={name} value={name} />)}
              </datalist>
              <div className="grid gap-4 lg:grid-cols-2">
                {conceptLanguageSections.map((section) => {
                  const values = concept?.[section.field] || [];
                  const isRelation = RELATION_FIELDS.includes(section.field);
                  return (
                    <div
                      key={section.field}
                      data-stage-tone={RELATION_TONES[section.field]}
                      data-drop-active={dropField === section.field || undefined}
                      onDragOver={isRelation ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDropField(section.field); } : undefined}
                      onDragLeave={isRelation ? () => setDropField((current) => current === section.field ? null : current) : undefined}
                      onDrop={isRelation ? (event) => {
                        event.preventDefault();
                        setDropField(null);
                        const name = event.dataTransfer.getData('text/plain').trim();
                        if (!name || !concept || (concept[section.field] || []).some((item) => item.toLowerCase() === name.toLowerCase())) return;
                        updateConceptListField(section.field, [...(concept[section.field] || []), name]);
                        toast({ title: 'Concept boundary updated', description: `${name} was added to ${section.title.toLowerCase()} for ${selectedName}.` });
                      } : undefined}
                      className={cn('noesis-concept-zone rounded-xl border border-border/30 bg-card p-3', isRelation && 'noesis-concept-zone--relation', section.field === 'examples' && 'lg:col-start-1')}
                    >
                      <div className="mb-2">
                        <div className={cn('font-code text-[8px] uppercase tracking-widest font-bold', isRelation ? 'noesis-concept-zone__title' : 'text-foreground/60')}>{section.title}</div>
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
                          list={isRelation ? `concept-names-${concept?.id || 'new'}` : undefined}
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

            {concept?.boundaryReview && (
              <div className="mt-4 noesis-recommendation">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-code text-[9px] font-bold uppercase tracking-widest text-accent">Saved Boundary Review</div>
                    <p className="mt-1 text-xs text-muted-foreground">Use this reviewed analysis when editing distinctions, examples, and counterexamples below.</p>
                  </div>
                  <Badge variant="outline" className="rounded-full border-accent/30 text-accent">AI-assisted</Badge>
                </div>
                <ContextualAiDocument content={concept.boundaryReview} />
                {concept.boundaryProvenance && <AiProvenanceBadge provenance={concept.boundaryProvenance} target={conceptReviewTarget(concept.id, 'boundaryReview', concept.boundaryProvenance.provenanceId)} title="Boundary review" />}
              </div>
            )}

            {concept && (
              <div className="mt-4">
                <AiAssistedHistory
                  entries={concept.aiReviewHistory || []}
                  onChange={async (aiReviewHistory) => { if (!await onUpdateConcept({ ...concept, aiReviewHistory })) throw new Error('Review history was not saved.'); }}
                />
              </div>
            )}

          </div>

            </div>
          </details>

          <details id="concept-boundaries" open className={cn('noesis-workbench-panel group mb-5 scroll-mt-6', conceptWorkflowStep !== 'boundaries' && 'hidden')}>
            <summary className="noesis-workbench-panel__header cursor-pointer list-none">
              <div className="min-w-0 flex-1">
                <div className="noesis-workbench-panel__eyebrow">Boundaries</div>
                <h3 className="noesis-workbench-panel__title">Boundary test</h3>
                <p className="noesis-workbench-panel__description">Try edge cases, then save a clearer boundary in your own words.</p>
              </div>
              <ChevronDown className="noesis-workbench-panel__chevron" aria-hidden="true" />
            </summary>
            <div className="noesis-workbench-panel__body">
          {/* Boundary Test */}
          <div className="mb-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold">Boundary Test</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Classify edge cases so this concept becomes clearer while keeping the definition under your control.
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
                                  ? 'border-accent bg-accent text-accent-foreground'
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

            <div className="mt-5 noesis-recommendation">
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

            </div>
          </details>

          <details id="concept-diagnose" open className={cn('noesis-workbench-panel group mb-5 scroll-mt-6', conceptWorkflowStep !== 'diagnose' && 'hidden')}>
            <summary className="noesis-workbench-panel__header cursor-pointer list-none">
              <div className="min-w-0 flex-1">
                <div className="noesis-workbench-panel__eyebrow">Diagnose</div>
                <h3 className="noesis-workbench-panel__title">Definition health</h3>
              </div>
              <ChevronDown className="noesis-workbench-panel__chevron" aria-hidden="true" />
            </summary>
            <div className="noesis-workbench-panel__body">
          {/* Growth Diagnosis */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <ConceptIcon className="size-4 text-muted-foreground/40" />
                <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold">Growth Diagnosis</h2>
              </div>
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

            </div>
          </details>

          <details id="concept-connect" open className={cn('noesis-workbench-panel group mb-5 scroll-mt-6', conceptWorkflowStep !== 'connect' && 'hidden')}>
            <summary className="noesis-workbench-panel__header cursor-pointer list-none">
              <div className="min-w-0 flex-1">
                <div className="noesis-workbench-panel__eyebrow">Connect</div>
                <h3 className="noesis-workbench-panel__title">Where this concept appears</h3>
              </div>
              <ChevronDown className="noesis-workbench-panel__chevron" aria-hidden="true" />
            </summary>
            <div className="noesis-workbench-panel__body">
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
                    <p className="text-sm font-body italic text-primary/80 line-clamp-3 mt-1">&quot;{a.text}&quot;</p>
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

            </div>
          </details>

          <details open className={cn('noesis-workbench-panel group mb-5', conceptWorkflowStep !== 'connect' && 'hidden')}>
            <summary className="noesis-workbench-panel__header cursor-pointer list-none">
              <div className="min-w-0 flex-1">
                <div className="noesis-workbench-panel__eyebrow">Connect</div>
                <h3 className="noesis-workbench-panel__title">Compare positions using this concept</h3>
              </div>
              <ChevronDown className="noesis-workbench-panel__chevron" aria-hidden="true" />
            </summary>
            <div className="noesis-workbench-panel__body">
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
                      <div key={`${a.id}-${b.id}`} className="rounded-lg bg-card/80 border border-amber-100 p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">Position A</p>
                            <p className="text-sm font-headline font-bold italic text-primary">{a.title}</p>
                            <p className="text-xs text-muted-foreground italic font-body mt-1 line-clamp-2">&quot;{a.statement}&quot;</p>
                          </div>
                          <div>
                            <p className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-bold">Position B</p>
                            <p className="text-sm font-headline font-bold italic text-primary">{b.title}</p>
                            <p className="text-xs text-muted-foreground italic font-body mt-1 line-clamp-2">&quot;{b.statement}&quot;</p>
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
                                    'h-auto justify-start rounded-lg px-3 py-2 text-left whitespace-normal border-amber-100 bg-card text-foreground hover:bg-amber-50',
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

            </div>
          </details>

          <details id="concept-history" open className={cn('noesis-workbench-panel group mb-5 scroll-mt-6', conceptWorkflowStep !== 'history' && 'hidden')}>
            <summary className="noesis-workbench-panel__header cursor-pointer list-none">
              <div className="min-w-0 flex-1">
                <div className="noesis-workbench-panel__eyebrow">History</div>
                <h3 className="noesis-workbench-panel__title">Definition history</h3>
              </div>
              <ChevronDown className="noesis-workbench-panel__chevron" aria-hidden="true" />
            </summary>
            <div className="noesis-workbench-panel__body">
          {/* Evolution over time */}
          {sortedEvents.length > 0 && (
            <section className="mb-10">
              <h2 className="font-code text-[11px] uppercase tracking-[0.2em] text-foreground/60 font-bold mb-6">Evolution Over Time</h2>
              <div className="relative pl-6 border-l-2 border-border/20 space-y-6">
                {sortedEvents.map((event) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[29px] size-3.5 rounded-full bg-card border-2 border-accent/40 shadow-sm" />
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
          </details>
        </div>

        {conceptEditorDialog}
        {conceptDeleteDialog}

      </div>
    );
  }

  return (
    <div className="noesis-page noesis-concepts-index" data-noesis-identity="encyclopedia-index">
      <PageHeader
        title="Concepts"
        description="Build the vocabulary lab for definitions, boundaries, consistency, and conceptual drift."
        meta={<p className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">{maturitySummary}</p>}
        actions={
          <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 shadow-md shadow-accent/20 rounded-full h-9">
            <Plus className="size-4 mr-1.5" /> New Concept
          </Button>
        }
      />

      {conceptRows.length > 0 && (() => {
        const bands: Array<[string, string, string, number]> = [
          ['stable', 'Mature', 'act', conceptRows.filter((row) => row.maturity.label === 'stable').length],
          ['usable', 'Developing', 'outline', conceptRows.filter((row) => row.maturity.label === 'usable').length],
          ['emerging', 'Emerging', 'examine', conceptRows.filter((row) => row.maturity.label === 'emerging').length],
          ['beginning', 'Beginning', 'more', conceptRows.filter((row) => row.maturity.label === 'beginning').length],
        ];
        return (
          <section className="noesis-flowbar mb-6" aria-label="How developed your vocabulary is">
            <div className="noesis-instrument__label">How developed your vocabulary is · {conceptRows.length}</div>
            <div className="noesis-flowbar__bar" role="img" aria-label={bands.map(([, label, , count]) => `${label} ${count}`).join(', ')}>
              {bands.filter((band) => band[3]).map(([key, label, tone, count]) => <span key={key} data-stage-tone={tone} style={{ flexGrow: count }} title={`${label}: ${count}`} />)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {bands.map(([key, label, tone, count]) => <span key={key} data-stage-tone={tone} className="noesis-flowbar__key"><i />{label} {count}</span>)}
              <button type="button" aria-pressed={listView === 'needs_attention'} onClick={() => setListView(listView === 'needs_attention' ? 'all' : 'needs_attention')} className="ml-auto rounded-full border border-[hsl(var(--stage-claim)/.5)] px-3 py-1 text-sm text-[hsl(var(--stage-claim))]">{needsAttentionRows.length} need attention</button>
            </div>
          </section>
        );
      })()}

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
        viewControlMobileRow
        viewControl={<ViewModeToggle
          label="Concept layout"
          showLabels
          value={viewMode === 'table' ? 'list' : splitView ? 'split' : 'grid'}
          modes={['grid', 'split', 'list']}
          onChange={value => {
            if (value !== 'list') setCardLayout(value === 'split' ? 'split' : 'cards');
            setViewMode(value === 'list' ? 'table' : 'cards');
          }}
        />}
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
            <SelectTrigger aria-label="More concept filters" className={cn(
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

      {viewMode === 'table' && conceptRows.length > 0 && (
        <section className="min-w-0 rounded-lg border border-border/60 bg-card">
          <Table className="table-fixed xl:table-auto">
            <caption className="sr-only">Concepts</caption>
            <TableHeader><TableRow className="bg-muted/25 hover:bg-muted/25"><TableHead>Concept</TableHead><TableHead className="w-24 sm:w-32 xl:w-40">Maturity</TableHead><TableHead className="hidden w-20 xl:table-cell">Links</TableHead><TableHead className="hidden xl:table-cell">Missing requirements</TableHead><TableHead className="hidden w-16 sm:table-cell"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {conceptRows.map(({ name, concept, diagnosis: diag, connectionCount, repairFlags }) => (
                <TableRow key={name} className="cursor-pointer" onClick={(event) => { if (isEntitySurfaceClick(event)) openConceptDetail(name, concept); }}>
                  <TableCell className="max-w-xl py-2 [overflow-wrap:anywhere]"><button type="button" className="min-h-11 w-full rounded-sm text-left font-headline text-base font-semibold text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => openConceptDetail(name, concept)} onKeyDown={(event) => activateEntityOnKey(event, () => openConceptDetail(name, concept))}>{name}</button><p className="line-clamp-2 pb-1 text-xs leading-5 text-muted-foreground">{concept?.description || 'Definition not added'}</p></TableCell>
                  <TableCell><div className="space-y-1.5"><StageBadge type="concept" stage={concept?.stage} status={concept?.philosophyStatus} /><span className={cn('block w-fit font-code text-[8px] font-bold uppercase tracking-widest', CLARITY_BG[diag.level])}>{diag.level}</span></div></TableCell>
                  <TableCell className="hidden font-code text-[10px] uppercase tracking-wider text-muted-foreground xl:table-cell">{connectionCount}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">{repairFlags.length ? repairFlags.slice(0, 3).map((flag) => flag.label).join(' · ') : 'Ready for use'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{concept && <Button variant="ghost" size="icon" aria-label={`Edit ${name}`} className="size-11 rounded-full" onClick={() => openEditor(concept)}><Edit className="size-4" /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {splitView && viewMode !== 'table' && conceptRows.length > 0 && (() => {
        const maturityName = (label: string) => ({ stable: 'Mature', usable: 'Developing', emerging: 'Emerging', beginning: 'Beginning' } as Record<string, string>)[label] || label;
        const current = conceptRows.find((row) => row.name === previewName) || conceptRows[0];
        return (
          <div className="noesis-concept-split mb-8">
            <ul className="noesis-concept-split__list" aria-label="Concepts">
              {conceptRows.map((row) => (
                <li key={row.name}>
                  <button type="button" draggable onDragStart={(event) => { event.dataTransfer.setData('text/x-noesis-concept', row.name); event.dataTransfer.effectAllowed = 'copy'; }} aria-current={row.name === current.name || undefined} onClick={() => setPreviewName(row.name)} onDoubleClick={() => openConceptDetail(row.name, row.concept)}>
                    <b>{row.name}</b>
                    <span className="noesis-concept-split__meta"><i data-maturity={row.maturity.label} />{maturityName(row.maturity.label)}{row.concept?.description?.trim() ? '' : ' · no definition'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="grid min-w-0 content-start gap-4">
              <article className="noesis-concept-split__card" data-stage-tone="outline">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full">{maturityName(current.maturity.label)}</Badge>
                  <Badge variant="outline" className="rounded-full">{current.connectionCount} links</Badge>
                  {current.repairFlags.length > 0 && <Badge variant="outline" className="rounded-full" style={{ color: 'hsl(var(--stage-claim))', borderColor: 'hsl(var(--stage-claim) / .5)' }}>{current.repairFlags.length} to repair</Badge>}
                </div>
                <h2 className="mt-2 font-headline text-4xl font-semibold italic">{current.name}</h2>
                {current.concept?.description?.trim()
                  ? <blockquote className="noesis-concept-split__quote">{current.concept.description}</blockquote>
                  : <p className="mt-2 text-sm text-muted-foreground">No definition yet. Mark a definition in a source or Works, or open the workbench to write one.</p>}
                <Button type="button" onClick={() => openConceptDetail(current.name, current.concept)} className="mt-3 rounded-full">Open the workbench</Button>
              </article>
              <div className="noesis-instrument-pair">
                <ConceptDiagnosisBars diagnosis={current.diagnosis} />
                {current.concept && (() => {
                  const target = current.concept;
                  const zones: Array<{ field: 'aliases' | 'opposedTo' | 'notSameAs'; title: string; hint: string; tone: string }> = [
                    { field: 'aliases', title: 'Same as', hint: 'Synonyms and close neighbours', tone: 'act' },
                    { field: 'opposedTo', title: 'Opposed to', hint: 'Opposites and rivals', tone: 'claim' },
                    { field: 'notSameAs', title: 'Not the same as', hint: 'Easily confused, but different', tone: 'outline' },
                  ];
                  const save = (field: 'aliases' | 'opposedTo' | 'notSameAs', values: string[]) => void onUpdateConcept({ ...target, [field]: Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))), dateUpdated: new Date().toISOString() });
                  return (
                    <section className="noesis-relations" aria-label="Relations">
                      <div className="noesis-instrument__label">Relations · drag concepts from the list</div>
                      {zones.map((zone) => (
                        <div key={zone.field} data-stage-tone={zone.tone} className="noesis-relations__zone"
                          onDragOver={(event) => { if (event.dataTransfer.types.includes('text/x-noesis-concept')) { event.preventDefault(); event.currentTarget.dataset.over = '1'; } }}
                          onDragLeave={(event) => { delete event.currentTarget.dataset.over; }}
                          onDrop={(event) => { event.preventDefault(); delete event.currentTarget.dataset.over; const name = event.dataTransfer.getData('text/x-noesis-concept'); if (name && name !== current.name) save(zone.field, [...(target[zone.field] || []), name]); }}>
                          <span className="noesis-relations__title">{zone.title}</span>
                          <span className="noesis-relations__hint">{zone.hint}</span>
                          <span className="flex flex-wrap gap-1.5">
                            {(target[zone.field] || []).map((value) => (
                              <span key={value} className="noesis-relations__chip">{value}<button type="button" aria-label={`Remove ${value} from ${zone.title}`} onClick={() => save(zone.field, (target[zone.field] || []).filter((item) => item !== value))}>×</button></span>
                            ))}
                          </span>
                        </div>
                      ))}
                      <select aria-label="Add a relation without dragging" className="noesis-relations__pick" value="" onChange={(event) => { const [field, name] = event.target.value.split('::'); if (field && name) save(field as 'aliases' | 'opposedTo' | 'notSameAs', [...(target[field as 'aliases'] || []), name]); }}>
                        <option value="">Or add without dragging…</option>
                        {conceptRows.filter((row) => row.name !== current.name).map((row) => (
                          <optgroup key={row.name} label={row.name}>
                            {zones.map((zone) => <option key={zone.field} value={`${zone.field}::${row.name}`}>{row.name} · {zone.title.toLowerCase()}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </section>
                  );
                })()}
              </div>
              {current.concept && <ConceptCaliper concept={current.concept} />}
            </div>
          </div>
        );
      })()}

      <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4', splitView && viewMode !== 'table' && 'hidden')}>
        {viewMode !== 'table' && conceptRows.map(({ name, concept, related, diagnosis: diag, maturity, connectionCount, possibleDuplicates, repairFlags }) => {

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
                    <h2 className="font-headline text-xl font-bold flex-1 group-hover:text-accent transition-colors leading-tight">{name}</h2>
                    {concept && (
                      <Button variant="ghost" size="icon" aria-label={`Edit ${name}`} className="size-10 opacity-100 transition-opacity rounded-full md:size-9 md:opacity-0 md:group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); openEditor(concept); }}>
                        <Edit className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StageBadge type="concept" stage={concept?.stage} status={concept?.philosophyStatus} />
                    <span className={cn('font-code text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border', CLARITY_BG[diag.level])}>
                      {diag.level}
                    </span>
                    <span className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
                      {connectionCount} {connectionCount === 1 ? 'link' : 'links'}
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

              {possibleDuplicates.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="font-code text-[8px] uppercase tracking-widest text-amber-700 font-bold">Duplicate Review</div>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Compare with {possibleDuplicates.join(', ')} before merging or treating these as separate concepts.
                  </p>
                </div>
              )}

              <div className="border-t border-border/30 pt-3">
                <ConceptDiagnosisBars diagnosis={diag} compact />
                <div className="mt-2 font-code text-[8px] uppercase tracking-wider text-muted-foreground">
                  {related.sources.length} sources · {related.beliefs.length} positions · {related.drafts.length} works
                </div>
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

      {conceptEditorDialog}
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

