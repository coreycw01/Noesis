"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { Brain, ChevronDown, ExternalLink, Globe, LogOut, Save, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { ContextualAiAction } from '@/lib/contextual-ai';
import { cn } from '@/lib/utils';
import type { AiSettings, BeliefProfile, Concept, Draft, Media, Practice, ProfilePrivacySettings, PublicProfileSnapshot, Question, ThinkingEvent, ThinkingMetrics, ThinkingPattern, ThinkingPatternUserResponse, Unknown, UserProfile, VaultEntry } from '@/lib/types';

interface ProfilePageProps {
  user: User | null;
  profile: UserProfile;
  aiSettings: AiSettings;
  privacy: ProfilePrivacySettings;
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
  onSavePrivacy: (privacy: ProfilePrivacySettings, snapshot: PublicProfileSnapshot) => Promise<void>;
  onUpdateUnknown: (unknown: Unknown) => void;
  onUpdateThinkingPattern: (pattern: ThinkingPattern) => void;
  onNavigate: (view: string, targetId?: string) => void;
}

type ProfileTab = 'profile' | 'philosophy' | 'reflection' | 'public';
type PhilosophyView = 'foundation' | 'influences' | 'development';
type ReflectionView = 'patterns' | 'open-edges';

export function ProfilePage({ user, profile, aiSettings, privacy, concepts, inquiries, positions, sources, works, practices, thinkingEvents, beliefProfiles, unknowns, thinkingPatterns, thinkingMetrics: _thinkingMetrics, onSaveProfile, onSavePrivacy, onUpdateUnknown, onUpdateThinkingPattern, onNavigate }: ProfilePageProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const [profileDraft, setProfileDraft] = useState<UserProfile>(profile);
  const [privacyDraft, setPrivacyDraft] = useState<ProfilePrivacySettings>(privacy);
  const [patternResponseDrafts, setPatternResponseDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'profile' | 'privacy' | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [philosophyView, setPhilosophyView] = useState<PhilosophyView>('foundation');
  const [reflectionView, setReflectionView] = useState<ReflectionView>('patterns');
  const profileBaselineRef = useRef(JSON.stringify(profile));
  const privacyBaselineRef = useRef(JSON.stringify(privacy));

  useEffect(() => {
    const next = JSON.stringify(profile);
    setProfileDraft((current) => JSON.stringify(current) === profileBaselineRef.current ? profile : current);
    profileBaselineRef.current = next;
  }, [profile]);
  useEffect(() => {
    const next = JSON.stringify(privacy);
    setPrivacyDraft((current) => JSON.stringify(current) === privacyBaselineRef.current ? privacy : current);
    privacyBaselineRef.current = next;
  }, [privacy]);

  const rankedConcepts = useMemo(() => [...concepts].sort((a, b) => (b.links.length + b.sourceIds.length) - (a.links.length + a.sourceIds.length)), [concepts]);
  const activePositions = useMemo(() => [...positions].filter((item) => item.status !== 'rejected' && item.status !== 'abandoned').sort((a, b) => b.confidence - a.confidence), [positions]);
  const openInquiries = useMemo(() => inquiries.filter((item) => !['resolved', 'archived', 'answered'].includes(item.status)), [inquiries]);
  const openUnknowns = useMemo(() => unknowns.filter((item) => item.status !== 'resolved' && item.status !== 'archived'), [unknowns]);
  const sourceLeaders = useMemo(() => [...sources].sort((a, b) => b.annotations.length - a.annotations.length).slice(0, 5), [sources]);
  const recentBeliefEvents = useMemo(() => [...thinkingEvents].filter((event) => event.entityType === 'position').sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8), [thinkingEvents]);
  const challengedPositions = useMemo(() => beliefProfiles.filter((item) => (item.challengedBy || []).length > 0).sort((a, b) => (b.challengedBy?.length || 0) - (a.challengedBy?.length || 0)).slice(0, 5).map((item) => positions.find((position) => position.id === item.positionId)).filter(Boolean) as VaultEntry[], [beliefProfiles, positions]);

  const derivedIdentity = useMemo(() => {
    const themes = rankedConcepts.slice(0, 5).map((concept) => concept.name);
    const activePracticeCount = practices.filter((item) => item.status === 'active').length;
    const revisionCount = thinkingEvents.filter((event) => ['position_revised', 'confidence_changed', 'stress_test_answered'].includes(event.eventType)).length;
    const season = activePracticeCount > 0 ? 'Testing ideas in practice' : revisionCount > 1 ? 'Revising established positions' : openInquiries.length > activePositions.length ? 'Exploring open questions' : works.length > 0 ? 'Turning thought into expression' : concepts.length > 0 ? 'Building a philosophical vocabulary' : 'Beginning a philosophy workspace';
    return { themes, season, focus: themes.length ? themes.slice(0, 3).join(', ') : 'No recurring themes yet', leadingPosition: activePositions[0], evidenceLine: `${concepts.length} concepts, ${activePositions.length} active positions, ${openInquiries.length} open inquiries, and ${activePracticeCount} active practices` };
  }, [activePositions, concepts.length, openInquiries.length, practices, rankedConcepts, thinkingEvents, works.length]);

  const openEdges = useMemo(() => ({
    tensions: positions.filter((position) => (position.evidenceAgainst || []).length > 0 || position.status === 'questioning').slice(0, 5).map((position) => position.statement || position.title),
    unsupported: activePositions.filter((position) => (position.evidenceFor || []).length === 0 && position.sourceIds.length === 0).slice(0, 5).map((position) => position.statement || position.title),
  }), [activePositions, positions]);

  const patternEvidence = useMemo(() => {
    const objectFamilies = new Set(thinkingEvents.map((event) => event.entityType)).size;
    const dates = thinkingEvents.map((event) => Date.parse(event.createdAt)).filter((date) => !Number.isNaN(date));
    return { sufficient: thinkingEvents.length >= 8 && objectFamilies >= 3, count: thinkingEvents.length, objectFamilies, range: dates.length ? `${formatDate(new Date(Math.min(...dates)).toISOString())} - ${formatDate(new Date(Math.max(...dates)).toISOString())}` : 'Not enough history' };
  }, [thinkingEvents]);

  const saveProfile = async () => {
    setSaving('profile');
    try { await onSaveProfile(profileDraft); toast({ title: 'Profile saved', description: 'Your identity and philosophy name are up to date.' }); }
    catch { toast({ variant: 'destructive', title: 'Profile not saved', description: 'Noesis could not save your profile right now.' }); }
    finally { setSaving(null); }
  };

  const selectedRecords = <T extends { id: string },>(items: T[], ids: string[] | undefined, enabled: boolean) => {
    if (!enabled) return [];
    if (ids === undefined) return items.slice(0, 8);
    const selected = new Set(ids);
    return items.filter((item) => selected.has(item.id)).slice(0, 12);
  };

  const savePrivacy = async () => {
    setSaving('privacy');
    try {
      const normalizedSlug = privacyDraft.shareSlug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || '';
      const nextPrivacy = { ...privacyDraft, shareSlug: normalizedSlug };
      const snapshot: PublicProfileSnapshot = {
        shareSlug: normalizedSlug,
        enabled: nextPrivacy.publicProfileEnabled,
        displayName: profileDraft.displayName || user?.displayName || 'Untitled Thinker',
        ...((profileDraft.avatarUrl || profileDraft.photoURL) ? { avatarUrl: profileDraft.avatarUrl || profileDraft.photoURL } : {}),
        ...((nextPrivacy.publicBioEnabled ?? true) && profileDraft.bio?.trim() ? { bio: profileDraft.bio.trim() } : {}),
        ...((nextPrivacy.publicPhilosophyEnabled ?? true) && profileDraft.philosophyName?.trim() ? { philosophyName: profileDraft.philosophyName.trim(), philosophyNameStatus: profileDraft.philosophyNameStatus || 'working' } : {}),
        ...((nextPrivacy.publicPhilosophyEnabled ?? true) && profileDraft.philosophyStatement?.trim() ? { philosophyStatement: profileDraft.philosophyStatement.trim() } : {}),
        currentSeason: (nextPrivacy.publicSeasonEnabled ?? true) ? derivedIdentity.season : '',
        themes: (nextPrivacy.publicThemesEnabled ?? true) ? derivedIdentity.themes : [],
        concepts: selectedRecords(rankedConcepts, nextPrivacy.publicConceptIds, nextPrivacy.publicConceptsEnabled).map((concept) => ({ id: concept.id, name: concept.name, description: concept.description })),
        positions: selectedRecords(activePositions, nextPrivacy.publicPositionIds, nextPrivacy.publicPositionsEnabled).map((position) => ({ id: position.id, statement: position.statement || position.title, confidence: position.confidence })),
        works: selectedRecords(works, nextPrivacy.publicWorkIds, nextPrivacy.publicWorksEnabled).map((work) => ({ id: work.id, title: work.title, type: work.type })),
        practices: selectedRecords(practices.filter((practice) => practice.status === 'active'), nextPrivacy.publicPracticeIds, nextPrivacy.publicPracticesEnabled).map((practice) => ({ id: practice.id, title: practice.title, type: practice.type })),
        sources: selectedRecords(sources, nextPrivacy.publicSourceIds, nextPrivacy.publicSourcesEnabled).map((source) => ({ id: source.id, title: source.title, creator: source.creator, type: source.type })),
        beliefHistory: selectedRecords(recentBeliefEvents, nextPrivacy.publicBeliefHistoryIds, nextPrivacy.publicBeliefBiographyEnabled).map((event) => ({ id: event.id, summary: event.summary, date: event.createdAt })),
      };
      setPrivacyDraft(nextPrivacy);
      await onSavePrivacy(nextPrivacy, snapshot);
      toast({ title: 'Public profile updated', description: 'Only the sections and items you selected will be visible.' });
    } catch (error) { toast({ variant: 'destructive', title: 'Public profile not saved', description: error instanceof Error ? error.message : 'Noesis could not save your sharing choices.' }); }
    finally { setSaving(null); }
  };

  const respondToPattern = (pattern: ThinkingPattern, response: ThinkingPatternUserResponse, note?: string) => {
    const status = response === 'confirmed' || response === 'partially_agree' ? 'acknowledged' : response === 'outdated' ? 'outdated' : response === 'rejected' ? 'dismissed' : pattern.status;
    onUpdateThinkingPattern({ ...pattern, status, userResponse: response, userResponseNote: note?.trim() || pattern.userResponseNote, userRespondedAt: new Date().toISOString(), dateUpdated: new Date().toISOString() });
    if (note) setPatternResponseDrafts((previous) => ({ ...previous, [pattern.patternId]: '' }));
  };

  const handleSignOut = async () => {
    try { await signOut(auth); }
    catch { toast({ variant: 'destructive', title: 'Sign out failed', description: 'Noesis could not sign you out right now.' }); }
  };

  const buildPhilosophyEnvelope = useCallback((action: ContextualAiAction, userPrompt?: string) => {
    if (action !== 'synthesize_profile_philosophy') return null;
    const itemMemory = [
      `Philosophy name: ${profileDraft.philosophyName?.trim() || 'Not named yet'}`,
      `Naming status: ${profileDraft.philosophyNameStatus || 'working'}`,
      `Current statement: ${profileDraft.philosophyStatement?.trim() || 'Not written yet'}`,
      `Current season: ${derivedIdentity.season}`,
    ];
    const linkedMemory = [
      ...rankedConcepts.slice(0, 4).map((concept) => `Concept: ${concept.name}${concept.description ? ` — ${concept.description.slice(0, 320)}` : ''}`),
      ...activePositions.slice(0, 5).map((position) => `Position (${Math.round(position.confidence)}% confidence): ${(position.statement || position.title).slice(0, 420)}`),
      ...openInquiries.slice(0, 3).map((inquiry) => `Open inquiry: ${inquiry.text.slice(0, 420)}`),
      ...practices.filter((practice) => practice.status === 'active').slice(0, 3).map((practice) => `Active practice: ${practice.title}${practice.hypothesis ? ` — ${practice.hypothesis.slice(0, 260)}` : ''}`),
      ...works.slice(0, 2).map((work) => `Work: ${work.title} (${work.type})`),
      ...sourceLeaders.slice(0, 3).map((source) => `Influential source: ${source.title}${source.creator ? ` by ${source.creator}` : ''}`),
    ].slice(0, 20);
    return {
      action,
      targetType: 'profile' as const,
      targetId: profile.id || user?.uid || 'current-profile',
      scope: 'linked_items' as const,
      itemMemory,
      linkedMemory,
      userPrompt,
    };
  }, [activePositions, derivedIdentity.season, openInquiries, practices, profile.id, profileDraft.philosophyName, profileDraft.philosophyNameStatus, profileDraft.philosophyStatement, rankedConcepts, sourceLeaders, user?.uid, works]);

  const acceptPhilosophySynthesis = async (_result: unknown, editedContent: string) => {
    const nextProfile = { ...profileDraft, philosophyStatement: editedContent, dateUpdated: new Date().toISOString() };
    await onSaveProfile(nextProfile);
    setProfileDraft(nextProfile);
  };

  return (
    <div className="noesis-page">
      <div className="noesis-page-inner flex flex-col gap-5">
        <PageHeader title="Profile" description="Who you are, the philosophy taking shape, and exactly what you choose to share." actions={<><Button variant="outline" onClick={handleSignOut} className="rounded-full bg-card px-4 font-semibold text-destructive hover:text-destructive"><LogOut className="mr-2 size-4" />Sign Out</Button>{(activeTab === 'profile' || activeTab === 'philosophy') && <Button onClick={saveProfile} disabled={saving === 'profile'} className="rounded-full px-5 font-semibold"><Save className="mr-2 size-4" />{saving === 'profile' ? 'Saving' : 'Save'}</Button>}</>} />

        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 text-muted-foreground">{profileDraft.photoURL || profileDraft.avatarUrl ? <img src={profileDraft.photoURL || profileDraft.avatarUrl} alt={profileDraft.displayName || 'Profile avatar'} className="h-full w-full object-cover" /> : <UserCircle2 className="size-9" />}</div>
              <div className="min-w-0"><div className="font-code text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Thinker profile</div><h2 className="noesis-page-title mt-1 truncate text-2xl">{profileDraft.displayName || user?.displayName || 'Untitled Thinker'}</h2><p className="mt-1 text-sm text-muted-foreground">{profileDraft.philosophyName?.trim() || 'Unnamed philosophy'}<span className="mx-2">/</span>{derivedIdentity.season}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">{derivedIdentity.themes.slice(0, 3).map((theme) => <Badge key={theme} variant="secondary" className="rounded-full">{theme}</Badge>)}<Badge variant="outline" className="rounded-full">{concepts.length} concepts</Badge><Badge variant="outline" className="rounded-full">{activePositions.length} active positions</Badge></div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileTab)} className="space-y-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-border bg-card p-1.5"><TabsTrigger value="profile" className="rounded-lg">Profile</TabsTrigger><TabsTrigger value="philosophy" className="rounded-lg">Philosophy</TabsTrigger><TabsTrigger value="reflection" className="rounded-lg">Reflection</TabsTrigger><TabsTrigger value="public" className="rounded-lg">Public</TabsTrigger></TabsList>

          <TabsContent value="profile" className="mt-0"><div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <SectionCard title="Your Identity" description="Only the details Noesis cannot infer responsibly."><div className="grid gap-4 sm:grid-cols-2"><Field label="Display name"><Input value={profileDraft.displayName || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, displayName: event.target.value }))} /></Field><Field label="Avatar URL"><Input value={profileDraft.avatarUrl || profileDraft.photoURL || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, avatarUrl: event.target.value, photoURL: event.target.value }))} placeholder="https://..." /></Field></div><Field label="Public introduction"><Textarea value={profileDraft.bio || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, bio: event.target.value }))} className="min-h-[100px]" placeholder="Introduce yourself and the questions that matter to you." /></Field><p className="mt-3 text-xs leading-5 text-muted-foreground">Your email is private and never included in the public profile.</p></SectionCard>
            <SectionCard title="Current Snapshot" description="A compact summary derived from your saved work."><div className="grid gap-3 sm:grid-cols-2"><DerivedField label="Current season" value={derivedIdentity.season} /><DerivedField label="Recurring focus" value={derivedIdentity.focus} /><DerivedField label="Leading position" value={derivedIdentity.leadingPosition?.statement || derivedIdentity.leadingPosition?.title || 'No active position yet.'} wide /></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Based on {derivedIdentity.evidenceLine}. This describes the current record, not a permanent identity.</p></SectionCard>
          </div></TabsContent>

          <TabsContent value="philosophy" className="mt-0"><SectionCard title="Your Philosophy" description="Name the worldview taking shape, then inspect the records that give it substance.">
            <div className="space-y-4 rounded-xl border border-border bg-background/50 p-4"><div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><Field label="Philosophy name"><Input value={profileDraft.philosophyName || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, philosophyName: event.target.value }))} placeholder="Name it now, or leave it unnamed" /></Field><div><div className="mb-2 font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Naming status</div><div className="flex gap-2"><Button type="button" size="sm" variant={(profileDraft.philosophyNameStatus || 'working') === 'working' ? 'default' : 'outline'} onClick={() => setProfileDraft((previous) => ({ ...previous, philosophyNameStatus: 'working' }))} className="rounded-full">Working name</Button><Button type="button" size="sm" variant={profileDraft.philosophyNameStatus === 'established' ? 'default' : 'outline'} onClick={() => setProfileDraft((previous) => ({ ...previous, philosophyNameStatus: 'established' }))} className="rounded-full">Established</Button></div></div></div><Field label="Working philosophy statement"><Textarea value={profileDraft.philosophyStatement || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, philosophyStatement: event.target.value }))} className="min-h-[110px]" placeholder="Describe the central idea that connects your current thinking." /></Field></div>
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="max-w-2xl"><div className="flex items-center gap-2 font-medium"><Brain className="size-4 text-accent" />Shape My Philosophy</div><p className="mt-1 text-sm leading-6 text-muted-foreground">Review a bounded set of your strongest concepts, positions, questions, practices, works, and sources. Noesis suggests language; you decide what becomes yours.</p></div>{aiSettings.aiAssistanceEnabled ? <ContextualAiPanel actions={['synthesize_profile_philosophy']} buildEnvelope={buildPhilosophyEnvelope} showContextBeforeSending={aiSettings.showContextBeforeSending} reasoningDepth={aiSettings.defaultReasoningDepth} retainAcceptedProvenance={aiSettings.retainAcceptedAiProvenance} onAccept={acceptPhilosophySynthesis} buttonLabel="Shape My Philosophy" promptLabel="What should Noesis focus on? (optional)" promptPlaceholder="For example: help me name the tension between discipline and freedom." /> : <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => onNavigate('settings')}>Enable in Settings</Button>}</div>
            <SegmentedNav className="mt-5" value={philosophyView} onChange={(value) => setPhilosophyView(value as PhilosophyView)} items={[["foundation", "Foundation"], ["influences", "Influences"], ["development", "Development"]]} label="Philosophy sections" />
            {philosophyView === 'foundation' && <div className="mt-5 grid gap-4 lg:grid-cols-2"><LinkGroup title="Recurring concepts" empty="No concepts yet." onOpenAll={() => onNavigate('concepts')}>{rankedConcepts.slice(0, 5).map((concept) => <MiniLink key={concept.id} label={concept.name} meta={`${concept.links.length} links`} onClick={() => onNavigate('concepts', concept.id)} />)}</LinkGroup><LinkGroup title="Current positions" empty="No active positions yet." onOpenAll={() => onNavigate('vault')}>{activePositions.slice(0, 5).map((position) => <MiniLink key={position.id} label={position.statement || position.title} meta={`${Math.round(position.confidence)}%`} onClick={() => onNavigate('vault', position.id)} />)}</LinkGroup></div>}
            {philosophyView === 'influences' && <div className="mt-5 grid gap-4 lg:grid-cols-2"><LinkGroup title="Sources shaping the work" empty="No sources yet." onOpenAll={() => onNavigate('source-index')}>{sourceLeaders.map((source) => <MiniLink key={source.id} label={source.title} meta={source.type} onClick={() => onNavigate('library', source.id)} />)}</LinkGroup><LinkGroup title="Questions still open" empty="No open inquiries." onOpenAll={() => onNavigate('questions')}>{openInquiries.slice(0, 5).map((inquiry) => <MiniLink key={inquiry.id} label={inquiry.text} meta={inquiry.status} onClick={() => onNavigate('questions', inquiry.id)} />)}</LinkGroup></div>}
            {philosophyView === 'development' && <div className="mt-5 grid gap-4 lg:grid-cols-2"><LinkGroup title="Positions under pressure" empty="No challenged positions yet." onOpenAll={() => onNavigate('vault')}>{challengedPositions.map((position) => <MiniLink key={position.id} label={position.statement || position.title} meta="under review" onClick={() => onNavigate('vault', position.id)} />)}</LinkGroup><LinkGroup title="Recent development" empty="No position changes recorded yet." onOpenAll={() => onNavigate('evolution')}>{recentBeliefEvents.slice(0, 5).map((event) => <MiniLink key={event.id} label={event.summary} meta={formatDate(event.createdAt)} onClick={() => onNavigate('evolution')} />)}</LinkGroup></div>}
          </SectionCard></TabsContent>

          <TabsContent value="reflection" className="mt-0"><SectionCard title="Reflection" description="Evidence-backed observations and unfinished edges, kept separate from your identity.">
            <SegmentedNav value={reflectionView} onChange={(value) => setReflectionView(value as ReflectionView)} items={[["patterns", "Observed patterns"], ["open-edges", "Open edges"]]} label="Reflection sections" />
            {reflectionView === 'patterns' && <div className="mt-5"><div className="rounded-xl border border-border bg-background/50 p-4"><div className="flex flex-wrap items-center gap-2"><Brain className="size-4 text-accent" /><span className="font-medium">{patternEvidence.sufficient ? 'Enough variety for cautious reflection' : 'Limited evidence'}</span><Badge variant="outline">{patternEvidence.count} events</Badge><Badge variant="outline">{patternEvidence.objectFamilies} object types</Badge></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{patternEvidence.range}. These are observations to review, never fixed claims about who you are.</p></div><div className="mt-4 space-y-3">{thinkingPatterns.filter((pattern) => pattern.status !== 'dismissed').map((pattern) => <PatternDisclosure key={pattern.patternId} pattern={pattern} responseDraft={patternResponseDrafts[pattern.patternId] || ''} onDraftChange={(value) => setPatternResponseDrafts((previous) => ({ ...previous, [pattern.patternId]: value }))} onRespond={respondToPattern} />)}{!thinkingPatterns.some((pattern) => pattern.status !== 'dismissed') && <EmptyCopy text="No evidence-backed pattern has crossed the display threshold yet." />}</div></div>}
            {reflectionView === 'open-edges' && <div className="mt-5 grid gap-4 lg:grid-cols-3"><StatusList title={`Open unknowns (${openUnknowns.length})`} items={openUnknowns.slice(0, 5)} onResolve={(item) => onUpdateUnknown({ ...item, status: 'resolved', resolvedAt: new Date().toISOString() })} onOpen={() => onNavigate('questions')} /><TextList title="Unresolved tensions" items={openEdges.tensions} empty="No recorded tension crosses the display threshold." /><TextList title="Positions needing support" items={openEdges.unsupported} empty="No unsupported active position was found." /></div>}
          </SectionCard></TabsContent>

          <TabsContent value="public" className="mt-0"><SectionCard title="Public Profile" description="Publish only the identity details, philosophy signals, and individual records you choose."><div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4"><div className="rounded-xl border border-border bg-background/50 p-4"><Field label="Profile URL name"><Input value={privacyDraft.shareSlug || ''} onChange={(event) => setPrivacyDraft((previous) => ({ ...previous, shareSlug: event.target.value }))} placeholder="your-public-noesis" /></Field><div className="mt-4"><SwitchRow label="Publish profile" checked={privacyDraft.publicProfileEnabled} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicProfileEnabled: checked }))} /></div>{privacy.publicProfileEnabled && privacy.shareSlug && <a href={`/p/${privacy.shareSlug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">Open published profile <ExternalLink className="size-3.5" /></a>}</div>
              <div className="grid gap-3 sm:grid-cols-2"><SwitchRow label="Introduction" checked={privacyDraft.publicBioEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicBioEnabled: checked }))} /><SwitchRow label="Philosophy name" checked={privacyDraft.publicPhilosophyEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicPhilosophyEnabled: checked }))} /><SwitchRow label="Current season" checked={privacyDraft.publicSeasonEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicSeasonEnabled: checked }))} /><SwitchRow label="Recurring themes" checked={privacyDraft.publicThemesEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicThemesEnabled: checked }))} /></div>
              <div className="grid gap-3 md:grid-cols-2"><PublicationPicker title="Concepts" enabled={privacyDraft.publicConceptsEnabled} items={rankedConcepts.map((item) => ({ id: item.id, label: item.name }))} selectedIds={privacyDraft.publicConceptIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicConceptsEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicConceptIds: ids }))} /><PublicationPicker title="Positions" enabled={privacyDraft.publicPositionsEnabled} items={activePositions.map((item) => ({ id: item.id, label: item.statement || item.title }))} selectedIds={privacyDraft.publicPositionIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicPositionsEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicPositionIds: ids }))} /><PublicationPicker title="Works" enabled={privacyDraft.publicWorksEnabled} items={works.map((item) => ({ id: item.id, label: item.title }))} selectedIds={privacyDraft.publicWorkIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicWorksEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicWorkIds: ids }))} /><PublicationPicker title="Practices" enabled={privacyDraft.publicPracticesEnabled} items={practices.filter((item) => item.status === 'active').map((item) => ({ id: item.id, label: item.title }))} selectedIds={privacyDraft.publicPracticeIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicPracticesEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicPracticeIds: ids }))} /><PublicationPicker title="Sources" enabled={privacyDraft.publicSourcesEnabled} items={sources.map((item) => ({ id: item.id, label: item.title }))} selectedIds={privacyDraft.publicSourceIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicSourcesEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicSourceIds: ids }))} /><PublicationPicker title="Belief history" enabled={privacyDraft.publicBeliefBiographyEnabled} items={recentBeliefEvents.map((item) => ({ id: item.id, label: item.summary }))} selectedIds={privacyDraft.publicBeliefHistoryIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicBeliefBiographyEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicBeliefHistoryIds: ids }))} /></div>
              <Button onClick={savePrivacy} disabled={saving === 'privacy'} className="w-full rounded-full font-semibold"><Save className="mr-2 size-4" />{saving === 'privacy' ? 'Saving choices' : 'Save public profile'}</Button></div>
            <div className="self-start rounded-xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-medium"><Globe className="size-4 text-accent" />Public preview</div><Badge variant={privacyDraft.publicProfileEnabled ? 'default' : 'outline'}>{privacyDraft.publicProfileEnabled ? 'Published' : 'Private'}</Badge></div><h3 className="mt-5 font-headline text-2xl font-semibold italic">{profileDraft.displayName || user?.displayName || 'Untitled Thinker'}</h3>{(privacyDraft.publicBioEnabled ?? true) && <p className="mt-2 text-sm leading-6 text-muted-foreground">{profileDraft.bio || 'No public introduction yet.'}</p>}{(privacyDraft.publicPhilosophyEnabled ?? true) && profileDraft.philosophyName && <PreviewLine label="Philosophy" value={`${profileDraft.philosophyName} (${profileDraft.philosophyNameStatus === 'established' ? 'established' : 'working name'})`} />}{(privacyDraft.publicPhilosophyEnabled ?? true) && profileDraft.philosophyStatement && <p className="mt-3 text-sm leading-6 text-muted-foreground">{profileDraft.philosophyStatement}</p>}{(privacyDraft.publicSeasonEnabled ?? true) && <PreviewLine label="Current season" value={derivedIdentity.season} />}{(privacyDraft.publicThemesEnabled ?? true) && <div className="mt-4 flex flex-wrap gap-2">{derivedIdentity.themes.map((theme) => <Badge key={theme} variant="secondary">{theme}</Badge>)}</div>}<p className="mt-5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">Private notes, annotations, unknowns, and pattern feedback are never published.</p></div>
          </div></SectionCard></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card className="rounded-2xl border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5"><h2 className="font-headline text-2xl font-semibold italic">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p></div>{children}</Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="font-code text-[9px] font-bold uppercase tracking-[0.18em]">{label}</Label>{children}</div>; }
function DerivedField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={cn('rounded-xl border border-border bg-background/50 p-4', wide && 'sm:col-span-2')}><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div><p className="mt-2 text-sm leading-6">{value}</p></div>; }
function SegmentedNav({ value, onChange, items, label, className }: { value: string; onChange: (value: string) => void; items: Array<[string, string]>; label: string; className?: string }) { return <div role="tablist" aria-label={label} className={cn('flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-background/50 p-1', className)}>{items.map(([id, text]) => <Button key={id} type="button" role="tab" aria-selected={value === id} size="sm" variant={value === id ? 'default' : 'ghost'} onClick={() => onChange(id)} className="shrink-0 rounded-lg">{text}</Button>)}</div>; }
function LinkGroup({ title, empty, onOpenAll, children }: { title: string; empty: string; onOpenAll: () => void; children: React.ReactNode }) { const hasChildren = React.Children.count(children) > 0; return <div className="rounded-xl border border-border bg-background/50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div><Button variant="ghost" size="sm" onClick={onOpenAll} className="rounded-full">Open all</Button></div><div className="space-y-2">{hasChildren ? children : <EmptyCopy text={empty} />}</div></div>; }
function MiniLink({ label, meta, onClick }: { label: string; meta: string; onClick: () => void }) { return <button onClick={onClick} className="flex min-h-11 w-full items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 text-sm leading-5">{label}</span><span className="shrink-0 font-code text-[8px] uppercase tracking-wider text-muted-foreground">{meta}</span></button>; }

function PatternDisclosure({ pattern, responseDraft, onDraftChange, onRespond }: { pattern: ThinkingPattern; responseDraft: string; onDraftChange: (value: string) => void; onRespond: (pattern: ThinkingPattern, response: ThinkingPatternUserResponse, note?: string) => void }) {
  const evidenceLevel = pattern.evidence.length >= 5 && pattern.confidence >= 0.75 ? 'strong' : pattern.evidence.length >= 3 && pattern.confidence >= 0.55 ? 'moderate' : 'limited';
  return <details className="group rounded-xl border border-border bg-background/50"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><div className="font-medium">{pattern.label}</div><div className="mt-1 text-xs text-muted-foreground">{evidenceLevel} evidence / {pattern.evidence.length} examples</div></div><ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" /></summary><div className="border-t border-border px-4 py-4"><p className="text-sm leading-6 text-muted-foreground">{pattern.description}</p>{pattern.evidence.length > 0 && <ul className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">{pattern.evidence.slice(0, 4).map((evidence) => <li key={evidence}>- {evidence}</li>)}</ul>}<div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => onRespond(pattern, 'confirmed')}>Agree</Button><Button variant="outline" size="sm" onClick={() => onRespond(pattern, 'partially_agree')}>Partly</Button><Button variant="ghost" size="sm" onClick={() => onRespond(pattern, 'needs_more_evidence')}>Need evidence</Button><Button variant="ghost" size="sm" onClick={() => onRespond(pattern, 'rejected')}>Disagree</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={responseDraft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Offer another explanation" /><Button variant="outline" disabled={!responseDraft.trim()} onClick={() => onRespond(pattern, 'alternative_explanation', responseDraft)}>Save note</Button></div></div></details>;
}

function StatusList({ title, items, onResolve, onOpen }: { title: string; items: Unknown[]; onResolve: (item: Unknown) => void; onOpen: () => void }) { return <div className="rounded-xl border border-border bg-background/50 p-4"><div className="flex items-center justify-between gap-2"><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div><Button variant="ghost" size="sm" onClick={onOpen}>Open inquiries</Button></div><div className="mt-3 space-y-2">{items.map((item) => <div key={item.unknownId} className="rounded-lg border border-border bg-card p-3"><div className="text-sm font-medium">{item.title}</div><Button variant="ghost" size="sm" className="mt-2 h-8 px-2" onClick={() => onResolve(item)}>Mark resolved</Button></div>)}{!items.length && <EmptyCopy text="No open unknowns." />}</div></div>; }
function TextList({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div className="rounded-xl border border-border bg-background/50 p-4"><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div><div className="mt-3 space-y-2">{items.map((item) => <p key={item} className="rounded-lg border border-border bg-card p-3 text-sm leading-5">{item}</p>)}{!items.length && <EmptyCopy text={empty} />}</div></div>; }

function PublicationPicker({ title, enabled, items, selectedIds, onEnabledChange, onSelectionChange }: { title: string; enabled: boolean; items: Array<{ id: string; label: string }>; selectedIds?: string[]; onEnabledChange: (checked: boolean) => void; onSelectionChange: (ids: string[]) => void }) {
  const selected = selectedIds ?? items.slice(0, 8).map((item) => item.id);
  const toggle = (id: string) => onSelectionChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return <div className="rounded-xl border border-border bg-background/50"><div className="flex min-h-14 items-center gap-3 px-4"><div className="min-w-0 flex-1"><div className="text-sm font-medium">{title}</div><div className="text-xs text-muted-foreground">{enabled ? `${selected.length} selected` : 'Not shared'}</div></div><Switch aria-label={`Share ${title}`} checked={enabled} onCheckedChange={onEnabledChange} /></div>{enabled && <details className="group border-t border-border"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Choose specific items<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary><div className="max-h-56 space-y-1 overflow-y-auto border-t border-border p-2">{items.map((item) => <label key={item.id} className="flex min-h-10 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/20"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="mt-1 size-4" /><span className="leading-5">{item.label}</span></label>)}{!items.length && <div className="p-2 text-sm text-muted-foreground">Nothing available to share.</div>}</div></details>}</div>;
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) { return <div className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"><span className="text-sm">{label}</span><Switch aria-label={label} checked={checked} onCheckedChange={onCheckedChange} /></div>; }
function PreviewLine({ label, value }: { label: string; value: string }) { return <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-3"><div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>; }
function EmptyCopy({ text }: { text: string }) { return <div className="text-sm italic leading-5 text-muted-foreground">{text}</div>; }
function formatDate(value?: string) { if (!value) return 'Unknown date'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
