
"use client";

import { aiDepthFor } from '@/lib/ai-depth';
import { workspaceScrollBehavior } from '@/lib/appearance';

import React, { useEffect, useMemo, useState } from 'react';
import { persistedConceptRecords } from '@/lib/workspace-counts';
import { LabeledField } from '@/components/shared/LabeledField';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, ChevronDown, Edit, Plus, Scale, Trash2, MoreHorizontal } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
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
import { FooterSection, RecordFooter, RecordHeader, RecordPage, RecordPath, RecordSection } from '@/components/shared/record/RecordPage';
import { BenchBand, Connections, Tool, ToolsBand } from '@/components/shared/record/RecordParts';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Pill, PillRow } from '@/components/ui/pill';
import { SectionEmpty } from '@/components/shared/SectionEmpty';
import { ConceptBoundaryBench } from '@/components/Concepts/ConceptBoundaryBench';
import { conceptBoundaryFindings, type ConceptBoundaryFinding } from '@/lib/concept-boundary-findings';
import { conceptAttentionReason } from '@/lib/concept-attention';
import { useToast } from '@/hooks/use-toast';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { FilterToolbar, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
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
  attentionReason: string;
};

type ConceptTensionDecision = Extract<PhilosophicalLinkType, 'coheres' | 'contradicts' | 'refines'>;
type ConceptListField = 'aliases' | 'opposedTo' | 'notSameAs' | 'examples' | 'counterexamples';
const RELATION_FIELDS: ConceptListField[] = ['aliases', 'notSameAs', 'opposedTo'];
// Relations are read as a widening distance from the concept, in the semantic
// status colours: the same as it (ok), near but not it (caution), against it (problem).
const RELATION_TONES: Partial<Record<ConceptListField, string>> = { aliases: 'ok', notSameAs: 'caution', opposedTo: 'problem' };
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
  { id: 'needs_attention', label: 'Needs Attention', description: 'Contested concepts and undefined concepts already used in positions.' },
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
  const [conceptWorkflowStep, setConceptWorkflowStep] = useState<'define' | 'boundaries' | 'diagnose' | 'connect' | 'history'>('boundaries');
  const [editing, setEditing] = useState<Concept | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingConcept, setSavingConcept] = useState(false);
  const conceptSaveLock = React.useRef(false);
  const [draftConcept, setDraftConcept] = useState<Partial<Concept>>({ name: '', description: '', sourceIds: [] });
  const [tensionDecisions, setTensionDecisions] = useState<Record<string, ConceptTensionDecision>>({});
  const [isDefinitionEditing, setIsDefinitionEditing] = useState(false);
  const [definitionDraft, setDefinitionDraft] = useState('');
  const [definitionCase, setDefinitionCase] = useState<{ conceptId: string; example: string } | null>(null);
  const definitionInput = React.useRef<HTMLTextAreaElement>(null);
  const distinctionInput = React.useRef<HTMLInputElement>(null);
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
      const attentionReason = conceptAttentionReason(conceptDoc, related.beliefs.length);
      const searchText = `${name} ${conceptDoc.description || ''} ${(conceptDoc.aliases || []).join(' ')} ${(conceptDoc.notSameAs || []).join(' ')} ${(conceptDoc.examples || []).join(' ')} ${(conceptDoc.counterexamples || []).join(' ')} ${JSON.stringify(related)}`.toLowerCase();
      const matchesSearch = !search || searchText.includes(search.toLowerCase());
      const matchesView =
        listView === 'all' ||
        (listView === 'recent' && isRecent) ||
        (listView === 'needs_attention' && Boolean(attentionReason)) ||
        (listView === 'connected' && connectionCount > 0) ||
        (listView === 'undefined' && isUndefined) ||
        (listView === 'contested' && isContested) ||
        (listView === 'duplicates' && possibleDuplicates.length > 0) ||
        (listView === 'transformed' && isTransformed) ||
        (listView === 'neglected' && isNeglected);
      if (!matchesSearch || !matchesView) return null;

      let why = 'Part of the current concept vocabulary.';
      if (listView === 'recent') why = lastActiveAt ? `Last moved ${new Date(lastActiveAt).toLocaleDateString()}.` : 'Recently updated definition or linked event.';
      if (listView === 'needs_attention') why = attentionReason;
      if (listView === 'connected') why = `${connectionCount} linked object${connectionCount === 1 ? '' : 's'} depend on this concept.`;
      if (listView === 'undefined') why = 'Needs a clearer working definition or boundary test.';
      if (listView === 'contested') why = 'Shows tension, challenge, or inconsistent usage.';
      if (listView === 'duplicates') why = `Possible overlap with ${possibleDuplicates.join(', ')}. Distinguish, alias, or merge manually.`;
      if (listView === 'transformed') why = 'Has revision or transformation signals in its history.';
      if (listView === 'neglected') why = 'Has meaningful links but little recent movement.';

      return { name, concept: conceptDoc, related, diagnosis, maturity, connectionCount, lastActiveAt, why, possibleDuplicates, repairFlags, attentionReason };
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
  const needsAttentionRows = conceptRows.filter((row) => row.attentionReason);
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
    const boundaryFindings = concept ? conceptBoundaryFindings(concept) : [];
    const activeFinding = boundaryFindings.find(finding => definitionCase?.conceptId === concept?.id && finding.example === definitionCase?.example) || boundaryFindings[0];
    const otherFindings = boundaryFindings.filter(finding => finding !== activeFinding);
    const driftEvents = sortedEvents.filter((event) => /concept|definition|revise|transform|changed/i.test(`${event.eventType} ${event.reason || ''}`));

    const back = () => {
      setSelectedName(null);
      setIsDefinitionEditing(false);
      onOpenConceptRoute?.(null);
    };

    const startDefinitionEdit = () => {
      if (!isDefinitionEditing) setDefinitionDraft(concept?.description || '');
      setIsDefinitionEditing(true);
    };

    const reviewDefinition = (finding: ConceptBoundaryFinding) => {
      if (!concept) return;
      setDefinitionCase({ conceptId: concept.id, example: finding.example });
      startDefinitionEdit();
      window.requestAnimationFrame(() => definitionInput.current?.focus());
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
      { field: 'notSameAs', title: 'Not the same as', prompt: 'Easily confused, but different: neighbours this should not collapse into.', placeholder: 'Add a distinction' },
      { field: 'opposedTo', title: 'Opposed to', prompt: 'Opposites and rivals: what this concept stands against.', placeholder: 'Add an opposite' },
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

    const caseCount = (concept?.examples || []).length + (concept?.edgeCases || []).length + (concept?.counterexamples || []).length;
    const relationCount = (concept?.aliases || []).length + (concept?.notSameAs || []).length + (concept?.opposedTo || []).length;
    let conceptHereId: string; let conceptGuide: string;
    if (!concept?.description?.trim()) { conceptHereId = 'con-define'; conceptGuide = 'Write a working definition, even a rough one.'; }
    else if (caseCount < 2) { conceptHereId = 'con-boundary'; conceptGuide = 'Test the boundary with a case or two.'; }
    else if (!(concept.edgeCases || []).length) { conceptHereId = 'con-boundary'; conceptGuide = 'Find an edge case: something that could go either way.'; }
    else if (!relationCount) { conceptHereId = 'con-relations'; conceptGuide = 'Relate it to a neighbouring concept.'; }
    else { conceptHereId = 'con-stands'; conceptGuide = diagnosis.suggestedNextAction; }

    return (
      <RecordPage tone="outline" identity="encyclopedia-entry" className="noesis-concept-entry">
        <RecordHeader backLabel="Concepts" onBack={back} view="concepts" kind="Concept" status={concept?.philosophyStatus} title={selectedName}
          trailing={concept ? <>
            <ContextualAiPanel
              actions={['refine_concept_definition', 'clarify_concept_boundaries']}
              enabled={Boolean(aiSettings?.aiAssistanceEnabled)}
              showContextBeforeSending={aiSettings?.showContextBeforeSending}
              reasoningDepth={aiDepthFor(aiSettings, 'concepts')}
              buttonLabel="Ask Noesis"
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
              <DropdownMenuTrigger asChild><IconButton label="Concept actions" variant="outline"><MoreHorizontal className="size-4" /></IconButton></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openEditor(concept)}><Edit className="mr-2 size-4" /> Edit concept</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteTarget(concept)} className="text-problem focus:text-problem"><Trash2 className="mr-2 size-4" /> Delete concept</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </> : undefined} />

        <RecordPath label="Where you are with this concept" hereId={conceptHereId} guide={conceptGuide}
          stops={[{ id: 'con-define', label: 'Definition' }, { id: 'con-boundary', label: 'Boundary' }, { id: 'con-relations', label: 'Relations' }, { id: 'con-stands', label: 'Where it stands' }]} />

        {/* ---------- Thinking tools: comparisons you make yourself ---------- */}
        <ToolsBand note="For you, not for Noesis. Comparing what this concept holds up, and where it strains.">
          <Tool label="Compare positions using this concept" icon={Scale} disabled={r.beliefs.length < 2}>
            {/* Tensions & Conflicts */}
            {r.beliefs.length >= 2 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-5">
                  <AlertTriangle className="size-4 text-caution" />
                  <h2 className="noesis-eyebrow text-foreground/60 font-bold">Tensions & Conflicts</h2>
                </div>
                <div className="rounded-xl border border-caution/35 bg-caution/10 p-5">
                  <p className="text-xs text-caution font-body mb-4 italic">
                    These positions all orbit <span className="font-bold">{selectedName}</span>. Do they cohere, contradict, or refine each other?
                  </p>
                  <div className="space-y-4">
                    {r.beliefs.slice(0, 4).map((a, ai) =>
                      r.beliefs.slice(ai + 1, ai + 2).map((b) => (
                        <div key={`${a.id}-${b.id}`} className="rounded-lg bg-card/80 border border-caution/25 p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground/40 mb-1 font-bold">Position A</p>
                              <p className="text-sm font-headline font-bold italic text-primary">{a.title}</p>
                              <p className="text-xs text-muted-foreground italic font-body mt-1 line-clamp-2">&quot;{a.statement}&quot;</p>
                            </div>
                            <div>
                              <p className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground/40 mb-1 font-bold">Position B</p>
                              <p className="text-sm font-headline font-bold italic text-primary">{b.title}</p>
                              <p className="text-xs text-muted-foreground italic font-body mt-1 line-clamp-2">&quot;{b.statement}&quot;</p>
                            </div>
                          </div>
                          <div className="mt-4 border-t border-caution/25 pt-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="noesis-eyebrow noesis-eyebrow--sm text-caution font-bold">Resolve Relationship</p>
                              {tensionDecisions[`${a.id}-${b.id}`] && (
                                <span className="rounded-full border border-caution/40 bg-caution/15 px-2 py-0.5 noesis-eyebrow noesis-eyebrow--sm text-foreground">
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
                                      'h-auto justify-start rounded-lg px-3 py-2 text-left whitespace-normal border-caution/25 bg-card text-foreground hover:bg-caution/10',
                                      selected && 'border-caution bg-caution/20 text-foreground'
                                    )}
                                  >
                                    <span className="block">
                                      <span className="block noesis-eyebrow noesis-eyebrow--sm font-bold">{decision.label}</span>
                                      <span className="mt-0.5 block text-xs normal-case tracking-normal text-muted-foreground">{decision.description}</span>
                                    </span>
                                  </Button>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-xs text-caution">
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

          </Tool>
        </ToolsBand>

        <BenchBand note="Where you write the concept out, and where Noesis can read over your shoulder if you ask it to." />

        <RecordSection id="con-define" title="Definition" description="The working meaning, in your own words. It can change." here={conceptHereId === 'con-define'}
          aside={!isDefinitionEditing && concept ? <Button variant="tertiary" size="sm" onClick={startDefinitionEdit}><Edit className="size-3.5" /> {concept.description ? 'Edit definition' : 'Write a definition'}</Button> : undefined}>
          {activeFinding && <div className="mb-4 max-w-3xl border-l border-border pl-3 text-sm">
            <Eyebrow>From the boundary test</Eyebrow>
            <p className="mt-1 break-words font-medium">{activeFinding.example} <span className="font-normal text-muted-foreground">· {activeFinding.label}</span></p>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{activeFinding.reason}</p>
            <div className="flex flex-wrap gap-x-3">
              {!isDefinitionEditing && <Button type="button" variant="link" size="sm" className="min-h-8 px-0" onClick={() => reviewDefinition(activeFinding)}>Revise using this case</Button>}
              <Button type="button" variant="link" size="sm" className="min-h-8 px-0" onClick={() => distinctionInput.current?.focus()}>Clarify a distinction</Button>
            </div>
            {otherFindings.length > 0 && <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground">Other reviewed cases ({otherFindings.length})</summary>
              <ul className="mt-1 space-y-2">
                {otherFindings.map(finding => <li key={finding.example}><button type="button" className="min-h-8 break-words text-left underline underline-offset-2" onClick={() => reviewDefinition(finding)}>{finding.example}</button></li>)}
              </ul>
            </details>}
          </div>}
          {isDefinitionEditing ? (
            <div className="grid max-w-3xl gap-3">
              <Textarea ref={definitionInput} value={definitionDraft} onChange={(event) => setDefinitionDraft(event.target.value)} className="min-h-[120px] text-base leading-7" placeholder="Write the current working definition for this concept." aria-label="Working definition" />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={saveInlineDefinition} disabled={!concept}>Save definition</Button>
                <Button variant="ghost" size="sm" onClick={() => setIsDefinitionEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : concept?.description ? (
            <div className="max-w-3xl">
              <p className="font-body text-lg leading-relaxed">{concept.description}</p>
              {concept.definitionProvenance && <AiProvenanceBadge provenance={concept.definitionProvenance} target={conceptReviewTarget(concept.id, 'description', concept.definitionProvenance.provenanceId)} title="Concept definition" />}
            </div>
          ) : (
            <SectionEmpty title="No definition yet." hint="Write a provisional one before treating this concept as stable." />
          )}
          {(concept?.aiReviewHistory || []).length > 0 && (
            <div className="mt-4">
              <AiAssistedHistory entries={concept?.aiReviewHistory || []} onChange={async (aiReviewHistory) => { if (concept && !await onUpdateConcept({ ...concept, aiReviewHistory })) throw new Error('Review history was not saved.'); }} />
            </div>
          )}
        </RecordSection>

        <RecordSection id="con-boundary" title="Boundary" description="Sort cases into what fits, what sits at the edge, and what does not." here={conceptHereId === 'con-boundary'}>
          {concept
            ? <ConceptBoundaryBench key={concept.id} concept={concept} onSave={onUpdateConcept} onReviewDefinition={reviewDefinition} />
            : <SectionEmpty title="Save the concept first." hint="The boundary bench opens once the concept exists." />}
        </RecordSection>

        <RecordSection id="con-relations" title="Relations" description="How this concept sits beside its neighbours: the same as, near but not it, against it." here={conceptHereId === 'con-relations'}>
          <div className="noesis-concept-shelf">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow size="sm">Your concepts · drag one into a box below</Eyebrow>
              <Input value={shelfQuery} onChange={(event) => setShelfQuery(event.target.value)} placeholder="Find a concept" aria-label="Find a concept to relate" className="h-8 w-44 text-xs" />
            </div>
            <div className="noesis-concept-shelf__list" role="list">
              {shelfConcepts.map((name) => (
                <span key={name} role="listitem" draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', name); event.dataTransfer.effectAllowed = 'copy'; }} className="noesis-concept-shelf__chip" title={`Drag “${name}” into Same as, Not the same as, or Opposed to`}>{name}</span>
              ))}
              {!shelfConcepts.length && <span className="text-xs italic text-muted-foreground">No other concepts match.</span>}
            </div>
          </div>
          <datalist id={`concept-names-${concept?.id || 'new'}`}>
            {otherConceptNames.map((name) => <option key={name} value={name} />)}
          </datalist>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {conceptLanguageSections.filter((section) => RELATION_FIELDS.includes(section.field)).map((section) => {
              const values = concept?.[section.field] || [];
              return (
                <div
                  key={section.field}
                  data-tone={RELATION_TONES[section.field]}
                  data-drop-active={dropField === section.field || undefined}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDropField(section.field); }}
                  onDragLeave={() => setDropField((current) => current === section.field ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDropField(null);
                    const name = event.dataTransfer.getData('text/plain').trim();
                    if (!name || !concept || (concept[section.field] || []).some((item) => item.toLowerCase() === name.toLowerCase())) return;
                    updateConceptListField(section.field, [...(concept[section.field] || []), name]);
                    toast({ title: 'Relation added', description: `${name} was added to ${section.title.toLowerCase()} for ${selectedName}.` });
                  }}
                  className="noesis-concept-zone noesis-concept-zone--relation noesis-panel noesis-panel--tight"
                >
                  <div className="mb-2">
                    <Eyebrow size="sm" tone={RELATION_TONES[section.field] as 'ok'} className="noesis-concept-zone__title">{section.title}</Eyebrow>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{section.prompt}</p>
                  </div>
                  {values.length
                    ? <PillRow className="mb-3">{values.map((value) => <Pill key={value} tone={RELATION_TONES[section.field] as 'ok'} onRemove={() => removeConceptListItem(section.field, value)} removeLabel={`Remove ${value}`}>{value}</Pill>)}</PillRow>
                    : <p className="mb-3 text-xs italic text-muted-foreground">No entries yet.</p>}
                  <div className="noesis-add">
                    <Input
                      ref={section.field === 'notSameAs' ? distinctionInput : undefined}
                      value={conceptListDrafts[section.field]}
                      onChange={(event) => setConceptListDrafts((prev) => ({ ...prev, [section.field]: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addConceptListItem(section.field); } }}
                      placeholder={section.placeholder}
                      aria-label={section.title}
                      list={`concept-names-${concept?.id || 'new'}`}
                      className="h-8 text-xs"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addConceptListItem(section.field)} disabled={!concept || !conceptListDrafts[section.field].trim()}>Add</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </RecordSection>

        <RecordSection id="con-stands" title="Where it stands" description="How clear it is, what it rests on, and where it is already at work." here={conceptHereId === 'con-stands'}>
          <ConceptDiagnosisBars diagnosis={diagnosis} />
          <p className="mt-3 font-body text-sm italic text-muted-foreground">{diagnosis.why}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={diagnosis.level === 'integrated' || diagnosis.level === 'strong' ? 'ok' : diagnosis.level === 'developing' ? 'caution' : 'neutral'}>{diagnosis.level}</Badge>
            {diagnosis.evolving && <Eyebrow size="sm" tone="stage">Recently changed</Eyebrow>}
          </div>
          {diagnosis.growthAreas.length > 0 && (
            <div className="mt-4">
              <Eyebrow as="h3">What would raise it</Eyebrow>
              <ul className="mt-1.5 grid gap-1.5">
                {diagnosis.growthAreas.map((area) => <li key={area} className="flex items-start gap-2 text-sm"><span className="mt-0.5 shrink-0 text-tone">→</span>{area}</li>)}
              </ul>
            </div>
          )}
          {diagnosis.areasToReview.length > 0 && (
            <div className="mt-4">
              <Eyebrow as="h3">Areas to review</Eyebrow>
              <PillRow className="mt-1.5">{diagnosis.areasToReview.map((area) => <Badge key={area}>{area}</Badge>)}</PillRow>
            </div>
          )}
        </RecordSection>

          <RecordFooter>
            <FooterSection title="Connections">
            {/* Every other record page lists what it is attached to with the
                shared Connections: one coloured pill per kind, carrying its
                count, opening to the items. This page used to hand-roll six
                grids of generic cards instead, which made a Concept's
                attachments the one place in the app where the kind of a thing
                was not written in its colour. */}
            <Connections groups={[
              { type: 'Sources', tone: 'source', items: r.sources.map((source) => ({ id: source.id, label: source.title, meta: [source.type, source.creator].filter(Boolean).join(' \u00b7 ') || undefined, onOpen: () => previewSource(source) })), empty: 'No sources tagged with this concept yet.' },
              { type: 'Annotations', tone: 'annotation', items: r.annotations.map((note, index) => ({ id: `${note.source.id}:${index}`, label: note.text.length > 120 ? `${note.text.slice(0, 119)}\u2026` : note.text, meta: note.source.title, onOpen: () => previewAnnotationSource(note) })), empty: 'No annotations tagged with this concept yet.' },
              { type: 'Inquiries', tone: 'inquiry', items: r.questions.map((question) => ({ id: question.id, label: question.text, meta: question.answer ? 'Answered' : 'Open', onOpen: () => previewInquiry(question) })), empty: 'No inquiries linked to this concept.' },
              { type: 'Positions', tone: 'position', items: r.beliefs.map((belief) => ({ id: belief.id, label: belief.title, meta: [belief.status, belief.confidence ? `${belief.confidence}% confidence` : null].filter(Boolean).join(' \u00b7 ') || undefined, onOpen: () => previewPosition(belief) })), empty: 'No positions formed around this concept yet.' },
              { type: 'Works', tone: 'work', items: r.drafts.map((draft) => ({ id: draft.id, label: draft.title || 'Untitled', meta: [draft.type, draft.status].filter(Boolean).join(' \u00b7 ') || undefined, onOpen: () => previewWork(draft) })), empty: 'No works express this concept yet.' },
              { type: 'Praxis', tone: 'practice', items: r.practices.map((practice) => ({ id: practice.id, label: practice.title, meta: [practice.type, practice.status].filter(Boolean).join(' \u00b7 ') || undefined, onOpen: () => previewPractice(practice) })), empty: 'No practices test this concept yet.' },
            ]} />
            </FooterSection>


            <FooterSection title="History">
            {/* Evolution over time */}
            {sortedEvents.length > 0 && (
              <section className="mb-10">
                <h2 className="noesis-eyebrow text-foreground/60 font-bold mb-6">Evolution Over Time</h2>
                <div className="relative pl-6 border-l-2 border-border/20 space-y-6">
                  {sortedEvents.map((event) => (
                    <div key={event.id} className="relative">
                      <div className="absolute -left-[29px] size-3.5 rounded-full bg-card border-2 border-accent/40 shadow-sm" />
                      <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground/40 mb-1 font-bold">
                        {event.date} · {event.eventType.replace(/_/g, ' ')}
                      </div>
                      <p className="text-sm font-body font-semibold text-primary/90">{event.entityTitle}</p>
                      {event.reason && <p className="text-xs text-muted-foreground font-body italic mt-0.5">{event.reason}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
            </FooterSection>
            <FooterSection title="Record">
              <p className="text-sm text-muted-foreground">{r.sources.length} sources · {r.annotations.length} annotations · {r.questions.length} inquiries · {r.beliefs.length} positions · {r.drafts.length} works{concept?.dateCreated ? ` · created ${new Date(concept.dateCreated).toLocaleDateString()}` : ''}</p>
            </FooterSection>
          </RecordFooter>
        {conceptEditorDialog}
        {conceptDeleteDialog}
      </RecordPage>
    );
  }

  return (
    <div className="noesis-page noesis-concepts-index" data-noesis-identity="encyclopedia-index">
      <PageHeader
        title="Concepts"
        description="Build the vocabulary lab for definitions, boundaries, consistency, and conceptual drift."
        meta={<p className="noesis-eyebrow text-muted-foreground/60">{maturitySummary}</p>}
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
                  'rounded-full border px-3 py-1.5 noesis-eyebrow noesis-eyebrow--sm transition-colors',
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
              'h-8 w-[150px] rounded-full border bg-background/70 px-3 noesis-eyebrow noesis-eyebrow--sm',
              moreConceptViewActive ? 'border-accent text-accent' : 'border-border text-muted-foreground'
            )}>
              <SelectValue placeholder="More Filters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="more" disabled className="noesis-eyebrow">More Filters</SelectItem>
              {moreConceptViews.map((view) => (
                <SelectItem key={view.id} value={view.id} className="noesis-eyebrow">
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
                  <TableCell><div className="space-y-1.5"><StageBadge type="concept" stage={concept?.stage} status={concept?.philosophyStatus} /><span className={cn('block w-fit noesis-eyebrow noesis-eyebrow--sm font-bold', CLARITY_BG[diag.level])}>{diag.level}</span></div></TableCell>
                  <TableCell className="hidden noesis-eyebrow text-muted-foreground xl:table-cell">{connectionCount}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">{repairFlags.length ? repairFlags.slice(0, 3).map((flag) => flag.label).join(' · ') : 'Ready for use'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{concept && <Button variant="ghost" size="icon" aria-label={`Edit ${name}`} className="size-11" onClick={() => openEditor(concept)}><Edit className="size-4" /></Button>}</TableCell>
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
                  {current.attentionReason && <Badge variant="outline" className="rounded-full" tone="caution">{current.attentionReason}</Badge>}
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
                              <Pill key={value} tone="concept" removeLabel={`Remove ${value} from ${zone.title}`} onRemove={() => save(zone.field, (target[zone.field] || []).filter((item) => item !== value))}>{value}</Pill>
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
                      <Button variant="ghost" size="icon" aria-label={`Edit ${name}`} className="size-10 opacity-100 transition-opacity md:size-9 md:opacity-0 md:group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); openEditor(concept); }}>
                        <Edit className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StageBadge type="concept" stage={concept?.stage} status={concept?.philosophyStatus} />
                    <span className={cn('noesis-eyebrow noesis-eyebrow--sm font-bold px-2 py-0.5 rounded-full border', CLARITY_BG[diag.level])}>
                      {diag.level}
                    </span>
                    <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground font-bold">
                      {connectionCount} {connectionCount === 1 ? 'link' : 'links'}
                    </span>
                  </div>
                </div>
                <div className="size-8 rounded-full flex items-center justify-center transition-colors shadow-sm bg-primary/10 text-primary">
                  <BookOpen className="size-4" />
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground font-body line-clamp-2 italic mb-5">
                {concept?.description || 'Inspect linked sources, positions, works, inquiries, and practices.'}
              </p>

              {possibleDuplicates.length > 0 && (
                <div className="mb-4 rounded-xl border border-caution/40 bg-caution/10 px-3 py-2">
                  <div className="noesis-eyebrow noesis-eyebrow--sm text-caution font-bold">Duplicate Review</div>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    Compare with {possibleDuplicates.join(', ')} before merging or treating these as separate concepts.
                  </p>
                </div>
              )}

              <div className="border-t border-border/30 pt-3">
                <ConceptDiagnosisBars diagnosis={diag} compact />
                <div className="mt-2 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">
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


