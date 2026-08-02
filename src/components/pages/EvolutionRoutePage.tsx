"use client";

import { EvolutionTimeline } from '@/components/Evolution/EvolutionTimeline';
import type { AiSettings, Media, ThinkingEvent, ThinkingMetrics, ThinkingPattern, TimelineEvent, Unknown } from '@/lib/types';

export interface EvolutionRoutePageProps {
  aiSettings: AiSettings;
  events: TimelineEvent[];
  media: Media[];
  thinkingEvents: ThinkingEvent[];
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  metrics: ThinkingMetrics;
}

export function EvolutionRoutePage({
  aiSettings,
  events,
  media,
  thinkingEvents,
  unknowns,
  thinkingPatterns,
  metrics,
}: EvolutionRoutePageProps) {
  return (
    <EvolutionTimeline
      aiSettings={aiSettings}
      events={events}
      media={media}
      thinkingEvents={thinkingEvents}
      unknowns={unknowns}
      thinkingPatterns={thinkingPatterns}
      metrics={metrics}
    />
  );
}
