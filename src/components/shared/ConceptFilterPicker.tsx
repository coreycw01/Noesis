"use client";

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Concept filter as a searchable dropdown. Long concept vocabularies stay
 * usable, and when the search names a concept that does not exist yet the
 * picker offers to create it (where the page can create concepts).
 */
export function ConceptFilterPicker({ value, options, onChange, onCreate, label = 'Filter by concept', allLabel = 'All concepts', className }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onCreate?: (name: string) => void;
  label?: string;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => options.filter((option) => !needle || option.toLowerCase().includes(needle)).slice(0, 60), [needle, options]);
  const exact = options.some((option) => option.toLowerCase() === needle);
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={label} className={cn('h-9 justify-between gap-2 rounded-full border-border/60 bg-card px-4 noesis-eyebrow shadow-sm', className)}>
          <span className="truncate">{value === 'all' ? allLabel : value}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent data-noesis-select-content align="start" collisionPadding={12} className="w-[min(320px,calc(100vw-2rem))] rounded-xl p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (matches[0]) choose(matches[0]);
              else if (onCreate && needle) { onCreate(query.trim()); choose(query.trim()); }
            }}
            placeholder="Search concepts"
            aria-label="Search concepts"
            className="h-9 rounded-full pl-8 text-sm"
          />
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain" role="listbox" aria-label="Concepts">
          <button type="button" role="option" aria-selected={value === 'all'} onClick={() => choose('all')} className="flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-muted">
            {allLabel}{value === 'all' && <Check className="size-4 text-accent" aria-hidden="true" />}
          </button>
          {matches.map((option) => (
            <button key={option} type="button" role="option" aria-selected={value === option} onClick={() => choose(option)} className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted">
              <span className="truncate">{option}</span>{value === option && <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />}
            </button>
          ))}
          {!matches.length && <p className="px-3 py-2 text-sm text-muted-foreground">No concept matches “{query.trim()}”.</p>}
        </div>
        {onCreate && (
          <div className="mt-1 border-t border-border/60 pt-1">
            <button
              type="button"
              disabled={!needle || exact}
              onClick={() => { onCreate(query.trim()); choose(query.trim()); }}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-accent hover:bg-muted disabled:text-muted-foreground disabled:hover:bg-transparent"
            >
              <Plus className="size-4" aria-hidden="true" />
              {needle && !exact ? <>New concept “{query.trim()}”</> : 'New concept: type a name above'}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
