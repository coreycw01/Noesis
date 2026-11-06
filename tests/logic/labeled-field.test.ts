import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LabeledField } from '../../src/components/shared/LabeledField';
import { Input } from '../../src/components/ui/input';

test('shared fields connect visible labels to their input and preserve explicit ids', () => {
  const html = renderToStaticMarkup(React.createElement(LabeledField, { label: 'Display name' },
    React.createElement(Input, { id: 'profile-name', defaultValue: 'A thinker' }),
  ));
  assert.match(html, /for="profile-name"/);
  assert.match(html, /id="profile-name"/);
  assert.match(html, /Display name/);
});

test('shared fields create distinct input ids without losing their values', () => {
  const html = renderToStaticMarkup(React.createElement('div', null,
    ...['First', 'Second'].map((label) => React.createElement(LabeledField, { key: label, label },
      React.createElement(Input, { defaultValue: label }),
    )),
  ));
  const targets = [...html.matchAll(/for="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(targets).size, 2);
  targets.forEach((id) => assert.ok(html.includes(`id="${id}"`)));
  assert.match(html, /value="Second"/);
});
