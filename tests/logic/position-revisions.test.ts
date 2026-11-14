import assert from 'node:assert/strict';
import test from 'node:test';
import { positionRevisionHistory } from '../../src/lib/position-revisions';

test('a confidence change records one revision, including callers that supply their own', () => {
  const previous = { confidence: 86, versionHistory: [] };
  const next = { confidence: 72, versionHistory: [] };
  const history = positionRevisionHistory(previous, next, '2026-11-06');
  assert.equal(history.length, 1);
  assert.equal(history[0].confidence, 72);
  assert.equal(positionRevisionHistory(previous, { ...next, versionHistory: history }, '2026-11-06').length, 1);
  assert.equal(positionRevisionHistory(next, next, '2026-11-06').length, 0);
});

test('returning to an older confidence records a new change without altering old history', () => {
  const old = { date: '2026-10-01', eventType: 'revised' as const, confidence: 72, description: 'An earlier view' };
  const result = positionRevisionHistory({ confidence: 86, versionHistory: [old] }, { confidence: 72, versionHistory: [old] }, '2026-11-06');
  assert.equal(result.length, 2);
  assert.equal(result[0], old);
});
