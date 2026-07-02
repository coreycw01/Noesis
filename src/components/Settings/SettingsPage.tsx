"use client";

import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { Download, LogOut, RefreshCw, Save, Shield, Wrench } from 'lucide-react';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { noesisGuide } from '@/lib/noesis-guide';
import {
  MEDIA_LABELS,
  WRITING_STYLE_LABELS,
  WRITING_STYLES,
  DRAFT_LABELS,
} from '@/lib/readex';
import type {
  AccountSettings,
  AiSettings,
  AppearanceSettings,
  AtlasSettings,
  DataSettings,
  DeveloperSettings,
  GoalPreferenceSettings,
  MediaType,
  MetacognitionSettings,
  NotificationSettings,
  PrivacySettings,
  SourceIntakeSettings,
  UserPreferences,
  WorksSettings,
  WorkspacePreferenceSettings,
} from '@/lib/types';

type SettingsState = {
  account: AccountSettings;
  appearance: AppearanceSettings;
  workspace: WorkspacePreferenceSettings;
  ai: AiSettings;
  metacognition: MetacognitionSettings;
  privacy: PrivacySettings;
  data: DataSettings;
  sourceIntake: SourceIntakeSettings;
  works: WorksSettings;
  atlas: AtlasSettings;
  notifications: NotificationSettings;
  goals: GoalPreferenceSettings;
  developer: DeveloperSettings;
};

type SettingsSectionKey = keyof SettingsState;
type SettingsPanelId =
  | 'account'
  | 'profile'
  | 'appearance'
  | 'workspace'
  | 'works'
  | 'ai'
  | 'data'
  | 'privacy'
  | 'help';

interface SettingsPageProps {
  user: User | null;
  settings: SettingsState;
  reviewMode: boolean;
  onSaveSection: (section: SettingsSectionKey, value: SettingsState[SettingsSectionKey]) => Promise<void>;
  onExportWorkspace: () => void;
  onOpenProfile?: () => void;
  onRefreshDemoWorkspace?: () => Promise<void>;
  refreshingDemoWorkspace?: boolean;
  profileSummary?: {
    displayName?: string;
    email?: string;
    role?: string;
    bio?: string;
    workspaceMode?: string;
  };
}

const mediaTypes: MediaType[] = ['book', 'audiobook', 'podcast', 'video', 'movie', 'article', 'course', 'lecture', 'documentary', 'interview', 'conversation', 'paper', 'other'];
const SETTINGS_SECTION_STORAGE_KEY = 'noesis:settings-section';

const SETTINGS_PANELS: Array<{ id: SettingsPanelId; label: string; description: string }> = [
  { id: 'account', label: 'Account', description: 'Login, export, and sign-out controls.' },
  { id: 'profile', label: 'Profile', description: 'Identity and workspace context.' },
  { id: 'appearance', label: 'Appearance', description: 'Theme, color, density, and display feel.' },
  { id: 'workspace', label: 'Workspace', description: 'Navigation, intake defaults, Atlas, and reminders.' },
  { id: 'works', label: 'Writing Defaults', description: 'Work creation defaults and editor behavior.' },
  { id: 'ai', label: 'AI Preferences', description: 'Suggestion, analysis, and metacognition controls.' },
  { id: 'data', label: 'Data & Demo Workspace', description: 'Export, review data, and demo refresh tools.' },
  { id: 'privacy', label: 'Privacy & Permissions', description: 'Visibility and sharing defaults.' },
  { id: 'help', label: 'Help / Usage Guide', description: 'How the Noesis hierarchy fits together.' },
];

export function SettingsPage({
  user,
  settings,
  reviewMode,
  onSaveSection,
  onExportWorkspace,
  onOpenProfile,
  onRefreshDemoWorkspace,
  refreshingDemoWorkspace = false,
  profileSummary,
}: SettingsPageProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<SettingsState>(settings);
  const [saving, setSaving] = useState<SettingsSectionKey | 'reset' | 'refresh-demo' | null>(null);
  const [activePanel, setActivePanel] = useState<SettingsPanelId>('account');

  useEffect(() => setDrafts(settings), [settings]);

  useEffect(() => {
    const saved = window.localStorage.getItem(SETTINGS_SECTION_STORAGE_KEY) as SettingsPanelId | null;
    if (saved && SETTINGS_PANELS.some((panel) => panel.id === saved)) {
      setActivePanel(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, activePanel);
  }, [activePanel]);

  const appearancePreview = useMemo(
    () => ({
      themeMode: drafts.appearance.themeMode,
      accentTheme: drafts.appearance.accentTheme,
    }),
    [drafts.appearance]
  );

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const systemDark = mediaQuery.matches;
      const dark = appearancePreview.themeMode === 'dark' || (appearancePreview.themeMode === 'system' && systemDark);
      root.classList.toggle('dark', dark);
      root.dataset.theme = appearancePreview.accentTheme;
    };
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [appearancePreview]);

  const saveSection = async (section: SettingsSectionKey) => {
    setSaving(section);
    try {
      await onSaveSection(section, drafts[section]);
      toast({ title: `${sectionLabel(section)} saved`, description: `Your ${sectionLabel(section).toLowerCase()} settings are updated.` });
    } catch {
      toast({ variant: 'destructive', title: 'Settings not saved', description: `Noesis could not save the ${sectionLabel(section).toLowerCase()} section.` });
    } finally {
      setSaving(null);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    setSaving('reset');
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({ title: 'Reset email sent', description: 'Check your inbox for the password reset link.' });
    } catch {
      toast({ variant: 'destructive', title: 'Reset failed', description: 'Firebase could not send the reset email.' });
    } finally {
      setSaving(null);
    }
  };

  const refreshDemoWorkspace = async () => {
    if (!onRefreshDemoWorkspace) return;
    setSaving('refresh-demo');
    try {
      await onRefreshDemoWorkspace();
      toast({ title: 'Demo workspace refreshed', description: 'The review dataset has been reseeded and reloaded.' });
    } catch {
      toast({ variant: 'destructive', title: 'Refresh failed', description: 'Noesis could not reseed the demo workspace.' });
    } finally {
      setSaving(null);
    }
  };

  const currentPanel = SETTINGS_PANELS.find((panel) => panel.id === activePanel) || SETTINGS_PANELS[0];
  const helpSections = noesisGuide.sections.filter((section) => !['profile', 'goals'].includes(section.id));

  const renderPanel = () => {
    switch (activePanel) {
      case 'account':
        return (
          <div className="space-y-6">
            <SettingsCard title="Account" description="Authentication, account state, and export controls.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Email">
                  <Input value={drafts.account.authEmail || user?.email || ''} disabled />
                </Field>
                <Field label="Connected Login Methods">
                  <Input value={(drafts.account.connectedLoginMethods || []).join(', ') || 'password'} disabled />
                </Field>
                <Field label="Account Created">
                  <Input value={drafts.account.accountCreatedAt || user?.metadata?.creationTime || 'Unknown'} disabled />
                </Field>
                <Field label="Authentication Status">
                  <Input value={user ? 'Signed in' : 'Signed out'} disabled />
                </Field>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="outline" onClick={resetPassword} disabled={!user?.email || saving === 'reset'} className="rounded-full bg-card px-6">
                  Reset Password
                </Button>
                <Button variant="outline" onClick={onExportWorkspace} className="rounded-full bg-card px-6">
                  <Download className="mr-2 size-4" />
                  Export Account Data
                </Button>
                <Button variant="ghost" onClick={() => signOut(auth)} className="rounded-full text-destructive hover:text-destructive">
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </Button>
              </div>
            </SettingsCard>
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-6">
            <SettingsCard title="Profile" description="Identity belongs near the app title, not buried inside system controls.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display Name">
                  <Input value={profileSummary?.displayName || 'No profile yet'} disabled />
                </Field>
                <Field label="Email">
                  <Input value={profileSummary?.email || user?.email || ''} disabled />
                </Field>
                <Field label="Role">
                  <Input value={profileSummary?.role || 'reader'} disabled />
                </Field>
                <Field label="Workspace Mode">
                  <Input value={profileSummary?.workspaceMode || 'private'} disabled />
                </Field>
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                {profileSummary?.bio || 'Use the profile icon near the Noesis title to edit your public-facing identity, bio, learning season, and philosophical self-description.'}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={onOpenProfile} disabled={!onOpenProfile} className="rounded-full px-6">
                  Open Profile
                </Button>
              </div>
            </SettingsCard>
          </div>
        );
      case 'appearance':
        return (
          <div className="space-y-6">
            <SettingsCard title="Appearance" description="Theme, density, visibility, and reading feel across the workspace.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mode">
                  <Select value={drafts.appearance.themeMode} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, themeMode: value as AppearanceSettings['themeMode'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Accent Color">
                  <Select value={drafts.appearance.accentTheme} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, accentTheme: value as AppearanceSettings['accentTheme'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="violet">Violet</SelectItem>
                      <SelectItem value="sage">Sage</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="amber">Amber</SelectItem>
                      <SelectItem value="rose">Rose</SelectItem>
                      <SelectItem value="mono">Mono</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Density">
                  <Select value={drafts.appearance.density} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, density: value as AppearanceSettings['density'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reading Width">
                  <Select value={drafts.appearance.readingWidth} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, readingWidth: value as AppearanceSettings['readingWidth'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="narrow">Narrow</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="wide">Wide</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Reduced motion" checked={drafts.appearance.reducedMotion} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, reducedMotion: checked } }))} />
                <SwitchRow label="High contrast mode" checked={drafts.appearance.highContrastMode} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, highContrastMode: checked } }))} />
                <SwitchRow label="Sidebar collapsed by default" checked={drafts.appearance.sidebarCollapsedByDefault} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, sidebarCollapsedByDefault: checked } }))} />
                <SwitchRow label="Show page descriptions" checked={drafts.appearance.showPageDescriptions} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, showPageDescriptions: checked } }))} />
              </div>
              <SaveBar onSave={() => saveSection('appearance')} saving={saving === 'appearance'} />
            </SettingsCard>
          </div>
        );
      case 'workspace':
        return (
          <div className="space-y-6">
            <SettingsCard title="Workspace" description="Navigation, object creation, review mode, and general working behavior.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Default landing page">
                  <ViewSelect value={drafts.workspace.defaultLandingPage} onChange={(value) => setDrafts((prev) => ({ ...prev, workspace: { ...prev.workspace, defaultLandingPage: value } }))} />
                </Field>
                <Field label="Page after adding a source">
                  <ViewSelect value={drafts.workspace.defaultAfterSourcePage} onChange={(value) => setDrafts((prev) => ({ ...prev, workspace: { ...prev.workspace, defaultAfterSourcePage: value } }))} />
                </Field>
                <Field label="Default source status">
                  <Select value={drafts.workspace.defaultSourceStatus} onValueChange={(value) => setDrafts((prev) => ({ ...prev, workspace: { ...prev.workspace, defaultSourceStatus: value as WorkspacePreferenceSettings['defaultSourceStatus'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Want to Read">Want to Read</SelectItem>
                      <SelectItem value="Consuming">Consuming</SelectItem>
                      <SelectItem value="Finished">Finished</SelectItem>
                      <SelectItem value="Paused">Paused</SelectItem>
                      <SelectItem value="Abandoned">Abandoned</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default sort order">
                  <Select value={drafts.workspace.defaultSortOrder} onValueChange={(value) => setDrafts((prev) => ({ ...prev, workspace: { ...prev.workspace, defaultSortOrder: value as WorkspacePreferenceSettings['defaultSortOrder'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Recent</SelectItem>
                      <SelectItem value="updated">Updated</SelectItem>
                      <SelectItem value="alphabetical">Alphabetical</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Confirm before deleting objects" checked={drafts.workspace.confirmBeforeDeletingObjects} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, workspace: { ...prev.workspace, confirmBeforeDeletingObjects: checked } }))} />
                <SwitchRow label="Enable review prompts after major edits" checked={drafts.workspace.enableReviewPromptsAfterMajorEdits} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, workspace: { ...prev.workspace, enableReviewPromptsAfterMajorEdits: checked } }))} />
              </div>
              <SaveBar onSave={() => saveSection('workspace')} saving={saving === 'workspace'} />
            </SettingsCard>

            <SettingsCard title="Source Intake" description="Defaults and automation around metadata lookup, annotations, and source capture.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Default media type">
                  <Select value={drafts.sourceIntake.defaultMediaType} onValueChange={(value) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, defaultMediaType: value as MediaType } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {mediaTypes.map((type) => <SelectItem key={type} value={type}>{MEDIA_LABELS[type]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default annotation type">
                  <Select value={drafts.sourceIntake.defaultAnnotationType} onValueChange={(value) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, defaultAnnotationType: value as SourceIntakeSettings['defaultAnnotationType'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="highlight">Highlight</SelectItem>
                      <SelectItem value="thought">Thought</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="connection">Connection</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Enable ISBN lookup" checked={drafts.sourceIntake.enableIsbnLookup} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, enableIsbnLookup: checked } }))} />
                <SwitchRow label="Enable DOI lookup" checked={drafts.sourceIntake.enableDoiLookup} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, enableDoiLookup: checked } }))} />
                <SwitchRow label="Enable article metadata fetch" checked={drafts.sourceIntake.enableArticleMetadataFetch} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, enableArticleMetadataFetch: checked } }))} />
                <SwitchRow label="Auto-create concepts from annotations" checked={drafts.sourceIntake.autoCreateConceptsFromAnnotations} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, autoCreateConceptsFromAnnotations: checked } }))} />
                <SwitchRow label="Auto-create inquiries from question annotations" checked={drafts.sourceIntake.autoCreateInquiriesFromQuestions} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, autoCreateInquiriesFromQuestions: checked } }))} />
              </div>
              <SaveBar onSave={() => saveSection('sourceIntake')} saving={saving === 'sourceIntake'} />
            </SettingsCard>

            <SettingsCard title="Atlas & Notifications" description="Map defaults, overlays, and reminder surfaces that support the workspace without taking it over.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Atlas layout mode">
                  <Select value={drafts.atlas.layoutMode} onValueChange={(value) => setDrafts((prev) => ({ ...prev, atlas: { ...prev.atlas, layoutMode: value as AtlasSettings['layoutMode'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="force_graph">Force graph</SelectItem>
                      <SelectItem value="radial">Radial</SelectItem>
                      <SelectItem value="hierarchical">Hierarchical</SelectItem>
                      <SelectItem value="timeline">Timeline</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Node size based on">
                  <Select value={drafts.atlas.nodeSizeBasedOn} onValueChange={(value) => setDrafts((prev) => ({ ...prev, atlas: { ...prev.atlas, nodeSizeBasedOn: value as AtlasSettings['nodeSizeBasedOn'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link_count">Link count</SelectItem>
                      <SelectItem value="recent_activity">Recent activity</SelectItem>
                      <SelectItem value="confidence">Confidence</SelectItem>
                      <SelectItem value="evidence_strength">Evidence strength</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Show labels by default" checked={drafts.atlas.showLabelsByDefault} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, atlas: { ...prev.atlas, showLabelsByDefault: checked } }))} />
                <SwitchRow label="Show contradiction links" checked={drafts.atlas.showContradictionLinks} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, atlas: { ...prev.atlas, showContradictionLinks: checked } }))} />
                <SwitchRow label="Show practice links" checked={drafts.atlas.showPracticeLinks} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, atlas: { ...prev.atlas, showPracticeLinks: checked } }))} />
                <SwitchRow label="Show source links" checked={drafts.atlas.showSourceLinks} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, atlas: { ...prev.atlas, showSourceLinks: checked } }))} />
                <SwitchRow label="Daily review reminders" checked={drafts.notifications.dailyReviewReminders} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, notifications: { ...prev.notifications, dailyReviewReminders: checked } }))} />
                <SwitchRow label="Weekly evolution summary" checked={drafts.notifications.weeklyEvolutionSummary} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, notifications: { ...prev.notifications, weeklyEvolutionSummary: checked } }))} />
                <SwitchRow label="Practice reminders" checked={drafts.notifications.practiceReminders} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, notifications: { ...prev.notifications, practiceReminders: checked } }))} />
                <SwitchRow label="Unknown follow-up reminders" checked={drafts.notifications.unknownFollowUpReminders} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, notifications: { ...prev.notifications, unknownFollowUpReminders: checked } }))} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => saveSection('atlas')} disabled={saving === 'atlas'} className="rounded-full px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'atlas' ? 'Saving Atlas' : 'Save Atlas Defaults'}
                </Button>
                <Button variant="outline" onClick={() => saveSection('notifications')} disabled={saving === 'notifications'} className="rounded-full bg-card px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'notifications' ? 'Saving Alerts' : 'Save Notifications'}
                </Button>
              </div>
            </SettingsCard>
          </div>
        );
      case 'works':
        return (
          <div className="space-y-6">
            <SettingsCard title="Writing Defaults" description="Creation defaults for writing, drawing, notes, recordings, and connected documents.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Default work type">
                  <Select value={drafts.works.defaultWorkType} onValueChange={(value) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, defaultWorkType: value as WorksSettings['defaultWorkType'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DRAFT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default paper style">
                  <Select value={drafts.works.defaultPaperStyle} onValueChange={(value) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, defaultPaperStyle: value as WorksSettings['defaultPaperStyle'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WRITING_STYLES.map((style) => <SelectItem key={style} value={style}>{WRITING_STYLE_LABELS[style]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default editor feel">
                  <Select value={drafts.works.defaultEditorMode} onValueChange={(value) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, defaultEditorMode: value as UserPreferences['writingDefaults']['editorFeel'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="focused">Focused</SelectItem>
                      <SelectItem value="spacious">Spacious</SelectItem>
                      <SelectItem value="dense">Dense</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Auto-save interval (seconds)">
                  <Input
                    type="number"
                    min={1}
                    value={String(drafts.works.autoSaveIntervalSeconds)}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, autoSaveIntervalSeconds: Number(event.target.value) || 1 } }))}
                  />
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="External doc sync enabled" checked={drafts.works.externalDocSyncEnabled} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, externalDocSyncEnabled: checked } }))} />
                <SwitchRow label="Show word count" checked={drafts.works.showWordCount} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, showWordCount: checked } }))} />
                <SwitchRow label="Show linked concepts" checked={drafts.works.showLinkedConcepts} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, showLinkedConcepts: checked } }))} />
                <SwitchRow label="Show linked positions" checked={drafts.works.showLinkedPositions} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, showLinkedPositions: checked } }))} />
                <SwitchRow label="Show AI panel" checked={drafts.works.showAiPanel} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, showAiPanel: checked } }))} />
              </div>
              <SaveBar onSave={() => saveSection('works')} saving={saving === 'works'} />
            </SettingsCard>
          </div>
        );
      case 'ai':
        return (
          <div className="space-y-6">
            <SettingsCard title="AI Preferences" description="Control the suggestion layer without letting AI silently become truth.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Provider">
                  <Input value={drafts.ai.provider} onChange={(event) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, provider: event.target.value } }))} />
                </Field>
                <Field label="Model">
                  <Input value={drafts.ai.model} onChange={(event) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, model: event.target.value } }))} />
                </Field>
                <Field label="Reasoning Depth">
                  <Select value={drafts.ai.reasoningDepth} onValueChange={(value) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, reasoningDepth: value as AiSettings['reasoningDepth'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="deep">Deep</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Memory Scope">
                  <Select value={drafts.ai.memoryScope} onValueChange={(value) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, memoryScope: value as AiSettings['memoryScope'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current_object">Current object only</SelectItem>
                      <SelectItem value="linked_objects">Linked objects</SelectItem>
                      <SelectItem value="whole_workspace">Whole workspace</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Enable AI suggestions" checked={drafts.ai.enableAiSuggestions} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, enableAiSuggestions: checked } }))} />
                <SwitchRow label="Question generation" checked={drafts.ai.autoGenerateQuestionsAfterSourceCapture} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, autoGenerateQuestionsAfterSourceCapture: checked } }))} />
                <SwitchRow label="Possible tension detection" checked={drafts.ai.autoDetectPossibleTensions} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, autoDetectPossibleTensions: checked } }))} />
                <SwitchRow label="Concept link suggestions" checked={drafts.ai.autoSuggestConceptLinks} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, autoSuggestConceptLinks: checked } }))} />
                <SwitchRow label="Require approval before saving AI output" checked={drafts.ai.requireUserApprovalBeforeSavingAiOutput} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, requireUserApprovalBeforeSavingAiOutput: checked } }))} />
              </div>
              <SaveBar onSave={() => saveSection('ai')} saving={saving === 'ai'} />
            </SettingsCard>

            <SettingsCard title="Metacognition" description="Feature controls for thinking events, biographies, patterns, unknowns, and reflective metrics.">
              <div className="grid gap-3">
                <SwitchRow label="Enable metacognition features" checked={drafts.metacognition.enableMetacognitionFeatures} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableMetacognitionFeatures: checked } }))} />
                <SwitchRow label="Enable thinking events logging" checked={drafts.metacognition.enableThinkingEventsLogging} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableThinkingEventsLogging: checked } }))} />
                <SwitchRow label="Enable belief biographies" checked={drafts.metacognition.enableBeliefBiographies} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableBeliefBiographies: checked } }))} />
                <SwitchRow label="Enable thinking pattern detection" checked={drafts.metacognition.enableThinkingPatternDetection} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableThinkingPatternDetection: checked } }))} />
                <SwitchRow label="Enable unknowns tracking" checked={drafts.metacognition.enableUnknownsTracking} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableUnknownsTracking: checked } }))} />
                <SwitchRow label="Enable cognition metrics" checked={drafts.metacognition.enableCognitionMetrics} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableCognitionMetrics: checked } }))} />
                <SwitchRow label="Show metacognition on profile" checked={drafts.metacognition.showMetacognitionPanelsOnProfile} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, showMetacognitionPanelsOnProfile: checked } }))} />
              </div>
              <SaveBar onSave={() => saveSection('metacognition')} saving={saving === 'metacognition'} />
            </SettingsCard>
          </div>
        );
      case 'data':
        return (
          <div className="space-y-6">
            <SettingsCard title="Data & Demo Workspace" description="Exports, safe resets, review data, and the dedicated mock workspace controls.">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                  <div>Last export: {drafts.data.lastExportedAt || 'Not exported yet'}</div>
                  {reviewMode && (
                    <div className="mt-2 font-code text-[11px]">
                      Demo seed status: {drafts.developer.demoWorkspaceSeedStatus ? 'seeded' : 'not seeded'}
                    </div>
                  )}
                </div>
                <SwitchRow label="Allow imports" checked={drafts.data.allowImport} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, data: { ...prev.data, allowImport: checked } }))} />
                <SwitchRow label="Allow workspace reset" checked={drafts.data.allowWorkspaceReset} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, data: { ...prev.data, allowWorkspaceReset: checked } }))} />
                <SwitchRow label="Allow clear demo data" checked={drafts.data.allowClearDemoData} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, data: { ...prev.data, allowClearDemoData: checked } }))} />
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={onExportWorkspace} className="rounded-full bg-card">
                    <Download className="mr-2 size-4" />
                    Export All Data
                  </Button>
                  {reviewMode && onRefreshDemoWorkspace && (
                    <Button variant="outline" onClick={refreshDemoWorkspace} disabled={refreshingDemoWorkspace || saving === 'refresh-demo'} className="rounded-full bg-card">
                      <RefreshCw className="mr-2 size-4" />
                      {refreshingDemoWorkspace || saving === 'refresh-demo' ? 'Refreshing Demo Workspace' : 'Refresh Demo Workspace'}
                    </Button>
                  )}
                </div>
              </div>
              <SaveBar onSave={() => saveSection('data')} saving={saving === 'data'} />
            </SettingsCard>

            {reviewMode && (
              <SettingsCard title="Developer / Review Mode" description="Diagnostics for the dedicated demo workspace and review path.">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Wrench className="size-4 text-accent" />
                      Review workspace status
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <li>Review mode: {drafts.developer.reviewModeStatus ? 'enabled' : 'disabled'}</li>
                      <li>Demo seed status: {drafts.developer.demoWorkspaceSeedStatus ? 'seeded' : 'not seeded'}</li>
                      <li>User path: {drafts.developer.currentUserPath || 'unknown'}</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-4">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Shield className="size-4 text-accent" />
                      Demo isolation
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Demo refresh should reseed mock data in place and never silently collapse the review workspace into an empty state.
                    </p>
                  </div>
                </div>
              </SettingsCard>
            )}
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-6">
            <SettingsCard title="Privacy & Permissions" description="Default visibility and protection around anything that may one day be shared.">
              <div className="grid gap-3">
                <Field label="Default object visibility">
                  <Select value={drafts.privacy.defaultObjectVisibility} onValueChange={(value) => setDrafts((prev) => ({ ...prev, privacy: { ...prev.privacy, defaultObjectVisibility: value as PrivacySettings['defaultObjectVisibility'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="shared_link">Shared link</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Shareable profile link">
                  <Input value={drafts.privacy.shareableProfileLink || ''} onChange={(event) => setDrafts((prev) => ({ ...prev, privacy: { ...prev.privacy, shareableProfileLink: event.target.value } }))} placeholder="https://..." />
                </Field>
                <SwitchRow label="Public sharing enabled" checked={drafts.privacy.publicSharingEnabled} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, privacy: { ...prev.privacy, publicSharingEnabled: checked } }))} />
                <SwitchRow label="Hide annotations from shared views" checked={drafts.privacy.hideAnnotationsFromSharedViews} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, privacy: { ...prev.privacy, hideAnnotationsFromSharedViews: checked } }))} />
                <SwitchRow label="Hide metacognition from shared views" checked={drafts.privacy.hideMetacognitionFromSharedViews} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, privacy: { ...prev.privacy, hideMetacognitionFromSharedViews: checked } }))} />
                <SwitchRow label="Require confirmation before public sharing" checked={drafts.privacy.requireConfirmationBeforePublic} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, privacy: { ...prev.privacy, requireConfirmationBeforePublic: checked } }))} />
              </div>
              <SaveBar onSave={() => saveSection('privacy')} saving={saving === 'privacy'} />
            </SettingsCard>
          </div>
        );
      case 'help':
        return (
          <div className="space-y-6">
            <SettingsCard title="Help / Usage Guide" description="How the thinking system connects without forcing every object into the same workflow.">
              <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                <div className="font-medium text-foreground">Noesis hierarchy</div>
                <p className="mt-2">
                  Sources feed annotations. Annotations become concepts or inquiries. Concepts and evidence support positions. Positions become works, practices, and change over time in Evolution.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {helpSections.map((section) => (
                  <div key={section.id} className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="font-headline text-lg font-semibold italic text-foreground">{section.label}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.definition}</p>
                    <div className="mt-3">
                      <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">What it does</div>
                      <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                        {section.whatYouDo.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                    <div className="mt-3">
                      <div className="font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Connects to</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {section.connectsTo.map((item) => (
                          <span key={item} className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SettingsCard>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 pt-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-[28px] font-headline font-semibold italic text-foreground">Settings</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Control how Noesis behaves without crowding the main thinking surfaces. Settings stays organized by function, while Profile and Goals live where they belong in the day-to-day workspace.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="h-fit rounded-2xl border-border bg-card p-3 shadow-sm">
            <div className="xl:hidden">
              <Field label="Settings Section">
                <Select value={activePanel} onValueChange={(value) => setActivePanel(value as SettingsPanelId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETTINGS_PANELS.map((panel) => (
                      <SelectItem key={panel.id} value={panel.id}>{panel.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="hidden xl:block">
              <div className="mb-3 px-3 font-code text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sections</div>
              <div className="space-y-1">
                {SETTINGS_PANELS.map((panel) => (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() => setActivePanel(panel.id)}
                    className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${
                      activePanel === panel.id
                        ? 'bg-accent/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <div className="text-sm font-medium">{panel.label}</div>
                    <div className="mt-1 text-xs leading-5">{panel.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="min-w-0 space-y-6">
            <div className="rounded-2xl border border-border bg-muted/15 px-5 py-4">
              <div className="font-headline text-xl font-semibold italic text-foreground">{currentPanel.label}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{currentPanel.description}</p>
            </div>
            {renderPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="font-headline text-2xl font-semibold italic">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="readex-kicker text-[9px] font-bold uppercase">{label}</Label>
      {children}
    </div>
  );
}

function SaveBar({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div className="mt-6 flex justify-end">
      <Button onClick={onSave} disabled={saving} className="rounded-full px-6 font-semibold">
        <Save className="mr-2 size-4" />
        {saving ? 'Saving' : 'Save Section'}
      </Button>
    </div>
  );
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ViewSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="atlas">Atlas</SelectItem>
        <SelectItem value="concepts">Concepts</SelectItem>
        <SelectItem value="questions">Inquiries</SelectItem>
        <SelectItem value="library">Library</SelectItem>
        <SelectItem value="source-index">Source Index</SelectItem>
        <SelectItem value="annotations">Annotations</SelectItem>
        <SelectItem value="vault">Positions</SelectItem>
        <SelectItem value="writing">Works</SelectItem>
        <SelectItem value="practices">Practices</SelectItem>
        <SelectItem value="evolution">Evolution</SelectItem>
        <SelectItem value="settings">Settings</SelectItem>
      </SelectContent>
    </Select>
  );
}

function sectionLabel(section: SettingsSectionKey) {
  switch (section) {
    case 'ai':
      return 'AI';
    case 'sourceIntake':
      return 'Source Intake';
    default:
      return section.charAt(0).toUpperCase() + section.slice(1);
  }
}
