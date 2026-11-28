import assert from 'node:assert/strict';
import test from 'node:test';
import { pageAtReadingLine, workDragScrollStep } from '../../src/lib/work-page-location';

test('page settings follow the page being read, not the nearest upcoming page title', () => {
  const pages = [{ id: 'main', top: -800, bottom: 300 }, { id: 'second', top: 340, bottom: 1440 }];
  assert.equal(pageAtReadingLine(pages, 150)?.id, 'main');
  assert.equal(pageAtReadingLine(pages, 400)?.id, 'second');
  assert.equal(pageAtReadingLine(pages, 310)?.id, 'main');
  assert.equal(pageAtReadingLine(pages, 335)?.id, 'second');
  assert.equal(pageAtReadingLine([], 100), undefined);
});

test('tool drag scrolls in the direction of the closest canvas edge and caps its speed', () => {
  assert.equal(workDragScrollStep(400, 200, 800), 0);
  assert.equal(workDragScrollStep(232, 200, 800), -9);
  assert.equal(workDragScrollStep(768, 200, 800), 9);
  assert.equal(workDragScrollStep(950, 200, 800), 18);
  assert.equal(workDragScrollStep(50, 200, 800), -18);
  assert.equal(workDragScrollStep(400, 200, 200), 0);
});
