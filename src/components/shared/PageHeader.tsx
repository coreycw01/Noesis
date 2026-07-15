"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, actions, meta, className, children }: PageHeaderProps) {
  return (
    <header className={cn('mb-10 rounded-2xl border border-transparent', className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-headline text-[28px] font-semibold italic leading-tight text-foreground/80">{title}</h1>
          <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-muted-foreground">{description}</p>
          {meta && <div className="mt-4 flex flex-wrap gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}
