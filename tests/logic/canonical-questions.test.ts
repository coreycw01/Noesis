import assert from 'node:assert/strict';
import test from 'node:test';
import { allQuestions } from '../../src/lib/readex';
import type { Media, Question } from '../../src/lib/types';

const date = '2026-01-01T00:00:00.000Z';

function question(overrides: Partial<Question> = {}): Question {
  return { id: 'q1', text: 'What should change?', status: 'open', evidenceIds: [], conceptIds: [], dateCreated: date, ...overrides };
}

function source(annotation: Record<string, unknown>): Media {
  return {
    id: 's1', title: 'Source', creator: 'Author', type: 'book', status: 'to_read', tags: [], dateAdded: date,
    annotations: [{ id: 'a1', text: 'What should change?', type: 'question', date, ...annotation } as any],
  } as unknown as Media;
}

test('a promoted annotation is not projected as a duplicate inquiry', () => {
  const persisted = question({ id: 'q-promoted', type: 'annotation', sourceAnnotationId: 'a1' });
  const result = allQuestions([source({ createdInquiryId: 'q-promoted' })], [persisted]);
  assert.deepEqual(result.map((item) => item.id), ['q-promoted']);
});

test('matching real user inquiry titles remain distinct records', () => {
  const result = allQuestions([], [question({ id: 'q1' }), question({ id: 'q2' })]);
  assert.equal(result.length, 2);
});
