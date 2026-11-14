import assert from 'node:assert/strict';
import test from 'node:test';
import { countAtlasConceptTags } from '../../src/components/Atlas/atlas-tag-counts';
import { conceptKey, taggedItemsForConcept } from '../../src/lib/readex';
import type { Draft, Insight, Media, Practice, VaultEntry } from '../../src/lib/types';

test('Atlas tag counts match record selection and count repeated aliases only once per record', () => {
  const media = [{ tags: ['Agency', ' agency ', 'Identity'] }, {}] as Media[];
  const insights = [{ tags: ['Identity'] }] as Insight[];
  const vault = [{ tags: ['AGENCY'] }] as VaultEntry[];
  const drafts = [{ conceptTags: ['agency'] }] as Draft[];
  const practices = [{ conceptTags: ['identity', 'agency'] }] as Practice[];
  const counts = countAtlasConceptTags([
    ...media.map((item) => item.tags),
    ...insights.map((item) => item.tags),
    ...vault.map((item) => item.tags),
    ...drafts.map((item) => item.conceptTags),
    ...practices.map((item) => item.conceptTags),
  ]);
  assert.equal(counts.get(conceptKey('agency')), 3);
  for (const key of ['agency', 'AGENCY', 'identity', 'unknown']) {
    assert.equal(counts.get(conceptKey(key)) ?? 0, taggedItemsForConcept(key, media, insights, vault, drafts, practices).length);
  }
});
