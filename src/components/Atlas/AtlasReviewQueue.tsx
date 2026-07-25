"use client";

import { AlertTriangle, Check, Clock3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AtlasRegionViewModel } from './atlas-diagnostics';
import type { Concept, PhilosophicalLink, PhilosophicalObjectType } from '@/lib/types';

export function AtlasReviewQueue({
  concepts,
  regions,
  links,
  knownIds,
  onUpdateConcept,
  onUpdateLink,
  onDeleteLink,
}: {
  concepts: Concept[];
  regions: AtlasRegionViewModel[];
  links: PhilosophicalLink[];
  knownIds: Partial<Record<PhilosophicalObjectType, Set<string>>>;
  onUpdateConcept: (concept: Concept) => void;
  onUpdateLink?: (link: PhilosophicalLink) => void;
  onDeleteLink?: (id: string, options?: { method?: string }) => void;
}) {
  const groupedConceptIds = new Set(regions.flatMap((region) => region.conceptIds));
  const ungrouped = concepts.filter((concept) => !groupedConceptIds.has(concept.id) && concept.atlasReviewStatus !== 'rejected');
  const suggested = links.filter((link) => link.createdFrom === 'suggestion' && link.acceptedByUser !== false);
  const broken = links.filter((link) => !knownIds[link.fromType]?.has(link.fromId) || !knownIds[link.toType]?.has(link.toId));
  const count = ungrouped.length + suggested.length + broken.length;

  return (
    <Card className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-widest">Review queue</Badge>
          <h2 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">Structures awaiting your judgment</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Automatic organization stays provisional. Confirm, defer, reject, or clean up each item here.</p>
        </div>
        <div className="font-headline text-3xl font-semibold text-foreground">{count}</div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <ReviewLane title="Ungrouped concepts" count={ungrouped.length}>
          {ungrouped.map((concept) => (
            <ReviewItem key={concept.id} title={concept.name} detail="This confirmed concept does not yet meet the evidence threshold for a region.">
              <Button size="sm" variant="outline" onClick={() => onUpdateConcept({ ...concept, atlasReviewStatus: 'deferred' })}><Clock3 className="mr-1 size-3" /> Defer</Button>
              <Button size="sm" variant="ghost" onClick={() => onUpdateConcept({ ...concept, atlasReviewStatus: 'rejected' })}>Hide suggestion</Button>
            </ReviewItem>
          ))}
        </ReviewLane>
        <ReviewLane title="Suggested links" count={suggested.length}>
          {suggested.map((link) => (
            <ReviewItem key={link.id} title={`${link.fromLabel || link.fromType} → ${link.toLabel || link.toType}`} detail={link.note || link.type.replace(/_/g, ' ')}>
              <Button size="sm" onClick={() => onUpdateLink?.({ ...link, acceptedByUser: true })}><Check className="mr-1 size-3" /> Confirm</Button>
              <Button size="sm" variant="outline" onClick={() => onUpdateLink?.({ ...link, acceptedByUser: false })}>Reject</Button>
            </ReviewItem>
          ))}
        </ReviewLane>
        <ReviewLane title="Broken references" count={broken.length}>
          {broken.map((link) => (
            <ReviewItem key={link.id} title={`${link.fromLabel || link.fromType} → ${link.toLabel || link.toType}`} detail="One endpoint no longer exists in this workspace.">
              <Button size="sm" variant="destructive" onClick={() => onDeleteLink?.(link.id, { method: 'broken-reference-review' })}><Trash2 className="mr-1 size-3" /> Remove link</Button>
            </ReviewItem>
          ))}
        </ReviewLane>
      </div>
    </Card>
  );
}

function ReviewLane({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border/60 bg-background/60 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-headline text-lg font-semibold italic">{title}</h3><Badge variant="outline">{count}</Badge></div><div className="space-y-3">{children}{!count && <p className="text-sm italic text-muted-foreground">Nothing needs review.</p>}</div></div>;
}

function ReviewItem({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border/50 bg-card p-3"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><div><div className="font-medium text-foreground">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{children}</div></div>;
}
