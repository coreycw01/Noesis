"use client";

import React from 'react';
import { ArrowRight, BrainCircuit, FlaskConical, HelpCircle, MapPinned, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AtlasRegionLabel, AtlasRegionViewModel, AtlasTerritoryCard } from './atlas-diagnostics';
import { regionActionDisplay, regionLabelDisplay } from './atlas-diagnostics';
import type { Concept, Draft, Media, Practice, Question, VaultEntry } from '@/lib/types';
import { openNoesisObjectPreview } from '@/lib/noesis-object-preview';

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

  const previewConcept = (name: string) => {
    const concept = concepts.find((item) => item.name.toLowerCase() === name.toLowerCase());
    openNoesisObjectPreview({
      id: `atlas-concept-${concept?.id || name}`,
      label: name,
      section: 'Concept',
      description: concept?.description || 'Open this concept from the Atlas territory.',
      view: 'concepts',
      targetId: concept?.id || null,
      targetType: concept?.id ? 'concept' : undefined,
      objectType: 'Interpretive Object',
      kind: 'object',
      intellectualStage: 'Interpret',
      hierarchyLevel: 'Interpretive',
      currentState: concept?.philosophyStatus || 'concept',
      summary: concept?.description || 'A dominant concept shaping this territory.',
      matchedBecause: `This concept is one of the dominant terms in ${selectedRegion?.name || 'the selected territory'}.`,
      connectedConcepts: concept?.links || selectedRegion?.dominantConcepts || [],
      relatedObjects: [
        `${regionPositions.length} regional positions`,
        `${regionQuestions.length} regional inquiries`,
        `${regionSources.length} regional sources`,
      ],
      lastChangedAt: concept?.dateUpdated || concept?.dateCreated || selectedRegion?.lastActiveAt,
      quickActionLabel: 'Open Concept',
      quickActions: [
        { label: 'Open Concept', view: 'concepts', targetId: concept?.id || null, targetType: concept?.id ? 'concept' : undefined },
        { label: 'Open Territory Map', view: 'atlas' },
      ],
      thinkingEventHint: 'Previewing a concept is orientation. Redefining, merging, splitting, or materially relinking it should create the thinking event.',
    });
  };

  const previewPosition = (position: VaultEntry) => {
    openNoesisObjectPreview({
      id: `atlas-position-${position.id}`,
      label: position.title || position.statement,
      section: 'Position',
      description: position.status || 'Open position workbench.',
      view: 'vault',
      targetId: position.id,
      targetType: 'position',
      objectType: 'Judgment Object',
      kind: 'object',
      intellectualStage: 'Judge',
      hierarchyLevel: 'Judgment',
      currentState: position.status,
      summary: position.statement || position.description || 'A position shaping this territory.',
      matchedBecause: `This position belongs to the ${selectedRegion?.name || 'selected'} territory through concepts, evidence, or links.`,
      connectedConcepts: position.tags || selectedRegion?.dominantConcepts || [],
      relatedObjects: [
        `${position.sourceIds?.length || 0} linked sources`,
        `${(position.evidenceFor || []).length} supports`,
        `${(position.evidenceAgainst || []).length} challenges`,
      ],
      lastChangedAt: position.dateUpdated || position.dateCreated || selectedRegion?.lastActiveAt,
      quickActionLabel: 'Open Position',
      quickActions: [
        { label: 'Open Position Workbench', view: 'vault', targetId: position.id, targetType: 'position' },
        { label: 'Open Region Map', view: 'atlas' },
      ],
      thinkingEventHint: 'Previewing a position is orientation. Support, challenge, confidence changes, stress tests, abandonment, and revision should create events.',
    });
  };

  const previewInquiry = (question: Question) => {
    openNoesisObjectPreview({
      id: `atlas-inquiry-${question.id}`,
      label: question.text,
      section: 'Inquiry',
      description: question.status || 'Open inquiry workspace.',
      view: 'questions',
      targetId: question.id,
      targetType: 'inquiry',
      objectType: 'Interpretive Object',
      kind: 'object',
      intellectualStage: 'Question',
      hierarchyLevel: 'Interpretive',
      currentState: question.status,
      summary: question.answer || 'An unresolved question in this territory.',
      matchedBecause: `This inquiry contributes uncertainty inside ${selectedRegion?.name || 'the selected territory'}.`,
      connectedConcepts: selectedRegion?.dominantConcepts || [],
      relatedObjects: [
        `${question.sourceIds?.length || 0} linked sources`,
        `${question.beliefIds?.length || 0} linked positions`,
        `${question.draftIds?.length || 0} linked works`,
      ],
      lastChangedAt: question.dateUpdated || question.dateCreated || selectedRegion?.lastActiveAt,
      quickActionLabel: 'Open Inquiry',
      quickActions: [
        { label: 'Open Investigation', view: 'questions', targetId: question.id, targetType: 'inquiry' },
        { label: 'Open Region Map', view: 'atlas' },
      ],
      thinkingEventHint: 'Previewing an inquiry is orientation. Reformulating, adding assumptions, resolving, or promoting it should create history.',
    });
  };

  const previewSource = (source: Media) => {
    openNoesisObjectPreview({
      id: `atlas-source-${source.id}`,
      label: source.title,
      section: 'Source',
      description: source.creator || source.type || 'Open source workspace.',
      view: 'library',
      targetId: source.id,
      targetType: 'source',
      objectType: 'Raw Input',
      kind: 'object',
      intellectualStage: 'Encounter',
      hierarchyLevel: 'Raw',
      currentState: source.status,
      summary: source.description || source.capture?.after?.coreArgument || source.capture?.before?.openQuestion || 'A source feeding this territory.',
      matchedBecause: `This source anchors ${selectedRegion?.name || 'the selected territory'} through concepts, annotations, or positions.`,
      connectedConcepts: source.tags || selectedRegion?.dominantConcepts || [],
      relatedObjects: [
        `${source.annotations?.length || 0} annotations`,
        `${regionPositions.filter((position) => (position.sourceIds || []).includes(source.id)).length} regional positions influenced`,
      ],
      lastChangedAt: source.dateUpdated || source.dateAdded || selectedRegion?.lastActiveAt,
      quickActionLabel: 'Open Source',
      quickActions: [
        { label: 'Open Source Workspace', view: 'library', targetId: source.id, targetType: 'source' },
        { label: 'Process Annotations', view: 'annotations' },
      ],
      thinkingEventHint: 'Previewing a source is orientation. Completing reflection, distilling a claim, or creating annotations should record intellectual development.',
    });
  };

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
                      <button key={name} type="button" onClick={() => previewConcept(name)} className="rounded-full border border-border/60 bg-card px-3 py-1 font-code text-[10px] uppercase tracking-widest text-foreground transition-colors hover:border-accent hover:text-accent">
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
                    <button key={position.id} type="button" onClick={() => previewPosition(position)} className="block w-full rounded-2xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-accent/40">
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
                    <button key={question.id} type="button" onClick={() => previewInquiry(question)} className="block w-full rounded-2xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-accent/40">
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
                      <button key={source.id} type="button" onClick={() => previewSource(source)} className="block text-left text-sm text-muted-foreground transition-colors hover:text-accent">
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
