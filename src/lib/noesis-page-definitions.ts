import type { NoesisView } from '@/lib/noesis-routes';

export interface NoesisPageDefinition {
  view: NoesisView;
  route: string;
  title: string;
  purpose: string;
  section: 'Mind' | 'Inputs' | 'Outputs' | 'Utility';
  signatureExperience: string;
}

export const NOESIS_PAGE_DEFINITIONS: NoesisPageDefinition[] = [
  {
    view: 'atlas',
    route: '/atlas',
    title: 'Atlas',
    purpose: 'Reveal the territories, tensions, dependencies, and development of the whole thinking system.',
    section: 'Mind',
    signatureExperience: 'Region and relationship maps for worldview-level diagnosis.',
  },
  {
    view: 'concepts',
    route: '/concepts',
    title: 'Concepts',
    purpose: 'Clarify the vocabulary that organizes recurring ideas across Noesis.',
    section: 'Mind',
    signatureExperience: 'A concept laboratory for definitions, distinctions, examples, and ambiguity.',
  },
  {
    view: 'questions',
    route: '/inquiries',
    title: 'Inquiries',
    purpose: 'Investigate recurring questions with evidence, assumptions, unknowns, and working answers.',
    section: 'Mind',
    signatureExperience: 'Structured investigation workspaces rather than saved question cards.',
  },
  {
    view: 'library',
    route: '/library',
    title: 'Library',
    purpose: 'Process sources through capture, annotations, claims, concepts, connections, and reflection.',
    section: 'Inputs',
    signatureExperience: 'An active reading, listening, and viewing desk.',
  },
  {
    view: 'source-index',
    route: '/sources',
    title: 'Source Index',
    purpose: 'Browse, filter, and manage every source feeding the workspace.',
    section: 'Inputs',
    signatureExperience: 'A high-density source command center.',
  },
  {
    view: 'annotations',
    route: '/annotations',
    title: 'Annotations',
    purpose: 'Turn captured highlights, thoughts, questions, and claims into usable thought.',
    section: 'Inputs',
    signatureExperience: 'A distillation inbox with processing states and batch actions.',
  },
  {
    view: 'vault',
    route: '/positions',
    title: 'Positions',
    purpose: 'State, challenge, revise, and test what the user currently believes.',
    section: 'Outputs',
    signatureExperience: 'A belief workbench with evidence, counterpositions, stress tests, and biography.',
  },
  {
    view: 'writing',
    route: '/works',
    title: 'Works',
    purpose: 'Create writing, notes, recordings, drawings, and external-document artifacts.',
    section: 'Outputs',
    signatureExperience: 'A multimodal creation studio for expressed thought.',
  },
  {
    view: 'practices',
    route: '/practices',
    title: 'Practices',
    purpose: 'Test ideas through habits, experiments, observations, and lived commitments.',
    section: 'Outputs',
    signatureExperience: 'An intellectual experiment field with logs and outcomes.',
  },
  {
    view: 'evolution',
    route: '/evolution',
    title: 'Evolution',
    purpose: 'Show meaningful changes in concepts, inquiries, positions, works, and practices over time.',
    section: 'Outputs',
    signatureExperience: 'A time-lapse of thought driven by thinking events.',
  },
  {
    view: 'profile',
    route: '/profile',
    title: 'Profile',
    purpose: 'Show identity, intellectual orientation, tendencies, unknowns, and belief development.',
    section: 'Utility',
    signatureExperience: 'A thinking portrait with evidence-backed metacognitive observations.',
  },
  {
    view: 'goals',
    route: '/goals',
    title: 'Goals',
    purpose: 'Direct attention through intellectual commitments and reviewable progress.',
    section: 'Utility',
    signatureExperience: 'An intellectual quest board rather than a media-count tracker.',
  },
  {
    view: 'settings',
    route: '/settings',
    title: 'Settings',
    purpose: 'Control account, appearance, workspace, AI, privacy, data, and developer behavior.',
    section: 'Utility',
    signatureExperience: 'A functional control room for app behavior.',
  },
];

export const NOESIS_PAGE_BY_VIEW = NOESIS_PAGE_DEFINITIONS.reduce((acc, page) => {
  acc[page.view] = page;
  return acc;
}, {} as Record<NoesisView, NoesisPageDefinition>);
