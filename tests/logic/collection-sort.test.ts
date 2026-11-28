import assert from 'node:assert/strict';
import test from 'node:test';
import { sortCollection } from '../../src/lib/collection-sort';

test('collection sorting does not mutate the input and uses names as a date tie-breaker', () => {
  const items = [{ name: 'Zebra', date: '2026-01-02' }, { name: 'Beta', date: '2026-01-02' }, { name: 'Apple', date: '2026-01-01' }];
  const order = (mode: 'name' | 'newest' | 'oldest') => sortCollection(items, mode, item => item.name, item => item.date).map(item => item.name);
  assert.deepEqual(order('newest'), ['Beta', 'Zebra', 'Apple']);
  assert.deepEqual(order('oldest'), ['Apple', 'Beta', 'Zebra']);
  assert.deepEqual(order('name'), ['Apple', 'Beta', 'Zebra']);
  assert.equal(items[0].name, 'Zebra');
});
