import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNoesisRoute, viewToPath } from '../../src/lib/noesis-routes';

test('Labs is the workspace route for practices', () => {
  assert.deepEqual(parseNoesisRoute('/labs'), { view: 'practices' });
  assert.deepEqual(parseNoesisRoute('/demo/labs'), { view: 'practices' });
  assert.equal(viewToPath('practices'), '/labs');
  assert.equal(viewToPath('practices', { reviewMode: true }), '/demo/labs');
});

test('existing practice detail links remain compatible', () => {
  assert.deepEqual(parseNoesisRoute('/practices/practice-1'), {
    view: 'practices',
    focusedPracticeId: 'practice-1',
  });
  assert.equal(viewToPath('practices', { practiceId: 'practice-1' }), '/practices/practice-1');
});
