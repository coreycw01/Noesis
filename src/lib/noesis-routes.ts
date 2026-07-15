export type NoesisView =
  | 'atlas'
  | 'concepts'
  | 'questions'
  | 'library'
  | 'source-index'
  | 'annotations'
  | 'vault'
  | 'writing'
  | 'practices'
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
}

function normalizePathname(pathname: string) {
  if (!pathname) return '/';
  const clean = pathname.replace(/\/+$/, '');
  return clean || '/';
}

export function parseNoesisRoute(pathname: string): NoesisRouteState {
  const clean = normalizePathname(pathname);
  const parts = clean.split('/').filter(Boolean);
  const [, maybeSection, maybeId] = parts.length && (parts[0] === 'demo' || parts[0] === 'review')
    ? ['', parts[1], parts[2]]
    : ['', parts[0], parts[1]];

  switch (maybeSection) {
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
      return { view: 'annotations' };
    case 'positions':
      return { view: 'vault', focusedPositionId: maybeId || null };
    case 'works':
      return { view: 'writing', focusedWorkId: maybeId || null };
    case 'practices':
      return { view: 'practices', focusedPracticeId: maybeId || null };
    case 'evolution':
      return { view: 'evolution' };
    case 'profile':
      return { view: 'profile' };
    case 'goals':
      return { view: 'goals' };
    case 'settings':
      return { view: 'settings' };
    default:
      return { view: 'atlas' };
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
}) {
  const prefix = options?.reviewMode ? '/demo' : '';
  switch (view) {
    case 'atlas':
      return `${prefix}/atlas`;
    case 'concepts':
      return options?.conceptId ? `${prefix}/concepts/${options.conceptId}` : `${prefix}/concepts`;
    case 'questions':
      return options?.questionId ? `${prefix}/inquiries/${options.questionId}` : `${prefix}/inquiries`;
    case 'library':
      return options?.sourceId ? `${prefix}/library/${options.sourceId}` : `${prefix}/library`;
    case 'source-index':
      return `${prefix}/sources`;
    case 'annotations':
      return `${prefix}/annotations`;
    case 'vault':
      return options?.positionId ? `${prefix}/positions/${options.positionId}` : `${prefix}/positions`;
    case 'writing':
      return options?.workId ? `${prefix}/works/${options.workId}` : `${prefix}/works`;
    case 'practices':
      return options?.practiceId ? `${prefix}/practices/${options.practiceId}` : `${prefix}/practices`;
    case 'evolution':
      return `${prefix}/evolution`;
    case 'profile':
      return `${prefix}/profile`;
    case 'goals':
      return `${prefix}/goals`;
    case 'settings':
      return `${prefix}/settings`;
    default:
      return `${prefix}/atlas`;
  }
}
