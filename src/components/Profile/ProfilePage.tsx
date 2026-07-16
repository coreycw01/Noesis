"use client";

import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { Brain, Globe, Lightbulb, LogOut, Save, Sparkles, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type {
  BeliefProfile,
  Concept,
  Draft,
  Media,
  ProfileMetacognitionSummary,
  ProfilePrivacySettings,
  Question,
  ThinkingEvent,
  ThinkingMetrics,
  ThinkingPattern,
  Unknown,
  UserProfile,
  VaultEntry,
  Practice,
} from '@/lib/types';

interface ProfilePageProps {
  user: User | null;
  profile: UserProfile;
  privacy: ProfilePrivacySettings;
  summary: ProfileMetacognitionSummary;
  concepts: Concept[];
  inquiries: Question[];
  positions: VaultEntry[];
  sources: Media[];
  works: Draft[];
  practices: Practice[];
  thinkingEvents: ThinkingEvent[];
  beliefProfiles: BeliefProfile[];
  unknowns: Unknown[];
  thinkingPatterns: ThinkingPattern[];
  thinkingMetrics: ThinkingMetrics;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onSavePrivacy: (privacy: ProfilePrivacySettings) => Promise<void>;
  onAddUnknown: (unknown: Partial<Unknown>) => Unknown;
  onUpdateUnknown: (unknown: Unknown) => void;
  onUpdateThinkingPattern: (pattern: ThinkingPattern) => void;
  onNavigate: (view: string, targetId?: string) => void;
}

export function ProfilePage({
  user,
  profile,
  privacy,
  summary,
  concepts,
  inquiries,
  positions,
  sources,
  works,
  practices,
  thinkingEvents,
  beliefProfiles,
  unknowns,
  thinkingPatterns,
  thinkingMetrics,
  onSaveProfile,
  onSavePrivacy,
  onAddUnknown,
  onUpdateUnknown,
  onUpdateThinkingPattern,
  onNavigate,
}: ProfilePageProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const [profileDraft, setProfileDraft] = useState<UserProfile>(profile);
  const [privacyDraft, setPrivacyDraft] = useState<ProfilePrivacySettings>(privacy);
  const [unknownDraft, setUnknownDraft] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState<'profile' | 'privacy' | null>(null);

  useEffect(() => setProfileDraft(profile), [profile]);
  useEffect(() => setPrivacyDraft(privacy), [privacy]);

  const conceptLeaders = useMemo(
    () =>
      [...concepts]
        .sort((a, b) => (b.links.length + b.sourceIds.length) - (a.links.length + a.sourceIds.length))
        .slice(0, 6),
    [concepts]
  );

  const activePositions = useMemo(
    () => [...positions].filter((item) => item.status !== 'rejected' && item.status !== 'abandoned').slice(0, 5),
    [positions]
  );

  const revisedPositions = useMemo(() => {
    const revisedIds = new Set(
      thinkingEvents
        .filter((event) => event.entityType === 'position' && ['position_revised', 'confidence_changed', 'challenge_added'].includes(event.eventType))
        .map((event) => event.entityId)
    );
    return positions.filter((item) => revisedIds.has(item.id)).slice(0, 5);
  }, [positions, thinkingEvents]);

  const challengedBeliefs = useMemo(
    () =>
      [...beliefProfiles]
        .filter((item) => (item.challengedBy || []).length > 0)
        .sort((a, b) => (b.challengedBy?.length || 0) - (a.challengedBy?.length || 0))
        .slice(0, 5)
        .map((item) => positions.find((position) => position.id === item.positionId))
        .filter(Boolean) as VaultEntry[],
    [beliefProfiles, positions]
  );

  const sourceLeaders = useMemo(
    () =>
      [...sources]
        .sort((a, b) => b.annotations.length - a.annotations.length)
        .slice(0, 5),
    [sources]
  );

  const openInquiries = useMemo(
    () => [...inquiries].filter((item) => !['resolved', 'archived', 'answered'].includes(item.status)).slice(0, 5),
    [inquiries]
  );

  const recentBeliefEvents = useMemo(
    () =>
      [...thinkingEvents]
        .filter((event) => event.entityType === 'position')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 10),
    [thinkingEvents]
  );

  const openUnknowns = useMemo(() => unknowns.filter((item) => item.status !== 'resolved' && item.status !== 'archived'), [unknowns]);
  const resolvedUnknowns = useMemo(() => unknowns.filter((item) => item.status === 'resolved'), [unknowns]);

  const saveProfile = async () => {
    setSaving('profile');
    try {
      await onSaveProfile(profileDraft);
      toast({ title: 'Profile saved', description: 'Your thinker profile is now up to date.' });
    } catch {
      toast({ variant: 'destructive', title: 'Profile not saved', description: 'Noesis could not save your profile right now.' });
    } finally {
      setSaving(null);
    }
  };

  const savePrivacy = async () => {
    setSaving('privacy');
    try {
      await onSavePrivacy(privacyDraft);
      toast({ title: 'Public philosophy updated', description: 'Your sharing defaults were saved.' });
    } catch {
      toast({ variant: 'destructive', title: 'Privacy not saved', description: 'Noesis could not save your sharing settings.' });
    } finally {
      setSaving(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Signed out', description: 'Your Noesis workspace is closed on this device.' });
    } catch {
      toast({ variant: 'destructive', title: 'Sign out failed', description: 'Noesis could not sign you out right now.' });
    }
  };

  const addUnknown = () => {
    if (!unknownDraft.title.trim()) return;
    onAddUnknown({
      title: unknownDraft.title.trim(),
      description: unknownDraft.description.trim(),
      domain: 'profile',
      createdFrom: 'manual',
      importance: 'medium',
      status: 'active',
      conceptTags: [],
      sourceIds: [],
      positionIds: [],
      inquiryIds: [],
      questionIds: [],
    });
    setUnknownDraft({ title: '', description: '' });
  };

  const trendCards = [
    ['Questions asked', String(thinkingMetrics.questionsAsked)],
    ['Beliefs revised', String(thinkingMetrics.beliefsRevised)],
    ['Unknowns open', String(openUnknowns.length)],
    ['Sources studied', String(thinkingMetrics.sourcesStudied)],
    ['Contradictions resolved', String(thinkingMetrics.contradictionsResolved)],
    ['Practices active', String(practices.filter((item) => item.status === 'active').length)],
  ] as const;

  const profileStats = [
    ['Concepts', concepts.length],
    ['Positions', positions.length],
    ['Works', works.length],
    ['Sources', sources.length],
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 pt-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          title="Profile"
          description="Shape the identity, tendencies, unknowns, and public-facing philosophy behind your Noesis workspace."
          actions={(
            <>
              <Button variant="outline" onClick={handleSignOut} className="rounded-full bg-card px-6 font-semibold text-destructive hover:text-destructive">
                <LogOut className="mr-2 size-4" />
                Sign Out
              </Button>
              <Button onClick={saveProfile} disabled={saving === 'profile'} className="rounded-full px-6 font-semibold">
                <Save className="mr-2 size-4" />
                {saving === 'profile' ? 'Saving Profile' : 'Save Profile'}
              </Button>
            </>
          )}
        />

        <Card className="rounded-3xl border-border bg-card p-7 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-5">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-3xl border border-border bg-muted/30 text-muted-foreground">
                {profileDraft.photoURL || profileDraft.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileDraft.photoURL || profileDraft.avatarUrl}
                    alt={profileDraft.displayName || 'Profile avatar'}
                    className="h-full w-full rounded-3xl object-cover"
                  />
                ) : (
                  <UserCircle2 className="size-11" />
                )}
              </div>
              <div className="max-w-3xl">
                <div className="font-code text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Thinker identity</div>
                <h1 className="mt-2 font-headline text-3xl font-semibold italic text-foreground">
                  {profileDraft.displayName || user?.displayName || 'Untitled Thinker'}
                </h1>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {profileDraft.bio || 'Shape the public and private identity behind your map, positions, inquiries, and works.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profileDraft.learningSeason && <Badge variant="outline" className="rounded-full">{profileDraft.learningSeason}</Badge>}
                  {(profileDraft.currentThemes || []).slice(0, 3).map((theme) => (
                    <Badge key={theme} variant="secondary" className="rounded-full">{theme}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              {profileStats.map(([label, value]) => (
                <ProfileStat key={label} label={label} value={value} />
              ))}
            </div>
          </div>
        </Card>

        <Tabs defaultValue="identity" className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl border border-border bg-card p-2">
            <TabsTrigger value="identity" className="rounded-xl">Identity</TabsTrigger>
            <TabsTrigger value="connections" className="rounded-xl">Connections</TabsTrigger>
            <TabsTrigger value="metacognition" className="rounded-xl">Metacognition</TabsTrigger>
            <TabsTrigger value="unknowns" className="rounded-xl">Unknowns</TabsTrigger>
            <TabsTrigger value="public" className="rounded-xl">Public View</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-0 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <SectionCard title="Overview" description="Identity, focus, and the current season of your thought.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Display Name">
                    <Input value={profileDraft.displayName || ''} onChange={(event) => setProfileDraft((prev) => ({ ...prev, displayName: event.target.value }))} />
                  </Field>
                  <Field label="Email">
                    <Input value={profileDraft.email || user?.email || ''} disabled />
                  </Field>
                  <Field label="Avatar URL">
                    <Input value={profileDraft.avatarUrl || profileDraft.photoURL || ''} onChange={(event) => setProfileDraft((prev) => ({ ...prev, avatarUrl: event.target.value, photoURL: event.target.value }))} placeholder="https://..." />
                  </Field>
                  <Field label="Learning Season">
                    <Input value={profileDraft.learningSeason || ''} onChange={(event) => setProfileDraft((prev) => ({ ...prev, learningSeason: event.target.value }))} placeholder="ex. Belief revision and discipline" />
                  </Field>
                  <Field label="Intellectual Focus">
                    <TagEditor value={profileDraft.intellectualFocus || []} onChange={(value) => setProfileDraft((prev) => ({ ...prev, intellectualFocus: value }))} placeholder="philosophy, theology, psychology" />
                  </Field>
                  <Field label="Current Themes">
                    <TagEditor value={profileDraft.currentThemes || []} onChange={(value) => setProfileDraft((prev) => ({ ...prev, currentThemes: value }))} placeholder="identity, meaning, discipline" />
                  </Field>
                  <Field label="Disciplines">
                    <TagEditor value={profileDraft.disciplines || []} onChange={(value) => setProfileDraft((prev) => ({ ...prev, disciplines: value }))} placeholder="ethics, political theory, phenomenology" />
                  </Field>
                </div>
                <Field label="Bio">
                  <Textarea value={profileDraft.bio || ''} onChange={(event) => setProfileDraft((prev) => ({ ...prev, bio: event.target.value }))} className="min-h-[130px]" placeholder="What kind of thinker are you trying to become?" />
                </Field>
              </SectionCard>

              <SectionCard title="Cognition Metrics" description="Reflective indicators of how your thinking is moving, not productivity vanity.">
                <div className="grid gap-3 sm:grid-cols-2">
                  {trendCards.map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border bg-background/60 p-4">
                      <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                      <div className="mt-2 font-headline text-3xl font-semibold italic text-foreground">{value}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="connections" className="mt-0 grid gap-6 lg:grid-cols-2">
            <SectionCard title="Intellectual Identity" description="A grounded snapshot of the ideas, sources, and positions shaping you right now.">
              <div className="grid gap-5">
                <LinkGroup title="Core recurring concepts" empty="No concepts yet." onOpenAll={() => onNavigate('concepts')}>
                  {conceptLeaders.map((concept) => <MiniLink key={concept.id} label={concept.name} meta={`${concept.links.length} links`} onClick={() => onNavigate('concepts', concept.id)} />)}
                </LinkGroup>
                <LinkGroup title="Most active positions" empty="No active positions yet." onOpenAll={() => onNavigate('vault')}>
                  {activePositions.map((position) => <MiniLink key={position.id} label={position.title} meta={position.type} onClick={() => onNavigate('vault', position.id)} />)}
                </LinkGroup>
                <LinkGroup title="Most revised positions" empty="No revised positions yet." onOpenAll={() => onNavigate('vault')}>
                  {revisedPositions.map((position) => <MiniLink key={position.id} label={position.title} meta="recently revised" onClick={() => onNavigate('vault', position.id)} />)}
                </LinkGroup>
                <LinkGroup title="Most challenged beliefs" empty="No challenged beliefs yet." onOpenAll={() => onNavigate('vault')}>
                  {challengedBeliefs.map((position) => <MiniLink key={position.id} label={position.title} meta="under pressure" onClick={() => onNavigate('vault', position.id)} />)}
                </LinkGroup>
                <LinkGroup title="Major sources shaping you" empty="No sources yet." onOpenAll={() => onNavigate('source-index')}>
                  {sourceLeaders.map((source) => <MiniLink key={source.id} label={source.title} meta={source.type} onClick={() => onNavigate('library', source.id)} />)}
                </LinkGroup>
                <LinkGroup title="Current unresolved inquiries" empty="No open inquiries yet." onOpenAll={() => onNavigate('questions')}>
                  {openInquiries.map((inquiry) => <MiniLink key={inquiry.id} label={inquiry.text} meta={inquiry.status} onClick={() => onNavigate('questions', inquiry.id)} />)}
                </LinkGroup>
              </div>
            </SectionCard>

            <SectionCard title="Belief Biography" description="How your positions have been formed, pressured, revised, and replaced over time.">
              <div className="space-y-3">
                {recentBeliefEvents.length ? recentBeliefEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{event.eventType.replaceAll('_', ' ')}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                    </div>
                    <div className="mt-2 font-medium text-foreground">{event.summary}</div>
                    {flattenRelatedEntityIds(event.relatedEntityIds).length ? <p className="mt-2 text-sm text-muted-foreground">Related objects: {flattenRelatedEntityIds(event.relatedEntityIds).join(', ')}</p> : null}
                  </div>
                )) : <EmptyCopy text="No position history yet. Once beliefs are created and revised, their biography will collect here." />}
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="metacognition" className="mt-0">
            <SectionCard title="Thinking Patterns" description="Provisional tendencies grounded in stored evidence, not fixed identity labels.">
              <div className="space-y-3">
                {thinkingPatterns.map((pattern) => (
                  <Card key={pattern.patternId} className="rounded-2xl border-border bg-background/60 p-4 shadow-none">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-headline text-xl font-semibold italic">{pattern.label}</h3>
                      <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{Math.round(pattern.confidence * 100)}% confidence</Badge>
                      <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{pattern.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{pattern.description}</p>
                    {pattern.evidence.length > 0 && <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{pattern.evidence.map((evidence) => <li key={evidence}>- {evidence}</li>)}</ul>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => onUpdateThinkingPattern({ ...pattern, status: 'acknowledged' })}>Acknowledge</Button>
                      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onUpdateThinkingPattern({ ...pattern, status: 'dismissed' })}>Dismiss</Button>
                    </div>
                  </Card>
                ))}
                {!thinkingPatterns.length && <EmptyCopy text="No thinking patterns inferred yet. As the workspace gathers more positions, questions, and revisions, Noesis will be able to reflect clearer tendencies back to you." />}
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/15 p-4">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Brain className="size-4 text-accent" />
                  Summary snapshot
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(summary.topThinkingPatterns || []).slice(0, 6).map((item) => <Badge key={item} className="rounded-full">{item}</Badge>)}
                  {!summary.topThinkingPatterns?.length && <span className="text-sm text-muted-foreground">No stored summary yet.</span>}
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="unknowns" className="mt-0">
            <SectionCard title="Unknowns and Knowledge Gaps" description="A serious thinking system should be able to name what it still does not understand.">
              <div className="grid gap-3">
                <Input value={unknownDraft.title} onChange={(event) => setUnknownDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Name an unresolved gap" />
                <Textarea value={unknownDraft.description} onChange={(event) => setUnknownDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-[90px]" placeholder="Why does this gap matter?" />
                <div className="flex justify-end">
                  <Button onClick={addUnknown} className="rounded-full">
                    <Lightbulb className="mr-2 size-4" />
                    Add Unknown
                  </Button>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <StatusList title={`Open (${openUnknowns.length})`} items={openUnknowns} actionLabel="Mark resolved" onAction={(item) => onUpdateUnknown({ ...item, status: 'resolved', resolvedAt: new Date().toISOString() })} />
                <StatusList title={`Resolved (${resolvedUnknowns.length})`} items={resolvedUnknowns} />
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="public" className="mt-0">
            <SectionCard title="Public Philosophy View" description="Prepare a future-facing public layer without exposing anything by default.">
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-border bg-background/60 p-5">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Globe className="size-4 text-accent" />
                    Sharing controls
                  </div>
                  <div className="mt-4 space-y-4">
                    <Field label="Share slug">
                      <Input value={privacyDraft.shareSlug || ''} onChange={(event) => setPrivacyDraft((prev) => ({ ...prev, shareSlug: event.target.value }))} placeholder="your-public-noesis" />
                    </Field>
                    <SwitchRow label="Enable public profile shell" checked={privacyDraft.publicProfileEnabled} onCheckedChange={(checked) => setPrivacyDraft((prev) => ({ ...prev, publicProfileEnabled: checked }))} />
                    <SwitchRow label="Allow public concepts" checked={privacyDraft.publicConceptsEnabled} onCheckedChange={(checked) => setPrivacyDraft((prev) => ({ ...prev, publicConceptsEnabled: checked }))} />
                    <SwitchRow label="Allow public positions" checked={privacyDraft.publicPositionsEnabled} onCheckedChange={(checked) => setPrivacyDraft((prev) => ({ ...prev, publicPositionsEnabled: checked }))} />
                    <SwitchRow label="Allow public works" checked={privacyDraft.publicWorksEnabled} onCheckedChange={(checked) => setPrivacyDraft((prev) => ({ ...prev, publicWorksEnabled: checked }))} />
                    <SwitchRow label="Allow public practices" checked={privacyDraft.publicPracticesEnabled} onCheckedChange={(checked) => setPrivacyDraft((prev) => ({ ...prev, publicPracticesEnabled: checked }))} />
                    <SwitchRow label="Allow public source list" checked={privacyDraft.publicSourcesEnabled} onCheckedChange={(checked) => setPrivacyDraft((prev) => ({ ...prev, publicSourcesEnabled: checked }))} />
                    <SwitchRow label="Allow public belief biography" checked={privacyDraft.publicBeliefBiographyEnabled} onCheckedChange={(checked) => setPrivacyDraft((prev) => ({ ...prev, publicBeliefBiographyEnabled: checked }))} />
                  </div>
                  <div className="mt-5 flex justify-end">
                    <Button onClick={savePrivacy} disabled={saving === 'privacy'} className="rounded-full px-6 font-semibold">
                      <Save className="mr-2 size-4" />
                      {saving === 'privacy' ? 'Saving Privacy' : 'Save Public View'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-5">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Sparkles className="size-4 text-accent" />
                    Preview rules
                  </div>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
                    <li>- Default visibility stays private until you explicitly share.</li>
                    <li>- Public profile content should emerge from your real objects, not a separate marketing layer.</li>
                    <li>- Hidden notes, annotations, and metacognition remain excluded unless you choose otherwise.</li>
                    <li>- The public layer is future-ready, but nothing is exposed automatically.</li>
                  </ul>
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-3xl border-border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="font-headline text-2xl font-semibold italic text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-headline text-2xl font-semibold italic text-foreground">{value}</div>
    </div>
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

function TagEditor({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  return (
    <Input
      value={value.join(', ')}
      onChange={(event) => onChange(event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
      placeholder={placeholder}
    />
  );
}

function LinkGroup({ title, empty, onOpenAll, children }: { title: string; empty: string; onOpenAll: () => void; children: React.ReactNode }) {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-code text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onOpenAll}>Open</Button>
      </div>
      <div className="space-y-2">
        {hasChildren ? children : <EmptyCopy text={empty} compact />}
      </div>
    </div>
  );
}

function MiniLink({ label, meta, onClick }: { label: string; meta: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted/20">
      <span className="text-sm text-foreground">{label}</span>
      <span className="font-code text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{meta}</span>
    </button>
  );
}

function StatusList({
  title,
  items,
  actionLabel,
  onAction,
}: {
  title: string;
  items: Unknown[];
  actionLabel?: string;
  onAction?: (item: Unknown) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="font-code text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.unknownId} className="rounded-xl border border-border bg-card/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-foreground">{item.title}</div>
              <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{item.status}</Badge>
            </div>
            {item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
            {actionLabel && onAction && item.status !== 'resolved' && (
              <div className="mt-3">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => onAction(item)}>{actionLabel}</Button>
              </div>
            )}
          </div>
        )) : <EmptyCopy text="Nothing here yet." compact />}
      </div>
    </div>
  );
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function EmptyCopy({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={compact ? 'text-sm italic text-muted-foreground' : 'rounded-2xl border border-dashed border-border bg-background/40 p-5 text-sm italic text-muted-foreground'}>
      {text}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function flattenRelatedEntityIds(value?: ThinkingEvent['relatedEntityIds']) {
  if (!value) return [];
  return Object.values(value).flatMap((items) => items || []);
}
