import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceMindMap } from '../../src/lib/workspace-mindmap';

test('concepts become branches holding the records that use them', () => {
  const xml = workspaceMindMap({
    concepts: [{ id: 'c1', name: 'Courage', description: 'Acting well despite fear' }],
    vault: [
      { id: 'p1', title: 'Speak up', statement: 'Say the hard thing', tags: ['courage'], status: 'active', confidence: 70 },
      { id: 'p2', title: 'Retired', tags: ['courage'], status: 'abandoned' },
    ],
    questions: [{ id: 'q1', text: 'When is silence wise?', conceptIds: ['c1'] }],
    media: [{ id: 's1', title: 'Loose source', tags: [] }],
  });
  assert.ok(xml.startsWith('<map version="1.0.1">'));
  assert.match(xml, /TEXT="Courage"/);
  assert.match(xml, /TEXT="Positions \(1\)"/);
  assert.match(xml, /TEXT="Speak up"/);
  assert.doesNotMatch(xml, /Retired/);
  assert.match(xml, /TEXT="When is silence wise\?"/);
  assert.match(xml, /TEXT="Not yet tied to a concept"[^]*TEXT="Loose source"/);
});

test('record text is escaped for XML', () => {
  const xml = workspaceMindMap({ concepts: [{ id: 'c', name: 'A & B <"x">' }] });
  assert.match(xml, /TEXT="A &amp; B &lt;&quot;x&quot;&gt;"/);
});
