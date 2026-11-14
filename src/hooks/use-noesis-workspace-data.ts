"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { demoSessionVersion, readDemoSession, subscribeDemoSession } from '@/lib/demo-session';
import { doc, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { RECOVERY_EVENT_TYPES, RECOVERY_RETENTION_MS, recentRecoverableDeletions } from '@/lib/deleted-items';
import { useCollection, useDoc } from '@/firebase';
import { readexRefs } from '@/lib/firestore-schema';
import {
  NOESIS_SHELL_SUMMARY_REQUIREMENTS,
  dataRequirementsForNoesisRoute,
  routeNeedsData,
  shellNeedsSummaryData,
  type NoesisWorkspaceDataKey,
} from '@/lib/noesis-page-definitions';
import type {
  AccountSettings,
  AiSettings,
  AnnotationRecord,
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
import { withNoesisStage } from '@/lib/workflow-integrity';
import type { PhilosophicalObjectType } from '@/lib/types';
import { mergeSourceAnnotationRecords } from '@/lib/collection-integrity';
import { mergeThinkingHistory } from '@/lib/evolution-history';
import { thinkingHistoryQuery } from '@/lib/thinkingEvents/history-query';

function recordsForWorkspace<T>(records: T[], uid: string) {
  return records.filter((record) => {
    const owner = (record as any)?.userId || (record as any)?.uid;
    return !owner || owner === uid;
  });
}

function stagedRecords<T extends { status?: string; stage?: any; condition?: any; legacyStatus?: string }>(records: T[], uid: string, type: PhilosophicalObjectType, statusOf?: (record: T) => string | undefined) {
  return recordsForWorkspace(records, uid).map((record) => withNoesisStage(type, { ...record, status: statusOf?.(record) ?? record.status }) as T);
}

export function useNoesisWorkspaceData({
  db,
  uid,
  activeView,
  routeState,
  isOfflineReviewPreview,
  retryVersion = 0,
  recoveryRequested = false,
}: {
  db: any;
  uid: string;
  activeView: NoesisView;
  routeState?: NoesisRouteState;
  isOfflineReviewPreview: boolean;
  retryVersion?: number;
  recoveryRequested?: boolean;
}) {
  const [thinkingEventsLimit, setThinkingEventsLimit] = useState(200);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [previousThinkingEvents, setPreviousThinkingEvents] = useState<{ owner: string; db: unknown; events: ThinkingEvent[]; hasMore: boolean; limit: number } | null>(null);
  const [recoveryClock, setRecoveryClock] = useState(Date.now);
  const [recoveryRetry, setRecoveryRetry] = useState(0);
  const refs = useMemo(() => readexRefs(db, uid), [db, uid]);
  const effectiveRouteState = routeState || { view: activeView };
  const demoVersion = useSyncExternalStore(subscribeDemoSession, demoSessionVersion, () => 0);
  const reviewPreviewData = useMemo(
    () => (isOfflineReviewPreview ? readDemoSession(uid) : null),
    [uid, isOfflineReviewPreview, demoVersion]
  );

  const { data: workspaceSummaryDocLive, loading: workspaceSummaryLoadingLive } = useDoc<WorkspaceSummary>(
    isOfflineReviewPreview ? null : refs.settingsWorkspaceSummary as any, retryVersion
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
  const needsThinkingEvents = routeNeedsData(effectiveRouteState, 'thinkingEvents');
  const needsRecovery = effectiveRouteState.view === 'settings' && recoveryRequested;
  useEffect(() => {
    if (!needsRecovery) return;
    setRecoveryClock(Date.now());
    const timer = window.setInterval(() => setRecoveryClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [needsRecovery, uid]);
  // Keep query listeners stable for the day; the selector enforces the exact expiry.
  const recoveryCutoff = Math.floor(recoveryClock / 86_400_000) * 86_400_000 - RECOVERY_RETENTION_MS;
  const recoveryQuery = useMemo(() => !needsRecovery || isOfflineReviewPreview ? null : query(
    refs.thinkingEvents,
    where('eventType', 'in', [...RECOVERY_EVENT_TYPES]),
    where('createdAt', '>=', Timestamp.fromMillis(recoveryCutoff)),
    orderBy('createdAt', 'desc'),
  ), [isOfflineReviewPreview, needsRecovery, recoveryCutoff, refs.thinkingEvents]);
  const legacyRecoveryQuery = useMemo(() => !needsRecovery || isOfflineReviewPreview ? null : query(
    refs.thinkingEvents,
    where('eventType', 'in', [...RECOVERY_EVENT_TYPES]),
    where('createdAt', '>=', new Date(recoveryCutoff).toISOString()),
    orderBy('createdAt', 'desc'),
  ), [isOfflineReviewPreview, needsRecovery, recoveryCutoff, refs.thinkingEvents]);
  const recoveryEvents = useCollection<ThinkingEvent>(recoveryQuery as any, retryVersion + recoveryRetry);
  const legacyRecoveryEvents = useCollection<ThinkingEvent>(legacyRecoveryQuery as any, retryVersion + recoveryRetry);
  const recentDeletedItems = useMemo(() => needsRecovery ? recentRecoverableDeletions(
    recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.thinkingEvents || [])
      : [...new Map([...recoveryEvents.data, ...legacyRecoveryEvents.data].map((event) => [event.id, event])).values()], uid),
    Math.max(recoveryClock, Date.now()),
  ) : [], [isOfflineReviewPreview, legacyRecoveryEvents.data, needsRecovery, recoveryClock, recoveryEvents.data, reviewPreviewData?.thinkingEvents, uid]);
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
  const needsAiSettings = routeNeedsData(effectiveRouteState, 'aiSettings') || needsAllSettings;
  const needsWorkspaceDoc = routeNeedsData(effectiveRouteState, 'workspace') || shellNeedsSummaryData('workspace');
  const thinkingEventsQuery = useMemo(
    () => isOfflineReviewPreview || !needsThinkingEvents
      ? null
      : thinkingHistoryQuery(refs.thinkingEvents, thinkingEventsLimit, 'timestamp'),
    [isOfflineReviewPreview, needsThinkingEvents, refs.thinkingEvents, thinkingEventsLimit]
  );
  const legacyThinkingEventsQuery = useMemo(
    () => thinkingEventsQuery ? thinkingHistoryQuery(refs.thinkingEvents, thinkingEventsLimit, 'legacy') : null,
    [refs.thinkingEvents, thinkingEventsLimit, thinkingEventsQuery]
  );
  useEffect(() => setThinkingEventsLimit(200), [uid]);
  const thinkingMetricsRef = useMemo(
    () => isOfflineReviewPreview || !needsThinkingMetrics
      ? null
      : doc(refs.thinkingMetrics, 'summary') as any,
    [isOfflineReviewPreview, needsThinkingMetrics, refs.thinkingMetrics]
  );

  const { data: mediaLive = [], loading: mediaLoadingLive, error: mediaErrorLive } = useCollection<Media>(isOfflineReviewPreview || !needsMedia ? null : refs.media as any, retryVersion);
  const { data: annotationsLive = [], loading: annotationsLoadingLive, error: annotationsErrorLive } = useCollection<AnnotationRecord>(isOfflineReviewPreview || !needsMedia ? null : refs.annotations as any, retryVersion);
  const { data: vaultLive = [], loading: vaultLoadingLive, error: vaultErrorLive } = useCollection<VaultEntry>(isOfflineReviewPreview || !needsVault ? null : refs.vault as any, retryVersion);
  const { data: insightsLive = [], loading: insightsLoadingLive, error: insightsLoadingLiveError } = useCollection<Insight>(isOfflineReviewPreview || !needsInsights ? null : refs.insights as any, retryVersion);
  const { data: conceptsLive = [], loading: conceptsLoadingLive, error: conceptsErrorLive } = useCollection<Concept>(isOfflineReviewPreview || !needsConcepts ? null : refs.concepts as any, retryVersion);
  const { data: questionsLive = [], loading: questionsLoadingLive, error: questionsErrorLive } = useCollection<Question>(isOfflineReviewPreview || !needsQuestions ? null : refs.questions as any, retryVersion);
  const { data: timelineLive = [], loading: timelineLoadingLive, error: timelineErrorLive } = useCollection<TimelineEvent>(isOfflineReviewPreview || !needsTimeline ? null : refs.timeline as any, retryVersion);
  const { data: draftsLive = [], loading: draftsLoadingLive, error: draftsErrorLive } = useCollection<Draft>(isOfflineReviewPreview || !needsDrafts ? null : refs.drafts as any, retryVersion);
  const { data: practicesLive = [], loading: practicesLoadingLive, error: practicesErrorLive } = useCollection<Practice>(isOfflineReviewPreview || !needsPractices ? null : refs.practices as any, retryVersion);
  const { data: atlasMapsLive = [], loading: atlasMapsLoadingLive, error: atlasMapsErrorLive } = useCollection<AtlasMap>(isOfflineReviewPreview || !needsAtlasMaps ? null : refs.atlasMaps as any, retryVersion);
  const { data: linksLive = [], loading: linksLoadingLive, error: linksErrorLive } = useCollection<PhilosophicalLink>(isOfflineReviewPreview || !needsLinks ? null : refs.links as any, retryVersion);
  const modernHistory = useCollection<ThinkingEvent>(thinkingEventsQuery as any, retryVersion + historyRetry);
  const legacyHistory = useCollection<ThinkingEvent>(legacyThinkingEventsQuery as any, retryVersion + historyRetry);
  const thinkingEventsLive = useMemo(() => mergeThinkingHistory(modernHistory.data, legacyHistory.data), [modernHistory.data, legacyHistory.data]);
  const thinkingHistoryHasMore = thinkingEventsLive.length > thinkingEventsLimit
    || modernHistory.data.length > thinkingEventsLimit || legacyHistory.data.length > thinkingEventsLimit;
  const thinkingEventsLoadingLive = modernHistory.loading || legacyHistory.loading;
  const isHistoryAccessError = (error: Error | null) => ['permission-denied', 'unauthenticated'].includes((error as { code?: string })?.code ?? '');
  const thinkingEventsLoadingLiveError = [modernHistory.error, legacyHistory.error].find(isHistoryAccessError) || modernHistory.error || legacyHistory.error;
  const canShowPreviousHistory = !isOfflineReviewPreview && effectiveRouteState.view === 'evolution'
    && previousThinkingEvents?.owner === uid && previousThinkingEvents.db === db && previousThinkingEvents.hasMore
    && thinkingEventsLimit > previousThinkingEvents.limit;
  const historyAccessDenied = isHistoryAccessError(thinkingEventsLoadingLiveError);
  const historyLoadingOlder = canShowPreviousHistory && thinkingEventsLoadingLive && !thinkingEventsLoadingLiveError;
  const historyOlderError = canShowPreviousHistory && Boolean(thinkingEventsLoadingLiveError) && !historyAccessDenied;
  const keepPreviousHistory = historyLoadingOlder || historyOlderError;
  useEffect(() => {
    if (historyAccessDenied) {
      setPreviousThinkingEvents(null);
      return;
    }
    if (!thinkingEventsQuery || effectiveRouteState.view !== 'evolution' || thinkingEventsLoadingLive || thinkingEventsLoadingLiveError) return;
    setPreviousThinkingEvents({
      owner: uid,
      db,
      events: thinkingEventsLive.slice(0, thinkingEventsLimit),
      hasMore: thinkingHistoryHasMore,
      limit: thinkingEventsLimit,
    });
  }, [db, effectiveRouteState.view, historyAccessDenied, thinkingEventsLimit, thinkingEventsLive, thinkingEventsLoadingLive, thinkingEventsLoadingLiveError, thinkingEventsQuery, thinkingHistoryHasMore, uid]);
  const { data: beliefProfilesLive = [], loading: beliefProfilesLoadingLive, error: beliefProfilesLoadingLiveError } = useCollection<BeliefProfile>(isOfflineReviewPreview || !needsBeliefProfiles ? null : refs.beliefProfiles as any, retryVersion);
  const { data: unknownsLive = [], loading: unknownsLoadingLive, error: unknownsLoadingLiveError } = useCollection<Unknown>(isOfflineReviewPreview || !needsUnknowns ? null : refs.unknowns as any, retryVersion);
  const { data: thinkingPatternsLive = [], loading: thinkingPatternsLoadingLive, error: thinkingPatternsLoadingLiveError } = useCollection<ThinkingPattern>(isOfflineReviewPreview || !needsThinkingPatterns ? null : refs.thinkingPatterns as any, retryVersion);
  const { data: thinkingMetricsDocLive, loading: thinkingMetricsLoadingLive, error: thinkingMetricsLoadingLiveError } = useDoc<ThinkingMetrics>(thinkingMetricsRef, retryVersion);
  const { data: goalDocLive, loading: goalLoadingLive, error: goalLoadingLiveError } = useDoc<GoalSettings>(isOfflineReviewPreview || !needsGoalDoc ? null : refs.settingsGoal as any, retryVersion);
  const { data: legacyPreferencesDocLive, loading: preferencesLoadingLive, error: preferencesLoadingLiveError } = useDoc<UserPreferences>(isOfflineReviewPreview || !needsPreferencesDoc ? null : refs.settingsPreferences as any, retryVersion);
  const { data: legacyProfileDocLive, loading: legacyProfileLoadingLive, error: legacyProfileLoadingLiveError } = useDoc<UserProfile>(isOfflineReviewPreview || !needsLegacyProfileDoc ? null : refs.legacySettingsProfile as any, retryVersion);
  const { data: workspaceDocLive, loading: workspaceLoadingLive, error: workspaceLoadingLiveError } = useDoc<WorkspaceSettings & Partial<WorkspacePreferenceSettings>>(isOfflineReviewPreview || !needsWorkspaceDoc ? null : refs.settingsWorkspace as any, retryVersion);
  const { data: profileMainDocLive, loading: profileMainLoadingLive, error: profileMainLoadingLiveError } = useDoc<UserProfile>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profileMain as any, retryVersion);
  const { data: profilePrivacyDocLive, loading: profilePrivacyLoadingLive, error: profilePrivacyLoadingLiveError } = useDoc<ProfilePrivacySettings>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profilePrivacy as any, retryVersion);
  const { data: profileSummaryDocLive, loading: profileSummaryLoadingLive, error: profileSummaryLoadingLiveError } = useDoc<ProfileMetacognitionSummary>(isOfflineReviewPreview || !needsProfileDocs ? null : refs.profileMetacognitionSummary as any, retryVersion);
  const { data: settingsAccountDocLive, loading: settingsAccountLoadingLive, error: settingsAccountLoadingLiveError } = useDoc<AccountSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsAccount as any, retryVersion);
  const { data: settingsAppearanceDocLive, loading: settingsAppearanceLoadingLive, error: settingsAppearanceLoadingLiveError } = useDoc<AppearanceSettings>(isOfflineReviewPreview || !needsAppearanceDoc ? null : refs.settingsAppearance as any, retryVersion);
  const settingsWorkspacePrefsDocLive = workspaceDocLive as WorkspacePreferenceSettings | null;
  const { data: settingsAiDocLive, loading: settingsAiLoadingLive, error: settingsAiLoadingLiveError } = useDoc<AiSettings>(isOfflineReviewPreview || !needsAiSettings ? null : refs.settingsAi as any, retryVersion);
  const { data: settingsMetacognitionDocLive, loading: settingsMetacognitionLoadingLive, error: settingsMetacognitionLoadingLiveError } = useDoc<MetacognitionSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsMetacognition as any, retryVersion);
  const { data: settingsPrivacyDocLive, loading: settingsPrivacyLoadingLive, error: settingsPrivacyLoadingLiveError } = useDoc<PrivacySettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsPrivacy as any, retryVersion);
  const { data: settingsDataDocLive, loading: settingsDataLoadingLive, error: settingsDataLoadingLiveError } = useDoc<DataSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsData as any, retryVersion);
  const { data: settingsSourceIntakeDocLive, loading: settingsSourceIntakeLoadingLive, error: settingsSourceIntakeLoadingLiveError } = useDoc<SourceIntakeSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsSourceIntake as any, retryVersion);
  const { data: settingsWorksDocLive, loading: settingsWorksLoadingLive, error: settingsWorksLoadingLiveError } = useDoc<WorksSettings>(isOfflineReviewPreview || !(needsAllSettings || routeNeedsData(effectiveRouteState, 'worksSettings')) ? null : refs.settingsWorks as any, retryVersion);
  const { data: settingsAtlasDocLive, loading: settingsAtlasLoadingLive, error: settingsAtlasLoadingLiveError } = useDoc<AtlasSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsAtlas as any, retryVersion);
  const { data: settingsNotificationsDocLive, loading: settingsNotificationsLoadingLive, error: settingsNotificationsLoadingLiveError } = useDoc<NotificationSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsNotifications as any, retryVersion);
  const { data: settingsGoalsDocLive, loading: settingsGoalsLoadingLive, error: settingsGoalsLoadingLiveError } = useDoc<GoalPreferenceSettings>(isOfflineReviewPreview || !(needsAllSettings || routeNeedsData(effectiveRouteState, 'goalPreferences')) ? null : refs.settingsGoals as any, retryVersion);
  const { data: settingsDeveloperDocLive, loading: settingsDeveloperLoadingLive, error: settingsDeveloperLoadingLiveError } = useDoc<DeveloperSettings>(isOfflineReviewPreview || !needsAllSettings ? null : refs.settingsDeveloper as any, retryVersion);
  const settingsLoading = settingsAccountLoadingLive ||
    settingsAppearanceLoadingLive ||
    workspaceLoadingLive ||
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
    media: isOfflineReviewPreview ? false : mediaLoadingLive || annotationsLoadingLive,
    vault: isOfflineReviewPreview ? false : vaultLoadingLive,
    insights: isOfflineReviewPreview ? false : insightsLoadingLive,
    concepts: isOfflineReviewPreview ? false : conceptsLoadingLive,
    questions: isOfflineReviewPreview ? false : questionsLoadingLive,
    timeline: isOfflineReviewPreview ? false : timelineLoadingLive,
    drafts: isOfflineReviewPreview ? false : draftsLoadingLive,
    practices: isOfflineReviewPreview ? false : practicesLoadingLive,
    atlasMaps: isOfflineReviewPreview ? false : atlasMapsLoadingLive,
    links: isOfflineReviewPreview ? false : linksLoadingLive,
    thinkingEvents: !isOfflineReviewPreview && thinkingEventsLoadingLive && !keepPreviousHistory,
    beliefProfiles: isOfflineReviewPreview ? false : beliefProfilesLoadingLive,
    unknowns: isOfflineReviewPreview ? false : unknownsLoadingLive,
    thinkingPatterns: isOfflineReviewPreview ? false : thinkingPatternsLoadingLive,
    thinkingMetrics: isOfflineReviewPreview ? false : thinkingMetricsLoadingLive,
    worksSettings: isOfflineReviewPreview ? false : settingsWorksLoadingLive,
    goalPreferences: isOfflineReviewPreview ? false : settingsGoalsLoadingLive,
    goal: isOfflineReviewPreview ? false : goalLoadingLive,
    preferences: isOfflineReviewPreview ? false : preferencesLoadingLive,
    appearance: isOfflineReviewPreview ? false : settingsAppearanceLoadingLive,
    legacyProfile: isOfflineReviewPreview ? false : legacyProfileLoadingLive,
    workspace: isOfflineReviewPreview ? false : workspaceLoadingLive,
    profileDocs: isOfflineReviewPreview ? false : profileDocsLoading,
    aiSettings: isOfflineReviewPreview ? false : settingsAiLoadingLive,
    allSettings: isOfflineReviewPreview ? false : settingsLoading,
    workspaceSummary: isOfflineReviewPreview ? false : workspaceSummaryLoadingLive,
  };
  const activePageRequirements = dataRequirementsForNoesisRoute(effectiveRouteState);
  const pageLoading = activePageRequirements.some((key) => requirementLoading[key]);
  const shellLoading = NOESIS_SHELL_SUMMARY_REQUIREMENTS.some((key) => requirementLoading[key]);
  const requirementErrors: Partial<Record<NoesisWorkspaceDataKey, Error | null>> = {
    media: mediaErrorLive || annotationsErrorLive,
    vault: vaultErrorLive,
    concepts: conceptsErrorLive,
    questions: questionsErrorLive,
    timeline: timelineErrorLive,
    drafts: draftsErrorLive,
    practices: practicesErrorLive,
    atlasMaps: atlasMapsErrorLive,
    links: linksErrorLive,
    insights: insightsLoadingLiveError,
    thinkingEvents: keepPreviousHistory ? null : thinkingEventsLoadingLiveError,
    beliefProfiles: beliefProfilesLoadingLiveError,
    unknowns: unknownsLoadingLiveError,
    thinkingPatterns: thinkingPatternsLoadingLiveError,
    thinkingMetrics: thinkingMetricsLoadingLiveError,
    worksSettings: settingsWorksLoadingLiveError,
    goalPreferences: settingsGoalsLoadingLiveError,
    goal: goalLoadingLiveError,
    preferences: preferencesLoadingLiveError,
    appearance: settingsAppearanceLoadingLiveError,
    legacyProfile: legacyProfileLoadingLiveError,
    workspace: workspaceLoadingLiveError,
    profileDocs: profileMainLoadingLiveError || profilePrivacyLoadingLiveError || profileSummaryLoadingLiveError,
    aiSettings: settingsAiLoadingLiveError,
    allSettings: settingsAccountLoadingLiveError || settingsAppearanceLoadingLiveError || workspaceLoadingLiveError
      || settingsAiLoadingLiveError || settingsMetacognitionLoadingLiveError || settingsPrivacyLoadingLiveError
      || settingsDataLoadingLiveError || settingsSourceIntakeLoadingLiveError || settingsWorksLoadingLiveError
      || settingsAtlasLoadingLiveError || settingsNotificationsLoadingLiveError || settingsGoalsLoadingLiveError || settingsDeveloperLoadingLiveError,
  };
  const pageErrorKey = activePageRequirements.find((key) => requirementErrors[key]);

  // Stage labels are derived UI data. Keep these arrays stable until the
  // underlying snapshot changes so editors are not reset by unrelated renders.
  const mediaRecords = useMemo(() => {
    const sources = stagedRecords(isOfflineReviewPreview ? (reviewPreviewData?.media || []) : mediaLive, uid, 'source');
    const annotations = recordsForWorkspace(
      isOfflineReviewPreview ? (reviewPreviewData?.annotations || []) as AnnotationRecord[] : annotationsLive,
      uid,
    );
    return mergeSourceAnnotationRecords(sources, annotations);
  }, [annotationsLive, isOfflineReviewPreview, mediaLive, reviewPreviewData?.annotations, reviewPreviewData?.media, uid]);
  const vaultRecords = useMemo(
    () => stagedRecords(isOfflineReviewPreview ? (reviewPreviewData?.vault || []) : vaultLive, uid, 'position'),
    [isOfflineReviewPreview, reviewPreviewData?.vault, uid, vaultLive]
  );
  const conceptRecords = useMemo(
    () => stagedRecords(isOfflineReviewPreview ? (reviewPreviewData?.concepts || []) : conceptsLive, uid, 'concept', (record) => record.philosophyStatus),
    [conceptsLive, isOfflineReviewPreview, reviewPreviewData?.concepts, uid]
  );
  const questionRecords = useMemo(
    () => stagedRecords(isOfflineReviewPreview ? (reviewPreviewData?.questions || []) : questionsLive, uid, 'inquiry'),
    [isOfflineReviewPreview, questionsLive, reviewPreviewData?.questions, uid]
  );
  const draftRecords = useMemo(
    () => stagedRecords(isOfflineReviewPreview ? (reviewPreviewData?.drafts || []) : draftsLive, uid, 'work'),
    [draftsLive, isOfflineReviewPreview, reviewPreviewData?.drafts, uid]
  );
  const practiceRecords = useMemo(
    () => stagedRecords(isOfflineReviewPreview ? (reviewPreviewData?.practices || []) : practicesLive, uid, 'practice'),
    [isOfflineReviewPreview, practicesLive, reviewPreviewData?.practices, uid]
  );

  return {
    refs,
    media: mediaRecords,
    vault: vaultRecords,
    insights: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.insights || []) : insightsLive, uid),
    concepts: conceptRecords,
    questions: questionRecords,
    timeline: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.timeline || []) : timelineLive, uid),
    drafts: draftRecords,
    practices: practiceRecords,
    atlasMaps: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.atlasMaps || []) : atlasMapsLive, uid),
    links: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.links || []) : linksLive, uid),
    thinkingEvents: recordsForWorkspace(isOfflineReviewPreview ? (reviewPreviewData?.thinkingEvents || [])
      : keepPreviousHistory ? previousThinkingEvents!.events : thinkingEventsLive.slice(0, thinkingEventsLimit), uid),
    thinkingEventsHasMore: !isOfflineReviewPreview && needsThinkingEvents && (keepPreviousHistory || thinkingHistoryHasMore),
    historyLoadingOlder,
    historyOlderError,
    recentDeletedItems,
    recentDeletedLoading: !isOfflineReviewPreview && effectiveRouteState.view === 'settings'
      && (!needsRecovery || recoveryEvents.loading || legacyRecoveryEvents.loading),
    recentDeletedError: Boolean(recoveryEvents.error || legacyRecoveryEvents.error),
    retryDeletedItems: () => setRecoveryRetry((current) => current + 1),
    loadMoreThinkingEvents: () => {
      if (historyLoadingOlder) return;
      if (historyOlderError) setHistoryRetry((current) => current + 1);
      else setThinkingEventsLimit((current) => current + 200);
    },
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
      media: isOfflineReviewPreview ? false : mediaLoadingLive || annotationsLoadingLive,
      vault: isOfflineReviewPreview ? false : vaultLoadingLive,
      insights: isOfflineReviewPreview ? false : insightsLoadingLive,
      concepts: isOfflineReviewPreview ? false : conceptsLoadingLive,
      questions: isOfflineReviewPreview ? false : questionsLoadingLive,
      timeline: isOfflineReviewPreview ? false : timelineLoadingLive,
      drafts: isOfflineReviewPreview ? false : draftsLoadingLive,
      practices: isOfflineReviewPreview ? false : practicesLoadingLive,
      atlasMaps: isOfflineReviewPreview ? false : atlasMapsLoadingLive,
      links: isOfflineReviewPreview ? false : linksLoadingLive,
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
      settingsWorkspacePrefs: isOfflineReviewPreview ? false : workspaceLoadingLive,
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
