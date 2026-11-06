import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeHtml } from '../../src/lib/sanitize';

test('document ribbon formatting survives sanitizing and repeated saves', () => {
  const input = '<p style="text-align: center; line-height: 1.5"><span style="font-weight: bold; font-style: italic; font-family: Georgia; font-size: 18px; color: rgb(20, 30, 40); background-color: #ffff00">A considered claim</span><sup>1</sup></p><hr />';
  const clean = sanitizeHtml(input);
  for (const property of ['font-weight:bold', 'font-style:italic', 'font-family:Georgia', 'font-size:18px', 'text-align:center', 'line-height:1.5', 'background-color:#ffff00']) assert.ok(clean.includes(property), property);
  assert.ok(clean.includes('<sup>1</sup>'));
  assert.ok(clean.includes('<hr'));
  assert.equal(sanitizeHtml(clean), clean);
});

test('document styling cannot introduce URLs, scripts or positioning', () => {
  const clean = sanitizeHtml('<p onclick="alert(1)" style="position:fixed;inset:0;background-image:url(https://example.com/track);color:expression(alert(1));--payload:url(x);font-weight:bold">Text<script>alert(1)</script><a href="javascript:alert(1)">link</a></p>');
  assert.ok(clean.includes('font-weight:bold'));
  for (const unsafe of ['onclick', 'position', 'inset:', 'url(', 'expression', '--payload', '<script', 'javascript:']) assert.ok(!clean.includes(unsafe), unsafe);
});
