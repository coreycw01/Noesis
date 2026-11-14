import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceTabIndex } from '../../src/lib/workspace-tab-navigation';

test('tab navigation wraps and supports jumps to either end', () => {
  assert.equal(workspaceTabIndex('ArrowRight', 2, 3), 0);
  assert.equal(workspaceTabIndex('ArrowLeft', 0, 3), 2);
  assert.equal(workspaceTabIndex('Home', 2, 3), 0);
  assert.equal(workspaceTabIndex('End', 0, 3), 2);
});

test('tab navigation leaves activation keys alone and handles absent focus', () => {
  assert.equal(workspaceTabIndex('Enter', 0, 3), null);
  assert.equal(workspaceTabIndex('ArrowLeft', -1, 3), 2);
  assert.equal(workspaceTabIndex('ArrowRight', -1, 3), 0);
  assert.equal(workspaceTabIndex('End', -1, 0), null);
});
