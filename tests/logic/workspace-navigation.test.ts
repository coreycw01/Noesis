import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateWorkspace, workspaceRouteScrollTop } from '../../src/lib/workspace-navigation';

test('workspace navigation lets Next synchronize the URL without private router state', () => {
  const calls: unknown[][] = [];
  navigateWorkspace({ pushState: (...args) => { calls.push(args); } }, '/demo/inquiries/q_test/');
  assert.deepEqual(calls, [[{ noesisPath: '/demo/inquiries/q_test/' }, '', '/demo/inquiries/q_test/']]);
});

test('fresh pages and records start at the top; same-route changes preserve context', () => {
  const positions = new Map([['/demo/inquiries', 430]]);
  assert.equal(workspaceRouteScrollTop('/demo/inquiries', '/demo/inquiries/q_one', positions), 0);
  assert.equal(workspaceRouteScrollTop('/demo/inquiries/q_one', '/demo/inquiries/q_two', positions), 0);
  assert.equal(workspaceRouteScrollTop('/demo/inquiries/q_one', '/demo/inquiries/q_one/', positions), null);
  assert.equal(workspaceRouteScrollTop('/demo/inquiries/q_one', '/demo/library', positions), 0);
});

test('returning to the parent list restores its own position without crossing workspace scopes', () => {
  const positions = new Map([['/demo/inquiries', 430], ['/review/inquiries', 200], ['/demo/annotations', 75]]);
  assert.equal(workspaceRouteScrollTop('/demo/inquiries/q_one/', '/demo/inquiries/', positions), 430);
  assert.equal(workspaceRouteScrollTop('/review/inquiries/q_one/', '/review/inquiries/', positions), 200);
  assert.equal(workspaceRouteScrollTop('/review/inquiries/q_one/', '/demo/inquiries/', positions), 0);
  assert.equal(workspaceRouteScrollTop('/demo/annotations/s_one/a_one/', '/demo/annotations/', positions), 75);
});
