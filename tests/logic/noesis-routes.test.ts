import assert from 'node:assert/strict';
import test from 'node:test';
import { NOESIS_ICONS, NOESIS_VIEW_ICON_KEYS } from '../../src/lib/noesis-icons';
import { pageNeedsData } from '../../src/lib/noesis-page-definitions';
import { parseNoesisRoute, viewToPath } from '../../src/lib/noesis-routes';

test('Labs is the workspace route for practices', () => {
  assert.deepEqual(parseNoesisRoute('/labs'), { view: 'practices' });
  assert.deepEqual(parseNoesisRoute('/demo/labs'), { view: 'practices' });
  assert.equal(viewToPath('practices'), '/labs');
  assert.equal(viewToPath('practices', { reviewMode: true }), '/demo/labs');
});

test('Context Desk keeps its own lightweight route identity', () => {
  assert.deepEqual(parseNoesisRoute('/context-desk'), { view: 'context-desk' });
  assert.deepEqual(parseNoesisRoute('/demo/context-desk'), { view: 'context-desk' });
  assert.equal(viewToPath('context-desk'), '/context-desk');
  assert.equal(viewToPath('context-desk', { reviewMode: true }), '/demo/context-desk');
});

test('existing practice detail links remain compatible', () => {
  assert.deepEqual(parseNoesisRoute('/practices/practice-1'), {
    view: 'practices',
    focusedPracticeId: 'practice-1',
  });
  assert.equal(viewToPath('practices', { practiceId: 'practice-1' }), '/practices/practice-1');
});

test('Labs and individual practices use distinct visual semantics', () => {
  assert.equal(NOESIS_VIEW_ICON_KEYS.practices, 'lab');
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
