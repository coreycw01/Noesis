"use client";

import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PraxisMethodTabs, type PraxisMethod } from './PraxisMethodPicker';

export function PraxisIndexHeader({ method, description, createLabel, onPick, onCreate, tabs, secondary }: {
  method: PraxisMethod;
  description: string;
  createLabel: string;
  onPick: (method: PraxisMethod) => void;
  onCreate: () => void;
  tabs?: ReactNode;
  secondary?: ReactNode;
}) {
  return <PageHeader title="Praxis" description={description} tabs={
    <div className="flex w-full min-w-0 flex-col items-center gap-2">
      <PraxisMethodTabs method={method} onChange={onPick} />
      {tabs}
    </div>
  } actions={
    <div className="flex flex-wrap items-center justify-end gap-2">
      {secondary}
      <Button onClick={onCreate}><Plus className="size-4" />{createLabel}</Button>
    </div>
  } />;
}

export function PraxisCardGroup({ title, count, actions, children }: { title: string; count: number; actions?: ReactNode; children: ReactNode }) {
  return <section aria-label={title}>
    <div className="mb-2 flex items-center gap-2">
      <h2 className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">{title}</h2>
      <span className="h-px flex-1 bg-border/60" />
      <Badge variant="outline" className="rounded-full bg-card noesis-eyebrow noesis-eyebrow--sm">{count}</Badge>
      {actions}
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  </section>;
}
