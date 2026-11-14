import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDemoChanges, applyDemoOverrides, demoExportCollection } from '../../src/lib/demo-session';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { buildWorkspaceExport } from '../../src/lib/workspace-export';

test('workspace JSON contains saved settings, links, and first-class history without relying on loaded views', async () => {
  const uid = 'demo-export';
  const base = buildDemoWorkspace(uid);
  const workspace = applyDemoOverrides(base, applyDemoChanges(base, {}, uid, [
    { path: `users/${uid}/settings/ai`, operation: 'set', data: { aiAssistanceEnabled: false } },
    { path: `users/${uid}/settings/goal`, operation: 'set', merge: true, data: { label: 'My saved goals' } },
    { path: `users/${uid}/workRevisions/rev-1`, operation: 'create', data: { workId: base.drafts[0].id, body: 'A saved revision' } },
    { path: `users/${uid}/practiceLogs/log-1`, operation: 'create', data: { practiceId: base.practices[0].id } },
    { path: `users/${uid}/positionVersions/ver-1`, operation: 'create', data: { positionId: base.vault[0].id } },
  ]));
  const result = await buildWorkspaceExport(uid, async (name) => demoExportCollection(workspace, name), async () => null);
  assert.equal(result.version, 1);
  assert.equal(result.includesUploadedFiles, false);
  assert.equal(result.settings.ai.aiAssistanceEnabled, false);
  assert.equal(result.settings.goal.label, 'My saved goals');
  assert.equal(result.profile.main.displayName, base.profile.displayName);
  assert.equal(result.collections.workRevisions[0].body, 'A saved revision');
  assert.equal(result.collections.practiceLogs[0].id, 'log-1');
  assert.equal(result.collections.positionVersions[0].id, 'ver-1');
  assert.equal(result.collections.links.length, base.links.length);
  assert.equal(result.collections.thinkingMetrics[0].id, 'summary');
});

test('a failed collection read stops export rather than returning a partial file', async () => {
  await assert.rejects(buildWorkspaceExport('owner', async (name) => {
    if (name === 'workRevisions') throw new Error('Unavailable');
    return [];
  }, async () => null), /Unavailable/);
});
