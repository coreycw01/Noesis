"use client";

import { EvolutionTimeline } from '@/components/Evolution/EvolutionTimeline';
import type { AiSettings, Media, ThinkingEvent, ThinkingPattern, TimelineEvent, Unknown } from '@/lib/types';

export interface EvolutionRoutePageProps {
  aiSettings: AiSettings;
  events: TimelineEvent[];
  media: Media[];
  thinkingEvents: ThinkingEvent[];
  thinkingEventsHasMore: boolean;
  loadMoreThinkingEvents: () => void;
  historyLoadingOlder: boolean;
  historyOlderError: boolean;
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  onSaveSynthesis: (event: TimelineEvent, result?: import('@/lib/contextual-ai').AiReviewResult, eventIds?: readonly string[]) => void | Promise<void>;
}

export function EvolutionRoutePage({
  aiSettings,
  events,
  media,
  thinkingEvents,
  thinkingEventsHasMore,
  loadMoreThinkingEvents,
  historyLoadingOlder,
  historyOlderError,
  unknowns,
  thinkingPatterns,
  onSaveSynthesis,
}: EvolutionRoutePageProps) {
  return (
    <EvolutionTimeline
      aiSettings={aiSettings}
      events={events}
      media={media}
      thinkingEvents={thinkingEvents}
      thinkingEventsHasMore={thinkingEventsHasMore}
      loadMoreThinkingEvents={loadMoreThinkingEvents}
      historyLoadingOlder={historyLoadingOlder}
      historyOlderError={historyOlderError}
      unknowns={unknowns}
      thinkingPatterns={thinkingPatterns}
      onSaveSynthesis={onSaveSynthesis}
    />
  );
}
