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
  const [expandedLookups, setExpandedLookups] = React.useState<string[]>([]);
  const searchId = React.useId();
  const lookupId = React.useId();
  const lookupHeadingId = React.useId();
  const filterHeadingId = React.useId();
  const searchInput = React.useRef<HTMLInputElement>(null);
  const searchTimer = React.useRef<number | null>(null);
  const composing = React.useRef(false);
  const resolvedActiveFilterCount = activeFilterCount ?? activeFilters?.length ?? activeFilterLabels.length;
  const cancelPendingSearch = React.useCallback(() => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    searchTimer.current = null;
  }, []);
  React.useEffect(() => {
    cancelPendingSearch();
    setLocalSearch(search || '');
  }, [search, cancelPendingSearch]);

  React.useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const updateSearch = (value: string) => {
    setLocalSearch(value);
    cancelPendingSearch();
    if (!onSearchChange || composing.current) return;
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null;
      onSearchChange(value.trim());
    }, 180);
  };

  const clearSearch = () => {
    cancelPendingSearch();
    setLocalSearch('');
    onSearchChange?.('');
    searchInput.current?.focus();
  };
  const clearAll = () => {
    cancelPendingSearch();
    setLocalSearch('');
    onClear?.();
  };
  const clearAllDisabled = clearDisabled && !localSearch;

  const renderedFilters: Array<{ id: string; label: string; onRemove?: () => void }> = activeFilters?.length
    ? activeFilters
    : activeFilterLabels.map((label) => ({ id: label, label }));
  return (
    <section aria-label="Page filters and search" className={cn('sticky top-0 z-20 mb-5 border-b border-border/30 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:mb-7', className)}>
      <div className="flex min-h-10 flex-nowrap items-center gap-2 sm:flex-wrap">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {typeof search === 'string' && onSearchChange && (
          <div className="relative min-w-0 flex-1 md:max-w-xl">
            <label htmlFor={searchId} className="sr-only">{searchLabel}</label>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              ref={searchInput}
              value={localSearch}
              onChange={(event) => updateSearch(event.target.value)}
              onCompositionStart={() => {
                composing.current = true;
                cancelPendingSearch();
              }}
              onCompositionEnd={(event) => {
                composing.current = false;
                updateSearch(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !composing.current && localSearch) {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              role="searchbox"
              aria-label={searchLabel}
              placeholder={searchPlaceholder}
              className="h-11 rounded-[var(--button-radius)] border-border/50 bg-transparent pl-9 pr-11 text-base shadow-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:text-sm"
            />
            {localSearch && (
              <Button type="button" variant="ghost" size="icon" onClick={clearSearch} aria-label="Clear search" title="Clear search" className="absolute right-0 top-1/2 size-11 -translate-y-1/2 sm:size-9">
                <X className="size-3.5" />
              </Button>
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
              <PopoverContent aria-labelledby={lookupHeadingId} align="start" collisionPadding={12} className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(380px,calc(100vw-2rem))] flex-col rounded-xl border-border bg-popover p-3 shadow-xl">
                <div className="mb-3 shrink-0">
                  <div id={lookupHeadingId} className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Search related objects</div>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <label htmlFor={lookupId} className="sr-only">Search related objects</label>
                    <Input id={lookupId} value={lookupSearch} onChange={(event) => {
                      setLookupSearch(event.target.value);
                      setExpandedLookups([]);
                    }} placeholder="Find a source or concept..." className="h-11 rounded-[var(--button-radius)] bg-background pl-8 text-base sm:h-9 sm:text-sm" />
                  </div>
                </div>
                <div className="min-h-0 max-h-80 space-y-4 overflow-y-auto overscroll-contain pr-1">
                  {relatedLookups.map((group) => {
                    const needle = lookupSearch.trim().toLowerCase();
                    const matches = group.options.filter((option) => !needle || `${option.label} ${option.description || ''}`.toLowerCase().includes(needle));
                    const expanded = expandedLookups.includes(group.id);
                    const options = expanded ? matches : matches.slice(0, 12);
                    return (
                      <div key={group.id}>
                        <div className="mb-1.5 font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</div>
                        <div className="space-y-1">
                          <button type="button" aria-pressed={!group.value || group.value === 'all'} onClick={() => group.onSelect('all')} className="flex min-h-11 w-full items-center justify-between rounded-[var(--button-radius)] px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span>All {group.label.toLowerCase()}</span>
                            {(!group.value || group.value === 'all') && <Check className="size-4 text-accent" />}
                          </button>
                          {options.map((option) => (
                            <button key={option.value} type="button" aria-pressed={group.value === option.value} onClick={() => group.onSelect(option.value)} className="flex min-h-11 w-full items-start justify-between gap-3 rounded-[var(--button-radius)] px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <span className="min-w-0">
                                <span className="block break-words text-sm text-foreground">{option.label}</span>
                                {option.description && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{option.description}</span>}
                              </span>
                              {group.value === option.value && <Check className="mt-0.5 size-4 shrink-0 text-accent" />}
                            </button>
                          ))}
                          {matches.length > 12 && (
                            <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpandedLookups((current) =>
                              expanded ? current.filter((id) => id !== group.id) : [...current, group.id]
                            )}>{expanded ? 'Show fewer' : `Show all ${matches.length}`} {group.label.toLowerCase()}</Button>
                          )}
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
              size="icon"
              className="size-9 shrink-0 justify-center rounded-full border-border/50 bg-card px-0 font-code text-[9px] uppercase tracking-widest sm:w-auto sm:px-3"
              aria-label={resolvedActiveFilterCount ? `Filters, ${resolvedActiveFilterCount} active` : 'Filters'}
            >
              <SlidersHorizontal className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Filters{resolvedActiveFilterCount ? ` (${resolvedActiveFilterCount})` : ''}</span>
            </Button>
            </PopoverTrigger>
            <PopoverContent
              aria-labelledby={filterHeadingId}
              align="end"
              collisionPadding={12}
              className="max-h-[var(--radix-popover-content-available-height)] w-[min(420px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border-border bg-popover p-4 shadow-xl"
              onFocusOutside={(event) => {
                // Radix Select renders in a portal. Moving focus into or back from
                // that portal should not dismiss the surrounding filter panel.
                event.preventDefault();
              }}
              onPointerDownOutside={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest('[data-noesis-select-content]')) {
                  event.preventDefault();
                }
              }}
            >
              <div id={filterHeadingId} className="mb-3 font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Filter and sort</div>
              <div className="flex flex-wrap items-center gap-2 [&_[role=combobox]]:min-w-[170px] [&_[role=combobox]]:flex-1">
                {children}
              </div>
              {onClear && <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={clearAllDisabled} className="mt-3 sm:hidden"><X aria-hidden="true" /> Clear filters</Button>}
            </PopoverContent>
          </Popover>
        )}
        {viewControl}
        <div className="ml-auto hidden shrink-0 flex-wrap items-center justify-end gap-2 sm:flex">
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
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={clearAllDisabled} className="h-8 rounded-full px-3 font-code text-[9px] uppercase tracking-widest">
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
  /** Null when another view (such as a split) is active and none of these is pressed. */
  value: StandardViewMode | null;
  onChange: (value: StandardViewMode) => void;
  modes?: StandardViewMode[];
  label?: string;
}) {
  const icons = { grid: Grid2X2, list: List, table: Table2 };
  return (
    <div role="group" className="flex shrink-0 items-center gap-0.5 rounded-[var(--button-radius)] border border-border/50 bg-card p-1" aria-label={label}>
      {modes.map((mode) => {
        const Icon = icons[mode];
        return (
          <Button key={mode} type="button" variant={value === mode ? 'secondary' : 'ghost'} size="icon" className="size-7" onClick={() => onChange(mode)} aria-pressed={value === mode} aria-label={`${mode} view`} title={`${mode} view`}>
            <Icon className="size-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
