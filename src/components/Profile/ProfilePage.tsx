"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { Brain, ChevronDown, ExternalLink, Globe, LogOut, Save, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { WorkspaceTabs } from '@/components/shared/WorkspaceTabs';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { AiAssistedHistory } from '@/components/ai/AiAssistedHistory';
import { ShapeMyPhilosophy } from '@/components/Profile/ShapeMyPhilosophy';
import { AiProvenanceBadge } from '@/components/ai/AiProvenanceBadge';
import { LabeledField as Field } from '@/components/shared/LabeledField';
import { profileEditPatch, profileReviewTarget, type ProfileReviewApproval } from '@/lib/profile-edit';
import { persistedConceptRecords } from '@/lib/workspace-counts';
import { buildPublicProfileSnapshot, isValidPublicProfileSlug, PUBLIC_PROFILE_SECTION_LIMIT, publicProfilePickerResults, publicProfileSaveMode, publicProfileSections, publicProfileSelectedIds } from '@/lib/public-profile';
import { thinkingHistoryDate } from '@/lib/evolution-history';
import { isInquiryActive } from '@/lib/inquiry-state';
import { isLivePosition } from '@/lib/position-state';
import { NoesisAiMark } from '@/components/ai/NoesisAiMark';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { profileStatementFromSynthesis, resolvedAiHistory, type AiReviewResult, type ContextualAiAction } from '@/lib/contextual-ai';
import { cn } from '@/lib/utils';
import type { AiSettings, BeliefProfile, Concept, Draft, Media, Practice, ProfilePrivacySettings, PublicProfileSnapshot, Question, ThinkingEvent, ThinkingMetrics, ThinkingPattern, ThinkingPatternUserResponse, Unknown, UserProfile, VaultEntry } from '@/lib/types';

interface ProfilePageProps {
  user: User | null;
  reviewMode: boolean;
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
  onSaveProfile: (profile: Partial<UserProfile>, approval?: ProfileReviewApproval) => Promise<void>;
  onSavePrivacy: (privacy: ProfilePrivacySettings, snapshot: PublicProfileSnapshot, expectedVersion: { dateUpdated?: string }) => Promise<ProfilePrivacySettings>;
  onUpdateUnknown: (unknown: Unknown) => void;
  onUpdateThinkingPattern: (pattern: ThinkingPattern) => void;
  onNavigate: (view: string, targetId?: string) => void;
}

type ProfileTab = 'profile' | 'philosophy' | 'reflection' | 'public';
type PhilosophyView = 'foundation' | 'influences' | 'development';
type ReflectionView = 'patterns' | 'open-edges';

export function ProfilePage({ user, reviewMode, profile, aiSettings, privacy, concepts: workspaceConcepts, inquiries, positions, sources, works, practices, thinkingEvents, beliefProfiles, unknowns, thinkingPatterns, thinkingMetrics: _thinkingMetrics, onSaveProfile, onSavePrivacy, onUpdateUnknown, onUpdateThinkingPattern, onNavigate }: ProfilePageProps) {
  const concepts = useMemo(() => persistedConceptRecords(workspaceConcepts), [workspaceConcepts]);
  const auth = useAuth();
  const { toast } = useToast();
  const [profileDraft, setProfileDraft] = useState<UserProfile>(profile);
  const savedReviews = resolvedAiHistory(profileDraft.aiReviewHistory, {
    id: 'legacy-philosophy-review', action: 'synthesize_profile_philosophy', title: 'Philosophy review',
    content: profileDraft.philosophySynthesisReview || '', date: profileDraft.philosophySynthesisReviewedAt || profileDraft.dateUpdated || '',
  });
  const [privacyDraft, setPrivacyDraft] = useState<ProfilePrivacySettings>(privacy);
  const [privacyDraftBase, setPrivacyDraftBase] = useState(privacy);
  const [patternResponseDrafts, setPatternResponseDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'profile' | 'privacy' | null>(null);
  const [pendingPublication, setPendingPublication] = useState<{ privacy: ProfilePrivacySettings; snapshot: PublicProfileSnapshot; expectedVersion: { dateUpdated?: string } } | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [philosophyView, setPhilosophyView] = useState<PhilosophyView>('foundation');
  const [shaping, setShaping] = useState(false);
  const [reflectionView, setReflectionView] = useState<ReflectionView>('patterns');
  const profileBaselineRef = useRef(profile);
  const publishButtonRef = useRef<HTMLButtonElement>(null);
  const shareSlugInput = useRef<HTMLInputElement>(null);
  const shareSlugFeedback = React.useId();
  const [showSlugError, setShowSlugError] = useState(false);

  useEffect(() => {
    const previous = profileBaselineRef.current;
    if (JSON.stringify(profile) === JSON.stringify(previous)) return;
    profileBaselineRef.current = profile;
    setProfileDraft((current) => ({ ...profile, ...profileEditPatch(previous, current) }));
  }, [profile]);
  useEffect(() => {
    if (JSON.stringify(privacyDraft) !== JSON.stringify(privacyDraftBase) || JSON.stringify(privacy) === JSON.stringify(privacyDraftBase)) return;
    if (privacyDraftBase.dateUpdated && (!privacy.dateUpdated || privacy.dateUpdated < privacyDraftBase.dateUpdated)) return;
    setPrivacyDraft(privacy);
    setPrivacyDraftBase(privacy);
  }, [privacy, privacyDraft, privacyDraftBase]);
  const sharingChoicesChanged = privacyDraftBase.dateUpdated !== privacy.dateUpdated
    && (!privacyDraftBase.dateUpdated || Boolean(privacy.dateUpdated && privacy.dateUpdated > privacyDraftBase.dateUpdated));

  const rankedConcepts = useMemo(() => [...concepts].sort((a, b) => (b.links.length + b.sourceIds.length) - (a.links.length + a.sourceIds.length)), [concepts]);
  const activePositions = useMemo(() => positions.filter(isLivePosition).sort((a, b) => b.confidence - a.confidence), [positions]);
  const shareablePositions = useMemo(() => positions.filter((item) => item.status !== 'rejected' && item.status !== 'abandoned').sort((a, b) => b.confidence - a.confidence), [positions]);
  const openInquiries = useMemo(() => inquiries.filter(isInquiryActive), [inquiries]);
  const openUnknowns = useMemo(() => unknowns.filter((item) => item.status !== 'resolved' && item.status !== 'archived'), [unknowns]);
  const sourceLeaders = useMemo(() => [...sources].sort((a, b) => b.annotations.length - a.annotations.length).slice(0, 5), [sources]);
  const publicBeliefEvents = useMemo(() => thinkingEvents
    .filter((event) => event.entityType === 'position' && Number.isFinite(thinkingHistoryDate(event.createdAt)))
    .sort((a, b) => thinkingHistoryDate(b.createdAt) - thinkingHistoryDate(a.createdAt)), [thinkingEvents]);
  const recentBeliefEvents = publicBeliefEvents.slice(0, 8);
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
    const dates = thinkingEvents.map((event) => thinkingHistoryDate(event.createdAt)).filter(Number.isFinite);
    return { sufficient: thinkingEvents.length >= 8 && objectFamilies >= 3, count: thinkingEvents.length, objectFamilies, range: dates.length ? `${formatDate(new Date(Math.min(...dates)).toISOString())} - ${formatDate(new Date(Math.max(...dates)).toISOString())}` : 'Not enough history' };
  }, [thinkingEvents]);

  const philosophyEvidenceCount = rankedConcepts.length
    + activePositions.length
    + inquiries.filter((item) => item.answer?.trim() || item.currentIntuition?.trim()).length
    + practices.filter((item) => item.observedOutcome?.trim() || item.logs?.length).length
    + works.filter((item) => (item.body || item.draftContent || '').trim()).length;

  const saveProfile = async () => {
    const patch = profileEditPatch(profileBaselineRef.current, profileDraft);
    if (!Object.keys(patch).length) return;
    setSaving('profile');
    try { await onSaveProfile(patch); toast({ title: 'Profile saved', description: 'Your identity and philosophy name are up to date.' }); }
    catch { toast({ variant: 'destructive', title: 'Profile not saved', description: 'Noesis could not save your profile right now.' }); }
    finally { setSaving(null); }
  };

  const publicSnapshot = buildPublicProfileSnapshot(privacyDraft, profile, {
    ...derivedIdentity, fallbackName: user?.displayName,
  }, {
    concepts: rankedConcepts, positions: shareablePositions, works, sources,
    practices: practices.filter((practice) => practice.status === 'active'),
    beliefHistory: publicBeliefEvents,
  });
  const validShareSlug = isValidPublicProfileSlug(publicSnapshot.shareSlug);
  const { canPublish, requiresConfirmation } = publicProfileSaveMode(Boolean(user), reviewMode, publicSnapshot.enabled, privacyDraft.requireConfirmationBeforePublic);
  const invalidShareSlug = showSlugError && publicSnapshot.enabled && !validShareSlug;

  const savePrivacy = async ({ privacy: choices, snapshot, expectedVersion }: NonNullable<typeof pendingPublication>) => {
    setSaving('privacy');
    try {
      const nextPrivacy = { ...choices, shareSlug: snapshot.shareSlug };
      const saved = await onSavePrivacy(nextPrivacy, snapshot, expectedVersion);
      setPrivacyDraftBase(saved);
      setPrivacyDraft((current) => current === choices ? saved : current);
      toast({ title: canPublish ? 'Sharing choices saved' : 'Preview choices saved', description: canPublish ? undefined : 'No public page was created.' });
    } finally { setSaving(null); }
  };

  const requestPrivacySave = () => {
    if (sharingChoicesChanged) return;
    if (publicSnapshot.enabled && !validShareSlug) {
      setShowSlugError(true);
      shareSlugInput.current?.focus();
      return;
    }
    const publication = { privacy: privacyDraft, snapshot: publicSnapshot, expectedVersion: { dateUpdated: privacyDraftBase.dateUpdated } };
    if (requiresConfirmation) {
      setPendingPublication(publication);
      return;
    }
    void savePrivacy(publication).catch((error) => toast({ variant: 'destructive', title: 'Public profile not saved', description: error instanceof Error ? error.message : 'Noesis could not save your sharing choices.' }));
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
      `Record coverage: ${concepts.length} concepts, ${activePositions.length} active positions, ${inquiries.length} inquiries, ${practices.length} practices, ${works.length} works, ${sources.length} sources`,
      `Open edges: ${openUnknowns.length} unknowns; ${openEdges.tensions.length} challenged positions; ${openEdges.unsupported.length} positions without recorded support`,
    ];
    const linkedMemory = [
      ...rankedConcepts.slice(0, 4).map((concept) => `Concept: ${concept.name}; definition: ${concept.description || 'not recorded'}; links ${concept.links.length}; sources ${concept.sourceIds.length}`),
      ...activePositions.slice(0, 5).map((position) => `Position: ${(position.statement || position.title).slice(0, 420)}; confidence ${Math.round(position.confidence)}%; support ${position.evidenceFor?.length || 0}; challenges ${position.evidenceAgainst?.length || 0}; assumptions ${position.assumptions?.length || 0}; status ${position.status}`),
      ...inquiries.filter((inquiry) => inquiry.answer?.trim() || inquiry.currentIntuition?.trim() || inquiry.uncertainty?.trim()).slice(0, 3).map((inquiry) => `Inquiry: ${inquiry.text.slice(0, 300)}; status ${inquiry.status}; current view ${inquiry.answer || inquiry.currentIntuition || 'none'}; uncertainty ${inquiry.uncertainty || 'not recorded'}`),
      ...practices.filter((practice) => practice.observedOutcome?.trim() || practice.logs?.length).slice(0, 3).map((practice) => `Practice: ${practice.title}; hypothesis ${practice.hypothesis || 'not recorded'}; observed ${practice.observedOutcome || 'not summarized'}; interpretation ${practice.interpretation || 'not recorded'}; effect ${practice.effectOnPosition || 'not recorded'}`),
      ...works.filter((work) => (work.body || work.draftContent || '').trim()).slice(0, 2).map((work) => `Work: ${work.title} (${work.type}, ${work.status}); excerpt ${(work.body || work.draftContent || '').slice(0, 360)}`),
      ...sourceLeaders.slice(0, 2).map((source) => `Source reflection: ${source.title}${source.creator ? ` by ${source.creator}` : ''}; lasting idea ${source.capture?.after?.lasting || source.capture?.after?.beliefChange || source.capture?.after?.coreArgument || 'not recorded'}`),
      ...recentBeliefEvents.slice(0, 1).map((event) => `Recent position change: ${event.summary}; reason ${event.userReason || event.systemReason || 'not recorded'}`),
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
  }, [activePositions, concepts.length, derivedIdentity.season, inquiries, openEdges.tensions.length, openEdges.unsupported.length, openUnknowns.length, practices, profile.id, profileDraft.philosophyName, profileDraft.philosophyNameStatus, profileDraft.philosophyStatement, rankedConcepts, recentBeliefEvents, sourceLeaders, sources.length, user?.uid, works]);

  const acceptPhilosophySynthesis = async (result: AiReviewResult, editedContent: string) => {
    await onSaveProfile({}, { result, text: editedContent, baseline: profile });
    const statement = profileStatementFromSynthesis(editedContent);
    if (statement) setProfileDraft((current) => ({ ...current, philosophyStatement: statement }));
  };

  return (
    <div className="noesis-page noesis-profile-page" data-noesis-identity="intellectual-portrait">
      <div className="noesis-page-inner flex flex-col gap-5">
        <PageHeader title="Profile" description="Who you are, the philosophy taking shape, and exactly what you choose to share." actions={<><Button variant="outline" onClick={handleSignOut} className="rounded-full bg-card px-4 font-semibold text-destructive hover:text-destructive"><LogOut className="mr-2 size-4" />Sign Out</Button>{(activeTab === 'profile' || activeTab === 'philosophy') && <Button onClick={saveProfile} disabled={saving === 'profile'} className="rounded-full px-5 font-semibold"><Save className="mr-2 size-4" />{saving === 'profile' ? 'Saving' : 'Save'}</Button>}</>} />

        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 text-muted-foreground">{profileDraft.photoURL || profileDraft.avatarUrl ? <img src={profileDraft.photoURL || profileDraft.avatarUrl} alt={profileDraft.displayName || 'Profile avatar'} className="h-full w-full object-cover" /> : <UserCircle2 className="size-9" />}</div>
              <div className="min-w-0"><div className="font-code text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Thinker profile</div><h2 className="noesis-page-title mt-1 break-words text-xl sm:text-2xl">{profileDraft.displayName || user?.displayName || 'Untitled Thinker'}</h2><p className="mt-1 text-sm text-muted-foreground">{profileDraft.philosophyName?.trim() || 'Unnamed philosophy'}<span className="mx-2">/</span>{derivedIdentity.season}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">{derivedIdentity.themes.slice(0, 3).map((theme) => <Badge key={theme} variant="secondary" className="rounded-full">{theme}</Badge>)}<Badge variant="outline" className="rounded-full">{concepts.length} concepts</Badge><Badge variant="outline" className="rounded-full">{activePositions.length} active positions</Badge></div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileTab)} className="space-y-5">
          <WorkspaceTabs
            value={activeTab}
            onChange={setActiveTab}
            label="Profile views"
            items={[
              { id: 'profile', label: 'Profile' },
              { id: 'philosophy', label: 'Philosophy' },
              { id: 'reflection', label: 'Reflection' },
              { id: 'public', label: 'Public' },
            ]}
          />

          <TabsContent value="profile" className="mt-0"><div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <SectionCard title="Your Identity" description="Only the details Noesis cannot infer responsibly."><div className="grid gap-4 sm:grid-cols-2"><Field label="Display name"><Input value={profileDraft.displayName || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, displayName: event.target.value }))} /></Field><Field label="Avatar URL"><Input value={profileDraft.avatarUrl || profileDraft.photoURL || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, avatarUrl: event.target.value, photoURL: event.target.value }))} placeholder="https://..." /></Field></div><Field label="Public introduction"><Textarea value={profileDraft.bio || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, bio: event.target.value }))} className="min-h-[100px]" placeholder="Introduce yourself and the questions that matter to you." /></Field><p className="mt-3 text-xs leading-5 text-muted-foreground">Your email is private and never included in the public profile.</p></SectionCard>
            <SectionCard title="Current Snapshot" description="A compact summary derived from your saved work."><div className="grid gap-3 sm:grid-cols-2"><DerivedField label="Current season" value={derivedIdentity.season} /><DerivedField label="Recurring focus" value={derivedIdentity.focus} /><DerivedField label="Leading position" value={derivedIdentity.leadingPosition?.statement || derivedIdentity.leadingPosition?.title || 'No active position yet.'} wide /></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Based on {derivedIdentity.evidenceLine}. This describes the current record, not a permanent identity.</p></SectionCard>
          </div></TabsContent>

          <TabsContent value="philosophy" className="mt-0">
            {shaping ? (
              <section className="mb-6 rounded-[var(--card-radius)] border border-border bg-card p-5">
                <ShapeMyPhilosophy
                  positions={positions}
                  concepts={concepts}
                  inquiries={inquiries}
                  practices={practices}
                  links={[]}
                  initialStatement={profileDraft.philosophyStatement}
                  onSaveStatement={async (statement) => {
                    await onSaveProfile({ philosophyStatement: statement });
                    setProfileDraft((previous) => ({ ...previous, philosophyStatement: statement }));
                    toast({ title: 'Working statement saved', description: 'Saved exactly as you wrote it.' });
                  }}
                  onClose={() => setShaping(false)}
                />
              </section>
            ) : (
              <section className="noesis-philosophy-launch mb-6" data-stage-tone="integrate">
                <div className="min-w-0">
                  <div className="noesis-stage-badge border-l-2 pl-2 font-code text-[10px] font-bold uppercase tracking-[0.16em]">Shape My Philosophy</div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A guided process through your workspace: survey, choose, clarify, ladder, examine, then write it in your own words. Noesis asks; you answer. It never writes your philosophy for you.</p>
                </div>
                <Button type="button" onClick={() => setShaping(true)} className="rounded-full">Begin</Button>
              </section>
            )}
            <SectionCard title="Your Philosophy" description="Name the worldview taking shape, then inspect the records that give it substance.">
            <div className="space-y-4 rounded-xl border border-border bg-background/50 p-4"><div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><Field label="Philosophy name"><Input value={profileDraft.philosophyName || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, philosophyName: event.target.value }))} placeholder="Name it now, or leave it unnamed" /></Field><div><div className="mb-2 font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Naming status</div><div className="flex gap-2"><Button type="button" size="sm" variant={(profileDraft.philosophyNameStatus || 'working') === 'working' ? 'default' : 'outline'} onClick={() => setProfileDraft((previous) => ({ ...previous, philosophyNameStatus: 'working' }))} className="rounded-full">Working name</Button><Button type="button" size="sm" variant={profileDraft.philosophyNameStatus === 'established' ? 'default' : 'outline'} onClick={() => setProfileDraft((previous) => ({ ...previous, philosophyNameStatus: 'established' }))} className="rounded-full">Established</Button></div></div></div><Field label="Working philosophy statement"><Textarea value={profileDraft.philosophyStatement || ''} onChange={(event) => setProfileDraft((previous) => ({ ...previous, philosophyStatement: event.target.value }))} className="min-h-[110px]" placeholder="Describe the central idea that connects your current thinking." /></Field></div>
            {profile.philosophyStatementProvenance && <div className="mt-2">
              <AiProvenanceBadge provenance={profile.philosophyStatementProvenance} target={profileReviewTarget(profile.philosophyStatementProvenance.provenanceId, 'philosophyStatement')} title="Working philosophy statement" />
            </div>}
            <div className="mt-4 flex flex-col gap-4 noesis-recommendation sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 font-medium"><NoesisAiMark className="size-6" />Shape My Philosophy</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Noesis compares a bounded set of your strongest records, tests their consistency, and proposes language for you to review. It never names or publishes your philosophy automatically.</p>
                {philosophyEvidenceCount < 3 && <p className="mt-2 text-xs text-muted-foreground">Add or develop at least three concepts, positions, inquiry answers, practices, or works before requesting a synthesis.</p>}
              </div>
              {aiSettings.aiAssistanceEnabled ? (
                <ContextualAiPanel
                  actions={['synthesize_profile_philosophy']}
                  buildEnvelope={buildPhilosophyEnvelope}
                  enabled={philosophyEvidenceCount >= 3}
                  showContextBeforeSending={aiSettings.showContextBeforeSending}
                  reasoningDepth={aiSettings.defaultReasoningDepth}
                  onAccept={acceptPhilosophySynthesis}
                  buttonLabel="Shape My Philosophy"
                  promptLabel="What should Noesis examine?"
                  promptPlaceholder="For example: Is my confidence consistent with my evidence and tested practices?"
                />
              ) : <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => onNavigate('settings')}>Enable in Settings</Button>}
            </div>
            {savedReviews.length > 0 && (
              <div className="mt-4">
                <AiAssistedHistory
                  title="Saved philosophy reviews"
                  entries={savedReviews.map((entry) => ({
                    ...entry,
                    originDetails: entry.id.startsWith('ai-review-') ? {
                      provenance: { provenanceId: entry.id, kind: 'ai-assisted' },
                      target: profileReviewTarget(entry.id, 'aiReviewHistory.content'),
                    } : undefined,
                  }))}
                  onChange={async (aiReviewHistory) => {
                    const patch = { aiReviewHistory, dateUpdated: new Date().toISOString() };
                    await onSaveProfile(patch);
                    setProfileDraft((current) => ({ ...current, ...patch }));
                  }}
                />
              </div>
            )}
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
            <div className="space-y-4"><div className="rounded-xl border border-border bg-background/50 p-4">
              <Field label="Profile URL name"><Input ref={shareSlugInput} value={privacyDraft.shareSlug || ''} onChange={(event) => setPrivacyDraft((previous) => ({ ...previous, shareSlug: event.target.value }))} placeholder="your-public-noesis" aria-invalid={invalidShareSlug || undefined} aria-describedby={shareSlugFeedback} /></Field>
              <p id={shareSlugFeedback} role={invalidShareSlug ? 'alert' : undefined} className={`mt-2 break-all text-xs ${invalidShareSlug ? 'text-destructive' : 'text-muted-foreground'}`}>
                {invalidShareSlug || !validShareSlug ? 'Use 3 to 60 letters, numbers, or hyphens.' : `${canPublish ? 'Public link' : 'Example link'}: /p/${publicSnapshot.shareSlug}`}
              </p>
              <div className="mt-4"><SwitchRow label={canPublish ? 'Publish profile' : 'Preview a public profile'} checked={privacyDraft.publicProfileEnabled} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicProfileEnabled: checked }))} /></div>{canPublish && privacy.publicProfileEnabled && privacy.shareSlug && <a href={`/p/${privacy.shareSlug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">Open published profile <ExternalLink className="size-3.5" /></a>}</div>
              <div className="grid gap-3 sm:grid-cols-2"><SwitchRow label="Introduction" checked={privacyDraft.publicBioEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicBioEnabled: checked }))} /><SwitchRow label="Philosophy name and statement" checked={privacyDraft.publicPhilosophyEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicPhilosophyEnabled: checked }))} /><SwitchRow label="Current season" checked={privacyDraft.publicSeasonEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicSeasonEnabled: checked }))} /><SwitchRow label="Recurring themes" checked={privacyDraft.publicThemesEnabled ?? true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicThemesEnabled: checked }))} /></div>
              <SwitchRow label="Profile photo" checked={privacyDraft.publicAvatarEnabled === true} onCheckedChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicAvatarEnabled: checked }))} />
              <div className="grid gap-3 md:grid-cols-2"><PublicationPicker title="Concepts" enabled={privacyDraft.publicConceptsEnabled} items={rankedConcepts.map((item) => ({ id: item.id, label: item.name }))} selectedIds={privacyDraft.publicConceptIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicConceptsEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicConceptIds: ids }))} /><PublicationPicker title="Positions" enabled={privacyDraft.publicPositionsEnabled} items={shareablePositions.map((item) => ({ id: item.id, label: item.statement || item.title }))} selectedIds={privacyDraft.publicPositionIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicPositionsEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicPositionIds: ids }))} /><PublicationPicker title="Works" enabled={privacyDraft.publicWorksEnabled} items={works.map((item) => ({ id: item.id, label: item.title }))} selectedIds={privacyDraft.publicWorkIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicWorksEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicWorkIds: ids }))} /><PublicationPicker title="Practices" enabled={privacyDraft.publicPracticesEnabled} items={practices.filter((item) => item.status === 'active').map((item) => ({ id: item.id, label: item.title }))} selectedIds={privacyDraft.publicPracticeIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicPracticesEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicPracticeIds: ids }))} /><PublicationPicker title="Sources" enabled={privacyDraft.publicSourcesEnabled} items={sources.map((item) => ({ id: item.id, label: item.title }))} selectedIds={privacyDraft.publicSourceIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicSourcesEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicSourceIds: ids }))} /><PublicationPicker title="Belief history" enabled={privacyDraft.publicBeliefBiographyEnabled} items={publicBeliefEvents.map((item) => ({ id: item.id, label: item.summary }))} selectedIds={privacyDraft.publicBeliefHistoryIds} onEnabledChange={(checked) => setPrivacyDraft((previous) => ({ ...previous, publicBeliefBiographyEnabled: checked }))} onSelectionChange={(ids) => setPrivacyDraft((previous) => ({ ...previous, publicBeliefHistoryIds: ids }))} /></div>
              {sharingChoicesChanged && <div className="space-y-2 border-y border-border py-3">
                <p role="status" className="text-sm text-muted-foreground">Sharing choices changed in another tab. Reload them before publishing.</p>
                <Button type="button" variant="outline" onClick={() => { setPrivacyDraftBase(privacy); setPrivacyDraft(privacy); }}>Discard draft and reload choices</Button>
              </div>}
              <Button ref={publishButtonRef} onClick={requestPrivacySave} disabled={saving === 'privacy' || sharingChoicesChanged} className="w-full rounded-full font-semibold"><Save className="mr-2 size-4" />{saving === 'privacy' ? 'Saving choices' : canPublish ? 'Save public profile' : 'Save preview choices'}</Button></div>
            <div className="min-w-0 self-start rounded-xl border border-border bg-card p-5 xl:sticky xl:top-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-medium"><Globe className="size-4 text-accent" />Public preview</h3>
                <Badge variant="outline">{!canPublish ? 'Demo only' : publicSnapshot.enabled ? 'Will be public after saving' : 'Private'}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{canPublish ? 'This preview uses your saved identity and philosophy.' : 'Preview choices stay in this workspace. No public page is created.'}</p>
              {publicSnapshot.enabled ? <ProfileSnapshotContent snapshot={publicSnapshot} /> : <p className="mt-4 text-sm text-muted-foreground">{canPublish ? 'Visitors will not be able to open this profile after saving.' : 'Turn on the preview to see what visitors would see.'}</p>}
              <p className="mt-5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">Private notes, annotations, unknowns, and pattern feedback are never published.</p>
            </div>
          </div></SectionCard></TabsContent>
        </Tabs>
        <ConfirmActionDialog open={Boolean(pendingPublication)} onOpenChange={(open) => { if (!open) setPendingPublication(null); }}
          returnFocusRef={publishButtonRef}
          title={canPublish ? 'Publish these profile details?' : 'Save this profile preview?'}
          description={canPublish ? 'Anyone with the public link can read and copy the information shown in your preview.' : 'These choices stay in this workspace and do not create a public page.'}
          confirmLabel={canPublish ? 'Publish profile' : 'Save preview choices'} onConfirm={() => pendingPublication ? savePrivacy(pendingPublication) : undefined}>
          {pendingPublication && (
            <div role="region" aria-label="Details to be published" tabIndex={0} className="max-h-[34dvh] min-h-0 min-w-0 overflow-y-auto overscroll-contain border-y border-border px-1 pb-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
              <p className="mt-3 break-all text-xs text-muted-foreground">{canPublish ? 'Public link' : 'Example link'}: /p/{pendingPublication.snapshot.shareSlug}</p>
              <ProfileSnapshotContent snapshot={pendingPublication.snapshot} />
            </div>
          )}
        </ConfirmActionDialog>
      </div>
    </div>
  );
}

function ProfileSnapshotContent({ snapshot }: { snapshot: PublicProfileSnapshot }) {
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        {snapshot.avatarUrl && <img src={snapshot.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full object-cover" />}
        <p className="min-w-0 break-words font-headline text-2xl font-semibold">{snapshot.displayName}</p>
      </div>
      {snapshot.bio && <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{snapshot.bio}</p>}
      {snapshot.philosophyName && <PreviewLine label={snapshot.philosophyNameStatus === 'established' ? 'Established philosophy' : 'Working philosophy name'} value={snapshot.philosophyName} />}
      {snapshot.philosophyStatement && <p className="mt-3 break-words text-sm leading-6">{snapshot.philosophyStatement}</p>}
      {snapshot.currentSeason && <PreviewLine label="Current season" value={snapshot.currentSeason} />}
      {snapshot.themes.length > 0 && <PreviewLine label="Recurring themes" value={snapshot.themes.join(', ')} />}
      {publicProfileSections(snapshot, formatDate).map(({ label, items }) => (
        <details key={label} className="mt-3 border-t border-border pt-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">{label} ({items.length})</summary>
          <ul className="space-y-2 pb-2 text-sm">{items.map((item) => <li key={item.id} className="break-words">{item.label}{item.detail && <span className="block text-xs text-muted-foreground">{item.detail}</span>}</li>)}</ul>
        </details>
      ))}
    </>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card className="rounded-2xl border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5"><h2 className="font-headline text-2xl font-semibold italic">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p></div>{children}</Card>; }
function DerivedField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={cn('rounded-xl border border-border bg-background/50 p-4', wide && 'sm:col-span-2')}><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div><p className="mt-2 text-sm leading-6">{value}</p></div>; }
function SegmentedNav({ value, onChange, items, label, className }: { value: string; onChange: (value: string) => void; items: Array<[string, string]>; label: string; className?: string }) { return <WorkspaceTabs value={value} onChange={onChange} items={items.map(([id, text]) => ({ id, label: text }))} label={label} variant="segmented" className={className} />; }
function LinkGroup({ title, empty, onOpenAll, children }: { title: string; empty: string; onOpenAll: () => void; children: React.ReactNode }) { const hasChildren = React.Children.count(children) > 0; return <div className="rounded-xl border border-border bg-background/50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div><Button variant="ghost" size="sm" onClick={onOpenAll} className="rounded-full">Open all</Button></div><div className="space-y-2">{hasChildren ? children : <EmptyCopy text={empty} />}</div></div>; }
function MiniLink({ label, meta, onClick }: { label: string; meta: string; onClick: () => void }) { return <button onClick={onClick} className="flex min-h-11 w-full items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 text-sm leading-5">{label}</span><span className="shrink-0 font-code text-[8px] uppercase tracking-wider text-muted-foreground">{meta}</span></button>; }

function PatternDisclosure({ pattern, responseDraft, onDraftChange, onRespond }: { pattern: ThinkingPattern; responseDraft: string; onDraftChange: (value: string) => void; onRespond: (pattern: ThinkingPattern, response: ThinkingPatternUserResponse, note?: string) => void }) {
  const evidenceLevel = pattern.evidence.length >= 5 && pattern.confidence >= 0.75 ? 'strong' : pattern.evidence.length >= 3 && pattern.confidence >= 0.55 ? 'moderate' : 'limited';
  return <details className="group rounded-xl border border-border bg-background/50"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><div className="font-medium">{pattern.label}</div><div className="mt-1 text-xs text-muted-foreground">{evidenceLevel} evidence / {pattern.evidence.length} examples</div></div><ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" /></summary><div className="border-t border-border px-4 py-4"><p className="text-sm leading-6 text-muted-foreground">{pattern.description}</p>{pattern.evidence.length > 0 && <ul className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">{pattern.evidence.slice(0, 4).map((evidence) => <li key={evidence}>- {evidence}</li>)}</ul>}<div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => onRespond(pattern, 'confirmed')}>Agree</Button><Button variant="outline" size="sm" onClick={() => onRespond(pattern, 'partially_agree')}>Partly</Button><Button variant="ghost" size="sm" onClick={() => onRespond(pattern, 'needs_more_evidence')}>Need evidence</Button><Button variant="ghost" size="sm" onClick={() => onRespond(pattern, 'rejected')}>Disagree</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={responseDraft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Offer another explanation" /><Button variant="outline" disabled={!responseDraft.trim()} onClick={() => onRespond(pattern, 'alternative_explanation', responseDraft)}>Save note</Button></div></div></details>;
}

function StatusList({ title, items, onResolve, onOpen }: { title: string; items: Unknown[]; onResolve: (item: Unknown) => void; onOpen: () => void }) { return <div className="rounded-xl border border-border bg-background/50 p-4"><div className="flex items-center justify-between gap-2"><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div><Button variant="ghost" size="sm" onClick={onOpen}>Open inquiries</Button></div><div className="mt-3 space-y-2">{items.map((item) => <div key={item.unknownId} className="rounded-lg border border-border bg-card p-3"><div className="text-sm font-medium">{item.title}</div><Button variant="ghost" size="sm" className="mt-2 h-8 px-2" onClick={() => onResolve(item)}>Mark resolved</Button></div>)}{!items.length && <EmptyCopy text="No open unknowns." />}</div></div>; }
function TextList({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div className="rounded-xl border border-border bg-background/50 p-4"><div className="font-code text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div><div className="mt-3 space-y-2">{items.map((item) => <p key={item} className="rounded-lg border border-border bg-card p-3 text-sm leading-5">{item}</p>)}{!items.length && <EmptyCopy text={empty} />}</div></div>; }

function PublicationPicker({ title, enabled, items, selectedIds, onEnabledChange, onSelectionChange }: { title: string; enabled: boolean; items: Array<{ id: string; label: string }>; selectedIds?: string[]; onEnabledChange: (checked: boolean) => void; onSelectionChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const choices = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);
  const selected = publicProfileSelectedIds(items, selectedIds);
  const results = publicProfilePickerResults(items, selected, search);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    (choices.current.get(pendingFocus.current) ?? searchInput.current)?.focus();
    pendingFocus.current = null;
  });
  const atLimit = selected.length >= PUBLIC_PROFILE_SECTION_LIMIT;
  const toggle = (id: string) => {
    if (selected.includes(id)) onSelectionChange(selected.filter((item) => item !== id));
    else if (!atLimit) onSelectionChange([...selected, id]);
  };
  const renderItem = (item: { id: string; label: string }, checked: boolean) => (
    <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--button-radius)] px-2 py-2 text-sm hover:bg-muted/20">
      <input type="checkbox" checked={checked} disabled={atLimit && !checked}
        ref={(node) => { if (node) choices.current.set(item.id, node); else choices.current.delete(item.id); }}
        onChange={(event) => {
          if (document.activeElement === event.currentTarget) pendingFocus.current = item.id;
          toggle(item.id);
        }}
        className="mt-1 size-4 shrink-0 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />
      <span className="min-w-0 break-words leading-5">{item.label}</span>
    </label>
  );
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/50">
      <div className="flex min-h-14 items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground" aria-live="polite">{enabled ? `${selected.length} of ${PUBLIC_PROFILE_SECTION_LIMIT} selected` : 'Not shared'}</div>
        </div>
        <Switch aria-label={`Share ${title}`} checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && <details className="group border-t border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Choose {title.toLocaleLowerCase()}<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-2 border-t border-border p-2">
          {items.length > 0 && <Input ref={searchInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Find ${title.toLocaleLowerCase()}`} aria-label={`Search ${title.toLocaleLowerCase()} to share`} className="min-h-11" />}
          <div className="max-h-56 space-y-2 overflow-y-auto overscroll-contain">
            {results.selected.length > 0 && <div role="group" aria-label="Selected items">
              <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">Selected</p>
              {results.selected.map((item) => renderItem(item, true))}
            </div>}
            {results.available.length > 0 && <div role="group" aria-label="Available items">
              {results.selected.length > 0 && <p className="border-t border-border px-2 pt-2 text-xs font-medium text-muted-foreground">Available</p>}
              {results.available.map((item) => renderItem(item, false))}
            </div>}
            {!items.length && <p className="p-2 text-sm text-muted-foreground">Nothing available to share.</p>}
            {items.length > 0 && search.trim() && !results.available.length && <p role="status" className="p-2 text-sm text-muted-foreground">No other items match this search.</p>}
          </div>
        </div>
      </details>}
    </div>
  );
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) { return <div className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"><span className="text-sm">{label}</span><Switch aria-label={label} checked={checked} onCheckedChange={onCheckedChange} /></div>; }
function PreviewLine({ label, value }: { label: string; value: string }) { return <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-3"><div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>; }
function EmptyCopy({ text }: { text: string }) { return <div className="text-sm italic leading-5 text-muted-foreground">{text}</div>; }
function formatDate(value?: string) { if (!value) return 'Unknown date'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
