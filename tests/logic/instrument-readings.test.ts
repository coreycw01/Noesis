import assert from 'node:assert/strict';
import test from 'node:test';
import { experimentReadings, inquirySounding, practiceRhythm } from '../../src/lib/instrument-readings';
import type { Question } from '../../src/lib/types';

test('a saved answer does not imply the inquiry weighed evidence or compared candidates', () => {
  const question = { answer: 'A tentative answer.' } as Question;
  assert.deepEqual(inquirySounding(question).map(mark => mark.recorded), [false, false, false, true]);
});

test('only non-contextual evidence placed on an existing answer registers as weighed', () => {
  const question = {
    whyItMatters: 'It changes what I do.',
    candidateAnswers: [{ id: 'a', statement: 'Possibility' }],
    evidenceRecords: [{ claim: 'Context', candidateId: 'a', direction: 'contextualizes' }, { claim: 'Old link', candidateId: 'deleted', direction: 'supports' }],
  } as Question;
  assert.deepEqual(inquirySounding(question).map(mark => mark.recorded), [true, true, false, false]);
  question.evidenceRecords![0].direction = 'challenges';
  assert.equal(inquirySounding(question)[2].recorded, true);
});

test('the rhythm rail separates missed, unlogged, and upcoming days', () => {
  const rail = practiceRhythm({
    startDate: '2026-11-20',
    logDates: ['2026-11-20', '2026-11-22', '2026-11-26'],
    logs: [{ id: 'a', date: '2026-11-22', actionCompleted: false, observations: 'I ran out of time.' }],
  }, '2026-11-24');
  assert.equal(rail.weekCount, 1);
  assert.equal(rail.keptDays, 1);
  assert.deepEqual(rail.week(0).map(day => day.state), ['kept', 'unlogged', 'missed', 'unlogged', 'unlogged', 'upcoming', 'upcoming']);
  assert.equal(rail.week(0)[2].note, 'I ran out of time.');
  assert.equal(practiceRhythm({ startDate: '2026-11-01' }, '2026-11-24').weekCount, 4);
});

test('the test bench does not mistake attendance for an observation', () => {
  const records = experimentReadings({
    logs: [
      { id: 'check-in', date: '2026-11-20', actionCompleted: true, outcome: 'Kept' },
      { id: 'result', date: '2026-11-23', actionCompleted: true, observations: 'Less distracted', outcome: 'Less distracted' },
      { id: 'unexpected', date: '2026-11-22', actionCompleted: false, unexpectedResult: 'No change on walks' },
      { id: 'future', date: '2026-11-30', actionCompleted: true, observations: 'Future entry' },
    ],
    conclusion: { whatHappened: 'Less distracted at work only' },
  }, '2026-11-24');
  assert.deepEqual(records.map(record => record.id), ['log-unexpected', 'log-result', 'result']);
  assert.equal(records[1].text, 'Less distracted');
});

test('the practice path moves only for kept steps and does not invent an open-ended target', () => {
  const practice = {
    startDate: '2026-11-20', endDate: '2026-11-24', durationDays: 5,
    logDates: ['2026-11-19', '2026-11-20', '2026-11-20', '2026-11-22', '2026-11-25', '2026-11-28'],
    logs: [{ id: 'a', date: '2026-11-22', actionCompleted: false }],
  };
  const path = practiceRhythm(practice, '2026-11-27');
  assert.equal(path.targetSteps, 5);
  assert.equal(path.keptSteps, 1);
  assert.equal(practiceRhythm({ ...practice, durationMode: 'open_ended' }, '2026-11-27').targetSteps, null);
  assert.equal(practiceRhythm({ ...practice, durationMode: 'one_time' }, '2026-11-27').targetSteps, 1);
});
