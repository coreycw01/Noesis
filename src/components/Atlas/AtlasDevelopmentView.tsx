"use client";

import React from 'react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { AtlasDevelopmentBucket } from './atlas-diagnostics';
import { regionActionDisplay, regionLabelDisplay } from './atlas-diagnostics';

interface AtlasDevelopmentViewProps {
  buckets: AtlasDevelopmentBucket[];
  onOpenRegion: (regionId: string) => void;
}

export function AtlasDevelopmentView({ buckets, onOpenRegion }: AtlasDevelopmentViewProps) {
  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
        <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Development View</Badge>
        <h2 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">Where is the worldview deep, thin, stale, or growing fast?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          This is the maturity and imbalance surface for Atlas. Use it to see which territories are carrying your philosophy, which ones are neglected, and where the next real investment should go.
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {buckets.map((bucket) => (
          <Card key={bucket.id} className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-foreground" />
                <h3 className="font-headline text-2xl font-semibold italic text-foreground">{bucket.title}</h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{bucket.description}</p>
            </div>
            <div className="space-y-3">
              {bucket.regions.map((region) => (
                <button key={region.id} type="button" onClick={() => onOpenRegion(region.id)} className="block w-full text-left">
                  <Card className="rounded-2xl border border-border/60 bg-muted/15 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h4 className="font-headline text-lg font-semibold italic text-foreground">{region.name}</h4>
                        <p className="text-sm leading-6 text-muted-foreground">{region.description}</p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {region.labels.slice(0, 3).map((label) => (
                        <Badge key={label} variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">
                          {regionLabelDisplay(label)}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                        <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Positions</div>
                        <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{region.activePositionsCount}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                        <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Recent activity</div>
                        <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{region.recentActivityCount}</div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                      <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Next move</div>
                      <div className="mt-2 font-headline text-base font-semibold italic text-foreground">{region.suggestedNextActions[0] ? regionActionDisplay(region.suggestedNextActions[0]) : 'Keep exploring'}</div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
