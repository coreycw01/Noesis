import assert from 'node:assert/strict';
import test from 'node:test';
import { apiUsageWindows } from '../../src/lib/api-usage-windows';

test('usage retries point to the next actual UTC accounting window', () => {
  assert.deepEqual(apiUsageWindows(new Date('2026-11-14T23:59:59.900Z')), {
    minute: '202611142359', day: '20261114', minuteRetryAfter: 1, dayRetryAfter: 1,
  });
  assert.deepEqual(apiUsageWindows(new Date('2026-11-15T00:00:00.000Z')), {
    minute: '202611150000', day: '20261115', minuteRetryAfter: 60, dayRetryAfter: 86_400,
  });
});
