
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
  ChevronRight,
  Command,
  Table as TableIcon,
  Highlighter,
  Home,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
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
import type { NoesisRouteTargetType } from '@/lib/noesis-routes';
import { NOESIS_OBJECT_PREVIEW_EVENT, type NoesisObjectPreviewItem } from '@/lib/noesis-object-preview';
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
  targetType?: NoesisRouteTargetType;
  objectType?: string;
  kind?: 'navigation' | 'object' | 'create';
  intellectualStage?: 'Encounter' | 'Capture' | 'Interpret' | 'Question' | 'Judge' | 'Express' | 'Test' | 'Revise' | 'Understand' | 'Navigate' | 'Configure';
  hierarchyLevel?: 'Raw' | 'Interpretive' | 'Judgment' | 'Expression' | 'Historical' | 'Utility';
  activityClass?: 'meaningful' | 'orientation' | 'non_meaningful';
  thinkingEventHint?: string;
  aliases?: string[];
  currentState?: string;
  summary?: string;
  connectedConcepts?: string[];
  relatedObjects?: string[];
  lastChangedAt?: string;
  matchedBecause?: string;
  quickActionLabel?: string;
  quickActions?: Array<{
    label: string;
    view: string;
    targetId?: string | null;
    targetType?: NoesisRouteTargetType;
  }>;
}

const RECENT_COMMAND_ITEMS_KEY = 'noesis:recent-command-items';
const MAX_RECENT_COMMAND_ITEMS = 8;
const STRUCTURED_COMMAND_EXAMPLES = [
  'create inquiry',
  'open position',
  'challenge autonomy',
  'continue essay',
  'start practice',
];
const NOESIS_STAGE_ORDER = ['Encounter', 'Capture', 'Interpret', 'Question', 'Judge', 'Express', 'Test', 'Revise', 'Understand'] as const;
const STAGE_DESCRIPTIONS: Record<(typeof NOESIS_STAGE_ORDER)[number], string> = {
  Encounter: 'A source, capture, or object enters the system.',
  Capture: 'A highlight, thought, question, or connection is preserved.',
  Interpret: 'Meaning is organized into concepts and relationships.',
  Question: 'Uncertainty becomes an inquiry or unknown.',
  Judge: 'A position is stated, challenged, and given confidence.',
  Express: 'Thought becomes a work, note, recording, drawing, or draft.',
  Test: 'A practice or experiment checks whether the idea holds in life.',
  Revise: 'Evidence, tension, or practice changes the object.',
  Understand: 'Evolution, profile, and Atlas show what changed.',
};

const normalizePreviewType = (item: CommandPaletteItem | null) => {
  if (!item) return 'Object';
  if (item.objectType) return item.objectType;
  if (item.kind === 'create') return 'Creation Action';
  if (item.kind === 'navigation') return 'Workspace';
  if (item.hierarchyLevel) return `${item.hierarchyLevel} Object`;
  return item.section || 'Object';
};

const normalizePreviewState = (item: CommandPaletteItem | null) => {
  if (!item) return 'Orientation';
  if (item.currentState) return item.currentState;
  if (item.kind === 'create') return 'Ready to create';
  if (item.kind === 'navigation') return item.view === 'settings' ? 'App behavior' : 'Workspace overview';
  if (item.targetId) return 'Preview only';
  return 'Available';
};

const normalizePreviewSummary = (item: CommandPaletteItem | null) => {
  if (!item) return 'Preview this object before opening the full workspace.';
  return item.summary || item.description || 'Preview this object before opening the full workspace.';
};

const normalizeMatchedReason = (item: CommandPaletteItem | null) => {
  if (!item) return 'Opened from a navigation or search result.';
  if (item.matchedBecause) return item.matchedBecause;
  if (item.kind === 'create') return 'This action starts one of the core Noesis workflows.';
  if (item.kind === 'navigation') return 'This workspace matches the selected page or command.';
  if (item.targetId) return 'This object matched your command search or a recent object shortcut.';
  return 'Opened from the command palette.';
};

const normalizeActivityClass = (item: CommandPaletteItem | null) => {
  if (!item) return 'orientation';
  if (item.activityClass) return item.activityClass;
  if (item.kind === 'create') return 'meaningful';
  if (item.kind === 'navigation') return 'non_meaningful';
  return 'orientation';
};

const normalizeThinkingEventHint = (item: CommandPaletteItem | null) => {
  if (!item) return 'Previewing an item is orientation only. It should not create a thinking event.';
  if (item.thinkingEventHint) return item.thinkingEventHint;
  if (item.kind === 'create') return 'Creating the object from its workspace should create a thinking event when the object is saved.';
  if (item.kind === 'navigation') return 'Opening or sorting a page is navigation only. It should not create a thinking event.';
  return 'Opening this preview is orientation only. Meaningful edits, links, revisions, tests, or resolutions happen on the full page.';
};

const defaultQuickActionsFor = (item: CommandPaletteItem | null) => {
  if (!item) return [];
  if (item.quickActions?.length) return item.quickActions;
  if (item.kind === 'object' || item.targetId) {
    return [
      {
        label: `Open in ${item.section || 'Workspace'}`,
        view: item.view,
        targetId: item.targetId,
        targetType: item.targetType,
      },
    ];
  }
  if (item.kind === 'create') {
    return [
      {
        label: item.quickActionLabel || 'Start this workflow',
        view: item.view,
        targetId: item.targetId,
        targetType: item.targetType,
      },
    ];
  }
  return [];
};

const thoughtPathFor = (item: CommandPaletteItem | null) => {
  if (!item?.intellectualStage || item.intellectualStage === 'Navigate' || item.intellectualStage === 'Configure') {
    return [];
  }
  const activeIndex = NOESIS_STAGE_ORDER.indexOf(item.intellectualStage);
  if (activeIndex < 0) return [];
  const start = Math.max(0, activeIndex - 2);
  const end = Math.min(NOESIS_STAGE_ORDER.length, activeIndex + 3);
  return NOESIS_STAGE_ORDER.slice(start, end).map((stage) => ({
    stage,
    active: stage === item.intellectualStage,
    description: STAGE_DESCRIPTIONS[stage],
  }));
};

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
  const [attentionOpen, setAttentionOpen] = useState(false);
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

  useEffect(() => {
    const onPreviewObject = (event: Event) => {
      const detail = (event as CustomEvent<NoesisObjectPreviewItem>).detail;
      if (!detail?.id || !detail.label || !detail.view) return;
      setPreviewItem({
        ...detail,
        kind: detail.kind || 'object',
        activityClass: detail.activityClass || 'orientation',
      });
    };
    window.addEventListener(NOESIS_OBJECT_PREVIEW_EVENT, onPreviewObject);
    return () => window.removeEventListener(NOESIS_OBJECT_PREVIEW_EVENT, onPreviewObject);
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
    const utilities: CommandPaletteItem[] = [
      { id: 'profile', label: NOESIS_PAGE_BY_VIEW.profile.title, section: 'Utility', description: NOESIS_PAGE_BY_VIEW.profile.purpose, view: 'profile', kind: 'navigation' as const, intellectualStage: 'Understand', hierarchyLevel: 'Utility', activityClass: 'non_meaningful' as const },
      { id: 'goals', label: NOESIS_PAGE_BY_VIEW.goals.title, section: 'Utility', description: NOESIS_PAGE_BY_VIEW.goals.purpose, view: 'goals', kind: 'navigation' as const, intellectualStage: 'Test', hierarchyLevel: 'Utility', activityClass: 'non_meaningful' as const },
    ];
    const creation: CommandPaletteItem[] = [
      { id: 'create-source', label: 'Add Source', section: 'Create', description: 'Open Library to capture a book, article, video, paper, or other source.', view: 'library', kind: 'create' as const, intellectualStage: 'Encounter', hierarchyLevel: 'Raw', objectType: 'Source', activityClass: 'meaningful' as const, thinkingEventHint: 'Saving a new source should record a source-created thinking event when it becomes part of the workspace.', aliases: ['add book', 'add article', 'add paper', 'capture source', 'study source', 'new source'] },
      { id: 'capture-annotation', label: 'Capture Annotation', section: 'Create', description: 'Open Annotations to process a highlight, thought, question, objection, definition, example, or connection.', view: 'annotations', kind: 'create' as const, objectType: 'Raw Capture', hierarchyLevel: 'Raw', intellectualStage: 'Capture', currentState: 'Ready to capture', matchedBecause: 'Capture is the bridge from encountering material to interpreting it inside Noesis.', activityClass: 'meaningful' as const, thinkingEventHint: 'Saving a new annotation should record capture; promoting it into an inquiry, concept, or position should record the later intellectual step.', aliases: ['new highlight', 'capture thought', 'save quote', 'process highlight', 'show annotations that challenge'] },
      { id: 'create-inquiry', label: 'Create Inquiry', section: 'Create', description: 'Open Inquiries to start a structured investigation.', view: 'questions', kind: 'create' as const, intellectualStage: 'Question', hierarchyLevel: 'Interpretive', objectType: 'Inquiry', activityClass: 'meaningful' as const, thinkingEventHint: 'Creating or resolving an inquiry should create a thinking event because uncertainty changed state.', aliases: ['create question', 'ask question', 'create an inquiry about', 'investigate', 'unknown question'] },
      { id: 'create-position', label: 'Create Position', section: 'Create', description: 'Open Positions to state or draft a belief for testing.', view: 'vault', kind: 'create' as const, intellectualStage: 'Judge', hierarchyLevel: 'Judgment', objectType: 'Position', activityClass: 'meaningful' as const, thinkingEventHint: 'Creating, revising, challenging, supporting, or changing confidence on a position should create a thinking event.', aliases: ['create belief', 'state claim', 'open my position', 'draft position', 'judge idea'] },
      { id: 'create-work', label: 'Create Work', section: 'Create', description: 'Open Works to start writing, notes, drawing, or recording.', view: 'writing', kind: 'create' as const, intellectualStage: 'Express', hierarchyLevel: 'Expression', objectType: 'Work', activityClass: 'meaningful' as const, thinkingEventHint: 'Creating a work can be ordinary drafting; completing or substantially revising it should create a thinking event.', aliases: ['write essay', 'continue essay', 'unfinished essay', 'start note', 'record idea', 'draw idea'] },
      { id: 'start-practice', label: 'Start Practice', section: 'Create', description: 'Open Practices to turn an idea into a lived test.', view: 'practices', kind: 'create' as const, intellectualStage: 'Test', hierarchyLevel: 'Expression', objectType: 'Practice', activityClass: 'meaningful' as const, thinkingEventHint: 'Creating, concluding, or logging a practice result that changes a belief should create a thinking event.', aliases: ['start experiment', 'test belief', 'behavioral commitment', 'lived test', 'practice result'] },
    ];
    const core: CommandPaletteItem[] = navItems.map((item) => ({
      id: item.id,
      label: NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].title,
      section: NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].section,
      description: typeof item.count === 'number'
        ? `${NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].purpose} ${item.count} item${item.count === 1 ? '' : 's'}.`
        : NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].purpose,
      view: item.id,
      kind: 'navigation' as const,
      intellectualStage: item.id === 'settings' ? 'Configure' as const : 'Navigate' as const,
      hierarchyLevel: 'Utility' as const,
      activityClass: 'non_meaningful' as const,
    }));
    const query = commandQuery.trim().toLowerCase();
    return [...recent, ...creation, ...core, ...utilities, ...workspaceCommandItems]
      .filter((item) => {
        const searchable = [
          item.label,
          item.section,
          item.description,
          item.summary,
          item.objectType,
          item.currentState,
          item.matchedBecause,
          item.intellectualStage,
          item.hierarchyLevel,
          item.activityClass,
          item.thinkingEventHint,
          ...(item.aliases || []),
          ...(item.connectedConcepts || []),
          ...(item.relatedObjects || []),
        ].filter(Boolean).join(' ');
        return !query || searchable.toLowerCase().includes(query);
      })
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

  const previewType = normalizePreviewType(previewItem);
  const previewState = normalizePreviewState(previewItem);
  const previewSummary = normalizePreviewSummary(previewItem);
  const previewMatchedReason = normalizeMatchedReason(previewItem);
  const previewQuickActions = defaultQuickActionsFor(previewItem);
  const previewThoughtPath = thoughtPathFor(previewItem);
  const previewActivityClass = normalizeActivityClass(previewItem);
  const previewThinkingEventHint = normalizeThinkingEventHint(previewItem);
  const activePage = NOESIS_PAGE_BY_VIEW[activeView as keyof typeof NOESIS_PAGE_BY_VIEW] || NOESIS_PAGE_BY_VIEW.home;
  const mobilePrimaryNav = navItems.filter((item) => ['home', 'atlas', 'annotations', 'vault', 'writing'].includes(item.id));
  const attentionTotal = movement
    ? movement.rawAnnotations + movement.unsupportedPositions + movement.openInquiries + movement.practicesWithoutPosition + movement.positionsWithoutPractice
    : 0;
  const attentionItems = [
    {
      id: 'raw-annotations',
      label: 'Unprocessed annotations',
      count: movement?.rawAnnotations || 0,
      description: 'Captured notes still need a decision: support, challenge, question, clarify, or reference.',
      view: 'annotations',
    },
    {
      id: 'open-inquiries',
      label: 'Open inquiries',
      count: movement?.openInquiries || 0,
      description: 'Questions are still active and need evidence, a working answer, or resolution.',
      view: 'questions',
    },
    {
      id: 'unsupported-positions',
      label: 'Unsupported positions',
      count: movement?.unsupportedPositions || 0,
      description: 'Positions need supporting evidence, challenges, or a clearer confidence state.',
      view: 'vault',
    },
    {
      id: 'positions-without-practice',
      label: 'Untested positions',
      count: movement?.positionsWithoutPractice || 0,
      description: 'Beliefs exist without a linked practice or lived test.',
      view: 'vault',
    },
    {
      id: 'practices-without-position',
      label: 'Unanchored practices',
      count: movement?.practicesWithoutPosition || 0,
      description: 'Practices need a linked position so the behavior tests an idea.',
      view: 'practices',
    },
  ].filter((item) => item.count > 0);

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
            className="group/goals relative mt-3 w-full cursor-pointer rounded border border-white/10 bg-white/[0.05] p-3 pr-9 transition-all hover:border-white/20 hover:bg-white/[0.075]"
          >
            <ChevronRight className="absolute right-3 top-3 size-3 text-sidebar-foreground/35 transition-all group-hover/goals:translate-x-0.5 group-hover/goals:text-white/70" />
            <div className="mb-2 min-w-0">
              <div>
                <span className="font-code text-[9px] uppercase tracking-wider text-sidebar-foreground/60 font-bold">Goals</span>
                <div className="mt-1 text-[13px] font-body text-white/90">{goal.label || 'Goal Set'}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {sortedActiveGoals.slice(0, 3).map((row) => (
                <div key={row.id} className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-2 py-1.5">
                  <div className="truncate font-code text-[7px] font-bold uppercase tracking-widest text-sidebar-foreground/60">{row.label}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Progress value={row.percent} className="h-1 flex-1 bg-white/10" />
                    <span className="shrink-0 font-code text-[7px] font-bold text-white/60">{row.done}/{row.target}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {attentionTotal > 0 && (
        <div className={cn("border-b border-sidebar-border", collapsed && !isMobile ? "px-3 py-3" : "px-5 py-3")}>
          <button
            type="button"
            onClick={() => setAttentionOpen(true)}
            className={cn(
              "group flex w-full items-center rounded-full border border-amber-300/20 bg-amber-400/10 text-amber-100 transition-colors hover:border-amber-300/35 hover:bg-amber-400/15",
              collapsed && !isMobile ? "justify-center p-2.5" : "gap-2 px-3 py-2"
            )}
            title={`${attentionTotal} item${attentionTotal === 1 ? '' : 's'} need attention`}
            aria-label={`${attentionTotal} item${attentionTotal === 1 ? '' : 's'} need attention`}
          >
            <span className="relative">
              <AlertTriangle className="size-4 text-amber-300" />
              <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-amber-300 px-1 font-code text-[8px] font-bold text-black">
                {attentionTotal > 9 ? '9+' : attentionTotal}
              </span>
            </span>
            {(!collapsed || isMobile) && (
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-code text-[8px] font-bold uppercase tracking-[0.16em] text-amber-200">Attention</span>
                <span className="block truncate text-[11px] text-sidebar-foreground/55">{attentionTotal} item{attentionTotal === 1 ? '' : 's'} to review</span>
              </span>
            )}
          </button>
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
            <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-background/95 px-3 shadow-sm backdrop-blur md:hidden">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileNavOpen(true)}
                className="size-9 rounded-full border-border/60 bg-card shadow-sm"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-headline text-lg font-semibold italic leading-none text-foreground/85">{activePage.title}</div>
                <div className="mt-0.5 truncate font-code text-[8px] uppercase tracking-[0.16em] text-muted-foreground">{activePage.section}</div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCommandOpen(true)}
                className="size-9 rounded-full border-border/60 bg-card shadow-sm"
                aria-label="Open command palette"
              >
                <Command className="size-4" />
              </Button>
            </div>
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetContent side="left" className="w-[280px] border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col">{sidebarContent}</div>
              </SheetContent>
            </Sheet>
          </>
        )}

        <main className="flex-1 flex flex-col relative overflow-hidden bg-background min-w-0 pt-14 pb-16 md:pt-0 md:pb-0">
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
          {isMobile && (
            <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-2 py-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden" aria-label="Primary mobile navigation">
              <div className="grid grid-cols-5 gap-1">
                {mobilePrimaryNav.map((item) => {
                  const page = NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW];
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavChange(item.id)}
                      className={cn(
                        'flex min-h-11 flex-col items-center justify-center rounded-2xl px-1 py-1 text-[10px] transition-colors',
                        isActive ? 'bg-accent/12 text-accent' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <item.icon className="size-4" />
                      <span className="mt-0.5 max-w-full truncate font-code text-[7px] uppercase tracking-[0.12em]">{page.title}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </main>

        <Dialog open={attentionOpen} onOpenChange={setAttentionOpen}>
          <DialogContent className="max-w-lg rounded-3xl border-border bg-card shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl font-semibold italic">Needs Attention</DialogTitle>
              <DialogDescription>
                These are the parts of your workspace that need the next concrete move.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {attentionItems.length ? attentionItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setAttentionOpen(false);
                    handleNavChange(item.view);
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-amber-400/15 font-code text-[10px] font-bold text-amber-700 dark:text-amber-200">
                        {item.count}
                      </span>
                      <span className="font-medium text-foreground">{item.label}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <div className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Clear</div>
                  <p className="mt-2 text-sm text-muted-foreground">Nothing currently needs attention.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
          <DialogContent className="max-w-xl rounded-3xl border-border bg-card p-0 shadow-2xl">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle className="font-headline text-2xl font-semibold italic">Command Palette</DialogTitle>
              <DialogDescription>Search objects, jump to workspaces, or start structured Noesis actions. This is navigation and creation, not unrestricted AI chat.</DialogDescription>
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
              <div className="mt-3 flex flex-wrap gap-2">
                {STRUCTURED_COMMAND_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setCommandQuery(example)}
                    className="rounded-full border border-border bg-background/60 px-3 py-1 font-code text-[8px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
                {commandItems.map((item) => (
                  <button
                    key={`${item.section}-${item.id}`}
                    type="button"
                    onClick={() => handleCommandSelect(item)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="min-w-0 pr-3">
                      <span className="block font-medium text-foreground">{item.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                      {(item.intellectualStage || item.hierarchyLevel) ? (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {item.intellectualStage && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 font-code text-[8px] uppercase tracking-[0.16em] text-accent">
                              {item.intellectualStage}
                            </span>
                          )}
                          {item.hierarchyLevel && (
                            <span className="rounded-full border border-border px-2 py-0.5 font-code text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
                              {item.hierarchyLevel}
                            </span>
                          )}
                        </span>
                      ) : null}
                      {(commandQuery.trim() && (item.matchedBecause || item.connectedConcepts?.length || item.relatedObjects?.length)) ? (
                        <span className="mt-2 block rounded-xl bg-accent/5 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                          <span className="font-code text-[8px] uppercase tracking-[0.16em] text-accent">Matched Because </span>
                          {item.matchedBecause || (
                            item.connectedConcepts?.length
                              ? `It is connected to ${item.connectedConcepts.slice(0, 3).join(', ')}.`
                              : `It has related context: ${item.relatedObjects?.slice(0, 2).join(', ')}.`
                          )}
                        </span>
                      ) : null}
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
                  {previewType}
                </span>
                <span className="rounded-full bg-accent/10 px-2.5 py-1 font-code text-[9px] uppercase tracking-[0.16em] text-accent">
                  {previewState}
                </span>
                {previewItem?.intellectualStage && (
                  <span className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 font-code text-[9px] uppercase tracking-[0.16em] text-accent">
                    {previewItem.intellectualStage}
                  </span>
                )}
                <span className={`rounded-full border px-2.5 py-1 font-code text-[9px] uppercase tracking-[0.16em] ${
                  previewActivityClass === 'meaningful'
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : previewActivityClass === 'non_meaningful'
                      ? 'border-border bg-muted/20 text-muted-foreground'
                      : 'border-border bg-card text-muted-foreground'
                }`}>
                  {previewActivityClass === 'meaningful' ? 'Meaningful' : previewActivityClass === 'non_meaningful' ? 'Navigation' : 'Orientation'}
                </span>
              </div>
              <SheetTitle className="font-headline text-2xl font-semibold italic leading-tight text-foreground/85">
                {previewItem?.label || 'Object Preview'}
              </SheetTitle>
              <SheetDescription className="text-sm leading-6">
                {previewSummary}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Orientation</div>
                  <div className="mt-3 grid gap-3 text-sm leading-6">
                    <div>
                      <div className="font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Current State</div>
                      <p className="mt-1 text-muted-foreground">{previewState}</p>
                    </div>
                    <div>
                      <div className="font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Why This Appeared</div>
                      <p className="mt-1 text-muted-foreground">{previewMatchedReason}</p>
                    </div>
                    {(previewItem?.intellectualStage || previewItem?.hierarchyLevel) && (
                      <div>
                        <div className="font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Noesis Stage</div>
                        <p className="mt-1 text-muted-foreground">
                          {previewItem?.intellectualStage || 'Navigate'}
                          {previewItem?.hierarchyLevel ? ` - ${previewItem.hierarchyLevel} layer` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Activity Rule</div>
                    <span className={`rounded-full px-2.5 py-1 font-code text-[8px] uppercase tracking-[0.16em] ${
                      previewActivityClass === 'meaningful'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-muted/25 text-muted-foreground'
                    }`}>
                      {previewActivityClass === 'meaningful'
                        ? 'Can create thinking event'
                        : previewActivityClass === 'non_meaningful'
                          ? 'No thinking event'
                          : 'Preview only'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{previewThinkingEventHint}</p>
                </section>

                {previewThoughtPath.length ? (
                  <section className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Thought Path</div>
                    <div className="mt-3 space-y-2">
                      {previewThoughtPath.map((step, index) => (
                        <div key={step.stage} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`grid size-6 place-items-center rounded-full border font-code text-[8px] ${
                              step.active
                                ? 'border-accent bg-accent text-accent-foreground'
                                : 'border-border bg-card text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            {index < previewThoughtPath.length - 1 && <div className="h-6 w-px bg-border" />}
                          </div>
                          <div className="min-w-0 pb-2">
                            <div className={`font-code text-[9px] uppercase tracking-[0.16em] ${step.active ? 'text-accent' : 'text-muted-foreground'}`}>
                              {step.stage}
                            </div>
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 rounded-xl bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      This preview orients the object in the Noesis flow. Full editing still belongs on the object page.
                    </p>
                  </section>
                ) : null}

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
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">No concept connections are available in this preview. Open the full page to inspect its complete relationship context.</p>
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
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">No related objects are indexed for this preview yet. Relationship panels on the full page may contain more detail.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Last Meaningful Change</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {previewItem?.lastChangedAt || 'No change date available.'}
                  </p>
                </section>

                {previewQuickActions.length ? (
                  <section className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Quick Actions</div>
                    <div className="mt-3 grid gap-2">
                      {previewQuickActions.map((action) => (
                        <Button
                          key={`${action.view}-${action.targetId || action.label}`}
                          variant="outline"
                          className="justify-between rounded-xl"
                          onClick={() => {
                            if (!previewItem) return;
                            openPreviewItem({
                              ...previewItem,
                              view: action.view,
                              targetId: action.targetId,
                              targetType: action.targetType,
                              quickActionLabel: action.label,
                            });
                          }}
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
