"use client";

import React from 'react';
import { AlertTriangle, FlaskConical, HelpCircle, Link2, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AtlasTensionItem, AtlasTensionColumn } from './atlas-diagnostics';

interface AtlasTensionsBoardProps {
  grouped: Record<AtlasTensionColumn, AtlasTensionItem[]>;
  onOpenPosition: (id: string) => void;
  onOpenQuestion: (id: string) => void;
  onOpenConcept: (name: string) => void;
}

const COLUMN_META: Array<{
  id: AtlasTensionColumn;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  { id: 'under_tension', label: 'Under Tension', icon: <Sparkles className="size-4 text-sky-600" />, description: 'Ideas with both support and challenge that need refinement.' },
  { id: 'contradictory', label: 'Contradictory', icon: <ShieldAlert className="size-4 text-rose-600" />, description: 'Conflicting positions that need a judgment call.' },
  { id: 'needs_evidence', label: 'Needs Evidence', icon: <Link2 className="size-4 text-amber-600" />, description: 'Positions that are not supported well enough yet.' },
  { id: 'needs_practice', label: 'Needs Practice', icon: <FlaskConical className="size-4 text-emerald-600" />, description: 'Beliefs that have not touched reality yet.' },
  { id: 'under_challenged', label: 'Under-Challenged', icon: <AlertTriangle className="size-4 text-orange-600" />, description: 'Ideas that need a stronger objection.' },
  { id: 'needs_definition', label: 'Needs Definition', icon: <HelpCircle className="size-4 text-violet-600" />, description: 'Concepts around a belief are still too vague.' },
  { id: 'stale_unused', label: 'Stale / Unused', icon: <Sparkles className="size-4 text-slate-600" />, description: 'Beliefs that have not been revisited recently.' },
];

export function AtlasTensionsBoard({ grouped, onOpenPosition, onOpenQuestion, onOpenConcept }: AtlasTensionsBoardProps) {
  const openItem = (item: AtlasTensionItem) => {
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

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
        <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Tensions</Badge>
        <h2 className="mt-3 font-headline text-3xl font-semibold italic text-foreground">Where does my thinking need work?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          Atlas should create pressure in the right places. This board surfaces the gaps, contradictions, and under-tested ideas that need deliberate attention.
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
        {COLUMN_META.map((column) => (
          <Card key={column.id} className="flex min-h-[280px] flex-col rounded-3xl border border-border/60 bg-card/85 p-4 shadow-sm">
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2">
                {column.icon}
                <h3 className="font-headline text-xl font-semibold italic text-foreground">{column.label}</h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{column.description}</p>
            </div>
            <div className="flex-1 space-y-3">
              {grouped[column.id].length ? grouped[column.id].map((item) => (
                <button key={item.id} type="button" onClick={() => openItem(item)} className="block w-full text-left">
                  <Card className="rounded-2xl border border-border/60 bg-muted/15 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h4 className="font-headline text-lg font-semibold italic text-foreground">{item.title}</h4>
                        <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{item.severity}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-code text-[9px] uppercase tracking-widest text-accent">{item.actionLabel}</span>
                      <Button variant="ghost" size="sm" className="h-8 rounded-full px-3" onClick={(event) => { event.stopPropagation(); openItem(item); }}>
                        Open
                      </Button>
                    </div>
                  </Card>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-4 text-sm italic text-muted-foreground">
                  Nothing in this tension column right now.
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
