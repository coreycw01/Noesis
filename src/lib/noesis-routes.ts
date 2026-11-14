export type NoesisView =
  | 'home'
  | 'atlas'
  | 'concepts'
  | 'questions'
  | 'library'
  | 'source-index'
  | 'annotations'
  | 'vault'
  | 'writing'
  | 'context-desk'
  | 'labs'
  | 'evolution'
  | 'profile'
  | 'goals'
  | 'settings';

export interface NoesisRouteState {
  view: NoesisView;
  focusedConceptId?: string | null;
  focusedQuestionId?: string | null;
  focusedSourceId?: string | null;
  focusedPositionId?: string | null;
  focusedWorkId?: string | null;
  focusedPracticeId?: string | null;
  focusedGoalId?: string | null;
  focusedAnnotationSourceId?: string | null;
  focusedAnnotationId?: string | null;
}

export type NoesisRouteTargetType = 'concept' | 'inquiry' | 'source' | 'annotation' | 'position' | 'work' | 'practice';

export interface NoesisRouteTarget {
  type: NoesisRouteTargetType;
  id: string;
  view: NoesisView;
  annotationSourceId?: string;
}

export const NOESIS_ROUTE_TARGET_LABELS: Record<NoesisRouteTargetType, {
  singular: string;
  plural: string;
  owner: string;
}> = {
  concept: { singular: 'concept', plural: 'concepts', owner: 'Concepts' },
  inquiry: { singular: 'inquiry', plural: 'inquiries', owner: 'Inquiries' },
  source: { singular: 'source', plural: 'sources', owner: 'Library' },
  annotation: { singular: 'annotation', plural: 'annotations', owner: 'Annotations' },
  position: { singular: 'position', plural: 'positions', owner: 'Positions' },
  work: { singular: 'work', plural: 'works', owner: 'Works' },
  practice: { singular: 'practice', plural: 'practices', owner: 'Praxis' },
};

function normalizePathname(pathname: string) {
  if (!pathname) return '/';
  const clean = pathname.replace(/\/+$/, '');
  return clean || '/';
}

function decodeRouteId(value: string | undefined) {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return value; }
}

export function parseNoesisRoute(pathname: string): NoesisRouteState {
  const clean = normalizePathname(pathname);
  const parts = clean.split('/').filter(Boolean);
  const isReviewRoute = parts.length > 0 && (parts[0] === 'demo' || parts[0] === 'review');
  const maybeSection = isReviewRoute ? parts[1] : parts[0];
  const maybeId = decodeRouteId(isReviewRoute ? parts[2] : parts[1]);
  const maybeChildId = decodeRouteId(isReviewRoute ? parts[3] : parts[2]);

  switch (maybeSection) {
    case undefined:
    case '':
    case 'home':
      return { view: 'home' };
    case 'atlas':
      return { view: 'atlas' };
    case 'concepts':
      return { view: 'concepts', focusedConceptId: maybeId || null };
    case 'inquiries':
      return { view: 'questions', focusedQuestionId: maybeId || null };
    case 'library':
      return { view: 'library', focusedSourceId: maybeId || null };
    case 'sources':
      return { view: 'source-index' };
    case 'annotations':
      return {
        view: 'annotations',
        focusedAnnotationSourceId: maybeId || null,
        focusedAnnotationId: maybeChildId || null,
      };
    case 'positions':
      return { view: 'vault', focusedPositionId: maybeId || null };
    case 'works':
      return { view: 'writing', focusedWorkId: maybeId || null };
    case 'context-desk':
      return { view: 'context-desk' };
    case 'labs':
      return { view: 'labs', focusedPracticeId: maybeId || null };
    case 'practices':
      return { view: 'labs', focusedPracticeId: maybeId || null };
    case 'evolution':
      return { view: 'evolution' };
    case 'profile':
      return { view: 'profile' };
    case 'goals':
      return maybeId ? { view: 'goals', focusedGoalId: maybeId } : { view: 'goals' };
    case 'settings':
      return { view: 'settings' };
    default:
      return { view: 'home' };
  }
}

export function viewToPath(view: NoesisView, options?: {
  reviewMode?: boolean;
  conceptId?: string | null;
  questionId?: string | null;
  sourceId?: string | null;
  positionId?: string | null;
  workId?: string | null;
  practiceId?: string | null;
  goalId?: string | null;
  annotationSourceId?: string | null;
  annotationId?: string | null;
}) {
  const prefix = options?.reviewMode ? '/demo' : '';
  switch (view) {
    case 'home':
      return `${prefix}/home`;
    case 'atlas':
      return `${prefix}/atlas`;
    case 'concepts':
      return options?.conceptId ? `${prefix}/concepts/${encodeURIComponent(options.conceptId)}` : `${prefix}/concepts`;
    case 'questions':
      return options?.questionId ? `${prefix}/inquiries/${encodeURIComponent(options.questionId)}` : `${prefix}/inquiries`;
    case 'library':
      return options?.sourceId ? `${prefix}/library/${encodeURIComponent(options.sourceId)}` : `${prefix}/library`;
    case 'source-index':
      return `${prefix}/sources`;
    case 'annotations':
      return options?.annotationSourceId && options?.annotationId
        ? `${prefix}/annotations/${encodeURIComponent(options.annotationSourceId)}/${encodeURIComponent(options.annotationId)}`
        : `${prefix}/annotations`;
    case 'vault':
      return options?.positionId ? `${prefix}/positions/${encodeURIComponent(options.positionId)}` : `${prefix}/positions`;
    case 'writing':
      return options?.workId ? `${prefix}/works/${encodeURIComponent(options.workId)}` : `${prefix}/works`;
    case 'context-desk':
      return `${prefix}/context-desk`;
    case 'labs':
      return options?.practiceId ? `${prefix}/labs/${encodeURIComponent(options.practiceId)}` : `${prefix}/labs`;
    case 'evolution':
      return `${prefix}/evolution`;
    case 'profile':
      return `${prefix}/profile`;
    case 'goals':
      return options?.goalId ? `${prefix}/goals/${encodeURIComponent(options.goalId)}` : `${prefix}/goals`;
    case 'settings':
      return `${prefix}/settings`;
    default:
      return `${prefix}/home`;
  }
}

export function getNoesisRouteTarget(routeState: NoesisRouteState): NoesisRouteTarget | null {
  if (routeState.focusedConceptId) {
    return { type: 'concept', id: routeState.focusedConceptId, view: 'concepts' };
  }
  if (routeState.focusedQuestionId) {
    return { type: 'inquiry', id: routeState.focusedQuestionId, view: 'questions' };
  }
  if (routeState.focusedSourceId) {
    return { type: 'source', id: routeState.focusedSourceId, view: 'library' };
  }
  if (routeState.focusedAnnotationSourceId && routeState.focusedAnnotationId) {
    return { type: 'annotation', id: routeState.focusedAnnotationId, view: 'annotations', annotationSourceId: routeState.focusedAnnotationSourceId };
  }
  if (routeState.focusedPositionId) {
    return { type: 'position', id: routeState.focusedPositionId, view: 'vault' };
  }
  if (routeState.focusedWorkId) {
    return { type: 'work', id: routeState.focusedWorkId, view: 'writing' };
  }
  if (routeState.focusedPracticeId) {
    return { type: 'practice', id: routeState.focusedPracticeId, view: 'labs' };
  }
  return null;
}

export function focusedIdForNoesisView(routeState: NoesisRouteState, view: NoesisView = routeState.view) {
  switch (view) {
    case 'concepts':
      return routeState.focusedConceptId || null;
    case 'questions':
      return routeState.focusedQuestionId || null;
    case 'library':
      return routeState.focusedSourceId || null;
    case 'annotations':
      return routeState.focusedAnnotationSourceId ? routeState.focusedAnnotationId || null : null;
    case 'vault':
      return routeState.focusedPositionId || null;
    case 'writing':
      return routeState.focusedWorkId || null;
    case 'labs':
      return routeState.focusedPracticeId || null;
    case 'goals':
      return routeState.focusedGoalId || null;
    default:
      return null;
  }
}

export function viewOptionsForNoesisRouteTarget(target: NoesisRouteTarget) {
  return {
    conceptId: target.type === 'concept' ? target.id : null,
    questionId: target.type === 'inquiry' ? target.id : null,
    sourceId: target.type === 'source' ? target.id : null,
    positionId: target.type === 'position' ? target.id : null,
    workId: target.type === 'work' ? target.id : null,
    practiceId: target.type === 'practice' ? target.id : null,
    annotationId: target.type === 'annotation' ? target.id : null,
    annotationSourceId: target.type === 'annotation' ? target.annotationSourceId : null,
  };
}

export function labelForNoesisRouteTarget(type: NoesisRouteTargetType) {
  return NOESIS_ROUTE_TARGET_LABELS[type];
}

export function pathForNoesisRouteTarget(target: NoesisRouteTarget, options?: { reviewMode?: boolean }) {
  return viewToPath(target.view, {
    reviewMode: options?.reviewMode,
    ...viewOptionsForNoesisRouteTarget(target),
  });
}
