"use client";

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchMatches } from '@/lib/search';
import { cn } from '@/lib/utils';

export interface EntityPickerItem {
  id: string;
  label: string;
  secondary?: string;
  searchText?: string[];
}

interface EntityPickerProps {
  items: EntityPickerItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  label?: string;
  triggerLabel?: string;
  searchPlaceholder?: string;
  emptySelectedLabel?: string;
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
  compact?: boolean;
  className?: string;
}

export function EntityPicker({
  items,
  selectedIds,
  onToggle,
  label,
  triggerLabel = 'Add item',
  searchPlaceholder = 'Search...',
  emptySelectedLabel = 'Nothing linked yet.',
  onCreate,
  createLabel = (query) => `Create "${query}"`,
  compact,
  className,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputId = useId();
  const listId = useId();
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const filtered = useMemo(() => items.filter((item) => searchMatches(query, [
    { value: item.label, label: 'name' },
    { value: item.secondary, label: 'detail' },
    ...(item.searchText || []).map((value) => ({ value, label: 'related' })),
  ])), [items, query]);
  const normalizedQuery = query.trim();
  const canCreate = Boolean(onCreate && normalizedQuery && !items.some((item) => item.label.toLowerCase() === normalizedQuery.toLowerCase()));

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const selectActiveItem = () => {
    const item = filtered[activeIndex];
    if (item) {
      onToggle(item.id);
      return;
    }
    if (canCreate) {
      onCreate?.(normalizedQuery);
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        {label && <label className="text-sm font-medium leading-none">{label}</label>}
        <Popover open={open} onOpenChange={setOpen} modal>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('h-8 rounded-full border-dashed px-3 font-code text-[9px] uppercase tracking-widest', compact && 'h-7 px-2')}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Plus className="mr-1.5 size-3" /> {triggerLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="z-[100] w-[min(22rem,calc(100vw-2rem))] p-0"
            align="end"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="border-b border-border/50 p-2">
              <label htmlFor={inputId} className="sr-only">{searchPlaceholder}</label>
              <Input
                id={inputId}
                autoFocus
                value={query}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveIndex((index) => filtered.length ? (index + 1) % filtered.length : 0);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex((index) => filtered.length ? (index - 1 + filtered.length) % filtered.length : 0);
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    selectActiveItem();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setQuery('');
                    setOpen(false);
                  }
                }}
                placeholder={searchPlaceholder}
                className="h-9 rounded-full text-xs"
              />
            </div>
            <div className="sr-only" aria-live="polite">
              {filtered.length} result{filtered.length === 1 ? '' : 's'} available
            </div>
            <ScrollArea className="h-64">
              <div id={listId} role="listbox" aria-label={searchPlaceholder} className="space-y-1 p-2">
                {filtered.map((item, index) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      id={`${listId}-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-pressed={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        onToggle(item.id);
                      }}
                      onClick={(event) => event.preventDefault()}
                      className={cn('flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40', index === activeIndex && 'bg-muted/70', isSelected && 'bg-accent/10 text-accent')}
                    >
                      <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', isSelected ? 'border-accent bg-accent text-accent-foreground' : 'border-input')}>
                        {isSelected && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-headline font-semibold italic">{item.label}</span>
                        {item.secondary && <span className="block truncate font-code text-[9px] uppercase tracking-wider text-muted-foreground">{item.secondary}</span>}
                      </span>
                    </button>
                  );
                })}
                {filtered.length === 0 && !canCreate && (
                  <div className="p-4 text-center text-xs italic text-muted-foreground">No items match “{normalizedQuery}”.</div>
                )}
                {canCreate && (
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      onCreate?.(normalizedQuery);
                      setQuery('');
                      setOpen(false);
                    }}
                    onClick={(event) => event.preventDefault()}
                    className="flex w-full items-center gap-2 rounded-lg border-t border-border/50 p-2 text-left text-accent hover:bg-accent/10"
                  >
                    <Plus className="size-3" />
                    <span className="font-code text-[10px] uppercase tracking-wider">{createLabel(normalizedQuery)}</span>
                  </button>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex min-h-[42px] flex-wrap items-start gap-1.5 rounded-lg border border-dashed border-border bg-muted/5 p-2">
        {selected.length > 0 ? selected.map((item) => (
          <Badge key={item.id} variant="secondary" className="flex items-center gap-1 bg-card font-body text-[11px]">
            <span className="max-w-[180px] truncate italic">{item.label}</span>
            <button type="button" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onToggle(item.id); }} aria-label={`Remove ${item.label}`} className="ml-1 hover:text-destructive">
              <X className="size-3" />
            </button>
          </Badge>
        )) : <span className="px-1 py-1 text-[11px] italic text-muted-foreground">{emptySelectedLabel}</span>}
      </div>
    </div>
  );
}
