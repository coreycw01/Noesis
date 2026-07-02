
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  FirebaseClientProvider,
  initializeFirebase,
  isFirebaseConfigComplete,
  missingFirebaseConfigKeys,
  useCollection,
  useDoc,
  useFirebase,
  useUser,
} from '@/firebase';
import { LoginPage } from '@/components/Auth/LoginPage';
import { Shell } from '@/components/Shell';
import type { MovementMetrics } from '@/components/Shell';
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
import { SettingsPage } from '@/components/Settings/SettingsPage';
import { GoalsPage } from '@/components/Goals/GoalsPage';
import { Toaster } from '@/components/ui/toaster';
import { Badge } from '@/components/ui/badge';
import { MEDIA_TYPES, allAnnotations, conceptKey, ensureConceptTerms, normalizeConceptTags, today, workCategoryForDraft } from '@/lib/readex';
import { DEFAULT_ATLAS_NODE_SETTINGS, DEFAULT_ATLAS_VIEW_SETTINGS, DEFAULT_GOAL_SETTINGS, DEFAULT_THINKING_METRICS, DEFAULT_USER_PREFERENCES, DEFAULT_USER_PROFILE, DEFAULT_WORKSPACE_SETTINGS, PROTOTYPE_USER_ID, readexRefs, readexSchemaDoc } from '@/lib/firestore-schema';
import { buildDemoWorkspace, buildReviewExport, REVIEW_ACCOUNT_EMAIL, REVIEW_FEATURE_FLAGS } from '@/lib/demo-workspace';
import type { AiSuggestion, Annotation, AtlasMap, BeliefProfile, Concept, Draft, GoalSettings, Insight, Media, MediaType, PhilosophicalLink, Practice, Question, ThinkingEvent, ThinkingMetrics, ThinkingPattern, TimelineEvent, Unknown, VaultEntry, SecurityRuleContext, UserPreferences, UserProfile, WorkspaceSettings } from '@/lib/types';
import { doc, getDoc, setDoc, updateDoc, writeBatch, deleteDoc, type DocumentData, type DocumentReference } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, Download, FlaskConical } from 'lucide-react';

type FirebaseInstances = ReturnType<typeof initializeFirebase>;

function ReadexWorkspace({ user, uid, reviewMode = false }: { user: User | null; uid: string; reviewMode?: boolean }) {
  const { db } = useFirebase();
  const [view, setView] = useState('atlas');
  const [focusedSourceId, setFocusedSourceId] = useState<string | null>(null);
  const [focusedPositionId, setFocusedPositionId] = useState<string | null>(null);
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [goalState, setGoalState] = useState<GoalSettings>(DEFAULT_GOAL_SETTINGS);
  const effectiveUid = uid;

  const refs = useMemo(() => readexRefs(db, effectiveUid), [db, effectiveUid]);

  const { data: media = [], loading: mediaLoading } = useCollection<Media>(refs.media as any);
  const { data: vault = [], loading: vaultLoading } = useCollection<VaultEntry>(refs.vault as any);
  const { data: insights = [], loading: insightsLoading } = useCollection<Insight>(refs.insights as any);
  const { data: concepts = [], loading: conceptsLoading } = useCollection<Concept>(refs.concepts as any);
  const { data: questions = [], loading: questionsLoading } = useCollection<Question>(refs.questions as any);
  const { data: timeline = [], loading: timelineLoading } = useCollection<TimelineEvent>(refs.timeline as any);
  const { data: drafts = [], loading: draftsLoading } = useCollection<Draft>(refs.drafts as any);
  const { data: practices = [], loading: practicesLoading } = useCollection<Practice>(refs.practices as any);
  const { data: atlasMaps = [], loading: atlasMapsLoading } = useCollection<AtlasMap>(refs.atlasMaps as any);
  const { data: links = [], loading: linksLoading } = useCollection<PhilosophicalLink>(refs.links as any);
  const { data: suggestions = [], loading: suggestionsLoading } = useCollection<AiSuggestion>(refs.suggestions as any);
  const { data: thinkingEvents = [], loading: thinkingEventsLoading } = useCollection<ThinkingEvent>(refs.thinkingEvents as any);
  const { data: beliefProfiles = [], loading: beliefProfilesLoading } = useCollection<BeliefProfile>(refs.beliefProfiles as any);
  const { data: unknowns = [], loading: unknownsLoading } = useCollection<Unknown>(refs.unknowns as any);
  const { data: thinkingPatterns = [], loading: thinkingPatternsLoading } = useCollection<ThinkingPattern>(refs.thinkingPatterns as any);
  const { data: thinkingMetricsDoc, loading: thinkingMetricsLoading } = useDoc<ThinkingMetrics>(doc(refs.thinkingMetrics, 'summary') as any);
  const { data: goalDoc, loading: goalLoading } = useDoc<GoalSettings>(refs.settingsGoal as any);
  const { data: preferencesDoc, loading: preferencesLoading } = useDoc<UserPreferences>(refs.settingsPreferences as any);
  const { data: profileDoc, loading: profileLoading } = useDoc<UserProfile>(refs.settingsProfile as any);
  const { data: workspaceDoc, loading: workspaceLoading } = useDoc<WorkspaceSettings>(refs.settingsWorkspace as any);
  
  const goal = { ...DEFAULT_GOAL_SETTINGS, ...(goalDoc || {}) };
  const preferences: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    ...(preferencesDoc || {}),
    writingDefaults: {
      ...DEFAULT_USER_PREFERENCES.writingDefaults,
      ...(preferencesDoc?.writingDefaults || {}),
    },
  };
  const profile: UserProfile = {
    ...DEFAULT_USER_PROFILE,
    ...(profileDoc || {}),
    displayName: profileDoc?.displayName || user?.displayName || '',
    email: profileDoc?.email || user?.email || '',
    photoURL: profileDoc?.photoURL || user?.photoURL || '',
    role: profileDoc?.role || DEFAULT_USER_PROFILE.role,
  };
  const workspace: WorkspaceSettings = {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...(workspaceDoc || {}),
    featureFlags: {
      ...DEFAULT_WORKSPACE_SETTINGS.featureFlags,
      ...(workspaceDoc?.featureFlags || {}),
    },
  };
  const featureFlags = workspace.featureFlags || {};
  const isReviewIdentity = (user?.email || profile.email || '').toLowerCase() === REVIEW_ACCOUNT_EMAIL.toLowerCase();
  const isReviewWorkspace = reviewMode || isReviewIdentity || workspace.workspaceMode === 'review' || workspace.demoWorkspace;
  const canSeedReviewWorkspace = effectiveUid === PROTOTYPE_USER_ID || isReviewIdentity;
  const [isSeedingReview, setIsSeedingReview] = useState(false);
  const autoSeedAttemptedRef = useRef(false);
  const reviewDataLoading =
    mediaLoading ||
    vaultLoading ||
    insightsLoading ||
    conceptsLoading ||
    questionsLoading ||
    timelineLoading ||
    draftsLoading ||
    practicesLoading ||
    atlasMapsLoading ||
    linksLoading ||
    suggestionsLoading ||
    thinkingEventsLoading ||
    beliefProfilesLoading ||
    unknownsLoading ||
    thinkingPatternsLoading ||
    thinkingMetricsLoading ||
    goalLoading ||
    preferencesLoading ||
    profileLoading ||
    workspaceLoading;

  useEffect(() => {
    setGoalState(goal);
  }, [goalDoc]);

  useEffect(() => {
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
        await setDoc(refs.user, { uid: effectiveUid, app: 'readex', updatedAt: today() }, { merge: true });
        await setDefaultIfMissing(refs.settingsGoal, DEFAULT_GOAL_SETTINGS);
        await setDefaultIfMissing(refs.settingsAtlasView, DEFAULT_ATLAS_VIEW_SETTINGS);
        await setDefaultIfMissing(refs.settingsAtlasNodes, DEFAULT_ATLAS_NODE_SETTINGS);
        await setDefaultIfMissing(refs.settingsPreferences, DEFAULT_USER_PREFERENCES);
        await setDefaultIfMissing(refs.settingsWorkspace, DEFAULT_WORKSPACE_SETTINGS);
        await setDefaultIfMissing(doc(refs.thinkingMetrics, 'summary') as any, DEFAULT_THINKING_METRICS);
        await setDoc(refs.settingsProfile, {
          ...DEFAULT_USER_PROFILE,
          displayName: user?.displayName || '',
          email: user?.email || '',
          photoURL: user?.photoURL || '',
          role: isReviewIdentity ? 'demo' : (profileDoc?.role || DEFAULT_USER_PROFILE.role),
          dateUpdated: today(),
        }, { merge: true });
        await setDoc(refs.settingsSchema, readexSchemaDoc(effectiveUid), { merge: true });
      } catch (err) {
        console.warn('Silent skip: scaffold error', err);
      }
    };

    scaffoldFirestore();
  }, [effectiveUid, isReviewIdentity, profileDoc?.role, refs, user]);

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

  const seedReviewWorkspace = async (replaceExisting = false) => {
    setIsSeedingReview(true);
    try {
      const demo = buildDemoWorkspace(effectiveUid);
      const batch = writeBatch(db);
      const collectionsToClear = replaceExisting
        ? [
            ...media.map((item) => doc(refs.media, item.id)),
            ...concepts.map((item) => doc(refs.concepts, item.id)),
            ...questions.map((item) => doc(refs.questions, item.id)),
            ...vault.map((item) => doc(refs.vault, item.id)),
            ...drafts.map((item) => doc(refs.drafts, item.id)),
            ...practices.map((item) => doc(refs.practices, item.id)),
            ...timeline.map((item) => doc(refs.timeline, item.id)),
            ...insights.map((item) => doc(refs.insights, item.id)),
            ...links.map((item) => doc(refs.links, item.id)),
            ...suggestions.map((item) => doc(refs.suggestions, item.id)),
            ...atlasMaps.map((item) => doc(refs.atlasMaps, item.id)),
          ]
        : [];

      collectionsToClear.forEach((ref) => batch.delete(ref));

      batch.set(refs.user, {
        uid: effectiveUid,
        app: 'noesis',
        reviewWorkspace: true,
        reviewEmail: REVIEW_ACCOUNT_EMAIL,
        updatedAt: today(),
      }, { merge: true });
      batch.set(refs.settingsGoal, demo.goal, { merge: true });
      batch.set(refs.settingsPreferences, demo.preferences, { merge: true });
      batch.set(refs.settingsProfile, demo.profile, { merge: true });
      batch.set(refs.settingsWorkspace, demo.workspace, { merge: true });
      batch.set(refs.settingsSchema, readexSchemaDoc(effectiveUid), { merge: true });
      batch.set(refs.settingsAtlasView, DEFAULT_ATLAS_VIEW_SETTINGS, { merge: true });
      batch.set(refs.settingsAtlasNodes, DEFAULT_ATLAS_NODE_SETTINGS, { merge: true });

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

      await batch.commit();
      autoSeedAttemptedRef.current = true;
    } finally {
      setIsSeedingReview(false);
    }
  };

  useEffect(() => {
    if (!isReviewWorkspace || !canSeedReviewWorkspace || isSeedingReview || reviewDataLoading) return;
    if (autoSeedAttemptedRef.current) return;
    if (workspace.seedSource === 'system-demo' && totalObjects > 0) return;
    if (totalObjects > 0 && workspace.demoWorkspace) return;
    if (totalObjects === 0) {
      autoSeedAttemptedRef.current = true;
      seedReviewWorkspace(false).catch((error) => console.warn('Review seed failed', error));
    }
  }, [canSeedReviewWorkspace, isReviewWorkspace, isSeedingReview, reviewDataLoading, totalObjects, workspace.demoWorkspace, workspace.seedSource]);

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

  const emitError = (path: string, operation: SecurityRuleContext['operation'], data?: any) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path,
      operation,
      requestResourceData: data,
    }));
  };

  const createThinkingEvent = (event: Partial<ThinkingEvent>) => {
    if (!metacognitionEnabled || !event.eventType || !event.targetType || !event.targetId) return;
    const eventRef = doc(refs.thinkingEvents);
    const payload: ThinkingEvent = {
      eventId: eventRef.id,
      eventType: event.eventType,
      targetType: event.targetType,
      targetId: event.targetId,
      relatedTargetType: event.relatedTargetType,
      relatedTargetId: event.relatedTargetId,
      sourceType: event.sourceType || 'system',
      summary: event.summary || '',
      metadata: event.metadata || {},
      createdAt: event.createdAt || today(),
    };
    setDoc(eventRef, payload).catch(() => emitError(eventRef.path, 'create', payload));
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
    createThinkingEvent({ eventType: 'unknown_created', targetType: 'unknown', targetId: payload.unknownId, sourceType: payload.createdFrom === 'manual' ? 'user' : payload.createdFrom, summary: `Unknown created: ${payload.title}` });
    return payload;
  };

  const updateUnknown = (item: Unknown) => {
    const unknownRef = doc(refs.unknowns, item.unknownId);
    updateDoc(unknownRef, { ...item, dateUpdated: today() } as any).catch(() => emitError(unknownRef.path, 'update', item));
    if (item.status === 'resolved') {
      createThinkingEvent({ eventType: 'unknown_resolved', targetType: 'unknown', targetId: item.unknownId, sourceType: 'user', summary: `Unknown resolved: ${item.title}` });
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
    createThinkingEvent({ eventType: 'thinking_pattern_inferred', targetType: 'thinking_pattern', targetId: payload.patternId, sourceType: payload.createdFrom, summary: `Thinking pattern inferred: ${payload.label}` });
  };

  const updateThinkingPattern = (pattern: ThinkingPattern) => {
    const patternRef = doc(refs.thinkingPatterns, pattern.patternId);
    updateDoc(patternRef, { ...pattern, dateUpdated: today() } as any).catch(() => emitError(patternRef.path, 'update', pattern));
    if (pattern.status === 'acknowledged') {
      createThinkingEvent({ eventType: 'thinking_pattern_acknowledged', targetType: 'thinking_pattern', targetId: pattern.patternId, sourceType: 'user', summary: `Thinking pattern acknowledged: ${pattern.label}` });
    }
    if (pattern.status === 'dismissed') {
      createThinkingEvent({ eventType: 'thinking_pattern_dismissed', targetType: 'thinking_pattern', targetId: pattern.patternId, sourceType: 'user', summary: `Thinking pattern dismissed: ${pattern.label}` });
    }
  };

  const refreshThinkingMetrics = (overrides?: Partial<ThinkingMetrics>) => {
    if (!metacognitionEnabled || !featureFlags.thinkingMetricsEnabled) return;
    const metricsRef = doc(refs.thinkingMetrics, 'summary');
    const payload: ThinkingMetrics = {
      questionsAsked: questions.length,
      assumptionsChallenged: thinkingEvents.filter((item) => item.eventType === 'assumption_challenged').length,
      beliefsCreated: vault.length,
      beliefsRevised: thinkingEvents.filter((item) => item.eventType === 'position_revised').length,
      beliefsAbandoned: thinkingEvents.filter((item) => item.eventType === 'position_abandoned').length,
      contradictionsDetected: thinkingEvents.filter((item) => item.eventType === 'contradiction_detected').length,
      contradictionsResolved: thinkingEvents.filter((item) => item.eventType === 'contradiction_resolved').length,
      connectionsCreated: links.length,
      sourcesStudied: media.filter((item) => item.status === 'Finished').length,
      ideasSynthesized: insights.length,
      unknownsCreated: unknowns.length,
      unknownsResolved: unknowns.filter((item) => item.status === 'resolved').length,
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
    setDoc(conceptRef, payload).catch(() => emitError(conceptRef.path, 'create', payload));
  };

  const updateConcept = (concept: Concept) => {
    const conceptRef = doc(refs.concepts, concept.id);
    updateDoc(conceptRef, { ...concept, dateUpdated: today() }).catch(() => emitError(conceptRef.path, 'update', concept));
  };

  const deleteConcept = (id: string) => {
    const conceptRef = doc(refs.concepts, id);
    deleteDoc(conceptRef).catch(() => emitError(conceptRef.path, 'delete'));
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
    setDoc(mediaRef, payload).catch(() => emitError(mediaRef.path, 'create', payload));
    createTimelineEvent({ entityId: mediaRef.id, entityType: 'media', entityTitle: payload.title, eventType: 'created', reason: 'Source added to Noesis' });
  };

  const updateMedia = (item: Media) => {
    ensureConcepts(item.tags || []);
    const mediaRef = doc(refs.media, item.id);
    updateDoc(mediaRef, { ...item, dateUpdated: today() } as any).catch(() => emitError(mediaRef.path, 'update', item));
  };

  const deleteMedia = (id: string) => {
    const mediaRef = doc(refs.media, id);
    deleteDoc(mediaRef).catch(() => emitError(mediaRef.path, 'delete'));
  };

  const updateAnnotation = (sourceId: string, annotation: Annotation) => {
    const source = media.find((item) => item.id === sourceId);
    if (!source) return;
    const annotations = (source.annotations || []).map((item) => item.id === annotation.id ? annotation : item);
    updateMedia({ ...source, annotations, dateUpdated: today() });
  };

  const deleteAnnotation = (sourceId: string, annotationId: string) => {
    const source = media.find((item) => item.id === sourceId);
    if (!source) return;
    const annotations = (source.annotations || []).filter((item) => item.id !== annotationId);
    updateMedia({ ...source, annotations, dateUpdated: today() });
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
    setDoc(vaultRef, payload).catch(() => emitError(vaultRef.path, 'create', payload));
    createTimelineEvent({ entityId: vaultRef.id, entityType: 'vault', entityTitle: payload.title, eventType: 'created', reason: 'Position formed', influencedBy: data.sourceIds });
    refreshBeliefProfile(payload as VaultEntry, { originSummary: payload.statement || payload.description });
    createThinkingEvent({ eventType: 'position_created', targetType: 'position', targetId: payload.id, sourceType: payload.createdFrom === 'manual' ? 'user' : 'system', summary: `Position created: ${payload.title}`, metadata: { sourceIds: payload.sourceIds } });
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
    if (previous && (previous.evidenceFor || []).length < (entry.evidenceFor || []).length) {
      profilePatch.strengthenedBy = [...(beliefProfiles.find((item) => item.positionId === entry.id)?.strengthenedBy || []), 'Evidence added'];
      createThinkingEvent({ eventType: 'evidence_added', targetType: 'position', targetId: entry.id, sourceType: 'user', summary: `Evidence added to ${entry.title}` });
    }
    if (previous && (previous.evidenceAgainst || []).length < (entry.evidenceAgainst || []).length) {
      profilePatch.challengedBy = [...(beliefProfiles.find((item) => item.positionId === entry.id)?.challengedBy || []), 'Challenge recorded'];
      profilePatch.lastChallengedAt = today();
      createThinkingEvent({ eventType: 'challenge_added', targetType: 'position', targetId: entry.id, sourceType: 'user', summary: `Challenge added to ${entry.title}` });
    }
    if (previous && previous.confidence !== entry.confidence) {
      createThinkingEvent({ eventType: 'confidence_changed', targetType: 'position', targetId: entry.id, sourceType: 'user', summary: `Confidence changed for ${entry.title}`, metadata: { from: previous.confidence, to: entry.confidence } });
    }
    if (previous && (previous.testingCount || 0) < (entry.testingCount || 0)) {
      createThinkingEvent({
        eventType: 'stress_test_answered',
        targetType: 'position',
        targetId: entry.id,
        sourceType: 'user',
        summary: `Stress test answered for ${entry.title}`,
        metadata: { from: previous.testingCount || 0, to: entry.testingCount || 0 },
      });
    }
    if (entry.status === 'abandoned' && previous?.status !== 'abandoned') {
      profilePatch.abandonedAt = today();
      profilePatch.reviewStatus = 'abandoned';
      createThinkingEvent({ eventType: 'position_abandoned', targetType: 'position', targetId: entry.id, sourceType: 'user', summary: `Position abandoned: ${entry.title}` });
    } else {
      createThinkingEvent({ eventType: 'position_revised', targetType: 'position', targetId: entry.id, sourceType: 'user', summary: `Position revised: ${entry.title}` });
    }
    refreshBeliefProfile(entry, profilePatch);
  };

  const deleteVaultEntry = (id: string) => {
    const vaultRef = doc(refs.vault, id);
    deleteDoc(vaultRef).catch(() => emitError(vaultRef.path, 'delete'));
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
    createThinkingEvent({ eventType: 'question_promoted', targetType: 'inquiry', targetId: question.id, relatedTargetType: 'position', relatedTargetId: vaultRef.id, sourceType: 'system', summary: `Inquiry promoted into position: ${position.title}` });
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
    createThinkingEvent({ eventType: data.type === 'annotation' ? 'question_promoted' : 'question_created', targetType: 'inquiry', targetId: payload.id, sourceType: 'user', summary: `Inquiry created: ${payload.text}` });
    return payload as Question;
  };

  const updateQuestion = (question: Question) => {
    const questionRef = doc(refs.questions, question.id);
    updateDoc(questionRef, { ...question, dateUpdated: today() } as any).catch(() => emitError(questionRef.path, 'update', question));
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
    return payload as Draft;
  };

  const updateDraft = (draft: Draft) => {
    ensureConcepts(draft.conceptTags || []);
    const draftRef = doc(refs.drafts, draft.id);
    updateDoc(draftRef, { ...draft, dateUpdated: today() } as any).catch(() => emitError(draftRef.path, 'update', draft));
  };

  const deleteDraft = (id: string) => {
    const draftRef = doc(refs.drafts, id);
    deleteDoc(draftRef).catch(() => emitError(draftRef.path, 'delete'));
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
  };

  const updatePractice = (practice: Practice) => {
    ensureConcepts(practice.conceptTags || []);
    const practiceRef = doc(refs.practices, practice.id);
    const previous = practices.find((item) => item.id === practice.id);
    updateDoc(practiceRef, { ...practice, dateUpdated: today() } as any).catch(() => emitError(practiceRef.path, 'update', practice));
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
  };

  const deletePractice = (id: string) => {
    const practiceRef = doc(refs.practices, id);
    deleteDoc(practiceRef).catch(() => emitError(practiceRef.path, 'delete'));
  };

  const addPhilosophicalLink = (data: Partial<PhilosophicalLink>) => {
    if (!data.fromType || !data.fromId || !data.toType || !data.toId || !data.type) return;
    const linkRef = doc(refs.links);
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
      dateCreated: today(),
      dateUpdated: today(),
    };
    setDoc(linkRef, payload).catch(() => emitError(linkRef.path, 'create', payload));
    createThinkingEvent({
      eventType: payload.type === 'contradicts' ? 'contradiction_detected' : 'link_created',
      targetType: payload.fromType,
      targetId: payload.fromId,
      relatedTargetType: payload.toType,
      relatedTargetId: payload.toId,
      sourceType: payload.createdFrom === 'manual' ? 'user' : payload.createdFrom === 'suggestion' ? 'ai' : 'system',
      summary: `${payload.type.replace(/_/g, ' ')} link created between ${payload.fromLabel || payload.fromId} and ${payload.toLabel || payload.toId}`,
    });
  };

  const updatePhilosophicalLink = (link: PhilosophicalLink) => {
    const linkRef = doc(refs.links, link.id);
    updateDoc(linkRef, { ...link, dateUpdated: today() } as any).catch(() => emitError(linkRef.path, 'update', link));
  };

  const deletePhilosophicalLink = (id: string) => {
    const linkRef = doc(refs.links, id);
    deleteDoc(linkRef).catch(() => emitError(linkRef.path, 'delete'));
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
    createThinkingEvent({ eventType: 'suggestion_created', targetType: 'suggestion', targetId: payload.id, sourceType: 'ai', summary: `Suggestion created: ${payload.title}` });
  };

  const updateAiSuggestion = (suggestion: AiSuggestion) => {
    const suggestionRef = doc(refs.suggestions, suggestion.id);
    updateDoc(suggestionRef, { ...suggestion, dateUpdated: today() } as any).catch(() => emitError(suggestionRef.path, 'update', suggestion));
    if (suggestion.status === 'accepted') {
      createThinkingEvent({ eventType: 'suggestion_accepted', targetType: 'suggestion', targetId: suggestion.id, sourceType: 'user', summary: `Suggestion accepted: ${suggestion.title}` });
    }
    if (suggestion.status === 'dismissed' || suggestion.status === 'ignored') {
      createThinkingEvent({ eventType: 'suggestion_dismissed', targetType: 'suggestion', targetId: suggestion.id, sourceType: 'user', summary: `Suggestion dismissed: ${suggestion.title}` });
    }
  };

  const addAtlasMap = (data: Partial<AtlasMap>) => {
    const mapRef = doc(refs.atlasMaps);
    const payload = {
      id: mapRef.id,
      title: data.title || 'Untitled Map',
      description: data.description || '',
      nodeNames: data.nodeNames || [],
      nodePositions: data.nodePositions || {},
      manualLinks: data.manualLinks || [],
      autoLinkFilters: data.autoLinkFilters || {
        sharedSources: true,
        sharedPositions: true,
        sharedInquiries: true,
        sharedWorks: true,
        sharedPractices: true,
        conceptLinks: true,
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

  const savePreferences = async (nextPreferences: UserPreferences) => {
    const payload = { ...nextPreferences, dateUpdated: today() };
    await setDoc(refs.settingsPreferences, payload, { merge: true });
  };

  const saveProfile = async (nextProfile: UserProfile) => {
    const payload = { ...nextProfile, email: user?.email || nextProfile.email || '', dateUpdated: today() };
    await setDoc(refs.settingsProfile, payload, { merge: true });
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

  const renderContent = () => {
    switch (view) {
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
            onAddAtlasMap={addAtlasMap}
            onUpdateAtlasMap={updateAtlasMap}
            onDeleteAtlasMap={deleteAtlasMap}
            onDeleteLink={deletePhilosophicalLink}
            onOpenPosition={(id) => {
              setFocusedPositionId(id);
              setView('vault');
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
            onFocusedSourceHandled={() => setFocusedSourceId(null)}
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
              setFocusedSourceId(sourceId);
              setView('library');
            }}
            onCreatePosition={createIdea}
            onCreateInquiry={addQuestion}
            onAddConcept={addConcept}
            onCreateSuggestion={addAiSuggestion}
            onCreateLink={addPhilosophicalLink}
            onNavigate={(nextView, targetId) => {
              if (nextView === 'vault' && targetId) setFocusedPositionId(targetId);
              if (nextView === 'questions' && targetId) setFocusedQuestionId(targetId);
              setView(nextView);
            }}
          />
        );
      case 'source-index':
        return <SourceIndex media={media} vault={vault} drafts={drafts} practices={practices} onOpenSource={(sourceId) => { setFocusedSourceId(sourceId); setView('library'); }} />;
      case 'goals':
        return <GoalsPage goal={goalState} goalProgress={goalProgress} onSaveGoal={saveGoal} />;
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
            focusedEntryId={focusedPositionId}
            onFocusedEntryHandled={() => setFocusedPositionId(null)}
          />
        );
      case 'questions':
        return <QuestionsWorkspace questions={questions} media={media} vault={vault} drafts={drafts} concepts={concepts} onAddQuestion={addQuestion} onUpdateQuestion={updateQuestion} onAddVaultEntry={addVaultEntry} onAddDraft={addDraft} onFormPositionFromInquiry={formPositionFromInquiry} focusedQuestionId={focusedQuestionId} onFocusedQuestionHandled={() => setFocusedQuestionId(null)} />;
      case 'writing':
        return <Atelier drafts={drafts} media={media} vault={vault} questions={questions} concepts={concepts} writingDefaults={preferences.writingDefaults} onAddDraft={addDraft} onUpdateDraft={updateDraft} onDeleteDraft={deleteDraft} onAddConcept={addConcept} />;
      case 'evolution':
        return <EvolutionTimeline events={timeline} media={media} thinkingEvents={thinkingEvents} unknowns={unknowns} thinkingPatterns={thinkingPatterns} metrics={thinkingMetrics} />;
      case 'practices':
        return <PracticesWorkspace practices={practices} concepts={concepts} media={media} questions={questions} positions={vault} drafts={drafts} onAddPractice={addPractice} onUpdatePractice={updatePractice} onDeletePractice={deletePractice} onAddConcept={addConcept} onCreateLink={addPhilosophicalLink} />;
      case 'settings':
        return (
          <SettingsPage
            user={user}
            profile={profile}
            preferences={preferences}
            unknowns={unknowns}
            thinkingPatterns={thinkingPatterns}
            thinkingMetrics={thinkingMetrics}
            featureFlags={featureFlags}
            onSaveProfile={saveProfile}
            onSavePreferences={savePreferences}
            onAddUnknown={addUnknown}
            onUpdateUnknown={updateUnknown}
            onAddThinkingPattern={addThinkingPattern}
            onUpdateThinkingPattern={updateThinkingPattern}
            onCreateSuggestion={addAiSuggestion}
            onUpdateSuggestion={updateAiSuggestion}
            aiContext={{
              positions: vault.map((item) => ({ title: item.title, statement: item.statement, confidence: item.confidence })),
              inquiries: questions.map((item) => item.text),
              works: drafts.map((item) => item.title),
              sources: media.map((item) => ({ title: item.title, type: item.type })),
              links: links.map((item) => ({ from: item.fromLabel || item.fromId, to: item.toLabel || item.toId, type: item.type })),
              thinkingEvents: thinkingEvents.map((item) => ({ eventType: item.eventType, summary: item.summary })),
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Shell
      activeView={view}
      onViewChange={setView}
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
      onOpenSettings={() => setView('settings')}
      movement={movement}
    >
      {isReviewWorkspace && (
        <div className="px-8 pt-8">
          <div className="mx-auto max-w-7xl rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-amber-500 text-black">Review Workspace</Badge>
                  <Badge variant="outline" className="rounded-full">Role: demo</Badge>
                  <Badge variant="outline" className="rounded-full">Scoped to /users/{effectiveUid}</Badge>
                </div>
                <h2 className="mt-3 font-headline text-2xl font-semibold italic text-foreground">Developer and demo environment is active.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  This workspace seeds realistic sources, annotations, inquiries, positions, works, practices, AI suggestions, and Atlas links so the app can be reviewed end to end without touching another user&apos;s data.
                </p>
                {!canSeedReviewWorkspace && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-700 dark:text-amber-300">
                    Sign in with <span className="font-code">{REVIEW_ACCOUNT_EMAIL}</span> or use demo mode to seed and refresh the dedicated review dataset. Your current account can still browse the app, but it will not overwrite its own workspace with demo content.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 font-code text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>{media.length} sources</span>
                  <span>{allAnnotations(media).length} annotations</span>
                  <span>{questions.length} inquiries</span>
                  <span>{vault.length} positions</span>
                  <span>{drafts.length} works</span>
                  <span>{practices.length} practices</span>
                  <span>{links.length} typed links</span>
                  <span>{suggestions.length} AI suggestions</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => seedReviewWorkspace(true)} disabled={isSeedingReview || !canSeedReviewWorkspace} className="rounded-full bg-card">
                  <FlaskConical className="mr-2 size-4" />
                  {isSeedingReview ? 'Refreshing Demo Data' : 'Refresh Demo Workspace'}
                </Button>
                <Button onClick={exportReviewArchitecture} className="rounded-full">
                  <Download className="mr-2 size-4" /> Export Architecture
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {renderContent()}
      <Toaster />
    </Shell>
  );
}

function ReadexApp({ reviewMode = false }: { reviewMode?: boolean }) {
  const { user, loading } = useUser();
  const [demoMode, setDemoMode] = useState(false);
  const allowDemo = reviewMode || process.env.NEXT_PUBLIC_ALLOW_PROTOTYPE_MODE === 'true';

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-accent" />
          <div className="font-code text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Syncing Mind</div>
        </div>
      </div>
    );
  }

  if (!user && !demoMode) {
    return (
      <>
        <LoginPage allowDemo={allowDemo} onDemo={() => allowDemo && setDemoMode(true)} />
        <Toaster />
      </>
    );
  }

  return <ReadexWorkspace user={user} uid={user?.uid || PROTOTYPE_USER_ID} reviewMode={reviewMode || demoMode} />;
}

export function NoesisHome({ reviewMode = false }: { reviewMode?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [firebaseInstances, setFirebaseInstances] = useState<FirebaseInstances | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isFirebaseConfigComplete) return;
    try {
      setFirebaseInstances(initializeFirebase());
    } catch (error) {
      setInitError(error instanceof Error ? error.message : 'Firebase initialization failed.');
    }
  }, [mounted]);

  if (mounted && !isFirebaseConfigComplete) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="max-w-xl rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
          <div className="font-code text-[10px] uppercase tracking-[0.22em] text-accent">Firebase setup required</div>
          <h1 className="mt-3 font-headline text-3xl font-semibold">Noesis needs your Firebase config.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Add these missing variables to `.env.local`, then restart the dev server.
          </p>
          <div className="mt-5 rounded-xl bg-muted/60 p-4 font-code text-xs leading-6 text-muted-foreground">
            {missingFirebaseConfigKeys.map((key) => <div key={key}>{key}</div>)}
          </div>
          <Button variant="outline" onClick={() => window.location.reload()} size="sm" className="mt-6 rounded-full">
            <RefreshCw className="mr-2 size-3.5" /> Reload Page
          </Button>
        </div>
      </div>
    );
  }

  if (mounted && initError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="max-w-xl rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm">
          <div className="font-code text-[10px] uppercase tracking-[0.22em] text-destructive">Firebase failed to start</div>
          <h1 className="mt-3 font-headline text-3xl font-semibold">Check your Firebase settings.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{initError}</p>
          <Button variant="outline" onClick={() => window.location.reload()} size="sm" className="mt-6 rounded-full">
            <RefreshCw className="mr-2 size-3.5" /> Reload Page
          </Button>
        </div>
      </div>
    );
  }

  if (!mounted || !firebaseInstances) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-6">
          <div className="font-code text-[10px] uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Initializing Noesis...</div>
          <Button variant="outline" onClick={() => window.location.reload()} size="sm" className="rounded-full">
            <RefreshCw className="size-3.5 mr-2" /> Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FirebaseClientProvider firebaseApp={firebaseInstances.firebaseApp} firestore={firebaseInstances.firestore} auth={firebaseInstances.auth}>
      <ReadexApp reviewMode={reviewMode} />
    </FirebaseClientProvider>
  );
}

export default function Home() {
  return <NoesisHome />;
}
