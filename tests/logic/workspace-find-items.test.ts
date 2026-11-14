import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { pathForNoesisRouteTarget } from '../../src/lib/noesis-routes';
import { workspaceFindItems } from '../../src/lib/workspace-find-items';
import { findMatchRank } from '../../src/lib/workspace-find-rank';
import { mergeSourceAnnotationRecords } from '../../src/lib/collection-integrity';

test('Find indexes records beyond the previous per-collection caps', () => {
  const base = buildDemoWorkspace('find-test');
  const concepts = Array.from({ length: 32 }, (_, index) => ({
    ...base.concepts[0], id: `concept-${index}`, name: `Search marker ${index}`,
  }));
  const results = workspaceFindItems({ ...base, concepts });
  assert.ok(results.some((item) => item.targetId === 'concept-31' && item.label === 'Search marker 31'));
  assert.equal(results.filter((item) => item.targetType === 'annotation').length,
    base.media.flatMap((source) => source.annotations).length);
});

test('exact and partial titles rank above mentions, and absent terms do not match', () => {
  assert.ok(findMatchRank('identity', 'Identity', '') > findMatchRank('identity', 'Identity and habit', ''));
  assert.ok(findMatchRank('identity', 'Narrative identity', '') > findMatchRank('identity', 'Habit', 'Uses identity'));
  assert.equal(findMatchRank('identity', 'Habit', 'Repetition'), 0);
});

test('Find uses the current first-class annotation rather than a stale nested copy', () => {
  const base = buildDemoWorkspace('find-test');
  const source = base.media.find((item) => item.annotations.length)!;
  const annotation = source.annotations[0];
  const media = mergeSourceAnnotationRecords([source], [{
    ...annotation, sourceId: source.id, text: 'Edited first-class annotation', userId: 'find-test',
  }]);
  assert.equal(media[0].annotations.filter((item) => item.id === annotation.id).length, 1);
  assert.equal(media[0].annotations.find((item) => item.id === annotation.id)?.text, 'Edited first-class annotation');
});

test('Find distinguishes annotations with the same ID by source and builds their detail links', () => {
  const base = buildDemoWorkspace('find-test');
  const annotation = { ...base.media.flatMap((source) => source.annotations)[0], id: 'shared-id' };
  const media = base.media.slice(0, 2).map((source) => ({ ...source, annotations: [annotation] }));
  const items = workspaceFindItems({ ...base, media, links: base.links, unknowns: base.unknowns });
  const results = items.filter((item) => item.targetType === 'annotation' && item.targetId === annotation.id);
  assert.equal(results.length, 2);
  assert.notEqual(results[0].id, results[1].id);
  assert.deepEqual(results.map((item) => pathForNoesisRouteTarget({
    type: 'annotation', view: 'annotations', id: item.targetId!, annotationSourceId: item.annotationSourceId,
  }, { reviewMode: true })), media.map((source) => `/demo/annotations/${source.id}/shared-id`));
});

test('the raw annotation action counts both source records and opens the inbox', () => {
  const base = buildDemoWorkspace('find-attention');
  const annotation = { ...base.media.flatMap((source) => source.annotations)[0], id: 'shared-id', philosophyStatus: 'raw' as const, createdInquiryId: undefined, createdPositionId: undefined };
  const media = base.media.slice(0, 2).map((source) => ({ ...source, annotations: [annotation] }));
  const action = workspaceFindItems({ ...base, media }).find((item) => item.id === 'next-process-annotations');
  assert.equal(action?.label, 'Process 2 unprocessed annotations');
  assert.equal(action?.view, 'annotations');
  assert.equal(action?.kind, 'navigation');
  assert.equal(action?.targetId, null);
});
