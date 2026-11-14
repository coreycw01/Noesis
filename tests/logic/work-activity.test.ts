import assert from 'node:assert/strict';
import test from 'node:test';
import { compareLatestWorkTimestamp, workTimestamp } from '../../src/lib/work-activity';

test('newest work activity sorts first and missing or invalid activity sorts last', () => {
  const values = ['', '2025-06-01', 'unknown', '2026-06-01', '1970-01-01'];
  assert.deepEqual(values.sort(compareLatestWorkTimestamp), ['2026-06-01', '2025-06-01', '1970-01-01', '', 'unknown']);
  assert.equal(workTimestamp(undefined), null);
  assert.equal(workTimestamp('1970-01-01'), 0);
});
