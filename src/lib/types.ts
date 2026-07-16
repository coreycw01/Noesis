
export type MediaStatus = 'Want to Read' | 'Consuming' | 'Finished' | 'Paused' | 'Abandoned';
export type MediaType = 'book' | 'audiobook' | 'podcast' | 'video' | 'movie' | 'article' | 'course' | 'lecture' | 'documentary' | 'interview' | 'conversation' | 'paper' | 'other';
export type AnnotationType = 'highlight' | 'thought' | 'question' | 'connection';
export type VaultType = 'belief' | 'principle' | 'mental_model' | 'life_rule' | 'worldview';
export type EventType = 'created' | 'refined' | 'challenged' | 'revised' | 'expanded' | 'abandoned';
export type QuestionStatus = 'open' | 'investigating' | 'answered' | 'archived';
export type DraftType = 'essay' | 'script' | 'field_note' | 'manuscript' | 'reflection' | 'argument' | 'source_analysis' | 'text_note' | 'voice_note' | 'talk_to_text' | 'drawing_note' | 'drawing' | 'recording';
export type DraftStatus = 'seed' | 'drafting' | 'revised' | 'final';
export type WorkCategory = 'writing' | 'notes' | 'drawing' | 'recording';
export type WorkMode = 'draft' | 'final';
export type RecordingType = 'video' | 'screen';
export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentTheme = 'violet' | 'sage' | 'blue' | 'amber' | 'rose' | 'mono';
export type WritingStyle = 'blank_paper' | 'ruled_notebook' | 'manuscript' | 'cornell_notes' | 'two_column_debate' | 'dialectic' | 'belief_audit' | 'source_analysis' | 'mind_map' | 'timeline';
export type ExternalDocProvider = 'google_docs' | 'notion' | 'dropbox_paper' | 'microsoft_word' | 'markdown' | 'other';
export type ExternalDocSyncStatus = 'connected' | 'syncing' | 'synced' | 'error';
export type UserRole = 'user' | 'tester' | 'demo' | 'admin';
export type WorkspaceMode = 'standard' | 'review';
export type VisibilitySetting = 'private' | 'shared_link' | 'public';
export type PracticeType = 'habit' | 'experiment' | 'discipline' | 'reflection_prompt' | 'commitment' | 'observation' | 'rule' | 'challenge';
export type PracticeStatus = 'proposed' | 'planned' | 'active' | 'completed' | 'failed' | 'integrated' | 'paused' | 'abandoned';
export type AnnotationPhilosophyStatus = 'raw' | 'connected' | 'questioned' | 'used_in_position' | 'archived';
export type ConceptPhilosophyStatus = 'undefined' | 'emerging' | 'developed' | 'contested' | 'core';
export type PositionPhilosophyStatus = 'draft' | 'active' | 'uncertain' | 'challenged' | 'revised' | 'rejected';
export type PhilosophicalObjectType = 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'work' | 'practice' | 'evolution';
export type PhilosophicalLinkType = 'supports' | 'challenges' | 'coheres' | 'defines' | 'refines' | 'contradicts' | 'exemplifies' | 'inspired_by' | 'tested_by' | 'expressed_in' | 'changed_by' | 'depends_on' | 'explains' | 'explained_by' | 'derived_from' | 'references' | 'replaces' | 'questions' | 'expands' | 'weakens' | 'strengthens';
export type AtlasMapLinkType = PhilosophicalLinkType | 'examples' | 'causes' | 'questions' | 'practices' | 'relates' | 'custom';
export type AtlasMapLineMode = 'default' | 'singleColor' | 'strengthColor' | 'relationshipCategoryColor';
export type AtlasMapBackgroundType = 'default' | 'color' | 'preset' | 'uploaded';
export type AtlasMapBackgroundPreset = 'dark' | 'light' | 'paper' | 'grid' | 'blank';
export type AtlasMapFontFamily = 'system' | 'serif' | 'mono' | 'rounded' | 'condensed';
export type AtlasMapNodeStyle = 'default' | 'compact' | 'pill' | 'card';
export type AtlasMapMode = 'core' | 'conflict' | 'evidence' | 'practice' | 'evolution' | 'full' | 'custom';
export type SourceProvider = 'google_books' | 'open_library' | 'openalex' | 'tmdb' | 'url_metadata' | 'manual';
export type AiSuggestionType = 'annotation_consequence' | 'position_draft' | 'typed_link' | 'possible_tension' | 'evolution_summary' | 'daily_prompt' | 'missing_perspective' | 'blind_spot' | 'missing_question' | 'stress_test' | 'thinking_pattern' | 'unknown_candidate' | 'contradiction_cluster';
export type AiSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'ignored' | 'dismissed' | 'outdated';
export type ThinkingEventType = 'created' | 'edited' | 'revised' | 'challenged' | 'supported' | 'abandoned' | 'resolved' | 'linked' | 'unlinked' | 'link_removed' | 'tested' | 'synthesized' | 'confidence_changed' | 'evidence_added' | 'evidence_removed' | 'contradiction_detected' | 'contradiction_resolved' | 'unknown_created' | 'unknown_resolved' | 'question_created' | 'question_resolved' | 'position_formed' | 'practice_created' | 'source_distilled' | 'annotation_created' | 'ai_suggestion_generated' | 'ai_suggestion_accepted' | 'ai_suggestion_rejected' | 'position_created' | 'position_revised' | 'position_replaced' | 'position_abandoned' | 'question_promoted' | 'link_created' | 'suggestion_created' | 'suggestion_accepted' | 'suggestion_dismissed' | 'thinking_pattern_inferred' | 'thinking_pattern_acknowledged' | 'thinking_pattern_dismissed' | 'stress_test_generated' | 'stress_test_answered' | 'assumption_added' | 'assumption_challenged' | 'challenge_added';
export type ThinkingPatternType = 'evidence_style' | 'reasoning_style' | 'questioning_style' | 'source_bias' | 'conceptual_gap' | 'revision_pattern' | 'contradiction_pattern' | 'certainty_pattern';
export type ThinkingPatternStatus = 'pending' | 'acknowledged' | 'dismissed' | 'outdated';
export type UnknownStatus = 'active' | 'exploring' | 'resolved' | 'archived';
export type UnknownImportance = 'low' | 'medium' | 'high';
export type BeliefProfileReviewStatus = 'current' | 'needs_review' | 'outdated' | 'abandoned';
export type ThinkingEventEntityType = 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'work' | 'practice' | 'atlasMap' | 'link' | 'unknown' | 'beliefProfile' | 'thinkingPattern' | 'metric' | 'suggestion' | 'evolution';
export type ThinkingEventOrigin = 'user' | 'ai' | 'system';
export type ThinkingEventEpistemicStatus = 'raw_capture' | 'uncertain' | 'emerging' | 'working_belief' | 'strong_belief' | 'challenged' | 'abandoned' | 'resolved';
export type ThinkingEventImportance = 'low' | 'medium' | 'high' | 'major';

export interface SecurityRuleContext {
  operation: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
}

export interface Annotation {
  id: string;
  text: string;
  type: AnnotationType;
  context?: string;
  date: string;
  answer?: string;
  conceptTags?: string[];
  philosophyStatus?: AnnotationPhilosophyStatus;
  createdPositionId?: string;
  createdInquiryId?: string;
  linkedPositionIds?: string[];
}

export interface ReadingSession {
  id: string;
  userId?: string;
  sourceId?: string;
  startedAt?: string;
  endedAt?: string;
  date?: string;
  durationSeconds?: number;
  totalElapsedSeconds?: number;
  countdownTargetSeconds?: number;
  notes?: string;
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
  pauseStartedAt?: string;
  totalPausedSeconds?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MediaCapture {
  before?: {
    priorBeliefs?: string;
    expectation?: string;
    openQuestion?: string;
    openAnswer?: string;
  };
  after?: {
    coreArgument?: string;
    heldUp?: string;
    didntHold?: string;
    lasting?: string;
    beliefChange?: string;
    crossRefs?: string;
  };
  sessions: ReadingSession[];
}

export interface Media {
  id: string;
  title: string;
  creator: string;
  creators?: string[];
  type: MediaType;
  status: MediaStatus;
  year?: string;
  genre?: string;
  description?: string;
  url?: string;
  thumbnailUrl?: string;
  publisher?: string;
  isbn?: string;
  doi?: string;
  platform?: string;
  sourceProvider?: SourceProvider;
  externalIds?: {
    googleBooksId?: string;
    openLibraryId?: string;
    openAlexId?: string;
    tmdbId?: string;
    isbn?: string;
    doi?: string;
    url?: string;
  };
  tags: string[];
  annotations: Annotation[];
  capture: MediaCapture;
  dateAdded: string;
  dateUpdated?: string;
}

export interface VaultVersion {
  description: string;
  reason?: string;
  eventType?: EventType;
  date: string;
}

export interface VaultEntry {
  id: string;
  title: string;
  type: VaultType;
  statement: string;
  description: string;
  confidence: number;
  status: PositionPhilosophyStatus | 'questioning' | 'abandoned';
  tags: string[];
  sourceIds: string[];
  insightIds?: string[];
  evidenceFor?: string[];
  evidenceAgainst?: string[];
  versionHistory?: VaultVersion[];
  createdFrom?: 'manual' | 'idea';
  sourceAnnotationId?: string;
  sourceWorkId?: string;
  sourceDocumentId?: string;
  confidenceScore?: number;
  evidenceQuality?: 'low' | 'moderate' | 'high';
  lastChallengedAt?: string;
  testingCount?: number;
  lastRevisedAt?: string;
  beliefProfileId?: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  sourceIds: string[];
  tags: string[];
  categories?: string[];
  connections?: string[];
  beliefId?: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  links: string[];
  sourceIds: string[];
  dateCreated: string;
  dateUpdated?: string;
  x: number;
  y: number;
  createdFrom?: 'manual' | 'tag' | 'idea' | 'fallback';
  philosophyStatus?: ConceptPhilosophyStatus;
}

export interface Question {
  id: string;
  text: string;
  status: QuestionStatus | 'gathering_evidence' | 'under_tension' | 'partially_answered' | 'resolved' | 'reopened';
  answer?: string;
  evidenceIds: string[];
  conceptIds: string[];
  sourceIds?: string[];
  beliefIds?: string[];
  draftIds?: string[];
  type?: 'open' | 'annotation' | 'manual';
  sourceAnnotationId?: string;
  sourceWorkId?: string;
  sourceDocumentId?: string;
  dateCreated: string;
  dateUpdated?: string;
}

export interface TimelineEvent {
  id: string;
  entityId: string;
  entityType: 'media' | 'vault' | 'concept' | 'question' | 'draft' | 'insight' | string;
  entityTitle: string;
  eventType: EventType;
  reason: string;
  influencedBy?: string[];
  date: string;
}

export interface Draft {
  id: string;
  title: string;
  body: string;
  type: DraftType;
  status: DraftStatus;
  label?: string;
  workCategory?: WorkCategory;
  paperType?: WritingStyle;
  draftContent?: string;
  finalContent?: string;
  activeMode?: WorkMode;
  activeRibbon?: 'writing' | 'drawing';
  recordingType?: RecordingType;
  durationSeconds?: number;
  fileUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  canvasData?: string;
  writingOverlayData?: string;
  writingStyle?: WritingStyle;
  externalDoc?: ExternalDraftDocument;
  conceptTags: string[];
  sourceIds: string[];
  questionIds: string[];
  beliefIds: string[];
  dateCreated: string;
  dateUpdated: string;
}

export interface ExternalDraftDocument {
  provider: ExternalDocProvider;
  title: string;
  url: string;
  documentId?: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  syncStatus: ExternalDocSyncStatus;
  syncError?: string;
}

export interface Practice {
  id: string;
  title: string;
  description: string;
  type: PracticeType;
  status: PracticeStatus;
  durationDays: number;
  startDate: string;
  endDate: string;
  conceptTags: string[];
  sourceIds: string[];
  questionIds: string[];
  positionIds: string[];
  draftIds: string[];
  notes: string;
  logDates?: string[];
  dateCreated: string;
  dateUpdated: string;
}

export interface PhilosophicalLink {
  id: string;
  fromType: PhilosophicalObjectType;
  fromId: string;
  fromLabel?: string;
  toType: PhilosophicalObjectType;
  toId: string;
  toLabel?: string;
  type: PhilosophicalLinkType;
  note?: string;
  createdFrom: 'manual' | 'suggestion' | 'system';
  acceptedByUser?: boolean;
  connectionScore?: number;
  connectionStrength?: 'strong' | 'moderate' | 'weak';
  lastInteractedAt?: string;
  interactionCount?: number;
  mapModes?: Array<'core' | 'conflict' | 'evidence' | 'practice' | 'evolution' | 'full'>;
  dateCreated: string;
  dateUpdated: string;
}

export interface AiSuggestion {
  id: string;
  targetType: PhilosophicalObjectType;
  targetId: string;
  targetLabel?: string;
  suggestionType: AiSuggestionType;
  title: string;
  body: string;
  description?: string;
  reasoning?: string;
  evidence?: string[];
  confidence?: number;
  payload?: Record<string, any>;
  status: AiSuggestionStatus;
  createdFrom: 'ai';
  dateCreated: string;
  dateUpdated: string;
}

export interface ThinkingEvent {
  id: string;
  eventId: string;
  userId: string;
  schemaVersion?: number;
  actorId?: string;
  eventType: ThinkingEventType;
  actionType?: ThinkingEventType;
  entityType: ThinkingEventEntityType;
  entityId: string;
  relatedEntityIds?: {
    sourceIds?: string[];
    annotationIds?: string[];
    conceptIds?: string[];
    inquiryIds?: string[];
    positionIds?: string[];
    workIds?: string[];
    practiceIds?: string[];
    unknownIds?: string[];
    linkIds?: string[];
    suggestionIds?: string[];
  };
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  diff?: Record<string, any> | null;
  changedFields?: string[];
  targetType: PhilosophicalObjectType | 'unknown' | 'suggestion' | 'thinking_pattern';
  targetId: string;
  relatedTargetType?: PhilosophicalObjectType | 'unknown' | 'suggestion' | 'thinking_pattern';
  relatedTargetId?: string;
  sourceType: ThinkingEventOrigin;
  summary: string;
  userReason?: string | null;
  aiReason?: string | null;
  systemReason?: string | null;
  origin: ThinkingEventOrigin;
  confidenceBefore?: number | null;
  confidenceAfter?: number | null;
  epistemicStatus?: ThinkingEventEpistemicStatus | null;
  importance?: ThinkingEventImportance;
  sourceActionId?: string | null;
  idempotencyKey?: string | null;
  visibility?: 'private' | 'public_preview';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface BeliefProfile {
  positionId: string;
  createdAt: string;
  createdFrom?: string;
  originSummary: string;
  strengthenedBy: string[];
  challengedBy: string[];
  weakenedBy: string[];
  replacedByPositionId?: string;
  abandonedAt?: string;
  lastChallengedAt?: string;
  lastRevisedAt?: string;
  confidenceScore?: number;
  certaintyLevel?: number;
  evidenceQuality?: 'low' | 'moderate' | 'high';
  testingCount?: number;
  reviewStatus: BeliefProfileReviewStatus;
  updatedAt: string;
}

export interface Unknown {
  unknownId: string;
  title: string;
  description: string;
  domain: string;
  sourceIds: string[];
  positionIds: string[];
  inquiryIds: string[];
  conceptTags: string[];
  questionIds: string[];
  status: UnknownStatus;
  importance: UnknownImportance;
  createdFrom: 'manual' | 'ai' | 'system';
  dateCreated: string;
  dateUpdated: string;
  resolvedAt?: string;
  resolutionSummary?: string;
}

export interface ThinkingPattern {
  patternId: string;
  patternType: ThinkingPatternType;
  label: string;
  description: string;
  evidence: string[];
  confidence: number;
  timespan: string;
  trendDirection: 'increasing' | 'decreasing' | 'stable' | 'unclear';
  status: ThinkingPatternStatus;
  createdFrom: 'ai' | 'system';
  dateCreated: string;
  dateUpdated: string;
}

export interface ThinkingMetrics {
  questionsAsked: number;
  assumptionsChallenged: number;
  beliefsCreated: number;
  beliefsRevised: number;
  beliefsAbandoned: number;
  contradictionsDetected: number;
  contradictionsResolved: number;
  connectionsCreated: number;
  sourcesStudied: number;
  ideasSynthesized: number;
  unknownsCreated: number;
  unknownsResolved: number;
  positionsStressTested: number;
  lastComputedAt: string;
}

export interface GoalSettings {
  id?: string;
  label: string;
  types: MediaType[];
  targets: Partial<Record<MediaType, number>>;
  goalTypes?: GoalType[];
  goals?: GoalItem[];
}

export interface GoalType {
  id: string;
  userId?: string;
  name: string;
  icon?: string;
  color?: string;
  mediaTypes?: MediaType[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface GoalItem {
  id: string;
  title: string;
  typeId: string;
  currentProgress: number;
  targetProgress: number;
  sortOrder: number;
  status: 'active' | 'completed' | 'archived';
  purpose?: string;
  evidenceOfProgress?: string;
  completionCriteria?: string;
  milestones?: string[];
  obstacles?: string;
  reviewCadence?: 'weekly' | 'monthly' | 'seasonal' | 'custom';
  linkedObjectLabels?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WritingDefaults {
  type: DraftType;
  status: DraftStatus;
  writingStyle: WritingStyle;
  editorFeel: 'focused' | 'spacious' | 'dense';
}

export interface UserPreferences {
  id?: string;
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  writingDefaults: WritingDefaults;
  dateUpdated?: string;
}

export interface UserProfile {
  id?: string;
  displayName: string;
  email: string;
  photoURL?: string;
  avatarUrl?: string;
  bio?: string;
  intellectualFocus?: string[];
  currentThemes?: string[];
  disciplines?: string[];
  learningSeason?: string;
  publicProfileEnabled?: boolean;
  shareSlug?: string;
  role?: UserRole;
  createdAt?: string;
  dateUpdated?: string;
}

export interface WorkspaceSettings {
  id?: string;
  role: UserRole;
  workspaceMode: WorkspaceMode;
  seedSource?: 'system-demo' | 'manual' | 'none';
  demoWorkspace?: boolean;
  reviewReady?: boolean;
  featureFlags: Record<string, boolean>;
  dateUpdated?: string;
}

export interface ProfilePrivacySettings {
  id?: string;
  defaultVisibility: VisibilitySetting;
  publicProfileEnabled: boolean;
  publicConceptsEnabled: boolean;
  publicPositionsEnabled: boolean;
  publicWorksEnabled: boolean;
  publicPracticesEnabled: boolean;
  publicSourcesEnabled: boolean;
  publicBeliefBiographyEnabled: boolean;
  hidePrivateNotesFromSharedViews: boolean;
  hideAnnotationsFromSharedViews: boolean;
  hideMetacognitionFromSharedViews: boolean;
  requireConfirmationBeforePublic: boolean;
  shareSlug?: string;
  dateUpdated?: string;
}

export interface ProfileMetacognitionSummary {
  id?: string;
  topThinkingPatterns: string[];
  unresolvedTensions: string[];
  currentUnknowns: string[];
  strongestBeliefs: string[];
  weakestBeliefs: string[];
  lastComputedAt?: string;
}

export interface AccountSettings {
  id?: string;
  authEmail: string;
  connectedLoginMethods: string[];
  accountCreatedAt?: string;
  allowDeleteAccount: boolean;
  dateUpdated?: string;
}

export interface AppearanceSettings {
  id?: string;
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  density: 'comfortable' | 'compact';
  fontSize: 'sm' | 'md' | 'lg';
  readingWidth: 'narrow' | 'standard' | 'wide';
  reducedMotion: boolean;
  highContrastMode: boolean;
  sidebarCollapsedByDefault: boolean;
  showPageDescriptions: boolean;
  dateUpdated?: string;
}

export interface WorkspacePreferenceSettings {
  id?: string;
  defaultLandingPage: string;
  defaultAfterSourcePage: string;
  defaultSourceStatus: MediaStatus;
  defaultWorkType: DraftType;
  defaultWritingStyle: WritingStyle;
  defaultNoteMode: 'text_note' | 'voice_note' | 'drawing_note';
  defaultLibraryView: 'grid' | 'list';
  defaultAtlasView: 'map' | 'focus' | 'custom';
  defaultSortOrder: 'recent' | 'updated' | 'alphabetical';
  autoSaveBehavior: 'instant' | 'debounced' | 'manual_prompt';
  confirmBeforeDeletingObjects: boolean;
  enableReviewPromptsAfterMajorEdits: boolean;
  dateUpdated?: string;
}

export interface AiSettings {
  id?: string;
  enableAiSuggestions: boolean;
  provider: string;
  model: string;
  reasoningDepth: 'light' | 'standard' | 'deep';
  autoGenerateQuestionsAfterSourceCapture: boolean;
  autoDetectPossibleTensions: boolean;
  autoSuggestConceptLinks: boolean;
  autoSuggestPositionLinks: boolean;
  autoSummarizeEvolutionEvents: boolean;
  requireUserApprovalBeforeSavingAiOutput: boolean;
  saveAiSuggestionsAsDraftOnly: boolean;
  memoryScope: 'current_object' | 'linked_objects' | 'whole_workspace';
  tone: 'neutral' | 'socratic' | 'critical' | 'exploratory';
  safetyMode: 'conservative' | 'balanced' | 'open_ended';
  dateUpdated?: string;
}

export interface MetacognitionSettings {
  id?: string;
  enableMetacognitionFeatures: boolean;
  enableThinkingEventsLogging: boolean;
  enableBeliefBiographies: boolean;
  enableThinkingPatternDetection: boolean;
  enableUnknownsTracking: boolean;
  enableCognitionMetrics: boolean;
  enableMissingPerspectivesDetection: boolean;
  enableBlindSpotObservations: boolean;
  showMetacognitionPanelsOnProfile: boolean;
  showMetacognitionPanelsOnObjectPages: boolean;
  recomputeMetacognitionAutomatically: boolean;
  lastComputedAt?: string;
  dateUpdated?: string;
}

export interface PrivacySettings {
  id?: string;
  defaultObjectVisibility: VisibilitySetting;
  publicSharingEnabled: boolean;
  allowPublicWorks: boolean;
  allowPublicPositions: boolean;
  allowPublicConcepts: boolean;
  allowPublicPractices: boolean;
  allowPublicSourceList: boolean;
  hidePrivateNotesFromSharedViews: boolean;
  hideAnnotationsFromSharedViews: boolean;
  hideMetacognitionFromSharedViews: boolean;
  requireConfirmationBeforePublic: boolean;
  shareableProfileLink?: string;
  dateUpdated?: string;
}

export interface DataSettings {
  id?: string;
  lastExportedAt?: string;
  allowImport: boolean;
  allowWorkspaceReset: boolean;
  allowClearDemoData: boolean;
  storageUsageNote?: string;
  dateUpdated?: string;
}

export interface SourceIntakeSettings {
  id?: string;
  defaultMediaType: MediaType;
  defaultSourceStatus: MediaStatus;
  enableIsbnLookup: boolean;
  enableDoiLookup: boolean;
  enableYouTubeMetadataFetch: boolean;
  enableArticleMetadataFetch: boolean;
  enableFileUpload: boolean;
  enableOcr: boolean;
  defaultAnnotationType: AnnotationType;
  autoCreateConceptsFromAnnotations: boolean;
  autoCreateInquiriesFromQuestions: boolean;
  requireConfirmationBeforeCreatingExtractedObjects: boolean;
  dateUpdated?: string;
}

export interface WorksSettings {
  id?: string;
  defaultWorkType: DraftType;
  defaultDraftStatus: DraftStatus;
  defaultPaperStyle: WritingStyle;
  defaultEditorMode: WritingDefaults['editorFeel'];
  autoSaveIntervalSeconds: number;
  externalDocSyncEnabled: boolean;
  defaultExportFormat: 'pdf' | 'docx' | 'md' | 'txt';
  showWordCount: boolean;
  showLinkedConcepts: boolean;
  showLinkedPositions: boolean;
  showAiPanel: boolean;
  recordingStorageSetting: 'local' | 'cloud';
  drawingCanvasDefault: 'freeform' | 'notebook';
  dateUpdated?: string;
}

export interface AtlasSettings {
  id?: string;
  defaultMapId?: string;
  defaultNodeTypesVisible: string[];
  defaultLinkTypesVisible: PhilosophicalLinkType[];
  showLabelsByDefault: boolean;
  showEvidenceStrength: boolean;
  showContradictionLinks: boolean;
  showPracticeLinks: boolean;
  showSourceLinks: boolean;
  layoutMode: 'force_graph' | 'radial' | 'hierarchical' | 'timeline';
  nodeSizeBasedOn: 'link_count' | 'recent_activity' | 'confidence' | 'evidence_strength';
  dateUpdated?: string;
}

export interface NotificationSettings {
  id?: string;
  dailyReviewReminders: boolean;
  weeklyEvolutionSummary: boolean;
  sourceGoalReminders: boolean;
  practiceReminders: boolean;
  unresolvedTensionReminders: boolean;
  unknownFollowUpReminders: boolean;
  positionReviewReminders: boolean;
  staleBeliefReviewReminders: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  dateUpdated?: string;
}

export interface GoalPreferenceSettings {
  id?: string;
  goalReminderFrequency: 'off' | 'daily' | 'weekly' | 'monthly';
  defaultGoalCategories: string[];
  defaultMonthlySourceTarget: number;
  includeAudiobooksInReadingGoals: boolean;
  includePodcastsInLearningGoals: boolean;
  includeVideosInSourceGoals: boolean;
  showGoalsOnDashboard: boolean;
  dateUpdated?: string;
}

export interface DeveloperSettings {
  id?: string;
  reviewModeStatus: boolean;
  demoWorkspaceSeedStatus: boolean;
  currentUserPath?: string;
  themeCompatibilityTestedAt?: string;
  dateUpdated?: string;
}

export interface AtlasViewSettings {
  id?: string;
  x: number;
  y: number;
  scale: number;
}

export interface AtlasNodePosition {
  id?: string;
  name: string;
  x: number;
  y: number;
}

export interface AtlasMapNodePosition {
  x: number;
  y: number;
}

export interface AtlasAutoLinkFilters {
  sharedSources: boolean;
  sharedPositions: boolean;
  sharedInquiries: boolean;
  sharedWorks: boolean;
  sharedPractices: boolean;
  conceptLinks: boolean;
}

export interface AtlasMapLink {
  id: string;
  from: string;
  to: string;
  type: AtlasMapLinkType;
  label: string;
  note?: string;
  dateCreated: string;
}

export interface AtlasMapBackground {
  type: AtlasMapBackgroundType;
  color?: string;
  preset?: AtlasMapBackgroundPreset;
  imageUrl?: string;
  opacity?: number;
  blur?: number;
  storagePath?: string;
}

export interface AtlasMapStyle {
  lineMode: AtlasMapLineMode;
  customLineColor?: string;
  background: AtlasMapBackground;
  fontFamily: AtlasMapFontFamily;
  nodeStyle?: AtlasMapNodeStyle;
  showWeakLinks?: boolean;
}

export interface AtlasMap {
  id: string;
  title: string;
  mode: AtlasMapMode;
  description: string;
  nodeNames: string[];
  nodeIds?: string[];
  nodePositions: Record<string, AtlasMapNodePosition>;
  manualLinks: AtlasMapLink[];
  linkIds?: string[];
  autoLinkFilters: AtlasAutoLinkFilters;
  style?: AtlasMapStyle;
  dateCreated: string;
  dateUpdated: string;
}
