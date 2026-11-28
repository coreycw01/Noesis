"use client";

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PraxisDeskTabs({ checkIn, commitments }: { checkIn: ReactNode; commitments: ReactNode }) {
  return (
    <section className="noesis-today-desk__notebook min-w-0" aria-label="Praxis activity">
      <Tabs defaultValue="check-in">
        <TabsList aria-label="Praxis activity" className="grid h-auto min-w-0 grid-cols-2">
          <TabsTrigger value="check-in" className="min-h-9 min-w-0 whitespace-normal break-words px-1 text-xs leading-tight sm:text-sm">Praxis check-in</TabsTrigger>
          <TabsTrigger value="commitments" className="min-h-9 min-w-0 whitespace-normal break-words px-1 text-xs leading-tight sm:text-sm">Active commitments</TabsTrigger>
        </TabsList>
        <TabsContent forceMount value="check-in" className="min-w-0 data-[state=inactive]:hidden">{checkIn}</TabsContent>
        <TabsContent value="commitments" className="min-w-0">{commitments}</TabsContent>
      </Tabs>
    </section>
  );
}
