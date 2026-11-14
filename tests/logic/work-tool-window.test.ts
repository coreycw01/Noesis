import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloatingWorkToolWindow } from '../../src/components/Writing/FloatingWorkToolWindow';
import type { WorkToolSection } from '../../src/lib/types';

function renderWindow(minimized: boolean, background?: NonNullable<WorkToolSection['window']>['background']) {
  const props = {
    section: { id: 'map-1', tool: 'mind_map', data: { fields: {} }, window: { x: 900, y: 200, width: 600, height: 430, minimized, background } },
    label: 'Mind Map', mobileActive: true, onFocus() {}, onPatch() {}, onPlacementChange() {}, onRemove() {},
    children: React.createElement('input', { 'aria-label': 'Central idea', defaultValue: 'Agency' }),
  } satisfies React.ComponentProps<typeof FloatingWorkToolWindow>;
  return renderToStaticMarkup(React.createElement(FloatingWorkToolWindow, props));
}

test('on-paper restore controls are desktop-only', () => {
  const html = renderWindow(true);
  assert.match(html, /aria-label="Restore Mind Map"/);
  const restore = html.match(/<button[^>]+aria-label="Restore Mind Map"[^>]*>/)?.[0] || '';
  assert.ok(restore);
  assert.match(restore, /class="[^"]*\bhidden\b/);
  assert.match(restore, /md:inline-flex/);
  assert.doesNotMatch(restore, /style="[^"]*;?left:/);
});

test('minimizing keeps tool inputs mounted so pending edits can commit', () => {
  const html = renderWindow(true);
  assert.match(html, /display:none/);
  assert.match(html, /data-minimized="true"/);
  assert.match(html, /\binert=""/);
  assert.match(html, /value="Agency"/);
  assert.doesNotMatch(renderWindow(false), /\binert=""/);
});

test('removal is explicitly named and distinct from minimizing', () => {
  const html = renderWindow(false);
  assert.match(html, /aria-label="Remove Mind Map"/);
  assert.match(html, /aria-label="Minimize Mind Map"/);
  assert.doesNotMatch(html, /aria-label="Close Mind Map"/);
});

test('tool appearance is independent of field editing and preserves zero background opacity', () => {
  const html = renderWindow(false, { color: '#297dbc', opacity: 0 });
  assert.match(html, /aria-label="Mind Map appearance"/);
  assert.match(html, /<input[^>]+aria-label="Central idea"/);
  assert.match(html, /--work-tool-tint:#297dbc/);
  assert.match(html, /--work-tool-alpha:0%/);
  assert.doesNotMatch(renderWindow(false, { color: 'invalid' }), /--work-tool-tint:/);
});
