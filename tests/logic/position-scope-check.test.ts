import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildPositionScopeCheck, formatPositionScopeCheck, POSITION_SCOPE_CASE_LIMIT, scopeCheckIsCurrent } from '../../src/lib/position-scope-check';

test('records a case and the user’s judgment without generating grounds or a confidence change', () => {
  const check = buildPositionScopeCheck('  Deliberation improves decisions. ', '  An emergency that needs immediate action  ', 'narrower');
  assert.deepEqual(check, {
    claim: 'Deliberation improves decisions.',
    situation: 'An emergency that needs immediate action',
    verdict: 'narrower',
  });
  assert.ok(check);
  assert.equal(formatPositionScopeCheck(check), 'Needs a narrower claim: An emergency that needs immediate action');
});

test('rejects empty, oversized, or unclassified cases', () => {
  assert.equal(buildPositionScopeCheck('Claim', ' ', 'holds'), null);
  assert.equal(buildPositionScopeCheck(' ', 'A case', 'holds'), null);
  assert.equal(buildPositionScopeCheck('Claim', 'A case', ''), null);
  assert.equal(buildPositionScopeCheck('Claim', 'A case', 'constructor'), null);
  assert.equal(buildPositionScopeCheck('Claim', 'x'.repeat(POSITION_SCOPE_CASE_LIMIT + 1), 'outside'), null);
});

test('a check against older wording is not current after changing the claim', () => {
  const check = buildPositionScopeCheck('Deliberation improves decisions.', 'A planning session', 'holds');
  assert.ok(check);
  assert.equal(scopeCheckIsCurrent(check, ' Deliberation improves decisions. '), true);
  assert.equal(scopeCheckIsCurrent(check, 'Deliberation improves nonurgent decisions.'), false);
});
