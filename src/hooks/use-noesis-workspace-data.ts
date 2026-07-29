"use client";

import { useMemo } from 'react';
import { doc, limit, orderBy, query } from 'firebase/firestore';
import { useCollection, useDoc } from '@/firebase';
import { readexRefs } from '@/lib/firestore-schema';
import { buildDemoWorkspace } from '@/lib/demo-workspace';
import {
  NOESIS_SHELL_SUMMARY_REQUIREMENTS,
  dataRequirementsForNoesisRoute,
  routeNeedsData,
  shellNeedsSummaryData,
  type NoesisWorkspaceDataKey,
} from '@/lib/noesis-page-definitions';
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
  WorkspaceSummary,
} from '@/lib/types';
import type { NoesisRouteState, NoesisView } from '@/lib/noesis-routes';

function recordsForWorkspace<T>(records: T[], uid: string) {
  return records.filter((record) => {
    const owner = (record as any)?.userId || (record as any)?.uid;
    return !owner || owner === uid;
  });
}

export function useNoesisWorkspaceData({
  db,
  uid,
  activeView,
  routeState,
  isOfflineReviewPreview,
}: {
  db: any;
  uid: string;
  activeView: NoesisView;
  routeState?: NoesisRouteState;
  isOfflineReviewPreview: boolean;
}) {
  const refs = useMemo(() => readexRefs(db, uid), [db, uid]);
  const effectiveRouteState = routeState || { view: activeView };
  const reviewPreviewData = useMemo(
    () => (isOfflineReviewPreview ? buildDemoWorkspace(uid) : null),
    [uid, isOfflineReviewPreview]
  );

  const { data: workspaceSummaryDocLive, loading: workspaceSummaryLoadingLive } = useDoc<WorkspaceSummary>(
    isOfflineReviewPreview ? null : refs.settingsWorkspaceSummary as any
  );
  const hasWorkspaceSummary = isOfflineReviewPreview || Boolean(workspaceSummaryDocLive);
  const needsShellBootstrap = (key: NoesisWorkspaceDataKey) => !hasWorkspaceSummary && shellNeedsSummaryData(key);

  const needsMedia = routeNeedsData(effectiveRouteState, 'media') || needsShellBootstrap('media');
  const needsVault = routeNeedsData(effectiveRouteState, 'vault') || needsShellBootstrap('vault');
  const needsInsights = routeNeedsData(effectiveRouteState, 'insights');
  const needsConcepts = routeNeedsData(effectiveRouteState, 'concepts') || needsShellBootstrap('concepts');
  const needsQuestions = routeNeedsData(effectiveRouteState, 'questions') || needsShellBootstrap('questions');
  const needsTimeline = routeNeedsData(effectiveRouteState, 'timeline') || needsShellBootstrap('timeline');
  const needsDrafts = routeNeedsData(effectiveRouteState, 'drafts') || needsShellBootstrap('drafts');
  const needsPractices = routeNeedsData(effectiveRouteState, 'practices') || needsShellBootstrap('practices');
  const needsAtlasMaps = routeNeedsData(effectiveRouteState, 'atlasMaps');
  const needsLinks = routeNeedsData(effectiveRouteState, 'links');
  const needsSuggestions = routeNeedsData(effectiveRouteState, 'suggestions');
  const needsThinkingEvents = routeNeedsData(effectiveRouteState, 'thinkingEvents');
  const needsBeliefProfiles = routeNeedsData(effectiveRouteState, 'beliefProfiles');
  const needsUnknowns = routeNeedsData(effectiveRouteState, 'unknowns');
  const needsThinkingPatterns = routeNeedsData(effectiveRouteState, 'thinkingPatterns');
  const needsThinkingMetrics = routeNeedsData(effectiveRouteState, 'thinkingMetrics');
  const needsGoalDoc = routeNeedsData(effectiveRouteState, 'goal');
  const needsPreferencesDoc = routeNeedsData(effectiveRouteState, 'preferences') || shellNeedsSummaryData('preferences');
  const needsAppearanceDoc = routeNeedsData(effectiveRouteState, 'appearance') || shellNeedsSummaryData('appearance');
  const needsLegacyProfileDoc = routeNeedsData(effectiveRouteState, 'legacyProfile') || shellNeedsSummaryData('legacyProfile');
  const needsProfileDocs = routeNeedsData(effectiveRouteState, 'profileDocs');
  const needsAllSettings = routeNeedsData(effectiveRouteState, 'allSettings');
  const needsWorkspaceDoc = routeNeedsData(effectiveRouteState, 'workspace') || shellNeedsSummaryData('workspace');
  const thinkingEventsQuery = useMemo(
    () => isOfflineReviewPreview || !needsThinkingEvents
      ? null
      : query(refs.thinkingEvents as any, orderBy('createdAt', 'desc'), limit(200)),
    [isOfflineReviewPreview, needsThinkingEvents, refs.thinkingEvents]
  );
  const thinkingMetricsRef = useMemo(
    () => isOfflineReviewPreview || !needsThinkingMetrics
      ? null
      : doc(refs.thinkingMetrics, 'summary') as any,
    [isOfflineReviewPreview, needsThinkingMetrics, refs.thinkingMetrics]
  );

  const { data: mediaLive = [], loading: mediaLoadingLive, error: mediaErrorLive } = useCollection<Media>(isOfflineReviewPreview || !needsMedia ? null : refs.media as any);
  const { data: vaultLive = [], loading: vaultLoadingLive, error: vaultErrorLive } = useCollection<VaultEntry>(isOfflineReviewPreview || !needsVault ? null : refs.vault as any);
  const { data: insightsLive = [], loading: insightsLoadingLive } = useCollection<Insight>(isOfflineReviewPreview || !needsInsights ? null : refs.insights as any);
  const { data: conceptsLive = [], loading: conceptsLoadingLive, error: conceptsErrorLive } = useCollection<Concept>(isOfflineReviewPreview || !needsConcepts ? null : refs.concepts as any);
  const { data: questionsLive = [], loading: questionsLoadingLive, error: questionsErrorLive } = useCollection<Question>(isOfflineReviewPreview || !needsQuestions ? null : refs.questions as any);
  const { data: timelineLive = [], loading: timelineLoadingLive, error: timelineErrorLive } = useCollection<TimelineEvent>(isOfflineReviewPreview || !needsTimeline ? null : refs.timeline as any);
  const { data: draftsLive = [], loading: draftsLoadingLive, error: draftsErrorLive } = useCollection<Draft>(isOfflineReviewPreview || !needsDrafts ? null : refs.drafts as any);
  const { data: practicesLive = [], loading: practicesLoadingLive, error: practicesErrorLive } = useCollection<Practice>(isOfflineReviewPreview || !needsPractices ? null : refs.practices as any);
  const { data: atlasMapsLive = [], loading: atlasMapsLoadingLive, error: atlasMapsErrorLive } = useCollection<AtlasMap>(isOfflineReviewPreview || !needsAtlasMaps ? null : refs.atlasMaps as any);
  const { data: linksLive = [], loading: linksLoadingLive, error: linksErrorLive } = useCollection<PhilosophicalLink>(isOfflineReviewPreview || !needsLinks ? null : refs.links as any);
  const { data: suggestionsLive = [], loading: suggestionsLoadingLive } = useCollection<AiSuggestion>(isOfflineReviewPreview || !needsSuggestions ? null : refs.suggestions as any);
  const { data: thinkingEventsLive = [], loading: thinkingEventsLoadingLive } = useCollection<ThinkingEvent>(thinkingEventsQuery as any);
  const { data: beliefProfilesLive = [], loading: beliefProfilesLoadingLive } = useCollection<BeliefProfile>(isOfflineReviewPreview || !needsBeliefProfiles ? null : refs.beliefProfiles as any);
  const { data: unknownsLive = [], loading: unknownsLoadingLive } = useCollection<Unknown>(isOfflineReviewPreview || !needsUnknowns ? null : refs.unknowns as any);
  const { data: thinkingPatternsLive = [], loading: thinkingPatternsLoadingLive } = useCollection<ThinkingPattern>(isOfflineReviewPreview || !needsThinkingPatterns ? null : refs.thinkingPatterns as any);
  const { data: thinkingMetricsDocLive, loading: thinkingMetricsLoadingLive } = useDoc<ThinkingMetrics>(thinkingMetricsRef);
  const { data: goalDocLive, loading: goalLoadingLive } = useDoc<GoalSettings>(isOfflineReviewPreview || !needsGoalDoc ? null : refs.settingsGoal as any);
  const { data: legacyPreferencesDocLive, loading: preferencesLoadingLive } = useDoc<UserPreferences>(isOfflineReviewPreview || !needsPreferencesDoc ? null : refs.settingsPreferences as any);
  const { data: legacyProfileDocLive, loading: legacyProfileLoadingLive } = useDoc<UserProfile>(isOfflineReviewPreview || !needsLegacyProfileDoc ? null : refs.legacySettingsProfile as any);
  const { data: workspaceDocLive, loading: workspaceLoadingLive } = useDoc<WorkspaceSettings>(isOfflineReviewPreview || !needsWorkspaceDoc ? null : refs.settingsWorkspace as any);
  const { data: profileMainDocLive, loading: profileMainLoadingLive } = useDoc<UserProfile>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profileMain as any);
  const { data: profilePrivacyDocLive, loading: profilePrivacyLoadingLive } = useDoc<ProfilePrivacySettings>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profilePrivacy as any);
  const { data: profileSummaryDocLive, loading: profileSummaryLoadingLive } = useDoc<ProfileMetacognitionSummary>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profileMetacognitionSummary as any);
  const { data: settingsAccountDocLive, loading: settingsAccountLoadingLive } = useDoc<AccountSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsAccount as any);
  const { data: settingsAppearanceDocLive, loading: settingsAppearanceLoadingLive } = useDoc<AppearanceSettings>(isOfflineReviewPreview || !needsAppearanceDoc ? null : refs.settingsAppearance as any);
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
  const settingsLoading = settingsAccountLoadingLive ||
    settingsAppearanceLoadingLive ||
    settingsWorkspacePrefsLoadingLive ||
    settingsAiLoadingLive ||
    settingsMetacognitionLoadingLive ||
    settingsPrivacyLoadingLive ||
    settingsDataLoadingLive ||
    settingsSourceIntakeLoadingLive ||
    settingsWorksLoadingLive ||
    settingsAtlasLoadingLive ||
    settingsNotificationsLoadingLive ||
    settingsGoalsLoadingLive ||
    settingsDeveloperLoadingLive;
  const profileDocsLoading = profileMainLoadingLive || profilePrivacyLoadingLive || profileSummaryLoadingLive;
  const requirementLoading: Record<NoesisWorkspaceDataKey, boolean> = {
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
    appearance: isOfflineReviewPreview ? false : settingsAppearanceLoadingLive,
    legacyProfile: isOfflineReviewPreview ? false : legacyProfileLoadingLive,
    workspace: isOfflineReviewPreview ? false : workspaceLoadingLive,
    profileDocs: isOfflineReviewPreview ? false : profileDocsLoading,
    allSettings: isOfflineReviewPreview ? false : settingsLoading,
    workspaceSummary: isOfflineReviewPreview ? false : workspaceSummaryLoadingLive,
  };
  const activePageRequirements = dataRequirementsForNoesisRoute(effectiveRouteState);
  const pageLoading = activePageRequirements.some((key) => requirementLoading[key]);
  const shellLoading = NOESIS_SHELL_SUMMARY_REQUIREMENTS.some((key) => requirementLoading[key]);
  const requirementErrors: Partial<Record<NoesisWorkspaceDataKey, Error | null>> = {
    media: mediaErrorLive,
    vault: vaultErrorLive,
    concepts: conceptsErrorLive,
    questions: questionsErrorLive,
    timeline: timelineErrorLive,
    drafts: draftsErrorLive,
    practices: practicesErrorLive,
    atlasMaps: atlasMapsErrorLive,
    links: linksErrorLive,
  };
  const pageErrorKey = activePageRequirements.find((key) => requirementErrors[key]);

  return {
    refs,
    media: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.media || []) : mediaLive, uid),
    vault: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.vault || []) : vaultLive, uid),
    insights: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.insights || []) : insightsLive, uid),
    concepts: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.concepts || []) : conceptsLive, uid),
    questions: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.questions || []) : questionsLive, uid),
    timeline: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.timeline || []) : timelineLive, uid),
    drafts: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.drafts || []) : draftsLive, uid),
    practices: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.practices || []) : practicesLive, uid),
    atlasMaps: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.atlasMaps || []) : atlasMapsLive, uid),
    links: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.links || []) : linksLive, uid),
    suggestions: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.suggestions || []) : suggestionsLive, uid),
    thinkingEvents: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.thinkingEvents || []) : thinkingEventsLive, uid),
    beliefProfiles: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.beliefProfiles || []) : beliefProfilesLive, uid),
    unknowns: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.unknowns || []) : unknownsLive, uid),
    thinkingPatterns: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.thinkingPatterns || []) : thinkingPatternsLive, uid),
    thinkingMetricsDoc: isOfflineReviewPreview ? (reviewPreviewData?.thinkingMetrics || null) : thinkingMetricsDocLive,
    goalDoc: isOfflineReviewPreview ? (reviewPreviewData?.goal || null) : goalDocLive,
    legacyPreferencesDoc: isOfflineReviewPreview ? (reviewPreviewData?.preferences || null) : legacyPreferencesDocLive,
    legacyProfileDoc: isOfflineReviewPreview ? (reviewPreviewData?.profile || null) : legacyProfileDocLive,
    workspaceDoc: isOfflineReviewPreview ? (reviewPreviewData?.workspace || null) : workspaceDocLive,
    workspaceSummaryDoc: isOfflineReviewPreview ? null : workspaceSummaryDocLive,
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
      workspaceSummary: isOfflineReviewPreview ? false : workspaceSummaryLoadingLive,
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
      page: pageLoading,
      shell: shellLoading,
      requirements: requirementLoading,
      activePageRequirements,
      shellRequirements: NOESIS_SHELL_SUMMARY_REQUIREMENTS,
      pageError: pageErrorKey ? {
        key: pageErrorKey,
        error: requirementErrors[pageErrorKey]!,
      } : null,
    },
  };
}
