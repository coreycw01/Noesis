
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FlaskConical, HelpCircle, Link2, Maximize, Minimize, Plus, Search, SlidersHorizontal, Unlink2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AtlasHealthTable } from '@/components/Atlas/AtlasHealthTable';
import { AtlasOverview } from '@/components/Atlas/AtlasOverview';
import { AtlasPositionCanvas } from '@/components/Atlas/AtlasPositionCanvas';
import { AtlasTensionsBoard } from '@/components/Atlas/AtlasTensionsBoard';
import { SourceLinker } from '@/components/SourceLinker';
import { initializeFirebase } from '@/firebase';
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
import { conceptKey, conceptRelated, conceptTerms, taggedItemsForConcept, today, uid as makeId } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { deleteObject, getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { AtlasSection, deriveAtlasHealthRows, deriveAtlasOverview, deriveAtlasTensions, groupTensions } from './atlas-diagnostics';

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
  onAddConcept: (data: Partial<Concept>) => void;
  onUpdateConcept: (concept: Concept) => void;
  onCreateLink?: (data: Partial<PhilosophicalLink>) => void;
  onAddAtlasMap: (data: Partial<AtlasMap>) => void;
  onUpdateAtlasMap: (map: AtlasMap) => void;
  onDeleteAtlasMap: (id: string) => void;
  onDeleteLink?: (id: string, options?: { method?: string }) => void;
  onInteractLink?: (id: string) => void;
  onOpenPosition?: (id: string) => void;
  onOpenQuestion?: (id: string) => void;
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

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warning' | 'notice';
  icon: 'conflict' | 'evidence' | 'practice' | 'concept' | 'inquiry';
  conceptName?: string;
  positionId?: string;
  questionId?: string;
  link?: AtlasLinkItem;
};

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
const ATLAS_BASE_ZOOM = 0.8;
const ATLAS_MIN_ZOOM = 0.45;
const ATLAS_MAX_ZOOM = 1.7;
const ATLAS_ZOOM_STEP = 0.08;
const ATLAS_ZOOM_STORAGE_KEY = 'noesis.atlas.zoom';

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
  onAddAtlasMap,
  onUpdateAtlasMap,
  onDeleteAtlasMap,
  onDeleteLink,
  onInteractLink,
  uid,
  onOpenPosition,
  onOpenQuestion,
}: ConceptAtlasProps) {
  const [zoom, setZoom] = useState(ATLAS_BASE_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [atlasSection, setAtlasSection] = useState<AtlasSection>('overview');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [autoConnectionFocus, setAutoConnectionFocus] = useState<'strong' | 'moderate' | 'all'>('moderate');
  const [viewMode, setViewMode] = useState<AtlasViewMode>('core');
  const [relationshipFilterMode, setRelationshipFilterMode] = useState<AtlasRelationshipFilterMode>('recommended');
  const [customRelationshipTypes, setCustomRelationshipTypes] = useState<PhilosophicalLinkType[]>([]);
  const [mode, setMode] = useState<'auto' | 'custom'>('auto');
  const [activeMapId, setActiveMapId] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isNodeOpen, setIsNodeOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<AtlasLinkItem | null>(null);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [cutLinkCandidate, setCutLinkCandidate] = useState<AtlasLinkItem | null>(null);
  const [cutLinkMethod, setCutLinkMethod] = useState<'atlas_long_hold' | 'atlas_link_detail' | 'atlas_node_action'>('atlas_link_detail');
  const [isPositionsOpen, setIsPositionsOpen] = useState(false);
  const [relatedDialogType, setRelatedDialogType] = useState<null | 'sources' | 'works' | 'practices' | 'inquiries' | 'unknowns'>(null);
  const [isDeleteAllLinksOpen, setIsDeleteAllLinksOpen] = useState(false);
  const [linkSort, setLinkSort] = useState<'alpha' | 'created' | 'interacted'>('alpha');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [quickLinkSource, setQuickLinkSource] = useState<string | null>(null);
  const [quickLinkTarget, setQuickLinkTarget] = useState<string | null>(null);
  const [quickLinkHoverTarget, setQuickLinkHoverTarget] = useState<string | null>(null);
  const [quickLinkCursor, setQuickLinkCursor] = useState({ x: 0, y: 0 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [linkInteractionMap, setLinkInteractionMap] = useState<Record<string, { lastInteractedAt: string; interactionCount: number }>>({});
  const [newConcept, setNewConcept] = useState<Partial<Concept>>({ name: '', description: '', sourceIds: [] });
  const [newMap, setNewMap] = useState({ title: '', description: '' });
  const [styleDraft, setStyleDraft] = useState<AtlasMapStyle>(defaultAtlasMapStyle);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [linkDraft, setLinkDraft] = useState<{ to: string; type: AtlasMapLinkType; label: string; note: string }>({ to: '', type: 'relates', label: '', note: '' });
  const [showAdvancedLinkTypes, setShowAdvancedLinkTypes] = useState(false);
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [panelSection, setPanelSection] = useState<'links' | 'evidence' | 'events' | 'actions'>('links');
  const mapRef = useRef<HTMLDivElement | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const edgeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextEdgeClickRef = useRef(false);
  const edgeHoverInteractionRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(ATLAS_ZOOM_STORAGE_KEY);
    if (!stored) return;
    const parsed = Number(stored);
    if (!Number.isFinite(parsed)) return;
    setZoom(Math.min(ATLAS_MAX_ZOOM, Math.max(ATLAS_MIN_ZOOM, parsed)));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ATLAS_ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  const terms = useMemo(() => conceptTerms(concepts, media, insights, vault, drafts, practices), [concepts, media, insights, vault, drafts, practices]);
  const activeMap = atlasMaps.find((map) => map.id === activeMapId) || atlasMaps[0] || null;
  const activeMapStyle = useMemo(
    () => normalizeAtlasMapStyle(activeMap?.style),
    [activeMap?.style]
  );
  const selectedConcept = concepts.find((item) => conceptKey(item.name) === conceptKey(selectedName || ''));
  const related = selectedName ? conceptRelated(selectedName, { media, insights, vault, drafts, practices, questions, timeline }) : null;
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
  const healthRows = useMemo(
    () => deriveAtlasHealthRows({ vault, concepts, media, practices, questions, drafts, links, thinkingEvents }),
    [vault, concepts, media, practices, questions, drafts, links, thinkingEvents]
  );
  const tensionItems = useMemo(() => deriveAtlasTensions(healthRows), [healthRows]);
  const groupedTensions = useMemo(() => groupTensions(tensionItems), [tensionItems]);
  const overviewData = useMemo(
    () => deriveAtlasOverview({ rows: healthRows, tensions: tensionItems, concepts, practices, questions, timeline, thinkingEvents }),
    [healthRows, tensionItems, concepts, practices, questions, timeline, thinkingEvents]
  );
  const selectedHealthRow = useMemo(
    () => healthRows.find((row) => row.position.id === selectedPositionId) || null,
    [healthRows, selectedPositionId]
  );
  const atlasSectionMeta: Record<AtlasSection, { label: string; description: string }> = {
    overview: {
      label: 'Overview',
      description: 'See the current state of your worldview before you drop into detail.',
    },
    health: {
      label: 'Idea Health',
      description: 'Review which positions are strong, weak, stale, or under pressure.',
    },
    tensions: {
      label: 'Tensions',
      description: 'Surface contradictions, missing evidence, and ideas that need work.',
    },
    position: {
      label: 'Position Canvas',
      description: 'Inspect what one belief is built on, what challenges it, and what should happen to it next.',
    },
    graph: {
      label: 'Map View',
      description: 'Explore Atlas visually through concepts, positions, practices, and typed links.',
    },
  };

  useEffect(() => {
    if (atlasSection !== 'graph' && isFullScreen) {
      setIsFullScreen(false);
    }
  }, [atlasSection, isFullScreen]);
  const activeRelationshipTypes = useMemo(() => {
    if (relationshipFilterMode === 'all') return [] as PhilosophicalLinkType[];
    if (relationshipFilterMode === 'recommended') return recommendedRelationshipTypes;
    return customRelationshipTypes;
  }, [customRelationshipTypes, recommendedRelationshipTypes, relationshipFilterMode]);
  const relationshipFilterLabel = useMemo(() => {
    if (relationshipFilterMode === 'all') return 'Relationship Types: All';
    if (relationshipFilterMode === 'recommended') return 'Relationship Types: Recommended';
    if (!customRelationshipTypes.length) return 'Relationship Types: None';
    return `Relationship Types: ${customRelationshipTypes.length} selected`;
  }, [customRelationshipTypes.length, relationshipFilterMode]);

  useEffect(() => {
    if (!activeMapId && atlasMaps[0]) setActiveMapId(atlasMaps[0].id);
    if (activeMapId && !atlasMaps.some((map) => map.id === activeMapId)) setActiveMapId(atlasMaps[0]?.id || '');
  }, [activeMapId, atlasMaps]);

  useEffect(() => {
    if (selectedName) setPanelSection('links');
  }, [selectedName]);

  useEffect(() => {
    if (isStyleOpen) {
      setStyleDraft(normalizeAtlasMapStyle(activeMap?.style));
    }
  }, [activeMap?.style, isStyleOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQuickLinkSource(null);
        setQuickLinkTarget(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const visibleTerms = useMemo(() => {
    if (mode === 'custom') return activeMap ? activeMap.nodeNames.map(conceptKey) : [];
    return terms;
  }, [activeMap, mode, terms]);

  const nodes = useMemo<MapNode[]>(() => {
    const filtered = visibleTerms.filter((name) => !search || name.toLowerCase().includes(search.toLowerCase()));
    return filtered.map((name, index) => {
      const concept = concepts.find((c) => conceptKey(c.name) === conceptKey(name));
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, filtered.length);
      const radius = filtered.length <= 2 ? 22 : 34 + (index % 2) * 7;
      const count = taggedItemsForConcept(name, media, insights, vault, drafts, practices).length;
      const customPosition = activeMap?.nodePositions?.[conceptKey(name)];
      return {
        name,
        concept,
        count,
        x: draftPositions[conceptKey(name)]?.x ?? customPosition?.x ?? concept?.x ?? 50 + Math.cos(angle) * radius,
        y: draftPositions[conceptKey(name)]?.y ?? customPosition?.y ?? concept?.y ?? 50 + Math.sin(angle) * radius,
      };
    });
  }, [activeMap, concepts, drafts, draftPositions, insights, media, practices, search, vault, visibleTerms]);

  const relatedByNode = useMemo(() => {
    return new Map(nodes.map((node) => [
      conceptKey(node.name),
      conceptRelated(node.name, { media, insights, vault, drafts, practices, questions, timeline }),
    ]));
  }, [drafts, insights, media, nodes, practices, questions, timeline, vault]);
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

  const classifyStrength = (score: number) => {
    if (score >= 65) return 'strong' as const;
    if (score >= 35) return 'moderate' as const;
    if (score >= 15) return 'weak' as const;
    return 'suggested' as const;
  };

  const matchesConnectionFocus = (
    strength: MapEdge['strength'],
    focus: 'strong' | 'moderate' | 'all'
  ) => {
    if (focus === 'all') return true;
    if (focus === 'moderate') return strength === 'strong' || strength === 'moderate';
    return strength === 'strong';
  };

  const deriveMapModesFromType = (type?: string): AtlasViewMode[] => {
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
  };

  const collectRelatedTags = (related: ReturnType<typeof conceptRelated>, conceptName: string) => {
    const tags = new Set<string>();
    related.sources.forEach((item) => (item.tags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.beliefs.forEach((item) => (item.tags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.drafts.forEach((item) => (item.conceptTags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.practices.forEach((item) => (item.conceptTags || []).forEach((tag) => tags.add(conceptKey(tag))));
    related.questions.forEach((item) => (item.conceptIds || []).forEach((id) => tags.add(conceptKey(conceptNameById.get(id) || id))));
    tags.delete(conceptKey(conceptName));
    return tags;
  };

  const scoreSharedConnection = (
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
  };

  const edges = useMemo<MapEdge[]>(() => {
    const result: MapEdge[] = [];
    const nodeNames = new Set(nodes.map((node) => conceptKey(node.name)));
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
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const left = relatedByNode.get(conceptKey(nodes[i].name));
          const right = relatedByNode.get(conceptKey(nodes[j].name));
          if (!left || !right) continue;
          const sharedSources = left.sources.filter((item) => right.sources.some((other) => other.id === item.id)).length;
          const sharedPositions = left.beliefs.filter((item) => right.beliefs.some((other) => other.id === item.id)).length;
          const sharedInquiries = left.questions.filter((item) => right.questions.some((other) => other.id === item.id)).length;
          const sharedWorks = left.drafts.filter((item) => right.drafts.some((other) => other.id === item.id)).length;
          const sharedPractices = left.practices.filter((item) => right.practices.some((other) => other.id === item.id)).length;
          const objectTypeCount = [
            sharedSources > 0,
            sharedPositions > 0,
            sharedInquiries > 0,
            sharedWorks > 0,
            sharedPractices > 0,
          ].filter(Boolean).length;
          const shared =
            (mode === 'auto' || filters.sharedSources ? sharedSources : 0) +
            (mode === 'auto' || filters.sharedPositions ? sharedPositions : 0) +
            (mode === 'auto' || filters.sharedInquiries ? sharedInquiries : 0) +
            (mode === 'auto' || filters.sharedWorks ? sharedWorks : 0) +
            (mode === 'auto' || filters.sharedPractices ? sharedPractices : 0);
          if (shared) {
            const scored = scoreSharedConnection(nodes[i].name, nodes[j].name, left, right, {
              sharedSources,
              sharedPositions,
              sharedInquiries,
              sharedWorks,
              sharedPractices,
            });
            sharedCandidates.push({
              from: nodes[i].name,
              to: nodes[j].name,
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
  }, [activeMap, activeRelationshipTypes, autoConnectionFocus, concepts, deriveMapModesFromType, links, mode, nodes, relatedByNode, scoreSharedConnection, typedConceptPairMeta]);

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

  const visibleFamilies = useMemo(() => {
    const families = new Set();
    visibleEdges.forEach((edge) => {
      const pair = [conceptKey(edge.from), conceptKey(edge.to)].sort().join('::');
      families.add(pair);
    });
    return families.size;
  }, [visibleEdges]);

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

  const todayPrompt = useMemo(() => {
    const rawAnnotations = media.flatMap((item) => item.annotations || []).filter((annotation) => (annotation.philosophyStatus || 'raw') === 'raw');
    const openInquiries = questions.filter((question) => ['open', 'investigating', 'gathering_evidence', 'under_tension'].includes(question.status));
    const unsupportedPositions = vault.filter((position) => !(position.sourceIds || []).length && !(position.evidenceFor || []).length);
    const untestedPositions = vault.filter((position) => !practices.some((practice) => (practice.positionIds || []).includes(position.id)));

    if (rawAnnotations.length) {
      return {
        title: 'Connect one raw annotation',
        body: 'Choose one captured note and decide whether it becomes a concept, an inquiry, support, or a challenge.',
      };
    }
    if (openInquiries.length) {
      return {
        title: 'Move one inquiry forward',
        body: 'Add evidence for or against one open question so it can eventually become a clearer position.',
      };
    }
    if (unsupportedPositions.length) {
      return {
        title: 'Support or challenge a position',
        body: 'Pick one position without evidence and link the source or objection that gives it pressure.',
      };
    }
    if (untestedPositions.length) {
      return {
        title: 'Test a position in practice',
        body: 'Turn one current position into a small behavior, experiment, or commitment.',
      };
    }
    return {
      title: 'Record what changed',
      body: 'Add an Evolution note for the clearest shift in your thinking this week.',
    };
  }, [media, practices, questions, vault]);

  const openConceptInGraph = (name: string) => {
    setSelectedName(name);
    setIsPanelOpen(true);
    setPanelSection('evidence');
    setAtlasSection('graph');
  };

  const openPositionCanvas = (id: string) => {
    setSelectedPositionId(id);
    setAtlasSection('position');
  };

  const availableNodeTerms = useMemo(() => {
    const existingNames = new Set(nodes.map(n => conceptKey(n.name)));
    return terms.filter(t => !existingNames.has(conceptKey(t)));
  }, [nodes, terms]);

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
              <div className="mt-1 font-code text-[8px] uppercase tracking-widest text-muted-foreground">
                {link.sourceLabel} · {link.label}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isGroupedTyped && (
                <Badge variant="outline" className="rounded-full bg-accent/10 font-code text-[8px] uppercase tracking-widest text-accent">
                  {link.relationshipTypes?.length} types
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{link.kind}</Badge>
            </div>
          </div>
          {isGroupedTyped && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {link.relationshipTypes?.slice(0, 4).map((type) => (
                <Badge key={type} variant="outline" className="rounded-full bg-muted/20 font-code text-[8px] uppercase tracking-widest">
                  {type}
                </Badge>
              ))}
              {(link.relationshipTypes?.length || 0) > 4 && (
                <Badge variant="outline" className="rounded-full bg-muted/20 font-code text-[8px] uppercase tracking-widest">
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
      className={cn(
        "z-20 flex h-full shrink-0 flex-col overflow-hidden border border-border bg-white shadow-sm",
        isFullScreen
          ? "absolute inset-y-4 right-4 w-80 rounded-2xl"
          : "w-80 rounded-xl"
      )}
    >
      {selectedName ? (
        <>
          <div className="flex items-start justify-between border-b border-border/50 p-5">
            <div>
              <Badge variant="outline" className="mb-2 font-code text-[9px] uppercase tracking-widest text-accent rounded-full">Map Node</Badge>
              <h2 className="font-headline text-2xl font-bold italic">{selectedName}</h2>
              {selectedConcept?.description && <p className="mt-2 text-sm text-muted-foreground font-body">{selectedConcept.description}</p>}
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedName(null)}><X className="size-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4 space-y-2">
              <Label className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">Panel Section</Label>
              <Select value={panelSection} onValueChange={(value) => setPanelSection(value as 'links' | 'evidence' | 'events' | 'actions')}>
                <SelectTrigger className="h-9 rounded-full bg-card">
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

            {panelSection === 'links' && (
              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">Links</h4>
                  <div className="flex items-center gap-2">
                    <Select value={linkSort} onValueChange={(value) => setLinkSort(value as 'alpha' | 'created' | 'interacted')}>
                      <SelectTrigger className="h-7 w-[148px] rounded-full bg-card px-3 font-code text-[9px] uppercase tracking-widest">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alpha">Sort: A-Z</SelectItem>
                        <SelectItem value="created">Sort: Recently Created</SelectItem>
                        <SelectItem value="interacted">Sort: Recently Interacted</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-full" onClick={() => beginQuickLinkMode(selectedName!)}>
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
                <h4 className="mb-3 font-code text-[10px] uppercase tracking-widest text-muted-foreground">Evidence And Outputs</h4>
                {related ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setRelatedDialogType('sources')} disabled={!related.sources.length} className="rounded-full disabled:cursor-not-allowed disabled:opacity-60">
                      <Badge variant="outline" className="bg-muted/30 rounded-full transition-colors hover:border-accent hover:text-accent">{related.sources.length} sources</Badge>
                    </button>
                    <button onClick={() => setIsPositionsOpen(true)} disabled={!related.beliefs.length} className="rounded-full disabled:cursor-not-allowed disabled:opacity-60">
                      <Badge variant="outline" className="bg-muted/30 rounded-full transition-colors hover:border-accent hover:text-accent">{related.beliefs.length} positions</Badge>
                    </button>
                    <button onClick={() => setRelatedDialogType('works')} disabled={!related.drafts.length} className="rounded-full disabled:cursor-not-allowed disabled:opacity-60">
                      <Badge variant="outline" className="bg-muted/30 rounded-full transition-colors hover:border-accent hover:text-accent">{related.drafts.length} works</Badge>
                    </button>
                    <button onClick={() => setRelatedDialogType('practices')} disabled={!related.practices.length} className="rounded-full disabled:cursor-not-allowed disabled:opacity-60">
                      <Badge variant="outline" className="bg-muted/30 rounded-full transition-colors hover:border-accent hover:text-accent">{related.practices.length} practices</Badge>
                    </button>
                    <button onClick={() => setRelatedDialogType('inquiries')} disabled={!related.questions.length} className="rounded-full disabled:cursor-not-allowed disabled:opacity-60">
                      <Badge variant="outline" className="bg-muted/30 rounded-full transition-colors hover:border-accent hover:text-accent">{related.questions.length} inquiries</Badge>
                    </button>
                    <button onClick={() => setRelatedDialogType('unknowns')} disabled={!relatedUnknowns.length} className="rounded-full disabled:cursor-not-allowed disabled:opacity-60">
                      <Badge variant="outline" className="bg-muted/30 rounded-full transition-colors hover:border-accent hover:text-accent">{relatedUnknowns.length} unknowns</Badge>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground font-body">Gathering links...</p>
                )}
              </section>
            )}

            {panelSection === 'events' && (
              <section>
                <h4 className="mb-3 font-code text-[10px] uppercase tracking-widest text-muted-foreground">Recent Thinking Events</h4>
                <div className="space-y-2">
                  {recentThinkingForNode.length ? recentThinkingForNode.map((event) => (
                    <div key={event.eventId} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                      <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">{event.eventType.replace(/_/g, ' ')}</div>
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
                      <h4 className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">Actions</h4>
                      <Button size="sm" variant="outline" className="h-8 w-full justify-center rounded-full text-xs" onClick={() => beginQuickLinkMode(selectedName!)}>
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
                        className="h-7 w-full justify-center rounded-full px-2 text-[10px] text-destructive hover:text-destructive disabled:text-muted-foreground"
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
          <p className="text-sm font-body">Double-click a concept node to inspect its links, evidence, and outputs.</p>
        </div>
      )}
    </aside>
  );

  const linkTargets = useMemo(() => {
    if (!selectedName) return [];
    const key = conceptKey(selectedName);
    return visibleTerms.filter(t => conceptKey(t) !== key);
  }, [selectedName, visibleTerms]);

  const addConcept = () => {
    if (!newConcept.name?.trim()) return;
    onAddConcept({ ...newConcept, name: conceptKey(newConcept.name), createdFrom: 'manual' });
    setNewConcept({ name: '', description: '', sourceIds: [] });
    setIsAddOpen(false);
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

  const createCustomMap = () => {
    if (!newMap.title.trim()) return;
    const initialNodeNames = selectedName ? [conceptKey(selectedName)] : [];
    onAddAtlasMap({
      title: newMap.title.trim(),
      mode: 'custom',
      description: newMap.description.trim(),
      nodeNames: initialNodeNames,
      nodeIds: atlasNodeIdsForNames(initialNodeNames),
      nodePositions: selectedName ? { [conceptKey(selectedName)]: { x: 50, y: 50 } } : {},
      manualLinks: [],
      linkIds: [],
      autoLinkFilters: defaultAutoLinkFilters,
      style: defaultAtlasMapStyle,
    });
    setNewMap({ title: '', description: '' });
    setMode('custom');
    setIsMapOpen(false);
  };

  const updateActiveMap = (patch: Partial<AtlasMap>) => {
    if (!activeMap) return;
    const nextNodeNames = patch.nodeNames || activeMap.nodeNames || [];
    const nextManualLinks = patch.manualLinks || activeMap.manualLinks || [];
    onUpdateAtlasMap({
      ...activeMap,
      ...patch,
      mode: patch.mode || activeMap.mode || 'custom',
      nodeIds: patch.nodeIds || atlasNodeIdsForNames(nextNodeNames),
      linkIds: patch.linkIds || nextManualLinks.map((link) => link.id),
      dateUpdated: today(),
    });
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

  const createLink = () => {
    if (!selectedName || !linkDraft.to.trim()) return;
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
      updateActiveMap({ manualLinks: [...(activeMap.manualLinks || []), link] });
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
      onCreateLink({
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
      onUpdateConcept({ ...selectedConcept, links, dateUpdated: today() });
    }

    setLinkDraft({ to: '', type: 'relates', label: '', note: '' });
    setLinkSearch('');
    setIsLinkOpen(false);
    clearQuickLinkMode();
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

  const cutLink = (item: AtlasLinkItem) => {
    if (item.kind === 'custom') {
      removeUserLink(item.id);
    } else if (item.kind === 'typed') {
      onDeleteLink?.(item.id, { method: cutLinkMethod });
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
      selectedTypedLinks.forEach((link) => onDeleteLink(link.id, { method: cutLinkMethod }));
    }

    setSelectedLink(null);
    setCutLinkCandidate(null);
    setActiveEdgeId(null);
    setIsDeleteAllLinksOpen(false);
    setCutLinkMethod('atlas_link_detail');
  };

  const startPanning = (event: React.MouseEvent | React.PointerEvent) => {
    if (quickLinkSource) {
      setLastMousePos({ x: event.clientX, y: event.clientY });
      setQuickLinkCursor({ x: event.clientX, y: event.clientY });
      return;
    }
    if (draggingName) return;
    if (event.target !== event.currentTarget) return;
    setIsPanning(true);
    setLastMousePos({ x: event.clientX, y: event.clientY });
    setSelectedName(null);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (quickLinkSource) {
      setQuickLinkCursor({ x: event.clientX, y: event.clientY });
    }
    if (!isPanning) return;
    const dx = event.clientX - lastMousePos.x;
    const dy = event.clientY - lastMousePos.y;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMousePos({ x: event.clientX, y: event.clientY });
  };

  const moveNode = (name: string, clientX: number, clientY: number) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(94, Math.max(6, ((clientX - rect.left - pan.x) / (rect.width * zoom)) * 100));
    const y = Math.min(92, Math.max(8, ((clientY - rect.top - pan.y) / (rect.height * zoom)) * 100));
    setDraftPositions((prev) => ({ ...prev, [conceptKey(name)]: { x, y } }));
  };

  const persistNode = (name: string) => {
    const position = draftPositions[conceptKey(name)];
    const concept = concepts.find((item) => conceptKey(item.name) === conceptKey(name));
    if (position && mode === 'custom' && activeMap) {
      updateActiveMap({
        nodePositions: {
          ...(activeMap.nodePositions || {}),
          [conceptKey(name)]: position,
        },
      });
    } else if (concept && position) {
      onUpdateConcept({ ...concept, ...position, dateUpdated: today() });
    }
    setDraggingName(null);
  };

  const edgePoints = (from: MapNode, to: MapNode) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const horizontalRadius = 7.2;
    const verticalRadius = 4.2;
    const fromRadius = Math.min(Math.abs(horizontalRadius / (ux || 0.001)), Math.abs(verticalRadius / (uy || 0.001)));
    const toRadius = fromRadius;
    return {
      x1: from.x + ux * Math.min(fromRadius, len / 2),
      y1: from.y + uy * Math.min(fromRadius, len / 2),
      x2: to.x - ux * Math.min(toRadius, len / 2),
      y2: to.y - uy * Math.min(toRadius, len / 2),
    };
  };

  const edgeStrokeColor = (edge: MapEdge) => {
    const family = getAtlasRelationshipFamily(edge);
    if (mode === 'custom') {
      if (activeMapStyle.lineMode === 'singleColor') return activeMapStyle.customLineColor || '#7c3aed';
      if (activeMapStyle.lineMode === 'strengthColor') {
        if (edge.strength === 'strong') return '#f59e0b';
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

    if (background.type === 'uploaded' && background.imageUrl) {
      base.backgroundImage = `url(${background.imageUrl})`;
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
      base.backgroundColor = '#111111';
      base.backgroundImage = 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)';
      base.backgroundSize = '28px 28px';
    } else if (preset === 'blank') {
      base.backgroundColor = '#ffffff';
    } else {
      base.background = 'radial-gradient(circle at top, rgba(58,41,24,0.24), transparent 36%), linear-gradient(180deg, rgba(17,14,11,1) 0%, rgba(12,11,10,1) 100%)';
    }

    return base;
  }, [activeMapStyle.background, mode]);

  const customMapBackgroundOverlayStyle = useMemo<React.CSSProperties>(() => {
    if (mode !== 'custom') return {};
    return {
      opacity: activeMapStyle.background.opacity ?? 0.42,
      filter: `blur(${activeMapStyle.background.blur ?? 0}px)`,
    };
  }, [activeMapStyle.background.blur, activeMapStyle.background.opacity, mode]);

  const nodeCardClassName = (nodeStyle: AtlasMapNodeStyle | undefined, isSelected: boolean) => cn(
    'border-accent/20 bg-white/95 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl',
    nodeStyle === 'compact' && 'min-w-[112px] rounded-lg px-3 py-2',
    nodeStyle === 'pill' && 'min-w-[124px] rounded-full px-5 py-2.5',
    nodeStyle === 'card' && 'min-w-[152px] rounded-2xl px-4 py-4 shadow-lg',
    (!nodeStyle || nodeStyle === 'default') && 'rounded-xl p-3',
    isSelected && (isFullScreen
      ? 'border-accent shadow-2xl ring-2 ring-accent'
      : 'border-accent shadow-lg ring-1 ring-accent/85')
  );

  const saveMapStyle = () => {
    if (!activeMap) return;
    updateActiveMap({ style: styleDraft });
    setIsStyleOpen(false);
  };

  const clearUploadedBackground = async () => {
    if (!styleDraft.background.storagePath) {
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
      return;
    }

    try {
      const { firebaseApp } = initializeFirebase();
      const storage = getStorage(firebaseApp);
      await deleteObject(storageRef(storage, styleDraft.background.storagePath));
    } catch (error) {
      console.warn('Unable to delete atlas background from storage', error);
    }

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
      const { firebaseApp } = initializeFirebase();
      const storage = getStorage(firebaseApp);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `users/${uid}/atlasMaps/${activeMap.id}/background-${Date.now()}-${safeName}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type || 'image/png' });
      const imageUrl = await getDownloadURL(fileRef);
      setStyleDraft((prev) => ({
        ...prev,
        background: {
          ...prev.background,
          type: 'uploaded',
          imageUrl,
          storagePath: path,
          opacity: prev.background.opacity ?? 0.58,
          blur: prev.background.blur ?? 0,
        },
      }));
    } finally {
      setIsUploadingBackground(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = '';
    }
  };

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const contradictionLink = links.find((link) =>
      ['contradicts', 'challenges', 'weakens'].includes(link.type)
      && link.fromType === 'concept'
      && link.toType === 'concept'
    );
    if (contradictionLink) {
      items.push({
        id: `attention-link-${contradictionLink.id}`,
        title: 'Possible contradiction',
        detail: `${contradictionLink.fromLabel || 'Idea'} vs ${contradictionLink.toLabel || 'idea'}`,
        tone: 'danger',
        icon: 'conflict',
        conceptName: contradictionLink.fromLabel,
        link: {
          id: contradictionLink.id,
          kind: 'typed',
          from: contradictionLink.fromLabel || contradictionLink.fromType,
          to: contradictionLink.toLabel || contradictionLink.toType,
          label: contradictionLink.type.replace(/_/g, ' '),
          linkType: contradictionLink.type,
          note: contradictionLink.note,
          removable: Boolean(onDeleteLink),
          sourceLabel: 'Typed philosophical link',
          createdAt: contradictionLink.dateCreated,
          updatedAt: contradictionLink.dateUpdated,
        },
      });
    }

    const weakPosition = vault.find((position) => !(position.sourceIds || []).length && !(position.evidenceFor || []).length);
    if (weakPosition) {
      items.push({
        id: `attention-position-${weakPosition.id}`,
        title: 'Weak evidence',
        detail: weakPosition.title,
        tone: 'warning',
        icon: 'evidence',
        conceptName: weakPosition.tags?.[0],
        positionId: weakPosition.id,
      });
    }

    const untestedPosition = vault.find((position) => !practices.some((practice) => (practice.positionIds || []).includes(position.id)));
    if (untestedPosition) {
      items.push({
        id: `attention-practice-${untestedPosition.id}`,
        title: 'Untested position',
        detail: untestedPosition.title,
        tone: 'notice',
        icon: 'practice',
        conceptName: untestedPosition.tags?.[0],
        positionId: untestedPosition.id,
      });
    }

    const orphanedConcept = concepts.find((concept) => {
      const conceptRelations = conceptRelated(concept.name, { media, insights, vault, drafts, practices, questions, timeline });
      return (
        !(concept.links || []).length
        && !concept.sourceIds.length
        && !conceptRelations.sources.length
        && !conceptRelations.beliefs.length
        && !conceptRelations.questions.length
        && !conceptRelations.drafts.length
        && !conceptRelations.practices.length
      );
    });
    if (orphanedConcept) {
      items.push({
        id: `attention-concept-${orphanedConcept.id}`,
        title: 'Orphaned concept',
        detail: orphanedConcept.name,
        tone: 'warning',
        icon: 'concept',
        conceptName: orphanedConcept.name,
      });
    }

    const staleInquiry = [...questions]
      .filter((question) => ['open', 'investigating', 'gathering_evidence', 'under_tension', 'partially_answered', 'reopened'].includes(question.status))
      .sort((a, b) => Date.parse(a.dateUpdated || a.dateCreated) - Date.parse(b.dateUpdated || b.dateCreated))[0];
    if (staleInquiry) {
      const inquiryConcept = concepts.find((concept) => staleInquiry.conceptIds.includes(concept.id));
      items.push({
        id: `attention-inquiry-${staleInquiry.id}`,
        title: 'Stale inquiry',
        detail: staleInquiry.text,
        tone: 'notice',
        icon: 'inquiry',
        conceptName: inquiryConcept?.name,
        questionId: staleInquiry.id,
      });
    }

    return items.slice(0, 5);
  }, [concepts, drafts, insights, links, media, onDeleteLink, practices, questions, timeline, vault]);

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

  const isMapEmpty = visibleEdges.length === 0;

  return (
    <div className={cn(
      "relative flex w-full min-h-0 flex-col bg-background",
      isFullScreen ? "fixed inset-0 z-50 overflow-hidden" : "h-[calc(100vh-3.5rem)] overflow-hidden"
    )}>
      {!isFullScreen && (
      <header className="z-20 mb-1 flex items-start justify-between gap-4 px-8 pt-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-headline text-[28px] font-semibold italic">Atlas</h1>
            <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{atlasSectionMeta[atlasSection].label}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{atlasSectionMeta[atlasSection].description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {atlasSection === 'graph' && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search map..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-56 pl-9 rounded-full" />
              </div>
              <Button onClick={() => setIsAddOpen(true)} size="sm" className="bg-accent hover:bg-accent/90 rounded-full">
                <Plus className="mr-1.5 size-4" /> New Concept
              </Button>
            </>
          )}
        </div>
      </header>
      )}

      {!isFullScreen && (
      <div className="z-10 space-y-2 px-8 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['overview', 'Overview'],
            ['health', 'Idea Health'],
            ['tensions', 'Tensions'],
            ['position', 'Position Canvas'],
            ['graph', 'Map View'],
          ] as Array<[AtlasSection, string]>).map(([section, label]) => (
            <Button
              key={section}
              variant={atlasSection === section ? 'default' : 'outline'}
              size="sm"
              className="h-8 rounded-full"
              onClick={() => setAtlasSection(section)}
            >
              {label}
            </Button>
          ))}
        </div>
        {atlasSection === 'graph' && (
        <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-white p-1 shadow-sm">
            <Button variant={mode === 'auto' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('auto')} className="h-8 rounded-full">Auto Map</Button>
            <Button variant={mode === 'custom' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('custom')} className="h-8 rounded-full">Custom Maps</Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as AtlasViewMode)}>
              <SelectTrigger className="h-8 w-36 rounded-full border-input bg-background px-3 font-code text-[10px] uppercase tracking-wider shadow-sm">
                <SelectValue placeholder="View Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="core" className="font-code text-[10px] uppercase tracking-wider">Core Map</SelectItem>
                <SelectItem value="conflict" className="font-code text-[10px] uppercase tracking-wider">Conflict Map</SelectItem>
                <SelectItem value="evidence" className="font-code text-[10px] uppercase tracking-wider">Evidence Map</SelectItem>
                <SelectItem value="practice" className="font-code text-[10px] uppercase tracking-wider">Practice/Test</SelectItem>
                <SelectItem value="evolution" className="font-code text-[10px] uppercase tracking-wider">Evolution Map</SelectItem>
                <SelectItem value="full" className="font-code text-[10px] uppercase tracking-wider">Full Map</SelectItem>
              </SelectContent>
            </Select>
            <Select value={autoConnectionFocus} onValueChange={(value) => setAutoConnectionFocus(value as 'strong' | 'moderate' | 'all')}>
              <SelectTrigger className="h-8 w-40 rounded-full border-input bg-background px-3 font-code text-[10px] uppercase tracking-wider shadow-sm">
                <SelectValue placeholder="Connection Focus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong" className="font-code text-[10px] uppercase tracking-wider">Strong Connections</SelectItem>
                <SelectItem value="moderate" className="font-code text-[10px] uppercase tracking-wider">Strong + Moderate</SelectItem>
                <SelectItem value="all" className="font-code text-[10px] uppercase tracking-wider">All Connections</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 rounded-full px-3 font-code text-[10px] uppercase tracking-wider shadow-sm">
                  {relationshipFilterLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[420px] w-72 overflow-y-auto rounded-2xl">
                <DropdownMenuLabel className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">Relationship Types</DropdownMenuLabel>
                <div className="flex gap-2 px-2 pb-2 pt-1">
                  <Button size="sm" variant={relationshipFilterMode === 'recommended' ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-[10px]" onClick={() => setRelationshipFilterMode('recommended')}>
                    Select Recommended
                  </Button>
                  <Button size="sm" variant={relationshipFilterMode === 'all' ? 'default' : 'outline'} className="h-7 rounded-full px-3 text-[10px]" onClick={() => setRelationshipFilterMode('all')}>
                    Show All
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-[10px]" onClick={() => { setRelationshipFilterMode('custom'); setCustomRelationshipTypes([]); }}>
                    Clear All
                  </Button>
                </div>
                <DropdownMenuSeparator />
                {atlasRelationshipGroups.map((group) => (
                  <div key={group.label}>
                    <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/80">{group.label}</DropdownMenuLabel>
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
                        className="font-code text-[10px] uppercase tracking-wider"
                      >
                        {type.replace(/_/g, ' ')}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {mode === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeMap?.id || ''}
                onChange={(event) => setActiveMapId(event.target.value)}
                className="h-8 rounded-full border border-input bg-background px-4 font-code text-[11px] uppercase tracking-wider shadow-sm appearance-none cursor-pointer"
              >
                {!atlasMaps.length && <option value="">No custom maps</option>}
                {atlasMaps.map((map) => <option key={map.id} value={map.id}>{map.title}</option>)}
              </select>
              <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setIsStyleOpen(true)} disabled={!activeMap}>
                <SlidersHorizontal className="mr-1.5 size-4" /> Map Style
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setIsMapOpen(true)}><Plus className="mr-1.5 size-4" /> Custom Map</Button>
              <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setIsNodeOpen(true)} disabled={!activeMap}><Plus className="mr-1.5 size-4" /> Add Node</Button>
              {activeMap && (
                <Button variant="ghost" size="sm" onClick={() => onDeleteAtlasMap(activeMap.id)} className="h-8 text-destructive hover:text-destructive rounded-full">Delete Map</Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide">
            <Stat value={nodes.length} label="Nodes" />
            <Stat value={visibleEdges.length} label="Visible Links" />
            <Stat value={visibleFamilies} label="Visible Families" />
            <Stat value={selectedName || 'None'} label="Active" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">
              {viewMode === 'core' ? 'Core' : viewMode.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">
              {autoConnectionFocus === 'strong' ? 'Strong' : autoConnectionFocus === 'moderate' ? 'Moderate' : 'All'}
            </Badge>
          </div>
        </div>
        </>
        )}
      </div>
      )}

      {atlasSection !== 'graph' && !isFullScreen && (
        <div className="flex-1 overflow-y-auto px-8 pb-6 pt-2">
          {atlasSection === 'overview' && (
            <AtlasOverview
              overview={overviewData}
              todayPrompt={todayPrompt}
              attentionItems={attentionItems}
              onOpenPosition={openPositionCanvas}
              onOpenQuestion={(id) => onOpenQuestion?.(id)}
              onOpenConcept={openConceptInGraph}
              onOpenTensions={() => setAtlasSection('tensions')}
            />
          )}
          {atlasSection === 'health' && (
            <AtlasHealthTable
              rows={healthRows}
              onOpenPosition={openPositionCanvas}
            />
          )}
          {atlasSection === 'tensions' && (
            <AtlasTensionsBoard
              grouped={groupedTensions}
              onOpenPosition={openPositionCanvas}
              onOpenQuestion={(id) => onOpenQuestion?.(id)}
              onOpenConcept={openConceptInGraph}
            />
          )}
          {atlasSection === 'position' && (
            <AtlasPositionCanvas
              row={selectedHealthRow}
              onOpenConcept={openConceptInGraph}
              onOpenQuestion={(id) => onOpenQuestion?.(id)}
              onBackToHealth={() => setAtlasSection('health')}
            />
          )}
        </div>
      )}

      {atlasSection === 'graph' && (
      <div className={cn(
        "flex min-h-0 flex-1 gap-4",
        isFullScreen ? "overflow-hidden px-0 pb-0" : "overflow-hidden px-8 pb-4"
      )}>
        <div
          ref={mapRef}
          className={cn(
            "relative h-full min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-inner",
            quickLinkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            isFullScreen && "rounded-none"
          )}
          onClick={() => {
            if (quickLinkSource) clearQuickLinkMode();
            else setActiveEdgeId(null);
          }}
          onMouseDown={startPanning}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          {mode === 'custom' && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ ...customMapBackgroundStyle, ...customMapBackgroundOverlayStyle }}
            />
          )}
          <div className="absolute right-4 top-4 z-30 flex h-9 rounded-full border border-border/50 bg-white/90 p-1 shadow-md backdrop-blur">
            <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setZoom((z) => Math.max(ATLAS_MIN_ZOOM, z - ATLAS_ZOOM_STEP)); }} className="h-7 w-7 rounded-full font-bold">-</Button>
            <div className="flex w-10 items-center justify-center font-code text-[10px] font-bold text-primary/60">{Math.round((zoom / ATLAS_BASE_ZOOM) * 100)}%</div>
            <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setZoom((z) => Math.min(ATLAS_MAX_ZOOM, z + ATLAS_ZOOM_STEP)); }} className="h-7 w-7 rounded-full font-bold">+</Button>
            <div className="mx-1 my-1 w-px bg-border" />
            <Button variant={isPanelOpen ? 'secondary' : 'ghost'} size="icon" onClick={(event) => { event.stopPropagation(); setIsPanelOpen((open) => !open); }} className="h-7 w-7 rounded-full">
              <SlidersHorizontal className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setIsFullScreen(!isFullScreen); }} className="h-7 w-7 rounded-full">
              {isFullScreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
            </Button>
          </div>

          {isMapEmpty && (
            <div className="absolute left-4 top-4 z-20 max-w-sm rounded-2xl border border-border bg-white/95 p-4 shadow-lg backdrop-blur">
              <div className="font-headline text-lg font-semibold italic">Not enough strong connections yet.</div>
              <p className="mt-1 text-sm italic leading-5 text-muted-foreground">Create links, interact with nodes, or lower the strength filter to reveal weaker relationships.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAutoConnectionFocus('moderate')}>Show Strong + Moderate</Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAutoConnectionFocus('all')}>Show All Connections</Button>
                <Button size="sm" className="rounded-full" onClick={() => setIsLinkOpen(true)} disabled={!selectedName}>Create Link</Button>
              </div>
            </div>
          )}

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
            className="absolute inset-0 h-full w-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {visibleEdges.map((edge, index) => {
                const from = nodes.find((node) => conceptKey(node.name) === conceptKey(edge.from));
                const to = nodes.find((node) => conceptKey(node.name) === conceptKey(edge.to));
                if (!from || !to) return null;
                const points = edgePoints(from, to);
                const key = `${edge.from}-${edge.to}-${edge.id || index}`;
                const isHovered = hoveredEdgeId === key;
                const edgeColor = edgeStrokeColor(edge);
                const isActive = activeEdgeId === edgeSignature(edge);
                const isSelectedClusterEdge = selectedClusterEdges.has(edgeSignature(edge));
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
              const sourceNode = nodes.find((node) => conceptKey(node.name) === conceptKey(quickLinkSource));
              const rect = mapRef.current?.getBoundingClientRect();
              if (!sourceNode || !rect) return null;
              const cursorX = ((quickLinkCursor.x - rect.left - pan.x) / (rect.width * zoom)) * 100;
              const cursorY = ((quickLinkCursor.y - rect.top - pan.y) / (rect.height * zoom)) * 100;
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

            {nodes.map((node) => (
              <button
                key={node.name}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 text-center transition-none",
                  quickLinkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
                )}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openNodeLinkPanel(node.name);
                }}
                onPointerEnter={() => {
                  if (quickLinkSource && conceptKey(node.name) !== conceptKey(quickLinkSource)) {
                    setQuickLinkHoverTarget(node.name);
                  }
                }}
                onPointerLeave={() => {
                  if (quickLinkHoverTarget === node.name) setQuickLinkHoverTarget(null);
                }}
                onPointerDown={(event) => {
                  if (quickLinkSource) {
                    event.stopPropagation();
                    if (conceptKey(node.name) === conceptKey(quickLinkSource)) return;
                    setQuickLinkTarget(node.name);
                    setQuickLinkHoverTarget(node.name);
                    setLinkDraft((prev) => ({
                      ...prev,
                      to: conceptKey(node.name),
                      type: prev.type || 'supports',
                      label: prev.label || 'supports',
                    }));
                    setIsLinkOpen(true);
                    return;
                  }
                  event.stopPropagation();
                  setDraggingName(node.name);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onDoubleClick={(event) => {
                  if (quickLinkSource) return;
                  event.stopPropagation();
                  setSelectedName(node.name);
                  setIsPanelOpen(true);
                }}
                onPointerMove={(event) => {
                  if (draggingName === node.name) moveNode(node.name, event.clientX, event.clientY);
                }}
                onPointerUp={() => persistNode(node.name)}
                onPointerCancel={() => setDraggingName(null)}
              >
                <Card
                  className={cn(
                    nodeCardClassName(activeMapStyle.nodeStyle, selectedName === node.name),
                    quickLinkSource && conceptKey(node.name) === conceptKey(quickLinkSource) && 'border-accent ring-2 ring-accent shadow-2xl',
                    quickLinkSource && conceptKey(node.name) !== conceptKey(quickLinkSource) && 'opacity-95',
                    quickLinkHoverTarget && conceptKey(node.name) === conceptKey(quickLinkHoverTarget) && 'border-accent bg-accent/10 ring-2 ring-accent shadow-2xl',
                    activeEdgeNodes.size > 0 && !activeEdgeNodes.has(conceptKey(node.name)) && 'opacity-45',
                    activeEdgeNodes.has(conceptKey(node.name)) && 'ring-2 ring-accent/60 shadow-xl',
                    !activeEdgeNodes.size && selectedClusterNodes.size > 0 && !selectedClusterNodes.has(conceptKey(node.name)) && 'opacity-25 saturate-50',
                    !activeEdgeNodes.size && selectedClusterNodes.has(conceptKey(node.name)) && selectedName !== node.name && 'border-accent/35 ring-1 ring-accent/35 shadow-lg'
                  )}
                  style={{ fontFamily: mode === 'custom' ? mapFontFamily(activeMapStyle.fontFamily) : undefined }}
                >
                  <h3 className={cn('font-headline font-semibold text-primary', activeMapStyle.nodeStyle === 'compact' && 'text-sm', activeMapStyle.nodeStyle === 'pill' && 'text-[15px]')}>
                    {node.name}
                  </h3>
                  <div className="font-code text-[9px] uppercase text-muted-foreground">{node.count} linked</div>
                  {selectedName === node.name && (
                    <div
                      className={cn(
                        "flex items-center justify-center gap-1.5",
                        isFullScreen
                          ? "mt-2"
                          : "absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 rounded-full border border-border/70 bg-white/96 px-1.5 py-1 shadow-lg backdrop-blur-sm"
                      )}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("rounded-full text-[10px]", isFullScreen ? "h-6 px-2" : "h-5 px-1.5 text-[9px]")}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedName(node.name);
                          beginQuickLinkMode(node.name);
                        }}
                      >
                        <Link2 className="mr-1 size-3" /> Quick Link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("rounded-full text-destructive hover:text-destructive", isFullScreen ? "h-6 px-2 text-[10px]" : "h-5 px-1.5 text-[9px]")}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (removableNodeLinks.length) {
                            setSelectedName(node.name);
                            setCutLinkMethod('atlas_node_action');
                            setIsDeleteAllLinksOpen(true);
                          }
                        }}
                        disabled={!removableNodeLinks.length}
                      >
                        Cut Links
                      </Button>
                    </div>
                  )}
                </Card>
              </button>
            ))}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-px bg-border" />
          </div>

          {quickLinkSource && (
            <div
              className="pointer-events-none absolute z-30 rounded-full border border-accent/30 bg-white/95 px-3 py-1.5 shadow-md"
              style={{
                left: Math.min((mapRef.current?.clientWidth || 0) - 220, Math.max(12, quickLinkCursor.x - (mapRef.current?.getBoundingClientRect().left || 0) + 14)),
                top: Math.min((mapRef.current?.clientHeight || 0) - 48, Math.max(12, quickLinkCursor.y - (mapRef.current?.getBoundingClientRect().top || 0) + 14)),
              }}
            >
              <div className="font-code text-[9px] uppercase tracking-widest text-accent">
                Link from {quickLinkSource} - click a target node
              </div>
            </div>
          )}
        </div>
        {!isFullScreen && isPanelOpen && atlasPanel}
      </div>
      )}

      {atlasSection === 'graph' && isFullScreen && isPanelOpen && atlasPanel}

      <Dialog open={!!selectedLink} onOpenChange={(open) => !open && setSelectedLink(null)}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Link Detail</DialogTitle>
          </DialogHeader>
          {selectedLink && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">From</div>
                  <div className="mt-1 font-headline text-lg font-bold italic">{selectedLink.from}</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">To</div>
                  <div className="mt-1 font-headline text-lg font-bold italic">{selectedLink.to}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-widest">{selectedLink.linkType || selectedLink.label}</Badge>
                <Badge variant="outline" className="rounded-full bg-card font-code text-[9px] uppercase tracking-widest">{selectedLink.sourceLabel}</Badge>
                {selectedLink.relationshipTypes && selectedLink.relationshipTypes.length > 1 && selectedLink.relationshipTypes.map((type) => (
                  <Badge key={type} variant="outline" className="rounded-full bg-muted/20 font-code text-[9px] uppercase tracking-widest">
                    {type}
                  </Badge>
                ))}
              </div>
              <p className="rounded-xl border border-border/60 bg-card p-4 text-sm italic leading-6 text-muted-foreground">
                {selectedLink.note || (selectedLink.kind === 'shared' ? 'This relationship is derived from shared evidence across the system.' : 'No note recorded for this link.')}
              </p>
              {selectedLink.kind === 'shared' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs italic leading-5 text-amber-800">
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

      <Dialog
        open={!!cutLinkCandidate}
        onOpenChange={(open) => {
          if (!open) {
            setCutLinkCandidate(null);
            setCutLinkMethod('atlas_link_detail');
          }
        }}
      >
        <DialogContent className="max-w-md border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Remove this link?</DialogTitle>
          </DialogHeader>
          {cutLinkCandidate && (
            <p className="pt-2 text-sm italic leading-6 text-muted-foreground">
              This removes the relationship between <span className="text-foreground">{cutLinkCandidate.from}</span> and <span className="text-foreground">{cutLinkCandidate.to}</span>. The nodes and their source items stay intact.
            </p>
          )}
          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setCutLinkCandidate(null)} className="rounded-full">Cancel</Button>
            <Button variant="destructive" onClick={() => cutLink(cutLinkCandidate!)} className="rounded-full px-7">Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      openPositionCanvas(position.id);
                    }}
                  >
                    <TableCell>
                      <div className="font-headline text-base font-semibold italic">{position.title}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{position.statement || position.description}</div>
                    </TableCell>
                    <TableCell className="font-code text-[10px] uppercase tracking-widest">{position.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{position.status}</Badge></TableCell>
                    <TableCell className="font-code text-xs">{position.confidence}/5</TableCell>
                    <TableCell className="font-code text-xs">{(position.sourceIds || []).length}</TableCell>
                    <TableCell className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{new Date(position.dateUpdated || position.dateCreated).toLocaleDateString()}</TableCell>
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
                {item.meta && <div className="mt-1 font-code text-[9px] uppercase tracking-widest text-muted-foreground">{item.meta}</div>}
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
            <Button variant="destructive" onClick={clearSelectedNodeLinks} className="rounded-full px-7">Delete Connected Links</Button>
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
          <DialogFooter className="pt-4"><Button onClick={addConcept} className="rounded-full px-8">Anchor Node</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-headline text-2xl italic">New Custom Map</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="readex-kicker">Map Name</Label>
              <Input value={newMap.title} onChange={(event) => setNewMap((prev) => ({ ...prev, title: event.target.value }))} placeholder="Discipline and Avoidance" className="rounded-full" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker">Purpose</Label>
              <Textarea value={newMap.description} onChange={(event) => setNewMap((prev) => ({ ...prev, description: event.target.value }))} placeholder="What this map is trying to understand..." />
            </div>
          </div>
          <DialogFooter className="pt-4"><Button onClick={createCustomMap} className="rounded-full px-8">Create Map</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStyleOpen} onOpenChange={setIsStyleOpen}>
        <DialogContent className="max-w-2xl border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Customize Map</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-6 overflow-y-auto pt-2 pr-1">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="readex-kicker">Line Color Preference</Label>
                <Select
                  value={styleDraft.lineMode}
                  onValueChange={(value) => setStyleDraft((prev) => ({ ...prev, lineMode: value as AtlasMapStyle['lineMode'] }))}
                >
                  <SelectTrigger className="rounded-full">
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
                      value={styleDraft.customLineColor || '#7c3aed'}
                      onChange={(event) => setStyleDraft((prev) => ({ ...prev, customLineColor: event.target.value }))}
                      className="h-10 w-16 rounded-lg p-1"
                    />
                    <Input
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
                  <SelectTrigger className="rounded-full">
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
                  <SelectTrigger className="rounded-full">
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
                    <SelectTrigger className="rounded-full">
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
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      className="hidden"
                      onChange={(event) => handleBackgroundUpload(event.target.files?.[0] || null)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => backgroundInputRef.current?.click()}
                        disabled={!uid || isUploadingBackground}
                      >
                        {isUploadingBackground ? 'Uploading...' : 'Upload Background'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full text-destructive hover:text-destructive"
                        onClick={clearUploadedBackground}
                        disabled={!styleDraft.background.imageUrl}
                      >
                        Remove Background
                      </Button>
                    </div>
                    {!uid && <p className="text-xs italic text-muted-foreground">Background upload becomes available once this workspace has a user id.</p>}
                    {styleDraft.background.imageUrl && (
                      <div className="space-y-2">
                        <div className="overflow-hidden rounded-xl border border-border/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={styleDraft.background.imageUrl} alt="Map background preview" className="h-32 w-full object-cover" />
                        </div>
                        <Input
                          value={styleDraft.background.imageUrl}
                          onChange={(event) => setStyleDraft((prev) => ({
                            ...prev,
                            background: {
                              ...prev.background,
                              imageUrl: event.target.value,
                            },
                          }))}
                          className="rounded-full"
                        />
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
                  <SelectTrigger className="rounded-full">
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
                  <span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">
                    {Math.round((styleDraft.background.opacity ?? 0.42) * 100)}%
                  </span>
                </div>
                <Slider
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
                  <span className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">
                    {styleDraft.background.blur ?? 0}px
                  </span>
                </div>
                <Slider
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
            <Button variant="ghost" onClick={() => setIsStyleOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={saveMapStyle} className="rounded-full px-8">Save Map Style</Button>
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
                  <button key={name} onClick={() => addNodeToMap(name)} className="w-full rounded-lg p-3 text-left font-code text-[10px] uppercase tracking-wider hover:bg-muted transition-colors">
                    {name}
                  </button>
                ))}
              {!availableNodeTerms.length && <p className="p-4 text-sm text-muted-foreground italic font-body">Every concept is already on this custom map.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkOpen} onOpenChange={(open) => {
        setIsLinkOpen(open);
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
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="readex-kicker">From</Label>
              <Input value={selectedName || ''} disabled className="rounded-full" />
            </div>
            <div className="space-y-2">
              <Label className="readex-kicker">To</Label>
              <select
                value={linkDraft.to}
                onChange={(event) => setLinkDraft((prev) => ({ ...prev, to: event.target.value }))}
                className="h-10 w-full rounded-full border border-border/60 bg-white px-4 text-sm font-body shadow-sm appearance-none"
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
                        "rounded-full border px-3 py-1 font-code text-[9px] uppercase tracking-widest transition-colors",
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
                      "rounded-full border px-3 py-1 font-code text-[9px] uppercase tracking-widest transition-colors",
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
                    className="h-10 w-full rounded-full border border-border/60 bg-white px-4 text-sm font-body shadow-sm appearance-none"
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
          </div>
          <DialogFooter className="pt-4"><Button onClick={createLink} disabled={!linkDraft.to} className="rounded-full px-8">Save Link</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap rounded-full border border-border bg-white px-5 py-2 shadow-sm">
      <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/60 font-bold">{label}</div>
      <div className="max-w-[120px] truncate font-headline text-lg font-bold italic text-primary">{value}</div>
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


