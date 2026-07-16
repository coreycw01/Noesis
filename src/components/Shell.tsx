
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  HelpCircle,
  History,
  Library,
  Menu,
  Map as MapIcon,
  PenTool,
  Repeat,
  Settings,
  ShieldCheck,
  Edit2,
  ChevronRight,
  Command,
  Table as TableIcon,
  Highlighter,
  Home,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import type { GoalSettings, MediaType } from '@/lib/types';
import { MEDIA_LABELS } from '@/lib/readex';
import { NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';
import placeholderData from '@/app/lib/placeholder-images.json';

export interface MovementMetrics {
  rawAnnotations: number;
  unsupportedPositions: number;
  openInquiries: number;
  practicesWithoutPosition: number;
  positionsWithoutPractice: number;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  section: string;
  description: string;
  view: string;
  targetId?: string | null;
  kind?: 'navigation' | 'object' | 'create';
  currentState?: string;
  summary?: string;
  connectedConcepts?: string[];
  relatedObjects?: string[];
  lastChangedAt?: string;
  quickActionLabel?: string;
  quickActions?: Array<{
    label: string;
    view: string;
    targetId?: string | null;
  }>;
}

const RECENT_COMMAND_ITEMS_KEY = 'noesis:recent-command-items';
const MAX_RECENT_COMMAND_ITEMS = 8;

interface ShellProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
  onOpenProfile?: () => void;
  onOpenGoals?: () => void;
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
  movement?: MovementMetrics;
  profile?: {
    displayName?: string;
    email?: string;
    photoURL?: string;
    avatarUrl?: string;
    role?: string;
  };
  workspaceMode?: string;
  commandItems?: CommandPaletteItem[];
  onCommandSelect?: (item: CommandPaletteItem) => void;
}

export function Shell({ children, activeView, onViewChange, onOpenProfile, onOpenGoals, counts, goal, goalProgress, movement, profile, workspaceMode, commandItems: workspaceCommandItems = [], onCommandSelect }: ShellProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [previewItem, setPreviewItem] = useState<CommandPaletteItem | null>(null);
  const [recentCommandItems, setRecentCommandItems] = useState<CommandPaletteItem[]>([]);
  const navItems = [
    { id: 'home', icon: Home },
    { id: 'atlas', icon: MapIcon },
    { id: 'concepts', icon: BookOpen, count: counts.concepts },
    { id: 'questions', icon: HelpCircle, count: counts.questions },
    { id: 'library', icon: Library, count: counts.media },
    { id: 'source-index', icon: TableIcon, count: counts.media },
    { id: 'annotations', icon: Highlighter, count: counts.annotations },
    { id: 'vault', icon: ShieldCheck, count: counts.vault },
    { id: 'writing', icon: PenTool, count: counts.drafts },
    { id: 'practices', icon: Repeat, count: counts.practices },
    { id: 'evolution', icon: History, count: counts.timeline },
    { id: 'settings', icon: Settings },
  ];

  const logoData = placeholderData.placeholderImages.find(img => img.id === 'app-logo');
  const profileInitials = useMemo(() => {
    const label = profile?.displayName?.trim() || profile?.email?.trim() || 'Noesis';
    return label
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'N';
  }, [profile?.displayName, profile?.email]);

  useEffect(() => {
    const saved = window.localStorage.getItem('noesis:sidebar-collapsed');
    if (saved) setCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RECENT_COMMAND_ITEMS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as CommandPaletteItem[];
      if (Array.isArray(parsed)) setRecentCommandItems(parsed.slice(0, MAX_RECENT_COMMAND_ITEMS));
    } catch {
      setRecentCommandItems([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('noesis:sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const sortedActiveGoals = useMemo(() => {
    const categories = [...(goal.goalTypes || [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const activeGoals = [...(goal.goals || [])]
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (categories.length && activeGoals.length) {
      return activeGoals.map((item) => {
        const category = categories.find((goalType) => goalType.id === item.typeId);
        const mediaTypes = category?.mediaTypes || [];
        const done = mediaTypes.reduce((sum, type) => sum + (goalProgress[type] || 0), 0);
        const target = Math.max(1, item.targetProgress || 1);
        const percent = (done / target) * 100;
        return {
          id: item.id,
          label: item.title || category?.name || 'Goal Category',
          done,
          target,
          percent,
          mediaTypes,
        };
      });
    }

    return goal.types.map((type) => {
      const done = goalProgress[type] || 0;
      const target = goal.targets[type] || 12;
      const percent = (done / Math.max(1, target)) * 100;
      return {
        id: type,
        label: MEDIA_LABELS[type],
        done,
        target,
        percent,
        mediaTypes: [type],
      };
    });
  }, [goal, goalProgress]).sort((a, b) => b.percent - a.percent);

  const toggleSidebar = () => setCollapsed((current) => !current);
  const handleNavChange = (view: string) => {
    onViewChange(view);
    setMobileNavOpen(false);
    setCommandOpen(false);
    setCommandQuery('');
  };

  const commandItems = useMemo<CommandPaletteItem[]>(() => {
    const recent = recentCommandItems.map((item) => ({
      ...item,
      id: `recent-${item.id}`,
      section: 'Recent',
      description: item.description || `Open ${item.label}`,
      kind: item.kind || 'object',
    }));
    const utilities = [
      { id: 'profile', label: NOESIS_PAGE_BY_VIEW.profile.title, section: 'Utility', description: NOESIS_PAGE_BY_VIEW.profile.purpose, view: 'profile', kind: 'navigation' as const },
      { id: 'goals', label: NOESIS_PAGE_BY_VIEW.goals.title, section: 'Utility', description: NOESIS_PAGE_BY_VIEW.goals.purpose, view: 'goals', kind: 'navigation' as const },
    ];
    const creation = [
      { id: 'create-source', label: 'Add Source', section: 'Create', description: 'Open Library to capture a book, article, video, paper, or other source.', view: 'library', kind: 'create' as const },
      { id: 'create-inquiry', label: 'Create Inquiry', section: 'Create', description: 'Open Inquiries to start a structured investigation.', view: 'questions', kind: 'create' as const },
      { id: 'create-position', label: 'Create Position', section: 'Create', description: 'Open Positions to state or draft a belief for testing.', view: 'vault', kind: 'create' as const },
      { id: 'create-work', label: 'Create Work', section: 'Create', description: 'Open Works to start writing, notes, drawing, or recording.', view: 'writing', kind: 'create' as const },
      { id: 'start-practice', label: 'Start Practice', section: 'Create', description: 'Open Practices to turn an idea into a lived test.', view: 'practices', kind: 'create' as const },
    ];
    const core = navItems.map((item) => ({
      id: item.id,
      label: NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].title,
      section: NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].section,
      description: typeof item.count === 'number'
        ? `${NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].purpose} ${item.count} item${item.count === 1 ? '' : 's'}.`
        : NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].purpose,
      view: item.id,
      kind: 'navigation' as const,
    }));
    const query = commandQuery.trim().toLowerCase();
    return [...recent, ...creation, ...core, ...utilities, ...workspaceCommandItems]
      .filter((item) => !query || `${item.label} ${item.section} ${item.description}`.toLowerCase().includes(query))
      .slice(0, 18);
  }, [commandQuery, navItems, recentCommandItems, workspaceCommandItems]);

  const rememberCommandItem = (item: CommandPaletteItem) => {
    if (!item.targetId || item.kind !== 'object') return;
    setRecentCommandItems((current) => {
      const cleanId = item.id.replace(/^recent-/, '');
      const nextItem = { ...item, id: cleanId, section: item.section === 'Recent' ? 'Object' : item.section };
      const next = [nextItem, ...current.filter((entry) => entry.targetId !== item.targetId || entry.view !== item.view)]
        .slice(0, MAX_RECENT_COMMAND_ITEMS);
      try {
        window.localStorage.setItem(RECENT_COMMAND_ITEMS_KEY, JSON.stringify(next));
      } catch {
        // Recent items are a convenience layer; navigation should never depend on storage.
      }
      return next;
    });
  };

  const handleCommandSelect = (item: CommandPaletteItem) => {
    if (item.kind === 'object' || item.targetId) {
      rememberCommandItem(item);
      setPreviewItem(item);
      setCommandOpen(false);
      setCommandQuery('');
      return;
    }
    if (onCommandSelect) {
      onCommandSelect(item);
    } else {
      handleNavChange(item.view);
    }
    setCommandOpen(false);
    setCommandQuery('');
  };

  const openPreviewItem = (item: CommandPaletteItem) => {
    rememberCommandItem(item);
    if (onCommandSelect) {
      onCommandSelect(item);
    } else {
      handleNavChange(item.view);
    }
    setPreviewItem(null);
  };

  const renderNavButton = (item: typeof navItems[number]) => {
    const page = NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW];
    const button = (
      <button
        onClick={() => handleNavChange(item.id)}
        className={cn(
          'w-full flex items-center transition-all group',
          collapsed && !isMobile ? 'justify-center px-3 py-2.5' : 'gap-2.5 px-5 py-2.5',
          activeView === item.id
            ? 'border-accent bg-accent/10 text-white border-l-2'
            : 'border-transparent text-sidebar-foreground/60 hover:text-white hover:bg-white/[0.04] border-l-2'
        )}
      >
        <item.icon className={cn('size-4 shrink-0', activeView === item.id ? 'text-white' : 'group-hover:text-accent')} />
        {(!collapsed || isMobile) && (
          <>
            <span className="text-[13px] font-body font-medium tracking-wide flex-1 text-left">{page.title}</span>
            {typeof item.count === 'number' && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-code text-[9px] text-white/50">{item.count}</span>
            )}
          </>
        )}
      </button>
    );

    if (collapsed && !isMobile) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">{page.title}</TooltipContent>
        </Tooltip>
      );
    }

    return <React.Fragment key={item.id}>{button}</React.Fragment>;
  };

  const sidebarContent = (
    <>
      <div className={cn("border-b border-sidebar-border", collapsed && !isMobile ? "p-3" : "p-5")}>
        <div className={cn("mb-2 flex", collapsed && !isMobile ? "flex-col items-center gap-3" : "items-start gap-3")}>
          <div className={cn("flex items-center", collapsed && !isMobile ? "justify-center" : "gap-3")}>
            <div className="relative size-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.05] shrink-0">
              {logoData && (
                <Image
                  src={logoData.imageUrl}
                  alt={logoData.description}
                  width={32}
                  height={32}
                  className="object-cover"
                  data-ai-hint={logoData.imageHint}
                />
              )}
            </div>
            {(!collapsed || isMobile) && (
              <div>
                <span className="text-[22px] font-headline font-bold text-white tracking-tight">Noesis<span className="text-accent">.</span></span>
                <p className="font-code text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/35 font-medium">Turn thought into understanding.</p>
              </div>
            )}
          </div>
        </div>

        <div className={cn("mt-2 flex items-center", collapsed && !isMobile ? "justify-center" : "justify-end")}>
          <Button
            variant="ghost"
            size="icon"
            onClick={isMobile ? () => setMobileNavOpen(false) : toggleSidebar}
            className="rounded-full text-sidebar-foreground/55 hover:bg-white/[0.08] hover:text-white"
            title={collapsed && !isMobile ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isMobile ? <ChevronLeft className="size-4" /> : <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />}
          </Button>
        </div>

        <button
          type="button"
          onClick={onOpenProfile || (() => handleNavChange('profile'))}
          className={cn(
            "group flex items-center rounded-2xl border border-white/10 bg-white/[0.05] transition-colors hover:border-white/20 hover:bg-white/[0.08]",
            collapsed && !isMobile ? "mt-2 w-full justify-center p-2.5" : "mt-2 w-full gap-3 px-3 py-2.5"
          )}
          title="Open profile"
        >
          <Avatar className="size-9 border border-white/10">
            <AvatarImage src={profile?.photoURL || profile?.avatarUrl || ''} alt={profile?.displayName || 'Profile'} />
            <AvatarFallback className="bg-white/[0.08] text-[11px] font-semibold text-white">
              {profileInitials}
            </AvatarFallback>
          </Avatar>
          {(!collapsed || isMobile) && (
            <div className="min-w-0 text-left">
              <div className="truncate text-[12px] font-medium text-white/90">{profile?.displayName || 'Profile'}</div>
              <div className="truncate font-code text-[8px] uppercase tracking-[0.14em] text-sidebar-foreground/38">
                {workspaceMode || profile?.role || 'Private workspace'}
              </div>
            </div>
          )}
        </button>

        {(!collapsed || isMobile) && (
          <div
            onClick={onOpenGoals || (() => handleNavChange('goals'))}
            className="mt-3 w-full rounded border border-white/10 bg-white/[0.05] p-3 transition-all hover:border-white/20 hover:bg-white/[0.075] group/goals relative cursor-pointer"
          >
            <div className="mb-3 flex justify-between items-center">
              <div>
                <span className="font-code text-[9px] uppercase tracking-wider text-sidebar-foreground/60 font-bold">Goals</span>
                <div className="mt-1 text-[13px] font-body text-white/90">{goal.label || 'Goal Set'}</div>
              </div>
              <Edit2 className="size-3 text-sidebar-foreground/40 opacity-0 group-hover/goals:opacity-100 transition-opacity" />
            </div>
            <ScrollArea className="h-[110px] pr-2">
              <div className="space-y-4">
                {sortedActiveGoals.map((row) => (
                  <div key={row.id} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <span className="font-code text-[7px] uppercase tracking-widest text-sidebar-foreground/40 font-bold">{row.label}</span>
                      <span className="font-code text-[9px] text-white/70 font-bold">{row.done}/{row.target}</span>
                    </div>
                    {row.mediaTypes.length > 0 && (
                      <div className="font-code text-[7px] uppercase tracking-widest text-sidebar-foreground/25">
                        Counts: {row.mediaTypes.map((type) => MEDIA_LABELS[type]).join(', ')}
                      </div>
                    )}
                    <Progress value={row.percent} className="h-1 bg-white/10" />
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between font-code text-[8px] uppercase tracking-widest text-sidebar-foreground/30 font-bold group-hover/goals:text-sidebar-foreground/60 transition-colors">
              <span>View All Details</span>
              <ChevronRight className="size-2.5" />
            </div>
          </div>
        )}
      </div>

      {(!collapsed || isMobile) && movement && (movement.rawAnnotations + movement.unsupportedPositions + movement.openInquiries + movement.practicesWithoutPosition + movement.positionsWithoutPractice) > 0 && (
        <div className="px-5 pb-4 border-b border-sidebar-border">
          <div className="flex items-center gap-1.5 mb-2 mt-4">
            <AlertTriangle className="size-3 text-amber-400" />
            <span className="font-code text-[8px] uppercase tracking-[0.16em] text-sidebar-foreground/40 font-bold">Needs Attention</span>
          </div>
          <div className="space-y-1.5">
            {movement.rawAnnotations > 0 && (
              <button onClick={() => handleNavChange('annotations')} className="w-full text-left rounded-lg px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] transition-colors group">
                <span className="font-code text-[9px] text-white/60 group-hover:text-white/85 transition-colors">
                  <span className="text-amber-400 font-bold">{movement.rawAnnotations}</span> raw annotation{movement.rawAnnotations !== 1 ? 's' : ''} unclassified
                </span>
              </button>
            )}
            {movement.openInquiries > 0 && (
              <button onClick={() => handleNavChange('questions')} className="w-full text-left rounded-lg px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] transition-colors group">
                <span className="font-code text-[9px] text-white/60 group-hover:text-white/85 transition-colors">
                  <span className="text-amber-400 font-bold">{movement.openInquiries}</span> open inquir{movement.openInquiries !== 1 ? 'ies' : 'y'} without answer
                </span>
              </button>
            )}
            {movement.unsupportedPositions > 0 && (
              <button onClick={() => handleNavChange('vault')} className="w-full text-left rounded-lg px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] transition-colors group">
                <span className="font-code text-[9px] text-white/60 group-hover:text-white/85 transition-colors">
                  <span className="text-amber-400 font-bold">{movement.unsupportedPositions}</span> position{movement.unsupportedPositions !== 1 ? 's' : ''} without evidence
                </span>
              </button>
            )}
            {movement.positionsWithoutPractice > 0 && (
              <button onClick={() => handleNavChange('practices')} className="w-full text-left rounded-lg px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] transition-colors group">
                <span className="font-code text-[9px] text-white/60 group-hover:text-white/85 transition-colors">
                  <span className="text-amber-400 font-bold">{movement.positionsWithoutPractice}</span> position{movement.positionsWithoutPractice !== 1 ? 's' : ''} not yet tested
                </span>
              </button>
            )}
            {movement.practicesWithoutPosition > 0 && (
              <button onClick={() => handleNavChange('practices')} className="w-full text-left rounded-lg px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] transition-colors group">
                <span className="font-code text-[9px] text-white/60 group-hover:text-white/85 transition-colors">
                  <span className="text-amber-400 font-bold">{movement.practicesWithoutPosition}</span> practice{movement.practicesWithoutPosition !== 1 ? 's' : ''} without a belief
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        {['Mind', 'Inputs', 'Outputs', 'Utility'].map((section) => (
          <div key={section} className="mb-5">
            {(!collapsed || isMobile) && (
              <h4 className="px-5 mb-1 font-code text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/22 font-bold">{section}</h4>
            )}
            <ul className="space-y-1">
              {navItems.filter((item) => NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].section === section).map((item) => (
                <li key={item.id}>{renderNavButton(item)}</li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border bg-transparent", collapsed && !isMobile ? "p-3 text-center" : "p-4")}>
        <span className="text-[9px] font-code text-sidebar-foreground/20">v1.3.0 cloud</span>
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={160}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {!isMobile && (
          <aside className={cn(
            "hidden md:flex bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border shadow-2xl z-20 transition-[width] duration-300 ease-out",
            collapsed ? "w-[84px]" : "w-[252px]"
          )}>
            {sidebarContent}
          </aside>
        )}

        {isMobile && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="fixed left-4 top-4 z-30 rounded-full border-border/60 bg-card shadow-md md:hidden"
            >
              <Menu className="size-4" />
            </Button>
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetContent side="left" className="w-[280px] border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col">{sidebarContent}</div>
              </SheetContent>
            </Sheet>
          </>
        )}

        <main className="flex-1 flex flex-col relative overflow-hidden bg-background min-w-0">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="absolute right-5 top-5 z-10 hidden items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground lg:flex"
            aria-label="Open command palette"
          >
            <Command className="size-3.5" />
            <span className="font-code text-[9px] uppercase tracking-[0.16em]">Ctrl K</span>
          </button>
          {children}
        </main>

        <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
          <DialogContent className="max-w-xl rounded-3xl border-border bg-card p-0 shadow-2xl">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle className="font-headline text-2xl font-semibold italic">Command Palette</DialogTitle>
              <DialogDescription>Jump to a page, utility surface, or primary workspace without using the sidebar.</DialogDescription>
            </DialogHeader>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  placeholder="Search Atlas, Positions, Works..."
                  className="h-11 rounded-full pl-9"
                />
              </div>
              <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
                {commandItems.map((item) => (
                  <button
                    key={`${item.section}-${item.id}`}
                    type="button"
                    onClick={() => handleCommandSelect(item)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span>
                      <span className="block font-medium text-foreground">{item.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1 font-code text-[8px] uppercase tracking-[0.16em] text-muted-foreground">{item.section}</span>
                  </button>
                ))}
                {!commandItems.length && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No matching destinations.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Sheet open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden border-l border-border bg-card p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-6 py-5 text-left">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border px-2.5 py-1 font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {previewItem?.section || 'Object'}
                </span>
                {previewItem?.currentState && (
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 font-code text-[9px] uppercase tracking-[0.16em] text-accent">
                    {previewItem.currentState}
                  </span>
                )}
              </div>
              <SheetTitle className="font-headline text-2xl font-semibold italic leading-tight text-foreground/85">
                {previewItem?.label || 'Object Preview'}
              </SheetTitle>
              <SheetDescription className="text-sm leading-6">
                {previewItem?.summary || previewItem?.description || 'Preview this object before opening the full workspace.'}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Current State</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {previewItem?.description || 'No additional summary has been recorded for this object yet.'}
                  </p>
                </section>

                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Connected Concepts</div>
                  {previewItem?.connectedConcepts?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewItem.connectedConcepts.slice(0, 8).map((concept) => (
                        <span key={concept} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                          {concept}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">No concept connections are visible from the command index yet.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Related Objects</div>
                  {previewItem?.relatedObjects?.length ? (
                    <div className="mt-3 grid gap-2">
                      {previewItem.relatedObjects.map((related) => (
                        <div key={related} className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                          {related}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">No relationship counts are visible from the command index yet.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Last Meaningful Change</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {previewItem?.lastChangedAt || 'No change date available.'}
                  </p>
                </section>

                {previewItem?.quickActions?.length ? (
                  <section className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Quick Actions</div>
                    <div className="mt-3 grid gap-2">
                      {previewItem.quickActions.map((action) => (
                        <Button
                          key={`${action.view}-${action.targetId || action.label}`}
                          variant="outline"
                          className="justify-between rounded-xl"
                          onClick={() => openPreviewItem({
                            ...previewItem,
                            view: action.view,
                            targetId: action.targetId,
                            quickActionLabel: action.label,
                          })}
                        >
                          {action.label}
                          <ChevronRight className="size-4" />
                        </Button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            <div className="border-t border-border p-4">
              <Button
                className="w-full rounded-full"
                onClick={() => previewItem && openPreviewItem(previewItem)}
              >
                {previewItem?.quickActionLabel || 'Open Full Page'}
                <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
