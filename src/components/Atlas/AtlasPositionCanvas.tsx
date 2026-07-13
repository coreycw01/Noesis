"use client";

import React from 'react';
import { BrainCircuit, FlaskConical, HelpCircle, Library, PenTool, RefreshCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AtlasHealthRow } from './atlas-diagnostics';

interface AtlasPositionCanvasProps {
  row: AtlasHealthRow | null;
  onOpenConcept: (name: string) => void;
  onOpenQuestion: (id: string) => void;
  onOpenPractice?: (id: string) => void;
  onOpenDraft?: (id: string) => void;
  onBackToHealth: () => void;
}

function CanvasGroup({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="font-headline text-xl font-semibold italic text-foreground">{title}</h3>
      </div>
      {children || (
        <p className="text-sm italic text-muted-foreground">{empty || 'Nothing linked yet.'}</p>
      )}
    </Card>
  );
}

export function AtlasPositionCanvas({ row, onOpenConcept, onOpenQuestion, onOpenPractice, onOpenDraft, onBackToHealth }: AtlasPositionCanvasProps) {
  if (!row) {
    return (
      <Card className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
        <h2 className="font-headline text-3xl font-semibold italic text-foreground">Position Canvas</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">Choose a position from Overview, Idea Health, or Tensions to inspect what it is built on, what challenges it, and what should happen to it next.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-accent font-code text-[9px] uppercase tracking-[0.18em]">Position Canvas</Badge>
              <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{row.position.status}</Badge>
              <Badge variant="outline" className="rounded-full font-code text-[9px] uppercase tracking-widest">{row.healthLabel}</Badge>
            </div>
            <h2 className="font-headline text-3xl font-semibold italic text-foreground">{row.position.title}</h2>
            <p className="max-w-4xl text-base leading-7 text-muted-foreground">{row.position.statement || row.position.description || 'No position statement yet.'}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full">Confidence {row.position.confidenceScore ?? row.position.confidence ?? 0}%</Badge>
              <Badge variant="outline" className="rounded-full">{row.supportCount} support</Badge>
              <Badge variant="outline" className="rounded-full">{row.challengeCount} challenge</Badge>
              <Badge variant="outline" className="rounded-full">Evidence {row.evidenceQuality}</Badge>
              <Badge variant="outline" className="rounded-full">Last revised {new Date(row.lastRevised || row.position.dateUpdated).toLocaleDateString()}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={onBackToHealth}>
              Back to Health
            </Button>
            <Button className="rounded-full">Revise Position</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <CanvasGroup title="Key Concepts" icon={<BrainCircuit className="size-4 text-violet-600" />}>
          <div className="flex flex-wrap gap-2">
            {row.linkedConcepts.length ? row.linkedConcepts.map((concept) => (
              <Button key={concept.id} variant="outline" size="sm" className="rounded-full" onClick={() => onOpenConcept(concept.name)}>
                {concept.name}
              </Button>
            )) : <p className="text-sm italic text-muted-foreground">No concepts are linked yet.</p>}
          </div>
        </CanvasGroup>
        <CanvasGroup title="Supporting Evidence" icon={<Library className="size-4 text-emerald-600" />}>
          <div className="space-y-2">
            {(row.position.evidenceFor || []).length ? row.position.evidenceFor?.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 p-3 text-sm leading-6 text-muted-foreground">{item}</div>
            )) : <p className="text-sm italic text-muted-foreground">No supporting evidence is linked yet.</p>}
          </div>
        </CanvasGroup>
        <CanvasGroup title="Challenging Evidence" icon={<TriangleAlert className="size-4 text-rose-600" />}>
          <div className="space-y-2">
            {(row.position.evidenceAgainst || []).length ? row.position.evidenceAgainst?.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 p-3 text-sm leading-6 text-muted-foreground">{item}</div>
            )) : <p className="text-sm italic text-muted-foreground">No serious objection has been attached yet.</p>}
          </div>
        </CanvasGroup>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <CanvasGroup title="Source Evidence" icon={<Library className="size-4 text-emerald-700" />}>
          <div className="space-y-2">
            {row.supportSources.length ? row.supportSources.map((source) => (
              <div key={source.id} className="rounded-2xl border border-border/60 bg-muted/15 p-3">
                <div className="font-headline text-lg font-semibold italic text-foreground">{source.title}</div>
                <div className="text-sm text-muted-foreground">{source.creator || source.publisher || source.url || 'Linked source'}</div>
              </div>
            )) : <p className="text-sm italic text-muted-foreground">No source objects are attached yet.</p>}
          </div>
        </CanvasGroup>
        <CanvasGroup title="Practices / Tests" icon={<FlaskConical className="size-4 text-sky-600" />}>
          <div className="space-y-2">
            {row.linkedPractices.length ? row.linkedPractices.map((practice) => (
              <button key={practice.id} type="button" className="block w-full rounded-2xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-accent/40" onClick={() => onOpenPractice?.(practice.id)}>
                <div className="font-headline text-lg font-semibold italic text-foreground">{practice.title}</div>
                <div className="text-sm text-muted-foreground">{practice.description || practice.notes || 'No practice note yet.'}</div>
              </button>
            )) : <p className="text-sm italic text-muted-foreground">No linked practice is testing this position yet.</p>}
          </div>
        </CanvasGroup>
        <CanvasGroup title="Open Questions" icon={<HelpCircle className="size-4 text-orange-600" />}>
          <div className="space-y-2">
            {row.linkedQuestions.length ? row.linkedQuestions.map((question) => (
              <button key={question.id} type="button" className="block w-full rounded-2xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-accent/40" onClick={() => onOpenQuestion(question.id)}>
                <div className="font-headline text-lg font-semibold italic text-foreground">{question.text}</div>
                <div className="text-sm text-muted-foreground">{question.answer || 'Still open.'}</div>
              </button>
            )) : <p className="text-sm italic text-muted-foreground">No inquiry is currently attached to this position.</p>}
          </div>
        </CanvasGroup>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <CanvasGroup title="Works Expressing It" icon={<PenTool className="size-4 text-fuchsia-600" />}>
          <div className="space-y-2">
            {row.linkedDrafts.length ? row.linkedDrafts.map((draft) => (
              <button key={draft.id} type="button" className="block w-full rounded-2xl border border-border/60 bg-muted/15 p-3 text-left transition-colors hover:border-accent/40" onClick={() => onOpenDraft?.(draft.id)}>
                <div className="font-headline text-lg font-semibold italic text-foreground">{draft.title}</div>
                <div className="text-sm text-muted-foreground">{draft.status} - {draft.type}</div>
              </button>
            )) : <p className="text-sm italic text-muted-foreground">No work is currently expressing this position.</p>}
          </div>
        </CanvasGroup>
        <CanvasGroup title="AI Critique" icon={<Sparkles className="size-4 text-amber-500" />}>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Use this surface for the strongest objection, hidden assumptions, and suggested practice tests when AI critique is available.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full">Challenge Position</Button>
              <Button variant="outline" size="sm" className="rounded-full">Find Assumption</Button>
              <Button variant="outline" size="sm" className="rounded-full">Suggest Practice</Button>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Next pressure point</div>
              <div className="mt-2 font-headline text-lg font-semibold italic text-foreground">{row.nextAction}</div>
              <div className="mt-1 text-sm text-muted-foreground">This is the strongest deterministic next move based on current support, challenge, practice, and revision signals.</div>
            </div>
          </div>
        </CanvasGroup>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <CanvasGroup title="Revision History" icon={<RefreshCcw className="size-4 text-slate-600" />}>
          <div className="space-y-2">
            {(row.position.versionHistory || []).length ? row.position.versionHistory?.map((version, index) => (
              <div key={`${version.date}-${index}`} className="rounded-2xl border border-border/60 bg-muted/15 p-3">
                <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">{version.eventType || 'revision'} - {new Date(version.date).toLocaleDateString()}</div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">{version.description}</div>
                {version.reason && <div className="mt-2 text-xs italic text-muted-foreground">Reason: {version.reason}</div>}
              </div>
            )) : <p className="text-sm italic text-muted-foreground">No revision history has been recorded yet.</p>}
          </div>
        </CanvasGroup>
        <CanvasGroup title="Decision Pressure" icon={<TriangleAlert className="size-4 text-rose-500" />}>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Health label</div>
              <div className="mt-2 font-headline text-lg font-semibold italic text-foreground">{row.healthLabel}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Tension level</div>
              <div className="mt-2 font-headline text-lg font-semibold italic text-foreground">{row.tensionLevel}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-3">
              <div className="font-code text-[9px] uppercase tracking-widest text-muted-foreground">Next move</div>
              <div className="mt-2 font-headline text-lg font-semibold italic text-foreground">{row.nextAction}</div>
            </div>
          </div>
        </CanvasGroup>
      </div>
    </div>
  );
}
