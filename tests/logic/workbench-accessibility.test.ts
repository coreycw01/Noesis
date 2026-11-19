import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkbenchFlow } from '../../src/components/shared/WorkbenchFlow';
import { FilterToolbar, ViewModeToggle } from '../../src/components/shared/FilterToolbar';
import { AlertDialogFooter } from '../../src/components/ui/alert-dialog';
import { DialogFooter } from '../../src/components/ui/dialog';
import { Sheet, SheetFooter, SheetTrigger } from '../../src/components/ui/sheet';
import { workbenchFocusIndex } from '../../src/lib/workbench-keyboard';

test('arrow keys and Home/End move focus without treating activation keys as navigation', () => {
  assert.equal(workbenchFocusIndex('ArrowRight', 3, 4), 0);
  assert.equal(workbenchFocusIndex('ArrowLeft', 0, 4), 3);
  assert.equal(workbenchFocusIndex('ArrowRight', 0, 4, true), 3);
  assert.equal(workbenchFocusIndex('Home', 2, 4), 0);
  assert.equal(workbenchFocusIndex('End', 0, 4), 3);
  for (const key of ['Enter', ' ', 'Tab', 'Escape']) assert.equal(workbenchFocusIndex(key, 0, 4), null);
  assert.equal(workbenchFocusIndex('End', 0, 0), null);
});

test('workbench steps expose the current step and connect buttons to descriptions', () => {
  const html = renderToStaticMarkup(createElement(WorkbenchFlow, {
    label: 'Inquiry workflow',
    activeId: 'answer',
    onSelect: () => undefined,
    steps: [
      { id: 'frame', label: 'Frame', description: 'Clarify the question' },
      { id: 'answer', label: 'Answer', description: 'Record an answer' },
    ],
  }));
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
  for (const [, id] of html.matchAll(/aria-describedby="([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`));
  assert.equal((html.match(/aria-describedby=/g) || []).length, 2);
});

test('shared dialog footers keep cancel before confirmation in DOM and mobile layout', () => {
  for (const Footer of [AlertDialogFooter, DialogFooter, SheetFooter]) {
    const html = renderToStaticMarkup(createElement(Footer, null, createElement('button', null, 'Cancel'), createElement('button', null, 'Confirm')));
    assert.doesNotMatch(html, /flex-(col|row)-reverse/);
    assert.ok(html.indexOf('Cancel') < html.indexOf('Confirm'));
  }
});

test('shared search and view controls expose names and the selected view', () => {
  const html = renderToStaticMarkup(createElement(FilterToolbar, {
    search: 'attention',
    searchLabel: 'Search annotations',
    onSearchChange: () => undefined,
    viewControl: createElement(ViewModeToggle, { value: 'table', modes: ['grid', 'table'], onChange: () => undefined }),
  }));
  assert.match(html, /<label[^>]+for="([^"]+)"[^>]*>Search annotations<\/label>/);
  assert.match(html, /<input[^>]+role="searchbox"[^>]+aria-label="Search annotations"/);
  assert.match(html, /<button[^>]+aria-label="Clear search"/);
  assert.match(html, /role="group"[^>]+aria-label="View mode"/);
  assert.match(html, /aria-pressed="false" aria-label="grid view"/);
  assert.match(html, /aria-pressed="true" aria-label="table view"/);
});

test('a registered sheet opener exposes its dialog state to assistive technology', () => {
  const html = renderToStaticMarkup(createElement(Sheet, { open: false },
    createElement(SheetTrigger, { asChild: true }, createElement('button', { type: 'button' }, 'More pages')),
  ));
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="[^"]+"/);
});

test('labeled concept modes render in Cards, Split, List order with one selected', () => {
  const html = renderToStaticMarkup(createElement(ViewModeToggle, {
    label: 'Concept layout', showLabels: true, value: 'split',
    modes: ['grid', 'split', 'list'], onChange: () => undefined,
  }));
  assert.match(html, /aria-label="Concept layout"/);
  const choices = [...html.matchAll(/aria-pressed="(true|false)" aria-label="([^"]+)"/g)].map(match => [match[2], match[1]]);
  assert.deepEqual(choices, [['Cards view', 'false'], ['Split view', 'true'], ['List view', 'false']]);
  assert.match(html, /<span>Cards<\/span>/);
  assert.match(html, /<span>Split<\/span>/);
  assert.match(html, /<span>List<\/span>/);
});
