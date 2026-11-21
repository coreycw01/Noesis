import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_AI_REVIEW_HISTORY,
  MAX_NESTED_ANNOTATIONS,
  appendAiReviewHistory,
  boundedNestedAnnotations,
  annotationRecord,
  annotationPromotionUpdates,
  conceptIdsForLabels,
  inquiryAnnotationUpdates,
  mergeAnnotationRecords,
  tagConceptId,
} from '../../src/lib/collection-integrity';
import { ensureConceptTerms } from '../../src/lib/readex';
import { promotedAnnotationOrigins } from '../../src/lib/ai-provenance';
import type { Annotation } from '../../src/lib/types';

test('inquiry promotion validates source ownership of selections and preserves existing backlinks', () => {
  const note = (id: string, createdInquiryId?: string) => ({ id, text: id, date: '2026-11-13', createdInquiryId }) as Annotation;
  const sources = [{ id: 'source', annotations: [note('one'), note('two', 'existing'), note('untouched')] }];
  const references = ['one', 'two', 'one'].map((annotationId) => ({ sourceId: 'source', annotationId }));
  const [update] = inquiryAnnotationUpdates(sources, references, 'new-inquiry');
  assert.deepEqual(update.updated.map(({ id, philosophyStatus, createdInquiryId }) => [id, philosophyStatus, createdInquiryId]), [
    ['one', 'questioned', 'new-inquiry'],
    ['two', 'questioned', 'existing'],
  ]);
  assert.equal(update.annotations.find(({ id }) => id === 'untouched')?.philosophyStatus, undefined);
  assert.throws(() => inquiryAnnotationUpdates(sources, [{ sourceId: 'wrong-source', annotationId: 'one' }], 'new-inquiry'), /no longer available/);
  assert.throws(() => inquiryAnnotationUpdates(sources, [...references, { sourceId: 'source', annotationId: 'missing' }], 'new-inquiry'), /no longer available/);
});

test('moving a mark preserves its original excerpt and records the exact destination in the source update', () => {
  const annotation: Annotation = { id: 'ann', type: 'thought', text: 'A passage from the source.', date: '2026-11-20', marks: [
    { id: 'q', kind: 'question', start: 0, end: 9, text: 'A passage', date: '2026-11-20' },
    { id: 'p', kind: 'claim', start: 15, end: 25, text: 'the source', date: '2026-11-20' },
    { id: 'x', kind: 'action', start: 2, end: 9, text: 'passage', date: '2026-11-20' },
  ] };
  const source = { id: 'source', annotations: [annotation], dateUpdated: '2026-11-20' };
  const transfer = { sourceId: source.id, annotationId: annotation.id, markId: 'q', text: 'What does this passage mean?' };
  const [update] = inquiryAnnotationUpdates([source], [], 'new-inquiry', transfer);
  assert.equal(update.sourceVersion, source.dateUpdated);
  assert.equal(update.updated[0].text, annotation.text);
  assert.deepEqual(update.updated[0].marks?.[0], { ...annotation.marks?.[0], movedTo: 'inquiry', movedId: 'new-inquiry', movedText: transfer.text });
  const [position] = annotationPromotionUpdates([source], [], 'position', 'new-position', { ...transfer, markId: 'p' });
  assert.equal(position.updated[0].marks?.[1].movedId, 'new-position');
  assert.deepEqual(position.updated[0].linkedPositionIds, ['new-position']);
  const [practice] = annotationPromotionUpdates([source], [], 'practice', 'new-practice', { ...transfer, markId: 'x' });
  assert.equal(practice.updated[0].marks?.[2].movedId, 'new-practice');
  assert.throws(() => inquiryAnnotationUpdates([{ ...source, annotations: update.updated }], [], 'duplicate', transfer), /already sent/);
  assert.throws(() => annotationPromotionUpdates([source], [], 'position', 'wrong', transfer), /changed/);
});

test('promotion carries only the original reviewed text references of the selected source annotations', () => {
  const provenance = { kind: 'ai-assisted' as const, provenanceId: 'ai-review-source' };
  const reviewed: Annotation = { id: 'reviewed', text: 'Approved claim', type: 'claim', date: '2026-11-13', textProvenance: provenance };
  const manual: Annotation = { id: 'manual', text: 'My note', type: 'thought', date: '2026-11-13' };
  const media = [{ id: 'source', annotations: [reviewed, manual, { ...reviewed, id: 'unselected' }] }];
  const selection = [
    { sourceId: 'wrong-source', annotationId: 'reviewed' },
    { sourceId: 'source', annotationId: 'manual' },
    { sourceId: 'source', annotationId: 'reviewed' },
    { sourceId: 'source', annotationId: 'reviewed' },
  ];
  assert.deepEqual(promotedAnnotationOrigins(media, selection), [{ annotationId: 'reviewed', provenance }]);
  assert.deepEqual(promotedAnnotationOrigins(media, selection.slice(0, 2)), []);
});

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

test('annotation reminders survive both saved representations without changing the passage or status', () => {
  const note: Annotation = {
    id: 'a1', type: 'highlight', text: 'The original passage.', date: '2026-11-21',
    philosophyStatus: 'raw', savedReason: 'I wanted to test this in practice.',
  };
  const [merged] = mergeAnnotationRecords(boundedNestedAnnotations([note]), [annotationRecord('source', note)]);
  assert.equal(merged.savedReason, note.savedReason);
  assert.equal(merged.text, note.text);
  assert.equal(merged.philosophyStatus, 'raw');
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

test('equivalent tags share one placeholder and resolve to an explicit concept first', () => {
  assert.equal(tagConceptId('  SELF-Rule '), tagConceptId('Self rule'));
  assert.equal(tagConceptId('Cafe\u0301'), tagConceptId('Caf\u00e9'));
  assert.notEqual(tagConceptId('self/rule'), tagConceptId('self rule'));
  assert.ok(!tagConceptId('self/rule')?.includes('/'));
  assert.equal(tagConceptId('x'.repeat(1500)), null);
  assert.equal(ensureConceptTerms([], ['SELF RULE', 'Self-rule', 'self   rule']).length, 1);
  const concepts = [
    { id: 'existing', name: 'Self Rule', createdFrom: 'manual' },
    { id: 'placeholder', name: 'SELF RULE', createdFrom: 'tag' },
  ] as Parameters<typeof ensureConceptTerms>[0];
  assert.deepEqual(ensureConceptTerms(concepts, ['self-rule']), []);
  assert.deepEqual(conceptIdsForLabels(['Self-rule'], concepts), ['existing']);
});
