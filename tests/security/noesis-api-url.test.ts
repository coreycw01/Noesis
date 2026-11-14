import assert from 'node:assert/strict';
import test from 'node:test';
import { noesisApiUrl } from '../../src/lib/noesis-api-url';

test('authenticated API requests stay on the same origin and inside the API path', () => {
  const origin = 'https://noesis.example';
  assert.equal(noesisApiUrl('/api/contextual-ai?q=one', origin).href, `${origin}/api/contextual-ai/?q=one`);
  for (const unsafe of ['//other.example/api/test', 'http://noesis.example/api/test', '/api/../profile',
    '/api-other/test', 'https://attacker@noesis.example/api/test']) {
    assert.throws(() => noesisApiUrl(unsafe, origin), /only attach credentials/);
  }
});
