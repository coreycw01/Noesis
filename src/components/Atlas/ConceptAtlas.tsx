
"use client";

import './atlas-motion.css';
import { cssColor } from '@/lib/css-color';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { atlasFocusPan } from './atlas-keyboard-focus';
import { CalendarRange, FlaskConical, HelpCircle, Link2, Maximize, Minimize, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { normalizePositionConfidence } from '@/lib/workflow-integrity';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToastAction } from '@/components/ui/toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AtlasConnectionsView } from '@/components/Atlas/AtlasConnectionsView';
import { AtlasReviewQueue } from '@/components/Atlas/AtlasReviewQueue';
import { AtlasTerritoryView } from '@/components/Atlas/AtlasTerritoryView';
import { AtlasTensionsBoard } from '@/components/Atlas/AtlasTensionsBoard';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { SourceLinker } from '@/components/SourceLinker';
import type {
  AtlasAutoLinkFilters,
  AtlasMap,
  AtlasMapBackgroundPreset,
  AtlasMapFontFamily,
  AtlasMapLink,
  AtlasMapLinkType,
  AtlasMapNodeStyle,
  AtlasMapStyle,
  Concept,
  Draft,
  Insight,
  Media,
  PhilosophicalLink,
  PhilosophicalLinkType,
  Practice,
  Question,
  ThinkingEvent,
  TimelineEvent,
  Unknown,
  VaultEntry,
} from '@/lib/types';
import { conceptKey, conceptRelated, today, uid as makeId } from '@/lib/readex';
import { countAtlasConceptTags } from './atlas-tag-counts';
import { cn } from '@/lib/utils';
import { iconForNoesisView } from '@/lib/noesis-icons';
import { uploadPrivateAsset } from '@/lib/storage-assets';
import { usePrivateAssetUrl } from '@/hooks/use-private-asset-url';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  AtlasSection,
  deriveAtlasRegions,
  deriveAtlasSystemTensions,
  deriveAtlasTerritoryView,
  reconcileAtlasRegionNotices,
} from './atlas-diagnostics';
import { ATLAS_NODE_BOUNDS, atlasAutoNodePosition, atlasTerritoryPositions, atlasCanDrag, atlasCompactNodes, atlasMapScope, atlasMapTerms, atlasStoredZoom, atlasVisibleNodePosition, atlasZoomPlane } from './atlas-layout';
import { shouldTraceAtlasConnection, type AtlasConnectionTrace } from './atlas-connection-trace';
import { AtlasTerritoryCanvas } from './AtlasTerritoryCanvas';
import { navigateWorkspace } from '@/lib/workspace-navigation';
import { viewToPath } from '@/lib/noesis-routes';
import { atlasNodeTimelineState, atlasTimelineBounds, atlasTimelineDayValue, formatAtlasTimelineDate, type AtlasTimelineWindow } from './atlas-timeline';

interface ConceptAtlasProps {
  concepts: Concept[];
  media: Media[];
  insights: Insight[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  timeline: TimelineEvent[];
  atlasMaps: AtlasMap[];
  links: PhilosophicalLink[];
  thinkingEvents: ThinkingEvent[];
  unknowns: Unknown[];
  onAddConcept: (data: Partial<Concept>) => void | boolean | Promise<void | boolean>;
  onUpdateConcept: (concept: Concept) => void;
  onCreateLink?: (data: Partial<PhilosophicalLink>) => void | Promise<void>;
  onUpdateLink?: (link: PhilosophicalLink) => void;
  onAddAtlasMap: (data: Partial<AtlasMap>) => Promise<string>;
  onUpdateAtlasMap: (map: AtlasMap, rethrow?: boolean) => void | Promise<void>;
  onMoveAtlasMapNode: (mapId: string, key: string, position: { x: number; y: number }) => Promise<void>;
  onDeleteAtlasMap: (id: string) => Promise<void>;
  onDeleteLink?: (id: string, options?: { method?: string }) => Promise<void>;
  onInteractLink?: (id: string) => void;
  onOpenPosition?: (id: string) => void;
  onOpenQuestion?: (id: string) => void;
  onOpenSource?: (id: string) => void;
  onOpenWriting?: () => void;
  onOpenPractices?: () => void;
  uid?: string;
}

type MapNode = {
  name: string;
  concept?: Concept;
  count: number;
  x: number;
  y: number;
};

type MapEdge = {
  from: string;
  to: string;
  type: 'user' | 'concept' | 'shared' | 'typed';
  label: string;
  linkType?: AtlasMapLinkType;
  id?: string;
  weight?: number;
  strength?: 'strong' | 'moderate' | 'weak' | 'suggested';
  objectTypes?: Array<'concept' | 'position' | 'inquiry' | 'source' | 'annotation' | 'work' | 'practice'>;
  mapModes?: AtlasViewMode[];
  groupedLinkIds?: string[];
  groupedTypes?: PhilosophicalLinkType[];
  note?: string;
  interactionCount?: number;
  lastInteractedAt?: string;
};

type AtlasLinkItem = {
  id: string;
  kind: 'custom' | 'concept' | 'typed' | 'shared';
  from: string;
  to: string;
  label: string;
  linkType?: string;
  note?: string;
  removable: boolean;
  sourceLabel: string;
  sourceConceptId?: string;
  conceptTarget?: string;
  createdAt?: string;
  updatedAt?: string;
  lastInteractedAt?: string;
  interactionCount?: number;
  groupedLinkIds?: string[];
  relationshipTypes?: string[];
  objectTypes?: Array<'concept' | 'position' | 'inquiry' | 'source' | 'annotation' | 'work' | 'practice'>;
};

type AtlasRelationshipFilterMode = 'recommended' | 'all' | 'custom';

type AtlasRelationshipFamily = 'conflict' | 'support' | 'meaning' | 'practice' | 'evolution' | 'reference' | 'manual' | 'derived';

const defaultAutoLinkFilters: AtlasAutoLinkFilters = {
  sharedSources: true,
  sharedPositions: true,
  sharedInquiries: true,
  sharedWorks: true,
  sharedPractices: true,
  conceptLinks: true,
};
const defaultAtlasMapStyle: AtlasMapStyle = {
  lineMode: 'relationshipCategoryColor',
  customLineColor: '#7c3aed',
  background: {
    type: 'preset',
    preset: 'dark',
    opacity: 0.42,
    blur: 0,
  },
  fontFamily: 'system',
  nodeStyle: 'default',
  showWeakLinks: false,
};
const AtlasIcon = iconForNoesisView('atlas');
const ATLAS_BASE_ZOOM = 0.8;
const ATLAS_MIN_ZOOM = ATLAS_BASE_ZOOM / 2;
const ATLAS_MAX_ZOOM = 1.7;
const ATLAS_ZOOM_STEP = 0.08;
const ATLAS_ZOOM_STORAGE_KEY = 'noesis.atlas.zoom.v2';
function atlasConfidencePercent(confidence?: number) {
  return normalizePositionConfidence(confidence);
}
/* Colours a person picks for their own map. Stored as data, so literal. */
const atlasColorSwatches = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2', '#64748b'];

const linkTypes: AtlasMapLinkType[] = ['supports', 'challenges', 'coheres', 'defines', 'refines', 'contradicts', 'exemplifies', 'inspired_by', 'tested_by', 'expressed_in', 'changed_by', 'depends_on', 'explains', 'explained_by', 'derived_from', 'references', 'replaces', 'questions', 'expands', 'weakens', 'strengthens', 'relates', 'custom'];
const highImportanceLinkTypes = new Set<AtlasMapLinkType | PhilosophicalLinkType>(['contradicts', 'supports', 'challenges', 'depends_on', 'strengthens', 'weakens', 'tested_by', 'changed_by', 'refines']);
const moderateImportanceLinkTypes = new Set<AtlasMapLinkType | PhilosophicalLinkType>(['coheres', 'defines', 'explains', 'explained_by', 'questions', 'expands', 'replaces', 'derived_from']);
type AtlasViewMode = 'core' | 'conflict' | 'evidence' | 'practice' | 'evolution' | 'full';
const atlasRelationshipTypes = linkTypes.filter((type) => type !== 'relates' && type !== 'custom') as PhilosophicalLinkType[];
const atlasRelationshipGroups: Array<{ label: string; types: PhilosophicalLinkType[] }> = [
  { label: 'Reasoning', types: ['supports', 'challenges', 'contradicts', 'strengthens', 'weakens'] },
  { label: 'Meaning', types: ['defines', 'explains', 'explained_by', 'exemplifies', 'coheres'] },
  { label: 'Development', types: ['refines', 'replaces', 'expands', 'derived_from', 'changed_by'] },
  { label: 'Practice', types: ['tested_by', 'depends_on', 'expressed_in', 'questions'] },
  { label: 'Reference', types: ['references', 'inspired_by'] },
];
const recommendedRelationshipTypesByViewMode: Record<AtlasViewMode, PhilosophicalLinkType[]> = {
  core: ['supports', 'challenges', 'contradicts', 'depends_on', 'refines', 'strengthens', 'weakens', 'tested_by', 'defines', 'questions'],
  conflict: ['challenges', 'contradicts', 'weakens', 'questions'],
  evidence: ['supports', 'exemplifies', 'references', 'derived_from', 'strengthens'],
  practice: ['tested_by', 'depends_on', 'expressed_in', 'questions'],
  evolution: ['refines', 'replaces', 'changed_by', 'derived_from', 'strengthens', 'weakens'],
  full: atlasRelationshipTypes,
};

function normalizeAtlasMapStyle(style?: AtlasMapStyle): AtlasMapStyle {
  return {
    ...defaultAtlasMapStyle,
    ...style,
    background: {
      ...defaultAtlasMapStyle.background,
      ...(style?.background || {}),
    },
  };
}

function normalizeAtlasLinkType(type: AtlasMapLinkType): PhilosophicalLinkType {
  switch (type) {
    case 'custom':
    case 'relates':
      return 'coheres';
    case 'examples':
      return 'exemplifies';
    case 'causes':
      return 'explains';
    case 'practices':
      return 'tested_by';
    default:
      return type;
  }
}

function getAtlasRelationshipFamily(edge: Pick<MapEdge, 'linkType' | 'type'>): AtlasRelationshipFamily {
  const type = (edge.linkType || '').toString();
  if (['contradicts', 'challenges', 'weakens', 'questions'].includes(type)) return 'conflict';
  if (['supports', 'exemplifies', 'references', 'derived_from', 'strengthens'].includes(type)) return 'support';
  if (['defines', 'explains', 'explained_by', 'coheres'].includes(type)) return 'meaning';
  if (['tested_by', 'depends_on', 'expressed_in'].includes(type)) return 'practice';
  if (['refines', 'replaces', 'changed_by', 'expands'].includes(type)) return 'evolution';
  if (['inspired_by'].includes(type)) return 'reference';
  if (edge.type === 'user') return 'manual';
  return 'derived';
}

function atlasEdgePairKey(edge: Pick<MapEdge, 'from' | 'to'>) {
  return [conceptKey(edge.from), conceptKey(edge.to)].sort().join('::');
}

function atlasLinkColorKey(link: Pick<AtlasLinkItem, 'id' | 'kind' | 'from' | 'to'>) {
  if (link.kind === 'typed' && link.id.startsWith('typed-group:')) return link.id;
  if (link.kind === 'shared') return `shared:${[conceptKey(link.from), conceptKey(link.to)].sort().join('::')}`;
  if (link.kind === 'concept') return link.id;
  return link.id;
}


function edgePriorityScore(edge: MapEdge) {
  const strengthBonus = edge.strength === 'strong' ? 24 : edge.strength === 'moderate' ? 12 : edge.strength === 'weak' ? 2 : 0;
  const typeBonus = edge.type === 'typed' ? 24 : edge.type === 'concept' ? 14 : edge.type === 'user' ? 18 : 0;
  const relationshipBonus = highImportanceLinkTypes.has((edge.linkType || '') as AtlasMapLinkType | PhilosophicalLinkType)
    ? 14
    : moderateImportanceLinkTypes.has((edge.linkType || '') as AtlasMapLinkType | PhilosophicalLinkType)
      ? 8
      : 0;
  return (edge.weight || 0) + strengthBonus + typeBonus + relationshipBonus;
}

export function ConceptAtlas({
  concepts,
  media,
  insights,
  vault,
  drafts,
  practices,
  questions,
  timeline,
  atlasMaps,
  links,
  thinkingEvents,
  unknowns,
  onAddConcept,
  onUpdateConcept,
  onCreateLink,
  onUpdateLink,
  onAddAtlasMap,
  onUpdateAtlasMap,
  onMoveAtlasMapNode,
  onDeleteAtlasMap,
  onDeleteLink,
  onInteractLink,
  uid,
  onOpenPosition,
  onOpenQuestion,
  onOpenSource,
  onOpenWriting,
  onOpenPractices,
}: ConceptAtlasProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [zoom, setZoom] = useState(ATLAS_BASE_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  // The map shows every region unless one was opened from the Regions tab.
  const [mapRegionFocus, setMapRegionFocus] = useState(false);
  // Timeline replay: null shows the map as it stands now.
  const [timelineWindow, setTimelineWindow] = useState<AtlasTimelineWindow | null>(null);
  const [atlasSection, setAtlasSection] = useState<AtlasSection>('map');
  const [connectionsTab, setConnectionsTab] = useState<'relationships' | 'tensions'>('relationships');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const inspectorId = useId();
  const inspectorCloseRef = useRef<HTMLButtonElement>(null);
  const mapControlsRef = useRef<HTMLButtonElement>(null);
  const fullScreenButtonRef = useRef<HTMLButtonElement>(null);
  const nodeButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusInspectorRef = useRef(false);
  const suppressNodeClickRef = useRef(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [regionDetailOpen, setRegionDetailOpen] = useState(false);
  const [newRegionIds, setNewRegionIds] = useState<string[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [autoConnectionFocus, setAutoConnectionFocus] = useState<'strong' | 'moderate' | 'all'>('all');
  const [viewMode, setViewMode] = useState<AtlasViewMode>('core');
  const [relationshipFilterMode, setRelationshipFilterMode] = useState<AtlasRelationshipFilterMode>('recommended');
  const [customRelationshipTypes, setCustomRelationshipTypes] = useState<PhilosophicalLinkType[]>([]);
  const [mode, setMode] = useState<'auto' | 'custom'>('auto');
  const [activeMapId, setActiveMapId] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const styleBase = useRef<AtlasMap | null>(null);
  const styleSaveLock = useRef(false);
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleError, setStyleError] = useState('');
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState('');
  const linkSaveLock = useRef(false);
  const [isNodeOpen, setIsNodeOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<AtlasLinkItem | null>(null);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [connectionTrace, setConnectionTrace] = useState<AtlasConnectionTrace | null>(null);
  useEffect(() => {
    if (!connectionTrace) return;
    const timeout = window.setTimeout(() => setConnectionTrace(null), 8_000);
    return () => window.clearTimeout(timeout);
  }, [connectionTrace]);
  const [cutLinkCandidate, setCutLinkCandidate] = useState<AtlasLinkItem | null>(null);
  const [cutLinkMethod, setCutLinkMethod] = useState<'atlas_long_hold' | 'atlas_link_detail' | 'atlas_node_action'>('atlas_link_detail');
  const [isPositionsOpen, setIsPositionsOpen] = useState(false);
  const [relatedDialogType, setRelatedDialogType] = useState<null | 'sources' | 'works' | 'practices' | 'inquiries' | 'unknowns'>(null);
  const [isDeleteAllLinksOpen, setIsDeleteAllLinksOpen] = useState(false);
  const [linkSort, setLinkSort] = useState<'alpha' | 'created' | 'interacted'>('alpha');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [quickLinkSource, setQuickLinkSource] = useState<string | null>(null);
  const [quickLinkTarget, setQuickLinkTarget] = useState<string | null>(null);
  const [quickLinkHoverTarget, setQuickLinkHoverTarget] = useState<string | null>(null);
  const [quickLinkCursor, setQuickLinkCursor] = useState({ x: 0, y: 0 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [linkInteractionMap, setLinkInteractionMap] = useState<Record<string, { lastInteractedAt: string; interactionCount: number }>>({});
  const [newConcept, setNewConcept] = useState<Partial<Concept>>({ name: '', description: '', sourceIds: [] });
  const [creatingConcept, setCreatingConcept] = useState(false);
  const conceptCreationLock = useRef(false);
  const [newMap, setNewMap] = useState({ title: '', description: '' });
  const [creatingMap, setCreatingMap] = useState(false);
  const [mapCreationError, setMapCreationError] = useState('');
  const mapCreationLock = useRef(false);
  const [mapToDelete, setMapToDelete] = useState<AtlasMap | null>(null);
  const [registryRemoval, setRegistryRemoval] = useState<{ id: string; options?: { method?: string } } | null>(null);
  const registryRemovalOpener = useRef<HTMLButtonElement | null>(null);
  const requestRegistryRemoval = onDeleteLink ? (id: string, options?: { method?: string }, opener?: HTMLButtonElement) => {
    registryRemovalOpener.current = opener ?? null;
    setRegistryRemoval({ id, options });
  } : undefined;
  const [styleDraft, setStyleDraft] = useState<AtlasMapStyle>(defaultAtlasMapStyle);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [linkDraft, setLinkDraft] = useState<{ to: string; type: AtlasMapLinkType; label: string; note: string }>({ to: '', type: 'relates', label: '', note: '' });
  const [showAdvancedLinkTypes, setShowAdvancedLinkTypes] = useState(false);
  const [positionsByScope, setPositionsByScope] = useState<Record<string, Record<string, { x: number; y: number }>>>({});
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [nodePreview, setNodePreview] = useState<{ scope: string; key: string; x: number; y: number } | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [nodeSizes, setNodeSizes] = useState<Record<string, { width: number; height: number }>>({});
  const mapZoomPlane = useMemo(() => atlasZoomPlane(zoom, ATLAS_BASE_ZOOM), [zoom]);
  const [panelSection, setPanelSection] = useState<'links' | 'evidence' | 'events' | 'actions'>('links');
  const mapRef = useRef<HTMLDivElement | null>(null);
  const panGestureRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const nodeGestureRef = useRef<{ pointerId: number; name: string; x: number; y: number; position?: { x: number; y: number } } | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const edgeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextEdgeClickRef = useRef(false);
  const edgeHoverInteractionRef = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      setZoom(atlasStoredZoom(window.localStorage.getItem(ATLAS_ZOOM_STORAGE_KEY), ATLAS_BASE_ZOOM, ATLAS_MIN_ZOOM, ATLAS_MAX_ZOOM));
    } catch { /* The map still works without browser storage. */ }
  }, []);

  const changeZoom = (value: number) => {
    const next = Math.min(ATLAS_MAX_ZOOM, Math.max(ATLAS_MIN_ZOOM, value));
    setZoom(next);
    try { window.localStorage.setItem(ATLAS_ZOOM_STORAGE_KEY, String(next)); } catch { /* Optional preference. */ }
  };

  const terms = useMemo(
    () => Array.from(new Set(concepts.map((concept) => conceptKey(concept.name)).filter(Boolean))),
    [concepts]
  );
  const activeMap = atlasMaps.find((map) => map.id === activeMapId) || atlasMaps[0] || null;
  const effectiveNodeColors = activeMap?.nodeColors || {};
  const effectiveLinkColors = activeMap?.linkColors || {};
  const activeMapStyle = useMemo(
    () => normalizeAtlasMapStyle(activeMap?.style),
    [activeMap?.style]
  );
  const { url: activeBackgroundUrl } = usePrivateAssetUrl(
    activeMapStyle.background.storagePath,
    activeMapStyle.background.imageUrl || '',
  );
  const { url: draftBackgroundUrl } = usePrivateAssetUrl(
    styleDraft.background.storagePath,
    styleDraft.background.imageUrl || '',
  );
  const selectedConcept = concepts.find((item) => conceptKey(item.name) === conceptKey(selectedName || ''));
  const related = useMemo(() => selectedName
    ? conceptRelated(selectedName, { media, insights, vault, drafts, practices, questions, timeline })
    : null, [selectedName, media, insights, vault, drafts, practices, questions, timeline]);
  const relatedUnknowns = useMemo(() => {
    if (!selectedName) return [];
    return unknowns.filter((item) => (item.conceptTags || []).some((tag) => conceptKey(tag) === conceptKey(selectedName)));
  }, [selectedName, unknowns]);
  const recentThinkingForNode = useMemo(() => {
    if (!selectedName) return [];
    return thinkingEvents
      .filter((item) => item.summary.toLowerCase().includes(selectedName.toLowerCase()))
      .slice(0, 3);
  }, [selectedName, thinkingEvents]);
  const recommendedRelationshipTypes = useMemo(
    () => recommendedRelationshipTypesByViewMode[viewMode],
    [viewMode]
  );
  const atlasRegions = useMemo(
    () => deriveAtlasRegions({ concepts, media, vault, practices, questions, drafts, links, timeline, thinkingEvents }),
    [concepts, media, vault, practices, questions, drafts, links, timeline, thinkingEvents]
  );
  const markRegionSeen = useCallback((regionId: string) => {
    if (!uid) return;
    const storageKey = `noesis:atlas-region-notices:v1:${uid}`;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as { knownIds?: string[]; unreadIds?: string[] };
      const unreadIds = (saved.unreadIds || []).filter((id) => id !== regionId);
      window.localStorage.setItem(storageKey, JSON.stringify({ knownIds: saved.knownIds || [], unreadIds }));
      setNewRegionIds(unreadIds);
    } catch {
      setNewRegionIds((current) => current.filter((id) => id !== regionId));
    }
  }, [uid]);
  const openRegion = useCallback((regionId: string) => {
    setSelectedRegionId(regionId);
    setRegionDetailOpen(false);
    setAtlasSection('territory');
    markRegionSeen(regionId);
  }, [markRegionSeen]);

  useEffect(() => {
    if (!uid) return;
    const activeRegions = atlasRegions.filter((region) => region.status === 'active');
    const activeIds = activeRegions.map((region) => region.id);
    const storageKey = `noesis:atlas-region-notices:v1:${uid}`;
    try {
      const previous = window.localStorage.getItem(storageKey);
      const { state, newIds } = reconcileAtlasRegionNotices(activeIds, previous ? JSON.parse(previous) : null);
      const newRegions = activeRegions.filter((region) => newIds.includes(region.id));
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setNewRegionIds(state.unreadIds);
      if (newRegions.length) {
        const region = newRegions[0];
        toast({
          title: newRegions.length === 1 ? `New Atlas region: ${region.name}` : `${newRegions.length} new Atlas regions`,
          description: 'Three existing concepts now form an active region. Review why they were grouped.',
          action: <ToastAction altText="View new Atlas region" onClick={() => openRegion(region.id)}>View</ToastAction>,
        });
      }
    } catch {
      setNewRegionIds([]);
    }
  }, [atlasRegions, openRegion, toast, uid]);
  const atlasTerritoryCards = useMemo(
    () => deriveAtlasTerritoryView(atlasRegions),
    [atlasRegions]
  );
  const atlasSystemTensions = useMemo(
    () => deriveAtlasSystemTensions({ regions: atlasRegions, concepts, vault, practices, links }),
    [atlasRegions, concepts, vault, practices, links]
  );
  const atlasKnownIds = useMemo(() => ({
    concept: new Set(concepts.map((item) => item.id)),
    position: new Set(vault.map((item) => item.id)),
    inquiry: new Set(questions.map((item) => item.id)),
    source: new Set(media.map((item) => item.id)),
    annotation: new Set(media.flatMap((item) => (item.annotations || []).map((annotation) => annotation.id))),
    work: new Set(drafts.map((item) => item.id)),
    practice: new Set(practices.map((item) => item.id)),
  }), [concepts, drafts, media, practices, questions, vault]);
  const selectedRegion = useMemo(
    () => atlasRegions.find((region) => region.id === selectedRegionId) || atlasRegions[0] || null,
    [atlasRegions, selectedRegionId]
  );
  const mapScope = atlasMapScope(mode, activeMap?.id, selectedRegion?.id);
  const draftPositions = positionsByScope[mapScope];
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setActiveEdgeId(null);
    setQuickLinkSource(null);
    setQuickLinkTarget(null);
    setQuickLinkHoverTarget(null);
  }, [mapScope]);
  useEffect(() => {
    panGestureRef.current = null;
    nodeGestureRef.current = null;
    setDraggingName(null);
    setNodePreview(null);
  }, [mapScope, isFullScreen]);
  useEffect(() => {
    if (mode !== 'custom' || !activeMap?.nodePositions || !draftPositions || draggingName) return;
    const saved = activeMap.nodePositions;
    const acknowledged = Object.keys(draftPositions).filter((key) =>
      saved[key]?.x === draftPositions[key].x && saved[key]?.y === draftPositions[key].y);
    if (!acknowledged.length) return;
    setPositionsByScope((current) => {
      const next = { ...current[mapScope] };
      for (const key of acknowledged) if (next[key] === draftPositions[key]) delete next[key];
      return { ...current, [mapScope]: next };
    });
  }, [activeMap?.nodePositions, draftPositions, draggingName, mapScope, mode]);

  useEffect(() => {
    if (atlasSection !== 'map' && isFullScreen) {
      setIsFullScreen(false);
    }
  }, [atlasSection, isFullScreen]);
  const activeRelationshipTypes = useMemo(() => {
    if (relationshipFilterMode === 'all') return [] as PhilosophicalLinkType[];
    if (relationshipFilterMode === 'recommended') return recommendedRelationshipTypes;
    return customRelationshipTypes;
  }, [customRelationshipTypes, recommendedRelationshipTypes, relationshipFilterMode]);


  useEffect(() => {
    if (selectedName) setPanelSection('links');
  }, [selectedName]);

  useEffect(() => {
    if (!selectedRegionId && atlasRegions[0]) setSelectedRegionId(atlasRegions[0].id);
  }, [atlasRegions, selectedRegionId]);

  useEffect(() => {
    if (atlasSection !== 'map') return;
    const element = mapRef.current;
    if (!element) return;
    const updateSize = () => {
      setMapSize((current) => {
        const { clientWidth: width, clientHeight: height } = element;
        return current.width === width && current.height === height ? current : { width, height };
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [atlasSection, isFullScreen]);

  const visibleTerms = useMemo(() => {
    if (mode === 'custom') return atlasMapTerms({ terms, customTerms: activeMap?.nodeNames.map(conceptKey) ?? [] });
    if (atlasSection !== 'map' || !selectedRegion || !mapRegionFocus) return terms;
    const regionNames = new Set(selectedRegion.conceptIds
      .map((id) => concepts.find((concept) => concept.id === id)?.name)
      .filter((name): name is string => Boolean(name))
      .map(conceptKey));
    return atlasMapTerms({ terms, regionTerms: regionNames, focusedTerm: selectedName ? conceptKey(selectedName) : undefined });
  }, [activeMap, atlasSection, concepts, mapRegionFocus, mode, selectedName, selectedRegion, terms]);

  const timelineBounds = useMemo(() => atlasTimelineBounds(concepts.map((concept) => concept.dateCreated)), [concepts]);
  const timelineNewCount = useMemo(() => timelineWindow
    ? concepts.filter((concept) => atlasNodeTimelineState(concept.dateCreated, timelineWindow) === 'new').length
    : 0, [concepts, timelineWindow]);

  const tagCounts = useMemo(() => countAtlasConceptTags([
    ...media.map((item) => item.tags),
    ...insights.map((item) => item.tags),
    ...vault.map((item) => item.tags),
    ...drafts.map((item) => item.conceptTags),
    ...practices.map((item) => item.conceptTags),
  ]), [drafts, insights, media, practices, vault]);

  // Each concept's first region: where it sits on the territory map.
  const primaryRegionOf = useMemo(() => {
    const regionOf = new Map<string, number>();
    atlasRegions.forEach((region, index) => region.conceptIds.forEach((id) => {
      const key = conceptKey(concepts.find((concept) => concept.id === id)?.name || '');
      if (key && !regionOf.has(key)) regionOf.set(key, index);
    }));
    return regionOf;
  }, [atlasRegions, concepts]);

  const displayedNodes = useMemo(() => {
    const conceptsByName = new Map<string, Concept>();
    for (const concept of concepts) {
      const key = conceptKey(concept.name);
      if (!conceptsByName.has(key)) conceptsByName.set(key, concept);
    }
    const filtered = visibleTerms.filter((name) => (!search || name.toLowerCase().includes(search.toLowerCase()))
      && atlasNodeTimelineState(conceptsByName.get(conceptKey(name))?.dateCreated, timelineWindow) !== 'unborn');
    const candidates = filtered.map((name) => ({
      name,
      key: conceptKey(name),
      concept: conceptsByName.get(conceptKey(name)),
      count: tagCounts.get(conceptKey(name)) ?? 0,
    }));
    return isMobile && mode === 'auto' && !search.trim()
      ? atlasCompactNodes(candidates, selectedName ? conceptKey(selectedName) : undefined)
      : candidates;
  }, [concepts, isMobile, mode, search, selectedName, tagCounts, timelineWindow, visibleTerms]);

  const nodes = useMemo<MapNode[]>(() => {
    const territory = mode === 'auto' && !isMobile && !mapRegionFocus && !search.trim()
      ? atlasTerritoryPositions(displayedNodes.map((node) => node.key), primaryRegionOf)
      : null;
    return displayedNodes.map(({ name, key, concept, count }, index) => {
      const autoPosition = territory?.get(key) ?? atlasAutoNodePosition(index, displayedNodes.length, isMobile);
      const customPosition = activeMap?.nodePositions?.[key];
      const preview = nodePreview?.scope === mapScope && nodePreview.key === key ? nodePreview : null;
      return {
        name,
        concept,
        count,
        x: preview?.x ?? draftPositions?.[key]?.x
          ?? (mode === 'auto' ? autoPosition.x : customPosition?.x ?? concept?.x ?? autoPosition.x),
        y: preview?.y ?? draftPositions?.[key]?.y
          ?? (mode === 'auto' ? autoPosition.y : customPosition?.y ?? concept?.y ?? autoPosition.y),
      };
    });
  }, [activeMap, displayedNodes, draftPositions, isMobile, mapRegionFocus, mapScope, mode, nodePreview, primaryRegionOf, search]);

  const relatedByNode = useMemo(() => {
    return new Map(displayedNodes.map((node) => [
      node.key,
      conceptRelated(node.name, { media, insights, vault, drafts, practices, questions, timeline }),
    ]));
  }, [displayedNodes, drafts, insights, media, practices, questions, timeline, vault]);
  const conceptNameById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept.name])),
    [concepts]
  );
  const savedConceptLinkPairs = useMemo(() => {
    const pairs = new Set<string>();
    concepts.forEach((concept) => {
      (concept.links || []).forEach((target) => {
        pairs.add([conceptKey(concept.name), conceptKey(target)].sort().join('::'));
      });
    });
    return pairs;
  }, [concepts]);
  const typedConceptPairMeta = useMemo(() => {
    const pairs = new Map<string, { interactionCount: number; acceptedByUser: boolean; latestDate: string; types: PhilosophicalLinkType[] }>();
    links.forEach((link) => {
      if (link.fromType !== 'concept' || link.toType !== 'concept') return;
      const fromName = conceptKey(conceptNameById.get(link.fromId) || link.fromLabel || '');
      const toName = conceptKey(conceptNameById.get(link.toId) || link.toLabel || '');
      if (!fromName || !toName) return;
      const key = [fromName, toName].sort().join('::');
      const current = pairs.get(key);
      pairs.set(key, {
        interactionCount: Math.max(current?.interactionCount || 0, link.interactionCount || 0),
        acceptedByUser: Boolean(current?.acceptedByUser || link.acceptedByUser || link.createdFrom === 'manual'),
        latestDate: [current?.latestDate || '', link.lastInteractedAt || link.dateUpdated || link.dateCreated || '']
          .sort((a, b) => (Date.parse(b || '') || 0) - (Date.parse(a || '') || 0))[0] || '',
        types: Array.from(new Set([...(current?.types || []), link.type])),
      });
    });
    return pairs;
  }, [conceptNameById, links]);

  const classifyStrength = useCallback((score: number) => {
    if (score >= 65) return 'strong' as const;
    if (score >= 35) return 'moderate' as const;
    if (score >= 15) return 'weak' as const;
    return 'suggested' as const;
  }, []);

  const matchesConnectionFocus = (
    strength: MapEdge['strength'],
    focus: 'strong' | 'moderate' | 'all'
  ) => {
    if (focus === 'all') return true;
    if (focus === 'moderate') return strength === 'strong' || strength === 'moderate';
    return strength === 'strong';
  };

  const deriveMapModesFromType = useCallback((type?: string): AtlasViewMode[] => {
    const modes = new Set<AtlasViewMode>(['full']);
    if (!type || ['custom', 'relates'].includes(type)) {
      modes.add('core');
      return Array.from(modes);
    }
    if (['challenges', 'contradicts', 'weakens', 'questions'].includes(type)) modes.add('conflict');
    if (['supports', 'exemplifies', 'references', 'derived_from', 'strengthens'].includes(type)) modes.add('evidence');
    if (['tested_by', 'expressed_in', 'depends_on'].includes(type)) modes.add('practice');
    if (['refines', 'replaces', 'changed_by', 'derived_from'].includes(type)) modes.add('evolution');
    if (highImportanceLinkTypes.has(type as AtlasMapLinkType) || moderateImportanceLinkTypes.has(type as AtlasMapLinkType)) modes.add('core');
    return Array.from(modes);
  }, []);

  const collectRelatedTags = useCallback((related: ReturnType<typeof conceptRelated>, conceptName: string) => {
    const tags = new Set<string>();
    related.sources.forEach((item) => (item.tags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.beliefs.forEach((item) => (item.tags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.drafts.forEach((item) => (item.conceptTags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.practices.forEach((item) => (item.conceptTags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.questions.forEach((item) => (item.conceptIds || []).forEach((id) => tags.add(conceptKey(conceptNameById.get(id) || id))));
    tags.delete(conceptKey(conceptName));
    return tags;
  }, [conceptNameById]);

  const scoreSharedConnection = useCallback((
    leftName: string,
    rightName: string,
    left: ReturnType<typeof conceptRelated>,
    right: ReturnType<typeof conceptRelated>,
    counts: { sharedSources: number; sharedPositions: number; sharedInquiries: number; sharedWorks: number; sharedPractices: number }
  ) => {
    const pairKey = [conceptKey(leftName), conceptKey(rightName)].sort().join('::');
    const typedPairMeta = typedConceptPairMeta.get(pairKey);
    const explicitLinkScore = savedConceptLinkPairs.has(pairKey)
      ? 40
      : typedPairMeta?.acceptedByUser
        ? 30
        : typedPairMeta
          ? 10
          : 0;
    const leftTags = collectRelatedTags(left, leftName);
    const rightTags = collectRelatedTags(right, rightName);
    const sharedConceptCount = [...leftTags].filter((tag) => rightTags.has(tag)).length;
    const sharedConceptScore = Math.min(sharedConceptCount * 8, 24);
    const interactionScore = Math.min((typedPairMeta?.interactionCount || 0) * 5, 15);
    const sharedDates = [
      ...left.sources.filter((item) => right.sources.some((other) => other.id === item.id)).map((item) => item.dateUpdated || item.dateAdded || ''),
      ...left.beliefs.filter((item) => right.beliefs.some((other) => other.id === item.id)).map((item) => item.dateUpdated || item.dateCreated || ''),
      ...left.questions.filter((item) => right.questions.some((other) => other.id === item.id)).map((item) => item.dateUpdated || item.dateCreated || ''),
      ...left.drafts.filter((item) => right.drafts.some((other) => other.id === item.id)).map((item) => item.dateUpdated || item.dateCreated || ''),
      ...left.practices.filter((item) => right.practices.some((other) => other.id === item.id)).map((item) => item.dateUpdated || item.dateCreated || ''),
      typedPairMeta?.latestDate || '',
    ].filter(Boolean);
    const latestDate = sharedDates.sort((a, b) => (Date.parse(b || '') || 0) - (Date.parse(a || '') || 0))[0] || '';
    const ageDays = latestDate ? Math.max(0, (Date.now() - (Date.parse(latestDate) || 0)) / (1000 * 60 * 60 * 24)) : 999;
    const recencyScore = ageDays <= 7 ? 10 : ageDays <= 30 ? 6 : ageDays <= 90 ? 3 : 0;
    const evidenceScore = counts.sharedSources >= 2 ? 10 : counts.sharedSources === 1 ? 6 : 0;
    const relationshipImportanceScore =
      counts.sharedPractices > 0
        ? 15
        : counts.sharedPositions > 0
          ? 12
          : counts.sharedInquiries > 0
            ? 9
            : counts.sharedWorks > 0
              ? 7
              : 4;
    const connectionScore = Math.min(
      100,
      explicitLinkScore + sharedConceptScore + interactionScore + recencyScore + evidenceScore + relationshipImportanceScore
    );
    const modes = new Set<AtlasViewMode>(['full']);
    modes.add('core');
    if (counts.sharedPositions || counts.sharedSources) modes.add('evidence');
    if (counts.sharedPractices || counts.sharedWorks) modes.add('practice');
    if (counts.sharedInquiries || counts.sharedPositions) modes.add('conflict');
    if (counts.sharedWorks || counts.sharedPositions) modes.add('evolution');
    const labelBits = [
      counts.sharedSources ? `${counts.sharedSources} source${counts.sharedSources > 1 ? 's' : ''}` : '',
      counts.sharedPositions ? `${counts.sharedPositions} position${counts.sharedPositions > 1 ? 's' : ''}` : '',
      counts.sharedInquiries ? `${counts.sharedInquiries} inquir${counts.sharedInquiries > 1 ? 'ies' : 'y'}` : '',
      counts.sharedPractices ? `${counts.sharedPractices} practice${counts.sharedPractices > 1 ? 's' : ''}` : '',
      counts.sharedWorks ? `${counts.sharedWorks} work${counts.sharedWorks > 1 ? 's' : ''}` : '',
    ].filter(Boolean);
    return {
      score: connectionScore,
      strength: classifyStrength(connectionScore),
      mapModes: Array.from(modes),
      label: labelBits.slice(0, 2).join(' • '),
    };
  }, [classifyStrength, collectRelatedTags, savedConceptLinkPairs, typedConceptPairMeta]);

  const edges = useMemo<MapEdge[]>(() => {
    const result: MapEdge[] = [];
    const nodeNames = new Set(displayedNodes.map((node) => node.key));
    const filters = mode === 'custom' ? (activeMap?.autoLinkFilters || defaultAutoLinkFilters) : defaultAutoLinkFilters;

    if (mode === 'custom' && activeMap) {
      (activeMap.manualLinks || []).forEach((link) => {
        if (nodeNames.has(conceptKey(link.from)) && nodeNames.has(conceptKey(link.to))) {
          result.push({
            from: conceptKey(link.from),
            to: conceptKey(link.to),
            type: 'user',
            label: link.label || link.type,
            linkType: link.type,
            id: link.id,
            weight: 85,
            strength: 'strong',
            objectTypes: ['concept'],
            mapModes: deriveMapModesFromType(link.type),
          });
        }
      });
    }

    if (mode === 'auto' || filters.conceptLinks) {
      concepts.forEach((concept) => (concept.links || []).forEach((link) => {
        if (nodeNames.has(conceptKey(concept.name)) && nodeNames.has(conceptKey(link))) {
          const pairKey = [conceptKey(concept.name), conceptKey(link)].sort().join('::');
          const pairMeta = typedConceptPairMeta.get(pairKey);
          const conceptScore = Math.min(100, 55 + Math.min((pairMeta?.interactionCount || 0) * 5, 15));
          result.push({
            from: conceptKey(concept.name),
            to: conceptKey(link),
            type: 'concept',
            label: 'saved concept link',
            weight: conceptScore,
            strength: classifyStrength(conceptScore),
            objectTypes: ['concept'],
            mapModes: ['core', 'full'],
          });
        }
      }));
    }

    const autoFiltersEnabled = mode === 'auto' || filters.sharedSources || filters.sharedPositions || filters.sharedInquiries || filters.sharedWorks || filters.sharedPractices;
    if (autoFiltersEnabled) {
      const sharedCandidates: MapEdge[] = [];
      for (let i = 0; i < displayedNodes.length; i += 1) {
        for (let j = i + 1; j < displayedNodes.length; j += 1) {
          const leftNode = displayedNodes[i];
          const rightNode = displayedNodes[j];
          const left = relatedByNode.get(leftNode.key);
          const right = relatedByNode.get(rightNode.key);
          if (!left || !right) continue;
          const sharedSources = left.sources.filter((item) => right.sources.some((other) => other.id === item.id)).length;
          const sharedPositions = left.beliefs.filter((item) => right.beliefs.some((other) => other.id === item.id)).length;
          const sharedInquiries = left.questions.filter((item) => right.questions.some((other) => other.id === item.id)).length;
          const sharedWorks = left.drafts.filter((item) => right.drafts.some((other) => other.id === item.id)).length;
          const sharedPractices = left.practices.filter((item) => right.practices.some((other) => other.id === item.id)).length;
          const shared =
            (mode === 'auto' || filters.sharedSources ? sharedSources : 0) +
            (mode === 'auto' || filters.sharedPositions ? sharedPositions : 0) +
            (mode === 'auto' || filters.sharedInquiries ? sharedInquiries : 0) +
            (mode === 'auto' || filters.sharedWorks ? sharedWorks : 0) +
            (mode === 'auto' || filters.sharedPractices ? sharedPractices : 0);
          if (shared) {
            const scored = scoreSharedConnection(leftNode.name, rightNode.name, left, right, {
              sharedSources,
              sharedPositions,
              sharedInquiries,
              sharedWorks,
              sharedPractices,
            });
            sharedCandidates.push({
              from: leftNode.name,
              to: rightNode.name,
              type: 'shared',
              label: scored.label || `${shared} shared`,
              weight: scored.score,
              strength: scored.strength,
              objectTypes: [
                ...(sharedSources ? ['source' as const] : []),
                ...(sharedPositions ? ['position' as const] : []),
                ...(sharedInquiries ? ['inquiry' as const] : []),
                ...(sharedWorks ? ['work' as const] : []),
                ...(sharedPractices ? ['practice' as const] : []),
              ],
              mapModes: scored.mapModes,
            });
          }
        }
      }

      if (autoConnectionFocus === 'all') {
        result.push(...sharedCandidates);
      } else if (autoConnectionFocus === 'moderate') {
        const sortedCandidates = [...sharedCandidates].sort((a, b) => (b.weight || 0) - (a.weight || 0));
        const perNodeCounts = new Map<string, number>();
        sortedCandidates.forEach((edge) => {
          const strength = edge.strength || 'suggested';
          if (strength === 'weak' || strength === 'suggested') return;
          const fromKey = conceptKey(edge.from);
          const toKey = conceptKey(edge.to);
          const fromCount = perNodeCounts.get(fromKey) || 0;
          const toCount = perNodeCounts.get(toKey) || 0;
          if (fromCount >= 6 || toCount >= 6) return;
          result.push(edge);
          perNodeCounts.set(fromKey, fromCount + 1);
          perNodeCounts.set(toKey, toCount + 1);
        });
      } else {
        const sortedCandidates = [...sharedCandidates].sort((a, b) => (b.weight || 0) - (a.weight || 0));
        const perNodeCounts = new Map<string, number>();
        sortedCandidates.forEach((edge) => {
          if (edge.strength !== 'strong') return;
          const fromKey = conceptKey(edge.from);
          const toKey = conceptKey(edge.to);
          const fromCount = perNodeCounts.get(fromKey) || 0;
          const toCount = perNodeCounts.get(toKey) || 0;
          if (fromCount >= 4 || toCount >= 4) return;
          result.push(edge);
          perNodeCounts.set(fromKey, fromCount + 1);
          perNodeCounts.set(toKey, toCount + 1);
        });
      }
    }

    const typedEdgeMap = new Map<string, MapEdge>();
    links
      .filter((link) => !activeRelationshipTypes.length || activeRelationshipTypes.includes(link.type))
      .forEach((link) => {
        const fromConcept = link.fromType === 'concept' ? concepts.find((concept) => concept.id === link.fromId) : null;
        const toConcept = link.toType === 'concept' ? concepts.find((concept) => concept.id === link.toId) : null;
        const fromName = conceptKey(fromConcept?.name || link.fromLabel);
        const toName = conceptKey(toConcept?.name || link.toLabel);
        if (!fromName || !toName || !nodeNames.has(fromName) || !nodeNames.has(toName)) return;

        const importanceScore = highImportanceLinkTypes.has(link.type) ? 85 : moderateImportanceLinkTypes.has(link.type) ? 60 : 35;
        const linkWeight = link.connectionScore ?? importanceScore;
        const linkStrength = link.connectionStrength || classifyStrength(linkWeight);
        const pairKey = [fromName, toName].sort().join('::');
        const existing = typedEdgeMap.get(pairKey);

        if (!existing) {
          typedEdgeMap.set(pairKey, {
            from: fromName,
            to: toName,
            type: 'typed',
            label: link.type.replace(/_/g, ' '),
            linkType: link.type,
            id: `typed-group:${pairKey}`,
            weight: linkWeight,
            strength: linkStrength,
            objectTypes: [
              ...(link.fromType === 'concept' || link.toType === 'concept' ? ['concept' as const] : []),
              ...(link.fromType === 'position' || link.toType === 'position' ? ['position' as const] : []),
              ...(link.fromType === 'inquiry' || link.toType === 'inquiry' ? ['inquiry' as const] : []),
              ...(link.fromType === 'source' || link.toType === 'source' ? ['source' as const] : []),
              ...(link.fromType === 'annotation' || link.toType === 'annotation' ? ['annotation' as const] : []),
              ...(link.fromType === 'work' || link.toType === 'work' ? ['work' as const] : []),
              ...(link.fromType === 'practice' || link.toType === 'practice' ? ['practice' as const] : []),
            ],
            mapModes: link.mapModes || deriveMapModesFromType(link.type),
            groupedLinkIds: [link.id],
            groupedTypes: [link.type],
            note: link.note || '',
            interactionCount: link.interactionCount || 0,
            lastInteractedAt: link.lastInteractedAt || link.dateUpdated || link.dateCreated || '',
          });
          return;
        }

        const existingWeight = existing.weight || 0;
        const shouldPromotePrimary = linkWeight > existingWeight;
        existing.groupedLinkIds = Array.from(new Set([...(existing.groupedLinkIds || []), link.id]));
        existing.groupedTypes = Array.from(new Set([...(existing.groupedTypes || []), link.type]));
        existing.mapModes = Array.from(new Set([...(existing.mapModes || []), ...(link.mapModes || deriveMapModesFromType(link.type))]));
        existing.objectTypes = Array.from(new Set([...(existing.objectTypes || []),
          ...(link.fromType === 'concept' || link.toType === 'concept' ? ['concept' as const] : []),
          ...(link.fromType === 'position' || link.toType === 'position' ? ['position' as const] : []),
          ...(link.fromType === 'inquiry' || link.toType === 'inquiry' ? ['inquiry' as const] : []),
          ...(link.fromType === 'source' || link.toType === 'source' ? ['source' as const] : []),
          ...(link.fromType === 'annotation' || link.toType === 'annotation' ? ['annotation' as const] : []),
          ...(link.fromType === 'work' || link.toType === 'work' ? ['work' as const] : []),
          ...(link.fromType === 'practice' || link.toType === 'practice' ? ['practice' as const] : []),
        ]));
        existing.interactionCount = Math.max(existing.interactionCount || 0, link.interactionCount || 0);
        existing.lastInteractedAt = [existing.lastInteractedAt || '', link.lastInteractedAt || link.dateUpdated || link.dateCreated || '']
          .sort((a, b) => (Date.parse(b || '') || 0) - (Date.parse(a || '') || 0))[0] || existing.lastInteractedAt;
        if (link.note) {
          existing.note = [existing.note || '', link.note].filter(Boolean).slice(0, 2).join('\n');
        }
        if (shouldPromotePrimary) {
          existing.label = link.type.replace(/_/g, ' ');
          existing.linkType = link.type;
          existing.weight = linkWeight;
          existing.strength = linkStrength;
        }
      });

    result.push(...typedEdgeMap.values().map((edge) => ({
      ...edge,
      label: (edge.groupedTypes?.length || 0) > 1 ? `${edge.label} + ${(edge.groupedTypes?.length || 1) - 1} more` : edge.label,
    })));
    return result;
  }, [activeMap, activeRelationshipTypes, autoConnectionFocus, classifyStrength, concepts, deriveMapModesFromType, displayedNodes, links, mode, relatedByNode, scoreSharedConnection, typedConceptPairMeta]);

  const visibleEdges = useMemo(() => {
    const selectedKey = conceptKey(selectedName || '');
    const isSelectedEdge = (edge: MapEdge) => conceptKey(edge.from) === selectedKey || conceptKey(edge.to) === selectedKey;
    const hasObjectType = (edge: MapEdge, types: Array<NonNullable<MapEdge['objectTypes']>[number]>) =>
      (edge.objectTypes || []).some((type) => types.includes(type));

    const filtered = edges.filter((edge) => {
      const typedLabel = (edge.linkType || '').toString();
      const matchesMode = edge.mapModes?.includes(viewMode) ?? false;
      if (
        typedLabel
        && activeRelationshipTypes.length
        && !['custom', 'relates'].includes(typedLabel)
        && !activeRelationshipTypes.includes(typedLabel as PhilosophicalLinkType)
      ) {
        return false;
      }
      if (viewMode === 'full') return true;

      if (viewMode === 'conflict') {
        return matchesMode || ['contradicts', 'challenges', 'weakens', 'questions'].includes(typedLabel);
      }

      if (viewMode === 'evidence') {
        return matchesMode || edge.type === 'shared' || hasObjectType(edge, ['source', 'annotation', 'position']);
      }

      if (viewMode === 'practice') {
        return matchesMode || hasObjectType(edge, ['practice', 'work']) || ['tested_by', 'expressed_in'].includes(typedLabel);
      }

      if (viewMode === 'evolution') {
        return matchesMode || ['changed_by', 'replaces', 'refines', 'strengthens', 'weakens'].includes(typedLabel);
      }

      if (matchesMode && edge.strength !== 'weak' && edge.strength !== 'suggested') return true;
      if (edge.strength === 'strong') return true;
      if (isSelectedEdge(edge) && edge.strength === 'moderate') return true;
      if (['contradicts', 'challenges', 'depends_on', 'refines', 'strengthens', 'weakens', 'tested_by', 'changed_by'].includes(typedLabel) && edge.strength === 'moderate') return true;
      if (edge.type === 'user') return true;
      return false;
    });

    const customFiltered = mode === 'custom' && activeMapStyle.showWeakLinks === false
      ? filtered.filter((edge) => edge.strength !== 'weak' && edge.strength !== 'suggested')
      : filtered;

    let prioritized = customFiltered;

    if (mode === 'auto') {
      const explicitKinds = new Map<string, { typed: boolean; concept: boolean }>();
      prioritized.forEach((edge) => {
        const pairKey = atlasEdgePairKey(edge);
        const existing = explicitKinds.get(pairKey) || { typed: false, concept: false };
        if (edge.type === 'typed') existing.typed = true;
        if (edge.type === 'concept') existing.concept = true;
        explicitKinds.set(pairKey, existing);
      });

      prioritized = prioritized.filter((edge) => {
        const pairKinds = explicitKinds.get(atlasEdgePairKey(edge));
        if (!pairKinds) return true;
        if (edge.type === 'shared' && (pairKinds.typed || pairKinds.concept)) return false;
        if (edge.type === 'concept' && pairKinds.typed) return false;
        return true;
      });
    }

    const strengthFiltered = prioritized.filter((edge) => matchesConnectionFocus(edge.strength, autoConnectionFocus));

    if (mode === 'auto' && viewMode !== 'full' && !selectedName) {
      const sorted = [...strengthFiltered]
        .sort((left, right) => edgePriorityScore(right) - edgePriorityScore(left));
      const perNodeCounts = new Map<string, number>();
      const perNodeLimit = autoConnectionFocus === 'all' ? 7 : autoConnectionFocus === 'moderate' ? 5 : 4;
      const globalLimit = viewMode === 'core'
        ? (autoConnectionFocus === 'all' ? 54 : autoConnectionFocus === 'moderate' ? 40 : 28)
        : (autoConnectionFocus === 'all' ? 42 : autoConnectionFocus === 'moderate' ? 30 : 22);
      const kept: MapEdge[] = [];

      sorted.forEach((edge) => {
        const fromKey = conceptKey(edge.from);
        const toKey = conceptKey(edge.to);
        const fromCount = perNodeCounts.get(fromKey) || 0;
        const toCount = perNodeCounts.get(toKey) || 0;
        const typedLabel = (edge.linkType || '').toString();
        const keepBeyondCap =
          edge.type === 'typed' &&
          (edge.strength === 'strong' || ['contradicts', 'challenges', 'depends_on', 'refines', 'tested_by', 'supports'].includes(typedLabel));

        if (!keepBeyondCap && kept.length >= globalLimit) return;
        if (!keepBeyondCap && (fromCount >= perNodeLimit || toCount >= perNodeLimit)) return;

        kept.push(edge);
        perNodeCounts.set(fromKey, fromCount + 1);
        perNodeCounts.set(toKey, toCount + 1);
      });

      return kept;
    }

    return strengthFiltered;
  }, [activeMapStyle.showWeakLinks, activeRelationshipTypes, autoConnectionFocus, edges, mode, selectedName, viewMode]);

  const renderedNodes = useMemo(() => {
    if (mode === 'custom' || selectedName || (selectedRegion && mapRegionFocus) || search.trim()) return nodes;
    const keys = new Set<string>();
    for (const edge of visibleEdges) {
      if (keys.size >= 12 && (!keys.has(conceptKey(edge.from)) || !keys.has(conceptKey(edge.to)))) continue;
      keys.add(conceptKey(edge.from));
      keys.add(conceptKey(edge.to));
      if (keys.size >= 12) break;
    }
    if (keys.size < 8) {
      [...nodes].sort((a, b) => b.count - a.count).forEach((node) => {
        if (keys.size < Math.min(8, nodes.length)) keys.add(conceptKey(node.name));
      });
    }
    return nodes.filter((node) => keys.has(conceptKey(node.name))).slice(0, 12);
  }, [mode, nodes, search, selectedName, selectedRegion, visibleEdges]);

  const renderedNodeKeys = useMemo(() => new Set(renderedNodes.map((node) => conceptKey(node.name))), [renderedNodes]);
  const renderedNodeNames = JSON.stringify(renderedNodes.map((node) => node.name));
  useEffect(() => {
    if (atlasSection !== 'map') return;
    const names = JSON.parse(renderedNodeNames) as string[];
    const measure = () => {
      const sizes = Object.fromEntries(names.flatMap((name) => {
        const button = nodeButtons.current.get(name);
        return button ? [[name, { width: button.offsetWidth, height: button.offsetHeight }]] : [];
      }));
      setNodeSizes(sizes);
    };
    const observer = new ResizeObserver(measure);
    names.forEach((name) => {
      const button = nodeButtons.current.get(name);
      if (button) observer.observe(button);
    });
    measure();
    return () => observer.disconnect();
  }, [atlasSection, renderedNodeNames]);

  const positionedNodes = useMemo(() => renderedNodes.map((node) => ({
    ...node,
    ...atlasVisibleNodePosition(node, mapSize, nodeSizes[node.name] ?? { width: 152, height: 72 }, mapZoomPlane.scale),
  })), [renderedNodes, mapSize, nodeSizes, mapZoomPlane.scale]);
  const regionIslands = useMemo(() => {
    if (mode !== 'auto' || mapRegionFocus) return [];
    return atlasRegions.flatMap((region, index) => {
      const members = positionedNodes.filter((node) => primaryRegionOf.get(conceptKey(node.name)) === index);
      if (members.length < 2) return [];
      const xs = members.map((node) => node.x);
      const ys = members.map((node) => node.y);
      const pad = 8;
      const left = Math.max(0, Math.min(...xs) - pad);
      const top = Math.max(0, Math.min(...ys) - pad - 4);
      return [{
        id: region.id,
        name: region.name,
        left,
        top,
        width: Math.min(100 - left, Math.max(...xs) - Math.min(...xs) + pad * 2),
        height: Math.min(100 - top, Math.max(...ys) - Math.min(...ys) + pad * 2 + 4),
        hue: (index * 67 + 30) % 360,
      }];
    });
  }, [atlasRegions, mapRegionFocus, mode, positionedNodes, primaryRegionOf]);
  const positionedNodeByKey = useMemo(() => new Map(positionedNodes.map((node) => [conceptKey(node.name), node])), [positionedNodes]);
  const renderedEdges = useMemo(
    () => visibleEdges.filter((edge) => renderedNodeKeys.has(conceptKey(edge.from)) && renderedNodeKeys.has(conceptKey(edge.to))),
    [renderedNodeKeys, visibleEdges],
  );


  const activeEdgeNodes = useMemo(() => {
    if (!activeEdgeId) return new Set<string>();
    const activeEdge = visibleEdges.find((edge) => edgeSignature(edge) === activeEdgeId);
    if (!activeEdge) return new Set<string>();
    return new Set([conceptKey(activeEdge.from), conceptKey(activeEdge.to)]);
  }, [activeEdgeId, visibleEdges]);

  const selectedClusterNodes = useMemo(() => {
    if (!selectedName || activeEdgeId) return new Set<string>();
    const selectedKey = conceptKey(selectedName);
    const cluster = new Set<string>([selectedKey]);
    visibleEdges.forEach((edge) => {
      const fromKey = conceptKey(edge.from);
      const toKey = conceptKey(edge.to);
      if (fromKey === selectedKey || toKey === selectedKey) {
        cluster.add(fromKey);
        cluster.add(toKey);
      }
    });
    return cluster;
  }, [activeEdgeId, selectedName, visibleEdges]);

  const selectedClusterEdges = useMemo(() => {
    if (!selectedName || activeEdgeId) return new Set<string>();
    const selectedKey = conceptKey(selectedName);
    const cluster = new Set<string>();
    visibleEdges.forEach((edge) => {
      const fromKey = conceptKey(edge.from);
      const toKey = conceptKey(edge.to);
      if (fromKey === selectedKey || toKey === selectedKey) {
        cluster.add(edgeSignature(edge));
      }
    });
    return cluster;
  }, [activeEdgeId, selectedName, visibleEdges]);

  const openConceptInGraph = (name: string) => {
    setMode('auto');
    setSearch('');
    setSelectedName(name);
    setIsPanelOpen(true);
    setPanelSection('evidence');
    setAtlasSection('map');
  };

  const openRegionInMap = (regionId: string) => {
    setMode('auto');
    setSearch('');
    setSelectedName(null);
    setIsPanelOpen(false);
    setSelectedRegionId(regionId);
    setMapRegionFocus(true);
    setRegionDetailOpen(false);
    setAtlasSection('map');
  };

  const openRegionWorkspace = (regionId: string) => {
    openRegion(regionId);
  };

  const availableNodeTerms = useMemo(() => {
    const existingNames = new Set((activeMap?.nodeNames || []).map(conceptKey));
    return terms.filter(t => !existingNames.has(conceptKey(t)));
  }, [activeMap?.nodeNames, terms]);

  const selectedMapLinks = useMemo(() => {
    if (!selectedName || mode !== 'custom' || !activeMap) return [];
    const key = conceptKey(selectedName);
    return (activeMap.manualLinks || []).filter(l => conceptKey(l.from) === key || conceptKey(l.to) === key);
  }, [selectedName, mode, activeMap]);

  const selectedTypedLinks = useMemo(() => {
    if (!selectedName) return [];
    const key = conceptKey(selectedName);
    return links.filter((link) => {
      const fromConcept = link.fromType === 'concept' ? concepts.find((concept) => concept.id === link.fromId) : null;
      const toConcept = link.toType === 'concept' ? concepts.find((concept) => concept.id === link.toId) : null;
      return conceptKey(fromConcept?.name || link.fromLabel) === key || conceptKey(toConcept?.name || link.toLabel) === key;
    });
  }, [concepts, links, selectedName]);

  const markLinkInteraction = (link: AtlasLinkItem) => {
    setLinkInteractionMap((prev) => ({
      ...prev,
      [link.id]: {
        lastInteractedAt: today(),
        interactionCount: (prev[link.id]?.interactionCount || 0) + 1,
      },
    }));
    if (link.kind === 'typed') {
      if (link.groupedLinkIds?.length) {
        link.groupedLinkIds.forEach((id) => onInteractLink?.(id));
      } else {
        onInteractLink?.(link.id);
      }
    }
  };

  const openLinkDetail = (link: AtlasLinkItem) => {
    markLinkInteraction(link);
    setActiveEdgeId(activeEdgeSignatureForLink(link));
    setSelectedLink(link);
  };

  const handleEdgeHoverInteraction = (edge: MapEdge) => {
    if (edge.type !== 'typed') return;
    const hoverKey = edge.id || atlasEdgePairKey(edge);
    const now = Date.now();
    const last = edgeHoverInteractionRef.current[hoverKey] || 0;
    if (now - last < 10000) return;
    edgeHoverInteractionRef.current[hoverKey] = now;
    markLinkInteraction(linkItemForEdge(edge));
  };

  const beginQuickLinkMode = (sourceName: string) => {
    setSelectedName(sourceName);
    setQuickLinkSource(sourceName);
    setQuickLinkTarget(null);
    setQuickLinkHoverTarget(null);
    setShowAdvancedLinkTypes(false);
    setPanelSection('actions');
  };

  const openNodeLinkPanel = (sourceName: string) => {
    setSelectedName(sourceName);
    setIsPanelOpen(true);
    setPanelSection('links');
  };

  const clearQuickLinkMode = () => {
    setQuickLinkSource(null);
    setQuickLinkTarget(null);
    setQuickLinkHoverTarget(null);
    setShowAdvancedLinkTypes(false);
  };

  const activateMapNode = (name: string, moveFocus: boolean) => {
    if (quickLinkSource) {
      if (conceptKey(name) === conceptKey(quickLinkSource)) return;
      setQuickLinkTarget(name);
      setQuickLinkHoverTarget(name);
      setLinkDraft((prev) => ({ ...prev, to: conceptKey(name), type: prev.type || 'supports', label: prev.label || 'supports' }));
      setIsLinkOpen(true);
      return;
    }
    if (moveFocus) {
      focusInspectorRef.current = true;
      inspectorCloseRef.current?.focus({ preventScroll: true });
    }
    setSelectedName(name);
    setIsPanelOpen(true);
  };

  const closeNodeInspector = () => {
    const trigger = selectedName ? nodeButtons.current.get(selectedName) : undefined;
    clearQuickLinkMode();
    setSelectedName(null);
    setIsPanelOpen(false);
    (trigger || mapControlsRef.current)?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!focusInspectorRef.current || !selectedName || !isPanelOpen) return;
    focusInspectorRef.current = false;
    inspectorCloseRef.current?.focus({ preventScroll: true });
  }, [selectedName, isPanelOpen]);

  const getLinkInteractionTime = (link: AtlasLinkItem) =>
    linkInteractionMap[link.id]?.lastInteractedAt || link.lastInteractedAt || link.updatedAt || link.createdAt || '';

  const startEdgeHold = (edge: MapEdge) => {
    const linkItem = linkItemForEdge(edge);
    if (!linkItem.removable) return;
    setActiveEdgeId(activeEdgeSignatureForLink(linkItem));
    if (edgeHoldTimerRef.current) clearTimeout(edgeHoldTimerRef.current);
    edgeHoldTimerRef.current = setTimeout(() => {
      setSelectedLink(null);
      setCutLinkMethod('atlas_long_hold');
      registryRemovalOpener.current = null;
      setCutLinkCandidate(linkItem);
      markLinkInteraction(linkItem);
      suppressNextEdgeClickRef.current = true;
      edgeHoldTimerRef.current = null;
    }, 700);
  };

  const cancelEdgeHold = () => {
    if (edgeHoldTimerRef.current) {
      clearTimeout(edgeHoldTimerRef.current);
      edgeHoldTimerRef.current = null;
    }
  };

  function linkItemForEdge(edge: MapEdge): AtlasLinkItem {
    if (edge.type === 'user') {
      const mapLink = activeMap?.manualLinks?.find((link) => link.id === edge.id);
      return {
        id: edge.id || `${edge.from}:${edge.to}`,
        kind: 'custom',
        from: mapLink?.from || edge.from,
        to: mapLink?.to || edge.to,
        label: mapLink?.label || edge.label,
        linkType: mapLink?.type || edge.linkType,
        note: mapLink?.note,
        removable: Boolean(mapLink),
        sourceLabel: 'Custom map link',
        createdAt: mapLink?.dateCreated,
        updatedAt: mapLink?.dateCreated,
      };
    }

    if (edge.type === 'typed') {
      const groupedLinks = (edge.groupedLinkIds?.length
        ? links.filter((link) => edge.groupedLinkIds?.includes(link.id))
        : links.filter((link) => link.id === edge.id)
      ).sort((left, right) => (right.connectionScore || 0) - (left.connectionScore || 0));
      const typedLink = groupedLinks[0];
      return {
        id: groupedLinks.length > 1 ? (edge.id || `${edge.from}:${edge.to}`) : (typedLink?.id || edge.id || `${edge.from}:${edge.to}`),
        kind: 'typed',
        from: typedLink?.fromLabel || edge.from,
        to: typedLink?.toLabel || edge.to,
        label: typedLink?.type?.replace(/_/g, ' ') || edge.label,
        linkType: typedLink?.type || edge.linkType,
        note: groupedLinks.length > 1
          ? `This pair carries ${groupedLinks.length} typed relationships: ${groupedLinks.map((link) => link.type.replace(/_/g, ' ')).join(', ')}.${typedLink?.note ? `\n\nPrimary note: ${typedLink.note}` : ''}`
          : typedLink?.note,
        removable: Boolean(groupedLinks.length === 1 && typedLink && onDeleteLink),
        sourceLabel: groupedLinks.length > 1 ? 'Typed philosophical relationships' : 'Typed philosophical link',
        createdAt: typedLink?.dateCreated,
        updatedAt: typedLink?.dateUpdated,
        lastInteractedAt: edge.lastInteractedAt || typedLink?.lastInteractedAt,
        interactionCount: edge.interactionCount || typedLink?.interactionCount,
        groupedLinkIds: groupedLinks.map((link) => link.id),
        relationshipTypes: groupedLinks.map((link) => link.type.replace(/_/g, ' ')),
      };
    }

    if (edge.type === 'concept') {
      const sourceConcept = concepts.find((concept) => conceptKey(concept.name) === conceptKey(edge.from));
      return {
        id: `concept:${sourceConcept?.id || edge.from}:${conceptKey(edge.to)}`,
        kind: 'concept',
        from: edge.from,
        to: edge.to,
        label: edge.label,
        linkType: 'concept',
        removable: Boolean(sourceConcept),
        sourceLabel: 'Saved concept link',
        sourceConceptId: sourceConcept?.id,
        conceptTarget: conceptKey(edge.to),
        createdAt: sourceConcept?.dateCreated,
        updatedAt: sourceConcept?.dateUpdated,
      };
    }

    return {
      id: `shared:${conceptKey(edge.from)}:${conceptKey(edge.to)}`,
      kind: 'shared',
      from: edge.from,
      to: edge.to,
      label: edge.label,
      linkType: 'shared evidence',
      note: 'This link is derived from shared sources, positions, inquiries, works, or practices.',
      removable: false,
      sourceLabel: 'Auto/shared evidence link',
      createdAt: undefined,
      updatedAt: undefined,
      objectTypes: edge.objectTypes,
    };
  }

  function edgeSignature(edge: MapEdge) {
    if (edge.type === 'user') return edge.id || `${edge.from}:${edge.to}`;
    if (edge.type === 'typed') return edge.id || `${edge.from}:${edge.to}`;
    if (edge.type === 'concept') {
      const sourceConcept = concepts.find((concept) => conceptKey(concept.name) === conceptKey(edge.from));
      return `concept:${sourceConcept?.id || edge.from}:${conceptKey(edge.to)}`;
    }
    return `shared:${conceptKey(edge.from)}:${conceptKey(edge.to)}`;
  }

  function activeEdgeSignatureForLink(link: AtlasLinkItem) {
    if (link.kind === 'typed') {
      return `typed-group:${[conceptKey(link.from), conceptKey(link.to)].sort().join('::')}`;
    }
    return link.id;
  }

  const selectedNodeLinks = useMemo<AtlasLinkItem[]>(() => {
    if (!selectedName) return [];
    const key = conceptKey(selectedName);
    const items: AtlasLinkItem[] = [];

    selectedMapLinks.forEach((link) => {
      items.push({
        id: link.id,
        kind: 'custom',
        from: link.from,
        to: link.to,
        label: link.label || link.type,
        linkType: link.type,
        note: link.note,
        removable: true,
        sourceLabel: 'Custom map link',
        createdAt: link.dateCreated,
        updatedAt: link.dateCreated,
      });
    });

    concepts.forEach((concept) => {
      (concept.links || []).forEach((target) => {
        const from = conceptKey(concept.name);
        const to = conceptKey(target);
        if (from !== key && to !== key) return;
        items.push({
          id: `concept:${concept.id}:${to}`,
          kind: 'concept',
          from,
          to,
          label: 'saved concept link',
          linkType: 'concept',
          removable: true,
          sourceLabel: 'Saved concept link',
          sourceConceptId: concept.id,
          conceptTarget: to,
          createdAt: concept.dateCreated,
          updatedAt: concept.dateUpdated,
        });
      });
    });

    selectedTypedLinks.forEach((link) => {
      items.push({
        id: link.id,
        kind: 'typed',
        from: link.fromLabel || link.fromType,
        to: link.toLabel || link.toType,
        label: link.type.replace(/_/g, ' '),
        linkType: link.type,
        note: link.note,
        removable: Boolean(onDeleteLink),
        sourceLabel: 'Typed philosophical link',
        createdAt: link.dateCreated,
        updatedAt: link.dateUpdated,
        lastInteractedAt: link.lastInteractedAt,
        interactionCount: link.interactionCount,
      });
    });

    edges
      .filter((edge) => edge.type === 'shared' && (conceptKey(edge.from) === key || conceptKey(edge.to) === key))
      .forEach((edge) => items.push(linkItemForEdge(edge)));

    const seen = new Set<string>();
    const uniqueItems = items.filter((item) => {
      const id = `${item.kind}:${item.id}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return [...uniqueItems].sort((a, b) => {
      const aTarget = conceptKey(a.from) === key ? a.to : a.from;
      const bTarget = conceptKey(b.from) === key ? b.to : b.from;
      if (linkSort === 'created') {
        return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0);
      }
      if (linkSort === 'interacted') {
        return (Date.parse(getLinkInteractionTime(b)) || 0) - (Date.parse(getLinkInteractionTime(a)) || 0);
      }
      return aTarget.localeCompare(bTarget);
    });
  }, [concepts, edges, getLinkInteractionTime, linkSort, onDeleteLink, selectedMapLinks, selectedName, selectedTypedLinks]);

  const removableNodeLinks = useMemo(() => selectedNodeLinks.filter((link) => link.removable), [selectedNodeLinks]);

  const relatedDialogData = useMemo(() => {
    if (!relatedDialogType || !related) return null;

    switch (relatedDialogType) {
      case 'sources':
        return {
          title: `${selectedName} Sources`,
          empty: 'No related sources yet.',
          items: related.sources.map((item) => ({
            id: item.id,
            title: item.title,
            meta: [item.creator, item.type, item.status].filter(Boolean).join(' · '),
            body:
              item.description ||
              item.capture?.after?.coreArgument ||
              item.capture?.after?.lasting ||
              item.capture?.before?.expectation ||
              item.capture?.before?.openQuestion ||
              '',
          })),
        };
      case 'works':
        return {
          title: `${selectedName} Works`,
          empty: 'No related works yet.',
          items: related.drafts.map((item) => ({
            id: item.id,
            title: item.title,
            meta: [item.type.replace(/_/g, ' '), item.status].filter(Boolean).join(' · '),
            body: item.body || item.finalContent || item.draftContent || '',
          })),
        };
      case 'practices':
        return {
          title: `${selectedName} Practices`,
          empty: 'No related practices yet.',
          items: related.practices.map((item) => ({
            id: item.id,
            title: item.title,
            meta: [item.type.replace(/_/g, ' '), item.status].filter(Boolean).join(' · '),
            body: item.description || item.notes || '',
          })),
        };
      case 'inquiries':
        return {
          title: `${selectedName} Inquiries`,
          empty: 'No related inquiries yet.',
          items: related.questions.map((item) => ({
            id: item.id,
            title: item.text,
            meta: item.status.replace(/_/g, ' '),
            body: item.answer || '',
          })),
        };
      case 'unknowns':
        return {
          title: `${selectedName} Unknowns`,
          empty: 'No related unknowns yet.',
          items: relatedUnknowns.map((item) => ({
            id: item.unknownId,
            title: item.title,
            meta: [item.status, item.importance].filter(Boolean).join(' · '),
            body: item.description || item.resolutionSummary || '',
          })),
        };
      default:
        return null;
    }
  }, [related, relatedDialogType, relatedUnknowns, selectedName]);

  const renderSelectedNodeLinkCard = (link: AtlasLinkItem) => {
    const target = conceptKey(link.from) === conceptKey(selectedName || '') ? link.to : link.from;
    const isGroupedTyped = link.kind === 'typed' && (link.relationshipTypes?.length || 0) > 1;
    return (
      <div key={`${link.kind}:${link.id}`} className="rounded-lg border border-border/50 bg-muted/10 p-3">
        <button onClick={() => openLinkDetail(link)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-headline text-sm font-semibold italic text-primary">{target}</div>
              <div className="mt-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">
                {link.sourceLabel} · {link.label}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isGroupedTyped && (
                <Badge variant="outline" className="rounded-full bg-accent/10 noesis-eyebrow noesis-eyebrow--sm text-accent">
                  {link.relationshipTypes?.length} types
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{link.kind}</Badge>
            </div>
          </div>
          {isGroupedTyped && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {link.relationshipTypes?.slice(0, 4).map((type) => (
                <Badge key={type} variant="outline" className="rounded-full bg-muted/20 noesis-eyebrow noesis-eyebrow--sm">
                  {type}
                </Badge>
              ))}
              {(link.relationshipTypes?.length || 0) > 4 && (
                <Badge variant="outline" className="rounded-full bg-muted/20 noesis-eyebrow noesis-eyebrow--sm">
                  +{(link.relationshipTypes?.length || 0) - 4} more
                </Badge>
              )}
            </div>
          )}
          {link.note && <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">{link.note}</p>}
        </button>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openLinkDetail(link)} className="h-7 rounded-full px-3">
            {isGroupedTyped ? 'Review Set' : 'Details'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!link.removable}
            onClick={() => {
              setCutLinkMethod('atlas_node_action');
              setSelectedLink(null);
              registryRemovalOpener.current = null;
              setCutLinkCandidate(link);
            }}
            className="h-7 rounded-full px-3 text-destructive hover:text-destructive disabled:text-muted-foreground"
          >
            Delete Link
          </Button>
        </div>
      </div>
    );
  };

  const atlasPanel = (
    <aside
      id={inspectorId}
      aria-label={selectedName ? `Atlas inspector: ${selectedName}` : 'Atlas inspector'}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
        if (quickLinkSource) return;
        event.preventDefault();
        event.stopPropagation();
        closeNodeInspector();
      }}
      className={cn(
        "z-40 flex shrink-0 flex-col overflow-hidden border border-border bg-card shadow-lg",
        isFullScreen
          ? "absolute inset-x-2 bottom-2 h-[42%] rounded-xl sm:bottom-4 sm:left-auto sm:right-4 sm:top-16 sm:h-auto sm:w-80 sm:rounded-2xl"
          : "absolute inset-x-2 bottom-2 h-[min(52%,32rem)] rounded-xl md:bottom-6 md:left-auto md:right-6 md:top-16 md:h-auto md:w-[min(22rem,calc(100%-1rem))]"
      )}
    >
      {selectedName ? (
        <>
          <div className="flex items-start justify-between border-b border-border/50 p-5">
            <div>
              <Badge variant="outline" className="mb-2 noesis-eyebrow noesis-eyebrow--sm text-accent rounded-full">Map Node</Badge>
              <h2 className="font-headline text-2xl font-bold italic">{selectedName}</h2>
              {selectedConcept?.description && <p className="mt-2 text-sm text-muted-foreground font-body">{selectedConcept.description}</p>}
            </div>
            <Button
              ref={inspectorCloseRef}
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label="Close Atlas inspector"
              onClick={closeNodeInspector}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4 space-y-2">
              <Label className="noesis-eyebrow text-muted-foreground">Panel Section</Label>
              <Select value={panelSection} onValueChange={(value) => setPanelSection(value as 'links' | 'evidence' | 'events' | 'actions')}>
                <SelectTrigger aria-label="Inspector section" className="min-h-11 rounded-full bg-card">
                  <SelectValue placeholder="Choose section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="links">Links</SelectItem>
                  <SelectItem value="evidence">Evidence & Outputs</SelectItem>
                  <SelectItem value="events">Recent Events</SelectItem>
                  <SelectItem value="actions">Actions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeMap && (
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Node Color</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                   
                    onClick={() => updateNodeColor(selectedName!)}
                    disabled={!effectiveNodeColors[conceptKey(selectedName!)]}
                  >
                    Reset
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {atlasColorSwatches.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Set node color ${color}`}
                      className={cn(
                        'size-6 rounded-full border border-border shadow-sm ring-offset-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring',
                        effectiveNodeColors[conceptKey(selectedName!)] === color && 'ring-2 ring-accent'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => updateNodeColor(selectedName!, color)}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom node color"
                    value={effectiveNodeColors[conceptKey(selectedName!)] || '#7c3aed'}
                    onChange={(event) => updateNodeColor(selectedName!, event.target.value)}
                    className="h-7 w-9 cursor-pointer rounded-md border border-border bg-card p-0.5"
                  />
                </div>
              </div>
            )}

            {panelSection === 'links' && (
              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="noesis-eyebrow text-muted-foreground">Links</h4>
                  <div className="flex items-center gap-2">
                    <Select value={linkSort} onValueChange={(value) => setLinkSort(value as 'alpha' | 'created' | 'interacted')}>
                      <SelectTrigger className="h-7 w-[148px] rounded-full bg-card px-3 noesis-eyebrow noesis-eyebrow--sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alpha">Sort: A-Z</SelectItem>
                        <SelectItem value="created">Sort: Recently Created</SelectItem>
                        <SelectItem value="interacted">Sort: Recently Interacted</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => beginQuickLinkMode(selectedName!)}>
                    <Link2 className="mr-1 size-3.5" /> Link This Idea
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedNodeLinks.map(renderSelectedNodeLinkCard)}
                  {!selectedNodeLinks.length && <p className="text-[10px] italic text-muted-foreground font-body">No links yet.</p>}
                </div>
              </section>
            )}

            {panelSection === 'evidence' && (
              <section>
                <h4 className="mb-3 noesis-eyebrow text-muted-foreground">Evidence And Outputs</h4>
                {related ? (
                  <div className="flex flex-wrap gap-2">
                    <Pill look="mono" onClick={() => setRelatedDialogType('sources')} disabled={!related.sources.length}>{related.sources.length} sources</Pill>
                    <Pill look="mono" onClick={() => setIsPositionsOpen(true)} disabled={!related.beliefs.length}>{related.beliefs.length} positions</Pill>
                    <Pill look="mono" onClick={() => setRelatedDialogType('works')} disabled={!related.drafts.length}>{related.drafts.length} works</Pill>
                    <Pill look="mono" onClick={() => setRelatedDialogType('practices')} disabled={!related.practices.length}>{related.practices.length} practices</Pill>
                    <Pill look="mono" onClick={() => setRelatedDialogType('inquiries')} disabled={!related.questions.length}>{related.questions.length} inquiries</Pill>
                    <Pill look="mono" onClick={() => setRelatedDialogType('unknowns')} disabled={!relatedUnknowns.length}>{relatedUnknowns.length} unknowns</Pill>
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground font-body">Gathering links...</p>
                )}
              </section>
            )}

            {panelSection === 'events' && (
              <section>
                <h4 className="mb-3 noesis-eyebrow text-muted-foreground">Recent Thinking Events</h4>
                <div className="space-y-2">
                  {recentThinkingForNode.length ? recentThinkingForNode.map((event) => (
                    <div key={event.eventId} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                      <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{event.eventType.replace(/_/g, ' ')}</div>
                      <p className="mt-1 text-sm italic text-foreground/80">{event.summary}</p>
                    </div>
                  )) : (
                    <p className="text-xs italic text-muted-foreground font-body">No event-based history has been attached to this node yet.</p>
                  )}
                </div>
              </section>
            )}

                  {panelSection === 'actions' && (
                    <section className="space-y-3">
                      <h4 className="noesis-eyebrow text-muted-foreground">Actions</h4>
                      <Button size="sm" variant="outline" className="min-h-11 w-full justify-center text-xs" onClick={() => {
                        beginQuickLinkMode(selectedName!);
                        const next = renderedNodes.find((node) => node.name !== selectedName);
                        if (next) nodeButtons.current.get(next.name)?.focus({ preventScroll: true });
                      }}>
                        <Link2 className="mr-1.5 size-3.5" /> Quick Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!removableNodeLinks.length}
                        onClick={() => {
                          setCutLinkMethod('atlas_node_action');
                          setIsDeleteAllLinksOpen(true);
                        }}
                        className="min-h-11 w-full justify-center rounded-full px-2 text-xs text-destructive hover:text-destructive disabled:text-muted-foreground"
                      >
                        Delete Connected Links
                      </Button>
                      {mode === 'custom' && activeMap && (
                        <Button variant="ghost" size="sm" onClick={() => removeNodeFromMap(selectedName)} className="h-8 w-full justify-center rounded-full text-destructive hover:text-destructive">
                          Remove from this map
                  </Button>
                )}
              </section>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <MapIcon className="mb-4 size-12 opacity-10" />
          <h3 className="mb-2 font-headline text-lg italic">Mental Atlas</h3>
          <p className="text-sm font-body">Select a concept to see its links, evidence, and history.</p>
        </div>
      )}
    </aside>
  );

  const linkTargets = useMemo(() => {
    if (!selectedName) return [];
    const key = conceptKey(selectedName);
    return visibleTerms.filter(t => conceptKey(t) !== key);
  }, [selectedName, visibleTerms]);

  const addConcept = async () => {
    if (!newConcept.name?.trim() || conceptCreationLock.current) return;
    conceptCreationLock.current = true;
    setCreatingConcept(true);
    try {
      if (await onAddConcept({ ...newConcept, name: conceptKey(newConcept.name), createdFrom: 'manual' }) === false) throw new Error('Concept was not persisted.');
      setNewConcept({ name: '', description: '', sourceIds: [] });
      setIsAddOpen(false);
    } catch {
      toast({ title: 'Concept not saved', description: 'Your draft is still here. Please retry.', variant: 'destructive' });
    } finally { conceptCreationLock.current = false; setCreatingConcept(false); }
  };

  const toggleNewConceptSource = (id: string) => {
    setNewConcept((prev) => {
      const current = prev.sourceIds || [];
      const next = current.includes(id) ? current.filter((sourceId) => sourceId !== id) : [...current, id];
      return { ...prev, sourceIds: next };
    });
  };

  const atlasNodeIdsForNames = (names: string[]) =>
    names.map((name) => concepts.find((concept) => conceptKey(concept.name) === conceptKey(name))?.id || conceptKey(name));

  const createCustomMap = async () => {
    if (!newMap.title.trim() || mapCreationLock.current) return;
    mapCreationLock.current = true;
    setCreatingMap(true);
    setMapCreationError('');
    const initialNodeNames = selectedName ? [conceptKey(selectedName)] : [];
    try {
      const id = await onAddAtlasMap({
        title: newMap.title.trim(),
        mode: 'custom',
        description: newMap.description.trim(),
        nodeNames: initialNodeNames,
        nodeIds: atlasNodeIdsForNames(initialNodeNames),
        nodePositions: selectedName ? { [conceptKey(selectedName)]: { x: 50, y: 50 } } : {},
        manualLinks: [],
        nodeColors: {},
        linkColors: {},
        linkIds: [],
        autoLinkFilters: defaultAutoLinkFilters,
        style: defaultAtlasMapStyle,
      });
      setActiveMapId(id);
      setNewMap({ title: '', description: '' });
      setMode('custom');
      setIsMapOpen(false);
    } catch {
      setMapCreationError('The map could not be saved. Your changes are still here.');
    } finally {
      mapCreationLock.current = false;
      setCreatingMap(false);
    }
  };

  const updateActiveMap = (patch: Partial<AtlasMap>, rethrow = false) => {
    if (!activeMap) return;
    const nextNodeNames = patch.nodeNames || activeMap.nodeNames || [];
    const nextManualLinks = patch.manualLinks || activeMap.manualLinks || [];
    return onUpdateAtlasMap({
      ...activeMap,
      ...patch,
      mode: patch.mode || activeMap.mode || 'custom',
      nodeIds: patch.nodeIds || atlasNodeIdsForNames(nextNodeNames),
      linkIds: patch.linkIds || nextManualLinks.map((link) => link.id),
    }, rethrow);
  };

  const updateNodeColor = (nodeName: string, color?: string) => {
    if (!activeMap) return;
    const key = conceptKey(nodeName);
    const nextNodeColors = { ...(activeMap.nodeColors || {}) };
    if (color) {
      nextNodeColors[key] = color;
    } else {
      delete nextNodeColors[key];
    }
    updateActiveMap({ nodeColors: nextNodeColors });
  };

  const updateLinkColor = (link: AtlasLinkItem, color?: string) => {
    if (!activeMap) return;
    const key = atlasLinkColorKey(link);
    const nextLinkColors = { ...(activeMap.linkColors || {}) };
    if (color) {
      nextLinkColors[key] = color;
    } else {
      delete nextLinkColors[key];
    }
    updateActiveMap({ linkColors: nextLinkColors });
    setSelectedLink((prev) => (prev && prev.id === link.id && prev.kind === link.kind ? { ...prev } : prev));
  };

  const addNodeToMap = (name: string) => {
    if (!activeMap) return;
    const key = conceptKey(name);
    const nodeNames = Array.from(new Set([...(activeMap.nodeNames || []).map(conceptKey), key]));
    const angle = -Math.PI / 2 + (Math.PI * 2 * nodeNames.length) / Math.max(1, nodeNames.length + 1);
    updateActiveMap({
      nodeNames,
      nodePositions: {
        ...(activeMap.nodePositions || {}),
        [key]: activeMap.nodePositions?.[key] || { x: 50 + Math.cos(angle) * 28, y: 50 + Math.sin(angle) * 28 },
      },
    });
    setSelectedName(key);
    setIsNodeOpen(false);
  };

  function removeNodeFromMap(name: string) {
    if (!activeMap) return;
    const key = conceptKey(name);
    const nextPositions = { ...(activeMap.nodePositions || {}) };
    delete nextPositions[key];
    updateActiveMap({
      nodeNames: (activeMap.nodeNames || []).filter((nodeName) => conceptKey(nodeName) !== key),
      nodePositions: nextPositions,
      manualLinks: (activeMap.manualLinks || []).filter((link) => conceptKey(link.from) !== key && conceptKey(link.to) !== key),
    });
    setSelectedName(null);
  }

  const createLink = async () => {
    if (!selectedName || !linkDraft.to.trim() || linkSaveLock.current) return;
    linkSaveLock.current = true;
    setLinkSaving(true);
    setLinkError('');
    try {
      const targetConcept = concepts.find((concept) => conceptKey(concept.name) === conceptKey(linkDraft.to));

      if (mode === 'custom' && activeMap) {
        const link: AtlasMapLink = {
          id: makeId(),
          from: conceptKey(selectedName),
          to: conceptKey(linkDraft.to),
          type: linkDraft.type,
          label: linkDraft.label.trim() || linkDraft.type,
          note: linkDraft.note.trim(),
          dateCreated: today(),
        };
        setConnectionTrace({ edgeId: link.id, from: link.from });
        await updateActiveMap({ manualLinks: [...(activeMap.manualLinks || []), link] }, true);
      } else if (selectedConcept && targetConcept && onCreateLink) {
        const requestedType = linkDraft.type;
        const type = normalizeAtlasLinkType(requestedType);
        const label = linkDraft.label.trim();
        const note = [
          label && label !== requestedType ? `Atlas label: ${label}` : '',
          linkDraft.note.trim(),
        ]
          .filter(Boolean)
          .join('\n');
        const from = conceptKey(selectedConcept.name);
        const pairKey = [from, conceptKey(targetConcept.name)].sort().join('::');
        const edgeId = `typed-group:${pairKey}`;
        setConnectionTrace({ edgeId, from, previousLinkIds: new Set(links.map((link) => link.id)) });
        await onCreateLink({
          fromType: 'concept',
          fromId: selectedConcept.id,
          fromLabel: selectedConcept.name,
          toType: 'concept',
          toId: targetConcept.id,
          toLabel: targetConcept.name,
          type,
          note,
          createdFrom: 'manual',
          acceptedByUser: true,
        });
      } else if (selectedConcept) {
        const links = Array.from(new Set([...(selectedConcept.links || []), conceptKey(linkDraft.to)]));
        if (links.length > (selectedConcept.links || []).length) {
          setConnectionTrace({
            edgeId: `concept:${selectedConcept.id}:${conceptKey(linkDraft.to)}`,
            from: conceptKey(selectedConcept.name),
          });
        }
        await onUpdateConcept({ ...selectedConcept, links, dateUpdated: today() });
      } else {
        throw new Error('Choose an existing source concept.');
      }

      setLinkDraft({ to: '', type: 'relates', label: '', note: '' });
      setLinkSearch('');
      setIsLinkOpen(false);
      clearQuickLinkMode();
    } catch {
      setConnectionTrace(null);
      setLinkError('Could not save the relationship. Your draft is still here.');
    } finally {
      linkSaveLock.current = false;
      setLinkSaving(false);
    }
  };

  const removeUserLink = (id: string) => {
    if (!activeMap) return;
    updateActiveMap({ manualLinks: (activeMap.manualLinks || []).filter((link) => link.id !== id) });
  };

  const removeConceptLink = (targetName: string) => {
    if (!selectedConcept) return;
    const links = (selectedConcept.links || []).filter((link) => conceptKey(link) !== conceptKey(targetName));
    onUpdateConcept({ ...selectedConcept, links, dateUpdated: today() });
  };

  const cutLink = async (item: AtlasLinkItem) => {
    if (item.kind === 'custom') {
      removeUserLink(item.id);
    } else if (item.kind === 'typed') {
      await onDeleteLink?.(item.id, { method: cutLinkMethod });
    } else if (item.kind === 'concept' && item.sourceConceptId && item.conceptTarget) {
      const sourceConcept = concepts.find((concept) => concept.id === item.sourceConceptId);
      if (sourceConcept) {
        const nextLinks = (sourceConcept.links || []).filter((link) => conceptKey(link) !== conceptKey(item.conceptTarget));
        onUpdateConcept({ ...sourceConcept, links: nextLinks, dateUpdated: today() });
      }
    }
    if (activeEdgeId === activeEdgeSignatureForLink(item)) setActiveEdgeId(null);
    setSelectedLink(null);
    setCutLinkCandidate(null);
    setCutLinkMethod('atlas_link_detail');
  };

  const clearSelectedNodeLinks = () => {
    if (!selectedName) return;
    const key = conceptKey(selectedName);

    if (activeMap) {
      updateActiveMap({
        manualLinks: (activeMap.manualLinks || []).filter((link) => conceptKey(link.from) !== key && conceptKey(link.to) !== key),
      });
    }

    concepts.forEach((concept) => {
      const nextLinks = (concept.links || []).filter((link) => {
        const from = conceptKey(concept.name);
        const to = conceptKey(link);
        return from !== key && to !== key;
      });

      if (nextLinks.length !== (concept.links || []).length) {
        onUpdateConcept({ ...concept, links: nextLinks, dateUpdated: today() });
      }
    });

    if (onDeleteLink) {
      selectedTypedLinks.forEach((link) => void onDeleteLink(link.id, { method: cutLinkMethod }).catch(() => {
        toast({ title: 'A relationship could not be removed', variant: 'destructive' });
      }));
    }

    setSelectedLink(null);
    setCutLinkCandidate(null);
    setActiveEdgeId(null);
    setIsDeleteAllLinksOpen(false);
    setCutLinkMethod('atlas_link_detail');
  };

  const startPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !atlasCanDrag(event, isFullScreen)) return;
    if (quickLinkSource) {
      setQuickLinkCursor({ x: event.clientX, y: event.clientY });
      return;
    }
    if (nodeGestureRef.current || panGestureRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setSelectedName(null);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!event.isPrimary) return;
    if (quickLinkSource) {
      setQuickLinkCursor({ x: event.clientX, y: event.clientY });
    }
    const gesture = panGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const nodePositionAtPointer = (clientX: number, clientY: number) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(ATLAS_NODE_BOUNDS.maxX, Math.max(ATLAS_NODE_BOUNDS.minX, ((clientX - rect.left - pan.x) / rect.width) * 100));
    const y = Math.min(ATLAS_NODE_BOUNDS.maxY, Math.max(ATLAS_NODE_BOUNDS.minY, ((clientY - rect.top - pan.y) / rect.height) * 100));
    return { x, y };
  };

  const persistNode = (name: string, position: { x: number; y: number }) => {
    const key = conceptKey(name);
    const concept = concepts.find((item) => conceptKey(item.name) === key);
    setPositionsByScope((prev) => ({ ...prev, [mapScope]: { ...prev[mapScope], [key]: position } }));
    if (mode === 'custom' && activeMap) {
      void onMoveAtlasMapNode(activeMap.id, key, position).catch(() => {
        setPositionsByScope((current) => {
          if (current[mapScope]?.[key] !== position) return current;
          const next = { ...current[mapScope] };
          delete next[key];
          return { ...current, [mapScope]: next };
        });
        toast({ title: 'Node position not saved', description: 'The map will show its last saved position.', variant: 'destructive' });
      });
    } else if (concept) {
      onUpdateConcept({ ...concept, ...position, dateUpdated: today() });
    }
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panGestureRef.current?.pointerId === event.pointerId) panGestureRef.current = null;
  };

  const endNodeGesture = (pointerId: number, commit: boolean) => {
    const gesture = nodeGestureRef.current;
    if (gesture?.pointerId !== pointerId) return;
    nodeGestureRef.current = null;
    setNodePreview(null);
    setDraggingName(null);
    suppressNodeClickRef.current = Boolean(gesture.position) || !commit;
    if (commit && gesture.position) persistNode(gesture.name, gesture.position);
  };

  const edgePoints = (from: MapNode, to: MapNode) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const radius = (node: MapNode) => {
      const size = nodeSizes[node.name];
      if (!node.name) return 0;
      if (!activeMapStyle.nodeStyle || activeMapStyle.nodeStyle === 'default') {
        const dimension = Math.hypot(dx * mapSize.width, dy * mapSize.height);
        return dimension ? 850 * mapZoomPlane.scale * len / dimension : 0;
      }
      if (!size || !mapSize.width || !mapSize.height) return 0;
      return Math.min(
        ux ? size.width * mapZoomPlane.scale * 50 / (mapSize.width * Math.abs(ux)) : Infinity,
        uy ? size.height * mapZoomPlane.scale * 50 / (mapSize.height * Math.abs(uy)) : Infinity,
      );
    };
    const fromRadius = radius(from);
    const toRadius = radius(to);
    return {
      x1: from.x + ux * Math.min(fromRadius, len / 2),
      y1: from.y + uy * Math.min(fromRadius, len / 2),
      x2: to.x - ux * Math.min(toRadius, len / 2),
      y2: to.y - uy * Math.min(toRadius, len / 2),
    };
  };

  const edgeStrokeColor = (edge: MapEdge) => {
    const colorOverride = effectiveLinkColors[atlasLinkColorKey(linkItemForEdge(edge))];
    if (colorOverride) return colorOverride;
    const family = getAtlasRelationshipFamily(edge);
    if (mode === 'custom') {
      if (activeMapStyle.lineMode === 'singleColor') return activeMapStyle.customLineColor || '#7c3aed';
      if (activeMapStyle.lineMode === 'strengthColor') {
        if (edge.strength === 'strong') return cssColor('--caution');
        if (edge.strength === 'moderate') return '#8b5cf6';
        return '#94a3b8';
      }
    }
    switch (family) {
      case 'conflict':
        return 'hsl(0 68% 52%)';
      case 'support':
        return 'hsl(150 56% 34%)';
      case 'meaning':
        return 'hsl(209 72% 40%)';
      case 'practice':
        return 'hsl(36 84% 46%)';
      case 'evolution':
        return 'hsl(266 50% 48%)';
      case 'reference':
        return 'hsl(198 20% 48%)';
      case 'manual':
        return 'hsl(var(--accent))';
      default:
        return edge.type === 'concept' ? 'hsl(var(--primary) / .58)' : 'hsl(var(--muted-foreground) / .42)';
    }
  };

  const edgeVisuals = (
    edge: MapEdge,
    isHovered: boolean,
    isActive: boolean,
    hasActiveEdge: boolean,
    isSelectedClusterEdge: boolean,
    hasSelectedCluster: boolean,
  ) => {
    const strength = edge.strength || 'suggested';
    const isStrong = strength === 'strong';
    const isModerate = strength === 'moderate';
    const isWeak = strength === 'weak';
    const isSuggested = strength === 'suggested';
    const baseWidth = isStrong ? 3.7 : isModerate ? 2.25 : isWeak ? 1.1 : 1.4;
    const baseOpacity = isStrong ? 0.94 : isModerate ? 0.66 : isWeak ? 0.26 : 0.18;
    const widthBoost = isHovered ? 0.7 : 0;
    const opacityBoost = isHovered ? 0.14 : 0;
    const activeBoost = isActive ? 0.85 : 0;
    const activeOpacityBoost = isActive ? 0.18 : 0;
    const selectedBoost = hasSelectedCluster && isSelectedClusterEdge ? 0.35 : 0;
    const selectedOpacityBoost = hasSelectedCluster && isSelectedClusterEdge ? 0.12 : 0;
    const inactiveFade = hasActiveEdge && !isActive && !isHovered
      ? 0.45
      : hasSelectedCluster && !isSelectedClusterEdge && !isHovered
        ? 0.18
        : 1;
    return {
      strokeWidth: baseWidth + widthBoost + activeBoost + selectedBoost,
      strokeOpacity: Math.min(1, (baseOpacity + opacityBoost + activeOpacityBoost + selectedOpacityBoost) * inactiveFade),
      strokeDasharray: isSuggested ? '4 8' : isWeak ? '4 4' : '0',
      glowWidth: baseWidth + (isStrong ? 3.4 : isModerate ? 2.4 : 1.7) + (isActive ? 2.1 : 0),
      glowOpacity: isActive
        ? 0.3
        : isHovered
          ? (isStrong ? 0.22 : isModerate ? 0.16 : 0.1)
          : hasSelectedCluster && isSelectedClusterEdge
            ? 0.08
            : 0,
    };
  };

  const mapFontFamily = (fontFamily: AtlasMapFontFamily) => {
    switch (fontFamily) {
      case 'serif':
        return 'Georgia, Cambria, "Times New Roman", Times, serif';
      case 'mono':
        return '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
      case 'rounded':
        return '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", sans-serif';
      case 'condensed':
        return '"Arial Narrow", "Aptos Narrow", "Helvetica Neue", Arial, sans-serif';
      default:
        return 'Inter, "Segoe UI", Arial, sans-serif';
    }
  };

  const customMapBackgroundStyle = useMemo<React.CSSProperties>(() => {
    if (mode !== 'custom') return {};
    const background = activeMapStyle.background;
    const base: React.CSSProperties = {};

    if (background.type === 'color' && background.color) {
      base.backgroundColor = background.color;
      return base;
    }

    if (background.type === 'uploaded' && activeBackgroundUrl) {
      base.backgroundImage = `url(${activeBackgroundUrl})`;
      base.backgroundSize = 'cover';
      base.backgroundPosition = 'center';
      return base;
    }

    const preset = background.preset || 'dark';
    if (preset === 'light') {
      base.background = 'linear-gradient(180deg, rgba(250,248,244,1) 0%, rgba(242,238,232,1) 100%)';
    } else if (preset === 'paper') {
      base.background = 'linear-gradient(180deg, rgba(246,239,223,1) 0%, rgba(240,231,212,1) 100%)';
    } else if (preset === 'grid') {
      base.backgroundColor = cssColor('--background', 1, '#111111');
      base.backgroundImage = 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)';
      base.backgroundSize = '28px 28px';
    } else if (preset === 'blank') {
      base.backgroundColor = '#ffffff';
    } else {
      base.backgroundColor = '#111d2b';
    }

    return base;
  }, [activeBackgroundUrl, activeMapStyle.background, mode]);

  const customMapBackgroundOverlayStyle = useMemo<React.CSSProperties>(() => {
    if (mode !== 'custom') return {};
    return {
      opacity: activeMapStyle.background.opacity ?? 0.42,
      filter: `blur(${activeMapStyle.background.blur ?? 0}px)`,
    };
  }, [activeMapStyle.background.blur, activeMapStyle.background.opacity, mode]);

  const nodeCardClassName = (nodeStyle: AtlasMapNodeStyle | undefined, isSelected: boolean) => cn(
    'border-accent/20 bg-card/95 shadow-md hover:shadow-xl',
    nodeStyle === 'compact' && 'min-w-[112px] rounded-lg px-3 py-2',
    nodeStyle === 'pill' && 'min-w-[124px] rounded-full px-5 py-2.5',
    nodeStyle === 'card' && 'min-w-[152px] rounded-2xl px-4 py-4 shadow-lg',
    (!nodeStyle || nodeStyle === 'default') && 'noesis-atlas-star-node',
    isSelected && (isFullScreen
      ? 'border-accent shadow-2xl ring-2 ring-accent'
      : 'border-accent shadow-lg ring-1 ring-accent/85')
  );

  const nodeColorStyle = (nodeName: string): React.CSSProperties => {
    const color = effectiveNodeColors[conceptKey(nodeName)];
    const fontFamily = mode === 'custom' ? mapFontFamily(activeMapStyle.fontFamily) : undefined;
    if (!color || (!activeMapStyle.nodeStyle || activeMapStyle.nodeStyle === 'default')) return { fontFamily, '--atlas-node-ink': color } as React.CSSProperties;
    return {
      fontFamily,
      borderColor: color,
      boxShadow: `0 0 0 1px ${color}55, 0 12px 30px ${color}22`,
      background: `linear-gradient(135deg, ${color}24, hsl(var(--card)) 62%)`,
    };
  };

  const openMapStyle = () => {
    if (!activeMap) return;
    styleBase.current = activeMap;
    setStyleDraft(normalizeAtlasMapStyle(activeMap.style));
    setStyleError('');
    setIsStyleOpen(true);
  };

  const saveMapStyle = async () => {
    const base = styleBase.current;
    if (!base || styleSaveLock.current) return;
    if (base.id !== activeMap?.id || base.dateUpdated !== activeMap.dateUpdated) {
      setStyleError('The map changed while you were editing. Close and reopen Map Style to use the latest version.');
      return;
    }
    styleSaveLock.current = true;
    setSavingStyle(true);
    setStyleError('');
    try {
      const style = styleDraft.background.storagePath
        ? { ...styleDraft, background: { ...styleDraft.background, imageUrl: '' } }
        : styleDraft;
      await onUpdateAtlasMap({ ...base, style }, true);
      setIsStyleOpen(false);
    } catch (error) {
      setStyleError(error instanceof Error && error.name === 'WorkspaceRecordChangedError'
        ? 'The map changed before the style could be saved. Close and reopen Map Style to use the latest version.'
        : 'Map style was not saved. Your changes are still here.');
    } finally {
      styleSaveLock.current = false;
      setSavingStyle(false);
    }
  };

  const clearUploadedBackground = () => {
    setStyleDraft((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        type: 'preset',
        preset: 'dark',
        imageUrl: '',
        storagePath: '',
        blur: 0,
        opacity: 0.42,
      },
    }));
  };

  const handleBackgroundUpload = async (file?: File | null) => {
    if (!file || !activeMap || !uid) return;
    setIsUploadingBackground(true);
    try {
      const asset = await uploadPrivateAsset({
        uid,
        area: 'atlasMaps',
        entityId: activeMap.id,
        blob: file,
        originalName: file.name,
      });
      setStyleDraft((prev) => ({
        ...prev,
        background: {
          ...prev.background,
          type: 'uploaded',
          imageUrl: '',
          storagePath: asset.storagePath,
          opacity: prev.background.opacity ?? 0.58,
          blur: prev.background.blur ?? 0,
        },
      }));
    } finally {
      setIsUploadingBackground(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = '';
    }
  };

  const disableSharedAutoFiltersForLink = (link: AtlasLinkItem) => {
    if (mode !== 'custom' || !activeMap || link.kind !== 'shared') return;
    const objectTypes = link.objectTypes || [];
    updateActiveMap({
      autoLinkFilters: {
        ...(activeMap.autoLinkFilters || defaultAutoLinkFilters),
        sharedSources: objectTypes.includes('source') ? false : (activeMap.autoLinkFilters?.sharedSources ?? defaultAutoLinkFilters.sharedSources),
        sharedPositions: objectTypes.includes('position') ? false : (activeMap.autoLinkFilters?.sharedPositions ?? defaultAutoLinkFilters.sharedPositions),
        sharedInquiries: objectTypes.includes('inquiry') ? false : (activeMap.autoLinkFilters?.sharedInquiries ?? defaultAutoLinkFilters.sharedInquiries),
        sharedWorks: objectTypes.includes('work') ? false : (activeMap.autoLinkFilters?.sharedWorks ?? defaultAutoLinkFilters.sharedWorks),
        sharedPractices: objectTypes.includes('practice') ? false : (activeMap.autoLinkFilters?.sharedPractices ?? defaultAutoLinkFilters.sharedPractices),
      },
    });
  };


  const [atlasFocus, setAtlasFocus] = useState<{ id: string } | null>(null);
  const mapSearchResults = mode === 'auto' && search.trim()
    ? concepts.filter(concept => atlasNodeTimelineState(concept.dateCreated, timelineWindow) !== 'unborn' &&
      `${concept.name} ${(concept.aliases || []).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8) : [];
  const pickMapSearchResult = (concept: Concept) => {
    setAtlasFocus({ id: concept.id }); setSearch('');
  };

  return (
    <div data-noesis-identity="network" data-atlas-section={atlasSection} data-noesis-scroll-region onKeyDown={(event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
      if (quickLinkSource) clearQuickLinkMode();
      else if (isPanelOpen) closeNodeInspector();
      else if (isFullScreen) {
        setIsFullScreen(false);
        fullScreenButtonRef.current?.focus({ preventScroll: true });
      } else return;
      event.preventDefault();
      event.stopPropagation();
    }} className={cn(
      "relative flex w-full min-h-0 flex-col bg-background font-body",
      isFullScreen ? "fixed inset-0 z-50 overflow-hidden" : "flex-1 overflow-y-auto md:h-full md:overflow-hidden"
    )}>
      {!isFullScreen && (
        <header className="noesis-gutter shrink-0 space-y-2 pb-2 pt-2 sm:pt-3" data-stage-tone="integrate">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <AtlasIcon className="size-5 text-accent" aria-hidden="true" />
            <h1 className="font-headline text-2xl font-semibold">Atlas</h1>
            <span className="border-l border-border pl-2 text-xs text-muted-foreground">Survey · Map</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <WorkspaceTabs value={atlasSection} onChange={setAtlasSection} label="Atlas views" items={[
              { id: 'map', label: 'Map' },
              { id: 'territory', label: 'Regions', count: newRegionIds.length || undefined },
              { id: 'connections', label: 'Connections' },
              { id: 'review', label: 'Review' },
            ]} />
            {atlasSection === 'map' && <>
              <div className="relative min-w-28 flex-1 sm:max-w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input aria-label="Search map" placeholder="Search map…" value={search} onChange={event => setSearch(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter' && mapSearchResults[0]) { event.preventDefault(); pickMapSearchResult(mapSearchResults[0]); } }}
                  className="min-h-10 w-full pl-9" />
                {mode === 'auto' && search.trim() && <div className="absolute inset-x-0 top-full z-[55] mt-1 grid max-h-64 overflow-y-auto rounded-[var(--card-radius)] border border-border bg-card p-1 shadow-md">
                  {mapSearchResults.length ? mapSearchResults.map(concept => <button type="button" key={concept.id} className="min-h-10 break-words px-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => pickMapSearchResult(concept)}>{concept.name}</button>) : <p className="p-2 text-sm text-muted-foreground">No concepts found.</p>}
                </div>}
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild><Button variant="outline" className="min-h-10 shrink-0"><SlidersHorizontal className="size-4" />Map tools</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={12} scrollable className="w-64">
                  <DropdownMenuLabel>Map source</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem checked={mode === 'auto'} onSelect={() => setMode('auto')}>Auto Map</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={mode === 'custom'} onSelect={() => setMode('custom')}>Custom Maps</DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setIsAddOpen(true)}><Plus className="size-4" /> New concept</DropdownMenuItem>
                  <DropdownMenuCheckboxItem checked={!!timelineWindow} onCheckedChange={() => setTimelineWindow(current => current ? null : { from: Math.max(timelineBounds.start, timelineBounds.end - 30 * 86400000), asOf: timelineBounds.end })}><CalendarRange className="size-4" /> Timeline replay</DropdownMenuCheckboxItem>
                  {mode === 'custom' && <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Custom maps</DropdownMenuLabel>
                    {atlasMaps.map(map => <DropdownMenuCheckboxItem key={map.id} checked={map.id === activeMap?.id} onSelect={() => setActiveMapId(map.id)}>{map.title}</DropdownMenuCheckboxItem>)}
                    <DropdownMenuItem onSelect={() => setIsMapOpen(true)}>New map</DropdownMenuItem>
                    <DropdownMenuItem disabled={!activeMap} onSelect={() => setIsNodeOpen(true)}>Add node</DropdownMenuItem>
                    <DropdownMenuItem disabled={!activeMap} onSelect={openMapStyle}>Map style</DropdownMenuItem>
                    {activeMap && <DropdownMenuItem className="text-destructive" onSelect={() => setMapToDelete(activeMap)}>Delete map</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>View</DropdownMenuLabel>
                    {(['core', 'conflict', 'evidence', 'practice', 'evolution', 'full'] as const).map(value =>
                      <DropdownMenuCheckboxItem className="capitalize" key={value} checked={viewMode === value} onCheckedChange={() => setViewMode(value)}>{value}</DropdownMenuCheckboxItem>)}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Connection strength</DropdownMenuLabel>
                    {(['strong', 'moderate', 'all'] as const).map(value => <DropdownMenuCheckboxItem key={value} checked={autoConnectionFocus === value} onCheckedChange={() => setAutoConnectionFocus(value)}>{value === 'all' ? 'All connections' : value === 'strong' ? 'Strong only' : 'Strong and moderate'}</DropdownMenuCheckboxItem>)}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Relationship types</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem checked={relationshipFilterMode === 'recommended'} onCheckedChange={() => setRelationshipFilterMode('recommended')}>Recommended</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={relationshipFilterMode === 'all'} onCheckedChange={() => setRelationshipFilterMode('all')}>All relationships</DropdownMenuCheckboxItem>
                    <DropdownMenuItem onSelect={() => { setRelationshipFilterMode('custom'); setCustomRelationshipTypes([]); }}>Clear relationships</DropdownMenuItem>
                {atlasRelationshipGroups.map((group) => (
                  <div key={group.label}>
                    <DropdownMenuLabel className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground/80">{group.label}</DropdownMenuLabel>
                    {group.types.map((type) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={
                          relationshipFilterMode === 'all'
                            ? true
                            : relationshipFilterMode === 'recommended'
                              ? recommendedRelationshipTypes.includes(type)
                              : customRelationshipTypes.includes(type)
                        }
                        onCheckedChange={(checked) => {
                          setRelationshipFilterMode('custom');
                          setCustomRelationshipTypes((prev) => (
                            checked
                              ? [...new Set([...prev, type])]
                              : prev.filter((item) => item !== type)
                          ));
                        }}
                        className="noesis-eyebrow"
                      >
                        {type.replace(/_/g, ' ')}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
                  </>}
                </DropdownMenuContent>
              </DropdownMenu>
              {mode === 'custom' && activeMap && <span className="max-w-52 truncate text-xs text-muted-foreground" title={activeMap.title}>{activeMap.title}</span>}
            </>}
          </div>
          {atlasSection === 'map' && timelineWindow && <div className="noesis-atlas-timeline" data-open="true">
              <label className="noesis-atlas-timeline__date">
                <span>New since</span>
                <input
                  type="date"
                  value={atlasTimelineDayValue(timelineWindow.from)}
                  min={atlasTimelineDayValue(timelineBounds.start)}
                  max={atlasTimelineDayValue(timelineWindow.asOf)}
                  onChange={(event) => {
                    const value = Date.parse(event.target.value);
                    if (Number.isFinite(value)) setTimelineWindow((current) => current && { ...current, from: Math.min(value, current.asOf) });
                  }}
                />
              </label>
              <label className="noesis-atlas-timeline__slider">
                <span className="sr-only">Show the map as of</span>
                <input
                  type="range"
                  min={timelineBounds.start}
                  max={timelineBounds.end}
                  step={86400000}
                  value={timelineWindow.asOf}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setTimelineWindow((current) => current && { from: Math.min(current.from, value), asOf: value });
                  }}
                />
              </label>
              <span className="noesis-atlas-timeline__readout">
                As of <b>{formatAtlasTimelineDate(timelineWindow.asOf)}</b> · {timelineNewCount} new
              </span>
              <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setTimelineWindow(null)}>Now</Button>
          </div>}
        </header>
      )}

      {atlasSection !== 'map' && !isFullScreen && (
        <div className="flex-1 overflow-y-auto noesis-gutter pb-6 pt-2">
          {atlasSection === 'territory' && (
            <AtlasTerritoryView
              cards={atlasTerritoryCards}
              regions={atlasRegions}
              selectedRegionId={selectedRegionId}
              detailMode={regionDetailOpen}
              newRegionIds={newRegionIds}
              concepts={concepts}
              positions={vault}
              practices={practices}
              questions={questions}
              drafts={drafts}
              media={media}
              onSelectRegion={openRegion}
              onExpandRegion={() => setRegionDetailOpen(true)}
              onBackToRegions={() => setRegionDetailOpen(false)}
              onOpenMap={openRegionInMap}
              onOpenPosition={onOpenPosition}
              onOpenQuestion={onOpenQuestion}
              onOpenSource={onOpenSource}
              onOpenConcept={openConceptInGraph}
            />
          )}
          {atlasSection === 'connections' && (
            <div className="space-y-5">
              <WorkspaceTabs
                value={connectionsTab}
                onChange={setConnectionsTab}
                label="Atlas connection views"
                variant="segmented"
                items={[
                  { id: 'relationships', label: 'Relationships', icon: Link2 },
                  { id: 'tensions', label: 'System tensions', icon: FlaskConical },
                ]}
              />
              {connectionsTab === 'relationships' ? (
                <AtlasConnectionsView links={links} concepts={concepts} regionMembers={selectedRegion ? {
                  concept: selectedRegion.conceptIds, position: selectedRegion.positionIds, practice: selectedRegion.practiceIds,
                  inquiry: selectedRegion.inquiryIds, source: selectedRegion.sourceIds, work: selectedRegion.workIds,
                } : undefined} regionName={selectedRegion?.name} onUpdateLink={onUpdateLink} onDeleteLink={requestRegistryRemoval} />
              ) : (
                <AtlasTensionsBoard tensions={atlasSystemTensions} onOpenRegion={openRegionWorkspace} />
              )}
            </div>
          )}
          {atlasSection === 'review' && (
            <AtlasReviewQueue
              concepts={concepts}
              regions={atlasRegions}
              links={links}
              knownIds={atlasKnownIds}
              onUpdateConcept={onUpdateConcept}
              onUpdateLink={onUpdateLink}
              onDeleteLink={requestRegistryRemoval}
            />
          )}
        </div>
      )}

      {atlasSection === 'map' && mode === 'auto' && (
        <div className={cn("flex min-h-0 flex-1 flex-col", !isFullScreen && "noesis-gutter pb-3")}>
          <AtlasTerritoryCanvas
            focus={atlasFocus}
            fullScreen={isFullScreen}
            onToggleFullScreen={() => setIsFullScreen(value => !value)}
            regions={atlasRegions}
            concepts={concepts}
            positions={vault}
            inquiries={questions}
            sources={media}
            practices={practices}
            links={links}
            asOf={timelineWindow?.asOf ?? null}
            from={timelineWindow?.from ?? null}
            onOpenRegion={openRegion}
            onOpen={(target) => {
              if (target.type === 'position') onOpenPosition?.(target.id);
              else if (target.type === 'inquiry') onOpenQuestion?.(target.id);
              else if (target.type === 'source') onOpenSource?.(target.id);
              else if (target.type === 'practice') onOpenPractices?.();
              else {
                const reviewMode = /^\/(demo|review)(\/|$)/.test(window.location.pathname);
                navigateWorkspace(window.history, viewToPath('concepts', { conceptId: target.id, reviewMode }));
              }
            }}
          />
        </div>
      )}
      {atlasSection === 'map' && mode === 'custom' && (
      <div className={cn(

        "relative flex min-h-0 flex-1 gap-4",
        // Keep room for the map to breathe when the controls wrap onto extra rows.
        !isFullScreen && "md:min-h-0",
        !isFullScreen && "max-md:h-[max(24rem,calc(100dvh-10rem))] max-md:flex-none",
        isFullScreen ? "overflow-hidden px-0 pb-0" : "noesis-gutter overflow-hidden pb-4"
      )}>
        <div
          ref={mapRef}
          data-custom-backdrop={activeMapStyle.background.type !== 'preset' || activeMapStyle.background.preset !== 'dark'}
          className={cn(
            "noesis-atlas-custom-map relative h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-[var(--card-radius)] border border-border",
            zoom < ATLAS_BASE_ZOOM * 0.75 && "noesis-atlas-custom-map--overview",
            quickLinkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            isFullScreen ? "touch-none rounded-none" : "touch-pan-y"
          )}
          onClick={() => {
            if (quickLinkSource) clearQuickLinkMode();
            else setActiveEdgeId(null);
          }}
          onPointerDown={startPanning}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onLostPointerCapture={endPan}
          data-map-width={mapSize.width || undefined}
          data-map-height={mapSize.height || undefined}
        >
          {mode === 'custom' && (activeMapStyle.background.type !== 'preset' || activeMapStyle.background.preset !== 'dark' || activeMapStyle.background.blur !== 0 || activeMapStyle.background.opacity !== 0.42) && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ ...customMapBackgroundStyle, ...customMapBackgroundOverlayStyle }}
            />
          )}
          <div className={cn(
            "absolute right-4 top-4 z-50 flex rounded-full border border-border/50 bg-card/90 p-1 shadow-md backdrop-blur"
          )} onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label="Zoom out" disabled={zoom <= ATLAS_MIN_ZOOM + 0.001} onClick={() => changeZoom(zoom - ATLAS_ZOOM_STEP)} className="size-10 rounded-full font-bold md:size-8">-</Button>
            <Button variant="ghost" size="icon" className="size-10 md:size-8" title="Reset map view" aria-label={`Reset map view, current zoom ${Math.round((zoom / ATLAS_BASE_ZOOM) * 100)} percent`} onClick={() => { setPan({ x: 0, y: 0 }); changeZoom(ATLAS_BASE_ZOOM); }}>{Math.round((zoom / ATLAS_BASE_ZOOM) * 100)}%</Button>
            <Button variant="ghost" size="icon" aria-label="Zoom in" disabled={zoom >= ATLAS_MAX_ZOOM - 0.001} onClick={() => changeZoom(zoom + ATLAS_ZOOM_STEP)} className="size-10 rounded-full font-bold md:size-8">+</Button>
            <div className="mx-1 my-1 w-px bg-border" />
            <Button ref={mapControlsRef} variant={isPanelOpen ? 'secondary' : 'ghost'} size="icon" aria-expanded={isPanelOpen} aria-controls={isPanelOpen ? inspectorId : undefined} aria-label={isPanelOpen ? 'Hide Atlas inspector' : 'Show Atlas inspector'} onClick={(event) => { event.stopPropagation(); setIsPanelOpen((open) => !open); }} className="size-10 rounded-full md:size-8">
              <SlidersHorizontal className="size-3.5" />
            </Button>
            <Button ref={fullScreenButtonRef} variant="ghost" size="icon" aria-label={isFullScreen ? 'Exit full screen map' : 'Open full screen map'} aria-pressed={isFullScreen} title={isFullScreen ? 'Exit full screen' : 'Full screen for touch panning and dragging'} onClick={(event) => { event.stopPropagation(); setIsFullScreen(!isFullScreen); }} className="size-10 rounded-full md:size-8">
              {isFullScreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
            </Button>
          </div>

          {mode === 'custom' && !activeMap && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70">
              <Card className="max-w-sm rounded-2xl p-8 text-center shadow-2xl border-none">
                <h3 className="font-headline text-2xl font-semibold italic">Create Your First Custom Map</h3>
                <p className="mt-2 text-sm text-muted-foreground font-body">Custom maps let you choose the nodes, draw your own links, then layer auto-connections with filters.</p>
                <Button onClick={() => setIsMapOpen(true)} className="mt-6 rounded-full px-8"><Plus className="mr-1.5 size-4" /> Custom Map</Button>
              </Card>
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{
              width: `${mapZoomPlane.extentPercent}%`,
              height: `${mapZoomPlane.extentPercent}%`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${mapZoomPlane.scale})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {renderedEdges.map((edge, index) => {
                const from = positionedNodeByKey.get(conceptKey(edge.from));
                const to = positionedNodeByKey.get(conceptKey(edge.to));
                if (!from || !to) return null;
                const points = edgePoints(from, to);
                const key = `${edge.from}-${edge.to}-${edge.id || index}`;
                const isHovered = hoveredEdgeId === key;
                const edgeColor = edgeStrokeColor(edge);
                const isActive = activeEdgeId === edgeSignature(edge);
                const isSelectedClusterEdge = selectedClusterEdges.has(edgeSignature(edge));
                const showTrace = shouldTraceAtlasConnection(connectionTrace, edgeSignature(edge), edge.groupedLinkIds);
                const reverseTrace = connectionTrace?.from === conceptKey(edge.to);
                const visuals = edgeVisuals(
                  edge,
                  isHovered,
                  isActive,
                  Boolean(activeEdgeId),
                  isSelectedClusterEdge,
                  Boolean(selectedName) && selectedClusterEdges.size > 0
                );
                return (
                  <g key={key}>
                    {visuals.glowOpacity > 0 && (
                      <line
                        x1={`${points.x1}%`}
                        y1={`${points.y1}%`}
                        x2={`${points.x2}%`}
                        y2={`${points.y2}%`}
                        stroke={edgeColor}
                        strokeWidth={visuals.glowWidth}
                        strokeOpacity={visuals.glowOpacity}
                        strokeLinecap="round"
                      />
                    )}
                    <line
                      x1={`${points.x1}%`}
                      y1={`${points.y1}%`}
                      x2={`${points.x2}%`}
                      y2={`${points.y2}%`}
                      stroke={edgeColor}
                      strokeWidth={visuals.strokeWidth}
                      strokeOpacity={visuals.strokeOpacity}
                      strokeDasharray={visuals.strokeDasharray}
                      strokeLinecap="round"
                      className="transition-all"
                    />
                    {showTrace && (
                      <line
                        aria-hidden="true"
                        className="atlas-connection-trace"
                        x1={`${reverseTrace ? points.x2 : points.x1}%`}
                        y1={`${reverseTrace ? points.y2 : points.y1}%`}
                        x2={`${reverseTrace ? points.x1 : points.x2}%`}
                        y2={`${reverseTrace ? points.y1 : points.y2}%`}
                        pathLength={1}
                        strokeLinecap="round"
                        onAnimationEnd={() => setConnectionTrace((current) => current === connectionTrace ? null : current)}
                      />
                    )}
                    <line
                      x1={`${points.x1}%`}
                      y1={`${points.y1}%`}
                      x2={`${points.x2}%`}
                      y2={`${points.y2}%`}
                      stroke="transparent"
                      strokeWidth={16}
                      strokeLinecap="round"
                      className="pointer-events-auto cursor-pointer"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        startEdgeHold(edge);
                      }}
                      onPointerUp={cancelEdgeHold}
                      onPointerLeave={() => {
                        cancelEdgeHold();
                        setHoveredEdgeId(null);
                      }}
                      onPointerCancel={() => {
                        cancelEdgeHold();
                        setHoveredEdgeId(null);
                      }}
                      onPointerEnter={() => {
                        setHoveredEdgeId(key);
                        handleEdgeHoverInteraction(edge);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const linkItem = linkItemForEdge(edge);
                        if (linkItem.removable) {
                          setSelectedLink(null);
                          registryRemovalOpener.current = null;
                          setCutLinkCandidate(linkItem);
                          setActiveEdgeId(linkItem.id);
                          markLinkInteraction(linkItem);
                        }
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (suppressNextEdgeClickRef.current) {
                          suppressNextEdgeClickRef.current = false;
                          return;
                        }
                        const linkItem = linkItemForEdge(edge);
                        openLinkDetail(linkItem);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {quickLinkSource && (() => {
              const sourceNode = positionedNodeByKey.get(conceptKey(quickLinkSource));
              const rect = mapRef.current?.getBoundingClientRect();
              if (!sourceNode || !rect) return null;
              const cursorX = ((quickLinkCursor.x - rect.left - pan.x) / rect.width) * 100;
              const cursorY = ((quickLinkCursor.y - rect.top - pan.y) / rect.height) * 100;
              const ghost = edgePoints(sourceNode, { name: '', count: 0, x: cursorX, y: cursorY });
              return (
                <g>
                  <line
                    x1={`${ghost.x1}%`}
                    y1={`${ghost.y1}%`}
                    x2={`${ghost.x2}%`}
                    y2={`${ghost.y2}%`}
                    stroke="hsl(var(--accent))"
                    strokeWidth={2.5}
                    strokeOpacity={0.7}
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                  />
                </g>
              );
            })()}

            {/* Territory islands: each region's concepts sit on a soft landmass. */}
            {regionIslands.map((island) => (
              <div key={island.id} className="noesis-atlas-island" aria-hidden="true" style={{ left: `${island.left}%`, top: `${island.top}%`, width: `${island.width}%`, height: `${island.height}%`, '--island-hue': island.hue } as React.CSSProperties}>
                <span>{island.name}</span>
              </div>
            ))}
            {positionedNodes.map((node) => (
              <button
                key={node.name}
                ref={(element) => { if (element) nodeButtons.current.set(node.name, element); else nodeButtons.current.delete(node.name); }}
                type="button"
                aria-expanded={!quickLinkSource ? isPanelOpen && selectedName === node.name : undefined}
                aria-controls={isPanelOpen && selectedName === node.name ? inspectorId : undefined}
                disabled={Boolean(quickLinkSource && conceptKey(node.name) === conceptKey(quickLinkSource))}
                className={cn(
                  "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 border bg-card text-center text-card-foreground transition-none focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                  quickLinkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
                    nodeCardClassName(activeMapStyle.nodeStyle, selectedName === node.name),
                    quickLinkSource && conceptKey(node.name) === conceptKey(quickLinkSource) && 'border-accent ring-2 ring-accent shadow-2xl',
                    quickLinkSource && conceptKey(node.name) !== conceptKey(quickLinkSource) && 'opacity-95',
                    quickLinkHoverTarget && conceptKey(node.name) === conceptKey(quickLinkHoverTarget) && 'border-accent bg-accent/10 ring-2 ring-accent shadow-2xl',
                    activeEdgeNodes.size > 0 && !activeEdgeNodes.has(conceptKey(node.name)) && 'opacity-45',
                    activeEdgeNodes.has(conceptKey(node.name)) && 'ring-2 ring-accent/60 shadow-xl',
                    !activeEdgeNodes.size && selectedClusterNodes.size > 0 && !selectedClusterNodes.has(conceptKey(node.name)) && 'opacity-25 saturate-50',
                    !activeEdgeNodes.size && selectedClusterNodes.has(conceptKey(node.name)) && selectedName !== node.name && 'border-accent/35 ring-1 ring-accent/35 shadow-lg'
                )}
                data-timeline={atlasNodeTimelineState(node.concept?.dateCreated, timelineWindow) === 'new' ? 'new' : undefined}
                style={{ ...nodeColorStyle(node.name), left: `${node.x}%`, top: `${node.y}%` }}
                onFocus={(event) => {
                  if (!mapRef.current || !event.currentTarget.matches(':focus-visible')) return;
                  const delta = atlasFocusPan(mapRef.current.getBoundingClientRect(), event.currentTarget.getBoundingClientRect());
                  if (delta.x || delta.y) setPan((current) => ({ x: current.x + delta.x, y: current.y + delta.y }));
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openNodeLinkPanel(node.name);
                }}
                onPointerEnter={() => {
                  if (quickLinkSource) setQuickLinkHoverTarget(node.name);
                }}
                onPointerLeave={() => {
                  if (quickLinkHoverTarget === node.name) setQuickLinkHoverTarget(null);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (!event.isPrimary) return;
                  suppressNodeClickRef.current = false;
                  if (quickLinkSource || !atlasCanDrag(event, isFullScreen) || panGestureRef.current || nodeGestureRef.current) return;
                  nodeGestureRef.current = { pointerId: event.pointerId, name: node.name, x: event.clientX, y: event.clientY };
                  setDraggingName(node.name);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.detail !== 0 && suppressNodeClickRef.current) return;
                  activateMapNode(node.name, event.detail === 0);
                }}
                onPointerMove={(event) => {
                  const gesture = nodeGestureRef.current;
                  if (gesture?.pointerId !== event.pointerId || gesture.name !== node.name) return;
                  if (!gesture.position && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 6) return;
                  const position = nodePositionAtPointer(event.clientX, event.clientY);
                  if (!position) return;
                  gesture.position = position;
                  setNodePreview({ scope: mapScope, key: conceptKey(node.name), ...position });
                }}
                onPointerUp={(event) => endNodeGesture(event.pointerId, true)}
                onPointerCancel={(event) => endNodeGesture(event.pointerId, false)}
                onLostPointerCapture={(event) => endNodeGesture(event.pointerId, false)}
              >
                <span className="sr-only">{quickLinkSource ? 'Link to' : 'Open concept'} </span>
                <span className={cn('noesis-atlas-node-label block max-w-28 break-words font-headline font-semibold text-primary', activeMapStyle.nodeStyle === 'compact' && 'text-sm', activeMapStyle.nodeStyle === 'pill' && 'text-[15px]')}>{node.name}</span>
                {activeMapStyle.nodeStyle !== 'default' && <span className="block noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{node.count} linked</span>}
              </button>
            ))}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-px bg-border" />
          </div>

          {quickLinkSource && (
            <div
              className="pointer-events-none absolute z-30 rounded-full border border-accent/30 bg-card/95 px-3 py-1.5 shadow-md"
              style={{
                left: Math.min((mapRef.current?.clientWidth || 0) - 220, Math.max(12, quickLinkCursor.x - (mapRef.current?.getBoundingClientRect().left || 0) + 14)),
                top: Math.min((mapRef.current?.clientHeight || 0) - 48, Math.max(12, quickLinkCursor.y - (mapRef.current?.getBoundingClientRect().top || 0) + 14)),
              }}
            >
              <div className="noesis-eyebrow noesis-eyebrow--sm text-accent">
                Link from {quickLinkSource} - click a target node
              </div>
            </div>
          )}
        </div>
        {!isFullScreen && isPanelOpen && atlasPanel}
      </div>
      )}

      {atlasSection === 'map' && isFullScreen && isPanelOpen && atlasPanel}

      <Dialog open={!!selectedLink} onOpenChange={(open) => !open && setSelectedLink(null)}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Link Detail</DialogTitle>
          </DialogHeader>
          {selectedLink && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">From</div>
                  <div className="mt-1 font-headline text-lg font-bold italic">{selectedLink.from}</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">To</div>
                  <div className="mt-1 font-headline text-lg font-bold italic">{selectedLink.to}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full bg-accent noesis-eyebrow noesis-eyebrow--sm">{selectedLink.linkType || selectedLink.label}</Badge>
                <Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{selectedLink.sourceLabel}</Badge>
                {selectedLink.relationshipTypes && selectedLink.relationshipTypes.length > 1 && selectedLink.relationshipTypes.map((type) => (
                  <Badge key={type} variant="outline" className="rounded-full bg-muted/20 noesis-eyebrow noesis-eyebrow--sm">
                    {type}
                  </Badge>
                ))}
              </div>
              <p className="rounded-xl border border-border/60 bg-card p-4 text-sm italic leading-6 text-muted-foreground">
                {selectedLink.note || (selectedLink.kind === 'shared' ? 'This relationship is derived from shared evidence across the system.' : 'No note recorded for this link.')}
              </p>
              {activeMap && (
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <Label className="noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">Link Color</Label>
                      <p className="mt-1 text-xs italic text-muted-foreground">Changes how this connection appears on the current map.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => updateLinkColor(selectedLink)}
                      disabled={!effectiveLinkColors[atlasLinkColorKey(selectedLink)]}
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {atlasColorSwatches.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Set link color ${color}`}
                        className={cn(
                          'size-7 rounded-full border border-border shadow-sm ring-offset-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring',
                          effectiveLinkColors[atlasLinkColorKey(selectedLink)] === color && 'ring-2 ring-accent'
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => updateLinkColor(selectedLink, color)}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom link color"
                      value={effectiveLinkColors[atlasLinkColorKey(selectedLink)] || '#7c3aed'}
                      onChange={(event) => updateLinkColor(selectedLink, event.target.value)}
                      className="h-8 w-10 cursor-pointer rounded-md border border-border bg-card p-0.5"
                    />
                  </div>
                </div>
              )}
              {selectedLink.kind === 'shared' && (
                <div className="rounded-xl border border-caution/40 bg-caution/10 p-4 text-xs italic leading-5 text-foreground">
                  Auto/shared links are calculated from overlap. They cannot be cut directly; remove the shared evidence or disable this auto-link filter on a Custom Map.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setSelectedLink(null)} className="rounded-full">Close</Button>
            {selectedLink?.kind === 'shared' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedName(selectedLink.from);
                    setPanelSection('evidence');
                    setSelectedLink(null);
                  }}
                  className="rounded-full px-5"
                >
                  View Shared Evidence
                </Button>
                {mode === 'custom' && activeMap && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      disableSharedAutoFiltersForLink(selectedLink);
                      setSelectedLink(null);
                    }}
                    className="rounded-full px-5"
                  >
                    Turn Off Auto Evidence
                  </Button>
                )}
              </>
            )}
            {selectedLink?.kind === 'typed' && selectedLink.groupedLinkIds && selectedLink.groupedLinkIds.length > 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedName(selectedLink.from);
                  setPanelSection('links');
                  setSelectedLink(null);
                }}
                className="rounded-full px-5"
              >
                Review Relationship Set
              </Button>
            )}
            {selectedLink?.removable && (
              <Button
                variant="destructive"
                onClick={() => {
                  setCutLinkMethod('atlas_link_detail');
                  registryRemovalOpener.current = null;
                  setCutLinkCandidate(selectedLink);
                  setSelectedLink(null);
                }}
                className="rounded-full px-7"
              >
                Delete Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(cutLinkCandidate || registryRemoval)}
        onOpenChange={(open) => {
          if (open) return;
          setCutLinkCandidate(null);
          setRegistryRemoval(null);
          setCutLinkMethod('atlas_link_detail');
        }}
        title="Remove relationship?"
        returnFocusRef={registryRemovalOpener}
        description={cutLinkCandidate
          ? `This removes the relationship between ${cutLinkCandidate.from} and ${cutLinkCandidate.to}. The linked items are kept.`
          : 'This removes the relationship. The linked items are kept.'}
        confirmLabel="Remove relationship"
        destructive
        onConfirm={async () => {
          if (cutLinkCandidate) await cutLink(cutLinkCandidate);
          else if (registryRemoval) await onDeleteLink?.(registryRemoval.id, registryRemoval.options);
        }}
      />

      <Dialog open={isPositionsOpen} onOpenChange={setIsPositionsOpen}>
        <DialogContent className="max-w-4xl border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">{selectedName} Positions</DialogTitle>
            <p className="text-sm text-muted-foreground">Positions linked to this concept through tags, evidence, and outputs.</p>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Sources</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(related?.beliefs || []).map((position) => (
                  <TableRow
                    key={position.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setIsPositionsOpen(false);
                      onOpenPosition?.(position.id);
                    }}
                  >
                    <TableCell>
                      <div className="font-headline text-base font-semibold italic">{position.title}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{position.statement || position.description}</div>
                    </TableCell>
                    <TableCell className="noesis-eyebrow">{position.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{position.status}</Badge></TableCell>
                    <TableCell className="font-code text-xs">{atlasConfidencePercent(position.confidence)}%</TableCell>
                    <TableCell className="font-code text-xs">{(position.sourceIds || []).length}</TableCell>
                    <TableCell className="noesis-eyebrow text-muted-foreground">{new Date(position.dateUpdated || position.dateCreated).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {!(related?.beliefs || []).length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm italic text-muted-foreground">No related positions yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!relatedDialogType} onOpenChange={(open) => !open && setRelatedDialogType(null)}>
        <DialogContent className="max-w-3xl border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">{relatedDialogData?.title || 'Related Items'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pt-2">
            {relatedDialogData?.items.length ? relatedDialogData.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="font-headline text-lg font-semibold italic">{item.title}</div>
                {item.meta && <div className="mt-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{item.meta}</div>}
                {item.body && <p className="mt-2 text-sm italic leading-6 text-muted-foreground">{item.body}</p>}
              </div>
            )) : (
              <div className="py-10 text-center text-sm italic text-muted-foreground">
                {relatedDialogData?.empty || 'No related items yet.'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteAllLinksOpen}
        onOpenChange={(open) => {
          setIsDeleteAllLinksOpen(open);
          if (!open) setCutLinkMethod('atlas_link_detail');
        }}
      >
        <DialogContent className="max-w-md border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Delete Connected Links?</DialogTitle>
          </DialogHeader>
          <p className="pt-2 text-sm italic leading-6 text-muted-foreground">
            This removes every removable link attached to <span className="text-foreground">{selectedName}</span>. It does not delete every link on the map. Derived shared-evidence links will stay, because they come from overlap elsewhere in the system.
          </p>
          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setIsDeleteAllLinksOpen(false)} className="rounded-full">Cancel</Button>
            <Button variant="destructive" onClick={clearSelectedNodeLinks}>Delete Connected Links</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl border-none shadow-2xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-headline text-2xl italic">Plot New Concept</DialogTitle></DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="space-y-2">
              <Label className="readex-kicker">Concept Name</Label>
              <Input value={newConcept.name} onChange={(event) => setNewConcept((prev) => ({ ...prev, name: event.target.value }))} className="rounded-full" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker">Description</Label>
              <Textarea value={newConcept.description} onChange={(event) => setNewConcept((prev) => ({ ...prev, description: event.target.value }))} className="min-h-[100px]" />
            </div>
            <SourceLinker media={media} selectedIds={newConcept.sourceIds || []} onToggle={toggleNewConceptSource} label="Root Evidence (Sources)" />
          </div>
          <DialogFooter className="pt-4"><Button onClick={addConcept} disabled={creatingConcept || !newConcept.name?.trim()}>{creatingConcept ? 'Saving…' : 'Save concept'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog open={Boolean(mapToDelete)} onOpenChange={(open) => { if (!open) setMapToDelete(null); }}
        title="Delete custom map?" description={`This removes ${mapToDelete?.title || 'the map'} and its layout. The concepts themselves are kept.`}
        confirmLabel="Delete map" destructive onConfirm={async () => {
          if (!mapToDelete) return;
          await onDeleteAtlasMap(mapToDelete.id);
          if (activeMapId === mapToDelete.id) setActiveMapId('');
        }} />

      <Dialog open={isMapOpen} onOpenChange={(open) => {
        if (mapCreationLock.current) return;
        setIsMapOpen(open);
        if (!open) setMapCreationError('');
      }}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-headline text-2xl italic">New Custom Map</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="atlas-new-map-name" className="readex-kicker">Map Name</Label>
              <Input id="atlas-new-map-name" disabled={creatingMap} value={newMap.title} onChange={(event) => setNewMap((prev) => ({ ...prev, title: event.target.value }))} placeholder="Discipline and Avoidance" className="rounded-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="atlas-new-map-purpose" className="readex-kicker">Purpose</Label>
              <Textarea id="atlas-new-map-purpose" disabled={creatingMap} value={newMap.description} onChange={(event) => setNewMap((prev) => ({ ...prev, description: event.target.value }))} placeholder="What this map is trying to understand..." />
            </div>
          </div>
          {mapCreationError && <p role="alert" className="text-sm text-destructive">{mapCreationError}</p>}
          <DialogFooter className="pt-4"><Button disabled={creatingMap || !newMap.title.trim()} onClick={() => void createCustomMap()} className="rounded-full px-8">{creatingMap ? 'Creating...' : 'Create Map'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStyleOpen} onOpenChange={(open) => { if (!styleSaveLock.current) setIsStyleOpen(open); }}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Customize Map</DialogTitle>
            <DialogDescription className="sr-only">Set the appearance of this custom map.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain px-1 py-2">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="readex-kicker">Line Color Preference</Label>
                <Select
                  value={styleDraft.lineMode}
                  onValueChange={(value) => setStyleDraft((prev) => ({ ...prev, lineMode: value as AtlasMapStyle['lineMode'] }))}
                >
                  <SelectTrigger aria-label="Line color preference" className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default relationship colors</SelectItem>
                    <SelectItem value="singleColor">Single custom line color</SelectItem>
                    <SelectItem value="strengthColor">Strength-based line colors</SelectItem>
                    <SelectItem value="relationshipCategoryColor">Relationship-category colors</SelectItem>
                  </SelectContent>
                </Select>
                {styleDraft.lineMode === 'singleColor' && (
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                    <Input
                      type="color"
                      aria-label="Pick line color"
                      value={styleDraft.customLineColor || '#7c3aed'}
                      onChange={(event) => setStyleDraft((prev) => ({ ...prev, customLineColor: event.target.value }))}
                      className="h-10 w-16 rounded-lg p-1"
                    />
                    <Input
                      aria-label="Line color value"
                      value={styleDraft.customLineColor || '#7c3aed'}
                      onChange={(event) => setStyleDraft((prev) => ({ ...prev, customLineColor: event.target.value }))}
                      className="rounded-full"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="readex-kicker">Font Choice</Label>
                <Select
                  value={styleDraft.fontFamily}
                  onValueChange={(value) => setStyleDraft((prev) => ({ ...prev, fontFamily: value as AtlasMapFontFamily }))}
                >
                  <SelectTrigger aria-label="Font choice" className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="serif">Serif</SelectItem>
                    <SelectItem value="mono">Mono</SelectItem>
                    <SelectItem value="rounded">Rounded</SelectItem>
                    <SelectItem value="condensed">Condensed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="readex-kicker">Background Choice</Label>
                <Select
                  value={styleDraft.background.type}
                  onValueChange={(value) => setStyleDraft((prev) => ({
                    ...prev,
                    background: {
                      ...prev.background,
                      type: value as AtlasMapStyle['background']['type'],
                    },
                  }))}
                >
                  <SelectTrigger aria-label="Background choice" className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default dark</SelectItem>
                    <SelectItem value="preset">Preset background</SelectItem>
                    <SelectItem value="color">Solid color</SelectItem>
                    <SelectItem value="uploaded">Uploaded image</SelectItem>
                  </SelectContent>
                </Select>
                {styleDraft.background.type === 'preset' && (
                  <Select
                    value={styleDraft.background.preset || 'dark'}
                    onValueChange={(value) => setStyleDraft((prev) => ({
                      ...prev,
                      background: {
                        ...prev.background,
                        preset: value as AtlasMapBackgroundPreset,
                      },
                    }))}
                  >
                    <SelectTrigger aria-label="Background preset" className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Default dark</SelectItem>
                      <SelectItem value="light">Soft light</SelectItem>
                      <SelectItem value="paper">Paper</SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="blank">Blank</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {styleDraft.background.type === 'color' && (
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                    <Input
                      type="color"
                      aria-label="Pick background color"
                      value={styleDraft.background.color || '#111111'}
                      onChange={(event) => setStyleDraft((prev) => ({
                        ...prev,
                        background: {
                          ...prev.background,
                          color: event.target.value,
                        },
                      }))}
                      className="h-10 w-16 rounded-lg p-1"
                    />
                    <Input
                      aria-label="Background color value"
                      value={styleDraft.background.color || '#111111'}
                      onChange={(event) => setStyleDraft((prev) => ({
                        ...prev,
                        background: {
                          ...prev.background,
                          color: event.target.value,
                        },
                      }))}
                      className="rounded-full"
                    />
                  </div>
                )}
                {styleDraft.background.type === 'uploaded' && (
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
                    <input
                      ref={backgroundInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => handleBackgroundUpload(event.target.files?.[0] || null)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                       
                        onClick={() => backgroundInputRef.current?.click()}
                        disabled={!uid || isUploadingBackground}
                      >
                        {isUploadingBackground ? 'Uploading...' : 'Upload Background'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={clearUploadedBackground}
                        disabled={!styleDraft.background.imageUrl && !styleDraft.background.storagePath}
                      >
                        Remove Background
                      </Button>
                    </div>
                    {!uid && <p className="text-xs italic text-muted-foreground">Background upload becomes available once this workspace has a user id.</p>}
                    {draftBackgroundUrl && (
                      <div className="space-y-2">
                        <div className="overflow-hidden rounded-xl border border-border/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={draftBackgroundUrl} alt="Map background preview" className="h-32 w-full object-cover" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="readex-kicker">Node Style</Label>
                <Select
                  value={styleDraft.nodeStyle || 'default'}
                  onValueChange={(value) => setStyleDraft((prev) => ({ ...prev, nodeStyle: value as AtlasMapNodeStyle }))}
                >
                  <SelectTrigger aria-label="Node style" className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="pill">Pill</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>

                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-headline text-base font-semibold italic">Show weak links</div>
                      <p className="text-xs italic text-muted-foreground">Keep faint weak links visible on this custom map.</p>
                    </div>
                    <Switch
                      aria-label="Show weak links"
                      checked={styleDraft.showWeakLinks ?? false}
                      onCheckedChange={(checked) => setStyleDraft((prev) => ({ ...prev, showWeakLinks: checked }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="readex-kicker">Background opacity</Label>
                  <span className="noesis-eyebrow text-muted-foreground">
                    {Math.round((styleDraft.background.opacity ?? 0.42) * 100)}%
                  </span>
                </div>
                <Slider
                  aria-label="Background opacity"
                  value={[Math.round((styleDraft.background.opacity ?? 0.42) * 100)]}
                  min={10}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setStyleDraft((prev) => ({
                    ...prev,
                    background: {
                      ...prev.background,
                      opacity: value / 100,
                    },
                  }))}
                />
              </div>
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="readex-kicker">Background blur</Label>
                  <span className="noesis-eyebrow text-muted-foreground">
                    {styleDraft.background.blur ?? 0}px
                  </span>
                </div>
                <Slider
                  aria-label="Background blur"
                  value={[styleDraft.background.blur ?? 0]}
                  min={0}
                  max={18}
                  step={1}
                  onValueChange={([value]) => setStyleDraft((prev) => ({
                    ...prev,
                    background: {
                      ...prev.background,
                      blur: value,
                    },
                  }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            {styleError && <p role="alert" className="text-sm text-destructive">{styleError}</p>}
            <Button variant="ghost" disabled={savingStyle} onClick={() => setIsStyleOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={saveMapStyle} disabled={savingStyle || isUploadingBackground}>{savingStyle ? 'Saving...' : 'Save Map Style'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNodeOpen} onOpenChange={setIsNodeOpen}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-headline text-2xl italic">Add Node To Map</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input value={linkSearch} onChange={(event) => setLinkSearch(event.target.value)} placeholder="Search concepts..." className="rounded-full" />
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {availableNodeTerms
                .filter((name) => !linkSearch || name.toLowerCase().includes(linkSearch.toLowerCase()))
                .map((name) => (
                  <button key={name} onClick={() => addNodeToMap(name)} className="w-full rounded-lg p-3 text-left noesis-eyebrow hover:bg-muted transition-colors">
                    {name}
                  </button>
                ))}
              {!availableNodeTerms.length && <p className="p-4 text-sm text-muted-foreground italic font-body">Every concept is already on this custom map.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkOpen} onOpenChange={(open) => {
        if (linkSaveLock.current) return;
        setIsLinkOpen(open);
        setLinkError('');
        if (!open) {
          setQuickLinkTarget(null);
          setShowAdvancedLinkTypes(false);
        }
      }}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">
              {quickLinkSource && quickLinkTarget ? `Link ${quickLinkSource} to ${quickLinkTarget}` : 'Link This Idea'}
            </DialogTitle>
            <DialogDescription className="sr-only">Choose the target and relationship type.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={linkSaving} className="min-w-0 space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="atlas-link-from" className="readex-kicker">From</Label>
              <Input id="atlas-link-from" value={selectedName || ''} disabled className="rounded-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="atlas-link-to" className="readex-kicker">To</Label>
              <select
                id="atlas-link-to"
                value={linkDraft.to}
                onChange={(event) => setLinkDraft((prev) => ({ ...prev, to: event.target.value }))}
                className="h-10 w-full rounded-full border border-border/60 bg-card px-4 text-sm font-body shadow-sm appearance-none"
              >
                <option value="">Choose a concept...</option>
                {linkTargets.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="readex-kicker">Link Type</Label>
                <div className="flex flex-wrap gap-2 pb-1">
                  {(['supports', 'challenges', 'defines', 'refines', 'contradicts', 'tested_by'] as AtlasMapLinkType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLinkDraft((prev) => ({ ...prev, type, label: type.replace(/_/g, ' ') }))}
                      className={cn(
                        "rounded-full border px-3 py-1 noesis-eyebrow noesis-eyebrow--sm transition-colors",
                        linkDraft.type === type ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {type.replace(/_/g, ' ')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAdvancedLinkTypes((open) => !open)}
                    className={cn(
                      "rounded-full border px-3 py-1 noesis-eyebrow noesis-eyebrow--sm transition-colors",
                      showAdvancedLinkTypes ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {showAdvancedLinkTypes ? 'Hide More' : 'More Types'}
                  </button>
                </div>
                {showAdvancedLinkTypes && (
                  <select
                    value={linkDraft.type}
                    onChange={(event) => setLinkDraft((prev) => ({ ...prev, type: event.target.value as AtlasMapLinkType }))}
                    className="h-10 w-full rounded-full border border-border/60 bg-card px-4 text-sm font-body shadow-sm appearance-none"
                  >
                    {linkTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <Label className="readex-kicker">Label</Label>
                <Input value={linkDraft.label} onChange={(event) => setLinkDraft((prev) => ({ ...prev, label: event.target.value }))} placeholder="tests, explains, challenges..." className="rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker">Note</Label>
              <Textarea value={linkDraft.note} onChange={(event) => setLinkDraft((prev) => ({ ...prev, note: event.target.value }))} placeholder="Why do these belong together?" />
            </div>
          </fieldset>
          {linkError && <p role="alert" className="text-sm text-destructive">{linkError}</p>}
          <DialogFooter className="pt-4"><Button onClick={() => void createLink()} disabled={linkSaving || !linkDraft.to} className="rounded-full px-8">{linkSaving ? 'Saving link...' : 'Save Link'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}


