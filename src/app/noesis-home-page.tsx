
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import {
  useFirebase,
} from '@/firebase';
import type { MovementMetrics } from '@/components/Shell';
import { NoesisProviders } from '@/components/app-shell/NoesisProviders';
import { NoesisShell } from '@/components/app-shell/NoesisShell';
import { NoesisWorkspaceGate } from '@/components/app-shell/NoesisWorkspaceGate';
import { ConceptAtlas } from '@/components/Atlas/ConceptAtlas';
import { ConceptEncyclopedia } from '@/components/Concepts/ConceptEncyclopedia';
import { MediaLibrary } from '@/components/Library/MediaLibrary';
import { SourceIndex } from '@/components/Library/SourceIndex';
import { AnnotationsIndex } from '@/components/Library/AnnotationsIndex';
import { BeliefVault } from '@/components/Vault/BeliefVault';
import { Atelier } from '@/components/Writing/Atelier';
import { QuestionsWorkspace } from '@/components/Questions/QuestionsWorkspace';
import { EvolutionTimeline } from '@/components/Evolution/EvolutionTimeline';
import { PracticesWorkspace } from '@/components/Practices/PracticesWorkspace';
import { ProfilePage } from '@/components/Profile/ProfilePage';
import { SettingsPage } from '@/components/Settings/SettingsPage';
import { GoalsPage } from '@/components/Goals/GoalsPage';
import { ThinkingDesk } from '@/components/Home/ThinkingDesk';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNoesisWorkspaceData } from '@/hooks/use-noesis-workspace-data';
import { PageLoadingState } from '@/components/shared/PageState';
import { MEDIA_TYPES, allAnnotations, conceptKey, ensureConceptTerms, normalizeConceptTags, today, uid as makeActionId, workCategoryForDraft } from '@/lib/readex';
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
import { buildDemoWorkspace, buildReviewExport, REVIEW_ACCOUNT_EMAIL, REVIEW_FEATURE_FLAGS, REVIEW_WORKSPACE_UID } from '@/lib/demo-workspace';
import type {
  AccountSettings,
  AiSuggestion,
  AiSettings,
  Annotation,
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
} from '@/lib/types';
import { doc, getDoc, setDoc, updateDoc, writeBatch, deleteDoc, type DocumentData, type DocumentReference } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { classifyThinkingChange } from '@/lib/thinkingEvents/classifyThinkingChange';
import { writeThinkingEvent, type WriteThinkingEventInput } from '@/lib/thinkingEvents/writeThinkingEvent';
import { parseNoesisRoute, viewToPath, type NoesisView } from '@/lib/noesis-routes';
import { commitWorkspaceMutation } from '@/lib/workspace-mutations';
import { NOESIS_PAGE_BY_VIEW } from '@/lib/noesis-page-definitions';

function ReadexWorkspace({
  user,
  uid,
  reviewMode = false,
  reviewWorkspaceUid,
}: {
  user: User | null;
  uid: string;
  reviewMode?: boolean;
  reviewWorkspaceUid?: string;
}) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [goalState, setGoalState] = useState<GoalSettings>(DEFAULT_GOAL_SETTINGS);
  const effectiveUid = uid;
  const isOfflineReviewPreview = reviewMode && !user;
  const routeState = useMemo(() => parseNoesisRoute(pathname), [pathname]);
  const activeView = routeState.view;
  const focusedSourceId = routeState.focusedSourceId || null;
  const focusedPositionId = routeState.focusedPositionId || null;
  const focusedQuestionId = routeState.focusedQuestionId || null;

  const navigateToView = (view: NoesisView, options?: {
    conceptId?: string | null;
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
  }) => {
    router.push(viewToPath(view, {
      reviewMode,
      conceptId: options?.conceptId,
      questionId: options?.questionId,
      sourceId: options?.sourceId,
      positionId: options?.positionId,
      workId: options?.workId,
      practiceId: options?.practiceId,
    }));
  };

  const {
    refs,
    media,
    vault,
    insights,
    concepts,
    questions,
    timeline,
    drafts,
    practices,
    atlasMaps,
    links,
    suggestions,
    thinkingEvents,
    beliefProfiles,
    unknowns,
    thinkingPatterns,
    thinkingMetricsDoc,
    goalDoc,
    legacyPreferencesDoc,
    legacyProfileDoc,
    workspaceDoc,
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
    db,
    uid: effectiveUid,
    activeView,
    isOfflineReviewPreview,
  });
  
  const goal = { ...DEFAULT_GOAL_SETTINGS, ...(goalDoc || {}) };
  const appearanceSettings: AppearanceSettings = {
    ...DEFAULT_APPEARANCE_SETTINGS,
    themeMode: legacyPreferencesDoc?.themeMode || DEFAULT_APPEARANCE_SETTINGS.themeMode,
    accentTheme: legacyPreferencesDoc?.accentTheme || DEFAULT_APPEARANCE_SETTINGS.accentTheme,
    ...(settingsAppearanceDoc || {}),
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
    displayName: profileMainDoc?.displayName || legacyProfileDoc?.displayName || user?.displayName || '',
    email: profileMainDoc?.email || legacyProfileDoc?.email || user?.email || '',
    photoURL: profileMainDoc?.photoURL || legacyProfileDoc?.photoURL || user?.photoURL || '',
    avatarUrl: profileMainDoc?.avatarUrl || legacyProfileDoc?.avatarUrl || user?.photoURL || '',
    role: profileMainDoc?.role || legacyProfileDoc?.role || DEFAULT_USER_PROFILE.role,
  };
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
  const aiSettings: AiSettings = {
    ...DEFAULT_AI_SETTINGS,
    ...(settingsAiDoc || {}),
  };
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
      aiSuggestions: aiSettings.enableAiSuggestions,
      metacognitionEnabled: metacognitionSettings.enableMetacognitionFeatures,
      beliefBiographiesEnabled: metacognitionSettings.enableBeliefBiographies,
      unknownsEnabled: metacognitionSettings.enableUnknownsTracking,
      thinkingPatternsEnabled: metacognitionSettings.enableThinkingPatternDetection,
      missingPerspectivesEnabled: metacognitionSettings.enableMissingPerspectivesDetection,
      thinkingMetricsEnabled: metacognitionSettings.enableCognitionMetrics,
    },
  };
  const featureFlags = workspace.featureFlags || {};
  const isReviewIdentity = (user?.email || profile.email || '').toLowerCase() === REVIEW_ACCOUNT_EMAIL.toLowerCase();
  const activeReviewWorkspaceUid = reviewWorkspaceUid || REVIEW_WORKSPACE_UID;
  const isReviewWorkspace = Boolean(reviewMode || isReviewIdentity || workspace.workspaceMode === 'review' || workspace.demoWorkspace);
  const canSeedReviewWorkspace = Boolean(
    isReviewIdentity ||
    (user?.uid && effectiveUid === user.uid) ||
    effectiveUid === activeReviewWorkspaceUid
  );
  const [isSeedingReview, setIsSeedingReview] = useState(false);
  const autoSeedAttemptedRef = useRef(false);
  const reviewDataLoading =
    loading.media ||
    loading.vault ||
    loading.insights ||
    loading.concepts ||
    loading.questions ||
    loading.timeline ||
    loading.drafts ||
    loading.practices ||
    loading.atlasMaps ||
    loading.links ||
    loading.suggestions ||
    loading.thinkingEvents ||
    loading.beliefProfiles ||
    loading.unknowns ||
    loading.thinkingPatterns ||
    loading.thinkingMetrics ||
    loading.goal ||
    loading.preferences ||
    loading.legacyProfile ||
    loading.profileMain ||
    loading.profilePrivacy ||
    loading.profileSummary ||
    loading.workspace ||
    loading.settingsAccount ||
    loading.settingsAppearance ||
    loading.settingsWorkspacePrefs ||
    loading.settingsAi ||
    loading.settingsMetacognition ||
    loading.settingsPrivacy ||
    loading.settingsData ||
    loading.settingsSourceIntake ||
    loading.settingsWorks ||
    loading.settingsAtlas ||
    loading.settingsNotifications ||
    loading.settingsGoals ||
    loading.settingsDeveloper;

  useEffect(() => {
    setGoalState(goal);
  }, [goalDoc]);

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
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const systemDark = mediaQuery.matches;
      const dark = preferences.themeMode === 'dark' || (preferences.themeMode === 'system' && systemDark);
      root.classList.toggle('dark', dark);
      root.dataset.theme = preferences.accentTheme;
      window.localStorage.setItem('noesis:theme', JSON.stringify({
        themeMode: preferences.themeMode,
        accentTheme: preferences.accentTheme,
      }));
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [preferences.themeMode, preferences.accentTheme]);

  const totalObjects = media.length + concepts.length + questions.length + vault.length + drafts.length + practices.length + timeline.length + insights.length + links.length + suggestions.length + atlasMaps.length + thinkingEvents.length + beliefProfiles.length + unknowns.length + thinkingPatterns.length;

  const seedReviewWorkspace = async ({ force = false, preserveUserCreated = true, announce = false }: { force?: boolean; preserveUserCreated?: boolean; announce?: boolean } = {}) => {
    setIsSeedingReview(true);
    try {
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
      deleteStaleDemoDocs(suggestions, new Set(demo.suggestions.map((item) => item.id)), (item) => item.id, (id) => doc(refs.suggestions, id));
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
      batch.set(refs.settingsAi, demo.settingsAi, { merge: true });
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
          questions: demo.questions.length,
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
      demo.suggestions.forEach((item) => batch.set(doc(refs.suggestions, item.id), item));
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
    if (!isReviewWorkspace || !canSeedReviewWorkspace || isSeedingReview || reviewDataLoading) return;
    if (autoSeedAttemptedRef.current) return;
    if (workspace.seedSource === 'system-demo' && totalObjects > 0) return;
    if (totalObjects > 0 && workspace.demoWorkspace) return;
    if (totalObjects === 0) {
      autoSeedAttemptedRef.current = true;
      seedReviewWorkspace().catch((error) => console.warn('Review seed failed', error));
    }
  }, [canSeedReviewWorkspace, isOfflineReviewPreview, isReviewWorkspace, isSeedingReview, reviewDataLoading, totalObjects, workspace.demoWorkspace, workspace.seedSource]);

  const metacognitionEnabled = Boolean(featureFlags.metacognitionEnabled);

  useEffect(() => {
    refreshThinkingMetrics();
  }, [metacognitionEnabled, featureFlags.thinkingMetricsEnabled, questions.length, vault.length, links.length, media, insights.length, unknowns, thinkingEvents]);

  const exportReviewArchitecture = () => {
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
        inquiries: questions.length,
        positions: vault.length,
        works: drafts.length,
        practices: practices.length,
        evolutionEvents: timeline.length,
        aiSuggestions: suggestions.length,
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

  const exportWorkspaceData = () => {
    const payload = {
      exportedAt: today(),
      user: {
        uid: effectiveUid,
        profile,
        profilePrivacy,
        profileMetacognitionSummary,
      },
      settings: {
        account: accountSettings,
        appearance: appearanceSettings,
        workspace: workspacePreferences,
        ai: aiSettings,
        metacognition: metacognitionSettings,
        privacy: privacySettings,
        data: dataSettings,
        sourceIntake: sourceIntakeSettings,
        works: worksSettings,
        atlas: atlasSettings,
        notifications: notificationSettings,
        goals: goalPreferenceSettings,
        developer: developerSettings,
      },
      collections: {
        media,
        concepts,
        questions,
        vault,
        drafts,
        practices,
        timeline,
        links,
        suggestions,
        atlasMaps,
        thinkingEvents,
        beliefProfiles,
        unknowns,
        thinkingPatterns,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `noesis-workspace-${effectiveUid}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const emitError = (path: string, operation: SecurityRuleContext['operation'], data?: any) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path,
      operation,
      requestResourceData: data,
    }));
  };

  const normalizeThinkingEventType = (
    eventType: NonNullable<ThinkingEvent['eventType']>,
    entityType?: WriteThinkingEventInput['entityType']
  ): NonNullable<ThinkingEvent['eventType']> => {
    if (entityType === 'position') {
      if (eventType === 'created') return 'position_created';
      if (eventType === 'revised' || eventType === 'edited') return 'position_revised';
      if (eventType === 'abandoned') return 'position_abandoned';
      if (eventType === 'challenged') return 'challenge_added';
    }
    if (entityType === 'suggestion') {
      if (eventType === 'ai_suggestion_generated') return 'suggestion_created';
      if (eventType === 'ai_suggestion_accepted') return 'suggestion_accepted';
      if (eventType === 'ai_suggestion_rejected') return 'suggestion_dismissed';
    }
    if (entityType === 'link' && eventType === 'linked') return 'link_created';
    return eventType;
  };

  const createThinkingEvent = (event: Partial<ThinkingEvent> & { entityType?: WriteThinkingEventInput['entityType']; entityId?: string; relatedEntityIds?: WriteThinkingEventInput['relatedEntityIds']; before?: Record<string, any> | null; after?: Record<string, any> | null; origin?: WriteThinkingEventInput['origin']; importance?: WriteThinkingEventInput['importance']; confidenceBefore?: number | null; confidenceAfter?: number | null; epistemicStatus?: WriteThinkingEventInput['epistemicStatus']; sourceActionId?: string | null; idempotencyKey?: string | null; userReason?: string | null; aiReason?: string | null; systemReason?: string | null }) => {
    const entityType = event.entityType || (event.targetType === 'thinking_pattern' ? 'thinkingPattern' : event.targetType === 'unknown' ? 'unknown' : event.targetType === 'suggestion' ? 'suggestion' : event.targetType);
    const entityId = event.entityId || event.targetId;
    if (!metacognitionEnabled || !event.eventType || !entityType || !entityId) return;
    const normalizedEventType = normalizeThinkingEventType(event.eventType, entityType);
    writeThinkingEvent({
      collection: refs.thinkingEvents as any,
      userId: effectiveUid,
      eventType: normalizedEventType,
      entityType,
      entityId,
      relatedEntityIds: event.relatedEntityIds,
      before: event.before,
      after: event.after,
      summary: event.summary || '',
      userReason: event.userReason,
      aiReason: event.aiReason,
      systemReason: event.systemReason,
      origin: event.origin || event.sourceType || 'system',
      confidenceBefore: event.confidenceBefore,
      confidenceAfter: event.confidenceAfter,
      epistemicStatus: event.epistemicStatus,
      importance: event.importance,
      sourceActionId: event.sourceActionId,
      idempotencyKey: event.idempotencyKey,
      visibility: event.visibility,
      metadata: {
        ...(event.metadata || {}),
        legacyEventType: normalizedEventType !== event.eventType ? event.eventType : undefined,
        relatedTargetType: event.relatedTargetType,
        relatedTargetId: event.relatedTargetId,
      },
    }).catch(() => emitError(refs.thinkingEvents.path, 'create', event));
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
    setDoc(profileRef, payload, { merge: true }).catch(() => emitError(profileRef.path, 'create', payload));
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
    setDoc(unknownRef, payload).catch(() => emitError(unknownRef.path, 'create', payload));
    createThinkingEvent({ eventType: 'unknown_created', entityType: 'unknown', entityId: payload.unknownId, after: payload, origin: payload.createdFrom === 'manual' ? 'user' : payload.createdFrom, summary: `Unknown created: ${payload.title}`, importance: 'medium', sourceActionId: makeActionId() });
    return payload;
  };

  const updateUnknown = (item: Unknown) => {
    const unknownRef = doc(refs.unknowns, item.unknownId);
    updateDoc(unknownRef, { ...item, dateUpdated: today() } as any).catch(() => emitError(unknownRef.path, 'update', item));
    if (item.status === 'resolved') {
      createThinkingEvent({ eventType: 'unknown_resolved', entityType: 'unknown', entityId: item.unknownId, after: item, origin: 'user', summary: `Unknown resolved: ${item.title}`, importance: 'high', sourceActionId: makeActionId() });
    }
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
    setDoc(patternRef, payload).catch(() => emitError(patternRef.path, 'create', payload));
    createThinkingEvent({ eventType: 'thinking_pattern_inferred', entityType: 'thinkingPattern', entityId: payload.patternId, after: payload, origin: payload.createdFrom, summary: `Thinking pattern inferred: ${payload.label}`, importance: 'medium', sourceActionId: makeActionId() });
  };

  const updateThinkingPattern = (pattern: ThinkingPattern) => {
    const patternRef = doc(refs.thinkingPatterns, pattern.patternId);
    updateDoc(patternRef, { ...pattern, dateUpdated: today() } as any).catch(() => emitError(patternRef.path, 'update', pattern));
    if (pattern.status === 'acknowledged') {
      createThinkingEvent({ eventType: 'thinking_pattern_acknowledged', entityType: 'thinkingPattern', entityId: pattern.patternId, after: pattern, origin: 'user', summary: `Thinking pattern acknowledged: ${pattern.label}`, importance: 'medium', sourceActionId: makeActionId() });
    }
    if (pattern.status === 'dismissed') {
      createThinkingEvent({ eventType: 'thinking_pattern_dismissed', entityType: 'thinkingPattern', entityId: pattern.patternId, after: pattern, origin: 'user', summary: `Thinking pattern dismissed: ${pattern.label}`, importance: 'low', sourceActionId: makeActionId() });
    }
  };

  const refreshThinkingMetrics = (overrides?: Partial<ThinkingMetrics>) => {
    if (!metacognitionEnabled || !featureFlags.thinkingMetricsEnabled) return;
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
      sourcesStudied: media.filter((item) => item.status === 'Finished').length,
      ideasSynthesized: thinkingEvents.filter((item) => item.eventType === 'synthesized').length || insights.length,
      unknownsCreated: thinkingEvents.filter((item) => item.eventType === 'unknown_created').length || unknowns.length,
      unknownsResolved: thinkingEvents.filter((item) => item.eventType === 'unknown_resolved').length || unknowns.filter((item) => item.status === 'resolved').length,
      positionsStressTested: thinkingEvents.filter((item) => item.eventType === 'stress_test_answered').length,
      lastComputedAt: today(),
      ...overrides,
    };
    setDoc(metricsRef, payload, { merge: true }).catch(() => emitError(metricsRef.path, 'update', payload));
  };

  const createTimelineEvent = (event: Partial<TimelineEvent>) => {
    const eventRef = doc(refs.timeline);
    const data = {
      id: eventRef.id,
      entityId: event.entityId || '',
      entityType: event.entityType || 'unknown',
      entityTitle: event.entityTitle || 'Untitled',
      eventType: event.eventType || 'created',
      reason: event.reason || '',
      influencedBy: event.influencedBy || [],
      date: event.date || today(),
    };
    setDoc(eventRef, data).catch(() => emitError(eventRef.path, 'create', data));
  };

  const ensureConcepts = (tags: string[]) => {
    const missing = ensureConceptTerms(concepts, tags);
    missing.forEach((name) => {
      const conceptRef = doc(refs.concepts);
      const data = {
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
      setDoc(conceptRef, data).catch(() => emitError(conceptRef.path, 'create', data));
    });
  };

  const addConcept = (data: Partial<Concept>) => {
    const conceptRef = doc(refs.concepts);
    const payload = {
      id: conceptRef.id,
      name: conceptKey(data.name),
      description: data.description || '',
      links: data.links || [],
      sourceIds: data.sourceIds || [],
      x: data.x ?? Math.random() * 80 + 10,
      y: data.y ?? Math.random() * 80 + 10,
      createdFrom: data.createdFrom || 'manual',
      philosophyStatus: data.philosophyStatus || (data.description ? 'emerging' : 'undefined'),
      dateCreated: today(),
    };
    commitWorkspaceMutation({
      db,
      ref: conceptRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'created',
        entityType: 'concept',
        entityId: payload.id,
        after: payload,
        summary: `Created concept: ${payload.name}`,
        origin: payload.createdFrom === 'manual' ? 'user' : 'system',
        importance: 'medium',
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(conceptRef.path, 'create', payload));
  };

  const updateConcept = (concept: Concept) => {
    const conceptRef = doc(refs.concepts, concept.id);
    const previous = concepts.find((item) => item.id === concept.id);
    const nextConcept = { ...concept, dateUpdated: today() };
    commitWorkspaceMutation({
      db,
      ref: conceptRef as any,
      operation: 'update',
      data: nextConcept,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'edited',
        entityType: 'concept',
        entityId: concept.id,
        before: previous || null,
        after: nextConcept,
        summary: `Edited concept: ${concept.name}`,
        origin: 'user',
        importance: 'low',
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(conceptRef.path, 'update', concept));
  };

  const deleteConcept = (id: string) => {
    const existing = concepts.find((item) => item.id === id);
    const conceptRef = doc(refs.concepts, id);
    commitWorkspaceMutation({
      db,
      ref: conceptRef as any,
      operation: 'delete',
      thinkingEvent: metacognitionEnabled && existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'abandoned',
        entityType: 'concept',
        entityId: id,
        before: existing,
        summary: `Deleted concept: ${existing.name}`,
        origin: 'user',
        importance: 'medium',
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(conceptRef.path, 'delete'));
  };

  const addMedia = (data: Partial<Media>) => {
    const tags = normalizeConceptTags(data.tags);
    ensureConcepts(tags);
    const mediaRef = doc(refs.media);
    const payload = {
      id: mediaRef.id,
      title: data.title || 'Untitled Source',
      creator: data.creator || '',
      type: data.type || 'book',
      status: data.status || 'Want to Read',
      year: data.year || '',
      genre: data.genre || '',
      description: data.description || '',
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
      annotations: data.annotations || [],
      capture: data.capture || { sessions: [] },
      dateAdded: today(),
      dateUpdated: today(),
    };
    commitWorkspaceMutation({
      db,
      ref: mediaRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'created',
        entityType: 'source',
        entityId: payload.id,
        after: payload,
        summary: 'Added a new source.',
        origin: 'user',
        importance: 'medium',
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(mediaRef.path, 'create', payload));
    createTimelineEvent({ entityId: mediaRef.id, entityType: 'media', entityTitle: payload.title, eventType: 'created', reason: 'Source added to Noesis' });
  };

  const updateMedia = (item: Media) => {
    ensureConcepts(item.tags || []);
    const mediaRef = doc(refs.media, item.id);
    const previous = media.find((source) => source.id === item.id);
    const nextItem = { ...item, dateUpdated: today() };
    commitWorkspaceMutation({
      db,
      ref: mediaRef as any,
      operation: 'update',
      data: nextItem,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'edited',
        entityType: 'source',
        entityId: item.id,
        before: previous || null,
        after: nextItem,
        summary: 'Updated source capture or metadata.',
        origin: 'user',
        importance: 'low',
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(mediaRef.path, 'update', item));
  };

  const deleteMedia = (id: string) => {
    const existing = media.find((item) => item.id === id);
    const mediaRef = doc(refs.media, id);
    commitWorkspaceMutation({
      db,
      ref: mediaRef as any,
      operation: 'delete',
      thinkingEvent: metacognitionEnabled && existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'abandoned',
        entityType: 'source',
        entityId: id,
        before: existing,
        summary: `Deleted source: ${existing.title}`,
        origin: 'user',
        importance: 'medium',
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(mediaRef.path, 'delete'));
  };

  const updateAnnotation = (sourceId: string, annotation: Annotation) => {
    const source = media.find((item) => item.id === sourceId);
    if (!source) return;
    const previous = (source.annotations || []).find((item) => item.id === annotation.id) || null;
    const annotations = (source.annotations || []).map((item) => item.id === annotation.id ? annotation : item);
    updateMedia({ ...source, annotations, dateUpdated: today() });
    createThinkingEvent({
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
    });
  };

  const deleteAnnotation = (sourceId: string, annotationId: string) => {
    const source = media.find((item) => item.id === sourceId);
    if (!source) return;
    const existing = (source.annotations || []).find((item) => item.id === annotationId) || null;
    const annotations = (source.annotations || []).filter((item) => item.id !== annotationId);
    updateMedia({ ...source, annotations, dateUpdated: today() });
    if (existing) {
      createThinkingEvent({
        eventType: 'abandoned',
        entityType: 'annotation',
        entityId: annotationId,
        before: existing,
        summary: 'Deleted annotation.',
        origin: 'user',
        importance: 'low',
        relatedEntityIds: { sourceIds: [sourceId] },
        sourceActionId: makeActionId(),
      });
    }
  };

  const addVaultEntry = (data: Partial<VaultEntry>) => {
    const tags = normalizeConceptTags(data.tags);
    ensureConcepts(tags);
    const vaultRef = doc(refs.vault);
    const payload = {
      id: vaultRef.id,
      title: data.title || 'Untitled Position',
      type: data.type || 'belief',
      statement: data.statement || data.description || '',
      description: data.description || data.statement || '',
      confidence: data.confidence || 3,
      status: data.status || 'active',
      tags,
      sourceIds: data.sourceIds || [],
      evidenceFor: data.evidenceFor || [],
      evidenceAgainst: data.evidenceAgainst || [],
      versionHistory: data.versionHistory || [],
      createdFrom: data.createdFrom || 'manual',
      sourceAnnotationId: data.sourceAnnotationId || '',
      sourceWorkId: data.sourceWorkId || '',
      sourceDocumentId: data.sourceDocumentId || '',
      dateCreated: today(),
      dateUpdated: today(),
    };
    commitWorkspaceMutation({
      db,
      ref: vaultRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: metacognitionEnabled ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'created',
        entityType: 'position',
        entityId: payload.id,
        after: payload,
        summary: `Position created: ${payload.title}`,
        origin: payload.createdFrom === 'manual' ? 'user' : 'system',
        importance: 'high',
        relatedEntityIds: { sourceIds: payload.sourceIds, conceptIds: tags.map((tag) => concepts.find((item) => conceptKey(item.name) === conceptKey(tag))?.id).filter(Boolean) as string[] },
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(vaultRef.path, 'create', payload));
    createTimelineEvent({ entityId: vaultRef.id, entityType: 'vault', entityTitle: payload.title, eventType: 'created', reason: 'Position formed', influencedBy: data.sourceIds });
    refreshBeliefProfile(payload as VaultEntry, { originSummary: payload.statement || payload.description });
    return payload as VaultEntry;
  };

  const updateVaultEntry = (entry: VaultEntry) => {
    ensureConcepts(entry.tags || []);
    const vaultRef = doc(refs.vault, entry.id);
    const previous = vault.find((item) => item.id === entry.id);
    updateDoc(vaultRef, { ...entry, dateUpdated: today() } as any).catch(() => emitError(vaultRef.path, 'update', entry));
    createTimelineEvent({ entityId: entry.id, entityType: 'vault', entityTitle: entry.title, eventType: 'refined', reason: 'Position refined', influencedBy: entry.sourceIds });
    const profilePatch: Partial<BeliefProfile> = {
      confidenceScore: entry.confidenceScore ?? entry.confidence,
      evidenceQuality: entry.evidenceQuality,
      lastRevisedAt: today(),
    };
    const changeClassification = classifyThinkingChange(previous || null, entry);
    if (previous && (previous.evidenceFor || []).length < (entry.evidenceFor || []).length) {
      profilePatch.strengthenedBy = [...(beliefProfiles.find((item) => item.positionId === entry.id)?.strengthenedBy || []), 'Evidence added'];
      createThinkingEvent({ eventType: 'evidence_added', entityType: 'position', entityId: entry.id, before: previous, after: entry, origin: 'user', summary: `Evidence added to ${entry.title}`, importance: 'medium', relatedEntityIds: { sourceIds: entry.sourceIds || [] }, sourceActionId: makeActionId() });
    }
    if (previous && (previous.evidenceAgainst || []).length < (entry.evidenceAgainst || []).length) {
      profilePatch.challengedBy = [...(beliefProfiles.find((item) => item.positionId === entry.id)?.challengedBy || []), 'Challenge recorded'];
      profilePatch.lastChallengedAt = today();
      createThinkingEvent({ eventType: 'challenge_added', entityType: 'position', entityId: entry.id, before: previous, after: entry, origin: 'user', summary: `Challenge added to ${entry.title}`, importance: 'high', relatedEntityIds: { sourceIds: entry.sourceIds || [] }, sourceActionId: makeActionId(), epistemicStatus: 'challenged' });
    }
    if (previous && previous.confidence !== entry.confidence) {
      createThinkingEvent({ eventType: 'confidence_changed', entityType: 'position', entityId: entry.id, before: previous, after: entry, origin: 'user', summary: `Confidence changed for ${entry.title}`, importance: 'medium', confidenceBefore: previous.confidence, confidenceAfter: entry.confidence, sourceActionId: makeActionId() });
    }
    if (previous && (previous.testingCount || 0) < (entry.testingCount || 0)) {
      createThinkingEvent({
        eventType: 'stress_test_answered',
        entityType: 'position',
        entityId: entry.id,
        before: previous,
        after: entry,
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
      createThinkingEvent({ eventType: 'position_abandoned', entityType: 'position', entityId: entry.id, before: previous, after: entry, origin: 'user', summary: `Position abandoned: ${entry.title}`, importance: 'major', epistemicStatus: 'abandoned', sourceActionId: makeActionId() });
    } else {
      createThinkingEvent({ eventType: changeClassification.eventType, entityType: 'position', entityId: entry.id, before: previous || null, after: entry, origin: 'user', summary: `${changeClassification.eventType === 'position_revised' ? 'Position revised' : 'Position edited'}: ${entry.title}`, importance: changeClassification.importance, sourceActionId: makeActionId() });
    }
    refreshBeliefProfile(entry, profilePatch);
  };

  const deleteVaultEntry = (id: string) => {
    const existing = vault.find((item) => item.id === id);
    const vaultRef = doc(refs.vault, id);
    commitWorkspaceMutation({
      db,
      ref: vaultRef as any,
      operation: 'delete',
      thinkingEvent: metacognitionEnabled && existing ? {
        collection: refs.thinkingEvents as any,
        userId: effectiveUid,
        eventType: 'position_abandoned',
        entityType: 'position',
        entityId: id,
        before: existing,
        summary: `Deleted position: ${existing.title}`,
        origin: 'user',
        importance: 'major',
        epistemicStatus: 'abandoned',
        sourceActionId: makeActionId(),
      } : null,
    }).catch(() => emitError(vaultRef.path, 'delete'));
  };

  const createIdea = (data: { title: string; body: string; tags: string[]; sourceIds: string[]; position?: { title: string; statement: string; description: string; confidence: number }; sourceAnnotationId?: string; sourceWorkId?: string; sourceDocumentId?: string }) => {
    const tags = normalizeConceptTags(data.tags);
    ensureConcepts(tags);
    const insightRef = doc(refs.insights);
    const beliefRef = doc(refs.vault);
    const posTitle = data.position?.title || data.title;
    const batch = writeBatch(db);
    batch.set(insightRef, {
      id: insightRef.id,
      title: data.title,
      body: data.body,
      sourceIds: data.sourceIds || [],
      tags,
      categories: [],
      connections: [beliefRef.id],
      beliefId: beliefRef.id,
      dateCreated: today(),
      dateUpdated: today(),
    });
    batch.set(beliefRef, {
      id: beliefRef.id,
      title: posTitle,
      type: 'belief',
      statement: data.position?.statement || data.title,
      description: data.position?.description || data.body,
      confidence: data.position?.confidence ?? 3,
      status: 'active',
      tags,
      sourceIds: data.sourceIds || [],
      insightIds: [insightRef.id],
      evidenceFor: [],
      evidenceAgainst: [],
      versionHistory: [],
      createdFrom: 'idea',
      sourceAnnotationId: data.sourceAnnotationId || '',
      sourceWorkId: data.sourceWorkId || '',
      sourceDocumentId: data.sourceDocumentId || '',
      dateCreated: today(),
      dateUpdated: today(),
    });
    const eventRef = doc(refs.timeline);
    batch.set(eventRef, { id: eventRef.id, entityId: beliefRef.id, entityType: 'vault', entityTitle: posTitle, eventType: 'created', reason: 'Idea formed as position', influencedBy: data.sourceIds || [], date: today() });
    batch.commit().catch(() => emitError('batch', 'write', data));
    createThinkingEvent({
      eventType: 'position_formed',
      entityType: 'position',
      entityId: beliefRef.id,
      after: {
        title: posTitle,
        statement: data.position?.statement || data.title,
        description: data.position?.description || data.body,
      },
      origin: 'user',
      summary: `Position formed from idea: ${posTitle}`,
      importance: 'high',
      relatedEntityIds: {
        sourceIds: data.sourceIds || [],
        annotationIds: data.sourceAnnotationId ? [data.sourceAnnotationId] : [],
        workIds: data.sourceWorkId ? [data.sourceWorkId] : [],
      },
      sourceActionId: makeActionId(),
    });
    return { positionId: beliefRef.id, insightId: insightRef.id, title: posTitle };
  };

  const formPositionFromInquiry = (
    question: Question,
    position: { title: string; statement: string; description: string; confidence: number },
    finalAnswer: string
  ) => {
    const batch = writeBatch(db);
    const vaultRef = doc(refs.vault);
    batch.set(vaultRef, {
      id: vaultRef.id,
      title: position.title,
      type: 'belief',
      statement: position.statement,
      description: position.description,
      confidence: position.confidence,
      status: 'active',
      tags: [],
      sourceIds: question.sourceIds || [],
      evidenceFor: [],
      evidenceAgainst: [],
      versionHistory: [],
      createdFrom: 'inquiry',
      dateCreated: today(),
      dateUpdated: today(),
    });
    if (!question.id.startsWith('open:') && !question.id.startsWith('annotation:')) {
      const questionRef = doc(refs.questions, question.id);
      batch.update(questionRef as any, {
        status: 'answered',
        answer: finalAnswer,
        beliefIds: [...(question.beliefIds || []), vaultRef.id],
        dateUpdated: today(),
      });
    }
    const eventRef = doc(refs.timeline);
    batch.set(eventRef, {
      id: eventRef.id,
      entityId: vaultRef.id,
      entityType: 'vault',
      entityTitle: position.title,
      eventType: 'created',
      reason: 'Position formed from Socratic inquiry',
      influencedBy: question.sourceIds || [],
      date: today(),
    });
    createThinkingEvent({
      eventType: 'position_formed',
      entityType: 'position',
      entityId: vaultRef.id,
      after: position as any,
      origin: 'system',
      summary: `Inquiry promoted into position: ${position.title}`,
      importance: 'high',
      relatedEntityIds: {
        inquiryIds: [question.id],
        sourceIds: question.sourceIds || [],
      },
      sourceActionId: makeActionId(),
    });
    batch.commit().catch(() => emitError('batch', 'write', position));
  };

  const addQuestion = (data: Partial<Question>) => {
    const questionRef = doc(refs.questions);
    const payload = {
      id: questionRef.id,
      text: data.text || '',
      status: data.status || 'open',
      answer: data.answer || '',
      evidenceIds: data.evidenceIds || [],
      conceptIds: data.conceptIds || [],
      sourceIds: data.sourceIds || [],
      beliefIds: data.beliefIds || [],
      draftIds: data.draftIds || [],
      type: data.type || 'manual',
      sourceAnnotationId: data.sourceAnnotationId || '',
      sourceWorkId: data.sourceWorkId || '',
      sourceDocumentId: data.sourceDocumentId || '',
      dateCreated: today(),
      dateUpdated: today(),
    };
    setDoc(questionRef, payload).catch(() => emitError(questionRef.path, 'create', payload));
    createThinkingEvent({
      eventType: data.type === 'annotation' ? 'question_created' : 'question_created',
      entityType: 'inquiry',
      entityId: payload.id,
      after: payload,
      summary: `Inquiry created: ${payload.text}`,
      origin: 'user',
      importance: 'medium',
      relatedEntityIds: {
        sourceIds: payload.sourceIds || [],
        positionIds: payload.beliefIds || [],
        annotationIds: payload.sourceAnnotationId ? [payload.sourceAnnotationId] : [],
      },
      sourceActionId: makeActionId(),
    });
    return payload as Question;
  };

  const updateQuestion = (question: Question) => {
    const questionRef = doc(refs.questions, question.id);
    const previous = questions.find((item) => item.id === question.id);
    const nextQuestion = { ...question, dateUpdated: today() };
    updateDoc(questionRef, nextQuestion as any).catch(() => emitError(questionRef.path, 'update', question));
    createThinkingEvent({
      eventType: question.status === 'resolved' || question.status === 'answered' ? 'question_resolved' : 'edited',
      entityType: 'inquiry',
      entityId: question.id,
      before: previous || null,
      after: nextQuestion,
      summary: question.status === 'resolved' || question.status === 'answered' ? `Inquiry resolved: ${question.text}` : `Inquiry updated: ${question.text}`,
      origin: 'user',
      importance: question.status === 'resolved' || question.status === 'answered' ? 'high' : 'low',
      sourceActionId: makeActionId(),
    });
  };

  const addDraft = (data: Partial<Draft>) => {
    const conceptTags = normalizeConceptTags(data.conceptTags);
    ensureConcepts(conceptTags);
    const draftRef = doc(refs.drafts);
    const payload = {
      id: draftRef.id,
      title: data.title || 'Untitled Draft',
      body: data.body || '',
      type: data.type || preferences.writingDefaults.type,
      status: data.status || preferences.writingDefaults.status,
      label: data.label || '',
      workCategory: data.workCategory || workCategoryForDraft(data.type || preferences.writingDefaults.type),
      paperType: data.paperType || data.writingStyle || preferences.writingDefaults.writingStyle,
      draftContent: data.draftContent || data.body || '',
      finalContent: data.finalContent || '',
      activeMode: data.activeMode || 'draft',
      activeRibbon: data.activeRibbon || 'writing',
      recordingType: data.recordingType || 'screen',
      durationSeconds: data.durationSeconds || 0,
      fileUrl: data.fileUrl || '',
      storagePath: data.storagePath || '',
      thumbnailUrl: data.thumbnailUrl || '',
      canvasData: data.canvasData || '',
      writingOverlayData: data.writingOverlayData || '',
      writingStyle: data.writingStyle || preferences.writingDefaults.writingStyle,
      externalDoc: data.externalDoc || null,
      conceptTags,
      sourceIds: data.sourceIds || [],
      questionIds: data.questionIds || [],
      beliefIds: data.beliefIds || [],
      dateCreated: today(),
      dateUpdated: today(),
    };
    setDoc(draftRef, payload).catch(() => emitError(draftRef.path, 'create', payload));
    createTimelineEvent({ entityId: draftRef.id, entityType: 'draft', entityTitle: payload.title, eventType: 'created', reason: 'Work draft created' });
    createThinkingEvent({
      eventType: 'created',
      entityType: 'work',
      entityId: payload.id,
      after: payload,
      summary: `Created work: ${payload.title}`,
      origin: 'user',
      importance: 'medium',
      relatedEntityIds: { conceptIds: conceptTags.map((tag) => concepts.find((item) => conceptKey(item.name) === conceptKey(tag))?.id).filter(Boolean) as string[], inquiryIds: payload.questionIds || [], positionIds: payload.beliefIds || [], sourceIds: payload.sourceIds || [] },
      sourceActionId: makeActionId(),
    });
    return payload as Draft;
  };

  const updateDraft = (draft: Draft) => {
    ensureConcepts(draft.conceptTags || []);
    const draftRef = doc(refs.drafts, draft.id);
    const previous = drafts.find((item) => item.id === draft.id);
    const nextDraft = { ...draft, dateUpdated: today() };
    updateDoc(draftRef, nextDraft as any).catch(() => emitError(draftRef.path, 'update', draft));
    createThinkingEvent({
      eventType: 'edited',
      entityType: 'work',
      entityId: draft.id,
      before: previous || null,
      after: nextDraft,
      summary: `Updated work: ${draft.title}`,
      origin: 'user',
      importance: 'low',
      sourceActionId: makeActionId(),
    });
  };

  const deleteDraft = (id: string) => {
    const existing = drafts.find((item) => item.id === id);
    const draftRef = doc(refs.drafts, id);
    deleteDoc(draftRef).catch(() => emitError(draftRef.path, 'delete'));
    if (existing) {
      createThinkingEvent({
        eventType: 'abandoned',
        entityType: 'work',
        entityId: id,
        before: existing,
        summary: `Deleted work: ${existing.title}`,
        origin: 'user',
        importance: 'medium',
        relatedEntityIds: { sourceIds: existing.sourceIds || [], inquiryIds: existing.questionIds || [], positionIds: existing.beliefIds || [] },
        sourceActionId: makeActionId(),
      });
    }
  };

  const addPractice = (data: Partial<Practice>) => {
    const tags = normalizeConceptTags(data.conceptTags);
    ensureConcepts(tags);
    const practiceRef = doc(refs.practices);
    const payload = {
      id: practiceRef.id,
      title: data.title || 'Untitled Practice',
      description: data.description || '',
      type: data.type || 'experiment',
      status: data.status || 'planned',
      durationDays: data.durationDays || 7,
      startDate: data.startDate || today().slice(0, 10),
      endDate: data.endDate || '',
      conceptTags: tags,
      sourceIds: data.sourceIds || [],
      questionIds: data.questionIds || [],
      positionIds: data.positionIds || [],
      draftIds: data.draftIds || [],
      notes: data.notes || '',
      dateCreated: today(),
      dateUpdated: today(),
    };
    setDoc(practiceRef, payload).catch(() => emitError(practiceRef.path, 'create', payload));
    createTimelineEvent({ entityId: practiceRef.id, entityType: 'practice', entityTitle: payload.title, eventType: 'created', reason: 'New practice initiated' });
    createThinkingEvent({
      eventType: 'practice_created',
      entityType: 'practice',
      entityId: payload.id,
      after: payload,
      summary: `Created practice: ${payload.title}`,
      origin: 'user',
      importance: 'medium',
      relatedEntityIds: { positionIds: payload.positionIds || [], inquiryIds: payload.questionIds || [], sourceIds: payload.sourceIds || [] },
      sourceActionId: makeActionId(),
    });
  };

  const updatePractice = (practice: Practice) => {
    ensureConcepts(practice.conceptTags || []);
    const practiceRef = doc(refs.practices, practice.id);
    const previous = practices.find((item) => item.id === practice.id);
    const nextPractice = { ...practice, dateUpdated: today() };
    updateDoc(practiceRef, nextPractice as any).catch(() => emitError(practiceRef.path, 'update', practice));
    if (previous && previous.status !== practice.status) {
      createTimelineEvent({
        entityId: practice.id,
        entityType: 'practice',
        entityTitle: practice.title,
        eventType: practice.status === 'failed' ? 'challenged' : practice.status === 'abandoned' ? 'abandoned' : 'refined',
        reason: `Practice moved from ${previous.status} to ${practice.status}`,
        influencedBy: [...(practice.sourceIds || []), ...(practice.positionIds || [])],
      });
    }
    const previousLogs = previous?.logDates?.length || 0;
    const nextLogs = practice.logDates?.length || 0;
    createThinkingEvent({
      eventType: nextLogs > previousLogs ? 'tested' : 'edited',
      entityType: 'practice',
      entityId: practice.id,
      before: previous || null,
      after: nextPractice,
      summary: nextLogs > previousLogs ? `Logged a practice test connected to ${practice.title}` : `Updated practice: ${practice.title}`,
      origin: 'user',
      importance: nextLogs > previousLogs ? 'high' : 'low',
      relatedEntityIds: { positionIds: practice.positionIds || [], inquiryIds: practice.questionIds || [], workIds: practice.draftIds || [] },
      sourceActionId: makeActionId(),
    });
  };

  const deletePractice = (id: string) => {
    const existing = practices.find((item) => item.id === id);
    const practiceRef = doc(refs.practices, id);
    deleteDoc(practiceRef).catch(() => emitError(practiceRef.path, 'delete'));
    if (existing) {
      createThinkingEvent({
        eventType: 'abandoned',
        entityType: 'practice',
        entityId: id,
        before: existing,
        summary: `Deleted practice: ${existing.title}`,
        origin: 'user',
        importance: 'medium',
        relatedEntityIds: { sourceIds: existing.sourceIds || [], inquiryIds: existing.questionIds || [], positionIds: existing.positionIds || [], workIds: existing.draftIds || [] },
        sourceActionId: makeActionId(),
      });
    }
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
        sourceIds: inquiry?.sourceIds || inquiry?.evidenceIds || [],
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
    updateDoc(linkRef, {
      lastInteractedAt: today(),
      interactionCount: nextInteractionCount,
      connectionScore: scoreMeta.connectionScore,
      connectionStrength: scoreMeta.connectionStrength,
      mapModes: scoreMeta.mapModes,
      dateUpdated: today(),
    } as any).catch(() => emitError(linkRef.path, 'update', { id, lastInteractedAt: today(), interactionCount: nextInteractionCount }));
  };

  const addPhilosophicalLink = (data: Partial<PhilosophicalLink>, options?: { creationMethod?: string }) => {
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
    commitWorkspaceMutation({
      db,
      ref: linkRef as any,
      operation: 'set',
      data: payload,
      thinkingEvent: metacognitionEnabled ? {
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
      } : null,
    }).catch(() => emitError(linkRef.path, 'create', payload));
  };

  const addAtlasQuickLink = (data: Partial<PhilosophicalLink>) => addPhilosophicalLink(data, { creationMethod: 'atlas_quick_link' });

  const updatePhilosophicalLink = (link: PhilosophicalLink) => {
    const linkRef = doc(refs.links, link.id);
    const atlasMeta = scoreAtlasLink(link);
    updateDoc(linkRef, {
      ...link,
      connectionScore: atlasMeta.connectionScore,
      connectionStrength: atlasMeta.connectionStrength,
      mapModes: atlasMeta.mapModes,
      dateUpdated: today(),
    } as any).catch(() => emitError(linkRef.path, 'update', link));
  };

  const deletePhilosophicalLink = (id: string, options?: { method?: string }) => {
    const existing = links.find((item) => item.id === id);
    const linkRef = doc(refs.links, id);
    commitWorkspaceMutation({
      db,
      ref: linkRef as any,
      operation: 'delete',
      thinkingEvent: metacognitionEnabled && existing ? {
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
    }).catch(() => emitError(linkRef.path, 'delete'));
  };

  const addAiSuggestion = (data: Partial<AiSuggestion>) => {
    if (!data.targetType || !data.targetId || !data.suggestionType) return;
    const suggestionRef = doc(refs.suggestions);
    const payload = {
      id: suggestionRef.id,
      targetType: data.targetType,
      targetId: data.targetId,
      targetLabel: data.targetLabel || '',
      suggestionType: data.suggestionType,
      title: data.title || 'Suggested next action',
      body: data.body || '',
      payload: data.payload || {},
      status: data.status || 'pending',
      createdFrom: 'ai',
      dateCreated: today(),
      dateUpdated: today(),
    };
    setDoc(suggestionRef, payload).catch(() => emitError(suggestionRef.path, 'create', payload));
    createThinkingEvent({ eventType: 'ai_suggestion_generated', entityType: 'suggestion', entityId: payload.id, after: payload, origin: 'ai', summary: `Suggestion created: ${payload.title}`, importance: 'medium', sourceActionId: makeActionId() });
  };

  const updateAiSuggestion = (suggestion: AiSuggestion) => {
    const suggestionRef = doc(refs.suggestions, suggestion.id);
    updateDoc(suggestionRef, { ...suggestion, dateUpdated: today() } as any).catch(() => emitError(suggestionRef.path, 'update', suggestion));
    if (suggestion.status === 'accepted') {
      createThinkingEvent({ eventType: 'ai_suggestion_accepted', entityType: 'suggestion', entityId: suggestion.id, after: suggestion, origin: 'user', summary: `Suggestion accepted: ${suggestion.title}`, importance: 'medium', sourceActionId: makeActionId() });
    }
    if (suggestion.status === 'dismissed' || suggestion.status === 'ignored') {
      createThinkingEvent({ eventType: 'ai_suggestion_rejected', entityType: 'suggestion', entityId: suggestion.id, after: suggestion, origin: 'user', summary: `Suggestion dismissed: ${suggestion.title}`, importance: 'low', sourceActionId: makeActionId() });
    }
  };

  const addAtlasMap = (data: Partial<AtlasMap>) => {
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
    setDoc(mapRef, payload).catch(() => emitError(mapRef.path, 'create', payload));
  };

  const updateAtlasMap = (map: AtlasMap) => {
    const mapRef = doc(refs.atlasMaps, map.id);
    updateDoc(mapRef, { ...map, dateUpdated: today() } as any).catch(() => emitError(mapRef.path, 'update', map));
  };

  const deleteAtlasMap = (id: string) => {
    const mapRef = doc(refs.atlasMaps, id);
    deleteDoc(mapRef).catch(() => emitError(mapRef.path, 'delete'));
  };

  const saveGoal = async (nextGoal: GoalSettings) => {
    setGoalState(nextGoal);
    await setDoc(refs.settingsGoal, nextGoal, { merge: true });
  };

  const saveProfile = async (nextProfile: UserProfile) => {
    const payload = {
      ...nextProfile,
      email: user?.email || nextProfile.email || '',
      photoURL: nextProfile.photoURL || nextProfile.avatarUrl || user?.photoURL || '',
      avatarUrl: nextProfile.avatarUrl || nextProfile.photoURL || user?.photoURL || '',
      createdAt: nextProfile.createdAt || profile.createdAt || today(),
      dateUpdated: today(),
    };
    await setDoc(refs.user, {
      displayName: payload.displayName,
      email: payload.email,
      avatarUrl: payload.avatarUrl || '',
      updatedAt: today(),
    }, { merge: true });
    await setDoc(refs.profileMain, payload, { merge: true });
  };

  const saveProfilePrivacy = async (nextPrivacy: ProfilePrivacySettings) => {
    const payload = { ...nextPrivacy, dateUpdated: today() };
    await setDoc(refs.profilePrivacy, payload, { merge: true });
    await setDoc(refs.settingsPrivacy, {
      ...privacySettings,
      shareableProfileLink: payload.shareSlug || '',
      dateUpdated: today(),
    }, { merge: true });
  };

  const saveSettingsSection = async (section: 'account' | 'appearance' | 'workspace' | 'ai' | 'metacognition' | 'privacy' | 'data' | 'sourceIntake' | 'works' | 'atlas' | 'notifications' | 'goals' | 'developer', value: any) => {
    const stamped = { ...value, dateUpdated: today() };
    switch (section) {
      case 'account':
        await setDoc(refs.settingsAccount, stamped, { merge: true });
        break;
      case 'appearance':
        await setDoc(refs.settingsAppearance, stamped, { merge: true });
        await setDoc(refs.settingsPreferences, {
          ...preferences,
          themeMode: stamped.themeMode,
          accentTheme: stamped.accentTheme,
          dateUpdated: today(),
        }, { merge: true });
        break;
      case 'workspace':
        await setDoc(refs.settingsWorkspace, stamped, { merge: true });
        break;
      case 'ai':
        await setDoc(refs.settingsAi, stamped, { merge: true });
        await setDoc(refs.settingsWorkspace, {
          featureFlags: {
            ...workspace.featureFlags,
            aiSuggestions: stamped.enableAiSuggestions,
          },
          dateUpdated: today(),
        }, { merge: true });
        break;
      case 'metacognition':
        await setDoc(refs.settingsMetacognition, stamped, { merge: true });
        await setDoc(refs.settingsWorkspace, {
          featureFlags: {
            ...workspace.featureFlags,
            metacognitionEnabled: stamped.enableMetacognitionFeatures,
            beliefBiographiesEnabled: stamped.enableBeliefBiographies,
            unknownsEnabled: stamped.enableUnknownsTracking,
            thinkingPatternsEnabled: stamped.enableThinkingPatternDetection,
            missingPerspectivesEnabled: stamped.enableMissingPerspectivesDetection,
            thinkingMetricsEnabled: stamped.enableCognitionMetrics,
          },
          dateUpdated: today(),
        }, { merge: true });
        break;
      case 'privacy':
        await setDoc(refs.settingsPrivacy, stamped, { merge: true });
        break;
      case 'data':
        await setDoc(refs.settingsData, stamped, { merge: true });
        break;
      case 'sourceIntake':
        await setDoc(refs.settingsSourceIntake, stamped, { merge: true });
        break;
      case 'works':
        await setDoc(refs.settingsWorks, stamped, { merge: true });
        await setDoc(refs.settingsPreferences, {
          ...preferences,
          writingDefaults: {
            type: stamped.defaultWorkType,
            status: stamped.defaultDraftStatus,
            writingStyle: stamped.defaultPaperStyle,
            editorFeel: stamped.defaultEditorMode,
          },
          dateUpdated: today(),
        }, { merge: true });
        break;
      case 'atlas':
        await setDoc(refs.settingsAtlas, stamped, { merge: true });
        break;
      case 'notifications':
        await setDoc(refs.settingsNotifications, stamped, { merge: true });
        break;
      case 'goals':
        await setDoc(refs.settingsGoals, stamped, { merge: true });
        break;
      case 'developer':
        await setDoc(refs.settingsDeveloper, stamped, { merge: true });
        break;
    }
  };

  const goalProgress = MEDIA_TYPES.reduce((acc, type) => {
    acc[type] = media.filter((item) => item.type === type && item.status === 'Finished').length;
    return acc;
  }, {} as Record<MediaType, number>);

  const thinkingMetrics = { ...DEFAULT_THINKING_METRICS, ...(thinkingMetricsDoc || {}), lastComputedAt: thinkingMetricsDoc?.lastComputedAt || today() };

  const movement: MovementMetrics = {
    rawAnnotations: allAnnotations(media).filter((a) => !a.philosophyStatus || a.philosophyStatus === 'raw').length,
    unsupportedPositions: vault.filter((v) => (v.evidenceFor || []).length === 0 && (v.sourceIds || []).length === 0 && v.status !== 'rejected').length,
    openInquiries: questions.filter((q) => !q.answer && q.status !== 'answered' && q.status !== 'archived').length,
    practicesWithoutPosition: practices.filter((p) => (p.positionIds || []).length === 0).length,
    positionsWithoutPractice: vault.filter((v) => v.status !== 'rejected' && !practices.some((p) => (p.positionIds || []).includes(v.id))).length,
  };

  const missingFocusedTarget = useMemo(() => {
    if (reviewDataLoading) return null;
    if (routeState.focusedConceptId && !concepts.some((item) => item.id === routeState.focusedConceptId)) {
      return { label: 'concept', id: routeState.focusedConceptId, view: 'concepts' as NoesisView };
    }
    if (focusedQuestionId && !questions.some((item) => item.id === focusedQuestionId)) {
      return { label: 'inquiry', id: focusedQuestionId, view: 'questions' as NoesisView };
    }
    if (focusedSourceId && !media.some((item) => item.id === focusedSourceId)) {
      return { label: 'source', id: focusedSourceId, view: 'library' as NoesisView };
    }
    if (focusedPositionId && !vault.some((item) => item.id === focusedPositionId)) {
      return { label: 'position', id: focusedPositionId, view: 'vault' as NoesisView };
    }
    if (routeState.focusedWorkId && !drafts.some((item) => item.id === routeState.focusedWorkId)) {
      return { label: 'work', id: routeState.focusedWorkId, view: 'writing' as NoesisView };
    }
    if (routeState.focusedPracticeId && !practices.some((item) => item.id === routeState.focusedPracticeId)) {
      return { label: 'practice', id: routeState.focusedPracticeId, view: 'practices' as NoesisView };
    }
    return null;
  }, [concepts, drafts, focusedPositionId, focusedQuestionId, focusedSourceId, media, practices, questions, reviewDataLoading, routeState.focusedConceptId, routeState.focusedPracticeId, routeState.focusedWorkId, vault]);

  const renderContent = () => {
    if (reviewDataLoading) {
      return <NoesisPageLoading activeView={activeView} />;
    }

    switch (activeView) {
      case 'home':
        return (
          <ThinkingDesk
            profile={profile}
            concepts={concepts}
            media={media}
            inquiries={questions}
            positions={vault}
            works={drafts}
            practices={practices}
            timeline={timeline}
            thinkingEvents={thinkingEvents}
            unknowns={unknowns}
            links={links}
            onNavigate={(target) => {
              navigateToView(target.view, {
                conceptId: target.view === 'concepts' ? target.targetId : null,
                questionId: target.view === 'questions' ? target.targetId : null,
                sourceId: target.view === 'library' ? target.targetId : null,
                positionId: target.view === 'vault' ? target.targetId : null,
                workId: target.view === 'writing' ? target.targetId : null,
                practiceId: target.view === 'practices' ? target.targetId : null,
              });
            }}
          />
        );
      case 'atlas':
        return (
          <ConceptAtlas
            concepts={concepts}
            media={media}
            insights={insights}
            vault={vault}
            drafts={drafts}
            practices={practices}
            questions={questions}
            timeline={timeline}
            atlasMaps={atlasMaps}
            links={links}
            thinkingEvents={thinkingEvents}
            unknowns={unknowns}
            onAddConcept={addConcept}
            onUpdateConcept={updateConcept}
            onCreateLink={addAtlasQuickLink}
            onAddAtlasMap={addAtlasMap}
            onUpdateAtlasMap={updateAtlasMap}
            onDeleteAtlasMap={deleteAtlasMap}
            onDeleteLink={deletePhilosophicalLink}
            onInteractLink={markPhilosophicalLinkInteraction}
            uid={effectiveUid}
            onOpenPosition={(id) => {
              navigateToView('vault', { positionId: id });
            }}
            onOpenQuestion={(id) => {
              navigateToView('questions', { questionId: id });
            }}
            onOpenSource={(id) => {
              navigateToView('library', { sourceId: id });
            }}
            onOpenWriting={() => {
              navigateToView('writing');
            }}
            onOpenPractices={() => {
              navigateToView('practices');
            }}
          />
        );
      case 'concepts':
        return (
          <ConceptEncyclopedia 
            concepts={concepts} 
            media={media} 
            insights={insights} 
            vault={vault} 
            drafts={drafts} 
            practices={practices}
            questions={questions} 
            timeline={timeline} 
            onAddConcept={addConcept} 
            onUpdateConcept={updateConcept} 
            onDeleteConcept={deleteConcept} 
            onCreateIdea={createIdea}
          />
        );
      case 'library':
        return (
          <MediaLibrary 
            media={media} 
            concepts={concepts} 
            vault={vault} 
            drafts={drafts}
            practices={practices}
            questions={questions}
            timeline={timeline}
            onAddMedia={addMedia} 
            onUpdateMedia={updateMedia} 
            onDeleteMedia={deleteMedia} 
            onAddConcept={addConcept} 
            onCreateIdea={createIdea}
            onDeleteVaultEntry={deleteVaultEntry}
            focusedSourceId={focusedSourceId}
            onOpenSourceRoute={(sourceId) => navigateToView('library', { sourceId })}
          />
        );
      case 'annotations':
        return (
          <AnnotationsIndex
            media={media}
            concepts={concepts}
            positions={vault}
            inquiries={questions}
            onUpdateAnnotation={updateAnnotation}
            onDeleteAnnotation={deleteAnnotation}
            onOpenSource={(sourceId) => {
              navigateToView('library', { sourceId });
            }}
            onCreatePosition={createIdea}
            onCreateInquiry={addQuestion}
            onAddConcept={addConcept}
            onCreateSuggestion={addAiSuggestion}
            onCreateLink={addPhilosophicalLink}
            onNavigate={(nextView, targetId) => {
              navigateToView(nextView as NoesisView, {
                positionId: nextView === 'vault' ? targetId : null,
                questionId: nextView === 'questions' ? targetId : null,
                sourceId: nextView === 'library' ? targetId : null,
              });
            }}
          />
        );
      case 'source-index':
        return <SourceIndex media={media} vault={vault} drafts={drafts} practices={practices} onOpenSource={(sourceId) => { navigateToView('library', { sourceId }); }} />;
      case 'goals':
        return <GoalsPage goal={goalState} goalProgress={goalProgress} onSaveGoal={saveGoal} />;
      case 'profile':
        return (
          <ProfilePage
            user={user}
            profile={profile}
            privacy={profilePrivacy}
            summary={profileMetacognitionSummary}
            concepts={concepts}
            inquiries={questions}
            positions={vault}
            sources={media}
            works={drafts}
            practices={practices}
            thinkingEvents={thinkingEvents}
            beliefProfiles={beliefProfiles}
            unknowns={unknowns}
            thinkingPatterns={thinkingPatterns}
            thinkingMetrics={thinkingMetrics}
            onSaveProfile={saveProfile}
            onSavePrivacy={saveProfilePrivacy}
            onAddUnknown={addUnknown}
            onUpdateUnknown={updateUnknown}
            onUpdateThinkingPattern={updateThinkingPattern}
            onNavigate={(nextView, targetId) => {
              navigateToView(nextView as NoesisView, {
                questionId: nextView === 'questions' ? targetId : null,
                positionId: nextView === 'vault' ? targetId : null,
                sourceId: nextView === 'library' ? targetId : null,
              });
            }}
          />
        );
      case 'vault':
        return (
          <BeliefVault
            entries={vault}
            media={media}
            drafts={drafts}
            practices={practices}
            questions={questions}
            timeline={timeline}
            concepts={concepts}
            links={links}
            beliefProfiles={beliefProfiles}
            unknowns={unknowns}
            suggestions={suggestions}
            onAddEntry={addVaultEntry}
            onUpdateEntry={updateVaultEntry}
            onDeleteEntry={deleteVaultEntry}
            onAddConcept={addConcept}
            onCreateLink={addPhilosophicalLink}
            onAddDraft={addDraft}
            onAddPractice={addPractice}
            onAddQuestion={addQuestion}
            onCreateIdea={createIdea}
            onUpdateLink={updatePhilosophicalLink}
            onAddUnknown={addUnknown}
            onUpdateSuggestion={updateAiSuggestion}
            onCreateSuggestion={addAiSuggestion}
            onOpenSource={(id) => {
              navigateToView('library', { sourceId: id });
            }}
            onOpenQuestion={(id) => {
              navigateToView('questions', { questionId: id });
            }}
            onOpenPractice={() => {
              navigateToView('practices');
            }}
            onOpenWork={() => {
              navigateToView('writing');
            }}
            focusedEntryId={focusedPositionId}
            onOpenEntryRoute={(positionId) => navigateToView('vault', { positionId })}
          />
        );
      case 'questions':
        return <QuestionsWorkspace questions={questions} media={media} vault={vault} drafts={drafts} concepts={concepts} onAddQuestion={addQuestion} onUpdateQuestion={updateQuestion} onAddVaultEntry={addVaultEntry} onAddDraft={addDraft} onFormPositionFromInquiry={formPositionFromInquiry} focusedQuestionId={focusedQuestionId} onOpenQuestionRoute={(questionId) => navigateToView('questions', { questionId })} />;
      case 'writing':
        return <Atelier drafts={drafts} media={media} vault={vault} questions={questions} concepts={concepts} writingDefaults={preferences.writingDefaults} onAddDraft={addDraft} onUpdateDraft={updateDraft} onDeleteDraft={deleteDraft} onAddConcept={addConcept} focusedDraftId={routeState.focusedWorkId || null} onOpenDraftRoute={(workId) => navigateToView('writing', { workId })} />;
      case 'evolution':
        return <EvolutionTimeline events={timeline} media={media} thinkingEvents={thinkingEvents} unknowns={unknowns} thinkingPatterns={thinkingPatterns} metrics={thinkingMetrics} />;
      case 'practices':
        return <PracticesWorkspace practices={practices} concepts={concepts} media={media} questions={questions} positions={vault} drafts={drafts} onAddPractice={addPractice} onUpdatePractice={updatePractice} onDeletePractice={deletePractice} onAddConcept={addConcept} onCreateLink={addPhilosophicalLink} focusedPracticeId={routeState.focusedPracticeId || null} onOpenPracticeRoute={(practiceId) => navigateToView('practices', { practiceId })} />;
      case 'settings':
        return (
          <SettingsPage
            user={user}
            settings={{
              account: accountSettings,
              appearance: appearanceSettings,
              workspace: workspacePreferences,
              ai: aiSettings,
              metacognition: metacognitionSettings,
              privacy: privacySettings,
              data: dataSettings,
              sourceIntake: sourceIntakeSettings,
              works: worksSettings,
              atlas: atlasSettings,
              notifications: notificationSettings,
              goals: goalPreferenceSettings,
              developer: developerSettings,
            }}
            reviewMode={isReviewWorkspace}
            onSaveSection={saveSettingsSection}
            onExportWorkspace={exportWorkspaceData}
            onOpenProfile={() => navigateToView('profile')}
            onRefreshDemoWorkspace={() => seedReviewWorkspace({ force: true })}
            refreshingDemoWorkspace={isSeedingReview}
            profileSummary={{
              displayName: profile.displayName,
              email: profile.email,
              role: profile.role,
              bio: profile.bio,
              workspaceMode: workspace.workspaceMode,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <NoesisShell
      activeView={activeView}
      onViewChange={(nextView) => navigateToView(nextView as NoesisView)}
      onOpenProfile={() => navigateToView('profile')}
      onOpenGoals={() => navigateToView('goals')}
      counts={{
        concepts: concepts.length,
        questions: questions.length,
        media: media.length,
        vault: vault.length,
        drafts: drafts.length,
        timeline: timeline.length,
        practices: practices.length,
        annotations: allAnnotations(media).length
      }}
      goal={goalState}
      goalProgress={goalProgress}
      movement={movement}
      profile={profile}
      workspaceMode={workspace.workspaceMode}
      isReviewWorkspace={isReviewWorkspace}
      effectiveUid={effectiveUid}
      canSeedReviewWorkspace={canSeedReviewWorkspace}
      isSeedingReview={isSeedingReview}
      seedReviewWorkspace={seedReviewWorkspace}
      exportReviewArchitecture={exportReviewArchitecture}
      media={media}
      concepts={concepts}
      questions={questions}
      vault={vault}
      drafts={drafts}
      practices={practices}
      unknowns={unknowns}
      links={links}
      suggestionsCount={suggestions.length}
      user={user}
      onOpenCommandItem={(item) => {
        navigateToView(item.view as NoesisView, {
          conceptId: item.view === 'concepts' ? item.targetId : null,
          questionId: item.view === 'questions' ? item.targetId : null,
          sourceId: item.view === 'library' ? item.targetId : null,
          positionId: item.view === 'vault' ? item.targetId : null,
          workId: item.view === 'writing' ? item.targetId : null,
          practiceId: item.view === 'practices' ? item.targetId : null,
        });
      }}
    >
      {missingFocusedTarget && (
        <MissingFocusedTargetBanner
          label={missingFocusedTarget.label}
          id={missingFocusedTarget.id}
          onReturn={() => navigateToView(missingFocusedTarget.view)}
        />
      )}
      {renderContent()}
    </NoesisShell>
  );
}

function MissingFocusedTargetBanner({ label, id, onReturn }: { label: string; id: string; onReturn: () => void }) {
  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-code text-[10px] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Linked object unavailable</div>
          <p className="mt-1 text-sm text-muted-foreground">
            This route points to a {label} that is missing, deleted, or not readable in this workspace: <span className="font-code">{id}</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReturn} className="rounded-full bg-card">
          Return to {label} list
        </Button>
      </div>
    </div>
  );
}

function NoesisPageLoading({ activeView }: { activeView: NoesisView }) {
  const page = NOESIS_PAGE_BY_VIEW[activeView];
  return <PageLoadingState title={`Loading ${page.title}`} description={page.purpose} />;
}

function NoesisHome() {
  const pathname = usePathname();
  const reviewMode = pathname === '/review' || pathname.startsWith('/review/') || pathname === '/demo' || pathname.startsWith('/demo/');

  return (
    <NoesisProviders>
      <NoesisWorkspaceGate reviewMode={reviewMode}>
        {(workspace) => (
          <ReadexWorkspace
            user={workspace.user}
            uid={workspace.uid}
            reviewMode={workspace.reviewMode}
            reviewWorkspaceUid={workspace.reviewWorkspaceUid}
          />
        )}
      </NoesisWorkspaceGate>
    </NoesisProviders>
  );
}

export default function Home() {
  return <NoesisHome />;
}
