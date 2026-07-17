"use client";

import { EvolutionTimeline } from '@/components/Evolution/EvolutionTimeline';
import type { Media, ThinkingEvent, ThinkingMetrics, ThinkingPattern, TimelineEvent, Unknown } from '@/lib/types';

export interface EvolutionRoutePageProps {
  events: TimelineEvent[];
  media: Media[];
  thinkingEvents: ThinkingEvent[];
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  metrics: ThinkingMetrics;
}

export function EvolutionRoutePage({
  events,
  media,
  thinkingEvents,
  unknowns,
  thinkingPatterns,
  metrics,
}: EvolutionRoutePageProps) {
  return (
    <EvolutionTimeline
      events={events}
      media={media}
      thinkingEvents={thinkingEvents}
      unknowns={unknowns}
      thinkingPatterns={thinkingPatterns}
      metrics={metrics}
    />
  );
}
