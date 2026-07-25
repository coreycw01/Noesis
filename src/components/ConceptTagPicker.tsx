"use client";

import React, { useMemo } from 'react';
import type { Concept } from '@/lib/types';
import { conceptKey, normalizeConceptTags, UNSORTED_CONCEPT } from '@/lib/readex';
import { EntityPicker } from '@/components/search/EntityPicker';

interface ConceptTagPickerProps {
  concepts: Concept[];
  value: string[];
  onChange: (tags: string[]) => void;
  onCreateConcept?: (name: string) => void;
  compact?: boolean;
}

export function ConceptTagPicker({ concepts, value, onChange, onCreateConcept, compact }: ConceptTagPickerProps) {
  const selected = normalizeConceptTags(value);
  const items = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; secondary?: string; searchText?: string[] }>();
    byId.set(UNSORTED_CONCEPT, { id: UNSORTED_CONCEPT, label: UNSORTED_CONCEPT, secondary: 'Unclassified capture' });
    concepts.forEach((concept) => {
      const id = conceptKey(concept.name);
      byId.set(id, { id, label: id, secondary: concept.description, searchText: concept.aliases || [] });
    });
    selected.forEach((tag) => {
      if (!byId.has(tag)) byId.set(tag, { id: tag, label: tag, secondary: 'Saved concept tag' });
    });
    return Array.from(byId.values()).sort((a, b) => a.id === UNSORTED_CONCEPT ? -1 : b.id === UNSORTED_CONCEPT ? 1 : a.label.localeCompare(b.label));
  }, [concepts, selected]);

  const toggle = (id: string) => {
    const has = selected.includes(id);
    let next = has ? selected.filter((tag) => tag !== id) : [...selected, id];
    if (id === UNSORTED_CONCEPT && !has) next = [UNSORTED_CONCEPT];
    else if (id !== UNSORTED_CONCEPT && next.some((tag) => tag !== UNSORTED_CONCEPT)) next = next.filter((tag) => tag !== UNSORTED_CONCEPT);
    onChange(normalizeConceptTags(next));
  };

  const create = (query: string) => {
    const name = conceptKey(query);
    onCreateConcept?.(name);
    onChange(normalizeConceptTags([...selected.filter((tag) => tag !== UNSORTED_CONCEPT), name]));
  };

  return (
    <EntityPicker
      items={items}
      selectedIds={selected}
      onToggle={toggle}
      triggerLabel="Concept"
      searchPlaceholder="Find or create concept..."
      emptySelectedLabel="Unsorted Ideas"
      onCreate={onCreateConcept ? create : undefined}
      createLabel={(query) => `Create "${query}"`}
      compact={compact}
    />
  );
}
