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

  return {
    profile,
    preferences,
    goal,
    workspace,
    media,
    concepts,
    questions,
    vault,
    drafts,
    practices,
    timeline,
    insights,
    links,
    suggestions,
    atlasMaps,
    thinkingEvents,
    beliefProfiles,
    unknowns,
    thinkingPatterns,
    thinkingMetrics,
    profilePrivacy,
    profileMetacognitionSummary,
    settingsAccount,
    settingsAppearance,
    settingsWorkspace,
    settingsAi,
    settingsMetacognition,
    settingsPrivacy,
    settingsData,
    settingsSourceIntake,
    settingsWorks,
    settingsAtlas,
    settingsNotifications,
    settingsGoals,
    settingsDeveloper,
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
