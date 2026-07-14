"use client";

import React from 'react';
import { AlertTriangle, BrainCircuit, FlaskConical, ShieldAlert, Split, Unlink2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AtlasSystemTensionItem } from './atlas-diagnostics';
import { regionActionDisplay } from './atlas-diagnostics';

interface AtlasTensionsBoardProps {
  tensions: AtlasSystemTensionItem[];
  onOpenRegion: (regionId: string) => void;
}

function iconForTension(type: AtlasSystemTensionItem['type']) {
  switch (type) {
    case 'region_conflict':
      return <ShieldAlert className="size-4 text-rose-600" />;
    case 'concept_ambiguity':
      return <BrainCircuit className="size-4 text-violet-600" />;
    case 'practice_gap':
      return <FlaskConical className="size-4 text-emerald-600" />;
    case 'one_sided_region':
      return <Unlink2 className="size-4 text-amber-600" />;
    default:
      return <AlertTriangle className="size-4 text-muted-foreground" />;
  }
}

export function AtlasTensionsBoard({ tensions, onOpenRegion }: AtlasTensionsBoardProps) {
  const grouped = {
    region_conflict: tensions.filter((item) => item.type === 'region_conflict'),
    concept_ambiguity: tensions.filter((item) => item.type === 'concept_ambiguity'),
    practice_gap: tensions.filter((item) => item.type === 'practice_gap'),
    one_sided_region: tensions.filter((item) => item.type === 'one_sided_region'),
  };

  const columns = [
    {
      id: 'region_conflict' as const,
      title: 'Region Conflicts',
      description: 'Territories whose positions or concepts are pushing against each other.',
    },
    {
      id: 'concept_ambiguity' as const,
      title: 'Concept Ambiguity',
      description: 'Concepts spread across too many territories without a clear center.',
    },
    {
      id: 'practice_gap' as const,
      title: 'Practice Gaps',
      description: 'Territories with beliefs that have not become experiments or habits yet.',
    },
    {
      id: 'one_sided_region' as const,
      title: 'One-Sided Regions',
      description: 'Territories with support and articulation but too little pushback.',
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Tension View</Badge>
            <h2 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">Where is the worldview unstable?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              This view stops looking at single beliefs and starts looking for pressure across the whole map of thought: region conflict, concept ambiguity, practice gaps, and under-challenged territories.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Active tensions</div>
              <div className="mt-2 font-headline text-2xl font-semibold italic text-foreground">{tensions.length}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">High severity</div>
              <div className="mt-2 font-headline text-2xl font-semibold italic text-foreground">{tensions.filter((item) => item.severity === 'high').length}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Cross-region</div>
              <div className="mt-2 font-headline text-2xl font-semibold italic text-foreground">{grouped.region_conflict.length}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {columns.map((column) => (
          <Card key={column.id} className="flex min-h-[320px] flex-col rounded-3xl border border-border/60 bg-card/85 p-4 shadow-sm">
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Split className="size-4 text-foreground" />
                  <h3 className="font-headline text-xl font-semibold italic text-foreground">{column.title}</h3>
                </div>
                <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">
                  {grouped[column.id].length}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{column.description}</p>
            </div>
            <div className="flex-1 space-y-3">
              {grouped[column.id].length ? grouped[column.id].map((item) => (
                <Card key={item.id} className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {iconForTension(item.type)}
                        <h4 className="font-headline text-lg font-semibold italic text-foreground">{item.title}</h4>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{item.severity}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.regionIds.map((regionId) => (
                      <Button key={regionId} variant="outline" size="sm" className="rounded-full" onClick={() => onOpenRegion(regionId)}>
                        Open region
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Recommended next move</div>
                    <div className="mt-2 font-headline text-base font-semibold italic text-foreground">{regionActionDisplay(item.recommendedAction)}</div>
                  </div>
                </Card>
              )) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-4 text-sm italic text-muted-foreground">
                  Nothing in this system tension lane right now.
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
