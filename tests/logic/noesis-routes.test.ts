import assert from 'node:assert/strict';
import test from 'node:test';
import { NOESIS_ICONS, NOESIS_VIEW_ICON_KEYS } from '../../src/lib/noesis-icons';
import { dataRequirementsForNoesisRoute, metadataForNoesisRouteState, NOESIS_PAGE_BY_VIEW, NOESIS_PAGE_DEFINITIONS, pageNeedsData } from '../../src/lib/noesis-page-definitions';

test('Today loads its saved commitment visibility without visiting Settings first', () => {
  assert.ok(dataRequirementsForNoesisRoute(parseNoesisRoute('/home')).includes('goalPreferences'));
  assert.ok(!dataRequirementsForNoesisRoute(parseNoesisRoute('/library')).includes('goalPreferences'));
});
import { getNoesisRouteTarget, parseNoesisRoute, pathForNoesisRouteTarget, viewToPath } from '../../src/lib/noesis-routes';

test('commitment detail links round-trip in signed-in and demo workspaces', () => {
  for (const reviewMode of [false, true]) {
    const path = viewToPath('goals', { goalId: 'focus / study', reviewMode });
    assert.equal(path, `${reviewMode ? '/demo' : ''}/goals/focus%20%2F%20study`);
    assert.deepEqual(parseNoesisRoute(path), { view: 'goals', focusedGoalId: 'focus / study' });
    assert.ok(dataRequirementsForNoesisRoute(parseNoesisRoute(path)).includes('goal'));
  }
  assert.deepEqual(parseNoesisRoute('/goals'), { view: 'goals' });
});

test('Praxis keeps the Labs route compatible for existing practice links', () => {
  assert.deepEqual(parseNoesisRoute('/labs'), { view: 'labs', focusedPracticeId: null });
  assert.deepEqual(parseNoesisRoute('/demo/labs'), { view: 'labs', focusedPracticeId: null });
  assert.equal(viewToPath('labs'), '/labs');
  assert.equal(viewToPath('labs', { reviewMode: true }), '/demo/labs');
});

test('Praxis is the approved user-facing stage for lived action', () => {
  assert.equal(NOESIS_PAGE_BY_VIEW.labs.section, 'Praxis');
  assert.equal(NOESIS_PAGE_BY_VIEW.goals.section, 'Praxis');
  assert.equal(NOESIS_PAGE_DEFINITIONS.some((page) => (page.section as string) === 'Test'), false);
});

test('Context Desk keeps its own lightweight route identity', () => {
  assert.deepEqual(parseNoesisRoute('/context-desk'), { view: 'context-desk' });
  assert.deepEqual(parseNoesisRoute('/demo/context-desk'), { view: 'context-desk' });
  assert.equal(viewToPath('context-desk'), '/context-desk');
  assert.equal(viewToPath('context-desk', { reviewMode: true }), '/demo/context-desk');
});

test('existing practice detail links remain compatible', () => {
  assert.deepEqual(parseNoesisRoute('/practices/practice-1'), {
    view: 'labs',
    focusedPracticeId: 'practice-1',
  });
  assert.equal(viewToPath('labs', { practiceId: 'practice-1' }), '/labs/practice-1');
  assert.deepEqual(parseNoesisRoute('/labs/practice-1'), {
    view: 'labs',
    focusedPracticeId: 'practice-1',
  });
});

test('Praxis, experiments, and individual practices use distinct visual semantics', () => {
  assert.equal(NOESIS_VIEW_ICON_KEYS.labs, 'praxis');
  assert.notEqual(NOESIS_ICONS.praxis, NOESIS_ICONS.lab);
  assert.notEqual(NOESIS_ICONS.praxis, NOESIS_ICONS.practice);
  assert.notEqual(NOESIS_ICONS.lab, NOESIS_ICONS.practice);
});

test('Concepts and Context Desk use distinct, stable visual semantics', () => {
  assert.equal(NOESIS_VIEW_ICON_KEYS.concepts, 'concept');
  assert.equal(NOESIS_VIEW_ICON_KEYS['context-desk'], 'context');
  assert.notEqual(NOESIS_ICONS.concept, NOESIS_ICONS.context);
});

test('Context Desk excludes full Evolution history from its route payload', () => {
  assert.equal(pageNeedsData('context-desk', 'timeline'), false);
  assert.equal(pageNeedsData('context-desk', 'thinkingEvents'), false);
  assert.equal(pageNeedsData('context-desk', 'media'), true);
  assert.equal(pageNeedsData('context-desk', 'aiSettings'), true);
});

test('Source Index owns the sources route', () => {
  assert.deepEqual(parseNoesisRoute('/sources'), { view: 'source-index' });
  assert.deepEqual(parseNoesisRoute('/demo/sources'), { view: 'source-index' });
  assert.equal(viewToPath('source-index'), '/sources');
  assert.equal(viewToPath('source-index', { reviewMode: true }), '/demo/sources');
});

test('direct routes request the records they actually consume', () => {
  assert.equal(pageNeedsData('goals', 'concepts'), true);
  assert.equal(pageNeedsData('writing', 'worksSettings'), true);
  assert.ok(dataRequirementsForNoesisRoute(parseNoesisRoute('/works/essay')).includes('worksSettings'));
  assert.equal(pageNeedsData('evolution', 'thinkingMetrics'), false);
  assert.equal(pageNeedsData('profile', 'thinkingMetrics'), true);
});

test('annotations use URL-backed detail pages with source context', () => {
  assert.deepEqual(parseNoesisRoute('/annotations/source-1/note-2'), {
    view: 'annotations',
    focusedAnnotationSourceId: 'source-1',
    focusedAnnotationId: 'note-2',
  });
  assert.deepEqual(parseNoesisRoute('/demo/annotations/source-1/note-2'), {
    view: 'annotations',
    focusedAnnotationSourceId: 'source-1',
    focusedAnnotationId: 'note-2',
  });
  assert.equal(
    viewToPath('annotations', { annotationSourceId: 'source 1', annotationId: 'note/2' }),
    '/annotations/source%201/note%2F2'
  );
  assert.equal(viewToPath('annotations'), '/annotations');
});

test('encoded annotations retain both ids through routing without exposing them in metadata', () => {
  const path = viewToPath('annotations', { reviewMode: true, annotationSourceId: 'source 1', annotationId: 'note/%2F' });
  const state = parseNoesisRoute(path);
  const target = getNoesisRouteTarget(state);
  assert.deepEqual(target, { type: 'annotation', view: 'annotations', annotationSourceId: 'source 1', id: 'note/%2F' });
  assert.ok(target);
  assert.equal(pathForNoesisRouteTarget(target, { reviewMode: true }), path);
  assert.ok(dataRequirementsForNoesisRoute(state).includes('media'));
  assert.doesNotMatch(String(metadataForNoesisRouteState(state).description), /source 1|note\//);
  assert.equal(getNoesisRouteTarget(parseNoesisRoute('/annotations/source-only')), null);
});

test('record paths safely round-trip reserved characters and malformed links do not throw', () => {
  const workId = 'work 100% #2?';
  assert.equal(parseNoesisRoute(viewToPath('writing', { workId })).focusedWorkId, workId);
  assert.equal(parseNoesisRoute('/works/bad%id').focusedWorkId, 'bad%id');
});
