"use client";

import type { NoesisRouteTargetType } from '@/lib/noesis-routes';

export const NOESIS_OBJECT_PREVIEW_EVENT = 'noesis:object-preview';

export interface NoesisObjectPreviewItem {
  id: string;
  label: string;
  section: string;
  description: string;
  view: string;
  targetId?: string | null;
  targetType?: NoesisRouteTargetType;
  objectType?: string;
  kind?: 'navigation' | 'object' | 'create';
  intellectualStage?: 'Encounter' | 'Capture' | 'Interpret' | 'Question' | 'Judge' | 'Express' | 'Test' | 'Revise' | 'Understand' | 'Navigate' | 'Configure';
  hierarchyLevel?: 'Raw' | 'Interpretive' | 'Judgment' | 'Expression' | 'Historical' | 'Utility';
  activityClass?: 'meaningful' | 'orientation' | 'non_meaningful';
  thinkingEventHint?: string;
  aliases?: string[];
  currentState?: string;
  summary?: string;
  connectedConcepts?: string[];
  relatedObjects?: string[];
  lastChangedAt?: string;
  matchedBecause?: string;
  quickActionLabel?: string;
  quickActions?: Array<{
    label: string;
    view: string;
    targetId?: string | null;
    targetType?: NoesisRouteTargetType;
  }>;
}

export function openNoesisObjectPreview(item: NoesisObjectPreviewItem) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<NoesisObjectPreviewItem>(NOESIS_OBJECT_PREVIEW_EVENT, { detail: item }));
}
