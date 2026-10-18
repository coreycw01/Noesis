import assert from 'node:assert/strict';
import test from 'node:test';
import {
  removeDocumentPageSettings,
  resolveDocumentPageSettings,
  updateDocumentPageSettings,
} from '../../src/lib/work-page-settings';

const documentSettings = {
  pageSize: 'letter' as const,
  paperColor: 'blank' as const,
  paperPattern: 'none' as const,
};

test('page settings inherit document defaults and override only their own page', () => {
  const settings = updateDocumentPageSettings(undefined, 'timeline-page', { paperColor: 'sepia' });

  assert.deepEqual(resolveDocumentPageSettings(documentSettings, settings, 'main'), documentSettings);
  assert.deepEqual(resolveDocumentPageSettings(documentSettings, settings, 'timeline-page'), {
    ...documentSettings,
    paperColor: 'sepia',
  });
});

test('resetting one page leaves other page overrides intact', () => {
  const settings = updateDocumentPageSettings(
    updateDocumentPageSettings(undefined, 'main', { paperPattern: 'notebook' }),
    'diagram-page',
    { pageSize: 'a4' },
  );
  const reset = removeDocumentPageSettings(settings, 'main');

  assert.deepEqual(resolveDocumentPageSettings(documentSettings, reset, 'main'), documentSettings);
  assert.equal(resolveDocumentPageSettings(documentSettings, reset, 'diagram-page').pageSize, 'a4');
});
