"use client";

import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  className,
}: FilterToolbarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [localSearch, setLocalSearch] = React.useState(search || '');
  const searchId = React.useId();
  const searchTimer = React.useRef<number | null>(null);
  const resolvedActiveFilterCount = activeFilterCount ?? activeFilters?.length ?? activeFilterLabels.length;
  const hasActiveFilters = Boolean(resolvedActiveFilterCount && resolvedActiveFilterCount > 0) || Boolean(onClear && clearDisabled === false);

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
    <section aria-label="Page filters and search" className={cn('sticky top-0 z-20 mb-5 border-b border-border/30 bg-background/90 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:mb-8', className)}>
      <div className="flex min-h-10 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
        {typeof search === 'string' && onSearchChange && (
          <div className="relative min-w-0 flex-1 md:max-w-lg">
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
        {children && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className="h-9 justify-center rounded-full border-border/50 bg-transparent font-code text-[9px] uppercase tracking-widest md:hidden"
              aria-expanded={mobileFiltersOpen}
            >
              <SlidersHorizontal className="mr-1.5 size-3.5" />
              Filters{resolvedActiveFilterCount ? ` (${resolvedActiveFilterCount})` : ''}
            </Button>
            <div className={cn(
              'flex-wrap items-center gap-2 md:flex',
              mobileFiltersOpen ? 'flex' : 'hidden'
            )} aria-label="Filters">
              {children}
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 xl:justify-end">
          {hasActiveFilters && (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">
              {resolvedActiveFilterCount ? `${resolvedActiveFilterCount} active` : 'Filters active'}
            </span>
          )}
          {typeof resultCount === 'number' && (
            <span className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {resultCount} {resultLabel}
            </span>
          )}
          {sortLabel && (
            <span className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
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
