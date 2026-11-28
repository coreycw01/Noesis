import assert from 'node:assert/strict';
import test from 'node:test';
import { positionConfidenceTrace, positionHistoryDateMatches, positionRevisionHistory } from '../../src/lib/position-revisions';

test('confidence trace uses chronological readings and their original reasons, without inventing a past reading', () => {
  const base = { confidence: 72, dateCreated: '2026-10-01', dateUpdated: '2026-11-06' };
  assert.deepEqual(positionConfidenceTrace(base), [{ date: base.dateUpdated, value: 72, reason: '' }]);
  const revision = { eventType: 'revised' as const };
  assert.deepEqual(positionConfidenceTrace({ ...base, versionHistory: [
    { ...revision, date: '2026-11-01', confidence: 72, description: 'Changed by the log' },
    { ...revision, date: 'invalid', confidence: 0, description: 'Invalid' },
    { ...revision, date: '2026-10-20', confidence: 78, description: 'Initial reading' },
  ] }), [
    { date: '2026-10-20', value: 78, reason: 'Initial reading' },
    { date: '2026-11-01', value: 72, reason: 'Changed by the log' },
  ]);
});

test('a confidence change records one revision, including callers that supply their own', () => {
  const previous = { confidence: 86, versionHistory: [] };
  const next = { confidence: 72, versionHistory: [] };
  const history = positionRevisionHistory(previous, next, '2026-11-06');
  assert.equal(history.length, 1);
  assert.equal(history[0].confidence, 72);
  assert.equal(positionRevisionHistory(previous, { ...next, versionHistory: history }, '2026-11-06').length, 1);
  assert.equal(positionRevisionHistory(next, next, '2026-11-06').length, 0);
});

test('position history dates use local calendar days with inclusive or open endpoints', () => {
  const day = '2026-11-06';
  const exactDay = { from: day, to: day };
  assert.equal(positionHistoryDateMatches(day, exactDay), true);
  assert.equal(positionHistoryDateMatches(new Date(2026, 10, 6, 23, 59).toISOString(), exactDay), true);
  assert.equal(positionHistoryDateMatches('2026-11-07', exactDay), false);
  assert.equal(positionHistoryDateMatches('invalid', exactDay), false);
  assert.equal(positionHistoryDateMatches(day, { from: day, to: '' }), true);
  assert.equal(positionHistoryDateMatches(day, { from: '', to: '2026-11-05' }), false);
});

test('confidence filtering can find older readings without inserting an out-of-range current reading', () => {
  const entry = {
    confidence: 80,
    dateCreated: '2026-11-01',
    dateUpdated: '2026-11-20',
    versionHistory: Array.from({ length: 15 }, (_, index) => ({
      date: `2026-11-${String(index + 1).padStart(2, '0')}`,
      eventType: 'revised' as const,
      confidence: 55 + index,
      description: '',
    })),
  };
  assert.equal(positionConfidenceTrace(entry).length, 16);
  assert.deepEqual(positionConfidenceTrace(entry, { from: '', to: '2026-11-02' }).map(point => point.value), [55, 56]);
  assert.deepEqual(positionConfidenceTrace(entry, { from: '2026-11-21', to: '' }), []);
});

test('returning to an older confidence records a new change without altering old history', () => {
  const old = { date: '2026-10-01', eventType: 'revised' as const, confidence: 72, description: 'An earlier view' };
  const result = positionRevisionHistory({ confidence: 86, versionHistory: [old] }, { confidence: 72, versionHistory: [old] }, '2026-11-06');
  assert.equal(result.length, 2);
  assert.equal(result[0], old);
});
