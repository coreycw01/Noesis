
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Edit, LayoutGrid, Loader2, Plus, ShieldCheck, Table2, Trash2, Triangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { SourceLinker } from '@/components/SourceLinker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AiSuggestion, BeliefProfile, Concept, Draft, Media, PhilosophicalLink, PositionKind, PositionPhilosophyStatus, Practice, Question, TimelineEvent, Unknown, VaultEntry, VaultType } from '@/lib/types';
import { normalizeConceptTags, today } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { ConceptDetailDialog } from '@/components/Library/MediaLibrary';
import { NextPhilosophicalActionPanel } from '@/components/Philosophy/NextPhilosophicalActionPanel';
import { aiClient } from '@/lib/ai-client';
import { useToast } from '@/hooks/use-toast';
import { GenerativeAiIcon } from '@/components/GenerativeAiIcon';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { noesisUserError } from '@/lib/user-facing-errors';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';

interface BeliefVaultProps {
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
  suggestions: AiSuggestion[];
  onAddEntry: (data: Partial<VaultEntry>) => void;
  onUpdateEntry: (entry: VaultEntry) => void;
  onDeleteEntry: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
  onCreateLink: (data: Partial<PhilosophicalLink>) => void;
  onAddDraft: (data: Partial<Draft>) => void;
  onAddPractice: (data: Partial<Practice>) => void;
  onAddQuestion: (data: Partial<Question>) => void;
  onCreateIdea: (data: { title: string; body: string; tags: string[]; sourceIds: string[]; position?: { title: string; statement: string; description: string; confidence: number } }) => void;
  onAddUnknown: (data: Partial<Unknown>) => Unknown;
  onUpdateSuggestion: (suggestion: AiSuggestion) => void;
  onCreateSuggestion: (suggestion: Partial<AiSuggestion>) => void;
  onUpdateLink?: (link: PhilosophicalLink) => void;
  onOpenSource?: (id: string) => void;
  onOpenQuestion?: (id: string) => void;
  onOpenPractice?: (id: string) => void;
  onOpenWork?: (id: string) => void;
  focusedEntryId?: string | null;
  onFocusedEntryHandled?: () => void;
  onOpenEntryRoute?: (id: string | null) => void;
}

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
  { id: 'draft', label: 'Draft' },
  { id: 'tentative', label: 'Tentative' },
  { id: 'developing', label: 'Developing' },
  { id: 'defended', label: 'Defended' },
  { id: 'active', label: 'Active' },
  { id: 'contested', label: 'Contested' },
  { id: 'unstable', label: 'Unstable' },
  { id: 'questioning', label: 'Questioning' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'revised', label: 'Revised' },
  { id: 'split', label: 'Split' },
  { id: 'abandoned', label: 'Abandoned' },
  { id: 'replaced', label: 'Replaced' },
  { id: 'rejected', label: 'Rejected' },
];

function splitLines(value?: string) {
  return (value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value?: string[]) {
  return (value || []).join('\n');
}

function confidenceLabel(confidence = 3) {
  if (confidence <= 1) return 'tentative';
  if (confidence === 2) return 'low';
  if (confidence === 3) return 'moderate';
  if (confidence === 4) return 'strong';
  return 'very strong';
}

type PositionViewFilter =
  | 'all'
  | 'current'
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
  signal: string;
};

const POSITION_VIEW_LABELS: Record<PositionViewFilter, string> = {
  all: 'All',
  current: 'Current',
  emerging: 'Emerging',
  needs_evidence: 'Needs Evidence',
  needs_opposition: 'Needs Opposition',
  needs_practice: 'Needs Practice',
  under_review: 'Under Review',
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
  'all',
  'current',
  'needs_evidence',
  'needs_opposition',
  'needs_practice',
  'under_review',
];

function safePosition(entry: VaultEntry): VaultEntry {
  const title = entry.title || entry.statement || entry.description || 'Untitled Position';
  return {
    ...entry,
    id: entry.id || title,
    title,
    type: (entry.type || 'belief') as VaultType,
    statement: entry.statement || entry.description || '',
    description: entry.description || entry.statement || '',
    confidence: Number.isFinite(entry.confidence) ? entry.confidence : 3,
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
    versionHistory: entry.versionHistory || [],
    dateCreated: entry.dateCreated || entry.dateUpdated || new Date().toISOString(),
    dateUpdated: entry.dateUpdated || entry.dateCreated || new Date().toISOString(),
  };
}

function safePositionDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toLocaleDateString() : date.toLocaleDateString();
}

function positionListReason(entry: VaultEntry, links: PhilosophicalLink[], viewFilter: PositionViewFilter) {
  const hasTension = links.some((link) =>
    ((link.fromType === 'position' && link.fromId === entry.id) || (link.toType === 'position' && link.toId === entry.id)) &&
    ['challenges', 'contradicts'].includes(link.type)
  );
  const hasSupport = (entry.evidenceFor || []).length > 0 || (entry.sourceIds || []).length > 0;
  if (viewFilter === 'emerging') return entry.confidence <= 2 ? 'Low confidence signal: this claim needs evidence before becoming stable.' : 'Draft or early-stage claim.';
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
  label: string;
  nextAction: string;
  flags: string[];
};

function positionFormation(entry: VaultEntry) {
  const checks = [
    { label: 'core claim', complete: Boolean((entry.statement || entry.title || '').trim()) },
    { label: 'meaning and scope', complete: Boolean(entry.description?.trim()) },
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
    missing: checks.filter((item) => !item.complete).map((item) => item.label),
  };
}

function daysSince(value?: string) {
  const date = value ? new Date(value).getTime() : 0;
  if (!date || Number.isNaN(date)) return 999;
  return Math.max(0, Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24)));
}

function diagnosePosition(entry: VaultEntry, links: PhilosophicalLink[], practices: Practice[]): PositionDiagnostic {
  const typedLinks = links.filter((link) =>
    (link.fromType === 'position' && link.fromId === entry.id) ||
    (link.toType === 'position' && link.toId === entry.id)
  );
  const supportLinks = typedLinks.filter((link) => ['supports', 'coheres', 'strengthens', 'expressed_in', 'tested_by'].includes(link.type)).length;
  const challengeLinks = typedLinks.filter((link) => ['challenges', 'contradicts', 'weakens', 'questions'].includes(link.type)).length;
  const supportCount = (entry.evidenceFor || []).length + (entry.sourceIds || []).length + supportLinks;
  const challengeCount = (entry.evidenceAgainst || []).length + challengeLinks;
  const practiceCount = practices.filter((practice) => (practice.positionIds || []).includes(entry.id)).length;
  const assumptionCount = (entry.assumptions || []).length;
  const updatedAge = daysSince(entry.dateUpdated || entry.dateCreated);
  const flags: string[] = [];

  if (supportCount === 0) flags.push('unsupported');
  if (challengeCount === 0) flags.push('under-challenged');
  if (practiceCount === 0 && !['abandoned', 'rejected', 'replaced'].includes(entry.status)) flags.push('untested');
  if (assumptionCount === 0) flags.push('assumptions missing');
  if ((entry.confidence || 3) >= 4 && challengeCount === 0) flags.push('overconfident');
  if (updatedAge > 90 && !['abandoned', 'rejected', 'replaced'].includes(entry.status)) flags.push('stale');
  if (['challenged', 'contested', 'unstable', 'questioning'].includes(entry.status)) flags.push('under pressure');

  let label = 'balanced';
  let nextAction = 'Review the claim, then decide whether it should be tested, revised, or expressed.';
  if (supportCount === 0) {
    label = 'needs evidence';
    nextAction = 'Add a source, annotation, or reason that directly supports the position.';
  } else if (challengeCount === 0 && (entry.confidence || 3) >= 4) {
    label = 'overconfident';
    nextAction = 'Add a serious objection before raising or keeping high confidence.';
  } else if (challengeCount === 0) {
    label = 'under-challenged';
    nextAction = 'Write the strongest opposing case or link a challenging position.';
  } else if (practiceCount === 0) {
    label = 'untested';
    nextAction = 'Create a practice or lived experiment that would test this position.';
  } else if (updatedAge > 90) {
    label = 'stale';
    nextAction = 'Revisit the wording, confidence, and evidence after a long quiet period.';
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
    label,
    nextAction,
    flags,
  };
}

function buildStressStages({
  selected,
  assumptions,
  strongestSupport,
  strongestObjection,
  counterposition,
  linkedSources,
  linkedPractices,
}: {
  selected: VaultEntry;
  assumptions: string[];
  strongestSupport: string;
  strongestObjection: string;
  counterposition: string;
  linkedSources: Media[];
  linkedPractices: Practice[];
}): StressStage[] {
  const claim = selected.statement || selected.description || selected.title;
  const sourceSignal = linkedSources.length
    ? `${linkedSources.length} source(s) currently support or contextualize this claim.`
    : 'No source evidence is linked yet.';
  const practiceSignal = linkedPractices.length
    ? `${linkedPractices.length} practice(s) currently test this position.`
    : 'No lived test is linked yet.';

  return [
    {
      title: 'Clarify the claim',
      prompt: `Restate this position in one precise sentence: "${claim}"`,
      signal: 'A position cannot be tested until its exact claim is clear.',
    },
    {
      title: 'State strongest version',
      prompt: 'What is the fairest, strongest version of this claim before anyone attacks it?',
      signal: strongestSupport,
    },
    {
      title: 'Identify assumptions',
      prompt: `Which assumption is most load-bearing: ${assumptions.join(' ')}`,
      signal: assumptions[0] || 'No assumptions have been derived yet.',
    },
    {
      title: 'Present strongest objection',
      prompt: 'What is the strongest objection from someone intelligent who rejects this?',
      signal: strongestObjection,
    },
    {
      title: 'Consider counterexample',
      prompt: 'Name one concrete case where this position may fail, become too narrow, or mislead action.',
      signal: counterposition,
    },
    {
      title: 'Compare alternative explanation',
      prompt: 'What alternative explanation could account for the same evidence without accepting this position?',
      signal: sourceSignal,
    },
    {
      title: 'Identify missing evidence',
      prompt: 'What evidence would make this position meaningfully stronger or meaningfully weaker?',
      signal: sourceSignal,
    },
    {
      title: 'Define falsification condition',
      prompt: 'What would need to happen for you to reduce confidence or abandon this position?',
      signal: `Current confidence: ${selected.confidence || 3}/5.`,
    },
    {
      title: 'Examine practical consequences',
      prompt: 'If you lived as if this were true for a week, what would change in behavior?',
      signal: practiceSignal,
    },
    {
      title: 'Decide outcome',
      prompt: 'After this pressure test, should the position stay active, be revised, be challenged, or be abandoned?',
      signal: `Current status: ${selected.status || 'active'}.`,
    },
  ];
}

export function BeliefVault({ entries, media, drafts, practices, questions, timeline, concepts, links, beliefProfiles, unknowns, suggestions, onAddEntry, onUpdateEntry, onDeleteEntry, onAddConcept, onCreateLink, onAddDraft, onAddPractice, onAddQuestion, onCreateIdea, onAddUnknown, onUpdateSuggestion, onCreateSuggestion, onUpdateLink, onOpenSource, onOpenQuestion, onOpenPractice, onOpenWork, focusedEntryId, onFocusedEntryHandled, onOpenEntryRoute }: BeliefVaultProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | VaultType>('all');
  const [viewFilter, setViewFilter] = useState<PositionViewFilter>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailTab, setDetailTab] = useState<'overview' | 'evidence' | 'opposition' | 'relations' | 'history'>('overview');
  const [draftEntry, setDraftEntry] = useState<Partial<VaultEntry>>({ type: 'belief', title: '', statement: '', description: '', confidence: 3, status: 'active', tags: [] });
  const [conceptPopupName, setConceptPopupName] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultEntry | null>(null);
  const { toast } = useToast();

  // Draft-position pipeline state
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaStep, setIdeaStep] = useState<1 | 2 | 3>(1);
  const [ideaDraft, setIdeaDraft] = useState({ title: '', body: '' });
  const [ideaQA, setIdeaQA] = useState<Array<{ question: string; focus: string; answer: string }>>([]);
  const [ideaPosition, setIdeaPosition] = useState<{ positionTitle: string; statement: string; description: string; confidence: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stressTests, setStressTests] = useState<Array<{ kind: string; question: string }>>([]);
  const [stressAnswer, setStressAnswer] = useState('');
  const [stressStageIndex, setStressStageIndex] = useState(0);
  const [tensionDrawerOpen, setTensionDrawerOpen] = useState(false);

  const openIdeaDialog = () => {
    setIdeaDraft({ title: '', body: '' });
    setIdeaQA([]);
    setIdeaPosition(null);
    setIdeaStep(1);
    setIdeaOpen(true);
  };

  const handleGenerateQuestions = async () => {
    if (!ideaDraft.title.trim()) return;
    setIsGenerating(true);
    try {
      const result = await aiClient.generateIdeaQuestions({ ideaTitle: ideaDraft.title, ideaBody: ideaDraft.body });
      setIdeaQA(result.questions.map((q) => ({ ...q, answer: '' })));
      setIdeaStep(2);
      toast({ title: 'Inquiries generated.', description: 'AI produced three clarifying questions for this draft position.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'AI Unavailable', description: noesisUserError(error, 'Could not generate questions. Try again.') });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFormPosition = async () => {
    if (ideaQA.some((q) => !q.answer.trim())) {
      toast({ title: 'Answer all questions', description: 'Each question helps shape your position.' });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await aiClient.formPositionFromIdea({
        ideaTitle: ideaDraft.title,
        ideaBody: ideaDraft.body,
        qa: ideaQA.map((q) => ({ question: q.question, answer: q.answer })),
      });
      setIdeaPosition(result);
      setIdeaStep(3);
      toast({ title: 'Position draft ready.', description: 'AI formed a draft position from your answers.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'AI Unavailable', description: noesisUserError(error, 'Could not form position. Try again.') });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveIdeaPosition = () => {
    if (!ideaPosition) return;
    onCreateIdea({
      title: ideaDraft.title,
      body: ideaDraft.body,
      tags: [],
      sourceIds: [],
      position: {
        title: ideaPosition.positionTitle,
        statement: ideaPosition.statement,
        description: ideaPosition.description,
        confidence: ideaPosition.confidence,
      },
    });
    setIdeaOpen(false);
    toast({ title: 'Position Created', description: `"${ideaPosition.positionTitle}" added to your Positions.` });
  };

  const safeEntries = useMemo(() => entries.filter((entry) => entry?.id).map(safePosition), [entries]);
  const positionDiagnostics = useMemo(() => {
    const map = new Map<string, PositionDiagnostic>();
    safeEntries.forEach((entry) => map.set(entry.id, diagnosePosition(entry, links, practices)));
    return map;
  }, [safeEntries, links, practices]);
  const selected = safeEntries.find((entry) => entry.id === selectedId) || null;
  const filteredEntries = safeEntries.filter(e => {
    const diagnostic = positionDiagnostics.get(e.id) || diagnosePosition(e, links, practices);
    const typeOk = typeFilter === 'all'
      ? true
      : e.type === typeFilter;
    const hasTension = links.some((link) =>
      ((link.fromType === 'position' && link.fromId === e.id) || (link.toType === 'position' && link.toId === e.id)) &&
      ['challenges', 'contradicts'].includes(link.type)
    );
    const hasSupport = (e.evidenceFor || []).length > 0 || (e.sourceIds || []).length > 0;
    const changedAt = new Date(e.dateUpdated || e.dateCreated).getTime();
    const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const viewOk =
      viewFilter === 'all' ||
      (viewFilter === 'current' && ['active', 'tentative', 'developing', 'defended', 'draft', 'uncertain'].includes(e.status)) ||
      (viewFilter === 'emerging' && (['draft', 'tentative', 'developing'].includes(e.status) || e.confidence <= 2)) ||
      (viewFilter === 'needs_evidence' && !hasSupport) ||
      (viewFilter === 'needs_opposition' && !hasTension && !(e.evidenceAgainst || []).length) ||
      (viewFilter === 'needs_practice' && diagnostic.practiceCount === 0 && !['abandoned', 'rejected', 'replaced'].includes(e.status)) ||
      (viewFilter === 'under_review' && ['challenged', 'uncertain', 'questioning', 'contested', 'unstable', 'suspended'].includes(e.status)) ||
      (viewFilter === 'revised' && e.status === 'revised') ||
      (viewFilter === 'abandoned' && ['abandoned', 'rejected', 'replaced'].includes(e.status)) ||
      (viewFilter === 'tensions' && hasTension) ||
      (viewFilter === 'high_confidence' && e.confidence >= 4) ||
      (viewFilter === 'low_confidence' && e.confidence <= 2) ||
      (viewFilter === 'overconfident' && diagnostic.flags.includes('overconfident')) ||
      (viewFilter === 'suspended' && e.status === 'suspended') ||
      (viewFilter === 'unsupported' && !hasSupport) ||
      (viewFilter === 'stale' && diagnostic.flags.includes('stale')) ||
      (viewFilter === 'recently_changed' && changedAt >= recentCutoff);
    const haystack = `${e.title || ''} ${e.statement || ''} ${e.description || ''} ${e.positionKind || ''} ${(e.assumptions || []).join(' ')} ${e.falsification || ''} ${(e.consequences || []).join(' ')} ${(e.applications || []).join(' ')}`.toLowerCase();
    const queryOk = !search ||
      haystack.includes(search.toLowerCase());
    return typeOk && viewOk && queryOk;
  });

  const positionStats = useMemo(() => {
    const tensionCount = safeEntries.filter((entry) => links.some((link) =>
      ((link.fromType === 'position' && link.fromId === entry.id) || (link.toType === 'position' && link.toId === entry.id)) &&
      ['challenges', 'contradicts'].includes(link.type)
    )).length;
    return {
      total: safeEntries.length,
      underReview: safeEntries.filter((entry) => ['challenged', 'uncertain', 'questioning', 'contested', 'unstable', 'suspended'].includes(entry.status)).length,
      unsupported: safeEntries.filter((entry) => !(entry.evidenceFor || []).length && !(entry.sourceIds || []).length).length,
      needsPractice: safeEntries.filter((entry) => positionDiagnostics.get(entry.id)?.flags.includes('untested')).length,
      overconfident: safeEntries.filter((entry) => positionDiagnostics.get(entry.id)?.flags.includes('overconfident')).length,
      stale: safeEntries.filter((entry) => positionDiagnostics.get(entry.id)?.flags.includes('stale')).length,
      tensions: tensionCount,
    };
  }, [safeEntries, links, positionDiagnostics]);

  const clearPositionFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setViewFilter('all');
  };

  const positionFiltersActive = Boolean(search || typeFilter !== 'all' || viewFilter !== 'all');
  const activeFilterLabels = [
    search ? `Search: ${search}` : null,
    viewFilter !== 'all' ? `View: ${POSITION_VIEW_LABELS[viewFilter]}` : null,
    typeFilter !== 'all' ? `Type: ${TYPE_LABELS[typeFilter as VaultType]}` : null,
    viewMode !== 'cards' ? `Layout: ${viewMode}` : null,
  ].filter(Boolean) as string[];

  const openEditor = (entry?: VaultEntry) => {
    setDraftEntry(entry ? { ...entry } : { type: 'belief', title: '', statement: '', description: '', confidence: 3, status: 'tentative', positionKind: 'interpretive', tags: [], assumptions: [], consequences: [], applications: [] });
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!focusedEntryId) {
      setSelectedId(null);
      return;
    }
    if (safeEntries.some((entry) => entry.id === focusedEntryId)) {
      setSelectedId(focusedEntryId);
      setDetailTab('overview');
      onFocusedEntryHandled?.();
    }
  }, [safeEntries, focusedEntryId, onFocusedEntryHandled]);

  const saveEntry = () => {
    if (!draftEntry.title?.trim()) return;
    if (draftEntry.id) onUpdateEntry({ ...(draftEntry as VaultEntry), tags: normalizeConceptTags(draftEntry.tags), dateUpdated: today() });
    else onAddEntry({ ...draftEntry, tags: normalizeConceptTags(draftEntry.tags) });
    setEditorOpen(false);
  };

  const openEntry = (id: string) => {
    setSelectedId(id);
    setDetailTab('overview');
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
    const linkedSources = media.filter((item) => (selected.sourceIds || []).includes(item.id));
    const linkedDrafts = drafts.filter((draft) => (draft.beliefIds || []).includes(selected.id));
    const linkedPractices = practices.filter((practice) => (practice.positionIds || []).includes(selected.id));
    const linkedQuestions = questions.filter((question) => (question.beliefIds || []).includes(selected.id));
    const typedLinks = links.filter((link) => (link.fromType === 'position' && link.fromId === selected.id) || (link.toType === 'position' && link.toId === selected.id));
    const tensionLinks = typedLinks.filter((link) => link.type === 'contradicts' || link.type === 'challenges' || link.note?.toLowerCase().includes('tension'));
    const relatedPositions = safeEntries.filter((entry) =>
      entry.id !== selected.id &&
      typedLinks.some((link) =>
        (link.fromId === entry.id && link.toId === selected.id) ||
        (link.toId === entry.id && link.fromId === selected.id)
      )
    );
    const beliefProfile = beliefProfiles.find((item) => item.positionId === selected.id);
    const linkedUnknowns = unknowns.filter((item) => (item.positionIds || []).includes(selected.id));
    const positionSuggestions = suggestions.filter((item) => item.targetType === 'position' && item.targetId === selected.id);
    const formation = positionFormation(selected);
    const firstLinkedSource = linkedSources[0];
    const strongestObjection = tensionLinks[0]?.note || selected.evidenceAgainst?.[0] || 'No direct objection has been articulated yet.';
    const strongestSupport = selected.evidenceFor?.[0] || linkedSources[0]?.title || 'No direct support has been recorded yet.';
    const latestRevision = [...(selected.versionHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const derivedAssumptions = [
      selected.tags.length ? `The concepts ${selected.tags.slice(0, 3).join(', ')} are defined clearly enough to support this claim.` : 'This position needs explicit concepts before its scope is stable.',
      linkedSources.length ? 'The linked sources count as relevant evidence rather than only inspiration.' : 'This position can stand provisionally without a linked source, but remains evidence-light.',
      (selected.evidenceAgainst || []).length || tensionLinks.length ? 'The current objections represent the strongest available pressure.' : 'This position has not yet faced a serious recorded objection.',
    ];
    const positionAssumptions = (selected.assumptions || []).length ? selected.assumptions || [] : derivedAssumptions;
    const dependencyItems = [
      ...selected.tags.slice(0, 5).map((tag) => `Concept: ${tag}`),
      ...linkedQuestions.slice(0, 3).map((question) => `Inquiry: ${question.text}`),
      ...linkedSources.slice(0, 3).map((source) => `Source: ${source.title}`),
    ];
    const counterposition = strongestObjection !== 'No direct objection has been articulated yet.'
      ? strongestObjection
      : `The strongest opposite case has not been written yet. Ask what would make "${selected.title}" false, incomplete, or too narrow.`;
    const applicationItems = (selected.applications || []).length ? selected.applications || [] : [
      linkedPractices.length ? `${linkedPractices.length} practice(s) already test this position.` : 'No lived test is attached yet.',
      linkedDrafts.length ? `${linkedDrafts.length} work(s) express this position.` : 'No essay, note, script, or work expresses this position yet.',
      selected.status === 'revised' ? 'This position has already changed and should preserve its revision path.' : 'If pressure changes the claim, mark a revision instead of silently editing it.',
    ];
    const consequenceItems = (selected.consequences || []).length ? selected.consequences || [] : [
      'No explicit consequences have been written yet.',
      'Ask what decisions, behaviors, writings, or practices would change if this position were true.',
    ];
    const stressStages = buildStressStages({
      selected,
      assumptions: positionAssumptions,
      strongestSupport,
      strongestObjection,
      counterposition,
      linkedSources,
      linkedPractices,
    });
    const selectedStressStage = stressStages[Math.min(stressStageIndex, stressStages.length - 1)];
    const reviewTabs: Array<{ id: 'overview' | 'evidence' | 'opposition' | 'relations' | 'history'; label: string }> = [
      { id: 'overview', label: 'Claim' },
      { id: 'evidence', label: 'Grounds' },
      { id: 'opposition', label: 'Opposition' },
      { id: 'relations', label: 'Applications' },
      { id: 'history', label: 'Biography' },
    ];

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
        view: 'practices',
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
          { label: 'Open Practice Field', view: 'practices', targetId: practice.id, targetType: 'practice' },
          { label: 'Return to Position', view: 'vault', targetId: selected.id, targetType: 'position' },
        ],
        thinkingEventHint: 'Previewing a practice is orientation. Starting, concluding, or logging an outcome that changes a belief should create history.',
      });
    };

    const createMissingPerspective = async () => {
      const positionMemory = {
        scope: 'linked_objects' as const,
        instruction: 'Use the selected position first. Use linked objects only to identify grounded missing perspectives. Do not use generic perspective lists.',
        itemMemory: [
          `Position title: ${selected.title}`,
          `Statement: ${selected.statement || 'No statement.'}`,
          selected.description ? `Scope: ${selected.description}` : '',
          `Status: ${selected.status}`,
          `Confidence: ${selected.confidence}/5`,
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

    const saveStressAnswer = () => {
      if (!stressAnswer.trim()) return;
      const stageTitle = selectedStressStage?.title || 'Stress test';
      onUpdateEntry({
        ...selected,
        testingCount: (selected.testingCount || 0) + 1,
        versionHistory: [
          ...(selected.versionHistory || []),
          { date: today(), eventType: 'challenged', description: `Stress test answered (${stageTitle}): ${stressAnswer.trim()}` },
        ],
        dateUpdated: today(),
      });
      setStressAnswer('');
      toast({ title: 'Stress test recorded', description: 'The answer has been added to this position history.' });
    };

    return (
      <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
        <div className="mb-5 flex items-center justify-between">
          <Button variant="ghost" onClick={closeEntry} className="h-8 font-code text-[10px] uppercase tracking-widest rounded-full"><ArrowLeft className="size-4 mr-2" /> Positions</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openEditor(selected)} className="h-8 bg-white border-border/60 shadow-sm rounded-full"><Edit className="size-4 mr-2" /> Edit</Button>
            <Button variant="destructive" onClick={() => setDeleteTarget(selected)} className="h-8 shadow-sm rounded-full"><Trash2 className="size-4 mr-2" /> Delete</Button>
          </div>
        </div>

        <Card className="mb-5 rounded-2xl border-border/50 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="font-code uppercase bg-white border-border/60 shadow-sm rounded-full">{(selected.type || 'belief').replace('_', ' ')}</Badge>
              <Badge variant="outline" className="font-code uppercase bg-white border-border/60 shadow-sm rounded-full">{(selected.positionKind || 'interpretive').replace(/_/g, ' ')}</Badge>
              <Badge variant="secondary" className="font-code uppercase rounded-full bg-accent/10 text-accent">{confidenceLabel(selected.confidence)} confidence</Badge>
              <Badge
                variant={formation.fullyFormed ? 'default' : 'outline'}
                className={cn(
                  'font-code uppercase rounded-full shadow-sm',
                  formation.fullyFormed ? 'bg-emerald-600 text-white' : 'bg-amber-50 text-amber-900 border-amber-200'
                )}
              >
                {formation.fullyFormed ? 'Fully formed' : `Draft position ${formation.complete}/${formation.total}`}
              </Badge>
            </div>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <h1 className="font-headline text-3xl font-bold leading-tight">{selected.title}</h1>
              <p className="mt-3 max-w-4xl font-body text-base italic leading-7 text-primary/80">{selected.statement || selected.description}</p>
            </div>
            <div className="grid min-w-[260px] grid-cols-4 gap-2 rounded-xl border border-border/50 bg-muted/10 p-3 text-center">
              {[
                { label: 'Confidence', value: `${selected.confidence}/5` },
                { label: 'Support', value: (selected.evidenceFor || []).length },
                { label: 'Challenge', value: (selected.evidenceAgainst || []).length + tensionLinks.length },
                { label: 'Tests', value: linkedPractices.length },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-card px-2 py-2">
                  <div className="font-headline text-lg font-semibold italic">{item.value}</div>
                  <div className="font-code text-[7px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(selected.tags || []).map((tag) => (
              <button 
                key={tag} 
                onClick={() => setConceptPopupName(tag)}
                className="font-code text-[9px] uppercase tracking-widest px-3 py-1 bg-white border border-border/60 shadow-sm rounded-full font-bold hover:bg-accent/10 hover:text-accent transition-all"
              >
                {tag}
              </button>
            ))}
          </div>
        </Card>

        {!formation.fullyFormed && (
          <Card className="mb-5 rounded-xl border-amber-200 bg-amber-50/80 p-4 shadow-sm">
            <div className="font-code text-[9px] uppercase tracking-[0.18em] text-amber-800 font-bold">To fully form this position</div>
            <p className="mt-2 text-sm leading-6 text-amber-950">
              Complete {formation.missing.slice(0, 4).join(', ')}
              {formation.missing.length > 4 ? `, and ${formation.missing.length - 4} more` : ''}.
            </p>
          </Card>
        )}

        <div className="mb-5">
          <NextPhilosophicalActionPanel
            compact
            status={selected.status}
            title="Next Philosophical Action"
            description="Positions are the center of gravity: support them, challenge them, express them, or test them."
            actions={[
              {
                label: 'Raise Confidence',
                tone: 'support',
                disabled: selected.confidence >= 5,
                description: 'Increase confidence in this position.',
                onClick: () => onUpdateEntry({ ...selected, confidence: Math.min(5, (selected.confidence || 3) + 1), dateUpdated: today() }),
              },
              {
                label: 'Lower Confidence',
                tone: 'challenge',
                disabled: selected.confidence <= 1,
                description: 'Decrease confidence — add doubt before revising.',
                onClick: () => onUpdateEntry({ ...selected, confidence: Math.max(1, (selected.confidence || 3) - 1), dateUpdated: today() }),
              },
              {
                label: 'Turn into Essay',
                description: 'Open this position as an essay draft.',
                onClick: () => onAddDraft({
                  title: selected.title,
                  body: `**Position:** ${selected.statement}\n\n**Reasoning:**\n${selected.description || ''}`,
                  type: 'essay',
                  status: 'seed',
                  beliefIds: [selected.id],
                  sourceIds: selected.sourceIds || [],
                  conceptTags: selected.tags || [],
                }),
              },
              {
                label: 'Start Practice',
                description: 'Create a behavioral experiment to test this position.',
                onClick: () => onAddPractice({
                  title: `Test: ${selected.title.slice(0, 60)}`,
                  description: `This practice tests the position: "${selected.statement}"`,
                  type: 'experiment',
                  status: 'planned',
                  durationDays: 7,
                  positionIds: [selected.id],
                  conceptTags: selected.tags || [],
                  sourceIds: selected.sourceIds || [],
                }),
              },
              {
                label: 'Mark Challenged',
                tone: 'challenge',
                disabled: selected.status === 'challenged',
                onClick: () => onUpdateEntry({
                  ...selected,
                  status: 'challenged',
                  versionHistory: [
                    ...(selected.versionHistory || []),
                    { date: today(), eventType: 'challenged', description: 'Marked as challenged for further examination.' },
                  ],
                  dateUpdated: today(),
                }),
              },
              {
                label: 'Mark Revised',
                disabled: selected.status === 'revised',
                onClick: () => onUpdateEntry({
                  ...selected,
                  status: 'revised',
                  versionHistory: [
                    ...(selected.versionHistory || []),
                    { date: today(), eventType: 'revised', description: 'Marked as revised after reflection.' },
                  ],
                  dateUpdated: today(),
                }),
              },
              {
                label: 'Reject',
                tone: 'challenge',
                disabled: selected.status === 'rejected',
                description: 'Mark this position as rejected after examination.',
                onClick: () => onUpdateEntry({
                  ...selected,
                  status: 'rejected',
                  versionHistory: [
                    ...(selected.versionHistory || []),
                    { date: today(), eventType: 'revised', description: 'Position rejected after examination.' },
                  ],
                  dateUpdated: today(),
                }),
              },
            ]}
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {reviewTabs.map((tab) => (
            <Button
              key={tab.id}
              variant={detailTab === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDetailTab(tab.id)}
              className="rounded-full"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {detailTab === 'overview' && (
          <>
            <TensionResolutionPanel
              selected={selected}
              tensionLinks={tensionLinks}
              onUpdateEntry={onUpdateEntry}
              onUpdateLink={onUpdateLink}
            />

            <Card className="mb-6 rounded-xl border-border/50 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Position Anatomy</div>
                  <h3 className="mt-1 font-headline text-2xl font-bold italic">Scope, assumptions, opposition, and application</h3>
                </div>
                <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                  {selected.confidence}/5 confidence
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <InfoPanel title="Meaning and Scope" items={[selected.statement, selected.description].filter(Boolean)} empty="No statement or scope has been written yet." />
                <InfoPanel title="Confidence Reasoning" items={selected.confidenceReasoning ? [selected.confidenceReasoning] : []} empty="No reasoning for this confidence level has been written yet." />
                <InfoPanel title="Assumptions" items={positionAssumptions} empty="No assumptions derived yet." />
                <InfoPanel title="Dependencies" items={dependencyItems} empty="No concepts, inquiries, or sources are linked yet." />
                <InfoPanel title="Counterposition" items={[counterposition]} empty="No counterposition recorded yet." />
                <InfoPanel title="Applications" items={applicationItems} empty="No application path yet." />
                <InfoPanel title="Consequences" items={consequenceItems} empty="No consequences written yet." />
                <InfoPanel title="Falsification" items={selected.falsification ? [selected.falsification] : []} empty="No falsification condition written yet." />
                <InfoPanel title="Revision Rule" items={[
                  'If new evidence changes the claim, use revision history instead of overwriting the old position silently.',
                  'If the opposite case is stronger, lower confidence or mark the position challenged before abandoning it.',
                ]} empty="No revision rule." />
              </div>
            </Card>

            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="rounded-xl border-border/50 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Position Pressure</div>
                    <h3 className="mt-1 font-headline text-2xl font-bold italic">What most strengthens and pressures this belief</h3>
                  </div>
                  <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                    {selected.status}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoPanel title="Strongest Support" items={[strongestSupport]} empty="No support recorded yet." />
                  <InfoPanel title="Strongest Objection" items={[strongestObjection]} empty="No objection recorded yet." />
                  <InfoPanel title="Latest Revision" items={latestRevision ? [`${latestRevision.date}: ${latestRevision.description}`] : []} empty="No revision history yet." />
                  <InfoPanel title="Testing Posture" items={[
                    linkedPractices.length ? `${linkedPractices.length} practice(s) linked` : 'No practices linked yet.',
                    `${selected.testingCount || 0} stress test answer(s) recorded`,
                  ]} empty="No testing activity yet." />
                </div>
              </Card>

              <Card className="rounded-xl border-border/50 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Object Flow</div>
                    <h3 className="mt-1 font-headline text-2xl font-bold italic">What this position touches</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniMetricCard label="Sources" value={linkedSources.length} sub="evidence inputs" />
                  <MiniMetricCard label="Inquiries" value={linkedQuestions.length} sub="active questions" />
                  <MiniMetricCard label="Works" value={linkedDrafts.length} sub="expressed outputs" />
                  <MiniMetricCard label="Practices" value={linkedPractices.length} sub="lived tests" />
                </div>
              </Card>
            </div>

            <Card className="mb-6 rounded-xl border-border/50 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Stress-Test Mode</div>
                  <h3 className="mt-1 font-headline text-2xl font-bold italic">Pressure-test the claim before revising it</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Move through the stages in order. AI may suggest pressure, but the user decides whether this position survives, weakens, changes, or should be abandoned.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                  Stage {Math.min(stressStageIndex + 1, stressStages.length)} / {stressStages.length}
                </Badge>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                {stressStages.map((stage, index) => (
                  <button
                    key={stage.title}
                    type="button"
                    onClick={() => setStressStageIndex(index)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      stressStageIndex === index
                        ? 'border-accent bg-accent/10 text-foreground shadow-sm'
                        : 'border-border/60 bg-muted/10 text-muted-foreground hover:border-accent/50 hover:bg-accent/5'
                    )}
                  >
                    <div className="font-code text-[8px] uppercase tracking-[0.18em]">Step {index + 1}</div>
                    <div className="mt-1 text-sm font-semibold">{stage.title}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Current Prompt</div>
                  <p className="mt-2 text-base font-medium leading-7 text-foreground">{selectedStressStage.prompt}</p>
                  <div className="mt-4 rounded-lg border border-border/50 bg-card p-3">
                    <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Existing Signal</div>
                    <p className="mt-1 text-sm italic leading-6 text-muted-foreground">{selectedStressStage.signal}</p>
                  </div>
                  {stressStageIndex === stressStages.length - 1 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => onUpdateEntry({ ...selected, status: 'challenged', dateUpdated: today() })}
                      >
                        Mark Challenged
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => onUpdateEntry({
                          ...selected,
                          status: 'revised',
                          versionHistory: [
                            ...(selected.versionHistory || []),
                            { date: today(), eventType: 'revised', description: 'Marked revised after stress-test outcome review.' },
                          ],
                          dateUpdated: today(),
                        })}
                      >
                        Mark Revised
                      </Button>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
                    Answer this stage
                  </Label>
                  <Textarea
                    value={stressAnswer}
                    onChange={(event) => setStressAnswer(event.target.value)}
                    className="mt-2 min-h-[150px]"
                    placeholder="Record the pressure, the evidence that would matter, and what this should do to confidence or wording."
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs italic text-muted-foreground">
                      Saved answers are added to the belief biography as a challenge event.
                    </p>
                    <Button size="sm" className="rounded-full" onClick={saveStressAnswer}>Record Stage Answer</Button>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mb-6">
              <NextPhilosophicalActionPanel
                status={selected.status}
                title="Next Philosophical Action"
                description="Positions are the center of gravity: support them, challenge them, express them, or test them."
                actions={[
                  {
                    label: 'Raise Confidence',
                    tone: 'support',
                    disabled: selected.confidence >= 5,
                    description: 'Increase confidence in this position.',
                    onClick: () => onUpdateEntry({ ...selected, confidence: Math.min(5, (selected.confidence || 3) + 1), dateUpdated: today() }),
                  },
                  {
                    label: 'Lower Confidence',
                    tone: 'challenge',
                    disabled: selected.confidence <= 1,
                    description: 'Decrease confidence and mark room for revision.',
                    onClick: () => onUpdateEntry({ ...selected, confidence: Math.max(1, (selected.confidence || 3) - 1), dateUpdated: today() }),
                  },
                  {
                    label: 'Turn into Essay',
                    description: 'Open this position as an essay draft.',
                    onClick: () => onAddDraft({
                      title: selected.title,
                      body: `**Position:** ${selected.statement}\n\n**Reasoning:**\n${selected.description || ''}`,
                      type: 'essay',
                      status: 'seed',
                      beliefIds: [selected.id],
                      sourceIds: selected.sourceIds || [],
                      conceptTags: selected.tags || [],
                    }),
                  },
                  {
                    label: 'Start Practice',
                    description: 'Create a behavioral experiment to test this position.',
                    onClick: () => onAddPractice({
                      title: `Test: ${selected.title.slice(0, 60)}`,
                      description: `This practice tests the position: "${selected.statement}"`,
                      type: 'experiment',
                      status: 'planned',
                      durationDays: 7,
                      positionIds: [selected.id],
                      conceptTags: selected.tags || [],
                      sourceIds: selected.sourceIds || [],
                    }),
                  },
                  {
                    label: 'Open Inquiry',
                    description: 'Turn pressure into a named question.',
                    onClick: () => onAddQuestion({
                      text: `What would revise: ${selected.title}?`,
                      status: 'open',
                      beliefIds: [selected.id],
                      conceptIds: concepts.filter((concept) => (selected.tags || []).includes(concept.name)).map((concept) => concept.id),
                      sourceIds: selected.sourceIds || [],
                      evidenceIds: [],
                    }),
                  },
                  {
                    label: 'Mark Revised',
                    disabled: selected.status === 'revised',
                    onClick: () => onUpdateEntry({
                      ...selected,
                      status: 'revised',
                      versionHistory: [
                        ...(selected.versionHistory || []),
                        { date: today(), eventType: 'revised', description: 'Marked as revised after reflection.' },
                      ],
                      dateUpdated: today(),
                    }),
                  },
                ]}
              />
            </div>
          </>
        )}

        {detailTab === 'evidence' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EvidencePanel title="Evidence For" items={selected.evidenceFor || []} onAdd={(text) => onUpdateEntry({ ...selected, evidenceFor: [...(selected.evidenceFor || []), text], dateUpdated: today() })} />
            <EvidencePanel title="Evidence Against" items={selected.evidenceAgainst || []} onAdd={(text) => onUpdateEntry({ ...selected, evidenceAgainst: [...(selected.evidenceAgainst || []), text], dateUpdated: today() })} />
            <EntityListPanel
              title="Linked Sources"
              empty="No sources linked yet."
              items={linkedSources.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.type} ${item.creator ? `• ${item.creator}` : ''}`.trim(),
                onClick: () => previewSource(item),
              }))}
            />
            <InfoPanel
              title="Evidence Ledger"
              items={[
                `${(selected.evidenceFor || []).length} supporting note(s) recorded`,
                `${(selected.evidenceAgainst || []).length} challenging note(s) recorded`,
                `${linkedSources.length} source link(s) attached`,
              ]}
              empty="No ledger data yet."
            />
          </div>
        )}

        {detailTab === 'opposition' && (
          <div className="space-y-6">
            <TensionResolutionPanel
              selected={selected}
              tensionLinks={tensionLinks}
              onUpdateEntry={onUpdateEntry}
              onUpdateLink={onUpdateLink}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <EvidencePanel
                title="Objections and Counterevidence"
                items={selected.evidenceAgainst || []}
                onAdd={(text) => onUpdateEntry({ ...selected, evidenceAgainst: [...(selected.evidenceAgainst || []), text], dateUpdated: today() })}
              />
              <InfoPanel title="Counterposition" items={[counterposition]} empty="No counterposition recorded yet." />
              <InfoPanel title="Alternative Explanations" items={[
                'Could the same evidence support a weaker, narrower, or opposite claim?',
                linkedSources.length ? `Review ${linkedSources.length} linked source(s) for disagreement, not just support.` : 'Add a source that disagrees before raising confidence.',
              ]} empty="No alternative explanation path yet." />
              <InfoPanel title="Hidden Assumptions To Pressure" items={positionAssumptions} empty="No assumptions have been written yet." />
              <InfoPanel title="Falsification Condition" items={selected.falsification ? [selected.falsification] : []} empty="Write what evidence, experience, or result would weaken or overturn this claim." />
              <EntityListPanel
                title="Contradictory or Challenging Positions"
                empty="No typed challenge or contradiction links yet."
                items={relatedPositions
                  .filter((entry) => typedLinks.some((link) =>
                    ['challenges', 'contradicts', 'weakens'].includes(link.type) &&
                    ((link.fromId === entry.id && link.toId === selected.id) || (link.toId === entry.id && link.fromId === selected.id))
                  ))
                  .map((entry) => ({
                    id: entry.id,
                    title: entry.title,
                    meta: 'challenge pressure',
                    onClick: () => openEntry(entry.id),
                  }))}
              />
            </div>
          </div>
        )}

        {detailTab === 'relations' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EntityListPanel
              title="Related Positions"
              empty="No typed relations to other positions yet."
              items={relatedPositions.map((entry) => ({
                id: entry.id,
                title: entry.title,
                meta: typedLinks
                  .filter((link) =>
                    (link.fromId === entry.id && link.toId === selected.id) ||
                    (link.toId === entry.id && link.fromId === selected.id)
                  )
                  .map((link) => link.type.replace(/_/g, ' '))
                  .join(', '),
                onClick: () => openEntry(entry.id),
              }))}
            />
            <EntityListPanel
              title="Linked Inquiries"
              empty="No inquiries are linked to this position yet."
              items={linkedQuestions.map((item) => ({
                id: item.id,
                title: item.text,
                meta: item.status,
                onClick: () => previewInquiry(item),
              }))}
            />
            <EntityListPanel
              title="Works Expressing It"
              empty="No works are carrying this position yet."
              items={linkedDrafts.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.type.replace(/_/g, ' ')} • ${item.status}`,
                onClick: () => previewWork(item),
              }))}
            />
            <EntityListPanel
              title="Practices Testing It"
              empty="No practices are testing this belief yet."
              items={linkedPractices.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.type.replace(/_/g, ' ')} • ${item.status}`,
                onClick: () => previewPractice(item),
              }))}
            />
          </div>
        )}

        {detailTab === 'history' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="rounded-xl border-border/50 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Belief Biography</div>
                  <h3 className="mt-1 font-headline text-2xl font-bold italic">How this position has changed</h3>
                </div>
                <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                  {beliefProfile?.reviewStatus || 'current'}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoPanel title="Created From" items={beliefProfile?.originSummary ? [beliefProfile.originSummary] : [selected.createdFrom || 'Manual position entry']} empty="No origin summary yet." />
                <InfoPanel title="Confidence History" items={[`Current confidence: ${selected.confidenceScore ?? selected.confidence ?? 3}/5`, `Evidence quality: ${beliefProfile?.evidenceQuality || selected.evidenceQuality || 'unscored'}`, `Stress tests: ${beliefProfile?.testingCount ?? selected.testingCount ?? 0}`]} empty="No confidence history yet." />
                <InfoPanel title="Strengthened By" items={beliefProfile?.strengthenedBy || []} empty="No supporting developments recorded yet." />
                <InfoPanel title="Challenged By" items={beliefProfile?.challengedBy || []} empty="No challenges recorded yet." />
                <InfoPanel title="Weakened By" items={beliefProfile?.weakenedBy || []} empty="No weakening events recorded yet." />
                <InfoPanel title="Linked Unknowns" items={linkedUnknowns.map((item) => item.title)} empty="No linked unknowns yet." />
                <InfoPanel title="Version History" items={(selected.versionHistory || []).map((v) => `${v.date}: ${v.description}`)} empty="No revisions recorded yet." />
                <InfoPanel title="Typed Links" items={typedLinks.map((link) => `${link.type.replace(/_/g, ' ')}: ${link.fromLabel || link.fromType} -> ${link.toLabel || link.toType}`)} empty="No typed links recorded yet." />
              </div>
            </Card>

            <Card className="rounded-xl border-border/50 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">AI Review</div>
                  <h3 className="mt-1 font-headline text-2xl font-bold italic">Pressure, questions, and perspective</h3>
                </div>
                <GenerativeAiIcon className="size-10" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={createMissingPerspective}>Suggest Perspective</Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={createMissingQuestions}>Suggest Question</Button>
                <Button size="sm" className="rounded-full" onClick={createStressTests}>Generate Stress Test</Button>
              </div>
              {(stressTests.length > 0 || positionSuggestions.length > 0) && (
                <div className="mt-4 space-y-3">
                  {stressTests.map((prompt) => (
                    <div key={`${prompt.kind}:${prompt.question}`} className="rounded-xl border border-border/60 bg-muted/10 p-3 text-sm italic text-foreground/80">
                      {prompt.question}
                    </div>
                  ))}
                  {positionSuggestions.slice(0, 6).map((suggestion) => (
                    <div key={suggestion.id} className="rounded-xl border border-border/60 bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{suggestion.suggestionType.replace(/_/g, ' ')}</Badge>
                          <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{suggestion.status}</Badge>
                          {typeof suggestion.confidence === 'number' && (
                            <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{Math.round(suggestion.confidence * 100)}% confidence</Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                          AI suggests · user decides
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                        <div>
                          <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Suggestion</div>
                          <h4 className="mt-1 font-headline text-lg font-bold italic">{suggestion.title}</h4>
                          {suggestion.description && <p className="mt-1 text-sm text-muted-foreground">{suggestion.description}</p>}
                        </div>
                        <div className="rounded-xl border border-border/50 bg-card p-3">
                          <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Affected Object</div>
                          <p className="mt-1 text-sm font-medium text-foreground">{suggestion.targetLabel || selected.title}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-border/50 bg-card p-3">
                          <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Reason</div>
                          <p className="mt-1 text-sm italic leading-6 text-muted-foreground">{suggestion.reasoning || 'No explicit reasoning was stored with this suggestion.'}</p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-card p-3">
                          <div className="font-code text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Evidence Used</div>
                          {!!suggestion.evidence?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {suggestion.evidence.map((item) => <Badge key={item} variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">{item}</Badge>)}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm italic text-muted-foreground">No evidence list stored. Treat this as low-trust until reviewed.</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suggestion.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => {
                                if (suggestion.suggestionType === 'missing_question') {
                                  onAddQuestion({
                                    text: suggestion.title,
                                    status: 'open',
                                    beliefIds: [selected.id],
                                    conceptIds: concepts.filter((concept) => (selected.tags || []).includes(concept.name)).map((concept) => concept.id),
                                    evidenceIds: [],
                                    sourceIds: selected.sourceIds || [],
                                  });
                                }
                                if (suggestion.suggestionType === 'unknown_candidate') {
                                  onAddUnknown({
                                    title: suggestion.title,
                                    description: suggestion.description || suggestion.reasoning || '',
                                    positionIds: [selected.id],
                                    conceptTags: selected.tags || [],
                                    sourceIds: selected.sourceIds || [],
                                    status: 'active',
                                    importance: 'medium',
                                    createdFrom: 'ai',
                                  });
                                }
                                onUpdateSuggestion({ ...suggestion, status: 'accepted', dateUpdated: new Date().toISOString() });
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => {
                                if (suggestion.suggestionType === 'missing_question') {
                                  onAddQuestion({
                                    text: suggestion.title,
                                    status: 'open',
                                    beliefIds: [selected.id],
                                    conceptIds: concepts.filter((concept) => (selected.tags || []).includes(concept.name)).map((concept) => concept.id),
                                    evidenceIds: [],
                                    sourceIds: selected.sourceIds || [],
                                  });
                                }
                                onUpdateSuggestion({ ...suggestion, status: 'accepted', dateUpdated: new Date().toISOString() });
                              }}
                            >
                              Edit into inquiry
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onUpdateSuggestion({ ...suggestion, status: 'dismissed', dateUpdated: new Date().toISOString() })}>
                              Reject
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onUpdateSuggestion({ ...suggestion, status: 'ignored', dateUpdated: new Date().toISOString() })}>
                              Ignore
                            </Button>
                          </>
                        )}
                        <details className="w-full rounded-xl border border-border/50 bg-muted/10 p-3 text-sm text-muted-foreground">
                          <summary className="cursor-pointer font-medium text-foreground">Explain this suggestion</summary>
                          <div className="mt-2 space-y-2 leading-6">
                            <p><span className="font-medium text-foreground">Type:</span> {suggestion.suggestionType.replace(/_/g, ' ')}</p>
                            <p><span className="font-medium text-foreground">Confidence:</span> {typeof suggestion.confidence === 'number' ? `${Math.round(suggestion.confidence * 100)}%` : 'not scored'}</p>
                            <p><span className="font-medium text-foreground">Rule:</span> Accepting should create or route a reviewable object. It should not silently rewrite this position.</p>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">What would change your mind?</Label>
                <Textarea value={stressAnswer} onChange={(event) => setStressAnswer(event.target.value)} className="mt-2 min-h-[110px]" placeholder="What prediction follows? What weakens this? What contrary evidence would matter?" />
                <div className="mt-3 flex justify-end">
                  <Button size="sm" className="rounded-full" onClick={saveStressAnswer}>Record Answer</Button>
                </div>
              </div>
            </Card>
          </div>
        )}
        
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

        <BeliefEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draftEntry} setDraft={setDraftEntry} concepts={concepts} media={media} onAddConcept={onAddConcept} onSave={saveEntry} />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 font-body">
      <PageHeader
        title="Positions"
        description="State what you currently believe, what supports it, and what could change it."
        meta={
          <span className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
            {positionStats.total} positions · {positionStats.underReview} need review · {positionStats.needsPractice} untested · {positionStats.tensions} tensions
          </span>
        }
        className="mb-5"
        actions={
          <>
            {positionStats.tensions > 0 && (
              <Button variant="outline" onClick={() => setTensionDrawerOpen(true)} size="sm" className="bg-amber-50 border-amber-200 text-amber-900 shadow-sm rounded-full h-9 font-bold">
                <AlertTriangle className="size-4 mr-1.5" /> {positionStats.tensions} TENSIONS
              </Button>
            )}
            <Button onClick={() => openEditor()} size="sm" className="bg-accent hover:bg-accent/90 px-6 shadow-md shadow-accent/20 rounded-full h-9 font-bold">
              <Plus className="size-4 mr-1.5" /> NEW POSITION
            </Button>
          </>
        }
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search positions, principles..."
        resultCount={filteredEntries.length}
        resultLabel="positions"
        activeFilterLabels={activeFilterLabels}
        onClear={clearPositionFilters}
        clearDisabled={!positionFiltersActive}
        className="mb-3"
      >
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as PositionViewFilter)}>
          <SelectTrigger className="w-52 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60">
            <SelectValue placeholder="Position View" />
          </SelectTrigger>
          <SelectContent>
            {PRIMARY_POSITION_VIEW_FILTERS.map((value) => (
              <SelectItem key={value} value={value} className="font-code text-[10px] uppercase">{POSITION_VIEW_LABELS[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as VaultType | 'all')}>
          <SelectTrigger className="w-52 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60">
            <SelectValue placeholder="Position Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[10px] uppercase">All Types</SelectItem>
            {vaultTypes.map((type) => (
              <SelectItem key={type} value={type} className="font-code text-[10px] uppercase">{TYPE_LABELS[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

          <div className="flex rounded-full border border-border/60 bg-card p-1 shadow-sm">
            <Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('cards')} className="h-7 rounded-full px-3">
              <LayoutGrid className="size-3.5" /> Cards
            </Button>
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="h-7 rounded-full px-3">
              <Table2 className="size-3.5" /> Table
            </Button>
          </div>
      </FilterToolbar>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {[
          { label: 'Needs review', value: positionStats.underReview, filter: 'under_review' as PositionViewFilter },
          { label: 'Untested', value: positionStats.needsPractice, filter: 'needs_practice' as PositionViewFilter },
          { label: 'Unsupported', value: positionStats.unsupported, filter: 'unsupported' as PositionViewFilter },
          { label: 'Stale', value: positionStats.stale, filter: 'stale' as PositionViewFilter },
        ].filter((item) => item.value > 0).map((item) => (
          <button
            key={item.filter}
            type="button"
            onClick={() => setViewFilter(viewFilter === item.filter ? 'all' : item.filter)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-code text-[9px] uppercase tracking-widest transition-colors",
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
          const formation = positionFormation(entry);
          return (
            <Card 
              key={entry.id} 
              className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-accent/20 bg-card p-4 rounded-xl shadow-md md:p-5"
              onClick={() => openEntry(entry.id)}
            >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1 font-bold">
                  {TYPE_LABELS[entry.type] || 'Position'}
                </div>
                <h3 className="font-headline text-xl font-bold italic leading-tight group-hover:text-accent transition-colors truncate text-primary">
                  {entry.title}
                </h3>
              </div>
              <div className="size-10 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50 shadow-sm">
                <Triangle className="size-4 fill-current rotate-180" />
              </div>
            </div>
            
            <p className="text-[13px] leading-relaxed text-muted-foreground font-body line-clamp-2 italic mb-6">
              {entry.statement || entry.description}
            </p>

            <div className="mb-4 hidden rounded-xl border border-border/40 bg-muted/10 p-3 md:block">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{diagnostic.label}</Badge>
                <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">{diagnostic.daysSinceUpdate}d since review</span>
              </div>
              <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60">Strongest next action</div>
              <p className="text-xs italic leading-5 text-muted-foreground">{diagnostic.nextAction}</p>
              {!!diagnostic.flags.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {diagnostic.flags.slice(0, 3).map((flag) => (
                    <span key={flag} className="rounded-full bg-accent/10 px-2 py-0.5 font-code text-[8px] uppercase tracking-widest text-accent">{flag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-5 pt-4 border-t border-border/30">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div 
                    key={n} 
                    className={cn(
                      'size-2 rounded-full shadow-sm', 
                      n <= (entry.confidence || 3) ? 'bg-accent' : 'bg-muted'
                    )} 
                  />
                ))}
              </div>
              <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest px-2 py-0.5 bg-emerald-100/40 text-emerald-700 border-emerald-200/50 rounded-full font-bold">
                {entry.status}
              </Badge>
              <Badge variant="outline" className={cn(
                'font-code text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold',
                formation.fullyFormed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'
              )}>
                {formation.fullyFormed ? 'formed' : `${formation.complete}/${formation.total}`}
              </Badge>
              <div className="flex items-center gap-1.5 ml-auto">
                {(entry.tags || []).slice(0, 2).map(tag => (
                  <button
                    key={tag}
                    onClick={(e) => { e.stopPropagation(); setConceptPopupName(tag); }}
                    className="font-code text-[8px] uppercase tracking-widest px-2 py-0.5 bg-muted/10 text-muted-foreground/40 rounded-full font-bold hover:bg-accent/10 hover:text-accent transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
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
              action={positionFiltersActive ? <Button variant="outline" onClick={clearPositionFilters} className="rounded-full">Clear filters</Button> : undefined}
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
        <DialogContent className="max-w-2xl max-h-[82vh] overflow-y-auto bg-white border-none shadow-2xl rounded-2xl">
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
                    "rounded-full font-code text-[8px] uppercase tracking-widest",
                    severity === 'possible contradiction' ? "border-rose-200 bg-rose-50 text-rose-800" :
                    severity === 'possible qualification' ? "border-blue-200 bg-blue-50 text-blue-800" :
                    severity === 'possible complement' ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                    "border-border bg-muted/20 text-muted-foreground"
                  )}>
                    {severity}
                  </Badge>
                  <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">Shared: {sharedTags.slice(0, 2).join(', ')}</span>
                </div>
                <button onClick={() => { setTensionDrawerOpen(false); openEntry(a.id); }} className="block text-left font-headline text-base font-bold italic text-foreground hover:text-accent">
                  {a.title}
                </button>
                <div className="my-1 font-code text-[8px] uppercase tracking-widest text-muted-foreground">and</div>
                <button onClick={() => { setTensionDrawerOpen(false); openEntry(b.id); }} className="block text-left font-headline text-base font-bold italic text-foreground hover:text-accent">
                  {b.title}
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-full bg-white" onClick={() => { setTensionDrawerOpen(false); openEntry(a.id); }}>
                    Review tension
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setViewFilter('tensions')}>
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

      <BeliefEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draftEntry} setDraft={setDraftEntry} concepts={concepts} media={media} onAddConcept={onAddConcept} onSave={saveEntry} />

      {/* Draft position pipeline dialog */}
      <Dialog open={ideaOpen} onOpenChange={(open) => { if (!open) setIdeaOpen(false); }}>
        <DialogContent className="max-w-xl bg-white border-none shadow-2xl rounded-2xl">
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
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Draft Position</Label>
                <Input
                  value={ideaDraft.title}
                  onChange={(e) => setIdeaDraft((p) => ({ ...p, title: e.target.value }))}
                  placeholder="State the rough claim briefly..."
                  className="rounded-full"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Reasoning / Context</Label>
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
                  className="bg-accent shadow-md shadow-accent/20 rounded-full px-8 w-full"
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
                    <span className="font-code text-[8px] uppercase tracking-widest text-accent font-bold px-2 py-0.5 bg-accent/10 rounded-full">{qa.focus}</span>
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
                  className="bg-accent shadow-md shadow-accent/20 rounded-full px-8 w-full"
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
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Position Title</Label>
                <Input
                  value={ideaPosition.positionTitle}
                  onChange={(e) => setIdeaPosition((p) => p ? { ...p, positionTitle: e.target.value } : p)}
                  className="rounded-full font-headline font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Core Claim</Label>
                <Textarea
                  value={ideaPosition.statement}
                  onChange={(e) => setIdeaPosition((p) => p ? { ...p, statement: e.target.value } : p)}
                  className="min-h-[72px] italic"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Supporting Reasoning</Label>
                <Textarea
                  value={ideaPosition.description}
                  onChange={(e) => setIdeaPosition((p) => p ? { ...p, description: e.target.value } : p)}
                  className="min-h-[90px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Confidence (1–5)</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setIdeaPosition((p) => p ? { ...p, confidence: n } : p)}
                      className={cn(
                        'flex-1 h-9 rounded-full text-[11px] font-code font-bold uppercase tracking-wider transition-all border',
                        ideaPosition.confidence === n
                          ? 'bg-accent text-white border-accent shadow-md'
                          : 'bg-white text-muted-foreground border-border/60 hover:border-accent/40'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleSaveIdeaPosition}
                  className="bg-accent shadow-md shadow-accent/20 rounded-full px-8 w-full"
                >
                  Save Position
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete position?"
        description={`This removes "${deleteTarget?.title || 'this position'}" from Positions. Related sources, works, practices, and Evolution history will remain.`}
        confirmLabel="Delete Position"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          if (selectedId === deleteTarget.id) closeEntry();
          onDeleteEntry(deleteTarget.id);
          setDeleteTarget(null);
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
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{label}</div>
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
  onUpdateEntry: (entry: VaultEntry) => void;
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
        { date: today(), eventType: 'revised', description: 'Resolved a possible tension by refining this position.' },
      ],
      dateUpdated: today(),
    });
  };

  return (
    <Card className="mb-6 rounded-xl border-amber-200/60 bg-amber-50/60 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-code text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Possible Tension Detected</h2>
          <p className="mt-1 text-sm italic leading-5 text-muted-foreground">Decide whether this relationship is compatible, opposed, or needs refinement.</p>
        </div>
        <Badge variant="outline" className="rounded-full bg-white font-code text-[8px] uppercase tracking-widest">{tensionLinks.length} open</Badge>
      </div>
      <div className="space-y-3">
        {tensionLinks.map((link) => {
          const otherLabel = link.fromId === selected.id ? link.toLabel || link.toType : link.fromLabel || link.fromType;
          return (
            <div key={link.id} className="rounded-lg border border-amber-200/50 bg-white/80 p-3">
              <div className="mb-3 text-sm italic text-primary/80">
                {otherLabel} is currently marked as <span className="font-code text-[10px] uppercase tracking-widest text-amber-700">{link.type}</span>.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => updateLink(link, 'coheres', 'Reviewed and marked as not a contradiction.')} className="rounded-full bg-white">
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
    <>
      <Card className="hidden overflow-hidden rounded-xl border-border/60 bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Pressure</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Next Action</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const diagnostic = diagnostics.get(entry.id) || diagnosePosition(entry, links, practices);
              return (
              <TableRow key={entry.id} className="cursor-pointer" onClick={() => onOpen(entry.id)}>
                <TableCell>
                  <div className="font-headline text-base font-semibold italic">{entry.title}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{entry.statement || entry.description}</div>
                </TableCell>
                <TableCell className="font-code text-[10px] uppercase tracking-widest">{TYPE_LABELS[entry.type] || 'Position'}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{entry.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className={cn('size-2 rounded-full shadow-sm', n <= entry.confidence ? 'bg-accent' : 'bg-muted')} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">
                  {diagnostic.supportCount} support / {diagnostic.challengeCount} challenge / {diagnostic.practiceCount} tests
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{diagnostic.label}</Badge>
                    {diagnostic.flags.slice(0, 2).map((flag) => (
                      <Badge key={flag} variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">{flag}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="max-w-[260px] text-xs italic leading-5 text-muted-foreground">{diagnostic.nextAction}</TableCell>
                <TableCell className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{safePositionDate(entry.dateUpdated || entry.dateCreated)}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-3 md:hidden">
        {entries.map((entry) => (
          <button key={entry.id} onClick={() => onOpen(entry.id)} className="rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">{TYPE_LABELS[entry.type] || 'Position'}</div>
                <h3 className="mt-1 font-headline text-xl font-bold italic">{entry.title}</h3>
              </div>
              <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{entry.status}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-sm italic text-muted-foreground">{entry.statement || entry.description}</p>
            <div className="mt-3 rounded-lg border border-border/50 bg-muted/10 p-3">
              <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">
                {(diagnostics.get(entry.id) || diagnosePosition(entry, links, practices)).label}
              </Badge>
              <p className="mt-2 text-xs italic leading-5 text-muted-foreground">
                {(diagnostics.get(entry.id) || diagnosePosition(entry, links, practices)).nextAction}
              </p>
            </div>
            <div className="mt-4 flex justify-between font-code text-[9px] uppercase tracking-widest text-muted-foreground">
              <span>{entry.confidence}/5 confidence</span>
              <span>{(diagnostics.get(entry.id) || diagnosePosition(entry, links, practices)).supportCount} support</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function EvidencePanel({ title, items, onAdd }: { title: string; items: string[]; onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <Card className="p-5 bg-white border-border/40 shadow-sm rounded-xl">
      <h3 className="font-code text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-bold">{title}</h3>
      <div className="space-y-2 mb-3">{items.map((item, index) => <div key={`${item}-${index}`} className="rounded-lg bg-muted/30 p-3 text-sm italic shadow-sm border border-border/10 leading-relaxed text-primary/80">{item}</div>)}</div>
      <div className="flex gap-2"><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add evidence..." className="h-9 rounded-full" /><Button onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(''); } }} size="sm" className="h-9 px-4 rounded-full">Add</Button></div>
    </Card>
  );
}

function InfoPanel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Card className="p-5 bg-white border-border/40 shadow-sm rounded-xl">
      <h3 className="font-code text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-bold">{title}</h3>
      {items.length ? items.map((item) => (
        <div key={item} className="rounded-lg bg-muted/30 p-3 text-sm mb-2 italic shadow-sm border border-border/10 leading-relaxed text-primary/80">{item}</div>
      )) : (
        <p className="text-sm text-muted-foreground italic px-2 font-body">{empty}</p>
      )}
    </Card>
  );
}

function MiniMetricCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background p-4 shadow-sm">
      <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-headline text-2xl font-bold italic">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
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
    <Card className="p-5 bg-white border-border/40 shadow-sm rounded-xl">
      <h3 className="font-code text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-bold">{title}</h3>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => {
            const content = (
              <>
                <div className="font-headline text-base font-semibold italic text-primary">{item.title}</div>
                {item.meta ? <div className="mt-1 font-code text-[9px] uppercase tracking-widest text-muted-foreground">{item.meta}</div> : null}
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

function BeliefEditor({ open, onOpenChange, draft, setDraft, concepts, media, onAddConcept, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Partial<VaultEntry>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<VaultEntry>>>;
  concepts: Concept[];
  media: Media[];
  onAddConcept: (data: Partial<Concept>) => void;
  onSave: () => void;
}) {
  const toggleSource = (id: string) => {
    setDraft(prev => {
      const current = prev.sourceIds || [];
      const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
      return { ...prev, sourceIds: next };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto bg-white border-none shadow-2xl rounded-2xl">
        <DialogHeader><DialogTitle className="font-headline text-2xl italic">{draft.id ? 'Edit Position' : 'Form Position'}</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">TITLE</Label>
              <Input value={draft.title || ''} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="italic rounded-full" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">TYPE</Label>
              <Select value={draft.type || 'belief'} onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as VaultType }))}>
                <SelectTrigger className="h-10 border-border/60 bg-white shadow-sm rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>{vaultTypes.map((type) => <SelectItem key={type} value={type} className="font-code text-[10px] uppercase">{type.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">POSITION KIND</Label>
              <Select value={draft.positionKind || 'interpretive'} onValueChange={(value) => setDraft((prev) => ({ ...prev, positionKind: value as PositionKind }))}>
                <SelectTrigger className="h-10 border-border/60 bg-white shadow-sm rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>{positionKinds.map((kind) => <SelectItem key={kind.id} value={kind.id} className="font-code text-[10px] uppercase">{kind.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">STATE</Label>
              <Select value={draft.status || 'tentative'} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as VaultEntry['status'] }))}>
                <SelectTrigger className="h-10 border-border/60 bg-white shadow-sm rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>{positionStatuses.map((status) => <SelectItem key={status.id} value={status.id} className="font-code text-[10px] uppercase">{status.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONFIDENCE</Label>
              <Select value={String(draft.confidence || 3)} onValueChange={(value) => setDraft((prev) => ({ ...prev, confidence: Number(value) }))}>
                <SelectTrigger className="h-10 border-border/60 bg-white shadow-sm rounded-full font-code text-[10px] uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)} className="font-code text-[10px] uppercase">{value} - {confidenceLabel(value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">STATEMENT</Label>
            <Textarea value={draft.statement || ''} onChange={(event) => setDraft((prev) => ({ ...prev, statement: event.target.value, description: prev.description || event.target.value }))} placeholder="The core position in one clear sentence..." className="min-h-[60px] italic text-base" />
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">DESCRIPTION</Label>
            <Textarea value={draft.description || ''} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Elaborate on the reasoning, assumptions, or evidence..." className="min-h-[120px] italic text-base" />
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONFIDENCE REASONING</Label>
            <Textarea value={draft.confidenceReasoning || ''} onChange={(event) => setDraft((prev) => ({ ...prev, confidenceReasoning: event.target.value }))} placeholder="Why this confidence level rather than lower or higher?" className="min-h-[80px] italic text-base" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">ASSUMPTIONS</Label>
              <Textarea value={joinLines(draft.assumptions)} onChange={(event) => setDraft((prev) => ({ ...prev, assumptions: splitLines(event.target.value) }))} placeholder="One load-bearing assumption per line..." className="min-h-[110px] italic text-base" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">FALSIFICATION</Label>
              <Textarea value={draft.falsification || ''} onChange={(event) => setDraft((prev) => ({ ...prev, falsification: event.target.value }))} placeholder="What would weaken, overturn, or force revision?" className="min-h-[110px] italic text-base" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONSEQUENCES</Label>
              <Textarea value={joinLines(draft.consequences)} onChange={(event) => setDraft((prev) => ({ ...prev, consequences: splitLines(event.target.value) }))} placeholder="What follows if this is true? One consequence per line..." className="min-h-[110px] italic text-base" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">APPLICATIONS</Label>
              <Textarea value={joinLines(draft.applications)} onChange={(event) => setDraft((prev) => ({ ...prev, applications: splitLines(event.target.value) }))} placeholder="Where should this affect behavior, writing, practice, or decisions?" className="min-h-[110px] italic text-base" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONCEPT TAGS</Label>
            <ConceptTagPicker concepts={concepts} value={draft.tags || []} onChange={(tags) => setDraft((prev) => ({ ...prev, tags }))} onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })} />
          </div>
          
          <SourceLinker 
            media={media} 
            selectedIds={draft.sourceIds || []} 
            onToggle={toggleSource} 
            label="Supporting Sources"
          />
        </div>
        <DialogFooter className="pt-4"><Button onClick={onSave} className="bg-accent shadow-md shadow-accent/20 h-11 px-10 rounded-full font-bold">Save Position</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
