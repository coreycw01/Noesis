"use client";

import { useMemo, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Concept, PhilosophicalLink, PhilosophicalLinkType, PhilosophicalObjectType } from '@/lib/types';
import { filterAtlasConnections } from './atlas-connection-filters';

const linkTypes: PhilosophicalLinkType[] = [
  'supports', 'challenges', 'coheres', 'defines', 'refines', 'contradicts',
  'exemplifies', 'inspired_by', 'tested_by', 'expressed_in', 'changed_by',
  'depends_on', 'explains', 'explained_by', 'derived_from', 'references',
  'replaces', 'questions', 'expands', 'weakens', 'strengthens',
];

export function AtlasConnectionsView({
  links,
  concepts,
  regionMembers,
  regionName,
  onUpdateLink,
  onDeleteLink,
}: {
  links: PhilosophicalLink[];
  concepts: Concept[];
  regionMembers?: Partial<Record<PhilosophicalObjectType, readonly string[]>>;
  regionName?: string;
  onUpdateLink?: (link: PhilosophicalLink) => void;
  onDeleteLink?: (id: string, options: { method: string }, opener: HTMLButtonElement) => void;
}) {
  const [scope, setScope] = useState<'region' | 'all'>('region');
  const [conceptId, setConceptId] = useState('all');
  const [relationship, setRelationship] = useState('all');
  const [direction, setDirection] = useState('either');
  const [visibleCount, setVisibleCount] = useState(25);
  const conceptNames = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept.name])), [concepts]);
  const endpointLabel = (id: string, type: string, label?: string) =>
    (type === 'concept' && conceptNames.get(id)) || label?.trim() || `Unnamed ${type}`;
  const activeScope = regionMembers ? scope : 'all';
  const members = activeScope === 'region' ? regionMembers : undefined;
  const availableConcepts = useMemo(() => concepts.filter((concept) => !members || members.concept?.includes(concept.id)), [concepts, members]);
  const focusedConceptId = conceptId === 'all' || availableConcepts.some((concept) => concept.id === conceptId) ? conceptId : 'all';
  const filteredLinks = useMemo(() => filterAtlasConnections(links, {
    members, conceptId: focusedConceptId, direction, relationship,
  }), [links, members, focusedConceptId, direction, relationship]);

  return (
    <Card className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">Relationship registry</Badge>
          <h3 className="mt-2 font-headline text-2xl font-semibold italic text-foreground">Typed connections</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Each row shows its origin and recorded evidence. Map rank affects visibility; it does not measure evidence quality.</p>
        </div>
        <div role="status" className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{filteredLinks.length} of {links.length} links</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Select value={activeScope} onValueChange={(value) => { setScope(value as 'region' | 'all'); setConceptId('all'); setVisibleCount(25); }}>
          <SelectTrigger aria-label="Connection scope"><SelectValue /></SelectTrigger>
          <SelectContent>{regionMembers && <SelectItem value="region">{regionName ? `${regionName} region` : 'Selected region'}</SelectItem>}<SelectItem value="all">All connections</SelectItem></SelectContent>
        </Select>
        <Select value={focusedConceptId} onValueChange={(value) => { setConceptId(value); setVisibleCount(25); }}>
          <SelectTrigger aria-label="Filter connections by concept"><SelectValue placeholder="All concepts" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All concepts</SelectItem>{availableConcepts.map((concept) => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={relationship} onValueChange={(value) => { setRelationship(value); setVisibleCount(25); }}>
          <SelectTrigger aria-label="Filter by relationship"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Every relationship</SelectItem>{linkTypes.map((type) => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={focusedConceptId === 'all' ? 'either' : direction} onValueChange={(value) => { setDirection(value); setVisibleCount(25); }} disabled={focusedConceptId === 'all'}>
          <SelectTrigger aria-label="Filter by direction"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="either">Either direction</SelectItem><SelectItem value="outgoing">From this concept</SelectItem><SelectItem value="incoming">To this concept</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="mt-4 space-y-2">
        {filteredLinks.slice(0, visibleCount).map((link) => {
          const from = endpointLabel(link.fromId, link.fromType, link.fromLabel);
          const to = endpointLabel(link.toId, link.toType, link.toLabel);
          const endpoints = `${from} to ${to}`;
          return (
          <div key={link.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 lg:grid-cols-[minmax(0,1fr)_190px_150px_auto] lg:items-center">
            <div className="min-w-0">
              <div className="grid gap-2" aria-label="Connection endpoints">
                <div className="flex min-w-0 items-start gap-2">
                  <Link2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">From</div>
                    <div className="break-words font-medium leading-5 text-foreground">{from}</div>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-2 pl-6">
                  <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">→</span>
                  <div className="min-w-0">
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">To</div>
                    <div className="break-words font-medium leading-5 text-foreground">{to}</div>
                  </div>
                </div>
              </div>
              <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{link.note || 'No supporting note recorded.'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full text-[9px] uppercase">{link.createdFrom}</Badge>
                {link.createdFrom === 'suggestion' && <Badge variant="outline" className="rounded-full text-[9px] uppercase">{link.acceptedByUser ? 'confirmed' : 'needs review'}</Badge>}
              </div>
            </div>
            <Select value={link.type} disabled={!onUpdateLink} onValueChange={(type) => onUpdateLink?.({ ...link, type: type as PhilosophicalLinkType })}>
              <SelectTrigger aria-label={`Relationship type: ${endpoints}`}><SelectValue /></SelectTrigger>
              <SelectContent>{linkTypes.map((type) => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">Map rank: <span className="text-foreground">{link.connectionStrength || 'Unranked'}</span></div>
            <Button variant="ghost" size="icon" aria-label={`Remove relationship: ${endpoints}`} title="Remove relationship" disabled={!onDeleteLink} className="size-11 text-destructive hover:text-destructive" onClick={(event) => onDeleteLink?.(link.id, { method: 'connections-registry' }, event.currentTarget)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          );
        })}
        {!filteredLinks.length && <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">No relationships match these filters. Try another concept or show all connections.</div>}
        {filteredLinks.length > visibleCount && <Button variant="outline" onClick={() => setVisibleCount((count) => count + 25)}>Show more relationships</Button>}
      </div>
    </Card>
  );
}
