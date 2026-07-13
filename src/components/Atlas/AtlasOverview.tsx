"use client";

import React from 'react';
import { ArrowRight, BrainCircuit, FlaskConical, HelpCircle, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AtlasOverviewData, AtlasOverviewSectionItem } from './atlas-diagnostics';

interface AtlasOverviewProps {
  overview: AtlasOverviewData;
  onOpenPosition: (id: string) => void;
  onOpenQuestion: (id: string) => void;
  onOpenConcept: (name: string) => void;
  onOpenPractice?: (id: string) => void;
  onOpenTensions: () => void;
}

function OverviewSection({
  title,
  icon,
  items,
  empty,
  accent,
  onItemClick,
  actionLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: AtlasOverviewSectionItem[];
  empty: string;
  accent: string;
  onItemClick: (item: AtlasOverviewSectionItem) => void;
  actionLabel: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${accent}`}>{icon}</span>
        <h3 className="font-headline text-xl font-semibold italic text-foreground">{title}</h3>
      </div>
      {items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onItemClick(item)} className="text-left">
              <Card className="h-full rounded-2xl border border-border/60 bg-card/80 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <h4 className="font-headline text-lg font-semibold italic text-foreground">{item.title}</h4>
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="rounded-full bg-muted/25 font-code text-[9px] uppercase tracking-widest">
                    {item.meta || actionLabel}
                  </Badge>
                  <span className="font-code text-[9px] uppercase tracking-widest text-accent">{actionLabel}</span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-5 text-sm italic text-muted-foreground">
          {empty}
        </Card>
      )}
    </section>
  );
}

export function AtlasOverview({ overview, onOpenPosition, onOpenQuestion, onOpenConcept, onOpenPractice, onOpenTensions }: AtlasOverviewProps) {
  const openItem = (item: AtlasOverviewSectionItem) => {
    if (item.positionId) {
      onOpenPosition(item.positionId);
      return;
    }
    if (item.questionId) {
      onOpenQuestion(item.questionId);
      return;
    }
    if (item.practiceId && onOpenPractice) {
      onOpenPractice(item.practiceId);
      return;
    }
    if (item.conceptName) {
      onOpenConcept(item.conceptName);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Worldview Dashboard</Badge>
            <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">Atlas Default</Badge>
          </div>
          <h2 className="font-headline text-3xl font-semibold italic text-foreground">What is the current state of my worldview?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            Atlas now starts with diagnostics instead of a graph. Use this space to see what is active, what is under pressure, and what part of your thinking needs work next.
          </p>
        </Card>
        <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert className="size-4 text-amber-500" />
            <h3 className="font-headline text-xl font-semibold italic">Current Tensions</h3>
          </div>
          {overview.currentTensions.length ? (
            <div className="space-y-3">
              {overview.currentTensions.slice(0, 3).map((item) => (
                <button key={item.id} type="button" onClick={() => openItem(item)} className="block w-full rounded-2xl border border-border/60 bg-muted/20 p-4 text-left transition-colors hover:border-accent/40 hover:bg-muted/30">
                  <div className="font-headline text-lg font-semibold italic text-foreground">{item.title}</div>
                  <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.subtitle}</div>
                </button>
              ))}
              <Button variant="outline" className="w-full rounded-full" onClick={onOpenTensions}>
                Review all tensions
              </Button>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No urgent tensions are surfacing right now.</p>
          )}
        </Card>
      </div>

      <OverviewSection
        title="Core Positions"
        icon={<ShieldCheck className="size-4 text-sky-700" />}
        items={overview.corePositions}
        empty="No active positions are ready for review yet."
        accent="bg-sky-100"
        actionLabel="Open Position"
        onItemClick={openItem}
      />
      <OverviewSection
        title="Core Concepts"
        icon={<BrainCircuit className="size-4 text-violet-700" />}
        items={overview.coreConcepts}
        empty="No concept regions are developed enough to show here yet."
        accent="bg-violet-100"
        actionLabel="Open Concept"
        onItemClick={openItem}
      />
      <OverviewSection
        title="Active Practices"
        icon={<FlaskConical className="size-4 text-emerald-700" />}
        items={overview.activePractices}
        empty="No practices are actively testing positions yet."
        accent="bg-emerald-100"
        actionLabel="Open Practice"
        onItemClick={openItem}
      />
      <OverviewSection
        title="Weak / Unsupported Areas"
        icon={<TriangleAlert className="size-4 text-amber-700" />}
        items={overview.weakAreas}
        empty="Nothing looks especially weak right now."
        accent="bg-amber-100"
        actionLabel="Resolve"
        onItemClick={openItem}
      />
      <OverviewSection
        title="Untested Beliefs"
        icon={<FlaskConical className="size-4 text-sky-700" />}
        items={overview.untestedBeliefs}
        empty="Every major position currently has a linked practice."
        accent="bg-sky-100"
        actionLabel="Link Practice"
        onItemClick={openItem}
      />
      <OverviewSection
        title="Recently Changed Ideas"
        icon={<Sparkles className="size-4 text-rose-700" />}
        items={overview.recentChanges}
        empty="No recent shifts have been recorded yet."
        accent="bg-rose-100"
        actionLabel="View Change"
        onItemClick={openItem}
      />
      <OverviewSection
        title="Suggested Next Questions"
        icon={<HelpCircle className="size-4 text-orange-700" />}
        items={overview.suggestedNextQuestions}
        empty="No open next questions are waiting right now."
        accent="bg-orange-100"
        actionLabel="Open Inquiry"
        onItemClick={openItem}
      />
    </div>
  );
}
