import assert from 'node:assert/strict';
import test from 'node:test';
import { changedSettingsFields, metacognitionFeatureFlagPatch, reconcileSettingsDrafts, resolveAiSettings, workDefaultPreferencePatch } from '../../src/lib/settings-drafts';
import { DEFAULT_AI_SETTINGS } from '../../src/lib/firestore-schema';

test('AI settings respect an explicit opt-out in the demo and require opt-in for real accounts', () => {
  assert.equal(resolveAiSettings(DEFAULT_AI_SETTINGS, null, true).aiAssistanceEnabled, true);
  assert.equal(resolveAiSettings(DEFAULT_AI_SETTINGS, { aiAssistanceEnabled: false }, true).aiAssistanceEnabled, false);
  assert.equal(resolveAiSettings(DEFAULT_AI_SETTINGS, null, false).aiAssistanceEnabled, false);
  assert.equal(resolveAiSettings(DEFAULT_AI_SETTINGS, { aiAssistanceEnabled: true }, false).aiAssistanceEnabled, true);
});

const previous = { appearance: { theme: 'dark' }, ai: { enabled: true }, works: { paper: 'plain' } };

test('saving one settings section does not erase drafts in another section', () => {
  const draft = { ...previous, appearance: { theme: 'light' } };
  const saved = { ...previous, ai: { enabled: false } };
  const merged = reconcileSettingsDrafts(draft, previous, saved);
  assert.equal(merged.appearance.theme, 'light');
  assert.equal(merged.ai.enabled, false);
  assert.equal(previous.appearance.theme, 'dark');
});

test('untouched settings accept incoming saved values without unnecessary state replacement', () => {
  assert.equal(reconcileSettingsDrafts(previous, previous, previous), previous);
  const saved = { ...previous, works: { paper: 'ruled' } };
  assert.equal(reconcileSettingsDrafts(previous, previous, saved).works.paper, 'ruled');
});

test('a newer edit made while a save is pending survives the save response', () => {
  const draft = { ...previous, appearance: { theme: 'system' } };
  const saved = { ...previous, appearance: { theme: 'light' } };
  assert.equal(reconcileSettingsDrafts(draft, previous, saved).appearance.theme, 'system');
});

test('an unsaved appearance edit preserves an independent change from another tab', () => {
  const baseline = { appearance: { font: 'editorial', contrast: false, dateUpdated: 'before' } };
  const draft = { appearance: { ...baseline.appearance, font: 'modern' } };
  const incoming = { appearance: { ...baseline.appearance, contrast: true, dateUpdated: 'after' } };
  const merged = reconcileSettingsDrafts(draft, baseline, incoming);
  assert.deepEqual(merged.appearance, { font: 'modern', contrast: true, dateUpdated: 'after' });
  assert.deepEqual(changedSettingsFields(merged.appearance, incoming.appearance), { font: 'modern' });
});

test('partial work and metacognition settings only mirror changed fields', () => {
  assert.deepEqual(workDefaultPreferencePatch({ defaultEditorMode: 'focused' }), { editorFeel: 'focused' });
  assert.deepEqual(workDefaultPreferencePatch({}), {});
  assert.deepEqual(metacognitionFeatureFlagPatch({ enableUnknownsTracking: false }), { unknownsEnabled: false });
  assert.deepEqual(metacognitionFeatureFlagPatch({}), {});
});

test('returning to settings keeps draft fields and adopts other saved changes', () => {
  const baseline = { appearance: { contrast: false, motion: false }, ai: { enabled: true } };
  const draft = { ...baseline, appearance: { ...baseline.appearance, contrast: true } };
  const saved = { appearance: { contrast: false, motion: true }, ai: { enabled: false } };
  const reopened = reconcileSettingsDrafts(draft, baseline, saved);
  assert.deepEqual(reopened, { appearance: { contrast: true, motion: true }, ai: { enabled: false } });
  assert.deepEqual(changedSettingsFields(reopened.appearance, saved.appearance), { contrast: true });
});
