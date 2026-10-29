import assert from 'node:assert/strict';
import test from 'node:test';
import { inferMediaType, parsePageMetadata, youtubeVideoId } from '../../src/lib/source-url-metadata';

test('page metadata accepts arbitrary HTML attribute order and builds absolute URLs', () => {
  const metadata = parsePageMetadata(`
    <html><head>
      <meta content="A &amp; B" property="og:title">
      <meta content="A useful description of the source." name="description">
      <meta content="/cover.jpg" property="og:image">
      <meta content="article" property="og:type">
      <link href="/canonical" rel="canonical">
      <link href="/oembed.json" type="application/json+oembed" rel="alternate">
    </head></html>
  `, new URL('https://example.com/story'));

  assert.equal(metadata.title, 'A & B');
  assert.equal(metadata.description, 'A useful description of the source.');
  assert.equal(metadata.imageUrl, 'https://example.com/cover.jpg');
  assert.equal(metadata.canonicalUrl, 'https://example.com/canonical');
  assert.equal(metadata.oEmbedUrl, 'https://example.com/oembed.json');
  assert.equal(inferMediaType(new URL(metadata.canonicalUrl), metadata), 'article');
});

test('structured data supplies descriptions, creators, dates, and media type', () => {
  const metadata = parsePageMetadata(`
    <script type="application/ld+json">{
      "@type":"VideoObject",
      "name":"A careful lecture",
      "description":"The lecturer examines attention and agency.",
      "creator":{"name":"Noesis Lectures"},
      "uploadDate":"2025-05-04",
      "thumbnailUrl":"https://cdn.example.com/lecture.jpg"
    }</script>
  `, new URL('https://example.com/lecture'));

  assert.equal(metadata.title, 'A careful lecture');
  assert.equal(metadata.author, 'Noesis Lectures');
  assert.equal(metadata.publishedAt, '2025-05-04');
  assert.equal(inferMediaType(new URL('https://example.com/lecture'), metadata), 'video');
});

test('YouTube watch, short, live, embed, and short links resolve as videos', () => {
  const urls = [
    'https://www.youtube.com/watch?v=abc123',
    'https://youtube.com/shorts/abc123',
    'https://youtube.com/live/abc123',
    'https://youtube.com/embed/abc123',
    'https://youtu.be/abc123',
  ];
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(youtubeVideoId(url), 'abc123');
    assert.equal(inferMediaType(url, { openGraphType: '', structuredTypes: [] }), 'video');
  }
});
