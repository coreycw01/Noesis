import { collection, doc, type Firestore } from 'firebase/firestore';
import type { AtlasViewSettings, GoalSettings, MediaType, ThinkingMetrics, UserPreferences, UserProfile, WorkspaceSettings } from './types';

export const PROTOTYPE_USER_ID = 'anonymous-scholar';

export const READEX_COLLECTIONS = {
  media: 'media',
  concepts: 'concepts',
  questions: 'questions',
  vault: 'vault',
  drafts: 'drafts',
  practices: 'practices',
  atlasMaps: 'atlasMaps',
  links: 'links',
  suggestions: 'suggestions',
  timeline: 'timeline',
  insights: 'insights',
  thinkingEvents: 'thinkingEvents',
  beliefProfiles: 'beliefProfiles',
  unknowns: 'unknowns',
  thinkingPatterns: 'thinkingPatterns',
  thinkingMetrics: 'thinkingMetrics',
  settings: 'settings',
} as const;

export const READEX_SETTINGS_DOCS = {
  goal: 'goal',
  atlasView: 'atlasView',
  atlasNodes: 'atlasNodes',
  preferences: 'preferences',
  profile: 'profile',
  workspace: 'workspace',
  schema: 'schema',
} as const;

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  label: '2026 Goals',
  types: ['book', 'movie', 'video', 'documentary', 'article', 'podcast', 'audiobook'],
  targets: { book: 12, movie: 12, video: 12, documentary: 12, article: 12, podcast: 12, audiobook: 12 },
  goalTypes: [
    { id: 'books', name: 'Books', mediaTypes: ['book'], sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'audiobooks', name: 'Audiobooks', mediaTypes: ['audiobook'], sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'podcasts', name: 'Podcasts', mediaTypes: ['podcast'], sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
  goals: [
    { id: 'books-2026', title: 'Books', typeId: 'books', currentProgress: 0, targetProgress: 12, sortOrder: 0, status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'audiobooks-2026', title: 'Audiobooks', typeId: 'audiobooks', currentProgress: 0, targetProgress: 12, sortOrder: 1, status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'podcasts-2026', title: 'Podcasts', typeId: 'podcasts', currentProgress: 0, targetProgress: 12, sortOrder: 2, status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
};

export const DEFAULT_ATLAS_VIEW_SETTINGS: AtlasViewSettings = {
  x: 0,
  y: 0,
  scale: 1,
};

export const DEFAULT_ATLAS_NODE_SETTINGS: { positions: Record<string, { x: number; y: number }> } = {
  positions: {},
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  themeMode: 'light',
  accentTheme: 'violet',
  writingDefaults: {
    type: 'essay',
    status: 'seed',
    writingStyle: 'blank_paper',
    editorFeel: 'spacious',
  },
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: '',
  email: '',
  photoURL: '',
  bio: '',
  role: 'user',
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  role: 'user',
  workspaceMode: 'standard',
  seedSource: 'none',
  demoWorkspace: false,
  reviewReady: false,
  featureFlags: {
    reviewMode: false,
    demoWorkspaceSeed: false,
    aiSuggestions: true,
    atlasCustomMaps: true,
    sourceIntakeProviders: true,
    worksMultimodal: true,
    metacognitionEnabled: false,
    beliefBiographiesEnabled: false,
    unknownsEnabled: false,
    thinkingPatternsEnabled: false,
    missingPerspectivesEnabled: false,
    thinkingMetricsEnabled: false,
    atlasTypedRelationsEnabled: false,
  },
};

export const DEFAULT_THINKING_METRICS: ThinkingMetrics = {
  questionsAsked: 0,
  assumptionsChallenged: 0,
  beliefsCreated: 0,
  beliefsRevised: 0,
  beliefsAbandoned: 0,
  contradictionsDetected: 0,
  contradictionsResolved: 0,
  connectionsCreated: 0,
  sourcesStudied: 0,
  ideasSynthesized: 0,
  unknownsCreated: 0,
  unknownsResolved: 0,
  positionsStressTested: 0,
  lastComputedAt: '',
};

export function userPath(uid: string) {
  return `users/${uid}`;
}

export function readexRefs(db: Firestore, uid: string) {
  const userDoc = doc(db, 'users', uid);
  const userCollection = (name: keyof typeof READEX_COLLECTIONS) => collection(userDoc, READEX_COLLECTIONS[name]);
  const settingsDoc = (name: keyof typeof READEX_SETTINGS_DOCS) => doc(userDoc, READEX_COLLECTIONS.settings, READEX_SETTINGS_DOCS[name]);

  return {
    user: userDoc,
    media: userCollection('media'),
    concepts: userCollection('concepts'),
    questions: userCollection('questions'),
    vault: userCollection('vault'),
    drafts: userCollection('drafts'),
    practices: userCollection('practices'),
    atlasMaps: userCollection('atlasMaps'),
    links: userCollection('links'),
    suggestions: userCollection('suggestions'),
    timeline: userCollection('timeline'),
    insights: userCollection('insights'),
    thinkingEvents: userCollection('thinkingEvents'),
    beliefProfiles: userCollection('beliefProfiles'),
    unknowns: userCollection('unknowns'),
    thinkingPatterns: userCollection('thinkingPatterns'),
    thinkingMetrics: userCollection('thinkingMetrics'),
    settingsGoal: settingsDoc('goal'),
    settingsAtlasView: settingsDoc('atlasView'),
    settingsAtlasNodes: settingsDoc('atlasNodes'),
    settingsPreferences: settingsDoc('preferences'),
    settingsProfile: settingsDoc('profile'),
    settingsWorkspace: settingsDoc('workspace'),
    settingsSchema: settingsDoc('schema'),
  };
}

export function readexSchemaDoc(uid: string) {
  return {
    uid,
    version: 3,
    root: userPath(uid),
    collections: {
      media: `${userPath(uid)}/media`,
      concepts: `${userPath(uid)}/concepts`,
      questions: `${userPath(uid)}/questions`,
      vault: `${userPath(uid)}/vault`,
      drafts: `${userPath(uid)}/drafts`,
      practices: `${userPath(uid)}/practices`,
      atlasMaps: `${userPath(uid)}/atlasMaps`,
      links: `${userPath(uid)}/links`,
      suggestions: `${userPath(uid)}/suggestions`,
      timeline: `${userPath(uid)}/timeline`,
      insights: `${userPath(uid)}/insights`,
      thinkingEvents: `${userPath(uid)}/thinkingEvents`,
      beliefProfiles: `${userPath(uid)}/beliefProfiles`,
      unknowns: `${userPath(uid)}/unknowns`,
      thinkingPatterns: `${userPath(uid)}/thinkingPatterns`,
      thinkingMetrics: `${userPath(uid)}/thinkingMetrics`,
      settings: `${userPath(uid)}/settings`,
    },
    settingsDocs: {
      goal: `${userPath(uid)}/settings/goal`,
      atlasView: `${userPath(uid)}/settings/atlasView`,
      atlasNodes: `${userPath(uid)}/settings/atlasNodes`,
      preferences: `${userPath(uid)}/settings/preferences`,
      profile: `${userPath(uid)}/settings/profile`,
      workspace: `${userPath(uid)}/settings/workspace`,
      schema: `${userPath(uid)}/settings/schema`,
    },
    mediaTypes: DEFAULT_GOAL_SETTINGS.types as MediaType[],
    updatedAt: new Date().toISOString(),
  };
}
