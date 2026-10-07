"use client";

import { useMemo, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Concept, PhilosophicalLink, PhilosophicalLinkType } from '@/lib/types';

const linkTypes: PhilosophicalLinkType[] = [
  'supports', 'challenges', 'coheres', 'defines', 'refines', 'contradicts',
  'exemplifies', 'inspired_by', 'tested_by', 'expressed_in', 'changed_by',
  'depends_on', 'explains', 'explained_by', 'derived_from', 'references',
  'replaces', 'questions', 'expands', 'weakens', 'strengthens',
];

export function AtlasConnectionsView({
  links,
  concepts,
  regionConceptIds,
  regionObjectIds,
  regionName,
  onUpdateLink,
  onDeleteLink,
}: {
  links: PhilosophicalLink[];
  concepts: Concept[];
  regionConceptIds: string[];
  regionObjectIds: string[];
  regionName?: string;
  onUpdateLink?: (link: PhilosophicalLink) => void;
  onDeleteLink?: (id: string, options?: { method?: string }) => void;
}) {
  const [scope, setScope] = useState<'region' | 'all'>('region');
  const [conceptId, setConceptId] = useState('all');
  const [relationship, setRelationship] = useState('all');
  const [direction, setDirection] = useState('either');
  const [visibleCount, setVisibleCount] = useState(25);
  const availableConcepts = useMemo(() => concepts.filter((concept) => scope === 'all' || regionConceptIds.includes(concept.id)), [concepts, regionConceptIds, scope]);
  const focusedConceptId = conceptId === 'all' || availableConcepts.some((concept) => concept.id === conceptId) ? conceptId : 'all';
  const filteredLinks = useMemo(() => links.filter((link) => {
    const inRegion = regionObjectIds.includes(link.fromId) || regionObjectIds.includes(link.toId);
    if (scope === 'region' && regionObjectIds.length && !inRegion) return false;
    if (focusedConceptId !== 'all') {
      if (direction === 'outgoing' && link.fromId !== focusedConceptId) return false;
      if (direction === 'incoming' && link.toId !== focusedConceptId) return false;
      if (direction === 'either' && link.fromId !== focusedConceptId && link.toId !== focusedConceptId) return false;
    }
    return relationship === 'all' || link.type === relationship;
  }), [links, regionObjectIds, scope, focusedConceptId, direction, relationship]);

  return (
    <Card className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">Relationship registry</Badge>
          <h3 className="mt-2 font-headline text-2xl font-semibold italic text-foreground">Typed connections</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Every row shows its origin, strength, and recorded evidence. Suggested links remain provisional until confirmed.</p>
        </div>
        <div className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{filteredLinks.length} of {links.length} links</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Select value={scope} onValueChange={(value) => { setScope(value as 'region' | 'all'); setConceptId('all'); setVisibleCount(25); }}>
          <SelectTrigger aria-label="Connection scope"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="region">{regionName ? `${regionName} region` : 'Selected region'}</SelectItem><SelectItem value="all">All regions</SelectItem></SelectContent>
        </Select>
        <Select value={focusedConceptId} onValueChange={(value) => { setConceptId(value); setVisibleCount(25); }}>
          <SelectTrigger aria-label="Filter connections by concept"><SelectValue placeholder="All concepts" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All concepts</SelectItem>{availableConcepts.map((concept) => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={relationship} onValueChange={(value) => { setRelationship(value); setVisibleCount(25); }}>
          <SelectTrigger aria-label="Filter by relationship"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Every relationship</SelectItem>{linkTypes.map((type) => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={direction} onValueChange={setDirection} disabled={focusedConceptId === 'all'}>
          <SelectTrigger aria-label="Filter by direction"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="either">Either direction</SelectItem><SelectItem value="outgoing">From this concept</SelectItem><SelectItem value="incoming">To this concept</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="mt-4 space-y-2">
        {filteredLinks.slice(0, visibleCount).map((link) => (
          <div key={link.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 lg:grid-cols-[minmax(0,1fr)_190px_150px_auto] lg:items-center">
            <div className="min-w-0">
              <div className="grid gap-2" aria-label="Connection endpoints">
                <div className="flex min-w-0 items-start gap-2">
                  <Link2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">From</div>
                    <div className="break-words font-medium leading-5 text-foreground">{link.fromLabel || `${link.fromType} ${link.fromId.slice(0, 8)}`}</div>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-2 pl-6">
                  <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">→</span>
                  <div className="min-w-0">
                    <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">To</div>
                    <div className="break-words font-medium leading-5 text-foreground">{link.toLabel || `${link.toType} ${link.toId.slice(0, 8)}`}</div>
                  </div>
                </div>
              </div>
              <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{link.note || 'No supporting note recorded.'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full text-[9px] uppercase">{link.createdFrom}</Badge>
                {link.createdFrom === 'suggestion' && <Badge variant="outline" className="rounded-full text-[9px] uppercase">{link.acceptedByUser ? 'confirmed' : 'needs review'}</Badge>}
              </div>
            </div>
            <Select value={link.type} onValueChange={(type) => onUpdateLink?.({ ...link, type: type as PhilosophicalLinkType })}>
              <SelectTrigger aria-label="Relationship type"><SelectValue /></SelectTrigger>
              <SelectContent>{linkTypes.map((type) => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={link.connectionStrength || 'moderate'} onValueChange={(connectionStrength) => onUpdateLink?.({ ...link, connectionStrength: connectionStrength as PhilosophicalLink['connectionStrength'] })}>
              <SelectTrigger aria-label="Relationship strength"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="strong">Strong</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="weak">Weak</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" aria-label="Delete relationship" className="text-destructive hover:text-destructive" onClick={() => onDeleteLink?.(link.id, { method: 'connections-registry' })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {!filteredLinks.length && <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">No relationships match these filters. Try another concept or show all regions.</div>}
        {filteredLinks.length > visibleCount && <Button variant="outline" onClick={() => setVisibleCount((count) => count + 25)}>Show more relationships</Button>}
      </div>
    </Card>
  );
}
