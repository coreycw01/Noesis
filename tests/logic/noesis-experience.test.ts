import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_EXPERIENCE, isInitialSignIn, readExperience } from '../../src/lib/noesis-experience';

test('stored experience keeps the four dimensions independent', () => {
  const stored = { ...DEFAULT_EXPERIENCE, onboardingCompleted: true, primaryPurpose: 'organize', guidance: 'independent', activationSensitivity: 'early', challengeStyle: 'dialectical' } as const;
  const result = readExperience(stored);
  assert.deepEqual(result, { ...stored, purposes: ['organize', 'develop_philosophy'] });
  assert.equal(readExperience({ ...result, guidance: 'active' }).activationSensitivity, 'early');
});

test('missing settings do not claim onboarding is complete', () => {
  assert.deepEqual(readExperience(null), DEFAULT_EXPERIENCE);
  assert.equal(readExperience(null).onboardingCompleted, false);
});

test('returning accounts and missing auth metadata do not trigger automatic setup', () => {
  const creation = '2026-11-19T14:00:00Z';
  const now = Date.parse('2026-11-19T14:01:00Z');
  assert.equal(isInitialSignIn(creation, creation, now), true);
  assert.equal(isInitialSignIn(creation, creation, now + 86_400_000), false);
  assert.equal(isInitialSignIn(creation, new Date(now).toISOString(), now), false);
  assert.equal(isInitialSignIn(undefined, undefined, now), false);
});
