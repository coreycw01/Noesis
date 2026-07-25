"use client";

import React from 'react';
import { Check, Grid2X2, LibraryBig, List, Search, SlidersHorizontal, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type RelatedLookupGroup = {
  id: string;
  label: string;
  options: Array<{ value: string; label: string; description?: string }>;
  value?: string;
  onSelect: (value: string) => void;
};

interface FilterToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  children?: React.ReactNode;
  resultCount?: number;
  resultLabel?: string;
  sortLabel?: string;
  activeFilterLabels?: string[];
  activeFilters?: Array<{ id: string; label: string; onRemove?: () => void }>;
  activeFilterCount?: number;
  onClear?: () => void;
  clearDisabled?: boolean;
  relatedLookups?: RelatedLookupGroup[];
  relatedLookupLabel?: string;
  viewControl?: React.ReactNode;
  className?: string;
}

export function FilterToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchLabel = 'Search this page',
  children,
  resultCount,
  resultLabel = 'results',
  sortLabel,
  activeFilterLabels = [],
  activeFilters,
  activeFilterCount,
  onClear,
  clearDisabled,
  relatedLookups = [],
  relatedLookupLabel = 'Find related sources or concepts',
  viewControl,
  className,
}: FilterToolbarProps) {
  const [localSearch, setLocalSearch] = React.useState(search || '');
  const [lookupSearch, setLookupSearch] = React.useState('');
  const searchId = React.useId();
  const searchTimer = React.useRef<number | null>(null);
  const resolvedActiveFilterCount = activeFilterCount ?? activeFilters?.length ?? activeFilterLabels.length;
  React.useEffect(() => {
    setLocalSearch(search || '');
  }, [search]);

  React.useEffect(() => () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
  }, []);

  const updateSearch = (value: string) => {
    setLocalSearch(value);
    if (!onSearchChange) return;
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => onSearchChange(value.trim()), 180);
  };

  const clearSearch = () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    setLocalSearch('');
    onSearchChange?.('');
  };

  const renderedFilters: Array<{ id: string; label: string; onRemove?: () => void }> = activeFilters?.length
    ? activeFilters
    : activeFilterLabels.map((label) => ({ id: label, label }));
  return (
    <section aria-label="Page filters and search" className={cn('sticky top-0 z-20 mb-5 border-b border-border/30 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:mb-7', className)}>
      <div className="flex min-h-10 flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {typeof search === 'string' && onSearchChange && (
          <div className="relative min-w-[180px] flex-1 md:max-w-xl">
            <label htmlFor={searchId} className="sr-only">{searchLabel}</label>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              value={localSearch}
              onChange={(event) => updateSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              role="searchbox"
              aria-label={searchLabel}
              placeholder={searchPlaceholder}
              className="h-10 rounded-full border-border/50 bg-transparent pl-9 pr-9 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-accent/40"
            />
            {localSearch && (
              <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          )}
          {relatedLookups.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 rounded-full border-border/50 bg-card" aria-label={relatedLookupLabel} title={relatedLookupLabel}>
                  <LibraryBig className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(380px,calc(100vw-2rem))] rounded-xl border-border bg-popover p-3 shadow-xl">
                <div className="mb-3">
                  <div className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Search related objects</div>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={lookupSearch} onChange={(event) => setLookupSearch(event.target.value)} placeholder="Find a source or concept..." className="h-9 rounded-full bg-background pl-8 text-sm" />
                  </div>
                </div>
                <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                  {relatedLookups.map((group) => {
                    const options = group.options.filter((option) => !lookupSearch.trim() || `${option.label} ${option.description || ''}`.toLowerCase().includes(lookupSearch.trim().toLowerCase())).slice(0, 12);
                    return (
                      <div key={group.id}>
                        <div className="mb-1.5 font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</div>
                        <div className="space-y-1">
                          <button type="button" onClick={() => group.onSelect('all')} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
                            <span>All {group.label.toLowerCase()}</span>
                            {(!group.value || group.value === 'all') && <Check className="size-4 text-accent" />}
                          </button>
                          {options.map((option) => (
                            <button key={option.value} type="button" onClick={() => group.onSelect(option.value)} className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted">
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-foreground">{option.label}</span>
                                {option.description && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{option.description}</span>}
                              </span>
                              {group.value === option.value && <Check className="mt-0.5 size-4 shrink-0 text-accent" />}
                            </button>
                          ))}
                          {!options.length && <div className="px-3 py-2 text-sm italic text-muted-foreground">No matching {group.label.toLowerCase()}.</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {children && (
          <Popover>
            <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 justify-center rounded-full border-border/50 bg-card px-3 font-code text-[9px] uppercase tracking-widest"
            >
              <SlidersHorizontal className="mr-1.5 size-3.5" />
              Filters{resolvedActiveFilterCount ? ` (${resolvedActiveFilterCount})` : ''}
            </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(420px,calc(100vw-2rem))] rounded-xl border-border bg-popover p-4 shadow-xl">
              <div className="mb-3 font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Filter and sort</div>
              <div className="flex flex-wrap items-center gap-2 [&_[role=combobox]]:min-w-[170px] [&_[role=combobox]]:flex-1" aria-label="Filters">
                {children}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {viewControl}
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {typeof resultCount === 'number' && (
            <span className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {resultCount} {resultLabel}
            </span>
          )}
          {sortLabel && (
            <span className="hidden font-code text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground xl:inline">
              Sorted by {sortLabel}
            </span>
          )}
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear} disabled={clearDisabled} className="h-8 rounded-full px-3 font-code text-[9px] uppercase tracking-widest">
              <X className="mr-1.5 size-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>
      {renderedFilters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Active filter summary">
          {renderedFilters.map((filter) => (
            <span key={filter.id} className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/50 px-2.5 py-1 font-code text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              {filter.label}
              {filter.onRemove && (
                <button type="button" onClick={filter.onRemove} aria-label={`Remove ${filter.label}`} className="rounded-full p-0.5 hover:bg-background hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export type StandardViewMode = 'grid' | 'list' | 'table';

export function ViewModeToggle({
  value,
  onChange,
  modes = ['grid', 'list'],
  label = 'View mode',
}: {
  value: StandardViewMode;
  onChange: (value: StandardViewMode) => void;
  modes?: StandardViewMode[];
  label?: string;
}) {
  const icons = { grid: Grid2X2, list: List, table: Table2 };
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/50 bg-card p-1" aria-label={label}>
      {modes.map((mode) => {
        const Icon = icons[mode];
        return (
          <Button key={mode} type="button" variant={value === mode ? 'secondary' : 'ghost'} size="icon" className="size-7 rounded-full" onClick={() => onChange(mode)} aria-label={`${mode} view`} title={`${mode} view`}>
            <Icon className="size-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
