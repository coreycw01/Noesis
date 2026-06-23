"use client";

import React, { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SourceLinkerProps {
  media: Media[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  label?: string;
  className?: string;
}

export function SourceLinker({ media, selectedIds, onToggle, label = "Linked Sources", className }: SourceLinkerProps) {
  const [search, setSearch] = useState('');
  const selected = media.filter(m => selectedIds.includes(m.id));
  const filtered = media.filter(m => 
    !search || 
    m.title.toLowerCase().includes(search.toLowerCase()) || 
    m.creator?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 font-code text-[10px] uppercase tracking-wider">
              <Plus className="size-3 mr-1" /> Add Source
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b">
              <Input 
                placeholder="Search library..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs font-body"
              />
            </div>
            <ScrollArea className="h-64">
              <div className="p-2 space-y-1">
                {filtered.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onToggle(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                        isSelected ? "bg-accent/10" : "hover:bg-muted"
                      )}
                    >
                      <div className={cn("size-4 rounded border flex items-center justify-center shrink-0 transition-colors", isSelected ? "bg-accent border-accent text-white" : "border-input")}>
                        {isSelected && <Check className="size-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-headline font-semibold italic truncate">{item.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate uppercase font-code tracking-tighter">{item.creator}</div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground italic">No sources matching your search</div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex flex-wrap gap-1.5 min-h-[42px] p-2 rounded-md border border-dashed border-border bg-muted/5 items-start">
        {selected.length > 0 ? (
          selected.map((item) => (
            <Badge key={item.id} variant="secondary" className="flex items-center gap-1 font-body text-[11px] py-0.5 bg-white border-accent/20">
              <span className="max-w-[150px] truncate italic">{item.title}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onToggle(item.id); }} 
                className="hover:text-destructive transition-colors ml-1"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-[11px] text-muted-foreground italic px-1 py-1">No scholarly sources linked yet...</span>
        )}
      </div>
    </div>
  );
}