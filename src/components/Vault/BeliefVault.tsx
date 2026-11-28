
"use client";

import { aiDepthFor } from '@/lib/ai-depth';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FooterSection, RecordFooter, RecordHeader, RecordPage, RecordSection, Row } from '@/components/shared/record/RecordPage';
import { ItemWorkspace } from '@/components/shared/record/ItemWorkspace';
import { RecordLinkPicker, type LinkableRecord } from '@/components/shared/record/RecordLinkPicker';
import { ItemHistoryBackground, ItemHistoryPanel } from '@/components/shared/record/ItemHistoryPanel';
import { Connections, Tool, ToolsBand } from '@/components/shared/record/RecordParts';
import { InstrumentWorkbench } from '@/components/shared/record/InstrumentWorkbench';
import { InstrumentHelp } from '@/components/shared/InstrumentHelp';
import { Eyebrow } from '@/components/ui/eyebrow';
import { SectionEmpty } from '@/components/shared/SectionEmpty';
import { DeskFindings } from '@/components/ai/DeskFindings';
import { CalibrationBar } from '@/components/Vault/CalibrationBar';
import { PositionArch, PositionAssumptions } from '@/components/Vault/PositionArch';
import { PositionScopeTool } from '@/components/Vault/PositionScopeTool';
import { PositionHandoffs } from '@/components/Vault/PositionHandoffs';
import { AlertTriangle, ArrowLeft, CalendarRange, Gauge, ScanLine, Pencil, Plus, ShieldCheck, Trash2, Triangle, MoreHorizontal, Zap } from 'lucide-react';
import { usePersistentView } from '@/hooks/use-persistent-view';
import { useEntityViewPreference } from '@/hooks/use-entity-view-preference';
import { Button, IconButton } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import { ConfidenceEmber } from '@/components/Vault/ConfidenceEmber';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { SourceLinker } from '@/components/SourceLinker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { BeliefProfile, Concept, Draft, Media, PhilosophicalLink, PositionKind, PositionPhilosophyStatus, Practice, Question, TimelineEvent, Unknown, VaultEntry, VaultType } from '@/lib/types';
import { normalizeConceptTags, today } from '@/lib/readex';
import { normalizePositionConfidence } from '@/lib/workflow-integrity';
import { cn } from '@/lib/utils';
import { ConceptFilterPicker } from '@/components/shared/ConceptFilterPicker';
import { activateEntityOnKey, isEntitySurfaceClick } from '@/lib/entity-activation';
import { derivePositionLifecycleStage } from '@/lib/workflow-integrity';
import { StageBadge } from '@/components/shared/StageBadge';
import { ConceptDetailDialog } from '@/components/Concepts/ConceptDetailDialog';
import { useToast } from '@/hooks/use-toast';
import { DetailLabel, PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar, SortPill, ViewModeToggle } from '@/components/shared/FilterToolbar';
import { COLLECTION_SORT_OPTIONS, sortCollection, type CollectionOrder } from '@/lib/collection-sort';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { ToolOption, ToolOptions, WorkbenchPanel } from '@/components/shared/WorkbenchPanel';
import { EditorialSection, EntityMeta, IntellectualRoleLabel, RevisionEvent } from '@/components/shared/IntellectualStructures';
import { noesisUserError } from '@/lib/user-facing-errors';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';
import { searchMatches } from '@/lib/search';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { itemAiHistory } from '@/lib/item-ai-history';
import { PositionMiniScale, PullEvidenceDialog, zoneLabel } from '@/components/Vault/PositionCalibration';
import { distinctPositionStatement, evidenceBalance, resolvePositionGrounds } from '@/lib/position-grounds';
import { positionReviewInputs } from '@/lib/position-review-inputs';
import { positionConfidenceTrace, positionHistoryDateMatches, type PositionHistoryRange } from '@/lib/position-revisions';
import { formatPositionScopeCheck, scopeCheckIsCurrent } from '@/lib/position-scope-check';
import { PromotedAnnotationCreationDetails } from '@/components/ai/AiCreationHistory';
import { PromotedAnnotationOrigins } from '@/components/ai/AiProvenanceBadge';
import type { AiContextEnvelope, AiReviewResult, ContextualAiAction } from '@/lib/contextual-ai';
import { positionReviewTarget, type PositionReviewApproval } from '@/lib/position-ai-review';

interface BeliefVaultProps {
  aiSettings: import('@/lib/types').AiSettings;
  entries: VaultEntry[];
  media: Media[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  concepts: Concept[];
  links: PhilosophicalLink[];
  beliefProfiles: BeliefProfile[];
  unknowns: Unknown[];
  onAddEntry: (data: Partial<VaultEntry>) => void | Promise<unknown>;
  onUpdateEntry: (entry: VaultEntry, approval?: PositionReviewApproval) => void | Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void | Promise<unknown>;
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onAddPractice: (data: Partial<Practice>) => Promise<Practice>;
  onAddQuestion: (data: Partial<Question>) => Promise<Question>;
  onUpdateQuestion: (question: Question) => void | Promise<void>;
  onUpdateLink?: (link: PhilosophicalLink) => void;
  onOpenSource?: (id: string) => void;
  onOpenQuestion?: (id: string) => void;
  onOpenPractice?: (id: string) => void;
  onOpenWork?: (id: string) => void;
  focusedEntryId?: string | null;
  onFocusedEntryHandled?: () => void;
  onOpenEntryRoute?: (id: string | null) => void;
}

const ALL_POSITION_HISTORY: PositionHistoryRange = { from: '', to: '' };

const vaultTypes: VaultType[] = ['belief', 'principle', 'mental_model', 'life_rule', 'worldview'];

const TYPE_LABELS: Record<VaultType, string> = {
  belief: 'Belief',
  principle: 'Principle',
  mental_model: 'Mental Model',
  life_rule: 'Life Rule',
  worldview: 'Worldview',
};

const positionKinds: Array<{ id: PositionKind; label: string }> = [
  { id: 'descriptive', label: 'Descriptive' },
  { id: 'normative', label: 'Normative' },
  { id: 'interpretive', label: 'Interpretive' },
  { id: 'methodological', label: 'Methodological' },
  { id: 'personal_principle', label: 'Personal Principle' },
  { id: 'worldview_claim', label: 'Worldview Claim' },
  { id: 'predictive', label: 'Predictive' },
  { id: 'practical', label: 'Practical' },
];

const positionStatuses: Array<{ id: PositionPhilosophyStatus | 'questioning'; label: string }> = [
  { id: 'developing', label: 'Developing' },
  { id: 'active', label: 'Held' },
  { id: 'contested', label: 'Under Review' },
  { id: 'revised', label: 'Revised' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'replaced', label: 'Replaced' },
  { id: 'abandoned', label: 'Abandoned' },
];

function positionSavedStatus(status: VaultEntry['status']) {
  return positionStatuses.find(option => option.id === status)?.label || status.replace(/_/g, ' ');
}

function splitLines(value?: string) {
  return (value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value?: string[]) {
  return (value || []).join('\n');
}

function confidencePercent(confidence?: number) {
  return normalizePositionConfidence(confidence);
}

function confidenceLabel(confidence = 60) {
  const percent = confidencePercent(confidence);
  if (percent <= 20) return 'tentative';
  if (percent <= 40) return 'low';
  if (percent <= 60) return 'moderate';
  if (percent <= 80) return 'strong';
  return 'very strong';
}

type PositionViewFilter =
  | 'all'
  | 'complete'
  | 'current'
  | 'developing'
  | 'retired'
  | 'needs_attention'
  | 'emerging'
  | 'needs_evidence'
  | 'needs_opposition'
  | 'needs_practice'
  | 'under_review'
  | 'revised'
  | 'abandoned'
  | 'tensions'
  | 'high_confidence'
  | 'low_confidence'
  | 'overconfident'
  | 'suspended'
  | 'unsupported'
  | 'stale'
  | 'recently_changed';
type StressStage = {
  title: string;
  prompt: string;
  field: 'evidenceAgainst' | 'assumptions' | 'falsification';
  existing?: string;
};

const POSITION_VIEW_LABELS: Record<PositionViewFilter, string> = {
  all: 'All',
  complete: 'Complete',
  current: 'Current',
  under_review: 'Under Review',
  developing: 'Developing',
  retired: 'Retired',
  needs_attention: 'Needs Attention',
  emerging: 'Emerging',
  needs_evidence: 'Needs Evidence',
  needs_opposition: 'Needs Opposition',
  needs_practice: 'Needs Practice',
  revised: 'Revised',
  abandoned: 'Abandoned',
  tensions: 'Tensions',
  high_confidence: 'High Confidence',
  low_confidence: 'Low Confidence',
  overconfident: 'Overconfident',
  suspended: 'Suspended',
  unsupported: 'Unsupported',
  stale: 'Stale',
  recently_changed: 'Recently Changed',
};

const PRIMARY_POSITION_VIEW_FILTERS: PositionViewFilter[] = [
  'current',
  'under_review',
  'complete',
  'developing',
  'retired',
  'needs_attention',
];

function safePosition(entry: VaultEntry): VaultEntry {
  const title = entry.title || entry.statement || entry.description || 'Untitled Position';
  return {
    ...entry,
    id: entry.id || title,
    title,
    type: (entry.type || 'belief') as VaultType,
    statement: entry.statement ?? entry.description ?? '',
    description: entry.description ?? '',
    rationale: entry.rationale || '',
    confidence: confidencePercent(entry.confidence),
    status: entry.status || 'active',
    positionKind: entry.positionKind || 'interpretive',
    confidenceReasoning: entry.confidenceReasoning || '',
    assumptions: entry.assumptions || [],
    falsification: entry.falsification || '',
    consequences: entry.consequences || [],
    applications: entry.applications || [],
    tags: entry.tags || [],
    sourceIds: entry.sourceIds || [],
    evidenceFor: entry.evidenceFor || [],
    evidenceAgainst: entry.evidenceAgainst || [],
    missingEvidence: entry.missingEvidence || [],
    comparisonReviews: entry.comparisonReviews || [],
    versionHistory: entry.versionHistory || [],
    dateCreated: entry.dateCreated || entry.dateUpdated || new Date().toISOString(),
    dateUpdated: entry.dateUpdated || entry.dateCreated || new Date().toISOString(),
  };
}

function safePositionDate(value?: string) {
  const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toLocaleDateString() : date.toLocaleDateString();
}

function positionListReason(entry: VaultEntry, links: PhilosophicalLink[], viewFilter: PositionViewFilter) {
  const hasTension = links.some((link) =>
    ((link.fromType === 'position' && link.fromId === entry.id) || (link.toType === 'position' && link.toId === entry.id)) &&
    ['challenges', 'contradicts'].includes(link.type)
  );
  const hasSupport = (entry.evidenceFor || []).length > 0 || (entry.sourceIds || []).length > 0;
  if (viewFilter === 'emerging') return entry.confidence <= 40 ? 'Low confidence signal: this claim needs evidence before becoming stable.' : 'Draft or early-stage claim.';
  if (viewFilter === 'needs_evidence') return hasSupport ? 'Evidence exists, but review its quality before raising confidence.' : 'No source or supporting evidence is linked yet.';
  if (viewFilter === 'needs_opposition') return hasTension || (entry.evidenceAgainst || []).length ? 'Opposition exists; decide whether it weakens, refines, or contradicts the claim.' : 'No serious objection, counterexample, or challenge has been recorded yet.';
  if (viewFilter === 'under_review') return 'This position is uncertain, challenged, or explicitly under review.';
  if (viewFilter === 'revised') return 'This position has revision history and should preserve what changed.';
  if (viewFilter === 'abandoned') return 'This position is no longer current but remains part of the intellectual record.';
  if (viewFilter === 'tensions') return hasTension ? 'A typed challenge or contradiction is connected to this position.' : 'Potential tension with another position.';
  if (viewFilter === 'high_confidence') return 'High confidence should still show pressure: support, challenge, and falsification conditions.';
  if (viewFilter === 'low_confidence') return 'Low confidence means this should gather evidence, become an inquiry, or stay provisional.';
  if (viewFilter === 'suspended') return 'Suspended positions need a reason, review date, or replacement path.';
  if (viewFilter === 'unsupported') return hasSupport ? 'Supported by evidence.' : 'No source or supporting evidence is linked yet.';
  if (viewFilter === 'recently_changed') return `Last changed ${safePositionDate(entry.dateUpdated || entry.dateCreated)}.`;
  if ((entry.evidenceAgainst || []).length === 0 && !hasTension) return 'Next pressure: add a serious objection or counterposition.';
  if (!hasSupport) return 'Next pressure: add evidence or a source that actually supports this.';
  return 'Current belief-workbench item: support, challenge, express, or test it.';
}

type PositionDiagnostic = {
  supportCount: number;
  challengeCount: number;
  practiceCount: number;
  assumptionCount: number;
  daysSinceUpdate: number;
  completeness: number;
  assessmentScore: number;
  readinessLabel: string;
  label: string;
  nextAction: string;
  flags: string[];
};

function positionFormation(entry: VaultEntry) {
  const checks = [
    { label: 'core claim', complete: Boolean((entry.statement || entry.title || '').trim()) },
    { label: 'confidence reasoning', complete: Boolean(entry.confidenceReasoning?.trim()) },
    { label: 'assumptions', complete: (entry.assumptions || []).some((item) => item.trim()) },
    { label: 'falsification test', complete: Boolean(entry.falsification?.trim()) },
    {
      label: 'supporting evidence',
      complete: (entry.evidenceFor || []).some((item) => item.trim()) || (entry.sourceIds || []).length > 0,
    },
    { label: 'serious challenge', complete: (entry.evidenceAgainst || []).some((item) => item.trim()) },
  ];
  const complete = checks.filter((item) => item.complete).length;
  return {
    complete,
    total: checks.length,
    fullyFormed: complete === checks.length,
    completeness: Math.round((complete / checks.length) * 100),
    missing: checks.filter((item) => !item.complete).map((item) => item.label),
  };
}

function daysSince(value?: string) {
  const date = value ? new Date(value).getTime() : 0;
  if (!date || Number.isNaN(date)) return 999;
  return Math.max(0, Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24)));
}

function diagnosePosition(entry: VaultEntry, links: PhilosophicalLink[], practices: Practice[]): PositionDiagnostic {
  const { supportCount, challengeCount } = resolvePositionGrounds(entry, links);
  const practiceCount = practices.filter((practice) => (practice.positionIds || []).includes(entry.id)).length;
  const assumptionCount = (entry.assumptions || []).length;
  const formation = positionFormation(entry);
  const updatedAge = daysSince(entry.dateUpdated || entry.dateCreated);
  const flags: string[] = [];
  const evidenceDiversity = Math.min(new Set(entry.sourceIds || []).size, 4) * 5;
  const supportQuality = Math.min((entry.evidenceFor || []).filter((item) => item.trim().length > 24).length, 3) * 8;
  const challengePressure = Math.min(challengeCount, 3) * 8;
  const challengeResponse = (entry.falsification || '').trim() ? 10 : 0;
  const practiceSignal = Math.min(practiceCount, 2) * 6;
  const claritySignal = Math.min(formation.completeness, 100) * 0.18;
  const unansweredChallengePenalty = challengeCount > supportCount ? 12 : 0;
  const assessmentScore = Math.max(0, Math.min(100, Math.round(evidenceDiversity + supportQuality + challengePressure + challengeResponse + practiceSignal + claritySignal - unansweredChallengePenalty)));

  if (supportCount === 0) flags.push('unsupported');
  if (challengeCount === 0) flags.push('under-challenged');
  if (practiceCount === 0 && !['abandoned', 'rejected', 'replaced'].includes(entry.status)) flags.push('untested');
  if (assumptionCount === 0) flags.push('assumptions missing');
  if (confidencePercent(entry.confidence) >= 80 && challengeCount === 0) flags.push('overconfident');
  if (updatedAge > 90 && !['abandoned', 'rejected', 'replaced'].includes(entry.status)) flags.push('stale');
  if (['challenged', 'contested', 'unstable', 'questioning'].includes(entry.status)) flags.push('under pressure');

  let label = 'balanced';
  let nextAction = 'Review the claim, then decide whether it should be tested, revised, or expressed.';
  let readinessLabel = formation.missing.length ? `Developing · ${formation.missing.length} gaps` : 'Established';
  if (supportCount === 0) {
    label = 'needs evidence';
    nextAction = 'Add a source, annotation, or reason that directly supports the position.';
    readinessLabel = 'Developing · needs support';
  } else if (challengeCount === 0 && confidencePercent(entry.confidence) >= 80) {
    label = 'overconfident';
    nextAction = 'Add a serious objection before raising or keeping high confidence.';
    readinessLabel = 'Needs challenge';
  } else if (challengeCount === 0) {
    label = 'under-challenged';
    nextAction = 'Write the strongest opposing case or link a challenging position.';
    readinessLabel = 'Needs challenge';
  } else if (practiceCount === 0) {
    label = 'untested';
    nextAction = 'Create a practice or lived experiment that would test this position.';
    readinessLabel = 'Ready to test';
  } else if (updatedAge > 90) {
    label = 'stale';
    nextAction = 'Revisit the wording, confidence, and evidence after a long quiet period.';
    readinessLabel = 'Ready for review';
  } else if (assumptionCount === 0) {
    label = 'needs assumptions';
    nextAction = 'Name the assumptions this position depends on.';
  } else if (challengeCount > supportCount) {
    label = 'under pressure';
    nextAction = 'Revise, narrow, suspend, or answer the strongest challenge.';
  }

  return {
    supportCount,
    challengeCount,
    practiceCount,
    assumptionCount,
    daysSinceUpdate: updatedAge,
    completeness: formation.completeness,
    assessmentScore,
    readinessLabel,
    label,
    nextAction,
    flags,
  };
}

function buildStressStages(position: VaultEntry): StressStage[] {
  return [
    { field: 'evidenceAgainst', title: 'Strongest objection', prompt: 'What is the strongest reason this claim could be wrong? A counterexample or a different explanation from the same evidence both count.', existing: position.evidenceAgainst?.filter(item => item.trim()).at(-1) },
    { field: 'assumptions', title: 'Key assumption', prompt: 'What has to be true for this claim to hold? Name the one assumption that matters most.', existing: position.assumptions?.filter(item => item.trim()).at(-1) },
    { field: 'falsification', title: 'What would change my mind', prompt: 'What specific observation or result would make you narrow, revise, or let go of this claim?', existing: position.falsification },
  ];
}

export function BeliefVault({ aiSettings, entries, media, drafts, practices, questions, timeline, concepts, links, beliefProfiles, unknowns, onAddEntry, onUpdateEntry, onDeleteEntry, onAddConcept, onCreateLink, onAddDraft, onAddPractice, onAddQuestion, onUpdateQuestion, onUpdateLink, onOpenSource, onOpenQuestion, onOpenPractice, onOpenWork, focusedEntryId, onFocusedEntryHandled, onOpenEntryRoute }: BeliefVaultProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pullSide, setPullSide] = useState<'for' | 'against' | null>(null);
  const [comparePositionId, setComparePositionId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const entrySaveRef = useRef(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = usePersistentView<CollectionOrder>('noesis:position-sort', 'newest', ['newest', 'oldest', 'name']);
  const [typeFilter, setTypeFilter] = usePersistentView<'all' | VaultType>('noesis:positions-type', 'all', ['all', ...vaultTypes]);
  const [conceptFilter, setConceptFilter] = useState('all');
  const [viewFilter, setViewFilter] = usePersistentView<PositionViewFilter>('noesis:positions-filter', 'all', Object.keys(POSITION_VIEW_LABELS) as PositionViewFilter[]);
  const [viewMode, setViewMode] = useEntityViewPreference('positions');
  const [draftEntry, setDraftEntry] = useState<Partial<VaultEntry>>({ type: 'belief', title: '', statement: '', description: '', rationale: '', confidence: 60, status: 'active', tags: [] });
  const [conceptPopupName, setConceptPopupName] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultEntry | null>(null);
  const { toast } = useToast();

  const [stressDrafts, setStressDrafts] = useState<Record<string, string>>({});
  const [savingStress, setSavingStress] = useState(false);
  const stressSaveLock = useRef(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [workbenchTab, setWorkbenchTab] = useState<{ positionId: string; tab: string }>();
  const [assumptionPreview, setAssumptionPreview] = useState<{ key: string; pulled: ReadonlySet<number> }>();
  const [positionHistoryFilter, setPositionHistoryFilter] = useState<PositionHistoryRange & { positionId: string }>();
  const [stressStageIndex, setStressStageIndex] = useState(0);
  const [tensionDrawerOpen, setTensionDrawerOpen] = useState(false);

  const safeEntries = useMemo(() => entries.filter((entry) => entry?.id).map(safePosition), [entries]);
  const conceptFilterOptions = useMemo(
    () => concepts
      .map((concept) => concept.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    [concepts]
  );
  const positionDiagnostics = useMemo(() => {
    const map = new Map<string, PositionDiagnostic>();
    safeEntries.forEach((entry) => map.set(entry.id, diagnosePosition(entry, links, practices)));
    return map;
  }, [safeEntries, links, practices]);
  const routeControlsSelection = Boolean(onOpenEntryRoute);
  const activeEntryId = routeControlsSelection ? focusedEntryId : selectedId;
  const selected = safeEntries.find((entry) => entry.id === activeEntryId) || null;
  const filteredEntries = sortCollection(safeEntries.filter(e => {
    const diagnostic = positionDiagnostics.get(e.id) || diagnosePosition(e, links, practices);
    const typeOk = typeFilter === 'all'
      ? true
      : e.type === typeFilter;
    const hasTension = links.some((link) =>
      ((link.fromType === 'position' && link.fromId === e.id) || (link.toType === 'position' && link.toId === e.id)) &&
      ['challenges', 'contradicts'].includes(link.type)
    );
    const hasSupport = diagnostic.supportCount > 0;
    const changedAt = new Date(e.dateUpdated || e.dateCreated).getTime();
    const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const viewOk =
      viewFilter === 'all' ||
      (viewFilter === 'complete' && positionFormation(e).fullyFormed) ||
      (viewFilter === 'current' && derivePositionLifecycleStage(e.status) === 'current') ||
      (viewFilter === 'developing' && derivePositionLifecycleStage(e.status) === 'developing') ||
      (viewFilter === 'retired' && derivePositionLifecycleStage(e.status) === 'retired') ||
      (viewFilter === 'under_review' && derivePositionLifecycleStage(e.status) === 'under_review') ||
      (viewFilter === 'needs_attention' && (diagnostic.flags.length > 0 || diagnostic.completeness < 70 || diagnostic.assessmentScore < 45)) ||
      (viewFilter === 'emerging' && (['draft', 'tentative', 'developing'].includes(e.status) || e.confidence <= 40)) ||
      (viewFilter === 'needs_evidence' && !hasSupport) ||
      (viewFilter === 'needs_opposition' && diagnostic.challengeCount === 0) ||
      (viewFilter === 'needs_practice' && diagnostic.practiceCount === 0 && !['abandoned', 'rejected', 'replaced'].includes(e.status)) ||
      (viewFilter === 'revised' && e.status === 'revised') ||
      (viewFilter === 'abandoned' && ['abandoned', 'rejected', 'replaced'].includes(e.status)) ||
      (viewFilter === 'tensions' && hasTension) ||
      (viewFilter === 'high_confidence' && e.confidence >= 80) ||
      (viewFilter === 'low_confidence' && e.confidence <= 40) ||
      (viewFilter === 'overconfident' && diagnostic.flags.includes('overconfident')) ||
      (viewFilter === 'suspended' && e.status === 'suspended') ||
      (viewFilter === 'unsupported' && !hasSupport) ||
      (viewFilter === 'stale' && diagnostic.flags.includes('stale')) ||
      (viewFilter === 'recently_changed' && changedAt >= recentCutoff);
    const relatedSources = media.filter((source) => (e.sourceIds || []).includes(source.id));
    const relatedConcepts = concepts.filter((concept) => (e.tags || []).some((tag) => concept.name.toLowerCase() === tag.toLowerCase() || (concept.aliases || []).some((alias) => alias.toLowerCase() === tag.toLowerCase())));
    const conceptOk = conceptFilter === 'all' || relatedConcepts.some((concept) => concept.name.toLowerCase() === conceptFilter.toLowerCase());
    const relatedInquiries = questions.filter((question) => (question.beliefIds || []).includes(e.id) || (question.conceptIds || []).some((id) => relatedConcepts.some((concept) => concept.id === id)));
    const queryOk = searchMatches(search, [
      { value: e.title, label: 'position' },
      { value: e.statement, label: 'statement' },
      { value: e.description, label: 'meaning' },
      { value: e.positionKind, label: 'kind' },
      ...(e.assumptions || []).map((item) => ({ value: item, label: 'assumption' })),
      { value: e.falsification, label: 'falsification' },
      ...(e.consequences || []).map((item) => ({ value: item, label: 'consequence' })),
      ...(e.applications || []).map((item) => ({ value: item, label: 'application' })),
      ...relatedSources.flatMap((source) => [{ value: source.title, label: 'source' }, { value: source.creator, label: 'source creator' }]),
      ...relatedConcepts.map((concept) => ({ value: concept.name, label: 'concept' })),
      ...relatedInquiries.map((inquiry) => ({ value: inquiry.text, label: 'inquiry' })),
    ]);
    return typeOk && conceptOk && viewOk && queryOk;
  }), sortOrder, item => item.title, item => item.dateUpdated || item.dateCreated);

  const positionStats = useMemo(() => {
    const tensionCount = safeEntries.filter((entry) => links.some((link) =>
      ((link.fromType === 'position' && link.fromId === entry.id) || (link.toType === 'position' && link.toId === entry.id)) &&
      ['challenges', 'contradicts'].includes(link.type)
    )).length;
    return {
      total: safeEntries.length,
      complete: safeEntries.filter((entry) => positionFormation(entry).fullyFormed).length,
      current: safeEntries.filter((entry) => derivePositionLifecycleStage(entry.status) === 'current').length,
      developing: safeEntries.filter((entry) => derivePositionLifecycleStage(entry.status) === 'developing').length,
      retired: safeEntries.filter((entry) => derivePositionLifecycleStage(entry.status) === 'retired').length,
      underReview: safeEntries.filter((entry) => derivePositionLifecycleStage(entry.status) === 'under_review').length,
      needsAttention: safeEntries.filter((entry) => {
        const diagnostic = positionDiagnostics.get(entry.id);
        return Boolean(diagnostic && (diagnostic.flags.length > 0 || diagnostic.completeness < 70 || diagnostic.assessmentScore < 45));
      }).length,
      unsupported: safeEntries.filter((entry) => positionDiagnostics.get(entry.id)?.supportCount === 0).length,
      needsPractice: safeEntries.filter((entry) => positionDiagnostics.get(entry.id)?.flags.includes('untested')).length,
      overconfident: safeEntries.filter((entry) => positionDiagnostics.get(entry.id)?.flags.includes('overconfident')).length,
      stale: safeEntries.filter((entry) => positionDiagnostics.get(entry.id)?.flags.includes('stale')).length,
      tensions: tensionCount,
    };
  }, [safeEntries, links, positionDiagnostics]);

  const clearPositionFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setConceptFilter('all');
    setViewFilter('all');
  };

  const positionFiltersActive = Boolean(search || typeFilter !== 'all' || conceptFilter !== 'all' || viewFilter !== 'all');
  const activeFilterLabels = [
    search ? `Search: ${search}` : null,
    viewFilter !== 'all' ? `View: ${POSITION_VIEW_LABELS[viewFilter]}` : null,
    typeFilter !== 'all' ? `Type: ${TYPE_LABELS[typeFilter as VaultType]}` : null,
    conceptFilter !== 'all' ? `Concept: ${conceptFilter}` : null,
    viewMode !== 'cards' ? `Layout: ${viewMode}` : null,
  ].filter(Boolean) as string[];

  const openEditor = (entry?: VaultEntry) => {
    setDraftEntry(entry ? { ...entry, rationale: entry.rationale || '', confidence: confidencePercent(entry.confidence) } : { type: 'belief', title: '', statement: '', description: '', rationale: '', confidence: 60, status: 'developing', positionKind: 'interpretive', tags: [], assumptions: [], consequences: [], applications: [], evidenceFor: [], evidenceAgainst: [] });
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!focusedEntryId) {
      setSelectedId(null);
      return;
    }
    if (safeEntries.some((entry) => entry.id === focusedEntryId)) {
      if (!routeControlsSelection) setSelectedId(focusedEntryId);
      onFocusedEntryHandled?.();
    }
  }, [safeEntries, focusedEntryId, onFocusedEntryHandled, routeControlsSelection]);

  const saveEntry = async () => {
    if (!draftEntry.title?.trim()) return;
    if (entrySaveRef.current) return;
    entrySaveRef.current = true;
    setSavingEntry(true);
    try {
    if (draftEntry.id) {
      const current = safeEntries.find(entry => entry.id === draftEntry.id);
      if (!current) throw new Error('This position is no longer available.');
      await onUpdateEntry({
        ...current,
        title: draftEntry.title.trim(),
        type: draftEntry.type ?? current.type,
        positionKind: draftEntry.positionKind ?? current.positionKind,
        status: draftEntry.status ?? current.status,
        statement: draftEntry.statement?.trim() ?? current.statement,
        dateUpdated: today(),
      });
    }
    else await onAddEntry({ ...draftEntry, title: draftEntry.title.trim(), tags: normalizeConceptTags(draftEntry.tags) });
    setEditorOpen(false);
    } catch (error) {
      toast({ title: 'Position not saved', description: noesisUserError(error, 'save this position'), variant: 'destructive' });
    } finally {
      entrySaveRef.current = false;
      setSavingEntry(false);
    }
  };

  const openEntry = (id: string) => {
    setSelectedId(id);
    onOpenEntryRoute?.(id);
  };

  const closeEntry = () => {
    setSelectedId(null);
    onOpenEntryRoute?.(null);
  };

  const tensions = useMemo(() => {
    const active = safeEntries.filter((e) => e.status !== 'rejected' && e.status !== 'abandoned');
    const pairs: Array<{ a: VaultEntry; b: VaultEntry; sharedTags: string[]; severity: 'possible contradiction' | 'possible qualification' | 'possible complement' | 'shared concept only' }> = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const tagsA = (active[i].tags || []).map((t) => t.toLowerCase());
        const tagsB = (active[j].tags || []).map((t) => t.toLowerCase());
        const shared = tagsA.filter((t) => tagsB.includes(t));
        if (shared.length > 0 && active[i].id !== active[j].id) {
          const hasExplicitConflict = links.some((link) =>
            ['contradicts', 'challenges'].includes(link.type) &&
            ((link.fromId === active[i].id && link.toId === active[j].id) || (link.fromId === active[j].id && link.toId === active[i].id))
          );
          const hasRefinement = links.some((link) =>
            ['refines', 'coheres'].includes(link.type) &&
            ((link.fromId === active[i].id && link.toId === active[j].id) || (link.fromId === active[j].id && link.toId === active[i].id))
          );
          const severity = hasExplicitConflict
            ? 'possible contradiction'
            : hasRefinement
              ? 'possible qualification'
              : shared.length > 1
                ? 'possible complement'
                : 'shared concept only';
          pairs.push({ a: active[i], b: active[j], sharedTags: shared, severity });
        }
      }
    }
    return pairs.slice(0, 8);
  }, [safeEntries, links]);

  if (selected) {
    const range = positionHistoryFilter?.positionId === selected.id ? positionHistoryFilter : ALL_POSITION_HISTORY;
    const hasRange = Boolean(range.from || range.to);
    const invalidRange = Boolean(range.from && range.to && range.from > range.to);
    const rangeKey = `${selected.id}:${range.from}:${range.to}`;
    const historyDates = <PositionHistoryDates range={range} active={hasRange} invalid={invalidRange}
      onChange={next => setPositionHistoryFilter({ ...next, positionId: selected.id })} />;
    const linkedSources = media.filter((item) => (selected.sourceIds || []).includes(item.id));
    const linkedDrafts = drafts.filter((draft) => (draft.beliefIds || []).includes(selected.id));
    const linkedPractices = practices.filter((practice) => (practice.positionIds || []).includes(selected.id));
    const linkedQuestions = questions.filter((question) => question.id === selected.sourceInquiryId || (question.beliefIds || []).includes(selected.id));
    const typedLinks = links.filter((link) => (link.fromType === 'position' && link.fromId === selected.id) || (link.toType === 'position' && link.toId === selected.id));
    const referenceTargets = new Set(typedLinks.filter(link => link.type === 'references' && link.createdFrom === 'manual').map(link =>
      link.fromType === 'position' && link.fromId === selected.id ? `${link.toType}:${link.toId}` : `${link.fromType}:${link.fromId}`));
    const linkableRecords: LinkableRecord<'source' | 'inquiry' | 'position' | 'practice' | 'work'>[] = [
      ...media.map(item => ({ id: item.id, type: 'source' as const, label: 'Source', title: item.title })),
      ...questions.map(item => ({ id: item.id, type: 'inquiry' as const, label: 'Inquiry', title: item.text })),
      ...safeEntries.filter(item => item.id !== selected.id).map(item => ({ id: item.id, type: 'position' as const, label: 'Position', title: item.title })),
      ...practices.map(item => ({ id: item.id, type: 'practice' as const, label: 'Praxis', title: item.title })),
      ...drafts.map(item => ({ id: item.id, type: 'work' as const, label: 'Work', title: item.title || 'Untitled' })),
    ];
    const tensionLinks = typedLinks.filter((link) => link.type === 'contradicts' || link.type === 'challenges' || link.note?.toLowerCase().includes('tension'));
    const relatedPositions = safeEntries.filter((entry) =>
      entry.id !== selected.id &&
      typedLinks.some((link) => (link.type !== 'references' || link.createdFrom !== 'manual') && (
        (link.fromId === entry.id && link.toId === selected.id) ||
        (link.toId === entry.id && link.fromId === selected.id)
      ))
    );
    const beliefProfile = beliefProfiles.find((item) => item.positionId === selected.id);
    const linkedUnknowns = unknowns.filter((item) => (item.positionIds || []).includes(selected.id));
    const formation = positionFormation(selected);
    const diagnostic = positionDiagnostics.get(selected.id) || diagnosePosition(selected, links, practices);
    const firstLinkedSource = linkedSources[0];
    const stressStages = buildStressStages(selected);
    const selectedStressStage = stressStages[Math.min(stressStageIndex, stressStages.length - 1)];
    const stressDraftKey = JSON.stringify([selected.id, selectedStressStage.field]);
    const stressAnswer = stressDrafts[stressDraftKey] || '';
    const { supportCount, challengeCount, linked: linkedGrounds } = resolvePositionGrounds(selected, links);
    const { result, resultNeedsReview } = positionReviewInputs(selected, linkedPractices, linkedGrounds.against);
    const revisionCount = (selected.versionHistory || []).length;

    const previewSource = (source: Media) => {
      openNoesisObjectPreview({
        id: `position-source-${source.id}`,
        label: source.title,
        section: 'Source',
        description: source.creator || source.type || 'Open source workspace.',
        view: 'library',
        targetId: source.id,
        targetType: 'source',
        objectType: 'Raw Input',
        kind: 'object',
        intellectualStage: 'Encounter',
        hierarchyLevel: 'Raw',
        currentState: source.status,
        summary: source.description || source.capture?.after?.coreArgument || source.capture?.before?.openQuestion || 'A source linked to this position.',
        matchedBecause: `This source is attached as evidence or context for "${selected.title}".`,
        connectedConcepts: source.tags || selected.tags || [],
        relatedObjects: [`Position: ${selected.title}`, `${source.annotations?.length || 0} annotations`],
        lastChangedAt: source.dateUpdated || source.dateAdded,
        quickActionLabel: 'Open Source',
        quickActions: [
          { label: 'Open Source Workspace', view: 'library', targetId: source.id, targetType: 'source' },
          { label: 'Return to Position', view: 'vault', targetId: selected.id, targetType: 'position' },
        ],
        thinkingEventHint: 'Previewing a source is orientation. Completing source reflection, distilling a claim, or creating annotations should create intellectual history.',
      });
    };

    const previewInquiry = (question: Question) => {
      openNoesisObjectPreview({
        id: `position-inquiry-${question.id}`,
        label: question.text,
        section: 'Inquiry',
        description: question.status || 'Open inquiry workspace.',
        view: 'questions',
        targetId: question.id,
        targetType: 'inquiry',
        objectType: 'Interpretive Object',
        kind: 'object',
        intellectualStage: 'Question',
        hierarchyLevel: 'Interpretive',
        currentState: question.status,
        summary: question.answer || 'An inquiry linked to this position.',
        matchedBecause: `This inquiry gives uncertainty, origin, or pressure to "${selected.title}".`,
        connectedConcepts: selected.tags || [],
        relatedObjects: [`Position: ${selected.title}`, `${question.sourceIds?.length || 0} sources`, `${question.draftIds?.length || 0} works`],
        lastChangedAt: question.dateUpdated || question.dateCreated,
        quickActionLabel: 'Open Inquiry',
        quickActions: [
          { label: 'Open Investigation', view: 'questions', targetId: question.id, targetType: 'inquiry' },
          { label: 'Return to Position', view: 'vault', targetId: selected.id, targetType: 'position' },
        ],
        thinkingEventHint: 'Previewing an inquiry is orientation. Reformulating, adding assumptions, resolving, or promoting it should create history.',
      });
    };

    const previewWork = (draft: Draft) => {
      openNoesisObjectPreview({
        id: `position-work-${draft.id}`,
        label: draft.title,
        section: 'Work',
        description: `${draft.type.replace(/_/g, ' ')} - ${draft.status}`,
        view: 'writing',
        targetId: draft.id,
        targetType: 'work',
        objectType: 'Expression Object',
        kind: 'object',
        intellectualStage: 'Express',
        hierarchyLevel: 'Expression',
        currentState: draft.status,
        summary: draft.body || draft.draftContent || 'A work expressing this position.',
        matchedBecause: `This work expresses, tests, or clarifies "${selected.title}".`,
        connectedConcepts: draft.conceptTags || selected.tags || [],
        relatedObjects: [`Position: ${selected.title}`, `${draft.sourceIds?.length || 0} linked sources`, `${draft.questionIds?.length || 0} linked inquiries`],
        lastChangedAt: draft.dateUpdated || draft.dateCreated,
        quickActionLabel: 'Open Work',
        quickActions: [
          { label: 'Open Work Studio', view: 'writing', targetId: draft.id, targetType: 'work' },
          { label: 'Return to Position', view: 'vault', targetId: selected.id, targetType: 'position' },
        ],
        thinkingEventHint: 'Previewing a work is orientation. Completing, substantially revising, or synthesizing linked positions should create a thinking event.',
      });
    };

    const previewPractice = (practice: Practice) => {
      openNoesisObjectPreview({
        id: `position-practice-${practice.id}`,
        label: practice.title,
        section: 'Practice',
        description: `${practice.type.replace(/_/g, ' ')} - ${practice.status}`,
        view: 'labs',
        targetId: practice.id,
        targetType: 'practice',
        objectType: 'Experiment Object',
        kind: 'object',
        intellectualStage: 'Test',
        hierarchyLevel: 'Expression',
        currentState: practice.status,
        summary: practice.description || practice.notes || 'A lived test attached to this position.',
        matchedBecause: `This practice tests whether "${selected.title}" survives lived application.`,
        connectedConcepts: practice.conceptTags || selected.tags || [],
        relatedObjects: [`Position: ${selected.title}`, `${practice.logDates?.length || 0} logs`, `${practice.questionIds?.length || 0} inquiries`],
        lastChangedAt: practice.dateUpdated || practice.dateCreated,
        quickActionLabel: 'Open Practice',
        quickActions: [
          { label: 'Open Practice Field', view: 'labs', targetId: practice.id, targetType: 'practice' },
          { label: 'Return to Position', view: 'vault', targetId: selected.id, targetType: 'position' },
        ],
        thinkingEventHint: 'Previewing a practice is orientation. Starting, concluding, or logging an outcome that changes a belief should create history.',
      });
    };

    /* Release 1 removes the former persisted AI suggestion pipeline.
    const createMissingPerspective = async () => {
      const positionMemory = {
        scope: 'linked_objects' as const,
        instruction: 'Use the selected position first. Use linked objects only to identify grounded missing perspectives. Do not use generic perspective lists.',
        itemMemory: [
          `Position title: ${selected.title}`,
          `Statement: ${selected.statement || 'No statement.'}`,
          selected.description ? `Scope: ${selected.description}` : '',
          `Status: ${selected.status}`,
          `Confidence: ${confidencePercent(selected.confidence)}%`,
          selected.confidenceReasoning ? `Confidence reasoning: ${selected.confidenceReasoning}` : '',
          (selected.assumptions || []).length ? `Assumptions: ${(selected.assumptions || []).join('; ')}` : '',
        ].filter(Boolean),
        linkedMemory: [
          ...linkedSources.slice(0, 6).map((source) => `Source ${source.title}: ${source.description || source.capture?.after?.coreArgument || 'No summary.'}`),
          ...linkedQuestions.slice(0, 5).map((question) => `Inquiry ${question.text}: ${question.answer || question.status || 'open'}`),
          ...linkedPractices.slice(0, 5).map((practice) => `Practice ${practice.title}: ${practice.description || practice.notes || practice.status}`),
          ...linkedDrafts.slice(0, 4).map((draft) => `Work ${draft.title}: ${draft.body || draft.status}`),
          ...tensionLinks.slice(0, 5).map((link) => `Tension link ${link.type}: ${link.note || `${link.fromLabel || link.fromId} -> ${link.toLabel || link.toId}`}`),
        ],
      };
      try {
        const result = await aiClient.detectMissingPerspectives({
          targetType: 'position',
          targetTitle: selected.title,
          content: `${selected.title}\n${selected.statement}\n${selected.description || ''}`,
          sourceTitles: linkedSources.map((item) => item.title),
          conceptTags: selected.tags || [],
          existingPerspectiveCoverage: typedLinks.map((item) => item.type),
          memoryContext: positionMemory,
        });
        result.suggestions.forEach((suggestion) => onCreateSuggestion({
          targetType: 'position',
          targetId: selected.id,
          suggestionType: 'missing_perspective',
          title: suggestion.perspective,
          description: suggestion.question,
          reasoning: suggestion.whyItMatters,
          evidence: suggestion.evidence,
          confidence: suggestion.confidence,
          status: 'pending',
        }));
        toast({ title: 'Missing perspectives suggested', description: 'Review the possible lenses below before accepting any of them.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'AI Unavailable', description: noesisUserError(error, 'Noesis could not suggest perspectives right now.') });
      }
    };

    const createMissingQuestions = async () => {
      const workspaceMemory = [
        `${safeEntries.length} total positions`,
        `${questions.length} total inquiries`,
        `${media.length} total sources`,
        `${unknowns.length} total unknowns`,
        `${links.length} typed links`,
      ];
      try {
        const result = await aiClient.detectMissingQuestions({
          concepts: selected.tags || [],
          positions: [selected.statement || selected.title],
          unknowns: linkedUnknowns.map((item) => item.title),
          inquiries: questions.filter((item) => (item.beliefIds || []).includes(selected.id)).map((item) => item.text),
          contradictions: tensionLinks.map((item) => item.note || `${item.fromLabel || item.fromId} ${item.type} ${item.toLabel || item.toId}`),
          memoryContext: {
            scope: 'whole_workspace',
            instruction: 'Use the selected position first, then compare it to the wider workspace summary to find missing high-value questions. Do not ask generic philosophy questions.',
            itemMemory: [
              `Position: ${selected.title}`,
              `Statement: ${selected.statement || selected.description || 'No statement.'}`,
              `Concepts: ${(selected.tags || []).join(', ') || 'none'}`,
            ],
            linkedMemory: [
              ...linkedSources.slice(0, 5).map((source) => `Linked source ${source.title}: ${source.description || source.capture?.after?.coreArgument || 'No summary.'}`),
              ...linkedQuestions.slice(0, 5).map((question) => `Linked inquiry ${question.text}: ${question.answer || question.status || 'open'}`),
              ...linkedUnknowns.slice(0, 5).map((unknown) => `Linked unknown ${unknown.title}: ${unknown.status}`),
            ],
            workspaceMemory,
          },
        });
        result.suggestions.forEach((suggestion) => onCreateSuggestion({
          targetType: 'position',
          targetId: selected.id,
          suggestionType: 'missing_question',
          title: suggestion.question,
          description: suggestion.reasoning,
          reasoning: suggestion.reasoning,
          evidence: suggestion.evidence,
          confidence: suggestion.confidence,
          status: 'pending',
        }));
        toast({ title: 'Missing questions suggested', description: 'Use them to open new inquiries where the map is thin.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'AI Unavailable', description: noesisUserError(error, 'Noesis could not detect missing questions right now.') });
      }
    };

    const createStressTests = async () => {
      try {
        const result = await aiClient.generateStressTest({
          targetType: 'position',
          title: selected.title,
          content: `${selected.statement}\n${selected.description || ''}`,
          memoryContext: {
            scope: 'linked_objects',
            instruction: 'Stress-test this exact position. Use linked support, challenges, assumptions, sources, and practices. Do not drift into unrelated worldview analysis.',
            itemMemory: [
              `Position: ${selected.title}`,
              `Statement: ${selected.statement || 'No statement.'}`,
              selected.description ? `Scope: ${selected.description}` : '',
              (selected.assumptions || []).length ? `Assumptions: ${(selected.assumptions || []).join('; ')}` : '',
              selected.falsification ? `Existing falsification condition: ${selected.falsification}` : '',
              (selected.evidenceFor || []).length ? `Evidence for: ${(selected.evidenceFor || []).join('; ')}` : '',
              (selected.evidenceAgainst || []).length ? `Evidence against: ${(selected.evidenceAgainst || []).join('; ')}` : '',
            ].filter(Boolean),
            linkedMemory: [
              ...linkedSources.slice(0, 5).map((source) => `Source ${source.title}: ${source.description || source.capture?.after?.coreArgument || 'No summary.'}`),
              ...linkedPractices.slice(0, 5).map((practice) => `Practice ${practice.title}: ${practice.description || practice.status}`),
              ...tensionLinks.slice(0, 5).map((link) => `Challenge link ${link.type}: ${link.note || `${link.fromLabel || link.fromId} -> ${link.toLabel || link.toId}`}`),
            ],
          },
        });
        setStressTests(result.prompts);
        result.prompts.forEach((prompt) => onCreateSuggestion({
          targetType: 'position',
          targetId: selected.id,
          suggestionType: 'stress_test',
          title: 'Stress test prompt',
          description: prompt.question,
          reasoning: 'A position becomes more trustworthy when it survives pressure.',
          evidence: linkedSources.map((item) => item.title).slice(0, 3),
          confidence: 0.7,
          status: 'pending',
        }));
        toast({ title: 'Stress tests generated', description: 'Answer one prompt to pressure-test the position instead of just polishing it.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'AI Unavailable', description: noesisUserError(error, 'Noesis could not generate stress tests right now.') });
      }
    };

    */
    const saveStressAnswer = async () => {
      const answer = stressAnswer.trim();
      const { field, title } = selectedStressStage;
      if (!answer || stressSaveLock.current) return;
      const current = selected[field];
      if (typeof current === 'string' ? current.trim() === answer : current?.some(item => item.trim() === answer)) {
        toast({ title: 'Already recorded' });
        return;
      }
      const patch = field === 'falsification'
        ? { falsification: answer }
        : { [field]: [...(selected[field] || []), answer] };
      stressSaveLock.current = true;
      setSavingStress(true);
      try {
        await onUpdateEntry({
          ...selected,
          ...patch,
          versionHistory: [
            ...(selected.versionHistory || []),
            // Carry the confidence this event left the position at, even when
            // the event did not move it. A revision without one is invisible
            // to the trace and drops out of the belief river entirely, which
            // is why a river could show no width change across real work.
            { date: today(), eventType: field === 'evidenceAgainst' ? 'challenged' : 'refined', description: `Stress test (${title}): ${answer}`, confidence: selected.confidence },
          ],
          dateUpdated: today(),
        });
        setStressDrafts(drafts => ({ ...drafts, [stressDraftKey]: '' }));
        toast({ title: field === 'falsification' ? 'Saved to Calibrate' : 'Saved to Grounds' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Stress test not saved', description: noesisUserError(error, 'Try again to save your answer.') });
      } finally {
        stressSaveLock.current = false;
        setSavingStress(false);
      }
    };

    const comparisonTarget = safeEntries.find((entry) => entry.id === comparePositionId) || null;
    const scopeClaim = selected.statement.trim() || selected.title;
    const savedScope = selected.scopeCheck;
    const currentScope = savedScope && scopeCheckIsCurrent(savedScope, scopeClaim) ? savedScope : undefined;
    const scopeNote = currentScope ? `Scope check: ${formatPositionScopeCheck(currentScope)}` : '';

    const buildPositionAiEnvelope = (action: ContextualAiAction): AiContextEnvelope | null => {
      if (action === 'compare_selected_positions' && !comparisonTarget) return null;
      return {
        action,
        scope: action === 'compare_selected_positions' ? 'selected_pair' : 'linked_items',
        targetType: 'position',
        targetId: selected.id,
        itemMemory: [
          `Position: ${selected.title}`,
          `Statement: ${selected.statement || selected.description || 'No statement'}`,
          selected.description ? `Scope: ${selected.description}` : '',
          `Confidence: ${confidencePercent(selected.confidence)}%`,
          `Recorded support: ${(selected.evidenceFor || []).length} supporting notes and ${linkedSources.length} linked sources`,
          `Recorded pressure: ${(selected.evidenceAgainst || []).length} challenges, ${(selected.assumptions || []).length} assumptions, and ${linkedPractices.length} linked practices`,
          (selected.assumptions || []).length ? `Assumptions: ${(selected.assumptions || []).join('; ')}` : '',
          (selected.evidenceFor || []).length ? `Evidence for: ${(selected.evidenceFor || []).join('; ')}` : '',
          (selected.evidenceAgainst || []).length ? `Evidence against: ${(selected.evidenceAgainst || []).join('; ')}` : '',
          selected.falsification ? `Falsification condition: ${selected.falsification}` : '',
          scopeNote ? `${scopeNote} (the user's judgment about one case; not evidence by itself)` : '',
        ].filter(Boolean),
        linkedMemory: [
          ...linkedSources.slice(0, 8).map((source) => `Source: ${source.title} - ${source.description || source.capture?.after?.coreArgument || 'No summary'}`),
          ...linkedQuestions.slice(0, 5).map((question) => `Inquiry: ${question.text} - ${question.answer || question.status}`),
          ...linkedPractices.slice(0, 5).map((practice) => `Practice: ${practice.title} - ${practice.observedOutcome || practice.status}`),
        ],
        secondaryTarget: action === 'compare_selected_positions' && comparisonTarget ? {
          targetType: 'position',
          targetId: comparisonTarget.id,
          label: comparisonTarget.title,
          memory: [
            `Position: ${comparisonTarget.title}`,
            `Statement: ${comparisonTarget.statement || comparisonTarget.description || 'No statement'}`,
            `Confidence: ${confidencePercent(comparisonTarget.confidence)}%`,
            `Evidence for: ${(comparisonTarget.evidenceFor || []).join('; ') || 'none recorded'}`,
            `Evidence against: ${(comparisonTarget.evidenceAgainst || []).join('; ') || 'none recorded'}`,
            `Assumptions: ${(comparisonTarget.assumptions || []).join('; ') || 'none recorded'}`,
            `Falsification condition: ${comparisonTarget.falsification || 'none recorded'}`,
          ],
        } : undefined,
      };
    };

    const acceptPositionAiResult = async (result: AiReviewResult, content: string) => {
      await onUpdateEntry(selected, { result, text: content, comparisonId: result.action === 'compare_selected_positions' ? comparisonTarget?.id : undefined });
    };

    const statedPercent = confidencePercent(selected.confidence);
    const grounds = evidenceBalance(supportCount, challengeCount);
    const gap = grounds === null ? null : statedPercent - grounds;
    const supportItems = selected.evidenceFor || [];
    const challengeItems = selected.evidenceAgainst || [];
    let hereId: string; let guide: string;
    if (derivePositionLifecycleStage(selected.status) === 'retired') { hereId = 'pos-revise'; guide = 'This position is retired. Its grounds and decisions are still available.'; }
    else if (resultNeedsReview) { hereId = 'pos-calibrate'; guide = 'A linked Praxis result is ready to review. See whether it changes what you hold.'; }
    else if (!supportCount || !challengeCount) { hereId = 'pos-grounds'; guide = !supportCount ? 'Add what supports it.' : 'Add at least one challenge: what would count against it?'; }
    else if (gap !== null && Math.abs(gap) > 10) { hereId = 'pos-calibrate'; guide = 'Your confidence and the evidence balance differ. Review the grounds before deciding whether to change it.'; }
    else if (revisionCount > 1) { hereId = 'pos-revise'; guide = 'A revision is recorded.'; }
    else { hereId = 'pos-revise'; guide = 'Calibrated. If your thinking changed, record a revision. Otherwise you are done.'; }
    const groundRow = (text: string, side: 'for' | 'against', index: number) => (
      <Row key={`${side}-${index}`} onRemove={() => onUpdateEntry({ ...selected, [side === 'for' ? 'evidenceFor' : 'evidenceAgainst']: (side === 'for' ? supportItems : challengeItems).filter((_, i) => i !== index), dateUpdated: today() })} removeLabel="Remove">{text}</Row>
    );
    const addGround = (side: 'for' | 'against') => async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('input'); const text = input?.value.trim();
      if (!text) return;
      try {
        await saveWorkspace({ [side === 'for' ? 'evidenceFor' : 'evidenceAgainst']: [...(side === 'for' ? supportItems : challengeItems), text] });
        if (input?.value.trim() === text) input.value = '';
      } catch (error) {
        toast({ title: 'Ground not saved', description: noesisUserError(error, 'save this ground'), variant: 'destructive' });
      }
    };
    const revisionDecisions = [['active', 'Retain'], ['revised', 'Revise'], ['replaced', 'Replace'], ['suspended', 'Suspend'], ['abandoned', 'Retire']] as const;

    const tools = (
        <ToolsBand note="Test this claim or carry it into a linked experiment, work, or inquiry.">
          <Tool label="Stress test" icon={Gauge}>
            <label className="grid gap-1 text-sm font-medium">Test this claim from one angle
              <select aria-label="Stress test prompt" className="min-h-11 w-fit max-w-full rounded-md border border-border bg-background px-2" value={stressStageIndex} onChange={event => setStressStageIndex(Number(event.target.value))}>
                {stressStages.map((stage, index) => <option key={stage.field} value={index}>{stage.title}</option>)}
              </select>
            </label>
            <p className="mt-2 text-sm leading-6">{selectedStressStage.prompt}</p>
            {selectedStressStage.existing && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">Recorded: {selectedStressStage.existing}</p>}
            <Textarea value={stressAnswer} onChange={event => {
              const answer = event.target.value;
              setStressDrafts(drafts => ({ ...drafts, [stressDraftKey]: answer }));
            }} disabled={savingStress} className="mt-2 min-h-[80px]" placeholder="Record one concrete point." aria-label="Stress test answer" />
            <Button className="mt-2" variant="secondary" size="sm" onClick={() => void saveStressAnswer()} disabled={savingStress || !stressAnswer.trim()}>
              {savingStress ? 'Saving…' : selectedStressStage.field === 'falsification' ? 'Save to Calibrate' : 'Save to Grounds'}
            </Button>
          </Tool>
          <Tool label="Scope check" icon={ScanLine}>
            <PositionScopeTool key={JSON.stringify([selected.id, scopeClaim])} claim={scopeClaim} saved={savedScope} onSave={async scopeCheck => {
              await onUpdateEntry({ ...selected, scopeCheck, dateUpdated: today() });
              toast({ title: 'Scope check saved to Revise' });
            }} />
          </Tool>
          {tensionLinks.length > 0 && (
            <Tool label={`Tensions · ${tensionLinks.length}`} icon={Zap}>
              <TensionResolutionPanel selected={selected} tensionLinks={tensionLinks} onUpdateEntry={onUpdateEntry} onUpdateLink={onUpdateLink} />
            </Tool>
          )}
          <PositionHandoffs key={selected.id} position={selected} inquiries={linkedQuestions} concepts={concepts}
            onAddPractice={onAddPractice} onAddDraft={onAddDraft} onAddQuestion={onAddQuestion} onUpdateQuestion={onUpdateQuestion}
            onOpenPractice={onOpenPractice} onOpenWork={onOpenWork} onOpenQuestion={onOpenQuestion} />
        </ToolsBand>
    );

    const saveWorkspace = async (patch: Partial<VaultEntry>) => {
      if (entrySaveRef.current) throw new Error('Another edit is still saving. Please try again.');
      entrySaveRef.current = true;
      try { await onUpdateEntry({ ...selected, ...patch, dateUpdated: today() }); }
      finally { entrySaveRef.current = false; }
    };
    const hasSourcePassage = selected.createdFrom === 'annotation' && !!selected.sourceAnnotationId;
    const claim = (
        <RecordSection id="pos-claim" title="Claim" here={hereId === 'pos-claim'}>
          <PositionWorkspaceText key={`${selected.id}:statement`} label="Position statement" value={selected.statement} placeholder="What do you believe, in one clear sentence?" onSave={statement => saveWorkspace({ statement })} />
          <PositionWorkspaceText key={`${selected.id}:rationale`} label="Why you hold it" value={selected.rationale || ''} placeholder="What makes this claim persuasive to you?" onSave={rationale => saveWorkspace({ rationale })} />
          {hasSourcePassage && selected.description.trim() && selected.description.trim() !== selected.statement.trim() && (
            <div className="mt-4 border-l border-border pl-3 text-sm">
              <Eyebrow>Source passage</Eyebrow>
              <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{selected.description}</p>
              {linkedSources.length === 1 && <Button type="button" variant="link" size="sm" className="px-0" onClick={() => previewSource(linkedSources[0])}>Open source</Button>}
            </div>
          )}
          {!formation.fullyFormed && <p className="mt-3 text-sm text-muted-foreground">Still missing: {formation.missing.join(', ')}.</p>}
        </RecordSection>
    );

    const linkedGroundRow = (link: PhilosophicalLink) => (
      <p key={link.id} className="my-2 break-words text-sm">
        <Badge shape="rule" className="mr-2">Linked</Badge>
        <strong>{link.fromLabel || 'Linked record'}:</strong> {link.note}
      </p>
    );
    const assumptions = selected.assumptions || [];
    const assumptionKey = JSON.stringify([selected.id, assumptions]);
    const pulled = assumptionPreview?.key === assumptionKey ? assumptionPreview.pulled : new Set<number>();
    const toggleAssumption = (index: number) => setAssumptionPreview(current => {
      const next = new Set(current?.key === assumptionKey ? current.pulled : []);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { key: assumptionKey, pulled: next };
    });

    const groundsPanel = (
        <RecordSection id="pos-grounds" title="Grounds and assumptions" here={hereId === 'pos-grounds'}>
          <DeskFindings type="position" id={selected.id} findings={selected.contextDeskFindings} />
          <div className="noesis-step__cols noesis-step__cols--even">
            <div data-tone="practice" className="min-w-0">
              <Eyebrow tone="practice">Support</Eyebrow>
              {!!(supportItems.length || linkedGrounds.for.length) && (
                <div className="noesis-position-ground-list mt-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Recorded support">
                  {supportItems.map((text, index) => groundRow(text, 'for', index))}
                  {linkedGrounds.for.map(linkedGroundRow)}
                </div>
              )}
              {!supportCount && <SectionEmpty title="None yet." />}
              {linkedSources.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Related sources are listed in Connections. A link counts here only when it records how the source bears on this claim.</p>}
              <form className="noesis-add" onSubmit={addGround('for')}><Input placeholder="Add support" aria-label="Add support" className="h-9" /><Button type="submit" variant="secondary" tone="practice">Add</Button></form>
              <Button variant="link" size="sm" onClick={() => setPullSide('for')}>⇣ Pull from your workspace</Button>
            </div>
            <div data-tone="challenge" className="min-w-0">
              <Eyebrow tone="challenge">Challenges</Eyebrow>
              {!!(challengeItems.length || linkedGrounds.against.length) && (
                <div className="noesis-position-ground-list mt-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Recorded challenges">
                  {challengeItems.map((text, index) => groundRow(text, 'against', index))}
                  {linkedGrounds.against.map(linkedGroundRow)}
                </div>
              )}
              {!challengeCount && <SectionEmpty title="None yet." hint="Add an objection or counterexample you already know about." />}
              <form className="noesis-add" onSubmit={addGround('against')}><Input placeholder="Add a challenge" aria-label="Add a challenge" className="h-9" /><Button type="submit" variant="secondary" tone="challenge">Add</Button></form>
              <Button variant="link" size="sm" onClick={() => setPullSide('against')}>⇣ Pull from your workspace</Button>
            </div>
          </div>
          <PositionAssumptions key={assumptionKey} assumptions={assumptions} pulled={pulled} onToggle={toggleAssumption}
            onSave={next => saveWorkspace({ assumptions: next })} />
          {pulled.size > 0 && <Button type="button" variant="link" size="sm" className="lg:hidden"
            onClick={() => setWorkbenchTab({ positionId: selected.id, tab: 'calibrate' })}>View arch preview</Button>}
          <PositionWorkspaceText key={`${selected.id}:reconsider`} label="What would change your mind?" value={selected.falsification || ''} placeholder="What future finding or result would make you revise the claim?" onSave={falsification => saveWorkspace({ falsification })} />
          <PositionWorkspaceField key={`${selected.id}:sources`} label="Linked sources" value={selected.sourceIds || []} onSave={sourceIds => saveWorkspace({ sourceIds })}
            renderEditor={(sourceIds, setSourceIds) => <SourceLinker media={media} selectedIds={sourceIds} onToggle={id => setSourceIds(sourceIds.includes(id) ? sourceIds.filter(sourceId => sourceId !== id) : [...sourceIds, id])} />} />
          <PullEvidenceDialog open={pullSide !== null} onOpenChange={(open) => { if (!open) setPullSide(null); }} side={pullSide || 'for'} media={media} concepts={concepts} questions={questions} positions={entries} excludePositionId={selected.id}
            onPick={(text) => { if (pullSide === 'against') onUpdateEntry({ ...selected, evidenceAgainst: [...challengeItems, text], dateUpdated: today() }); else onUpdateEntry({ ...selected, evidenceFor: [...supportItems, text], dateUpdated: today() }); }} />
        </RecordSection>
    );

    const calibration = (
        <RecordSection id="pos-calibrate" title="Calibrate" here={hereId === 'pos-calibrate'}>
          <CalibrationBar
            stated={statedPercent}
            grounds={grounds}
            supportCount={supportCount}
            challengeCount={challengeCount}
            onCommit={async (value, reason) => {
              await onUpdateEntry({
                ...selected,
                confidence: value,
                confidenceReasoning: reason,
                versionHistory: [...(selected.versionHistory || []), { date: today(), eventType: 'refined', description: reason, confidence: value }],
                dateUpdated: today(),
              });
              toast({ title: `Confidence moved to ${value}%`, description: 'The reason is now part of the belief biography.' });
            }}
          />
          <details className="noesis-fold my-3">
            <summary><span>Confidence reasoning</span></summary>
            <div className="noesis-fold__body">
              <PositionWorkspaceText key={`${selected.id}:confidence-reason`} label="Reason" value={selected.confidenceReasoning || ''} placeholder="Why does your current confidence fit the grounds?" onSave={confidenceReasoning => saveWorkspace({ confidenceReasoning })} />
            </div>
          </details>
          <PositionArch
            className="my-4"
            assumptions={assumptions}
            pulled={pulled}
            supportCount={supportCount}
            challengeCount={challengeCount}
          />
          <details className="noesis-fold mt-3">
            <summary><span>Confidence over time</span></summary>
            <div className="noesis-fold__body">
              <div className="mb-2 flex items-center justify-end gap-1">
                {historyDates}
                <InstrumentHelp instrument="confidenceHistory" />
              </div>
              <ConfidenceHistoryChart key={rangeKey} entry={selected} range={range} invalidRange={invalidRange} />
            </div>
          </details>
          {result && (
            <dl className="mt-4 space-y-3 border-l border-border pl-3 text-sm">
              <div>
                <dt className="font-medium">Latest linked Praxis result</dt>
                <dd className="mt-1 space-y-1 break-words text-muted-foreground">
                  <button type="button" onClick={() => previewPractice(result.practice)} className="min-h-8 text-left font-medium text-foreground underline underline-offset-2">{result.practice.title}</button>
                  <p className="whitespace-pre-wrap">{result.observation}</p>
                  {result.implication && <p className="whitespace-pre-wrap"><strong>What it changed:</strong> {result.implication}</p>}
                  {result.alternative && <p className="whitespace-pre-wrap"><strong>Another explanation:</strong> {result.alternative}</p>}
                  <p className="text-xs">A linked result does not count as evidence on its own.</p>
                </dd>
              </div>
            </dl>
          )}
        </RecordSection>
    );

    const positionHistory = [...(selected.versionHistory || [])].sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
    let priorConfidence: number | undefined;
    const revisionEvents = positionHistory.map((version, index) => {
      const confidence = typeof version.confidence === 'number' ? confidencePercent(version.confidence) : undefined;
      const event = (
        <RevisionEvent key={`${version.date}-${index}`} date={version.date}
          action={version.eventType?.replace(/_/g, ' ') || 'Revision'}
          description={version.description}
          confidence={confidence}
          previousConfidence={priorConfidence}
          current={index === positionHistory.length - 1} />
      );
      priorConfidence = confidence ?? priorConfidence;
      return !invalidRange && positionHistoryDateMatches(version.date, range) ? event : null;
    }).filter(event => event !== null).reverse();
    const allAiHistory = selected.aiReviewHistory || [];

    const revise = (
        <RecordSection id="pos-revise" title="Revise" description="If your thinking changed, record it with a reason. Skip this if it didn't." here={hereId === 'pos-revise'}>
          <PositionWorkspaceText key={`${selected.id}:consequences`} label="Consequences" value={joinLines(selected.consequences)} placeholder="What follows if this is true? One consequence per line." onSave={text => saveWorkspace({ consequences: splitLines(text) })} />
          <PositionWorkspaceText key={`${selected.id}:applications`} label="Applications" value={joinLines(selected.applications)} placeholder="Where would you put this into practice? One application per line." onSave={text => saveWorkspace({ applications: splitLines(text) })} />
          {savedScope && (
            <div className="mb-4 border-l border-border pl-3 text-sm">
              <Eyebrow>Scope check</Eyebrow>
              <p className="mt-1 whitespace-pre-wrap break-words">{formatPositionScopeCheck(savedScope)}</p>
              {!currentScope && <p className="mt-1 text-muted-foreground">Checked against an earlier wording of this claim.</p>}
              {currentScope && currentScope.verdict !== 'holds' && (
                <Button type="button" variant="link" size="sm" onClick={() => {
                  setRevisionReason(previous => previous.includes(scopeNote) ? previous : [previous.trim(), scopeNote].filter(Boolean).join('\n\n'));
                  setWorkbenchTab({ positionId: selected.id, tab: 'revise' });
                  window.requestAnimationFrame(() => document.getElementById('position-revision-reason')?.focus());
                }}>Use in revision</Button>
              )}
            </div>
          )}
          <Textarea id="position-revision-reason" value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="What changed your mind? (becomes the reason)" aria-label="Reason for the revision" className="min-h-[72px]" />
          <div className="mt-3 flex flex-wrap gap-2">
            {revisionDecisions.map(([status, label]) => (
              <Button key={status} type="button" variant={status === 'revised' ? 'primary' : 'outline'} disabled={!revisionReason.trim()} onClick={async () => {
                await onUpdateEntry({ ...selected, status, versionHistory: [...(selected.versionHistory || []), { date: today(), eventType: status === 'active' ? 'refined' : status === 'abandoned' ? 'abandoned' : status === 'suspended' ? 'challenged' : 'revised', description: revisionReason.trim(), confidence: selected.confidence }], lastRevisedAt: today(), dateUpdated: today() });
                setRevisionReason('');
                toast({ title: `${label} recorded`, description: 'The reason is now part of the belief biography.' });
              }}>{label}</Button>
            ))}
          </div>
        </RecordSection>
    );

    const history = (
          <ItemHistoryPanel title="Position history" controls={historyDates} scrollKey={rangeKey}
            entries={revisionEvents.length ? revisionEvents : <p className="noesis-inline-empty">{invalidRange ? 'Enter a valid date range.' : hasRange ? 'No history entries in this date range.' : 'No revisions recorded yet.'}</p>}
            background={<ItemHistoryBackground title="Position background" lazy>
                <InfoPanel title="Created from" items={beliefProfile?.originSummary ? [beliefProfile.originSummary] : [selected.createdFrom || 'Manual position entry']} empty="No origin summary yet." />
                <PromotedAnnotationCreationDetails origins={selected.annotationOrigins} />
                {([['Strengthened by', beliefProfile?.strengthenedBy], ['Challenged by', beliefProfile?.challengedBy], ['Weakened by', beliefProfile?.weakenedBy]] as const).map(([title, items]) => (
                  items?.length ? <InfoPanel key={title} title={title} items={items} empty="" /> : null
                ))}
            </ItemHistoryBackground>} />
    );

    return (
      <RecordPage tone="claim" identity="examination">
        <RecordHeader backLabel="Positions" onBack={closeEntry} view="vault" kind="Position"
          status={positionSavedStatus(selected.status)} extra={derivePositionLifecycleStage(selected.status) === 'retired' ? undefined : `Workbench: ${diagnostic.readinessLabel}`} title={selected.title}
          tags={selected.tags || []} onTag={(tag) => setConceptPopupName(tag)}
          tagAction={<ConceptTagPicker key={selected.id} concepts={concepts} value={selected.tags || []} triggerOnly
            onCreateConcept={name => onAddConcept({ name, description: '', createdFrom: 'tag' })}
            onChange={async (tags) => {
              try { await saveWorkspace({ tags: normalizeConceptTags(tags) }); return true; }
              catch (error) {
                toast({ title: 'Concepts not saved', description: noesisUserError(error, 'save concept tags'), variant: 'destructive' });
                return false;
              }
            }} />}
          trailing={<>
            {aiSettings.aiAssistanceEnabled && (
              <Select value={comparePositionId} onValueChange={setComparePositionId}>
                <SelectTrigger aria-label="Position to compare" className="h-9 w-44 rounded-[var(--button-radius)]"><SelectValue placeholder="Compare with…" /></SelectTrigger>
                <SelectContent>{safeEntries.filter((entry) => entry.id !== selected.id).map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.title}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <ContextualAiPanel key={selected.id} itemHistory={itemAiHistory(selected)} iconOnly enabled={aiSettings.aiAssistanceEnabled} showContextBeforeSending={aiSettings.showContextBeforeSending} reasoningDepth={aiDepthFor(aiSettings, 'positions')} actions={['find_position_assumptions', 'generate_position_counterargument', 'identify_missing_position_evidence', 'compare_selected_positions']} buildEnvelope={buildPositionAiEnvelope} onAccept={acceptPositionAiResult} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><IconButton label="Position actions" variant="outline"><MoreHorizontal className="size-4" /></IconButton></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openEditor(selected)}><Pencil className="mr-2 size-4" /> Edit position</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteTarget(selected)} className="text-problem focus:text-problem"><Trash2 className="mr-2 size-4" /> Delete position</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>}>
          <PromotedAnnotationOrigins origins={selected.annotationOrigins} />
        </RecordHeader>

        <ItemWorkspace key={selected.id} history={history}>
        <p className="mb-3 text-sm text-muted-foreground">{guide}</p>
        <InstrumentWorkbench key={selected.id} label="Position workbench" layout="rows"
          value={workbenchTab?.positionId === selected.id ? workbenchTab.tab : 'claim'}
          onValueChange={tab => setWorkbenchTab({ positionId: selected.id, tab })}
          stops={[{ id: 'claim', label: 'Claim' }, { id: 'tools', label: 'Thinking tools' }, { id: 'grounds', label: 'Grounds' }, { id: 'calibrate', label: 'Calibrate' }, { id: 'revise', label: 'Revise' }]}
          primary={['claim', 'grounds', 'revise']} secondary={['tools', 'calibrate']}
          panels={{ claim, tools, grounds: groundsPanel, calibrate: calibration, revise }} />
        <RecordLinkPicker records={linkableRecords.filter(item => !referenceTargets.has(`${item.type}:${item.id}`))}
          description="Add a reference without counting it as support or a challenge."
          onLink={async (record) => {
            try {
              await onCreateLink({ fromType: 'position', fromId: selected.id, fromLabel: selected.title, toType: record.type, toId: record.id, toLabel: record.title, type: 'references', createdFrom: 'manual' });
              toast({ title: 'Record linked' });
              return true;
            } catch (error) {
              toast({ title: 'Link not saved', description: noesisUserError(error, 'link this record'), variant: 'destructive' });
              return false;
            }
          }} />


        <RecordFooter>
          <FooterSection title="Connections" count={linkedSources.length + linkedQuestions.length + linkedDrafts.length + linkedPractices.length + relatedPositions.length + referenceTargets.size}>
            <Connections groups={[
              { type: 'Sources', tone: 'source', items: linkedSources.map((item) => ({ id: item.id, label: item.title, meta: `${item.type}${item.creator ? ` · ${item.creator}` : ''}`, onOpen: () => previewSource(item) })) },
              { type: 'Inquiries', tone: 'inquiry', items: linkedQuestions.map((item) => ({ id: item.id, label: item.text, meta: item.status.replace(/_/g, ' '), onOpen: () => previewInquiry(item) })) },
              { type: 'Positions', tone: 'position', items: relatedPositions.map((entry) => ({ id: entry.id, label: entry.title, meta: typedLinks.filter((link) => (link.fromId === entry.id && link.toId === selected.id) || (link.toId === entry.id && link.fromId === selected.id)).map((link) => link.type.replace(/_/g, ' ')).join(', '), onOpen: () => openEntry(entry.id) })) },
              { type: 'Praxis', tone: 'practice', items: linkedPractices.map((item) => ({ id: item.id, label: item.title, meta: `${item.type.replace(/_/g, ' ')} · ${item.status}`, onOpen: () => previewPractice(item) })) },
              { type: 'Works', tone: 'work', items: linkedDrafts.map((item) => ({ id: item.id, label: item.title, meta: `${item.type.replace(/_/g, ' ')} · ${item.status}`, onOpen: () => previewWork(item) })) },
              { type: 'References', tone: 'neutral', items: linkableRecords.filter(item => referenceTargets.has(`${item.type}:${item.id}`)).map(item => ({
                id: `${item.type}:${item.id}`, label: item.title, meta: item.label, manuallyLinked: true,
                onOpen: item.type === 'source' ? () => onOpenSource?.(item.id) : item.type === 'inquiry' ? () => onOpenQuestion?.(item.id) : item.type === 'practice' ? () => onOpenPractice?.(item.id) : item.type === 'work' ? () => onOpenWork?.(item.id) : () => openEntry(item.id),
              })) },
            ]} />
          </FooterSection>

          {!!allAiHistory.length && <FooterSection title="Saved AI notes">
            <AiAssistedHistory entries={allAiHistory.map(entry => {
              const target = positionReviewTarget(selected.id, entry.action, entry.id);
              return { ...entry, originDetails: target && entry.id.startsWith('ai-review-') ? { provenance: { provenanceId: entry.id, kind: 'ai-assisted' as const }, target } : undefined };
            })} onChange={aiReviewHistory => onUpdateEntry({ ...selected, aiReviewHistory, dateUpdated: today() })} />
          </FooterSection>}
          <FooterSection title="Record">
            <EntityMeta items={[
              { label: 'Type', value: (selected.type || 'belief').replace('_', ' ') },
              { label: 'Mode', value: (selected.positionKind || 'interpretive').replace(/_/g, ' ') },
              { label: 'Status', value: selected.status },
              { label: 'Created', value: safePositionDate(selected.dateCreated) },
              { label: 'Updated', value: safePositionDate(selected.dateUpdated || selected.dateCreated) },
            ]} />
            <div className="mt-3 grid gap-3"><InfoPanel title="Typed relationships" items={typedLinks.map((link) => `${link.type.replace(/_/g, ' ')}: ${link.fromLabel || link.fromType} -> ${link.toLabel || link.toType}`)} empty="No typed relationships recorded yet." />
            <InfoPanel title="Saved position comparisons" items={(selected.comparisonReviews || []).map((review) => `${review.positionTitle} · ${safePositionDate(review.date)}\n${review.content}`)} empty="No reviewed position comparison has been saved yet." /></div>
          </FooterSection>

        </RecordFooter>
        </ItemWorkspace>

        <ConceptDetailDialog 
          name={conceptPopupName} 
          onClose={() => setConceptPopupName(null)}
          concepts={concepts}
          media={media}
          vault={safeEntries}
          drafts={drafts}
          practices={practices}
          questions={questions}
          timeline={timeline}
        />

        <BeliefEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draftEntry} setDraft={setDraftEntry} concepts={concepts} media={media} onAddConcept={onAddConcept} onSave={saveEntry} saving={savingEntry} />
      </RecordPage>
    );
  }

  return (
    <div className="noesis-page">
      <PageHeader
        title="Positions"
        description="State what you currently believe, what supports it, and what could change it."
        meta={
          <span className="noesis-eyebrow text-muted-foreground/60">
            {positionStats.total} positions · {positionStats.underReview} need review · {positionStats.needsPractice} untested · {positionStats.tensions} tensions
          </span>
        }
        actions={
          <>
            {positionStats.tensions > 0 && (
              <Button variant="outline" onClick={() => setTensionDrawerOpen(true)} size="sm" >
                <AlertTriangle className="size-4 mr-1.5 text-caution" /> {positionStats.tensions} {positionStats.tensions === 1 ? 'tension' : 'tensions'}
              </Button>
            )}
            <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 px-6 shadow-md shadow-accent/20 rounded-full h-9 font-bold">
              <Plus className="size-4 mr-1.5" /> New Position
            </Button>
          </>
        }
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search positions, principles..."
        resultCount={filteredEntries.length}
        sortControl={<SortPill label="Sort positions" value={sortOrder} onChange={setSortOrder} options={COLLECTION_SORT_OPTIONS} />}
        resultLabel="positions"
        activeFilterLabels={activeFilterLabels}
        onClear={clearPositionFilters}
        clearDisabled={!positionFiltersActive}
        viewControl={
          <ViewModeToggle
            value={viewMode === 'table' ? 'table' : 'grid'}
            modes={['grid', 'table']}
            onChange={(value) => setViewMode(value === 'table' ? 'table' : 'cards')}
          />
        }
        className="mb-3"
      >
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as PositionViewFilter)}>
          <SelectTrigger aria-label="Position view" className="w-52 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Position View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="noesis-eyebrow">{POSITION_VIEW_LABELS.all}</SelectItem>
            {PRIMARY_POSITION_VIEW_FILTERS.filter((value) => value !== 'all').map((value) => (
              <SelectItem key={value} value={value} className="noesis-eyebrow">{POSITION_VIEW_LABELS[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as VaultType | 'all')}>
          <SelectTrigger aria-label="Position type" className="w-52 h-10 noesis-eyebrow rounded-full bg-card shadow-sm border-border/60">
            <SelectValue placeholder="Position Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="noesis-eyebrow">All Types</SelectItem>
            {vaultTypes.map((type) => (
              <SelectItem key={type} value={type} className="noesis-eyebrow">{TYPE_LABELS[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ConceptFilterPicker
          value={conceptFilter}
          options={conceptFilterOptions}
          onChange={setConceptFilter}
          onCreate={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
          label="Filter positions by concept"
          className="h-10 w-52"
        />
      </FilterToolbar>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {[
          { label: 'Current', value: positionStats.current, filter: 'current' as PositionViewFilter },
          { label: 'Under review', value: positionStats.underReview, filter: 'under_review' as PositionViewFilter },
          { label: 'Complete', value: positionStats.complete, filter: 'complete' as PositionViewFilter },
          { label: 'Developing', value: positionStats.developing, filter: 'developing' as PositionViewFilter },
          { label: 'Retired', value: positionStats.retired, filter: 'retired' as PositionViewFilter },
          { label: 'Needs attention', value: positionStats.needsAttention, filter: 'needs_attention' as PositionViewFilter },
        ].filter((item) => item.filter === 'complete' || item.value > 0).map((item) => (
          <button
            key={item.filter}
            type="button"
            onClick={() => setViewFilter(viewFilter === item.filter ? 'all' : item.filter)}
            className={cn(
              "rounded-full border px-3 py-1.5 noesis-eyebrow noesis-eyebrow--sm transition-colors",
              viewFilter === item.filter ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
            )}
          >
            {item.label} ({item.value})
          </button>
        ))}
      </div>

      {viewMode === 'table' ? (
        <PositionsTable entries={filteredEntries} diagnostics={positionDiagnostics} links={links} practices={practices} onOpen={openEntry} />
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredEntries.map((entry) => {
          const diagnostic = positionDiagnostics.get(entry.id) || diagnosePosition(entry, links, practices);
          const statement = distinctPositionStatement(entry.title, entry.statement || entry.description || '');
          const formation = positionFormation(entry);
          return (
            <Card
              key={entry.id}
              className="noesis-position-card group cursor-pointer self-start transition-all hover:-translate-y-0.5 p-4 md:p-5"
              onClick={(event) => { if (isEntitySurfaceClick(event)) openEntry(entry.id); }}
            >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {/* As in the prototype: one type tag, and the challenge count when there is one. */}
                  <Badge variant="outline" className="rounded-full">{TYPE_LABELS[entry.type] || 'Position'}</Badge>
                  <span className="text-xs capitalize text-muted-foreground">{positionSavedStatus(entry.status)}</span>
                </div>
                <h2 className="font-headline text-lg font-bold italic leading-tight group-hover:text-accent transition-colors whitespace-normal break-words text-primary">
                  <button type="button" className="text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => openEntry(entry.id)}>{entry.title}</button>
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ConfidenceEmber confidence={confidencePercent(entry.confidence)} size={42} decorative />
              </div>
            </div>

            {statement && <p className="mb-4 break-words text-xs italic leading-relaxed text-muted-foreground">{statement}</p>}

            <PositionMiniScale confidence={confidencePercent(entry.confidence)} supportCount={diagnostic.supportCount} challengeCount={diagnostic.challengeCount} showCue={derivePositionLifecycleStage(entry.status) !== 'retired'} />
            {(entry.tags || []).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Pill look="mono" tone="concept" onClick={() => setConceptPopupName((entry.tags || [])[0])}>{(entry.tags || [])[0]}</Pill>
                {diagnostic.flags[0] && <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground" title={diagnostic.flags.join(', ')}>{diagnostic.flags[0]}{diagnostic.flags.length > 1 ? ` +${diagnostic.flags.length - 1}` : ''}</span>}
              </div>
            )}
          </Card>
          );
        })}
        {filteredEntries.length === 0 && (
          <div className="col-span-full">
            <PageEmptyState
              icon={ShieldCheck}
              title="No positions found"
              description="Refine your search or start a draft position you are willing to examine."
              belongsHere="Positions are explicit claims, principles, mental models, worldview statements, and life rules you are willing to support or challenge."
              whyItMatters="Noesis uses positions as the lifecycle for rough thoughts, tested judgments, and fully formed commitments."
              firstAction="Create one provisional position from an annotation, inquiry, source reflection, or direct claim."
              filterCause={positionFiltersActive ? 'Current view, search, or filters may be hiding positions.' : undefined}
              action={positionFiltersActive ? <Button variant="outline" onClick={clearPositionFilters}>Clear filters</Button> : undefined}
            />
          </div>
        )}
      </div>
      )}
      
      <ConceptDetailDialog 
        name={conceptPopupName} 
        onClose={() => setConceptPopupName(null)}
        concepts={concepts}
        media={media}
        vault={entries}
        drafts={drafts}
        practices={practices}
        questions={questions}
        timeline={timeline}
      />

      <Dialog open={tensionDrawerOpen} onOpenChange={setTensionDrawerOpen}>
        <DialogContent className="max-w-2xl max-h-[82vh] overflow-y-auto bg-card border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Possible tensions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              These are review prompts, not proven contradictions. Decide whether the positions conflict, qualify each other, complement each other, or merely share vocabulary.
            </p>
            {tensions.map(({ a, b, sharedTags, severity }) => (
              <div key={`${a.id}-${b.id}`} className="rounded-xl border border-border bg-background p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn(
                    "rounded-full noesis-eyebrow noesis-eyebrow--sm",
                    severity === 'possible contradiction' ? "border-problem/40 bg-problem/10 text-problem" :
                    severity === 'possible qualification' ? "border-info/40 bg-info/10 text-info" :
                    severity === 'possible complement' ? "border-ok/40 bg-ok/10 text-ok" :
                    "border-border bg-muted/20 text-muted-foreground"
                  )}>
                    {severity}
                  </Badge>
                  <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Shared: {sharedTags.slice(0, 2).join(', ')}</span>
                </div>
                <button onClick={() => { setTensionDrawerOpen(false); openEntry(a.id); }} className="block text-left font-headline text-base font-bold italic text-foreground hover:text-accent">
                  {a.title}
                </button>
                <div className="my-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">and</div>
                <button onClick={() => { setTensionDrawerOpen(false); openEntry(b.id); }} className="block text-left font-headline text-base font-bold italic text-foreground hover:text-accent">
                  {b.title}
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setTensionDrawerOpen(false); openEntry(a.id); }}>
                    Review tension
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setViewFilter('tensions')}>
                    Filter positions
                  </Button>
                </div>
              </div>
            ))}
            {tensions.length === 0 && (
              <p className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-5 text-sm text-muted-foreground">
                No possible tensions are currently active.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BeliefEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draftEntry} setDraft={setDraftEntry} concepts={concepts} media={media} onAddConcept={onAddConcept} onSave={saveEntry} saving={savingEntry} />

      {/* Draft position pipeline removed in the AI-free release.
      <Dialog open={ideaOpen} onOpenChange={(open) => { if (!open) setIdeaOpen(false); }}>
        <DialogContent className="max-w-xl bg-card border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {[1, 2, 3].map((n) => (
                <div key={n} className={cn('h-1 flex-1 rounded-full transition-all', ideaStep >= n ? 'bg-accent' : 'bg-muted/30')} />
              ))}
            </div>
            <DialogTitle className="font-headline text-2xl italic">
              {ideaStep === 1 && 'Start a Draft Position'}
              {ideaStep === 2 && 'Sharpen It'}
              {ideaStep === 3 && 'Review Your Position'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-body">
              {ideaStep === 1 && 'Capture the rough claim. AI can ask 3 questions to make it clearer.'}
              {ideaStep === 2 && 'Answer each question to clarify the claim you are willing to own.'}
              {ideaStep === 3 && 'Edit and save the draft position AI formed from your answers.'}
            </p>
          </DialogHeader>

          {ideaStep === 1 && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground font-bold">Draft Position</Label>
                <Input
                  value={ideaDraft.title}
                  onChange={(e) => setIdeaDraft((p) => ({ ...p, title: e.target.value }))}
                  placeholder="State the rough claim briefly..."
                  className="rounded-full"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground font-bold">Reasoning / Context</Label>
                <Textarea
                  value={ideaDraft.body}
                  onChange={(e) => setIdeaDraft((p) => ({ ...p, body: e.target.value }))}
                  placeholder="Why do you think this? What prompted it?"
                  className="min-h-[100px]"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleGenerateQuestions}
                  disabled={!ideaDraft.title.trim() || isGenerating}
                  className="w-full"
                >
                  {isGenerating ? <Loader2 className="size-5 mr-2 animate-spin" /> : <GenerativeAiIcon className="mr-2 size-7" />}
                  {isGenerating ? 'Generating questions…' : 'Ask AI'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {ideaStep === 2 && (
            <div className="space-y-5 pt-2">
              <div className="rounded-lg bg-muted/20 border border-border/30 px-4 py-3">
                <p className="text-xs text-muted-foreground font-code uppercase tracking-widest mb-1 font-bold">Draft Position</p>
                <p className="text-sm italic font-body text-primary/80">{ideaDraft.title}</p>
              </div>
              {ideaQA.map((qa, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="noesis-eyebrow noesis-eyebrow--sm text-accent font-bold px-2 py-0.5 bg-accent/10 rounded-full">{qa.focus}</span>
                  </div>
                  <p className="text-sm font-body text-foreground/80 leading-snug">{qa.question}</p>
                  <Textarea
                    value={qa.answer}
                    onChange={(e) => setIdeaQA((prev) => prev.map((q, j) => j === i ? { ...q, answer: e.target.value } : q))}
                    placeholder="Your answer..."
                    className="min-h-[72px]"
                  />
                </div>
              ))}
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleFormPosition}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ChevronRight className="size-4 mr-2" />}
                  {isGenerating ? 'Forming position…' : 'Form Position'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {ideaStep === 3 && ideaPosition && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground font-bold">Position Title</Label>
                <Input
                  value={ideaPosition.positionTitle}
                  onChange={(e) => setIdeaPosition((p) => p ? { ...p, positionTitle: e.target.value } : p)}
                  className="rounded-full font-headline font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground font-bold">Core Claim</Label>
                <Textarea
                  value={ideaPosition.statement}
                  onChange={(e) => setIdeaPosition((p) => p ? { ...p, statement: e.target.value } : p)}
                  className="min-h-[72px] italic"
                />
              </div>
              <div className="space-y-2">
                <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground font-bold">Supporting Reasoning</Label>
                <Textarea
                  value={ideaPosition.description}
                  onChange={(e) => setIdeaPosition((p) => p ? { ...p, description: e.target.value } : p)}
                  className="min-h-[90px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground font-bold">Confidence percentage</Label>
                <div className="flex items-center justify-end">
                  <span className="font-code text-sm font-bold text-accent">{confidencePercent(ideaPosition.confidence)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={confidencePercent(ideaPosition.confidence)}
                  onChange={(event) => setIdeaPosition((position) => position ? { ...position, confidence: Number(event.target.value) } : position)}
                  className="w-full accent-[hsl(var(--accent))]"
                  aria-label="Position confidence percentage"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleSaveIdeaPosition}
                  className="w-full"
                >
                  Save Position
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog> */}
      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete position?"
        description={`This removes "${deleteTarget?.title || 'this position'}" from Positions. Related sources, works, practices, and Evolution history will remain.`}
        confirmLabel="Delete Position"
        alternateLabel="Abandon instead"
        destructive
        onAlternate={async () => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleteTarget(null);
          try {
            await onUpdateEntry({
              ...target,
              status: 'abandoned',
              versionHistory: [...(target.versionHistory || []), { date: today(), eventType: 'abandoned', description: 'Position abandoned instead of deleted.', confidence: target.confidence }],
              dateUpdated: today(),
            });
            if (activeEntryId === target.id) closeEntry();
            toast({ title: 'Position abandoned.', description: 'Its history and connected work remain available for review.' });
          } catch (error) {
            toast({ variant: 'destructive', title: 'Position could not be abandoned', description: noesisUserError(error, 'abandon this position') });
          }
        }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleteTarget(null);
          try {
            await onDeleteEntry(target.id);
            if (activeEntryId === target.id) closeEntry();
            toast({ title: 'Position deleted.' });
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Position could not be deleted',
              description: noesisUserError(error, 'delete this position'),
            });
          }
        }}
      />
    </div>
  );
}

function PositionStat({ label, value, active, onClick }: { label: string; value: number | string; active?: boolean; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border/50 bg-card px-4 py-2 text-right shadow-sm transition-all',
        onClick && 'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md',
        active && 'border-accent/50 bg-accent/10 text-accent'
      )}
    >
      <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground/60">{label}</div>
      <div className="font-headline text-xl font-bold italic leading-none text-primary">{value}</div>
    </Comp>
  );
}

function TensionResolutionPanel({
  selected,
  tensionLinks,
  onUpdateEntry,
  onUpdateLink,
}: {
  selected: VaultEntry;
  tensionLinks: PhilosophicalLink[];
  onUpdateEntry: (entry: VaultEntry) => void | Promise<void>;
  onUpdateLink?: (link: PhilosophicalLink) => void;
}) {
  if (!tensionLinks.length) return null;

  const updateLink = (link: PhilosophicalLink, type: PhilosophicalLink['type'], note: string) => {
    onUpdateLink?.({
      ...link,
      type,
      note,
      dateUpdated: today(),
    });
  };

  const resolveTension = (link: PhilosophicalLink) => {
    updateLink(link, 'refines', 'Resolved by refining the distinction between these positions.');
    onUpdateEntry({
      ...selected,
      status: 'revised',
      versionHistory: [
        ...(selected.versionHistory || []),
        { date: today(), eventType: 'revised', description: 'Resolved a possible tension by refining this position.', confidence: selected.confidence },
      ],
      dateUpdated: today(),
    });
  };

  return (
    <Card className="noesis-status-panel mb-6 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="noesis-status-label">Possible Tension Detected</h2>
          <p className="noesis-status-detail mt-1 italic">Decide whether this relationship is compatible, opposed, or needs refinement.</p>
        </div>
        <Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{tensionLinks.length} open</Badge>
      </div>
      <div className="space-y-3">
        {tensionLinks.map((link) => {
          const otherLabel = link.fromId === selected.id ? link.toLabel || link.toType : link.fromLabel || link.fromType;
          return (
            <div key={link.id} className="noesis-status-panel-subtle p-3">
              <div className="mb-3 text-sm italic text-foreground">
                {otherLabel} is currently marked as <span className="noesis-eyebrow text-accent">{link.type}</span>.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => updateLink(link, 'coheres', 'Reviewed and marked as not a contradiction.')} className="rounded-full bg-card">
                  Not A Contradiction
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateLink(link, 'contradicts', 'Confirmed as an active contradiction to examine.')} className="rounded-full border-destructive/25 text-destructive hover:text-destructive">
                  Confirms Conflict
                </Button>
                <Button size="sm" onClick={() => resolveTension(link)} className="rounded-full">
                  Resolve / Fix
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PositionsTable({
  entries,
  diagnostics,
  links,
  practices,
  onOpen,
}: {
  entries: VaultEntry[];
  diagnostics: Map<string, PositionDiagnostic>;
  links: PhilosophicalLink[];
  practices: Practice[];
  onOpen: (id: string) => void;
}) {
  if (!entries.length) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
        <ShieldCheck className="size-20 mb-6 text-muted-foreground" />
        <h2 className="text-2xl font-headline italic mb-2">No positions found</h2>
        <p className="max-w-md font-body">Refine your search or start a draft position you are willing to examine.</p>
      </div>
    );
  }

  return (
      <Card className="min-w-0 rounded-xl border-border/60 bg-card shadow-sm">
        <Table aria-label="Positions table" className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead className="hidden w-[10%] xl:table-cell">Kind</TableHead>
              <TableHead className="hidden w-[13%] lg:table-cell">Status</TableHead>
              <TableHead className="w-24 sm:w-28">Confidence</TableHead>
              <TableHead className="hidden w-[12%] 2xl:table-cell">Pressure</TableHead>
              <TableHead className="hidden w-[12%] 2xl:table-cell">Health</TableHead>
              <TableHead className="hidden w-[18%] xl:table-cell">Next Action</TableHead>
              <TableHead className="hidden w-[11%] xl:table-cell">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const diagnostic = diagnostics.get(entry.id) || diagnosePosition(entry, links, practices);
              return (
              <TableRow key={entry.id} className="cursor-pointer" onClick={(event) => { if (isEntitySurfaceClick(event)) onOpen(entry.id); }}>
                <TableCell className="[overflow-wrap:anywhere]">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground xl:hidden">
                    <span>{TYPE_LABELS[entry.type] || 'Position'}</span>
                    <span className="lg:hidden"><StageBadge type="position" stage={entry.stage} status={entry.status} /></span>
                  </div>
                  <button type="button" className="min-h-11 w-full rounded-sm text-left font-headline text-base font-semibold italic hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onOpen(entry.id)} onKeyDown={(event) => activateEntityOnKey(event, () => onOpen(entry.id))}>{entry.title}</button>
                  <div className="max-w-xl whitespace-normal text-xs leading-5 text-muted-foreground">{entry.statement || entry.description}</div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground xl:hidden">{diagnostic.nextAction}</p>
                </TableCell>
                <TableCell className="hidden noesis-eyebrow xl:table-cell">{TYPE_LABELS[entry.type] || 'Position'}</TableCell>
                <TableCell className="hidden lg:table-cell"><div className="flex flex-wrap gap-1"><Badge>{entry.status}</Badge><StageBadge type="position" stage={entry.stage} status={entry.status} /></div></TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <div className="mb-1 noesis-figure font-bold">{confidencePercent(entry.confidence)}%</div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${confidencePercent(entry.confidence)}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden noesis-eyebrow text-muted-foreground 2xl:table-cell">
                  {diagnostic.supportCount} support / {diagnostic.challengeCount} challenge / {diagnostic.practiceCount} tests
                </TableCell>
                <TableCell className="hidden 2xl:table-cell">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{diagnostic.label}</Badge>
                    {diagnostic.flags.slice(0, 2).map((flag) => (
                      <Badge key={flag} variant="secondary" className="rounded-full noesis-eyebrow noesis-eyebrow--sm">{flag}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden text-xs italic leading-5 text-muted-foreground xl:table-cell">{diagnostic.nextAction}</TableCell>
                <TableCell className="hidden noesis-eyebrow text-muted-foreground xl:table-cell">{safePositionDate(entry.dateUpdated || entry.dateCreated)}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

  );
}

function EvidencePanel({ title, items, onAdd, onPull }: { title: string; items: string[]; onAdd: (text: string) => void; onPull?: () => void }) {
  const [text, setText] = useState('');
  return (
    <Card className="noesis-workbench-panel noesis-workbench-panel--sub">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="noesis-workbench-panel__eyebrow">{title}</h3>
        {onPull && <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onPull}>Pull from your records</Button>}
      </div>
      <div className="space-y-2 mb-3">{items.map((item, index) => <div key={`${item}-${index}`} className="rounded-lg bg-muted/30 p-3 text-sm italic shadow-sm border border-border/10 leading-relaxed text-primary/80">{item}</div>)}</div>
      <div className="flex gap-2"><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add evidence..." className="h-9 rounded-full" /><Button onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(''); } }} size="sm" className="h-9 px-4 rounded-full">Add</Button></div>
    </Card>
  );
}

function InfoPanel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Card className="noesis-workbench-panel noesis-workbench-panel--sub">
      <h3 className="noesis-workbench-panel__eyebrow mb-3">{title}</h3>
      {items.length ? items.map((item) => (
        <div key={item} className="rounded-lg bg-muted/30 p-3 text-sm mb-2 italic shadow-sm border border-border/10 leading-relaxed text-primary/80">{item}</div>
      )) : (
        <p className="text-sm text-muted-foreground italic px-2 font-body">{empty}</p>
      )}
    </Card>
  );
}

function PositionHistoryDates({ range, active, invalid, onChange }: { range: PositionHistoryRange; active: boolean; invalid: boolean; onChange: (range: PositionHistoryRange) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant={active ? 'secondary' : 'outline'} aria-label="History date range">
          <CalendarRange aria-hidden="true" />{active ? 'Dates set' : 'Dates'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="History date range" className="w-[min(20rem,calc(100vw-2rem))]">
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold">History date range</legend>
          <div className="mt-3 grid gap-2">
            <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">From
              <Input type="date" value={range.from} onChange={event => onChange({ ...range, from: event.target.value })} className="min-h-11 min-w-0" />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">To
              <Input type="date" value={range.to} onChange={event => onChange({ ...range, to: event.target.value })} className="min-h-11 min-w-0" />
            </label>
            <p className="text-xs text-muted-foreground" aria-live="polite">{invalid ? 'The end date must be on or after the start date.' : 'Filters confidence over time and position history.'}</p>
            {active && <Button type="button" size="sm" variant="ghost" className="justify-self-end" onClick={() => onChange(ALL_POSITION_HISTORY)}>Clear dates</Button>}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}

function ConfidenceHistoryChart({ entry, range, invalidRange }: { entry: VaultEntry; range: PositionHistoryRange; invalidRange: boolean }) {
  const series = invalidRange ? [] : positionConfidenceTrace(entry, range);
  const [step, setStep] = useState<number | null>(null);
  if (!series.length) return (
    <p className="mt-3 text-sm text-muted-foreground">{invalidRange ? 'Enter a valid date range.' : 'No confidence readings in this date range.'}</p>
  );
  const selected = Math.min(step ?? series.length - 1, series.length - 1);
  const reading = series[selected];
  const prior = series[selected - 1];
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 42, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const x = (index: number) => series.length === 1 ? padding.left + chartWidth / 2 : padding.left + (index / (series.length - 1)) * chartWidth;
  const y = (value: number) => padding.top + ((100 - value) / 100) * chartHeight;
  const linePoints = series.map((point, index) => `${x(index)},${y(point.value)}`);
  return (
    <div>
      <svg className="mt-3 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Line graph of confidence history for ${entry.title}`}>
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} className="stroke-border" strokeWidth="1" />
            <text x={padding.left - 8} y={y(value) + 3} textAnchor="end" className="fill-muted-foreground noesis-figure noesis-figure--sm">{value}</text>
          </g>
        ))}
        {series.length > 1 && <polyline points={linePoints.join(' ')} fill="none" className="stroke-muted-foreground/60" strokeWidth="2" strokeDasharray="5 6" />}
        {selected > 0 && <polyline points={linePoints.slice(0, selected + 1).join(' ')} fill="none" className="stroke-accent" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        <line x1={x(selected)} x2={x(selected)} y1={y(reading.value)} y2={y(0)} className="stroke-accent/50" strokeDasharray="3 4" />
        <circle cx={x(selected)} cy={y(reading.value)} r="7" className="fill-background stroke-accent" strokeWidth="4" />
      </svg>
      {series.length > 1 && <input type="range" min={0} max={series.length - 1} value={selected}
        className="h-10 w-full accent-[hsl(var(--accent))]" aria-label="Scrub confidence history"
        aria-valuetext={`${safePositionDate(reading.date)}, ${reading.value}% confidence`} onChange={event => setStep(Number(event.target.value))} />}
      <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-5" aria-live="polite">
        <div><Eyebrow size="sm">{safePositionDate(reading.date)}</Eyebrow><p><strong>{reading.value}%</strong>{prior && <span className="ml-2 text-muted-foreground">Was {prior.value}%</span>}</p></div>
        <div><Eyebrow size="sm">Recorded reason</Eyebrow><p className="break-words text-muted-foreground">{reading.reason || 'No reason recorded for this reading.'}</p></div>
      </div>
    </div>
  );
}


function EntityListPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; title: string; meta?: string; onClick?: () => void }>;
  empty: string;
}) {
  return (
    <Card className="noesis-workbench-panel noesis-workbench-panel--sub">
      <h3 className="noesis-workbench-panel__eyebrow mb-3">{title}</h3>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => {
            const content = (
              <>
                <div className="font-headline text-base font-semibold italic text-primary">{item.title}</div>
                {item.meta ? <div className="mt-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{item.meta}</div> : null}
              </>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full rounded-lg border border-border/10 bg-muted/30 p-3 text-left shadow-sm transition hover:border-accent/30 hover:bg-accent/5"
                >
                  {content}
                </button>
              );
            }

            return (
              <div key={item.id} className="rounded-lg border border-border/10 bg-muted/30 p-3 shadow-sm">
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic px-2 font-body">{empty}</p>
      )}
    </Card>
  );
}

function PositionWorkspaceField<T>({ label, value, summary, onSave, renderEditor }: {
  label: string;
  value: T;
  summary?: React.ReactNode;
  onSave: (value: T) => Promise<void>;
  renderEditor: (value: T, setValue: (value: T) => void) => React.ReactNode;
}) {
  const [edit, setEdit] = useState<{ original: T; value: T } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const changedElsewhere = !!edit && JSON.stringify(edit.original) !== JSON.stringify(value);
  const changed = !!edit && JSON.stringify(edit.value) !== JSON.stringify(edit.original);
  return (
    <div className="my-3 min-w-0 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        {!edit && <IconButton label={`Edit ${label.toLowerCase()}`} variant="ghost" onClick={() => { setEdit({ original: value, value }); setError(''); }}><Pencil className="size-4" /></IconButton>}
      </div>
      {!edit ? summary : (
        <fieldset className="min-w-0 space-y-2" disabled={saving}>
          <legend className="sr-only">{label}</legend>
          {renderEditor(edit.value, next => setEdit({ ...edit, value: next }))}
          {changedElsewhere && !saving && <p role="status" className="text-sm text-muted-foreground">This field changed since you opened it. Cancel and reopen it to see the latest value.</p>}
          {error && <p role="alert" className="text-sm text-problem">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={!changed || changedElsewhere || saving} onClick={async () => {
              if (savingRef.current) return;
              savingRef.current = true;
              setSaving(true);
              setError('');
              try { await onSave(edit.value); setEdit(null); }
              catch (error) { setError(noesisUserError(error, 'save this field')); }
              finally { savingRef.current = false; setSaving(false); }
            }}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function PositionWorkspaceText({ label, value, placeholder, onSave }: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
}) {
  return <PositionWorkspaceField label={label} value={value} onSave={text => onSave(text.trim())}
    summary={<p className={cn('whitespace-pre-wrap break-words text-sm leading-6', !value.trim() && 'text-muted-foreground')}>{value.trim() || 'Not recorded yet.'}</p>}
    renderEditor={(text, setText) => <Textarea aria-label={label} value={text} onChange={event => setText(event.target.value)} placeholder={placeholder} className="min-h-20" />} />;
}

function BeliefEditor({ open, onOpenChange, draft, setDraft, concepts, media, onAddConcept, onSave, saving = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Partial<VaultEntry>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<VaultEntry>>>;
  concepts: Concept[];
  media: Media[];
  onAddConcept: (data: Partial<Concept>) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  const creating = !draft.id;
  const toggleSource = (id: string) => {
    setDraft(prev => {
      const current = prev.sourceIds || [];
      const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
      return { ...prev, sourceIds: next };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto bg-card border-none shadow-2xl rounded-2xl">
        <DialogHeader><DialogTitle className="font-headline text-2xl italic">{draft.id ? 'Edit Position' : 'Form Position'}</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">TITLE</Label>
              <Input value={draft.title || ''} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="italic rounded-full" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">TYPE</Label>
              <Select value={draft.type || 'belief'} onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as VaultType }))}>
                <SelectTrigger className="h-10 border-border/60 bg-card shadow-sm rounded-full noesis-eyebrow"><SelectValue /></SelectTrigger>
                <SelectContent>{vaultTypes.map((type) => <SelectItem key={type} value={type} className="noesis-eyebrow">{type.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className={cn('grid grid-cols-1 gap-4', creating ? 'md:grid-cols-3' : 'sm:grid-cols-2')}>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">POSITION KIND</Label>
              <Select value={draft.positionKind || 'interpretive'} onValueChange={(value) => setDraft((prev) => ({ ...prev, positionKind: value as PositionKind }))}>
                <SelectTrigger className="h-10 border-border/60 bg-card shadow-sm rounded-full noesis-eyebrow"><SelectValue /></SelectTrigger>
                <SelectContent>{positionKinds.map((kind) => <SelectItem key={kind.id} value={kind.id} className="noesis-eyebrow">{kind.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">STATE</Label>
              <Select value={draft.status || 'tentative'} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as VaultEntry['status'] }))}>
                <SelectTrigger className="h-10 border-border/60 bg-card shadow-sm rounded-full noesis-eyebrow"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {draft.status && !positionStatuses.some(status => status.id === draft.status) && <SelectItem value={draft.status}>{draft.status.replace(/_/g, ' ')}</SelectItem>}
                  {positionStatuses.map((status) => <SelectItem key={status.id} value={status.id} className="noesis-eyebrow">{status.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {creating && <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">CONFIDENCE</Label>
              <div className="flex items-center justify-between gap-2">
                <span className="noesis-figure font-bold text-accent">{confidencePercent(draft.confidence)}%</span>
                <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{confidenceLabel(draft.confidence)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidencePercent(draft.confidence)}
                onChange={(event) => setDraft((prev) => ({ ...prev, confidence: Number(event.target.value) }))}
                className="h-6 w-full accent-[hsl(var(--accent))]"
                aria-label="Position confidence percentage"
              />
            </div>}
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">POSITION STATEMENT</Label>
            <Textarea aria-label="Position statement" value={draft.statement || ''} onChange={(event) => setDraft((prev) => ({ ...prev, statement: event.target.value }))} placeholder="The core position in one clear sentence..." className="min-h-[60px] italic text-base" />
          </div>
          {creating && <>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">WHY DO YOU HOLD IT?</Label>
            <Textarea value={draft.rationale || ''} onChange={(event) => setDraft((prev) => ({ ...prev, rationale: event.target.value }))} placeholder="In your own words, explain the reasons you currently find persuasive." className="min-h-[90px] italic text-base" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">KNOWN CHALLENGES</Label>
              <Textarea value={joinLines(draft.evidenceAgainst)} onChange={(event) => setDraft((prev) => ({ ...prev, evidenceAgainst: splitLines(event.target.value) }))} placeholder="An objection or counterexample you already know about." className="min-h-[100px] italic text-base" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">WHAT WOULD CHANGE YOUR MIND?</Label>
              <Textarea value={draft.falsification || ''} onChange={(event) => setDraft((prev) => ({ ...prev, falsification: event.target.value }))} placeholder="What future finding or result would make you revise the claim?" className="min-h-[110px] italic text-base" />
            </div>
          </div>
          <details className="rounded-2xl border border-border/50 bg-muted/10 p-4">
            <summary className="cursor-pointer noesis-eyebrow font-bold text-muted-foreground">Optional structure and links</summary>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">ASSUMPTIONS</Label>
                <Textarea value={joinLines(draft.assumptions)} onChange={(event) => setDraft((prev) => ({ ...prev, assumptions: splitLines(event.target.value) }))} placeholder="One load-bearing assumption per line..." className="min-h-[110px] italic text-base" />
              </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">CONFIDENCE REASONING</Label>
              <Textarea value={draft.confidenceReasoning || ''} onChange={(event) => setDraft((prev) => ({ ...prev, confidenceReasoning: event.target.value }))} placeholder="Why does this confidence level fit right now?" className="min-h-[110px] italic text-base" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">CONSEQUENCES</Label>
              <Textarea value={joinLines(draft.consequences)} onChange={(event) => setDraft((prev) => ({ ...prev, consequences: splitLines(event.target.value) }))} placeholder="What follows if this is true? One consequence per line..." className="min-h-[110px] italic text-base" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">APPLICATIONS</Label>
              <Textarea value={joinLines(draft.applications)} onChange={(event) => setDraft((prev) => ({ ...prev, applications: splitLines(event.target.value) }))} placeholder="Where should this affect behavior, writing, practice, or decisions?" className="min-h-[110px] italic text-base" />
            </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-label-sm">CONCEPT TAGS</Label>
            <ConceptTagPicker concepts={concepts} value={draft.tags || []} onChange={(tags) => setDraft((prev) => ({ ...prev, tags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} />
          </div>
          
          <SourceLinker 
            media={media} 
            selectedIds={draft.sourceIds || []} 
            onToggle={toggleSource} 
            label="Supporting Sources"
          />
            </div>
          </details>
          </>}
        </div>
        <DialogFooter className="pt-4"><Button onClick={onSave} disabled={saving || !draft.title?.trim()}>{saving ? 'Saving…' : 'Save position'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
