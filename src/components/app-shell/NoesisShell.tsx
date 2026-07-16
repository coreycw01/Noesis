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
  const workspaceCommandItems: CommandPaletteItem[] = [
    ...concepts.slice(0, 20).map((item) => ({
      id: `concept-${item.id}`,
      label: item.name,
      section: 'Concept',
      description: item.description || 'Open concept detail.',
      view: 'concepts',
      targetId: item.id,
      kind: 'object' as const,
      currentState: item.philosophyStatus || 'concept',
      summary: item.description || 'A concept in the user vocabulary.',
      connectedConcepts: item.links || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${item.links?.length || 0} related concepts`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Concept',
      quickActions: [
        { label: 'Open Concepts', view: 'concepts', targetId: item.id },
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
      kind: 'object' as const,
      currentState: item.status,
      summary: item.description || item.capture?.after?.coreArgument || item.capture?.before?.openQuestion || 'A source feeding the thinking system.',
      connectedConcepts: item.tags || [],
      relatedObjects: [
        `${item.annotations?.length || 0} annotations`,
        `${vault.filter((position) => (position.sourceIds || []).includes(item.id)).length} positions influenced`,
        `${drafts.filter((draft) => (draft.sourceIds || []).includes(item.id)).length} works linked`,
      ],
      lastChangedAt: item.dateUpdated || item.dateAdded,
      quickActionLabel: 'Open Source',
      quickActions: [
        { label: 'Open Library', view: 'library', targetId: item.id },
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
      kind: 'object' as const,
      currentState: item.philosophyStatus || 'raw',
      summary: item.context || item.answer || item.text,
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
        { label: 'Open Parent Source', view: 'library', targetId: item.source.id },
      ],
    })),
    ...questions.slice(0, 20).map((item) => ({
      id: `inquiry-${item.id}`,
      label: item.text,
      section: 'Inquiry',
      description: item.status || 'Open inquiry workspace.',
      view: 'questions',
      targetId: item.id,
      kind: 'object' as const,
      currentState: item.status,
      summary: item.answer || 'An open investigation in the system.',
      connectedConcepts: item.conceptIds?.map((conceptId) => concepts.find((concept) => concept.id === conceptId)?.name || conceptId) || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${item.beliefIds?.length || 0} positions`,
        `${item.draftIds?.length || 0} works`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Inquiry',
      quickActions: [
        { label: 'Investigate', view: 'questions', targetId: item.id },
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
      kind: 'object' as const,
      currentState: item.status,
      summary: item.statement || item.description || 'A current position in the belief workbench.',
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
        { label: 'Open Position', view: 'vault', targetId: item.id },
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
      kind: 'object' as const,
      currentState: item.status,
      summary: item.body || item.draftContent || 'A work expressing or developing thought.',
      connectedConcepts: item.conceptTags || [],
      relatedObjects: [
        `${item.sourceIds?.length || 0} sources`,
        `${item.questionIds?.length || 0} inquiries`,
        `${item.beliefIds?.length || 0} positions`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Work',
      quickActions: [
        { label: 'Open Work', view: 'writing', targetId: item.id },
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
      kind: 'object' as const,
      currentState: item.status,
      summary: item.description || item.notes || 'A lived test connected to thought.',
      connectedConcepts: item.conceptTags || [],
      relatedObjects: [
        `${item.positionIds?.length || 0} positions tested`,
        `${item.questionIds?.length || 0} inquiries`,
        `${item.logDates?.length || 0} logs`,
      ],
      lastChangedAt: item.dateUpdated || item.dateCreated,
      quickActionLabel: 'Open Practice',
      quickActions: [
        { label: 'Open Practice', view: 'practices', targetId: item.id },
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
      kind: 'object' as const,
      currentState: item.status,
      summary: item.description || 'A known area of uncertainty in the thinking system.',
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
