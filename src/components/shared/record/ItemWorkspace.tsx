'use client';

import { useState, type ReactNode } from 'react';
import { Hammer, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ItemHistoryTrigger() {
  return <TabsTrigger value="history" className="min-h-10 gap-2"><History className="size-4" aria-hidden="true" /> History</TabsTrigger>;
}

export function ItemWorkspace({ history, children }: { history: ReactNode; children: ReactNode }) {
  const [view, setView] = useState('workspace');
  return (
    <Tabs value={view} onValueChange={setView} activationMode="manual" className="min-w-0">
      <TabsList aria-label="Item views" className="my-3 h-auto max-w-full gap-2">
        <TabsTrigger value="workspace" className="min-h-10 gap-2"><Hammer className="size-4" aria-hidden="true" /> Workspace</TabsTrigger>
        <ItemHistoryTrigger />
      </TabsList>
      <TabsContent value="workspace" forceMount inert={view !== 'workspace'} className="mt-0 data-[state=inactive]:hidden">
        {children}
      </TabsContent>
      <TabsContent value="history" className="mt-0 space-y-3">
        {history}
      </TabsContent>
    </Tabs>
  );
}
