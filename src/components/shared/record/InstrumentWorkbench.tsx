'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type WorkbenchStop = { id: string; label: string };

export function InstrumentWorkbench({ label, stops, primary, secondary, panels, value, onValueChange, defaultValue }: {
  label: string;
  stops: readonly WorkbenchStop[];
  primary: readonly string[];
  secondary: readonly string[];
  panels: Readonly<Record<string, ReactNode>>;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}) {
  const column = (ids: readonly string[]) => (
    <div className="noesis-instrument-board__column">
      {ids.map(id => <TabsContent key={id} className="noesis-instrument-panel" value={id} forceMount>{panels[id]}</TabsContent>)}
    </div>
  );

  return (
    <Tabs value={value} onValueChange={onValueChange} defaultValue={defaultValue} className="noesis-instrument-board">
      <TabsList aria-label={label} className="noesis-instrument-tabs">
        {stops.map(stop => <TabsTrigger key={stop.id} value={stop.id}>{stop.label}</TabsTrigger>)}
      </TabsList>
      {column(primary)}
      {column(secondary)}
    </Tabs>
  );
}
