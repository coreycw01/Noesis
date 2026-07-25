"use client";

import React, { useMemo } from 'react';
import type { Media } from '@/lib/types';
import { EntityPicker } from '@/components/search/EntityPicker';

interface SourceLinkerProps {
  media: Media[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  label?: string;
  className?: string;
}

export function SourceLinker({ media, selectedIds, onToggle, label = "Linked Sources", className }: SourceLinkerProps) {
  const items = useMemo(() => media.map((item) => ({
    id: item.id,
    label: item.title,
    secondary: `${item.creator || 'Unknown creator'} · ${item.type}`,
    searchText: [item.year || '', item.publisher || '', item.platform || '', ...(item.tags || [])],
  })), [media]);
  return <EntityPicker items={items} selectedIds={selectedIds} onToggle={onToggle} label={label} triggerLabel="Add source" searchPlaceholder="Search title, creator, type..." emptySelectedLabel="No sources linked yet." className={className} />;
}
