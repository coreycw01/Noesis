
"use client";

import React from 'react';
import { Plus, ShieldCheck, Filter, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { VaultEntry, VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BeliefVaultProps {
  entries: VaultEntry[];
  onAddEntry: () => void;
  onSelectEntry: (entry: VaultEntry) => void;
}

const typeStyles: Record<VaultType, { bg: string, text: string, icon: string }> = {
  belief: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '●' },
  principle: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '▲' },
  mental_model: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '◈' },
  life_rule: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '◉' },
  worldview: { bg: 'bg-rose-100', text: 'text-rose-700', icon: '✦' },
};

export function BeliefVault({ entries, onAddEntry, onSelectEntry }: BeliefVaultProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
      <header className="flex justify-between items-end mb-12 animate-fade-in-up">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Philosophy Vault</h1>
          <p className="text-muted-foreground italic font-body text-lg">Your repository of explicit principles, claims, and refined mental models.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline"><Filter className="size-4 mr-2" /> Sort & Filter</Button>
          <Button onClick={onAddEntry} className="bg-primary hover:bg-primary/90">
            <Plus className="size-4 mr-2" /> Distill Entry
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entries.map((entry, idx) => (
          <Card 
            key={entry.id} 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden flex flex-col animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.05}s` }}
            onClick={() => onSelectEntry(entry)}
          >
            <div className={cn("h-1 w-full", typeStyles[entry.type].bg.replace('bg-', 'bg-'))} />
            <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <Badge variant="secondary" className={cn("font-code text-[10px] uppercase tracking-wider", typeStyles[entry.type].bg, typeStyles[entry.type].text)}>
                  {typeStyles[entry.type].icon} {entry.type.replace('_', ' ')}
                </Badge>
                <CardTitle className="text-xl font-headline leading-snug group-hover:text-accent transition-colors">
                  {entry.title}
                </CardTitle>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground font-body italic line-clamp-3 mb-6">
                "{entry.statement}"
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div 
                      key={n} 
                      className={cn("size-2 rounded-full", n <= entry.confidence ? "bg-accent" : "bg-muted")} 
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-code text-[10px] uppercase text-muted-foreground">Status</span>
                  <Badge variant="outline" className={cn(
                    "font-code text-[9px] uppercase",
                    entry.status === 'active' && "border-emerald-500 text-emerald-500",
                    entry.status === 'questioning' && "border-amber-500 text-amber-500",
                    entry.status === 'revised' && "border-blue-500 text-blue-500",
                    entry.status === 'abandoned' && "border-slate-500 text-slate-500",
                  )}>
                    {entry.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {entries.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40 grayscale pointer-events-none">
             <ShieldCheck className="size-24 mb-6 text-muted-foreground" />
             <h2 className="text-2xl font-headline italic mb-2">The Vault is Silent</h2>
             <p className="max-w-md font-body">Begin capturing your first belief from reading notes or intellectual reflection. High-confidence principles grow here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
