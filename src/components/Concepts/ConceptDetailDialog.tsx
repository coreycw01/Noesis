'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { conceptRelated, MEDIA_ICONS_COMP } from '@/lib/readex';
import type { Concept, Draft, Media, Practice, Question, TimelineEvent, VaultEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ConceptDetailDialog({ name, onClose, concepts, media, vault, drafts, questions, timeline, practices }: {
  name: string | null;
  onClose: () => void;
  concepts: Concept[];
  media: Media[];
  vault: VaultEntry[];
  drafts: Draft[];
  questions: Question[];
  timeline: TimelineEvent[];
  practices: Practice[];
}) {
  const [activeTab, setActiveTab] = useState('sources');
  const related = useMemo(() => name ? conceptRelated(name, { media, insights: [], vault, drafts, questions, timeline, practices }) : null, [name, media, vault, drafts, questions, timeline, practices]);

  if (!name || !related) return null;

  const tabs = [
    { id: 'sources', label: 'SOURCES', count: related.sources.length },
    { id: 'notes', label: 'NOTES', count: related.annotations.length },
    { id: 'questions', label: 'QUESTIONS', count: related.questions.length },
    { id: 'beliefs', label: 'BELIEFS', count: related.beliefs.length },
    { id: 'writing', label: 'WRITING', count: related.drafts.length },
    { id: 'practices', label: 'PRACTICES', count: related.practices.length },
    { id: 'evolution', label: 'EVOLUTION', count: related.events.length },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'sources':
        return (
          <div className="space-y-4">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">INPUTS: SOURCES</h4>
            {related.sources.map(s => (
              <Card key={s.id} className="p-5 bg-card border-border/40 flex gap-5 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <div className="size-12 rounded-lg bg-muted/20 flex items-center justify-center shrink-0 shadow-inner">
                  {React.createElement(MEDIA_ICONS_COMP[s.type] || BookOpen, { className: "size-6 text-accent/40" })}
                </div>
                <div>
                  <h5 className="font-headline font-bold text-xl leading-tight text-primary">{s.title}</h5>
                  <p className="text-xs font-body italic text-muted-foreground mt-1">{s.creator} · {s.type}</p>
                </div>
              </Card>
            ))}
            {related.sources.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked sources discovered.</p>}
          </div>
        );
      case 'notes':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">INPUTS: ANNOTATIONS</h4>
            {related.annotations.map((a, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl">
                <Badge variant="outline" className="mb-3 noesis-eyebrow noesis-eyebrow--sm border-border/60 shadow-sm bg-card rounded-full font-bold">{a.type}</Badge>
                <p className="font-body italic text-base text-primary/90 leading-relaxed">&quot;{a.text}&quot;</p>
              </Card>
            ))}
            {related.annotations.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked annotations discovered.</p>}
          </div>
        );
      case 'beliefs':
        const items = related.beliefs;
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">{activeTab.toUpperCase()}</h4>
            {items.map((item, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <h5 className="font-headline font-bold text-xl italic mb-3 text-primary leading-tight">{item.title}</h5>
                <p className="font-body text-base text-muted-foreground leading-relaxed italic">{item.description || item.statement || ''}</p>
              </Card>
            ))}
            {items.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked items discovered.</p>}
          </div>
        );
      case 'questions':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">INQUIRIES</h4>
            {related.questions.map((q, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl">
                <p className="font-headline font-bold italic text-lg leading-relaxed text-primary">&quot;{q.text}&quot;</p>
                {q.answer && <p className="font-body text-base text-muted-foreground mt-4 border-t border-border/20 pt-4 italic leading-relaxed">{q.answer}</p>}
              </Card>
            ))}
            {related.questions.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked inquiries discovered.</p>}
          </div>
        );
      case 'writing':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">WORKS</h4>
            {related.drafts.map((d, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-headline font-bold text-xl italic text-primary leading-tight">{d.title}</h5>
                  <Badge variant="outline" className="text-[9px] border-border/60 bg-card shadow-sm rounded-full font-bold uppercase tracking-widest">{d.status}</Badge>
                </div>
                <p className="text-[10px] font-code opacity-50 uppercase font-bold tracking-widest">{d.type}</p>
              </Card>
            ))}
            {related.drafts.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked works discovered.</p>}
          </div>
        );
      case 'practices':
        return (
          <div className="space-y-5">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">PRACTICES</h4>
            {related.practices.map((practice, i) => (
              <Card key={i} className="p-6 bg-card border-border/40 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-headline font-bold text-xl italic text-primary leading-tight">{practice.title}</h5>
                  <Badge variant="outline" className="text-[9px] border-border/60 bg-card shadow-sm rounded-full font-bold uppercase tracking-widest">{practice.status}</Badge>
                </div>
                <p className="font-body text-sm text-muted-foreground italic leading-relaxed">{practice.description || practice.type}</p>
              </Card>
            ))}
            {related.practices.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked practices discovered.</p>}
          </div>
        );
      case 'evolution':
        return (
          <div className="space-y-6">
            <h4 className="readex-kicker opacity-50 font-bold text-[10px]">EVOLUTION</h4>
            {related.events.map((e, i) => (
              <div key={i} className="flex gap-5 items-start border-l-2 border-accent/20 pl-6 py-2 transition-colors hover:border-accent">
                <div className="pt-2">
                   <div className="size-2.5 rounded-full bg-accent shadow-sm" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-headline font-bold text-lg italic text-primary">{e.entityTitle}</h5>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">{e.eventType}: {e.reason}</p>
                  <time className="text-[10px] font-code opacity-40 font-bold uppercase tracking-widest">{new Date(e.date).toLocaleDateString()}</time>
                </div>
              </div>
            ))}
            {related.events.length === 0 && <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked evolution events discovered.</p>}
          </div>
        );
      default:
        return <p className="text-sm italic text-muted-foreground text-center py-12 font-body">No linked content discovered for this filter.</p>;
    }
  };

  return (
    <Dialog open={!!name} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-background font-body">
        <div className="p-10">
          <DialogHeader className="mb-10">
            <DialogTitle className="text-5xl font-headline italic mb-2 text-primary/90 leading-tight">{name}</DialogTitle>
            <DialogDescription>Records connected to this concept.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2.5 mb-10 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-5 py-2 rounded-full border transition-all noesis-eyebrow font-bold flex items-center gap-2 shadow-sm",
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground border-accent shadow-md"
                    : "bg-card text-muted-foreground border-border/60 hover:border-accent/40"
                )}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold",
                    activeTab === tab.id ? "bg-card/20 text-white" : "bg-muted/50 text-muted-foreground/60"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Separator className="bg-border/30 mb-10" />

          <ScrollArea className="h-[380px] pr-5">
            {renderContent()}
          </ScrollArea>
        </div>

        <div className="p-8 pt-4 bg-muted/5 border-t border-border/20 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close Audit</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
