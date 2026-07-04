
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FlaskConical, HelpCircle, Link2, Maximize, Minimize, Plus, Search, SlidersHorizontal, Unlink2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { SourceLinker } from '@/components/SourceLinker';
import type {
  AtlasAutoLinkFilters,
  AtlasMap,
  AtlasMapLink,
  AtlasMapLinkType,
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
  onAddAtlasMap: (data: Partial<AtlasMap>) => void;
  onUpdateAtlasMap: (map: AtlasMap) => void;
  onDeleteAtlasMap: (id: string) => void;
  onDeleteLink?: (id: string) => void;
  onOpenPosition?: (id: string) => void;
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

const defaultAutoLinkFilters: AtlasAutoLinkFilters = {
  sharedSources: true,
  sharedPositions: true,
  sharedInquiries: true,
  sharedWorks: true,
  sharedPractices: true,
  conceptLinks: true,
};

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
  onAddAtlasMap,
  onUpdateAtlasMap,
  onDeleteAtlasMap,
  onDeleteLink,
  onOpenPosition,
}: ConceptAtlasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [autoConnectionFocus, setAutoConnectionFocus] = useState<'strong' | 'moderate' | 'all'>('strong');
  const [viewMode, setViewMode] = useState<AtlasViewMode>('core');
  const [relationshipFilterMode, setRelationshipFilterMode] = useState<AtlasRelationshipFilterMode>('recommended');
  const [customRelationshipTypes, setCustomRelationshipTypes] = useState<PhilosophicalLinkType[]>([]);
  const [mode, setMode] = useState<'auto' | 'custom'>('auto');
  const [activeMapId, setActiveMapId] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isNodeOpen, setIsNodeOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<AtlasLinkItem | null>(null);
  const [cutLinkCandidate, setCutLinkCandidate] = useState<AtlasLinkItem | null>(null);
  const [isPositionsOpen, setIsPositionsOpen] = useState(false);
  const [relatedDialogType, setRelatedDialogType] = useState<null | 'sources' | 'works' | 'practices' | 'inquiries' | 'unknowns'>(null);
  const [isDeleteAllLinksOpen, setIsDeleteAllLinksOpen] = useState(false);
  const [linkSort, setLinkSort] = useState<'alpha' | 'created' | 'interacted'>('alpha');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [quickLinkSource, setQuickLinkSource] = useState<string | null>(null);
  const [quickLinkTarget, setQuickLinkTarget] = useState<string | null>(null);
  const [quickLinkCursor, setQuickLinkCursor] = useState({ x: 0, y: 0 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [linkInteractionMap, setLinkInteractionMap] = useState<Record<string, { lastInteractedAt: string; interactionCount: number }>>({});
  const [newConcept, setNewConcept] = useState<Partial<Concept>>({ name: '', description: '', sourceIds: [] });
  const [newMap, setNewMap] = useState({ title: '', description: '' });
  const [linkDraft, setLinkDraft] = useState<{ to: string; type: AtlasMapLinkType; label: string; note: string }>({ to: '', type: 'relates', label: '', note: '' });
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [panelSection, setPanelSection] = useState<'links' | 'evidence' | 'events' | 'actions'>('links');
  const mapRef = useRef<HTMLDivElement | null>(null);
  const edgeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terms = useMemo(() => conceptTerms(concepts, media, insights, vault, drafts, practices), [concepts, media, insights, vault, drafts, practices]);
  const activeMap = atlasMaps.find((map) => map.id === activeMapId) || atlasMaps[0] || null;
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

  const classifyStrength = (score: number) => {
    if (score >= 70) return 'strong' as const;
    if (score >= 40) return 'moderate' as const;
    if (score >= 15) return 'weak' as const;
    return 'suggested' as const;
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
          });
        }
      });
    }

    if (mode === 'auto' || filters.conceptLinks) {
      concepts.forEach((concept) => (concept.links || []).forEach((link) => {
        if (nodeNames.has(conceptKey(concept.name)) && nodeNames.has(conceptKey(link))) {
          result.push({
            from: conceptKey(concept.name),
            to: conceptKey(link),
            type: 'concept',
            label: 'saved concept link',
            weight: 55,
            strength: 'moderate',
            objectTypes: ['concept'],
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
            const score = Math.min(100, shared * 12 + objectTypeCount * 10);
            sharedCandidates.push({
              from: nodes[i].name,
              to: nodes[j].name,
              type: 'shared',
              label: `${shared} shared`,
              weight: score,
              strength: classifyStrength(score),
              objectTypes: [
                ...(sharedSources ? ['source' as const] : []),
                ...(sharedPositions ? ['position' as const] : []),
                ...(sharedInquiries ? ['inquiry' as const] : []),
                ...(sharedWorks ? ['work' as const] : []),
                ...(sharedPractices ? ['practice' as const] : []),
              ],
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

    links
      .filter((link) => !activeRelationshipTypes.length || activeRelationshipTypes.includes(link.type))
      .forEach((link) => {
        const fromConcept = link.fromType === 'concept' ? concepts.find((concept) => concept.id === link.fromId) : null;
        const toConcept = link.toType === 'concept' ? concepts.find((concept) => concept.id === link.toId) : null;
        const fromName = conceptKey(fromConcept?.name || link.fromLabel);
        const toName = conceptKey(toConcept?.name || link.toLabel);
        if (fromName && toName && nodeNames.has(fromName) && nodeNames.has(toName)) {
          const importanceScore = highImportanceLinkTypes.has(link.type) ? 85 : moderateImportanceLinkTypes.has(link.type) ? 60 : 35;
          result.push({
            from: fromName,
            to: toName,
            type: 'typed',
            label: link.type.replace(/_/g, ' '),
            linkType: link.type,
            id: link.id,
            weight: importanceScore,
            strength: classifyStrength(importanceScore),
            objectTypes: [
              ...(link.fromType === 'concept' || link.toType === 'concept' ? ['concept' as const] : []),
              ...(link.fromType === 'position' || link.toType === 'position' ? ['position' as const] : []),
              ...(link.fromType === 'inquiry' || link.toType === 'inquiry' ? ['inquiry' as const] : []),
              ...(link.fromType === 'source' || link.toType === 'source' ? ['source' as const] : []),
              ...(link.fromType === 'annotation' || link.toType === 'annotation' ? ['annotation' as const] : []),
              ...(link.fromType === 'work' || link.toType === 'work' ? ['work' as const] : []),
              ...(link.fromType === 'practice' || link.toType === 'practice' ? ['practice' as const] : []),
            ],
          });
        }
      });
    return result;
  }, [activeMap, activeRelationshipTypes, autoConnectionFocus, concepts, links, mode, nodes, relatedByNode]);

  const visibleEdges = useMemo(() => {
    const selectedKey = conceptKey(selectedName || '');
    const isSelectedEdge = (edge: MapEdge) => conceptKey(edge.from) === selectedKey || conceptKey(edge.to) === selectedKey;
    const hasObjectType = (edge: MapEdge, types: Array<NonNullable<MapEdge['objectTypes']>[number]>) =>
      (edge.objectTypes || []).some((type) => types.includes(type));

    const filtered = edges.filter((edge) => {
      const typedLabel = (edge.linkType || '').toString();
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
        return ['contradicts', 'challenges', 'weakens', 'questions'].includes(typedLabel);
      }

      if (viewMode === 'evidence') {
        return edge.type === 'shared' || hasObjectType(edge, ['source', 'annotation', 'position']);
      }

      if (viewMode === 'practice') {
        return hasObjectType(edge, ['practice', 'work']) || ['tested_by', 'expressed_in'].includes(typedLabel);
      }

      if (viewMode === 'evolution') {
        return ['changed_by', 'replaces', 'refines', 'strengthens', 'weakens'].includes(typedLabel);
      }

      if (edge.strength === 'strong') return true;
      if (isSelectedEdge(edge) && edge.strength === 'moderate') return true;
      if (['contradicts', 'challenges', 'depends_on', 'refines', 'strengthens', 'weakens', 'tested_by', 'changed_by'].includes(typedLabel) && edge.strength === 'moderate') return true;
      if (edge.type === 'user') return true;
      return false;
    });

    if (viewMode !== 'full' && !selectedName) {
      return filtered.filter((edge) => edge.strength !== 'weak' && edge.strength !== 'suggested');
    }

    return filtered;
  }, [activeRelationshipTypes, edges, selectedName, viewMode]);

  const visibleFamilies = useMemo(() => {
    const families = new Set();
    visibleEdges.forEach((edge) => {
      const pair = [conceptKey(edge.from), conceptKey(edge.to)].sort().join('::');
      families.add(pair);
    });
    return families.size;
  }, [visibleEdges]);

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
  };

  const openLinkDetail = (link: AtlasLinkItem) => {
    markLinkInteraction(link);
    setSelectedLink(link);
  };

  const beginQuickLinkMode = (sourceName: string) => {
    setSelectedName(sourceName);
    setQuickLinkSource(sourceName);
    setQuickLinkTarget(null);
    setPanelSection('actions');
  };

  const clearQuickLinkMode = () => {
    setQuickLinkSource(null);
    setQuickLinkTarget(null);
  };

  const getLinkInteractionTime = (link: AtlasLinkItem) =>
    linkInteractionMap[link.id]?.lastInteractedAt || link.updatedAt || link.createdAt || '';

  const startEdgeHold = (edge: MapEdge) => {
    const linkItem = linkItemForEdge(edge);
    if (!linkItem.removable) return;
    if (edgeHoldTimerRef.current) clearTimeout(edgeHoldTimerRef.current);
    edgeHoldTimerRef.current = setTimeout(() => {
      setSelectedLink(null);
      setCutLinkCandidate(linkItem);
      markLinkInteraction(linkItem);
      edgeHoldTimerRef.current = null;
    }, 700);
  };

  const cancelEdgeHold = () => {
    if (edgeHoldTimerRef.current) {
      clearTimeout(edgeHoldTimerRef.current);
      edgeHoldTimerRef.current = null;
    }
  };

  const linkItemForEdge = (edge: MapEdge): AtlasLinkItem => {
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
      const typedLink = links.find((link) => link.id === edge.id);
      return {
        id: edge.id || `${edge.from}:${edge.to}`,
        kind: 'typed',
        from: typedLink?.fromLabel || edge.from,
        to: typedLink?.toLabel || edge.to,
        label: typedLink?.type?.replace(/_/g, ' ') || edge.label,
        linkType: typedLink?.type || edge.linkType,
        note: typedLink?.note,
        removable: Boolean(typedLink && onDeleteLink),
        sourceLabel: 'Typed philosophical link',
        createdAt: typedLink?.dateCreated,
        updatedAt: typedLink?.dateUpdated,
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
    };
  };

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

  const atlasPanel = (
    <aside
      className={cn(
        "z-20 flex shrink-0 flex-col overflow-hidden border border-border bg-white shadow-sm",
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
                  {selectedNodeLinks.map((link) => {
                    const target = conceptKey(link.from) === conceptKey(selectedName) ? link.to : link.from;
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
                            <Badge variant="outline" className="shrink-0 rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{link.kind}</Badge>
                          </div>
                          {link.note && <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">{link.note}</p>}
                        </button>
                        <div className="mt-2 flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openLinkDetail(link)} className="h-7 rounded-full px-3">Details</Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!link.removable}
                            onClick={() => {
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
                  })}
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
                        onClick={() => setIsDeleteAllLinksOpen(true)}
                        className="h-8 w-full justify-center rounded-full text-xs text-destructive hover:text-destructive disabled:text-muted-foreground"
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
          <p className="text-sm font-body">Select a concept node to inspect its links, evidence, and outputs.</p>
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

  const createCustomMap = () => {
    if (!newMap.title.trim()) return;
    onAddAtlasMap({
      title: newMap.title.trim(),
      description: newMap.description.trim(),
      nodeNames: selectedName ? [conceptKey(selectedName)] : [],
      nodePositions: selectedName ? { [conceptKey(selectedName)]: { x: 50, y: 50 } } : {},
      manualLinks: [],
      autoLinkFilters: defaultAutoLinkFilters,
    });
    setNewMap({ title: '', description: '' });
    setMode('custom');
    setIsMapOpen(false);
  };

  const updateActiveMap = (patch: Partial<AtlasMap>) => {
    if (!activeMap) return;
    onUpdateAtlasMap({ ...activeMap, ...patch, dateUpdated: today() });
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

  const removeNodeFromMap = (name: string) => {
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
  };

  const createLink = () => {
    if (!selectedName || !linkDraft.to.trim()) return;

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
      onDeleteLink?.(item.id);
    } else if (item.kind === 'concept' && item.sourceConceptId && item.conceptTarget) {
      const sourceConcept = concepts.find((concept) => concept.id === item.sourceConceptId);
      if (sourceConcept) {
        const nextLinks = (sourceConcept.links || []).filter((link) => conceptKey(link) !== conceptKey(item.conceptTarget));
        onUpdateConcept({ ...sourceConcept, links: nextLinks, dateUpdated: today() });
      }
    }
    setSelectedLink(null);
    setCutLinkCandidate(null);
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
      selectedTypedLinks.forEach((link) => onDeleteLink(link.id));
    }

    setSelectedLink(null);
    setCutLinkCandidate(null);
    setIsDeleteAllLinksOpen(false);
  };

  const startPanning = (event: React.MouseEvent | React.PointerEvent) => {
    if (quickLinkSource) {
      setLastMousePos({ x: event.clientX, y: event.clientY });
      setQuickLinkCursor({ x: event.clientX, y: event.clientY });
      return;
    }
    if (draggingName) return;
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
    const type = (edge.linkType || '').toString();
    if (['contradicts', 'challenges', 'weakens', 'questions'].includes(type)) return 'hsl(0 72% 56%)';
    if (['supports', 'exemplifies', 'references', 'derived_from', 'strengthens'].includes(type)) return 'hsl(152 58% 34%)';
    if (['defines', 'explains', 'explained_by', 'coheres'].includes(type)) return 'hsl(206 74% 40%)';
    if (['tested_by', 'depends_on', 'expressed_in'].includes(type)) return 'hsl(38 88% 44%)';
    if (['refines', 'replaces', 'changed_by', 'expands'].includes(type)) return 'hsl(266 54% 48%)';
    if (edge.type === 'user') return 'hsl(var(--accent))';
    if (edge.type === 'concept') return 'hsl(var(--primary) / .55)';
    return 'hsl(var(--muted-foreground) / .35)';
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

  const handleAttentionItemClick = (item: AttentionItem) => {
    setIsPanelOpen(true);
    if (item.conceptName) {
      setSelectedName(item.conceptName);
    }
    if (item.link) {
      openLinkDetail(item.link);
      return;
    }
    if (item.positionId) {
      setPanelSection('evidence');
      setIsPositionsOpen(true);
      return;
    }
    if (item.questionId) {
      setPanelSection('evidence');
      setRelatedDialogType('inquiries');
    }
  };

  const isMapEmpty = visibleEdges.length === 0;
  const isMapCrowded = visibleEdges.length > 60 || visibleFamilies > 20;

  return (
    <div className={cn(
      "relative flex min-h-screen w-full flex-col bg-background",
      isFullScreen ? "fixed inset-0 z-50 overflow-hidden" : "overflow-visible pb-8"
    )}>
      {!isFullScreen && (
      <header className="z-20 mb-2 flex items-start justify-between gap-4 px-8 pt-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-[28px] font-semibold italic">Atlas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Map the relationships between concepts, sources, inquiries, positions, works, and practices.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as AtlasViewMode)}>
            <SelectTrigger className="h-9 w-40 rounded-full border-input bg-background px-4 font-code text-[10px] uppercase tracking-wider shadow-sm">
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
            <SelectTrigger className="h-9 w-44 rounded-full border-input bg-background px-4 font-code text-[10px] uppercase tracking-wider shadow-sm">
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
              <Button variant="outline" className="h-9 rounded-full px-4 font-code text-[10px] uppercase tracking-wider shadow-sm">
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
                  Clear
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search map..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-64 pl-9 rounded-full" />
          </div>
          <Button onClick={() => setIsAddOpen(true)} size="sm" className="bg-accent hover:bg-accent/90 rounded-full">
            <Plus className="mr-1.5 size-4" /> New Concept
          </Button>
        </div>
      </header>
      )}

      {!isFullScreen && (
      <div className="z-10 space-y-2 px-8 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-white p-1 shadow-sm">
            <Button variant={mode === 'auto' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('auto')} className="h-8 rounded-full">Auto Map</Button>
            <Button variant={mode === 'custom' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('custom')} className="h-8 rounded-full">Custom Maps</Button>
          </div>

          {mode === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeMap?.id || ''}
                onChange={(event) => setActiveMapId(event.target.value)}
                className="h-9 rounded-full border border-input bg-background px-4 font-code text-[11px] uppercase tracking-wider shadow-sm appearance-none cursor-pointer"
              >
                {!atlasMaps.length && <option value="">No custom maps</option>}
                {atlasMaps.map((map) => <option key={map.id} value={map.id}>{map.title}</option>)}
              </select>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setIsMapOpen(true)}><Plus className="mr-1.5 size-4" /> Custom Map</Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setIsNodeOpen(true)} disabled={!activeMap}><Plus className="mr-1.5 size-4" /> Add Node</Button>
              {activeMap && (
                <Button variant="ghost" size="sm" onClick={() => onDeleteAtlasMap(activeMap.id)} className="text-destructive hover:text-destructive rounded-full">Delete Map</Button>
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
          <div className="flex min-w-[280px] max-w-[620px] flex-1 items-center justify-end gap-2 rounded-full border border-accent/15 bg-white/92 px-3 py-2 shadow-sm">
            <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Today</div>
            <Badge variant="outline" className="rounded-full bg-muted/20 font-code text-[8px] uppercase tracking-widest">One next action</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate font-headline text-sm font-bold italic leading-none text-primary">{todayPrompt.title}</div>
              <div className="truncate text-[11px] italic leading-4 text-muted-foreground font-body">{todayPrompt.body}</div>
            </div>
            <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">
              {viewMode === 'core' ? 'Core' : viewMode.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">
              {autoConnectionFocus === 'strong' ? 'Strong' : autoConnectionFocus === 'moderate' ? 'Moderate' : 'All'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <Badge variant="outline" className="rounded-full bg-white font-code text-[8px] uppercase tracking-widest text-muted-foreground">Needs Attention</Badge>
          {attentionItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleAttentionItemClick(item)}
              className={cn(
                "flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-left shadow-sm transition-colors",
                item.tone === 'danger' && "border-rose-200 bg-rose-50/90 text-rose-900 hover:bg-rose-100",
                item.tone === 'warning' && "border-amber-200 bg-amber-50/90 text-amber-900 hover:bg-amber-100",
                item.tone === 'notice' && "border-sky-200 bg-sky-50/90 text-sky-900 hover:bg-sky-100"
              )}
            >
              {item.icon === 'conflict' && <AlertTriangle className="size-4 shrink-0" />}
              {item.icon === 'evidence' && <Unlink2 className="size-4 shrink-0" />}
              {item.icon === 'practice' && <FlaskConical className="size-4 shrink-0" />}
              {item.icon === 'concept' && <Link2 className="size-4 shrink-0" />}
              {item.icon === 'inquiry' && <HelpCircle className="size-4 shrink-0" />}
              <span className="flex min-w-0 items-center gap-2">
                <span className="whitespace-nowrap font-code text-[9px] uppercase tracking-widest">{item.title}</span>
                <span className="truncate text-xs italic opacity-80">{item.detail}</span>
              </span>
            </button>
          ))}
          {!attentionItems.length && (
            <span className="text-xs italic text-muted-foreground">Nothing urgent is surfacing in this map yet.</span>
          )}
        </div>
      </div>
      )}

      <div className={cn(
        "flex flex-1 gap-4",
        isFullScreen ? "overflow-hidden px-0 pb-0" : "overflow-visible px-8 pb-5"
      )}>
        <div
          ref={mapRef}
          className={cn(
            "relative flex-1 overflow-hidden border border-border bg-background shadow-inner min-h-[82vh]",
            quickLinkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            isFullScreen ? "rounded-none" : "rounded-xl"
          )}
          onClick={() => {
            if (quickLinkSource) clearQuickLinkMode();
          }}
          onMouseDown={startPanning}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          <div className="absolute right-4 top-4 z-30 flex h-9 rounded-full border border-border/50 bg-white/90 p-1 shadow-md backdrop-blur">
            <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setZoom((z) => Math.max(0.5, z - 0.1)); }} className="h-7 w-7 rounded-full font-bold">-</Button>
            <div className="flex w-10 items-center justify-center font-code text-[10px] font-bold text-primary/60">{Math.round(zoom * 100)}%</div>
            <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setZoom((z) => Math.min(2, z + 0.1)); }} className="h-7 w-7 rounded-full font-bold">+</Button>
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

          {!isMapEmpty && isMapCrowded && (
            <div className="absolute left-4 top-4 z-20 max-w-sm rounded-full border border-border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full bg-card font-code text-[8px] uppercase tracking-widest">Crowded Map</Badge>
                <span className="text-sm italic text-muted-foreground">Showing the strongest connections first.</span>
                <Button size="sm" variant="outline" className="h-7 rounded-full px-3 text-[10px]" onClick={() => setAutoConnectionFocus('all')}>Show More</Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-[10px]" onClick={() => setViewMode('full')}>Switch to Full Map</Button>
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
                const user = edge.type === 'user';
                const concept = edge.type === 'concept';
                const typed = edge.type === 'typed';
                const strength = edge.strength || 'suggested';
                const key = `${edge.from}-${edge.to}-${edge.id || index}`;
                const isHovered = hoveredEdgeId === key;
                const strokeWidth = (strength === 'strong' ? (user ? 4.5 : 4) : strength === 'moderate' ? (typed ? 3 : 2.75) : 1.75) + (isHovered ? 0.85 : 0);
                const strokeOpacity = Math.min(1, (strength === 'strong' ? 0.95 : strength === 'moderate' ? 0.72 : strength === 'weak' ? 0.32 : 0.2) + (isHovered ? 0.15 : 0));
                return (
                  <g key={key}>
                    <line
                      x1={`${points.x1}%`}
                      y1={`${points.y1}%`}
                      x2={`${points.x2}%`}
                      y2={`${points.y2}%`}
                      stroke={edgeStrokeColor(edge)}
                      strokeWidth={strokeWidth}
                      strokeOpacity={strokeOpacity}
                      strokeDasharray={strength === 'suggested' ? '4 8' : user || concept ? '0' : strength === 'weak' ? '3 7' : '6 6'}
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
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        startEdgeHold(edge);
                      }}
                      onMouseUp={cancelEdgeHold}
                      onMouseLeave={() => {
                        cancelEdgeHold();
                        setHoveredEdgeId(null);
                      }}
                      onMouseEnter={() => setHoveredEdgeId(key)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const linkItem = linkItemForEdge(edge);
                        if (linkItem.removable) {
                          setSelectedLink(null);
                          setCutLinkCandidate(linkItem);
                          markLinkInteraction(linkItem);
                        }
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
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
                className="absolute min-w-[140px] -translate-x-1/2 -translate-y-1/2 cursor-grab text-center transition-none active:cursor-grabbing"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedName(node.name);
                }}
                onPointerDown={(event) => {
                  if (quickLinkSource) {
                    event.stopPropagation();
                    if (conceptKey(node.name) === conceptKey(quickLinkSource)) return;
                    setQuickLinkTarget(node.name);
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
                  setSelectedName(node.name);
                  setDraggingName(node.name);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (draggingName === node.name) moveNode(node.name, event.clientX, event.clientY);
                }}
                onPointerUp={() => persistNode(node.name)}
                onPointerCancel={() => setDraggingName(null)}
              >
                <Card className={cn('rounded-xl border-accent/20 bg-white/95 p-3 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl', selectedName === node.name && 'border-accent shadow-2xl ring-2 ring-accent')}>
                  <h3 className="font-headline font-semibold text-primary">{node.name}</h3>
                  <div className="font-code text-[9px] uppercase text-muted-foreground">{node.count} linked</div>
                  {selectedName === node.name && (
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 rounded-full px-2 text-[10px]"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedName(node.name);
                          setIsLinkOpen(true);
                        }}
                      >
                        <Link2 className="mr-1 size-3" /> Quick Link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 rounded-full px-2 text-[10px] text-destructive hover:text-destructive"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (removableNodeLinks.length) {
                            setSelectedName(node.name);
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

        {!isFullScreen && isPanelOpen && (
          <aside className="z-20 flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
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
                      {selectedNodeLinks.map((link) => {
                        const target = conceptKey(link.from) === conceptKey(selectedName) ? link.to : link.from;
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
                                <Badge variant="outline" className="shrink-0 rounded-full bg-card font-code text-[8px] uppercase tracking-widest">{link.kind}</Badge>
                              </div>
                              {link.note && <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">{link.note}</p>}
                            </button>
                            <div className="mt-2 flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openLinkDetail(link)} className="h-7 rounded-full px-3">Details</Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!link.removable}
                                onClick={() => {
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
                      })}

                      {!selectedNodeLinks.length && <p className="text-[10px] italic text-muted-foreground font-body">No links yet.</p>}
                    </div>

                    <div className="hidden">
                      {selectedMapLinks.map((link) => (
                        <Badge key={link.id} variant="secondary" className="flex items-center gap-1 border-accent/20 bg-accent/10 pr-1 font-code text-[9px] uppercase tracking-widest text-accent rounded-full">
                          {conceptKey(link.from) === conceptKey(selectedName) ? link.to : link.from} · {link.label || link.type}
                          <button onClick={() => removeUserLink(link.id)} className="ml-1 transition-colors hover:text-destructive">
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}

                      {selectedTypedLinks.map((link) => (
                        <Badge key={link.id} variant="secondary" className="flex items-center gap-1 border-emerald-200 bg-emerald-50 pr-2 font-code text-[9px] uppercase tracking-widest text-emerald-700 rounded-full">
                          {link.type.replace(/_/g, ' ')} - {link.fromLabel || link.fromType} to {link.toLabel || link.toType}
                        </Badge>
                      ))}

                      {(selectedConcept?.links || []).map((link) => (
                        <Badge key={link} variant="outline" className="flex items-center gap-1 pr-1 font-code text-[9px] uppercase tracking-widest rounded-full">
                          {link}
                          <button onClick={() => removeConceptLink(link)} className="ml-1 transition-colors hover:text-destructive">
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}

                      {!selectedMapLinks.length && !selectedTypedLinks.length && !(selectedConcept?.links?.length) && <p className="text-[10px] italic text-muted-foreground font-body">No links yet.</p>}
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
                        onClick={() => setIsDeleteAllLinksOpen(true)}
                        className="h-8 w-full justify-center rounded-full text-xs text-destructive hover:text-destructive disabled:text-muted-foreground"
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
                <p className="text-sm font-body">Select a concept node to inspect its links, evidence, and outputs.</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {isFullScreen && isPanelOpen && selectedName && atlasPanel}

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
                      updateActiveMap({
                        autoLinkFilters: {
                          ...(activeMap.autoLinkFilters || defaultAutoLinkFilters),
                          sharedSources: false,
                          sharedPositions: false,
                          sharedInquiries: false,
                          sharedWorks: false,
                          sharedPractices: false,
                        },
                      });
                      setSelectedLink(null);
                    }}
                    className="rounded-full px-5"
                  >
                    Turn Off Auto Evidence
                  </Button>
                )}
              </>
            )}
            {selectedLink?.removable && (
              <Button
                variant="destructive"
                onClick={() => {
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

      <Dialog open={!!cutLinkCandidate} onOpenChange={(open) => !open && setCutLinkCandidate(null)}>
        <DialogContent className="max-w-md border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl italic">Delete This Link?</DialogTitle>
          </DialogHeader>
          {cutLinkCandidate && (
            <p className="pt-2 text-sm italic leading-6 text-muted-foreground">
              This removes the relationship between <span className="text-foreground">{cutLinkCandidate.from}</span> and <span className="text-foreground">{cutLinkCandidate.to}</span>. The nodes and their source items stay intact.
            </p>
          )}
          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setCutLinkCandidate(null)} className="rounded-full">Cancel</Button>
            <Button variant="destructive" onClick={() => cutLink(cutLinkCandidate!)} className="rounded-full px-7">Delete Link</Button>
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
                      onOpenPosition?.(position.id);
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

      <Dialog open={isDeleteAllLinksOpen} onOpenChange={setIsDeleteAllLinksOpen}>
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
        if (!open) setQuickLinkTarget(null);
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
                </div>
                <select
                  value={linkDraft.type}
                  onChange={(event) => setLinkDraft((prev) => ({ ...prev, type: event.target.value as AtlasMapLinkType }))}
                  className="h-10 w-full rounded-full border border-border/60 bg-white px-4 text-sm font-body shadow-sm appearance-none"
                >
                  {linkTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
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

const MapIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);
