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
  belongsHere?: string;
  whyItMatters?: string;
  firstAction?: string;
  filterCause?: string;
  loadingLayout?: 'desk' | 'map' | 'list' | 'detail' | 'studio' | 'timeline';
  loadingDetails?: string[];
}

interface PageErrorStateProps extends PageStateProps {
  onRetry?: () => void;
  retryLabel?: string;
  savedState?: string;
  nextStep?: string;
  alternateAction?: React.ReactNode;
  technicalDetails?: string;
}

export function PageEmptyState({ title, description, icon: Icon = Search, action, className, belongsHere, whyItMatters, firstAction, filterCause }: PageStateProps) {
  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/5 p-10 text-center', className)}>
      <Icon className="mb-5 size-12 text-muted-foreground/35" />
      <h3 className="font-headline text-2xl font-semibold italic text-primary/70">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {(belongsHere || whyItMatters || firstAction || filterCause) && (
        <div className="mt-5 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
          {belongsHere && <StateDetail label="What belongs here" value={belongsHere} />}
          {whyItMatters && <StateDetail label="Why it matters" value={whyItMatters} />}
          {firstAction && <StateDetail label="Smallest useful action" value={firstAction} />}
          {filterCause && <StateDetail label="Filter note" value={filterCause} />}
        </div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageLoadingState({ title, description = 'Syncing the data this page needs.', className, loadingLayout = 'list', loadingDetails }: Omit<PageStateProps, 'icon' | 'action'>) {
  return (
    <div className={cn('min-h-[60vh] flex-1 p-8', className)} aria-busy="true" aria-live="polite">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-code text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-accent" />
              {title}
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
            {loadingDetails?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {loadingDetails.map((detail) => (
                  <span key={detail} className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 font-code text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {detail}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="hidden h-9 w-40 rounded-full bg-muted/40 sm:block" />
        </div>
        <LoadingSkeleton layout={loadingLayout} />
      </div>
    </div>
  );
}

export function PageErrorState({ title, description, onRetry, retryLabel = 'Try Again', savedState, nextStep, alternateAction, technicalDetails, className }: PageErrorStateProps) {
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
      {technicalDetails && (
        <details className="mt-4 max-w-lg rounded-2xl border border-border bg-background/70 p-4 text-left text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Technical details</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words font-code text-[11px] leading-5">{technicalDetails}</pre>
        </details>
      )}
      {(onRetry || alternateAction) && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="rounded-full">
              {retryLabel}
            </Button>
          )}
          {alternateAction}
        </div>
      )}
    </div>
  );
}

function StateDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <div className="font-code text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}

function LoadingSkeleton({ layout }: { layout: NonNullable<PageStateProps['loadingLayout']> }) {
  if (layout === 'map') {
    return (
      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
          <SkeletonPulse className="absolute left-[12%] top-[18%] h-16 w-36 rounded-2xl" />
          <SkeletonPulse className="absolute left-[42%] top-[28%] h-16 w-40 rounded-2xl" />
          <SkeletonPulse className="absolute right-[10%] top-[14%] h-16 w-32 rounded-2xl" />
          <SkeletonPulse className="absolute bottom-[20%] left-[28%] h-16 w-44 rounded-2xl" />
          <SkeletonPulse className="absolute bottom-[14%] right-[18%] h-16 w-36 rounded-2xl" />
          <div className="absolute inset-x-16 top-1/2 h-px bg-border/60" />
          <div className="absolute bottom-8 left-8 h-9 w-48 rounded-full bg-muted/40" />
        </div>
        <div className="rounded-3xl border border-border/60 bg-card p-5">
          <SkeletonPulse className="h-5 w-28 rounded-full" />
          <SkeletonPulse className="mt-5 h-24 rounded-2xl" />
          <SkeletonPulse className="mt-4 h-24 rounded-2xl" />
          <SkeletonPulse className="mt-4 h-16 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (layout === 'studio') {
    return (
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
        <SkeletonPanel rows={5} />
        <div className="min-h-[520px] rounded-3xl border border-border/60 bg-card p-6">
          <SkeletonPulse className="h-10 w-2/3 rounded-xl" />
          <SkeletonPulse className="mt-6 h-8 w-full rounded-xl" />
          <SkeletonPulse className="mt-4 h-8 w-5/6 rounded-xl" />
          <SkeletonPulse className="mt-4 h-64 w-full rounded-2xl" />
        </div>
        <SkeletonPanel rows={4} />
      </div>
    );
  }

  if (layout === 'timeline') {
    return (
      <div className="space-y-8 border-l border-border/60 pl-8">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="relative rounded-3xl border border-border/60 bg-card p-5">
            <span className="absolute -left-[37px] top-7 size-3 rounded-full bg-accent/40" />
            <SkeletonPulse className="h-4 w-40 rounded-full" />
            <SkeletonPulse className="mt-4 h-7 w-2/3 rounded-xl" />
            <SkeletonPulse className="mt-3 h-20 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'desk') {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-border/60 bg-card p-6">
          <SkeletonPulse className="h-7 w-64 rounded-xl" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <SkeletonPulse className="h-36 rounded-2xl" />
            <SkeletonPulse className="h-36 rounded-2xl" />
            <SkeletonPulse className="h-36 rounded-2xl" />
          </div>
        </div>
        <SkeletonPanel rows={5} />
      </div>
    );
  }

  if (layout === 'detail') {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border border-border/60 bg-card p-6">
          <SkeletonPulse className="h-8 w-2/3 rounded-xl" />
          <SkeletonPulse className="mt-5 h-28 rounded-2xl" />
          <SkeletonPulse className="mt-4 h-28 rounded-2xl" />
          <SkeletonPulse className="mt-4 h-20 rounded-2xl" />
        </div>
        <SkeletonPanel rows={5} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="rounded-3xl border border-border/60 bg-card p-5">
          <SkeletonPulse className="h-5 w-32 rounded-full" />
          <SkeletonPulse className="mt-4 h-8 w-4/5 rounded-xl" />
          <SkeletonPulse className="mt-4 h-20 rounded-2xl" />
          <SkeletonPulse className="mt-4 h-4 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SkeletonPanel({ rows }: { rows: number }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <SkeletonPulse className="h-5 w-32 rounded-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonPulse key={index} className="mt-4 h-14 rounded-2xl" />
      ))}
    </div>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-muted/55', className)} />;
}
