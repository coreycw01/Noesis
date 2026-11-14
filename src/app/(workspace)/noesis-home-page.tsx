
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { sameWorkVersion, type WorkVersion } from '@/lib/work-recovery';
import { contextDeskReviewWorkId, contextDeskWorkProvenance, isContextDeskReviewRetry, type ContextDeskWorkOrigin } from '@/lib/context-desk-work';
import { workContentLength, workHistorySnapshot } from '@/lib/thinkingEvents/work-history';
import { usePathname, useRouter } from 'next/navigation';
import {
  useFirebase,
} from '@/firebase';
import type { MovementMetrics } from '@/components/Shell';
import { navigateWorkspace, workspaceScrollRoute } from '@/lib/workspace-navigation';
import { positionRevisionHistory } from '@/lib/position-revisions';
import { practiceStartDateForSave } from '@/lib/practice-state';
import { localDateKey } from '@/lib/calendar';
import { useLocalDay } from '@/hooks/use-local-day';
import { recordProfileActivity } from '@/lib/profile-activity';
import { deriveWorkspaceAttention } from '@/lib/workspace-attention';
import { NoesisShell } from '@/components/app-shell/NoesisShell';
import { NoesisRouteContent } from '@/components/pages/NoesisRouteContent';
import type { SettingsDraftCache } from '@/components/Settings/SettingsPage';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNoesisWorkspaceData } from '@/hooks/use-noesis-workspace-data';
import { PageErrorState, PageLoadingState } from '@/components/shared/PageState';
import { appearanceSettingsWrites, applyAppearanceSettings, persistAppearanceSettings, readPersistedAppearanceSettings } from '@/lib/appearance';
import { MEDIA_TYPES, allAnnotations, allQuestions, conceptKey, ensureConceptTerms, normalizeConceptTags, today, uid as makeActionId, workCategoryForDraft } from '@/lib/readex';
import {
  DEFAULT_ACCOUNT_SETTINGS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_ATLAS_NODE_SETTINGS,
  DEFAULT_ATLAS_SETTINGS,
  DEFAULT_ATLAS_VIEW_SETTINGS,
  DEFAULT_DATA_SETTINGS,
  DEFAULT_DEVELOPER_SETTINGS,
  DEFAULT_GOAL_PREFERENCE_SETTINGS,
  DEFAULT_GOAL_SETTINGS,
  DEFAULT_METACOGNITION_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_PROFILE_METACOGNITION_SUMMARY,
  DEFAULT_PROFILE_PRIVACY,
  DEFAULT_SOURCE_INTAKE_SETTINGS,
  DEFAULT_THINKING_METRICS,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_USER_PROFILE,
  DEFAULT_WORKS_SETTINGS,
  DEFAULT_WORKSPACE_PREFERENCES,
  DEFAULT_WORKSPACE_SETTINGS,
  readexSchemaDoc,
} from '@/lib/firestore-schema';
import { REVIEW_ACCOUNT_EMAIL, REVIEW_FEATURE_FLAGS, REVIEW_WORKSPACE_UID } from '@/lib/review-workspace-config';
import { countPersistedConcepts, countPersistedRecords } from '@/lib/workspace-counts';
import type {
  AccountSettings,
  Annotation,
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
  MediaType,
  MetacognitionSettings,
  NotificationSettings,
  PhilosophicalLink,
  PhilosophicalLinkType,
  Practice,
  PrivacySettings,
  ProfileMetacognitionSummary,
  ProfilePrivacySettings,
  PublicProfileSnapshot,
  Question,
  SecurityRuleContext,
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
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocFromServer, getDocs, setDoc, writeBatch, deleteDoc, deleteField, serverTimestamp, type DocumentData, type DocumentReference } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { classifyThinkingChange } from '@/lib/thinkingEvents/classifyThinkingChange';
import { makeThinkingEventPayload, matchesPeriodSynthesis, writePeriodSynthesis, writeThinkingEvent, type WriteThinkingEventInput } from '@/lib/thinkingEvents/writeThinkingEvent';
import { commitDemoChanges, demoExportCollection, readDemoSession, type DemoChange } from '@/lib/demo-session';
import { buildWorkspaceExport, exportSavedWorkspace } from '@/lib/workspace-export';
import {
  focusedIdForNoesisView,
  getNoesisRouteTarget,
  labelForNoesisRouteTarget,
  parseNoesisRoute,
  viewOptionsForNoesisRouteTarget,
  viewToPath,
  type NoesisRouteState,
  type NoesisRouteTarget,
  type NoesisView,
} from '@/lib/noesis-routes';
import { commitWorkspaceMutation, WorkspaceRecordChangedError } from '@/lib/workspace-mutations';
import { WorkspaceOfflineError } from '@/lib/workspace-connectivity';
import { atlasNodePositionPatch, writeAtlasNodePosition, type AtlasNodePosition } from '@/lib/atlas-node-position';
import { publishProfileSelection } from '@/lib/public-profile-publication';
import { addedAiReviewEvent } from '@/lib/accepted-ai-event';
import { deletedAnnotationSource, recentRecoverableDeletions, sourceRecoveryAnnotations } from '@/lib/deleted-items';
import { inquiryPositionEvidence, inquirySourceIds, isInquiryClosed } from '@/lib/inquiry-state';
import { inquiryAiReviewPatch, inquiryHistorySnapshot, makeInquiryAiProvenance, writeInquiryAiReview, type InquiryAiReview } from '@/lib/inquiry-ai-review';
import { acceptedTextHash, promotedAnnotationOrigins, type AiProvenanceRecord } from '@/lib/ai-provenance';
import type { PositionReviewApproval } from '@/lib/position-ai-review';
import type { PracticeReviewApproval } from '@/lib/practice-ai-review';
import type { AnnotationReviewApproval } from '@/lib/annotation-ai-review';
import type { SourceReviewApproval } from '@/lib/source-ai-review';
import type { ConceptReviewApproval } from '@/lib/concept-ai-review';
import type { ProfileReviewApproval } from '@/lib/profile-edit';
import { applyGoalCheckIn, applyGoalPlan, writeGoalSettings, type SaveGoalCheckIn, type SaveGoalPlan } from '@/lib/goal-persistence';
import { metacognitionFeatureFlagPatch, resolveAiSettings, workDefaultPreferencePatch } from '@/lib/settings-drafts';
import { readBrowserPreference } from '@/lib/browser-preferences';
import { NOESIS_DATA_REQUIREMENT_LABELS, NOESIS_PAGE_BY_VIEW, type NoesisWorkspaceDataKey } from '@/lib/noesis-page-definitions';
import { normalizePositionConfidence, normalizePracticeStatusForSave, uniqueIds, withNoesisStage } from '@/lib/workflow-integrity';
import { annotationRecord, boundedNestedAnnotations, boundedNestedPracticeLogs, boundedNestedWorkRevisions, boundedPositionVersionHistory, conceptIdsForLabels, inquiryAnnotationUpdates, mergeSourceAnnotationRecords, tagConceptId } from '@/lib/collection-integrity';

function historyRecordId(parentId: string, entryId: string) {
  return `${parentId}__${entryId}`.replace(/\//g, '_');
}

function stableHistoryToken(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function ReadexWorkspace({
  user,
  uid,
  reviewMode = false,
  reviewWorkspaceUid,
  routeStateOverride,
}: {
  user: User | null;
  uid: string;
  reviewMode?: boolean;
  reviewWorkspaceUid?: string;
  routeStateOverride?: NoesisRouteState;
}) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [retryVersion, setRetryVersion] = useState(0);
  const [recoveryRequested, setRecoveryRequested] = useState(false);
  const settingsDraftCache = useRef<SettingsDraftCache | null>(null);
  const retryWorkspaceReads = useCallback(() => setRetryVersion((current) => current + 1), []);
  const [goalState, setGoalState] = useState<GoalSettings>(DEFAULT_GOAL_SETTINGS);
  const effectiveUid = uid;
  const isOfflineReviewPreview = reviewMode && !user;
  const routeState = useMemo(() => routeStateOverride ?? parseNoesisRoute(pathname), [pathname, routeStateOverride]);
  const activeView = routeState.view;
  const routeTarget = useMemo(() => getNoesisRouteTarget(routeState), [routeState]);
  const focusedConceptId = focusedIdForNoesisView(routeState, 'concepts');
  const focusedSourceId = focusedIdForNoesisView(routeState, 'library');
  const focusedPositionId = focusedIdForNoesisView(routeState, 'vault');
  const focusedQuestionId = focusedIdForNoesisView(routeState, 'questions');
  const focusedWorkId = focusedIdForNoesisView(routeState, 'writing');
  const focusedPracticeId = focusedIdForNoesisView(routeState, 'labs');
  const focusedAnnotationSourceId = routeState.focusedAnnotationSourceId || null;
  const focusedAnnotationId = routeState.focusedAnnotationId || null;
  const pendingNavigationRef = useRef<string | null>(null);
  const pendingNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const lastReadyRouteContentRef = useRef<React.ReactNode>(null);
  const recordedActivityDayRef = useRef<string | null>(null);
  const stageMigrationRef = useRef(false);

  useEffect(() => {
    if (pendingNavigationTimerRef.current) {
      clearTimeout(pendingNavigationTimerRef.current);
      pendingNavigationTimerRef.current = null;
    }
    pendingNavigationRef.current = null;
    setPendingPath(null);
  }, [pathname]);

  useEffect(() => () => {
    if (pendingNavigationTimerRef.current) clearTimeout(pendingNavigationTimerRef.current);
  }, []);

  const navigateToView = useCallback(async (view: NoesisView, options?: {
    conceptId?: string | null;
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
    goalId?: string | null;
    annotationSourceId?: string | null;
    annotationId?: string | null;
  }) => {
    const destination = viewToPath(view, {
      reviewMode,
      conceptId: options?.conceptId,
      questionId: options?.questionId,
      sourceId: options?.sourceId,
      positionId: options?.positionId,
      workId: options?.workId,
      practiceId: options?.practiceId,
      goalId: options?.goalId,
      annotationSourceId: options?.annotationSourceId,
      annotationId: options?.annotationId,
    });
    if (destination === pathname || pendingNavigationRef.current === destination) return;
    pendingNavigationRef.current = destination;
    setPendingPath(destination);
    if (typeof window === 'undefined') {
      router.push(destination);
      return;
    }

    const saves: Promise<boolean>[] = [];
    window.dispatchEvent(new CustomEvent('noesis:before-navigation', {
      detail: { waitUntil: (save: Promise<boolean>) => saves.push(save) },
    }));
    if (saves.length) {
      const outcomes = await Promise.allSettled(saves);
      if (pendingNavigationRef.current !== destination) return;
      if (outcomes.some((outcome) => outcome.status === 'rejected' || !outcome.value)) {
        pendingNavigationRef.current = null;
        setPendingPath(null);
        return;
      }
    }

    // Every Noesis route uses the same persistent client workspace. Updating
    // browser history directly avoids waiting on an unnecessary RSC navigation,
    // while Next's history integration keeps usePathname and back/forward synced.
    navigateWorkspace(window.history, destination);

    pendingNavigationTimerRef.current = setTimeout(() => {
      if (pendingNavigationRef.current !== destination) return;
      pendingNavigationRef.current = null;
      setPendingPath(null);
    }, 2000);
  }, [pathname, reviewMode, router]);

  const {
    refs,
    media,
    vault,
    insights,
    concepts,
    questions,
    timeline,
    drafts: loadedDrafts,
    practices,
    atlasMaps,
    links: rawLinks,
    thinkingEvents,
    thinkingEventsHasMore,
    recentDeletedItems,
    recentDeletedLoading,
    recentDeletedError,
    retryDeletedItems,
    loadMoreThinkingEvents,
    historyLoadingOlder,
    historyOlderError,
    beliefProfiles,
    unknowns,
    thinkingPatterns,
    thinkingMetricsDoc,
    goalDoc,
    legacyPreferencesDoc,
    legacyProfileDoc,
    workspaceDoc,
    workspaceSummaryDoc,
    profileMainDoc,
    profilePrivacyDoc,
    profileSummaryDoc,
    settingsAccountDoc,
    settingsAppearanceDoc,
    settingsWorkspacePrefsDoc,
    settingsAiDoc,
    settingsMetacognitionDoc,
    settingsPrivacyDoc,
    settingsDataDoc,
    settingsSourceIntakeDoc,
    settingsWorksDoc,
    settingsAtlasDoc,
    settingsNotificationsDoc,
    settingsGoalsDoc,
    settingsDeveloperDoc,
    loading,
  } = useNoesisWorkspaceData({
    retryVersion,
    recoveryRequested,
    db,
    uid: effectiveUid,
    activeView,
    routeState,
    isOfflineReviewPreview,
  });
  const drafts = loadedDrafts;
  const [demoAppearanceOverride, setDemoAppearanceOverride] = useState<Partial<AppearanceSettings>>(() => (
    isOfflineReviewPreview ? readPersistedAppearanceSettings() : {}
  ));
  useEffect(() => {
    if (!isOfflineReviewPreview || typeof window === 'undefined') return;
    const saved = readBrowserPreference('noesis-demo-drafts', 'sessionStorage');
    if (!saved) return;
    try {
      const legacy = JSON.parse(saved);
      if (!Array.isArray(legacy)) return;
      commitDemoChanges(effectiveUid, legacy.filter((item) => typeof item?.id === 'string').map((item) => ({
        path: `users/${effectiveUid}/drafts/${item.id}`, operation: 'set', data: item,
      })));
      window.sessionStorage.removeItem('noesis-demo-drafts');
    } catch {
      toast({ title: 'Demo works could not be restored', description: 'Your previous session is retained. Please free browser storage and reload.', variant: 'destructive' });
    }
  }, [effectiveUid, isOfflineReviewPreview, toast]);
  const links = useMemo(() => {
    const annotationIds = new Set(media.flatMap((source) => (source.annotations || []).map((annotation) => annotation.id)));
    const entityIds = {
      source: new Set(media.map((item) => item.id)),
      annotation: annotationIds,
      concept: new Set(concepts.map((item) => item.id)),
      inquiry: new Set(questions.map((item) => item.id)),
      position: new Set(vault.map((item) => item.id)),
      work: new Set(drafts.map((item) => item.id)),
      practice: new Set(practices.map((item) => item.id)),
      evolution: new Set(timeline.map((item) => item.id)),
    };
    return rawLinks.filter((link) => entityIds[link.fromType]?.has(link.fromId) && entityIds[link.toType]?.has(link.toId));
  }, [concepts, drafts, media, practices, questions, rawLinks, timeline, vault]);
  
  const goal = goalDoc ? { ...DEFAULT_GOAL_SETTINGS, ...goalDoc, goals: goalDoc.goals, goalTypes: goalDoc.goalTypes } : DEFAULT_GOAL_SETTINGS;
  const appearanceSettings: AppearanceSettings = {
    ...DEFAULT_APPEARANCE_SETTINGS,
    themeMode: legacyPreferencesDoc?.themeMode || DEFAULT_APPEARANCE_SETTINGS.themeMode,
    accentTheme: legacyPreferencesDoc?.accentTheme || DEFAULT_APPEARANCE_SETTINGS.accentTheme,
    ...(settingsAppearanceDoc || {}),
    ...(isOfflineReviewPreview ? demoAppearanceOverride : {}),
  };
  const worksSettings: WorksSettings = {
    ...DEFAULT_WORKS_SETTINGS,
    defaultWorkType: legacyPreferencesDoc?.writingDefaults?.type || DEFAULT_WORKS_SETTINGS.defaultWorkType,
    defaultDraftStatus: legacyPreferencesDoc?.writingDefaults?.status || DEFAULT_WORKS_SETTINGS.defaultDraftStatus,
    defaultPaperStyle: legacyPreferencesDoc?.writingDefaults?.writingStyle || DEFAULT_WORKS_SETTINGS.defaultPaperStyle,
    defaultEditorMode: legacyPreferencesDoc?.writingDefaults?.editorFeel || DEFAULT_WORKS_SETTINGS.defaultEditorMode,
    ...(settingsWorksDoc || {}),
  };
  const workspacePreferences: WorkspacePreferenceSettings = {
    ...DEFAULT_WORKSPACE_PREFERENCES,
    ...(settingsWorkspacePrefsDoc || {}),
  };
  const preferences: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    ...(legacyPreferencesDoc || {}),
    themeMode: appearanceSettings.themeMode,
    accentTheme: appearanceSettings.accentTheme,
    writingDefaults: {
      ...DEFAULT_USER_PREFERENCES.writingDefaults,
      ...(legacyPreferencesDoc?.writingDefaults || {}),
      type: worksSettings.defaultWorkType,
      status: worksSettings.defaultDraftStatus,
      writingStyle: worksSettings.defaultPaperStyle,
      editorFeel: worksSettings.defaultEditorMode,
    },
  };
  const profile: UserProfile = {
    ...DEFAULT_USER_PROFILE,
    ...(legacyProfileDoc || {}),
    ...(profileMainDoc || {}),
    displayName: profileMainDoc?.displayName ?? legacyProfileDoc?.displayName ?? user?.displayName ?? '',
    email: profileMainDoc?.email || legacyProfileDoc?.email || user?.email || '',
    photoURL: profileMainDoc?.photoURL ?? legacyProfileDoc?.photoURL ?? user?.photoURL ?? '',
    avatarUrl: profileMainDoc?.avatarUrl ?? legacyProfileDoc?.avatarUrl ?? user?.photoURL ?? '',
    role: profileMainDoc?.role || legacyProfileDoc?.role || DEFAULT_USER_PROFILE.role,
  };

  const activityDay = useLocalDay();
  useEffect(() => {
    if (!user || isOfflineReviewPreview) return;
    const recordDay = () => {
      if (navigator.onLine === false || document.hidden) return;
      const day = localDateKey();
      const key = `${user.uid}:${day}`;
      if (recordedActivityDayRef.current === key || profileMainDoc?.dailyActivityDates?.includes(day)) return;
      recordedActivityDayRef.current = key;
      void recordProfileActivity(refs.profileMain, refs.legacySettingsProfile, day).catch(() => {
        if (recordedActivityDayRef.current === key) recordedActivityDayRef.current = null;
      });
    };
    recordDay();
    document.addEventListener('visibilitychange', recordDay);
    window.addEventListener('online', recordDay);
    return () => {
      document.removeEventListener('visibilitychange', recordDay);
      window.removeEventListener('online', recordDay);
    };
  }, [activityDay, isOfflineReviewPreview, profileMainDoc?.dailyActivityDates, refs.profileMain, refs.legacySettingsProfile, user]);

  const profilePrivacy: ProfilePrivacySettings = {
    ...DEFAULT_PROFILE_PRIVACY,
    shareSlug: profile.shareSlug || DEFAULT_PROFILE_PRIVACY.shareSlug,
    ...(profilePrivacyDoc || {}),
  };
  const profileMetacognitionSummary: ProfileMetacognitionSummary = {
    ...DEFAULT_PROFILE_METACOGNITION_SUMMARY,
    ...(profileSummaryDoc || {}),
  };
  const accountSettings: AccountSettings = {
    ...DEFAULT_ACCOUNT_SETTINGS,
    authEmail: user?.email || profile.email || DEFAULT_ACCOUNT_SETTINGS.authEmail,
    connectedLoginMethods: user?.providerData?.map((provider) => provider.providerId).filter(Boolean) || [],
    accountCreatedAt: user?.metadata?.creationTime || DEFAULT_ACCOUNT_SETTINGS.accountCreatedAt,
    ...(settingsAccountDoc || {}),
  };
  const aiSettings = resolveAiSettings(DEFAULT_AI_SETTINGS, settingsAiDoc, isOfflineReviewPreview);
  const metacognitionSettings: MetacognitionSettings = {
    ...DEFAULT_METACOGNITION_SETTINGS,
    ...(settingsMetacognitionDoc || {}),
  };
  const privacySettings: PrivacySettings = {
    ...DEFAULT_PRIVACY_SETTINGS,
    shareableProfileLink: profilePrivacy.shareSlug || DEFAULT_PRIVACY_SETTINGS.shareableProfileLink,
    ...(settingsPrivacyDoc || {}),
  };
  const dataSettings: DataSettings = {
    ...DEFAULT_DATA_SETTINGS,
    ...(settingsDataDoc || {}),
  };
  const sourceIntakeSettings: SourceIntakeSettings = {
    ...DEFAULT_SOURCE_INTAKE_SETTINGS,
    ...(settingsSourceIntakeDoc || {}),
  };
  const atlasSettings: AtlasSettings = {
    ...DEFAULT_ATLAS_SETTINGS,
    ...(settingsAtlasDoc || {}),
  };
  const notificationSettings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(settingsNotificationsDoc || {}),
  };
  const goalPreferenceSettings: GoalPreferenceSettings = {
    ...DEFAULT_GOAL_PREFERENCE_SETTINGS,
    ...(settingsGoalsDoc || {}),
  };
  const developerSettings: DeveloperSettings = {
    ...DEFAULT_DEVELOPER_SETTINGS,
    currentUserPath: `users/${effectiveUid}`,
    reviewModeStatus: reviewMode,
    demoWorkspaceSeedStatus: workspaceDoc?.demoWorkspace || false,
    ...(settingsDeveloperDoc || {}),
  };
  const workspace: WorkspaceSettings = {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...(workspaceDoc || {}),
    featureFlags: {
      ...DEFAULT_WORKSPACE_SETTINGS.featureFlags,
      ...(workspaceDoc?.featureFlags || {}),
      metacognitionEnabled: metacognitionSettings.enableMetacognitionFeatures,
      beliefBiographiesEnabled: metacognitionSettings.enableBeliefBiographies,
      unknownsEnabled: metacognitionSettings.enableUnknownsTracking,
      thinkingPatternsEnabled: metacognitionSettings.enableThinkingPatternDetection,
      missingPerspectivesEnabled: metacognitionSettings.enableMissingPerspectivesDetection,
      thinkingMetricsEnabled: metacognitionSettings.enableCognitionMetrics,
    },
  };

  useEffect(() => {
    if (!user || isOfflineReviewPreview || stageMigrationRef.current || (workspace.stageModelVersion || 0) >= 2) return;
    stageMigrationRef.current = true;
    const targets = [
      { ref: refs.media, type: 'source' as const, status: (value: any) => value.status },
      { ref: refs.concepts, type: 'concept' as const, status: (value: any) => value.philosophyStatus },
      { ref: refs.questions, type: 'inquiry' as const, status: (value: any) => value.status },
      { ref: refs.vault, type: 'position' as const, status: (value: any) => value.status },
      { ref: refs.drafts, type: 'work' as const, status: (value: any) => value.status },
      { ref: refs.practices, type: 'practice' as const, status: (value: any) => value.status },
    ];
    void (async () => {
      for (const target of targets) {
        const snapshot = await getDocs(target.ref as any);
        for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
          const batch = writeBatch(db);
          snapshot.docs.slice(offset, offset + 400).forEach((record) => {
            const value = record.data() as any;
            const normalized = withNoesisStage(target.type, { ...value, status: target.status(value) });
            batch.set(record.ref, {
              stage: normalized.stage,
              condition: normalized.condition || deleteField(),
              legacyStatus: normalized.legacyStatus || deleteField(),
            }, { merge: true });
          });
          await batch.commit();
        }
      }
      await setDoc(refs.settingsWorkspace, { stageModelVersion: 2, dateUpdated: today() }, { merge: true });
    })().catch(() => {
      stageMigrationRef.current = false;
    });
  }, [db, isOfflineReviewPreview, refs, user, workspace.stageModelVersion]);
  const featureFlags = workspace.featureFlags || {};
  const isReviewIdentity = (user?.email || profile.email || '').toLowerCase() === REVIEW_ACCOUNT_EMAIL.toLowerCase();
  const activeReviewWorkspaceUid = reviewWorkspaceUid || REVIEW_WORKSPACE_UID;
  const isReviewWorkspace = Boolean(reviewMode);
  const loadWorkspaceCommandItems = useCallback(async (signal: AbortSignal) => {
    if (isOfflineReviewPreview) {
      const { workspaceFindItems } = await import('@/lib/workspace-find-items');
      signal.throwIfAborted();
      const demo = readDemoSession(effectiveUid);
      return { items: workspaceFindItems({ ...demo, media: mergeSourceAnnotationRecords(demo.media, (demo.annotations || []) as AnnotationRecord[]) }) };
    }
    const [{ workspaceFindItems }, { loadWorkspaceFindData }] = await Promise.all([
      import('@/lib/workspace-find-items'), import('@/lib/workspace-find-data'),
    ]);
    const cached = navigator.onLine === false;
    return { items: workspaceFindItems(await loadWorkspaceFindData(refs.user, signal, cached ? 'cache' : 'server')), cached };
  }, [effectiveUid, isOfflineReviewPreview, refs.user]);
  const canSeedReviewWorkspace = Boolean(
    user && (
      isReviewIdentity ||
      effectiveUid === user.uid ||
      user.uid === activeReviewWorkspaceUid
    )
  );
  const [isSeedingReview, setIsSeedingReview] = useState(false);
  const [syncIssue, setSyncIssue] = useState<FirestorePermissionError | null>(null);
  const autoSeedAttemptedRef = useRef(false);
  // Profile can render its identity shell from defaults immediately. Secondary
  // tabs fill in as their scoped listeners resolve instead of blocking navigation.
  const pageDataLoading = activeView === 'profile' ? false : loading.page;
  const shellDataLoading = loading.shell;
  const reviewDataLoading = pageDataLoading && !loading.pageError;
  const [slowPageLoad, setSlowPageLoad] = useState(false);
  useEffect(() => {
    setSlowPageLoad(false);
    if (!reviewDataLoading) return;
    const timer = window.setTimeout(() => setSlowPageLoad(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [pathname, retryVersion, reviewDataLoading]);
  const workspaceCounts = workspaceSummaryDoc?.counts;
  const activeRequirementSet = new Set<NoesisWorkspaceDataKey>(loading.activePageRequirements);
  const resolvedCount = (key: NoesisWorkspaceDataKey, live: number, summary?: number) =>
    activeRequirementSet.has(key) && !loading.requirements[key] ? live : (summary ?? live);
  const resolvedWorkspaceCounts = {
    concepts: resolvedCount('concepts', countPersistedConcepts(concepts), workspaceCounts?.concepts),
    questions: activeRequirementSet.has('questions')
      && activeRequirementSet.has('media')
      && !loading.requirements.questions
      && !loading.requirements.media
      ? allQuestions(media, questions).length
      : (workspaceCounts?.questions ?? allQuestions(media, questions).length),
    media: resolvedCount('media', countPersistedRecords(media), workspaceCounts?.media),
    vault: resolvedCount('vault', countPersistedRecords(vault), workspaceCounts?.vault),
    drafts: resolvedCount('drafts', countPersistedRecords(drafts), workspaceCounts?.drafts),
    timeline: resolvedCount('timeline', countPersistedRecords(timeline), workspaceCounts?.timeline),
    practices: resolvedCount('practices', countPersistedRecords(practices), workspaceCounts?.practices),
    annotations: activeRequirementSet.has('media') && !loading.requirements.media
      ? allAnnotations(media).length
      : (workspaceCounts?.annotations ?? allAnnotations(media).length),
  };

  useEffect(() => {
    setGoalState(goal);
  }, [goalDoc]);

  useEffect(() => {
    if (isOfflineReviewPreview || shellDataLoading) return;

    const required = new Set<NoesisWorkspaceDataKey>(loading.activePageRequirements);
    const isBootstrap = !workspaceSummaryDoc;
    const currentCounts = workspaceSummaryDoc?.counts || {
      media: 0,
      concepts: 0,
      questions: 0,
      annotations: 0,
      vault: 0,
      drafts: 0,
      practices: 0,
      timeline: 0,
    };
    const nextCounts = { ...currentCounts };
    const assign = (key: keyof WorkspaceSummary['counts'], value: number, requirement: NoesisWorkspaceDataKey) => {
      if (isBootstrap || required.has(requirement)) nextCounts[key] = value;
    };

    assign('media', countPersistedRecords(media), 'media');
    assign('annotations', allAnnotations(media).length, 'media');
    assign('concepts', countPersistedConcepts(concepts), 'concepts');
    if (isBootstrap || (required.has('questions') && required.has('media'))) {
      nextCounts.questions = allQuestions(media, questions).length;
    }
    assign('vault', countPersistedRecords(vault), 'vault');
    assign('drafts', countPersistedRecords(drafts), 'drafts');
    assign('practices', countPersistedRecords(practices), 'practices');
    assign('timeline', countPersistedRecords(timeline), 'timeline');

    if (JSON.stringify(nextCounts) === JSON.stringify(currentCounts) && workspaceSummaryDoc) return;
    void setDoc(refs.settingsWorkspaceSummary, {
      counts: nextCounts,
      dateUpdated: today(),
    } satisfies WorkspaceSummary, { merge: true }).catch(() => {
      // Navigation remains usable even when summary maintenance is denied.
    });
  }, [
    concepts,
    drafts,
    isOfflineReviewPreview,
    loading.activePageRequirements,
    media,
    practices,
    questions.length,
    refs.settingsWorkspaceSummary,
    shellDataLoading,
    timeline,
    vault,
    workspaceSummaryDoc,
  ]);

  useEffect(() => {
    if (isOfflineReviewPreview) return;
    const setDefaultIfMissing = async (ref: DocumentReference<DocumentData>, data: DocumentData) => {
      try {
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) await setDoc(ref, data);
      } catch (err) {
        console.warn('Silent skip: settings init error', ref.path);
      }
    };

    const scaffoldFirestore = async () => {
      try {
        const legacyProfileSnapshot = await getDoc(refs.legacySettingsProfile);
        const legacyProfileData = legacyProfileSnapshot.exists() ? legacyProfileSnapshot.data() as UserProfile : null;

        await setDoc(refs.user, {
          uid: effectiveUid,
          app: 'readex',
          displayName: user?.displayName || legacyProfileData?.displayName || '',
          email: user?.email || legacyProfileData?.email || '',
          avatarUrl: user?.photoURL || legacyProfileData?.avatarUrl || legacyProfileData?.photoURL || '',
          updatedAt: today(),
        }, { merge: true });
        await setDefaultIfMissing(refs.settingsGoal, DEFAULT_GOAL_SETTINGS);
        await setDefaultIfMissing(refs.settingsAtlasView, DEFAULT_ATLAS_VIEW_SETTINGS);
        await setDefaultIfMissing(refs.settingsAtlasNodes, DEFAULT_ATLAS_NODE_SETTINGS);
        await setDefaultIfMissing(refs.settingsPreferences, DEFAULT_USER_PREFERENCES);
        await setDefaultIfMissing(refs.settingsWorkspace, DEFAULT_WORKSPACE_SETTINGS);
        await setDefaultIfMissing(refs.settingsAccount, DEFAULT_ACCOUNT_SETTINGS);
        await setDefaultIfMissing(refs.settingsAppearance, DEFAULT_APPEARANCE_SETTINGS);
        await setDefaultIfMissing(refs.settingsAi, DEFAULT_AI_SETTINGS);
        await setDefaultIfMissing(refs.settingsMetacognition, DEFAULT_METACOGNITION_SETTINGS);
        await setDefaultIfMissing(refs.settingsPrivacy, DEFAULT_PRIVACY_SETTINGS);
        await setDefaultIfMissing(refs.settingsData, DEFAULT_DATA_SETTINGS);
        await setDefaultIfMissing(refs.settingsSourceIntake, DEFAULT_SOURCE_INTAKE_SETTINGS);
        await setDefaultIfMissing(refs.settingsWorks, DEFAULT_WORKS_SETTINGS);
        await setDefaultIfMissing(refs.settingsAtlas, DEFAULT_ATLAS_SETTINGS);
        await setDefaultIfMissing(refs.settingsNotifications, DEFAULT_NOTIFICATION_SETTINGS);
        await setDefaultIfMissing(refs.settingsGoals, DEFAULT_GOAL_PREFERENCE_SETTINGS);
        await setDefaultIfMissing(refs.settingsDeveloper, {
          ...DEFAULT_DEVELOPER_SETTINGS,
          currentUserPath: `users/${effectiveUid}`,
          reviewModeStatus: reviewMode,
          demoWorkspaceSeedStatus: isReviewIdentity,
        });
        await setDefaultIfMissing(doc(refs.thinkingMetrics, 'summary') as any, DEFAULT_THINKING_METRICS);
        await setDoc(refs.profileMain, {
          ...DEFAULT_USER_PROFILE,
          ...(legacyProfileData || {}),
          displayName: user?.displayName || legacyProfileData?.displayName || '',
          email: user?.email || legacyProfileData?.email || '',
          photoURL: user?.photoURL || legacyProfileData?.photoURL || '',
          avatarUrl: user?.photoURL || legacyProfileData?.avatarUrl || legacyProfileData?.photoURL || '',
          role: isReviewIdentity ? 'demo' : (legacyProfileData?.role || DEFAULT_USER_PROFILE.role),
          createdAt: legacyProfileData?.createdAt || today(),
          dateUpdated: today(),
        }, { merge: true });
        await setDefaultIfMissing(refs.profilePrivacy, DEFAULT_PROFILE_PRIVACY);
        await setDefaultIfMissing(refs.profileMetacognitionSummary, DEFAULT_PROFILE_METACOGNITION_SUMMARY);
        await setDoc(refs.settingsSchema, readexSchemaDoc(effectiveUid), { merge: true });
      } catch (err) {
        console.warn('Silent skip: scaffold error', err);
      }
    };

    scaffoldFirestore();
  }, [effectiveUid, isOfflineReviewPreview, isReviewIdentity, refs, reviewMode, user]);

  useEffect(() => {
    if (loading.requirements.appearance || loading.requirements.preferences) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const snapshot = {
        themeMode: preferences.themeMode,
        accentTheme: preferences.accentTheme,
        headerFont: appearanceSettings.headerFont,
        fontSize: appearanceSettings.fontSize,
        interfaceShape: appearanceSettings.interfaceShape,
        defaultCollectionView: appearanceSettings.defaultCollectionView,
        highContrastMode: appearanceSettings.highContrastMode,
        reducedMotion: appearanceSettings.reducedMotion,
      };
      applyAppearanceSettings(snapshot, mediaQuery.matches);
      persistAppearanceSettings(snapshot);
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [appearanceSettings.defaultCollectionView, appearanceSettings.fontSize, appearanceSettings.headerFont, appearanceSettings.highContrastMode, appearanceSettings.interfaceShape, appearanceSettings.reducedMotion, loading.requirements.appearance, loading.requirements.preferences, preferences.themeMode, preferences.accentTheme]);

  useEffect(() => {
    lastReadyRouteContentRef.current = null;
  }, [effectiveUid]);

  const totalObjects = media.length + concepts.length + questions.length + vault.length + drafts.length + practices.length + timeline.length + insights.length + links.length + atlasMaps.length + thinkingEvents.length + beliefProfiles.length + unknowns.length + thinkingPatterns.length;

  const seedReviewWorkspace = async ({ force = false, preserveUserCreated = true, announce = false }: { force?: boolean; preserveUserCreated?: boolean; announce?: boolean } = {}) => {
    setIsSeedingReview(true);
    try {
      const { buildDemoWorkspace } = await import('@/lib/demo-workspace');
      const demo = buildDemoWorkspace(effectiveUid);
      const batch = writeBatch(db);

      if (process.env.NODE_ENV !== 'production') {
        console.info('[DemoSeed] Starting', { uid: effectiveUid, force, preserveUserCreated });
      }

      const deleteStaleDemoDocs = <T,>(
        currentItems: T[],
        nextIds: Set<string>,
        idFor: (item: T) => string,
        refFor: (id: string) => DocumentReference<DocumentData>
      ) => {
        if (!force) return;
        currentItems.forEach((item) => {
          const currentId = idFor(item);
          const isDemoRecord = Boolean((item as any)?.demoSeed);
          const shouldDelete = isDemoRecord && !nextIds.has(currentId);
          if (shouldDelete || (!preserveUserCreated && !nextIds.has(currentId))) {
            batch.delete(refFor(currentId));
          }
        });
      };

      deleteStaleDemoDocs(media, new Set(demo.media.map((item) => item.id)), (item) => item.id, (id) => doc(refs.media, id));
      deleteStaleDemoDocs(concepts, new Set(demo.concepts.map((item) => item.id)), (item) => item.id, (id) => doc(refs.concepts, id));
      deleteStaleDemoDocs(questions, new Set(demo.questions.map((item) => item.id)), (item) => item.id, (id) => doc(refs.questions, id));
      deleteStaleDemoDocs(vault, new Set(demo.vault.map((item) => item.id)), (item) => item.id, (id) => doc(refs.vault, id));
      deleteStaleDemoDocs(drafts, new Set(demo.drafts.map((item) => item.id)), (item) => item.id, (id) => doc(refs.drafts, id));
      deleteStaleDemoDocs(practices, new Set(demo.practices.map((item) => item.id)), (item) => item.id, (id) => doc(refs.practices, id));
      deleteStaleDemoDocs(timeline, new Set(demo.timeline.map((item) => item.id)), (item) => item.id, (id) => doc(refs.timeline, id));
      deleteStaleDemoDocs(insights, new Set(demo.insights.map((item) => item.id)), (item) => item.id, (id) => doc(refs.insights, id));
      deleteStaleDemoDocs(links, new Set(demo.links.map((item) => item.id)), (item) => item.id, (id) => doc(refs.links, id));
      deleteStaleDemoDocs(atlasMaps, new Set(demo.atlasMaps.map((item) => item.id)), (item) => item.id, (id) => doc(refs.atlasMaps, id));
      deleteStaleDemoDocs(thinkingEvents, new Set(demo.thinkingEvents.map((item) => item.id)), (item) => item.id, (id) => doc(refs.thinkingEvents, id));
      deleteStaleDemoDocs(beliefProfiles, new Set(demo.beliefProfiles.map((item) => item.positionId)), (item) => item.positionId, (id) => doc(refs.beliefProfiles, id));
      deleteStaleDemoDocs(unknowns, new Set(demo.unknowns.map((item) => item.unknownId)), (item) => item.unknownId, (id) => doc(refs.unknowns, id));
      deleteStaleDemoDocs(thinkingPatterns, new Set(demo.thinkingPatterns.map((item) => item.patternId)), (item) => item.patternId, (id) => doc(refs.thinkingPatterns, id));

      batch.set(refs.user, {
        uid: effectiveUid,
        app: 'noesis',
        displayName: demo.profile.displayName,
        email: demo.profile.email,
        avatarUrl: demo.profile.avatarUrl || demo.profile.photoURL || '',
        reviewWorkspace: true,
        reviewEmail: REVIEW_ACCOUNT_EMAIL,
        updatedAt: today(),
      }, { merge: true });
      batch.set(refs.settingsGoal, demo.goal, { merge: true });
      batch.set(refs.settingsPreferences, demo.preferences, { merge: true });
      batch.set(refs.settingsWorkspace, demo.workspace, { merge: true });
      batch.set(refs.settingsAccount, demo.settingsAccount, { merge: true });
      batch.set(refs.settingsAppearance, demo.settingsAppearance, { merge: true });
      batch.set(refs.settingsMetacognition, demo.settingsMetacognition, { merge: true });
      batch.set(refs.settingsPrivacy, demo.settingsPrivacy, { merge: true });
      batch.set(refs.settingsData, demo.settingsData, { merge: true });
      batch.set(refs.settingsSourceIntake, demo.settingsSourceIntake, { merge: true });
      batch.set(refs.settingsWorks, demo.settingsWorks, { merge: true });
      batch.set(refs.settingsAtlas, demo.settingsAtlas, { merge: true });
      batch.set(refs.settingsNotifications, demo.settingsNotifications, { merge: true });
      batch.set(refs.settingsGoals, demo.settingsGoals, { merge: true });
      batch.set(refs.settingsDeveloper, demo.settingsDeveloper, { merge: true });
      batch.set(refs.profileMain, demo.profile, { merge: true });
      batch.set(refs.profilePrivacy, demo.profilePrivacy, { merge: true });
      batch.set(refs.profileMetacognitionSummary, demo.profileMetacognitionSummary, { merge: true });
      batch.set(doc(refs.thinkingMetrics, 'summary'), demo.thinkingMetrics, { merge: true });
      batch.set(refs.settingsSchema, readexSchemaDoc(effectiveUid), { merge: true });
      batch.set(refs.settingsAtlasView, DEFAULT_ATLAS_VIEW_SETTINGS, { merge: true });
      batch.set(refs.settingsAtlasNodes, DEFAULT_ATLAS_NODE_SETTINGS, { merge: true });

      if (process.env.NODE_ENV !== 'production') {
        console.info('[DemoSeed] Writing collections', {
          media: demo.media.length,
          concepts: demo.concepts.length,
          questions: allQuestions(demo.media, demo.questions).length,
          vault: demo.vault.length,
          drafts: demo.drafts.length,
          practices: demo.practices.length,
          timeline: demo.timeline.length,
          links: demo.links.length,
          thinkingEvents: demo.thinkingEvents.length,
        });
      }

      demo.media.forEach((item) => batch.set(doc(refs.media, item.id), item));
      demo.concepts.forEach((item) => batch.set(doc(refs.concepts, item.id), item));
      demo.questions.forEach((item) => batch.set(doc(refs.questions, item.id), item));
      demo.vault.forEach((item) => batch.set(doc(refs.vault, item.id), item));
      demo.drafts.forEach((item) => batch.set(doc(refs.drafts, item.id), item));
      demo.practices.forEach((item) => batch.set(doc(refs.practices, item.id), item));
      demo.timeline.forEach((item) => batch.set(doc(refs.timeline, item.id), item));
      demo.insights.forEach((item) => batch.set(doc(refs.insights, item.id), item));
      demo.links.forEach((item) => batch.set(doc(refs.links, item.id), item));
      demo.atlasMaps.forEach((item) => batch.set(doc(refs.atlasMaps, item.id), item));
      demo.thinkingEvents.forEach((item) => batch.set(doc(refs.thinkingEvents, item.id), item));
      demo.beliefProfiles.forEach((item) => batch.set(doc(refs.beliefProfiles, item.positionId), item));
      demo.unknowns.forEach((item) => batch.set(doc(refs.unknowns, item.unknownId), item));
      demo.thinkingPatterns.forEach((item) => batch.set(doc(refs.thinkingPatterns, item.patternId), item));

      await batch.commit();
      autoSeedAttemptedRef.current = true;

      if (process.env.NODE_ENV !== 'production') {
        console.info('[DemoSeed] Complete', { uid: effectiveUid });
      }

      if (announce) {
        toast({ title: 'Demo workspace refreshed', description: 'Mock data was reseeded and remains scoped to the review workspace.' });
      }
    } catch (error) {
      console.error('[DemoSeed] Failed', error);
      toast({
        title: 'Demo workspace refresh failed',
        description: 'Firestore rejected the workspace seed. Deploy the latest firestore.rules and confirm this account can write to its own /users/{uid} path.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsSeedingReview(false);
    }
  };

  useEffect(() => {
    if (isOfflineReviewPreview) return;
    if (!isReviewWorkspace || !canSeedReviewWorkspace || isSeedingReview || shellDataLoading) return;
    if (autoSeedAttemptedRef.current) return;
    if (workspace.seedSource === 'system-demo' && totalObjects > 0) return;
    if (totalObjects > 0 && workspace.demoWorkspace) return;
    if (totalObjects === 0) {
      autoSeedAttemptedRef.current = true;
      seedReviewWorkspace().catch((error) => console.warn('Review seed failed', error));
    }
  }, [canSeedReviewWorkspace, isOfflineReviewPreview, isReviewWorkspace, isSeedingReview, shellDataLoading, totalObjects, workspace.demoWorkspace, workspace.seedSource]);

  const metacognitionEnabled = Boolean(featureFlags.metacognitionEnabled);

  useEffect(() => {
    if (isOfflineReviewPreview) return;
    refreshThinkingMetrics();
  }, [isOfflineReviewPreview, metacognitionEnabled, featureFlags.thinkingMetricsEnabled, questions.length, vault.length, links.length, media, insights.length, unknowns, thinkingEvents]);

  const exportReviewArchitecture = async () => {
    const { buildReviewExport } = await import('@/lib/demo-workspace').catch(() => ({ buildReviewExport: null }));
    if (!buildReviewExport) {
      toast({ title: 'Review export unavailable', description: 'Try again when the workspace is online.', variant: 'destructive' });
      return;
    }
    const payload = buildReviewExport({
      uid: effectiveUid,
      profile,
      workspace: {
        ...workspace,
        role: isReviewWorkspace ? 'demo' : workspace.role,
        workspaceMode: isReviewWorkspace ? 'review' : workspace.workspaceMode,
        featureFlags: isReviewWorkspace ? { ...workspace.featureFlags, ...REVIEW_FEATURE_FLAGS } : workspace.featureFlags,
      },
      counts: {
        concepts: concepts.length,
        sources: media.length,
        annotations: allAnnotations(media).length,
        inquiries: allQuestions(media, questions).length,
        positions: vault.length,
        works: drafts.length,
        practices: practices.length,
        evolutionEvents: timeline.length,
        atlasMaps: atlasMaps.length,
        typedLinks: links.length,
      },
      metacognition: {
        thinkingPatterns: thinkingPatterns.map((item) => ({ label: item.label, status: item.status, confidence: item.confidence })),
        unknowns: unknowns.map((item) => ({ title: item.title, status: item.status, importance: item.importance })),
        metrics: thinkingMetrics,
      },
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `noesis-review-export-${effectiveUid}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportWorkspaceData = async () => {
    const demo = isOfflineReviewPreview ? readDemoSession(effectiveUid) : null;
    const payload = demo
      ? await buildWorkspaceExport(effectiveUid, async (name) => demoExportCollection(demo, name),
        async () => demo.userIdentity ? { ...demo.userIdentity, id: effectiveUid } : null)
      : await exportSavedWorkspace(refs.user);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `noesis-workspace-${effectiveUid}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const emitError = (path: string, operation: SecurityRuleContext['operation'], data?: any, error?: unknown) => {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (error instanceof WorkspaceOfflineError) {
      toast({ title: 'You are offline', description: error.message, variant: 'destructive' });
      return;
    }
    if (code !== 'permission-denied' && code !== 'firestore/permission-denied') {
      toast({ title: 'Change not saved', description: 'Your change could not be saved. Check your connection and try again.', variant: 'destructive' });
      return;
    }
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path,
      operation,
      requestResourceData: data,
    }));
  };

  const saveWorkspaceDoc = async (
    ref: DocumentReference<DocumentData>,
    data: DocumentData,
    operation: 'set' | 'update' = 'set',
    setOptions: { merge?: boolean } = { merge: true },
    companionDocs: Array<{ ref: DocumentReference<DocumentData>; data: DocumentData }> = [],
    thinkingEvents: WriteThinkingEventInput[] = [],
  ) => {
    try {
      if (isOfflineReviewPreview) {
        commitDemoChanges(effectiveUid, [
          { path: ref.path, operation, data, merge: setOptions.merge },
          ...companionDocs.map((entry) => ({ path: entry.ref.path, operation: 'set' as const, data: entry.data, merge: true })),
          ...thinkingEvents.map((event) => {
            const { eventRef, payload } = makeThinkingEventPayload(event);
            return { path: eventRef.path, operation: 'set' as const, data: { ...payload, createdAt: new Date().toISOString() } };
          }),
        ]);
        return;
      }
      await commitWorkspaceMutation({
        db,
        ref: ref as any,
        operation,
        data,
        setOptions,
        relatedWrites: companionDocs.map((entry) => ({ ...entry, operation: 'set', setOptions: { merge: true } })),
        thinkingEvents,
      });
    } catch (error) {
      emitError(ref.path, operation === 'update' ? 'update' : 'write', data, error);
      if (error instanceof WorkspaceOfflineError) throw error;
      throw new Error(`Unable to save ${readableWorkspaceArea(ref.path)}.`);
    }
  };

  const commitAndReport = (
    input: Parameters<typeof commitWorkspaceMutation>[0],
    context?: { data?: any; operation?: SecurityRuleContext['operation']; rethrow?: boolean }
  ) => {
    const commit = async () => {
      if (!isOfflineReviewPreview) return commitWorkspaceMutation(input);
      const events = [...(input.thinkingEvent ? [input.thinkingEvent] : []), ...(input.thinkingEvents || [])];
      const changes: DemoChange[] = [{ path: input.ref.path, operation: input.operation, data: input.data, merge: Boolean(input.setOptions && 'merge' in input.setOptions && input.setOptions.merge) }];
      (input.relatedUpdates || []).forEach((update) => changes.push({ path: update.ref.path, operation: 'update', data: update.data }));
      (input.relatedWrites || []).forEach((write) => changes.push({
        path: write.ref.path,
        operation: write.operation,
        data: write.data,
        merge: Boolean(write.setOptions && 'merge' in write.setOptions && write.setOptions.merge),
      }));
      for (const candidate of input.createIfMissing || []) {
        const event = candidate.thinkingEvent ? makeThinkingEventPayload(candidate.thinkingEvent) : null;
        changes.push({
          path: candidate.ref.path,
          operation: 'create-if-missing',
          data: candidate.data,
          onCreate: event ? { path: event.eventRef.path, operation: 'set', data: { ...event.payload, createdAt: today() } } : undefined,
        });
      }
      events.forEach((event) => {
        const { eventRef, payload } = makeThinkingEventPayload(event);
        changes.push({ path: eventRef.path, operation: 'set', data: { ...payload, createdAt: new Date().toISOString() } });
      });
      commitDemoChanges(effectiveUid, changes);
    };
    return commit().catch((error) => {
      emitError(
        input.ref.path,
        context?.operation || (input.operation === 'delete' ? 'delete' : input.operation === 'update' ? 'update' : 'write'),
        context?.data ?? input.data,
        error
      );
      if (context?.rethrow) throw error;
      if (isOfflineReviewPreview) toast({ title: 'Demo change not saved', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    });
  };

  const cleanupDeletedEntityReferences = async (
    entityType: 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'work' | 'practice',
    entityId: string,
    conceptName?: string
  ) => {
    const cleanupChanges: DemoChange[] = [];
    const recordsByCollection: Record<string, Array<{ id?: string; unknownId?: string }>> = {
      [refs.concepts.path]: concepts, [refs.questions.path]: questions, [refs.vault.path]: vault,
      [refs.drafts.path]: drafts, [refs.practices.path]: practices, [refs.media.path]: media, [refs.insights.path]: insights,
      [refs.unknowns.path]: unknowns,
    };
    const updateArray = (collectionRef: any, id: string, field: string, value: string) => {
      const current = recordsByCollection[collectionRef.path]?.find((item) => item.id === id || (item as any).unknownId === id) as Record<string, any> | undefined;
      cleanupChanges.push({ path: doc(collectionRef, id).path, operation: 'update', data: {
        [field]: isOfflineReviewPreview ? (current?.[field] || []).filter((item: string) => item !== value) : arrayRemove(value), dateUpdated: today(),
      } });
    };

    links
      .filter((link) => (link.fromType === entityType && link.fromId === entityId) || (link.toType === entityType && link.toId === entityId))
      .forEach((link) => {
        cleanupChanges.push({ path: doc(refs.links, link.id).path, operation: 'delete' });
      });

    if (entityType === 'source') {
      concepts.filter((item) => item.sourceIds.includes(entityId)).forEach((item) => updateArray(refs.concepts, item.id, 'sourceIds', entityId));
      questions.filter((item) => (item.sourceIds || []).includes(entityId)).forEach((item) => updateArray(refs.questions, item.id, 'sourceIds', entityId));
      vault.filter((item) => (item.sourceIds || []).includes(entityId)).forEach((item) => updateArray(refs.vault, item.id, 'sourceIds', entityId));
      drafts.filter((item) => (item.sourceIds || []).includes(entityId)).forEach((item) => updateArray(refs.drafts, item.id, 'sourceIds', entityId));
      practices.filter((item) => (item.sourceIds || []).includes(entityId)).forEach((item) => updateArray(refs.practices, item.id, 'sourceIds', entityId));
      unknowns.filter((item) => (item.sourceIds || []).includes(entityId)).forEach((item) => updateArray(refs.unknowns, item.unknownId, 'sourceIds', entityId));
    } else if (entityType === 'annotation') {
      questions.filter((item) => (item.evidenceIds || []).includes(entityId)).forEach((item) => updateArray(refs.questions, item.id, 'evidenceIds', entityId));
      questions.filter((item) => item.sourceAnnotationId === entityId).forEach((item) => {
        cleanupChanges.push({ path: doc(refs.questions, item.id).path, operation: 'update', data: { sourceAnnotationId: '', dateUpdated: today() } });
      });
      vault.filter((item) => item.sourceAnnotationId === entityId).forEach((item) => {
        cleanupChanges.push({ path: doc(refs.vault, item.id).path, operation: 'update', data: { sourceAnnotationId: '', dateUpdated: today() } });
      });
    } else if (entityType === 'concept' && conceptName) {
      vault.filter((item) => (item.tags || []).includes(conceptName)).forEach((item) => updateArray(refs.vault, item.id, 'tags', conceptName));
      drafts.filter((item) => (item.conceptTags || []).includes(conceptName)).forEach((item) => updateArray(refs.drafts, item.id, 'conceptTags', conceptName));
      practices.filter((item) => (item.conceptTags || []).includes(conceptName)).forEach((item) => updateArray(refs.practices, item.id, 'conceptTags', conceptName));
      media.filter((item) => (item.tags || []).includes(conceptName)).forEach((item) => updateArray(refs.media, item.id, 'tags', conceptName));
      media.filter((item) => (item.conceptIds || []).includes(entityId)).forEach((item) => updateArray(refs.media, item.id, 'conceptIds', entityId));
      vault.filter((item) => (item.conceptIds || []).includes(entityId)).forEach((item) => updateArray(refs.vault, item.id, 'conceptIds', entityId));
      insights.filter((item) => (item.conceptIds || []).includes(entityId)).forEach((item) => updateArray(refs.insights, item.id, 'conceptIds', entityId));
      drafts.filter((item) => (item.conceptIds || []).includes(entityId)).forEach((item) => updateArray(refs.drafts, item.id, 'conceptIds', entityId));
      practices.filter((item) => (item.conceptIds || []).includes(entityId)).forEach((item) => updateArray(refs.practices, item.id, 'conceptIds', entityId));
      questions.filter((item) => (item.conceptIds || []).includes(entityId)).forEach((item) => updateArray(refs.questions, item.id, 'conceptIds', entityId));
    } else if (entityType === 'inquiry') {
      drafts.filter((item) => (item.questionIds || []).includes(entityId)).forEach((item) => updateArray(refs.drafts, item.id, 'questionIds', entityId));
      practices.filter((item) => (item.questionIds || []).includes(entityId)).forEach((item) => updateArray(refs.practices, item.id, 'questionIds', entityId));
      unknowns.filter((item) => (item.inquiryIds || []).includes(entityId)).forEach((item) => updateArray(refs.unknowns, item.unknownId, 'inquiryIds', entityId));
    } else if (entityType === 'position') {
      questions.filter((item) => (item.beliefIds || []).includes(entityId)).forEach((item) => updateArray(refs.questions, item.id, 'beliefIds', entityId));
      drafts.filter((item) => (item.beliefIds || []).includes(entityId)).forEach((item) => updateArray(refs.drafts, item.id, 'beliefIds', entityId));
      practices.filter((item) => (item.positionIds || []).includes(entityId)).forEach((item) => updateArray(refs.practices, item.id, 'positionIds', entityId));
      unknowns.filter((item) => (item.positionIds || []).includes(entityId)).forEach((item) => updateArray(refs.unknowns, item.unknownId, 'positionIds', entityId));
      cleanupChanges.push({ path: doc(refs.beliefProfiles, entityId).path, operation: 'delete' });
    } else if (entityType === 'work') {
      questions.filter((item) => (item.draftIds || []).includes(entityId)).forEach((item) => updateArray(refs.questions, item.id, 'draftIds', entityId));
      practices.filter((item) => (item.draftIds || []).includes(entityId)).forEach((item) => updateArray(refs.practices, item.id, 'draftIds', entityId));
    } else if (entityType === 'practice') {
      questions.filter((item) => (item.practiceIds || []).includes(entityId)).forEach((item) => updateArray(refs.questions, item.id, 'practiceIds', entityId));
    }

    if (isOfflineReviewPreview) {
      if (cleanupChanges.length) commitDemoChanges(effectiveUid, cleanupChanges);
      return;
    }
    for (let offset = 0; offset < cleanupChanges.length; offset += 400) {
      const batch = writeBatch(db);
      cleanupChanges.slice(offset, offset + 400).forEach((change) => {
        const ref = doc(db, change.path);
        if (change.operation === 'delete') batch.delete(ref);
        else batch.update(ref, change.data || {});
      });
      await batch.commit();
    }
  };

  useEffect(() => {
    if (isOfflineReviewPreview) return;
    return errorEmitter.on('permission-error', (error) => {
      if (error instanceof FirestorePermissionError) {
        setSyncIssue(error);
      }
    });
  }, [isOfflineReviewPreview]);

  const acceptedAiEvents = (
    entityType: WriteThinkingEventInput['entityType'],
    entityId: string,
    previous: Parameters<typeof addedAiReviewEvent>[0],
    next: Parameters<typeof addedAiReviewEvent>[1],
  ): WriteThinkingEventInput[] => {
    const accepted = addedAiReviewEvent(previous, next);
    return accepted ? [{ ...accepted, collection: refs.thinkingEvents, userId: effectiveUid, entityType, entityId }] : [];
  };

  const refreshBeliefProfile = (entry: VaultEntry, patch?: Partial<BeliefProfile>) => {
    if (!metacognitionEnabled || !featureFlags.beliefBiographiesEnabled) return;
    const profileRef = doc(refs.beliefProfiles, entry.id);
    const current = beliefProfiles.find((item) => item.positionId === entry.id);
    const payload: BeliefProfile = {
      positionId: entry.id,
      createdAt: current?.createdAt || entry.dateCreated || today(),
      createdFrom: entry.createdFrom || current?.createdFrom || 'manual',
      originSummary: patch?.originSummary || current?.originSummary || entry.statement || entry.description || '',
      strengthenedBy: patch?.strengthenedBy || current?.strengthenedBy || [],
      challengedBy: patch?.challengedBy || current?.challengedBy || [],
      weakenedBy: patch?.weakenedBy || current?.weakenedBy || [],
      replacedByPositionId: patch?.replacedByPositionId ?? current?.replacedByPositionId,
      abandonedAt: patch?.abandonedAt ?? current?.abandonedAt,
      lastChallengedAt: patch?.lastChallengedAt ?? current?.lastChallengedAt ?? entry.lastChallengedAt,
      lastRevisedAt: patch?.lastRevisedAt ?? current?.lastRevisedAt ?? entry.lastRevisedAt,
      confidenceScore: patch?.confidenceScore ?? current?.confidenceScore ?? entry.confidenceScore ?? entry.confidence,
      certaintyLevel: patch?.certaintyLevel ?? current?.certaintyLevel ?? entry.confidence,
      evidenceQuality: patch?.evidenceQuality ?? current?.evidenceQuality ?? entry.evidenceQuality,
      testingCount: patch?.testingCount ?? current?.testingCount ?? entry.testingCount ?? 0,
      reviewStatus: patch?.reviewStatus || current?.reviewStatus || (entry.status === 'abandoned' ? 'abandoned' : 'current'),
      updatedAt: today(),
    };
    void commitAndReport({
      db,
      ref: profileRef as any,
      operation: 'set',
      data: payload,
      setOptions: { merge: true },
    }, { operation: 'update', data: payload });
  };

  const addUnknown = (data: Partial<Unknown>) => {
    const unknownRef = doc(refs.unknowns);
    const payload: Unknown = {
      unknownId: unknownRef.id,
      title: data.title || 'Untitled Unknown',
      description: data.description || '',
      domain: data.domain || '',
      sourceIds: data.sourceIds || [],
      positionIds: data.positionIds || [],
      inquiryIds: data.inquiryIds || [],
      conceptTags: normalizeConceptTags(data.conceptTags),
      questionIds: data.questionIds || [],
      status: data.status || 'active',
      importance: data.importance || 'medium',
      createdFrom: data.createdFrom || 'manual',
      dateCreated: today(),
      dateUpdated: today(),
      resolvedAt: data.resolvedAt,
      resolutionSummary: data.resolutionSummary || '',
    };
    void commitAndReport({
      db,
      ref: unknownRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'unknown_created',
        entityType: 'unknown',
        entityId: payload.unknownId,
        after: payload,
        origin: payload.createdFrom === 'manual' ? 'user' : payload.createdFrom,
        summary: `Unknown created: ${payload.title}`,
        importance: 'medium',
        relatedEntityIds: { sourceIds: payload.sourceIds || [], positionIds: payload.positionIds || [], inquiryIds: payload.inquiryIds || [] },
        sourceActionId: makeActionId(),
      },
    }, { operation: 'create', data: payload });
    return payload;
  };

  const addTimelineEvent = async (event: TimelineEvent, result?: import('@/lib/contextual-ai').AiReviewResult, eventIds?: readonly string[]) => {
    let provenance: AiProvenanceRecord | undefined;
    if (result) {
      if (result.action !== 'synthesize_evolution_period' || result.targetType !== 'evolution' || result.targetId !== event.entityId
        || !result.reviewId || event.id !== `period-review-${result.reviewId}` || !/^[\w-]{1,100}$/.test(result.reviewId)
        || !event.reason.trim() || event.reason.length > 32000) throw new Error('This review does not match the selected period.');
      provenance = {
        id: event.id, provenanceId: event.id, kind: 'ai-assisted', userId: effectiveUid, schemaVersion: 1,
        targets: [{ type: 'evolution', id: event.id, fieldPath: 'synthesis', subrecordId: event.id }],
        origin: { feature: 'evolution', action: result.action }, sourceActionId: event.id,
        generatedAt: result.generatedAt, acceptedAt: isOfflineReviewPreview ? today() : serverTimestamp(),
        precursor: result.content.slice(0, 32000) || null, acceptedText: event.reason,
        acceptedTextHash: await acceptedTextHash(event.reason), state: 'active',
        contextRefs: (eventIds || []).slice(0, 20).map((id) => ({ type: 'thinking-event', id })),
      };
      event = { ...event, reason: '', synthesisProvenance: { provenanceId: event.id, kind: 'ai-assisted' } };
    }
    const entityType = event.entityType === 'media' ? 'source'
      : event.entityType === 'vault' ? 'position'
      : event.entityType === 'question' ? 'inquiry'
      : event.entityType === 'draft' ? 'work'
      : event.entityType === 'practice' ? 'practice'
      : event.entityType === 'concept' ? 'concept'
      : 'evolution';
    const input: WriteThinkingEventInput = {
      collection: refs.thinkingEvents as any,
      userId: effectiveUid,
      eventType: 'synthesized',
      entityType,
      entityId: event.entityId || event.id,
      after: { legacyTimelineEvent: event },
      summary: event.entityTitle,
      origin: 'ai-assisted',
      importance: ['abandoned', 'replaced', 'resolved'].some((term) => String(event.eventType).includes(term)) ? 'high' : 'medium',
      idempotencyKey: event.id,
      sourceActionId: provenance?.id,
      metadata: provenance ? { provenanceId: provenance.id, fieldPath: 'synthesis', canonicalStream: 'thinkingEvents' }
        : { legacyTimelineEvent: event, canonicalStream: 'thinkingEvents' },
    };
    if (isOfflineReviewPreview) {
      const { eventRef, payload } = makeThinkingEventPayload(input);
      const demo = readDemoSession(effectiveUid);
      const existing = demo.thinkingEvents.find((item) => item.id === eventRef.id);
      const savedOrigin = demo.aiProvenance?.find((item) => item.id === provenance?.id);
      if (existing) {
        if (!matchesPeriodSynthesis(existing, payload) || (provenance && (savedOrigin?.acceptedTextHash !== provenance.acceptedTextHash
          || JSON.stringify(savedOrigin.contextRefs) !== JSON.stringify(provenance.contextRefs)))) throw new Error('This review was already saved with different content.');
        return;
      }
      commitDemoChanges(effectiveUid, [
        { path: eventRef.path, operation: 'create', data: { ...payload, createdAt: today() } },
        ...(provenance ? [{ path: doc(refs.user, 'aiProvenance', provenance.id).path, operation: 'create' as const, data: provenance }] : []),
      ]);
      return;
    }
    await writePeriodSynthesis(input, provenance);
  };

  const updateUnknown = (item: Unknown) => {
    const unknownRef = doc(refs.unknowns, item.unknownId);
    const previous = unknowns.find((unknown) => unknown.unknownId === item.unknownId);
    const nextUnknown = { ...item, dateUpdated: today() };
    void commitAndReport({
      db,
      ref: unknownRef as any,
      operation: 'update',
      data: nextUnknown,
      thinkingEvent: metacognitionEnabled && item.status === 'resolved' ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'unknown_resolved',
        entityType: 'unknown',
        entityId: item.unknownId,
        before: previous || null,
        after: nextUnknown,
        origin: 'user',
        summary: `Unknown resolved: ${item.title}`,
        importance: 'high',
        relatedEntityIds: { sourceIds: item.sourceIds || [], positionIds: item.positionIds || [], inquiryIds: item.inquiryIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'update', data: nextUnknown });
  };

  const addThinkingPattern = (data: Partial<ThinkingPattern>) => {
    const patternRef = doc(refs.thinkingPatterns);
    const payload: ThinkingPattern = {
      patternId: patternRef.id,
      patternType: data.patternType || 'reasoning_style',
      label: data.label || 'Emerging pattern',
      description: data.description || '',
      evidence: data.evidence || [],
      confidence: data.confidence ?? 0.5,
      timespan: data.timespan || 'recent work',
      trendDirection: data.trendDirection || 'unclear',
      status: data.status || 'pending',
      createdFrom: data.createdFrom || 'ai',
      dateCreated: today(),
      dateUpdated: today(),
    };
    void commitAndReport({
      db,
      ref: patternRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'thinking_pattern_inferred',
        entityType: 'thinkingPattern',
        entityId: payload.patternId,
        after: payload,
        origin: payload.createdFrom,
        summary: `Thinking pattern inferred: ${payload.label}`,
        importance: 'medium',
        metadata: { patternType: payload.patternType, confidence: payload.confidence, timespan: payload.timespan },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'create', data: payload });
  };

  const updateThinkingPattern = (pattern: ThinkingPattern) => {
    const patternRef = doc(refs.thinkingPatterns, pattern.patternId);
    const previous = thinkingPatterns.find((item) => item.patternId === pattern.patternId);
    const nextPattern = { ...pattern, dateUpdated: today() };
    const eventType = pattern.status === 'acknowledged'
      ? 'thinking_pattern_acknowledged'
      : pattern.status === 'dismissed'
        ? 'thinking_pattern_dismissed'
        : null;
    void commitAndReport({
      db,
      ref: patternRef as any,
      operation: 'update',
      data: nextPattern,
      thinkingEvent: metacognitionEnabled && eventType ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType,
        entityType: 'thinkingPattern',
        entityId: pattern.patternId,
        before: previous || null,
        after: nextPattern,
        origin: 'user',
        summary: pattern.status === 'acknowledged' ? `Thinking pattern acknowledged: ${pattern.label}` : `Thinking pattern dismissed: ${pattern.label}`,
        importance: pattern.status === 'acknowledged' ? 'medium' : 'low',
        metadata: { patternType: pattern.patternType, confidence: pattern.confidence, timespan: pattern.timespan },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'update', data: nextPattern });
  };

  const refreshThinkingMetrics = (overrides?: Partial<ThinkingMetrics>) => {
    if (isOfflineReviewPreview || !metacognitionEnabled || !featureFlags.thinkingMetricsEnabled) return;
    const metricsRef = doc(refs.thinkingMetrics, 'summary');
    const payload: ThinkingMetrics = {
      questionsAsked: thinkingEvents.filter((item) => item.eventType === 'question_created').length || questions.length,
      assumptionsChallenged: thinkingEvents.filter((item) => item.eventType === 'assumption_challenged' || item.eventType === 'challenged').length,
      beliefsCreated: thinkingEvents.filter((item) => item.entityType === 'position' && (item.eventType === 'created' || item.eventType === 'position_created' || item.eventType === 'position_formed')).length || vault.length,
      beliefsRevised: thinkingEvents.filter((item) => item.entityType === 'position' && (item.eventType === 'revised' || item.eventType === 'position_revised')).length,
      beliefsAbandoned: thinkingEvents.filter((item) => item.entityType === 'position' && (item.eventType === 'abandoned' || item.eventType === 'position_abandoned')).length,
      contradictionsDetected: thinkingEvents.filter((item) => item.eventType === 'contradiction_detected').length,
      contradictionsResolved: thinkingEvents.filter((item) => item.eventType === 'contradiction_resolved' || item.eventType === 'resolved').length,
      connectionsCreated: thinkingEvents.filter((item) => item.eventType === 'linked' || item.eventType === 'link_created').length || links.length,
      sourcesStudied: Math.max(
        media.filter((item) => ['Finished', 'Completed', 'Archived'].includes(item.status)).length,
        thinkingEvents.filter((item) => item.entityType === 'source' && ['source_distilled', 'source_created'].includes(item.eventType)).length
      ),
      ideasSynthesized: thinkingEvents.filter((item) => ['synthesized', 'work_revised'].includes(item.eventType)).length || insights.length,
      unknownsCreated: thinkingEvents.filter((item) => item.eventType === 'unknown_created').length || unknowns.length,
      unknownsResolved: thinkingEvents.filter((item) => item.eventType === 'unknown_resolved').length || unknowns.filter((item) => item.status === 'resolved').length,
      positionsStressTested: thinkingEvents.filter((item) => item.eventType === 'stress_test_answered').length,
      lastComputedAt: today(),
      ...overrides,
    };
    void commitAndReport({
      db,
      ref: metricsRef as any,
      operation: 'set',
      data: payload,
      setOptions: { merge: true },
    }, { operation: 'update', data: payload });
  };

  const prepareTagConcepts = (tags: string[]) => {
    const missing = ensureConceptTerms(concepts, tags);
    const createIfMissing = missing.flatMap((name) => {
      const id = tagConceptId(name);
      if (!id) return [];
      const conceptRef = doc(refs.concepts, id);
      const data: Concept = {
        id: conceptRef.id,
        name,
        description: '',
        links: [],
        sourceIds: [],
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
        createdFrom: name === 'Unsorted Ideas' ? 'fallback' : 'tag',
        philosophyStatus: name === 'Unsorted Ideas' ? 'emerging' : 'undefined',
        dateCreated: today(),
      };
      return [{
        ref: conceptRef as any,
        data,
        thinkingEvent: metacognitionEnabled ? ({
          collection: refs.thinkingEvents as any,
          userId: effectiveUid,
          eventType: 'created',
          entityType: 'concept',
          entityId: data.id,
          after: data,
          summary: `Created concept from tag: ${data.name}`,
          origin: 'system',
          importance: data.name === 'Unsorted Ideas' ? 'low' : 'medium',
          sourceActionId: makeActionId(),
        } satisfies WriteThinkingEventInput) : undefined,
      }];
    });
    return { conceptIds: conceptIdsForLabels(tags, [...concepts, ...createIfMissing.map(({ data }) => data)]), createIfMissing };
  };

  const addConcept = async (data: Partial<Concept>) => {
    if (!data.name?.trim()) return false;
    const conceptRef = doc(refs.concepts);
    const payload = {
      id: conceptRef.id,
      name: conceptKey(data.name),
      description: data.description || '',
      links: data.links || [],
      sourceIds: data.sourceIds || [],
      x: data.x ?? Math.random() * 80 + 10,
      y: data.y ?? Math.random() * 80 + 10,
      // Picker creation is explicit, unlike tag placeholders.
      createdFrom: data.createdFrom === 'tag' ? 'manual' : data.createdFrom || 'manual',
      philosophyStatus: data.philosophyStatus || (data.description ? 'emerging' : 'undefined'),
      dateCreated: today(),
    };
    try {
    await commitAndReport({
      db,
      ref: conceptRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: payload.description ? 'concept_defined' : 'created',
        entityType: 'concept',
        entityId: payload.id,
        after: payload,
        summary: payload.description ? `Defined concept: ${payload.name}` : `Created concept: ${payload.name}`,
        origin: payload.createdFrom === 'manual' ? 'user' : 'system',
        importance: 'medium',
        sourceActionId: makeActionId(),
      },
    }, { operation: 'create', data: payload, rethrow: true });
    return true;
    } catch { return false; }
  };

  const updateConcept = async (concept: Concept, approval?: ConceptReviewApproval) => {
    const conceptRef = doc(refs.concepts, concept.id);
    if (approval) {
      const date = today();
      const event: WriteThinkingEventInput = {
        collection: refs.thinkingEvents, userId: effectiveUid, entityId: concept.id, entityType: 'concept',
        eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance: concept',
      };
      const { assertConceptReviewBaseline, conceptReviewEvent, prepareConceptReview, writeConceptReview } = await import('@/lib/concept-ai-review');
      if (!isOfflineReviewPreview) return writeConceptReview(conceptRef, approval, date, event);
      const { field, record, patch } = await prepareConceptReview(effectiveUid, approval, date, date);
      const demo = readDemoSession(effectiveUid);
      const current = demo.concepts.find((item) => item.id === concept.id);
      if (!current) throw new Error('This concept is no longer available.');
      const existing = demo.aiProvenance?.find((item) => item.id === record.id);
      if (existing) {
        if (existing.acceptedTextHash === record.acceptedTextHash && existing.targets?.[0]?.id === concept.id && existing.targets?.[0]?.fieldPath === field) return;
        throw new Error('This review was already saved with different content.');
      }
      assertConceptReviewBaseline(current, approval.baseline, field);
      await commitAndReport({
        db, ref: conceptRef, operation: 'update', data: patch,
        relatedWrites: [{ ref: doc(refs.user, 'aiProvenance', record.id), operation: 'create', data: record }],
        thinkingEvent: conceptReviewEvent(event, record),
      }, { rethrow: true });
      return;
    }
    const previous = concepts.find((item) => item.id === concept.id);
    const nextConcept = { ...concept, createdFrom: concept.createdFrom === 'tag' && concept.description?.trim() ? 'manual' as const : concept.createdFrom, dateUpdated: today() };
    const definitionChanged = (previous?.description || '') !== (nextConcept.description || '');
    const conceptStatusChanged = previous?.philosophyStatus !== nextConcept.philosophyStatus;
    const conceptSourcesChanged = JSON.stringify(previous?.sourceIds || []) !== JSON.stringify(nextConcept.sourceIds || []);
    return commitAndReport({
      db,
      ref: conceptRef as any,
      operation: 'update',
      data: nextConcept,
      thinkingEvents: acceptedAiEvents('concept', concept.id, previous?.aiReviewHistory, nextConcept.aiReviewHistory),
      thinkingEvent: (definitionChanged || conceptStatusChanged || conceptSourcesChanged) ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: definitionChanged ? 'concept_redefined' : 'edited',
        entityType: 'concept',
        entityId: concept.id,
        before: previous || null,
        after: nextConcept,
        summary: definitionChanged ? `Redefined concept: ${concept.name}` : `Updated concept structure: ${concept.name}`,
        origin: 'user',
        importance: definitionChanged ? 'medium' : 'low',
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'update', data: nextConcept, rethrow: true });
  };

  const deleteConcept = (id: string) => {
    const existing = concepts.find((item) => item.id === id);
    const conceptRef = doc(refs.concepts, id);
    void commitAndReport({
      db,
      ref: conceptRef as any,
      operation: 'delete',
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'deleted',
        entityType: 'concept',
        entityId: id,
        before: existing,
        summary: `Deleted concept: ${existing.name}`,
        origin: 'user',
        importance: 'medium',
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true })
      .then(() => cleanupDeletedEntityReferences('concept', id, existing?.name))
      .catch(() => undefined);
  };

  const addMedia = (data: Partial<Media>) => {
    const tags = normalizeConceptTags(data.tags);
    const { conceptIds, createIfMissing } = prepareTagConcepts(tags);
    const mediaRef = doc(refs.media);
    const annotations = data.annotations || [];
    const payload = {
      id: mediaRef.id,
      title: data.title || 'Untitled Source',
      creator: data.creator || '',
      type: data.type || 'book',
      status: data.status || 'Want to Read',
      year: data.year || '',
      genre: data.genre || '',
      description: data.description || '',
      catalogSummary: data.catalogSummary || '',
      sourceNotes: data.sourceNotes || '',
      url: data.url || '',
      thumbnailUrl: data.thumbnailUrl || '',
      publisher: data.publisher || '',
      isbn: data.isbn || '',
      doi: data.doi || '',
      platform: data.platform || '',
      creators: data.creators || (data.creator ? [data.creator] : []),
      sourceProvider: data.sourceProvider || 'manual',
      externalIds: data.externalIds || {},
      tags,
      conceptIds,
      annotations: boundedNestedAnnotations(annotations),
      capture: data.capture || { sessions: [] },
      dateAdded: today(),
      dateUpdated: today(),
    };
    return commitAndReport({
      db,
      ref: mediaRef as any,
      operation: 'set',
      data: payload,
      createIfMissing,
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'source_created',
        entityType: 'source',
        entityId: payload.id,
        after: payload,
        summary: 'Added a new source.',
        origin: 'user',
        importance: 'medium',
        sourceActionId: makeActionId(),
      },
      relatedWrites: payload.annotations.map((annotation) => ({
        ref: doc(refs.annotations, annotation.id),
        operation: 'set' as const,
        data: annotationRecord(payload.id, annotation, effectiveUid),
      })),
    }, { operation: 'create', data: payload, rethrow: true });
  };

  const updateMedia = async (item: Media, base?: Pick<Partial<Media>, 'dateUpdated'>, approval?: SourceReviewApproval) => {
    const { conceptIds, createIfMissing } = prepareTagConcepts(item.tags || []);
    const mediaRef = doc(refs.media, item.id);
    if (approval) {
      const date = today();
      const event: WriteThinkingEventInput = {
        collection: refs.thinkingEvents, userId: effectiveUid, entityType: 'source', entityId: item.id,
        eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance: source',
      };
      const { matchesSourceReview, prepareSourceReview, sourceReviewEvent, writeSourceReview } = await import('@/lib/source-ai-review');
      if (!isOfflineReviewPreview) return writeSourceReview(mediaRef, approval, date, event);
      const { record, patch } = await prepareSourceReview(effectiveUid, approval, date, date);
      const demo = readDemoSession(effectiveUid);
      const current = demo.media.find((source) => source.id === item.id);
      if (!current) throw new Error('This source is no longer available.');
      const existing = demo.aiProvenance?.find((entry) => entry.id === record.id);
      if (existing) {
        if (matchesSourceReview(existing as typeof record, record)) return;
        throw new Error('This review was already saved with different content.');
      }
      const prepared = patch(current);
      await commitAndReport({
        db, ref: mediaRef, operation: 'update', data: prepared.data,
        relatedWrites: [
          { ref: doc(refs.user, 'aiProvenance', record.id), operation: 'create', data: prepared.origin },
          ...prepared.annotations.map((annotation) => ({ ref: doc(refs.annotations, annotation.id), operation: 'create' as const, data: annotation })),
        ],
        thinkingEvent: sourceReviewEvent(event, prepared.origin),
      }, { rethrow: true });
      return;
    }
    const previous = media.find((source) => source.id === item.id);
    if (base) {
      const stored = isOfflineReviewPreview ? readDemoSession(effectiveUid).media.find((source) => source.id === item.id) : previous;
      if (!previous || !stored || previous.dateUpdated !== base.dateUpdated || stored.dateUpdated !== base.dateUpdated) {
        throw new WorkspaceRecordChangedError();
      }
    }
    const nextItem = {
      ...item,
      conceptIds,
      annotations: boundedNestedAnnotations(item.annotations || []),
      dateUpdated: today(),
    };
    const previousAnnotations = new Map((previous?.annotations || []).map((annotation) => [annotation.id, annotation]));
    const nextAnnotationIds = new Set((item.annotations || []).map((annotation) => annotation.id));
    const annotationWrites = [
      ...(item.annotations || [])
        .filter((annotation) => JSON.stringify(previousAnnotations.get(annotation.id) || null) !== JSON.stringify(annotation))
        .map((annotation) => ({
          ref: doc(refs.annotations, annotation.id),
          operation: 'set' as const,
          data: annotationRecord(item.id, annotation, effectiveUid),
        })),
      ...Array.from(previousAnnotations.keys())
        .filter((annotationId) => !nextAnnotationIds.has(annotationId))
        .map((annotationId) => ({ ref: doc(refs.annotations, annotationId), operation: 'delete' as const })),
    ];
    const previousAnnotationCount = previous?.annotations?.length || 0;
    const nextAnnotationCount = nextItem.annotations?.length || 0;
    const previousSessionCount = previous?.capture?.sessions?.length || 0;
    const nextSessionCount = nextItem.capture?.sessions?.length || 0;
    const captureChanged = JSON.stringify(previous?.capture || {}) !== JSON.stringify(nextItem.capture || {});
    const sourceEventType =
      nextAnnotationCount > previousAnnotationCount ? 'annotation_created'
        : captureChanged && nextSessionCount > previousSessionCount ? 'source_distilled'
          : captureChanged ? 'source_distilled'
            : 'edited';
    const sourceEventImportance = sourceEventType === 'edited' ? 'low' : 'medium';
    return commitAndReport({
      db,
      ref: mediaRef as any,
      operation: 'update',
      data: nextItem,
      requireUnchanged: base ? { ref: mediaRef, field: 'dateUpdated', value: base.dateUpdated } : undefined,
      createIfMissing,
      thinkingEvents: acceptedAiEvents('source', item.id, previous?.aiReviewHistory, nextItem.aiReviewHistory),
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: sourceEventType,
        entityType: 'source',
        entityId: item.id,
        before: previous || null,
        after: nextItem,
        summary: sourceEventType === 'annotation_created'
          ? `Added annotation context to ${nextItem.title || 'source'}`
          : sourceEventType === 'source_distilled'
            ? `Updated source capture for ${nextItem.title || 'source'}`
            : `Updated source metadata for ${nextItem.title || 'source'}`,
        origin: 'user',
        importance: sourceEventImportance,
        sourceActionId: makeActionId(),
      },
      relatedWrites: annotationWrites,
    }, { operation: 'update', data: nextItem, rethrow: true });
  };

  const deleteMedia = async (id: string) => {
    const existing = media.find((item) => item.id === id);
    const mediaRef = doc(refs.media, id);
    await commitAndReport({
      db,
      ref: mediaRef as any,
      operation: 'delete',
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'deleted',
        entityType: 'source',
        entityId: id,
        before: { ...existing, annotations: boundedNestedAnnotations(existing.annotations || []) },
        summary: `Deleted source: ${existing.title}`,
        origin: 'user',
        importance: 'medium',
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true });
    // Annotation records stay private and are only displayed with a live source.
    try {
      await cleanupDeletedEntityReferences('source', id);
    } catch {
      toast({ title: 'Source deleted', description: 'Some linked references still need cleanup. Reload before following an old source link.', variant: 'destructive' });
    }
  };

  const updateAnnotation = async (sourceId: string, annotation: Annotation, approval?: AnnotationReviewApproval) => {
    const mediaRef = doc(refs.media, sourceId);
    if (approval) {
      const date = today();
      const event: WriteThinkingEventInput = {
        collection: refs.thinkingEvents, userId: effectiveUid, entityType: 'annotation', entityId: annotation.id,
        eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance: annotation effect',
      };
      const { annotationReviewEvent, matchesAnnotationReview, prepareAnnotationReview, writeAnnotationReview } = await import('@/lib/annotation-ai-review');
      if (!isOfflineReviewPreview) return writeAnnotationReview(mediaRef, annotation, approval, date, event);
      const { record, patch } = await prepareAnnotationReview(effectiveUid, sourceId, annotation, approval, date, date);
      const demo = readDemoSession(effectiveUid);
      const source = demo.media.find((item) => item.id === sourceId);
      const current = demo.annotations?.find((item) => item.id === annotation.id && item.sourceId === sourceId) as Annotation | undefined
        ?? source?.annotations?.find((item) => item.id === annotation.id);
      if (!source || !current) throw new Error('This annotation is no longer available.');
      const existing = demo.aiProvenance?.find((item) => item.id === record.id);
      if (existing) {
        if (matchesAnnotationReview(existing as typeof record, record)) return current;
        throw new Error('This review was already saved with different content.');
      }
      const next = patch(source, current);
      await commitAndReport({
        db, ref: mediaRef, operation: 'update', data: next.source,
        relatedWrites: [
          { ref: doc(refs.annotations, annotation.id), operation: 'set', data: next.annotation },
          { ref: doc(refs.user, 'aiProvenance', record.id), operation: 'create', data: record },
        ],
        thinkingEvent: annotationReviewEvent(event, record),
      }, { rethrow: true });
      return next.annotation;
    }
    const source = media.find((item) => item.id === sourceId);
    if (!source) return Promise.reject(new Error('The annotation source is no longer available.'));
    const previous = (source.annotations || []).find((item) => item.id === annotation.id) || null;
    if (!previous) return Promise.reject(new Error('The annotation is no longer available.'));
    const annotations = (source.annotations || []).map((item) => item.id === annotation.id ? annotation : item);
    const nextSource = { ...source, annotations: boundedNestedAnnotations(annotations), dateUpdated: today() };
    return commitAndReport({
      db,
      ref: mediaRef as any,
      operation: 'update',
      data: nextSource,
      requireUnchanged: { ref: mediaRef, field: 'dateUpdated', value: source.dateUpdated },
      thinkingEvents: acceptedAiEvents('annotation', annotation.id, previous?.aiReviewHistory, annotation.aiReviewHistory),
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: previous ? 'edited' : 'annotation_created',
        entityType: 'annotation',
        entityId: annotation.id,
        before: previous,
        after: annotation,
        summary: previous ? 'Updated annotation.' : 'Created annotation.',
        origin: 'user',
        importance: previous ? 'low' : 'medium',
        relatedEntityIds: { sourceIds: [sourceId], conceptIds: normalizeConceptTags(annotation.conceptTags).map((tag) => concepts.find((item) => conceptKey(item.name) === conceptKey(tag))?.id).filter(Boolean) as string[] },
        sourceActionId: makeActionId(),
      },
      relatedWrites: [{
        ref: doc(refs.annotations, annotation.id),
        operation: 'set',
        data: annotationRecord(sourceId, annotation, effectiveUid),
      }],
    }, { operation: 'update', data: nextSource, rethrow: true });
  };

  const deleteAnnotation = async (sourceId: string, annotationId: string) => {
    const source = media.find((item) => item.id === sourceId);
    if (!source) return;
    const existing = (source.annotations || []).find((item) => item.id === annotationId) || null;
    const annotations = (source.annotations || []).filter((item) => item.id !== annotationId);
    const mediaRef = doc(refs.media, sourceId);
    const nextSource = { ...source, annotations: boundedNestedAnnotations(annotations), dateUpdated: today() };
    await commitAndReport({
      db,
      ref: mediaRef as any,
      operation: 'update',
      data: nextSource,
      requireUnchanged: { ref: mediaRef, field: 'dateUpdated', value: source.dateUpdated },
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'deleted',
        entityType: 'annotation',
        entityId: annotationId,
        before: existing,
        summary: `Deleted annotation: ${existing.text.trim().slice(0, 120) || 'Untitled annotation'}`,
        origin: 'user',
        importance: 'low',
        relatedEntityIds: { sourceIds: [sourceId] },
        sourceActionId: makeActionId(),
      } : null,
      relatedWrites: [{ ref: doc(refs.annotations, annotationId), operation: 'delete' }],
    }, { operation: 'update', data: nextSource, rethrow: true });
    try {
      await cleanupDeletedEntityReferences('annotation', annotationId);
    } catch {
      // The annotation is already deleted. Orphan cleanup can be retried independently.
    }
  };

  const addVaultEntry = async (data: Partial<VaultEntry> & { annotationRefs?: Array<{ sourceId: string; annotationId: string }> }) => {
    const tags = normalizeConceptTags(data.tags);
    const { conceptIds, createIfMissing } = prepareTagConcepts(tags);
    const vaultRef = doc(refs.vault);
    const annotationOrigins = promotedAnnotationOrigins(media, data.annotationRefs || []);
    const payload = {
      id: vaultRef.id,
      title: data.title || 'Untitled Position',
      type: data.type || 'belief',
      statement: data.statement || data.description || '',
      description: data.description || data.statement || '',
      confidence: normalizePositionConfidence(data.confidence),
      status: data.status || 'active',
      positionKind: data.positionKind || 'interpretive',
      confidenceReasoning: data.confidenceReasoning || '',
      assumptions: data.assumptions || [],
      falsification: data.falsification || '',
      consequences: data.consequences || [],
      applications: data.applications || [],
      tags,
      conceptIds,
      sourceIds: uniqueIds(data.sourceIds || []),
      evidenceFor: data.evidenceFor || [],
      evidenceAgainst: data.evidenceAgainst || [],
      versionHistory: boundedPositionVersionHistory(data.versionHistory || []),
      createdFrom: data.createdFrom || 'manual',
      sourceAnnotationId: data.sourceAnnotationId || '',
      ...(annotationOrigins.length ? { annotationOrigins } : {}),
      sourceWorkId: data.sourceWorkId || '',
      sourceDocumentId: data.sourceDocumentId || '',
      dateCreated: today(),
      dateUpdated: today(),
    };
    const positionEvent: WriteThinkingEventInput = {
      collection: refs.thinkingEvents as any,
      userId: effectiveUid,
      eventType: 'position_created',
      entityType: 'position',
      entityId: payload.id,
      after: payload,
      summary: `Position created: ${payload.title}`,
      origin: 'user',
      importance: 'high',
      relatedEntityIds: {
        sourceIds: payload.sourceIds,
        conceptIds,
        annotationIds: uniqueIds(data.annotationRefs?.map((item) => item.annotationId) || (payload.sourceAnnotationId ? [payload.sourceAnnotationId] : [])),
      },
      sourceActionId: makeActionId(),
    };
    const positionVersionWrites = (payload.versionHistory || []).map((version) => ({
      ref: doc(refs.positionVersions, historyRecordId(payload.id, `${version.date || 'undated'}__${stableHistoryToken(version.description || '')}`)),
      operation: 'set' as const,
      data: { ...version, id: historyRecordId(payload.id, `${version.date || 'undated'}__${stableHistoryToken(version.description || '')}`), positionId: payload.id, userId: effectiveUid },
    }));
    const annotationRefs = data.annotationRefs || [];
    const annotationWrites: NonNullable<Parameters<typeof commitWorkspaceMutation>[0]['relatedWrites']> = [];
    if (annotationRefs.length) {
      new Set(annotationRefs.map((item) => item.sourceId)).forEach((sourceId) => {
        const source = media.find((item) => item.id === sourceId);
        if (!source) return;
        const annotationIds = new Set(annotationRefs.filter((item) => item.sourceId === sourceId).map((item) => item.annotationId));
        const updatedAnnotations = (source.annotations || []).map((annotation) => annotationIds.has(annotation.id) ? {
            ...annotation,
            philosophyStatus: 'used_in_position' as const,
            createdPositionId: annotation.createdPositionId || payload.id,
            linkedPositionIds: uniqueIds([...(annotation.linkedPositionIds || []), payload.id]),
          } : annotation);
        const sourcePatch = {
          annotations: boundedNestedAnnotations(updatedAnnotations),
          dateUpdated: today(),
        };
        annotationWrites.push({ ref: doc(refs.media, sourceId), operation: 'update', data: sourcePatch });
        updatedAnnotations.filter((annotation) => annotationIds.has(annotation.id)).forEach((annotation) => {
          const record = annotationRecord(sourceId, annotation, effectiveUid);
          annotationWrites.push({ ref: doc(refs.annotations, annotation.id), operation: 'set', data: record, setOptions: { merge: true } });
        });
      });
    }
    await commitAndReport({
      db,
      ref: vaultRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: positionEvent,
      createIfMissing,
      relatedWrites: [...positionVersionWrites, ...annotationWrites],
    }, { operation: 'create', data: payload, rethrow: true });
    refreshBeliefProfile(payload as VaultEntry, { originSummary: payload.statement || payload.description });
    return payload as VaultEntry;
  };

  const updateVaultEntry = async (entry: VaultEntry, approval?: PositionReviewApproval) => {
    const vaultRef = doc(refs.vault, entry.id);
    if (approval) {
      const date = today();
      const event: WriteThinkingEventInput = {
        collection: refs.thinkingEvents, userId: effectiveUid, entityType: 'position', entityId: entry.id,
        eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance: position',
      };
      const { matchesPositionReview, positionReviewEvent, preparePositionReview, writePositionReview } = await import('@/lib/position-ai-review');
      if (!isOfflineReviewPreview) return writePositionReview(vaultRef, approval, date, event);
      const { record, patch } = await preparePositionReview(effectiveUid, entry.id, approval, date, date);
      const demo = readDemoSession(effectiveUid);
      const current = demo.vault.find((item) => item.id === entry.id);
      if (!current) throw new Error('This position is no longer available.');
      const existing = demo.aiProvenance?.find((item) => item.id === record.id);
      if (existing) {
        if (matchesPositionReview(existing, record)) return;
        throw new Error('This review was already saved with different content.');
      }
      await commitAndReport({
        db, ref: vaultRef, operation: 'update',
        data: patch(current, demo.vault.find((item) => item.id === approval.comparisonId)),
        relatedWrites: [{ ref: doc(refs.user, 'aiProvenance', record.id), operation: 'create', data: record }],
        thinkingEvent: positionReviewEvent(event, record),
      }, { rethrow: true });
      return;
    }
    const { conceptIds, createIfMissing } = prepareTagConcepts(entry.tags || []);
    const previous = vault.find((item) => item.id === entry.id);
    const confidenceChanged = Boolean(previous && previous.confidence !== entry.confidence);
    const nextEntry = {
      ...entry,
      conceptIds,
      dateUpdated: today(),
      versionHistory: boundedPositionVersionHistory(positionRevisionHistory(previous, entry, today())),
    };
    const profilePatch: Partial<BeliefProfile> = {
      confidenceScore: entry.confidenceScore ?? entry.confidence,
      evidenceQuality: entry.evidenceQuality,
      lastRevisedAt: today(),
    };
    const previousVersions = new Set((previous?.versionHistory || []).map((version) => `${version.date}|${version.description}`));
    const positionVersionWrites = (nextEntry.versionHistory || [])
      .filter((version) => !previousVersions.has(`${version.date}|${version.description}`))
      .map((version) => ({
        ref: doc(refs.positionVersions, historyRecordId(entry.id, `${version.date || 'undated'}__${stableHistoryToken(version.description || '')}`)),
        operation: 'set' as const,
        data: { ...version, id: historyRecordId(entry.id, `${version.date || 'undated'}__${stableHistoryToken(version.description || '')}`), positionId: entry.id, userId: effectiveUid },
      }));
    const changeClassification = classifyThinkingChange(previous || null, entry);
    const positionEvents: WriteThinkingEventInput[] = [];
    if (previous && (previous.evidenceFor || []).length < (entry.evidenceFor || []).length) {
      profilePatch.strengthenedBy = [...(beliefProfiles.find((item) => item.positionId === entry.id)?.strengthenedBy || []), 'Evidence added'];
      positionEvents.push({ collection: refs.thinkingEvents as any, userId: effectiveUid, eventType: 'evidence_added', entityType: 'position', entityId: entry.id, before: previous, after: nextEntry, origin: 'user', summary: `Evidence added to ${entry.title}`, importance: 'medium', relatedEntityIds: { sourceIds: entry.sourceIds || [] }, sourceActionId: makeActionId() });
    }
    if (previous && (previous.evidenceAgainst || []).length < (entry.evidenceAgainst || []).length) {
      profilePatch.challengedBy = [...(beliefProfiles.find((item) => item.positionId === entry.id)?.challengedBy || []), 'Challenge recorded'];
      profilePatch.lastChallengedAt = today();
      positionEvents.push({ collection: refs.thinkingEvents as any, userId: effectiveUid, eventType: 'challenge_added', entityType: 'position', entityId: entry.id, before: previous, after: nextEntry, origin: 'user', summary: `Challenge added to ${entry.title}`, importance: 'high', relatedEntityIds: { sourceIds: entry.sourceIds || [] }, sourceActionId: makeActionId(), epistemicStatus: 'challenged' });
    }
    if (confidenceChanged && previous) {
      positionEvents.push({ collection: refs.thinkingEvents as any, userId: effectiveUid, eventType: 'confidence_changed', entityType: 'position', entityId: entry.id, before: previous, after: nextEntry, origin: 'user', summary: `Confidence changed for ${entry.title}`, importance: 'medium', confidenceBefore: previous.confidence, confidenceAfter: entry.confidence, sourceActionId: makeActionId() });
    }
    if (previous && (previous.testingCount || 0) < (entry.testingCount || 0)) {
      positionEvents.push({
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'stress_test_answered',
        entityType: 'position',
        entityId: entry.id,
        before: previous,
        after: nextEntry,
        origin: 'user',
        summary: `Stress test answered for ${entry.title}`,
        metadata: { from: previous.testingCount || 0, to: entry.testingCount || 0 },
        importance: 'high',
        sourceActionId: makeActionId(),
      });
    }
    if (entry.status === 'abandoned' && previous?.status !== 'abandoned') {
      profilePatch.abandonedAt = today();
      profilePatch.reviewStatus = 'abandoned';
      positionEvents.push({ collection: refs.thinkingEvents as any, userId: effectiveUid, eventType: 'position_abandoned', entityType: 'position', entityId: entry.id, before: previous, after: nextEntry, origin: 'user', summary: `Position abandoned: ${entry.title}`, importance: 'major', epistemicStatus: 'abandoned', sourceActionId: makeActionId() });
    } else {
      positionEvents.push({ collection: refs.thinkingEvents as any, userId: effectiveUid, eventType: changeClassification.eventType, entityType: 'position', entityId: entry.id, before: previous || null, after: nextEntry, origin: 'user', summary: `${changeClassification.eventType === 'position_revised' ? 'Position revised' : 'Position edited'}: ${entry.title}`, importance: changeClassification.importance, sourceActionId: makeActionId() });
    }
    await commitAndReport({
      db,
      ref: vaultRef as any,
      operation: 'update',
      data: nextEntry,
      createIfMissing,
      thinkingEvents: [...positionEvents, ...acceptedAiEvents('position', entry.id, previous?.aiReviewHistory, nextEntry.aiReviewHistory)],
      relatedWrites: positionVersionWrites,
    }, { operation: 'update', data: nextEntry, rethrow: true });
    refreshBeliefProfile(entry, profilePatch);
  };

  const deleteVaultEntry = async (id: string) => {
    const existing = vault.find((item) => item.id === id);
    const vaultRef = doc(refs.vault, id);
    await commitAndReport({
      db,
      ref: vaultRef as any,
      operation: 'delete',
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'deleted',
        entityType: 'position',
        entityId: id,
        before: existing,
        summary: `Deleted position: ${existing.title}`,
        origin: 'user',
        importance: 'high',
        relatedEntityIds: { sourceIds: existing.sourceIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true });
    try {
      await cleanupDeletedEntityReferences('position', id);
    } catch {
      // The position is already deleted. Orphan cleanup can be retried independently.
    }
  };

  const createIdea = async (data: { title: string; body: string; tags: string[]; sourceIds: string[]; position?: { title: string; statement: string; description: string; confidence: number }; sourceAnnotationId?: string; sourceWorkId?: string; sourceDocumentId?: string }) => {
    const tags = normalizeConceptTags(data.tags);
    const { conceptIds, createIfMissing } = prepareTagConcepts(tags);
    const insightRef = doc(refs.insights);
    const payload: Insight = {
      id: insightRef.id,
      title: data.title,
      body: data.body,
      sourceIds: data.sourceIds || [],
      tags,
      conceptIds,
      categories: [],
      connections: [],
      dateCreated: today(),
      dateUpdated: today(),
    };
    await commitAndReport({
      db,
      ref: insightRef as any,
      operation: 'set',
      data: payload,
      createIfMissing,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'synthesized',
        entityType: 'insight',
        entityId: insightRef.id,
        after: payload,
        origin: 'user',
        summary: `Source insight saved: ${data.title}`,
        importance: 'medium',
        relatedEntityIds: {
          sourceIds: data.sourceIds || [],
          annotationIds: data.sourceAnnotationId ? [data.sourceAnnotationId] : [],
          workIds: data.sourceWorkId ? [data.sourceWorkId] : [],
        },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'create', data: payload, rethrow: true });
    return { positionId: '', insightId: insightRef.id, title: data.title };
  };

  const formPositionFromInquiry = async (
    question: Question,
    position: { title: string; statement: string; description: string; confidence: number },
    finalAnswer: string
  ) => {
    const existing = questions.find((item) => item.id === question.id);
    if (existing && question.dateUpdated !== existing.dateUpdated) throw new WorkspaceRecordChangedError();
    if (!existing || isInquiryClosed(existing) || !finalAnswer.trim() || !position.title.trim() || !position.statement.trim()) {
      throw new Error('An open, saved inquiry and a written claim are required.');
    }
    const vaultRef = doc(refs.vault);
    const sourceIds = uniqueIds(inquirySourceIds(question).filter((id) => media.some((source) => source.id === id)));
    const tags = (question.conceptIds || []).flatMap((conceptId) => {
      const concept = concepts.find((item) => item.id === conceptId || conceptKey(item.name) === conceptKey(conceptId));
      return concept ? [concept.name] : [];
    });
    const date = today();
    const conceptIds = conceptIdsForLabels(tags, concepts);
    const positionPayload: VaultEntry = withNoesisStage('position', {
      id: vaultRef.id,
      title: position.title,
      type: 'belief',
      statement: position.statement,
      description: position.description,
      confidence: normalizePositionConfidence(position.confidence),
      status: 'developing',
      positionKind: 'interpretive',
      confidenceReasoning: question.resolutionSummary?.trim() || '',
      assumptions: question.assumptions || [],
      falsification: '',
      consequences: [],
      applications: [],
      tags,
      conceptIds,
      sourceIds,
      ...inquiryPositionEvidence(question, finalAnswer),
      versionHistory: [{
        description: `Formed from inquiry: ${question.text}`,
        eventType: 'created',
        date,
      }],
      createdFrom: 'inquiry',
      sourceInquiryId: question.id,
      ...(existing.annotationOrigins?.length ? { annotationOrigins: existing.annotationOrigins } : {}),
      dateCreated: date,
      dateUpdated: date,
    });
    const questionRef = doc(refs.questions, question.id);
    if (isOfflineReviewPreview) {
      const current = readDemoSession(effectiveUid).questions.find((item) => item.id === question.id);
      if (!current || current.status !== existing.status || current.dateUpdated !== existing.dateUpdated) {
        throw new WorkspaceRecordChangedError();
      }
    }
    const inquiryPatch = withNoesisStage('inquiry', {
      status: 'converted',
      answer: finalAnswer.trim(),
      resolutionSummary: question.resolutionSummary?.trim() || `Converted into the developing position “${position.title}”.`,
      checkpointSkips: question.checkpointSkips || [],
      dateUpdated: date,
    });
    await commitAndReport({
      db,
      ref: vaultRef,
      operation: 'create',
      data: positionPayload,
      requireUnchanged: { ref: questionRef, field: 'status', value: existing.status },
      requireUnchangedRecords: [{ ref: questionRef, field: 'dateUpdated', value: existing.dateUpdated }],
      relatedUpdates: [{
        ref: questionRef,
        data: { ...inquiryPatch, beliefIds: isOfflineReviewPreview ? uniqueIds([...(existing.beliefIds || []), vaultRef.id]) : arrayUnion(vaultRef.id) },
      }],
      thinkingEvent: {
        collection: refs.thinkingEvents,
        userId: effectiveUid,
        eventType: 'position_formed',
        entityType: 'position',
        entityId: vaultRef.id,
        after: positionPayload,
        origin: 'user',
        summary: `Inquiry promoted into position: ${position.title}`,
        importance: 'high',
        relatedEntityIds: {
          inquiryIds: [question.id],
          sourceIds,
          conceptIds,
        },
        sourceActionId: makeActionId(),
      },
    }, { operation: 'create', data: positionPayload, rethrow: true });
    return positionPayload;
  };

  const addQuestion = async (data: Partial<Question> & { annotationRefs?: Array<{ sourceId: string; annotationId: string }> }) => {
    const questionRef = doc(refs.questions);
    const annotationRefs = data.annotationRefs || [];
    const annotationUpdates = inquiryAnnotationUpdates(media, annotationRefs, questionRef.id);
    const annotationOrigins = promotedAnnotationOrigins(media, annotationRefs);
    const payload = {
      id: questionRef.id,
      text: data.text || '',
      status: data.status || 'open',
      answer: data.answer || '',
      whyItMatters: data.whyItMatters || '',
      currentIntuition: data.currentIntuition || '',
      uncertainty: data.uncertainty || '',
      assumptions: data.assumptions || [],
      candidateAnswers: data.candidateAnswers || [],
      resolutionSummary: data.resolutionSummary || '',
      evidenceIds: uniqueIds([...(data.evidenceIds || []), ...annotationRefs.map((item) => item.annotationId)]),
      evidenceRecords: data.evidenceRecords || [],
      conceptIds: uniqueIds(data.conceptIds || []),
      sourceIds: uniqueIds([...(data.sourceIds || []), ...annotationUpdates.map((item) => item.sourceId)]),
      beliefIds: uniqueIds(data.beliefIds || []),
      draftIds: uniqueIds(data.draftIds || []),
      practiceIds: uniqueIds(data.practiceIds || []),
      type: data.type || 'manual',
      sourceAnnotationId: data.sourceAnnotationId || '',
      ...(annotationOrigins.length ? { annotationOrigins } : {}),
      sourceWorkId: data.sourceWorkId || '',
      sourceDocumentId: data.sourceDocumentId || '',
      dateCreated: today(),
      dateUpdated: today(),
    };
    const inquiryEvent: WriteThinkingEventInput = {
      collection: refs.thinkingEvents as any,
      userId: effectiveUid,
      eventType: 'question_created',
      entityType: 'inquiry',
      entityId: payload.id,
      after: payload,
      summary: `Inquiry created: ${payload.text}`,
      origin: 'user',
      importance: 'medium',
      relatedEntityIds: {
        sourceIds: payload.sourceIds || [],
        positionIds: payload.beliefIds || [],
        annotationIds: uniqueIds(data.annotationRefs?.map((item) => item.annotationId) || (payload.sourceAnnotationId ? [payload.sourceAnnotationId] : [])),
      },
      sourceActionId: makeActionId(),
    };
    await commitAndReport({
      db,
      ref: questionRef,
      operation: 'set',
      data: payload,
      thinkingEvent: inquiryEvent,
      requireUnchangedRecords: annotationUpdates.map(({ sourceId, sourceVersion }) => ({
        ref: doc(refs.media, sourceId), field: 'dateUpdated', value: sourceVersion,
      })),
      relatedUpdates: annotationUpdates.map(({ sourceId, annotations }) => ({
        ref: doc(refs.media, sourceId), data: { annotations, dateUpdated: today() },
      })),
      relatedWrites: annotationUpdates.flatMap(({ sourceId, updated }) => updated.map((annotation) => ({
        ref: doc(refs.annotations, annotation.id),
        operation: 'set' as const,
        data: annotationRecord(sourceId, annotation, effectiveUid),
        setOptions: { merge: true },
      }))),
    }, { operation: 'create', data: payload, rethrow: true });
    return payload as Question;
  };

  const updateQuestion = async (question: Question) => {
    const questionRef = doc(refs.questions, question.id);
    const previous = questions.find((item) => item.id === question.id);
    if (!previous || question.dateUpdated !== previous.dateUpdated) throw new WorkspaceRecordChangedError();
    const nextQuestion = { ...question, dateUpdated: today() };
    const resolved = question.status === 'resolved' || question.status === 'answered';
    const reviewNotes = (item?: Question) => item?.investigationNotes?.filter((note) => note.origin === 'ai-assisted')
      .map(({ id }) => ({ id, action: 'socratic_inquiry_challenge' }));
    return commitAndReport({
      db,
      ref: questionRef as any,
      operation: 'update',
      data: nextQuestion,
      requireUnchanged: { ref: questionRef, field: 'dateUpdated', value: previous.dateUpdated },
      thinkingEvents: acceptedAiEvents('inquiry', question.id, reviewNotes(previous), reviewNotes(nextQuestion)),
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: resolved && previous?.status !== question.status ? 'question_resolved' : 'edited',
        entityType: 'inquiry',
        entityId: question.id,
        before: inquiryHistorySnapshot(previous),
        after: inquiryHistorySnapshot(nextQuestion),
        summary: resolved ? `Inquiry resolved: ${question.text}` : `Inquiry updated: ${question.text}`,
        origin: 'user',
        importance: resolved ? 'high' : 'low',
        sourceActionId: makeActionId(),
      },
    }, { operation: 'update', data: nextQuestion, rethrow: true });
  };

  const saveInquiryAiReview = async (inquiryId: string, review: InquiryAiReview, content: string) => {
    if (!review.reviewId || !/^[\w-]{1,100}$/.test(review.reviewId)
      || review.targetId !== inquiryId || review.targetType !== 'inquiry' || review.action !== 'socratic_inquiry_challenge') {
      throw new Error('This review does not belong to this inquiry.');
    }
    const event: WriteThinkingEventInput = {
      collection: refs.thinkingEvents, userId: effectiveUid, entityType: 'inquiry', entityId: inquiryId,
      eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance: Socratic challenge',
      idempotencyKey: `ai-review-${review.reviewId}`,
      metadata: { contextualAiAction: review.action, acceptedAfterReview: true, reviewEntryId: review.reviewId },
    };
    const inquiryRef = doc(refs.questions, inquiryId);
    const dateUpdated = today();
    if (!isOfflineReviewPreview) return writeInquiryAiReview(inquiryRef, review, content, dateUpdated, event);
    const hash = await acceptedTextHash(content);
    const demo = readDemoSession(effectiveUid);
    const existing = demo.thinkingEvents.find((entry) => entry.id === event.idempotencyKey);
    if (existing) {
      if (existing.entityId === inquiryId && existing.origin === 'ai-assisted'
        && existing.metadata?.reviewEntryId === review.reviewId
        && (!existing.metadata.provenanceId || demo.aiProvenance?.some((entry) => entry.id === event.idempotencyKey && entry.acceptedTextHash === hash))) return;
      throw new Error('This challenge was already saved with different content.');
    }
    const inquiry = demo.questions.find((item) => item.id === inquiryId);
    if (!inquiry) throw new Error('This inquiry is no longer available.');
    const patch = inquiryAiReviewPatch(inquiry, review, content);
    const { provenanceRef, record } = makeInquiryAiProvenance(inquiryRef, review, patch, effectiveUid, hash, dateUpdated);
    await commitAndReport({
      db, ref: inquiryRef, operation: 'update',
      data: { ...patch, dateUpdated },
      relatedWrites: [{ ref: provenanceRef, operation: 'set', data: record }],
      thinkingEvent: { ...event, sourceActionId: record.id, metadata: { ...event.metadata, provenanceId: record.id, fieldPath: 'investigationNotes.text' } },
    }, { rethrow: true });
  };

  const deleteQuestion = async (id: string) => {
    const existing = questions.find((item) => item.id === id);
    const questionRef = doc(refs.questions, id);
    await commitAndReport({
      db,
      ref: questionRef as any,
      operation: 'delete',
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'deleted',
        entityType: 'inquiry',
        entityId: id,
        before: existing,
        summary: `Deleted inquiry: ${existing.text}`,
        origin: 'user',
        importance: 'medium',
        relatedEntityIds: {
          sourceIds: inquirySourceIds(existing).filter((sourceId) => media.some((source) => source.id === sourceId)),
          positionIds: existing.beliefIds || [],
          workIds: existing.draftIds || [],
          annotationIds: existing.sourceAnnotationId ? [existing.sourceAnnotationId] : [],
        },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true });
    await cleanupDeletedEntityReferences('inquiry', id).catch(() => {
      toast({ title: 'Inquiry deleted', description: 'Some linked references could not be updated. Refresh before following its old links.', variant: 'destructive' });
    });
  };

  const linkInquiryItem = async (inquiryId: string, type: 'work' | 'practice', itemId: string) => {
    const inquiry = questions.find((item) => item.id === inquiryId);
    const item = (type === 'work' ? drafts : practices).find((record) => record.id === itemId);
    if (!inquiry || !item) throw new Error('The inquiry or linked item is no longer available.');
    const field = type === 'work' ? 'draftIds' : 'practiceIds';
    if (inquiry[field]?.includes(itemId) && item.questionIds?.includes(inquiryId)) return;
    const dateUpdated = today();
    const appendId = (ids: string[] | undefined, id: string) =>
      isOfflineReviewPreview ? uniqueIds([...(ids || []), id]) : arrayUnion(id);
    await commitAndReport({
      db,
      ref: doc(refs.questions, inquiryId),
      operation: 'update',
      data: { [field]: appendId(inquiry[field], itemId), dateUpdated },
      relatedUpdates: [{
        ref: doc(type === 'work' ? refs.drafts : refs.practices, itemId),
        data: { questionIds: appendId(item.questionIds, inquiryId), dateUpdated },
      }],
      thinkingEvent: {
        collection: refs.thinkingEvents,
        userId: effectiveUid,
        eventType: 'linked',
        entityType: 'inquiry',
        entityId: inquiryId,
        relatedEntityIds: type === 'work' ? { workIds: [itemId] } : { practiceIds: [itemId] },
        summary: `Linked ${type} to inquiry: ${item.title}`,
        origin: 'user',
      },
    }, { rethrow: true });
  };

  const addDraft = async (data: Partial<Draft>, origin?: ContextDeskWorkOrigin): Promise<Draft> => {
    const conceptTags = normalizeConceptTags(data.conceptTags);
    const { conceptIds, createIfMissing } = prepareTagConcepts(conceptTags);
    const review = data.aiReviewHistory?.[0];
    const reviewId = review?.action === 'review_selected_context' && review.id === data.id
      ? contextDeskReviewWorkId(data.id?.replace(/^context-review-/, '')) : undefined;
    const draftRef = reviewId ? doc(refs.drafts, reviewId) : doc(refs.drafts);
    if (origin && (!reviewId || !review)) throw new Error('This review could not be identified.');
    const provenance = origin && reviewId && review
      ? await contextDeskWorkProvenance(reviewId, effectiveUid, origin, review.content, isOfflineReviewPreview ? today() : serverTimestamp())
      : null;
    const payload = {
      id: draftRef.id,
      title: data.title || 'Untitled Draft',
      body: data.body || '',
      type: data.type || preferences.writingDefaults.type,
      status: data.status || preferences.writingDefaults.status,
      label: data.label || '',
      workCategory: data.workCategory || workCategoryForDraft(data.type || preferences.writingDefaults.type),
      workPurpose: data.workPurpose || 'explore',
      purposeNote: data.purposeNote || '',
      atlasRegion: data.atlasRegion || '',
      argumentSkeleton: data.argumentSkeleton || {},
      completionReflection: data.completionReflection || {},
      paperType: data.paperType || data.writingStyle || preferences.writingDefaults.writingStyle,
      draftContent: data.draftContent || data.body || '',
      finalContent: data.finalContent || '',
      activeMode: data.activeMode || 'draft',
      activeRibbon: data.activeRibbon || 'writing',
      recordingType: data.recordingType || 'screen',
      durationSeconds: data.durationSeconds || 0,
      fileUrl: data.fileUrl || '',
      storagePath: data.storagePath || '',
      asset: data.asset,
      thumbnailUrl: data.thumbnailUrl || '',
      canvasData: data.canvasData || '',
      canvasAsset: data.canvasAsset,
      inlineAssets: data.inlineAssets || [],
      drawingState: data.drawingState,
      templateData: data.templateData,
      documentPages: data.documentPages || [],
      documentSettings: data.documentSettings,
      pageSettings: data.pageSettings || {},
      writingOverlayData: data.writingOverlayData || '',
      overlayAsset: data.overlayAsset,
      writingStyle: data.writingStyle || preferences.writingDefaults.writingStyle,
      externalDoc: data.externalDoc || null,
      conceptTags,
      conceptIds,
      sourceIds: uniqueIds(data.sourceIds || []),
      questionIds: uniqueIds(data.questionIds || []),
      beliefIds: uniqueIds(data.beliefIds || []),
      versionHistory: boundedNestedWorkRevisions(data.versionHistory || []),
      ...(data.aiReviewHistory?.length ? { aiReviewHistory: data.aiReviewHistory } : {}),
      ...(provenance ? { bodyProvenance: { provenanceId: provenance.id, kind: provenance.kind } } : {}),
      dateCreated: today(),
      dateUpdated: today(),
    };
    const workRevisionWrites = (payload.versionHistory || []).map((revision) => ({
      ref: doc(refs.workRevisions, historyRecordId(payload.id, revision.id)),
      operation: 'set' as const,
      data: { ...revision, id: historyRecordId(payload.id, revision.id), revisionId: revision.id, workId: payload.id, userId: effectiveUid },
    }));
    const acceptExistingCreate = reviewId ? (existing: Partial<Draft>) => isContextDeskReviewRetry(existing, payload as Draft) : undefined;
    if (reviewId && isOfflineReviewPreview) {
      const existing = readDemoSession(effectiveUid).drafts.find((item) => item.id === reviewId);
      if (existing && acceptExistingCreate?.(existing)) return existing;
    }
    await commitAndReport({
      db,
      ref: draftRef as any,
      operation: reviewId ? 'create' : 'set',
      data: payload,
      acceptExistingCreate,
      relatedUpdates: questions.filter((question) => payload.questionIds.includes(question.id)).map((question) => ({
        ref: doc(refs.questions, question.id),
        data: { draftIds: isOfflineReviewPreview ? uniqueIds([...(question.draftIds || []), payload.id]) : arrayUnion(payload.id), dateUpdated: today() },
      })),
      relatedWrites: [
        ...workRevisionWrites,
        ...(provenance ? [{ ref: doc(refs.user, 'aiProvenance', provenance.id), operation: 'create' as const, data: provenance }] : []),
      ],
      createIfMissing,
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'created',
        entityType: 'work',
        entityId: payload.id,
        after: workHistorySnapshot(payload),
        summary: `Created work: ${payload.title}`,
        origin: reviewId ? 'ai-assisted' : 'user',
        ...(reviewId ? {
          idempotencyKey: reviewId,
          metadata: { acceptedAfterReview: true, contextualAiAction: 'review_selected_context', reviewEntryId: reviewId,
            ...(provenance ? { provenanceId: provenance.id, fieldPath: 'body' } : {}) },
        } : {}),
        importance: 'medium',
        relatedEntityIds: { conceptIds, inquiryIds: payload.questionIds || [], positionIds: payload.beliefIds || [], sourceIds: payload.sourceIds || [] },
        sourceActionId: provenance?.id || makeActionId(),
      },
    }, { operation: 'create', data: payload, rethrow: true });
    return payload as Draft;
  };

  const updateDraft = async (draft: Draft, expectedVersion: WorkVersion = draft) => {
    const previous = drafts.find((item) => item.id === draft.id);
    if (expectedVersion.id !== draft.id) throw new WorkspaceRecordChangedError();
    const { conceptIds, createIfMissing } = prepareTagConcepts(draft.conceptTags || []);
    const nextDraft = {
      ...draft,
      conceptIds,
      versionHistory: boundedNestedWorkRevisions(draft.versionHistory || []),
      revision: (expectedVersion.revision ?? 0) + 1,
      dateUpdated: today(),
    };
    const { lastOpenedAt: _lastOpenedAt, ...workWrite } = nextDraft;
    const previousRevisionIds = new Set((previous?.versionHistory || []).map((revision) => revision.id));
    const workRevisionWrites = (nextDraft.versionHistory || [])
      .filter((revision) => !previousRevisionIds.has(revision.id))
      .map((revision) => ({
        ref: doc(refs.workRevisions, historyRecordId(draft.id, revision.id)),
        operation: 'set' as const,
        data: { ...revision, id: historyRecordId(draft.id, revision.id), revisionId: revision.id, workId: draft.id, userId: effectiveUid },
      }));
    if (isOfflineReviewPreview) {
      const stored = readDemoSession(effectiveUid).drafts.find((item) => item.id === draft.id);
      if (!stored || !sameWorkVersion(stored, expectedVersion)) {
        throw new WorkspaceRecordChangedError();
      }
      commitDemoChanges(effectiveUid, [
        { path: doc(refs.drafts, draft.id).path, operation: 'update', data: workWrite },
        ...workRevisionWrites.map((write) => ({ path: write.ref.path, operation: 'set' as const, data: write.data })),
      ]);
      return nextDraft;
    }
    const draftRef = doc(refs.drafts, draft.id);
    const contentDelta = Math.abs(workContentLength(nextDraft) - workContentLength(previous));
    const statusChanged = previous?.status !== nextDraft.status;
    const reflectionChanged = JSON.stringify(previous?.completionReflection || {}) !== JSON.stringify(nextDraft.completionReflection || {});
    const structureChanged = JSON.stringify(previous?.argumentSkeleton || {}) !== JSON.stringify(nextDraft.argumentSkeleton || {});
    const meaningfulWorkChange = statusChanged || reflectionChanged || structureChanged || contentDelta >= 160;
    await commitAndReport({
      db,
      ref: draftRef as any,
      operation: 'update',
      data: workWrite,
      requireUnchangedRecords: [
        { ref: draftRef, field: 'dateUpdated', value: expectedVersion.dateUpdated },
        { ref: draftRef, field: 'revision', value: expectedVersion.revision },
      ],
      relatedWrites: workRevisionWrites,
      createIfMissing,
      thinkingEvent: meaningfulWorkChange ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'work_revised',
        entityType: 'work',
        entityId: draft.id,
        before: workHistorySnapshot(previous),
        after: workHistorySnapshot(nextDraft),
        summary: statusChanged
          ? `Changed work status: ${draft.title}`
          : reflectionChanged
            ? `Updated completion reflection for work: ${draft.title}`
            : structureChanged
              ? `Reworked structure for: ${draft.title}`
              : `Substantially revised work: ${draft.title}`,
        origin: 'user',
        importance: statusChanged || reflectionChanged || structureChanged ? 'medium' : 'low',
        relatedEntityIds: { sourceIds: draft.sourceIds || [], inquiryIds: draft.questionIds || [], positionIds: draft.beliefIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'update', data: nextDraft, rethrow: true });
    return nextDraft;
  };

  const markDraftOpened = (draft: Draft) => {
    const openedAt = new Date().toISOString();
    if (isOfflineReviewPreview) {
      commitDemoChanges(effectiveUid, [{ path: doc(refs.drafts, draft.id).path, operation: 'update', data: { lastOpenedAt: openedAt } }]);
      return Promise.resolve();
    }
    return commitAndReport({
      db,
      ref: doc(refs.drafts, draft.id) as any,
      operation: 'update',
      data: { lastOpenedAt: openedAt },
    }, {
      operation: 'update',
      data: { id: draft.id, lastOpenedAt: openedAt },
      rethrow: true,
    });
  };

  const deleteDraft = (id: string) => {
    const existing = drafts.find((item) => item.id === id);
    const draftRef = doc(refs.drafts, id);
    return commitAndReport({
      db,
      ref: draftRef as any,
      operation: 'delete',
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'deleted',
        entityType: 'work',
        entityId: id,
        before: existing,
        summary: `Deleted work: ${existing.title}`,
        origin: 'user',
        importance: 'medium',
        relatedEntityIds: { sourceIds: existing.sourceIds || [], inquiryIds: existing.questionIds || [], positionIds: existing.beliefIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true })
      .then(async () => {
        await cleanupDeletedEntityReferences('work', id);
        // Deleted works remain recoverable; their private media must survive
        // until an explicit retention/purge operation removes the snapshot.
      });
  };

  const addPractice = async (data: Partial<Practice>): Promise<Practice> => {
    const tags = normalizeConceptTags(data.conceptTags);
    const { conceptIds, createIfMissing } = prepareTagConcepts(tags);
    const practiceRef = doc(refs.practices);
    const payload = {
      id: practiceRef.id,
      title: data.title || 'Untitled Practice',
      description: data.description || '',
      type: data.type || 'experiment',
      status: normalizePracticeStatusForSave(data),
      durationDays: Number.isFinite(data.durationDays) ? Math.max(0, Math.floor(data.durationDays!)) : 7,
      startDate: practiceStartDateForSave(data),
      endDate: data.endDate || '',
      intellectualBasis: data.intellectualBasis || '',
      hypothesis: data.hypothesis || '',
      action: data.action || '',
      context: data.context || '',
      durationMode: data.durationMode || 'repeated',
      observationMethod: data.observationMethod || '',
      expectedOutcome: data.expectedOutcome || '',
      observedOutcome: data.observedOutcome || '',
      interpretation: data.interpretation || '',
      effectOnPosition: data.effectOnPosition || '',
      alternativeExplanation: data.alternativeExplanation || '',
      conclusion: data.conclusion || {},
      conceptTags: tags,
      conceptIds,
      sourceIds: uniqueIds(data.sourceIds || []),
      questionIds: uniqueIds(data.questionIds || []),
      positionIds: uniqueIds(data.positionIds || []),
      draftIds: uniqueIds(data.draftIds || []),
      notes: data.notes || '',
      logs: boundedNestedPracticeLogs(data.logs || []),
      logDates: data.logDates || [],
      dateCreated: today(),
      dateUpdated: today(),
    };
    const practiceLogWrites = (payload.logs || []).map((log) => ({
      ref: doc(refs.practiceLogs, historyRecordId(payload.id, log.id)),
      operation: 'set' as const,
      data: { ...log, id: historyRecordId(payload.id, log.id), logId: log.id, practiceId: payload.id, userId: effectiveUid },
    }));
    await commitAndReport({
      db,
      ref: practiceRef as any,
      operation: 'set',
      data: payload,
      relatedUpdates: questions.filter((question) => payload.questionIds.includes(question.id)).map((question) => ({
        ref: doc(refs.questions, question.id),
        data: { practiceIds: isOfflineReviewPreview ? uniqueIds([...(question.practiceIds || []), payload.id]) : arrayUnion(payload.id), dateUpdated: today() },
      })),
      relatedWrites: practiceLogWrites,
      createIfMissing,
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'practice_created',
        entityType: 'practice',
        entityId: payload.id,
        after: payload,
        summary: `Created practice: ${payload.title}`,
        origin: 'user',
        importance: 'medium',
        relatedEntityIds: { positionIds: payload.positionIds || [], inquiryIds: payload.questionIds || [], sourceIds: payload.sourceIds || [] },
        sourceActionId: makeActionId(),
      },
    }, { operation: 'create', data: payload, rethrow: true });
    return payload as Practice;
  };

  const updatePractice = async (practice: Practice, approval?: PracticeReviewApproval) => {
    const practiceRef = doc(refs.practices, practice.id);
    if (approval) {
      const date = today();
      const event: WriteThinkingEventInput = {
        collection: refs.thinkingEvents, userId: effectiveUid, entityType: 'practice', entityId: practice.id,
        eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance: practice outcome',
      };
      const { matchesPracticeReview, practiceReviewEvent, preparePracticeReview, writePracticeReview } = await import('@/lib/practice-ai-review');
      if (!isOfflineReviewPreview) return writePracticeReview(practiceRef, practice, approval, date, event);
      const { record, patch } = await preparePracticeReview(effectiveUid, practice, approval, date, date);
      const demo = readDemoSession(effectiveUid);
      const current = demo.practices.find((item) => item.id === practice.id);
      if (!current) throw new Error('This practice is no longer available.');
      const existing = demo.aiProvenance?.find((item) => item.id === record.id);
      if (existing) {
        if (matchesPracticeReview(existing, record)) return current;
        throw new Error('This review was already saved with different content.');
      }
      const data = patch(current);
      await commitAndReport({
        db, ref: practiceRef, operation: 'update', data,
        relatedWrites: [{ ref: doc(refs.user, 'aiProvenance', record.id), operation: 'create', data: record }],
        thinkingEvent: practiceReviewEvent(event, record),
      }, { rethrow: true });
      return { ...current, ...data };
    }
    const { conceptIds, createIfMissing } = prepareTagConcepts(practice.conceptTags || []);
    const previous = practices.find((item) => item.id === practice.id);
    const nextPractice = {
      ...practice,
      conceptIds,
      logs: boundedNestedPracticeLogs(practice.logs || []),
      status: normalizePracticeStatusForSave(practice),
      startDate: practiceStartDateForSave(practice),
      dateUpdated: today(),
    };
    const previousLogsById = new Map((previous?.logs || []).map((log) => [log.id, log]));
    const practiceLogWrites = (nextPractice.logs || [])
      .filter((log) => JSON.stringify(previousLogsById.get(log.id) || null) !== JSON.stringify(log))
      .map((log) => ({
        ref: doc(refs.practiceLogs, historyRecordId(practice.id, log.id)),
        operation: 'set' as const,
        data: { ...log, id: historyRecordId(practice.id, log.id), logId: log.id, practiceId: practice.id, userId: effectiveUid },
      }));
    const previousLogs = Math.max(previous?.logDates?.length || 0, previous?.logs?.length || 0);
    const nextLogs = Math.max(practice.logDates?.length || 0, practice.logs?.length || 0);
    const concluded = ['completed', 'concluded', 'failed', 'failed_productively', 'integrated', 'abandoned'].includes(practice.status);
    const eventType = nextLogs > previousLogs
      ? 'practice_logged'
      : concluded && previous?.status !== practice.status
        ? 'practice_concluded'
        : 'edited';
    return commitAndReport({
      db,
      ref: practiceRef as any,
      operation: 'update',
      data: nextPractice,
      relatedWrites: practiceLogWrites,
      createIfMissing,
      thinkingEvents: acceptedAiEvents('practice', practice.id, previous?.aiReviewHistory, nextPractice.aiReviewHistory),
      thinkingEvent: eventType !== 'edited' ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType,
        entityType: 'practice',
        entityId: practice.id,
        before: previous || null,
        after: nextPractice,
        summary: nextLogs > previousLogs ? `Logged a practice test connected to ${practice.title}` : concluded && previous?.status !== practice.status ? `Concluded practice: ${practice.title}` : `Updated practice: ${practice.title}`,
        origin: 'user',
        importance: nextLogs > previousLogs || concluded ? 'high' : 'low',
        relatedEntityIds: { positionIds: practice.positionIds || [], inquiryIds: practice.questionIds || [], workIds: practice.draftIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'update', data: nextPractice, rethrow: true });
  };

  const deletePractice = (id: string) => {
    const existing = practices.find((item) => item.id === id);
    const practiceRef = doc(refs.practices, id);
    return commitAndReport({
      db,
      ref: practiceRef as any,
      operation: 'delete',
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'deleted',
        entityType: 'practice',
        entityId: id,
        before: existing,
        summary: `Deleted practice: ${existing.title}`,
        origin: 'user',
        importance: 'medium',
        relatedEntityIds: { sourceIds: existing.sourceIds || [], inquiryIds: existing.questionIds || [], positionIds: existing.positionIds || [], workIds: existing.draftIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true })
      .then(() => cleanupDeletedEntityReferences('practice', id));
  };

  const restoreDeletedItem = async ({ id }: ThinkingEvent) => {
    const event = recentRecoverableDeletions(recentDeletedItems).find((item) => item.id === id && item.userId === effectiveUid);
    if (!event?.before) {
      throw new Error('This deleted item cannot be restored from its saved record.');
    }
    if (event.entityType === 'annotation') {
      const sourceId = deletedAnnotationSource(event);
      if (!sourceId || !event.entityId || event.entityId.includes('/') || typeof event.before.text !== 'string') {
        throw new Error('This annotation cannot be restored from its saved record.');
      }
      const sourceRef = doc(refs.media, sourceId);
      const source = isOfflineReviewPreview
        ? readDemoSession(effectiveUid).media.find((item) => item.id === sourceId)
        : (await getDocFromServer(sourceRef)).data();
      if (!source) throw new Error('Restore the source before restoring its annotation.');
      if (source.annotations?.some((item: Annotation) => item.id === event.entityId)) {
        throw new Error('This annotation already exists. Open the current annotation instead.');
      }
      const snapshot = annotationRecord(sourceId, event.before as Annotation, effectiveUid);
      await commitAndReport({
        db,
        ref: doc(refs.annotations, event.entityId),
        operation: 'create',
        data: snapshot,
        requireUnchanged: { ref: sourceRef, field: 'dateUpdated', value: source.dateUpdated },
        thinkingEvent: {
          collection: refs.thinkingEvents as any,
          userId: effectiveUid,
          eventType: 'restored',
          entityType: 'annotation',
          entityId: event.entityId,
          after: snapshot,
          summary: 'Restored annotation.',
          origin: 'user',
          importance: 'low',
          relatedEntityIds: { sourceIds: [sourceId] },
          sourceActionId: makeActionId(),
        },
      }, { operation: 'write', data: snapshot, rethrow: true });
      return;
    }
    const collectionByType = {
      concept: refs.concepts,
      source: refs.media,
      position: refs.vault,
      inquiry: refs.questions,
      work: refs.drafts,
      practice: refs.practices,
    } as const;
    const collectionRef = collectionByType[event.entityType as keyof typeof collectionByType];
    const restoredAnnotations = event.entityType === 'source' ? sourceRecoveryAnnotations(event.before, event.entityId, effectiveUid) : [];
    const snapshot = event.entityType === 'source'
      ? { ...event.before, annotations: [] }
      : event.before;
    if (!collectionRef) {
      throw new Error('This deleted item cannot be restored from its saved record.');
    }
    await commitAndReport({
      db,
      ref: doc(collectionRef, event.entityId) as any,
      operation: 'create',
      data: snapshot,
      createIfMissing: restoredAnnotations.map((data) => ({ ref: doc(refs.annotations, data.id), data })),
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'restored',
        entityType: event.entityType,
        entityId: event.entityId,
        before: null,
        after: snapshot,
        summary: `Restored ${event.entityType}: ${event.summary.replace(/^Deleted [^:]+:\s*/i, '')}`,
        origin: 'user',
        importance: 'low',
        sourceActionId: makeActionId(),
      },
    }, { operation: 'write', data: snapshot, rethrow: true });
  };

  const highImportanceAtlasLinks = new Set<PhilosophicalLinkType>(['contradicts', 'supports', 'challenges', 'tested_by', 'refines', 'depends_on']);
  const moderateImportanceAtlasLinks = new Set<PhilosophicalLinkType>(['defines', 'explains', 'explained_by', 'strengthens', 'weakens', 'derived_from', 'questions', 'replaces', 'expands']);

  const getLinkObjectProfile = (type: PhilosophicalLink['fromType'], id: string) => {
    if (type === 'source') {
      const source = media.find((item) => item.id === id);
      return {
        conceptTags: source?.tags || [],
        sourceIds: source ? [source.id] : [],
        evidenceCount: source ? 1 : 0,
        date: source?.dateUpdated || source?.dateAdded || '',
      };
    }

    if (type === 'annotation') {
      const annotation = allAnnotations(media).find((item) => item.id === id);
      return {
        conceptTags: annotation?.conceptTags || annotation?.source.tags || [],
        sourceIds: annotation?.source?.id ? [annotation.source.id] : [],
        evidenceCount: annotation?.source?.id ? 1 : 0,
        date: annotation?.date || '',
      };
    }

    if (type === 'concept') {
      const concept = concepts.find((item) => item.id === id);
      return {
        conceptTags: concept?.name ? [concept.name] : [],
        sourceIds: concept?.sourceIds || [],
        evidenceCount: (concept?.sourceIds || []).length,
        date: concept?.dateUpdated || concept?.dateCreated || '',
      };
    }

    if (type === 'inquiry') {
      const inquiry = questions.find((item) => item.id === id);
      return {
        conceptTags: (inquiry?.conceptIds || []).map((conceptId) => concepts.find((item) => item.id === conceptId)?.name || conceptId),
        sourceIds: inquiry ? inquirySourceIds(inquiry).filter((sourceId) => media.some((source) => source.id === sourceId)) : [],
        evidenceCount: (inquiry?.evidenceIds || []).length,
        date: inquiry?.dateUpdated || inquiry?.dateCreated || '',
      };
    }

    if (type === 'position') {
      const position = vault.find((item) => item.id === id);
      return {
        conceptTags: position?.tags || [],
        sourceIds: position?.sourceIds || [],
        evidenceCount: (position?.sourceIds || []).length + (position?.evidenceFor || []).length,
        date: position?.dateUpdated || position?.dateCreated || '',
      };
    }

    if (type === 'work') {
      const work = drafts.find((item) => item.id === id);
      return {
        conceptTags: work?.conceptTags || [],
        sourceIds: work?.sourceIds || [],
        evidenceCount: (work?.sourceIds || []).length,
        date: work?.dateUpdated || work?.dateCreated || '',
      };
    }

    if (type === 'practice') {
      const practice = practices.find((item) => item.id === id);
      return {
        conceptTags: practice?.conceptTags || [],
        sourceIds: practice?.sourceIds || [],
        evidenceCount: (practice?.sourceIds || []).length + (practice?.positionIds || []).length,
        date: practice?.dateUpdated || practice?.dateCreated || '',
      };
    }

    return { conceptTags: [], sourceIds: [], evidenceCount: 0, date: '' };
  };

  const deriveAtlasMapModesForLink = (type: PhilosophicalLinkType) => {
    const modes = new Set<'core' | 'conflict' | 'evidence' | 'practice' | 'evolution' | 'full'>(['full']);
    if (['challenges', 'contradicts', 'weakens', 'questions'].includes(type)) modes.add('conflict');
    if (['supports', 'exemplifies', 'references', 'derived_from', 'strengthens'].includes(type)) modes.add('evidence');
    if (['tested_by', 'expressed_in', 'depends_on'].includes(type)) modes.add('practice');
    if (['refines', 'replaces', 'changed_by', 'derived_from'].includes(type)) modes.add('evolution');
    if (highImportanceAtlasLinks.has(type) || moderateImportanceAtlasLinks.has(type)) modes.add('core');
    return Array.from(modes);
  };

  const scoreAtlasLink = (draft: Pick<PhilosophicalLink, 'fromType' | 'fromId' | 'toType' | 'toId' | 'type' | 'createdFrom'> & Partial<PhilosophicalLink>) => {
    const fromProfile = getLinkObjectProfile(draft.fromType, draft.fromId);
    const toProfile = getLinkObjectProfile(draft.toType, draft.toId);
    const sharedConceptCount = Array.from(new Set(normalizeConceptTags(fromProfile.conceptTags))).filter((tag) =>
      normalizeConceptTags(toProfile.conceptTags).includes(tag)
    ).length;
    const explicitLinkScore = draft.createdFrom === 'manual' ? 40 : draft.createdFrom === 'suggestion' ? 30 : 20;
    const interactionScore = Math.min((draft.interactionCount || 0) * 5, 15);
    const latestDate = [fromProfile.date, toProfile.date].map((value) => Date.parse(value || '') || 0).sort((a, b) => b - a)[0] || 0;
    const ageDays = latestDate ? Math.max(0, (Date.now() - latestDate) / (1000 * 60 * 60 * 24)) : 999;
    const recencyScore = ageDays <= 7 ? 10 : ageDays <= 30 ? 6 : ageDays <= 90 ? 3 : 0;
    const evidenceScore = Math.min(fromProfile.evidenceCount + toProfile.evidenceCount, 10);
    const relationshipImportanceScore = highImportanceAtlasLinks.has(draft.type) ? 15 : moderateImportanceAtlasLinks.has(draft.type) ? 9 : 4;
    const sharedConceptScore = Math.min(sharedConceptCount * 8, 24);
    const connectionScore = Math.min(100, explicitLinkScore + sharedConceptScore + interactionScore + recencyScore + evidenceScore + relationshipImportanceScore);
    const connectionStrength = connectionScore >= 65 ? 'strong' : connectionScore >= 35 ? 'moderate' : 'weak';
    return {
      connectionScore,
      connectionStrength,
      mapModes: deriveAtlasMapModesForLink(draft.type),
    };
  };

  const markPhilosophicalLinkInteraction = (id: string) => {
    const existing = links.find((item) => item.id === id);
    if (!existing) return;
    const nextInteractionCount = (existing.interactionCount || 0) + 1;
    const linkRef = doc(refs.links, id);
    const scoreMeta = scoreAtlasLink({ ...existing, interactionCount: nextInteractionCount });
    const data = {
      lastInteractedAt: today(),
      interactionCount: nextInteractionCount,
      connectionScore: scoreMeta.connectionScore,
      connectionStrength: scoreMeta.connectionStrength,
      mapModes: scoreMeta.mapModes,
      dateUpdated: today(),
    };
    void commitAndReport({
      db,
      ref: linkRef as any,
      operation: 'update',
      data,
    }, { operation: 'update', data: { id, ...data } });
  };

  const addPhilosophicalLink = (data: Partial<PhilosophicalLink>, options?: { creationMethod?: string; rethrow?: boolean }) => {
    if (!data.fromType || !data.fromId || !data.toType || !data.toId || !data.type) return;
    const linkRef = doc(refs.links);
    const atlasMeta = scoreAtlasLink({
      fromType: data.fromType,
      fromId: data.fromId,
      toType: data.toType,
      toId: data.toId,
      type: data.type,
      createdFrom: data.createdFrom || 'manual',
      interactionCount: 0,
    });
    const payload = {
      id: linkRef.id,
      fromType: data.fromType,
      fromId: data.fromId,
      fromLabel: data.fromLabel || '',
      toType: data.toType,
      toId: data.toId,
      toLabel: data.toLabel || '',
      type: data.type,
      note: data.note || '',
      createdFrom: data.createdFrom || 'manual',
      acceptedByUser: data.acceptedByUser ?? (data.createdFrom === 'manual' || data.createdFrom === 'suggestion'),
      connectionScore: atlasMeta.connectionScore,
      connectionStrength: atlasMeta.connectionStrength,
      lastInteractedAt: today(),
      interactionCount: 1,
      mapModes: atlasMeta.mapModes,
      dateCreated: today(),
      dateUpdated: today(),
    };
    return commitAndReport({
      db,
      ref: linkRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: payload.type === 'contradicts' ? 'contradiction_detected' : 'link_created',
        entityType: 'link',
        entityId: payload.id,
        after: payload,
        relatedEntityIds: {
          conceptIds: [payload.fromType === 'concept' ? payload.fromId : '', payload.toType === 'concept' ? payload.toId : ''].filter(Boolean),
          inquiryIds: [payload.fromType === 'inquiry' ? payload.fromId : '', payload.toType === 'inquiry' ? payload.toId : ''].filter(Boolean),
          positionIds: [payload.fromType === 'position' ? payload.fromId : '', payload.toType === 'position' ? payload.toId : ''].filter(Boolean),
          linkIds: [payload.id],
        },
        summary: `${payload.type.replace(/_/g, ' ')} link created between ${payload.fromLabel || payload.fromId} and ${payload.toLabel || payload.toId}`,
        origin: payload.createdFrom === 'manual' ? 'user' : payload.createdFrom === 'suggestion' ? 'ai' : 'system',
        importance: payload.type === 'contradicts' ? 'high' : 'medium',
        metadata: { method: options?.creationMethod || 'philosophical_link_create', relationshipType: payload.type, sourceId: payload.fromId, targetId: payload.toId },
        sourceActionId: makeActionId(),
      },
    }, { operation: 'create', data: payload, rethrow: options?.rethrow });
  };

  const addAtlasQuickLink = (data: Partial<PhilosophicalLink>) => addPhilosophicalLink(data, { creationMethod: 'atlas_quick_link', rethrow: true });

  const updatePhilosophicalLink = (link: PhilosophicalLink) => {
    const linkRef = doc(refs.links, link.id);
    const previous = links.find((item) => item.id === link.id);
    const atlasMeta = scoreAtlasLink(link);
    const nextLink = {
      ...link,
      connectionScore: atlasMeta.connectionScore,
      connectionStrength: atlasMeta.connectionStrength,
      mapModes: atlasMeta.mapModes,
      dateUpdated: today(),
    };
    void commitAndReport({
      db,
      ref: linkRef as any,
      operation: 'update',
      data: nextLink,
      thinkingEvent: {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: previous?.type !== link.type && link.type === 'contradicts' ? 'contradiction_detected' : 'edited',
        entityType: 'link',
        entityId: link.id,
        before: previous || null,
        after: nextLink,
        summary: `Updated ${link.type.replace(/_/g, ' ')} link between ${link.fromLabel || link.fromId} and ${link.toLabel || link.toId}`,
        origin: 'user',
        importance: link.type === 'contradicts' ? 'high' : 'medium',
        relatedEntityIds: {
          conceptIds: [link.fromType === 'concept' ? link.fromId : '', link.toType === 'concept' ? link.toId : ''].filter(Boolean),
          inquiryIds: [link.fromType === 'inquiry' ? link.fromId : '', link.toType === 'inquiry' ? link.toId : ''].filter(Boolean),
          positionIds: [link.fromType === 'position' ? link.fromId : '', link.toType === 'position' ? link.toId : ''].filter(Boolean),
          linkIds: [link.id],
        },
        metadata: { method: 'philosophical_link_update', relationshipType: link.type, sourceId: link.fromId, targetId: link.toId },
        sourceActionId: makeActionId(),
      },
    }, { operation: 'update', data: nextLink });
  };

  const deletePhilosophicalLink = (id: string, options?: { method?: string }) => {
    const existing = links.find((item) => item.id === id);
    const linkRef = doc(refs.links, id);
    return commitAndReport({
      db,
      ref: linkRef as any,
      operation: 'delete',
      thinkingEvent: existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'link_removed',
        entityType: 'link',
        entityId: existing.id,
        before: existing,
        summary: `Removed link between ${existing.fromLabel || existing.fromId} and ${existing.toLabel || existing.toId}`,
        origin: 'user',
        importance: existing.type === 'contradicts' ? 'high' : 'medium',
        relatedEntityIds: {
          conceptIds: [existing.fromType === 'concept' ? existing.fromId : '', existing.toType === 'concept' ? existing.toId : ''].filter(Boolean),
          inquiryIds: [existing.fromType === 'inquiry' ? existing.fromId : '', existing.toType === 'inquiry' ? existing.toId : ''].filter(Boolean),
          positionIds: [existing.fromType === 'position' ? existing.fromId : '', existing.toType === 'position' ? existing.toId : ''].filter(Boolean),
          linkIds: [existing.id],
        },
        metadata: {
          method: options?.method || 'atlas_long_hold',
          relationshipType: existing.type,
          sourceId: existing.fromId,
          targetId: existing.toId,
        },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true });
  };

  const addAtlasMap = async (data: Partial<AtlasMap>) => {
    const mapRef = doc(refs.atlasMaps);
    const nodeNames = data.nodeNames || [];
    const manualLinks = data.manualLinks || [];
    const resolvedNodeIds = nodeNames.map((name) => concepts.find((concept) => conceptKey(concept.name) === conceptKey(name))?.id || conceptKey(name));
    const payload = {
      id: mapRef.id,
      title: data.title || 'Untitled Map',
      mode: data.mode || 'custom',
      description: data.description || '',
      nodeNames,
      nodeIds: data.nodeIds || resolvedNodeIds,
      nodePositions: data.nodePositions || {},
      manualLinks,
      nodeColors: data.nodeColors || {},
      linkColors: data.linkColors || {},
      linkIds: data.linkIds || manualLinks.map((link) => link.id),
      autoLinkFilters: data.autoLinkFilters || {
        sharedSources: true,
        sharedPositions: true,
        sharedInquiries: true,
        sharedWorks: true,
        sharedPractices: true,
        conceptLinks: true,
      },
      style: data.style || {
        lineMode: 'relationshipCategoryColor',
        customLineColor: '#7c3aed',
        background: {
          type: 'preset',
          preset: 'dark',
          opacity: 0.4,
          blur: 0,
        },
        fontFamily: 'system',
        nodeStyle: 'default',
        showWeakLinks: false,
      },
      dateCreated: today(),
      dateUpdated: today(),
    };
    await commitAndReport({
      db,
      ref: mapRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'created',
        entityType: 'atlasMap',
        entityId: payload.id,
        after: payload,
        summary: `Created Atlas map: ${payload.title}`,
        origin: 'user',
        importance: 'medium',
        relatedEntityIds: { conceptIds: payload.nodeIds || [], linkIds: payload.linkIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'create', data: payload, rethrow: true });
    return mapRef.id;
  };

  const updateAtlasMap = (map: AtlasMap, rethrow = false) => {
    const mapRef = doc(refs.atlasMaps, map.id);
    const previous = atlasMaps.find((item) => item.id === map.id);
    if (isOfflineReviewPreview && readDemoSession(effectiveUid).atlasMaps.find((item) => item.id === map.id)?.dateUpdated !== map.dateUpdated) {
      const error = new WorkspaceRecordChangedError();
      if (rethrow) return Promise.reject(error);
      toast({ title: 'Map changed', description: 'Review the latest map and try again.', variant: 'destructive' });
      return;
    }
    const nextMap = { ...map, dateUpdated: today() };
    return commitAndReport({
      db,
      ref: mapRef as any,
      operation: 'update',
      data: nextMap,
      requireUnchanged: { ref: mapRef, field: 'dateUpdated', value: map.dateUpdated },
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'edited',
        entityType: 'atlasMap',
        entityId: map.id,
        before: previous || null,
        after: nextMap,
        summary: `Updated Atlas map: ${map.title}`,
        origin: 'user',
        importance: 'low',
        relatedEntityIds: { conceptIds: map.nodeIds || [], linkIds: map.linkIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'update', data: nextMap, rethrow });
  };

  const moveAtlasMapNode = async (id: string, key: string, position: AtlasNodePosition) => {
    const ref = doc(refs.atlasMaps, id);
    const updatedAt = today();
    if (isOfflineReviewPreview) {
      const map = readDemoSession(effectiveUid).atlasMaps.find((item) => item.id === id);
      commitDemoChanges(effectiveUid, [{ path: ref.path, operation: 'update', data: atlasNodePositionPatch(map, key, position, updatedAt) }]);
      return;
    }
    await writeAtlasNodePosition(ref, key, position, updatedAt);
  };

  const deleteAtlasMap = (id: string) => {
    const existing = atlasMaps.find((item) => item.id === id);
    const mapRef = doc(refs.atlasMaps, id);
    return commitAndReport({
      db,
      ref: mapRef as any,
      operation: 'delete',
      thinkingEvent: metacognitionEnabled && existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'abandoned',
        entityType: 'atlasMap',
        entityId: id,
        before: existing,
        summary: `Deleted Atlas map: ${existing.title}`,
        origin: 'user',
        importance: 'low',
        relatedEntityIds: { conceptIds: existing.nodeIds || [], linkIds: existing.linkIds || [] },
        sourceActionId: makeActionId(),
      } : null,
    }, { operation: 'delete', data: existing || { id }, rethrow: true });
  };

  const changeGoalSettings = async (change: (current: GoalSettings) => GoalSettings) => {
    let saved: GoalSettings;
    if (isOfflineReviewPreview) {
      const current = readDemoSession(effectiveUid).goal;
      saved = change(current);
      if (saved !== current) await saveWorkspaceDoc(refs.settingsGoal, saved);
    } else {
      saved = await writeGoalSettings(refs.settingsGoal, DEFAULT_GOAL_SETTINGS, change);
    }
    setGoalState(saved);
    return saved;
  };

  const saveGoal: SaveGoalPlan = (nextGoal, baseline) => changeGoalSettings((current) => applyGoalPlan(nextGoal, baseline, current));
  const saveGoalCheckIn: SaveGoalCheckIn = (goalId, checkIn) =>
    changeGoalSettings((current) => applyGoalCheckIn(current, goalId, checkIn));

  const saveProfile = async (patch: Partial<UserProfile>, approval?: ProfileReviewApproval) => {
    const dateUpdated = today();
    if (approval) {
      const event: WriteThinkingEventInput = {
        collection: refs.thinkingEvents, userId: effectiveUid, entityType: 'profile', entityId: 'main',
        eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance: philosophy synthesis',
      };
      const { assertProfileReviewBaseline, prepareProfileReview, profileReviewEvent, writeProfileReview } = await import('@/lib/profile-edit');
      if (!isOfflineReviewPreview) return writeProfileReview(refs.profileMain, approval, dateUpdated, event);
      const prepared = await prepareProfileReview(effectiveUid, approval.baseline, approval.result, approval.text, dateUpdated, dateUpdated);
      const { record } = prepared;
      const demo = readDemoSession(effectiveUid);
      const existing = demo.aiProvenance?.find((entry) => entry.id === record.id);
      if (existing) {
        if (existing.acceptedTextHash === record.acceptedTextHash) return;
        throw new Error('This review was already saved with different content.');
      }
      assertProfileReviewBaseline(demo.profile, approval.baseline, Boolean(prepared.patch.philosophyStatement));
      return commitAndReport({
        db, ref: refs.profileMain, operation: 'set', data: prepared.patch, setOptions: { merge: true },
        relatedWrites: [{ ref: doc(refs.user, 'aiProvenance', record.id), operation: 'create', data: record }],
        thinkingEvent: profileReviewEvent(event, record),
      }, { rethrow: true }).then(() => undefined);
    }
    const payload = {
      ...patch,
      dateUpdated,
    };
    const mirror = {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    };
    await saveWorkspaceDoc(refs.profileMain, payload, 'set', { merge: true }, Object.keys(mirror).length ? [{
      ref: refs.user, data: { ...mirror, updatedAt: dateUpdated },
    }] : [], patch.aiReviewHistory ? acceptedAiEvents('profile', 'main', profile.aiReviewHistory, patch.aiReviewHistory) : []);
  };

  const saveProfilePrivacy = async (nextPrivacy: ProfilePrivacySettings, snapshot: PublicProfileSnapshot, expectedVersion: { dateUpdated?: string }) => {
    const payload = { ...nextPrivacy, dateUpdated: today() };
    if (!user || isReviewWorkspace) {
      await saveWorkspaceDoc(refs.profilePrivacy, payload, 'set', { merge: true });
      return payload;
    }
    await publishProfileSelection({
      privacyRef: refs.profilePrivacy, settingsRef: refs.settingsPrivacy, ownerId: user.uid,
      privacy: payload, snapshot, updatedAt: payload.dateUpdated, expectedVersion,
    });
    return payload;
  };

  const saveSettingsSection = async (section: 'account' | 'appearance' | 'workspace' | 'ai' | 'metacognition' | 'privacy' | 'data' | 'sourceIntake' | 'works' | 'atlas' | 'notifications' | 'goals' | 'developer', value: any) => {
    const stamped = { ...value, dateUpdated: today() };
    switch (section) {
      case 'account':
        await saveWorkspaceDoc(refs.settingsAccount as any, stamped);
        break;
      case 'appearance': {
        const writes = appearanceSettingsWrites(value, stamped.dateUpdated);
        await saveWorkspaceDoc(refs.settingsAppearance, writes.appearance, 'set', { merge: true },
          writes.preferences ? [{ ref: refs.settingsPreferences, data: writes.preferences }] : []);
        if (isOfflineReviewPreview) {
          setDemoAppearanceOverride((previous) => ({ ...previous, ...writes.appearance }));
        }
        break;
      }
      case 'workspace':
        await saveWorkspaceDoc(refs.settingsWorkspace as any, stamped);
        break;
      case 'ai':
        await saveWorkspaceDoc(refs.settingsAi as any, stamped);
        break;
      case 'metacognition': {
        const featureFlags = metacognitionFeatureFlagPatch(value);
        await saveWorkspaceDoc(refs.settingsMetacognition, stamped, 'set', { merge: true },
          Object.keys(featureFlags).length ? [{ ref: refs.settingsWorkspace, data: { featureFlags, dateUpdated: stamped.dateUpdated } }] : []);
        break;
      }
      case 'privacy':
        await saveWorkspaceDoc(refs.settingsPrivacy as any, stamped);
        break;
      case 'data':
        await saveWorkspaceDoc(refs.settingsData as any, stamped);
        break;
      case 'sourceIntake':
        await saveWorkspaceDoc(refs.settingsSourceIntake as any, stamped);
        break;
      case 'works': {
        const writingDefaults = workDefaultPreferencePatch(value);
        await saveWorkspaceDoc(refs.settingsWorks, stamped, 'set', { merge: true },
          Object.keys(writingDefaults).length ? [{ ref: refs.settingsPreferences, data: { writingDefaults, dateUpdated: stamped.dateUpdated } }] : []);
        break;
      }
      case 'atlas':
        await saveWorkspaceDoc(refs.settingsAtlas as any, stamped);
        break;
      case 'notifications':
        await saveWorkspaceDoc(refs.settingsNotifications as any, stamped);
        break;
      case 'goals':
        await saveWorkspaceDoc(refs.settingsGoals as any, stamped);
        break;
      case 'developer':
        await saveWorkspaceDoc(refs.settingsDeveloper as any, stamped);
        break;
    }
  };

  const goalProgress = MEDIA_TYPES.reduce((acc, type) => {
    acc[type] = media.filter((item) => item.type === type && item.status === 'Finished').length;
    return acc;
  }, {} as Record<MediaType, number>);

  const thinkingMetrics = { ...DEFAULT_THINKING_METRICS, ...(thinkingMetricsDoc || {}), lastComputedAt: thinkingMetricsDoc?.lastComputedAt || today() };

  const movement: MovementMetrics = deriveWorkspaceAttention({ annotations: allAnnotations(media), positions: vault, inquiries: questions, practices }).metrics;

  const missingFocusedTarget = useMemo(() => {
    if (reviewDataLoading) return null;
    if (routeTarget && Object.values(loading.requirements).some(Boolean)) return null;
    if (!routeTarget) return null;
    if (routeTarget.type === 'concept' && !concepts.some((item) => item.id === routeTarget.id)) return routeTarget;
    if (routeTarget.type === 'inquiry' && !questions.some((item) => item.id === routeTarget.id)) return routeTarget;
    if (routeTarget.type === 'source' && !media.some((item) => item.id === routeTarget.id)) return routeTarget;
    if (routeTarget.type === 'annotation' && !media.some((item) => item.id === routeTarget.annotationSourceId
      && item.annotations?.some((annotation) => annotation.id === routeTarget.id))) return routeTarget;
    if (routeTarget.type === 'position' && !vault.some((item) => item.id === routeTarget.id)) return routeTarget;
    if (routeTarget.type === 'work' && !drafts.some((item) => item.id === routeTarget.id)) return routeTarget;
    if (routeTarget.type === 'practice' && !practices.some((item) => item.id === routeTarget.id)) return routeTarget;
    return null;
  }, [concepts, drafts, loading.requirements, media, practices, questions, reviewDataLoading, routeTarget, vault]);

  const renderRouteContent = () => {
    if (reviewDataLoading && slowPageLoad) {
      return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <PageErrorState
            title="Still waiting for workspace data"
            description="Noesis hasn't received the records this page needs. Check your connection, retry, or open another page."
            onRetry={retryWorkspaceReads}
            retryLabel="Retry"
          />
        </div>
      );
    }
    if (reviewDataLoading) {
      if (lastReadyRouteContentRef.current) {
        return (
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div className="pointer-events-none flex min-h-0 flex-1 select-none opacity-75" inert>
              {lastReadyRouteContentRef.current}
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 overflow-hidden bg-accent/15"
              role="progressbar"
              aria-label={`Loading ${NOESIS_PAGE_BY_VIEW[activeView].title}`}
            >
              <div className="h-full w-full animate-pulse bg-accent" />
            </div>
          </div>
        );
      }
      return (
        <NoesisPageLoading
          activeView={activeView}
          routeTarget={routeTarget}
          activeRequirements={loading.activePageRequirements}
          requirementLoading={loading.requirements}
        />
      );
    }

    if (loading.pageError) {
      const failedArea = NOESIS_DATA_REQUIREMENT_LABELS[loading.pageError.key] || 'workspace data';
      return (
        <div className="flex-1 overflow-y-auto p-8">
          <PageErrorState
            title={`Could not load ${failedArea}`}
            description={`Noesis could not read this account's ${failedArea.toLowerCase()}. No demo or cached records were substituted.`}
            savedState="Nothing was changed. The current account remains selected and no fallback workspace was opened."
            nextStep="Retry the request. If it fails again, verify the connection and this account's Firestore permissions."
            onRetry={retryWorkspaceReads}
            retryLabel="Retry"
          />
        </div>
      );
    }

    if (missingFocusedTarget) {
      return (
        <MissingFocusedTargetState
          target={missingFocusedTarget}
          onReturn={() => navigateToView(missingFocusedTarget.view)}
          onRetry={retryWorkspaceReads}
        />
      );
    }

    const routeContent = (
      <NoesisRouteContent
        activeView={activeView}
        user={user}
        effectiveUid={effectiveUid}
        isReviewWorkspace={isReviewWorkspace}
        isOfflineReviewPreview={isOfflineReviewPreview}
        media={media}
        concepts={concepts}
        insights={insights}
        questions={questions}
        vault={vault}
        drafts={drafts}
        practices={practices}
        timeline={timeline}
        atlasMaps={atlasMaps}
        links={links}
        thinkingEvents={thinkingEvents}
        thinkingEventsHasMore={thinkingEventsHasMore}
        loadMoreThinkingEvents={loadMoreThinkingEvents}
        historyLoadingOlder={historyLoadingOlder}
        historyOlderError={historyOlderError}
        beliefProfiles={beliefProfiles}
        unknowns={unknowns}
        thinkingPatterns={thinkingPatterns}
        thinkingMetrics={thinkingMetrics}
        profile={profile}
        profilePrivacy={profilePrivacy}
        profileMetacognitionSummary={profileMetacognitionSummary}
        preferences={preferences}
        workspace={workspace}
        accountSettings={accountSettings}
        appearanceSettings={appearanceSettings}
        workspacePreferences={workspacePreferences}
        aiSettings={aiSettings}
        metacognitionSettings={metacognitionSettings}
        privacySettings={privacySettings}
        dataSettings={dataSettings}
        sourceIntakeSettings={sourceIntakeSettings}
        worksSettings={worksSettings}
        atlasSettings={atlasSettings}
        notificationSettings={notificationSettings}
        goalPreferenceSettings={goalPreferenceSettings}
        developerSettings={developerSettings}
        goalState={goalState}
        goalProgress={goalProgress}
        focusedConceptId={focusedConceptId}
        focusedSourceId={focusedSourceId}
        focusedPositionId={focusedPositionId}
        focusedQuestionId={focusedQuestionId}
        focusedWorkId={focusedWorkId}
        focusedPracticeId={focusedPracticeId}
        focusedGoalId={focusedIdForNoesisView(routeState, 'goals')}
        focusedAnnotationSourceId={focusedAnnotationSourceId}
        focusedAnnotationId={focusedAnnotationId}
        refreshingDemoWorkspace={isSeedingReview}
        navigateToView={navigateToView}
        addQuestion={addQuestion}
        updateQuestion={updateQuestion}
        deleteQuestion={deleteQuestion}
        formPositionFromInquiry={formPositionFromInquiry}
        addConcept={addConcept}
        updateConcept={updateConcept}
        deleteConcept={deleteConcept}
        addMedia={addMedia}
        updateMedia={updateMedia}
        deleteMedia={deleteMedia}
        updateAnnotation={updateAnnotation}
        deleteAnnotation={deleteAnnotation}
        createIdea={createIdea}
        addPhilosophicalLink={addPhilosophicalLink}
        addAtlasQuickLink={addAtlasQuickLink}
        updatePhilosophicalLink={updatePhilosophicalLink}
        deletePhilosophicalLink={deletePhilosophicalLink}
        markPhilosophicalLinkInteraction={markPhilosophicalLinkInteraction}
        addAtlasMap={addAtlasMap}
        updateAtlasMap={updateAtlasMap}
        moveAtlasMapNode={moveAtlasMapNode}
        deleteAtlasMap={deleteAtlasMap}
        addVaultEntry={addVaultEntry}
        updateVaultEntry={updateVaultEntry}
        deleteVaultEntry={deleteVaultEntry}
        addDraft={addDraft}
        linkInquiryItem={linkInquiryItem}
        saveInquiryAiReview={saveInquiryAiReview}
        updateDraft={updateDraft}
        markDraftOpened={markDraftOpened}
        deleteDraft={deleteDraft}
        addPractice={addPractice}
        updatePractice={updatePractice}
        deletePractice={deletePractice}
        addUnknown={addUnknown}
        updateUnknown={updateUnknown}
        updateThinkingPattern={updateThinkingPattern}
        addTimelineEvent={addTimelineEvent}
        saveGoal={saveGoal}
        saveGoalCheckIn={saveGoalCheckIn}
        saveProfile={saveProfile}
        saveProfilePrivacy={saveProfilePrivacy}
        saveSettingsSection={saveSettingsSection}
        exportWorkspaceData={exportWorkspaceData}
        settingsDraftCache={settingsDraftCache}
        seedReviewWorkspace={seedReviewWorkspace}
        restoreDeletedItem={restoreDeletedItem}
        recentDeletedItems={recentDeletedItems}
        recentDeletedLoading={recentDeletedLoading}
        recentDeletedError={recentDeletedError}
        onRecoveryPanelChange={setRecoveryRequested}
        onRetryDeletedItems={retryDeletedItems}
      />
    );
    lastReadyRouteContentRef.current = routeContent;
    return routeContent;

  };

  return (
    <NoesisShell
      activeView={activeView}
      pendingPath={pendingPath}
      onViewChange={(nextView) => navigateToView(nextView as NoesisView)}
      onOpenProfile={() => navigateToView('profile')}
      counts={resolvedWorkspaceCounts}
      movement={movement}
      profile={profile}
      workspaceMode={workspace.workspaceMode}
      isReviewWorkspace={isReviewWorkspace}
      effectiveUid={effectiveUid}
      canSeedReviewWorkspace={canSeedReviewWorkspace}
      isSeedingReview={isSeedingReview}
      seedReviewWorkspace={seedReviewWorkspace}
      exportReviewArchitecture={exportReviewArchitecture}
      linkCount={links.length}
      loadWorkspaceCommandItems={loadWorkspaceCommandItems}
      onOpenCommandItem={(item) => {
        if (item.targetType && item.targetId) {
          navigateToView(item.view as NoesisView, viewOptionsForNoesisRouteTarget({
            type: item.targetType,
            id: item.targetId,
            view: item.view as NoesisView,
            annotationSourceId: item.annotationSourceId,
          }));
          return;
        }
        navigateToView(item.view as NoesisView, {
          conceptId: item.view === 'concepts' ? item.targetId : null,
          questionId: item.view === 'questions' ? item.targetId : null,
          sourceId: item.view === 'library' ? item.targetId : null,
          positionId: item.view === 'vault' ? item.targetId : null,
          workId: item.view === 'writing' ? item.targetId : null,
          practiceId: item.view === 'labs' ? item.targetId : null,
        });
      }}
    >
      {syncIssue && !isOfflineReviewPreview && (
        <SyncIssueBanner
          issue={syncIssue}
          onDismiss={() => setSyncIssue(null)}
        />
      )}
      <div
        className="contents"
        data-noesis-ready-path={!reviewDataLoading || slowPageLoad ? workspaceScrollRoute(pathname).path : undefined}
      >
        {renderRouteContent()}
      </div>
      </NoesisShell>
  );
}

function SyncIssueBanner({ issue, onDismiss }: { issue: FirestorePermissionError; onDismiss: () => void }) {
  const operationLabel = issue.context.operation === 'write' ? 'save' : issue.context.operation;
  const affectedArea = readableWorkspaceArea(issue.context.path);
  return (
    <div role="alert" className="border-b border-destructive/25 bg-destructive/10 px-6 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-code text-[10px] uppercase tracking-[0.18em] text-destructive">Sync needs attention</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Noesis could not {operationLabel} this change. Your current screen is still usable, but this specific update may not be stored until permissions or connection are fixed.
          </p>
          <p className="mt-1 font-code text-[10px] text-muted-foreground">
            Affected area: {affectedArea}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onDismiss} className="rounded-full bg-card">
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function readableWorkspaceArea(path: string) {
  const parts = path.split('/').filter(Boolean);
  const userIndex = parts.indexOf('users');
  const collection = userIndex >= 0 ? parts[userIndex + 2] : parts[0];
  const labels: Record<string, string> = {
    media: 'Library sources',
    concepts: 'Concepts',
    questions: 'Inquiries',
    vault: 'Positions',
    drafts: 'Works',
    practices: 'Practices',
    links: 'Atlas links',
    atlasMaps: 'Atlas maps',
    thinkingEvents: 'Evolution history',
    unknowns: 'Unknowns',
    thinkingPatterns: 'Thinking profile',
    settings: 'Settings',
    profile: 'Profile',
  };
  return labels[collection || ''] || 'workspace data';
}

function MissingFocusedTargetState({
  target,
  onReturn,
  onRetry,
}: {
  target: NoesisRouteTarget;
  onReturn: () => void;
  onRetry: () => void;
}) {
  const targetLabel = labelForNoesisRouteTarget(target.type);
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8" data-noesis-scroll-region>
      <PageErrorState
        title={`${targetLabel.singular.charAt(0).toUpperCase()}${targetLabel.singular.slice(1)} unavailable`}
        description="This item may have been deleted or belong to a different workspace."
        nextStep={`Retry if it was just saved or restored, or return to ${targetLabel.owner}.`}
        onRetry={onRetry}
        retryLabel="Retry"
        alternateAction={(
          <Button variant="outline" size="sm" onClick={onReturn} className="rounded-full bg-card">
            Return to {targetLabel.owner}
          </Button>
        )}
      />
    </div>
  );
}

function NoesisPageLoading({
  activeView,
  routeTarget,
  activeRequirements,
  requirementLoading,
}: {
  activeView: NoesisView;
  routeTarget?: NoesisRouteTarget | null;
  activeRequirements?: NoesisWorkspaceDataKey[];
  requirementLoading?: Partial<Record<NoesisWorkspaceDataKey, boolean>>;
}) {
  const page = NOESIS_PAGE_BY_VIEW[activeView];
  const targetLabel = routeTarget ? labelForNoesisRouteTarget(routeTarget.type) : null;
  const detailDescription = routeTarget
    ? `Opening this ${targetLabel?.singular || routeTarget.type} from ${targetLabel?.owner || page.title} and syncing only the related workspace data it needs.`
    : page.purpose;
  const pendingRequirements = (activeRequirements || [])
    .filter((key) => requirementLoading?.[key])
    .map((key) => NOESIS_DATA_REQUIREMENT_LABELS[key]);
  const loadingDetails = pendingRequirements.length
    ? pendingRequirements
    : routeTarget
      ? [`${targetLabel?.owner || page.title} detail`, 'Linked context']
      : ['Workspace summary'];
  return (
    <PageLoadingState
      title={`Loading ${routeTarget ? `${page.title} Detail` : page.title}`}
      description={detailDescription}
      loadingLayout={routeTarget ? 'detail' : page.loadingLayout}
      loadingDetails={loadingDetails}
    />
  );
}
