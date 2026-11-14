import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { appendPracticeObservation } from '../../src/lib/practice-observations';

test('practice observations count completed days, not attempts, and never start a schedule', () => {
  const practice = { ...buildDemoWorkspace('test').practices[0], status: 'planned' as const, logs: [], logDates: [] };
  const first = appendPracticeObservation(practice, { id: 'one', date: '2026-11-06', actionCompleted: true, outcome: 'Started the task first.' }, '2026-11-06');
  const second = appendPracticeObservation(first, { id: 'two', date: '2026-11-06', actionCompleted: true }, '2026-11-06');
  const third = appendPracticeObservation(second, { id: 'three', date: '2026-11-07', actionCompleted: false, outcome: 'Noticed a competing obligation.' }, '2026-11-07');
  assert.equal(third.status, 'planned');
  assert.equal(third.startDate, practice.startDate);
  assert.equal(third.logs?.length, 3);
  assert.deepEqual(third.logDates, ['2026-11-06']);
  assert.equal(third.observedOutcome, 'Noticed a competing obligation.');
  assert.equal(appendPracticeObservation(third, { id: 'three', date: '2026-11-07', actionCompleted: false }, '2026-11-07'), third);
});
