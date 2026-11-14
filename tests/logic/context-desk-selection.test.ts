import assert from 'node:assert/strict';
import test from 'node:test';
import { addContextDeskSelection, contextDeskRecordIsExcluded, contextDeskReviewKey, contextDeskSourceIds, contextDeskStorageKeys, MAX_CONTEXT_ITEMS, normalizeContextDeskSelection } from '../../src/lib/context-desk-selection';

test('review identity includes records past the request ID limit and distinguishes primary context', () => {
  const prefix = Array.from({ length: 11 }, (_, index) => ({ key: `annotation:${'x'.repeat(40)}:${index}` }));
  const first = [...prefix, { key: 'inquiry:first' }];
  const second = [...prefix, { key: 'inquiry:second' }];
  const requestId = (records: typeof first) => `selection:${records.map(({ key }) => key).sort().join('|')}`.slice(0, 256);
  assert.equal(requestId(first), requestId(second));
  assert.notEqual(contextDeskReviewKey(first), contextDeskReviewKey(second));
  assert.notEqual(contextDeskReviewKey(first), contextDeskReviewKey([...first].reverse()));
});

test('Context Desk separates selections and exclusions by account and mode', () => {
  const keys = ['a:account', 'b:account', 'a:demo'].flatMap((workspace) => Object.values(contextDeskStorageKeys(workspace)));
  assert.equal(new Set(keys).size, 6);
});

test('handoffs preserve existing selections and report a full desk', () => {
  const keys = Array.from({ length: MAX_CONTEXT_ITEMS }, (_, index) => `source:${index}`);
  assert.deepEqual(normalizeContextDeskSelection([null, '', keys[0], ...keys, 'extra']), keys);
  assert.equal(addContextDeskSelection(keys, 'annotation:source:note'), null);
  assert.deepEqual(addContextDeskSelection(keys, keys[0]), keys);
  assert.deepEqual(addContextDeskSelection([], 'annotation:source:note'), ['annotation:source:note']);
});

test('source exclusions cover records linked through annotations without removing unrelated records', () => {
  const sourceByAnnotation = new Map([['passage', 'excluded-book']]);
  const rules = { keys: new Set<string>(), types: new Set(['position']), sourceIds: new Set(['excluded-book']) };
  const sourceIds = contextDeskSourceIds(['other-book'], [undefined, 'passage', 'passage', 'missing'], sourceByAnnotation);
  assert.deepEqual(sourceIds, ['other-book', 'excluded-book']);
  assert.equal(contextDeskRecordIsExcluded({ key: 'inquiry:a', type: 'inquiry', sourceIds }, rules), true);
  assert.equal(contextDeskRecordIsExcluded({ key: 'inquiry:b', type: 'inquiry', sourceIds: ['other-book'] }, rules), false);
  assert.equal(contextDeskRecordIsExcluded({ key: 'position:a', type: 'position', sourceIds: [] }, rules), true);
});
