import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateWorkspace } from '../../src/lib/workspace-navigation';

test('workspace navigation lets Next synchronize the URL without private router state', () => {
  const calls: unknown[][] = [];
  navigateWorkspace({ pushState: (...args) => { calls.push(args); } }, '/demo/inquiries/q_test/');
  assert.deepEqual(calls, [[{ noesisPath: '/demo/inquiries/q_test/' }, '', '/demo/inquiries/q_test/']]);
});
