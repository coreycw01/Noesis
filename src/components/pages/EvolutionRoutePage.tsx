"use client";

import { EvolutionTimeline } from '@/components/Evolution/EvolutionTimeline';
import type { AiSettings, Media, ThinkingEvent, ThinkingMetrics, ThinkingPattern, TimelineEvent, Unknown } from '@/lib/types';

export interface EvolutionRoutePageProps {
  aiSettings: AiSettings;
  events: TimelineEvent[];
  media: Media[];
  thinkingEvents: ThinkingEvent[];
  thinkingEventsHasMore: boolean;
  loadMoreThinkingEvents: () => void;
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  metrics: ThinkingMetrics;
  onSaveSynthesis: (event: TimelineEvent) => void | Promise<void>;
}

export function EvolutionRoutePage({
  aiSettings,
  events,
  media,
  thinkingEvents,
  thinkingEventsHasMore,
  loadMoreThinkingEvents,
  unknowns,
  thinkingPatterns,
  metrics,
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
      unknowns={unknowns}
      thinkingPatterns={thinkingPatterns}
      metrics={metrics}
      onSaveSynthesis={onSaveSynthesis}
    />
  );
}
