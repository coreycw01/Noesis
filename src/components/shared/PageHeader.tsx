"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { iconForNoesisView } from '@/lib/noesis-icons';
import { NOESIS_NAV_SECTION_TONE, NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';
import { parseNoesisRoute, type NoesisRouteTargetType, type NoesisView } from '@/lib/noesis-routes';
import { RecentlyOpenedStrip } from '@/components/shared/RecentlyOpenedStrip';

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
  const { view } = parseNoesisRoute(pathname);
  const PageIcon = iconForNoesisView(view);
  const section = ({
    home: 'Today', atlas: 'Map', concepts: 'Vocabulary', questions: 'Investigation', library: 'Encounter',
    'source-index': 'Research index', annotations: 'Marginalia', vault: 'Argument', writing: 'Studio',
    'context-desk': 'Synthesis', labs: 'Praxis', evolution: 'History', profile: 'Portrait',
    goals: 'Commitment', exercises: 'Card table', settings: 'System',
  } satisfies Record<NoesisView, string>)[view];
  const pageSection = NOESIS_PAGE_BY_VIEW[view].section;
  // Index pages for records get a strip of the ones last opened on this device.
  const recentType = ({ concepts: 'concept', questions: 'inquiry', vault: 'position', library: 'source' } as Partial<Record<NoesisView, NoesisRouteTargetType>>)[view];
  const reviewMode = /^\/(demo|review)(\/|$)/.test(pathname || '');
  // Name where the page sits in the thinking flow, matching the sidebar groups.
  const stage = pageSection && pageSection !== 'More' && pageSection !== section ? pageSection : null;

  return (
    <header data-noesis-route={view} data-stage-tone={NOESIS_NAV_SECTION_TONE[pageSection]} className={cn('noesis-page-header', tabs && 'noesis-page-header--with-tabs', className)}>
      <div className="noesis-page-header__rule" aria-hidden="true" />
      {/* The title line: where the page sits in the flow reads beside the name
          rather than above it, so the header costs one row instead of two. */}
      <div className="noesis-page-header__title-row">
        <span className="noesis-margin-marker"><PageIcon className="size-3.5" strokeWidth={2.2} aria-hidden="true" /></span>
        <h1 className="noesis-page-title min-w-0">{title}</h1>
        <span className="noesis-route-label">
          {stage && <><span className="noesis-route-label__section">{stage}</span><span className="noesis-route-label__divider" aria-hidden="true" /></>}
          {section}
        </span>
      </div>
      <p className="noesis-page-description mt-2 max-w-3xl text-sm leading-6 md:text-base md:leading-7">{description}</p>
      {meta && <div className="noesis-page-header__meta">{meta}</div>}
      {/* One shape on every index page: what you had open on the left, the
          one action that starts something new on the right. */}
      {(recentType || actions) && (
        <div className="noesis-page-header__bar">
          <div className="min-w-0 flex-1">{recentType && <RecentlyOpenedStrip type={recentType} reviewMode={reviewMode} limit={3} />}</div>
          {actions && <div className="noesis-page-header-actions">{actions}</div>}
        </div>
      )}
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
  const pageSection = NOESIS_PAGE_BY_VIEW[view as NoesisView]?.section;
  return (
    <div className="noesis-detail-label" data-stage-tone={pageSection ? NOESIS_NAV_SECTION_TONE[pageSection] : undefined}>
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
