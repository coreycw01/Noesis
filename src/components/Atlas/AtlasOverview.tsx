"use client";

import React from 'react';
import { AlertTriangle, ArrowRight, BrainCircuit, FlaskConical, HelpCircle, ShieldCheck, Sparkles, TriangleAlert, Unlink2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AtlasOverviewData, AtlasOverviewSectionItem } from './atlas-diagnostics';

interface AtlasOverviewProps {
  overview: AtlasOverviewData;
  todayPrompt: {
    title: string;
    body: string;
  };
  attentionItems: Array<{
    id: string;
    title: string;
    detail: string;
    tone: 'danger' | 'warning' | 'notice';
    icon: 'conflict' | 'evidence' | 'practice' | 'concept' | 'inquiry';
    positionId?: string;
    questionId?: string;
    conceptName?: string;
  }>;
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

export function AtlasOverview({
  overview,
  todayPrompt,
  attentionItems,
  onOpenPosition,
  onOpenQuestion,
  onOpenConcept,
  onOpenPractice,
  onOpenTensions,
}: AtlasOverviewProps) {
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

  const openAttention = (item: AtlasOverviewProps['attentionItems'][number]) => {
    if (item.positionId) {
      onOpenPosition(item.positionId);
      return;
    }
    if (item.questionId) {
      onOpenQuestion(item.questionId);
      return;
    }
    if (item.conceptName) {
      onOpenConcept(item.conceptName);
    }
  };

  const overviewStats = [
    { label: 'Core positions', value: overview.corePositions.length },
    { label: 'Live tensions', value: overview.currentTensions.length },
    { label: 'Active practices', value: overview.activePractices.length },
    { label: 'Weak areas', value: overview.weakAreas.length },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Worldview Dashboard</Badge>
            <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">Atlas Default</Badge>
          </div>
          <h2 className="font-headline text-3xl font-semibold italic text-foreground">What is the current state of my worldview?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            Atlas now starts with diagnostics instead of a graph. Use this space to see what is active, what is under pressure, and what part of your thinking needs work next.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overviewStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">{stat.label}</div>
                <div className="mt-2 font-headline text-2xl font-semibold italic text-foreground">{stat.value}</div>
              </div>
            ))}
          </div>
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

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">One Next Action</Badge>
            <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">Deterministic</Badge>
          </div>
          <h3 className="mt-4 font-headline text-2xl font-semibold italic text-foreground">{todayPrompt.title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{todayPrompt.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={onOpenTensions}>Open Tensions</Button>
            <Button variant="outline" className="rounded-full" onClick={() => overview.suggestedNextQuestions[0] && openItem(overview.suggestedNextQuestions[0])} disabled={!overview.suggestedNextQuestions.length}>
              Open next inquiry
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => overview.weakAreas[0] && openItem(overview.weakAreas[0])} disabled={!overview.weakAreas.length}>
              Open weakest position
            </Button>
          </div>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <h3 className="font-headline text-xl font-semibold italic">Needs Attention</h3>
            </div>
            <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">
              {attentionItems.length} highlighted
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {attentionItems.length ? attentionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                title={`${item.title}: ${item.detail}`}
                onClick={() => openAttention(item)}
                className={[
                  'group flex min-w-[150px] flex-1 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg',
                  item.tone === 'danger' ? 'border-rose-300/80 bg-rose-50/90 text-rose-800' : '',
                  item.tone === 'warning' ? 'border-amber-300/80 bg-amber-50/90 text-amber-800' : '',
                  item.tone === 'notice' ? 'border-sky-300/80 bg-sky-50/90 text-sky-800' : '',
                ].join(' ')}
              >
                <span className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-[0_0_18px_rgba(255,255,255,0.18)] ring-1 ring-current/10',
                  item.tone === 'danger' ? 'bg-rose-100 animate-pulse' : '',
                  item.tone === 'warning' ? 'bg-amber-100 animate-pulse' : '',
                  item.tone === 'notice' ? 'bg-sky-100 animate-pulse' : '',
                ].join(' ')}>
                  {item.icon === 'conflict' && <AlertTriangle className="size-4" />}
                  {item.icon === 'evidence' && <Unlink2 className="size-4" />}
                  {item.icon === 'practice' && <FlaskConical className="size-4" />}
                  {item.icon === 'concept' && <BrainCircuit className="size-4" />}
                  {item.icon === 'inquiry' && <HelpCircle className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-headline text-base font-semibold italic text-foreground">{item.title}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-current/80">{item.detail}</span>
                </span>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-4 py-5 text-sm italic text-muted-foreground">
                Nothing urgent is being flagged right now.
              </div>
            )}
          </div>
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
