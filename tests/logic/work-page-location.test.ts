import assert from 'node:assert/strict';
import test from 'node:test';
import { pageAtReadingLine } from '../../src/lib/work-page-location';

test('page settings follow the page being read, not the nearest upcoming page title', () => {
  const pages = [{ id: 'main', top: -800, bottom: 300 }, { id: 'second', top: 340, bottom: 1440 }];
  assert.equal(pageAtReadingLine(pages, 150)?.id, 'main');
  assert.equal(pageAtReadingLine(pages, 400)?.id, 'second');
  assert.equal(pageAtReadingLine(pages, 310)?.id, 'main');
  assert.equal(pageAtReadingLine(pages, 335)?.id, 'second');
  assert.equal(pageAtReadingLine([], 100), undefined);
});
