import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_AI_REVIEW_HISTORY,
  MAX_NESTED_ANNOTATIONS,
  appendAiReviewHistory,
  boundedNestedAnnotations,
  conceptIdsForLabels,
  mergeAnnotationRecords,
} from '../../src/lib/collection-integrity';

test('keeps contextual AI review history bounded and newest first', () => {
  const entries = Array.from({ length: MAX_AI_REVIEW_HISTORY + 5 }, (_, index) => ({
    id: `entry-${index}`,
    title: `Review ${index}`,
    action: 'summarize_source' as const,
    content: `Review ${index}`,
    date: new Date(2026, 0, index + 1).toISOString(),
  }));
  const result = appendAiReviewHistory(entries, {
    id: 'newest',
    title: 'Newest review',
    action: 'summarize_source',
    content: 'Newest review',
    date: new Date(2026, 2, 1).toISOString(),
  });
  assert.equal(result.length, MAX_AI_REVIEW_HISTORY);
  assert.equal(result[0].id, 'newest');
});

test('bounds nested annotation compatibility caches', () => {
  const entries = Array.from({ length: MAX_NESTED_ANNOTATIONS + 8 }, (_, index) => ({
    id: `annotation-${index}`,
    text: `Annotation ${index}`,
    type: 'thought' as const,
    date: new Date(2026, 0, index + 1).toISOString(),
  }));
  const result = boundedNestedAnnotations(entries);
  assert.equal(result.length, MAX_NESTED_ANNOTATIONS);
  assert.equal(result[0].id, `annotation-${entries.length - 1}`);
});

test('first-class annotation records override matching nested cache records', () => {
  const result = mergeAnnotationRecords(
    [{ id: 'a1', text: 'old', type: 'thought', date: '2026-01-01' }],
    [{ id: 'a1', sourceId: 's1', text: 'current', type: 'thought', date: '2026-01-02' }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'current');
});

test('resolves compatibility labels to stable concept ids without duplicates', () => {
  const concepts = [
    { id: 'c_identity', name: 'Identity' },
    { id: 'c_ethics', name: 'Ethics' },
  ] as any;
  assert.deepEqual(conceptIdsForLabels([' identity ', 'Ethics', 'IDENTITY', 'Missing'], concepts), ['c_identity', 'c_ethics']);
});
