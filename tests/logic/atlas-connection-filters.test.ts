import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAtlasConnections } from '../../src/components/Atlas/atlas-connection-filters';

const outgoing = { fromType: 'concept', fromId: 'shared', toType: 'source', toId: 'book', type: 'explains' } as const;
const incoming = { fromType: 'position', fromId: 'claim', toType: 'concept', toId: 'shared', type: 'depends_on' } as const;
const unrelated = { fromType: 'position', fromId: 'shared', toType: 'source', toId: 'shared', type: 'supports' } as const;
const links = [outgoing, incoming, unrelated];
const all = { conceptId: 'all', direction: 'either', relationship: 'all' };

test('region membership is typed and an empty region does not show all connections', () => {
  assert.deepEqual(filterAtlasConnections(links, { ...all, members: { concept: ['shared'] } }), [outgoing, incoming]);
  assert.deepEqual(filterAtlasConnections(links, { ...all, members: {} }), []);
  assert.deepEqual(filterAtlasConnections(links, all), links);
});

test('concept direction and relationship filters match only typed endpoints', () => {
  const concept = { ...all, conceptId: 'shared' };
  assert.deepEqual(filterAtlasConnections(links, concept), [outgoing, incoming]);
  assert.deepEqual(filterAtlasConnections(links, { ...concept, direction: 'outgoing' }), [outgoing]);
  assert.deepEqual(filterAtlasConnections(links, { ...concept, direction: 'incoming' }), [incoming]);
  assert.deepEqual(filterAtlasConnections(links, { ...concept, relationship: 'supports' }), []);
});
