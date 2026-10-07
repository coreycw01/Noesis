import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAtlasRegions, reconcileAtlasRegionNotices } from '../../src/components/Atlas/atlas-diagnostics';
import type { Concept, Practice, Question, VaultEntry } from '../../src/lib/types';

test('regions contain only existing concepts and explain membership', () => {
  const concepts = [
    { id: 'identity', name: 'Identity', dateCreated: '2026-01-01' },
    { id: 'agency', name: 'Agency', dateCreated: '2026-01-01' },
  ] as Concept[];
  const regions = deriveAtlasRegions({ concepts, media: [], vault: [], practices: [], questions: [], drafts: [], links: [], timeline: [], thinkingEvents: [] });
  const selfhood = regions.find((region) => region.id === 'selfhood');

  assert.ok(selfhood);
  assert.deepEqual(selfhood.conceptIds.sort(), ['agency', 'identity']);
  assert.equal(selfhood.confirmedMemberCount, 2);
  assert.equal(selfhood.status, 'provisional');
  assert.match(selfhood.membershipReasons.identity, /name matches/);
  assert.match(selfhood.explanation, /Three existing concepts/);
});

test('a region becomes active with three existing concepts', () => {
  const concepts = ['Identity', 'Agency', 'Authenticity'].map((name, index) => ({
    id: `concept-${index}`,
    name,
    dateCreated: '2026-01-01',
  })) as Concept[];
  const regions = deriveAtlasRegions({ concepts, media: [], vault: [], practices: [], questions: [], drafts: [], links: [], timeline: [], thinkingEvents: [] });
  const selfhood = regions.find((region) => region.id === 'selfhood');

  assert.ok(selfhood);
  assert.equal(selfhood.status, 'active');
  assert.equal(selfhood.confirmedMemberCount, 3);
  assert.match(selfhood.explanation, /organizational view/);
});

test('new active regions are announced once and remain unread until opened', () => {
  const initial = reconcileAtlasRegionNotices(['selfhood'], null);
  assert.deepEqual(initial.newIds, []);
  const promoted = reconcileAtlasRegionNotices(['selfhood', 'ethics'], initial.state);
  assert.deepEqual(promoted.newIds, ['ethics']);
  assert.deepEqual(promoted.state.unreadIds, ['ethics']);
  const revisited = reconcileAtlasRegionNotices(['selfhood', 'ethics'], promoted.state);
  assert.deepEqual(revisited.newIds, []);
  assert.deepEqual(revisited.state.unreadIds, ['ethics']);
});

test('linked records can support a provisional region without creating concepts', () => {
  const concepts = [{ id: 'identity', name: 'Identity', dateCreated: '2026-01-01' }] as Concept[];
  const vault = [{ id: 'position-1', title: 'Agency and identity', statement: 'Agency shapes identity.', tags: ['Identity'] }] as VaultEntry[];
  const practices = [{ id: 'practice-1', title: 'Agency exercise', conceptTags: ['Identity'], positionIds: ['position-1'] }] as Practice[];
  const questions = [{ id: 'question-1', text: 'Can agency change identity?', conceptIds: ['identity'], beliefIds: ['position-1'], status: 'open' }] as Question[];
  const regions = deriveAtlasRegions({ concepts, media: [], vault, practices, questions, drafts: [], links: [], timeline: [], thinkingEvents: [] });
  const selfhood = regions.find((region) => region.id === 'selfhood');

  assert.ok(selfhood);
  assert.equal(selfhood.status, 'provisional');
  assert.deepEqual(selfhood.conceptIds, ['identity']);
  assert.match(selfhood.membershipReasons.identity, /linked position/);
  assert.equal(selfhood.suggestedMemberNames.length, 0);
});
