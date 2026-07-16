"use client";

import React from 'react';
import { Search, X } from 'lucide-react';
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
  activeFilterCount,
  onClear,
  clearDisabled,
  className,
}: FilterToolbarProps) {
  const hasActiveFilters = Boolean(activeFilterCount && activeFilterCount > 0) || Boolean(onClear && clearDisabled === false);
  return (
    <section aria-label="Page filters and search" className={cn('mb-8 rounded-xl border border-border/40 bg-card p-4 shadow-sm', className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        {typeof search === 'string' && onSearchChange && (
          <div className="relative min-w-[240px] flex-1 xl:max-w-md">
            <label htmlFor="page-search" className="sr-only">{searchLabel}</label>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="page-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 rounded-full pl-9 text-sm"
            />
          </div>
        )}
        {children && <div className="flex flex-wrap items-center gap-2" aria-label="Filters">{children}</div>}
        <div className="flex items-center justify-between gap-3 xl:justify-end">
          {hasActiveFilters && (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">
              {activeFilterCount ? `${activeFilterCount} active` : 'Filters active'}
            </span>
          )}
          {typeof resultCount === 'number' && (
            <span className="font-code text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {resultCount} {resultLabel}
            </span>
          )}
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear} disabled={clearDisabled} className="h-8 rounded-full px-3 font-code text-[9px] uppercase tracking-widest">
              <X className="mr-1.5 size-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
