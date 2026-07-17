import { collection, doc, type Firestore } from 'firebase/firestore';
import type {
  AccountSettings,
  AiSettings,
  AppearanceSettings,
  AtlasSettings,
  AtlasViewSettings,
  DataSettings,
  DeveloperSettings,
  GoalPreferenceSettings,
  GoalSettings,
  MediaType,
  MetacognitionSettings,
  NotificationSettings,
  PrivacySettings,
  ProfileMetacognitionSummary,
  ProfilePrivacySettings,
  SourceIntakeSettings,
  ThinkingMetrics,
  UserPreferences,
  UserProfile,
  WorksSettings,
  WorkspacePreferenceSettings,
  WorkspaceSettings,
} from './types';

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
  legacyProfile: 'profile',
  workspace: 'workspace',
  account: 'account',
  appearance: 'appearance',
  ai: 'ai',
  metacognition: 'metacognition',
  privacy: 'privacy',
  data: 'data',
  sourceIntake: 'sourceIntake',
  works: 'works',
  atlas: 'atlas',
  notifications: 'notifications',
  goals: 'goals',
  developer: 'developer',
  schema: 'schema',
} as const;

export const READEX_PROFILE_DOCS = {
  main: 'main',
  privacy: 'privacy',
  metacognitionSummary: 'metacognitionSummary',
} as const;

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  label: '2026 Intellectual Commitments',
  types: ['book', 'movie', 'video', 'documentary', 'article', 'podcast', 'audiobook'],
  targets: { book: 12, movie: 12, video: 12, documentary: 12, article: 12, podcast: 12, audiobook: 12 },
  goalTypes: [
    { id: 'source-consumption', name: 'Source Consumption', mediaTypes: ['book', 'paper', 'article', 'video', 'podcast'], sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inquiry-development', name: 'Inquiry Development', mediaTypes: [], sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'position-review', name: 'Position Review', mediaTypes: [], sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'work-expression', name: 'Writing Output', mediaTypes: [], sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'practice-testing', name: 'Practice Completion', mediaTypes: [], sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'concept-clarification', name: 'Concept Clarification', mediaTypes: [], sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
  goals: [
    {
      id: 'sources-2026',
      title: 'Study sources that change a live question',
      typeId: 'source-consumption',
      goalKind: 'consumption',
      currentProgress: 0,
      targetProgress: 18,
      sortOrder: 0,
      status: 'active',
      purpose: 'Read, watch, or listen for material that can actually alter concepts, inquiries, positions, works, or practices.',
      evidenceOfProgress: 'Completed sources include annotations, linked concepts, and at least one downstream object.',
      completionCriteria: 'Eighteen sources have produced connected annotations and a short review of what shifted.',
      milestones: ['Choose sources tied to active inquiries.', 'Capture annotations while studying.', 'Link useful material to concepts or positions.', 'Write a source reflection.', 'Review what the sources changed.'],
      reviewCadence: 'weekly',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'inquiries-2026',
      title: 'Move serious inquiries toward provisional answers',
      typeId: 'inquiry-development',
      goalKind: 'inquiry',
      currentProgress: 0,
      targetProgress: 6,
      sortOrder: 1,
      status: 'active',
      purpose: 'Turn recurring questions into investigations with evidence, assumptions, and working answers.',
      evidenceOfProgress: 'An inquiry gains framing, evidence, subquestions, unknowns, or a provisional answer.',
      completionCriteria: 'Six inquiries are resolved, transformed, or deliberately suspended with a summary.',
      milestones: ['Clarify the core question.', 'Name assumptions.', 'Gather evidence for competing answers.', 'Write a provisional answer.', 'Resolve, reopen, or transform the inquiry.'],
      reviewCadence: 'weekly',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'positions-2026',
      title: 'Review and stress-test current positions',
      typeId: 'position-review',
      goalKind: 'position',
      currentProgress: 0,
      targetProgress: 8,
      sortOrder: 2,
      status: 'active',
      purpose: 'Keep beliefs editable by making support, challenges, assumptions, and revision visible.',
      evidenceOfProgress: 'A position receives evidence, a challenge, a confidence update, or a revision note.',
      completionCriteria: 'Eight positions have been reviewed, strengthened, challenged, revised, abandoned, or transformed.',
      milestones: ['Choose a live position.', 'Add support.', 'Add the strongest objection.', 'Complete a stress test.', 'Revise, keep, challenge, or abandon the position.'],
      reviewCadence: 'monthly',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'works-2026',
      title: 'Express mature ideas in works',
      typeId: 'work-expression',
      goalKind: 'expression',
      currentProgress: 0,
      targetProgress: 4,
      sortOrder: 3,
      status: 'planned',
      purpose: 'Move developed thinking out of storage and into essays, notes, recordings, drawings, or external documents.',
      evidenceOfProgress: 'A work expresses linked positions, concepts, inquiries, or practices.',
      completionCriteria: 'Four works reach a reviewed state with linked evidence and a reflection.',
      milestones: ['Choose the idea being expressed.', 'Build the outline or artifact structure.', 'Draft the complete work.', 'Review coherence and evidence.', 'Archive, revise, or finalize with a reflection.'],
      reviewCadence: 'monthly',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
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
  avatarUrl: '',
  bio: '',
  intellectualFocus: [],
  currentThemes: [],
  disciplines: [],
  learningSeason: '',
  publicProfileEnabled: false,
  shareSlug: '',
  role: 'user',
};

export const DEFAULT_PROFILE_PRIVACY: ProfilePrivacySettings = {
  defaultVisibility: 'private',
  publicProfileEnabled: false,
  publicConceptsEnabled: false,
  publicPositionsEnabled: false,
  publicWorksEnabled: false,
  publicPracticesEnabled: false,
  publicSourcesEnabled: false,
  publicBeliefBiographyEnabled: false,
  hidePrivateNotesFromSharedViews: true,
  hideAnnotationsFromSharedViews: true,
  hideMetacognitionFromSharedViews: true,
  requireConfirmationBeforePublic: true,
  shareSlug: '',
};

export const DEFAULT_PROFILE_METACOGNITION_SUMMARY: ProfileMetacognitionSummary = {
  topThinkingPatterns: [],
  unresolvedTensions: [],
  currentUnknowns: [],
  strongestBeliefs: [],
  weakestBeliefs: [],
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

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  authEmail: '',
  connectedLoginMethods: [],
  allowDeleteAccount: false,
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  themeMode: 'light',
  accentTheme: 'violet',
  density: 'comfortable',
  fontSize: 'md',
  readingWidth: 'standard',
  reducedMotion: false,
  highContrastMode: false,
  sidebarCollapsedByDefault: false,
  showPageDescriptions: true,
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferenceSettings = {
  defaultLandingPage: 'atlas',
  defaultAfterSourcePage: 'library',
  defaultSourceStatus: 'Want to Read',
  defaultWorkType: 'essay',
  defaultWritingStyle: 'blank_paper',
  defaultNoteMode: 'text_note',
  defaultLibraryView: 'grid',
  defaultAtlasView: 'map',
  defaultSortOrder: 'recent',
  autoSaveBehavior: 'debounced',
  confirmBeforeDeletingObjects: true,
  enableReviewPromptsAfterMajorEdits: true,
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enableAiSuggestions: true,
  provider: 'gemini',
  model: '2.5-flash',
  reasoningDepth: 'standard',
  autoGenerateQuestionsAfterSourceCapture: true,
  autoDetectPossibleTensions: true,
  autoSuggestConceptLinks: true,
  autoSuggestPositionLinks: true,
  autoSummarizeEvolutionEvents: true,
  requireUserApprovalBeforeSavingAiOutput: true,
  saveAiSuggestionsAsDraftOnly: true,
  memoryScope: 'linked_objects',
  tone: 'socratic',
  safetyMode: 'balanced',
};

export const DEFAULT_METACOGNITION_SETTINGS: MetacognitionSettings = {
  enableMetacognitionFeatures: false,
  enableThinkingEventsLogging: false,
  enableBeliefBiographies: false,
  enableThinkingPatternDetection: false,
  enableUnknownsTracking: false,
  enableCognitionMetrics: false,
  enableMissingPerspectivesDetection: false,
  enableBlindSpotObservations: false,
  showMetacognitionPanelsOnProfile: true,
  showMetacognitionPanelsOnObjectPages: true,
  recomputeMetacognitionAutomatically: false,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  defaultObjectVisibility: 'private',
  publicSharingEnabled: false,
  allowPublicWorks: false,
  allowPublicPositions: false,
  allowPublicConcepts: false,
  allowPublicPractices: false,
  allowPublicSourceList: false,
  hidePrivateNotesFromSharedViews: true,
  hideAnnotationsFromSharedViews: true,
  hideMetacognitionFromSharedViews: true,
  requireConfirmationBeforePublic: true,
  shareableProfileLink: '',
};

export const DEFAULT_DATA_SETTINGS: DataSettings = {
  allowImport: true,
  allowWorkspaceReset: false,
  allowClearDemoData: true,
  storageUsageNote: '',
};

export const DEFAULT_SOURCE_INTAKE_SETTINGS: SourceIntakeSettings = {
  defaultMediaType: 'book',
  defaultSourceStatus: 'Want to Read',
  enableIsbnLookup: true,
  enableDoiLookup: true,
  enableYouTubeMetadataFetch: false,
  enableArticleMetadataFetch: true,
  enableFileUpload: true,
  enableOcr: false,
  defaultAnnotationType: 'highlight',
  autoCreateConceptsFromAnnotations: false,
  autoCreateInquiriesFromQuestions: true,
  requireConfirmationBeforeCreatingExtractedObjects: true,
};

export const DEFAULT_WORKS_SETTINGS: WorksSettings = {
  defaultWorkType: 'essay',
  defaultDraftStatus: 'seed',
  defaultPaperStyle: 'blank_paper',
  defaultEditorMode: 'spacious',
  autoSaveIntervalSeconds: 3,
  externalDocSyncEnabled: true,
  defaultExportFormat: 'md',
  showWordCount: true,
  showLinkedConcepts: true,
  showLinkedPositions: true,
  showAiPanel: true,
  recordingStorageSetting: 'local',
  drawingCanvasDefault: 'freeform',
};

export const DEFAULT_ATLAS_SETTINGS: AtlasSettings = {
  defaultMapId: '',
  defaultNodeTypesVisible: ['concept', 'position', 'inquiry', 'work', 'practice'],
  defaultLinkTypesVisible: ['supports', 'challenges', 'coheres', 'defines', 'refines'],
  showLabelsByDefault: true,
  showEvidenceStrength: false,
  showContradictionLinks: true,
  showPracticeLinks: true,
  showSourceLinks: true,
  layoutMode: 'force_graph',
  nodeSizeBasedOn: 'link_count',
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyReviewReminders: false,
  weeklyEvolutionSummary: false,
  sourceGoalReminders: false,
  practiceReminders: false,
  unresolvedTensionReminders: false,
  unknownFollowUpReminders: false,
  positionReviewReminders: false,
  staleBeliefReviewReminders: false,
  emailNotifications: false,
  inAppNotifications: true,
};

export const DEFAULT_GOAL_PREFERENCE_SETTINGS: GoalPreferenceSettings = {
  goalReminderFrequency: 'weekly',
  defaultGoalCategories: ['Books', 'Articles', 'Podcasts'],
  defaultMonthlySourceTarget: 8,
  includeAudiobooksInReadingGoals: true,
  includePodcastsInLearningGoals: true,
  includeVideosInSourceGoals: true,
  showGoalsOnDashboard: true,
};

export const DEFAULT_DEVELOPER_SETTINGS: DeveloperSettings = {
  reviewModeStatus: false,
  demoWorkspaceSeedStatus: false,
  currentUserPath: '',
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
  const profileDoc = (name: keyof typeof READEX_PROFILE_DOCS) => doc(userDoc, 'profile', READEX_PROFILE_DOCS[name]);

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
    settingsWorkspace: settingsDoc('workspace'),
    settingsAccount: settingsDoc('account'),
    settingsAppearance: settingsDoc('appearance'),
    settingsAi: settingsDoc('ai'),
    settingsMetacognition: settingsDoc('metacognition'),
    settingsPrivacy: settingsDoc('privacy'),
    settingsData: settingsDoc('data'),
    settingsSourceIntake: settingsDoc('sourceIntake'),
    settingsWorks: settingsDoc('works'),
    settingsAtlas: settingsDoc('atlas'),
    settingsNotifications: settingsDoc('notifications'),
    settingsGoals: settingsDoc('goals'),
    settingsDeveloper: settingsDoc('developer'),
    legacySettingsProfile: settingsDoc('legacyProfile'),
    profileMain: profileDoc('main'),
    profilePrivacy: profileDoc('privacy'),
    profileMetacognitionSummary: profileDoc('metacognitionSummary'),
    settingsSchema: settingsDoc('schema'),
  };
}

export function readexSchemaDoc(uid: string) {
  return {
    uid,
    version: 4,
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
      profile: `${userPath(uid)}/profile`,
      settings: `${userPath(uid)}/settings`,
    },
    profileDocs: {
      main: `${userPath(uid)}/profile/main`,
      privacy: `${userPath(uid)}/profile/privacy`,
      metacognitionSummary: `${userPath(uid)}/profile/metacognitionSummary`,
    },
    settingsDocs: {
      goal: `${userPath(uid)}/settings/goal`,
      atlasView: `${userPath(uid)}/settings/atlasView`,
      atlasNodes: `${userPath(uid)}/settings/atlasNodes`,
      preferences: `${userPath(uid)}/settings/preferences`,
      workspace: `${userPath(uid)}/settings/workspace`,
      account: `${userPath(uid)}/settings/account`,
      appearance: `${userPath(uid)}/settings/appearance`,
      ai: `${userPath(uid)}/settings/ai`,
      metacognition: `${userPath(uid)}/settings/metacognition`,
      privacy: `${userPath(uid)}/settings/privacy`,
      data: `${userPath(uid)}/settings/data`,
      sourceIntake: `${userPath(uid)}/settings/sourceIntake`,
      works: `${userPath(uid)}/settings/works`,
      atlas: `${userPath(uid)}/settings/atlas`,
      notifications: `${userPath(uid)}/settings/notifications`,
      goals: `${userPath(uid)}/settings/goals`,
      developer: `${userPath(uid)}/settings/developer`,
      legacyProfile: `${userPath(uid)}/settings/profile`,
      schema: `${userPath(uid)}/settings/schema`,
    },
    mediaTypes: DEFAULT_GOAL_SETTINGS.types as MediaType[],
    updatedAt: new Date().toISOString(),
  };
}
