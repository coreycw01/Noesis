"use client";

import React from 'react';
import type { User } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shell } from '@/components/Shell';
import type { MovementMetrics } from '@/components/Shell';
import type { CommandPaletteItem } from '@/components/Shell';
import { Toaster } from '@/components/ui/toaster';
import { allAnnotations } from '@/lib/readex';
import type {
  Draft,
  Concept,
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
import { Download, FlaskConical } from 'lucide-react';
import { REVIEW_ACCOUNT_EMAIL } from '@/lib/demo-workspace';
import { deriveAtlasRegions } from '@/components/Atlas/atlas-diagnostics';
import { useNoesisRoute } from '@/lib/noesis-route-context';
import { NOESIS_DATA_REQUIREMENT_LABELS } from '@/lib/noesis-page-definitions';

function timeValue(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysAgo(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

interface NoesisShellProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
  onOpenProfile: () => void;
  onOpenGoals: () => void;
  counts: {
    concepts: number;
    questions: number;
    media: number;
    annotations: number;
    vault: number;
    drafts: number;
    practices: number;
    timeline: number;
  };
  goal: GoalSettings;
  goalProgress: Partial<Record<MediaType, number>>;
  movement: MovementMetrics;
  profile: UserProfile;
  workspaceMode?: string;
  isReviewWorkspace: boolean;
  effectiveUid: string;
  canSeedReviewWorkspace: boolean;
  isSeedingReview: boolean;
  seedReviewWorkspace: (options?: { force?: boolean; announce?: boolean }) => void;
  exportReviewArchitecture: () => void;
  media: Media[];
  concepts: Concept[];
  questions: Question[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  unknowns: Unknown[];
  links: PhilosophicalLink[];
  suggestionsCount: number;
  user: User | null;
  onOpenCommandItem?: (item: CommandPaletteItem) => void;
}

export function NoesisShell({
  children,
  activeView,
  onViewChange,
  onOpenProfile,
  onOpenGoals,
  counts,
  goal,
  goalProgress,
  movement,
  profile,
  workspaceMode,
  isReviewWorkspace,
  effectiveUid,
  canSeedReviewWorkspace,
  isSeedingReview,
  seedReviewWorkspace,
  exportReviewArchitecture,
  media,
  concepts,
  questions,
  vault,
  drafts,
  practices,
  unknowns,
  links,
  suggestionsCount,
  onOpenCommandItem,
}: NoesisShellProps) {
  const { activePage, dataRequirements, isDetailRoute, routeTarget } = useNoesisRoute();
  const routeRequirementLabels = dataRequirements.map((key) => NOESIS_DATA_REQUIREMENT_LABELS[key] || key);
  const atlasRegions = React.useMemo(() => deriveAtlasRegions({
    concepts,
    media,
    vault,
    practices,
    questions,
    drafts,
    links,
    timeline: [],
    thinkingEvents: [],
  }), [concepts, drafts, links, media, practices, questions, vault]);

  const attentionCommandItems = React.useMemo<CommandPaletteItem[]>(() => {
    const annotations = allAnnotations(media);
    const unprocessedAnnotations = annotations.filter((item) => {
      const status = item.philosophyStatus || 'raw';
      return ['raw', 'connected'].includes(status) && !item.createdInquiryId && !item.createdPositionId;
    });
    const unsupportedPositions = vault.filter((item) => (item.evidenceFor || []).length === 0 && (item.sourceIds || []).length === 0);
    const unchallengedPositions = vault.filter((item) => (item.evidenceAgainst || []).length === 0 && item.status !== 'abandoned');
    const untestedPositions = vault.filter((item) => !practices.some((practice) => (practice.positionIds || []).includes(item.id)) && item.status !== 'abandoned');
    const unresolvedInquiries = questions.filter((item) => !['resolved', 'answered', 'archived', 'abandoned', 'suspended'].includes(item.status || '') && !item.answer?.trim());
    const staleConcepts = concepts.filter((item) => {
      const lastActive = timeValue(item.dateUpdated || item.dateCreated);
      return lastActive > 0 && lastActive < daysAgo(180);
    });
    const unfinishedWorks = drafts.filter((item) => !['final', 'complete', 'published', 'archived'].includes(item.status || ''));
    const activePracticesNeedingLogs = practices.filter((item) => {
      if (!['active', 'planned', 'proposed'].includes(item.status || '')) return false;
      const lastLog = Math.max(...(item.logDates || []).map((date) => timeValue(date)), 0);
      return lastLog === 0 || lastLog < daysAgo(7);
    });

    const items: CommandPaletteItem[] = [];

    if (unprocessedAnnotations.length) {
      items.push({
        id: 'next-process-annotations',
        label: `Process ${unprocessedAnnotations.length} unprocessed annotation${unprocessedAnnotations.length === 1 ? '' : 's'}`,
        section: 'Next Action',
        description: 'Open the annotation inbox and turn raw captures into concepts, inquiries, challenges, or positions.',
        view: 'annotations',
        targetId: unprocessedAnnotations[0].id,
        objectType: 'Processing Queue',
        kind: 'object',
        intellectualStage: 'Interpret',
        hierarchyLevel: 'Raw',
        activityClass: 'meaningful',
        currentState: 'Needs interpretation',
        summary: `${unprocessedAnnotations.length} captures are still waiting for judgment or connection.`,
        matchedBecause: 'Noesis should move thought from capture into interpretation instead of leaving raw highlights inert.',
        connectedConcepts: unprocessedAnnotations.flatMap((item) => item.conceptTags || []).slice(0, 6),
        relatedObjects: unprocessedAnnotations.slice(0, 4).map((item) => `${item.type}: ${item.text.slice(0, 72)}`),
        lastChangedAt: unprocessedAnnotations[0].date,
        thinkingEventHint: 'Processing these annotations can create concept, inquiry, position, support, or challenge events when promoted.',
        aliases: ['show annotations that challenge', 'process highlights', 'raw captures', 'unprocessed annotations', 'turn annotation into idea'],
        quickActionLabel: 'Open Annotation Inbox',
        quickActions: [{ label: 'Open Annotation Inbox', view: 'annotations' }],
      });
    }

    unsupportedPositions.slice(0, 3).forEach((position) => {
      items.push({
        id: `next-evidence-${position.id}`,
        label: `Add evidence to: ${position.title || position.statement}`,
        section: 'Next Action',
        description: 'This position has no direct supporting sources or evidence yet.',
        view: 'vault',
        targetId: position.id,
        targetType: 'position' as const,
        objectType: 'Position Action',
        kind: 'object',
        intellectualStage: 'Judge',
        hierarchyLevel: 'Judgment',
        activityClass: 'meaningful',
        currentState: 'Unsupported',
        summary: position.statement || position.description || 'A position needs supporting evidence before it can become stable.',
        matchedBecause: 'Positions should not look mature until evidence is attached.',
        connectedConcepts: position.tags || [],
        relatedObjects: [`${(position.evidenceFor || []).length} supports`, `${(position.sourceIds || []).length} linked sources`],
        lastChangedAt: position.dateUpdated || position.dateCreated,
        thinkingEventHint: 'Adding evidence should create an evidence_added thinking event for this position.',
        aliases: ['unsupported position', 'add evidence', 'needs support', 'weak evidence', 'position without sources'],
        quickActionLabel: 'Open Position',
        quickActions: [{ label: 'Open Position', view: 'vault', targetId: position.id, targetType: 'position' as const }],
      });
    });

    unchallengedPositions.slice(0, 3).forEach((position) => {
      items.push({
        id: `next-challenge-${position.id}`,
        label: `Challenge position: ${position.title || position.statement}`,
        section: 'Next Action',
        description: 'This position has no recorded challenge or opposing evidence.',
        view: 'vault',
        targetId: position.id,
        targetType: 'position' as const,
        objectType: 'Position Action',
        kind: 'object',
        intellectualStage: 'Revise',
        hierarchyLevel: 'Judgment',
        activityClass: 'meaningful',
        currentState: 'Under-challenged',
        summary: position.statement || position.description || 'A position needs opposition before confidence means much.',
        matchedBecause: 'Noesis should surface positions that have not been seriously challenged.',
        connectedConcepts: position.tags || [],
        relatedObjects: [`${(position.evidenceAgainst || []).length} challenges`, `${position.confidence ?? 'unknown'} confidence`],
        lastChangedAt: position.dateUpdated || position.dateCreated,
        thinkingEventHint: 'Adding a challenge, objection, or confidence change should create challenge/confidence thinking events.',
        aliases: ['challenge position', 'opposing evidence', 'stress test belief', 'under challenged', 'find objection'],
        quickActionLabel: 'Stress-Test Position',
        quickActions: [{ label: 'Open Stress-Test', view: 'vault', targetId: position.id, targetType: 'position' as const }],
      });
    });

    untestedPositions.slice(0, 3).forEach((position) => {
      items.push({
        id: `next-test-${position.id}`,
        label: `Create a practice for: ${position.title || position.statement}`,
        section: 'Next Action',
        description: 'This position is not connected to a lived test yet.',
        view: 'practices',
        targetId: null,
        objectType: 'Practice Action',
        kind: 'object',
        intellectualStage: 'Test',
        hierarchyLevel: 'Expression',
        activityClass: 'meaningful',
        currentState: 'Untested',
        summary: position.statement || position.description || 'A claim becomes more serious when it can be tested in behavior.',
        matchedBecause: 'Practices close the loop between thought and life.',
        connectedConcepts: position.tags || [],
        relatedObjects: [`Position: ${position.title || position.statement}`, 'No linked practice found'],
        lastChangedAt: position.dateUpdated || position.dateCreated,
        thinkingEventHint: 'Creating a practice that tests this position should record a practice_created or tested thinking event.',
        aliases: ['untested belief', 'test position', 'create practice', 'lived experiment', 'practice for belief'],
        quickActionLabel: 'Open Practices',
        quickActions: [
          { label: 'Open Practices', view: 'practices' },
          { label: 'Open Position First', view: 'vault', targetId: position.id, targetType: 'position' as const },
        ],
      });
    });

    unresolvedInquiries.slice(0, 3).forEach((inquiry) => {
      items.push({
        id: `next-inquiry-${inquiry.id}`,
        label: `Advance inquiry: ${inquiry.text}`,
        section: 'Next Action',
        description: 'This inquiry needs evidence, a working answer, or a resolution summary.',
        view: 'questions',
        targetId: inquiry.id,
        targetType: 'inquiry' as const,
        objectType: 'Inquiry Action',
        kind: 'object',
        intellectualStage: 'Question',
        hierarchyLevel: 'Interpretive',
        activityClass: 'meaningful',
        currentState: inquiry.status || 'Open',
        summary: inquiry.answer || 'An open question still needs investigation.',
        matchedBecause: 'Open inquiries are unfinished intellectual pressure points.',
        connectedConcepts: inquiry.conceptIds?.map((conceptId) => concepts.find((concept) => concept.id === conceptId)?.name || conceptId) || [],
        relatedObjects: [`${inquiry.sourceIds?.length || 0} sources`, `${inquiry.beliefIds?.length || 0} positions`],
        lastChangedAt: inquiry.dateUpdated || inquiry.dateCreated,
        thinkingEventHint: 'Reframing, resolving, or promoting this inquiry should create question or position events.',
        aliases: ['open question', 'unanswered question', 'advance inquiry', 'working answer', 'resolve inquiry'],
        quickActionLabel: 'Open Inquiry',
        quickActions: [{ label: 'Open Inquiry', view: 'questions', targetId: inquiry.id, targetType: 'inquiry' as const }],
      });
    });

    staleConcepts.slice(0, 3).forEach((concept) => {
      items.push({
        id: `next-stale-concept-${concept.id}`,
        label: `Revisit old concept: ${concept.name}`,
        section: 'Next Action',
        description: 'This idea has not been revisited in roughly six months.',
        view: 'concepts',
        targetId: concept.id,
        targetType: 'concept' as const,
        objectType: 'Concept Action',
        kind: 'object',
        intellectualStage: 'Revise',
        hierarchyLevel: 'Interpretive',
        activityClass: 'meaningful',
        currentState: concept.philosophyStatus || 'Stale',
        summary: concept.description || 'A concept may need a clearer definition or updated boundary.',
        matchedBecause: 'This matches the command idea: find ideas I have not revisited in six months.',
        connectedConcepts: concept.links || [],
        relatedObjects: [`${concept.sourceIds?.length || 0} sources`, `${concept.links?.length || 0} related concepts`],
        lastChangedAt: concept.dateUpdated || concept.dateCreated,
        thinkingEventHint: 'Redefining or materially relinking this concept should create a concept-definition thinking event.',
        aliases: ['not revisited', 'six months', 'old idea', 'stale concept', 'neglected concept'],
        quickActionLabel: 'Open Concept',
        quickActions: [{ label: 'Open Concept', view: 'concepts', targetId: concept.id, targetType: 'concept' as const }],
      });
    });

    unfinishedWorks.slice(0, 3).forEach((work) => {
      items.push({
        id: `next-work-${work.id}`,
        label: `Continue work: ${work.title}`,
        section: 'Next Action',
        description: 'This work is still in progress and may contain unresolved claims.',
        view: 'writing',
        targetId: work.id,
        targetType: 'work' as const,
        objectType: 'Work Action',
        kind: 'object',
        intellectualStage: 'Express',
        hierarchyLevel: 'Expression',
        activityClass: 'meaningful',
        currentState: work.status || 'Draft',
        summary: work.body || work.draftContent || 'A work in progress.',
        matchedBecause: 'The command bar should help continue unfinished expression, not just open pages.',
        connectedConcepts: work.conceptTags || [],
        relatedObjects: [`${work.beliefIds?.length || 0} positions`, `${work.questionIds?.length || 0} inquiries`],
        lastChangedAt: work.dateUpdated || work.dateCreated,
        thinkingEventHint: 'Substantial revision, synthesis, or completion of this work should create a thinking event.',
        aliases: ['continue essay', 'unfinished essay', 'continue writing', 'draft in progress', 'unfinished work'],
        quickActionLabel: 'Open Work',
        quickActions: [{ label: 'Open Work', view: 'writing', targetId: work.id, targetType: 'work' as const }],
      });
    });

    activePracticesNeedingLogs.slice(0, 3).forEach((practice) => {
      items.push({
        id: `next-practice-log-${practice.id}`,
        label: `Log practice result: ${practice.title}`,
        section: 'Next Action',
        description: 'This practice needs a recent observation or outcome log.',
        view: 'practices',
        targetId: practice.id,
        targetType: 'practice' as const,
        objectType: 'Practice Action',
        kind: 'object',
        intellectualStage: 'Test',
        hierarchyLevel: 'Expression',
        activityClass: 'meaningful',
        currentState: practice.status || 'Active',
        summary: practice.description || practice.notes || 'A practice awaiting evidence from life.',
        matchedBecause: 'Practices should test positions through logged consequences, not just streaks.',
        connectedConcepts: practice.conceptTags || [],
        relatedObjects: [`${practice.positionIds?.length || 0} positions tested`, `${practice.logDates?.length || 0} logs`],
        lastChangedAt: practice.dateUpdated || practice.dateCreated,
        thinkingEventHint: 'Logging a result that affects a position or inquiry should create a tested/practice event.',
        aliases: ['log practice', 'practice result', 'needs observation', 'streak log', 'test outcome'],
        quickActionLabel: 'Open Practice',
        quickActions: [{ label: 'Open Practice', view: 'practices', targetId: practice.id, targetType: 'practice' as const }],
      });
    });

    return items.slice(0, 16);
  }, [concepts, drafts, media, practices, questions, vault]);

  const workspaceCommandItems: CommandPaletteItem[] = [
    ...attentionCommandItems,
    ...atlasRegions.slice(0, 12).map((region) => ({
      id: `atlas-region-${region.id}`,
      label: region.name,
      section: 'Atlas Region',
      description: region.description || 'Open Atlas to inspect this worldview territory.',
      view: 'atlas',
      targetId: region.id,
      objectType: 'Interpretive Territory',
      kind: 'object' as const,
      intellectualStage: 'Understand' as const,
      hierarchyLevel: 'Interpretive' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Opening a region is orientation. Creating links, resolving tensions, or revising related objects should create the meaningful event.',
      currentState: region.maturityStatus,
      summary: `${region.name} contains ${region.activePositionsCount} positions, ${region.openInquiryCount} open inquiries, ${region.practiceCount} practices, and ${region.tensionCount} tensions.`,
      matchedBecause: 'Atlas regions are derived from connected concepts, positions, inquiries, sources, works, practices, and typed links.',
      connectedConcepts: region.dominantConcepts,
      relatedObjects: [
        `${region.sourceCount} sources`,
        `${region.annotationCount} annotations`,
        `${region.recentActivityCount} recent changes`,
        `${region.labels.length ? region.labels.map((label) => label.replace(/-/g, ' ')).join(', ') : 'no diagnostic labels'}`,
      ],
      lastChangedAt: region.lastActiveAt,
      quickActionLabel: 'Open Atlas',
      quickActions: [
        { label: 'Open Atlas Territory View', view: 'atlas' },
        { label: 'Open Map View', view: 'atlas' },
      ],
    })),
    ...concepts.slice(0, 20).map((item) => ({
      id: `concept-${item.id}`,
      label: item.name,
      section: 'Concept',
      description: item.description || 'Open concept detail.',
      view: 'concepts',
      targetId: item.id,
      targetType: 'concept' as const,
      objectType: 'Interpretive Object',
      kind: 'object' as const,
      intellectualStage: 'Interpret' as const,
      hierarchyLevel: 'Interpretive' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Previewing a concept is orientation. Defining, redefining, merging, splitting, or materially linking it should create the thinking event.',
      currentState: item.philosophyStatus || 'concept',
      summary: item.description || 'A concept in the user vocabulary.',
      matchedBecause: 'Concepts organize recurring meaning across sources, inquiries, positions, works, and practices.',
      connectedConcepts: item.links || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${item.links?.length || 0} related concepts`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Concept',
      quickActions: [
        { label: 'Open Concepts', view: 'concepts', targetId: item.id, targetType: 'concept' as const },
        { label: 'Explore Atlas', view: 'atlas' },
      ],
    })),
    ...media.slice(0, 20).map((item) => ({
      id: `source-${item.id}`,
      label: item.title,
      section: 'Source',
      description: item.creator || item.type || 'Open source workspace.',
      view: 'library',
      targetId: item.id,
      targetType: 'source' as const,
      objectType: 'Raw Input',
      kind: 'object' as const,
      intellectualStage: 'Encounter' as const,
      hierarchyLevel: 'Raw' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Opening a source is orientation. Completing reflection, distilling a claim, or creating annotations from it should record intellectual development.',
      currentState: item.status,
      summary: item.description || item.capture?.after?.coreArgument || item.capture?.before?.openQuestion || 'A source feeding the thinking system.',
      matchedBecause: 'Sources are encounters that can become annotations, concepts, inquiries, and positions.',
      connectedConcepts: item.tags || [],
      relatedObjects: [
        `${item.annotations?.length || 0} annotations`,
        `${vault.filter((position) => (position.sourceIds || []).includes(item.id)).length} positions influenced`,
        `${drafts.filter((draft) => (draft.sourceIds || []).includes(item.id)).length} works linked`,
      ],
      lastChangedAt: item.dateUpdated || item.dateAdded,
      quickActionLabel: 'Open Source',
      quickActions: [
        { label: 'Open Library', view: 'library', targetId: item.id, targetType: 'source' as const },
        { label: 'Process Annotations', view: 'annotations' },
      ],
    })),
    ...allAnnotations(media).slice(0, 25).map((item) => ({
      id: `annotation-${item.source.id}-${item.id}`,
      label: item.text,
      section: 'Annotation',
      description: `${item.type} from ${item.source.title}`,
      view: 'annotations',
      targetId: item.id,
      objectType: 'Raw Capture',
      kind: 'object' as const,
      intellectualStage: 'Capture' as const,
      hierarchyLevel: 'Raw' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Previewing an annotation is orientation. Promoting it into a concept, inquiry, challenge, or position is the meaningful event.',
      currentState: item.philosophyStatus || 'raw',
      summary: item.context || item.answer || item.text,
      matchedBecause: 'Annotations are captures waiting to be interpreted, questioned, connected, or judged.',
      connectedConcepts: item.conceptTags || item.source.tags || [],
      relatedObjects: [
        `Source: ${item.source.title}`,
        item.createdInquiryId ? 'Created inquiry' : 'No inquiry created',
        item.createdPositionId ? 'Created position' : `${item.linkedPositionIds?.length || 0} linked positions`,
      ],
      lastChangedAt: item.date,
      quickActionLabel: 'Open Annotations',
      quickActions: [
        { label: 'Process Annotation', view: 'annotations' },
        { label: 'Open Parent Source', view: 'library', targetId: item.source.id, targetType: 'source' as const },
      ],
    })),
    ...questions.slice(0, 20).map((item) => ({
      id: `inquiry-${item.id}`,
      label: item.text,
      section: 'Inquiry',
      description: item.status || 'Open inquiry workspace.',
      view: 'questions',
      targetId: item.id,
      targetType: 'inquiry' as const,
      objectType: 'Interpretive Object',
      kind: 'object' as const,
      intellectualStage: 'Question' as const,
      hierarchyLevel: 'Interpretive' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Opening an inquiry is orientation. Revising the question, adding assumptions, resolving it, or forming a position from it should create history.',
      currentState: item.status,
      summary: item.answer || 'An open investigation in the system.',
      matchedBecause: 'Inquiries structure uncertainty and can mature into positions, works, practices, or unknowns.',
      connectedConcepts: item.conceptIds?.map((conceptId) => concepts.find((concept) => concept.id === conceptId)?.name || conceptId) || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${item.beliefIds?.length || 0} positions`,
        `${item.draftIds?.length || 0} works`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Inquiry',
      quickActions: [
        { label: 'Investigate', view: 'questions', targetId: item.id, targetType: 'inquiry' as const },
        { label: 'Open Positions', view: 'vault' },
      ],
    })),
    ...vault.slice(0, 20).map((item) => ({
      id: `position-${item.id}`,
      label: item.title || item.statement,
      section: 'Position',
      description: item.status || 'Open position workbench.',
      view: 'vault',
      targetId: item.id,
      targetType: 'position' as const,
      objectType: 'Judgment Object',
      kind: 'object' as const,
      intellectualStage: 'Judge' as const,
      hierarchyLevel: 'Judgment' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Previewing a position is orientation. Support, challenge, confidence, stress-test, abandonment, and revision actions should create events.',
      currentState: item.status,
      summary: item.statement || item.description || 'A current position in the belief workbench.',
      matchedBecause: 'Positions are user-owned judgments that need evidence, objections, confidence, and revision history.',
      connectedConcepts: item.tags || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${(item.evidenceFor || []).length} supports`,
        `${(item.evidenceAgainst || []).length} challenges`,
        `${practices.filter((practice) => (practice.positionIds || []).includes(item.id)).length} practices`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Position',
      quickActions: [
        { label: 'Open Position', view: 'vault', targetId: item.id, targetType: 'position' as const },
        { label: 'View Evolution', view: 'evolution' },
      ],
    })),
    ...drafts.slice(0, 20).map((item) => ({
      id: `work-${item.id}`,
      label: item.title,
      section: 'Work',
      description: item.type || 'Open work studio.',
      view: 'writing',
      targetId: item.id,
      targetType: 'work' as const,
      objectType: 'Expression Object',
      kind: 'object' as const,
      intellectualStage: 'Express' as const,
      hierarchyLevel: 'Expression' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Opening a work is orientation. Completing, substantially revising, or synthesizing linked ideas should record a thinking event.',
      currentState: item.status,
      summary: item.body || item.draftContent || 'A work expressing or developing thought.',
      matchedBecause: 'Works express, clarify, and expose tensions inside positions, inquiries, and concepts.',
      connectedConcepts: item.conceptTags || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${item.questionIds?.length || 0} inquiries`,
        `${item.beliefIds?.length || 0} positions`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Work',
      quickActions: [
        { label: 'Open Work', view: 'writing', targetId: item.id, targetType: 'work' as const },
        { label: 'Open Positions', view: 'vault' },
      ],
    })),
    ...practices.slice(0, 20).map((item) => ({
      id: `practice-${item.id}`,
      label: item.title,
      section: 'Practice',
      description: item.status || 'Open practice field.',
      view: 'practices',
      targetId: item.id,
      targetType: 'practice' as const,
      objectType: 'Experiment Object',
      kind: 'object' as const,
      intellectualStage: 'Test' as const,
      hierarchyLevel: 'Expression' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Opening a practice is orientation. Starting, concluding, or logging an outcome that affects a belief should create history.',
      currentState: item.status,
      summary: item.description || item.notes || 'A lived test connected to thought.',
      matchedBecause: 'Practices test whether an idea survives contact with lived behavior and observation.',
      connectedConcepts: item.conceptTags || [],
      relatedObjects: [
        `${item.positionIds?.length || 0} positions tested`,
        `${item.questionIds?.length || 0} inquiries`,
        `${item.logDates?.length || 0} logs`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Practice',
      quickActions: [
        { label: 'Open Practice', view: 'practices', targetId: item.id, targetType: 'practice' as const },
        { label: 'Open Positions', view: 'vault' },
      ],
    })),
    ...unknowns.slice(0, 20).map((item) => ({
      id: `unknown-${item.unknownId}`,
      label: item.title,
      section: 'Unknown',
      description: item.domain || item.importance || 'Open unknown.',
      view: 'profile',
      targetId: item.unknownId,
      objectType: 'Metacognitive Object',
      kind: 'object' as const,
      intellectualStage: 'Understand' as const,
      hierarchyLevel: 'Historical' as const,
      activityClass: 'orientation' as const,
      thinkingEventHint: 'Previewing an unknown is orientation. Creating, investigating, or resolving an unknown should create a thinking event.',
      currentState: item.status,
      summary: item.description || 'A known area of uncertainty in the thinking system.',
      matchedBecause: 'Unknowns make ignorance explicit so it can guide research, questions, and revision.',
      connectedConcepts: item.conceptTags || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${item.positionIds?.length || 0} positions`,
        `${item.inquiryIds?.length || 0} inquiries`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Profile',
      quickActions: [
        { label: 'Open Profile', view: 'profile' },
        { label: 'Open Inquiries', view: 'questions' },
      ],
    })),
  ];

  return (
    <Shell
      activeView={activeView}
      onViewChange={onViewChange}
      onOpenProfile={onOpenProfile}
      onOpenGoals={onOpenGoals}
      counts={counts}
      goal={goal}
      goalProgress={goalProgress}
      movement={movement}
      profile={{
        displayName: profile.displayName,
        email: profile.email,
        photoURL: profile.photoURL,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
      }}
      workspaceMode={workspaceMode}
      commandItems={workspaceCommandItems}
      onCommandSelect={onOpenCommandItem}
    >
      {isReviewWorkspace && (
        <div className="border-b border-amber-500/15 bg-amber-500/6 px-6 py-2.5">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-amber-500 text-black">Review Workspace</Badge>
                <Badge variant="outline" className="rounded-full">Role: demo</Badge>
                <Badge variant="outline" className="rounded-full">
                  Route: {activePage.title}{isDetailRoute && routeTarget ? ` / ${routeTarget.type}` : ''}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  Loads: {routeRequirementLabels.slice(0, 3).join(', ')}{routeRequirementLabels.length > 3 ? ` +${routeRequirementLabels.length - 3}` : ''}
                </Badge>
                <Badge variant="outline" className="rounded-full">Scoped to /users/{effectiveUid}</Badge>
                <span className="text-sm text-muted-foreground">
                  Demo environment active with seeded sources, annotations, inquiries, positions, works, practices, and Atlas links.
                </span>
              </div>
              {!canSeedReviewWorkspace && (
                <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                  Sign in with <span className="font-code">{REVIEW_ACCOUNT_EMAIL}</span> or use demo mode to refresh the dedicated review dataset.
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-2 font-code text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{media.length} sources</span>
                <span>{allAnnotations(media).length} annotations</span>
                <span>{questions.length} inquiries</span>
                <span>{vault.length} positions</span>
                <span>{drafts.length} works</span>
                <span>{practices.length} practices</span>
                <span>{links.length} typed links</span>
                <span>{suggestionsCount} AI suggestions</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => seedReviewWorkspace({ force: true, announce: true })} disabled={isSeedingReview || !canSeedReviewWorkspace} className="h-8 rounded-full bg-card px-3 text-xs">
                <FlaskConical className="mr-1.5 size-3.5" />
                {isSeedingReview ? 'Refreshing Demo Data' : 'Refresh Demo Workspace'}
              </Button>
              <Button onClick={exportReviewArchitecture} className="h-8 rounded-full px-3 text-xs">
                <Download className="mr-1.5 size-3.5" /> Export Architecture
              </Button>
            </div>
          </div>
        </div>
      )}
      {children}
      <Toaster />
    </Shell>
  );
}
