import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceBibtex } from '../../src/lib/source-bibtex';
import type { Media } from '../../src/lib/types';

function source(fields: Partial<Media>): Media {
  return { id: 's', title: 'Book', type: 'book', creator: 'Jane Smith', year: '2020', ...fields } as Media;
}

test('bibliography keys stay unique for the same creator and year', () => {
  const output = sourceBibtex([source({}), source({ title: 'Another book' }), source({ creator: 'Jane SMITH', type: 'paper' })]);
  assert.deepEqual([...output.matchAll(/@(\w+)\{([^,]+)/g)].map((match) => match.slice(1)), [
    ['book', 'Smith2020'], ['book', 'Smith2020-2'], ['article', 'SMITH2020-3'],
  ]);
});

test('bibliography prefers the creator list and handles BCE records', () => {
  const output = sourceBibtex([source({ title: 'Inquiry & method', creators: ['First Writer', 'Second Writer'], year: '-300' })]);
  assert.match(output, /@book\{WriterBCE300,/);
  assert.ok(output.includes('author = {First Writer and Second Writer}'));
  assert.ok(output.includes('title = {Inquiry \\& method}'));
});
