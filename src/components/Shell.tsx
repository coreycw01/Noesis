
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  Search,
  WifiOff,
  Check,
  LoaderCircle,
  CloudAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { NOESIS_NAV_SECTIONS, NOESIS_NAV_SECTION_TONE, NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';
import type { NoesisRouteTargetType } from '@/lib/noesis-routes';
import { NOESIS_OBJECT_PREVIEW_EVENT, type NoesisObjectPreviewItem } from '@/lib/noesis-object-preview';
import placeholderData from '@/app/lib/placeholder-images.json';
import { NOESIS_WORKSPACE_SYNC_EVENT, type WorkspaceSyncState } from '@/lib/workspace-connectivity';
import { MOBILE_REFRESH_THRESHOLD, mobilePullDistance, shouldRefreshFromPull } from '@/lib/mobile-refresh';
import { iconForNoesisView } from '@/lib/noesis-icons';
import { LoopDock, useNavStyle } from '@/components/app-shell/LoopDock';
import { findMatchRank } from '@/lib/workspace-find-rank';
import { readBrowserPreference, writeBrowserPreference } from '@/lib/browser-preferences';

import type { WorkspaceAttentionMetrics as MovementMetrics } from '@/lib/workspace-attention';
export type { WorkspaceAttentionMetrics as MovementMetrics } from '@/lib/workspace-attention';

export interface CommandPaletteItem {
  id: string;
  label: string;
  section: string;
  description: string;
  view: string;
  targetId?: string | null;
  targetType?: NoesisRouteTargetType;
  annotationSourceId?: string;
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

const MAX_RECENT_COMMAND_ITEMS = 8;

function WorkspaceSyncIndicator({ state, compact = false, offline = false }: { state: WorkspaceSyncState | 'idle'; compact?: boolean; offline?: boolean }) {
  const visibleState = offline ? 'error' : state;
  const label = offline
    ? 'Offline'
    : visibleState === 'saving'
      ? 'Saving'
      : visibleState === 'waiting'
        ? 'Waiting for server'
      : visibleState === 'saved'
        ? 'Saved'
        : visibleState === 'error'
          ? 'Save failed'
          : 'Synced';
  const Icon = visibleState === 'saving' ? LoaderCircle : visibleState === 'error' || visibleState === 'waiting' ? CloudAlert : Check;

  return (
    <span
      role="status"
      aria-live="polite"
      title={label}
      className={cn(
        'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-[9px] font-medium',
        visibleState === 'error' ? 'text-destructive' : visibleState === 'saving' ? 'text-accent' : 'text-sidebar-foreground/45',
        compact && 'justify-center px-1.5'
      )}
    >
      <Icon className={cn('size-3.5', visibleState === 'saving' && 'animate-spin')} aria-hidden="true" />
      <span className={compact ? 'sr-only' : undefined}>{label}</span>
    </span>
  );
}
const STRUCTURED_COMMAND_EXAMPLES = [
  'identity',
  'unfinished inquiry',
  'current position',
  'recent source',
  'practice result',
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
  pendingPath?: string | null;
  onViewChange: (view: string) => void;
  onOpenProfile?: () => void;
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
  movement?: MovementMetrics;
  profile?: {
    displayName?: string;
    email?: string;
    photoURL?: string;
    avatarUrl?: string;
    role?: string;
  };
  workspaceMode?: string;
  loadCommandItems?: (signal: AbortSignal) => Promise<{ items: CommandPaletteItem[]; cached?: boolean }>;
  onCommandSelect?: (item: CommandPaletteItem) => void;
}

export function Shell({ children, activeView, pendingPath, onViewChange, onOpenProfile, counts, movement, profile, workspaceMode, loadCommandItems, onCommandSelect }: ShellProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const navStyle = useNavStyle();
  const loopNav = navStyle === 'loop' && !isMobile;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      const layer = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]');
      if (layer) {
        event.preventDefault();
        (document.activeElement || layer).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      } else if (typeof window.history.state?.noesisPath === 'string') {
        // WebView can omit same-document pushState entries from canGoBack().
        event.preventDefault();
        window.history.back();
      }
    };
    window.addEventListener('noesis:native-back', handleNativeBack);
    return () => window.removeEventListener('noesis:native-back', handleNativeBack);
  }, []);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const pullGestureRef = useRef<{
    startX: number;
    startY: number;
    scrollElement: HTMLElement | null;
    eligible: boolean;
  } | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandPurpose, setCommandPurpose] = useState<'find' | 'create'>('find');
  const [workspaceSearch, setWorkspaceSearch] = useState<{ load: NonNullable<ShellProps['loadCommandItems']>; items?: CommandPaletteItem[]; cached?: boolean } | null>(null);
  const [commandQuery, setCommandQuery] = useState('');
  const [previewItem, setPreviewItem] = useState<CommandPaletteItem | null>(null);
  const [recentCommandItems, setRecentCommandItems] = useState<CommandPaletteItem[]>([]);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const commandOpener = useRef<HTMLElement | null>(null);
  const attentionOpener = useRef<HTMLElement | null>(null);
  const previewOpener = useRef<HTMLElement | null>(null);
  const restoreOverlayFocus = (opener: React.RefObject<HTMLElement | null>, event: Event) => {
    event.preventDefault();
    const element = opener.current;
    opener.current = null;
    if (element?.isConnected && !element.closest('[inert]')) element.focus({ preventScroll: true });
  };
  const openCommand = (purpose: 'find' | 'create', opener: HTMLElement) => {
    commandOpener.current = opener;
    setCommandPurpose(purpose);
    setCommandQuery('');
    setCommandOpen(true);
  };
  const [isOnline, setIsOnline] = useState(true);
  const [syncState, setSyncState] = useState<WorkspaceSyncState | 'idle'>('idle');
  const navItems = useMemo(() => [
    { id: 'home', icon: iconForNoesisView('home') },
    { id: 'concepts', icon: iconForNoesisView('concepts'), count: counts.concepts },
    { id: 'questions', icon: iconForNoesisView('questions'), count: counts.questions },
    { id: 'library', icon: iconForNoesisView('library'), count: counts.media },
    { id: 'annotations', icon: iconForNoesisView('annotations'), count: counts.annotations },
    { id: 'vault', icon: iconForNoesisView('vault'), count: counts.vault },
    { id: 'writing', icon: iconForNoesisView('writing'), count: counts.drafts },
    { id: 'context-desk', icon: iconForNoesisView('context-desk') },
    { id: 'exercises', icon: iconForNoesisView('exercises') },
    { id: 'labs', icon: iconForNoesisView('labs'), count: counts.practices },
    { id: 'evolution', icon: iconForNoesisView('evolution'), count: counts.timeline },
    { id: 'atlas', icon: iconForNoesisView('atlas') },
    { id: 'settings', icon: iconForNoesisView('settings') },
  ], [counts.annotations, counts.concepts, counts.drafts, counts.media, counts.practices, counts.questions, counts.timeline, counts.vault]);

  useEffect(() => {
    const updateConnectivity = () => setIsOnline(navigator.onLine);
    updateConnectivity();
    window.addEventListener('online', updateConnectivity);
    window.addEventListener('offline', updateConnectivity);
    return () => {
      window.removeEventListener('online', updateConnectivity);
      window.removeEventListener('offline', updateConnectivity);
    };
  }, []);

  useEffect(() => {
    let savedTimer: ReturnType<typeof setTimeout> | undefined;
    const onWorkspaceSync = (event: Event) => {
      const state = (event as CustomEvent<{ state?: WorkspaceSyncState }>).detail?.state;
      if (!state) return;
      if (savedTimer) clearTimeout(savedTimer);
      setSyncState(state);
      if (state === 'saved') savedTimer = setTimeout(() => setSyncState('idle'), 2400);
    };
    window.addEventListener(NOESIS_WORKSPACE_SYNC_EVENT, onWorkspaceSync);
    return () => {
      if (savedTimer) clearTimeout(savedTimer);
      window.removeEventListener(NOESIS_WORKSPACE_SYNC_EVENT, onWorkspaceSync);
    };
  }, []);

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
    const saved = readBrowserPreference('noesis:sidebar-collapsed');
    if (saved) setCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    try {
      window.localStorage.removeItem('noesis:recent-command-items');
    } catch { /* Optional legacy cleanup. */ }
  }, []);


  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (document.activeElement?.closest('[role="dialog"], [role="alertdialog"]')) return;
        event.preventDefault();
        setCommandPurpose('find');
        setCommandQuery('');
        commandOpener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : [...document.querySelectorAll<HTMLElement>('[data-noesis-find]')].find((element) => element.getClientRects().length > 0) ?? null;
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onPreviewObject = (event: Event) => {
      const detail = (event as CustomEvent<NoesisObjectPreviewItem>).detail;
      if (!detail?.id || !detail.label || !detail.view) return;
      previewOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPreviewItem({
        ...detail,
        kind: detail.kind || 'object',
        activityClass: detail.activityClass || 'orientation',
      });
    };
    window.addEventListener(NOESIS_OBJECT_PREVIEW_EVENT, onPreviewObject);
    return () => window.removeEventListener(NOESIS_OBJECT_PREVIEW_EVENT, onPreviewObject);
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeBrowserPreference('noesis:sidebar-collapsed', String(next));
  };
  const handleNavChange = (view: string) => {
    onViewChange(view);
    setMobileNavOpen(false);
    setMobileMoreOpen(false);
    setCommandOpen(false);
    setCommandQuery('');
  };

  const findMobileScrollElement = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return null;
    let element: HTMLElement | null = target;
    while (element && !element.classList.contains('noesis-app-main')) {
      const style = window.getComputedStyle(element);
      const canScroll = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      if (canScroll) return element;
      element = element.parentElement;
    }
    return null;
  };

  const cancelMobilePull = () => {
    pullGestureRef.current = null;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  };

  const mobileRefreshBlocked = !isMobile || !isOnline || isRefreshing || Boolean(pendingPath)
    || mobileNavOpen || mobileMoreOpen || commandOpen || syncState === 'saving' || syncState === 'waiting';

  const handleMobileTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (isRefreshing) return;
    cancelMobilePull();
    if (mobileRefreshBlocked || event.touches.length !== 1) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], .touch-none')) return;
    const touch = event.touches[0];
    const scrollElement = findMobileScrollElement(target instanceof Element && !(target instanceof HTMLElement) ? target.parentElement : target);
    const atTop = scrollElement ? scrollElement.scrollTop <= 0 : window.scrollY <= 0;
    pullGestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      scrollElement,
      eligible: atTop,
    };
  };

  const handleMobileTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const gesture = pullGestureRef.current;
    if (!gesture?.eligible) return;
    if (mobileRefreshBlocked || event.touches.length !== 1) {
      cancelMobilePull();
      return;
    }
    const touch = event.touches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const stillAtTop = gesture.scrollElement ? gesture.scrollElement.scrollTop <= 0 : window.scrollY <= 0;
    const nextDistance = mobilePullDistance(deltaX, deltaY, stillAtTop);
    if (nextDistance === null) {
      cancelMobilePull();
      return;
    }
    pullDistanceRef.current = nextDistance;
    setPullDistance(nextDistance);
  };

  const finishMobilePull = () => {
    const shouldRefresh = shouldRefreshFromPull(pullDistanceRef.current, Boolean(pullGestureRef.current?.eligible), mobileRefreshBlocked);
    cancelMobilePull();
    if (!shouldRefresh) return;
    setIsRefreshing(true);
    setPullDistance(MOBILE_REFRESH_THRESHOLD);
    window.setTimeout(() => window.location.reload(), 140);
  };

  useEffect(() => {
    if (!commandOpen || commandPurpose !== 'find' || !loadCommandItems || workspaceSearch?.load === loadCommandItems) return;
    const request = new AbortController();
    const timer = window.setTimeout(() => {
      request.abort();
      setWorkspaceSearch({ load: loadCommandItems });
    }, 12_000);
    void loadCommandItems(request.signal).then(
      (result) => { if (!request.signal.aborted) setWorkspaceSearch({ load: loadCommandItems, ...result }); },
      () => { if (!request.signal.aborted) setWorkspaceSearch({ load: loadCommandItems }); },
    ).finally(() => window.clearTimeout(timer));
    return () => { request.abort(); window.clearTimeout(timer); };
  }, [commandOpen, commandPurpose, loadCommandItems, workspaceSearch]);
  useEffect(() => {
    if (!commandOpen) setWorkspaceSearch(null);
  }, [commandOpen]);
  const indexedWorkspace = workspaceSearch?.load === loadCommandItems ? workspaceSearch : null;
  const indexingWorkspace = Boolean(commandOpen && commandPurpose === 'find' && loadCommandItems && !indexedWorkspace);

  const commandItems = useMemo<CommandPaletteItem[]>(() => {
    if (!commandOpen) return [];
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
      { id: 'start-practice', label: 'Start Practice', section: 'Create', description: 'Open Labs to turn an idea into a lived test.', view: 'labs', kind: 'create' as const, intellectualStage: 'Test', hierarchyLevel: 'Expression', objectType: 'Practice', activityClass: 'meaningful' as const, thinkingEventHint: 'Creating, concluding, or logging a practice result that changes a belief should create a thinking event.', aliases: ['open labs', 'start experiment', 'test belief', 'behavioral commitment', 'lived test', 'practice result'] },
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
    const availableItems = commandPurpose === 'create'
      ? creation
      : [...recent, ...core, ...utilities, ...(indexedWorkspace?.items ?? [])];
    return availableItems
      .map((item) => {
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
        return { item, rank: findMatchRank(query, item.label, searchable) };
      })
      .filter(({ rank }) => rank > 0)
      .sort((left, right) => right.rank - left.rank)
      .slice(0, 18)
      .map(({ item }) => item);
  }, [commandOpen, commandPurpose, commandQuery, indexedWorkspace, navItems, recentCommandItems]);

  const rememberCommandItem = (item: CommandPaletteItem) => {
    if (!item.targetId || item.kind !== 'object') return;
    setRecentCommandItems((current) => {
      const cleanId = item.id.replace(/^recent-/, '');
      const nextItem = { ...item, id: cleanId, section: item.section === 'Recent' ? 'Object' : item.section };
      return [nextItem, ...current.filter((entry) => entry.targetId !== item.targetId || entry.view !== item.view || entry.annotationSourceId !== item.annotationSourceId)]
        .slice(0, MAX_RECENT_COMMAND_ITEMS);
    });
  };

  const handleCommandSelect = (item: CommandPaletteItem) => {
    if (item.kind === 'object' || item.targetId) {
      rememberCommandItem(item);
      previewOpener.current = commandOpener.current;
      commandOpener.current = null;
      setPreviewItem(item);
      setCommandOpen(false);
      setCommandQuery('');
      return;
    }
    if (item.view !== activeView) commandOpener.current = null;
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
    if (item.view !== activeView || item.targetType) previewOpener.current = null;
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
  const activePageView = activeView === 'goals' ? 'labs' : activeView;
  const activePage = NOESIS_PAGE_BY_VIEW[activePageView as keyof typeof NOESIS_PAGE_BY_VIEW] || NOESIS_PAGE_BY_VIEW.home;
  const mobilePrimaryViews = new Set(['home', 'library', 'questions', 'vault']);
  const mobileMoreItems = [
    ...navItems.filter((item) => !mobilePrimaryViews.has(item.id)),
    { id: 'profile', icon: iconForNoesisView('profile') },
  ];
  const activeMobileMoreItem = mobileMoreItems.find((item) => item.id === activeView || (item.id === 'labs' && activeView === 'goals'));
  const activeMobileMorePage = activeMobileMoreItem
    ? NOESIS_PAGE_BY_VIEW[activeMobileMoreItem.id as keyof typeof NOESIS_PAGE_BY_VIEW]
    : null;
  const mobilePrimaryNav = [
    { id: 'home', label: 'Today', icon: iconForNoesisView('home'), view: 'home' },
    { id: 'library', label: 'Library', icon: iconForNoesisView('library'), view: 'library' },
    { id: 'questions', label: 'Inquiries', icon: iconForNoesisView('questions'), view: 'questions' },
    { id: 'vault', label: 'Positions', icon: iconForNoesisView('vault'), view: 'vault' },
  ];
  const attentionTotal = movement?.uniqueTotal || 0;
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
      label: 'Active inquiries',
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
      count: movement?.unanchoredPractices || 0,
      description: 'Add a reason or link an inquiry, concept, source, or position to give the practice an intellectual basis.',
      view: 'labs',
    },
  ].filter((item) => item.count > 0);

  const renderNavButton = (item: typeof navItems[number]) => {
    const page = NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW];
    const isActive = activeView === item.id || (item.id === 'labs' && activeView === 'goals');
    const button = (
      <button
        onClick={() => {
          if (item.id === 'labs' && activeView === 'goals') {
            try { window.localStorage.setItem('noesis:labs-tool', 'practices'); } catch { /* Optional view preference. */ }
          }
          handleNavChange(item.id);
        }}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'w-full flex items-center transition-all group',
          collapsed && !isMobile ? 'justify-center px-3 py-2.5' : 'gap-2.5 px-5 py-2.5',
          'border-l-2 duration-150',
          isActive
            ? 'noesis-nav-item--active bg-sidebar-foreground/[0.07] text-sidebar-foreground'
            : 'border-transparent text-sidebar-foreground/62 hover:border-sidebar-foreground/20 hover:bg-sidebar-foreground/[0.04] hover:text-sidebar-foreground'
        )}
      >
        <item.icon className="noesis-nav-item__icon size-4 shrink-0" />
        {(!collapsed || isMobile) && (
          <>
            <span className={cn('text-[13px] font-body tracking-wide flex-1 text-left', isActive ? 'font-semibold' : 'font-medium')}>{page.title}</span>
            {typeof item.count === 'number' && (
              <span className="rounded-full bg-sidebar-foreground/10 px-2 py-0.5 noesis-figure noesis-figure--sm text-sidebar-foreground/65">{item.count}</span>
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
      <div className={cn("shrink-0 border-b border-sidebar-border", collapsed && !isMobile ? "p-3" : "p-5")}>
        <div className={cn("mb-2 flex", collapsed && !isMobile ? "flex-col items-center gap-3" : "items-start gap-3")}>
          <div className={cn("flex items-center", collapsed && !isMobile ? "justify-center" : "gap-3")}>
            <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-brand-paper shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_6px_18px_rgba(0,0,0,0.22)]">
              {logoData && (
                <Image
                  src={logoData.imageUrl}
                  alt={logoData.description}
                  width={44}
                  height={44}
                  className="size-full object-contain"
                  priority
                />
              )}
            </div>
            {(!collapsed || isMobile) && (
              <div>
                <span className="text-[25px] font-headline font-bold text-sidebar-foreground tracking-tight">Noesis<span className="text-accent">.</span></span>
                <p className="noesis-eyebrow noesis-eyebrow--sm text-sidebar-foreground/35 font-medium">Turn thought into understanding.</p>
              </div>
            )}
          </div>
        </div>

        <div className={cn("mt-2 flex items-center", collapsed && !isMobile ? "justify-center" : "justify-end")}>
          <Button
            variant="ghost"
            size="icon"
            onClick={isMobile ? () => setMobileNavOpen(false) : toggleSidebar}
            className="rounded-full text-sidebar-foreground/55 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
            aria-label={isMobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isMobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isMobile ? <ChevronLeft className="size-4" /> : <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />}
          </Button>
        </div>

        <button
          type="button"
          onClick={onOpenProfile || (() => handleNavChange('profile'))}
          className={cn(
            "group flex items-center rounded-2xl border border-sidebar-border bg-sidebar-foreground/5 transition-colors hover:border-sidebar-foreground/20 hover:bg-sidebar-foreground/10",
            collapsed && !isMobile ? "mt-2 w-full justify-center p-2.5" : "mt-2 w-full gap-3 px-3 py-2.5"
          )}
          title="Open profile"
        >
          <Avatar className="size-9 border border-sidebar-border">
            <AvatarImage src={profile?.photoURL || profile?.avatarUrl || ''} alt={profile?.displayName || 'Profile'} />
            <AvatarFallback className="bg-sidebar-foreground/10 text-[11px] font-semibold text-sidebar-foreground">
              {profileInitials}
            </AvatarFallback>
          </Avatar>
          {(!collapsed || isMobile) && (
            <div className="min-w-0 text-left">
              <div className="truncate text-[12px] font-medium text-sidebar-foreground">{profile?.displayName || 'Profile'}</div>
              <div className="truncate noesis-eyebrow noesis-eyebrow--sm text-sidebar-foreground/38">
                {workspaceMode || profile?.role || 'Private workspace'}
              </div>
            </div>
          )}
        </button>

      </div>

      {attentionTotal > 0 && (
        <div className={cn("shrink-0 border-b border-sidebar-border", collapsed && !isMobile ? "px-3 py-3" : "px-5 py-3")}>
          <button
            type="button"
            onClick={(event) => { attentionOpener.current = event.currentTarget; setAttentionOpen(true); }}
            className={cn(
              "group flex w-full items-center rounded-full border border-accent/30 bg-accent/10 text-sidebar-foreground transition-colors hover:border-accent/45 hover:bg-accent/15",
              collapsed && !isMobile ? "justify-center p-2.5" : "gap-2 px-3 py-2"
            )}
            title={`${attentionTotal} item${attentionTotal === 1 ? '' : 's'} need attention`}
          >
            <span className="relative" aria-hidden="true">
              <AlertTriangle className="size-4 text-sidebar-primary" />
              <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 noesis-figure noesis-figure--sm font-bold text-accent-foreground">
                {attentionTotal > 9 ? '9+' : attentionTotal}
              </span>
            </span>
            {(!collapsed || isMobile) ? (
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate noesis-eyebrow noesis-eyebrow--sm font-bold text-sidebar-primary">Attention</span>
                <span className="block truncate text-[11px] text-sidebar-foreground/55">{attentionTotal} item{attentionTotal === 1 ? '' : 's'} to review</span>
              </span>
            ) : <span className="sr-only">Attention {attentionTotal} item{attentionTotal === 1 ? '' : 's'} to review</span>}
          </button>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto py-4 scrollbar-hide">
        {NOESIS_NAV_SECTIONS.map((section) => (
          <div key={section} className="noesis-nav-section mb-5" data-stage={NOESIS_NAV_SECTION_TONE[section]}>
            {(!collapsed || isMobile) && section !== 'Today' && (
              <div className="px-5 mb-1">
                <h4 className="noesis-nav-section__label noesis-eyebrow noesis-eyebrow--sm font-bold">{section}</h4>
              </div>
            )}
            <ul className="space-y-1">
              {navItems.filter((item) => NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW].section === section).map((item) => (
                <li key={item.id}>{renderNavButton(item)}</li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-sidebar-border bg-transparent", collapsed && !isMobile ? "p-3 text-center" : "p-4")}>
        <button
          type="button"
          data-noesis-find
          onClick={(event) => openCommand('find', event.currentTarget)}
          className={cn(
            "mb-2 flex w-full items-center rounded-xl border border-sidebar-border bg-sidebar-foreground/5 text-sidebar-foreground/55 transition-colors hover:border-sidebar-foreground/20 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
            collapsed && !isMobile ? "justify-center p-2.5" : "gap-2 px-3 py-2"
          )}
          aria-keyshortcuts="Control+k Meta+k"
          title="Find in Noesis (Ctrl K)"
        >
          <Search className="size-4 shrink-0" />
          <span className={collapsed && !isMobile ? "sr-only" : "flex-1 text-left noesis-eyebrow noesis-eyebrow--sm"}>Find in Noesis</span>
          {(!collapsed || isMobile) && (
              <span aria-hidden="true" className="noesis-eyebrow noesis-eyebrow--sm text-sidebar-foreground/60">Ctrl K</span>
          )}
        </button>
        <div className={cn('flex items-center gap-2', collapsed && !isMobile ? 'justify-center' : 'justify-between')}>
          {(!collapsed || isMobile) && <span className="text-[9px] font-code text-sidebar-foreground/20">v1.3.0 cloud</span>}
          <WorkspaceSyncIndicator state={isOnline ? syncState : 'error'} compact={collapsed && !isMobile} offline={!isOnline} />
        </div>
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={160}>
      <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
      <div className="noesis-app flex h-[100dvh] w-full overflow-hidden bg-background">
        <a href="#noesis-main-content" onClick={(event) => {
          const main = document.getElementById('noesis-main-content');
          if (!main) return;
          event.preventDefault();
          main.focus({ preventScroll: true });
        }} className="sr-only z-[60] focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:rounded-[var(--button-radius)] focus:bg-surface focus:px-4 focus:py-3 focus:text-foreground focus:outline focus:outline-2 focus:outline-ring">
          Skip to workspace content
        </a>
        {!isMobile && !loopNav && (
          <aside aria-label="Workspace sidebar" className={cn(
            "noesis-sidebar hidden md:flex bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border z-20 transition-[width] duration-300 ease-out",
            collapsed ? "w-[84px]" : "w-[252px]"
          )}>
            {sidebarContent}
          </aside>
        )}

        {isMobile && (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <header className="noesis-mobile-header fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-background/95 px-3 shadow-sm backdrop-blur md:hidden">
              <SheetTrigger asChild><Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button></SheetTrigger>
              <div className="min-w-0 flex-1">
                <div className="truncate font-headline text-lg font-semibold italic leading-none text-foreground/85">{activePage.title}</div>
                <div className="mt-0.5 truncate noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{activePage.section}</div>
              </div>
              <WorkspaceSyncIndicator state={isOnline ? syncState : 'error'} compact offline={!isOnline} />
              <Button
                variant="outline"
                size="icon"
                data-noesis-find
                onClick={(event) => openCommand('find', event.currentTarget)}
                className="size-9 rounded-full border-border/60 bg-card shadow-sm"
                aria-label="Find in Noesis"
              >
                <Search className="size-4" />
              </Button>
            </header>
              <SheetContent side="left" aria-describedby={undefined} className="noesis-sidebar w-[280px] border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col">{sidebarContent}</div>
              </SheetContent>
          </Sheet>
        )}
        {isMobile && (
              <SheetContent side="bottom" className="max-h-[78dvh] rounded-t-2xl border-border bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
                <SheetHeader className="border-b border-border/70 pb-3 text-left">
                  <SheetTitle className="font-headline text-xl font-semibold italic">More pages</SheetTitle>
                  <SheetDescription>Open another part of your thinking workspace.</SheetDescription>
                </SheetHeader>
                <div className="grid max-h-[58dvh] grid-cols-2 gap-2 overflow-y-auto py-4">
                  {mobileMoreItems.map((item) => {
                    const page = NOESIS_PAGE_BY_VIEW[item.id as keyof typeof NOESIS_PAGE_BY_VIEW];
                    const isActive = activeView === item.id || (item.id === 'labs' && activeView === 'goals');
                    const count = 'count' in item ? item.count : undefined;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.id === 'profile' && onOpenProfile) {
                            setMobileMoreOpen(false);
                            onOpenProfile();
                            return;
                          }
                          if (item.id === 'labs' && activeView === 'goals') {
                            try { window.localStorage.setItem('noesis:labs-tool', 'practices'); } catch { /* Optional view preference. */ }
                          }
                          handleNavChange(item.id);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex min-h-[76px] items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'border-accent/45 bg-accent/10 text-foreground'
                            : 'border-border/70 bg-card text-foreground hover:border-accent/35 hover:bg-muted/35'
                        )}
                      >
                        <item.icon className={cn('mt-0.5 size-5 shrink-0', isActive ? 'text-accent' : 'text-muted-foreground')} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="min-w-0 break-words text-sm font-semibold">{page.title}</span>
                            {typeof count === 'number' && <span className="noesis-figure text-muted-foreground">{count}</span>}
                          </span>
                          <span className="mt-1 block line-clamp-2 text-xs leading-4 text-muted-foreground">{page.purpose}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
        )}

        <main
          id="noesis-main-content"
          tabIndex={-1}
          className={cn("noesis-app-main relative flex min-w-0 flex-1 flex-col overflow-hidden pb-32 pt-14 md:pb-0 md:pt-0", loopNav && "noesis-app-main--loop")}
          data-stage-tone={activePage.section === 'Today' ? 'today' : NOESIS_NAV_SECTION_TONE[activePage.section]}
          aria-busy={Boolean(pendingPath)}
          onTouchStart={handleMobileTouchStart}
          onTouchMove={handleMobileTouchMove}
          onTouchEnd={finishMobilePull}
          onTouchCancel={cancelMobilePull}
        >
          {isMobile && (pullDistance > 0 || isRefreshing) && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none fixed left-1/2 top-[calc(3.75rem+env(safe-area-inset-top))] z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg transition-opacity"
              style={{ opacity: Math.min(1, Math.max(0.35, pullDistance / 64)) }}
            >
              <LoaderCircle className={cn('size-4 text-accent', isRefreshing && 'animate-spin')} aria-hidden="true" />
              <span>{isRefreshing ? 'Refreshing' : pullDistance >= MOBILE_REFRESH_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}</span>
            </div>
          )}
          {!isOnline && (
            <div role="status" className="flex shrink-0 items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs leading-5 text-foreground sm:px-6">
              <WifiOff className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              <span><strong className="font-medium">You&apos;re offline.</strong> Recent records may still be available. Keep this tab open and reconnect before saving.</span>
            </div>
          )}
          {children}
          {loopNav && (
            <div className="noesis-proto-topbar">
              <button type="button" className="noesis-proto-brand" onClick={() => handleNavChange('home')} aria-label="Noesis, go to Today">Noesis.</button>
              <button type="button" className="noesis-proto-profile" onClick={onOpenProfile || (() => handleNavChange('profile'))}>Profile</button>
            </div>
          )}
          {loopNav && (
            <LoopDock
              items={navItems}
              activeView={activeView}
              attention={attentionTotal}
              onNavigate={handleNavChange}
              onFind={(opener) => openCommand('find', opener)}
              onOpenProfile={onOpenProfile || (() => handleNavChange('profile'))}
            />
          )}
          {isMobile && (
            <nav className="noesis-mobile-nav fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-2 py-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden" aria-label="Primary mobile navigation">
              <div className="grid grid-cols-5 gap-1">
                {mobilePrimaryNav.map((item) => {
                  const isActive = activeView === item.view;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavChange(item.view)}
                      aria-label={`Open ${item.label}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 flex-col items-center justify-center rounded-2xl px-1 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive ? 'bg-accent/12 text-accent' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <item.icon className="size-[18px]" aria-hidden="true" />
                      <span className="mt-0.5 max-w-full whitespace-nowrap noesis-eyebrow noesis-eyebrow--sm">{item.label}</span>
                    </button>
                  );
                })}
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label={activeMobileMorePage ? `More pages, current page: ${activeMobileMorePage.title}` : 'More pages'}
                    className={cn(
                      'flex min-h-11 flex-col items-center justify-center rounded-[var(--button-radius)] px-1 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      activeMobileMorePage ? 'bg-accent/12 text-accent' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <Menu className="size-[18px]" aria-hidden="true" />
                    <span className="mt-0.5 noesis-eyebrow noesis-eyebrow--sm">More</span>
                  </button>
                </SheetTrigger>
              </div>
            </nav>
          )}
          {isMobile && activeView === 'home' && (
            <Button
              type="button"
              onClick={(event) => openCommand('create', event.currentTarget)}
              className="fixed bottom-[76px] right-4 z-40 size-12 rounded-full shadow-lg md:hidden"
              aria-label="Capture or create an item"
              title="Capture or create"
            >
              <Plus className="size-5" aria-hidden="true" />
            </Button>
          )}
        </main>

        <Dialog open={attentionOpen} onOpenChange={setAttentionOpen}>
          <DialogContent onCloseAutoFocus={(event) => restoreOverlayFocus(attentionOpener, event)} className="max-w-lg rounded-3xl border-border bg-card shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl font-semibold italic">Needs Attention</DialogTitle>
              <DialogDescription>
                {attentionTotal} distinct items need a next move. An item can appear in more than one category below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {attentionItems.length ? attentionItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.view !== activeView) attentionOpener.current = null;
                    setAttentionOpen(false);
                    handleNavChange(item.view);
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-accent/15 noesis-figure font-bold text-accent">
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
                  <div className="noesis-eyebrow font-bold text-muted-foreground">Clear</div>
                  <p className="mt-2 text-sm text-muted-foreground">Nothing currently needs attention.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
          <DialogContent onCloseAutoFocus={(event) => restoreOverlayFocus(commandOpener, event)} className="max-w-xl rounded-3xl border-border bg-card p-0 shadow-2xl">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle className="font-headline text-2xl font-semibold italic">{commandPurpose === 'find' ? 'Find in Noesis' : 'Create in Noesis'}</DialogTitle>
              <DialogDescription>{commandPurpose === 'find' ? 'Find and open an existing item or workspace.' : 'Choose the kind of thought you want to add.'}</DialogDescription>
            </DialogHeader>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  aria-label={commandPurpose === 'find' ? 'Find in Noesis' : 'Filter creation choices'}
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  placeholder={commandPurpose === 'find' ? 'Find concepts, inquiries, sources, positions...' : 'Filter creation choices...'}
                  className="h-11 rounded-full pl-9"
                />
              </div>
              {commandPurpose === 'find' && <div className="mt-3 flex flex-wrap gap-2">
                {STRUCTURED_COMMAND_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setCommandQuery(example)}
                    className="rounded-full border border-border bg-background/60 px-3 py-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>}
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
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 noesis-eyebrow noesis-eyebrow--sm text-accent">
                              {item.intellectualStage}
                            </span>
                          )}
                          {item.hierarchyLevel && (
                            <span className="rounded-full border border-border px-2 py-0.5 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">
                              {item.hierarchyLevel}
                            </span>
                          )}
                        </span>
                      ) : null}
                      {(commandQuery.trim() && (item.matchedBecause || item.connectedConcepts?.length || item.relatedObjects?.length)) ? (
                        <span className="mt-2 block rounded-xl bg-accent/5 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                          <span className="noesis-eyebrow noesis-eyebrow--sm text-accent">Matched Because </span>
                          {item.matchedBecause || (
                            item.connectedConcepts?.length
                              ? `It is connected to ${item.connectedConcepts.slice(0, 3).join(', ')}.`
                              : `It has related context: ${item.relatedObjects?.slice(0, 2).join(', ')}.`
                          )}
                        </span>
                      ) : null}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{item.section}</span>
                  </button>
                ))}
                {commandPurpose === 'find' && indexedWorkspace && !indexedWorkspace.items && (
                  <p role="status" className="px-2 py-3 text-sm text-muted-foreground">
                    Workspace items could not be loaded. <Button size="sm" variant="ghost" onClick={() => setWorkspaceSearch(null)}>Retry</Button>
                  </p>
                )}
                {indexingWorkspace && <p role="status" className="px-2 py-3 text-sm text-muted-foreground">Loading workspace items…</p>}
                {indexedWorkspace?.cached && <p role="status" className="px-2 py-3 text-sm text-muted-foreground">Offline: searching records saved on this device. Results may be incomplete.</p>}
                {!commandItems.length && !indexingWorkspace && !(commandPurpose === 'find' && indexedWorkspace && !indexedWorkspace.items) && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {commandPurpose === 'find' ? 'No matching items or destinations.' : 'No creation choices match.'}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Sheet open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <SheetContent onCloseAutoFocus={(event) => restoreOverlayFocus(previewOpener, event)} side="right" className="flex w-full flex-col gap-0 overflow-hidden border-l border-border bg-card p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-6 py-5 text-left">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">
                  {previewType}
                </span>
                <span className="rounded-full bg-accent/10 px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm text-accent">
                  {previewState}
                </span>
                {previewItem?.intellectualStage && (
                  <span className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm text-accent">
                    {previewItem.intellectualStage}
                  </span>
                )}
                <span className={`rounded-full border px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm ${
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
                  <div className="noesis-eyebrow text-muted-foreground">Orientation</div>
                  <div className="mt-3 grid gap-3 text-sm leading-6">
                    <div>
                      <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Current State</div>
                      <p className="mt-1 text-muted-foreground">{previewState}</p>
                    </div>
                    <div>
                      <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Why This Appeared</div>
                      <p className="mt-1 text-muted-foreground">{previewMatchedReason}</p>
                    </div>
                    {(previewItem?.intellectualStage || previewItem?.hierarchyLevel) && (
                      <div>
                        <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Noesis Stage</div>
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
                    <div className="noesis-eyebrow text-muted-foreground">Activity Rule</div>
                    <span className={`rounded-full px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm ${
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
                    <div className="noesis-eyebrow text-muted-foreground">Thought Path</div>
                    <div className="mt-3 space-y-2">
                      {previewThoughtPath.map((step, index) => (
                        <div key={step.stage} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`grid size-6 place-items-center rounded-full border noesis-figure noesis-figure--sm ${
                              step.active
                                ? 'border-accent bg-accent text-accent-foreground'
                                : 'border-border bg-card text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            {index < previewThoughtPath.length - 1 && <div className="h-6 w-px bg-border" />}
                          </div>
                          <div className="min-w-0 pb-2">
                            <div className={`noesis-eyebrow noesis-eyebrow--sm ${step.active ? 'text-accent' : 'text-muted-foreground'}`}>
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
                  <div className="noesis-eyebrow text-muted-foreground">Connected Concepts</div>
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
                  <div className="noesis-eyebrow text-muted-foreground">Related Objects</div>
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
                  <div className="noesis-eyebrow text-muted-foreground">Last Meaningful Change</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {previewItem?.lastChangedAt || 'No change date available.'}
                  </p>
                </section>

                {previewQuickActions.length ? (
                  <section className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="noesis-eyebrow text-muted-foreground">Quick Actions</div>
                    <div className="mt-3 grid gap-2">
                      {previewQuickActions.map((action) => (
                        <Button
                          key={`${action.view}-${action.targetId || action.label}`}
                          variant="outline"
                          className="justify-between"
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
                className="w-full"
                onClick={() => previewItem && openPreviewItem(previewItem)}
              >
                {previewItem?.quickActionLabel || 'Open Full Page'}
                <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      </Sheet>
    </TooltipProvider>
  );
}
