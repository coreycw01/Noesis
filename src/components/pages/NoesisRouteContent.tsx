"use client";

import type { User } from 'firebase/auth';
import dynamic from 'next/dynamic';
import type {
  AccountSettings,
  AiSettings,
  AiSuggestion,
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

export interface NoesisRouteContentProps {
  activeView: NoesisView;
  user: User | null;
  effectiveUid: string;
  isReviewWorkspace: boolean;
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
  suggestions: AiSuggestion[];
  thinkingEvents: ThinkingEvent[];
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
  refreshingDemoWorkspace: boolean;
  navigateToView: (view: NoesisView, options?: {
    conceptId?: string | null;
    questionId?: string | null;
    sourceId?: string | null;
    positionId?: string | null;
    workId?: string | null;
    practiceId?: string | null;
  }) => void;
  addQuestion: (data: Partial<Question>) => Question | void;
  updateQuestion: (question: Question) => void;
  deleteQuestion: (id: string) => void;
  formPositionFromInquiry: (question: Question, position: { title: string; statement: string; description: string; confidence: number }, finalAnswer: string) => void;
  addConcept: (data: Partial<Concept>) => Concept | void;
  updateConcept: (concept: Concept) => void;
  deleteConcept: (id: string) => void;
  addMedia: (data: Partial<Media>) => Media | void;
  updateMedia: (media: Media) => void;
  deleteMedia: (id: string) => void;
  updateAnnotation: (sourceId: string, annotation: Annotation) => void;
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
  }) => { positionId: string; insightId: string; title: string };
  addAiSuggestion: (suggestion: Partial<AiSuggestion>) => void;
  updateAiSuggestion: (suggestion: AiSuggestion) => void;
  addPhilosophicalLink: (data: Partial<PhilosophicalLink>) => void;
  addAtlasQuickLink: (data: Partial<PhilosophicalLink>) => void;
  updatePhilosophicalLink: (link: PhilosophicalLink) => void;
  deletePhilosophicalLink: (id: string) => void;
  markPhilosophicalLinkInteraction: (id: string) => void;
  addAtlasMap: (data: Partial<AtlasMap>) => AtlasMap | void;
  updateAtlasMap: (map: AtlasMap) => void;
  deleteAtlasMap: (id: string) => void;
  addVaultEntry: (data: Partial<VaultEntry>) => VaultEntry | void;
  updateVaultEntry: (entry: VaultEntry) => void;
  deleteVaultEntry: (id: string) => Promise<void>;
  addDraft: (data: Partial<Draft>) => Draft | void;
  updateDraft: (draft: Draft) => void;
  markDraftOpened: (draft: Draft) => void | Promise<void>;
  deleteDraft: (id: string) => void;
  addPractice: (data: Partial<Practice>) => Practice | void;
  updatePractice: (practice: Practice) => void;
  deletePractice: (id: string) => void;
  addUnknown: (data: Partial<Unknown>) => Unknown;
  updateUnknown: (unknown: Unknown) => void;
  updateThinkingPattern: (pattern: ThinkingPattern) => void;
  saveGoal: (goal: GoalSettings) => Promise<void>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  saveProfilePrivacy: (privacy: ProfilePrivacySettings) => Promise<void>;
  saveSettingsSection: (
    section: 'account' | 'appearance' | 'workspace' | 'ai' | 'metacognition' | 'privacy' | 'data' | 'sourceIntake' | 'works' | 'atlas' | 'notifications' | 'goals' | 'developer',
    data: unknown,
  ) => Promise<void>;
  exportWorkspaceData: () => Promise<void>;
  seedReviewWorkspace: (options?: { force?: boolean; preserveUserCreated?: boolean }) => void | Promise<void>;
}

export function NoesisRouteContent({
  activeView,
  user,
  effectiveUid,
  isReviewWorkspace,
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
  suggestions,
  thinkingEvents,
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
  addAiSuggestion,
  updateAiSuggestion,
  addPhilosophicalLink,
  addAtlasQuickLink,
  updatePhilosophicalLink,
  deletePhilosophicalLink,
  markPhilosophicalLinkInteraction,
  addAtlasMap,
  updateAtlasMap,
  deleteAtlasMap,
  addVaultEntry,
  updateVaultEntry,
  deleteVaultEntry,
  addDraft,
  updateDraft,
  markDraftOpened,
  deleteDraft,
  addPractice,
  updatePractice,
  deletePractice,
  addUnknown,
  updateUnknown,
  updateThinkingPattern,
  saveGoal,
  saveProfile,
  saveProfilePrivacy,
  saveSettingsSection,
  exportWorkspaceData,
  seedReviewWorkspace,
}: NoesisRouteContentProps) {
  switch (activeView) {
    case 'home':
      return (
        <HomeRoutePage
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
          goal={goalState}
          goalProgress={goalProgress}
          onCreateInquiry={(data) => addQuestion(data) as Question}
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
          onNavigate={navigateToView}
        />
      );
    case 'annotations':
      return (
        <AnnotationsRoutePage
          media={media}
          concepts={concepts}
          positions={vault}
          inquiries={questions}
          onUpdateAnnotation={updateAnnotation}
          onDeleteAnnotation={deleteAnnotation}
          onCreatePosition={createIdea}
          onCreateInquiry={(data) => addQuestion(data) as Question}
          onAddConcept={addConcept}
          onCreateSuggestion={addAiSuggestion}
          onCreateLink={addPhilosophicalLink}
          onNavigate={navigateToView}
        />
      );
    case 'source-index':
      return <SourceIndexRoutePage media={media} vault={vault} drafts={drafts} practices={practices} questions={questions} onNavigate={navigateToView} />;
    case 'goals':
      return <GoalsRoutePage goal={goalState} goalProgress={goalProgress} onSaveGoal={saveGoal} />;
    case 'profile':
      return (
        <ProfileRoutePage
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
          onNavigate={navigateToView}
        />
      );
    case 'vault':
      return (
        <PositionsRoutePage
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
          onAddQuestion={(data) => addQuestion(data) as Question}
          onCreateIdea={createIdea}
          onUpdateLink={updatePhilosophicalLink}
          onAddUnknown={addUnknown}
          onUpdateSuggestion={updateAiSuggestion}
          onCreateSuggestion={addAiSuggestion}
          focusedEntryId={focusedPositionId}
          onNavigate={navigateToView}
        />
      );
    case 'questions':
      return <InquiriesRoutePage questions={questions} media={media} vault={vault} drafts={drafts} practices={practices} concepts={concepts} onAddQuestion={(data) => addQuestion(data) as Question} onUpdateQuestion={updateQuestion} onDeleteQuestion={deleteQuestion} onAddVaultEntry={addVaultEntry} onAddDraft={(data) => addDraft(data) as Draft} onUpdateDraft={updateDraft} onAddPractice={(data) => addPractice(data) as Practice} onUpdatePractice={updatePractice} onFormPositionFromInquiry={formPositionFromInquiry} focusedQuestionId={focusedQuestionId} onNavigate={navigateToView} />;
    case 'writing':
      return <WorksRoutePage uid={effectiveUid} drafts={drafts} media={media} vault={vault} questions={questions} concepts={concepts} writingDefaults={preferences.writingDefaults} onAddDraft={(data) => addDraft(data) as Draft} onUpdateDraft={updateDraft} onMarkDraftOpened={markDraftOpened} onDeleteDraft={deleteDraft} onAddConcept={addConcept} focusedDraftId={focusedWorkId} onNavigate={navigateToView} />;
    case 'evolution':
      return <EvolutionRoutePage events={timeline} media={media} thinkingEvents={thinkingEvents} unknowns={unknowns} thinkingPatterns={thinkingPatterns} metrics={thinkingMetrics} />;
    case 'practices':
      return <PracticesRoutePage practices={practices} concepts={concepts} media={media} questions={questions} positions={vault} drafts={drafts} onAddPractice={addPractice} onUpdatePractice={updatePractice} onDeletePractice={deletePractice} onAddConcept={addConcept} onCreateLink={addPhilosophicalLink} focusedPracticeId={focusedPracticeId} onNavigate={navigateToView} />;
    case 'settings':
      return (
        <SettingsRoutePage
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
