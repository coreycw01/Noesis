"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { iconForNoesisView } from '@/lib/noesis-icons';
import { NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  /** Sub-view navigation. Sits on the header's closing rule on every page. */
  tabs?: React.ReactNode;
}

export function PageHeader({ title, description, actions, meta, className, children, tabs }: PageHeaderProps) {
  const pathname = usePathname();
  const routeSegment = pathname.split('/').filter(Boolean).find((segment) => segment !== 'demo') || 'home';
  const view = ({
    home: 'home',
    atlas: 'atlas',
    concepts: 'concepts',
    inquiries: 'questions',
    library: 'library',
    sources: 'source-index',
    annotations: 'annotations',
    positions: 'vault',
    works: 'writing',
    'context-desk': 'context-desk',
    labs: 'labs',
    practices: 'labs',
    evolution: 'evolution',
    profile: 'profile',
    goals: 'goals',
    settings: 'settings',
  } as Record<string, string>)[routeSegment] || 'home';
  const PageIcon = iconForNoesisView(view);
  const section = ({
    home: 'Today', atlas: 'Map', concepts: 'Vocabulary', questions: 'Investigation', library: 'Encounter',
    'source-index': 'Research index', annotations: 'Marginalia', vault: 'Argument', writing: 'Studio',
    'context-desk': 'Synthesis', practices: 'Experiment', evolution: 'History', profile: 'Portrait',
    goals: 'Commitment', settings: 'System',
  } as Record<string, string>)[view] || 'Workspace';
  const pageSection = NOESIS_PAGE_BY_VIEW[view as keyof typeof NOESIS_PAGE_BY_VIEW]?.section;
  // Name where the page sits in the thinking flow, matching the sidebar groups.
  const stage = pageSection && pageSection !== 'More' && pageSection !== section ? pageSection : null;

  return (
    <header data-noesis-route={view} className={cn('noesis-page-header', tabs && 'noesis-page-header--with-tabs', className)}>
      <div className="noesis-page-header__rule" aria-hidden="true" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0 max-w-4xl">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="noesis-margin-marker"><PageIcon className="size-3.5" strokeWidth={2.2} aria-hidden="true" /></span>
            <span className="noesis-route-label">
              {stage && <><span className="noesis-route-label__section">{stage}</span><span className="noesis-route-label__divider" aria-hidden="true" /></>}
              {section}
            </span>
          </div>
          <div>
            <h1 className="noesis-page-title min-w-0 text-[30px] md:text-[38px] lg:text-[42px]">{title}</h1>
          </div>
          <p className="noesis-page-description mt-2 max-w-3xl text-sm leading-6 md:mt-3 md:text-base md:leading-7">{description}</p>
          {meta && <div className="noesis-page-header__meta">{meta}</div>}
        </div>
        {actions && <div className="noesis-page-header-actions">{actions}</div>}
      </div>
      {children && <div className="mt-4 md:mt-5">{children}</div>}
      {tabs && <div className="noesis-page-header__tabs">{tabs}</div>}
    </header>
  );
}

/**
 * The opening of every record page (a concept, inquiry, position, or source):
 * the same accent rule, margin marker, and label line as an index page header,
 * naming the kind of record and its current state.
 */
export function DetailLabel({ view, kind, status, extra }: { view: string; kind: string; status?: React.ReactNode; extra?: React.ReactNode }) {
  const Icon = iconForNoesisView(view);
  return (
    <div className="noesis-detail-label">
      <div className="noesis-page-header__rule" aria-hidden="true" />
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <span className="noesis-margin-marker"><Icon className="size-3.5" strokeWidth={2.2} aria-hidden="true" /></span>
        <span className="noesis-route-label">
          <span className="noesis-route-label__section">{kind}</span>
          {status && <><span className="noesis-route-label__divider" aria-hidden="true" />{status}</>}
        </span>
        {extra && <span className="min-w-0 truncate text-xs text-muted-foreground">{extra}</span>}
      </div>
    </div>
  );
}
