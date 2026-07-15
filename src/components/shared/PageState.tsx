"use client";

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

interface PageErrorStateProps extends PageStateProps {
  onRetry?: () => void;
  retryLabel?: string;
  savedState?: string;
  nextStep?: string;
}

export function PageEmptyState({ title, description, icon: Icon = Search, action, className }: PageStateProps) {
  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/5 p-10 text-center', className)}>
      <Icon className="mb-5 size-12 text-muted-foreground/35" />
      <h3 className="font-headline text-2xl font-semibold italic text-primary/70">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageLoadingState({ title, description = 'Syncing the data this page needs.', className }: Omit<PageStateProps, 'icon' | 'action'>) {
  return (
    <div className={cn('flex min-h-[60vh] flex-1 items-center justify-center p-8', className)}>
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card px-10 py-8 text-center shadow-sm">
        <Loader2 className="size-7 animate-spin text-accent" />
        <div>
          <div className="font-code text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function PageErrorState({ title, description, onRetry, retryLabel = 'Try Again', savedState, nextStep, className }: PageErrorStateProps) {
  return (
    <div role="alert" className={cn('flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 p-10 text-center', className)}>
      <AlertTriangle className="mb-5 size-12 text-destructive" />
      <h3 className="font-headline text-2xl font-semibold italic text-destructive">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {(savedState || nextStep) && (
        <div className="mt-5 max-w-lg rounded-2xl border border-border bg-background/70 p-4 text-left text-sm leading-6 text-muted-foreground">
          {savedState && <p><span className="font-medium text-foreground">Save state:</span> {savedState}</p>}
          {nextStep && <p className={savedState ? 'mt-2' : undefined}><span className="font-medium text-foreground">Next step:</span> {nextStep}</p>}
        </div>
      )}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-6 rounded-full">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
