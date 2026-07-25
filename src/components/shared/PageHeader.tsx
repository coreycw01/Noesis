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
    <header className={cn('noesis-page-header mb-5 border border-transparent md:mb-8 lg:mb-10', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
        <div className="min-w-0">
          <h1 className="noesis-page-title text-[24px] md:text-[28px]">{title}</h1>
          <p className="noesis-page-description mt-1.5 line-clamp-2 max-w-2xl text-[13px] leading-5 md:mt-2 md:line-clamp-none md:text-sm md:leading-6">{description}</p>
          {meta && <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:mt-4 md:flex-wrap md:overflow-visible md:pb-0">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 md:flex-wrap md:items-center md:gap-3 md:overflow-visible md:pb-0">{actions}</div>}
      </div>
      {children && <div className="mt-4 md:mt-5">{children}</div>}
    </header>
  );
}
