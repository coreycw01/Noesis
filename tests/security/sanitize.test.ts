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
