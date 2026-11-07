import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileSettingsDrafts } from '../../src/lib/settings-drafts';

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
