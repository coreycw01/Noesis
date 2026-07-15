"use client";

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useCollection, useDoc } from '@/firebase';
import { readexRefs } from '@/lib/firestore-schema';
import { buildDemoWorkspace } from '@/lib/demo-workspace';
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
  GoalPreferenceSettings,
  GoalSettings,
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
  SourceIntakeSettings,
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
} from '@/lib/types';
import type { NoesisView } from '@/lib/noesis-routes';

export function useNoesisWorkspaceData({
  db,
  uid,
  activeView,
  isOfflineReviewPreview,
}: {
  db: any;
  uid: string;
  activeView: NoesisView;
  isOfflineReviewPreview: boolean;
}) {
  const refs = useMemo(() => readexRefs(db, uid), [db, uid]);
  const reviewPreviewData = useMemo(
    () => (isOfflineReviewPreview ? buildDemoWorkspace(uid) : null),
    [uid, isOfflineReviewPreview]
  );

  const needsMedia = ['atlas', 'concepts', 'library', 'source-index', 'annotations', 'vault', 'questions', 'writing', 'evolution', 'practices', 'goals', 'profile'].includes(activeView);
  const needsVault = ['atlas', 'concepts', 'library', 'source-index', 'annotations', 'vault', 'questions', 'writing', 'practices', 'profile'].includes(activeView);
  const needsInsights = ['atlas', 'concepts'].includes(activeView);
  const needsConcepts = ['atlas', 'concepts', 'library', 'annotations', 'vault', 'questions', 'writing', 'practices', 'profile'].includes(activeView);
  const needsQuestions = ['atlas', 'concepts', 'library', 'annotations', 'vault', 'questions', 'practices', 'profile'].includes(activeView);
  const needsTimeline = ['atlas', 'concepts', 'library', 'vault', 'evolution'].includes(activeView);
  const needsDrafts = ['atlas', 'concepts', 'source-index', 'vault', 'questions', 'writing', 'practices', 'profile'].includes(activeView);
  const needsPractices = ['atlas', 'concepts', 'source-index', 'library', 'vault', 'writing', 'practices', 'profile'].includes(activeView);
  const needsAtlasMaps = activeView === 'atlas';
  const needsLinks = ['atlas', 'vault'].includes(activeView);
  const needsSuggestions = ['vault'].includes(activeView);
  const needsThinkingEvents = ['atlas', 'evolution', 'profile'].includes(activeView);
  const needsBeliefProfiles = ['vault', 'profile'].includes(activeView);
  const needsUnknowns = ['atlas', 'vault', 'evolution', 'profile'].includes(activeView);
  const needsThinkingPatterns = ['evolution', 'profile'].includes(activeView);
  const needsThinkingMetrics = ['evolution', 'profile'].includes(activeView);
  const needsGoalDoc = ['goals'].includes(activeView);
  const needsPreferencesDoc = ['writing', 'settings'].includes(activeView);
  const needsLegacyProfileDoc = ['profile', 'settings'].includes(activeView);
  const needsProfileDocs = ['profile'].includes(activeView);
  const needsAllSettings = ['settings'].includes(activeView);
  const needsWorkspaceDoc = activeView === 'settings' || activeView === 'profile';

  const { data: mediaLive = [], loading: mediaLoadingLive } = useCollection<Media>(isOfflineReviewPreview || !needsMedia ? null : refs.media as any);
  const { data: vaultLive = [], loading: vaultLoadingLive } = useCollection<VaultEntry>(isOfflineReviewPreview || !needsVault ? null : refs.vault as any);
  const { data: insightsLive = [], loading: insightsLoadingLive } = useCollection<Insight>(isOfflineReviewPreview || !needsInsights ? null : refs.insights as any);
  const { data: conceptsLive = [], loading: conceptsLoadingLive } = useCollection<Concept>(isOfflineReviewPreview || !needsConcepts ? null : refs.concepts as any);
  const { data: questionsLive = [], loading: questionsLoadingLive } = useCollection<Question>(isOfflineReviewPreview || !needsQuestions ? null : refs.questions as any);
  const { data: timelineLive = [], loading: timelineLoadingLive } = useCollection<TimelineEvent>(isOfflineReviewPreview || !needsTimeline ? null : refs.timeline as any);
  const { data: draftsLive = [], loading: draftsLoadingLive } = useCollection<Draft>(isOfflineReviewPreview || !needsDrafts ? null : refs.drafts as any);
  const { data: practicesLive = [], loading: practicesLoadingLive } = useCollection<Practice>(isOfflineReviewPreview || !needsPractices ? null : refs.practices as any);
  const { data: atlasMapsLive = [], loading: atlasMapsLoadingLive } = useCollection<AtlasMap>(isOfflineReviewPreview || !needsAtlasMaps ? null : refs.atlasMaps as any);
  const { data: linksLive = [], loading: linksLoadingLive } = useCollection<PhilosophicalLink>(isOfflineReviewPreview || !needsLinks ? null : refs.links as any);
  const { data: suggestionsLive = [], loading: suggestionsLoadingLive } = useCollection<AiSuggestion>(isOfflineReviewPreview || !needsSuggestions ? null : refs.suggestions as any);
  const { data: thinkingEventsLive = [], loading: thinkingEventsLoadingLive } = useCollection<ThinkingEvent>(isOfflineReviewPreview || !needsThinkingEvents ? null : refs.thinkingEvents as any);
  const { data: beliefProfilesLive = [], loading: beliefProfilesLoadingLive } = useCollection<BeliefProfile>(isOfflineReviewPreview || !needsBeliefProfiles ? null : refs.beliefProfiles as any);
  const { data: unknownsLive = [], loading: unknownsLoadingLive } = useCollection<Unknown>(isOfflineReviewPreview || !needsUnknowns ? null : refs.unknowns as any);
  const { data: thinkingPatternsLive = [], loading: thinkingPatternsLoadingLive } = useCollection<ThinkingPattern>(isOfflineReviewPreview || !needsThinkingPatterns ? null : refs.thinkingPatterns as any);
  const { data: thinkingMetricsDocLive, loading: thinkingMetricsLoadingLive } = useDoc<ThinkingMetrics>(isOfflineReviewPreview || !needsThinkingMetrics ? null : doc(refs.thinkingMetrics, 'summary') as any);
  const { data: goalDocLive, loading: goalLoadingLive } = useDoc<GoalSettings>(isOfflineReviewPreview || !needsGoalDoc ? null : refs.settingsGoal as any);
  const { data: legacyPreferencesDocLive, loading: preferencesLoadingLive } = useDoc<UserPreferences>(isOfflineReviewPreview || !needsPreferencesDoc ? null : refs.settingsPreferences as any);
  const { data: legacyProfileDocLive, loading: legacyProfileLoadingLive } = useDoc<UserProfile>(isOfflineReviewPreview || !needsLegacyProfileDoc ? null : refs.legacySettingsProfile as any);
  const { data: workspaceDocLive, loading: workspaceLoadingLive } = useDoc<WorkspaceSettings>(isOfflineReviewPreview || !needsWorkspaceDoc ? null : refs.settingsWorkspace as any);
  const { data: profileMainDocLive, loading: profileMainLoadingLive } = useDoc<UserProfile>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profileMain as any);
  const { data: profilePrivacyDocLive, loading: profilePrivacyLoadingLive } = useDoc<ProfilePrivacySettings>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profilePrivacy as any);
  const { data: profileSummaryDocLive, loading: profileSummaryLoadingLive } = useDoc<ProfileMetacognitionSummary>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profileMetacognitionSummary as any);
  const { data: settingsAccountDocLive, loading: settingsAccountLoadingLive } = useDoc<AccountSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsAccount as any);
  const { data: settingsAppearanceDocLive, loading: settingsAppearanceLoadingLive } = useDoc<AppearanceSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsAppearance as any);
  const { data: settingsWorkspacePrefsDocLive, loading: settingsWorkspacePrefsLoadingLive } = useDoc<WorkspacePreferenceSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsWorkspace as any);
  const { data: settingsAiDocLive, loading: settingsAiLoadingLive } = useDoc<AiSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsAi as any);
  const { data: settingsMetacognitionDocLive, loading: settingsMetacognitionLoadingLive } = useDoc<MetacognitionSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsMetacognition as any);
  const { data: settingsPrivacyDocLive, loading: settingsPrivacyLoadingLive } = useDoc<PrivacySettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsPrivacy as any);
  const { data: settingsDataDocLive, loading: settingsDataLoadingLive } = useDoc<DataSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsData as any);
  const { data: settingsSourceIntakeDocLive, loading: settingsSourceIntakeLoadingLive } = useDoc<SourceIntakeSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsSourceIntake as any);
  const { data: settingsWorksDocLive, loading: settingsWorksLoadingLive } = useDoc<WorksSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsWorks as any);
  const { data: settingsAtlasDocLive, loading: settingsAtlasLoadingLive } = useDoc<AtlasSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsAtlas as any);
  const { data: settingsNotificationsDocLive, loading: settingsNotificationsLoadingLive } = useDoc<NotificationSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsNotifications as any);
  const { data: settingsGoalsDocLive, loading: settingsGoalsLoadingLive } = useDoc<GoalPreferenceSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsGoals as any);
  const { data: settingsDeveloperDocLive, loading: settingsDeveloperLoadingLive } = useDoc<DeveloperSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsDeveloper as any);

  return {
    refs,
    media: isOfflineReviewPreview ? (reviewPreviewData?.media || []) : mediaLive,
    vault: isOfflineReviewPreview ? (reviewPreviewData?.vault || []) : vaultLive,
    insights: isOfflineReviewPreview ? (reviewPreviewData?.insights || []) : insightsLive,
    concepts: isOfflineReviewPreview ? (reviewPreviewData?.concepts || []) : conceptsLive,
    questions: isOfflineReviewPreview ? (reviewPreviewData?.questions || []) : questionsLive,
    timeline: isOfflineReviewPreview ? (reviewPreviewData?.timeline || []) : timelineLive,
    drafts: isOfflineReviewPreview ? (reviewPreviewData?.drafts || []) : draftsLive,
    practices: isOfflineReviewPreview ? (reviewPreviewData?.practices || []) : practicesLive,
    atlasMaps: isOfflineReviewPreview ? (reviewPreviewData?.atlasMaps || []) : atlasMapsLive,
    links: isOfflineReviewPreview ? (reviewPreviewData?.links || []) : linksLive,
    suggestions: isOfflineReviewPreview ? (reviewPreviewData?.suggestions || []) : suggestionsLive,
    thinkingEvents: isOfflineReviewPreview ? (reviewPreviewData?.thinkingEvents || []) : thinkingEventsLive,
    beliefProfiles: isOfflineReviewPreview ? (reviewPreviewData?.beliefProfiles || []) : beliefProfilesLive,
    unknowns: isOfflineReviewPreview ? (reviewPreviewData?.unknowns || []) : unknownsLive,
    thinkingPatterns: isOfflineReviewPreview ? (reviewPreviewData?.thinkingPatterns || []) : thinkingPatternsLive,
    thinkingMetricsDoc: isOfflineReviewPreview ? (reviewPreviewData?.thinkingMetrics || null) : thinkingMetricsDocLive,
    goalDoc: isOfflineReviewPreview ? (reviewPreviewData?.goal || null) : goalDocLive,
    legacyPreferencesDoc: isOfflineReviewPreview ? (reviewPreviewData?.preferences || null) : legacyPreferencesDocLive,
    legacyProfileDoc: isOfflineReviewPreview ? (reviewPreviewData?.profile || null) : legacyProfileDocLive,
    workspaceDoc: isOfflineReviewPreview ? (reviewPreviewData?.workspace || null) : workspaceDocLive,
    profileMainDoc: isOfflineReviewPreview ? (reviewPreviewData?.profile || null) : profileMainDocLive,
    profilePrivacyDoc: isOfflineReviewPreview ? (reviewPreviewData?.profilePrivacy || null) : profilePrivacyDocLive,
    profileSummaryDoc: isOfflineReviewPreview ? (reviewPreviewData?.profileMetacognitionSummary || null) : profileSummaryDocLive,
    settingsAccountDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsAccount || null) : settingsAccountDocLive,
    settingsAppearanceDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsAppearance || null) : settingsAppearanceDocLive,
    settingsWorkspacePrefsDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsWorkspace || null) : settingsWorkspacePrefsDocLive,
    settingsAiDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsAi || null) : settingsAiDocLive,
    settingsMetacognitionDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsMetacognition || null) : settingsMetacognitionDocLive,
    settingsPrivacyDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsPrivacy || null) : settingsPrivacyDocLive,
    settingsDataDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsData || null) : settingsDataDocLive,
    settingsSourceIntakeDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsSourceIntake || null) : settingsSourceIntakeDocLive,
    settingsWorksDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsWorks || null) : settingsWorksDocLive,
    settingsAtlasDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsAtlas || null) : settingsAtlasDocLive,
    settingsNotificationsDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsNotifications || null) : settingsNotificationsDocLive,
    settingsGoalsDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsGoals || null) : settingsGoalsDocLive,
    settingsDeveloperDoc: isOfflineReviewPreview ? (reviewPreviewData?.settingsDeveloper || null) : settingsDeveloperDocLive,
    loading: {
      media: isOfflineReviewPreview ? false : mediaLoadingLive,
      vault: isOfflineReviewPreview ? false : vaultLoadingLive,
      insights: isOfflineReviewPreview ? false : insightsLoadingLive,
      concepts: isOfflineReviewPreview ? false : conceptsLoadingLive,
      questions: isOfflineReviewPreview ? false : questionsLoadingLive,
      timeline: isOfflineReviewPreview ? false : timelineLoadingLive,
      drafts: isOfflineReviewPreview ? false : draftsLoadingLive,
      practices: isOfflineReviewPreview ? false : practicesLoadingLive,
      atlasMaps: isOfflineReviewPreview ? false : atlasMapsLoadingLive,
      links: isOfflineReviewPreview ? false : linksLoadingLive,
      suggestions: isOfflineReviewPreview ? false : suggestionsLoadingLive,
      thinkingEvents: isOfflineReviewPreview ? false : thinkingEventsLoadingLive,
      beliefProfiles: isOfflineReviewPreview ? false : beliefProfilesLoadingLive,
      unknowns: isOfflineReviewPreview ? false : unknownsLoadingLive,
      thinkingPatterns: isOfflineReviewPreview ? false : thinkingPatternsLoadingLive,
      thinkingMetrics: isOfflineReviewPreview ? false : thinkingMetricsLoadingLive,
      goal: isOfflineReviewPreview ? false : goalLoadingLive,
      preferences: isOfflineReviewPreview ? false : preferencesLoadingLive,
      legacyProfile: isOfflineReviewPreview ? false : legacyProfileLoadingLive,
      workspace: isOfflineReviewPreview ? false : workspaceLoadingLive,
      profileMain: isOfflineReviewPreview ? false : profileMainLoadingLive,
      profilePrivacy: isOfflineReviewPreview ? false : profilePrivacyLoadingLive,
      profileSummary: isOfflineReviewPreview ? false : profileSummaryLoadingLive,
      settingsAccount: isOfflineReviewPreview ? false : settingsAccountLoadingLive,
      settingsAppearance: isOfflineReviewPreview ? false : settingsAppearanceLoadingLive,
      settingsWorkspacePrefs: isOfflineReviewPreview ? false : settingsWorkspacePrefsLoadingLive,
      settingsAi: isOfflineReviewPreview ? false : settingsAiLoadingLive,
      settingsMetacognition: isOfflineReviewPreview ? false : settingsMetacognitionLoadingLive,
      settingsPrivacy: isOfflineReviewPreview ? false : settingsPrivacyLoadingLive,
      settingsData: isOfflineReviewPreview ? false : settingsDataLoadingLive,
      settingsSourceIntake: isOfflineReviewPreview ? false : settingsSourceIntakeLoadingLive,
      settingsWorks: isOfflineReviewPreview ? false : settingsWorksLoadingLive,
      settingsAtlas: isOfflineReviewPreview ? false : settingsAtlasLoadingLive,
      settingsNotifications: isOfflineReviewPreview ? false : settingsNotificationsLoadingLive,
      settingsGoals: isOfflineReviewPreview ? false : settingsGoalsLoadingLive,
      settingsDeveloper: isOfflineReviewPreview ? false : settingsDeveloperLoadingLive,
    },
  };
}
