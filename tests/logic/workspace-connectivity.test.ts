import assert from 'node:assert/strict';
import test from 'node:test';
import { reportSlowAcknowledgement, requireWorkspaceConnection, WorkspaceOfflineError } from '../../src/lib/workspace-connectivity';

test('known offline state rejects before a cloud save is queued', () => {
  assert.throws(() => requireWorkspaceConnection(false), WorkspaceOfflineError);
  assert.doesNotThrow(() => requireWorkspaceConnection(true));
});

test('slow saves can be reported without completing or aborting them', async () => {
  await new Promise<void>((resolve) => reportSlowAcknowledgement(resolve, 0));
  let notified = false;
  const stop = reportSlowAcknowledgement(() => { notified = true; }, 0);
  stop();
  await new Promise<void>((resolve) => setTimeout(resolve, 5));
  assert.equal(notified, false);
});
