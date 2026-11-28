import assert from 'node:assert/strict';
import test from 'node:test';
import { boundaryNumbering } from '../../src/lib/concept-boundary-findings';
import type { Concept } from '../../src/lib/types';

test('case numbers survive moving between zones and continue after a removal', () => {
  const original = { examples: ['First'], edgeCases: ['Second'], counterexamples: [] } as Pick<Concept, 'examples' | 'edgeCases' | 'counterexamples'>;
  const moved = boundaryNumbering(original, { fits: [], edge: ['Second'], outside: ['First', 'Third'] });
  assert.deepEqual(moved.patch.boundaryCaseNumbers, [
    { text: 'First', number: 1 }, { text: 'Second', number: 2 }, { text: 'Third', number: 3 },
  ]);
  const saved = { examples: [], edgeCases: ['Second'], counterexamples: ['First', 'Third'], ...moved.patch };
  const removed = boundaryNumbering(saved, { fits: [], edge: ['Second'], outside: ['Third'] });
  const added = boundaryNumbering({ ...saved, counterexamples: ['Third'], ...removed.patch }, { fits: ['Fourth'], edge: ['Second'], outside: ['Third'] });
  assert.deepEqual(added.patch.boundaryCaseNumbers.map(entry => entry.number), [2, 3, 4]);
});
