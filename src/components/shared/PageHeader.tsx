"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { iconForNoesisView } from '@/lib/noesis-icons';

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, actions, meta, className, children }: PageHeaderProps) {
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
    labs: 'practices',
    practices: 'practices',
    evolution: 'evolution',
    profile: 'profile',
    goals: 'goals',
    settings: 'settings',
  } as Record<string, string>)[routeSegment] || 'home';
  const PageIcon = iconForNoesisView(view);

  return (
    <header className={cn('noesis-page-header mb-5 border border-transparent md:mb-8 lg:mb-10', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
        <div className="min-w-0">
          <div className="flex items-start gap-2.5">
            <PageIcon className="mt-1 size-5 shrink-0 text-accent md:size-6" strokeWidth={2.25} aria-hidden="true" />
            <h1 className="noesis-page-title min-w-0 text-[24px] md:text-[28px]">{title}</h1>
          </div>
          <p className="noesis-page-description mt-1.5 line-clamp-2 max-w-2xl text-[13px] leading-5 md:mt-2 md:line-clamp-none md:text-sm md:leading-6">{description}</p>
          {meta && <div className="mt-3 flex flex-wrap gap-2 md:mt-4">{meta}</div>}
        </div>
        {actions && <div className="noesis-page-header-actions">{actions}</div>}
      </div>
      {children && <div className="mt-4 md:mt-5">{children}</div>}
    </header>
  );
}
