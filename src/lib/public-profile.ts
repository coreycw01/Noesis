import type { Concept, Draft, Media, Practice, ProfilePrivacySettings, PublicProfileSnapshot, ThinkingEvent, UserProfile, VaultEntry } from './types';
import { DRAFT_LABELS, MEDIA_LABELS, PRACTICE_LABELS } from './readex';
import type { NoesisIconKey } from './noesis-icons';
import { thinkingHistoryDate } from './evolution-history';

export const PUBLIC_PROFILE_SECTION_LIMIT = 12;

export function publicProfileSaveMode(signedIn: boolean, reviewMode: boolean, enabled: boolean, confirmPreview: boolean) {
  const canPublish = signedIn && !reviewMode;
  return { canPublish, requiresConfirmation: enabled && (canPublish || confirmPreview) };
}

export function publicSnapshotMatchesChoices(snapshot: PublicProfileSnapshot, privacy: ProfilePrivacySettings) {
  if (snapshot.enabled !== privacy.publicProfileEnabled || snapshot.shareSlug !== normalizePublicProfileSlug(privacy.shareSlug)) return false;
  if (!snapshot.enabled) return true;
  const selected = (items: readonly { id: string }[], enabled: boolean, ids?: string[]) =>
    items.length <= PUBLIC_PROFILE_SECTION_LIMIT && (!items.length || (enabled
      && new Set(items.map(({ id }) => id)).size === items.length
      && items.every(({ id }) => ids?.includes(id))));
  return (privacy.publicAvatarEnabled === true || !snapshot.avatarUrl)
    && (privacy.publicBioEnabled !== false || !snapshot.bio)
    && (privacy.publicPhilosophyEnabled !== false || !(snapshot.philosophyName || snapshot.philosophyStatement || snapshot.philosophyNameStatus))
    && (privacy.publicSeasonEnabled !== false || !snapshot.currentSeason)
    && (privacy.publicThemesEnabled !== false || !snapshot.themes.length)
    && selected(snapshot.concepts, privacy.publicConceptsEnabled, privacy.publicConceptIds)
    && selected(snapshot.positions, privacy.publicPositionsEnabled, privacy.publicPositionIds)
    && selected(snapshot.works, privacy.publicWorksEnabled, privacy.publicWorkIds)
    && selected(snapshot.practices, privacy.publicPracticesEnabled, privacy.publicPracticeIds)
    && selected(snapshot.sources, privacy.publicSourcesEnabled, privacy.publicSourceIds)
    && selected(snapshot.beliefHistory, privacy.publicBeliefBiographyEnabled, privacy.publicBeliefHistoryIds);
}

type PublicProfileItem = { id: string; label: string; detail?: string };

export function publicProfileSections(snapshot: PublicProfileSnapshot, formatDate: (date: string) => string) {
  if (!snapshot.enabled) return [];
  const sections: Array<{ icon: NoesisIconKey; label: string; items: PublicProfileItem[] }> = [
    { icon: 'concept', label: 'Concepts', items: (snapshot.concepts ?? []).map((item) => ({ id: item.id, label: item.name, detail: item.description })) },
    { icon: 'position', label: 'Positions', items: (snapshot.positions ?? []).map((item) => ({ id: item.id, label: item.statement, detail: Number.isFinite(item.confidence) ? `${Math.round(item.confidence)}% confidence` : undefined })) },
    { icon: 'work', label: 'Works', items: (snapshot.works ?? []).map((item) => ({ id: item.id, label: item.title, detail: DRAFT_LABELS[item.type] })) },
    { icon: 'practice', label: 'Practices', items: (snapshot.practices ?? []).map((item) => ({ id: item.id, label: item.title, detail: PRACTICE_LABELS[item.type] })) },
    { icon: 'source', label: 'Sources', items: (snapshot.sources ?? []).map((item) => ({ id: item.id, label: item.title, detail: [item.creator, MEDIA_LABELS[item.type]].filter(Boolean).join(' / ') })) },
    { icon: 'evolution', label: 'Belief history', items: (snapshot.beliefHistory ?? []).map((item) => ({ id: item.id, label: item.summary, detail: formatDate(item.date) })) },
  ];
  return sections.filter(({ items }) => items.length > 0);
}

export function normalizePublicProfileSlug(value?: string) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function isValidPublicProfileSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{2,59}$/.test(value);
}

export function publicProfileSelectedIds(items: ReadonlyArray<{ id: string }>, ids?: string[]) {
  const chosen = new Set(ids);
  return [...new Set(items.map((item) => item.id).filter((id) => chosen.has(id)))].slice(0, PUBLIC_PROFILE_SECTION_LIMIT);
}

export function publicProfilePickerResults<T extends PublicProfileItem>(items: readonly T[], ids: readonly string[], search: string) {
  const selectedIds = new Set(ids);
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const selected: T[] = [];
  const available: T[] = [];
  for (const item of items) {
    if (selectedIds.has(item.id)) selected.push(item);
    else {
      const label = item.label.toLocaleLowerCase();
      if (terms.every((term) => label.includes(term))) available.push(item);
    }
  }
  return { selected, available };
}

export function buildPublicProfileSnapshot(privacy: ProfilePrivacySettings, profile: UserProfile, identity: {
  fallbackName?: string | null;
  season: string;
  themes: string[];
}, records: { concepts: Concept[]; positions: VaultEntry[]; works: Draft[]; practices: Practice[]; sources: Media[]; beliefHistory: ThinkingEvent[] }): PublicProfileSnapshot {
  const select = <T extends { id: string }>(items: T[], enabled: boolean, ids?: string[]) =>
    enabled ? publicProfileSelectedIds(items, ids).flatMap((id) => items.find((item) => item.id === id) || []) : [];
  const snapshot: PublicProfileSnapshot = {
    shareSlug: normalizePublicProfileSlug(privacy.shareSlug),
    enabled: privacy.publicProfileEnabled,
    displayName: profile.displayName?.trim() || identity.fallbackName?.trim() || 'Untitled Thinker',
    currentSeason: '', themes: [], concepts: [], positions: [], works: [], practices: [], sources: [], beliefHistory: [],
  };
  if (!snapshot.enabled) return { ...snapshot, displayName: 'Untitled Thinker' };

  const avatarUrl = profile.avatarUrl || profile.photoURL;
  if (privacy.publicAvatarEnabled === true && avatarUrl) snapshot.avatarUrl = avatarUrl;
  if (privacy.publicBioEnabled !== false && profile.bio?.trim()) snapshot.bio = profile.bio.trim();
  if (privacy.publicPhilosophyEnabled !== false) {
    if (profile.philosophyName?.trim()) {
      snapshot.philosophyName = profile.philosophyName.trim();
      snapshot.philosophyNameStatus = profile.philosophyNameStatus || 'working';
    }
    if (profile.philosophyStatement?.trim()) snapshot.philosophyStatement = profile.philosophyStatement.trim();
  }
  if (privacy.publicSeasonEnabled !== false) snapshot.currentSeason = identity.season;
  if (privacy.publicThemesEnabled !== false) snapshot.themes = identity.themes.slice(0, 5);
  snapshot.concepts = select(records.concepts, privacy.publicConceptsEnabled, privacy.publicConceptIds).map(({ id, name, description }) => ({ id, name, ...(description ? { description } : {}) }));
  snapshot.positions = select(records.positions, privacy.publicPositionsEnabled, privacy.publicPositionIds).map(({ id, statement, title, confidence }) => ({ id, statement: statement || title, confidence }));
  snapshot.works = select(records.works, privacy.publicWorksEnabled, privacy.publicWorkIds).map(({ id, title, type }) => ({ id, title, type }));
  snapshot.practices = select(records.practices, privacy.publicPracticesEnabled, privacy.publicPracticeIds).map(({ id, title, type }) => ({ id, title, type }));
  snapshot.sources = select(records.sources, privacy.publicSourcesEnabled, privacy.publicSourceIds).map(({ id, title, creator, type }) => ({ id, title, ...(creator ? { creator } : {}), type }));
  snapshot.beliefHistory = select(records.beliefHistory, privacy.publicBeliefBiographyEnabled, privacy.publicBeliefHistoryIds).map(({ id, summary, createdAt }) => {
    const instant = thinkingHistoryDate(createdAt);
    return { id, summary, date: Number.isFinite(instant) ? new Date(instant).toISOString() : '' };
  });
  return snapshot;
}
