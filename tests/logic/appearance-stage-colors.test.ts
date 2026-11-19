import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToHslTriplet } from '../../src/lib/appearance';

test('a chosen page colour becomes the theme token format', () => {
  assert.equal(hexToHslTriplet('#ff0000'), '0 100% 50%');
  assert.equal(hexToHslTriplet('3b6e72'), '184 32% 34%');
  assert.equal(hexToHslTriplet('#ffffff'), '0 0% 100%');
  assert.equal(hexToHslTriplet('not a colour'), null);
});

test('saving page colours writes every stage, so a reset clears the saved colour', async () => {
  const { appearanceSettingsWrites } = await import('../../src/lib/appearance');
  const writes = appearanceSettingsWrites({ stageColors: { claim: '#ff0000' } }, '2026-11-19');
  assert.equal((writes.appearance.stageColors as Record<string, string>).claim, '#ff0000');
  assert.equal((writes.appearance.stageColors as Record<string, string>).encounter, '');
  assert.equal(Object.keys(writes.appearance.stageColors as object).length, 7);
});
