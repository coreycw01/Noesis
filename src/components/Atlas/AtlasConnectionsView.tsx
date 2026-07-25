"use client";

import { Link2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PhilosophicalLink, PhilosophicalLinkType } from '@/lib/types';

const linkTypes: PhilosophicalLinkType[] = [
  'supports', 'challenges', 'coheres', 'defines', 'refines', 'contradicts',
  'exemplifies', 'inspired_by', 'tested_by', 'expressed_in', 'changed_by',
  'depends_on', 'explains', 'explained_by', 'derived_from', 'references',
  'replaces', 'questions', 'expands', 'weakens', 'strengthens',
];

export function AtlasConnectionsView({
  links,
  onUpdateLink,
  onDeleteLink,
}: {
  links: PhilosophicalLink[];
  onUpdateLink?: (link: PhilosophicalLink) => void;
  onDeleteLink?: (id: string, options?: { method?: string }) => void;
}) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">Relationship registry</Badge>
          <h3 className="mt-2 font-headline text-2xl font-semibold italic text-foreground">Typed connections</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Every row shows its origin, strength, and recorded evidence. Suggested links remain provisional until confirmed.</p>
        </div>
        <div className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{links.length} links</div>
      </div>
      <div className="mt-4 space-y-2">
        {links.map((link) => (
          <div key={link.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 lg:grid-cols-[minmax(0,1fr)_190px_150px_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 shrink-0 text-accent" />
                <span className="truncate font-medium text-foreground">{link.fromLabel || `${link.fromType} ${link.fromId.slice(0, 8)}`}</span>
                <span className="text-muted-foreground">→</span>
                <span className="truncate font-medium text-foreground">{link.toLabel || `${link.toType} ${link.toId.slice(0, 8)}`}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{link.note || 'No supporting note recorded.'}</p>
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
        {!links.length && <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">No confirmed relationships yet. Create links in Map to build this registry.</div>}
      </div>
    </Card>
  );
}
