"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { Download, LogOut, Network, RefreshCw, Save, Shield, Trash2, Wrench } from 'lucide-react';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { ExperienceSettingsRow } from '@/components/Settings/NoesisExperienceSetup';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useNavStyle, writeNavStyle } from '@/components/app-shell/LoopDock';
import { useToast } from '@/hooks/use-toast';
import { noesisGuide } from '@/lib/noesis-guide';
import { PageHeader } from '@/components/shared/PageHeader';
import { LabeledField as Field } from '@/components/shared/LabeledField';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { AI_DEPTH_PAGES } from '@/lib/ai-depth';
import { appearanceSnapshot, applyAppearanceSettings, persistAppearanceSettings } from '@/lib/appearance';
import { changedSettingsFields, reconcileSettingsDrafts } from '@/lib/settings-drafts';
import { thinkingHistoryDate } from '@/lib/evolution-history';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { WorkspaceOfflineError } from '@/lib/workspace-connectivity';
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
  StageColorKey,
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
  ThinkingEvent,
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
export type SettingsDraftCache = { baseline: SettingsState; draft: SettingsState };
type SettingsPanelId =
  | 'account'
  | 'appearance'
  | 'workspace'
  | 'capture'
  | 'works'
  | 'notifications'
  | 'ai'
  | 'experimental'
  | 'data'
  | 'integrations'
  | 'terminology'
  | 'privacy'
  | 'help';

type SettingsImpact = {
  current: string;
  affects: string[];
  limitations: string[];
};

interface SettingsPageProps {
  user: User | null;
  settings: SettingsState;
  draftCache: React.RefObject<SettingsDraftCache | null>;
  reviewMode: boolean;
  onSaveSection: (section: SettingsSectionKey, value: Partial<SettingsState[SettingsSectionKey]>) => Promise<void>;
  onExportWorkspace: (format?: 'json' | 'mindmap') => Promise<void>;
  onOpenProfile?: () => void;
  recentDeletedItems?: ThinkingEvent[];
  recentDeletedLoading?: boolean;
  recentDeletedError?: boolean;
  onRecoveryPanelChange?: (active: boolean) => void;
  onRetryDeletedItems?: () => void;
  onRestoreDeletedItem?: (event: ThinkingEvent) => Promise<void>;
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
  { id: 'appearance', label: 'Appearance', description: 'Theme, typography, layout, navigation, and what appears on My Desk.' },
  { id: 'works', label: 'Work Defaults', description: 'Starting type, status, paper, and editor feel for new Works.' },
  { id: 'ai', label: 'AI Assistance', description: 'Manual, bounded assistance and context privacy.' },
  { id: 'data', label: 'Data', description: 'Workspace export and demo refresh tools.' },
];

const PANEL_SECTION_MAP: Record<SettingsPanelId, SettingsSectionKey[]> = {
  account: [],
  appearance: ['appearance', 'goals'],
  workspace: ['workspace'],
  capture: ['sourceIntake', 'workspace'],
  works: ['works'],
  notifications: ['notifications', 'goals'],
  ai: ['ai'],
  experimental: ['metacognition', 'atlas'],
  data: [],
  integrations: ['works', 'sourceIntake', 'data'],
  terminology: ['workspace'],
  privacy: ['privacy'],
  help: [],
};

const SETTINGS_IMPACT_COPY: Record<SettingsPanelId, SettingsImpact> = {
  account: {
    current: 'Controls sign-in actions, password reset, account export, and the handoff to the separate Profile surface.',
    affects: ['Authentication controls', 'Workspace export actions', 'Profile access from the utility area'],
    limitations: [],
  },
  appearance: {
    current: 'Previews theme, color, headline typography, interface size, collection layout, contrast, and motion immediately, then persists them when saved.',
    affects: ['Light, dark, and system mode', 'Accent theme tokens', 'Header typography', 'Default card or table collection layout', 'Interface text scale', 'Contrast and motion preferences'],
    limitations: [],
  },
  workspace: {
    current: 'Sets navigation defaults, source creation behavior, deletion confirmation, review prompts, goal reminders, and Atlas defaults.',
    affects: ['Default landing and post-source routes', 'Default source status and sort order', 'Goal reminder behavior', 'Atlas and notification defaults'],
    limitations: ['Route-level page ownership is still being phased in, so a few older mounted surfaces may read these defaults later than newer routes.'],
  },
  capture: {
    current: 'Defines the default source and annotation shape before capture becomes interpretation.',
    affects: ['Default media type', 'Default annotation type', 'Metadata lookup toggles', 'Automatic concept and inquiry creation preferences'],
    limitations: ['Voice transcription, browser capture, and some provider automations require connected integrations before they become live controls.'],
  },
  works: {
    current: 'Defines how new Works open, save, and display their creation surface.',
    affects: ['Default work type', 'Default paper style', 'Editor feel', 'Autosave interval', 'External document sync visibility'],
    limitations: ['Private external document auto-sync still requires provider authentication; Noesis can store linked document metadata now.'],
  },
  notifications: {
    current: 'Controls reminder surfaces that should point back to real unfinished intellectual objects.',
    affects: ['Daily review prompts', 'Weekly evolution summaries', 'Practice reminders', 'Unknown follow-up reminders', 'Goal review visibility'],
    limitations: ['Notifications should not fire unless they can identify the associated source, position, inquiry, practice, or unknown.'],
  },
  ai: {
    current: 'Controls manual item-level assistance and shows exactly what context is sent.',
    affects: ['Assistance availability', 'Context preview', 'Reasoning depth', 'Accepted-output provenance'],
    limitations: ['Assistance never runs automatically and cannot change user-authored objects without review.'],
  },
  experimental: {
    current: 'Turns reflective systems on or off behind feature gates so unstable intelligence never masquerades as truth.',
    affects: ['Belief biographies', 'Unknowns tracking', 'Thinking pattern detection', 'Cognition metrics', 'Advanced Atlas overlays'],
    limitations: ['Every metacognitive claim must remain evidence-backed, dismissible, and safe to disable.'],
  },
  data: {
    current: 'Download saved workspace records or recover recently deleted items.',
    affects: ['Workspace export', 'Recently deleted items', 'Demo refresh'],
    limitations: ['Firestore rules must allow the active user to write their own path before demo refresh can persist.'],
  },
  integrations: {
    current: 'Explains external systems that need real provider connections instead of placeholder switches.',
    affects: ['External document expectations', 'Source metadata readiness', 'Storage planning', 'Calendar or reminder future work'],
    limitations: ['These cards are intentionally informational until OAuth, storage, or provider keys are connected server-side.'],
  },
  terminology: {
    current: 'Documents user-facing language without changing existing Firestore collection names.',
    affects: ['Conceptual clarity for Positions, Inquiries, Works, and Sources', 'Future migration planning'],
    limitations: ['Custom renaming is not editable until navigation, exports, and the command palette can stay consistent.'],
  },
  privacy: {
    current: 'Workspace records stay private. Manage what appears on your public profile from Profile.',
    affects: ['Public profile'],
    limitations: [],
  },
  help: {
    current: 'Explains the Noesis hierarchy and workflow without saving app behavior.',
    affects: ['User orientation only'],
    limitations: ['This guide is descriptive; it does not mutate data or settings.'],
  },
};

export function SettingsPage({
  user,
  settings,
  draftCache,
  reviewMode,
  onSaveSection,
  onExportWorkspace,
  onOpenProfile,
  recentDeletedItems = [],
  recentDeletedLoading = false,
  recentDeletedError = false,
  onRecoveryPanelChange,
  onRetryDeletedItems,
  onRestoreDeletedItem,
  onRefreshDemoWorkspace,
  refreshingDemoWorkspace = false,
  profileSummary,
}: SettingsPageProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<SettingsState>(() => {
    const cached = draftCache.current;
    return cached ? reconcileSettingsDrafts(cached.draft, cached.baseline, settings) : settings;
  });
  const settingsBaseline = useRef(settings);
  const savedAppearance = useRef(settings.appearance);
  const [confirmedAppearance, setConfirmedAppearance] = useState(settings.appearance);
  const saveLock = useRef(false);
  const [saving, setSaving] = useState<SettingsSectionKey | 'reset' | 'refresh-demo' | null>(null);
  const [lastSaved, setLastSaved] = useState<SettingsSectionKey | null>(null);
  const [restoringItem, setRestoringItem] = useState<string | null>(null);
  const restoreLock = useRef(false);
  const recoveryListHeading = useRef<HTMLHeadingElement>(null);
  const exportLock = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [activePanel, setActivePanel] = useState<SettingsPanelId>('account');
  useEffect(() => {
    onRecoveryPanelChange?.(activePanel === 'data');
    return () => onRecoveryPanelChange?.(false);
  }, [activePanel, onRecoveryPanelChange]);
  const [panelPreferenceLoaded, setPanelPreferenceLoaded] = useState(false);
  const [aiConnection, setAiConnection] = useState<'idle' | 'checking' | 'configured' | 'not_configured' | 'sign_in_required' | 'email_not_verified' | 'unavailable'>('idle');
  const aiCheck = useRef<AbortController | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const exportWorkspace = async (format: 'json' | 'mindmap' = 'json') => {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    try {
      await onExportWorkspace(format);
      toast({ title: format === 'mindmap' ? 'Mind map ready' : 'Workspace JSON ready', description: format === 'mindmap' ? 'A .mm file for FreeMind, Freeplane, XMind, or MindNode. Check your browser downloads.' : 'Check your browser downloads.' });
    } catch (error) {
      toast({
        title: 'Export not available',
        description: error instanceof WorkspaceOfflineError
          ? 'Reconnect to download your saved workspace records.'
          : 'No file was downloaded. Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  };

  const checkAiConnection = async () => {
    if (aiCheck.current) return;
    if (!user) {
      setAiConnection('sign_in_required');
      return;
    }
    const request = new AbortController();
    aiCheck.current = request;
    const timer = window.setTimeout(() => request.abort(), 10_000);
    setAiConnection('checking');
    try {
      const response = await authenticatedFetch('/api/contextual-ai', { signal: request.signal });
      const data = await response.json().catch(() => ({}));
      if (aiCheck.current !== request) return;
      if (response.status === 401) setAiConnection('sign_in_required');
      else if (response.status === 403 && data?.code === 'email_not_verified') setAiConnection('email_not_verified');
      else setAiConnection(response.ok && typeof data?.configured === 'boolean'
        ? data.configured ? 'configured' : 'not_configured'
        : 'unavailable');
    } catch {
      if (aiCheck.current === request) setAiConnection('unavailable');
    } finally {
      window.clearTimeout(timer);
      if (aiCheck.current === request) aiCheck.current = null;
    }
  };

  useEffect(() => () => {
    aiCheck.current?.abort();
    aiCheck.current = null;
  }, []);

  useEffect(() => {
    const previous = settingsBaseline.current;
    setDrafts((current) => reconcileSettingsDrafts(current, previous, settings));
    settingsBaseline.current = settings;
    if (previous.appearance !== settings.appearance
      && JSON.stringify(previous.appearance) !== JSON.stringify(settings.appearance)) {
      savedAppearance.current = settings.appearance;
      setConfirmedAppearance(settings.appearance);
    }
  }, [settings]);

  useLayoutEffect(() => {
    draftCache.current = { baseline: settings, draft: reconcileSettingsDrafts(drafts, settingsBaseline.current, settings) };
  }, [draftCache, drafts, settings]);

  useEffect(() => () => {
    applyAppearanceSettings(savedAppearance.current);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_SECTION_STORAGE_KEY) as SettingsPanelId | null;
      // Today settings now live under Appearance.
      const resolved = saved === 'notifications' ? 'appearance' : saved;
      if (resolved && SETTINGS_PANELS.some((panel) => panel.id === resolved)) setActivePanel(resolved);
    } catch { /* Section preference is optional. */ }
    setPanelPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!panelPreferenceLoaded) return;
    try { window.localStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, activePanel); } catch { /* Keep settings usable without storage. */ }
  }, [activePanel, panelPreferenceLoaded]);

  const appearancePreview = useMemo(
    () => appearanceSnapshot(drafts.appearance),
    [drafts.appearance]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => applyAppearanceSettings(activePanel === 'appearance' ? appearancePreview : confirmedAppearance, mediaQuery.matches);
    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [activePanel, appearancePreview, confirmedAppearance]);

  const sectionChanges = (section: SettingsSectionKey) => section === 'appearance'
    ? changedSettingsFields(appearancePreview, appearanceSnapshot(confirmedAppearance))
    : changedSettingsFields(drafts[section], settingsBaseline.current[section]);
  const canSaveSection = (section: SettingsSectionKey) => Object.keys(sectionChanges(section)).length > 0;
  const discardAppearance = () => {
    setDrafts((current) => ({ ...current, appearance: savedAppearance.current }));
  };

  const saveSection = async (section: SettingsSectionKey) => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(section);
    try {
      const value = sectionChanges(section);
      if (!Object.keys(value).length) return;
      await onSaveSection(section, value);
      if (section === 'appearance') {
        const acknowledged = { ...savedAppearance.current, ...value };
        savedAppearance.current = acknowledged;
        setConfirmedAppearance(acknowledged);
        persistAppearanceSettings(appearanceSnapshot(acknowledged));
      }
      setLastSaved(section);
      toast({ title: `${sectionLabel(section)} saved` });
    } catch {
      toast({ variant: 'destructive', title: 'Settings not saved', description: `${sectionLabel(section)} could not be saved. Your changes are still here.` });
    } finally {
      saveLock.current = false;
      setSaving(null);
    }
  };

  const saveProps = (section: SettingsSectionKey) => ({
    onSave: () => saveSection(section),
    saving: saving === section,
    busy: saving !== null,
    dirty: canSaveSection(section),
    saved: lastSaved === section,
  });

  const restoreItem = async (event: ThinkingEvent) => {
    if (!onRestoreDeletedItem || restoreLock.current) return;
    restoreLock.current = true;
    setRestoringItem(event.id);
    try {
      await onRestoreDeletedItem(event);
      toast({ title: 'Item restored' });
      recoveryListHeading.current?.focus({ preventScroll: true });
    } catch (error) {
      toast({ title: 'Item not restored', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      restoreLock.current = false;
      setRestoringItem(null);
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

  const deleteAccount = async () => {
    if (!user || reviewMode || deletingAccount) return;
    setDeletingAccount(true);
    try {
      const response = await authenticatedFetch('/api/account/delete', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Account deletion failed.');
      setDeleteAccountOpen(false);
      await signOut(auth).catch(() => undefined);
      toast({ title: 'Account deleted', description: 'Your Noesis workspace and sign-in account were deleted.' });
    } finally {
      setDeletingAccount(false);
    }
  };

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
                  <Input value={formatAccountDate(drafts.account.accountCreatedAt || user?.metadata?.creationTime)} disabled />
                </Field>
                <Field label="Authentication Status">
                  <Input value={user ? 'Signed in' : 'Signed out'} disabled />
                </Field>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="outline" onClick={resetPassword} disabled={!user?.email || saving === 'reset'}>
                  Reset Password
                </Button>
                <Button variant="outline" onClick={() => void exportWorkspace()} disabled={exporting} className="rounded-full bg-card px-6">
                  <Download className="mr-2 size-4" />
                  {exporting ? 'Preparing export...' : 'Export Workspace JSON'}
                </Button>
                <Button variant="ghost" onClick={() => signOut(auth)} className="rounded-full text-destructive hover:text-destructive">
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </Button>
                {!reviewMode && user && (
                  <Button variant="ghost" onClick={() => setDeleteAccountOpen(true)} className="rounded-full text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 size-4" />
                    Delete Account and Workspace
                  </Button>
                )}
              </div>
            </SettingsCard>
          </div>
        );
      case 'appearance':
        return (
          <div className="space-y-6">
            <SettingsCard title="Appearance" description="Theme, typography, collection layout, interface scale, contrast, and motion across the workspace.">
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
                <Field label="Theme Palette">
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
                <Field label="Header Font">
                  <Select value={drafts.appearance.headerFont} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, headerFont: value as AppearanceSettings['headerFont'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editorial">Editorial — Playfair</SelectItem>
                      <SelectItem value="literary">Literary — Spectral</SelectItem>
                      <SelectItem value="classic">Classic — Georgia</SelectItem>
                      <SelectItem value="modern">Modern — Sans Serif</SelectItem>
                      <SelectItem value="mono">Technical — Mono</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Interface Size">
                  <Select value={drafts.appearance.fontSize} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, fontSize: value as AppearanceSettings['fontSize'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="md">Standard</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Interface Shape">
                  <Select value={drafts.appearance.interfaceShape} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, interfaceShape: value as AppearanceSettings['interfaceShape'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pills">Pills and rounded surfaces</SelectItem>
                      <SelectItem value="square">Square tabs and controls</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default Collection View">
                  <Select value={drafts.appearance.defaultCollectionView} onValueChange={(value) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, defaultCollectionView: value as AppearanceSettings['defaultCollectionView'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cards">Cards</SelectItem>
                      <SelectItem value="table">Table</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Reduced motion" checked={drafts.appearance.reducedMotion} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, reducedMotion: checked } }))} />
                <SwitchRow label="High contrast mode" checked={drafts.appearance.highContrastMode} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, highContrastMode: checked } }))} />
                <LoopNavigationRow />
              </div>
              <StageColorPicker
                value={drafts.appearance.stageColors || {}}
                onChange={(stageColors) => setDrafts((prev) => ({ ...prev, appearance: { ...prev.appearance, stageColors } }))}
              />
              <div className="mt-6 overflow-hidden rounded-2xl border-2 border-border bg-background shadow-sm" aria-label="Live theme preview">
                <div className="flex min-h-48">
                  <div className="w-20 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
                    <div className="mb-5 h-7 w-7 rounded-md bg-sidebar-primary" />
                    <div className="space-y-3">
                      <div className="h-2 rounded bg-sidebar-foreground/85" />
                      <div className="h-2 rounded bg-sidebar-foreground/45" />
                      <div className="h-2 rounded bg-sidebar-foreground/45" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 p-5">
                    <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">Live theme preview</div>
                    <div className="mt-2 font-headline text-2xl font-semibold italic text-foreground">A workspace for living thought</div>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">This preview uses the same page, navigation, surface, border, typography, and accent tokens as every Noesis workspace.</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button size="sm">Primary action</Button>
                      <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-card-foreground">Readable card</div>
                      <div className="rounded-full bg-muted px-3 py-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">
                        {drafts.appearance.highContrastMode ? 'High contrast on' : 'Standard contrast'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <SaveBar {...saveProps('appearance')} onDiscard={discardAppearance} />
            </SettingsCard>
            <SettingsCard title="My Desk" description="Hiding the commitment summary does not change your saved commitments or progress.">
              <SwitchRow label="Show commitments on My Desk" checked={drafts.goals.showGoalsOnDashboard} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, showGoalsOnDashboard: checked } }))} />
              <SaveBar {...saveProps('goals')} />
            </SettingsCard>
          </div>
        );
      case 'workspace':
        return (
          <div className="space-y-6">
            <SettingsCard title="Workspace" description="Navigation, object creation, review mode, and general working behavior.">
              <ExperienceSettingsRow />
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
              <SaveBar {...saveProps('workspace')} />
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
              </div>
              <SaveBar {...saveProps('sourceIntake')} />
            </SettingsCard>

            <SettingsCard title="Goal Preferences" description="Configure how goal reminders and source-counting defaults behave without turning Goals into a system setting.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Reminder frequency">
                  <Select value={drafts.goals.goalReminderFrequency} onValueChange={(value) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, goalReminderFrequency: value as GoalPreferenceSettings['goalReminderFrequency'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Monthly source target">
                  <Input
                    type="number"
                    min={0}
                    value={String(drafts.goals.defaultMonthlySourceTarget)}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, defaultMonthlySourceTarget: Math.max(0, Number(event.target.value) || 0) } }))}
                  />
                </Field>
                <Field label="Default goal categories">
                  <Input
                    value={(drafts.goals.defaultGoalCategories || []).join(', ')}
                    onChange={(event) => setDrafts((prev) => ({
                      ...prev,
                      goals: {
                        ...prev.goals,
                        defaultGoalCategories: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                      },
                    }))}
                    placeholder="Sources, Works, Practices"
                  />
                </Field>
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Show commitments on My Desk" checked={drafts.goals.showGoalsOnDashboard} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, showGoalsOnDashboard: checked } }))} />
                <SwitchRow label="Count completed audiobooks" checked={drafts.goals.includeAudiobooksInReadingGoals} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, includeAudiobooksInReadingGoals: checked } }))} />
                <SwitchRow label="Count completed podcasts" checked={drafts.goals.includePodcastsInLearningGoals} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, includePodcastsInLearningGoals: checked } }))} />
                <SwitchRow label="Count completed videos" checked={drafts.goals.includeVideosInSourceGoals} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, includeVideosInSourceGoals: checked } }))} />
              </div>
              <SaveBar {...saveProps('goals')} />
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
                <Button onClick={() => saveSection('atlas')} disabled={saving !== null || !canSaveSection('atlas')} className="rounded-full px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'atlas' ? 'Saving Atlas' : 'Save Atlas Defaults'}
                </Button>
                <Button variant="outline" onClick={() => saveSection('notifications')} disabled={saving !== null || !canSaveSection('notifications')} className="rounded-full bg-card px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'notifications' ? 'Saving Alerts' : 'Save Notifications'}
                </Button>
              </div>
            </SettingsCard>
          </div>
        );
      case 'capture':
        return (
          <div className="space-y-6">
            <SettingsCard title="Capture Defaults" description="Defaults for source intake, annotations, metadata lookup, and quick capture behavior.">
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
              </div>
              <div className="mt-5 grid gap-3">
                <SwitchRow label="Enable ISBN lookup" checked={drafts.sourceIntake.enableIsbnLookup} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, enableIsbnLookup: checked } }))} />
                <SwitchRow label="Enable DOI lookup" checked={drafts.sourceIntake.enableDoiLookup} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, enableDoiLookup: checked } }))} />
                <SwitchRow label="Enable article metadata fetch" checked={drafts.sourceIntake.enableArticleMetadataFetch} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, sourceIntake: { ...prev.sourceIntake, enableArticleMetadataFetch: checked } }))} />
              </div>
              <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                Voice transcription, automatic timestamps, and browser capture are integration-dependent. They are listed here as capture behavior requirements, but Noesis will not show fake toggles until the provider is connected.
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => saveSection('sourceIntake')} disabled={saving !== null || !canSaveSection('sourceIntake')} className="rounded-full px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'sourceIntake' ? 'Saving Capture' : 'Save Capture Defaults'}
                </Button>
                <Button variant="outline" onClick={() => saveSection('workspace')} disabled={saving !== null || !canSaveSection('workspace')} className="rounded-full bg-card px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'workspace' ? 'Saving Source Status' : 'Save Source Status'}
                </Button>
              </div>
            </SettingsCard>
          </div>
        );
      case 'works':
        return (
          <div className="space-y-6">
            <SettingsCard title="Work Defaults" description="Choose how newly created Works begin. Existing Works keep their own saved settings.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Default work type">
                  <Select value={drafts.works.defaultWorkType} onValueChange={(value) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, defaultWorkType: value as WorksSettings['defaultWorkType'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DRAFT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default status">
                  <Select value={drafts.works.defaultDraftStatus} onValueChange={(value) => setDrafts((prev) => ({ ...prev, works: { ...prev.works, defaultDraftStatus: value as WorksSettings['defaultDraftStatus'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seed">Seed</SelectItem>
                      <SelectItem value="developing">Developing</SelectItem>
                      <SelectItem value="revising">Revising</SelectItem>
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
              </div>
              <SaveBar {...saveProps('works')} />
            </SettingsCard>
          </div>
        );
      case 'notifications':
        return (
          <SettingsCard title="My Desk" description="Hide the commitment summary without changing your saved commitments or progress.">
            <SwitchRow label="Show commitments on My Desk" checked={drafts.goals.showGoalsOnDashboard} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, goals: { ...prev.goals, showGoalsOnDashboard: checked } }))} />
            <SaveBar {...saveProps('goals')} />
          </SettingsCard>
        );
      case 'ai':
        return (
          <div className="space-y-6">
            <SettingsCard title="Contextual AI Assistance" description="Choose how manually requested assistance uses the context you provide.">
              <div className="grid gap-3">
                <SwitchRow label="Enable contextual assistance" checked={drafts.ai.aiAssistanceEnabled} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, aiAssistanceEnabled: checked } }))} />
                <SwitchRow label="Open context preview by default" checked={drafts.ai.showContextBeforeSending} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, showContextBeforeSending: checked } }))} />
                <Field label="Reasoning depth">
                  <Select value={drafts.ai.defaultReasoningDepth} onValueChange={(value) => setDrafts((prev) => ({ ...prev, ai: { ...prev.ai, defaultReasoningDepth: value as AiSettings['defaultReasoningDepth'] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="deep">Deep</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <fieldset className="rounded-[var(--card-radius)] border border-border p-4">
                  <legend className="px-1 noesis-eyebrow text-muted-foreground">Depth by page</legend>
                  <p className="mb-3 text-sm text-muted-foreground">Start some pages lighter or deeper than the default. You can still change the depth for a single request.</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {AI_DEPTH_PAGES.map(({ page, label }) => (
                      <li key={page} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                        <span className="text-sm">{label}</span>
                        <Select
                          value={drafts.ai.depthByPage?.[page] || 'default'}
                          onValueChange={(value) => setDrafts((prev) => {
                            const depthByPage = { ...(prev.ai.depthByPage || {}) };
                            if (value === 'default') delete depthByPage[page]; else depthByPage[page] = value as AiSettings['defaultReasoningDepth'];
                            return { ...prev, ai: { ...prev.ai, depthByPage } };
                          })}
                        >
                          <SelectTrigger className="h-8 w-40" aria-label={`${label} reasoning depth`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default ({drafts.ai.defaultReasoningDepth})</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="deep">Deep</SelectItem>
                          </SelectContent>
                        </Select>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                You start every request. Item assistance uses that item and its linked records; Context Desk uses your selected items, and period reviews use the selected dates. Results remain suggestions until you review and accept them. Accepted material is recorded as AI-assisted.
              </div>
              <div className="mt-3 rounded-xl border border-border bg-background/60 p-4">
                <div className="text-sm font-medium text-foreground">Where assistance appears</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Library · Annotations · Concepts · Inquiries · Positions · completed practice reviews · Evolution period reviews · Profile philosophy reviews · Context Desk. No automatic workspace scans run.</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/60 p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Server configuration</div>
                  <div role="status" className="text-xs text-muted-foreground">
                    {!user || aiConnection === 'sign_in_required' ? 'Sign in to check server configuration.' : aiConnection === 'email_not_verified' ? 'Verify your email before checking server configuration.' : aiConnection === 'configured' ? 'Configured. This check does not run an AI request.' : aiConnection === 'not_configured' ? 'AI is not configured on the server.' : aiConnection === 'unavailable' ? 'Configuration status could not be verified. Try again.' : aiConnection === 'checking' ? 'Checking configuration...' : 'Not checked.'}
                  </div>
                </div>
                <Button variant="outline" onClick={checkAiConnection} disabled={!user || aiConnection === 'checking'}>
                  <RefreshCw aria-hidden="true" className={`mr-2 size-4 ${aiConnection === 'checking' ? 'animate-spin' : ''}`} /> Check Configuration
                </Button>
              </div>
              <SaveBar {...saveProps('ai')} />
            </SettingsCard>
          </div>
        );
      case 'experimental':
        return (
          <div className="space-y-6">
            <SettingsCard title="Experimental Features" description="Enable reflective systems only when their limitations are visible and their outputs remain reviewable.">
              <div className="grid gap-3">
                <SwitchRow label="Metacognition layer" checked={drafts.metacognition.enableMetacognitionFeatures} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableMetacognitionFeatures: checked } }))} />
                <SwitchRow label="Belief biographies" checked={drafts.metacognition.enableBeliefBiographies} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableBeliefBiographies: checked } }))} />
                <SwitchRow label="Unknowns tracking" checked={drafts.metacognition.enableUnknownsTracking} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableUnknownsTracking: checked } }))} />
                <SwitchRow label="Thinking pattern detection" checked={drafts.metacognition.enableThinkingPatternDetection} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableThinkingPatternDetection: checked } }))} />
                <SwitchRow label="Cognition metrics" checked={drafts.metacognition.enableCognitionMetrics} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, metacognition: { ...prev.metacognition, enableCognitionMetrics: checked } }))} />
                <SwitchRow label="Advanced Atlas relation overlays" checked={drafts.atlas.showContradictionLinks} onCheckedChange={(checked) => setDrafts((prev) => ({ ...prev, atlas: { ...prev.atlas, showContradictionLinks: checked } }))} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <LimitationCard title="Evidence required" body="Noesis should not display thinking patterns when the event sample is too small or disconnected from actual user actions." />
                <LimitationCard title="Recorded evidence only" body="Reflection should be traceable to real changes and never invent activity or conclusions." />
                <LimitationCard title="Reversible defaults" body="Experimental surfaces must be safe to disable without breaking Positions, Atlas, Evolution, Profile, or demo data." />
                <LimitationCard title="No identity labels" body="The app should say recent evidence suggests a tendency, never that the user is a fixed kind of thinker." />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => saveSection('metacognition')} disabled={saving !== null || !canSaveSection('metacognition')} className="rounded-full px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'metacognition' ? 'Saving Experiments' : 'Save Experimental Features'}
                </Button>
                <Button variant="outline" onClick={() => saveSection('atlas')} disabled={saving !== null || !canSaveSection('atlas')} className="rounded-full bg-card px-6">
                  <Save className="mr-2 size-4" />
                  {saving === 'atlas' ? 'Saving Atlas' : 'Save Atlas Overlays'}
                </Button>
              </div>
            </SettingsCard>
          </div>
        );
      case 'data':
        return (
          <div className="space-y-6">
            <SettingsCard title="Workspace Data" description="Download a private copy of everything you have saved. The JSON file holds every record and setting (no uploaded files) and cannot be imported to restore a workspace. The mind map lays your concepts out as branches with the positions, inquiries, sources, and practices that use them.">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => void exportWorkspace()} disabled={exporting} className="rounded-full bg-card">
                    <Download className="mr-2 size-4" />
                    {exporting ? 'Preparing export...' : 'Export Workspace JSON'}
                  </Button>
                  <Button variant="outline" onClick={() => void exportWorkspace('mindmap')} disabled={exporting} className="rounded-full bg-card">
                    <Network className="mr-2 size-4" />
                    Export as Mind Map
                  </Button>
                  {reviewMode && onRefreshDemoWorkspace && (
                    <Button variant="outline" onClick={refreshDemoWorkspace} disabled={refreshingDemoWorkspace || saving === 'refresh-demo'}>
                      <RefreshCw className="mr-2 size-4" />
                      {refreshingDemoWorkspace || saving === 'refresh-demo' ? 'Refreshing Demo Workspace' : 'Refresh Demo Workspace'}
                    </Button>
                  )}
                </div>
              </div>
            </SettingsCard>

            <SettingsCard title="Recently deleted" headingRef={recoveryListHeading} description="Restore supported records deleted in the last 30 days. Relationships removed with a record may need to be reconnected.">
              {recentDeletedLoading ? <p role="status" className="text-sm text-muted-foreground">Loading recently deleted items...</p>
                : recentDeletedError ? <div className="flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm text-destructive">Recently deleted items could not be loaded.</p>
                  <Button type="button" variant="outline" onClick={onRetryDeletedItems}>Retry recently deleted</Button>
                </div>
                : recentDeletedItems.length ? <div className="divide-y divide-border rounded-xl border border-border">
                {recentDeletedItems.map((event) => {
                  const label = event.summary.replace(/^Deleted (annotation|concept|source|position|inquiry|work|practice): /i, '');
                  const date = thinkingHistoryDate(event.createdAt);
                  return <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0"><div className="break-words text-sm font-medium text-foreground">{label}</div><div className="mt-1 text-xs text-muted-foreground">{event.entityType}{Number.isFinite(date) && <> · <time dateTime={new Date(date).toISOString()}>{new Date(date).toLocaleDateString()}</time></>}</div></div>
                    <Button type="button" size="sm" variant="outline" aria-label={`Restore ${label}`} disabled={!onRestoreDeletedItem || restoringItem !== null} onClick={() => void restoreItem(event)} className="min-h-11 rounded-full">{restoringItem === event.id ? 'Restoring...' : 'Restore'}</Button>
                  </div>;
                })}</div> : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Deleted items will appear here for 30 days.</p>}
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
      case 'integrations':
        return (
          <div className="space-y-6">
            <SettingsCard title="Integrations" description="External systems must be connected deliberately and never simulated with fake switches.">
              <div className="grid gap-4 md:grid-cols-2">
                <IntegrationCard title="External documents" status={drafts.works.externalDocSyncEnabled ? 'Configured in Works defaults' : 'Available when enabled'} body="Works can store external document links and sync status. Private Google Docs require OAuth before true automatic updates." />
                <IntegrationCard title="Source metadata providers" status="Server routes available" body="Books, papers, movies, and URL metadata should resolve through provider APIs, while manual entry remains the fallback." />
                <IntegrationCard title="Cloud storage" status="Needs storage policy" body="Recordings, drawings, and imported files should use a storage provider before large artifacts leave local draft fields." />
                <IntegrationCard title="Calendar and reminders" status="Not connected" body="Practice logs, goal reviews, and inquiry reminders need a calendar/notification provider before they can trigger outside the app." />
                <IntegrationCard title="Browser capture" status="Not connected" body="Web clipping and source context capture should wait for a browser capture integration rather than pretending URLs are enough." />
                <IntegrationCard title="Transcription provider" status="Not connected" body="Voice notes and recordings need an explicit transcription provider before automatic transcripts can be offered." />
              </div>
              <SaveBar {...saveProps('works')} />
            </SettingsCard>
          </div>
        );
      case 'terminology':
        return (
          <div className="space-y-6">
            <SettingsCard title="Terminology" description="Clarify Noesis language while keeping the internal schema stable.">
              <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                Limited renaming should be treated as a presentation layer. Internal collections like <span className="font-code">vault</span>, <span className="font-code">questions</span>, and <span className="font-code">drafts</span> remain stable so migrations do not break existing data.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ClassificationCard title="Concepts" body="Ideas with intellectual meaning: autonomy, justice, identity, consciousness, obligation. Concepts affect definitions, Atlas, and metacognition." />
                <ClassificationCard title="Domains" body="Broad philosophical territory: ethics, epistemology, metaphysics, philosophy of mind, religion, aesthetics, and social philosophy." />
                <ClassificationCard title="Facets" body="Object characteristics: source type, annotation role, inquiry kind, position maturity, work format, practice outcome, confidence, or status." />
                <ClassificationCard title="Labels" body="Temporary workflow organization: review next week, video idea, class project, private, priority. Labels should not shape worldview conclusions." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TerminologyCard term="Positions" alt="Beliefs / Claims" body="Judgment objects the user currently holds, tests, revises, or abandons." />
                <TerminologyCard term="Inquiries" alt="Questions" body="Structured investigations that preserve uncertainty until an answer has evidence." />
                <TerminologyCard term="Works" alt="Writing / Artifacts" body="Outputs where philosophy becomes essays, notes, drawings, recordings, or linked documents." />
                <TerminologyCard term="Practices" alt="Experiments" body="Lived tests that reveal whether a position can survive behavior." />
                <TerminologyCard term="Concepts" alt="Vocabulary" body="The organizing language of the user’s thinking, with definitions and boundaries." />
                <TerminologyCard term="Evolution" alt="History" body="Meaningful intellectual change, not generic app activity." />
              </div>
              <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-4 text-sm italic leading-6 text-muted-foreground">
                Custom renaming is intentionally not editable yet. It should only ship once every page can reflect terminology consistently across navigation, command palette, object previews, and exports.
              </div>
            </SettingsCard>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-6">
            <SettingsCard title="Privacy & Permissions" description="Your workspace stays private. Only the information you publish from Profile appears on your public page.">
              {onOpenProfile && <Button type="button" variant="outline" onClick={onOpenProfile}>Open Profile</Button>}
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
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="font-medium text-foreground">Cross-page handoffs</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  These are the intended routes through the system. A page should hand work to the next page without duplicating that page’s main job.
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {noesisGuide.workflows.slice(0, 10).map((workflow) => (
                    <div key={workflow.id} className="rounded-xl border border-border/60 bg-card p-3">
                      <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">{workflow.label}</div>
                      <ol className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                        {workflow.steps.slice(0, 4).map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {helpSections.map((section) => (
                  <div key={section.id} className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="font-headline text-lg font-semibold italic text-foreground">{section.label}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.definition}</p>
                    <div className="mt-3">
                      <div className="noesis-eyebrow text-muted-foreground">What it does</div>
                      <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                        {section.whatYouDo.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                    <div className="mt-3">
                      <div className="noesis-eyebrow text-muted-foreground">Connects to</div>
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
    <>
    <div className="noesis-page noesis-settings-page" data-noesis-identity="utility">
      <div className="noesis-page-inner">
        <PageHeader
          title="Settings"
          description="Control how Noesis behaves without crowding the main thinking surfaces. Settings stays organized by function, while Profile and Goals live where they belong in the day-to-day workspace."
        />

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
              <div className="mb-3 px-3 noesis-eyebrow text-muted-foreground">Sections</div>
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
            {renderPanel()}
          </div>
        </div>
      </div>
    </div>
    <ConfirmActionDialog
      open={deleteAccountOpen}
      onOpenChange={setDeleteAccountOpen}
      title="Delete your Noesis account?"
      description="This removes your public profile, workspace records, uploaded files, and sign-in account. Download any records or files you want to keep before continuing. This cannot be undone in Noesis."
      confirmLabel={deletingAccount ? 'Deleting…' : 'Delete Account'}
      destructive
      onConfirm={deleteAccount}
    />
    </>
  );
}

function buildSettingsImpact(panel: SettingsPanelId, saved: SettingsState, drafts: SettingsState) {
  const sections = PANEL_SECTION_MAP[panel];
  const changedSections = sections.filter((section) => JSON.stringify(saved[section]) !== JSON.stringify(drafts[section]));
  return {
    ...SETTINGS_IMPACT_COPY[panel],
    sections,
    changedSections,
  };
}

function BehaviorPreview({
  impact,
}: {
  impact: SettingsImpact & { sections: SettingsSectionKey[]; changedSections: SettingsSectionKey[] };
}) {
  const hasChanges = impact.changedSections.length > 0;
  return (
    <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">Behavior preview</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{impact.current}</p>
        </div>
        <div className={`w-fit rounded-full border px-3 py-1 noesis-eyebrow noesis-eyebrow--sm ${
          hasChanges
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border bg-muted/20 text-muted-foreground'
        }`}>
          {hasChanges ? `${impact.changedSections.length} unsaved` : 'Saved'}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">After save this affects</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {impact.affects.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">Saved sections</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {impact.sections.length > 0 ? (
              impact.sections.map((section) => {
                const changed = impact.changedSections.includes(section);
                return (
                  <span
                    key={section}
                    className={`rounded-full border px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm ${
                      changed
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    {sectionLabel(section)}
                  </span>
                );
              })
            ) : (
              <span className="text-sm text-muted-foreground">No saved settings. This section is guidance only.</span>
            )}
          </div>
        </div>
      </div>

      {impact.limitations.length > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/15 p-4">
          <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">Limits and safeguards</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {impact.limitations.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 rounded-full bg-muted-foreground/60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SettingsCard({ title, description, children, headingRef }: { title: string; description: string; children: React.ReactNode; headingRef?: React.Ref<HTMLHeadingElement> }) {
  return (
    <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="font-headline text-2xl font-semibold italic">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function SaveBar({ onSave, onDiscard, saving, busy, dirty, saved }: { onSave: () => void; onDiscard?: () => void; saving: boolean; busy: boolean; dirty: boolean; saved: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
      <span role="status" className="sr-only">{!dirty && saved ? 'Changes saved' : ''}</span>
      {dirty && onDiscard && <Button type="button" variant="ghost" disabled={busy} onClick={onDiscard}>Discard preview</Button>}
      <Button type="button" onClick={onSave} disabled={busy || !dirty}>
        {saving ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
        {saving ? 'Saving' : !dirty && saved ? 'Saved' : 'Save Changes'}
      </Button>
    </div>
  );
}

function LimitationCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function IntegrationCard({ title, status, body }: { title: string; status: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-headline text-lg font-semibold italic text-foreground">{title}</div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 noesis-eyebrow noesis-eyebrow--sm text-muted-foreground">{status}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function TerminologyCard({ term, alt, body }: { term: string; alt: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-muted-foreground">User-facing term</div>
      <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{term}</div>
      <div className="mt-3 rounded-xl bg-muted/25 p-3 text-xs italic text-muted-foreground">Possible language: {alt}</div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function ClassificationCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="noesis-recommendation">
      <div className="noesis-eyebrow noesis-eyebrow--sm font-bold text-accent">Classification system</div>
      <div className="mt-1 font-headline text-xl font-semibold italic text-foreground">{title}</div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

/** Navigation style is a per-device choice, so it applies at once instead of waiting for Save. */
function LoopNavigationRow() {
  const style = useNavStyle();
  return (
    <div className="grid gap-1">
      <SwitchRow label="Use the Loop dock (turn off for the classic sidebar)" checked={style === 'loop'} onCheckedChange={(checked) => writeNavStyle(checked ? 'loop' : 'sidebar')} />
      <p className="px-1 text-xs text-muted-foreground">A floating dock that lays pages out as Notice, Outline, Examine, Stand, Implement, Survey: N·O·E·S·I·S. Desktop only; applies on this device immediately.</p>
    </div>
  );
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
      <Label htmlFor={id} className="cursor-pointer text-sm text-foreground">{label}</Label>
      <Switch id={id} aria-label={label} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function formatAccountDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
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
      return 'AI Assistance';
    case 'sourceIntake':
      return 'Source Intake';
    default:
      return section.charAt(0).toUpperCase() + section.slice(1);
  }
}

const STAGE_COLOR_ROWS: Array<{ key: StageColorKey; stage: string; pages: string }> = [
  { key: 'encounter', stage: 'Notice', pages: 'Library, Sources, Annotations, My Desk' },
  { key: 'outline', stage: 'Outline', pages: 'Concepts' },
  { key: 'examine', stage: 'Examine', pages: 'Inquiries' },
  { key: 'claim', stage: 'Stand', pages: 'Positions' },
  { key: 'act', stage: 'Implement', pages: 'Praxis, Exercises, Commitments' },
  { key: 'integrate', stage: 'Perspective', pages: 'Works, Atlas, Evolution' },
  { key: 'more', stage: 'More', pages: 'Profile, Settings, Context Desk' },
];

/* Colours a person picks for their own pages. These are data, not design
   tokens: they are stored on the workspace and must stay the same colour
   whatever theme is in use. */
const PAGE_SWATCHES = [
  ['Brick', '#b85444'], ['Coral', '#dc795d'], ['Amber', '#bc8632'],
  ['Olive', '#828843'], ['Fern', '#4b9567'], ['Teal', '#318e88'],
  ['Lake', '#3686a7'], ['Denim', '#587bac'], ['Iris', '#806abb'],
  ['Plum', '#a2679c'], ['Rose', '#be6584'], ['Slate', '#768491'],
] as const;

function StageColorPicker({ value, onChange }: { value: Partial<Record<StageColorKey, string>>; onChange: (next: Partial<Record<StageColorKey, string>>) => void }) {
  return (
    <details className="mt-6 rounded-[var(--card-radius)] border border-border px-4">
      <summary className="cursor-pointer py-3 text-sm font-medium">Page colours</summary>
      <ul className="divide-y divide-border pb-2">
        {STAGE_COLOR_ROWS.map(({ key, stage, pages }) => {
          const current = value[key]?.toLowerCase() || 'theme';
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div><span className="text-sm font-medium">{stage}</span><p className="text-xs text-muted-foreground">{pages}</p></div>
              <Select value={current} onValueChange={(colour) => {
                const next = { ...value };
                if (colour === 'theme') delete next[key]; else next[key] = colour;
                onChange(next);
              }}>
                <SelectTrigger aria-label={stage + ' colour'} className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="theme">Theme default</SelectItem>
                  {current !== 'theme' && !PAGE_SWATCHES.some(([, hex]) => hex === current) && <SelectItem value={current}>Previous colour</SelectItem>}
                  {PAGE_SWATCHES.map(([name, hex]) => <SelectItem key={hex} value={hex}><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-full border border-current/20" style={{ backgroundColor: hex }} />{name}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
