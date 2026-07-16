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
    })),
    ...media.slice(0, 20).map((item) => ({
      id: `source-${item.id}`,
      label: item.title,
      section: 'Source',
      description: item.creator || item.type || 'Open source workspace.',
      view: 'library',
      targetId: item.id,
    })),
    ...questions.slice(0, 20).map((item) => ({
      id: `inquiry-${item.id}`,
      label: item.text,
      section: 'Inquiry',
      description: item.status || 'Open inquiry workspace.',
      view: 'questions',
      targetId: item.id,
    })),
    ...vault.slice(0, 20).map((item) => ({
      id: `position-${item.id}`,
      label: item.title || item.statement,
      section: 'Position',
      description: item.status || 'Open position workbench.',
      view: 'vault',
      targetId: item.id,
    })),
    ...drafts.slice(0, 20).map((item) => ({
      id: `work-${item.id}`,
      label: item.title,
      section: 'Work',
      description: item.type || 'Open work studio.',
      view: 'writing',
      targetId: item.id,
    })),
    ...practices.slice(0, 20).map((item) => ({
      id: `practice-${item.id}`,
      label: item.title,
      section: 'Practice',
      description: item.status || 'Open practice field.',
      view: 'practices',
      targetId: item.id,
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
