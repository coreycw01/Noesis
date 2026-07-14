"use client";

import React from 'react';
import { ArrowRight, BrainCircuit, FlaskConical, HelpCircle, MapPinned, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AtlasRegionLabel, AtlasRegionViewModel, AtlasTerritoryCard } from './atlas-diagnostics';
import { regionActionDisplay, regionLabelDisplay } from './atlas-diagnostics';
import type { Concept, Draft, Media, Practice, Question, VaultEntry } from '@/lib/types';

interface AtlasTerritoryViewProps {
  cards: AtlasTerritoryCard[];
  regions: AtlasRegionViewModel[];
  selectedRegionId: string | null;
  concepts: Concept[];
  positions: VaultEntry[];
  practices: Practice[];
  questions: Question[];
  drafts: Draft[];
  media: Media[];
  onSelectRegion: (regionId: string) => void;
  onOpenMap: (regionId: string) => void;
  onOpenPosition?: (id: string) => void;
  onOpenQuestion?: (id: string) => void;
  onOpenSource?: (id: string) => void;
  onOpenConcept?: (name: string) => void;
}

function toneForLabel(label: AtlasRegionLabel) {
  if (label === 'tension-heavy') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (label === 'under-tested' || label === 'practice-poor') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (label === 'rapidly-evolving') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (label === 'evidence-rich' || label === 'heavily-developed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-border/60 bg-muted/20 text-muted-foreground';
}

export function AtlasTerritoryView({
  cards,
  regions,
  selectedRegionId,
  concepts,
  positions,
  practices,
  questions,
  drafts,
  media,
  onSelectRegion,
  onOpenMap,
  onOpenPosition,
  onOpenQuestion,
  onOpenSource,
  onOpenConcept,
}: AtlasTerritoryViewProps) {
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) || regions[0] || null;
  const regionPositions = positions.filter((item) => selectedRegion?.positionIds.includes(item.id));
  const regionQuestions = questions.filter((item) => selectedRegion?.inquiryIds.includes(item.id));
  const regionPractices = practices.filter((item) => selectedRegion?.practiceIds.includes(item.id));
  const regionWorks = drafts.filter((item) => selectedRegion?.workIds.includes(item.id));
  const regionSources = media.filter((item) => selectedRegion?.sourceIds.includes(item.id));
  const regionConcepts = concepts.filter((item) => selectedRegion?.conceptIds.includes(item.id));

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Territory View</Badge>
            <h2 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">What territories define my current thought-world?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              Atlas is now reading the shape of your philosophy as regions, not isolated beliefs. Open a territory to see its concepts, pressures, practices, and where it wants to grow next.
            </p>
          </div>
          {selectedRegion && (
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={() => onOpenMap(selectedRegion.id)}>
                <MapPinned className="mr-2 size-4" />
                Open in Map
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <button key={card.id} type="button" className="text-left" onClick={() => onSelectRegion(card.id)}>
              <Card className={`h-full rounded-3xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${selectedRegion?.id === card.id ? 'border-accent/50 bg-accent/5' : 'border-border/60 bg-card/85'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-headline text-2xl font-semibold italic text-foreground">{card.name}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.labels.slice(0, 3).map((label) => (
                    <Badge key={label} variant="outline" className={`rounded-full font-code text-[9px] uppercase tracking-widest ${toneForLabel(label)}`}>
                      {regionLabelDisplay(label)}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Positions</div>
                    <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{card.stats.positions}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Practices</div>
                    <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{card.stats.practices}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Inquiries</div>
                    <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{card.stats.inquiries}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                    <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Tensions</div>
                    <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{card.stats.tensions}</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Suggested next move</div>
                  <div className="mt-2 font-headline text-lg font-semibold italic text-foreground">{card.nextAction ? regionActionDisplay(card.nextAction) : 'Keep exploring'}</div>
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
          {selectedRegion ? (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Region Detail</Badge>
                  <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">
                    {selectedRegion.maturityStatus}
                  </Badge>
                </div>
                <h3 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">{selectedRegion.name}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{selectedRegion.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Dominant concepts</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedRegion.dominantConcepts.length ? selectedRegion.dominantConcepts.map((name) => (
                      <button key={name} type="button" onClick={() => onOpenConcept?.(name)} className="rounded-full border border-border/60 bg-card px-3 py-1 font-code text-[10px] uppercase tracking-widest text-foreground transition-colors hover:border-accent hover:text-accent">
                        {name}
                      </button>
                    )) : <span className="text-sm italic text-muted-foreground">No dominant concepts yet.</span>}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                  <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Signals</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedRegion.labels.map((label) => (
                      <Badge key={label} variant="outline" className={`rounded-full font-code text-[9px] uppercase tracking-widest ${toneForLabel(label)}`}>
                        {regionLabelDisplay(label)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="size-4 text-violet-600" />
                    <h4 className="font-headline text-lg font-semibold italic text-foreground">Positions</h4>
                  </div>
                  {regionPositions.slice(0, 3).map((position) => (
                    <button key={position.id} type="button" onClick={() => onOpenPosition?.(position.id)} className="block w-full rounded-2xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-accent/40">
                      <div className="font-headline text-base font-semibold italic text-foreground">{position.title}</div>
                      <div className="line-clamp-2 text-sm text-muted-foreground">{position.statement || position.description}</div>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="size-4 text-orange-600" />
                    <h4 className="font-headline text-lg font-semibold italic text-foreground">Open Inquiries</h4>
                  </div>
                  {regionQuestions.slice(0, 3).map((question) => (
                    <button key={question.id} type="button" onClick={() => onOpenQuestion?.(question.id)} className="block w-full rounded-2xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-accent/40">
                      <div className="font-headline text-base font-semibold italic text-foreground">{question.text}</div>
                      <div className="text-sm text-muted-foreground">{question.answer || 'Still unresolved.'}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <FlaskConical className="size-4 text-emerald-600" />
                    <div className="font-headline text-base font-semibold italic text-foreground">Practices</div>
                  </div>
                  <div className="space-y-2">
                    {regionPractices.slice(0, 3).map((practice) => (
                      <div key={practice.id} className="text-sm text-muted-foreground">{practice.title}</div>
                    ))}
                    {!regionPractices.length && <div className="text-sm italic text-muted-foreground">No active practices here yet.</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="size-4 text-fuchsia-600" />
                    <div className="font-headline text-base font-semibold italic text-foreground">Works</div>
                  </div>
                  <div className="space-y-2">
                    {regionWorks.slice(0, 3).map((draft) => (
                      <div key={draft.id} className="text-sm text-muted-foreground">{draft.title}</div>
                    ))}
                    {!regionWorks.length && <div className="text-sm italic text-muted-foreground">No works express this territory yet.</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TriangleAlert className="size-4 text-amber-600" />
                    <div className="font-headline text-base font-semibold italic text-foreground">Sources</div>
                  </div>
                  <div className="space-y-2">
                    {regionSources.slice(0, 3).map((source) => (
                      <button key={source.id} type="button" onClick={() => onOpenSource?.(source.id)} className="block text-left text-sm text-muted-foreground transition-colors hover:text-accent">
                        {source.title}
                      </button>
                    ))}
                    {!regionSources.length && <div className="text-sm italic text-muted-foreground">No sources anchor this territory yet.</div>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm italic text-muted-foreground">
              No territories are available yet.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
