import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContextDeskMemory, AI_CONTEXT_MEMORY_LIMIT, aiContextMemorySize } from '../../src/lib/contextual-ai';
import { resolveDeskSelection } from '../../src/lib/context-desk-selection';
import { readDeskMembership, readSavedDesks, replaceSavedDesk, type SavedContextDesk } from '../../src/lib/saved-context-desks';

for (const size of [12, 80, 300]) {
  test(`a ${size}-item desk keeps membership separate from authorized analysis`, () => {
    const records = Array.from({ length: size }, (_, i) => ({
      key: `position:${i}`, type: 'position', label: 'Repeated title',
      sourceIds: [i === 0 ? 'excluded-book' : 'allowed-book'], memory: ['Evidence '.repeat(500)],
    }));
    const selected = records.map(item => item.key);
    const desk = readDeskMembership({ selected: [...selected, selected[0]], sourceIds: ['excluded-book'] });
    assert.equal(desk.selected.length, size);
    const result = resolveDeskSelection([...desk.selected, 'position:gone'], new Map(records.map(record => [record.key, record])), {
      keys: new Set(), types: new Set(), sourceIds: new Set(desk.sourceIds),
    });
    assert.equal(result.excluded, 1);
    assert.equal(result.unavailable, 1);
    assert.equal(result.analysis.length, Math.min(size - 1, 12));
    assert.equal(result.analysis[0].key, 'position:1');
    assert.ok(result.analysis.every(record => !record.sourceIds.includes('excluded-book')));
    assert.ok(aiContextMemorySize(buildContextDeskMemory(result.analysis)) <= AI_CONTEXT_MEMORY_LIMIT);
  });
}

test('desk revisions prevent a stale device from overwriting a newer save', () => {
  const a: SavedContextDesk = { ...readDeskMembership({}), id: 'desk-1', revision: 'a', name: 'Freedom' };
  const b = { ...a, revision: 'b', name: 'Responsibility' };
  const data = replaceSavedDesk([], a.id, null, a);
  const newer = replaceSavedDesk(data, a.id, a.revision, b);
  assert.deepEqual(readSavedDesks(newer), [b]);
  assert.throws(() => replaceSavedDesk(newer, a.id, a.revision, null), /another device/);
  assert.deepEqual(replaceSavedDesk(newer, b.id, b.revision, null), []);
});

test('saved exclusions are not truncated to the membership cap', () => {
  const sourceIds = Array.from({ length: 500 }, (_, i) => `book-${i}`);
  assert.deepEqual(readDeskMembership({ sourceIds }).sourceIds, sourceIds);
});
