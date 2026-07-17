
"use client";

import React, { useMemo, useState } from 'react';
import { Download, Copy, ArrowUpDown, ExternalLink, MessageSquare, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { PageEmptyState } from '@/components/shared/PageState';
import type { Draft, Media, MediaStatus, MediaType, Practice, Question, VaultEntry } from '@/lib/types';
import { MEDIA_LABELS, MEDIA_TYPES, conceptKey } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SourceIndexProps {
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  questions: Question[];
  onOpenSource: (sourceId: string) => void;
}

type SourceIndexView = 'table' | 'covers' | 'timeline' | 'influence' | 'domains' | 'unfinished' | 'recent';
type SortKey = 'creator' | 'dateAdded' | 'title' | 'year' | 'influence' | 'annotations' | 'connected' | 'progress';
type AnnotationFilter = 'all' | 'with' | 'without';
type CatalogFilter = 'all' | 'missing_metadata' | 'no_annotations' | 'high_influence' | 'unfinished';

const statuses: MediaStatus[] = ['Want to Read', 'Consuming', 'Finished', 'Paused', 'Abandoned'];
const HIGH_INFLUENCE_SCORE = 10;

function sourceMetadataGaps(m: Media) {
  const identifiers = Object.values(m.externalIds || {}).filter(Boolean);
  const gaps: string[] = [];
  if (!m.creator && !(m.creators || []).length) gaps.push('creator');
  if (!m.year) gaps.push('year');
  if (!m.description) gaps.push('description');
  if (!(m.tags || []).length) gaps.push('concepts');
  if (!m.publisher && !m.platform) gaps.push('publisher/platform');
  if (!m.isbn && !m.doi && !m.url && identifiers.length === 0) gaps.push('identifier');
  return gaps;
}

function sourceCatalogHealth(m: Media) {
  let score = 0;
  if (m.title) score += 10;
  if (m.creator || (m.creators || []).length) score += 15;
  if (m.year) score += 10;
  if (m.description) score += 20;
  if ((m.tags || []).length > 0) score += 20;
  if ((m.annotations || []).length > 0) score += 15;
  if (m.publisher || m.platform || m.isbn || m.doi || m.url || Object.values(m.externalIds || {}).some(Boolean)) score += 10;
  return Math.min(score, 100);
}

export function SourceIndex({ media, vault, drafts, practices, questions, onOpenSource }: SourceIndexProps) {
  const [view, setView] = useState<SourceIndexView>('table');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<MediaType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<MediaStatus | 'all'>('all');
  const [filterConcept, setFilterConcept] = useState<string>('all');
  const [filterAnnotations, setFilterAnnotations] = useState<AnnotationFilter>('all');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  const allConcepts = useMemo(() => {
    const tags = new Set<string>();
    media.forEach(m => (m.tags || []).forEach(tag => tags.add(conceptKey(tag))));
    return Array.from(tags).sort();
  }, [media]);

  const sourceRows = useMemo(() => {
    const scoreSourceInfluence = (m: Media) => {
      const linkedPositions = vault.filter((entry) => (entry.sourceIds || []).includes(m.id)).length;
      const linkedWorks = drafts.filter((draft) => (draft.sourceIds || []).includes(m.id)).length;
      const linkedPractices = practices.filter((practice) => (practice.sourceIds || []).includes(m.id)).length;
      const linkedQuestions = questions.filter((question) => (question.sourceIds || question.evidenceIds || []).includes(m.id)).length;
      const annotationScore = Math.min((m.annotations || []).length, 12);
      const reflectionScore = [
        m.capture?.after?.beliefChange,
        m.capture?.after?.coreArgument,
        m.capture?.after?.remainsUnanswered,
        m.capture?.after?.nextAction,
      ].filter(Boolean).length;
      return annotationScore + linkedPositions * 5 + linkedQuestions * 4 + linkedWorks * 3 + linkedPractices * 4 + reflectionScore * 4;
    };
    const connectedCount = (m: Media) =>
      vault.filter((entry) => (entry.sourceIds || []).includes(m.id)).length +
      drafts.filter((draft) => (draft.sourceIds || []).includes(m.id)).length +
      practices.filter((practice) => (practice.sourceIds || []).includes(m.id)).length +
      questions.filter((question) => (question.sourceIds || question.evidenceIds || []).includes(m.id)).length;
    const progressScore = (m: Media) => {
      if (m.status === 'Finished') return 100;
      if (m.status === 'Consuming') return 65;
      if (m.status === 'Paused') return 45;
      if (m.status === 'Abandoned') return 20;
      return 10;
    };
    const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    return media
      .filter((m) => {
        const typeOk = filterType === 'all' || m.type === filterType;
        const statusOk = filterStatus === 'all' || m.status === filterStatus;
        const conceptOk = filterConcept === 'all' || (m.tags || []).map(conceptKey).includes(filterConcept);
        const annotationOk = filterAnnotations === 'all' || (filterAnnotations === 'with' ? (m.annotations || []).length > 0 : (m.annotations || []).length === 0);
        const unfinishedOk = view !== 'unfinished' || ['Want to Read', 'Consuming', 'Paused'].includes(m.status);
        const recentOk = view !== 'recent' || new Date(m.dateAdded || m.dateUpdated || '').getTime() >= recentCutoff;
        const influence = scoreSourceInfluence(m);
        const influenceOk = view !== 'influence' || influence > 0;
        const metadataGaps = sourceMetadataGaps(m);
        const catalogOk =
          catalogFilter === 'all' ||
          (catalogFilter === 'missing_metadata' && metadataGaps.length > 0) ||
          (catalogFilter === 'no_annotations' && (m.annotations || []).length === 0) ||
          (catalogFilter === 'high_influence' && influence >= HIGH_INFLUENCE_SCORE) ||
          (catalogFilter === 'unfinished' && ['Want to Read', 'Consuming', 'Paused'].includes(m.status));
        const ids = Object.values(m.externalIds || {}).join(' ');
        const query = `${m.title} ${m.creator} ${(m.creators || []).join(' ')} ${m.description || ''} ${m.publisher} ${m.platform} ${m.isbn} ${m.doi} ${m.url} ${m.sourceProvider} ${ids} ${(m.tags || []).join(' ')}`.toLowerCase();
        return typeOk && statusOk && conceptOk && annotationOk && unfinishedOk && recentOk && influenceOk && catalogOk && (!search || query.includes(search.toLowerCase()));
      })
      .map((source) => ({
        source,
        influence: scoreSourceInfluence(source),
        connected: connectedCount(source),
        progress: progressScore(source),
        metadataGaps: sourceMetadataGaps(source),
        health: sourceCatalogHealth(source),
        linkedPositions: vault.filter((entry) => (entry.sourceIds || []).includes(source.id)).length,
        linkedWorks: drafts.filter((draft) => (draft.sourceIds || []).includes(source.id)).length,
        linkedPractices: practices.filter((practice) => (practice.sourceIds || []).includes(source.id)).length,
        linkedQuestions: questions.filter((question) => (question.sourceIds || question.evidenceIds || []).includes(source.id)).length,
      }))
      .sort((a, b) => {
        const numericSorts: Partial<Record<SortKey, [number, number]>> = {
          influence: [a.influence, b.influence],
          annotations: [a.source.annotations?.length || 0, b.source.annotations?.length || 0],
          connected: [a.connected, b.connected],
          progress: [a.progress, b.progress],
        };
        if (numericSorts[sortKey]) {
          const [valA, valB] = numericSorts[sortKey]!;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        const valA = (a.source[sortKey as keyof Media] as string) || '';
        const valB = (b.source[sortKey as keyof Media] as string) || '';
        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [media, search, filterType, filterStatus, filterConcept, filterAnnotations, catalogFilter, sortKey, sortOrder, view, vault, drafts, practices, questions]);

  const filtered = sourceRows.map((row) => row.source);

  const domainRows = useMemo(() => {
    const map = new Map<string, {
      name: string;
      sources: number;
      annotations: number;
      positions: number;
      works: number;
      practices: number;
      questions: number;
      influence: number;
      sourceIds: string[];
    }>();
    sourceRows.forEach((row) => {
      const tags = row.source.tags?.length ? row.source.tags : ['Unsorted'];
      tags.forEach((tag) => {
        const key = conceptKey(tag);
        const current = map.get(key) || {
          name: key,
          sources: 0,
          annotations: 0,
          positions: 0,
          works: 0,
          practices: 0,
          questions: 0,
          influence: 0,
          sourceIds: [],
        };
        current.sources += 1;
        current.annotations += row.source.annotations?.length || 0;
        current.positions += row.linkedPositions;
        current.works += row.linkedWorks;
        current.practices += row.linkedPractices;
        current.questions += row.linkedQuestions;
        current.influence += row.influence;
        current.sourceIds.push(row.source.id);
        map.set(key, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.influence - a.influence || b.sources - a.sources || a.name.localeCompare(b.name));
  }, [sourceRows]);

  const timelineRows = useMemo(() => {
    const map = new Map<string, typeof sourceRows>();
    sourceRows.forEach((row) => {
      const date = row.source.dateAdded || row.source.dateUpdated || '';
      const parsed = new Date(date);
      const key = Number.isFinite(parsed.getTime())
        ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
        : 'Undated';
      map.set(key, [...(map.get(key) || []), row]);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([period, rows]) => ({
        period,
        rows: rows.sort((a, b) => new Date(b.source.dateAdded || b.source.dateUpdated || '').getTime() - new Date(a.source.dateAdded || a.source.dateUpdated || '').getTime()),
        influence: rows.reduce((sum, row) => sum + row.influence, 0),
        annotations: rows.reduce((sum, row) => sum + (row.source.annotations?.length || 0), 0),
      }));
  }, [sourceRows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const copyCitation = (m: Media) => {
    const citation = `${m.creator || 'Unknown'} (${m.year || 'n.d.'}). ${m.title}.${m.publisher ? ` ${m.publisher}.` : ''}`;
    navigator.clipboard.writeText(citation);
    toast({ title: "Citation Copied", description: "APA format ready for manuscript." });
  };

  const copyAllCitations = () => {
    const citations = filtered.map(m => `${m.creator || 'Unknown'} (${m.year || 'n.d.'}). ${m.title}.${m.publisher ? ` ${m.publisher}.` : ''}`).join('\n');
    navigator.clipboard.writeText(citations);
    toast({ title: "Bibliography Copied", description: `${filtered.length} citations exported to clipboard.` });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterStatus('all');
    setFilterConcept('all');
    setFilterAnnotations('all');
    setCatalogFilter('all');
  };

  const filtersActive = Boolean(search || filterType !== 'all' || filterStatus !== 'all' || filterConcept !== 'all' || filterAnnotations !== 'all' || catalogFilter !== 'all');

  return (
    <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-7xl mx-auto w-full font-body">
      <PageHeader
        title="Source Index"
        description="Browse, filter, and manage every source feeding your thinking."
        actions={
          <>
          <Button variant="outline" onClick={copyAllCitations} size="sm" className="h-9 px-6 bg-white border-border/60 shadow-sm rounded-full font-bold uppercase text-[10px] tracking-widest">
            <Copy className="size-4 mr-2" /> COPY BIBLIOGRAPHY
          </Button>
          <Button variant="outline" size="sm" className="h-9 px-6 bg-white border-border/60 shadow-sm rounded-full font-bold uppercase text-[10px] tracking-widest">
            <Download className="size-4 mr-2" /> EXPORT BIBTEX
          </Button>
          </>
        }
      />

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search registry by title, creator, identifiers, concepts..."
        resultCount={filtered.length}
        resultLabel="sources"
        onClear={clearFilters}
        clearDisabled={!filtersActive}
      >
          <Select value={filterType} onValueChange={(v) => setFilterType(v as MediaType | 'all')}>
            <SelectTrigger className="w-40 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-code text-[10px] uppercase">All Types</SelectItem>
              {MEDIA_TYPES.map(t => <SelectItem key={t} value={t} className="font-code text-[10px] uppercase">{MEDIA_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as MediaStatus | 'all')}>
            <SelectTrigger className="w-44 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-code text-[10px] uppercase">All Statuses</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s} className="font-code text-[10px] uppercase">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterConcept} onValueChange={setFilterConcept}>
            <SelectTrigger className="w-48 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="All Concepts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-code text-[10px] uppercase">All Concepts</SelectItem>
              {allConcepts.map(c => <SelectItem key={c} value={c} className="font-code text-[10px] uppercase">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAnnotations} onValueChange={(v) => setFilterAnnotations(v as AnnotationFilter)}>
            <SelectTrigger className="w-48 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="Annotations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-code text-[10px] uppercase">All Annotation States</SelectItem>
              <SelectItem value="with" className="font-code text-[10px] uppercase">Has Annotations</SelectItem>
              <SelectItem value="without" className="font-code text-[10px] uppercase">No Annotations</SelectItem>
            </SelectContent>
          </Select>
          <Select value={catalogFilter} onValueChange={(v) => setCatalogFilter(v as CatalogFilter)}>
            <SelectTrigger className="w-48 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="Catalog State" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-code text-[10px] uppercase">All Catalog States</SelectItem>
              <SelectItem value="missing_metadata" className="font-code text-[10px] uppercase">Missing Metadata</SelectItem>
              <SelectItem value="no_annotations" className="font-code text-[10px] uppercase">No Annotations</SelectItem>
              <SelectItem value="high_influence" className="font-code text-[10px] uppercase">High Influence</SelectItem>
              <SelectItem value="unfinished" className="font-code text-[10px] uppercase">Unfinished Sources</SelectItem>
            </SelectContent>
          </Select>
          <Select value={view} onValueChange={(v) => setView(v as SourceIndexView)}>
            <SelectTrigger className="w-40 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="View" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="table" className="font-code text-[10px] uppercase">Table</SelectItem>
              <SelectItem value="covers" className="font-code text-[10px] uppercase">Covers</SelectItem>
              <SelectItem value="timeline" className="font-code text-[10px] uppercase">Timeline</SelectItem>
              <SelectItem value="influence" className="font-code text-[10px] uppercase">Influence</SelectItem>
              <SelectItem value="domains" className="font-code text-[10px] uppercase">Domains</SelectItem>
              <SelectItem value="unfinished" className="font-code text-[10px] uppercase">Unfinished</SelectItem>
              <SelectItem value="recent" className="font-code text-[10px] uppercase">Recently Added</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-44 h-10 font-code text-[10px] uppercase rounded-full bg-white shadow-sm border-border/60"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dateAdded" className="font-code text-[10px] uppercase">Date Added</SelectItem>
              <SelectItem value="title" className="font-code text-[10px] uppercase">Title</SelectItem>
              <SelectItem value="creator" className="font-code text-[10px] uppercase">Creator</SelectItem>
              <SelectItem value="year" className="font-code text-[10px] uppercase">Year</SelectItem>
              <SelectItem value="influence" className="font-code text-[10px] uppercase">Influence</SelectItem>
              <SelectItem value="annotations" className="font-code text-[10px] uppercase">Annotations</SelectItem>
              <SelectItem value="connected" className="font-code text-[10px] uppercase">Connected</SelectItem>
              <SelectItem value="progress" className="font-code text-[10px] uppercase">Progress</SelectItem>
            </SelectContent>
          </Select>
      </FilterToolbar>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          { label: 'Missing Metadata', value: media.filter((item) => sourceMetadataGaps(item).length > 0).length, note: 'needs catalog cleanup', filter: 'missing_metadata' as CatalogFilter },
          { label: 'Unfinished', value: media.filter((item) => ['Want to Read', 'Consuming', 'Paused'].includes(item.status)).length, note: 'still in study flow', filter: 'unfinished' as CatalogFilter },
          { label: 'No Annotations', value: media.filter((item) => !(item.annotations || []).length).length, note: 'cataloged but not processed', filter: 'no_annotations' as CatalogFilter },
          { label: 'High Influence', value: sourceRows.filter((row) => row.influence >= HIGH_INFLUENCE_SCORE).length, note: 'feeding many objects', filter: 'high_influence' as CatalogFilter },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => setCatalogFilter(catalogFilter === stat.filter ? 'all' : stat.filter)}
            className={cn(
              "rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
              catalogFilter === stat.filter ? "border-accent/50 bg-accent/10 ring-2 ring-accent/15" : "border-border/40 bg-white"
            )}
          >
            <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/60">{stat.label}</div>
            <div className="mt-1 font-headline text-2xl font-bold text-accent">{stat.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{stat.note}</div>
          </button>
        ))}
      </div>

      {view === 'covers' && (
        <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sourceRows.map(({ source: m, influence, connected }) => (
            <button key={m.id} type="button" onClick={() => onOpenSource(m.id)} className="group rounded-xl border border-border/40 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="mb-4 aspect-[3/4] overflow-hidden rounded-lg border border-border/30 bg-muted/20">
                {m.thumbnailUrl ? <img src={m.thumbnailUrl} alt={m.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><Library className="size-10" /></div>}
              </div>
              <div className="font-headline text-xl font-bold italic text-primary group-hover:text-accent">{m.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{m.creator || 'Unknown creator'}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="rounded-full">{m.type}</Badge>
                <Badge variant="outline" className="rounded-full">{influence} influence</Badge>
                <Badge variant="outline" className="rounded-full">{connected} links</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {view === 'domains' && (
        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {domainRows.map((domain) => (
            <button
              key={domain.name}
              type="button"
              onClick={() => {
                setFilterConcept(domain.name);
                setView('table');
              }}
              className="rounded-xl border border-border/40 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Domain</div>
                  <h3 className="mt-1 font-headline text-2xl font-bold italic text-primary">{domain.name}</h3>
                </div>
                <Badge variant="outline" className="rounded-full">{domain.sources} sources</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Influence', domain.influence],
                  ['Notes', domain.annotations],
                  ['Inquiries', domain.questions],
                  ['Positions', domain.positions],
                  ['Works', domain.works],
                  ['Practices', domain.practices],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border/40 bg-background/70 px-3 py-2">
                    <div className="font-headline text-lg font-bold text-accent">{value}</div>
                    <div className="font-code text-[7px] uppercase tracking-widest text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Opens the table filtered to this domain so Source Index stays retrieval-focused.
              </p>
            </button>
          ))}
          {domainRows.length === 0 && (
            <div className="col-span-full">
              <PageEmptyState
                icon={Library}
                title="No source domains yet"
                description="Add concept tags to sources so the catalog can group them by intellectual territory."
              />
            </div>
          )}
        </div>
      )}

      {view === 'timeline' && (
        <div className="mb-8 space-y-6">
          {timelineRows.map((period) => (
            <section key={period.period} className="rounded-xl border border-border/40 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Added Period</div>
                  <h3 className="mt-1 font-headline text-2xl font-bold italic text-primary">{period.period}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full">{period.rows.length} sources</Badge>
                  <Badge variant="outline" className="rounded-full">{period.annotations} annotations</Badge>
                  <Badge variant="outline" className="rounded-full">{period.influence} influence</Badge>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {period.rows.map(({ source, influence, connected }) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => onOpenSource(source.id)}
                    className="rounded-lg border border-border/40 bg-background/70 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground/85">{source.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{source.creator || MEDIA_LABELS[source.type]}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0 rounded-full">{source.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="rounded-full text-[8px]">{influence} influence</Badge>
                      <Badge variant="secondary" className="rounded-full text-[8px]">{connected} links</Badge>
                      <Badge variant="secondary" className="rounded-full text-[8px]">{source.annotations?.length || 0} notes</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {timelineRows.length === 0 && (
            <PageEmptyState
              icon={Library}
              title="No timeline results"
              description="Clear filters or add dated sources to see when material entered your system."
              action={filtersActive ? <Button variant="outline" onClick={clearFilters} className="rounded-full">Clear filters</Button> : undefined}
            />
          )}
        </div>
      )}

      {!['covers', 'domains', 'timeline'].includes(view) && <div className="bg-white rounded-xl border border-border/40 shadow-md overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/5 font-code text-[9px] uppercase tracking-[0.2em] font-bold">
            <TableRow>
              <TableHead className="w-[300px] cursor-pointer" onClick={() => toggleSort('title')}>
                Title <ArrowUpDown className="inline size-3 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('creator')}>
                Author/Creator <ArrowUpDown className="inline size-3 ml-1" />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('year')}>
                Year <ArrowUpDown className="inline size-3 ml-1" />
              </TableHead>
              <TableHead>Identifier/Pub</TableHead>
              <TableHead>Links</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-body text-[14px]">
            {sourceRows.map(({ source: m, influence, connected, progress, metadataGaps, health, linkedPositions, linkedWorks, linkedPractices, linkedQuestions }) => {
              return (
                <TableRow key={m.id} className="hover:bg-muted/5 group transition-colors cursor-pointer" onClick={() => onOpenSource(m.id)}>
                  <TableCell>
                    <div className="font-semibold italic text-primary/90">{m.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(m.tags || []).slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="font-code text-[8px] uppercase tracking-tighter rounded-full bg-muted/20 text-muted-foreground">{tag}</Badge>
                      ))}
                      {metadataGaps.length > 0 && (
                        <Badge variant="outline" className="font-code text-[8px] uppercase tracking-tighter rounded-full border-amber-200 bg-amber-50 text-amber-800">
                          {metadataGaps.length} gaps
                        </Badge>
                      )}
                      {!(m.annotations || []).length && (
                        <Badge variant="outline" className="font-code text-[8px] uppercase tracking-tighter rounded-full border-rose-200 bg-rose-50 text-rose-800">
                          no notes
                        </Badge>
                      )}
                      {influence >= HIGH_INFLUENCE_SCORE && (
                        <Badge variant="outline" className="font-code text-[8px] uppercase tracking-tighter rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">
                          influential
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.creator}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-code text-[8px] uppercase tracking-tighter rounded-full bg-white shadow-sm">{m.type}</Badge>
                  </TableCell>
                  <TableCell className="font-code text-[10px] text-muted-foreground/60">{m.year || '—'}</TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate text-[11px] text-muted-foreground/80" title={m.isbn || m.publisher}>
                      {m.isbn || m.doi || m.publisher || '—'}
                    </div>
                    {metadataGaps.length > 0 && (
                      <div className="mt-1 max-w-[170px] truncate font-code text-[8px] uppercase tracking-widest text-amber-700" title={`Missing: ${metadataGaps.join(', ')}`}>
                        missing {metadataGaps.slice(0, 2).join(', ')}{metadataGaps.length > 2 ? '...' : ''}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[8px] bg-white rounded-full"><MessageSquare className="size-3 mr-1" />{(m.annotations || []).length}</Badge>
                      <Badge variant="outline" className="text-[8px] bg-white rounded-full">{linkedQuestions} inquiries</Badge>
                      <Badge variant="outline" className="text-[8px] bg-white rounded-full">{linkedPositions} positions</Badge>
                      <Badge variant="outline" className="text-[8px] bg-white rounded-full">{linkedWorks} works</Badge>
                      <Badge variant="outline" className="text-[8px] bg-white rounded-full">{linkedPractices} practices</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2" title={`Influence ${influence} · Connected ${connected} · Progress ${progress}%`}>
                      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full transition-all", health > 70 ? "bg-emerald-500" : health > 40 ? "bg-amber-500" : "bg-red-400")} 
                          style={{ width: `${health}%` }} 
                        />
                      </div>
                      <span className="font-code text-[8px] text-muted-foreground">{influence}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={(event) => { event.stopPropagation(); copyCitation(m); }} title="Copy Citation">
                        <Copy className="size-3.5" />
                      </Button>
                      {m.url && (
                        <Button variant="ghost" size="icon" className="size-8 rounded-full" asChild title="Open URL" onClick={(event) => event.stopPropagation()}>
                          <a href={m.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /></a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {sourceRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-8">
                  <PageEmptyState
                    icon={Library}
                    title="No sources match this view"
                    description="Clear filters or search for a different title, creator, identifier, or concept tag."
                    action={filtersActive ? <Button variant="outline" onClick={clearFilters} className="rounded-full">Clear filters</Button> : undefined}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>}
    </div>
  );
}
