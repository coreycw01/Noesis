import { noesisGuide } from './noesis-guide';
import {
  DEFAULT_GOAL_PREFERENCE_SETTINGS,
  DEFAULT_GOAL_SETTINGS,
  DEFAULT_PROFILE_METACOGNITION_SUMMARY,
  DEFAULT_PROFILE_PRIVACY,
  DEFAULT_THINKING_METRICS,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_WORKSPACE_SETTINGS,
  readexSchemaDoc,
} from './firestore-schema';
import type {
  AccountSettings,
  AiSuggestion,
  AiSettings,
  AppearanceSettings,
  AtlasMap,
  AtlasSettings,
  BeliefProfile,
  Concept,
  DataSettings,
  DeveloperSettings,
  Draft,
  GoalSettings,
  GoalPreferenceSettings,
  Insight,
  Media,
  MetacognitionSettings,
  NotificationSettings,
  PhilosophicalLink,
  Practice,
  PrivacySettings,
  ProfileMetacognitionSummary,
  ProfilePrivacySettings,
  Question,
  ThinkingEvent,
  ThinkingMetrics,
  ThinkingPattern,
  TimelineEvent,
  Unknown,
  UserPreferences,
  UserProfile,
  VaultEntry,
  WorksSettings,
  WorkspacePreferenceSettings,
  WorkspaceSettings,
  SourceIntakeSettings,
} from './types';

export const REVIEW_ACCOUNT_EMAIL = 'noesisdev4@gmail.com';
export const REVIEW_WORKSPACE_UID = 'DxhP1l3gE7SZFRgUKdLcI2AD9Nr2';
export const DEMO_SEED_VERSION = 1;

export const REVIEW_FEATURE_FLAGS = {
  reviewMode: true,
  demoWorkspaceSeed: true,
  aiSuggestions: true,
  atlasCustomMaps: true,
  sourceIntakeProviders: true,
  worksMultimodal: true,
  contradictionReview: true,
  externalDocSync: true,
} satisfies Record<string, boolean>;

type DemoWorkspaceData = {
  profile: UserProfile;
  preferences: UserPreferences;
  goal: GoalSettings;
  workspace: WorkspaceSettings;
  media: Media[];
  concepts: Concept[];
  questions: Question[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  timeline: TimelineEvent[];
  insights: Insight[];
  links: PhilosophicalLink[];
  suggestions: AiSuggestion[];
  atlasMaps: AtlasMap[];
  thinkingEvents: ThinkingEvent[];
  beliefProfiles: BeliefProfile[];
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  thinkingMetrics: ThinkingMetrics;
  profilePrivacy: ProfilePrivacySettings;
  profileMetacognitionSummary: ProfileMetacognitionSummary;
  settingsAccount: AccountSettings;
  settingsAppearance: AppearanceSettings;
  settingsWorkspace: WorkspacePreferenceSettings;
  settingsAi: AiSettings;
  settingsMetacognition: MetacognitionSettings;
  settingsPrivacy: PrivacySettings;
  settingsData: DataSettings;
  settingsSourceIntake: SourceIntakeSettings;
  settingsWorks: WorksSettings;
  settingsAtlas: AtlasSettings;
  settingsNotifications: NotificationSettings;
  settingsGoals: GoalPreferenceSettings;
  settingsDeveloper: DeveloperSettings;
};

function iso(day: number, hour = 12) {
  return new Date(Date.UTC(2026, 5, day, hour, 0, 0)).toISOString();
}

function withDemoSeed<T extends Record<string, any>>(value: T): T & { demoSeed: true; seedVersion: number } {
  return {
    ...value,
    demoSeed: true,
    seedVersion: DEMO_SEED_VERSION,
  };
}

export function buildDemoWorkspace(uid: string): DemoWorkspaceData {
  const concepts: Concept[] = [
    { id: 'c_identity', name: 'Identity', description: 'Identity is partly inherited and partly practiced; it hardens through repeated choices and social feedback.', links: ['Narrative Self', 'Discipline', 'Responsibility'], sourceIds: ['m_aurelius', 'm_berlin', 'm_paper_identity'], dateCreated: iso(1), dateUpdated: iso(21), x: 48, y: 23, createdFrom: 'manual', philosophyStatus: 'core' },
    { id: 'c_discipline', name: 'Discipline', description: 'Discipline is a form of self-governance that becomes meaningful when tied to a valued end.', links: ['Identity', 'Attention', 'Responsibility'], sourceIds: ['m_aurelius', 'm_podcast_huberman'], dateCreated: iso(2), dateUpdated: iso(20), x: 63, y: 31, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_attention', name: 'Attention', description: 'Attention decides which realities become vivid enough to shape action.', links: ['Discipline', 'Perception', 'Meaning'], sourceIds: ['m_video_dreyfus', 'm_podcast_huberman'], dateCreated: iso(3), dateUpdated: iso(18), x: 73, y: 47, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_meaning', name: 'Meaning', description: 'Meaning emerges when actions, values, and interpretation converge into something that feels worth sustaining.', links: ['Attention', 'Responsibility', 'Narrative Self'], sourceIds: ['m_berlin', 'm_article_meaning'], dateCreated: iso(4), dateUpdated: iso(19), x: 56, y: 60, createdFrom: 'manual', philosophyStatus: 'core' },
    { id: 'c_responsibility', name: 'Responsibility', description: 'Responsibility is the bridge from what one believes to what one is willing to carry.', links: ['Meaning', 'Discipline', 'Practice'], sourceIds: ['m_aurelius', 'm_article_meaning'], dateCreated: iso(5), dateUpdated: iso(22), x: 39, y: 55, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_narrative', name: 'Narrative Self', description: 'The self is partly maintained by the stories used to unify memory, motive, and aspiration.', links: ['Identity', 'Meaning', 'Perception'], sourceIds: ['m_paper_identity'], dateCreated: iso(5), dateUpdated: iso(22), x: 31, y: 39, createdFrom: 'manual', philosophyStatus: 'contested' },
    { id: 'c_perception', name: 'Perception', description: 'Perception is not passive intake; it is filtered by training, assumptions, and emotional salience.', links: ['Attention', 'Narrative Self'], sourceIds: ['m_video_dreyfus'], dateCreated: iso(6), dateUpdated: iso(17), x: 80, y: 62, createdFrom: 'manual', philosophyStatus: 'emerging' },
    { id: 'c_practice', name: 'Practice', description: 'Practice is how an idea asks to be tested in life rather than merely admired in thought.', links: ['Responsibility', 'Discipline'], sourceIds: ['m_podcast_huberman'], dateCreated: iso(7), dateUpdated: iso(23), x: 46, y: 74, createdFrom: 'manual', philosophyStatus: 'developed' },
  ];

  const media: Media[] = [
    {
      id: 'm_aurelius',
      title: 'Meditations',
      creator: 'Marcus Aurelius',
      creators: ['Marcus Aurelius'],
      type: 'book',
      status: 'Finished',
      year: '180',
      genre: 'Stoicism',
      description: 'Personal reflections on inner rule, duty, impermanence, and the discipline of attention.',
      url: 'https://books.google.com/books?id=meditations-demo',
      thumbnailUrl: 'https://covers.openlibrary.org/b/id/14823833-L.jpg',
      publisher: 'Public Domain',
      isbn: '',
      doi: '',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'meditations-demo', url: 'https://books.google.com/books?id=meditations-demo' },
      tags: ['Discipline', 'Responsibility', 'Identity'],
      annotations: [
        { id: 'a1', text: 'If the mind governs its impressions, discipline is really a practice of attention.', type: 'thought', date: iso(8), conceptTags: ['Discipline', 'Attention'], philosophyStatus: 'connected', linkedPositionIds: ['v_attention_rule'] },
        { id: 'a2', text: 'What part of my current identity is maintained by excuses rather than commitments?', type: 'question', date: iso(8, 14), answer: '', conceptTags: ['Identity', 'Responsibility'], philosophyStatus: 'questioned', createdInquiryId: 'q_identity_excuse' },
        { id: 'a3', text: 'The obstacle reveals character because response is already philosophy in motion.', type: 'highlight', date: iso(9), conceptTags: ['Responsibility', 'Practice'], philosophyStatus: 'used_in_position', createdPositionId: 'v_character_in_motion' },
      ],
      capture: {
        before: { priorBeliefs: 'Stoicism risks being emotionally flattening.', expectation: 'Looking for a language of inner steadiness.', openQuestion: 'Can discipline exist without becoming sterile?', openAnswer: '' },
        after: { coreArgument: 'Inner freedom depends on governing impressions and chosen action.', heldUp: 'Discipline is framed as service to one’s role.', didntHold: 'Some passages overstate detachment.', lasting: 'Attention is the first moral act.', beliefChange: 'Discipline feels less punitive and more clarifying.', crossRefs: 'Linked to Identity, Responsibility, Practice.' },
        sessions: [{ id: 'rs1', sourceId: 'm_aurelius', date: iso(9), durationSeconds: 4800, totalElapsedSeconds: 4800, status: 'completed', notes: 'Marked links between self-command and responsibility.', createdAt: iso(9), updatedAt: iso(9) }],
      },
      dateAdded: iso(7),
      dateUpdated: iso(23),
    },
    {
      id: 'm_article_meaning',
      title: 'Meaning Crisis and Modern Responsibility',
      creator: 'Elena Mercer',
      creators: ['Elena Mercer'],
      type: 'article',
      status: 'Finished',
      year: '2025',
      genre: 'Philosophy',
      description: 'An essay on the difference between borrowed meaning and enacted meaning.',
      url: 'https://example.com/meaning-crisis',
      thumbnailUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80',
      publisher: 'Theoria Review',
      platform: 'Web',
      sourceProvider: 'url_metadata',
      externalIds: { url: 'https://example.com/meaning-crisis' },
      tags: ['Meaning', 'Responsibility'],
      annotations: [
        { id: 'a4', text: 'Meaning borrowed from prestige collapses under difficulty.', type: 'highlight', date: iso(10), conceptTags: ['Meaning'], philosophyStatus: 'connected' },
        { id: 'a5', text: 'The article challenges my assumption that clarity always precedes commitment.', type: 'connection', date: iso(10, 15), conceptTags: ['Meaning', 'Responsibility'], philosophyStatus: 'used_in_position', linkedPositionIds: ['v_commit_before_clarity'] },
      ],
      capture: {
        before: { priorBeliefs: 'Meaning should be intellectually justified before lived.', expectation: 'Expecting critique of modern drift.', openQuestion: 'Can responsibility create meaning before certainty exists?', openAnswer: '' },
        after: { coreArgument: 'Commitment often precedes clarity.', heldUp: 'Responsibility can generate direction.', lasting: 'Borrowed meaning cannot survive pressure.', beliefChange: 'I now suspect action can uncover rather than merely follow meaning.', crossRefs: 'Linked to Practice and Meaning.' },
        sessions: [{ id: 'rs2', sourceId: 'm_article_meaning', date: iso(10), durationSeconds: 2700, totalElapsedSeconds: 2700, status: 'completed', notes: 'Turned article into a question about action before certainty.', createdAt: iso(10), updatedAt: iso(10) }],
      },
      dateAdded: iso(9),
      dateUpdated: iso(23),
    },
    {
      id: 'm_paper_identity',
      title: 'Narrative Identity and Agency Under Uncertainty',
      creator: 'S. Ortega',
      creators: ['S. Ortega', 'L. Hart'],
      type: 'paper',
      status: 'Consuming',
      year: '2024',
      genre: 'Cognitive Science',
      description: 'A paper on narrative continuity, agency, and meaning-making under unstable conditions.',
      url: 'https://openalex.org/W1234567890',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
      publisher: 'Journal of Mind and Culture',
      doi: '10.1234/noesis.identity.2024',
      platform: 'OpenAlex',
      sourceProvider: 'openalex',
      externalIds: { openAlexId: 'W1234567890', doi: '10.1234/noesis.identity.2024', url: 'https://openalex.org/W1234567890' },
      tags: ['Identity', 'Narrative Self'],
      annotations: [
        { id: 'a6', text: 'Identity becomes brittle when the story cannot absorb failure.', type: 'highlight', date: iso(11), conceptTags: ['Identity', 'Narrative Self'], philosophyStatus: 'connected' },
        { id: 'a7', text: 'Does narrative coherence help or distort agency?', type: 'question', date: iso(11, 13), answer: 'Likely both; it can guide action but also overwrite conflicting evidence.', conceptTags: ['Narrative Self', 'Identity'], philosophyStatus: 'questioned', createdInquiryId: 'q_narrative_distort' },
      ],
      capture: {
        before: { priorBeliefs: 'Identity is mostly action, not story.', expectation: 'Expecting pushback on narrative accounts of self.' },
        after: { coreArgument: 'Agency and story are mutually reinforcing under uncertainty.', heldUp: 'Stories can stabilize action.', didntHold: 'Narrative is sometimes treated as too coherent.', lasting: 'Failure has to be integrated, not denied.' },
        sessions: [{ id: 'rs3', sourceId: 'm_paper_identity', date: iso(11), durationSeconds: 3600, totalElapsedSeconds: 3600, status: 'completed', notes: 'Useful for tension between action and narrative theories of identity.', createdAt: iso(11), updatedAt: iso(11) }],
      },
      dateAdded: iso(10),
      dateUpdated: iso(22),
    },
    {
      id: 'm_podcast_huberman',
      title: 'Ritual, Attention, and Behavioral Change',
      creator: 'Noesis Review Podcast',
      creators: ['A. Patel', 'Noesis Review Podcast'],
      type: 'podcast',
      status: 'Finished',
      year: '2026',
      genre: 'Behavioral Science',
      description: 'Conversation about ritual, environment design, and protecting deep work from distraction loops.',
      url: 'https://example.com/podcast-attention',
      thumbnailUrl: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=900&q=80',
      publisher: 'Noesis Review',
      platform: 'Podcast Feed',
      sourceProvider: 'manual',
      externalIds: { url: 'https://example.com/podcast-attention' },
      tags: ['Attention', 'Discipline', 'Practice'],
      annotations: [
        { id: 'a8', text: 'Behavioral design matters because attention is rarely a purely internal fight.', type: 'thought', date: iso(12), conceptTags: ['Attention', 'Practice'], philosophyStatus: 'connected' },
        { id: 'a9', text: 'For 7 days, begin work before consuming media.', type: 'connection', date: iso(12, 14), conceptTags: ['Discipline', 'Practice'], philosophyStatus: 'used_in_position', linkedPositionIds: ['v_attention_rule'] },
      ],
      capture: {
        before: { priorBeliefs: 'Discipline is mostly a willpower issue.', expectation: 'Looking for behavior-level interventions.' },
        after: { coreArgument: 'Environment and ritual scaffold discipline.', heldUp: 'Attention protection is practical, not mystical.', beliefChange: 'I now think discipline is designed, not merely summoned.' },
        sessions: [{ id: 'rs4', sourceId: 'm_podcast_huberman', date: iso(12), durationSeconds: 4200, totalElapsedSeconds: 4200, status: 'completed', notes: 'Turned episode into a practice idea and a position about ritual.', createdAt: iso(12), updatedAt: iso(12) }],
      },
      dateAdded: iso(12),
      dateUpdated: iso(24),
    },
    {
      id: 'm_video_dreyfus',
      title: 'Embodiment, Skill, and Perception',
      creator: 'Philosophy Channel',
      creators: ['Philosophy Channel'],
      type: 'video',
      status: 'Finished',
      year: '2023',
      genre: 'Phenomenology',
      description: 'A lecture connecting perception, embodiment, and practical skill.',
      url: 'https://www.youtube.com/watch?v=noesis-embodiment',
      thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
      publisher: 'YouTube',
      platform: 'YouTube',
      sourceProvider: 'manual',
      externalIds: { url: 'https://www.youtube.com/watch?v=noesis-embodiment' },
      tags: ['Perception', 'Attention'],
      annotations: [
        { id: 'a10', text: 'Perception changes with training; the world literally looks different when skill deepens.', type: 'highlight', date: iso(13), conceptTags: ['Perception', 'Attention'], philosophyStatus: 'connected' },
      ],
      capture: {
        before: { expectation: 'Looking for stronger language around perception as trained attention.' },
        after: { coreArgument: 'Skill changes what stands out in perception.', lasting: 'Attention and perception are more embodied than I was allowing.' },
        sessions: [{ id: 'rs5', sourceId: 'm_video_dreyfus', date: iso(13), durationSeconds: 3900, totalElapsedSeconds: 3900, status: 'completed', notes: 'Good bridge to practice and embodied knowledge.', createdAt: iso(13), updatedAt: iso(13) }],
      },
      dateAdded: iso(13),
      dateUpdated: iso(21),
    },
    {
      id: 'm_documentary_jodorowsky',
      title: 'Examined Lives: Ritual and Meaning',
      creator: 'Aster Documentary Studio',
      creators: ['Aster Documentary Studio'],
      type: 'documentary',
      status: 'Finished',
      year: '2025',
      genre: 'Documentary',
      description: 'A documentary following how deliberate ritual reshapes purpose, habit, and identity across seasons of change.',
      url: 'https://example.com/documentary-examined-lives',
      thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80',
      publisher: 'Aster Documentary Studio',
      platform: 'Streaming',
      sourceProvider: 'manual',
      externalIds: { url: 'https://example.com/documentary-examined-lives' },
      tags: ['Meaning', 'Practice', 'Identity'],
      annotations: [
        { id: 'a11', text: 'Ritual gives continuity to identity before motivation catches up.', type: 'highlight', date: iso(14), conceptTags: ['Practice', 'Identity'], philosophyStatus: 'connected' },
        { id: 'a12', text: 'This example suggests practices can stabilize meaning, not just express it.', type: 'thought', date: iso(14, 14), conceptTags: ['Meaning', 'Practice'], philosophyStatus: 'connected', linkedPositionIds: ['v_commit_before_clarity'] },
      ],
      capture: {
        before: { expectation: 'Looking for narrative examples of how ritual shapes identity.' },
        after: { coreArgument: 'Ritual can carry a person through ambiguity before conviction fully forms.', heldUp: 'Practice creates a runway for meaning.', lasting: 'The documentary gives lived texture to the commitment-before-clarity belief.' },
        sessions: [{ id: 'rs6', sourceId: 'm_documentary_jodorowsky', date: iso(14), durationSeconds: 5100, totalElapsedSeconds: 5100, status: 'completed', notes: 'Strong bridge between practice and belief evolution.', createdAt: iso(14), updatedAt: iso(14) }],
      },
      dateAdded: iso(14),
      dateUpdated: iso(24),
    },
    {
      id: 'm_movie_paterson',
      title: 'Paterson',
      creator: 'Jim Jarmusch',
      creators: ['Jim Jarmusch'],
      type: 'movie',
      status: 'Finished',
      year: '2016',
      genre: 'Drama',
      description: 'A film about repetition, attention, and quiet forms of meaning inside an ordinary life.',
      url: 'https://example.com/paterson-film',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80',
      publisher: 'Amazon Studios',
      platform: 'Streaming',
      sourceProvider: 'manual',
      externalIds: { url: 'https://example.com/paterson-film' },
      tags: ['Attention', 'Meaning', 'Practice'],
      annotations: [
        { id: 'a13', text: 'Ordinary repetition can become meaning-bearing when attention is refined enough.', type: 'highlight', date: iso(15, 13), conceptTags: ['Attention', 'Meaning'], philosophyStatus: 'connected' },
        { id: 'a14', text: 'Why do I still assume meaningful life must feel dramatic?', type: 'question', date: iso(15, 15), answer: '', conceptTags: ['Meaning'], philosophyStatus: 'questioned', createdInquiryId: 'q_ordinary_meaning' },
      ],
      capture: {
        before: { priorBeliefs: 'Meaning needs scale or visible accomplishment.', expectation: 'Testing whether quiet repetition can still feel philosophical.' },
        after: { coreArgument: 'Attention can turn ordinary routine into a serious moral and aesthetic life.', heldUp: 'Meaning may depend more on mode of seeing than on spectacle.', beliefChange: 'I have less trust now in drama as a sign of seriousness.' },
        sessions: [{ id: 'rs7', sourceId: 'm_movie_paterson', date: iso(15), durationSeconds: 6600, totalElapsedSeconds: 6600, status: 'completed', notes: 'Produced a fresh inquiry about ordinary meaning.', createdAt: iso(15), updatedAt: iso(15) }],
      },
      dateAdded: iso(15),
      dateUpdated: iso(24),
    },
  ];

  const insights: Insight[] = [
    { id: 'i_story_failure', title: 'Failure tests the story of self', body: 'Narrative identity matters most when failure threatens the story that holds action together.', sourceIds: ['m_paper_identity'], tags: ['Identity', 'Narrative Self'], categories: ['idea'], connections: ['v_identity_action'], dateCreated: iso(14), dateUpdated: iso(14) },
    { id: 'i_design_discipline', title: 'Discipline is designed', body: 'What feels like character weakness is often an unstructured environment around attention.', sourceIds: ['m_podcast_huberman'], tags: ['Discipline', 'Attention', 'Practice'], categories: ['idea'], connections: ['v_attention_rule'], dateCreated: iso(15), dateUpdated: iso(15) },
    { id: 'i_meaning_action', title: 'Action can precede meaning', body: 'Meaning may be clarified by responsibility rather than discovered in advance of it.', sourceIds: ['m_article_meaning'], tags: ['Meaning', 'Responsibility'], categories: ['idea'], connections: ['v_commit_before_clarity'], dateCreated: iso(15), dateUpdated: iso(16) },
  ];

  const questions: Question[] = [
    { id: 'q_identity_excuse', text: 'What part of my current identity is maintained by excuses rather than commitments?', status: 'open', answer: '', evidenceIds: ['m_aurelius'], conceptIds: ['c_identity', 'c_responsibility'], sourceIds: ['m_aurelius'], beliefIds: ['v_identity_action'], draftIds: ['d_identity_essay'], type: 'annotation', sourceAnnotationId: 'a2', dateCreated: iso(8), dateUpdated: iso(20) },
    { id: 'q_narrative_distort', text: 'Does narrative coherence help or distort agency?', status: 'partially_answered', answer: 'It stabilizes action, but it can also protect the self from corrective evidence.', evidenceIds: ['m_paper_identity'], conceptIds: ['c_narrative', 'c_identity'], sourceIds: ['m_paper_identity'], beliefIds: ['v_identity_action'], draftIds: ['d_identity_essay'], type: 'annotation', sourceAnnotationId: 'a7', dateCreated: iso(11), dateUpdated: iso(22) },
    { id: 'q_discipline_without_meaning', text: 'Can discipline exist without meaning, or does it collapse into control for its own sake?', status: 'gathering_evidence', answer: '', evidenceIds: ['m_aurelius', 'm_article_meaning'], conceptIds: ['c_discipline', 'c_meaning'], sourceIds: ['m_aurelius', 'm_article_meaning'], beliefIds: ['v_attention_rule'], draftIds: ['d_field_notes'], type: 'manual', dateCreated: iso(9), dateUpdated: iso(21) },
    { id: 'q_responsibility_before_certainty', text: 'When should responsibility outrun clarity?', status: 'answered', answer: 'When values are strong enough that waiting for certainty becomes disguised avoidance.', evidenceIds: ['m_article_meaning', 'm_podcast_huberman'], conceptIds: ['c_responsibility', 'c_meaning', 'c_practice'], sourceIds: ['m_article_meaning', 'm_podcast_huberman'], beliefIds: ['v_commit_before_clarity'], draftIds: ['d_source_analysis'], type: 'manual', dateCreated: iso(10), dateUpdated: iso(23) },
    { id: 'q_ordinary_meaning', text: 'Why do I keep associating seriousness with drama rather than sustained attention?', status: 'under_tension', answer: '', evidenceIds: ['m_movie_paterson', 'm_video_dreyfus'], conceptIds: ['c_attention', 'c_meaning'], sourceIds: ['m_movie_paterson', 'm_video_dreyfus'], beliefIds: ['v_commit_before_clarity'], draftIds: ['d_field_notes'], type: 'annotation', sourceAnnotationId: 'a14', dateCreated: iso(15), dateUpdated: iso(24) },
    { id: 'q_archived_stoic', text: 'Is Stoic detachment the same thing as emotional maturity?', status: 'archived', answer: 'No. Detachment can be defensive; maturity keeps contact with feeling while choosing well.', evidenceIds: ['m_aurelius'], conceptIds: ['c_identity', 'c_discipline'], sourceIds: ['m_aurelius'], beliefIds: [], draftIds: [], type: 'manual', dateCreated: iso(8), dateUpdated: iso(19) },
  ];

  const vault: VaultEntry[] = [
    { id: 'v_identity_action', title: 'Identity is enacted before it is explained', type: 'worldview', statement: 'Identity is primarily built through repeated action, then narrated afterward.', description: 'A live position under tension with narrative theories of self; action remains primary, but story still matters.', confidence: 72, status: 'revised', tags: ['Identity', 'Narrative Self'], sourceIds: ['m_aurelius', 'm_paper_identity'], evidenceFor: ['Repeated behavior stabilizes identity.', 'Narrative accounts still rely on enacted continuity.'], evidenceAgainst: ['Stories can reframe action and future agency.', 'Trauma can reshape behavior through interpretation before action changes.'], versionHistory: [{ description: 'Initial action-first framing.', reason: 'Created from reading notes.', eventType: 'created', date: iso(12) }, { description: 'Revised to acknowledge narrative scaffolding.', reason: 'Paper on narrative identity introduced nuance.', eventType: 'revised', date: iso(22) }], createdFrom: 'manual', dateCreated: iso(12), dateUpdated: iso(22) },
    { id: 'v_attention_rule', title: 'Attention must be protected before it can be directed', type: 'principle', statement: 'Attention is too porous to trust to mood alone; it must be protected by ritual and environment.', description: 'A supported principle linking discipline to environmental design rather than raw willpower.', confidence: 86, status: 'active', tags: ['Attention', 'Discipline', 'Practice'], sourceIds: ['m_aurelius', 'm_podcast_huberman'], evidenceFor: ['Morning rituals reduce media-driven drift.', 'Captured notes show environmental triggers precede distraction.'], evidenceAgainst: ['Some focus failures persist even in good conditions.'], versionHistory: [{ description: 'Formed from podcast notes and practice experiments.', eventType: 'created', date: iso(16) }], createdFrom: 'idea', sourceAnnotationId: 'a9', dateCreated: iso(16), dateUpdated: iso(24) },
    { id: 'v_commit_before_clarity', title: 'Commitment can generate meaning before certainty exists', type: 'belief', statement: 'Some forms of meaning appear only after a responsibility is accepted and lived.', description: 'A supported but still somewhat tentative belief about action preceding full understanding.', confidence: 68, status: 'active', tags: ['Meaning', 'Responsibility', 'Practice'], sourceIds: ['m_article_meaning', 'm_podcast_huberman'], evidenceFor: ['Action sometimes reveals values more clearly than contemplation.', 'Practices create data the mind alone cannot.'], evidenceAgainst: ['Premature commitment can trap a person in a false path.'], versionHistory: [{ description: 'Created from article annotation.', eventType: 'created', date: iso(17) }], createdFrom: 'idea', sourceAnnotationId: 'a5', dateCreated: iso(17), dateUpdated: iso(23) },
    { id: 'v_character_in_motion', title: 'Response to friction is philosophy in motion', type: 'mental_model', statement: 'Pressure exposes the practical structure of a worldview more clearly than polished articulation.', description: 'A well-supported mental model generated from Stoic notes and practice review.', confidence: 81, status: 'active', tags: ['Responsibility', 'Practice'], sourceIds: ['m_aurelius'], evidenceFor: ['Resistance moments reveal actual governing values.'], evidenceAgainst: ['Momentary stress can distort behavior in unrepresentative ways.'], versionHistory: [{ description: 'Created from Meditations annotation.', eventType: 'created', date: iso(18) }], createdFrom: 'idea', sourceAnnotationId: 'a3', dateCreated: iso(18), dateUpdated: iso(21) },
    { id: 'v_pure_story_self', title: 'Identity is fundamentally narrative', type: 'worldview', statement: 'The self is best understood as a story that organizes memory, motive, and aspiration.', description: 'A deliberately conflicting position kept active for tension analysis against action-first identity.', confidence: 49, status: 'challenged', tags: ['Identity', 'Narrative Self'], sourceIds: ['m_paper_identity'], evidenceFor: ['Narrative continuity gives agency durability.'], evidenceAgainst: ['Action changes identity even when stories lag behind.'], versionHistory: [{ description: 'Imported as a competing position for review.', eventType: 'created', date: iso(19) }], createdFrom: 'manual', dateCreated: iso(19), dateUpdated: iso(22) },
    { id: 'v_withdrawal_rule', title: 'Withdrawal protects identity from failure', type: 'belief', statement: 'Avoidance often protects the story of self from evidence of limitation.', description: 'A personally useful but currently abandoned explanatory belief after more careful review.', confidence: 34, status: 'abandoned', tags: ['Identity', 'Meaning'], sourceIds: ['m_article_meaning'], evidenceFor: ['Avoidance spikes before ambiguous high-stakes work.'], evidenceAgainst: ['Fatigue and overload also drive avoidance.'], versionHistory: [{ description: 'Created from reflection on work avoidance.', eventType: 'created', date: iso(15) }, { description: 'Demoted after noticing the belief was too totalizing.', eventType: 'abandoned', date: iso(24) }], createdFrom: 'manual', dateCreated: iso(15), dateUpdated: iso(24) },
  ];

  const drafts: Draft[] = [
    { id: 'd_identity_essay', title: 'Identity As Repeated Choice', body: 'Drafting an essay on whether identity is better understood as practiced action or narrative coherence.', type: 'essay', status: 'drafting', label: 'Essay', workCategory: 'writing', paperType: 'blank_paper', draftContent: '<p>Identity may be less an essence than a record of repeated choices.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'blank_paper', conceptTags: ['Identity', 'Narrative Self'], sourceIds: ['m_aurelius', 'm_paper_identity'], questionIds: ['q_identity_excuse', 'q_narrative_distort'], beliefIds: ['v_identity_action', 'v_pure_story_self'], dateCreated: iso(18), dateUpdated: iso(23) },
    { id: 'd_field_notes', title: 'Morning Friction Log', body: 'Three mornings of observing how distraction starts before the work itself begins.', type: 'field_note', status: 'revised', label: 'Field Note', workCategory: 'writing', paperType: 'cornell_notes', draftContent: '<p>Before starting the task, I reached for news twice and email once.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'cornell_notes', conceptTags: ['Attention', 'Discipline', 'Practice'], sourceIds: ['m_podcast_huberman'], questionIds: ['q_discipline_without_meaning'], beliefIds: ['v_attention_rule'], dateCreated: iso(19), dateUpdated: iso(24) },
    { id: 'd_source_analysis', title: 'Meaning Before Clarity', body: 'A source analysis comparing enacted meaning against purely contemplative meaning.', type: 'source_analysis', status: 'drafting', label: 'Source Analysis', workCategory: 'writing', paperType: 'source_analysis', draftContent: '<p>The article argues that responsibility can create meaning, not merely follow it.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'source_analysis', conceptTags: ['Meaning', 'Responsibility'], sourceIds: ['m_article_meaning'], questionIds: ['q_responsibility_before_certainty'], beliefIds: ['v_commit_before_clarity'], dateCreated: iso(20), dateUpdated: iso(23) },
    { id: 'd_voice_note', title: 'Voice Note: Action Before Understanding', body: 'Spoken notes after a walk about whether commitment can precede clarity.', type: 'voice_note', status: 'seed', label: 'Voice Note', workCategory: 'notes', durationSeconds: 143, fileUrl: 'https://example.com/demo/noesis-voice-note.mp3', conceptTags: ['Meaning', 'Responsibility'], sourceIds: ['m_article_meaning'], questionIds: ['q_responsibility_before_certainty'], beliefIds: ['v_commit_before_clarity'], dateCreated: iso(21), dateUpdated: iso(21) },
    { id: 'd_drawing', title: 'Attention Ritual Sketch', body: 'A visual routine map showing how workspace cues shape attention.', type: 'drawing', status: 'drafting', label: 'Drawing', workCategory: 'drawing', canvasData: '', thumbnailUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=900&q=80', conceptTags: ['Attention', 'Practice'], sourceIds: ['m_podcast_huberman'], questionIds: [], beliefIds: ['v_attention_rule'], dateCreated: iso(21), dateUpdated: iso(24) },
    { id: 'd_recording', title: 'Recorded Reflection: On Friction', body: 'A captured screen reflection walking through where discipline collapses under ambiguity.', type: 'recording', status: 'seed', label: 'Recording', workCategory: 'recording', recordingType: 'video', durationSeconds: 318, fileUrl: 'https://example.com/demo/noesis-recording.mp4', conceptTags: ['Discipline', 'Practice'], sourceIds: ['m_podcast_huberman', 'm_aurelius'], questionIds: ['q_discipline_without_meaning'], beliefIds: ['v_attention_rule', 'v_character_in_motion'], dateCreated: iso(22), dateUpdated: iso(22) },
    { id: 'd_imported_doc', title: 'Private Philosophy Memo', body: 'Imported from an external document to show cross-platform writing flow.', type: 'manuscript', status: 'drafting', label: 'Imported Doc', workCategory: 'writing', paperType: 'manuscript', draftContent: '<p>This document lives outside Noesis but remains linked back into the workspace.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'manuscript', externalDoc: { provider: 'google_docs', title: 'Private Philosophy Memo', url: 'https://docs.google.com/document/d/demo-noesis-memo/edit', documentId: 'demo-noesis-memo', autoSync: true, lastSyncedAt: iso(24), syncStatus: 'synced' }, conceptTags: ['Meaning', 'Identity'], sourceIds: ['m_aurelius', 'm_article_meaning'], questionIds: ['q_identity_excuse'], beliefIds: ['v_identity_action'], dateCreated: iso(23), dateUpdated: iso(24) },
  ];

  const practices: Practice[] = [
    { id: 'p_attention_fast', title: 'Begin work before consuming media', description: 'For 7 days, start the highest-value task before checking news, messages, or social feeds.', type: 'challenge', status: 'active', durationDays: 7, startDate: iso(24), endDate: iso(30), conceptTags: ['Attention', 'Discipline', 'Practice'], sourceIds: ['m_podcast_huberman'], questionIds: ['q_discipline_without_meaning'], positionIds: ['v_attention_rule'], draftIds: ['d_field_notes'], notes: 'This is the practice test attached to the attention-protection principle.', logDates: [iso(24), iso(25), iso(26)], dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'p_failure_log', title: 'Log identity-protective avoidance', description: 'For one week, note moments where avoidance seems designed to protect self-image from failure.', type: 'observation', status: 'active', durationDays: 7, startDate: iso(23), endDate: iso(29), conceptTags: ['Identity', 'Meaning'], sourceIds: ['m_article_meaning'], questionIds: ['q_identity_excuse'], positionIds: ['v_withdrawal_rule'], draftIds: ['d_field_notes'], notes: 'Use this to test whether avoidance is really about identity or sometimes just overload.', logDates: [iso(23), iso(24)], dateCreated: iso(23), dateUpdated: iso(25) },
    { id: 'p_responsibility_block', title: 'Weekly responsibility review', description: 'End the week by naming one obligation you avoided and one obligation you carried well.', type: 'reflection_prompt', status: 'planned', durationDays: 21, startDate: iso(27), endDate: iso(48), conceptTags: ['Responsibility', 'Meaning', 'Practice'], sourceIds: ['m_aurelius', 'm_article_meaning'], questionIds: ['q_responsibility_before_certainty'], positionIds: ['v_commit_before_clarity', 'v_character_in_motion'], draftIds: ['d_source_analysis'], notes: 'Designed to close the loop between thought and action.', logDates: [], dateCreated: iso(25), dateUpdated: iso(25) },
  ];

  const links: PhilosophicalLink[] = [
    { id: 'l1', fromType: 'concept', fromId: 'c_attention', fromLabel: 'Attention', toType: 'position', toId: 'v_attention_rule', toLabel: 'Attention must be protected before it can be directed', type: 'supports', note: 'The concept gives structure to the position.', createdFrom: 'manual', dateCreated: iso(16), dateUpdated: iso(16) },
    { id: 'l2', fromType: 'concept', fromId: 'c_narrative', fromLabel: 'Narrative Self', toType: 'position', toId: 'v_identity_action', toLabel: 'Identity is enacted before it is explained', type: 'refines', note: 'Narrative softens the action-first claim without replacing it.', createdFrom: 'manual', dateCreated: iso(22), dateUpdated: iso(22) },
    { id: 'l3', fromType: 'position', fromId: 'v_pure_story_self', fromLabel: 'Identity is fundamentally narrative', toType: 'position', toId: 'v_identity_action', toLabel: 'Identity is enacted before it is explained', type: 'contradicts', note: 'Competing center of gravity for identity formation.', createdFrom: 'manual', dateCreated: iso(22), dateUpdated: iso(22) },
    { id: 'l4', fromType: 'source', fromId: 'm_article_meaning', fromLabel: 'Meaning Crisis and Modern Responsibility', toType: 'position', toId: 'v_commit_before_clarity', toLabel: 'Commitment can generate meaning before certainty exists', type: 'supports', note: 'Primary evidence source.', createdFrom: 'system', dateCreated: iso(17), dateUpdated: iso(17) },
    { id: 'l5', fromType: 'inquiry', fromId: 'q_discipline_without_meaning', fromLabel: 'Can discipline exist without meaning?', toType: 'position', toId: 'v_attention_rule', toLabel: 'Attention must be protected before it can be directed', type: 'challenges', note: 'Pushes the principle to justify its end.', createdFrom: 'manual', dateCreated: iso(21), dateUpdated: iso(21) },
    { id: 'l6', fromType: 'position', fromId: 'v_attention_rule', fromLabel: 'Attention must be protected before it can be directed', toType: 'practice', toId: 'p_attention_fast', toLabel: 'Begin work before consuming media', type: 'tested_by', note: 'Direct behavioral test.', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(24) },
    { id: 'l7', fromType: 'position', fromId: 'v_commit_before_clarity', fromLabel: 'Commitment can generate meaning before certainty exists', toType: 'work', toId: 'd_source_analysis', toLabel: 'Meaning Before Clarity', type: 'expressed_in', note: 'Developed into a written analysis.', createdFrom: 'system', dateCreated: iso(23), dateUpdated: iso(23) },
    { id: 'l8', fromType: 'concept', fromId: 'c_practice', fromLabel: 'Practice', toType: 'position', toId: 'v_character_in_motion', toLabel: 'Response to friction is philosophy in motion', type: 'exemplifies', note: 'Practice shows the position in lived form.', createdFrom: 'manual', dateCreated: iso(19), dateUpdated: iso(19) },
    { id: 'l9', fromType: 'source', fromId: 'm_podcast_huberman', fromLabel: 'Ritual, Attention, and Behavioral Change', toType: 'concept', toId: 'c_attention', toLabel: 'Attention', type: 'inspired_by', note: 'The source expanded the concept footprint.', createdFrom: 'system', dateCreated: iso(12), dateUpdated: iso(12) },
    { id: 'l10', fromType: 'position', fromId: 'v_withdrawal_rule', fromLabel: 'Withdrawal protects identity from failure', toType: 'evolution', toId: 't_abandoned_withdrawal', toLabel: 'Abandoned overgeneralized withdrawal belief', type: 'changed_by', note: 'The position was later retired.', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(24) },
    { id: 'l11', fromType: 'position', fromId: 'v_commit_before_clarity', fromLabel: 'Commitment can generate meaning before certainty exists', toType: 'position', toId: 'v_character_in_motion', toLabel: 'Response to friction is philosophy in motion', type: 'depends_on', note: 'The meaning claim depends on pressure revealing whether a commitment is real.', createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(24) },
    { id: 'l12', fromType: 'concept', fromId: 'c_meaning', fromLabel: 'Meaning', toType: 'position', toId: 'v_commit_before_clarity', toLabel: 'Commitment can generate meaning before certainty exists', type: 'explains', note: 'The concept provides the explanatory center for the position.', createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(24) },
  ];

  const suggestions: AiSuggestion[] = [
    { id: 's1', targetType: 'annotation', targetId: 'a2', targetLabel: 'Identity excuse annotation', suggestionType: 'annotation_consequence', title: 'Possible inquiry', body: 'This note naturally becomes an inquiry about avoidance and self-protection.', payload: { suggestedConcept: 'Identity', suggestedInquiry: 'What part of identity is preserved by avoidance?' }, status: 'accepted', createdFrom: 'ai', dateCreated: iso(8, 15), dateUpdated: iso(8, 16) },
    { id: 's2', targetType: 'position', targetId: 'v_identity_action', targetLabel: 'Identity is enacted before it is explained', suggestionType: 'possible_tension', title: 'Possible tension', body: 'This position may conflict with the narrative-self position unless action and story are distinguished more carefully.', payload: { opposingPositionId: 'v_pure_story_self', suggestedLinkType: 'contradicts' }, status: 'accepted', createdFrom: 'ai', dateCreated: iso(22, 13), dateUpdated: iso(22, 15) },
    { id: 's3', targetType: 'concept', targetId: 'c_meaning', targetLabel: 'Meaning', suggestionType: 'position_draft', title: 'Draft position from sources', body: 'Action can uncover meaning before reflective certainty arrives.', payload: { sourceIds: ['m_article_meaning'], confidence: 'medium' }, status: 'accepted', createdFrom: 'ai', dateCreated: iso(17, 10), dateUpdated: iso(17, 12) },
    { id: 's4', targetType: 'inquiry', targetId: 'q_discipline_without_meaning', targetLabel: 'Can discipline exist without meaning?', suggestionType: 'daily_prompt', title: 'Best next step', body: 'Open the field note and add one concrete example where discipline held or failed this week.', payload: { route: 'writing', draftId: 'd_field_notes' }, status: 'pending', createdFrom: 'ai', dateCreated: iso(25), dateUpdated: iso(25) },
    { id: 's5', targetType: 'source', targetId: 'm_paper_identity', targetLabel: 'Narrative Identity and Agency Under Uncertainty', suggestionType: 'annotation_consequence', title: 'Extracted concept', body: 'Several annotations cluster around narrative self as its own organizing concept.', payload: { suggestedConcept: 'Narrative Self' }, status: 'accepted', createdFrom: 'ai', dateCreated: iso(11, 16), dateUpdated: iso(11, 16) },
    { id: 's6', targetType: 'evolution', targetId: 't_revision_identity', targetLabel: 'Identity revision event', suggestionType: 'evolution_summary', title: 'Revision summary', body: 'The action-first identity view was revised after narrative evidence complicated the earlier formulation.', payload: { positionId: 'v_identity_action' }, status: 'accepted', createdFrom: 'ai', dateCreated: iso(22, 16), dateUpdated: iso(22, 16) },
    { id: 's7', targetType: 'position', targetId: 'v_withdrawal_rule', targetLabel: 'Withdrawal protects identity from failure', suggestionType: 'unknown_candidate', title: 'Possible unknown', body: 'The current evidence does not separate identity-protective withdrawal from fatigue-driven withdrawal.', reasoning: 'Several notes challenge the belief without resolving which mechanism dominates.', evidence: ['Avoidance spikes before ambiguous work.', 'Fatigue and overload remain plausible alternatives.'], confidence: 0.78, payload: { unknownTitle: 'What actually drives avoidance under ambiguity?' }, status: 'accepted', createdFrom: 'ai', dateCreated: iso(24, 10), dateUpdated: iso(24, 12) },
    { id: 's8', targetType: 'inquiry', targetId: 'q_ordinary_meaning', targetLabel: 'Why do I keep associating seriousness with drama?', suggestionType: 'missing_perspective', title: 'Missing perspective', body: 'You may be missing an aesthetic perspective on meaning that values attention and form over intensity.', reasoning: 'Recent sources emphasize repetition, craft, and perception more than achievement or crisis.', evidence: ['Paterson notes', 'Embodiment lecture notes'], confidence: 0.71, status: 'pending', createdFrom: 'ai', dateCreated: iso(25, 11), dateUpdated: iso(25, 11) },
  ];

  const timeline: TimelineEvent[] = [
    { id: 't_created_identity', entityId: 'v_identity_action', entityType: 'vault', entityTitle: 'Identity is enacted before it is explained', eventType: 'created', reason: 'Created from reading Meditations and early identity notes.', influencedBy: ['m_aurelius'], date: iso(12) },
    { id: 't_created_attention', entityId: 'v_attention_rule', entityType: 'vault', entityTitle: 'Attention must be protected before it can be directed', eventType: 'created', reason: 'Podcast notes and personal experiments converged into a principle.', influencedBy: ['m_podcast_huberman'], date: iso(16) },
    { id: 't_created_commit', entityId: 'v_commit_before_clarity', entityType: 'vault', entityTitle: 'Commitment can generate meaning before certainty exists', eventType: 'created', reason: 'Article analysis moved into a position.', influencedBy: ['m_article_meaning'], date: iso(17) },
    { id: 't_created_motion', entityId: 'v_character_in_motion', entityType: 'vault', entityTitle: 'Response to friction is philosophy in motion', eventType: 'created', reason: 'A highlight became a mental model.', influencedBy: ['m_aurelius'], date: iso(18) },
    { id: 't_work_identity', entityId: 'd_identity_essay', entityType: 'draft', entityTitle: 'Identity As Repeated Choice', eventType: 'expanded', reason: 'Became the working essay for the identity cluster.', influencedBy: ['v_identity_action', 'q_narrative_distort'], date: iso(20) },
    { id: 't_practice_attention', entityId: 'p_attention_fast', entityType: 'practice', entityTitle: 'Begin work before consuming media', eventType: 'created', reason: 'Created as a direct test of the attention principle.', influencedBy: ['v_attention_rule'], date: iso(24) },
    { id: 't_revision_identity', entityId: 'v_identity_action', entityType: 'vault', entityTitle: 'Identity is enacted before it is explained', eventType: 'revised', reason: 'Narrative evidence forced a more nuanced formulation.', influencedBy: ['m_paper_identity', 'v_pure_story_self'], date: iso(22) },
    { id: 't_challenged_story', entityId: 'v_pure_story_self', entityType: 'vault', entityTitle: 'Identity is fundamentally narrative', eventType: 'challenged', reason: 'The action-first position exposed gaps in a pure narrative account.', influencedBy: ['v_identity_action'], date: iso(22) },
    { id: 't_abandoned_withdrawal', entityId: 'v_withdrawal_rule', entityType: 'vault', entityTitle: 'Withdrawal protects identity from failure', eventType: 'abandoned', reason: 'Observed the belief was too totalizing and ignored fatigue variables.', influencedBy: ['p_failure_log'], date: iso(24) },
    { id: 't_source_identity', entityId: 'm_paper_identity', entityType: 'media', entityTitle: 'Narrative Identity and Agency Under Uncertainty', eventType: 'expanded', reason: 'Paper introduced a stronger narrative counterweight.', influencedBy: [], date: iso(11) },
  ];

  const beliefProfiles: BeliefProfile[] = [
    { positionId: 'v_identity_action', createdAt: iso(12), createdFrom: 'manual', originSummary: 'Created from Meditations notes and later revised after narrative-self evidence complicated the original claim.', strengthenedBy: ['Repeated behavior observations', 'Identity essay draft'], challengedBy: ['Narrative identity paper', 'Competing worldview position'], weakenedBy: [], lastChallengedAt: iso(22), lastRevisedAt: iso(22), confidenceScore: 72, certaintyLevel: 3, evidenceQuality: 'moderate', testingCount: 1, reviewStatus: 'current', updatedAt: iso(24) },
    { positionId: 'v_attention_rule', createdAt: iso(16), createdFrom: 'idea', originSummary: 'Derived from podcast notes and personal experiments around distraction triggers.', strengthenedBy: ['Morning friction log', 'Active attention practice'], challengedBy: ['Inquiry about discipline without meaning'], weakenedBy: [], confidenceScore: 86, certaintyLevel: 4, evidenceQuality: 'high', testingCount: 2, reviewStatus: 'current', updatedAt: iso(24) },
    { positionId: 'v_commit_before_clarity', createdAt: iso(17), createdFrom: 'idea', originSummary: 'Formed from article and documentary evidence that action can reveal meaning.', strengthenedBy: ['Meaning article', 'Documentary on ritual'], challengedBy: ['Risk of premature commitment'], weakenedBy: [], confidenceScore: 68, certaintyLevel: 3, evidenceQuality: 'moderate', testingCount: 1, reviewStatus: 'current', updatedAt: iso(24) },
    { positionId: 'v_character_in_motion', createdAt: iso(18), createdFrom: 'idea', originSummary: 'Formed from Stoic notes about resistance as a test of character.', strengthenedBy: ['Meditations highlight', 'Practice review'], challengedBy: [], weakenedBy: [], confidenceScore: 81, certaintyLevel: 4, evidenceQuality: 'high', testingCount: 1, reviewStatus: 'current', updatedAt: iso(24) },
    { positionId: 'v_pure_story_self', createdAt: iso(19), createdFrom: 'manual', originSummary: 'Added intentionally as a live competing theory of self.', strengthenedBy: ['Narrative continuity evidence'], challengedBy: ['Action-first identity view'], weakenedBy: ['Observed action shifts that outpaced self-story'], lastChallengedAt: iso(22), confidenceScore: 49, certaintyLevel: 2, evidenceQuality: 'moderate', testingCount: 0, reviewStatus: 'needs_review', updatedAt: iso(24) },
    { positionId: 'v_withdrawal_rule', createdAt: iso(15), createdFrom: 'manual', originSummary: 'Came from a self-explanation of avoidance before fatigue variables were taken seriously.', strengthenedBy: ['Observed avoidance before high-stakes work'], challengedBy: ['Practice logs', 'Alternative fatigue explanation'], weakenedBy: ['The belief overgeneralized across too many cases'], confidenceScore: 34, certaintyLevel: 1, evidenceQuality: 'low', testingCount: 1, reviewStatus: 'abandoned', abandonedAt: iso(24), updatedAt: iso(24) },
  ];

  const unknowns: Unknown[] = [
    { unknownId: 'u_avoidance_driver', title: 'What actually drives avoidance under ambiguity?', description: 'The current workspace has not yet separated identity-protection from fatigue, ambiguity, and overload.', domain: 'identity', sourceIds: ['m_article_meaning'], positionIds: ['v_withdrawal_rule'], inquiryIds: ['q_identity_excuse'], conceptTags: ['Identity', 'Meaning'], questionIds: ['q_identity_excuse'], status: 'active', importance: 'high', createdFrom: 'ai', dateCreated: iso(24), dateUpdated: iso(24) },
    { unknownId: 'u_ordinary_meaning', title: 'How does ordinary routine become meaning-bearing?', description: 'The app has evidence that attention matters, but the mechanism linking repetition to meaning is still underdeveloped.', domain: 'meaning', sourceIds: ['m_movie_paterson', 'm_video_dreyfus'], positionIds: ['v_commit_before_clarity'], inquiryIds: ['q_ordinary_meaning'], conceptTags: ['Meaning', 'Attention'], questionIds: ['q_ordinary_meaning'], status: 'exploring', importance: 'medium', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(25) },
    { unknownId: 'u_stoic_detachment', title: 'When does detachment become avoidance?', description: 'This was a prior gap that now has a stable working answer.', domain: 'discipline', sourceIds: ['m_aurelius'], positionIds: [], inquiryIds: ['q_archived_stoic'], conceptTags: ['Discipline', 'Identity'], questionIds: ['q_archived_stoic'], status: 'resolved', importance: 'medium', createdFrom: 'system', dateCreated: iso(8), dateUpdated: iso(19), resolvedAt: iso(19), resolutionSummary: 'Resolved by distinguishing maturity from emotional distance.' },
  ];

  const thinkingPatterns: ThinkingPattern[] = [
    { patternId: 'tp_revision_after_annotations', patternType: 'revision_pattern', label: 'Beliefs tend to revise after annotation clusters form', description: 'Recent evidence suggests that revision happens most often after several related annotations accumulate around one concept.', evidence: ['Identity position revised after Meditations and narrative-paper annotations', 'Meaning position sharpened after article and documentary notes'], confidence: 0.83, timespan: 'Last 30 days', trendDirection: 'stable', status: 'acknowledged', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(24) },
    { patternId: 'tp_source_to_practice_gap', patternType: 'conceptual_gap', label: 'Concepts are linked more often than they are tested', description: 'The workspace shows strong connection-making, but fewer ideas are translated into practices than into positions or works.', evidence: ['Concept density exceeds practice count', 'Only a subset of positions have active practices'], confidence: 0.77, timespan: 'Last 30 days', trendDirection: 'increasing', status: 'pending', createdFrom: 'ai', dateCreated: iso(25), dateUpdated: iso(25) },
    { patternId: 'tp_questioning_meaning', patternType: 'questioning_style', label: 'Meaning questions recur through responsibility and attention', description: 'Questions about meaning repeatedly route through responsibility, ritual, and forms of attention rather than abstract theory alone.', evidence: ['Responsibility-before-certainty inquiry', 'Ordinary meaning inquiry', 'Article and film annotations'], confidence: 0.8, timespan: 'Current season', trendDirection: 'stable', status: 'acknowledged', createdFrom: 'ai', dateCreated: iso(25), dateUpdated: iso(25) },
  ];

  const thinkingMetrics: ThinkingMetrics = {
    ...DEFAULT_THINKING_METRICS,
    questionsAsked: 6,
    assumptionsChallenged: 4,
    beliefsCreated: 6,
    beliefsRevised: 2,
    beliefsAbandoned: 1,
    contradictionsDetected: 1,
    contradictionsResolved: 0,
    connectionsCreated: 12,
    sourcesStudied: 7,
    ideasSynthesized: 3,
    unknownsCreated: 3,
    unknownsResolved: 1,
    positionsStressTested: 2,
    lastComputedAt: iso(26),
  };

  const thinkingEvents: ThinkingEvent[] = [
    { id: 'te1', eventId: 'te1', userId: uid, eventType: 'position_created', entityType: 'position', entityId: 'v_identity_action', targetType: 'position', targetId: 'v_identity_action', sourceType: 'user', summary: 'Created the action-first identity position from Meditations notes.', origin: 'user', importance: 'medium', relatedEntityIds: { sourceIds: ['m_aurelius'] }, createdAt: iso(12), updatedAt: iso(12) },
    { id: 'te2', eventId: 'te2', userId: uid, eventType: 'position_revised', entityType: 'position', entityId: 'v_identity_action', targetType: 'position', targetId: 'v_identity_action', sourceType: 'user', summary: 'Revised the identity position after narrative evidence complicated the original framing.', origin: 'user', importance: 'high', relatedEntityIds: { sourceIds: ['m_paper_identity'], positionIds: ['v_pure_story_self'] }, confidenceBefore: 81, confidenceAfter: 72, createdAt: iso(22), updatedAt: iso(22) },
    { id: 'te3', eventId: 'te3', userId: uid, eventType: 'confidence_changed', entityType: 'position', entityId: 'v_pure_story_self', targetType: 'position', targetId: 'v_pure_story_self', sourceType: 'system', summary: 'Lowered confidence in the pure narrative-self position after contradiction review.', origin: 'system', importance: 'medium', confidenceBefore: 61, confidenceAfter: 49, relatedEntityIds: { positionIds: ['v_identity_action'] }, createdAt: iso(22, 14), updatedAt: iso(22, 14) },
    { id: 'te4', eventId: 'te4', userId: uid, eventType: 'challenge_added', entityType: 'position', entityId: 'v_attention_rule', targetType: 'position', targetId: 'v_attention_rule', sourceType: 'user', summary: 'Added a challenge asking whether discipline without meaning collapses into control.', origin: 'user', importance: 'medium', relatedEntityIds: { inquiryIds: ['q_discipline_without_meaning'] }, createdAt: iso(21), updatedAt: iso(21) },
    { id: 'te5', eventId: 'te5', userId: uid, eventType: 'position_abandoned', entityType: 'position', entityId: 'v_withdrawal_rule', targetType: 'position', targetId: 'v_withdrawal_rule', sourceType: 'user', summary: 'Abandoned the withdrawal rule after noticing it overgeneralized beyond the evidence.', origin: 'user', importance: 'high', relatedEntityIds: { practiceIds: ['p_failure_log'] }, createdAt: iso(24), updatedAt: iso(24) },
    { id: 'te6', eventId: 'te6', userId: uid, eventType: 'unknown_created', entityType: 'unknown', entityId: 'u_avoidance_driver', targetType: 'unknown', targetId: 'u_avoidance_driver', sourceType: 'ai', summary: 'Created an unknown around what actually drives avoidance under ambiguity.', origin: 'ai', importance: 'medium', relatedEntityIds: { positionIds: ['v_withdrawal_rule'], inquiryIds: ['q_identity_excuse'] }, createdAt: iso(24, 12), updatedAt: iso(24, 12) },
    { id: 'te7', eventId: 'te7', userId: uid, eventType: 'unknown_resolved', entityType: 'unknown', entityId: 'u_stoic_detachment', targetType: 'unknown', targetId: 'u_stoic_detachment', sourceType: 'system', summary: 'Resolved the detachment unknown by distinguishing maturity from avoidance.', origin: 'system', importance: 'medium', relatedEntityIds: { inquiryIds: ['q_archived_stoic'] }, createdAt: iso(19), updatedAt: iso(19) },
    { id: 'te8', eventId: 'te8', userId: uid, eventType: 'suggestion_accepted', entityType: 'suggestion', entityId: 's2', targetType: 'suggestion', targetId: 's2', relatedTargetType: 'position', relatedTargetId: 'v_identity_action', sourceType: 'user', summary: 'Accepted the possible-tension suggestion between action-first and narrative identity positions.', origin: 'user', importance: 'medium', relatedEntityIds: { positionIds: ['v_identity_action', 'v_pure_story_self'], suggestionIds: ['s2'] }, createdAt: iso(22, 15), updatedAt: iso(22, 15) },
    { id: 'te9', eventId: 'te9', userId: uid, eventType: 'thinking_pattern_inferred', entityType: 'thinkingPattern', entityId: 'tp_revision_after_annotations', targetType: 'thinking_pattern', targetId: 'tp_revision_after_annotations', sourceType: 'ai', summary: 'Inferred that belief revisions tend to follow annotation clustering.', origin: 'ai', importance: 'low', createdAt: iso(24), updatedAt: iso(24) },
    { id: 'te10', eventId: 'te10', userId: uid, eventType: 'stress_test_answered', entityType: 'position', entityId: 'v_commit_before_clarity', targetType: 'position', targetId: 'v_commit_before_clarity', sourceType: 'user', summary: 'Answered a stress test about what would weaken the commitment-before-clarity belief.', origin: 'user', importance: 'medium', relatedEntityIds: { practiceIds: ['p_responsibility_block'], workIds: ['d_source_analysis'] }, createdAt: iso(25), updatedAt: iso(25) },
  ];

  const atlasMaps: AtlasMap[] = [
    {
      id: 'map_identity_engine',
      title: 'Identity Engine',
      description: 'A reviewer-friendly custom map linking the app’s major philosophy loop from source to position to practice.',
      nodeNames: ['Identity', 'Narrative Self', 'Discipline', 'Attention', 'Meaning', 'Responsibility', 'Practice'],
      nodePositions: {
        Identity: { x: 44, y: 18 },
        'Narrative Self': { x: 24, y: 34 },
        Discipline: { x: 66, y: 26 },
        Attention: { x: 78, y: 50 },
        Meaning: { x: 56, y: 68 },
        Responsibility: { x: 34, y: 62 },
        Practice: { x: 49, y: 84 },
      },
      manualLinks: [
        { id: 'aml1', from: 'Identity', to: 'Narrative Self', type: 'custom', label: 'competing center', note: 'Reviewer map note: these positions need comparison, not forced collapse.', dateCreated: iso(22) },
        { id: 'aml2', from: 'Discipline', to: 'Attention', type: 'supports', label: 'protects', note: 'Discipline shows up here as a protection structure for attention.', dateCreated: iso(24) },
        { id: 'aml3', from: 'Responsibility', to: 'Practice', type: 'tested_by', label: 'requires test', note: 'Responsibility should cash out in a behavioral practice.', dateCreated: iso(24) },
      ],
      autoLinkFilters: { sharedSources: true, sharedPositions: true, sharedInquiries: true, sharedWorks: true, sharedPractices: true, conceptLinks: true },
      dateCreated: iso(22),
      dateUpdated: iso(24),
    },
    {
      id: 'map_meaning_loop',
      title: 'Meaning Loop Review Map',
      description: 'A custom reviewer map showing how sources, inquiry, position, work, and practice cycle around the meaning question.',
      nodeNames: ['Meaning', 'Responsibility', 'Practice', 'Attention', 'Identity'],
      nodePositions: {
        Meaning: { x: 52, y: 18 },
        Responsibility: { x: 28, y: 38 },
        Practice: { x: 36, y: 72 },
        Attention: { x: 71, y: 62 },
        Identity: { x: 73, y: 30 },
      },
      manualLinks: [
        { id: 'aml4', from: 'Meaning', to: 'Responsibility', type: 'explains', label: 'explains', note: 'Responsibility is one of the main routes through which meaning gets tested.', dateCreated: iso(25) },
        { id: 'aml5', from: 'Responsibility', to: 'Practice', type: 'tested_by', label: 'tested by', note: 'Reviewers can trace how the belief cashes out in a live practice.', dateCreated: iso(25) },
        { id: 'aml6', from: 'Attention', to: 'Meaning', type: 'refines', label: 'refines', note: 'Attention may change what meaning even feels like in ordinary life.', dateCreated: iso(25) },
      ],
      autoLinkFilters: { sharedSources: true, sharedPositions: true, sharedInquiries: true, sharedWorks: true, sharedPractices: true, conceptLinks: true },
      dateCreated: iso(25),
      dateUpdated: iso(25),
    },
  ];

  const goal: GoalSettings = {
    ...DEFAULT_GOAL_SETTINGS,
    label: 'Reviewer Demo Goals',
    targets: { book: 6, paper: 4, article: 8, podcast: 6, video: 6, movie: 2, documentary: 2, audiobook: 2 },
    goalTypes: [
      { id: 'goal-books', name: 'Books & Papers', mediaTypes: ['book', 'paper'], sortOrder: 0, createdAt: iso(1), updatedAt: iso(24) },
      { id: 'goal-media', name: 'Talks & Listening', mediaTypes: ['podcast', 'video', 'lecture', 'conversation'], sortOrder: 1, createdAt: iso(1), updatedAt: iso(24) },
      { id: 'goal-essays', name: 'Essays & Articles', mediaTypes: ['article', 'documentary'], sortOrder: 2, createdAt: iso(1), updatedAt: iso(24) },
    ],
    goals: [
      { id: 'goal-books-1', title: 'Books & Papers', typeId: 'goal-books', currentProgress: 2, targetProgress: 10, sortOrder: 0, status: 'active', createdAt: iso(1), updatedAt: iso(24) },
      { id: 'goal-media-1', title: 'Talks & Listening', typeId: 'goal-media', currentProgress: 2, targetProgress: 8, sortOrder: 1, status: 'active', createdAt: iso(1), updatedAt: iso(24) },
      { id: 'goal-essays-1', title: 'Essays & Articles', typeId: 'goal-essays', currentProgress: 1, targetProgress: 10, sortOrder: 2, status: 'active', createdAt: iso(1), updatedAt: iso(24) },
    ],
  };

  const preferences: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    themeMode: 'dark',
    accentTheme: 'amber',
    writingDefaults: {
      type: 'essay',
      status: 'drafting',
      writingStyle: 'belief_audit',
      editorFeel: 'spacious',
    },
    dateUpdated: iso(24),
  };

  const profile: UserProfile = {
    displayName: 'Noesis Review Workspace',
    email: REVIEW_ACCOUNT_EMAIL,
    photoURL: '',
    avatarUrl: '',
    bio: 'Dedicated demo thinker profile for architectural, UX, AI, and workflow review across the whole Noesis system.',
    intellectualFocus: ['philosophy synthesis', 'belief revision', 'attention and practice'],
    currentThemes: ['Identity', 'Meaning', 'Responsibility', 'Practice'],
    disciplines: ['philosophy', 'cognitive science', 'behavioral design'],
    learningSeason: 'Turning philosophy into tested practice',
    publicProfileEnabled: false,
    shareSlug: 'noesis-review-workspace',
    role: 'demo',
    createdAt: iso(1),
    dateUpdated: iso(24),
  };

  const profilePrivacy: ProfilePrivacySettings = {
    ...DEFAULT_PROFILE_PRIVACY,
    publicProfileEnabled: false,
    publicConceptsEnabled: false,
    publicPositionsEnabled: false,
    publicWorksEnabled: false,
    publicPracticesEnabled: false,
    publicSourcesEnabled: false,
    publicBeliefBiographyEnabled: false,
    shareSlug: profile.shareSlug || '',
    dateUpdated: iso(24),
  };

  const profileMetacognitionSummary: ProfileMetacognitionSummary = {
    ...DEFAULT_PROFILE_METACOGNITION_SUMMARY,
    topThinkingPatterns: ['Beliefs tend to revise after annotation clusters form', 'Meaning questions recur through responsibility and attention'],
    unresolvedTensions: ['Action-first identity vs narrative identity', 'Discipline as control vs discipline as meaningful service'],
    currentUnknowns: ['What actually drives avoidance under ambiguity?', 'How does ordinary routine become meaning-bearing?'],
    strongestBeliefs: ['Attention must be protected before it can be directed', 'Response to friction is philosophy in motion'],
    weakestBeliefs: ['Withdrawal protects identity from failure', 'Identity is fundamentally narrative'],
    lastComputedAt: iso(26),
  };

  const workspace: WorkspaceSettings = {
    ...DEFAULT_WORKSPACE_SETTINGS,
    role: 'demo',
    workspaceMode: 'review',
    seedSource: 'system-demo',
    demoWorkspace: true,
    reviewReady: true,
    featureFlags: REVIEW_FEATURE_FLAGS,
    dateUpdated: iso(24),
  };

  const settingsAccount: AccountSettings = {
    authEmail: REVIEW_ACCOUNT_EMAIL,
    connectedLoginMethods: ['password'],
    accountCreatedAt: iso(1),
    allowDeleteAccount: false,
    dateUpdated: iso(24),
  };

  const settingsAppearance: AppearanceSettings = {
    themeMode: 'dark',
    accentTheme: 'amber',
    density: 'comfortable',
    fontSize: 'md',
    readingWidth: 'standard',
    reducedMotion: false,
    highContrastMode: false,
    sidebarCollapsedByDefault: false,
    showPageDescriptions: true,
    dateUpdated: iso(24),
  };

  const settingsWorkspace: WorkspacePreferenceSettings = {
    defaultLandingPage: 'atlas',
    defaultAfterSourcePage: 'library',
    defaultSourceStatus: 'Want to Read',
    defaultWorkType: 'essay',
    defaultWritingStyle: 'belief_audit',
    defaultNoteMode: 'text_note',
    defaultLibraryView: 'grid',
    defaultAtlasView: 'map',
    defaultSortOrder: 'recent',
    autoSaveBehavior: 'debounced',
    confirmBeforeDeletingObjects: true,
    enableReviewPromptsAfterMajorEdits: true,
    dateUpdated: iso(24),
  };

  const settingsAi: AiSettings = {
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
    dateUpdated: iso(24),
  };

  const settingsMetacognition: MetacognitionSettings = {
    enableMetacognitionFeatures: true,
    enableThinkingEventsLogging: true,
    enableBeliefBiographies: true,
    enableThinkingPatternDetection: true,
    enableUnknownsTracking: true,
    enableCognitionMetrics: true,
    enableMissingPerspectivesDetection: true,
    enableBlindSpotObservations: true,
    showMetacognitionPanelsOnProfile: true,
    showMetacognitionPanelsOnObjectPages: true,
    recomputeMetacognitionAutomatically: true,
    lastComputedAt: iso(26),
    dateUpdated: iso(26),
  };

  const settingsPrivacy: PrivacySettings = {
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
    dateUpdated: iso(24),
  };

  const settingsData: DataSettings = {
    lastExportedAt: iso(24),
    allowImport: true,
    allowWorkspaceReset: false,
    allowClearDemoData: true,
    storageUsageNote: 'Demo workspace only; safe to refresh for reviews.',
    dateUpdated: iso(24),
  };

  const settingsSourceIntake: SourceIntakeSettings = {
    defaultMediaType: 'book',
    defaultSourceStatus: 'Want to Read',
    enableIsbnLookup: true,
    enableDoiLookup: true,
    enableYouTubeMetadataFetch: true,
    enableArticleMetadataFetch: true,
    enableFileUpload: true,
    enableOcr: false,
    defaultAnnotationType: 'highlight',
    autoCreateConceptsFromAnnotations: false,
    autoCreateInquiriesFromQuestions: true,
    requireConfirmationBeforeCreatingExtractedObjects: true,
    dateUpdated: iso(24),
  };

  const settingsWorks: WorksSettings = {
    defaultWorkType: 'essay',
    defaultDraftStatus: 'drafting',
    defaultPaperStyle: 'belief_audit',
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
    dateUpdated: iso(24),
  };

  const settingsAtlas: AtlasSettings = {
    defaultMapId: 'map_identity_engine',
    defaultNodeTypesVisible: ['concept', 'position', 'inquiry', 'work', 'practice'],
    defaultLinkTypesVisible: ['supports', 'challenges', 'refines', 'contradicts', 'tested_by', 'expressed_in', 'depends_on', 'explains'],
    showLabelsByDefault: true,
    showEvidenceStrength: true,
    showContradictionLinks: true,
    showPracticeLinks: true,
    showSourceLinks: true,
    layoutMode: 'force_graph',
    nodeSizeBasedOn: 'link_count',
    dateUpdated: iso(24),
  };

  const settingsNotifications: NotificationSettings = {
    dailyReviewReminders: false,
    weeklyEvolutionSummary: true,
    sourceGoalReminders: true,
    practiceReminders: true,
    unresolvedTensionReminders: true,
    unknownFollowUpReminders: true,
    positionReviewReminders: true,
    staleBeliefReviewReminders: true,
    emailNotifications: false,
    inAppNotifications: true,
    dateUpdated: iso(24),
  };

  const settingsGoals: GoalPreferenceSettings = {
    ...DEFAULT_GOAL_PREFERENCE_SETTINGS,
    goalReminderFrequency: 'weekly',
    defaultGoalCategories: ['Books & Papers', 'Talks & Listening', 'Essays & Articles'],
    defaultMonthlySourceTarget: 8,
    includeAudiobooksInReadingGoals: true,
    includePodcastsInLearningGoals: true,
    includeVideosInSourceGoals: true,
    showGoalsOnDashboard: true,
    dateUpdated: iso(24),
  };

  const settingsDeveloper: DeveloperSettings = {
    reviewModeStatus: true,
    demoWorkspaceSeedStatus: true,
    currentUserPath: `users/${uid}`,
    themeCompatibilityTestedAt: iso(24),
    dateUpdated: iso(24),
  };

  media.push(
    {
      id: 'm_epictetus',
      title: 'Enchiridion',
      creator: 'Epictetus',
      creators: ['Epictetus'],
      type: 'book',
      status: 'Finished',
      year: '125',
      genre: 'Stoicism',
      description: 'Compact handbook on what is and is not within one’s control.',
      url: 'https://books.google.com/books?id=enchiridion-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80',
      publisher: 'Public Domain',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'enchiridion-demo', url: 'https://books.google.com/books?id=enchiridion-demo' },
      tags: ['Agency', 'Freedom', 'Discipline'],
      annotations: [
        { id: 'a15', text: 'Freedom begins when attention stops demanding control over what is not yours to rule.', type: 'highlight', date: iso(16), conceptTags: ['Agency', 'Freedom'], philosophyStatus: 'connected' },
        { id: 'a16', text: 'Does control become a moral category before it becomes a psychological one?', type: 'question', date: iso(16, 14), answer: '', conceptTags: ['Agency', 'Responsibility'], philosophyStatus: 'questioned', createdInquiryId: 'q_control_moral' },
      ],
      capture: {
        before: { expectation: 'Looking for a leaner account of agency than modern self-help language provides.' },
        after: { coreArgument: 'Agency grows when concern is disciplined by what can actually be acted on.', lasting: 'Control is partly a sorting act, not only a force of will.' },
        sessions: [{ id: 'rs8', sourceId: 'm_epictetus', date: iso(16), durationSeconds: 4200, totalElapsedSeconds: 4200, status: 'completed', notes: 'Strengthened the agency and freedom cluster.', createdAt: iso(16), updatedAt: iso(16) }],
      },
      dateAdded: iso(16),
      dateUpdated: iso(25),
    },
    {
      id: 'm_republic',
      title: 'Republic',
      creator: 'Plato',
      creators: ['Plato'],
      type: 'book',
      status: 'Consuming',
      year: '-380',
      genre: 'Political Philosophy',
      description: 'Dialogue on justice, education, desire, and the ordering of the soul.',
      url: 'https://books.google.com/books?id=republic-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80',
      publisher: 'Public Domain',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'republic-demo', url: 'https://books.google.com/books?id=republic-demo' },
      tags: ['Justice', 'Desire', 'Order'],
      annotations: [
        { id: 'a17', text: 'Desire becomes political once it organizes the soul before it organizes the city.', type: 'thought', date: iso(17), conceptTags: ['Desire', 'Power'], philosophyStatus: 'connected' },
        { id: 'a18', text: 'What is lost when order is pursued without room for human plurality?', type: 'question', date: iso(17, 14), answer: '', conceptTags: ['Power', 'Community'], philosophyStatus: 'questioned', createdInquiryId: 'q_order_plurality' },
      ],
      capture: {
        before: { expectation: 'Testing whether discipline and justice can be linked without authoritarian drift.' },
        after: { coreArgument: 'The structure of desire shapes the structure of life.', lasting: 'Inner order may be necessary, but it is not the same as domination.' },
        sessions: [{ id: 'rs9', sourceId: 'm_republic', date: iso(17), durationSeconds: 5100, totalElapsedSeconds: 5100, status: 'completed', notes: 'Pulled a question about order and plurality into inquiries.', createdAt: iso(17), updatedAt: iso(17) }],
      },
      dateAdded: iso(17),
      dateUpdated: iso(25),
    },
    {
      id: 'm_ethics',
      title: 'Nicomachean Ethics',
      creator: 'Aristotle',
      creators: ['Aristotle'],
      type: 'book',
      status: 'Finished',
      year: '-340',
      genre: 'Ethics',
      description: 'A systematic treatment of virtue, habit, friendship, and flourishing.',
      url: 'https://books.google.com/books?id=ethics-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=80',
      publisher: 'Public Domain',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'ethics-demo', url: 'https://books.google.com/books?id=ethics-demo' },
      tags: ['Virtue', 'Habit', 'Community'],
      annotations: [
        { id: 'a19', text: 'Habit is not a substitute for thought; it is how thought becomes character.', type: 'highlight', date: iso(18), conceptTags: ['Habit', 'Virtue'], philosophyStatus: 'connected' },
        { id: 'a20', text: 'Good life language becomes thin when friendship is removed from moral development.', type: 'connection', date: iso(18, 15), conceptTags: ['Community', 'Care'], philosophyStatus: 'connected' },
      ],
      capture: {
        before: { expectation: 'Looking for a bridge between habit and flourishing that is not just productivity rhetoric.' },
        after: { coreArgument: 'Character is trained through repeated, socially shaped action.', lasting: 'Habit belongs with virtue, not only efficiency.' },
        sessions: [{ id: 'rs10', sourceId: 'm_ethics', date: iso(18), durationSeconds: 4800, totalElapsedSeconds: 4800, status: 'completed', notes: 'Deepened the habit and community clusters.', createdAt: iso(18), updatedAt: iso(18) }],
      },
      dateAdded: iso(18),
      dateUpdated: iso(26),
    },
    {
      id: 'm_nietzsche',
      title: 'Genealogy of Morals',
      creator: 'Friedrich Nietzsche',
      creators: ['Friedrich Nietzsche'],
      type: 'book',
      status: 'Consuming',
      year: '1887',
      genre: 'Philosophy',
      description: 'A genealogical critique of morality, ressentiment, and inherited values.',
      url: 'https://books.google.com/books?id=genealogy-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80',
      publisher: 'Public Domain',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'genealogy-demo', url: 'https://books.google.com/books?id=genealogy-demo' },
      tags: ['Power', 'Truth', 'Self-Deception'],
      annotations: [
        { id: 'a21', text: 'Some moral language may be disguised woundedness rather than clean principle.', type: 'thought', date: iso(18, 18), conceptTags: ['Self-Deception', 'Power'], philosophyStatus: 'connected' },
        { id: 'a22', text: 'When does moral seriousness become a strategy for avoiding vulnerability?', type: 'question', date: iso(18, 19), answer: '', conceptTags: ['Self-Deception', 'Truth'], philosophyStatus: 'questioned', createdInquiryId: 'q_moral_seriousness' },
      ],
      capture: {
        before: { expectation: 'Need an irritant strong enough to challenge self-flattering moral narratives.' },
        after: { coreArgument: 'Motives need suspicion, not only noble vocabulary.', lasting: 'Self-deception belongs in the center of moral review.' },
        sessions: [{ id: 'rs11', sourceId: 'm_nietzsche', date: iso(18), durationSeconds: 5400, totalElapsedSeconds: 5400, status: 'completed', notes: 'Generated a strong question around hidden motives.', createdAt: iso(18), updatedAt: iso(18) }],
      },
      dateAdded: iso(18),
      dateUpdated: iso(26),
    },
    {
      id: 'm_kierkegaard',
      title: 'The Sickness Unto Death',
      creator: 'Søren Kierkegaard',
      creators: ['Søren Kierkegaard'],
      type: 'book',
      status: 'Finished',
      year: '1849',
      genre: 'Existentialism',
      description: 'A study of despair, selfhood, and the failure to become oneself honestly.',
      url: 'https://books.google.com/books?id=sickness-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80',
      publisher: 'Public Domain',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'sickness-demo', url: 'https://books.google.com/books?id=sickness-demo' },
      tags: ['Identity', 'Anxiety', 'Self-Deception'],
      annotations: [
        { id: 'a23', text: 'Despair often hides behind ordinary competence and respectable routine.', type: 'highlight', date: iso(19), conceptTags: ['Identity', 'Anxiety'], philosophyStatus: 'connected' },
        { id: 'a24', text: 'I may confuse coherence with honesty when the self is actually evading what it knows.', type: 'thought', date: iso(19, 14), conceptTags: ['Self-Deception', 'Truth'], philosophyStatus: 'connected' },
      ],
      capture: {
        before: { expectation: 'Need language for inward avoidance that is deeper than simple procrastination.' },
        after: { coreArgument: 'Selfhood can fail by refusing contact with truth about itself.', lasting: 'Despair is often subtle, not dramatic.' },
        sessions: [{ id: 'rs12', sourceId: 'm_kierkegaard', date: iso(19), durationSeconds: 4500, totalElapsedSeconds: 4500, status: 'completed', notes: 'Strengthened the self-deception cluster.', createdAt: iso(19), updatedAt: iso(19) }],
      },
      dateAdded: iso(19),
      dateUpdated: iso(26),
    },
    {
      id: 'm_camus',
      title: 'The Myth of Sisyphus',
      creator: 'Albert Camus',
      creators: ['Albert Camus'],
      type: 'book',
      status: 'Finished',
      year: '1942',
      genre: 'Existentialism',
      description: 'An inquiry into absurdity, revolt, and living without metaphysical guarantees.',
      url: 'https://books.google.com/books?id=sisyphus-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=80',
      publisher: 'Public Domain',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'sisyphus-demo', url: 'https://books.google.com/books?id=sisyphus-demo' },
      tags: ['Meaning', 'Mortality', 'Freedom'],
      annotations: [
        { id: 'a25', text: 'Freedom may become most serious when certainty is refused rather than completed.', type: 'highlight', date: iso(20), conceptTags: ['Freedom', 'Meaning'], philosophyStatus: 'connected' },
        { id: 'a26', text: 'Can revolt be ethically constructive without becoming just another form of pride?', type: 'question', date: iso(20, 15), answer: '', conceptTags: ['Freedom', 'Humility'], philosophyStatus: 'questioned', createdInquiryId: 'q_revolt_pride' },
      ],
      capture: {
        before: { expectation: 'Testing how meaning survives without metaphysical closure.' },
        after: { coreArgument: 'One can act seriously without possessing final certainty.', lasting: 'Moral action under uncertainty needs more existential vocabulary.' },
        sessions: [{ id: 'rs13', sourceId: 'm_camus', date: iso(20), durationSeconds: 4200, totalElapsedSeconds: 4200, status: 'completed', notes: 'Fed the uncertainty and freedom themes.', createdAt: iso(20), updatedAt: iso(20) }],
      },
      dateAdded: iso(20),
      dateUpdated: iso(26),
    },
    {
      id: 'm_atomic_habits',
      title: 'Atomic Habits',
      creator: 'James Clear',
      creators: ['James Clear'],
      type: 'book',
      status: 'Finished',
      year: '2018',
      genre: 'Behavioral Design',
      description: 'Practical account of identity, systems, and small behavioral change.',
      url: 'https://books.google.com/books?id=atomic-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=900&q=80',
      publisher: 'Avery',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'atomic-demo', url: 'https://books.google.com/books?id=atomic-demo' },
      tags: ['Habit', 'Identity', 'Practice'],
      annotations: [
        { id: 'a27', text: 'Repetition shapes identity more reliably than self-description.', type: 'highlight', date: iso(21), conceptTags: ['Habit', 'Identity'], philosophyStatus: 'used_in_position', linkedPositionIds: ['v_repetition_identity'] },
        { id: 'a28', text: 'Good systems are not enough if the purpose behind them is inherited and unexamined.', type: 'connection', date: iso(21, 15), conceptTags: ['Habit', 'Meaning'], philosophyStatus: 'connected' },
      ],
      capture: {
        before: { expectation: 'Need a clean behavioral counterweight to purely reflective philosophy.' },
        after: { coreArgument: 'Identity becomes believable when repeated in small form.', lasting: 'Practice can be modest and still metaphysical in effect.' },
        sessions: [{ id: 'rs14', sourceId: 'm_atomic_habits', date: iso(21), durationSeconds: 3900, totalElapsedSeconds: 3900, status: 'completed', notes: 'Fed a position about repetition and identity.', createdAt: iso(21), updatedAt: iso(21) }],
      },
      dateAdded: iso(21),
      dateUpdated: iso(26),
    },
    {
      id: 'm_deep_work',
      title: 'Deep Work',
      creator: 'Cal Newport',
      creators: ['Cal Newport'],
      type: 'book',
      status: 'Finished',
      year: '2016',
      genre: 'Productivity',
      description: 'Argument for concentration, depth, and attention as economic and intellectual assets.',
      url: 'https://books.google.com/books?id=deep-work-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=900&q=80',
      publisher: 'Grand Central',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'deep-work-demo', url: 'https://books.google.com/books?id=deep-work-demo' },
      tags: ['Attention', 'Technology', 'Agency'],
      annotations: [
        { id: 'a29', text: 'Attention is not just productivity fuel; it is a way of refusing fragmentation.', type: 'thought', date: iso(22), conceptTags: ['Attention', 'Technology'], philosophyStatus: 'connected' },
        { id: 'a30', text: 'Technology should be judged by what it trains the user to become.', type: 'highlight', date: iso(22, 14), conceptTags: ['Technology', 'Identity'], philosophyStatus: 'used_in_position', linkedPositionIds: ['v_technology_trains_self'] },
      ],
      capture: {
        before: { expectation: 'Wanted to test whether depth talk can be philosophical rather than merely professional.' },
        after: { coreArgument: 'Concentration is an ethical and identity-shaping discipline.', lasting: 'Technology criticism needs to include training effects on the self.' },
        sessions: [{ id: 'rs15', sourceId: 'm_deep_work', date: iso(22), durationSeconds: 4200, totalElapsedSeconds: 4200, status: 'completed', notes: 'Generated the tech-and-selfhood position.', createdAt: iso(22), updatedAt: iso(22) }],
      },
      dateAdded: iso(22),
      dateUpdated: iso(26),
    },
    {
      id: 'm_burnout',
      title: 'The Burnout Society',
      creator: 'Byung-Chul Han',
      creators: ['Byung-Chul Han'],
      type: 'book',
      status: 'Finished',
      year: '2010',
      genre: 'Cultural Critique',
      description: 'Diagnosis of self-exploitation, achievement culture, and psychic overload.',
      url: 'https://books.google.com/books?id=burnout-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=80',
      publisher: 'Stanford',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'burnout-demo', url: 'https://books.google.com/books?id=burnout-demo' },
      tags: ['Technology', 'Desire', 'Self-Deception'],
      annotations: [
        { id: 'a31', text: 'Some exhaustion is not weakness but the natural output of a system that rewards self-exploitation.', type: 'highlight', date: iso(23), conceptTags: ['Technology', 'Desire'], philosophyStatus: 'connected' },
        { id: 'a32', text: 'The desire to optimize can itself become an identity trap.', type: 'thought', date: iso(23, 15), conceptTags: ['Self-Deception', 'Ambition'], philosophyStatus: 'connected' },
      ],
      capture: {
        before: { expectation: 'Needed a more structural read on discipline fatigue.' },
        after: { coreArgument: 'The self can become both worker and tyrant under achievement culture.', lasting: 'Productivity and seriousness are easy to confuse.' },
        sessions: [{ id: 'rs16', sourceId: 'm_burnout', date: iso(23), durationSeconds: 3600, totalElapsedSeconds: 3600, status: 'completed', notes: 'Opened a useful tension between ambition and care.', createdAt: iso(23), updatedAt: iso(23) }],
      },
      dateAdded: iso(23),
      dateUpdated: iso(26),
    },
    {
      id: 'm_postman',
      title: 'Amusing Ourselves to Death',
      creator: 'Neil Postman',
      creators: ['Neil Postman'],
      type: 'book',
      status: 'Finished',
      year: '1985',
      genre: 'Media Critique',
      description: 'Classic argument that media forms reshape public reason and attention.',
      url: 'https://books.google.com/books?id=postman-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
      publisher: 'Penguin',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'postman-demo', url: 'https://books.google.com/books?id=postman-demo' },
      tags: ['Technology', 'Attention', 'Truth'],
      annotations: [
        { id: 'a33', text: 'Media environments teach habits of thought long before users notice it.', type: 'highlight', date: iso(24), conceptTags: ['Technology', 'Attention'], philosophyStatus: 'connected' },
        { id: 'a34', text: 'What does truth become when entertainment is the default delivery system?', type: 'question', date: iso(24, 14), answer: '', conceptTags: ['Truth', 'Technology'], philosophyStatus: 'questioned', createdInquiryId: 'q_truth_entertainment' },
      ],
      capture: {
        before: { expectation: 'Looking for a language of media form that goes deeper than distraction.' },
        after: { coreArgument: 'Form trains cognition, not just content preference.', lasting: 'Technology criticism needs to remain pedagogical.' },
        sessions: [{ id: 'rs17', sourceId: 'm_postman', date: iso(24), durationSeconds: 4200, totalElapsedSeconds: 4200, status: 'completed', notes: 'Fed truth, technology, and attention links.', createdAt: iso(24), updatedAt: iso(24) }],
      },
      dateAdded: iso(24),
      dateUpdated: iso(26),
    },
    {
      id: 'm_hooks',
      title: 'All About Love',
      creator: 'bell hooks',
      creators: ['bell hooks'],
      type: 'book',
      status: 'Finished',
      year: '2000',
      genre: 'Ethics',
      description: 'An account of love as practice, care, truthfulness, and shared responsibility.',
      url: 'https://books.google.com/books?id=hooks-demo',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516908205727-40afad9449a0?auto=format&fit=crop&w=900&q=80',
      publisher: 'William Morrow',
      platform: 'Google Books',
      sourceProvider: 'google_books',
      externalIds: { googleBooksId: 'hooks-demo', url: 'https://books.google.com/books?id=hooks-demo' },
      tags: ['Care', 'Community', 'Responsibility'],
      annotations: [
        { id: 'a35', text: 'Care is not sentiment alone; it is disciplined truthful attention to another person.', type: 'highlight', date: iso(24, 18), conceptTags: ['Care', 'Responsibility'], philosophyStatus: 'connected' },
        { id: 'a36', text: 'What kind of community makes a person more honest rather than merely more comfortable?', type: 'question', date: iso(24, 19), answer: '', conceptTags: ['Community', 'Truth'], philosophyStatus: 'questioned', createdInquiryId: 'q_honest_community' },
      ],
      capture: {
        before: { expectation: 'Need a relational corrective so philosophy does not become solitary self-decoration.' },
        after: { coreArgument: 'Love is a disciplined practice of responsibility and truth.', lasting: 'Community belongs in belief revision, not outside it.' },
        sessions: [{ id: 'rs18', sourceId: 'm_hooks', date: iso(24), durationSeconds: 4500, totalElapsedSeconds: 4500, status: 'completed', notes: 'Created a strong bridge between care, truth, and community.', createdAt: iso(24), updatedAt: iso(24) }],
      },
      dateAdded: iso(24),
      dateUpdated: iso(26),
    }
  );

  concepts.push(
    { id: 'c_agency', name: 'Agency', description: 'Agency is the felt and practiced capacity to direct action under constraints.', links: ['Freedom', 'Responsibility', 'Attention'], sourceIds: ['m_epictetus', 'm_deep_work'], dateCreated: iso(16), dateUpdated: iso(26), x: 23, y: 20, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_freedom', name: 'Freedom', description: 'Freedom is less raw possibility than rightly ordered action amid limits.', links: ['Agency', 'Discipline', 'Meaning'], sourceIds: ['m_epictetus', 'm_camus'], dateCreated: iso(16), dateUpdated: iso(26), x: 17, y: 28, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_desire', name: 'Desire', description: 'Desire shapes attention, identity, and the kinds of order a person ends up serving.', links: ['Habit', 'Power', 'Meaning'], sourceIds: ['m_republic', 'm_burnout'], dateCreated: iso(17), dateUpdated: iso(26), x: 12, y: 46, createdFrom: 'manual', philosophyStatus: 'contested' },
    { id: 'c_habit', name: 'Habit', description: 'Habit is repeated form solidifying into character and expectation.', links: ['Virtue', 'Identity', 'Practice'], sourceIds: ['m_ethics', 'm_atomic_habits'], dateCreated: iso(18), dateUpdated: iso(26), x: 58, y: 80, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_virtue', name: 'Virtue', description: 'Virtue is practiced excellence shaped by communities, aims, and repeated choice.', links: ['Habit', 'Community', 'Wisdom'], sourceIds: ['m_ethics'], dateCreated: iso(18), dateUpdated: iso(26), x: 66, y: 79, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_self_deception', name: 'Self-Deception', description: 'Self-deception lets a person keep a flattering story while evidence is quietly ignored.', links: ['Truth', 'Identity', 'Desire'], sourceIds: ['m_nietzsche', 'm_kierkegaard'], dateCreated: iso(18), dateUpdated: iso(26), x: 14, y: 58, createdFrom: 'manual', philosophyStatus: 'core' },
    { id: 'c_anxiety', name: 'Anxiety', description: 'Anxiety often reveals stakes, evasions, and possible futures before belief has caught up.', links: ['Identity', 'Meaning', 'Mortality'], sourceIds: ['m_kierkegaard'], dateCreated: iso(19), dateUpdated: iso(26), x: 26, y: 12, createdFrom: 'manual', philosophyStatus: 'emerging' },
    { id: 'c_mortality', name: 'Mortality', description: 'Mortality pressures belief toward seriousness by making delay and abstraction finite.', links: ['Meaning', 'Humility', 'Responsibility'], sourceIds: ['m_camus', 'm_aurelius'], dateCreated: iso(20), dateUpdated: iso(26), x: 86, y: 18, createdFrom: 'manual', philosophyStatus: 'emerging' },
    { id: 'c_solitude', name: 'Solitude', description: 'Solitude can sharpen honesty or thicken private distortion depending on how it is used.', links: ['Community', 'Identity', 'Truth'], sourceIds: ['m_movie_paterson', 'm_kierkegaard'], dateCreated: iso(20), dateUpdated: iso(26), x: 9, y: 71, createdFrom: 'manual', philosophyStatus: 'contested' },
    { id: 'c_community', name: 'Community', description: 'Community can either reinforce self-deception or deepen accountability and truthfulness.', links: ['Care', 'Truth', 'Solitude'], sourceIds: ['m_ethics', 'm_hooks'], dateCreated: iso(20), dateUpdated: iso(26), x: 21, y: 78, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_wisdom', name: 'Wisdom', description: 'Wisdom is disciplined integration rather than information volume.', links: ['Virtue', 'Humility', 'Truth'], sourceIds: ['m_ethics', 'm_aurelius'], dateCreated: iso(21), dateUpdated: iso(26), x: 70, y: 12, createdFrom: 'manual', philosophyStatus: 'emerging' },
    { id: 'c_technology', name: 'Technology', description: 'Technology is a training environment that shapes attention, selfhood, and judgment.', links: ['Attention', 'Identity', 'Truth'], sourceIds: ['m_deep_work', 'm_postman', 'm_burnout'], dateCreated: iso(22), dateUpdated: iso(26), x: 90, y: 44, createdFrom: 'manual', philosophyStatus: 'core' },
    { id: 'c_creativity', name: 'Creativity', description: 'Creativity is disciplined responsiveness to the world, not mere inspiration.', links: ['Attention', 'Responsibility', 'Practice'], sourceIds: ['m_movie_paterson'], dateCreated: iso(22), dateUpdated: iso(26), x: 84, y: 73, createdFrom: 'manual', philosophyStatus: 'emerging' },
    { id: 'c_power', name: 'Power', description: 'Power shapes what counts as order, virtue, or truth long before those words are argued over.', links: ['Desire', 'Truth', 'Community'], sourceIds: ['m_republic', 'm_nietzsche'], dateCreated: iso(17), dateUpdated: iso(26), x: 4, y: 53, createdFrom: 'manual', philosophyStatus: 'contested' },
    { id: 'c_care', name: 'Care', description: 'Care is structured attention that takes responsibility for another’s good.', links: ['Community', 'Responsibility', 'Truth'], sourceIds: ['m_hooks'], dateCreated: iso(24), dateUpdated: iso(26), x: 30, y: 86, createdFrom: 'manual', philosophyStatus: 'developed' },
    { id: 'c_truth', name: 'Truth', description: 'Truth matters as a discipline of contact with reality, not just accuracy of statement.', links: ['Self-Deception', 'Technology', 'Care'], sourceIds: ['m_nietzsche', 'm_postman', 'm_hooks'], dateCreated: iso(18), dateUpdated: iso(26), x: 6, y: 63, createdFrom: 'manual', philosophyStatus: 'core' },
    { id: 'c_ambition', name: 'Ambition', description: 'Ambition can organize effort or quietly become allegiance to admiration.', links: ['Desire', 'Power', 'Humility'], sourceIds: ['m_burnout'], dateCreated: iso(23), dateUpdated: iso(26), x: 92, y: 58, createdFrom: 'manual', philosophyStatus: 'contested' },
    { id: 'c_humility', name: 'Humility', description: 'Humility is accurate scale before reality, not theatrical self-diminishment.', links: ['Wisdom', 'Truth', 'Mortality'], sourceIds: ['m_camus', 'm_aurelius'], dateCreated: iso(20), dateUpdated: iso(26), x: 78, y: 6, createdFrom: 'manual', philosophyStatus: 'developed' }
  );

  questions.push(
    { id: 'q_control_moral', text: 'Does control become a moral category before it becomes a psychological one?', status: 'open', answer: '', evidenceIds: ['m_epictetus'], conceptIds: ['c_agency', 'c_responsibility'], sourceIds: ['m_epictetus'], beliefIds: ['v_attention_rule'], draftIds: ['d_agency_notes'], type: 'annotation', sourceAnnotationId: 'a16', dateCreated: iso(16), dateUpdated: iso(26) },
    { id: 'q_order_plurality', text: 'What is lost when order is pursued without room for human plurality?', status: 'gathering_evidence', answer: '', evidenceIds: ['m_republic', 'm_hooks'], conceptIds: ['c_power', 'c_community'], sourceIds: ['m_republic', 'm_hooks'], beliefIds: ['v_technology_trains_self'], draftIds: ['d_technology_notes'], type: 'annotation', sourceAnnotationId: 'a18', dateCreated: iso(17), dateUpdated: iso(26) },
    { id: 'q_moral_seriousness', text: 'When does moral seriousness become a strategy for avoiding vulnerability?', status: 'under_tension', answer: '', evidenceIds: ['m_nietzsche', 'm_kierkegaard'], conceptIds: ['c_self_deception', 'c_truth'], sourceIds: ['m_nietzsche', 'm_kierkegaard'], beliefIds: ['v_worldview_editable'], draftIds: ['d_belief_biography'], type: 'annotation', sourceAnnotationId: 'a22', dateCreated: iso(18), dateUpdated: iso(26) },
    { id: 'q_revolt_pride', text: 'Can revolt be ethically constructive without becoming just another form of pride?', status: 'open', answer: '', evidenceIds: ['m_camus'], conceptIds: ['c_freedom', 'c_humility'], sourceIds: ['m_camus'], beliefIds: ['v_responsibility_uncertainty'], draftIds: ['d_responsibility_without_certainty'], type: 'annotation', sourceAnnotationId: 'a26', dateCreated: iso(20), dateUpdated: iso(26) },
    { id: 'q_truth_entertainment', text: 'What does truth become when entertainment is the default delivery system?', status: 'investigating', answer: '', evidenceIds: ['m_postman', 'm_deep_work'], conceptIds: ['c_truth', 'c_technology', 'c_attention'], sourceIds: ['m_postman', 'm_deep_work'], beliefIds: ['v_technology_trains_self'], draftIds: ['d_technology_notes'], type: 'annotation', sourceAnnotationId: 'a34', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'q_honest_community', text: 'What kind of community makes a person more honest rather than merely more comfortable?', status: 'partially_answered', answer: 'One that invites evidence, correction, and care without making belonging conditional on agreement.', evidenceIds: ['m_hooks', 'm_ethics'], conceptIds: ['c_community', 'c_care', 'c_truth'], sourceIds: ['m_hooks', 'm_ethics'], beliefIds: ['v_community_honesty'], draftIds: ['d_fragments_solitude'], type: 'annotation', sourceAnnotationId: 'a36', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'q_comfort_growth', text: 'Is comfort quietly hostile to growth, or can comfort also be restorative and truthful?', status: 'gathering_evidence', answer: '', evidenceIds: ['m_burnout', 'm_movie_paterson'], conceptIds: ['c_desire', 'c_care', 'c_meaning'], sourceIds: ['m_burnout', 'm_movie_paterson'], beliefIds: ['v_comfort_reality'], draftIds: ['d_passive_learning'], type: 'manual', dateCreated: iso(23), dateUpdated: iso(26) },
    { id: 'q_belief_worth_keeping', text: 'What makes a belief worth keeping after it has been seriously challenged?', status: 'resolved', answer: 'It must survive challenge by becoming more precise, more accountable, and more testable in practice.', evidenceIds: ['m_aurelius', 'm_nietzsche', 'm_hooks'], conceptIds: ['c_truth', 'c_practice', 'c_humility'], sourceIds: ['m_aurelius', 'm_nietzsche', 'm_hooks'], beliefIds: ['v_worldview_editable'], draftIds: ['d_belief_biography'], type: 'manual', dateCreated: iso(22), dateUpdated: iso(26) },
    { id: 'q_solitude_bias', text: 'When does solitude sharpen self-knowledge and when does it simply reinforce private bias?', status: 'reopened', answer: 'Solitude helps when it returns to shared reality and challenge, not when it becomes self-sealing.', evidenceIds: ['m_movie_paterson', 'm_hooks', 'm_kierkegaard'], conceptIds: ['c_solitude', 'c_community', 'c_truth'], sourceIds: ['m_movie_paterson', 'm_hooks', 'm_kierkegaard'], beliefIds: ['v_solitude_isolation'], draftIds: ['d_fragments_solitude'], type: 'manual', dateCreated: iso(21), dateUpdated: iso(26) }
  );

  vault.push(
    { id: 'v_repetition_identity', title: 'Repetition shapes identity more reliably than intention', type: 'belief', statement: 'Repeated action forms identity more dependably than aspirational self-description does.', description: 'A position formed from habit literature and the existing action-first identity view.', confidence: 79, status: 'active', tags: ['Habit', 'Identity', 'Practice'], sourceIds: ['m_atomic_habits', 'm_ethics'], evidenceFor: ['Small repeated practices outlast motivational spikes.', 'Character feels downstream of repetition.'], evidenceAgainst: ['Intentional commitments can sometimes break repetition quickly.'], versionHistory: [{ description: 'Created from Atomic Habits notes.', eventType: 'created', date: iso(21) }], createdFrom: 'idea', sourceAnnotationId: 'a27', dateCreated: iso(21), dateUpdated: iso(26) },
    { id: 'v_technology_trains_self', title: 'Technology should be judged by what it trains the user to become', type: 'principle', statement: 'Technologies are not neutral tools if they repeatedly train forms of attention, desire, and selfhood.', description: 'The central tech-and-selfhood position in the review workspace.', confidence: 84, status: 'active', tags: ['Technology', 'Attention', 'Identity'], sourceIds: ['m_deep_work', 'm_postman', 'm_burnout'], evidenceFor: ['Media form shapes attention.', 'Tools reward particular habits of self.'], evidenceAgainst: ['Intentional users can partially resist training effects.'], versionHistory: [{ description: 'Created from technology and attention sources.', eventType: 'created', date: iso(22) }], createdFrom: 'idea', sourceAnnotationId: 'a30', dateCreated: iso(22), dateUpdated: iso(26) },
    { id: 'v_comfort_reality', title: 'Comfort becomes dangerous when it prevents contact with reality', type: 'mental_model', statement: 'Comfort is not the enemy, but it becomes corrosive when it blocks truth, testing, or necessary friction.', description: 'A deliberately nuanced position that tries to distinguish peace from avoidance.', confidence: 63, status: 'challenged', tags: ['Meaning', 'Care', 'Truth'], sourceIds: ['m_burnout', 'm_movie_paterson', 'm_hooks'], evidenceFor: ['Some comforts preserve evasion.', 'Avoidance often dresses itself as self-care.'], evidenceAgainst: ['Rest and tenderness can also restore truthful contact with life.'], versionHistory: [{ description: 'Created while comparing burnout notes with quieter models of peace.', eventType: 'created', date: iso(24) }], createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'v_worldview_editable', title: 'A worldview should be treated as editable, not sacred', type: 'worldview', statement: 'Strong beliefs should remain revisable under evidence, challenge, and lived testing.', description: 'A meta-position about belief maintenance itself.', confidence: 88, status: 'active', tags: ['Truth', 'Humility', 'Practice'], sourceIds: ['m_nietzsche', 'm_hooks', 'm_aurelius'], evidenceFor: ['Beliefs mature by surviving challenge.', 'Unedited worldviews become identity armor.'], evidenceAgainst: ['Too much fluidity can dissolve commitment before it becomes real.'], versionHistory: [{ description: 'Created from repeated revision patterns in the workspace.', eventType: 'created', date: iso(24) }], createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'v_responsibility_uncertainty', title: 'Moral action often requires provisional commitment before certainty', type: 'principle', statement: 'Waiting for total clarity can become moral avoidance when the situation already demands action.', description: 'An extension of the commitment-before-clarity belief into explicitly moral terrain.', confidence: 74, status: 'revised', tags: ['Responsibility', 'Meaning', 'Freedom'], sourceIds: ['m_article_meaning', 'm_camus', 'm_hooks'], evidenceFor: ['Responsibility often arrives before certainty.', 'Care sometimes asks for action amid ambiguity.'], evidenceAgainst: ['Premature action can harden error into principle.'], versionHistory: [{ description: 'Created from responsibility inquiry.', eventType: 'created', date: iso(23) }, { description: 'Revised to include stronger warning against rashness.', eventType: 'revised', date: iso(26) }], createdFrom: 'manual', dateCreated: iso(23), dateUpdated: iso(26) },
    { id: 'v_solitude_isolation', title: 'Solitude is necessary for self-knowledge, but isolation distorts it', type: 'belief', statement: 'Solitude clarifies the self only if it returns to dialogue, evidence, and shared correction.', description: 'A position balancing inwardness with accountability.', confidence: 71, status: 'active', tags: ['Solitude', 'Community', 'Truth'], sourceIds: ['m_movie_paterson', 'm_hooks', 'm_kierkegaard'], evidenceFor: ['Solitude reveals otherwise hidden motives.', 'Community is needed to test self-interpretation.'], evidenceAgainst: ['Too much external correction can drown inner honesty.'], versionHistory: [{ description: 'Created from solitude and community notes.', eventType: 'created', date: iso(24) }], createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'v_community_honesty', title: 'The best communities increase honesty, not just belonging', type: 'worldview', statement: 'Community is healthiest when it increases truthfulness, responsibility, and revision rather than merely comfort.', description: 'A communal counterweight to overly individualistic belief work.', confidence: 69, status: 'uncertain', tags: ['Community', 'Care', 'Truth'], sourceIds: ['m_hooks', 'm_ethics'], evidenceFor: ['Healthy communities surface evidence and perspective.', 'Belonging without truth becomes drift.'], evidenceAgainst: ['Radical honesty can become cruelty without care.'], versionHistory: [{ description: 'Created from bell hooks and Aristotle notes.', eventType: 'created', date: iso(25) }], createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'v_practice_before_claim', title: 'The strongest ideas are those that can become practices', type: 'life_rule', statement: 'An idea should normally be tested in practice before it is treated as settled philosophy.', description: 'A rule aimed at preventing decorative philosophy.', confidence: 83, status: 'active', tags: ['Practice', 'Truth', 'Responsibility'], sourceIds: ['m_podcast_huberman', 'm_ethics', 'm_hooks'], evidenceFor: ['Practices reveal whether a position survives friction.', 'Behavior generates data reflection alone cannot.'], evidenceAgainst: ['Some claims need conceptual work before they can be practiced cleanly.'], versionHistory: [{ description: 'Created as a meta-rule for the app itself.', eventType: 'created', date: iso(25) }], createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) }
  );

  drafts.push(
    { id: 'd_agency_notes', title: 'What I Mean by Agency', body: 'Working notes on agency as selective responsibility under limits.', type: 'field_note', status: 'drafting', label: 'Field Note', workCategory: 'writing', paperType: 'dialectic', draftContent: '<p>Agency may begin in sorting rather than force.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'dialectic', conceptTags: ['Agency', 'Freedom', 'Responsibility'], sourceIds: ['m_epictetus'], questionIds: ['q_control_moral'], beliefIds: ['v_attention_rule'], dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'd_technology_notes', title: 'Notes Toward a Philosophy of Technology', body: 'A developing note on how tools train attention and identity.', type: 'essay', status: 'drafting', label: 'Essay', workCategory: 'writing', paperType: 'two_column_debate', draftContent: '<p>Technology should be read pedagogically, not only instrumentally.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'two_column_debate', conceptTags: ['Technology', 'Attention', 'Identity'], sourceIds: ['m_deep_work', 'm_postman', 'm_burnout'], questionIds: ['q_truth_entertainment', 'q_order_plurality'], beliefIds: ['v_technology_trains_self'], dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'd_fragments_solitude', title: 'Fragments on Solitude', body: 'Short fragments on the difference between solitude and self-enclosure.', type: 'manuscript', status: 'drafting', label: 'Manuscript', workCategory: 'writing', paperType: 'blank_paper', draftContent: '<p>Solitude needs return routes to other minds.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'blank_paper', conceptTags: ['Solitude', 'Community', 'Truth'], sourceIds: ['m_movie_paterson', 'm_hooks', 'm_kierkegaard'], questionIds: ['q_honest_community', 'q_solitude_bias'], beliefIds: ['v_solitude_isolation', 'v_community_honesty'], dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'd_belief_biography', title: 'Why Beliefs Need Biographies', body: 'A note arguing that beliefs should be tracked through revision, pressure, and testing rather than stored as fixed claims.', type: 'source_analysis', status: 'drafting', label: 'Source Analysis', workCategory: 'writing', paperType: 'belief_audit', draftContent: '<p>A belief without history is too easy to mistake for truth.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'belief_audit', conceptTags: ['Truth', 'Practice', 'Humility'], sourceIds: ['m_nietzsche', 'm_hooks', 'm_aurelius'], questionIds: ['q_moral_seriousness', 'q_belief_worth_keeping'], beliefIds: ['v_worldview_editable'], dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'd_responsibility_without_certainty', title: 'Responsibility Without Certainty', body: 'A draft exploring whether moral action can remain serious without final metaphysical guarantees.', type: 'essay', status: 'drafting', label: 'Essay', workCategory: 'writing', paperType: 'timeline', draftContent: '<p>Some responsibilities become visible before they become defensible.</p>', finalContent: '', activeMode: 'draft', activeRibbon: 'writing', writingStyle: 'timeline', conceptTags: ['Responsibility', 'Freedom', 'Meaning'], sourceIds: ['m_camus', 'm_article_meaning', 'm_hooks'], questionIds: ['q_revolt_pride'], beliefIds: ['v_responsibility_uncertainty'], dateCreated: iso(25), dateUpdated: iso(26) }
  );

  practices.push(
    { id: 'p_deep_reading_block', title: 'One-hour deep reading block', description: 'Reserve one uninterrupted hour for slow reading before reactive work begins.', type: 'discipline', status: 'active', durationDays: 14, startDate: iso(22), endDate: iso(36), conceptTags: ['Attention', 'Discipline', 'Technology'], sourceIds: ['m_deep_work'], questionIds: ['q_truth_entertainment'], positionIds: ['v_attention_rule', 'v_technology_trains_self'], draftIds: ['d_technology_notes'], notes: 'Tracks whether protected reading changes the quality of later thinking.', logDates: [iso(22), iso(23), iso(24), iso(25)], dateCreated: iso(22), dateUpdated: iso(26) },
    { id: 'p_solitude_walk', title: 'Solitude walk without phone', description: 'Walk alone for thirty minutes without a device, then write one honest note about what surfaced.', type: 'habit', status: 'active', durationDays: 10, startDate: iso(23), endDate: iso(33), conceptTags: ['Solitude', 'Attention', 'Truth'], sourceIds: ['m_movie_paterson', 'm_kierkegaard'], questionIds: ['q_solitude_bias'], positionIds: ['v_solitude_isolation'], draftIds: ['d_fragments_solitude'], notes: 'Separates performative stillness from actual contact with thought.', logDates: [iso(23), iso(24), iso(26)], dateCreated: iso(23), dateUpdated: iso(26) },
    { id: 'p_desire_journal', title: 'Desire journal', description: 'Log one recurring desire per day and ask what kind of self it is training.', type: 'observation', status: 'planned', durationDays: 14, startDate: iso(27), endDate: iso(41), conceptTags: ['Desire', 'Identity', 'Self-Deception'], sourceIds: ['m_republic', 'm_burnout'], questionIds: ['q_moral_seriousness'], positionIds: ['v_worldview_editable'], draftIds: ['d_agency_notes'], notes: 'Helps distinguish aspiration from admiration-driven compulsion.', logDates: [], dateCreated: iso(26), dateUpdated: iso(26) },
    { id: 'p_community_feedback', title: 'Community feedback session', description: 'Present one live position to another person and ask what evidence they think is missing.', type: 'commitment', status: 'planned', durationDays: 30, startDate: iso(28), endDate: iso(58), conceptTags: ['Community', 'Truth', 'Care'], sourceIds: ['m_hooks'], questionIds: ['q_honest_community'], positionIds: ['v_community_honesty', 'v_worldview_editable'], draftIds: ['d_belief_biography'], notes: 'Designed to prevent private certainty from becoming sealed conviction.', logDates: [], dateCreated: iso(26), dateUpdated: iso(26) },
    { id: 'p_belief_challenge', title: 'Weekly belief challenge', description: 'Choose one live position each week and write the strongest case against it.', type: 'reflection_prompt', status: 'active', durationDays: 28, startDate: iso(24), endDate: iso(52), conceptTags: ['Truth', 'Humility', 'Practice'], sourceIds: ['m_nietzsche', 'm_hooks'], questionIds: ['q_belief_worth_keeping'], positionIds: ['v_worldview_editable', 'v_practice_before_claim'], draftIds: ['d_belief_biography'], notes: 'This is the main anti-decorative-philosophy practice in the demo workspace.', logDates: [iso(24), iso(25)], dateCreated: iso(24), dateUpdated: iso(26) }
  );

  links.push(
    { id: 'l13', fromType: 'concept', fromId: 'c_agency', fromLabel: 'Agency', toType: 'concept', toId: 'c_freedom', toLabel: 'Freedom', type: 'defines', note: 'Agency is one route to a practiced concept of freedom.', createdFrom: 'manual', dateCreated: iso(16), dateUpdated: iso(26) },
    { id: 'l14', fromType: 'source', fromId: 'm_epictetus', fromLabel: 'Enchiridion', toType: 'position', toId: 'v_attention_rule', toLabel: 'Attention must be protected before it can be directed', type: 'supports', note: 'Control language supports attention discipline.', createdFrom: 'system', dateCreated: iso(16), dateUpdated: iso(26) },
    { id: 'l15', fromType: 'source', fromId: 'm_atomic_habits', fromLabel: 'Atomic Habits', toType: 'position', toId: 'v_repetition_identity', toLabel: 'Repetition shapes identity more reliably than intention', type: 'supports', note: 'Primary behavioral support.', createdFrom: 'system', dateCreated: iso(21), dateUpdated: iso(26) },
    { id: 'l16', fromType: 'position', fromId: 'v_repetition_identity', fromLabel: 'Repetition shapes identity more reliably than intention', toType: 'practice', toId: 'p_deep_reading_block', toLabel: 'One-hour deep reading block', type: 'tested_by', note: 'Repetition is tested behaviorally.', createdFrom: 'system', dateCreated: iso(22), dateUpdated: iso(26) },
    { id: 'l17', fromType: 'source', fromId: 'm_deep_work', fromLabel: 'Deep Work', toType: 'position', toId: 'v_technology_trains_self', toLabel: 'Technology should be judged by what it trains the user to become', type: 'supports', note: 'Direct support from depth and distraction analysis.', createdFrom: 'system', dateCreated: iso(22), dateUpdated: iso(26) },
    { id: 'l18', fromType: 'source', fromId: 'm_postman', fromLabel: 'Amusing Ourselves to Death', toType: 'position', toId: 'v_technology_trains_self', toLabel: 'Technology should be judged by what it trains the user to become', type: 'supports', note: 'Media-form critique reinforces the position.', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l19', fromType: 'concept', fromId: 'c_technology', fromLabel: 'Technology', toType: 'position', toId: 'v_technology_trains_self', toLabel: 'Technology should be judged by what it trains the user to become', type: 'explains', note: 'Concept and position are tightly aligned.', createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l20', fromType: 'position', fromId: 'v_technology_trains_self', fromLabel: 'Technology should be judged by what it trains the user to become', toType: 'work', toId: 'd_technology_notes', toLabel: 'Notes Toward a Philosophy of Technology', type: 'expressed_in', note: 'The position is being articulated in a longer note.', createdFrom: 'system', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l21', fromType: 'source', fromId: 'm_burnout', fromLabel: 'The Burnout Society', toType: 'position', toId: 'v_comfort_reality', toLabel: 'Comfort becomes dangerous when it prevents contact with reality', type: 'supports', note: 'Adds structural critique of comfort and self-optimization.', createdFrom: 'system', dateCreated: iso(23), dateUpdated: iso(26) },
    { id: 'l22', fromType: 'source', fromId: 'm_hooks', fromLabel: 'All About Love', toType: 'position', toId: 'v_comfort_reality', toLabel: 'Comfort becomes dangerous when it prevents contact with reality', type: 'challenges', note: 'Adds a needed distinction between care and avoidance.', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l23', fromType: 'position', fromId: 'v_comfort_reality', fromLabel: 'Comfort becomes dangerous when it prevents contact with reality', toType: 'inquiry', toId: 'q_comfort_growth', toLabel: 'Is comfort quietly hostile to growth?', type: 'questions', note: 'The position remains under active refinement.', createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l24', fromType: 'source', fromId: 'm_hooks', fromLabel: 'All About Love', toType: 'position', toId: 'v_community_honesty', toLabel: 'The best communities increase honesty, not just belonging', type: 'supports', note: 'Care and truth are both necessary community measures.', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l25', fromType: 'source', fromId: 'm_ethics', fromLabel: 'Nicomachean Ethics', toType: 'position', toId: 'v_community_honesty', toLabel: 'The best communities increase honesty, not just belonging', type: 'supports', note: 'Friendship and virtue reinforce the communal claim.', createdFrom: 'system', dateCreated: iso(18), dateUpdated: iso(26) },
    { id: 'l26', fromType: 'position', fromId: 'v_community_honesty', fromLabel: 'The best communities increase honesty, not just belonging', toType: 'practice', toId: 'p_community_feedback', toLabel: 'Community feedback session', type: 'tested_by', note: 'The belief is explicitly tested in conversation.', createdFrom: 'system', dateCreated: iso(26), dateUpdated: iso(26) },
    { id: 'l27', fromType: 'position', fromId: 'v_worldview_editable', fromLabel: 'A worldview should be treated as editable, not sacred', toType: 'practice', toId: 'p_belief_challenge', toLabel: 'Weekly belief challenge', type: 'tested_by', note: 'Meta-position turned into a recurring test.', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l28', fromType: 'position', fromId: 'v_worldview_editable', fromLabel: 'A worldview should be treated as editable, not sacred', toType: 'work', toId: 'd_belief_biography', toLabel: 'Why Beliefs Need Biographies', type: 'expressed_in', note: 'Developed directly in the writing studio.', createdFrom: 'system', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l29', fromType: 'position', fromId: 'v_worldview_editable', fromLabel: 'A worldview should be treated as editable, not sacred', toType: 'position', toId: 'v_practice_before_claim', toLabel: 'The strongest ideas are those that can become practices', type: 'coheres', note: 'Both positions reinforce accountable revision.', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l30', fromType: 'position', fromId: 'v_practice_before_claim', fromLabel: 'The strongest ideas are those that can become practices', toType: 'practice', toId: 'p_belief_challenge', toLabel: 'Weekly belief challenge', type: 'tested_by', note: 'Practices test the practice-before-claim rule itself.', createdFrom: 'system', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l31', fromType: 'concept', fromId: 'c_habit', fromLabel: 'Habit', toType: 'position', toId: 'v_repetition_identity', toLabel: 'Repetition shapes identity more reliably than intention', type: 'supports', note: 'Habit language directly supports the position.', createdFrom: 'manual', dateCreated: iso(21), dateUpdated: iso(26) },
    { id: 'l32', fromType: 'concept', fromId: 'c_self_deception', fromLabel: 'Self-Deception', toType: 'inquiry', toId: 'q_moral_seriousness', toLabel: 'When does moral seriousness become a strategy for avoiding vulnerability?', type: 'defines', note: 'The concept sharpens the inquiry target.', createdFrom: 'manual', dateCreated: iso(18), dateUpdated: iso(26) },
    { id: 'l33', fromType: 'concept', fromId: 'c_truth', fromLabel: 'Truth', toType: 'position', toId: 'v_worldview_editable', toLabel: 'A worldview should be treated as editable, not sacred', type: 'supports', note: 'Truth as contact with reality supports revision.', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l34', fromType: 'position', fromId: 'v_responsibility_uncertainty', fromLabel: 'Moral action often requires provisional commitment before certainty', toType: 'work', toId: 'd_responsibility_without_certainty', toLabel: 'Responsibility Without Certainty', type: 'expressed_in', note: 'The position is being worked out in a dedicated essay.', createdFrom: 'system', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l35', fromType: 'position', fromId: 'v_commit_before_clarity', fromLabel: 'Commitment can generate meaning before certainty exists', toType: 'position', toId: 'v_responsibility_uncertainty', toLabel: 'Moral action often requires provisional commitment before certainty', type: 'strengthens', note: 'The moral version extends the meaning claim.', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l36', fromType: 'position', fromId: 'v_pure_story_self', fromLabel: 'Identity is fundamentally narrative', toType: 'position', toId: 'v_repetition_identity', toLabel: 'Repetition shapes identity more reliably than intention', type: 'contradicts', note: 'Narrative and repetition compete for explanatory center.', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l37', fromType: 'source', fromId: 'm_kierkegaard', fromLabel: 'The Sickness Unto Death', toType: 'concept', toId: 'c_self_deception', toLabel: 'Self-Deception', type: 'inspired_by', note: 'A primary source for the concept definition.', createdFrom: 'system', dateCreated: iso(19), dateUpdated: iso(26) },
    { id: 'l38', fromType: 'source', fromId: 'm_camus', fromLabel: 'The Myth of Sisyphus', toType: 'position', toId: 'v_responsibility_uncertainty', toLabel: 'Moral action often requires provisional commitment before certainty', type: 'supports', note: 'Absurdity and seriousness are key background supports.', createdFrom: 'system', dateCreated: iso(20), dateUpdated: iso(26) },
    { id: 'l39', fromType: 'source', fromId: 'm_hooks', fromLabel: 'All About Love', toType: 'practice', toId: 'p_community_feedback', toLabel: 'Community feedback session', type: 'inspired_by', note: 'The practice is grounded in care and truth.', createdFrom: 'system', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l40', fromType: 'concept', fromId: 'c_community', fromLabel: 'Community', toType: 'position', toId: 'v_solitude_isolation', toLabel: 'Solitude is necessary for self-knowledge, but isolation distorts it', type: 'refines', note: 'Community sharpens the boundary condition for solitude.', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l41', fromType: 'position', fromId: 'v_solitude_isolation', fromLabel: 'Solitude is necessary for self-knowledge, but isolation distorts it', toType: 'work', toId: 'd_fragments_solitude', toLabel: 'Fragments on Solitude', type: 'expressed_in', note: 'Being developed in fragments form.', createdFrom: 'system', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l42', fromType: 'position', fromId: 'v_community_honesty', fromLabel: 'The best communities increase honesty, not just belonging', toType: 'position', toId: 'v_solitude_isolation', toLabel: 'Solitude is necessary for self-knowledge, but isolation distorts it', type: 'coheres', note: 'The two positions complete each other.', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l43', fromType: 'source', fromId: 'm_ethics', fromLabel: 'Nicomachean Ethics', toType: 'position', toId: 'v_practice_before_claim', toLabel: 'The strongest ideas are those that can become practices', type: 'supports', note: 'Virtue ethics supports the practice orientation.', createdFrom: 'system', dateCreated: iso(18), dateUpdated: iso(26) },
    { id: 'l44', fromType: 'concept', fromId: 'c_technology', fromLabel: 'Technology', toType: 'inquiry', toId: 'q_truth_entertainment', toLabel: 'What does truth become when entertainment is the default delivery system?', type: 'expands', note: 'The inquiry is one expression of the broader technology concept.', createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l45', fromType: 'position', fromId: 'v_comfort_reality', fromLabel: 'Comfort becomes dangerous when it prevents contact with reality', toType: 'position', toId: 'v_commit_before_clarity', toLabel: 'Commitment can generate meaning before certainty exists', type: 'weakens', note: 'The position warns against commitment becoming self-soothing fantasy.', createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { id: 'l46', fromType: 'position', fromId: 'v_practice_before_claim', fromLabel: 'The strongest ideas are those that can become practices', toType: 'position', toId: 'v_worldview_editable', toLabel: 'A worldview should be treated as editable, not sacred', type: 'depends_on', note: 'The rule depends on a revisable worldview model.', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { id: 'l47', fromType: 'source', fromId: 'm_republic', fromLabel: 'Republic', toType: 'concept', toId: 'c_power', toLabel: 'Power', type: 'inspired_by', note: 'A classic source for the power cluster.', createdFrom: 'system', dateCreated: iso(17), dateUpdated: iso(26) },
    { id: 'l48', fromType: 'source', fromId: 'm_burnout', fromLabel: 'The Burnout Society', toType: 'concept', toId: 'c_ambition', toLabel: 'Ambition', type: 'inspired_by', note: 'Achievement culture sharpened the ambition concept.', createdFrom: 'system', dateCreated: iso(23), dateUpdated: iso(26) }
  );

  suggestions.push(
    { id: 's9', targetType: 'position', targetId: 'v_technology_trains_self', targetLabel: 'Technology should be judged by what it trains the user to become', suggestionType: 'missing_perspective', title: 'Missing perspective', body: 'You may be missing a communal perspective that asks how technologies train groups, not only individuals.', reasoning: 'Most current links examine identity and attention at the personal level.', evidence: ['Deep Work notes', 'Postman annotations'], confidence: 0.73, status: 'pending', createdFrom: 'ai', dateCreated: iso(25, 12), dateUpdated: iso(25, 12) },
    { id: 's10', targetType: 'position', targetId: 'v_comfort_reality', targetLabel: 'Comfort becomes dangerous when it prevents contact with reality', suggestionType: 'stress_test', title: 'Stress test', body: 'What evidence would show that comfort was restorative rather than evasive in a given case?', reasoning: 'The position risks collapsing care into avoidance.', evidence: ['burnout notes', 'community and care sources'], confidence: 0.81, status: 'pending', createdFrom: 'ai', dateCreated: iso(25, 13), dateUpdated: iso(25, 13) },
    { id: 's11', targetType: 'position', targetId: 'v_worldview_editable', targetLabel: 'A worldview should be treated as editable, not sacred', suggestionType: 'thinking_pattern', title: 'Emerging pattern', body: 'Recent work suggests you often treat revision as a sign of seriousness rather than weakness.', reasoning: 'Several belief biographies and challenges were accepted rather than hidden.', evidence: ['position revision events', 'belief challenge practice'], confidence: 0.77, status: 'pending', createdFrom: 'ai', dateCreated: iso(25, 14), dateUpdated: iso(25, 14) },
    { id: 's12', targetType: 'inquiry', targetId: 'q_honest_community', targetLabel: 'What kind of community makes a person more honest?', suggestionType: 'missing_question', title: 'Missing question', body: 'What practices make community criticism feel usable rather than humiliating?', reasoning: 'The inquiry names the desired community but not the process that makes correction livable.', evidence: ['hooks annotations', 'community feedback practice'], confidence: 0.75, status: 'pending', createdFrom: 'ai', dateCreated: iso(25, 15), dateUpdated: iso(25, 15) }
  );

  timeline.push(
    { id: 't_epictetus_agency', entityId: 'm_epictetus', entityType: 'media', entityTitle: 'Enchiridion', eventType: 'expanded', reason: 'Added the source to sharpen agency and freedom.', influencedBy: [], date: iso(16) },
    { id: 't_republic_desire', entityId: 'm_republic', entityType: 'media', entityTitle: 'Republic', eventType: 'expanded', reason: 'Opened a new line around desire, order, and plurality.', influencedBy: [], date: iso(17) },
    { id: 't_ethics_habit', entityId: 'm_ethics', entityType: 'media', entityTitle: 'Nicomachean Ethics', eventType: 'expanded', reason: 'Strengthened the habit and virtue cluster.', influencedBy: [], date: iso(18) },
    { id: 't_nietzsche_truth', entityId: 'm_nietzsche', entityType: 'media', entityTitle: 'Genealogy of Morals', eventType: 'challenged', reason: 'Introduced suspicion toward flattering moral language.', influencedBy: [], date: iso(18, 18) },
    { id: 't_kierkegaard_self', entityId: 'm_kierkegaard', entityType: 'media', entityTitle: 'The Sickness Unto Death', eventType: 'expanded', reason: 'Deepened self-deception and inward honesty themes.', influencedBy: [], date: iso(19) },
    { id: 't_camus_uncertainty', entityId: 'm_camus', entityType: 'media', entityTitle: 'The Myth of Sisyphus', eventType: 'expanded', reason: 'Gave the uncertainty and freedom themes more existential weight.', influencedBy: [], date: iso(20) },
    { id: 't_atomic_identity', entityId: 'v_repetition_identity', entityType: 'vault', entityTitle: 'Repetition shapes identity more reliably than intention', eventType: 'created', reason: 'Habit notes hardened into a live position.', influencedBy: ['m_atomic_habits'], date: iso(21) },
    { id: 't_deep_work_tech', entityId: 'v_technology_trains_self', entityType: 'vault', entityTitle: 'Technology should be judged by what it trains the user to become', eventType: 'created', reason: 'Attention and media sources converged into a tech position.', influencedBy: ['m_deep_work', 'm_postman'], date: iso(22) },
    { id: 't_burnout_comfort', entityId: 'v_comfort_reality', entityType: 'vault', entityTitle: 'Comfort becomes dangerous when it prevents contact with reality', eventType: 'created', reason: 'Burnout notes and practice review produced a new tension-rich model.', influencedBy: ['m_burnout'], date: iso(24) },
    { id: 't_worldview_editable', entityId: 'v_worldview_editable', entityType: 'vault', entityTitle: 'A worldview should be treated as editable, not sacred', eventType: 'created', reason: 'Belief revision patterns became a position of their own.', influencedBy: ['te2', 'te5'], date: iso(24, 16) },
    { id: 't_responsibility_revision', entityId: 'v_responsibility_uncertainty', entityType: 'vault', entityTitle: 'Moral action often requires provisional commitment before certainty', eventType: 'revised', reason: 'Added a stronger caution against rash certainty.', influencedBy: ['m_camus', 'm_hooks'], date: iso(26) },
    { id: 't_solitude_position', entityId: 'v_solitude_isolation', entityType: 'vault', entityTitle: 'Solitude is necessary for self-knowledge, but isolation distorts it', eventType: 'created', reason: 'Fragments on solitude became a clearer position.', influencedBy: ['m_movie_paterson', 'm_hooks'], date: iso(24, 18) },
    { id: 't_community_position', entityId: 'v_community_honesty', entityType: 'vault', entityTitle: 'The best communities increase honesty, not just belonging', eventType: 'created', reason: 'Community notes consolidated into a position.', influencedBy: ['m_hooks', 'm_ethics'], date: iso(25) },
    { id: 't_practice_before_claim', entityId: 'v_practice_before_claim', entityType: 'vault', entityTitle: 'The strongest ideas are those that can become practices', eventType: 'created', reason: 'System rule emerged from repeated use of the Works and Practices loop.', influencedBy: ['p_attention_fast', 'p_belief_challenge'], date: iso(25, 14) },
    { id: 't_deep_reading_practice', entityId: 'p_deep_reading_block', entityType: 'practice', entityTitle: 'One-hour deep reading block', eventType: 'created', reason: 'Created to test the attention and technology positions.', influencedBy: ['v_attention_rule', 'v_technology_trains_self'], date: iso(22) },
    { id: 't_solitude_walk_practice', entityId: 'p_solitude_walk', entityType: 'practice', entityTitle: 'Solitude walk without phone', eventType: 'created', reason: 'Created to test whether solitude clarifies or distorts.', influencedBy: ['v_solitude_isolation'], date: iso(23) },
    { id: 't_desire_journal_practice', entityId: 'p_desire_journal', entityType: 'practice', entityTitle: 'Desire journal', eventType: 'created', reason: 'Added to investigate admiration, ambition, and self-deception.', influencedBy: ['m_republic', 'm_burnout'], date: iso(26) },
    { id: 't_community_feedback_practice', entityId: 'p_community_feedback', entityType: 'practice', entityTitle: 'Community feedback session', eventType: 'created', reason: 'Added as the main social reality-test practice.', influencedBy: ['v_community_honesty'], date: iso(26) },
    { id: 't_belief_challenge_practice', entityId: 'p_belief_challenge', entityType: 'practice', entityTitle: 'Weekly belief challenge', eventType: 'created', reason: 'Turned belief revision into a recurring discipline.', influencedBy: ['v_worldview_editable'], date: iso(24, 19) },
    { id: 't_work_technology', entityId: 'd_technology_notes', entityType: 'draft', entityTitle: 'Notes Toward a Philosophy of Technology', eventType: 'expanded', reason: 'A multi-source position opened into a dedicated writing project.', influencedBy: ['v_technology_trains_self'], date: iso(25) },
    { id: 't_work_biography', entityId: 'd_belief_biography', entityType: 'draft', entityTitle: 'Why Beliefs Need Biographies', eventType: 'expanded', reason: 'Metacognition work was pulled into writing.', influencedBy: ['v_worldview_editable'], date: iso(25, 10) },
    { id: 't_unknown_community', entityId: 'u_accountability_gap', entityType: 'unknown', entityTitle: 'Whether current positions are too individualistic', eventType: 'created', reason: 'Community and accountability remained underdeveloped relative to self-focused positions.', influencedBy: ['m_hooks'], date: iso(25, 16) }
  );

  beliefProfiles.push(
    { positionId: 'v_repetition_identity', createdAt: iso(21), createdFrom: 'idea', originSummary: 'Created from habit and identity sources.', strengthenedBy: ['Atomic Habits', 'Ethics notes'], challengedBy: ['Cases where intentional rupture changes identity quickly'], weakenedBy: [], confidenceScore: 79, certaintyLevel: 4, evidenceQuality: 'high', testingCount: 1, reviewStatus: 'current', updatedAt: iso(26) },
    { positionId: 'v_technology_trains_self', createdAt: iso(22), createdFrom: 'idea', originSummary: 'Created from depth, media, and burnout sources about training effects.', strengthenedBy: ['Deep Work', 'Amusing Ourselves to Death'], challengedBy: ['Intentional-use counterargument'], weakenedBy: [], confidenceScore: 84, certaintyLevel: 4, evidenceQuality: 'high', testingCount: 1, reviewStatus: 'current', updatedAt: iso(26) },
    { positionId: 'v_worldview_editable', createdAt: iso(24), createdFrom: 'manual', originSummary: 'Created from revision patterns in the workspace itself.', strengthenedBy: ['Belief challenge practice', 'Position revision events'], challengedBy: ['Risk of perpetual provisionality'], weakenedBy: [], confidenceScore: 88, certaintyLevel: 4, evidenceQuality: 'high', testingCount: 2, reviewStatus: 'current', updatedAt: iso(26) },
    { positionId: 'v_responsibility_uncertainty', createdAt: iso(23), createdFrom: 'manual', originSummary: 'Formed from responsibility, Camus, and care sources.', strengthenedBy: ['Camus notes', 'bell hooks notes'], challengedBy: ['Rash action danger'], weakenedBy: [], confidenceScore: 74, certaintyLevel: 3, evidenceQuality: 'moderate', testingCount: 1, reviewStatus: 'current', lastRevisedAt: iso(26), updatedAt: iso(26) },
    { positionId: 'v_solitude_isolation', createdAt: iso(24), createdFrom: 'manual', originSummary: 'Created from solitude, truth, and community tensions.', strengthenedBy: ['Paterson notes', 'feedback practice design'], challengedBy: ['Overcorrection toward social dependence'], weakenedBy: [], confidenceScore: 71, certaintyLevel: 3, evidenceQuality: 'moderate', testingCount: 1, reviewStatus: 'current', updatedAt: iso(26) }
  );

  unknowns.push(
    { unknownId: 'u_clarity_fear', title: 'Whether the desire for clarity is sometimes fear of ambiguity', description: 'Some demand for clean articulation may be an avoidance of lived uncertainty.', domain: 'meaning', sourceIds: ['m_article_meaning', 'm_camus'], positionIds: ['v_commit_before_clarity', 'v_responsibility_uncertainty'], inquiryIds: ['q_responsibility_before_certainty'], conceptTags: ['Meaning', 'Humility'], questionIds: ['q_responsibility_before_certainty'], status: 'active', importance: 'high', createdFrom: 'manual', dateCreated: iso(25), dateUpdated: iso(26) },
    { unknownId: 'u_technology_attention', title: 'Whether technology is weakening attention or revealing already weak attention', description: 'The current evidence does not fully separate environmental shaping from preexisting attentional fragility.', domain: 'technology', sourceIds: ['m_deep_work', 'm_postman', 'm_burnout'], positionIds: ['v_technology_trains_self'], inquiryIds: ['q_truth_entertainment'], conceptTags: ['Technology', 'Attention'], questionIds: ['q_truth_entertainment'], status: 'exploring', importance: 'high', createdFrom: 'ai', dateCreated: iso(25), dateUpdated: iso(26) },
    { unknownId: 'u_accountability_gap', title: 'Whether current positions are too individualistic', description: 'The workspace may still privilege self-mastery over shared correction and relational obligation.', domain: 'community', sourceIds: ['m_hooks', 'm_ethics'], positionIds: ['v_worldview_editable', 'v_community_honesty'], inquiryIds: ['q_honest_community'], conceptTags: ['Community', 'Care'], questionIds: ['q_honest_community'], status: 'active', importance: 'medium', createdFrom: 'ai', dateCreated: iso(25), dateUpdated: iso(26) },
    { unknownId: 'u_productivity_seriousness', title: 'Whether productivity is being confused with seriousness', description: 'Several notes imply that visible output may still be masquerading as depth or care.', domain: 'practice', sourceIds: ['m_burnout', 'm_movie_paterson'], positionIds: ['v_attention_rule', 'v_comfort_reality'], inquiryIds: ['q_comfort_growth'], conceptTags: ['Ambition', 'Meaning', 'Care'], questionIds: ['q_comfort_growth'], status: 'exploring', importance: 'medium', createdFrom: 'manual', dateCreated: iso(24), dateUpdated: iso(26) },
    { unknownId: 'u_practices_change_beliefs', title: 'Whether practices are actually changing beliefs or merely decorating them', description: 'The app has many strong links between positions and practices, but it still needs more evidence of belief change caused by practice.', domain: 'practice', sourceIds: ['m_podcast_huberman', 'm_ethics'], positionIds: ['v_practice_before_claim', 'v_worldview_editable'], inquiryIds: ['q_belief_worth_keeping'], conceptTags: ['Practice', 'Truth'], questionIds: ['q_belief_worth_keeping'], status: 'active', importance: 'high', createdFrom: 'system', dateCreated: iso(25), dateUpdated: iso(26) }
  );

  thinkingPatterns.push(
    { patternId: 'tp_technology_identity', patternType: 'reasoning_style', label: 'Technology questions repeatedly route into identity formation', description: 'Recent evidence suggests the workspace reads tools as training environments for the self, not merely productivity utilities.', evidence: ['technology position', 'truth inquiry', 'deep work and Postman links'], confidence: 0.82, timespan: 'Current season', trendDirection: 'increasing', status: 'acknowledged', createdFrom: 'ai', dateCreated: iso(25), dateUpdated: iso(26) },
    { patternId: 'tp_practice_translation', patternType: 'revision_pattern', label: 'Abstract claims are often translated into practices', description: 'Many major positions now cash out in specific behavioral tests rather than remaining purely articulated beliefs.', evidence: ['attention practice', 'belief challenge practice', 'community feedback session'], confidence: 0.8, timespan: 'Last 30 days', trendDirection: 'increasing', status: 'pending', createdFrom: 'system', dateCreated: iso(26), dateUpdated: iso(26) },
    { patternId: 'tp_community_gap', patternType: 'conceptual_gap', label: 'Community and accountability remain less developed than self-mastery themes', description: 'The current workspace is becoming more communal, but self-focused positions still dominate the map.', evidence: ['unknown accountability gap', 'fewer community positions than identity positions'], confidence: 0.74, timespan: 'Current season', trendDirection: 'stable', status: 'pending', createdFrom: 'ai', dateCreated: iso(26), dateUpdated: iso(26) }
  );

  thinkingEvents.push(
    { id: 'te11', eventId: 'te11', userId: uid, eventType: 'question_created', entityType: 'inquiry', entityId: 'q_control_moral', targetType: 'inquiry', targetId: 'q_control_moral', sourceType: 'user', summary: 'Created an inquiry about control as a moral category.', origin: 'user', importance: 'medium', relatedEntityIds: { sourceIds: ['m_epictetus'] }, createdAt: iso(16), updatedAt: iso(16) },
    { id: 'te12', eventId: 'te12', userId: uid, eventType: 'position_created', entityType: 'position', entityId: 'v_repetition_identity', targetType: 'position', targetId: 'v_repetition_identity', sourceType: 'user', summary: 'Created a position linking repetition to identity formation.', origin: 'user', importance: 'medium', relatedEntityIds: { sourceIds: ['m_atomic_habits', 'm_ethics'] }, createdAt: iso(21), updatedAt: iso(21) },
    { id: 'te13', eventId: 'te13', userId: uid, eventType: 'position_created', entityType: 'position', entityId: 'v_technology_trains_self', targetType: 'position', targetId: 'v_technology_trains_self', sourceType: 'user', summary: 'Created the technology-and-selfhood position.', origin: 'user', importance: 'high', relatedEntityIds: { sourceIds: ['m_deep_work', 'm_postman'] }, createdAt: iso(22), updatedAt: iso(22) },
    { id: 'te14', eventId: 'te14', userId: uid, eventType: 'link_created', entityType: 'link', entityId: 'l17', targetType: 'position', targetId: 'v_technology_trains_self', relatedTargetType: 'source', relatedTargetId: 'm_deep_work', sourceType: 'system', summary: 'Linked Deep Work as direct support for the technology position.', origin: 'system', importance: 'low', relatedEntityIds: { linkIds: ['l17'], sourceIds: ['m_deep_work'], positionIds: ['v_technology_trains_self'] }, createdAt: iso(22), updatedAt: iso(22) },
    { id: 'te15', eventId: 'te15', userId: uid, eventType: 'practice_created', entityType: 'practice', entityId: 'p_deep_reading_block', targetType: 'practice', targetId: 'p_deep_reading_block', sourceType: 'user', summary: 'Created a deep reading practice to test attention and technology claims.', origin: 'user', importance: 'medium', relatedEntityIds: { practiceIds: ['p_deep_reading_block'], positionIds: ['v_attention_rule', 'v_technology_trains_self'] }, createdAt: iso(22), updatedAt: iso(22) },
    { id: 'te16', eventId: 'te16', userId: uid, eventType: 'created', entityType: 'work', entityId: 'd_technology_notes', targetType: 'work', targetId: 'd_technology_notes', sourceType: 'user', summary: 'Opened a dedicated work for the philosophy of technology cluster.', origin: 'user', importance: 'medium', relatedEntityIds: { workIds: ['d_technology_notes'], positionIds: ['v_technology_trains_self'] }, createdAt: iso(25), updatedAt: iso(25) },
    { id: 'te17', eventId: 'te17', userId: uid, eventType: 'position_created', entityType: 'position', entityId: 'v_worldview_editable', targetType: 'position', targetId: 'v_worldview_editable', sourceType: 'user', summary: 'Created a meta-position treating worldviews as revisable rather than sacred.', origin: 'user', importance: 'high', relatedEntityIds: { positionIds: ['v_identity_action', 'v_withdrawal_rule'] }, createdAt: iso(24, 16), updatedAt: iso(24, 16) },
    { id: 'te18', eventId: 'te18', userId: uid, eventType: 'thinking_pattern_inferred', entityType: 'thinkingPattern', entityId: 'tp_technology_identity', targetType: 'thinking_pattern', targetId: 'tp_technology_identity', sourceType: 'ai', summary: 'Inferred a recurring tendency to read technology through identity and training effects.', origin: 'ai', importance: 'low', createdAt: iso(25), updatedAt: iso(25) },
    { id: 'te19', eventId: 'te19', userId: uid, eventType: 'unknown_created', entityType: 'unknown', entityId: 'u_accountability_gap', targetType: 'unknown', targetId: 'u_accountability_gap', sourceType: 'ai', summary: 'Created an unknown around whether the workspace remains too individualistic.', origin: 'ai', importance: 'medium', relatedEntityIds: { unknownIds: ['u_accountability_gap'], positionIds: ['v_community_honesty', 'v_worldview_editable'] }, createdAt: iso(25, 16), updatedAt: iso(25, 16) },
    { id: 'te20', eventId: 'te20', userId: uid, eventType: 'stress_test_generated', entityType: 'suggestion', entityId: 's10', targetType: 'suggestion', targetId: 's10', relatedTargetType: 'position', relatedTargetId: 'v_comfort_reality', sourceType: 'ai', summary: 'Generated a stress test for the comfort-versus-reality position.', origin: 'ai', importance: 'low', relatedEntityIds: { suggestionIds: ['s10'], positionIds: ['v_comfort_reality'] }, createdAt: iso(25, 13), updatedAt: iso(25, 13) },
    { id: 'te21', eventId: 'te21', userId: uid, eventType: 'position_revised', entityType: 'position', entityId: 'v_responsibility_uncertainty', targetType: 'position', targetId: 'v_responsibility_uncertainty', sourceType: 'user', summary: 'Revised the responsibility-under-uncertainty position to include caution against rashness.', origin: 'user', importance: 'medium', confidenceBefore: 69, confidenceAfter: 74, relatedEntityIds: { sourceIds: ['m_camus', 'm_hooks'] }, createdAt: iso(26), updatedAt: iso(26) },
    { id: 'te22', eventId: 'te22', userId: uid, eventType: 'linked', entityType: 'link', entityId: 'l42', targetType: 'position', targetId: 'v_community_honesty', relatedTargetType: 'position', relatedTargetId: 'v_solitude_isolation', sourceType: 'user', summary: 'Linked community honesty and solitude as mutually refining positions.', origin: 'user', importance: 'medium', relatedEntityIds: { linkIds: ['l42'], positionIds: ['v_community_honesty', 'v_solitude_isolation'] }, createdAt: iso(25), updatedAt: iso(25) }
  );

  atlasMaps.push({
    id: 'map_technology_training',
    title: 'Technology Training Map',
    description: 'A reviewer map focused on how tools, attention, identity, and truth shape one another.',
    nodeNames: ['Technology', 'Attention', 'Identity', 'Truth', 'Agency', 'Practice'],
    nodePositions: {
      Technology: { x: 48, y: 20 },
      Attention: { x: 73, y: 36 },
      Identity: { x: 75, y: 66 },
      Truth: { x: 44, y: 82 },
      Agency: { x: 17, y: 61 },
      Practice: { x: 16, y: 31 },
    },
    manualLinks: [
      { id: 'aml7', from: 'Technology', to: 'Attention', type: 'supports', label: 'trains', note: 'Technology trains the kinds of attention a person can easily sustain.', dateCreated: iso(25) },
      { id: 'aml8', from: 'Attention', to: 'Identity', type: 'refines', label: 'shapes', note: 'Sustained attention changes what identity feels answerable to.', dateCreated: iso(25) },
      { id: 'aml9', from: 'Truth', to: 'Practice', type: 'tested_by', label: 'tested by', note: 'Truth claims need repeatable contact with life.', dateCreated: iso(25) },
    ],
    autoLinkFilters: { sharedSources: true, sharedPositions: true, sharedInquiries: true, sharedWorks: true, sharedPractices: true, conceptLinks: true },
    dateCreated: iso(25),
    dateUpdated: iso(26),
  });

  thinkingMetrics.questionsAsked = questions.length;
  thinkingMetrics.beliefsCreated = vault.length;
  thinkingMetrics.beliefsRevised = thinkingEvents.filter((item) => item.eventType === 'position_revised' || item.eventType === 'revised').length;
  thinkingMetrics.beliefsAbandoned = thinkingEvents.filter((item) => item.eventType === 'position_abandoned' || item.eventType === 'abandoned').length;
  thinkingMetrics.contradictionsDetected = links.filter((item) => item.type === 'contradicts').length;
  thinkingMetrics.contradictionsResolved = thinkingEvents.filter((item) => item.eventType === 'contradiction_resolved' || item.eventType === 'resolved').length;
  thinkingMetrics.connectionsCreated = links.length;
  thinkingMetrics.sourcesStudied = media.filter((item) => item.status === 'Finished').length;
  thinkingMetrics.ideasSynthesized = insights.length;
  thinkingMetrics.unknownsCreated = unknowns.length;
  thinkingMetrics.unknownsResolved = unknowns.filter((item) => item.status === 'resolved').length;
  thinkingMetrics.positionsStressTested = thinkingEvents.filter((item) => item.eventType === 'stress_test_answered' || item.eventType === 'stress_test_generated').length;
  thinkingMetrics.lastComputedAt = iso(26);

  return {
    profile: withDemoSeed(profile),
    preferences: withDemoSeed(preferences),
    goal: withDemoSeed(goal),
    workspace: withDemoSeed({ ...workspace, reviewUid: REVIEW_WORKSPACE_UID } as WorkspaceSettings & { reviewUid: string }),
    media: media.map((item) => withDemoSeed(item)),
    concepts: concepts.map((item) => withDemoSeed(item)),
    questions: questions.map((item) => withDemoSeed(item)),
    vault: vault.map((item) => withDemoSeed(item)),
    drafts: drafts.map((item) => withDemoSeed(item)),
    practices: practices.map((item) => withDemoSeed(item)),
    timeline: timeline.map((item) => withDemoSeed(item)),
    insights: insights.map((item) => withDemoSeed(item)),
    links: links.map((item) => withDemoSeed(item)),
    suggestions: suggestions.map((item) => withDemoSeed(item)),
    atlasMaps: atlasMaps.map((item) => withDemoSeed(item)),
    thinkingEvents: thinkingEvents.map((item) => withDemoSeed(item)),
    beliefProfiles: beliefProfiles.map((item) => withDemoSeed(item)),
    unknowns: unknowns.map((item) => withDemoSeed(item)),
    thinkingPatterns: thinkingPatterns.map((item) => withDemoSeed(item)),
    thinkingMetrics: withDemoSeed(thinkingMetrics),
    profilePrivacy: withDemoSeed(profilePrivacy),
    profileMetacognitionSummary: withDemoSeed(profileMetacognitionSummary),
    settingsAccount: withDemoSeed(settingsAccount),
    settingsAppearance: withDemoSeed(settingsAppearance),
    settingsWorkspace: withDemoSeed(settingsWorkspace),
    settingsAi: withDemoSeed(settingsAi),
    settingsMetacognition: withDemoSeed(settingsMetacognition),
    settingsPrivacy: withDemoSeed(settingsPrivacy),
    settingsData: withDemoSeed(settingsData),
    settingsSourceIntake: withDemoSeed(settingsSourceIntake),
    settingsWorks: withDemoSeed(settingsWorks),
    settingsAtlas: withDemoSeed(settingsAtlas),
    settingsNotifications: withDemoSeed(settingsNotifications),
    settingsGoals: withDemoSeed(settingsGoals),
    settingsDeveloper: withDemoSeed(settingsDeveloper),
  };
}

export function buildReviewExport(args: {
  uid: string;
  profile: UserProfile;
  workspace: WorkspaceSettings;
  counts: Record<string, number>;
  metacognition?: {
    thinkingPatterns: Array<{ label: string; status: string; confidence: number }>;
    unknowns: Array<{ title: string; status: string; importance: string }>;
    metrics: Record<string, number | string>;
  };
}) {
  return {
    exportedAt: new Date().toISOString(),
    navigationTree: noesisGuide.sections.map((section) => ({
      id: section.id,
      label: section.label,
      section: section.section,
      viewId: section.viewId,
      definition: section.definition,
    })),
    pageStructure: noesisGuide.sections.map((section) => ({
      label: section.label,
      whatYouDo: section.whatYouDo,
      connectsTo: section.connectsTo,
      importantActions: section.importantActions,
    })),
    firestoreCollections: readexSchemaDoc(args.uid),
    relationships: {
      relationshipFields: noesisGuide.relationshipFields,
      typedAtlasRelationships: [
        'supports',
        'challenges',
        'coheres',
        'defines',
        'refines',
        'contradicts',
        'exemplifies',
        'inspired_by',
        'tested_by',
        'expressed_in',
        'changed_by',
        'depends_on',
        'explains',
        'explained_by',
        'derived_from',
        'references',
        'replaces',
        'questions',
        'expands',
        'weakens',
        'strengthens',
      ],
      hierarchy: [
        'Sources -> Annotations -> Concepts/Inquiries -> Positions -> Works/Practices -> Evolution',
      ],
    },
    rolePermissions: {
      role: args.workspace.role,
      workspaceMode: args.workspace.workspaceMode,
      demoWorkspace: args.workspace.demoWorkspace,
      writeScope: `/users/${args.uid}`,
      productionIsolation: 'Demo workspace writes remain scoped to the developer account path only.',
    },
    enabledAiFeatures: [
      'Source claim distillation',
      'Reflective question generation',
      'Concept description suggestions',
      'Annotation consequence suggestions',
      'Position drafting',
      'Possible tension detection',
      'Evolution summary suggestions',
    ],
    currentStatistics: args.counts,
    metacognition: args.metacognition || {
      thinkingPatterns: [],
      unknowns: [],
      metrics: {},
    },
    featureFlags: args.workspace.featureFlags,
    profile: {
      displayName: args.profile.displayName,
      email: args.profile.email,
      role: args.profile.role,
    },
    reviewChecklist: [
      'Authentication',
      'Firestore reads and writes',
      'Storage-linked work artifacts',
      'AI generation routes',
      'Atlas linking',
      'Question generation',
      'Possible tensions',
      'Theme compatibility',
      'Desktop, tablet, and mobile layout',
      'Navigation, search, filters, and permissions',
    ],
    roadmapSignals: [
      'Thinking style detection',
      'Belief evolution',
      'Confidence tracking',
      'Unknowns and knowledge gaps',
      'Thinking metrics',
      'Missing perspectives',
      'Blind spot detection',
      'Contradiction network',
      'Worldview simulation',
      'Philosophical profile',
      'Missing questions',
      'Philosophy stress testing',
      'Meta reflection',
    ],
  };
}
