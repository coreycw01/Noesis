import {
  getNoesisRouteTarget,
  labelForNoesisRouteTarget,
  type NoesisRouteState,
  type NoesisRouteTargetType,
  type NoesisView,
} from '@/lib/noesis-routes';
import type { Metadata } from 'next';

export interface NoesisPageDefinition {
  view: NoesisView;
  route: string;
  title: string;
  purpose: string;
  section: 'Mind' | 'Inputs' | 'Outputs' | 'Utility';
  signatureExperience: string;
  loadingLayout: 'desk' | 'map' | 'list' | 'detail' | 'studio' | 'timeline';
}

export type NoesisWorkspaceDataKey =
  | 'media'
  | 'vault'
  | 'insights'
  | 'concepts'
  | 'questions'
  | 'timeline'
  | 'drafts'
  | 'practices'
  | 'atlasMaps'
  | 'links'
  | 'suggestions'
  | 'thinkingEvents'
  | 'beliefProfiles'
  | 'unknowns'
  | 'thinkingPatterns'
  | 'thinkingMetrics'
  | 'goal'
  | 'preferences'
  | 'legacyProfile'
  | 'workspace'
  | 'profileDocs'
  | 'allSettings';

export const NOESIS_PAGE_DEFINITIONS: NoesisPageDefinition[] = [
  {
    view: 'home',
    route: '/home',
    title: 'Home',
    purpose: 'Surface what deserves intellectual attention now and guide the next meaningful action.',
    section: 'Mind',
    signatureExperience: 'A Thinking Desk for unfinished edges, provocations, recent movement, and quiet signals.',
    loadingLayout: 'desk',
  },
  {
    view: 'atlas',
    route: '/atlas',
    title: 'Atlas',
    purpose: 'Reveal the territories, tensions, dependencies, and development of the whole thinking system.',
    section: 'Mind',
    signatureExperience: 'Region and relationship maps for worldview-level diagnosis.',
    loadingLayout: 'map',
  },
  {
    view: 'concepts',
    route: '/concepts',
    title: 'Concepts',
    purpose: 'Clarify the vocabulary that organizes recurring concepts across Noesis.',
    section: 'Mind',
    signatureExperience: 'A concept laboratory for definitions, distinctions, examples, and ambiguity.',
    loadingLayout: 'detail',
  },
  {
    view: 'questions',
    route: '/inquiries',
    title: 'Inquiries',
    purpose: 'Investigate recurring questions with evidence, assumptions, unknowns, and working answers.',
    section: 'Mind',
    signatureExperience: 'Structured investigation workspaces rather than saved question cards.',
    loadingLayout: 'detail',
  },
  {
    view: 'library',
    route: '/library',
    title: 'Library',
    purpose: 'Process sources through capture, annotations, claims, concepts, connections, and reflection.',
    section: 'Inputs',
    signatureExperience: 'An active reading, listening, and viewing desk.',
    loadingLayout: 'detail',
  },
  {
    view: 'source-index',
    route: '/sources',
    title: 'Source Index',
    purpose: 'Browse, filter, and manage every source feeding the workspace.',
    section: 'Inputs',
    signatureExperience: 'A high-density source command center.',
    loadingLayout: 'list',
  },
  {
    view: 'annotations',
    route: '/annotations',
    title: 'Annotations',
    purpose: 'Turn captured highlights, thoughts, questions, and claims into usable thought.',
    section: 'Inputs',
    signatureExperience: 'A distillation inbox with processing states and batch actions.',
    loadingLayout: 'list',
  },
  {
    view: 'vault',
    route: '/positions',
    title: 'Positions',
    purpose: 'State, challenge, revise, and test what the user currently believes.',
    section: 'Outputs',
    signatureExperience: 'A belief workbench with evidence, counterpositions, stress tests, and biography.',
    loadingLayout: 'detail',
  },
  {
    view: 'writing',
    route: '/works',
    title: 'Works',
    purpose: 'Create writing, notes, recordings, drawings, and external-document artifacts.',
    section: 'Outputs',
    signatureExperience: 'A multimodal creation studio for expressed thought.',
    loadingLayout: 'studio',
  },
  {
    view: 'practices',
    route: '/practices',
    title: 'Practices',
    purpose: 'Test positions through habits, experiments, observations, and lived commitments.',
    section: 'Outputs',
    signatureExperience: 'An intellectual experiment field with logs and outcomes.',
    loadingLayout: 'detail',
  },
  {
    view: 'evolution',
    route: '/evolution',
    title: 'Evolution',
    purpose: 'Show meaningful changes in concepts, inquiries, positions, works, and practices over time.',
    section: 'Outputs',
    signatureExperience: 'A time-lapse of thought driven by thinking events.',
    loadingLayout: 'timeline',
  },
  {
    view: 'profile',
    route: '/profile',
    title: 'Profile',
    purpose: 'Show identity, intellectual orientation, tendencies, unknowns, and belief development.',
    section: 'Utility',
    signatureExperience: 'A thinking portrait with evidence-backed metacognitive observations.',
    loadingLayout: 'detail',
  },
  {
    view: 'goals',
    route: '/goals',
    title: 'Goals',
    purpose: 'Direct attention through intellectual commitments and reviewable progress.',
    section: 'Utility',
    signatureExperience: 'An intellectual quest board rather than a media-count tracker.',
    loadingLayout: 'list',
  },
  {
    view: 'settings',
    route: '/settings',
    title: 'Settings',
    purpose: 'Control account, appearance, workspace, AI, privacy, data, and developer behavior.',
    section: 'Utility',
    signatureExperience: 'A functional control room for app behavior.',
    loadingLayout: 'detail',
  },
];

export const NOESIS_PAGE_BY_VIEW = NOESIS_PAGE_DEFINITIONS.reduce((acc, page) => {
  acc[page.view] = page;
  return acc;
}, {} as Record<NoesisView, NoesisPageDefinition>);

export const NOESIS_PAGE_DATA_REQUIREMENTS: Record<NoesisView, NoesisWorkspaceDataKey[]> = {
  home: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'timeline', 'links', 'thinkingEvents', 'unknowns', 'workspace'],
  atlas: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'timeline', 'insights', 'atlasMaps', 'links', 'thinkingEvents', 'unknowns'],
  concepts: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'timeline', 'insights', 'links'],
  questions: ['media', 'concepts', 'questions', 'vault', 'drafts'],
  library: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'timeline'],
  'source-index': ['media', 'questions', 'vault', 'drafts', 'practices'],
  annotations: ['media', 'concepts', 'questions', 'vault'],
  vault: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'timeline', 'links', 'suggestions', 'beliefProfiles', 'unknowns'],
  writing: ['media', 'concepts', 'questions', 'vault', 'drafts', 'preferences'],
  practices: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'links'],
  evolution: ['media', 'timeline', 'thinkingEvents', 'unknowns', 'thinkingPatterns', 'thinkingMetrics'],
  profile: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'thinkingEvents', 'beliefProfiles', 'unknowns', 'thinkingPatterns', 'thinkingMetrics', 'legacyProfile', 'workspace', 'profileDocs'],
  goals: ['media', 'questions', 'vault', 'drafts', 'practices', 'goal'],
  settings: ['preferences', 'legacyProfile', 'workspace', 'allSettings'],
};

export const NOESIS_DETAIL_DATA_REQUIREMENTS: Record<NoesisRouteTargetType, NoesisWorkspaceDataKey[]> = {
  concept: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'links'],
  inquiry: ['media', 'concepts', 'questions', 'vault', 'drafts'],
  source: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices'],
  position: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'timeline', 'links', 'suggestions', 'beliefProfiles', 'unknowns'],
  work: ['media', 'concepts', 'questions', 'vault', 'drafts', 'preferences'],
  practice: ['media', 'concepts', 'questions', 'vault', 'drafts', 'practices', 'links'],
};

export const NOESIS_SHELL_SUMMARY_REQUIREMENTS: NoesisWorkspaceDataKey[] = [
  'media',
  'concepts',
  'questions',
  'vault',
  'drafts',
  'practices',
  'timeline',
  'goal',
  'legacyProfile',
  'workspace',
];

export const NOESIS_DATA_REQUIREMENT_LABELS: Record<NoesisWorkspaceDataKey, string> = {
  media: 'Sources',
  vault: 'Positions',
  insights: 'Position drafts',
  concepts: 'Concepts',
  questions: 'Inquiries',
  timeline: 'Timeline',
  drafts: 'Works',
  practices: 'Practices',
  atlasMaps: 'Atlas maps',
  links: 'Links',
  suggestions: 'AI suggestions',
  thinkingEvents: 'Thinking events',
  beliefProfiles: 'Belief profiles',
  unknowns: 'Unknowns',
  thinkingPatterns: 'Thinking patterns',
  thinkingMetrics: 'Thinking metrics',
  goal: 'Goals',
  preferences: 'Preferences',
  legacyProfile: 'Profile',
  workspace: 'Workspace',
  profileDocs: 'Profile docs',
  allSettings: 'Settings',
};

export function pageNeedsData(view: NoesisView, key: NoesisWorkspaceDataKey) {
  return NOESIS_PAGE_DATA_REQUIREMENTS[view]?.includes(key) ?? false;
}

export function dataRequirementsForNoesisRoute(routeState: NoesisRouteState) {
  const routeTarget = getNoesisRouteTarget(routeState);
  return routeTarget
    ? NOESIS_DETAIL_DATA_REQUIREMENTS[routeTarget.type]
    : NOESIS_PAGE_DATA_REQUIREMENTS[routeState.view] || [];
}

export function routeNeedsData(routeState: NoesisRouteState, key: NoesisWorkspaceDataKey) {
  return dataRequirementsForNoesisRoute(routeState).includes(key);
}

export function shellNeedsSummaryData(key: NoesisWorkspaceDataKey) {
  return NOESIS_SHELL_SUMMARY_REQUIREMENTS.includes(key);
}

export function metadataForNoesisView(view: NoesisView, detailLabel?: string): Metadata {
  const page = NOESIS_PAGE_BY_VIEW[view];
  const title = detailLabel ? `${detailLabel} - ${page.title} | Noesis` : `${page.title} | Noesis`;
  return {
    title,
    description: page.purpose,
  };
}

export function metadataForNoesisDetail(
  view: NoesisView,
  targetType: NoesisRouteTargetType,
  targetId?: string,
): Metadata {
  const page = NOESIS_PAGE_BY_VIEW[view];
  const target = labelForNoesisRouteTarget(targetType);
  const readableId = targetId ? targetId.replace(/[-_]+/g, ' ') : 'selected item';

  return {
    title: `${target.owner} ${target.singular} | Noesis`,
    description: `${page.purpose} Open ${target.singular} detail: ${readableId}.`,
  };
}

export function metadataForNoesisRouteState(
  routeState: NoesisRouteState,
  workspaceLabel?: string,
): Metadata {
  const routeTarget = getNoesisRouteTarget(routeState);
  const suffix = workspaceLabel ? ` - ${workspaceLabel}` : '';

  if (routeTarget) {
    const page = NOESIS_PAGE_BY_VIEW[routeState.view];
    const target = labelForNoesisRouteTarget(routeTarget.type);
    const readableId = routeTarget.id.replace(/[-_]+/g, ' ');
    return {
      title: `${target.owner} ${target.singular}${suffix} | Noesis`,
      description: `${page.purpose} Open ${target.singular} detail: ${readableId}.`,
    };
  }

  return metadataForNoesisView(routeState.view, workspaceLabel);
}
