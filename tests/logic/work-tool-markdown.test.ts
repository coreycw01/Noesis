import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeWorkToolMarkdown } from '../../src/lib/work-tool-markdown';

test('Markdown export preserves mind map relationships without duplicating legacy branches', () => {
  assert.equal(serializeWorkToolMarkdown('Mind Map', {
    fields: { central: 'Agency' },
    branches: ['Legacy copy'],
    mindMapNodes: [
      { id: 'a', label: 'Constraints', parentId: null },
      { id: 'b', label: 'Habits', parentId: 'a' },
      { id: 'c', label: 'Practice', parentId: 'b' },
      { id: 'd', label: 'Open question', parentId: 'missing' },
    ],
  }), '## Mind Map\n\n### central\n\nAgency\n\n### Branches\n\n- Constraints\n- Constraints -> Habits\n- Habits -> Practice\n- Open question');
});

test('Markdown export still includes legacy branches and timeline details', () => {
  assert.equal(serializeWorkToolMarkdown('Mind Map', { fields: {}, branches: ['Agency', ' '] }),
    '## Mind Map\n\n### Branches\n\n- Agency');
  assert.match(serializeWorkToolMarkdown('Timeline', {
    fields: {},
    timeline: [{ id: 'start', date: '2026-11-13', branch: 'Practice', title: 'Start', detail: 'Record observations' }],
  }), /2026-11-13.*Practice: Start\nRecord observations/);
  assert.equal(serializeWorkToolMarkdown('Mind Map', { fields: { central: ' ' } }), '');
});
