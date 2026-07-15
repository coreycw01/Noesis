
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Edit, LayoutGrid, Lightbulb, Loader2, Plus, ShieldCheck, Table2, Trash2, Triangle } from 'lucide-react';
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
import type { AiSuggestion, BeliefProfile, Concept, Draft, Media, PhilosophicalLink, Practice, Question, TimelineEvent, Unknown, VaultEntry, VaultType } from '@/lib/types';
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

type PositionViewFilter = 'all' | 'current' | 'emerging' | 'under_review' | 'revised' | 'abandoned' | 'tensions' | 'unsupported' | 'recently_changed';

const POSITION_VIEW_LABELS: Record<PositionViewFilter, string> = {
  all: 'All',
  current: 'Current',
  emerging: 'Emerging',
  under_review: 'Under Review',
  revised: 'Revised',
  abandoned: 'Abandoned',
  tensions: 'Tensions',
  unsupported: 'Unsupported',
  recently_changed: 'Recently Changed',
};

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

export function BeliefVault({ entries, media, drafts, practices, questions, timeline, concepts, links, beliefProfiles, unknowns, suggestions, onAddEntry, onUpdateEntry, onDeleteEntry, onAddConcept, onCreateLink, onAddDraft, onAddPractice, onAddQuestion, onCreateIdea, onAddUnknown, onUpdateSuggestion, onCreateSuggestion, onUpdateLink, onOpenSource, onOpenQuestion, onOpenPractice, onOpenWork, focusedEntryId, onFocusedEntryHandled, onOpenEntryRoute }: BeliefVaultProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | VaultType | 'ideas'>('all');
  const [viewFilter, setViewFilter] = useState<PositionViewFilter>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailTab, setDetailTab] = useState<'overview' | 'evidence' | 'relations' | 'history'>('overview');
  const [draftEntry, setDraftEntry] = useState<Partial<VaultEntry>>({ type: 'belief', title: '', statement: '', description: '', confidence: 3, status: 'active', tags: [] });
  const [conceptPopupName, setConceptPopupName] = useState<string | null>(null);
  const { toast } = useToast();

  // Idea pipeline state
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaStep, setIdeaStep] = useState<1 | 2 | 3>(1);
  const [ideaDraft, setIdeaDraft] = useState({ title: '', body: '' });
  const [ideaQA, setIdeaQA] = useState<Array<{ question: string; focus: string; answer: string }>>([]);
  const [ideaPosition, setIdeaPosition] = useState<{ positionTitle: string; statement: string; description: string; confidence: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stressTests, setStressTests] = useState<Array<{ kind: string; question: string }>>([]);
  const [stressAnswer, setStressAnswer] = useState('');

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
      toast({ title: 'Inquiries generated.', description: 'AI produced three clarifying questions for this idea.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'AI Unavailable', description: error instanceof Error ? error.message : 'Could not generate questions. Try again.' });
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
      toast({ title: 'Position draft ready.', description: 'AI formed a draft position from your idea and answers.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'AI Unavailable', description: error instanceof Error ? error.message : 'Could not form position. Try again.' });
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
  const selected = safeEntries.find((entry) => entry.id === selectedId) || null;
  const filteredEntries = safeEntries.filter(e => {
    const typeOk = typeFilter === 'all'
      ? true
      : typeFilter === 'ideas'
        ? e.createdFrom === 'idea'
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
      (viewFilter === 'current' && ['active', 'draft', 'uncertain'].includes(e.status)) ||
      (viewFilter === 'emerging' && (e.status === 'draft' || e.confidence <= 2)) ||
      (viewFilter === 'under_review' && ['challenged', 'uncertain', 'questioning'].includes(e.status)) ||
      (viewFilter === 'revised' && e.status === 'revised') ||
      (viewFilter === 'abandoned' && ['abandoned', 'rejected'].includes(e.status)) ||
      (viewFilter === 'tensions' && hasTension) ||
      (viewFilter === 'unsupported' && !hasSupport) ||
      (viewFilter === 'recently_changed' && changedAt >= recentCutoff);
    const haystack = `${e.title || ''} ${e.statement || ''} ${e.description || ''}`.toLowerCase();
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
      underReview: safeEntries.filter((entry) => ['challenged', 'uncertain', 'questioning'].includes(entry.status)).length,
      unsupported: safeEntries.filter((entry) => !(entry.evidenceFor || []).length && !(entry.sourceIds || []).length).length,
      tensions: tensionCount,
    };
  }, [safeEntries, links]);

  const clearPositionFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setViewFilter('all');
  };

  const positionFiltersActive = Boolean(search || typeFilter !== 'all' || viewFilter !== 'all');

  const openEditor = (entry?: VaultEntry) => {
    setDraftEntry(entry ? { ...entry } : { type: 'belief', title: '', statement: '', description: '', confidence: 3, status: 'active', tags: [] });
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
    const pairs: Array<{ a: VaultEntry; b: VaultEntry; sharedTags: string[] }> = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const tagsA = (active[i].tags || []).map((t) => t.toLowerCase());
        const tagsB = (active[j].tags || []).map((t) => t.toLowerCase());
        const shared = tagsA.filter((t) => tagsB.includes(t));
        if (shared.length > 0 && active[i].id !== active[j].id) {
          pairs.push({ a: active[i], b: active[j], sharedTags: shared });
        }
      }
    }
    return pairs.slice(0, 3);
  }, [safeEntries]);

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
    const firstLinkedSource = linkedSources[0];
    const strongestObjection = tensionLinks[0]?.note || selected.evidenceAgainst?.[0] || 'No direct objection has been articulated yet.';
    const strongestSupport = selected.evidenceFor?.[0] || linkedSources[0]?.title || 'No direct support has been recorded yet.';
    const latestRevision = [...(selected.versionHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const reviewTabs: Array<{ id: 'overview' | 'evidence' | 'relations' | 'history'; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'relations', label: 'Relations' },
      { id: 'history', label: 'History' },
    ];

    const createMissingPerspective = async () => {
      try {
        const result = await aiClient.detectMissingPerspectives({
          targetType: 'position',
          targetTitle: selected.title,
          content: `${selected.title}\n${selected.statement}\n${selected.description || ''}`,
          sourceTitles: linkedSources.map((item) => item.title),
          conceptTags: selected.tags || [],
          existingPerspectiveCoverage: typedLinks.map((item) => item.type),
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
        toast({ variant: 'destructive', title: 'AI Unavailable', description: error instanceof Error ? error.message : 'Noesis could not suggest perspectives right now.' });
      }
    };

    const createMissingQuestions = async () => {
      try {
        const result = await aiClient.detectMissingQuestions({
          concepts: selected.tags || [],
          positions: [selected.statement || selected.title],
          unknowns: linkedUnknowns.map((item) => item.title),
          inquiries: questions.filter((item) => (item.beliefIds || []).includes(selected.id)).map((item) => item.text),
          contradictions: tensionLinks.map((item) => item.note || `${item.fromLabel || item.fromId} ${item.type} ${item.toLabel || item.toId}`),
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
        toast({ variant: 'destructive', title: 'AI Unavailable', description: error instanceof Error ? error.message : 'Noesis could not detect missing questions right now.' });
      }
    };

    const createStressTests = async () => {
      try {
        const result = await aiClient.generateStressTest({
          targetType: 'position',
          title: selected.title,
          content: `${selected.statement}\n${selected.description || ''}`,
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
        toast({ variant: 'destructive', title: 'AI Unavailable', description: error instanceof Error ? error.message : 'Noesis could not generate stress tests right now.' });
      }
    };

    const saveStressAnswer = () => {
      if (!stressAnswer.trim()) return;
      onUpdateEntry({
        ...selected,
        testingCount: (selected.testingCount || 0) + 1,
        versionHistory: [
          ...(selected.versionHistory || []),
          { date: today(), eventType: 'challenged', description: `Stress test answered: ${stressAnswer.trim()}` },
        ],
        dateUpdated: today(),
      });
      setStressAnswer('');
      toast({ title: 'Stress test recorded', description: 'The answer has been added to this position history.' });
    };

    return (
      <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-5xl mx-auto w-full font-body">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={closeEntry} className="h-8 font-code text-[10px] uppercase tracking-widest rounded-full"><ArrowLeft className="size-4 mr-2" /> Positions</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openEditor(selected)} className="h-8 bg-white border-border/60 shadow-sm rounded-full"><Edit className="size-4 mr-2" /> Edit</Button>
            <Button variant="destructive" onClick={() => { onDeleteEntry(selected.id); closeEntry(); }} className="h-8 shadow-sm rounded-full"><Trash2 className="size-4 mr-2" /> Delete</Button>
          </div>
        </div>

        <Card className="p-6 mb-6 bg-white border-border/50 shadow-sm rounded-xl">
          <Badge variant="outline" className="mb-3 font-code uppercase bg-white border-border/60 shadow-sm rounded-full">{(selected.type || 'belief').replace('_', ' ')}</Badge>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-headline text-4xl font-bold mb-3">{selected.title}</h1>
              <p className="font-body text-lg italic text-primary/80 mb-4">{selected.statement || selected.description}</p>
            </div>
            <div className="grid min-w-[220px] gap-2 rounded-xl border border-border/50 bg-muted/10 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-code uppercase tracking-widest text-muted-foreground">Confidence</span>
                <span className="font-headline text-lg font-semibold italic">{selected.confidence}/5</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-code uppercase tracking-widest text-muted-foreground">Support</span>
                <span className="font-headline text-lg font-semibold italic">{(selected.evidenceFor || []).length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-code uppercase tracking-widest text-muted-foreground">Challenge</span>
                <span className="font-headline text-lg font-semibold italic">{(selected.evidenceAgainst || []).length + tensionLinks.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-code uppercase tracking-widest text-muted-foreground">Practices</span>
                <span className="font-headline text-lg font-semibold italic">{linkedPractices.length}</span>
              </div>
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
                onClick: onOpenSource ? () => onOpenSource(item.id) : undefined,
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
                onClick: onOpenQuestion ? () => onOpenQuestion(item.id) : undefined,
              }))}
            />
            <EntityListPanel
              title="Works Expressing It"
              empty="No works are carrying this position yet."
              items={linkedDrafts.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.type.replace(/_/g, ' ')} • ${item.status}`,
                onClick: onOpenWork ? () => onOpenWork(item.id) : undefined,
              }))}
            />
            <EntityListPanel
              title="Practices Testing It"
              empty="No practices are testing this belief yet."
              items={linkedPractices.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${item.type.replace(/_/g, ' ')} • ${item.status}`,
                onClick: onOpenPractice ? () => onOpenPractice(item.id) : undefined,
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{suggestion.suggestionType.replace(/_/g, ' ')}</Badge>
                        {typeof suggestion.confidence === 'number' && (
                          <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{Math.round(suggestion.confidence * 100)}% confidence</Badge>
                        )}
                      </div>
                      <h4 className="mt-2 font-headline text-lg font-bold italic">{suggestion.title}</h4>
                      {suggestion.description && <p className="mt-1 text-sm text-muted-foreground">{suggestion.description}</p>}
                      {suggestion.reasoning && <p className="mt-2 text-sm italic text-foreground/80">{suggestion.reasoning}</p>}
                      {!!suggestion.evidence?.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestion.evidence.map((item) => <Badge key={item} variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">{item}</Badge>)}
                        </div>
                      )}
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
                            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onUpdateSuggestion({ ...suggestion, status: 'dismissed', dateUpdated: new Date().toISOString() })}>
                              Dismiss
                            </Button>
                          </>
                        )}
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
    <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-7xl mx-auto w-full font-body">
      <PageHeader
        title="Positions"
        description="State what you currently believe, what you are testing, and what evidence supports or challenges each position."
        actions={
          <>
            <PositionStat label="Total" value={positionStats.total} />
            <PositionStat label="Review" value={positionStats.underReview} />
            <PositionStat label="Unsupported" value={positionStats.unsupported} />
            <PositionStat label="Tensions" value={positionStats.tensions} />
            <Button variant="outline" onClick={openIdeaDialog} size="sm" className="bg-white border-border/60 shadow-sm rounded-full h-9 font-bold">
              <Lightbulb className="size-4 mr-1.5" /> NEW IDEA
            </Button>
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
        onClear={clearPositionFilters}
        clearDisabled={!positionFiltersActive}
        className="mb-8"
      >
        <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as PositionViewFilter)}>
          <SelectTrigger className="w-52 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60">
            <SelectValue placeholder="Position View" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(POSITION_VIEW_LABELS) as PositionViewFilter[]).map((value) => (
              <SelectItem key={value} value={value} className="font-code text-[10px] uppercase">{POSITION_VIEW_LABELS[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as VaultType | 'ideas' | 'all')}>
          <SelectTrigger className="w-52 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60">
            <SelectValue placeholder="Position Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-code text-[10px] uppercase">All Types</SelectItem>
            {vaultTypes.map((type) => (
              <SelectItem key={type} value={type} className="font-code text-[10px] uppercase">{TYPE_LABELS[type]}</SelectItem>
            ))}
            <SelectItem value="ideas" className="font-code text-[10px] uppercase">Ideas</SelectItem>
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

      {tensions.length > 0 && (
        <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-code text-[10px] uppercase tracking-[0.2em] text-foreground font-bold">Possible Tensions Detected</h3>
          </div>
          <div className="space-y-3">
            {tensions.map(({ a, b, sharedTags }) => (
              <div key={`${a.id}-${b.id}`} className="rounded-lg border border-border bg-background p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-body">
                  <button onClick={() => openEntry(a.id)} className="font-headline text-base font-bold italic text-foreground hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded-sm">
                    {a.title}
                  </button>
                  <span className="font-code text-[9px] uppercase tracking-widest text-muted-foreground self-center">shares concept</span>
                  <span className="font-code text-[9px] bg-accent/10 text-accent rounded-full px-2.5 py-1 self-center border border-accent/20 font-bold">{sharedTags[0]}</span>
                  <span className="font-code text-[9px] uppercase tracking-widest text-muted-foreground self-center">with</span>
                  <button onClick={() => openEntry(b.id)} className="font-headline text-base font-bold italic text-foreground hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded-sm">
                    {b.title}
                  </button>
                </div>
                <p className="mt-3 text-sm text-foreground/80 font-body italic leading-6">Examine whether these positions contradict, refine, or complement each other.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <PositionsTable entries={filteredEntries} onOpen={openEntry} />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEntries.map((entry) => (
          <Card 
            key={entry.id} 
            className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-accent/20 bg-white/95 p-5 rounded-xl shadow-md" 
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
        ))}
        {filteredEntries.length === 0 && (
          <div className="col-span-full">
            <PageEmptyState
              icon={ShieldCheck}
              title="No positions found"
              description="Refine your search or turn an idea into something you are willing to examine."
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

      <BeliefEditor open={editorOpen} onOpenChange={setEditorOpen} draft={draftEntry} setDraft={setDraftEntry} concepts={concepts} media={media} onAddConcept={onAddConcept} onSave={saveEntry} />

      {/* Idea → Position pipeline dialog */}
      <Dialog open={ideaOpen} onOpenChange={(open) => { if (!open) setIdeaOpen(false); }}>
        <DialogContent className="max-w-xl bg-white border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {[1, 2, 3].map((n) => (
                <div key={n} className={cn('h-1 flex-1 rounded-full transition-all', ideaStep >= n ? 'bg-accent' : 'bg-muted/30')} />
              ))}
            </div>
            <DialogTitle className="font-headline text-2xl italic">
              {ideaStep === 1 && 'Write Your Idea'}
              {ideaStep === 2 && 'Sharpen It'}
              {ideaStep === 3 && 'Review Your Position'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-body">
              {ideaStep === 1 && 'Capture the thought. AI will ask 3 questions to turn it into a position.'}
              {ideaStep === 2 && 'Answer each question to clarify the claim you are willing to own.'}
              {ideaStep === 3 && 'Edit and save the position AI formed from your idea and answers.'}
            </p>
          </DialogHeader>

          {ideaStep === 1 && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="font-code text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Idea Statement</Label>
                <Input
                  value={ideaDraft.title}
                  onChange={(e) => setIdeaDraft((p) => ({ ...p, title: e.target.value }))}
                  placeholder="State the idea briefly..."
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
                <p className="text-xs text-muted-foreground font-code uppercase tracking-widest mb-1 font-bold">Your Idea</p>
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
    </div>
  );
}

function PositionStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-2 text-right shadow-sm">
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{label}</div>
      <div className="font-headline text-xl font-bold italic leading-none text-primary">{value}</div>
    </div>
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

function PositionsTable({ entries, onOpen }: { entries: VaultEntry[]; onOpen: (id: string) => void }) {
  if (!entries.length) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
        <ShieldCheck className="size-20 mb-6 text-muted-foreground" />
        <h2 className="text-2xl font-headline italic mb-2">No positions found</h2>
        <p className="max-w-md font-body">Refine your search or turn an idea into something you are willing to examine.</p>
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
              <TableHead>Sources</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
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
                <TableCell className="font-code text-xs">{(entry.sourceIds || []).length}</TableCell>
                <TableCell className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{safePositionDate(entry.dateUpdated || entry.dateCreated)}</TableCell>
              </TableRow>
            ))}
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
            <div className="mt-4 flex justify-between font-code text-[9px] uppercase tracking-widest text-muted-foreground">
              <span>{entry.confidence}/5 confidence</span>
              <span>{(entry.sourceIds || []).length} sources</span>
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
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">STATEMENT</Label>
            <Textarea value={draft.statement || ''} onChange={(event) => setDraft((prev) => ({ ...prev, statement: event.target.value, description: prev.description || event.target.value }))} placeholder="The core position in one clear sentence..." className="min-h-[60px] italic text-base" />
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">DESCRIPTION</Label>
            <Textarea value={draft.description || ''} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Elaborate on the reasoning, assumptions, or evidence..." className="min-h-[120px] italic text-base" />
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
