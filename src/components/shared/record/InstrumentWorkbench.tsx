'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type WorkbenchStop = { id: string; label: string };

export function InstrumentWorkbench({ label, stops, primary, secondary, panels, value, onValueChange, defaultValue, layout = 'columns' }: {
  label: string;
  stops: readonly WorkbenchStop[];
  primary: readonly string[];
  secondary: readonly string[];
  panels: Readonly<Record<string, ReactNode>>;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  layout?: 'columns' | 'rows';
}) {
  const panel = (id: string) => (
    <TabsContent key={id} className="noesis-instrument-panel" value={id} forceMount>{panels[id]}</TabsContent>
  );
  const column = (ids: readonly string[]) => (
    <div className="noesis-instrument-board__column">
      {ids.map(panel)}
    </div>
  );

  return (
    <Tabs value={value} onValueChange={onValueChange} defaultValue={defaultValue} className="noesis-instrument-board" data-layout={layout}>
      <TabsList aria-label={label} className="noesis-instrument-tabs">
        {stops.map(stop => <TabsTrigger key={stop.id} value={stop.id}>{stop.label}</TabsTrigger>)}
      </TabsList>
      {layout === 'rows'
        ? Array.from({ length: Math.max(primary.length, secondary.length) }, (_, index) =>
            [primary[index], secondary[index]].filter(Boolean).map(panel))
        : <>{column(primary)}{column(secondary)}</>}
    </Tabs>
  );
}
