
"use client";

import React, { useState } from 'react';
import { useReadexStore } from '@/lib/store';
import { Shell } from '@/components/Shell';
import { ConceptAtlas } from '@/components/Atlas/ConceptAtlas';
import { MediaLibrary } from '@/components/Library/MediaLibrary';
import { BeliefVault } from '@/components/Vault/BeliefVault';
import { Atelier } from '@/components/Writing/Atelier';
import { Button } from '@/components/ui/button';
import { Library, PenTool, ShieldCheck, HelpCircle } from 'lucide-react';

export default function Home() {
  const store = useReadexStore();
  const [view, setView] = useState('atlas');

  if (!store.isHydrated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-primary">
        <div className="text-center space-y-4">
          <div className="size-12 bg-primary rounded-full animate-pulse mx-auto" />
          <h1 className="font-headline text-2xl italic">Consulting the Vault...</h1>
          <p className="font-code text-[10px] uppercase tracking-[0.3em] opacity-40">Scholastic Engine v1.0</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (view) {
      case 'atlas':
        return <ConceptAtlas concepts={store.concepts} onAddConcept={() => {}} />;
      case 'library':
        return <MediaLibrary media={store.media} onAddMedia={() => {}} onSelectMedia={() => {}} />;
      case 'vault':
        return <BeliefVault entries={store.vault} onAddEntry={() => {}} onSelectEntry={() => {}} />;
      case 'writing':
        return <Atelier drafts={store.drafts} media={store.media} vault={store.vault} onAddDraft={() => {}} />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center p-12 text-center">
            <div className="max-w-md">
              <div className="size-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-8">
                <HelpCircle className="size-10 text-muted-foreground/40" />
              </div>
              <h2 className="text-3xl font-headline italic mb-4">View under Restoration</h2>
              <p className="text-muted-foreground font-body text-lg">The archival records for this section are currently being cataloged. Please return to the Atlas or Vault.</p>
              <div className="mt-8 flex justify-center gap-4">
                <Button onClick={() => setView('atlas')} variant="outline" className="font-code text-[11px] uppercase"><Library className="size-4 mr-2" /> Library</Button>
                <Button onClick={() => setView('vault')} className="font-code text-[11px] uppercase"><ShieldCheck className="size-4 mr-2" /> Vault</Button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Shell activeView={view} onViewChange={setView} mediaCount={store.media.filter(m => m.status === 'Finished').length}>
      <div className="absolute top-4 right-8 z-30 flex items-center gap-4">
         <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden">
                <img src={`https://picsum.photos/seed/${i + 50}/100`} alt="Avatar" className="size-full object-cover" />
              </div>
            ))}
         </div>
      </div>
      {renderContent()}
    </Shell>
  );
}
