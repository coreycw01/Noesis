"use client";

import type { User } from 'firebase/auth';
import type { RefObject } from 'react';
import type { SettingsDraftCache } from '@/components/Settings/SettingsPage';
import dynamic from 'next/dynamic';
import type {
  AccountSettings,
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
  Practice,
  PrivacySettings,
  ProfileMetacognitionSummary,
  ProfilePrivacySettings,
  PublicProfileSnapshot,
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
import type { WorkVersion } from '@/lib/work-recovery';
import type { ContextDeskWorkOrigin } from '@/lib/context-desk-work';
import type { ProfileReviewApproval } from '@/lib/profile-edit';
import { allQuestions } from '@/lib/readex';

const HomeRoutePage = dynamic(() => import('./HomeRoutePage').then((module) => module.HomeRoutePage));
const AtlasRoutePage = dynamic(() => import('./AtlasRoutePage').then((module) => module.AtlasRoutePage), { ssr: false });
const ConceptsRoutePage = dynamic(() => import('./ConceptsRoutePage').then((module) => module.ConceptsRoutePage));
const LibraryRoutePage = dynamic(() => import('./LibraryRoutePage').then((module) => module.LibraryRoutePage));
const SourceIndexRoutePage = dynamic(() => import('./SourceIndexRoutePage').then((module) => module.SourceIndexRoutePage));
const AnnotationsRoutePage = dynamic(() => import('./AnnotationsRoutePage').then((module) => module.AnnotationsRoutePage));
const GoalsRoutePage = dynamic(() => import('./GoalsRoutePage').then((module) => module.GoalsRoutePage));
const ProfileRoutePage = dynamic(() => import('./ProfileRoutePage').then((module) => module.ProfileRoutePage));
const InquiriesRoutePage = dynamic(() => import('./InquiriesRoutePage').then((module) => module.InquiriesRoutePage));
const PracticesRoutePage = dynamic(() => import('./PracticesRoutePage').then((module) => module.PracticesRoutePage));
const EvolutionRoutePage = dynamic(() => import('./EvolutionRoutePage').then((module) => module.EvolutionRoutePage));
const SettingsRoutePage = dynamic(() => import('./SettingsRoutePage').then((module) => module.SettingsRoutePage));
const PositionsRoutePage = dynamic(() => import('./PositionsRoutePage').then((module) => module.PositionsRoutePage));
const WorksRoutePage = dynamic(() => import('./WorksRoutePage').then((module) => module.WorksRoutePage), { ssr: false });
const ContextDeskRoutePage = dynamic(() => import('./ContextDeskRoutePage').then((module) => module.ContextDeskRoutePage));

export interface NoesisRouteContentProps {
  activeView: NoesisView;
  user: User | null;
  effectiveUid: string;
  isReviewWorkspace: boolean;
  isOfflineReviewPreview: boolean;
  media: Media[];
  concepts: Concept[];
  insights: Insight[];
  questions: Question[];
  vault: VaultEntry[];
  drafts: Draft[];
  practices: Practice[];
  timeline: TimelineEvent[];
  atlasMaps: AtlasMap[];
  links: PhilosophicalLink[];
  thinkingEvents: ThinkingEvent[];
  thinkingEventsHasMore: boolean;
  loadMoreThinkingEvents: () => void;
  historyLoadingOlder: boolean;
  historyOlderError: boolean;
  beliefProfiles: BeliefProfile[];
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  thinkingMetrics: ThinkingMetrics;
  profile: UserProfile;
  profilePrivacy: ProfilePrivacySettings;
  profileMetacognitionSummary: ProfileMetacognitionSummary;
  preferences: UserPreferences;
  workspace: WorkspaceSettings;
  accountSettings: AccountSettings;
  appearanceSettings: AppearanceSettings;
  workspacePreferences: WorkspacePreferenceSettings;
  aiSettings: AiSettings;
  metacognitionSettings: MetacognitionSettings;
  privacySettings: PrivacySettings;
  dataSettings: DataSettings;
  sourceIntakeSettings: SourceIntakeSettings;
  worksSettings: WorksSettings;
  atlasSettings: AtlasSettings;
  notificationSettings: NotificationSettings;
  goalPreferenceSettings: GoalPreferenceSettings;
  developerSettings: DeveloperSettings;
  goalState: GoalSettings;
  goalProgress: Record<MediaType, number>;
  focusedConceptId: string | null;
  focusedSourceId: string | null;
  focusedPositionId: string | null;
  focusedQuestionId: string | null;
  focusedWorkId: string | null;
  focusedPracticeId: string | null;
  focusedGoalId: string | null;
  focusedAnnotationSourceId: string | null;
  focusedAnnotationId: string | null;
  refreshingDemoWorkspace: boolean;
  navigateToView: (view: NoesisView, options?: {
    conceptId?: string | null;
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
    goalId?: string | null;
    annotationSourceId?: string | null;
    annotationId?: string | null;
  }) => void;
  addQuestion: (data: Partial<Question> & { annotationRefs?: Array<{ sourceId: string; annotationId: string }> }) => Promise<Question>;
  updateQuestion: (question: Question) => void | Promise<void>;
  saveInquiryAiReview: (inquiryId: string, review: import('@/lib/inquiry-ai-review').InquiryAiReview, content: string) => Promise<void>;
  deleteQuestion: (id: string) => void | Promise<void>;
  formPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => Promise<VaultEntry>;
  addConcept: (data: Partial<Concept>) => Promise<boolean>;
  updateConcept: (concept: Concept, approval?: import('@/lib/concept-ai-review').ConceptReviewApproval) => void | Promise<void>;
  deleteConcept: (id: string) => void;
  addMedia: (data: Partial<Media>) => Media | void | Promise<void>;
  updateMedia: (media: Media, base?: Pick<Partial<Media>, 'dateUpdated'>, approval?: import('@/lib/source-ai-review').SourceReviewApproval) => void | Promise<unknown>;
  deleteMedia: (id: string) => void;
  updateAnnotation: (sourceId: string, annotation: Annotation, approval?: import('@/lib/annotation-ai-review').AnnotationReviewApproval) => void | Promise<Annotation | void>;
  deleteAnnotation: (sourceId: string, annotationId: string) => Promise<void>;
  createIdea: (data: {
    title: string;
    body: string;
    tags: string[];
    sourceIds: string[];
    sourceAnnotationId?: string;
    position?: {
      title: string;
      statement: string;
      description: string;
      confidence: number;
    };
  }) => Promise<{ positionId: string; insightId: string; title: string }>;
  addPhilosophicalLink: (data: Partial<PhilosophicalLink>) => void;
  addAtlasQuickLink: (data: Partial<PhilosophicalLink>) => void | Promise<void>;
  updatePhilosophicalLink: (link: PhilosophicalLink) => void;
  deletePhilosophicalLink: (id: string, options?: { method?: string }) => Promise<void>;
  markPhilosophicalLinkInteraction: (id: string) => void;
  addAtlasMap: (data: Partial<AtlasMap>) => Promise<string>;
  updateAtlasMap: (map: AtlasMap, rethrow?: boolean) => void | Promise<void>;
  moveAtlasMapNode: (mapId: string, key: string, position: { x: number; y: number }) => Promise<void>;
  deleteAtlasMap: (id: string) => Promise<void>;
  addVaultEntry: (data: Partial<VaultEntry> & { annotationRefs?: Array<{ sourceId: string; annotationId: string }> }) => Promise<VaultEntry>;
  updateVaultEntry: (entry: VaultEntry, approval?: import('@/lib/position-ai-review').PositionReviewApproval) => void | Promise<void>;
  deleteVaultEntry: (id: string) => Promise<void>;
  addDraft: (data: Partial<Draft>, origin?: ContextDeskWorkOrigin) => Promise<Draft>;
  linkInquiryItem: (inquiryId: string, type: 'work' | 'practice', itemId: string) => Promise<void>;
  updateDraft: (draft: Draft, expectedVersion?: WorkVersion) => Promise<Draft>;
  markDraftOpened: (draft: Draft) => void | Promise<void>;
  deleteDraft: (id: string) => void;
  addPractice: (data: Partial<Practice>) => Promise<Practice>;
  updatePractice: (practice: Practice, approval?: import('@/lib/practice-ai-review').PracticeReviewApproval) => void | Promise<Practice | void>;
  deletePractice: (id: string) => void;
  addUnknown: (data: Partial<Unknown>) => Unknown;
  updateUnknown: (unknown: Unknown) => void;
  updateThinkingPattern: (pattern: ThinkingPattern) => void;
  addTimelineEvent: (event: TimelineEvent, result?: import('@/lib/contextual-ai').AiReviewResult, eventIds?: readonly string[]) => void | Promise<void>;
  saveGoal: import('@/lib/goal-persistence').SaveGoalPlan;
  saveGoalCheckIn: import('@/lib/goal-persistence').SaveGoalCheckIn;
  saveProfile: (profile: Partial<UserProfile>, approval?: ProfileReviewApproval) => Promise<void>;
  saveProfilePrivacy: (privacy: ProfilePrivacySettings, snapshot: PublicProfileSnapshot, expectedVersion: { dateUpdated?: string }) => Promise<ProfilePrivacySettings>;
  saveSettingsSection: (
    section: 'account' | 'appearance' | 'workspace' | 'ai' | 'metacognition' | 'privacy' | 'data' | 'sourceIntake' | 'works' | 'atlas' | 'notifications' | 'goals' | 'developer',
    data: unknown,
  ) => Promise<void>;
  exportWorkspaceData: () => Promise<void>;
  settingsDraftCache: RefObject<SettingsDraftCache | null>;
  seedReviewWorkspace: (options?: { force?: boolean; preserveUserCreated?: boolean }) => void | Promise<void>;
  restoreDeletedItem: (event: ThinkingEvent) => Promise<void>;
  recentDeletedItems: ThinkingEvent[];
  recentDeletedLoading: boolean;
  recentDeletedError: boolean;
  onRecoveryPanelChange: (active: boolean) => void;
  onRetryDeletedItems: () => void;
}

export function NoesisRouteContent({
  activeView,
  user,
  effectiveUid,
  isReviewWorkspace,
  isOfflineReviewPreview,
  media,
  concepts,
  insights,
  questions,
  vault,
  drafts,
  practices,
  timeline,
  atlasMaps,
  links,
  thinkingEvents,
  thinkingEventsHasMore,
  loadMoreThinkingEvents,
  historyLoadingOlder,
  historyOlderError,
  beliefProfiles,
  unknowns,
  thinkingPatterns,
  thinkingMetrics,
  profile,
  profilePrivacy,
  profileMetacognitionSummary,
  preferences,
  workspace,
  accountSettings,
  appearanceSettings,
  workspacePreferences,
  aiSettings,
  metacognitionSettings,
  privacySettings,
  dataSettings,
  sourceIntakeSettings,
  worksSettings,
  atlasSettings,
  notificationSettings,
  goalPreferenceSettings,
  developerSettings,
  goalState,
  goalProgress,
  focusedConceptId,
  focusedSourceId,
  focusedPositionId,
  focusedQuestionId,
  focusedWorkId,
  focusedPracticeId,
  focusedGoalId,
  focusedAnnotationSourceId,
  focusedAnnotationId,
  refreshingDemoWorkspace,
  navigateToView,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  formPositionFromInquiry,
  addConcept,
  updateConcept,
  deleteConcept,
  addMedia,
  updateMedia,
  deleteMedia,
  updateAnnotation,
  deleteAnnotation,
  createIdea,
  addPhilosophicalLink,
  addAtlasQuickLink,
  updatePhilosophicalLink,
  deletePhilosophicalLink,
  markPhilosophicalLinkInteraction,
  addAtlasMap,
  updateAtlasMap,
  moveAtlasMapNode,
  deleteAtlasMap,
  addVaultEntry,
  updateVaultEntry,
  deleteVaultEntry,
  addDraft,
  linkInquiryItem,
  saveInquiryAiReview,
  updateDraft,
  markDraftOpened,
  deleteDraft,
  addPractice,
  updatePractice,
  deletePractice,
  addUnknown,
  updateUnknown,
  updateThinkingPattern,
  addTimelineEvent,
  saveGoal,
  saveGoalCheckIn,
  saveProfile,
  saveProfilePrivacy,
  saveSettingsSection,
  exportWorkspaceData,
  settingsDraftCache,
  seedReviewWorkspace,
  restoreDeletedItem,
  recentDeletedItems,
  recentDeletedLoading,
  recentDeletedError,
  onRecoveryPanelChange,
  onRetryDeletedItems,
}: NoesisRouteContentProps) {
  const canonicalInquiries = allQuestions(media, questions);
  switch (activeView) {
    case 'home':
      return (
        <HomeRoutePage
          profile={profile}
          concepts={concepts}
          media={media}
          inquiries={canonicalInquiries}
          positions={vault}
          works={drafts}
          practices={practices}
          timeline={timeline}
          thinkingEvents={thinkingEvents}
          unknowns={unknowns}
          links={links}
          goal={goalState}
          showCommitments={goalPreferenceSettings.showGoalsOnDashboard}
          goalProgress={goalProgress}
          onCreateInquiry={addQuestion}
          onNavigate={navigateToView}
        />
      );
    case 'atlas':
      return (
        <AtlasRoutePage
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
          onUpdateLink={updatePhilosophicalLink}
          onAddAtlasMap={addAtlasMap}
          onUpdateAtlasMap={updateAtlasMap}
          onMoveAtlasMapNode={moveAtlasMapNode}
          onDeleteAtlasMap={deleteAtlasMap}
          onDeleteLink={deletePhilosophicalLink}
          onInteractLink={markPhilosophicalLinkInteraction}
          uid={effectiveUid}
          onNavigate={navigateToView}
        />
      );
    case 'concepts':
      return (
        <ConceptsRoutePage
          aiSettings={aiSettings}
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
          onCreateLink={addPhilosophicalLink}
          focusedConceptId={focusedConceptId}
          onNavigate={navigateToView}
        />
      );
    case 'library':
      return (
        <LibraryRoutePage
          aiSettings={aiSettings}
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
          onCreateClaim={(data) => addVaultEntry({
            title: data.title,
            statement: data.title,
            description: data.body,
            confidenceReasoning: data.body,
            confidence: 60,
            status: 'developing',
            tags: data.tags,
            sourceIds: data.sourceIds,
            createdFrom: 'manual',
          })}
          onDeleteVaultEntry={deleteVaultEntry}
          focusedSourceId={focusedSourceId}
          onNavigate={navigateToView}
        />
      );
    case 'annotations':
      return (
        <AnnotationsRoutePage
          aiSettings={aiSettings}
          media={media}
          concepts={concepts}
          positions={vault}
          inquiries={questions}
          onUpdateAnnotation={updateAnnotation}
          onDeleteAnnotation={deleteAnnotation}
          onCreatePosition={async (data) => {
            const created = await addVaultEntry({
              title: data.position?.title || data.title,
              statement: data.position?.statement || data.title,
              description: data.position?.description || data.body,
              confidence: data.position?.confidence ?? 60,
              status: 'developing',
              tags: data.tags,
              sourceIds: data.sourceIds,
              sourceAnnotationId: data.sourceAnnotationId,
              annotationRefs: data.annotationRefs,
              createdFrom: 'annotation',
            });
            return { positionId: created.id, insightId: '', title: created.title };
          }}
          onCreateInquiry={addQuestion}
          onAddConcept={addConcept}
          onCreateLink={addPhilosophicalLink}
          focusedAnnotationSourceId={focusedAnnotationSourceId}
          focusedAnnotationId={focusedAnnotationId}
          onNavigate={navigateToView}
        />
      );
    case 'source-index':
      return <SourceIndexRoutePage media={media} vault={vault} drafts={drafts} practices={practices} questions={questions} onNavigate={navigateToView} />;
    case 'goals':
      return <GoalsRoutePage goal={goalState} goalProgress={goalProgress} concepts={concepts} inquiries={questions} sources={media} positions={vault} works={drafts} practices={practices} profile={profile} onSaveGoal={saveGoal} onSaveCheckIn={saveGoalCheckIn} focusedGoalId={focusedGoalId} onOpenCommitment={(goalId) => navigateToView('goals', { goalId })} onOpenPraxis={(method) => {
        try { window.localStorage.setItem('noesis:labs-tool', method); } catch { /* Optional view preference. */ }
        navigateToView('labs');
      }} />;
    case 'profile':
      return (
        <ProfileRoutePage
          user={user}
          reviewMode={isReviewWorkspace}
          profile={profile}
          aiSettings={aiSettings}
          privacy={profilePrivacy}
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
          onUpdateUnknown={updateUnknown}
          onUpdateThinkingPattern={updateThinkingPattern}
          onNavigate={navigateToView}
        />
      );
    case 'vault':
      return (
        <PositionsRoutePage
          aiSettings={aiSettings}
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
          onAddEntry={addVaultEntry}
          onUpdateEntry={updateVaultEntry}
          onDeleteEntry={deleteVaultEntry}
          onAddConcept={addConcept}
          onCreateLink={addPhilosophicalLink}
          onAddDraft={addDraft}
          onAddPractice={addPractice}
          onAddQuestion={addQuestion}
          onUpdateLink={updatePhilosophicalLink}
          focusedEntryId={focusedPositionId}
          onNavigate={navigateToView}
        />
      );
    case 'questions':
      return <InquiriesRoutePage aiSettings={aiSettings} questions={questions} media={media} vault={vault} drafts={drafts} practices={practices} concepts={concepts} onAddQuestion={addQuestion} onUpdateQuestion={updateQuestion} onSaveAiReview={saveInquiryAiReview} onDeleteQuestion={deleteQuestion} onAddVaultEntry={addVaultEntry} onAddDraft={addDraft} onLinkItem={linkInquiryItem} onAddPractice={addPractice} onFormPositionFromInquiry={formPositionFromInquiry} focusedQuestionId={focusedQuestionId} onNavigate={navigateToView} />;
    case 'writing':
      return <WorksRoutePage uid={effectiveUid} isReviewWorkspace={isOfflineReviewPreview} drafts={drafts} media={media} vault={vault} questions={questions} concepts={concepts} writingDefaults={preferences.writingDefaults} onAddDraft={addDraft} onUpdateDraft={updateDraft} onMarkDraftOpened={markDraftOpened} onDeleteDraft={deleteDraft} onAddConcept={addConcept} focusedDraftId={focusedWorkId} onNavigate={navigateToView} />;
    case 'context-desk':
      return (
        <ContextDeskRoutePage
          aiSettings={aiSettings}
          media={media}
          concepts={concepts}
          questions={questions}
          positions={vault}
          works={drafts}
          practices={practices}
          onAddDraft={addDraft}
          onNavigate={(view, targetId, annotationSourceId) => navigateToView(view as NoesisView, {
            annotationId: view === 'annotations' ? targetId : null,
            annotationSourceId: view === 'annotations' ? annotationSourceId : null,
            conceptId: view === 'concepts' ? targetId : null,
            questionId: view === 'questions' ? targetId : null,
            sourceId: view === 'library' ? targetId : null,
            positionId: view === 'vault' ? targetId : null,
            workId: view === 'writing' ? targetId : null,
            practiceId: view === 'labs' ? targetId : null,
          })}
        />
      );
    case 'evolution':
      return <EvolutionRoutePage aiSettings={aiSettings} events={timeline} media={media} thinkingEvents={thinkingEvents} thinkingEventsHasMore={thinkingEventsHasMore} loadMoreThinkingEvents={loadMoreThinkingEvents} historyLoadingOlder={historyLoadingOlder} historyOlderError={historyOlderError} unknowns={unknowns} thinkingPatterns={thinkingPatterns} onSaveSynthesis={addTimelineEvent} />;
    case 'labs':
      return <PracticesRoutePage aiSettings={aiSettings} practices={practices} concepts={concepts} media={media} questions={questions} positions={vault} drafts={drafts} links={links} onAddPractice={addPractice} onUpdatePractice={updatePractice} onDeletePractice={deletePractice} onAddConcept={addConcept} onCreateLink={addPhilosophicalLink} focusedPracticeId={focusedPracticeId} onNavigate={navigateToView} />;
    case 'settings':
      return (
        <SettingsRoutePage
          user={user}
          draftCache={settingsDraftCache}
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
          recentDeletedItems={recentDeletedItems}
          recentDeletedLoading={recentDeletedLoading}
          recentDeletedError={recentDeletedError}
          onRecoveryPanelChange={onRecoveryPanelChange}
          onRetryDeletedItems={onRetryDeletedItems}
          onRestoreDeletedItem={restoreDeletedItem}
          onRefreshDemoWorkspace={() => Promise.resolve(seedReviewWorkspace({ force: true }))}
          refreshingDemoWorkspace={refreshingDemoWorkspace}
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
}
