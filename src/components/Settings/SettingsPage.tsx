"use client";

import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { LogOut, Save } from 'lucide-react';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MEDIA_LABELS, MEDIA_TYPES, WRITING_STYLE_DESCRIPTIONS, WRITING_STYLE_LABELS, WRITING_STYLES } from '@/lib/readex';
import type { AccentTheme, DraftStatus, DraftType, GoalSettings, MediaType, ThemeMode, UserPreferences, UserProfile, WritingStyle } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SettingsPageProps {
  user: User | null;
  profile: UserProfile;
  preferences: UserPreferences;
  goal: GoalSettings;
  goalProgress: Partial<Record<MediaType, number>>;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onSavePreferences: (preferences: UserPreferences) => Promise<void>;
  onSaveGoal: (goal: GoalSettings) => Promise<void>;
}

const themeModes: ThemeMode[] = ['light', 'dark', 'system'];
const accentThemes: AccentTheme[] = ['violet', 'sage', 'blue', 'amber', 'rose', 'mono'];
const draftTypes: DraftType[] = ['essay', 'script', 'field_note'];
const draftStatuses: DraftStatus[] = ['seed', 'drafting', 'revised', 'final'];

const accentLabels: Record<AccentTheme, string> = {
  violet: 'Violet',
  sage: 'Sage',
  blue: 'Blue',
  amber: 'Amber',
  rose: 'Rose',
  mono: 'Mono',
};

export function SettingsPage({
  user,
  profile,
  preferences,
  goal,
  goalProgress,
  onSaveProfile,
  onSavePreferences,
  onSaveGoal,
}: SettingsPageProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const [profileDraft, setProfileDraft] = useState<UserProfile>(profile);
  const [preferencesDraft, setPreferencesDraft] = useState<UserPreferences>(preferences);
  const [goalDraft, setGoalDraft] = useState<GoalSettings>(goal);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => setProfileDraft(profile), [profile]);
  useEffect(() => setPreferencesDraft(preferences), [preferences]);
  useEffect(() => setGoalDraft(goal), [goal]);

  const saveProfile = async () => {
    setSaving('profile');
    try {
      if (user) {
        await updateProfile(user, {
          displayName: profileDraft.displayName || null,
          photoURL: profileDraft.photoURL || null,
        });
      }
      await onSaveProfile(profileDraft);
      toast({ title: 'Profile saved', description: 'Your Noesis profile is up to date.' });
    } catch {
      toast({ title: 'Profile not saved', description: 'Check Firebase Auth permissions and try again.' });
    } finally {
      setSaving(null);
    }
  };

  const savePreferences = async () => {
    setSaving('preferences');
    try {
      await onSavePreferences(preferencesDraft);
      toast({ title: 'Preferences saved', description: 'Appearance and writing defaults were updated.' });
    } catch {
      toast({ title: 'Preferences not saved', description: 'Noesis could not write your settings.' });
    } finally {
      setSaving(null);
    }
  };

  const saveGoals = async () => {
    setSaving('goals');
    try {
      await onSaveGoal(goalDraft);
      toast({ title: 'Source goals saved', description: 'Your media targets are updated.' });
    } catch {
      toast({ title: 'Goals not saved', description: 'Noesis could not write your source goals.' });
    } finally {
      setSaving(null);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    setSaving('reset');
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({ title: 'Reset email sent', description: 'Check your inbox for a password reset link.' });
    } catch {
      toast({ title: 'Reset not sent', description: 'Firebase could not send the reset email.' });
    } finally {
      setSaving(null);
    }
  };

  const updateWritingDefaults = (patch: Partial<UserPreferences['writingDefaults']>) => {
    setPreferencesDraft((prev) => ({
      ...prev,
      writingDefaults: { ...prev.writingDefaults, ...patch },
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 pt-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <h1 className="text-[28px] font-headline font-semibold italic text-foreground/80">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Control your account, appearance, source goals, and the default shape of every new work.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          <SettingsCard title="Profile" description="Your account identity and public-facing Noesis details.">
            <div className="grid gap-4">
              <Field label="Display Name">
                <Input value={profileDraft.displayName || ''} onChange={(event) => setProfileDraft((prev) => ({ ...prev, displayName: event.target.value }))} />
              </Field>
              <Field label="Email">
                <Input value={profileDraft.email || user?.email || ''} disabled />
              </Field>
              <Field label="Photo URL">
                <Input value={profileDraft.photoURL || ''} onChange={(event) => setProfileDraft((prev) => ({ ...prev, photoURL: event.target.value }))} placeholder="https://..." />
              </Field>
              <Field label="Bio">
                <Textarea value={profileDraft.bio || ''} onChange={(event) => setProfileDraft((prev) => ({ ...prev, bio: event.target.value }))} className="min-h-[110px]" placeholder="What are you using Noesis to understand?" />
              </Field>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={saveProfile} disabled={saving === 'profile'} className="rounded-full px-7 font-bold">
                <Save className="mr-2 size-4" /> Save Profile
              </Button>
              <Button variant="outline" onClick={resetPassword} disabled={!user?.email || saving === 'reset'} className="rounded-full bg-card px-7 font-bold">
                Reset Password
              </Button>
              <Button variant="ghost" onClick={() => signOut(auth)} className="rounded-full text-destructive hover:text-destructive">
                <LogOut className="mr-2 size-4" /> Sign Out
              </Button>
            </div>
          </SettingsCard>

          <SettingsCard title="Appearance" description="Choose the reading light and accent color for the whole workspace.">
            <div className="grid gap-5">
              <Field label="Mode">
                <div className="grid grid-cols-3 gap-2">
                  {themeModes.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPreferencesDraft((prev) => ({ ...prev, themeMode: mode }))}
                      className={cn(
                        'rounded-full border px-4 py-2 font-code text-[10px] font-bold uppercase tracking-widest transition-colors',
                        preferencesDraft.themeMode === mode ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Theme Color">
                <div className="grid grid-cols-3 gap-2">
                  {accentThemes.map((accent) => (
                    <button
                      key={accent}
                      onClick={() => setPreferencesDraft((prev) => ({ ...prev, accentTheme: accent }))}
                      className={cn(
                        'flex items-center justify-between rounded-full border px-4 py-2 text-left font-code text-[10px] font-bold uppercase tracking-widest transition-colors',
                        preferencesDraft.accentTheme === accent ? 'border-accent bg-accent/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span>{accentLabels[accent]}</span>
                      <span className={cn('size-3 rounded-full', `theme-dot-${accent}`)} />
                    </button>
                  ))}
                </div>
              </Field>

              <div className="rounded-xl border border-border bg-muted/20 p-5">
                <Badge className="mb-4 rounded-full bg-accent text-accent-foreground">Preview</Badge>
                <h3 className="font-headline text-2xl font-bold italic">Noesis workspace</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">The selected theme applies to cards, controls, links, and writing surfaces.</p>
              </div>
            </div>
            <div className="mt-6">
              <Button onClick={savePreferences} disabled={saving === 'preferences'} className="rounded-full px-7 font-bold">
                <Save className="mr-2 size-4" /> Save Appearance
              </Button>
            </div>
          </SettingsCard>

          <SettingsCard title="Writing Defaults" description="Choose the starting form for every new Work you create.">
            <div className="grid gap-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Default Type">
                  <Select value={preferencesDraft.writingDefaults.type} onValueChange={(value) => updateWritingDefaults({ type: value as DraftType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {draftTypes.map((type) => <SelectItem key={type} value={type}>{type === 'field_note' ? 'Field Note' : type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default Status">
                  <Select value={preferencesDraft.writingDefaults.status} onValueChange={(value) => updateWritingDefaults({ status: value as DraftStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {draftStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Editor Feel">
                  <Select value={preferencesDraft.writingDefaults.editorFeel} onValueChange={(value) => updateWritingDefaults({ editorFeel: value as UserPreferences['writingDefaults']['editorFeel'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="focused">Focused</SelectItem>
                      <SelectItem value="spacious">Spacious</SelectItem>
                      <SelectItem value="dense">Dense</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Default Paper">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {WRITING_STYLES.map((style) => (
                    <button
                      key={style}
                      onClick={() => updateWritingDefaults({ writingStyle: style })}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
                        preferencesDraft.writingDefaults.writingStyle === style ? 'border-accent bg-accent/10 shadow-sm' : 'border-border bg-card'
                      )}
                    >
                      <div className="font-headline text-lg font-bold italic">{WRITING_STYLE_LABELS[style]}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{WRITING_STYLE_DESCRIPTIONS[style]}</p>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="mt-6">
              <Button onClick={savePreferences} disabled={saving === 'preferences'} className="rounded-full px-7 font-bold">
                <Save className="mr-2 size-4" /> Save Writing Defaults
              </Button>
            </div>
          </SettingsCard>

          <SettingsCard title="Source Goals" description="Track media targets separately so books, films, videos, and articles do not collapse into one count.">
            <Field label="Goal Label">
              <Input value={goalDraft.label} onChange={(event) => setGoalDraft((prev) => ({ ...prev, label: event.target.value }))} />
            </Field>
            <div className="mt-5 grid max-h-[420px] gap-3 overflow-y-auto pr-2">
              {MEDIA_TYPES.map((type) => {
                const active = goalDraft.types.includes(type);
                const done = goalProgress[type] || 0;
                const target = goalDraft.targets[type] || 12;
                return (
                  <div key={type} className="grid grid-cols-[auto_1fr_80px_auto] items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setGoalDraft((prev) => ({ ...prev, types: event.target.checked ? Array.from(new Set([...prev.types, type])) : prev.types.filter((item) => item !== type) }))}
                      className="size-4 accent-accent"
                    />
                    <div>
                      <div className="font-code text-[10px] font-bold uppercase tracking-widest">{MEDIA_LABELS[type]}</div>
                      <div className="text-xs text-muted-foreground">{done} finished</div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={target}
                      onChange={(event) => setGoalDraft((prev) => ({ ...prev, targets: { ...prev.targets, [type]: Math.max(1, Number(event.target.value) || 1) } }))}
                      className="h-9 text-right font-code text-xs"
                    />
                    <Badge variant="outline" className="rounded-full bg-card font-code text-[9px]">{done}/{target}</Badge>
                  </div>
                );
              })}
            </div>
            <div className="mt-6">
              <Button onClick={saveGoals} disabled={saving === 'goals'} className="rounded-full px-7 font-bold">
                <Save className="mr-2 size-4" /> Save Goals
              </Button>
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="font-headline text-2xl font-bold italic">{title}</h2>
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
