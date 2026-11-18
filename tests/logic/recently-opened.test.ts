import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeRecentlyOpened } from '../../src/lib/recently-opened';

test('reopening a record moves it to the front without duplicating it', () => {
  const a = { type: 'concept' as const, id: 'a', label: 'A', at: '1' };
  const b = { type: 'concept' as const, id: 'b', label: 'B', at: '2' };
  const list = mergeRecentlyOpened(mergeRecentlyOpened([], a), b);
  assert.deepEqual(mergeRecentlyOpened(list, { ...a, at: '3' }).map((item) => item.id), ['a', 'b']);
});

test('the same id under a different type is a different record', () => {
  const list = mergeRecentlyOpened([{ type: 'concept', id: 'x', label: 'X', at: '1' }], { type: 'position', id: 'x', label: 'X', at: '2' });
  assert.equal(list.length, 2);
});

test('the list is capped', () => {
  let list: ReturnType<typeof mergeRecentlyOpened> = [];
  for (let index = 0; index < 30; index += 1) list = mergeRecentlyOpened(list, { type: 'inquiry', id: String(index), label: 'q', at: String(index) }, 5);
  assert.deepEqual(list.map((item) => item.id), ['29', '28', '27', '26', '25']);
});
