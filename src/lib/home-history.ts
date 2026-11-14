import { thinkingHistoryDate, unmatchedEvolutionMilestones } from './evolution-history';
import type { NoesisView } from './noesis-routes';
import type { Media, ThinkingEvent, TimelineEvent } from './types';

export type HomeHistoryTarget = { view: NoesisView; targetId?: string | null; annotationSourceId?: string };

const views: Partial<Record<string, NoesisView>> = {
  position: 'vault', vault: 'vault', question: 'questions', inquiry: 'questions',
  media: 'library', source: 'library', draft: 'writing', work: 'writing',
  practice: 'labs', concept: 'concepts',
};

export function homeHistoryTarget(event: ThinkingEvent | TimelineEvent, media: readonly Media[]): HomeHistoryTarget {
  const { entityType, entityId } = event;
  if (entityType === 'annotation' || entityType === 'insight') {
    const candidates = 'relatedEntityIds' in event ? event.relatedEntityIds?.sourceIds : 'influencedBy' in event ? event.influencedBy : undefined;
    const matching = media.filter((source) => (!candidates?.length || candidates.includes(source.id))
      && source.annotations?.some((note) => note.id === entityId));
    if (matching.length === 1) return { view: 'annotations', targetId: entityId, annotationSourceId: matching[0].id };
    return { view: 'evolution' };
  }
  const view = views[entityType];
  return view && entityId ? { view, targetId: entityId } : { view: 'evolution' };
}

export function recentHomeHistory(thinking: readonly ThinkingEvent[], legacy: readonly TimelineEvent[]) {
  return [
    ...thinking.map((event) => ({
      event, id: `event:${event.id}`, time: thinkingHistoryDate(event.createdAt),
      title: event.summary, meta: (event.eventType || event.actionType || 'change').replace(/_/g, ' '),
    })),
    ...unmatchedEvolutionMilestones(legacy, thinking).map((event) => ({
      event, id: `timeline:${event.id}`, time: thinkingHistoryDate(event.date),
      title: `${event.entityTitle}: ${event.reason || event.eventType}`, meta: event.eventType,
    })),
  ].filter(({ time }) => Number.isFinite(time))
    .sort((left, right) => right.time - left.time || left.id.localeCompare(right.id)).slice(0, 3);
}
