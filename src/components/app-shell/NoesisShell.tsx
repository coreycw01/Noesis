"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shell } from '@/components/Shell';
import type { MovementMetrics } from '@/components/Shell';
import type { CommandPaletteItem } from '@/components/Shell';
import { Toaster } from '@/components/ui/toaster';
import type { UserProfile } from '@/lib/types';
import { ChevronDown, Download, FlaskConical } from 'lucide-react';
import { REVIEW_ACCOUNT_EMAIL } from '@/lib/review-workspace-config';
import { useNoesisRoute } from '@/lib/noesis-route-context';
import { NOESIS_DATA_REQUIREMENT_LABELS } from '@/lib/noesis-page-definitions';

interface NoesisShellProps {
  children: React.ReactNode;
  activeView: string;
  pendingPath?: string | null;
  onViewChange: (view: string) => void;
  onOpenProfile: () => void;
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
  movement: MovementMetrics;
  profile: UserProfile;
  workspaceMode?: string;
  isReviewWorkspace: boolean;
  effectiveUid: string;
  canSeedReviewWorkspace: boolean;
  isSeedingReview: boolean;
  seedReviewWorkspace: (options?: { force?: boolean; announce?: boolean }) => void;
  exportReviewArchitecture: () => void;
  linkCount: number;
  loadWorkspaceCommandItems: (signal: AbortSignal) => Promise<{ items: CommandPaletteItem[]; cached?: boolean }>;
  onOpenCommandItem?: (item: CommandPaletteItem) => void;
}

export function NoesisShell({
  children,
  activeView,
  pendingPath,
  onViewChange,
  onOpenProfile,
  counts,
  movement,
  profile,
  workspaceMode,
  isReviewWorkspace,
  effectiveUid,
  canSeedReviewWorkspace,
  isSeedingReview,
  seedReviewWorkspace,
  exportReviewArchitecture,
  linkCount,
  loadWorkspaceCommandItems,
  onOpenCommandItem,
}: NoesisShellProps) {
  const [reviewDetailsOpen, setReviewDetailsOpen] = React.useState(false);
  const { activePage, dataRequirements, isDetailRoute, routeTarget } = useNoesisRoute();
  const routeRequirementLabels = dataRequirements.map((key) => NOESIS_DATA_REQUIREMENT_LABELS[key] || key);

  return (
    <Shell
      activeView={activeView}
      pendingPath={pendingPath}
      onViewChange={onViewChange}
      onOpenProfile={onOpenProfile}
      counts={counts}
      movement={movement}
      profile={{
        displayName: profile.displayName,
        email: profile.email,
        photoURL: profile.photoURL,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
      }}
      workspaceMode={workspaceMode}
      loadCommandItems={loadWorkspaceCommandItems}
      onCommandSelect={onOpenCommandItem}
    >
      {isReviewWorkspace && (
        <div className="noesis-gutter border-b border-accent/20 bg-accent/10 py-2">
          <div>
            <div className="flex min-w-0 items-center gap-2">
              <Badge className="shrink-0 rounded-full bg-accent text-accent-foreground">Demo</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                Local review workspace · {counts.media} sources · {counts.concepts} concepts · {counts.vault} positions
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReviewDetailsOpen((open) => !open)}
                aria-expanded={reviewDetailsOpen}
                className="h-8 shrink-0 rounded-full px-2 text-xs"
              >
                Details
                <ChevronDown className={`ml-1 size-3.5 transition-transform ${reviewDetailsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </div>
            {reviewDetailsOpen && <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-accent/20 pt-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
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
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This preview uses a local deterministic dataset. Sign in with <span className="font-code">{REVIEW_ACCOUNT_EMAIL}</span> to reseed the Firestore review workspace.
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-2 noesis-eyebrow text-muted-foreground">
                <span>{counts.media} sources</span>
                <span>{counts.annotations} annotations</span>
                <span>{counts.questions} inquiries</span>
                <span>{counts.vault} positions</span>
                <span>{counts.drafts} works</span>
                <span>{counts.practices} practices</span>
                <span>{linkCount} typed links</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => seedReviewWorkspace({ force: true, announce: true })} disabled={isSeedingReview || !canSeedReviewWorkspace} className="h-8 rounded-full bg-card px-3 text-xs">
                <FlaskConical className="mr-1.5 size-3.5" />
                {isSeedingReview ? 'Refreshing Demo Data' : 'Refresh Demo Workspace'}
              </Button>
              <Button onClick={exportReviewArchitecture} className="text-xs">
                <Download className="mr-1.5 size-3.5" /> Export Architecture
              </Button>
            </div>
          </div>}
          </div>
        </div>
      )}
      {children}
      <Toaster />
    </Shell>
  );
}
