"use client";

import React, { useMemo, useRef, useState } from 'react';
import { writeBrowserPreference } from '@/lib/browser-preferences';
import { recordDateKey } from '@/lib/calendar';
import { evidenceBalance, positionReviewCue, resolvePositionGrounds } from '@/lib/position-grounds';
import { useToast } from '@/hooks/use-toast';
import { useLocalDay } from '@/hooks/use-local-day';
import { deriveWorkspaceAttention } from '@/lib/workspace-attention';
import { deriveGoalProgress, goalCategories, goalItems, goalMeasureLabel } from '@/lib/goal-progress';
import {
  ArrowRight,
  AlertTriangle,
  ChevronRight,
  Compass,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageEmptyState } from '@/components/shared/PageState';
import { Progress } from '@/components/ui/progress';
import { allAnnotations } from '@/lib/readex';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';
import { iconForNoesisView, NOESIS_SOLID_DESK_ICONS } from '@/lib/noesis-icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isRepeatablePractice } from '@/lib/workflow-integrity';

const { annotation: ClipboardCheck, concept: Lightbulb } = NOESIS_SOLID_DESK_ICONS;
import type {
  Concept,
  Draft,
  GoalSettings,
  Media,
  MediaType,
  PhilosophicalLink,
  Practice,
  Question,
  Unknown,
  UserProfile,
  VaultEntry,
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';
import { NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';
import type { HomeHistoryTarget } from '@/lib/home-history';
import { thinkingHistoryDate } from '@/lib/evolution-history';
import { PositionsUnderHeat, PraxisCheckIn, positionHeat } from '@/components/Home/TodayInstruments';
import { PraxisDeskTabs } from '@/components/Home/PraxisDeskTabs';
import { DeskThoughtStarter, type DeskThoughtKind } from '@/components/Home/DeskThoughtStarter';

type HomeTarget = HomeHistoryTarget;

type DeskItem = HomeTarget & {
  id: string;
  label: string;
  eyebrow: string;
  reason: string;
  action: string;
  priority: number;
  kind: 'position' | 'inquiry' | 'work' | 'source' | 'practice' | 'concept';
};

interface ThinkingDeskProps {
  aiEnabled: boolean;
  profile: UserProfile;
  concepts: Concept[];
  media: Media[];
  inquiries: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  unknowns: Unknown[];
  links: PhilosophicalLink[];
  goal: GoalSettings;
  showCommitments: boolean;
  goalProgress: Partial<Record<MediaType, number>>;
  onNavigate: (target: HomeTarget) => void;
  onCreateInquiry: (data: Partial<Question>) => Promise<Question>;
  onCreateWork: (data: Partial<Draft>) => Promise<Draft>;
  onCreatePosition: (data: Partial<VaultEntry>) => Promise<VaultEntry>;
  onCreateConcept: (data: Partial<Concept>) => Promise<boolean>;
  onCreatePractice: (data: Partial<Practice>) => Promise<Practice>;
  onUpdatePractice: (practice: Practice) => void | Promise<Practice | void>;
}

function recentDate(value?: unknown) {
  const time = thinkingHistoryDate(value);
  return Number.isFinite(time) ? time : 0;
}

function uniqueDeskItems(items: DeskItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.view}:${item.targetId || item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ThinkingDesk({
  aiEnabled,
  concepts,
  media,
  inquiries,
  positions,
  works,
  practices,
  unknowns,
  links,
  goal,
  showCommitments,
  goalProgress,
  onNavigate,
  onCreateInquiry,
  onCreateWork,
  onCreatePosition,
  onCreateConcept,
  onCreatePractice,
  onUpdatePractice,
}: ThinkingDeskProps) {
  const day = useLocalDay();
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [provocationAngle, setProvocationAngle] = useState(0);
  const [briefAnswer, setBriefAnswer] = useState('');
  const [creatingInquiry, setCreatingInquiry] = useState(false);
  const inquiryCreationLock = useRef(false);
  const { toast } = useToast();
  const [irrelevantReason, setIrrelevantReason] = useState('');
  const [provocationDismissed, setProvocationDismissed] = useState(false);
  const annotations = useMemo(() => allAnnotations(media), [media]);
  const attention = useMemo(() => deriveWorkspaceAttention({
    annotations, positions, inquiries, practices, now: new Date(`${day}T12:00:00`),
  }), [annotations, day, positions, inquiries, practices]);

  const currentThemes = useMemo(() => {
    const terms = new Map<string, number>();
    [...positions.flatMap((item) => item.tags || []), ...media.flatMap((item) => item.tags || []), ...works.flatMap((item) => item.conceptTags || [])]
      .filter(Boolean)
      .forEach((term) => terms.set(term, (terms.get(term) || 0) + 1));
    return Array.from(terms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([term]) => term);
  }, [media, positions, works]);
  const activeGoalRows = useMemo(() => {
    const categories = goalCategories(goal);
    const activeGoals = goalItems(goal, categories)
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return activeGoals.slice(0, 3).map((item) => {
      const category = categories.find((goalType) => goalType.id === item.typeId);
      const progress = deriveGoalProgress(item, category, { concepts, inquiries, sources: media, positions, works, practices }, goalProgress);
      return {
        id: item.id,
        label: item.title || category?.name || 'Untitled goal',
        measure: goalMeasureLabel(item, category),
        done: progress.currentProgress,
        target: progress.targetProgress,
        percent: progress.percent,
      };
    });
  }, [concepts, goal, goalProgress, inquiries, media, positions, practices, works]);

  const heat = useMemo(() => positionHeat(positions, links), [positions, links]);
  const judgment = useMemo(() => {
    const items: DeskItem[] = [];
    const dayMs = 86_400_000;
    const daysSince = (value: string) => {
      const date = recordDateKey(value);
      return date ? Math.round((Date.parse(day) - Date.parse(date)) / dayMs) : 0;
    };
    for (const item of attention.currentPositions) {
      const { supportCount, challengeCount } = resolvePositionGrounds(item, links);
      const confidence = Math.round(item.confidence);
      const cue = positionReviewCue(confidence, supportCount, challengeCount);
      if (!cue) continue;
      const gap = supportCount && challengeCount ? confidence - evidenceBalance(supportCount, challengeCount)! : undefined;
      items.push({
        id: `position-${item.id}`, label: item.title || item.statement, kind: 'position', view: 'vault', targetId: item.id,
        eyebrow: gap !== undefined ? 'Confidence mismatch' : 'Position needs grounds',
        reason: gap !== undefined
          ? `Your confidence is ${confidence}%, ${Math.abs(gap)} points ${gap > 0 ? 'above' : 'below'} the balance of recorded evidence.`
          : `Your confidence is ${confidence}%. ${!supportCount && !challengeCount ? 'No support or challenge is recorded.' : !supportCount ? 'There is a challenge but no recorded support.' : 'There is support but no recorded challenge.'}`,
        action: gap !== undefined ? 'Review confidence' : cue,
        priority: gap !== undefined ? 90 + Math.min(20, Math.abs(gap)) : 62 + confidence / 5,
      });
    }
    for (const inquiry of attention.openInquiries) {
      const age = daysSince(inquiry.dateUpdated || inquiry.dateCreated);
      const hasAnswer = Boolean(inquiry.answer?.trim());
      items.push({
        id: `inquiry-${inquiry.id}`, label: inquiry.text, kind: 'inquiry', view: 'questions', targetId: inquiry.id,
        eyebrow: age >= 14 ? 'Inquiry gone quiet' : 'Open inquiry',
        reason: [
          age >= 14 ? `No recorded update in ${age} days.` : '',
          hasAnswer ? 'A working answer is saved. Check it against the evidence.' : 'No working answer is recorded. Consider what evidence would move it forward.',
        ].filter(Boolean).join(' '),
        action: hasAnswer ? 'Review answer' : 'Investigate',
        priority: age >= 14 ? 80 + Math.min(15, age / 4) : 58,
      });
    }
    for (const work of works) {
      if (['complete', 'final', 'published', 'archived', 'abandoned'].includes(work.status)) continue;
      const revisionDays = new Set((work.versionHistory || []).map(revision => recordDateKey(revision.createdAt))
        .filter(date => date && date <= day && daysSince(date) <= 14));
      const age = daysSince(work.dateUpdated || work.dateCreated);
      const revisited = revisionDays.size >= 2;
      if (age < 14 && !revisited) continue;
      items.push({
        id: `work-${work.id}`, label: work.title, kind: 'work', view: 'writing', targetId: work.id,
        eyebrow: revisited ? 'Work you keep returning to' : 'Draft gone quiet',
        reason: revisited ? `You saved revisions on ${revisionDays.size} different days in the last two weeks. Review what still needs to change.` : `This draft is unfinished and hasn’t been updated in ${age} days.`,
        action: revisited ? 'Review draft' : 'Reopen draft',
        priority: revisited ? 96 + Math.min(8, revisionDays.size) : 76 + Math.min(14, age / 5),
      });
    }
    for (const source of media) {
      const reflection = source.capture?.after;
      if (source.status !== 'Finished' || reflection?.coreArgument?.trim() || reflection?.beliefChange?.trim()) continue;
      items.push({
        id: `source-${source.id}`, label: source.title, kind: 'source', view: 'library', targetId: source.id,
        eyebrow: 'Finished source without reflection', reason: 'You finished this source without recording its main argument or how it changed your thinking.',
        action: 'Reflect on source', priority: 71,
      });
    }
    for (const practice of attention.unanchoredPractices) {
      items.push({
        id: `praxis-${practice.id}`, label: practice.title, kind: 'practice', view: 'labs', targetId: practice.id,
        eyebrow: 'Praxis without a starting point', reason: 'This has no recorded starting reason or linked idea to test.',
        action: 'Review its purpose', priority: 69,
      });
    }
    for (const concept of concepts) {
      if (concept.description?.trim() && concept.philosophyStatus !== 'undefined') continue;
      items.push({
        id: `concept-${concept.id}`, label: concept.name, kind: 'concept', view: 'concepts', targetId: concept.id,
        eyebrow: 'Concept without a working definition', reason: 'Put what this term means to you in your own words.',
        action: 'Clarify concept', priority: 60,
      });
    }
    const ranked = uniqueDeskItems(items.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label)));
    const seen = new Set<NoesisView>();
    const diverse = ranked.filter(item => {
      if (seen.has(item.view)) return false;
      seen.add(item.view);
      return true;
    });
    return uniqueDeskItems([...diverse, ...ranked]).slice(0, 3);
  }, [attention, concepts, day, links, media, works]);

  const provocation = useMemo(() => {
    const untested = attention.untestedPositions[0];
    if (untested && provocationAngle === 0) {
      return {
        question: `What would it look like to test "${untested.title || untested.statement}" in behavior this week?`,
        target: { view: 'labs' as NoesisView },
        evidence: 'Based on a position with no linked practice or lived test.',
      };
    }
    const angles = [
      {
        question: 'Which idea in your system deserves to be tested in practice instead of only refined in thought?',
        target: { view: 'labs' as NoesisView },
        evidence: 'Based on the gap between positions and linked practices.',
      },
      {
        question: 'What belief would become weaker if you required one serious opposing source?',
        target: { view: 'vault' as NoesisView },
        evidence: 'Based on positions with limited recorded challenge.',
      },
      {
        question: 'Which open question is actually waiting for a definition, not more information?',
        target: { view: 'questions' as NoesisView },
        evidence: 'Based on open inquiries and undefined concepts.',
      },
    ];
    const unsupported = attention.currentPositions.find((item) => (item.evidenceAgainst || []).length === 0);
    if (unsupported && provocationAngle === 0) {
      return {
        question: `What would make your position "${unsupported.title || unsupported.statement}" less convincing?`,
        target: { view: 'vault' as NoesisView, targetId: unsupported.id },
        evidence: 'Based on a position with no recorded challenging evidence.',
      };
    }
    const openInquiry = attention.openInquiries[0];
    if (openInquiry && provocationAngle <= 1) {
      return {
        question: `What evidence would count as real progress on "${openInquiry.text}"?`,
        target: { view: 'questions' as NoesisView, targetId: openInquiry.id },
        evidence: openInquiry.answer?.trim() ? 'Based on an open inquiry with a working answer to revisit.' : 'Based on an open inquiry without a working answer.',
      };
    }
    return angles[provocationAngle % angles.length];
  }, [attention, provocationAngle]);

  const openThreads = useMemo(() => {
    const latest = <T extends { dateUpdated?: string }>(items: T[]) => items.sort((a, b) => recentDate(b.dateUpdated) - recentDate(a.dateUpdated))[0];
    const source = latest(media.filter(item => item.status === 'Consuming'));
    const inquiry = latest([...attention.openInquiries]);
    const work = latest(works.filter(item => !['complete', 'final', 'published', 'archived', 'abandoned'].includes(item.status)));
    return [
      source && { label: 'Consuming', title: source.title, detail: source.creator, view: 'library' as const, targetId: source.id, tone: 'source' },
      inquiry && { label: 'Examining', title: inquiry.text, detail: inquiry.status.replaceAll('_', ' '), view: 'questions' as const, targetId: inquiry.id, tone: 'inquiry' },
      work && { label: 'Creating', title: work.title, detail: work.status.replaceAll('_', ' '), view: 'writing' as const, targetId: work.id, tone: 'work' },
    ] as const;
  }, [attention.openInquiries, media, works]);

  async function capture(kind: DeskThoughtKind, text: string, customTitle: string) {
    const title = customTitle || text.split(/\r?\n/, 1)[0].trim().slice(0, 80);
    switch (kind) {
      case 'inquiry': {
        const inquiry = await onCreateInquiry({ text, status: 'open' });
        onNavigate({ view: 'questions', targetId: inquiry.id });
        break;
      }
      case 'position': {
        const position = await onCreatePosition({ title, statement: text });
        onNavigate({ view: 'vault', targetId: position.id });
        break;
      }
      case 'concept': {
        if (!await onCreateConcept({ name: title, description: text })) throw new Error('Concept not saved');
        onNavigate({ view: 'concepts' });
        break;
      }
      case 'experiment': {
        const experiment = await onCreatePractice({ title, hypothesis: text, type: 'experiment', status: 'planned' });
        onNavigate({ view: 'labs', targetId: experiment.id });
        break;
      }
      case 'work': {
        const content = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\r?\n/g, '<br>');
        const work = await onCreateWork({ title, body: text, draftContent: `<p>${content}</p>`, type: 'text_note', status: 'drafting' });
        onNavigate({ view: 'writing', targetId: work.id });
        break;
      }
    }
  }

  const workspaceSnapshot = useMemo(() => {
    const openInquiries = attention.metrics.openInquiries;
    const unprocessedAnnotations = attention.metrics.rawAnnotations;
    const undefinedConcepts = concepts.filter((item) => !item.description?.trim() || item.philosophyStatus === 'undefined').length;
    const positionsNeedingEvidence = attention.metrics.unsupportedPositions;
    const activeWorks = works.filter((item) => !['final', 'complete', 'completed', 'published', 'archived', 'abandoned'].includes(item.status)).length;
    const activePractices = practices.filter((item) => item.status === 'active' && isRepeatablePractice(item.type)).length;
    const activeSources = media.filter((item) => ['Consuming', 'Want to Read', 'Paused'].includes(item.status)).length;
    const openUnknowns = unknowns.filter((item) => item.status === 'active' || item.status === 'exploring').length;

    return [
      { label: 'Sources in motion', value: activeSources, view: 'library', icon: 'source' },
      { label: 'Annotations to process', value: unprocessedAnnotations, view: 'annotations', icon: 'annotation' },
      { label: 'Concepts to define', value: undefinedConcepts, view: 'concepts', icon: 'concept' },
      { label: 'Active inquiries', value: openInquiries, view: 'questions', icon: 'inquiry' },
      { label: 'Positions needing evidence', value: positionsNeedingEvidence, view: 'vault', icon: 'position' },
      { label: 'Works in progress', value: activeWorks, view: 'writing', icon: 'work' },
      { label: 'Active practices', value: activePractices, view: 'labs', icon: 'practice' },
      { label: 'Open unknowns', value: openUnknowns, view: 'profile', icon: 'unknown' },
    ] as const;
  }, [attention, concepts, media, practices, unknowns, works]);

  const hasWorkspace = media.length + concepts.length + inquiries.length + positions.length + works.length + practices.length > 0;

  const previewOrNavigate = (
    target: HomeTarget,
    fallback?: {
      label?: string;
      description?: string;
      reason?: string;
      section?: string;
      state?: string;
      stage?: 'Encounter' | 'Capture' | 'Interpret' | 'Question' | 'Judge' | 'Express' | 'Test' | 'Revise' | 'Understand' | 'Navigate' | 'Configure';
    }
  ) => {
    if (!target.targetId) {
      onNavigate(target);
      return;
    }

    if (target.view === 'vault') {
      const position = positions.find((item) => item.id === target.targetId);
      if (position) {
        openNoesisObjectPreview({
          id: `home-position-${position.id}`,
          label: position.title || position.statement,
          section: 'Position',
          description: fallback?.description || position.status || 'Open position workbench.',
          view: 'vault',
          targetId: position.id,
          targetType: 'position',
          objectType: 'Judgment Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Judge',
          hierarchyLevel: 'Judgment',
          currentState: position.status,
          summary: position.statement || position.description || fallback?.reason || 'A position needing attention.',
          matchedBecause: fallback?.reason || 'Home selected this position as an unfinished intellectual edge.',
          connectedConcepts: position.tags || [],
          relatedObjects: [
            `${position.sourceIds?.length || 0} sources`,
            `${(position.evidenceFor || []).length} supports`,
            `${(position.evidenceAgainst || []).length} challenges`,
            `${practices.filter((practice) => (practice.positionIds || []).includes(position.id)).length} practices`,
          ],
          lastChangedAt: position.dateUpdated || position.dateCreated,
          quickActionLabel: fallback?.label || 'Open Position',
          quickActions: [
            { label: 'Open Position Workbench', view: 'vault', targetId: position.id, targetType: 'position' },
            { label: 'View Evolution', view: 'evolution' },
          ],
          thinkingEventHint: 'Previewing a position is orientation. Support, challenge, confidence changes, stress tests, abandonment, and revision should create events.',
        });
        return;
      }
    }

    if (target.view === 'questions') {
      const inquiry = inquiries.find((item) => item.id === target.targetId);
      if (inquiry) {
        openNoesisObjectPreview({
          id: `home-inquiry-${inquiry.id}`,
          label: inquiry.text,
          section: 'Inquiry',
          description: fallback?.description || inquiry.status || 'Open inquiry workspace.',
          view: 'questions',
          targetId: inquiry.id,
          targetType: 'inquiry',
          objectType: 'Interpretive Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Question',
          hierarchyLevel: 'Interpretive',
          currentState: inquiry.status,
          summary: inquiry.answer || fallback?.reason || 'An inquiry needing development.',
          matchedBecause: fallback?.reason || 'Home selected this inquiry as an open investigation.',
          connectedConcepts: concepts.filter((concept) => inquiry.conceptIds?.includes(concept.id)).map((concept) => concept.name),
          relatedObjects: [
            `${inquiry.sourceIds?.length || 0} sources`,
            `${inquiry.beliefIds?.length || 0} positions`,
            `${inquiry.draftIds?.length || 0} works`,
          ],
          lastChangedAt: inquiry.dateUpdated || inquiry.dateCreated,
          quickActionLabel: fallback?.label || 'Open Inquiry',
          quickActions: [
            { label: 'Open Investigation', view: 'questions', targetId: inquiry.id, targetType: 'inquiry' },
            { label: 'Open Positions', view: 'vault' },
          ],
          thinkingEventHint: 'Previewing an inquiry is orientation. Reformulating, adding assumptions, resolving, or promoting it should create history.',
        });
        return;
      }
    }

    if (target.view === 'library') {
      const source = media.find((item) => item.id === target.targetId);
      if (source) {
        openNoesisObjectPreview({
          id: `home-source-${source.id}`,
          label: source.title,
          section: 'Source',
          description: fallback?.description || source.creator || source.type || 'Open source workspace.',
          view: 'library',
          targetId: source.id,
          targetType: 'source',
          objectType: 'Raw Input',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Encounter',
          hierarchyLevel: 'Raw',
          currentState: source.status,
          summary: source.description || source.capture?.after?.coreArgument || source.capture?.before?.openQuestion || fallback?.reason || 'A source needing reflection.',
          matchedBecause: fallback?.reason || 'Home selected this source as a source-work item.',
          connectedConcepts: source.tags || [],
          relatedObjects: [
            `${source.annotations?.length || 0} annotations`,
            `${positions.filter((position) => (position.sourceIds || []).includes(source.id)).length} positions influenced`,
            `${works.filter((work) => (work.sourceIds || []).includes(source.id)).length} works linked`,
          ],
          lastChangedAt: source.dateUpdated || source.dateAdded,
          quickActionLabel: fallback?.label || 'Open Source',
          quickActions: [
            { label: 'Open Source Workspace', view: 'library', targetId: source.id, targetType: 'source' },
            { label: 'Process Annotations', view: 'annotations' },
          ],
          thinkingEventHint: 'Previewing a source is orientation. Completing reflection, distilling a claim, or creating annotations should record intellectual development.',
        });
        return;
      }
    }

    if (target.view === 'writing') {
      const work = works.find((item) => item.id === target.targetId);
      if (work) {
        openNoesisObjectPreview({
          id: `home-work-${work.id}`,
          label: work.title,
          section: 'Work',
          description: fallback?.description || `${work.type.replace(/_/g, ' ')} - ${work.status}`,
          view: 'writing',
          targetId: work.id,
          targetType: 'work',
          objectType: 'Expression Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Express',
          hierarchyLevel: 'Expression',
          currentState: work.status,
          summary: work.body || work.draftContent || fallback?.reason || 'A work needing continuation.',
          matchedBecause: fallback?.reason || 'Home selected this work as unfinished expression.',
          connectedConcepts: work.conceptTags || [],
          relatedObjects: [
            `${work.sourceIds?.length || 0} sources`,
            `${work.questionIds?.length || 0} inquiries`,
            `${work.beliefIds?.length || 0} positions`,
          ],
          lastChangedAt: work.dateUpdated || work.dateCreated,
          quickActionLabel: fallback?.label || 'Open Work',
          quickActions: [
            { label: 'Open Work Studio', view: 'writing', targetId: work.id, targetType: 'work' },
            { label: 'Open Positions', view: 'vault' },
          ],
          thinkingEventHint: 'Previewing a work is orientation. Completing, substantially revising, or synthesizing linked ideas should record a thinking event.',
        });
        return;
      }
    }

    if (target.view === 'labs') {
      const practice = practices.find((item) => item.id === target.targetId);
      if (practice) {
        openNoesisObjectPreview({
          id: `home-practice-${practice.id}`,
          label: practice.title,
          section: 'Practice',
          description: fallback?.description || `${practice.type.replace(/_/g, ' ')} - ${practice.status}`,
          view: 'labs',
          targetId: practice.id,
          targetType: 'practice',
          objectType: 'Experiment Object',
          kind: 'object',
          intellectualStage: fallback?.stage || 'Test',
          hierarchyLevel: 'Expression',
          currentState: practice.status,
          summary: practice.description || practice.notes || fallback?.reason || 'A practice needing observation.',
          matchedBecause: fallback?.reason || 'Home selected this practice as lived evidence that needs attention.',
          connectedConcepts: practice.conceptTags || [],
          relatedObjects: [
            `${practice.positionIds?.length || 0} positions tested`,
            `${practice.questionIds?.length || 0} inquiries`,
            `${practice.logDates?.length || 0} logs`,
          ],
          lastChangedAt: practice.dateUpdated || practice.dateCreated,
          quickActionLabel: fallback?.label || 'Open Practice',
          quickActions: [
            { label: 'Open Practice Field', view: 'labs', targetId: practice.id, targetType: 'practice' },
            { label: 'Open Positions', view: 'vault' },
          ],
          thinkingEventHint: 'Previewing a practice is orientation. Starting, concluding, or logging an outcome that affects a belief should create history.',
        });
        return;
      }
    }

    onNavigate(target);
  };

  const turnProvocationIntoInquiry = async () => {
    if (!onCreateInquiry || inquiryCreationLock.current) return;
    inquiryCreationLock.current = true;
    setCreatingInquiry(true);
    try {
      const created = await onCreateInquiry({
        text: provocation.question,
        whyItMatters: provocation.evidence,
        currentIntuition: [
          briefAnswer.trim(),
          irrelevantReason.trim() ? `This prompt may miss because: ${irrelevantReason.trim()}` : '',
        ].filter(Boolean).join('\n\n'),
        status: 'open',
        type: 'manual',
        beliefIds: provocation.target.view === 'vault' && provocation.target.targetId ? [provocation.target.targetId] : [],
        conceptIds: provocation.target.view === 'concepts' && provocation.target.targetId ? [provocation.target.targetId] : [],
        sourceIds: ['library', 'source-index'].includes(provocation.target.view) && provocation.target.targetId ? [provocation.target.targetId] : [],
        draftIds: provocation.target.view === 'writing' && provocation.target.targetId ? [provocation.target.targetId] : [],
        practiceIds: provocation.target.view === 'labs' && provocation.target.targetId ? [provocation.target.targetId] : [],
      });
      setBriefAnswer('');
      setIrrelevantReason('');
      onNavigate({ view: 'questions', targetId: created.id });
    } catch {
      toast({ title: 'Inquiry not saved', description: 'Your response is still here. Please retry.', variant: 'destructive' });
    } finally { inquiryCreationLock.current = false; setCreatingInquiry(false); }
  };

  if (!hasWorkspace) {
    return (
      <div className="noesis-page">
        <PageHeader
          title={NOESIS_PAGE_BY_VIEW.home.title}
          description="A starting point for your thinking."
        />
        <PageEmptyState
          icon={Compass}
          title="What’s on your mind?"
          action={(
            <div className="flex flex-wrap justify-center gap-3">
              <DeskThoughtStarter onSave={capture} aiEnabled={aiEnabled} />
              <Button variant="outline" onClick={() => onNavigate({ view: 'library' })}>Go to Library</Button>
            </div>
          )}
        />
      </div>
    );
  }

  return (
    <div className="noesis-page noesis-today-desk" data-noesis-scroll-region>
      <div className="noesis-page-inner">
        <PageHeader
          title={NOESIS_PAGE_BY_VIEW.home.title}
          description="A starting point for your thinking."
        >
          {/* One way in, on the line that already says what you are working
              on. Everything a session can begin with lives behind it, so the
              Desk opens with what needs attention rather than with a row of
              buttons for things you have not decided to do yet. */}
          <div className="noesis-focus-row">
            {currentThemes.length > 0 && (
              <div className="noesis-focus-row__themes">
                <span className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Current focus</span>
                {currentThemes.map(theme => {
                  const concept = concepts.find(item => item.name.trim().toLowerCase() === theme.trim().toLowerCase());
                  return (
                    <button key={theme} type="button" className="noesis-today-focus break-words"
                      aria-label={`Open the concept ${theme}`}
                      onClick={() => onNavigate(concept ? { view: 'concepts', targetId: concept.id } : { view: 'concepts' })}>
                      {theme}
                    </button>
                  );
                })}
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" className="noesis-focus-row__start">
                  <Plus className="size-4" aria-hidden="true" />Start
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={() => setThoughtOpen(true)}>
                  <Sparkles className="size-4" aria-hidden="true" />Start with a thought
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onNavigate({ view: 'library' })}>
                  {(() => { const I = iconForNoesisView('library'); return <I className="size-4" aria-hidden="true" />; })()}Add a source
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onNavigate({ view: 'annotations' })}>
                  {(() => { const I = iconForNoesisView('annotations'); return <I className="size-4" aria-hidden="true" />; })()}Capture an annotation
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onNavigate({ view: 'questions' })}>
                  {(() => { const I = iconForNoesisView('questions'); return <I className="size-4" aria-hidden="true" />; })()}Formulate an inquiry
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onNavigate({ view: 'vault' })}>
                  {(() => { const I = iconForNoesisView('vault'); return <I className="size-4" aria-hidden="true" />; })()}Build a position
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onNavigate({ view: 'writing' })}>
                  {(() => { const I = iconForNoesisView('writing'); return <I className="size-4" aria-hidden="true" />; })()}Create a work
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DeskThoughtStarter onSave={capture} aiEnabled={aiEnabled} open={thoughtOpen} onOpenChange={setThoughtOpen} />
        </PageHeader>

        <section className="noesis-today-desk__lead noesis-today-desk__move p-4 sm:p-5" aria-labelledby="desk-next">
          <h2 id="desk-next" className="noesis-eyebrow font-bold text-accent">Measured Judgment</h2>
          {judgment.length ? (
            <div className="noesis-today-desk__moves">
              {judgment.map(item => {
                const Icon = NOESIS_SOLID_DESK_ICONS[item.kind];
                return (
                  <button key={item.id} type="button" className="group noesis-today-desk__slip" onClick={() => onNavigate({ view: item.view, targetId: item.targetId })}>
                    <span className="flex items-center gap-2 text-tone" data-tone={item.kind}>
                      <Icon className="size-5 shrink-0" aria-hidden="true" />
                      <span className="noesis-eyebrow noesis-eyebrow--sm text-inherit">{item.eyebrow}</span>
                    </span>
                    <span className="font-headline text-lg font-semibold leading-snug">{item.label}</span>
                    <span className="text-sm leading-snug text-muted-foreground">{item.reason}</span>
                    <span className="mt-1 inline-flex items-center gap-2 text-xs font-medium text-accent">{item.action}<ArrowRight className="size-3.5" aria-hidden="true" /></span>
                  </button>
                );
              })}
            </div>
          ) : <p className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardCheck className="size-5 text-accent" aria-hidden="true" />No follow-ups surfaced today.</p>}
          <section className="border-t border-border pt-4" aria-labelledby="desk-reflection">
            <div className="flex items-start gap-4">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-tone" data-tone="concept" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 id="desk-reflection" className="noesis-eyebrow text-muted-foreground">Think on this</h3>
                {provocationDismissed ? (
                  <button type="button" onClick={() => setProvocationDismissed(false)} className="mt-2 text-sm text-accent hover:underline">
                    Restore today&apos;s reflection prompt
                  </button>
                ) : (
                  <>
                    <p className="mt-1 font-headline text-xl italic leading-snug text-foreground/85">{provocation.question}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{provocation.evidence}</p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-accent">Write a response</summary>
                      <Textarea
                        value={briefAnswer}
                        onChange={(event) => setBriefAnswer(event.target.value)}
                        aria-label="Your reflection"
                        placeholder="Capture a brief response..."
                        className="mt-3 min-h-[76px] rounded-md"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={turnProvocationIntoInquiry} disabled={creatingInquiry || !onCreateInquiry}>{creatingInquiry ? 'Saving…' : 'Open as inquiry'}</Button>
                        <Button size="sm" variant="outline" onClick={() => previewOrNavigate(provocation.target, { label: 'Explore further', description: 'Reflection prompt', reason: provocation.evidence })} className="rounded-md">Explore</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setProvocationAngle((angle) => angle + 1);
                            setBriefAnswer('');
                            setIrrelevantReason('');
                          }}
                          className="rounded-md"
                        >
                          Replace
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setProvocationDismissed(true)} className="rounded-md">Dismiss</Button>
                      </div>
                    </details>
                  </>
                )}
              </div>
            </div>
          </section>
        </section>


        <aside className="noesis-today-desk__rail min-w-0 lg:grid-cols-2">
          <div className="noesis-today-desk__rail min-w-0">
          <section className="noesis-today-desk__notebook" aria-labelledby="desk-notebook">
            <h2 id="desk-notebook" className="noesis-eyebrow font-bold">In the middle of</h2>
            {openThreads.some(Boolean) ? (
              <ul className="mt-2">
                {openThreads.map(thread => thread && (
                  <li key={thread.view} className="noesis-today-desk__thread" data-tone={thread.tone}>
                    <span className="noesis-eyebrow noesis-eyebrow--sm text-tone">{thread.label}</span>
                    <button type="button" className="min-w-0 text-left hover:underline" onClick={() => onNavigate(thread)}>
                      <span className="block break-words font-medium">{thread.title}</span>
                      {thread.detail && <span className="block break-words text-xs text-muted-foreground">{thread.detail}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">No work in progress yet.</p>}
          </section>
            <PositionsUnderHeat rows={heat} onOpen={(id) => onNavigate({ view: 'vault', targetId: id })} />
          </div>
          {showCommitments ? <PraxisDeskTabs
            checkIn={<PraxisCheckIn practices={practices} day={day} onUpdate={onUpdatePractice} onOpen={(id) => onNavigate({ view: 'labs', targetId: id })} showLabel={false} />}
            commitments={<section data-tone="practice" aria-labelledby="desk-commitments">
            <div className="flex items-center justify-between gap-3">
              <h2 id="desk-commitments" className="sr-only">Active commitments</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onNavigate({ view: 'goals' })}
                className="ms-auto size-8 rounded-md"
                aria-label="Open all commitments"
                title="Open all commitments"
              >
                <ChevronRight className="size-4 stroke-[2.4]" />
              </Button>
            </div>
            {activeGoalRows.length ? (
              <div className="mt-2 grid gap-2">
                {activeGoalRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onNavigate({ view: 'goals', targetId: row.id })}
                    className="noesis-today-desk__commitment w-full min-w-0 text-left hover:bg-tone/10 focus-visible:outline focus-visible:outline-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-sm font-medium text-foreground">{row.label}<small className="block font-normal text-muted-foreground">{row.measure}</small></span>
                      <span className="shrink-0 font-code text-xs tabular-nums text-tone">{row.done}/{row.target}</span>
                    </div>
                    <Progress value={row.percent} aria-hidden="true" className="mt-2 h-1.5 [&>div]:bg-tone" />
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate({ view: 'goals' })}
                className="w-full border-y border-dashed border-border py-4 text-left text-sm text-muted-foreground hover:text-foreground"
              >
                Set an intellectual commitment for what deserves sustained attention.
              </button>
            )}
            </section>}
          /> : <div className="noesis-today-desk__tape">
            <PraxisCheckIn practices={practices} day={day} onUpdate={onUpdatePractice} onOpen={(id) => onNavigate({ view: 'labs', targetId: id })} />
          </div>}

        </aside>

        <div className="mt-6">
          <details className="noesis-today-desk__index">
            <summary className="min-h-8 cursor-pointer text-sm font-semibold">Workspace at a glance</summary>
            <div className="mt-2 grid grid-cols-1 border-t border-border sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r">
              {workspaceSnapshot.map((item) => {
                const Icon = NOESIS_SOLID_DESK_ICONS[item.icon];
                return (
                <button
                  key={item.label}
                  type="button"
                  data-tone={item.icon === 'unknown' ? 'neutral' : item.icon}
                  onClick={() => {
                    if (item.icon === 'practice') writeBrowserPreference('noesis:labs-tool', 'practices');
                    onNavigate({ view: item.view });
                  }}
                  className="group flex min-h-14 min-w-0 items-center gap-3 border-b border-border px-2 py-3 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3"
                >
                  <Icon className="size-5 shrink-0 text-tone" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-sm leading-5 text-foreground/80">{item.label}</span>
                  <span className="shrink-0 font-code text-lg font-bold text-foreground">{item.value}</span>
                </button>
                );
              })}
            </div>
          </details>


        </div>
      </div>
    </div>
  );
}

