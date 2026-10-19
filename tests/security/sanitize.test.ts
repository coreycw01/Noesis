import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeHtml } from '../../src/lib/sanitize';

test('removes executable HTML and unsafe URL schemes', () => {
  const dirty = '<script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">bad</a><p onclick="alert(4)">safe</p>';
  const clean = sanitizeHtml(dirty);
  assert.doesNotMatch(clean, /script|onerror|onclick|javascript:/i);
  assert.match(clean, /<p>safe<\/p>/);
});

test('keeps only the supported rich-text vocabulary', () => {
  const clean = sanitizeHtml('<h2>Title</h2><p><strong>Claim</strong> <a href="https://example.com">source</a></p>');
  assert.match(clean, /<h2>Title<\/h2>/);
  assert.match(clean, /rel="noopener noreferrer nofollow"/);
});

test('keeps uploaded document images while rejecting executable image content', () => {
  const clean = sanitizeHtml('<figure data-noesis-image="uploaded" contenteditable="false"><img src="data:image/png;base64,AAAA" alt="Argument map" onerror="alert(1)"><figcaption>Argument map</figcaption></figure>');
  assert.match(clean, /data-noesis-image="uploaded"/);
  assert.match(clean, /src="data:image\/png;base64,AAAA"/);
  assert.match(clean, /alt="Argument map"/);
  assert.doesNotMatch(clean, /onerror/i);
});

test('keeps inline graph opacity and non-editable semantics', () => {
  const clean = sanitizeHtml('<figure data-noesis-chart="bar" contenteditable="false"><svg viewBox="0 0 10 10"><rect x="0" y="0" width="8" height="4" fill="currentColor" opacity="0.25"></rect></svg></figure>');
  assert.match(clean, /contenteditable="false"/);
  assert.match(clean, /opacity="0.25"/);
});
