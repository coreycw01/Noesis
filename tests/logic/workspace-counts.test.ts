import assert from 'node:assert/strict';
import test from 'node:test';
import { countPersistedConcepts, countPersistedRecords, persistedConceptRecords } from '../../src/lib/workspace-counts';

test('canonical record totals ignore duplicate client entries', () => {
  assert.equal(countPersistedRecords([
    { id: 'source-1' },
    { id: 'source-2' },
    { id: 'source-1' },
  ]), 2);
});

test('concept totals include only persisted named concept documents', () => {
  assert.equal(countPersistedConcepts([
    { id: 'concept-1', name: 'Identity' },
    { id: 'concept-2', name: 'Agency' },
    { id: 'concept-2', name: 'Agency duplicate snapshot' },
    { id: 'concept-tag-only', name: 'Justice', createdFrom: 'tag' },
    { id: 'concept-unsorted', name: 'Unsorted Ideas' },
  ]), 2);
});

test('profile concept records use the same exclusions and stable ids as navigation totals', () => {
  const records = [
    { id: 'one', name: 'Identity' }, { id: 'one', name: 'Identity' },
    { id: 'two', name: 'Unsorted Ideas' }, { id: 'three', name: 'Justice', createdFrom: 'tag' as const },
    { id: 'four', name: '   ' },
  ];
  assert.equal(persistedConceptRecords(records).length, countPersistedConcepts(records));
  assert.deepEqual(persistedConceptRecords(records).map((item) => item.id), ['one']);
});
