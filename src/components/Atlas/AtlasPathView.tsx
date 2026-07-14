"use client";

import React from 'react';
import { Compass, Workflow } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AtlasPathRecommendation } from './atlas-diagnostics';
import { regionActionDisplay } from './atlas-diagnostics';

interface AtlasPathViewProps {
  recommendations: AtlasPathRecommendation[];
  onOpenRegion: (regionId: string) => void;
  onOpenPosition?: (id: string) => void;
  onOpenQuestion?: (id: string) => void;
  onOpenSource?: (id: string) => void;
  onOpenWriting?: () => void;
  onOpenPractices?: () => void;
}

export function AtlasPathView({
  recommendations,
  onOpenRegion,
  onOpenPosition,
  onOpenQuestion,
  onOpenSource,
  onOpenWriting,
  onOpenPractices,
}: AtlasPathViewProps) {
  const openRecommendation = (item: AtlasPathRecommendation) => {
    if (item.targetType === 'position' && item.targetId) {
      onOpenPosition?.(item.targetId);
      return;
    }
    if (item.targetType === 'inquiry' && item.targetId) {
      onOpenQuestion?.(item.targetId);
      return;
    }
    if (item.targetType === 'source' && item.targetId) {
      onOpenSource?.(item.targetId);
      return;
    }
    if (item.targetType === 'work') {
      onOpenWriting?.();
      return;
    }
    if (item.targetType === 'practice') {
      onOpenPractices?.();
      return;
    }
    if (item.regionIds[0]) {
      onOpenRegion(item.regionIds[0]);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
        <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Path View</Badge>
        <h2 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">Where should the mind go next?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          These are guided routes through the atlas, built from deterministic region diagnostics. Path View should point toward the next useful move, not just admire the current map.
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {recommendations.map((item) => (
          <Card key={item.id} className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Compass className="size-4 text-accent" />
                  <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">
                    {item.regionNames.join(' + ')}
                  </Badge>
                </div>
                <h3 className="font-headline text-2xl font-semibold italic text-foreground">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.reason}</p>
              </div>
              <Workflow className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Exact next move</div>
              <div className="mt-2 font-headline text-lg font-semibold italic text-foreground">{regionActionDisplay(item.nextAction)}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={() => openRecommendation(item)}>
                Open path
              </Button>
              {item.regionIds.map((regionId) => (
                <Button key={regionId} variant="outline" className="rounded-full" onClick={() => onOpenRegion(regionId)}>
                  Open region
                </Button>
              ))}
            </div>
          </Card>
        ))}
        {!recommendations.length && (
          <Card className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm italic text-muted-foreground xl:col-span-2">
            Atlas does not have enough pressure signals yet to generate a path.
          </Card>
        )}
      </div>
    </div>
  );
}
