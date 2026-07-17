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
import { cn } from '@/lib/utils';
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
  ThinkingPatternUserResponse,
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
  const [patternResponseDrafts, setPatternResponseDrafts] = useState<Record<string, string>>({});
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

  const respondToPattern = (pattern: ThinkingPattern, response: ThinkingPatternUserResponse, note?: string) => {
    const status = response === 'confirmed' || response === 'partially_agree'
      ? 'acknowledged'
      : response === 'outdated'
        ? 'outdated'
        : response === 'rejected'
          ? 'dismissed'
          : pattern.status;
    onUpdateThinkingPattern({
      ...pattern,
      status,
      userResponse: response,
      userResponseNote: note?.trim() || pattern.userResponseNote,
      userRespondedAt: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
    });
    if (note) setPatternResponseDrafts((prev) => ({ ...prev, [pattern.patternId]: '' }));
    toast({ title: 'Profile observation updated', description: 'Noesis will treat this tendency as a reviewable observation, not a fixed identity label.' });
  };

  const trendCards = [
    ['Questions asked', String(thinkingMetrics.questionsAsked)],
    ['Beliefs revised', String(thinkingMetrics.beliefsRevised)],
    ['Unknowns open', String(openUnknowns.length)],
    ['Sources studied', String(thinkingMetrics.sourcesStudied)],
    ['Contradictions resolved', String(thinkingMetrics.contradictionsResolved)],
    ['Practices active', String(practices.filter((item) => item.status === 'active').length)],
  ] as const;

  const patternEvidenceLevel = (pattern: ThinkingPattern) => {
    const sampleSize = pattern.evidence.length;
    if (sampleSize >= 5 && pattern.confidence >= 0.75) return { label: 'strong evidence', tone: 'strong' as const };
    if (sampleSize >= 3 && pattern.confidence >= 0.55) return { label: 'moderate evidence', tone: 'moderate' as const };
    return { label: 'limited evidence', tone: 'limited' as const };
  };

  const mirrorDiagnostics = useMemo(() => {
    const evidenceEvents = thinkingEvents.filter((event) => ['evidence_added', 'supported', 'source_distilled', 'annotation_created'].includes(event.eventType));
    const challengeEvents = thinkingEvents.filter((event) => ['challenged', 'challenge_added', 'contradiction_detected', 'assumption_challenged'].includes(event.eventType));
    const revisionEvents = thinkingEvents.filter((event) => ['revised', 'position_revised', 'confidence_changed', 'stress_test_answered'].includes(event.eventType));
    const positionPracticeLinks = positions.filter((position) => practices.some((practice) => (practice.positionIds || []).includes(position.id)));
    const unsupportedPositions = positions.filter((position) => (position.evidenceFor || []).length === 0 && (position.sourceIds || []).length === 0 && position.status !== 'rejected');
    const sufficientEventSpread = thinkingEvents.length >= 8 && new Set(thinkingEvents.map((event) => event.entityType)).size >= 3;
    const dateTimes = thinkingEvents.map((event) => new Date(event.createdAt).getTime()).filter((time) => !Number.isNaN(time));
    const firstDate = dateTimes.length ? new Date(Math.min(...dateTimes)) : null;
    const lastDate = dateTimes.length ? new Date(Math.max(...dateTimes)) : null;
    const dateRange = firstDate && lastDate ? `${formatDate(firstDate.toISOString())} - ${formatDate(lastDate.toISOString())}` : 'Not enough event history';

    const strengths = [
      revisionEvents.length >= 2 ? {
        title: 'Willingness to revise',
        evidence: `${revisionEvents.length} revision or confidence-change events are recorded.`,
        confidence: revisionEvents.length >= 5 ? 'high' : 'moderate',
      } : null,
      challengeEvents.length >= 2 ? {
        title: 'Seeks opposition before closure',
        evidence: `${challengeEvents.length} challenge, contradiction, or assumption-pressure events are recorded.`,
        confidence: challengeEvents.length >= 5 ? 'high' : 'moderate',
      } : null,
      positionPracticeLinks.length >= 2 ? {
        title: 'Practical experimentation',
        evidence: `${positionPracticeLinks.length} positions are connected to practices.`,
        confidence: positionPracticeLinks.length >= 4 ? 'high' : 'moderate',
      } : null,
      conceptLeaders.length >= 4 ? {
        title: 'Conceptual organization',
        evidence: `${conceptLeaders.length} recurring concepts have enough links to shape the workspace.`,
        confidence: 'moderate',
      } : null,
    ].filter(Boolean) as Array<{ title: string; evidence: string; confidence: string }>;

    const vulnerabilities = [
      unsupportedPositions.length >= 2 ? {
        title: 'Positions may be outrunning evidence',
        evidence: `${unsupportedPositions.length} positions have no direct support recorded yet.`,
        confidence: unsupportedPositions.length >= 5 ? 'high' : 'moderate',
      } : null,
      openInquiries.length > activePositions.length ? {
        title: 'Questions may be accumulating faster than judgments',
        evidence: `${openInquiries.length} open inquiries versus ${activePositions.length} active positions are visible.`,
        confidence: 'moderate',
      } : null,
      sources.length > 0 && works.length === 0 ? {
        title: 'Source accumulation without expression',
        evidence: `${sources.length} sources are present, but no works are recorded.`,
        confidence: 'moderate',
      } : null,
      positions.length > 0 && positionPracticeLinks.length === 0 ? {
        title: 'Abstraction without lived testing',
        evidence: `${positions.length} positions exist, but none are linked to practices yet.`,
        confidence: 'moderate',
      } : null,
    ].filter(Boolean) as Array<{ title: string; evidence: string; confidence: string }>;

    return {
      sufficientEventSpread,
      eventCount: thinkingEvents.length,
      objectFamilies: new Set(thinkingEvents.map((event) => event.entityType)).size,
      dateRange,
      strengths,
      vulnerabilities,
    };
  }, [activePositions.length, conceptLeaders.length, openInquiries.length, positions, practices, sources.length, thinkingEvents, works.length]);

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
            <TabsTrigger value="connections" className="rounded-xl">Intellectual Portrait</TabsTrigger>
            <TabsTrigger value="metacognition" className="rounded-xl">Tendencies</TabsTrigger>
            <TabsTrigger value="unknowns" className="rounded-xl">Unknowns</TabsTrigger>
            <TabsTrigger value="missing" className="rounded-xl">Missing Perspectives</TabsTrigger>
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
              <div className="mb-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Evidence Threshold</div>
                  <h3 className="mt-2 font-headline text-xl font-semibold italic text-foreground">
                    {mirrorDiagnostics.sufficientEventSpread ? 'Enough recorded variety for cautious reflection' : 'Limited evidence: treat every pattern lightly'}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Profile observations are based on {mirrorDiagnostics.eventCount} thinking events across {mirrorDiagnostics.objectFamilies} object families.
                    Date range: {mirrorDiagnostics.dateRange}.
                  </p>
                  <div className="mt-3 rounded-xl border border-border/50 bg-card p-3 text-xs italic leading-5 text-muted-foreground">
                    Noesis should say “recent evidence suggests,” never “you are.” Low-data observations should invite reflection, not define identity.
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <MirrorList title="Possible Strengths" items={mirrorDiagnostics.strengths} empty="No evidence-backed strengths yet. More revised positions, challenges, practices, and concept work will make this clearer." />
                  <MirrorList title="Possible Vulnerabilities" items={mirrorDiagnostics.vulnerabilities} empty="No evidence-backed vulnerabilities yet. Noesis should not invent concerns without recorded evidence." />
                </div>
              </div>
              <div className="space-y-3">
                {thinkingPatterns.map((pattern) => (
                  <Card key={pattern.patternId} className="rounded-2xl border-border bg-background/60 p-4 shadow-none">
                    {(() => {
                      const evidenceLevel = patternEvidenceLevel(pattern);
                      return (
                        <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-headline text-xl font-semibold italic">Recent evidence suggests: {pattern.label}</h3>
                      <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{Math.round(pattern.confidence * 100)}% confidence</Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full font-code text-[8px] uppercase tracking-widest",
                          evidenceLevel.tone === 'strong' ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                          evidenceLevel.tone === 'moderate' ? "border-amber-200 bg-amber-50 text-amber-800" :
                          "border-rose-200 bg-rose-50 text-rose-800"
                        )}
                      >
                        {evidenceLevel.label}
                      </Badge>
                      <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{pattern.status}</Badge>
                      <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{pattern.timespan}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{pattern.description}</p>
                    {evidenceLevel.tone === 'limited' && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs italic leading-5 text-rose-900">
                        This observation has limited support. Treat it as a prompt to inspect evidence, not as a profile truth.
                      </div>
                    )}
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-border/50 bg-card p-3">
                        <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">Sample Size</div>
                        <div className="mt-1 font-headline text-2xl font-semibold italic">{pattern.evidence.length}</div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card p-3">
                        <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">Trend</div>
                        <div className="mt-1 text-sm font-medium capitalize">{pattern.trendDirection}</div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card p-3">
                        <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">Alternative Reading</div>
                        <div className="mt-1 text-xs italic text-muted-foreground">This may reflect the available records more than your full thinking.</div>
                      </div>
                    </div>
                        </>
                      );
                    })()}
                    {pattern.evidence.length > 0 && <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{pattern.evidence.map((evidence) => <li key={evidence}>- {evidence}</li>)}</ul>}
                    {pattern.userResponse && (
                      <div className="mt-3 rounded-xl border border-border/50 bg-card p-3 text-sm">
                        <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">Your Response</div>
                        <p className="mt-1 capitalize text-foreground">{pattern.userResponse.replace(/_/g, ' ')}</p>
                        {pattern.userResponseNote && <p className="mt-2 italic leading-6 text-muted-foreground">{pattern.userResponseNote}</p>}
                      </div>
                    )}
                    <div className="mt-4 rounded-2xl border border-border/50 bg-card p-4">
                      <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Challenge My Profile</div>
                      <p className="mt-2 text-xs italic leading-5 text-muted-foreground">
                        Treat this as a provisional observation. Confirm it, qualify it, reject it, ask for more evidence, or mark it outdated.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => respondToPattern(pattern, 'confirmed')}>Confirm</Button>
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => respondToPattern(pattern, 'partially_agree')}>Partially Agree</Button>
                        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => respondToPattern(pattern, 'needs_more_evidence')}>Request Evidence</Button>
                        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => respondToPattern(pattern, 'outdated')}>Outdated</Button>
                        <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={() => respondToPattern(pattern, 'rejected')}>Reject</Button>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                        <Input
                          value={patternResponseDrafts[pattern.patternId] || ''}
                          onChange={(event) => setPatternResponseDrafts((prev) => ({ ...prev, [pattern.patternId]: event.target.value }))}
                          placeholder="Offer an alternative explanation..."
                          className="h-9 rounded-full text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => respondToPattern(pattern, 'alternative_explanation', patternResponseDrafts[pattern.patternId])}
                          disabled={!patternResponseDrafts[pattern.patternId]?.trim()}
                        >
                          Save Alternative
                        </Button>
                      </div>
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

          <TabsContent value="missing" className="mt-0">
            <SectionCard title="Missing Perspectives" description="Possible absent lenses from your current record. These are prompts for review, not judgments about you.">
              <div className="grid gap-4 lg:grid-cols-2">
                <PerspectiveList title="Unresolved tensions" items={summary.unresolvedTensions} empty="No unresolved tensions summarized yet." />
                <PerspectiveList title="Current unknowns" items={summary.currentUnknowns} empty="No current unknowns summarized yet." />
                <PerspectiveList title="Strongest beliefs to test" items={summary.strongestBeliefs} empty="No strongest-belief summary yet." />
                <PerspectiveList title="Weakest beliefs needing support" items={summary.weakestBeliefs} empty="No weak-belief summary yet." />
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

function PerspectiveList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item} className="rounded-xl border border-border/50 bg-card p-3 text-sm italic leading-6 text-muted-foreground">
            {item}
          </div>
        )) : <EmptyCopy text={empty} compact />}
      </div>
      <p className="mt-3 text-[11px] italic leading-5 text-muted-foreground">
        Review this against actual evidence before promoting it into an inquiry, position, or practice.
      </p>
    </div>
  );
}

function MirrorList({ title, items, empty }: { title: string; items: Array<{ title: string; evidence: string; confidence: string }>; empty: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.title} className="rounded-xl border border-border/50 bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-foreground">{item.title}</div>
              <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">{item.confidence}</Badge>
            </div>
            <p className="mt-2 text-xs italic leading-5 text-muted-foreground">{item.evidence}</p>
          </div>
        )) : <EmptyCopy text={empty} compact />}
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
