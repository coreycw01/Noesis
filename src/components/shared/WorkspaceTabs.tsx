"use client";

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkspaceTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

interface WorkspaceTabsProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  items: WorkspaceTabItem<T>[];
  label: string;
  variant?: 'underline' | 'segmented';
  className?: string;
}

export function WorkspaceTabs<T extends string>({
  value,
  onChange,
  items,
  label,
  variant = 'underline',
  className,
}: WorkspaceTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex max-w-full items-center gap-1 overflow-x-auto scrollbar-hide',
        variant === 'underline'
          ? 'border-b border-border/70'
          : 'w-fit rounded-[var(--button-radius)] border border-border/70 bg-surface p-1',
        className,
      )}
    >
      {items.map(({ id, label: itemLabel, icon: Icon, count, disabled }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45',
              variant === 'underline'
                ? 'border-b-2 border-transparent'
                : 'rounded-[var(--button-radius)]',
              active && variant === 'underline' && 'border-accent text-foreground',
              !active && variant === 'underline' && 'text-muted-foreground hover:text-foreground',
              active && variant === 'segmented' && 'bg-surface-elevated text-foreground shadow-sm',
              !active && variant === 'segmented' && 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
            <span>{itemLabel}</span>
            {typeof count === 'number' && (
              <span className="min-w-5 rounded-full bg-muted px-1.5 py-0.5 font-code text-[9px] font-bold tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
