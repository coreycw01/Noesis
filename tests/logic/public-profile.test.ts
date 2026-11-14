import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { buildPublicProfileSnapshot, isValidPublicProfileSlug, publicProfilePickerResults, publicProfileSaveMode, publicProfileSections, publicProfileSelectedIds } from '../../src/lib/public-profile';
import { publicProfileCacheRule } from '../../src/lib/public-profile-cache';
import { Timestamp } from 'firebase/firestore';

const demo = buildDemoWorkspace('public-profile-test');
const records = { concepts: demo.concepts, positions: demo.vault, works: demo.drafts, practices: demo.practices, sources: demo.media, beliefHistory: demo.thinkingEvents };
const identity = { season: 'Reviewing', themes: ['Private theme'] };

test('publication always needs confirmation and a signed-in review workspace stays preview-only', () => {
  assert.deepEqual(publicProfileSaveMode(true, false, true, false), { canPublish: true, requiresConfirmation: true });
  assert.deepEqual(publicProfileSaveMode(true, false, false, true), { canPublish: true, requiresConfirmation: false });
  assert.deepEqual(publicProfileSaveMode(true, true, true, true), { canPublish: false, requiresConfirmation: true });
  assert.deepEqual(publicProfileSaveMode(false, true, true, false), { canPublish: false, requiresConfirmation: false });
});

test('public profile reads and writes share URL name bounds', () => {
  for (const slug of ['abc', 'my-philosophy', 'x'.repeat(60)]) assert.equal(isValidPublicProfileSlug(slug), true);
  for (const slug of ['', 'ab', 'x'.repeat(61), '../name', 'a/b', 'a%2Fb', 'my philosophy']) assert.equal(isValidPublicProfileSlug(slug), false);
});

test('public profile cache policy disallows retaining a shareable response', () => {
  assert.equal(publicProfileCacheRule.source, '/p/:slug');
  assert.match(publicProfileCacheRule.headers.find(({ key }) => key === 'Cache-Control')?.value ?? '', /\bprivate, no-store\b/);
});

test('public profile only includes explicitly selected records in enabled sections', () => {
  const [concept] = records.concepts;
  const [source] = records.sources;
  const snapshot = buildPublicProfileSnapshot({
    ...demo.profilePrivacy, publicProfileEnabled: true, shareSlug: ' My Philosophy ',
    publicBioEnabled: false, publicPhilosophyEnabled: false, publicSeasonEnabled: false, publicThemesEnabled: false,
    publicConceptsEnabled: true, publicConceptIds: [concept.id, 'unknown', concept.id],
    publicSourcesEnabled: false, publicSourceIds: [source.id], publicWorksEnabled: true, publicWorkIds: undefined,
  }, { ...demo.profile, bio: 'Private bio', philosophyStatement: 'Private statement' }, identity, records);
  assert.equal(snapshot.shareSlug, 'my-philosophy');
  assert.deepEqual(snapshot.concepts.map(({ id }) => id), [concept.id]);
  assert.deepEqual(snapshot.works, []);
  assert.deepEqual(snapshot.sources, []);
  assert.deepEqual(snapshot.themes, []);
  assert.equal(snapshot.currentSeason, '');
  assert.equal(snapshot.bio, undefined);
  assert.equal(snapshot.philosophyStatement, undefined);
  assert.equal('email' in snapshot, false);
});

test('sharing a philosophy statement does not publish its private review or provenance', () => {
  const snapshot = buildPublicProfileSnapshot({
    ...demo.profilePrivacy, publicProfileEnabled: true, publicPhilosophyEnabled: true,
  }, {
    ...demo.profile,
    philosophyStatement: 'Approved public statement',
    philosophyStatementProvenance: { provenanceId: 'private-origin-id', kind: 'ai-assisted' },
    philosophySynthesisReview: 'Private review text',
    aiReviewHistory: [{ id: 'private-origin-id', action: 'synthesize_profile_philosophy', title: 'Private review', content: 'Private review text', date: '2026-11-13' }],
  }, identity, records);
  assert.equal(snapshot.philosophyStatement, 'Approved public statement');
  assert.doesNotMatch(JSON.stringify(snapshot), /private-origin-id|Private review/);
});

test('publication search keeps selections visible and filters only available records', () => {
  const items = [{ id: 'chosen', label: 'Meditations' }, { id: 'match', label: 'Narrative Identity and Agency' }, { id: 'other', label: 'Agency alone' }];
  assert.deepEqual(publicProfilePickerResults(items, ['chosen'], '  AGENCY identity  '), {
    selected: [items[0]], available: [items[1]],
  });
  assert.deepEqual(publicProfilePickerResults(items, ['chosen'], 'no match'), { selected: [items[0]], available: [] });
});

test('unpublishing clears public content and a selection is bounded to twelve unique records', () => {
  const snapshot = buildPublicProfileSnapshot({ ...demo.profilePrivacy, publicProfileEnabled: false }, demo.profile, identity, records);
  assert.equal(snapshot.enabled, false);
  assert.equal(snapshot.avatarUrl, undefined);
  assert.deepEqual(snapshot.positions, []);
  const items = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
  assert.equal(publicProfileSelectedIds(items, items.map(({ id }) => id)).length, 12);
});

test('a public photo requires explicit consent and history uses portable dates', () => {
  const profile = { ...demo.profile, avatarUrl: 'https://example.com/avatar.png' };
  const [event] = records.beliefHistory;
  const timestamp = Timestamp.fromDate(new Date('2026-11-13T15:30:00Z'));
  const choices = {
    ...demo.profilePrivacy, publicProfileEnabled: true, publicBeliefBiographyEnabled: true,
    publicBeliefHistoryIds: [event.id],
  };
  const input = { ...records, beliefHistory: [{ ...event, createdAt: timestamp as unknown as string }] };
  const privatePhoto = buildPublicProfileSnapshot(choices, profile, identity, input);
  assert.equal(privatePhoto.avatarUrl, undefined);
  assert.equal(privatePhoto.beliefHistory[0]?.date, '2026-11-13T15:30:00.000Z');
  assert.equal(buildPublicProfileSnapshot({ ...choices, publicAvatarEnabled: true }, profile, identity, input).avatarUrl, profile.avatarUrl);
});

test('public sections omit empty and disabled content and use human-readable metadata', () => {
  const snapshot = {
    ...buildPublicProfileSnapshot({ ...demo.profilePrivacy, publicProfileEnabled: false }, demo.profile, identity, records),
    enabled: true,
    works: [{ id: 'note', title: 'Working notes', type: 'text_note' as const }],
    sources: [{ id: 'audio', title: 'A conversation', creator: 'Ada', type: 'podcast' as const }],
    beliefHistory: [{ id: 'event', summary: 'Revised position', date: '2026-11-13' }],
  };
  assert.deepEqual(publicProfileSections(snapshot, () => 'Nov 13, 2026'), [
    { icon: 'work', label: 'Works', items: [{ id: 'note', label: 'Working notes', detail: 'Text Note' }] },
    { icon: 'source', label: 'Sources', items: [{ id: 'audio', label: 'A conversation', detail: 'Ada / Podcast' }] },
    { icon: 'evolution', label: 'Belief history', items: [{ id: 'event', label: 'Revised position', detail: 'Nov 13, 2026' }] },
  ]);
  assert.deepEqual(publicProfileSections({ ...snapshot, enabled: false }, () => { throw new Error('Private content must not be formatted'); }), []);
});
