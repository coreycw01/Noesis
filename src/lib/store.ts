
"use client";

import { useState, useEffect } from 'react';
import type { Media, VaultEntry, Insight, Concept, Draft, TimelineEvent } from './types';

const STORAGE_KEY = 'readex_db_v1';

interface ReadexStore {
  media: Media[];
  vault: VaultEntry[];
  insights: Insight[];
  concepts: Concept[];
  drafts: Draft[];
  timeline: TimelineEvent[];
}

const initialData: ReadexStore = {
  media: [],
  vault: [],
  insights: [],
  concepts: [],
  drafts: [],
  timeline: []
};

export function useReadexStore() {
  const [data, setData] = useState<ReadexStore>(initialData);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setData(JSON.parse(saved));
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, isHydrated]);

  const addMedia = (m: Media) => setData(prev => ({ ...prev, media: [m, ...prev.media] }));
  const updateMedia = (m: Media) => setData(prev => ({ ...prev, media: prev.media.map(x => x.id === m.id ? m : x) }));
  
  const addVaultEntry = (v: VaultEntry) => setData(prev => ({ ...prev, vault: [v, ...prev.vault] }));
  const updateVaultEntry = (v: VaultEntry) => setData(prev => ({ ...prev, vault: prev.vault.map(x => x.id === v.id ? v : x) }));

  const addInsight = (i: Insight) => setData(prev => ({ ...prev, insights: [i, ...prev.insights] }));
  
  const addConcept = (c: Concept) => setData(prev => ({ ...prev, concepts: [c, ...prev.concepts] }));
  const updateConcept = (c: Concept) => setData(prev => ({ ...prev, concepts: prev.concepts.map(x => x.id === c.id ? c : x) }));

  const addDraft = (d: Draft) => setData(prev => ({ ...prev, drafts: [d, ...prev.drafts] }));
  const updateDraft = (d: Draft) => setData(prev => ({ ...prev, drafts: prev.drafts.map(x => x.id === d.id ? d : x) }));

  const addTimelineEvent = (e: TimelineEvent) => setData(prev => ({ ...prev, timeline: [e, ...prev.timeline] }));

  return {
    ...data,
    isHydrated,
    addMedia,
    updateMedia,
    addVaultEntry,
    updateVaultEntry,
    addInsight,
    addConcept,
    updateConcept,
    addDraft,
    updateDraft,
    addTimelineEvent
  };
}
