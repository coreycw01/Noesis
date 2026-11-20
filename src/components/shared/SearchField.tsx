"use client";

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** The one search field: glass at the left, a clear button when there is text. */
export function SearchField({ value, onChange, placeholder = 'Search', label = 'Search', className, inputClassName, autoFocus, id }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <div className={cn('noesis-search', className)}>
      <Search aria-hidden="true" />
      <Input id={id} type="search" value={value} autoFocus={autoFocus} aria-label={label} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={cn('h-9', inputClassName)} />
      {value && (
        <button type="button" className="noesis-search__clear" aria-label="Clear search" onClick={() => onChange('')}>
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
