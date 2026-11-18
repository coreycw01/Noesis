import assert from 'node:assert/strict';
import test from 'node:test';
import { fillQuestion, philosophySurvey, recurringWords } from '../../src/lib/philosophy-process';

test('questions reuse the person’s exact words and add nothing', () => {
  assert.equal(fillQuestion('And what kind of %X% is that %X%?', 'quiet courage'), 'And what kind of quiet courage is that quiet courage?');
  assert.equal(fillQuestion('What are you assuming when you say “%S%”?', 'x', 'Honesty first'), 'What are you assuming when you say “Honesty first”?');
});

test('recurring words are offered only when they appear in more than one answer', () => {
  const threads = recurringWords(['I want honesty with friends', 'Honesty makes trust possible', 'Trust takes time']);
  assert.deepEqual(threads, [['honesty', 2], ['trust', 2]]);
  assert.deepEqual(recurringWords(['honesty honesty honesty']), []);
});

test('the survey quotes recorded wording and skips retired positions', () => {
  const survey = philosophySurvey({
    positions: [
      { id: 'p1', title: 'Honesty', statement: 'Honesty matters more than comfort', status: 'active', confidence: 80, tags: [], versionHistory: [] },
      { id: 'p2', title: 'Old view', statement: 'Old', status: 'abandoned', confidence: 90, tags: [] },
    ] as never,
    concepts: [], inquiries: [], practices: [], links: [],
  });
  assert.equal(survey.length, 1);
  assert.equal(survey[0].words, 'Honesty matters more than comfort');
  assert.ok(survey[0].facts.includes('you hold it at 80%'));
});
