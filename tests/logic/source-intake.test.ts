import assert from 'node:assert/strict';
import test from 'node:test';
import { MEDIA_TYPES } from '../../src/lib/readex';
import { buildCatalogSummary, sourceResultToMediaPatch } from '../../src/lib/source-intake';
import { SOURCE_SEARCH_PLAN } from '../../src/lib/source-search-plan';

test('every supported media type has an explicit source-search plan', () => {
  assert.deepEqual(Object.keys(SOURCE_SEARCH_PLAN).sort(), [...MEDIA_TYPES].sort());
  for (const type of MEDIA_TYPES) {
    assert.ok(SOURCE_SEARCH_PLAN[type].length > 0, `${type} needs at least one provider`);
  }
});

test('multi-format media use resilient fallback providers', () => {
  for (const type of ['audiobook', 'podcast', 'movie', 'article', 'course', 'lecture', 'documentary', 'interview', 'conversation', 'paper', 'other'] as const) {
    assert.ok(SOURCE_SEARCH_PLAN[type].length >= 2, `${type} should not depend on one provider`);
  }
});

test('video-oriented media use YouTube with a non-YouTube fallback', () => {
  for (const type of ['video', 'course', 'lecture', 'documentary', 'interview', 'conversation'] as const) {
    const providers = SOURCE_SEARCH_PLAN[type];
    assert.ok(providers.includes('youtube'), `${type} should search YouTube`);
    assert.ok(providers.some((provider) => provider !== 'youtube'), `${type} needs a fallback when YouTube is unavailable`);
  }
});

test('catalog summaries stay factual, bounded, and separate from user notes', () => {
  const description = [
    'This source examines how attention changes moral judgment.',
    'It compares deliberate reflection with habitual reaction.',
    'The final section discusses practical consequences for everyday decisions.',
    'Additional appendices provide historical context that is not needed in a compact catalog summary.',
  ].join(' ');
  const summary = buildCatalogSummary(description, 180);
  assert.ok(summary.length <= 180);
  assert.match(summary, /^This source examines/);

  const patch = sourceResultToMediaPatch({
    provider: 'crossref',
    externalId: 'example',
    type: 'article',
    title: 'Attention and Judgment',
    creators: ['A. Thinker'],
    description,
  });
  assert.equal(patch.description, description);
  assert.equal(patch.catalogSummary, buildCatalogSummary(description));
  assert.equal('sourceNotes' in patch, false);
});
