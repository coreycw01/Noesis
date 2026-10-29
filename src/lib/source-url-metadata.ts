import type { MediaType } from './types';

export interface ParsedPageMetadata {
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  author: string;
  publishedAt: string;
  canonicalUrl: string;
  oEmbedUrl: string;
  openGraphType: string;
  structuredTypes: string[];
  tags: string[];
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] || match);
}

export function cleanMetadataText(value?: string | null) {
  return decodeHtmlEntities(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attributesFromTag(tag: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    const name = match[1].toLowerCase();
    if (name === 'meta' || name === 'link' || name === 'script') continue;
    attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function tagsFromHtml(html: string, tagName: 'meta' | 'link') {
  return Array.from(html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')))
    .map((match) => attributesFromTag(match[0]));
}

function absoluteUrl(value: string | undefined, base: URL) {
  if (!value) return '';
  try {
    return new URL(value, base).toString();
  } catch {
    return '';
  }
}

function jsonLdValues(html: string) {
  const values: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      values.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Third-party structured data is frequently incomplete or malformed.
    }
  }
  return values.flatMap((value: any) => value?.['@graph'] || value).filter(Boolean) as any[];
}

function firstStructuredValue(items: any[], keys: string[]) {
  for (const item of items) {
    for (const key of keys) {
      const value = item?.[key];
      if (!value) continue;
      if (typeof value === 'string' || typeof value === 'number') return cleanMetadataText(String(value));
      if (Array.isArray(value)) {
        const first = value[0];
        if (typeof first === 'string' || typeof first === 'number') return cleanMetadataText(String(first));
        if (first?.name) return cleanMetadataText(first.name);
      }
      if (value?.name) return cleanMetadataText(value.name);
    }
  }
  return '';
}

function structuredTypes(items: any[]) {
  return Array.from(new Set(items.flatMap((item) => {
    const value = item?.['@type'];
    return Array.isArray(value) ? value : value ? [value] : [];
  }).map((value) => cleanMetadataText(String(value))).filter(Boolean)));
}

export function parsePageMetadata(html: string, pageUrl: URL): ParsedPageMetadata {
  const metas = tagsFromHtml(html, 'meta');
  const links = tagsFromHtml(html, 'link');
  const structured = jsonLdValues(html);
  const meta = (...keys: string[]) => {
    const normalized = keys.map((key) => key.toLowerCase());
    const match = metas.find((attributes) => normalized.includes(
      String(attributes.property || attributes.name || attributes.itemprop || '').toLowerCase(),
    ));
    return cleanMetadataText(match?.content);
  };
  const link = (rel: string, type?: string) => links.find((attributes) => {
    const rels = String(attributes.rel || '').toLowerCase().split(/\s+/);
    return rels.includes(rel) && (!type || String(attributes.type || '').toLowerCase() === type);
  })?.href || '';

  const title = meta('og:title', 'twitter:title')
    || firstStructuredValue(structured, ['headline', 'name'])
    || cleanMetadataText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = meta('og:description', 'twitter:description', 'description')
    || firstStructuredValue(structured, ['description', 'abstract']);
  const image = meta('og:image', 'og:image:url', 'twitter:image', 'twitter:image:src')
    || firstStructuredValue(structured, ['thumbnailUrl', 'image']);
  const siteName = meta('og:site_name', 'application-name') || pageUrl.hostname.replace(/^www\./, '');
  const author = meta('author', 'article:author') || firstStructuredValue(structured, ['author', 'creator']);
  const publishedAt = meta('article:published_time', 'date', 'datepublished')
    || firstStructuredValue(structured, ['datePublished', 'uploadDate', 'dateCreated']);
  const canonicalUrl = absoluteUrl(link('canonical'), pageUrl) || pageUrl.toString();
  const oEmbedUrl = absoluteUrl(link('alternate', 'application/json+oembed'), pageUrl);
  const keywords = meta('keywords');

  return {
    title,
    description,
    imageUrl: absoluteUrl(image, pageUrl),
    siteName,
    author,
    publishedAt,
    canonicalUrl,
    oEmbedUrl,
    openGraphType: meta('og:type').toLowerCase(),
    structuredTypes: structuredTypes(structured),
    tags: keywords.split(',').map(cleanMetadataText).filter(Boolean).slice(0, 8),
  };
}

export function youtubeVideoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(hostname)) return '';
  if (url.pathname === '/watch') return url.searchParams.get('v') || '';
  const parts = url.pathname.split('/').filter(Boolean);
  if (['shorts', 'live', 'embed'].includes(parts[0])) return parts[1] || '';
  return '';
}

export function inferMediaType(url: URL, metadata: Pick<ParsedPageMetadata, 'openGraphType' | 'structuredTypes'>): MediaType | undefined {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (youtubeVideoId(url) || hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) return 'video';

  const signals = [metadata.openGraphType, ...metadata.structuredTypes].join(' ').toLowerCase();
  if (/video|clip|broadcast/.test(signals)) return 'video';
  if (/podcast|audioobject|audio/.test(signals)) return 'podcast';
  if (/movie|film/.test(signals)) return 'movie';
  if (/scholarlyarticle|medicalscholarlyarticle/.test(signals)) return 'paper';
  if (/course/.test(signals)) return 'course';
  if (/book|audiobook/.test(signals)) return signals.includes('audiobook') ? 'audiobook' : 'book';
  if (/article|posting|news/.test(signals)) return 'article';
  return undefined;
}
