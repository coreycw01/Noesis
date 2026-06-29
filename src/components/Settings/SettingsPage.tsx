"use client";

import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { Info, LogOut, Save } from 'lucide-react';
import { useAuth } from '@/firebase';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DRAFT_LABELS, WRITING_STYLE_DESCRIPTIONS, WRITING_STYLE_LABELS, WRITING_STYLES } from '@/lib/readex';
import type { AccentTheme, DraftStatus, DraftType, ThemeMode, UserPreferences, UserProfile, WritingStyle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { noesisGuide } from '@/lib/noesis-guide';

interface SettingsPageProps {
  user: User | null;
  profile: UserProfile;
  preferences: UserPreferences;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onSavePreferences: (preferences: UserPreferences) => Promise<void>;
}

const themeModes: ThemeMode[] = ['light', 'dark', 'system'];
const accentThemes: AccentTheme[] = ['violet', 'sage', 'blue', 'amber', 'rose', 'mono'];
const draftTypes: DraftType[] = ['essay', 'script', 'field_note', 'voice_note', 'talk_to_text', 'drawing', 'recording'];
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
  onSaveProfile,
  onSavePreferences,
}: SettingsPageProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const [profileDraft, setProfileDraft] = useState<UserProfile>(profile);
  const [preferencesDraft, setPreferencesDraft] = useState<UserPreferences>(preferences);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => setProfileDraft(profile), [profile]);
  useEffect(() => setPreferencesDraft(preferences), [preferences]);

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = preferencesDraft.themeMode === 'dark' || (preferencesDraft.themeMode === 'system' && systemDark);
    root.classList.toggle('dark', dark);
    root.dataset.theme = preferencesDraft.accentTheme;
  }, [preferencesDraft.themeMode, preferencesDraft.accentTheme]);

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
            Control your account, appearance, and the default shape of every new work.
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
                      {draftTypes.map((type) => <SelectItem key={type} value={type}>{DRAFT_LABELS[type]}</SelectItem>)}
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

        </div>

        <SettingsCard title={noesisGuide.title} description="A user-facing guide built from the current Noesis structure, labels, collections, and creation flows.">
          <div className="rounded-2xl border border-accent/15 bg-accent/[0.04] p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 items-center justify-center rounded-full border border-accent/20 bg-background text-accent">
                <Info className="size-4" />
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold italic">Overview</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{noesisGuide.overview}</p>
              </div>
            </div>
          </div>

          <Accordion type="multiple" className="mt-6 w-full">
            <AccordionItem value="sections">
              <AccordionTrigger className="font-headline text-xl italic no-underline hover:no-underline">Main Sections</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {noesisGuide.sections.map((section) => (
                    <Card key={section.id} className="rounded-xl border-border bg-background/60 p-4 shadow-none">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-headline text-lg font-bold italic">{section.label}</h4>
                          <p className="mt-1 font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                            {section.section}{section.viewId ? ` · view: ${section.viewId}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{section.section}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{section.definition}</p>
                      <GuideList label="What you do here" items={section.whatYouDo} />
                      <GuideList label="How it connects" items={section.connectsTo} />
                      <GuideList label="Important actions" items={section.importantActions} />
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="objects">
              <AccordionTrigger className="font-headline text-xl italic no-underline hover:no-underline">Core Objects</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4">
                  {noesisGuide.objects.map((item) => (
                    <Card key={item.id} className="rounded-xl border-border bg-background/60 p-4 shadow-none">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-headline text-lg font-bold italic">{item.label}</h4>
                        {item.collection && (
                          <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                            {item.collection}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.definition}</p>
                      <GuideList label="Where it appears" items={item.appearsIn} />
                      <GuideList label="Created by" items={item.createdBy} />
                      <GuideList label="Connects to" items={item.connectsTo} />
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="connections">
              <AccordionTrigger className="font-headline text-xl italic no-underline hover:no-underline">How Things Connect</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <Card className="rounded-xl border-border bg-background/60 p-5 shadow-none">
                    <h4 className="font-headline text-lg font-bold italic">Common Flow</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      This is a cautious map of the app as it currently behaves. It shows common movement through the system, not a rigid official hierarchy.
                    </p>
                    <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-4 font-code text-[11px] leading-6 text-foreground/80">
{noesisGuide.commonFlowDiagram}
                    </pre>
                  </Card>

                  <Card className="rounded-xl border-border bg-background/60 p-5 shadow-none">
                    <h4 className="font-headline text-lg font-bold italic">Relationship Fields in Use</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      These are the kinds of fields the current app uses to connect objects across pages and collections.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {noesisGuide.relationshipFields.map((field) => (
                        <Badge key={field} variant="secondary" className="rounded-full font-code text-[8px] uppercase tracking-widest">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="workflows">
              <AccordionTrigger className="font-headline text-xl italic no-underline hover:no-underline">Common Workflows</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {noesisGuide.workflows.map((workflow) => (
                    <Card key={workflow.id} className="rounded-xl border-border bg-background/60 p-4 shadow-none">
                      <h4 className="font-headline text-lg font-bold italic">{workflow.label}</h4>
                      <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                        {workflow.steps.map((step, index) => (
                          <li key={step} className="flex gap-3">
                            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 font-code text-[10px] font-bold text-accent">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="goals">
              <AccordionTrigger className="font-headline text-xl italic no-underline hover:no-underline">Goals Explained</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <GlossaryCard title="Goal Set" description="The named plan saved in the goals settings document. The sidebar card and Goals page both read from this shared saved state." />
                  <GlossaryCard title="Goal Category" description="A bucket inside the goal set, such as Books or Podcasts. Each category maps to one or more included media types." />
                  <GlossaryCard title="Included Media Types" description="The source formats that count toward that category, such as Book and Audiobook." />
                  <GlossaryCard title="Progress Count" description="The current completed count derived from finished source items whose media type is included in the category." />
                  <GlossaryCard title="Target Amount" description="The user-edited target value for that category inside the current goal set." />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="glossary">
              <AccordionTrigger className="font-headline text-xl italic no-underline hover:no-underline">Glossary</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3">
                  {noesisGuide.glossary.map(([term, definition]) => (
                    <div key={term} className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="font-headline text-lg font-bold italic">{term}</div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{definition}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SettingsCard>
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

function GuideList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-4">
      <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-accent">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GlossaryCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-xl border-border bg-background/60 p-4 shadow-none">
      <h4 className="font-headline text-lg font-bold italic">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Card>
  );
}
