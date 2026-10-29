import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rules = readFileSync('firestore.rules', 'utf8');
const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: Array<{ collectionGroup: string }> };
const schema = JSON.parse(readFileSync('docs/firestore.schema.json', 'utf8')) as { version: number; collections: Record<string, unknown> };

test('allows only the reviewed first-level workspace collections', () => {
  assert.match(rules, /allowedWorkspaceCollection/);
  assert.match(rules, /collectionId == 'annotations'/);
  assert.match(rules, /validListField\(data, 'aiReviewHistory', 500\)/);
  assert.match(rules, /validListField\(data, 'annotations', 200\)/);
});

test('indexes annotations and removes the retired suggestions index', () => {
  const groups = indexes.indexes.map((index) => index.collectionGroup);
  assert.ok(groups.includes('annotations'));
  assert.equal(groups.includes('suggestions'), false);
});

test('documents schema version five canonical collections', () => {
  assert.equal(schema.version, 5);
  assert.ok(schema.collections.annotations);
  assert.ok(schema.collections.thinkingEvents);
  assert.equal('suggestions' in schema.collections, false);
});
