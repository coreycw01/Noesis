import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldTraceAtlasConnection } from '../../src/components/Atlas/atlas-connection-trace';

test('only the newly requested custom edge draws a trace', () => {
  const trace = { edgeId: 'new-link', from: 'Agency' };
  assert.equal(shouldTraceAtlasConnection(null, 'new-link'), false);
  assert.equal(shouldTraceAtlasConnection(trace, 'old-link'), false);
  assert.equal(shouldTraceAtlasConnection(trace, 'new-link'), true);
});

test('an existing relationship group waits until it contains a new saved link', () => {
  const trace = { edgeId: 'typed-group:Agency::Identity', from: 'Identity', previousLinkIds: new Set(['existing', 'previously filtered']) };
  assert.equal(shouldTraceAtlasConnection(trace, trace.edgeId, ['existing']), false);
  assert.equal(shouldTraceAtlasConnection(trace, trace.edgeId, ['existing', 'previously filtered']), false);
  assert.equal(shouldTraceAtlasConnection(trace, trace.edgeId, ['existing', 'saved']), true);
});
