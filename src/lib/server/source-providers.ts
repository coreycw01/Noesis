import 'server-only';

import type { MediaType } from '@/lib/types';
import type { NormalizedSourceResult } from '@/lib/source-intake';
import { fetchPublicUrl, readLimitedText } from './public-url';

const USER_AGENT = 'Noesis source intake';

function cleanText(value?: string | null) {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function yearFromDate(value?: string | number | null) {
  const text = String(value || '');
  const match = text.match(/\d{4}/);
  return match?.[0] || '';
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean))).slice(0, 8);
}

function absoluteUrl(value: string | undefined, base: URL) {
  if (!value) return '';
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Provider request failed (${response.status}).`);
  return response.json();
}

function normalizeGoogleBook(item: any): NormalizedSourceResult | null {
  const volume = item?.volumeInfo;
  if (!volume?.title) return null;
  const identifiers = volume.industryIdentifiers || [];
  const isbn = identifiers.find((id: any) => String(id.type || '').includes('ISBN_13'))?.identifier
    || identifiers.find((id: any) => String(id.type || '').includes('ISBN'))?.identifier
    || '';

  return {
    provider: 'google_books',
    externalId: item.id,
    type: 'book',
    title: cleanText(volume.title),
    creators: unique(volume.authors || []),
    year: yearFromDate(volume.publishedDate),
    description: cleanText(volume.description),
    thumbnailUrl: volume.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
    sourceUrl: volume.previewLink || volume.infoLink || '',
    publisher: cleanText(volume.publisher),
    isbn,
    tags: unique(volume.categories || []),
    externalIds: {
      googleBooksId: item.id,
      isbn,
      url: volume.previewLink || volume.infoLink || '',
    },
  };
}

function normalizeOpenLibrary(doc: any): NormalizedSourceResult | null {
  if (!doc?.title) return null;
  const isbn = doc.isbn?.[0] || '';
  const openLibraryId = doc.key || '';
  const coverId = doc.cover_i;
  return {
    provider: 'open_library',
    externalId: openLibraryId || doc.edition_key?.[0] || doc.title,
    type: 'book',
    title: cleanText(doc.title),
    creators: unique(doc.author_name || []),
    year: yearFromDate(doc.first_publish_year),
    description: '',
    thumbnailUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '',
    sourceUrl: openLibraryId ? `https://openlibrary.org${openLibraryId}` : '',
    publisher: cleanText(doc.publisher?.[0]),
    isbn,
    tags: unique(doc.subject || []),
    externalIds: {
      openLibraryId,
      isbn,
      url: openLibraryId ? `https://openlibrary.org${openLibraryId}` : '',
    },
  };
}

function abstractFromInvertedIndex(index?: Record<string, number[]>) {
  if (!index) return '';
  const words: Array<{ word: string; position: number }> = [];
  Object.entries(index).forEach(([word, positions]) => {
    positions.forEach((position) => words.push({ word, position }));
  });
  return words
    .sort((a, b) => a.position - b.position)
    .map((item) => item.word)
    .join(' ');
}

function normalizeOpenAlexWork(work: any): NormalizedSourceResult | null {
  if (!work?.title) return null;
  const doi = String(work.doi || '').replace(/^https:\/\/doi.org\//, '');
  const concepts = unique((work.concepts || []).map((concept: any) => concept.display_name));
  return {
    provider: 'openalex',
    externalId: work.id,
    type: 'paper',
    title: cleanText(work.title),
    creators: unique((work.authorships || []).map((authorship: any) => authorship.author?.display_name)),
    year: yearFromDate(work.publication_year),
    description: cleanText(abstractFromInvertedIndex(work.abstract_inverted_index)),
    thumbnailUrl: '',
    sourceUrl: work.primary_location?.landing_page_url || work.open_access?.oa_url || work.id || '',
    publisher: cleanText(work.primary_location?.source?.display_name || work.host_venue?.display_name),
    doi,
    tags: concepts,
    externalIds: {
      openAlexId: work.id,
      doi,
      url: work.primary_location?.landing_page_url || work.open_access?.oa_url || work.id || '',
    },
  };
}

function tmdbHeaders() {
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!bearer && !apiKey) {
    throw new Error('TMDB search requires TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN in the server environment.');
  }

  return {
    headers: {
      accept: 'application/json',
      'user-agent': USER_AGENT,
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    apiKey,
  };
}

async function fetchTmdbJson(path: string, params: Record<string, string>) {
  const { headers, apiKey } = tmdbHeaders();
  const searchParams = new URLSearchParams(params);
  if (apiKey) searchParams.set('api_key', apiKey);
  const response = await fetch(`https://api.themoviedb.org/3${path}?${searchParams.toString()}`, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`TMDB request failed (${response.status}).`);
  return response.json();
}

function normalizeTmdbMovie(movie: any, forcedType: MediaType): NormalizedSourceResult | null {
  if (!movie?.title) return null;
  const tmdbId = String(movie.id || '');
  return {
    provider: 'tmdb',
    externalId: tmdbId,
    type: forcedType,
    title: cleanText(movie.title),
    creators: [],
    year: yearFromDate(movie.release_date),
    description: cleanText(movie.overview),
    thumbnailUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
    sourceUrl: tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : '',
    publisher: 'TMDB',
    platform: 'TMDB',
    tags: [],
    externalIds: {
      tmdbId,
      url: tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : '',
    },
  };
}

function normalizeItunesResult(item: any, forcedType: MediaType): NormalizedSourceResult | null {
  const title = item.collectionName || item.trackName;
  if (!title) return null;
  const id = String(item.collectionId || item.trackId || '');
  const sourceUrl = item.collectionViewUrl || item.trackViewUrl || '';
  return {
    provider: 'itunes',
    externalId: id || sourceUrl || title,
    type: forcedType,
    title: cleanText(title),
    creators: unique([item.artistName, item.collectionArtistName]),
    year: yearFromDate(item.releaseDate),
    description: cleanText(item.description || item.shortDescription || item.longDescription),
    thumbnailUrl: String(item.artworkUrl100 || item.artworkUrl60 || '').replace('100x100', '600x600'),
    sourceUrl,
    publisher: cleanText(item.artistName),
    platform: 'Apple',
    tags: unique([item.primaryGenreName]),
    externalIds: {
      itunesId: id,
      url: sourceUrl,
    },
  };
}

function normalizeCrossrefWork(work: any, forcedType: MediaType): NormalizedSourceResult | null {
  const title = work?.title?.[0];
  if (!title) return null;
  const doi = cleanText(work.DOI);
  const year = work.published?.['date-parts']?.[0]?.[0] || work.issued?.['date-parts']?.[0]?.[0] || '';
  const creators = unique((work.author || []).map((author: any) => [author.given, author.family].filter(Boolean).join(' ')));
  const sourceUrl = work.URL || (doi ? `https://doi.org/${doi}` : '');
  return {
    provider: 'crossref',
    externalId: doi || sourceUrl || title,
    type: forcedType,
    title: cleanText(title),
    creators,
    year: yearFromDate(year),
    description: cleanText(work.abstract || work.subtitle?.[0] || ''),
    thumbnailUrl: '',
    sourceUrl,
    publisher: cleanText(work.publisher || work['container-title']?.[0]),
    doi,
    tags: unique([work.type, ...(work.subject || [])]),
    externalIds: {
      crossrefId: doi || work.URL || '',
      doi,
      url: sourceUrl,
    },
  };
}

function normalizeInternetArchiveDoc(doc: any, forcedType: MediaType): NormalizedSourceResult | null {
  if (!doc?.title) return null;
  const identifier = cleanText(doc.identifier);
  const sourceUrl = identifier ? `https://archive.org/details/${identifier}` : '';
  return {
    provider: 'internet_archive',
    externalId: identifier || doc.title,
    type: forcedType,
    title: cleanText(doc.title),
    creators: unique(Array.isArray(doc.creator) ? doc.creator : [doc.creator]),
    year: yearFromDate(doc.year || doc.date),
    description: cleanText(doc.description),
    thumbnailUrl: identifier ? `https://archive.org/services/img/${identifier}` : '',
    sourceUrl,
    publisher: cleanText(doc.publisher || doc.collection?.[0] || 'Internet Archive'),
    platform: 'Internet Archive',
    tags: unique([doc.mediatype, ...(Array.isArray(doc.subject) ? doc.subject : [doc.subject])]),
    externalIds: {
      internetArchiveId: identifier,
      url: sourceUrl,
    },
  };
}

export async function searchBooks(query: string) {
  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&printType=books`;
  let results: NormalizedSourceResult[] = [];
  try {
    const google = await fetchJson(googleUrl);
    results = (google.items || []).map(normalizeGoogleBook).filter(Boolean);
  } catch {
    results = [];
  }

  if (results.length >= 3) return results.slice(0, 8);

  try {
    const openLibrary = await fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
    const fallback = (openLibrary.docs || []).map(normalizeOpenLibrary).filter(Boolean);
    return [...results, ...fallback].slice(0, 8);
  } catch {
    return results.slice(0, 8);
  }
}

export async function searchPapers(query: string) {
  const data = await fetchJson(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=8`);
  return (data.results || []).map(normalizeOpenAlexWork).filter(Boolean).slice(0, 8);
}

export async function searchMovies(query: string, type: MediaType) {
  const data = await fetchTmdbJson('/search/movie', {
    query,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  });
  return (data.results || []).map((movie: any) => normalizeTmdbMovie(movie, type)).filter(Boolean).slice(0, 8);
}

export async function searchItunes(query: string, type: MediaType) {
  const entity = type === 'audiobook' ? 'audiobook' : 'podcast';
  const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=${entity === 'audiobook' ? 'audiobook' : 'podcast'}&entity=${entity}&limit=8`);
  return (data.results || []).map((item: any) => normalizeItunesResult(item, type)).filter(Boolean).slice(0, 8);
}

export async function searchArticles(query: string, type: MediaType = 'article') {
  const data = await fetchJson(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=8&select=DOI,title,subtitle,author,publisher,published,issued,container-title,type,subject,abstract,URL`);
  return (data.message?.items || []).map((work: any) => normalizeCrossrefWork(work, type)).filter(Boolean).slice(0, 8);
}

export async function searchInternetArchive(query: string, type: MediaType) {
  const mediaType =
    type === 'podcast' || type === 'audiobook' || type === 'conversation'
      ? 'audio'
      : type === 'article' || type === 'paper' || type === 'course'
        ? 'texts'
        : 'movies';
  const fields = ['identifier', 'title', 'creator', 'year', 'date', 'description', 'publisher', 'collection', 'subject', 'mediatype'];
  const params = new URLSearchParams({
    q: `${query} AND mediatype:${mediaType}`,
    fl: fields.join(','),
    rows: '8',
    page: '1',
    output: 'json',
  });
  const data = await fetchJson(`https://archive.org/advancedsearch.php?${params.toString()}`);
  return (data.response?.docs || []).map((doc: any) => normalizeInternetArchiveDoc(doc, type)).filter(Boolean).slice(0, 8);
}

function metaContent(html: string, selector: RegExp) {
  return cleanText(html.match(selector)?.[1]);
}

function jsonLdValues(html: string) {
  const values: any[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) values.push(...parsed);
      else values.push(parsed);
    } catch {
      // Ignore invalid structured data from third-party pages.
    }
  }
  return values.flatMap((value) => value?.['@graph'] || value).filter(Boolean);
}

function firstJsonLdValue(items: any[], keys: string[]) {
  for (const item of items) {
    for (const key of keys) {
      const value = item?.[key];
      if (!value) continue;
      if (typeof value === 'string') return cleanText(value);
      if (Array.isArray(value)) {
        const first = value[0];
        if (typeof first === 'string') return cleanText(first);
        if (first?.name) return cleanText(first.name);
      }
      if (value.name) return cleanText(value.name);
    }
  }
  return '';
}

export async function metadataFromUrl(rawUrl: string, forcedType?: MediaType): Promise<NormalizedSourceResult> {
  const url = new URL(rawUrl);
  const response = await fetchPublicUrl(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1',
      'user-agent': USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`URL could not be read (${response.status}).`);

  const html = await readLimitedText(response);
  const jsonLd = jsonLdValues(html);
  const title = metaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || metaContent(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstJsonLdValue(jsonLd, ['headline', 'name'])
    || cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = metaContent(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || metaContent(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstJsonLdValue(jsonLd, ['description']);
  const image = absoluteUrl(
    metaContent(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      || metaContent(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i),
    url,
  );
  const siteName = metaContent(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || url.hostname.replace(/^www\./, '');
  const author = metaContent(html, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstJsonLdValue(jsonLd, ['author']);
  const published = metaContent(html, /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstJsonLdValue(jsonLd, ['datePublished', 'dateCreated']);
  const canonical = absoluteUrl(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1], url) || url.toString();

  return {
    provider: 'url_metadata',
    externalId: canonical,
    type: forcedType || 'article',
    title: title || canonical,
    creators: author ? [author] : [],
    year: yearFromDate(published),
    description,
    thumbnailUrl: image,
    sourceUrl: canonical,
    publisher: siteName,
    platform: siteName,
    tags: [],
    externalIds: { url: canonical },
  };
}

export async function searchSources(query: string, type: MediaType) {
  if (type === 'paper') return searchPapers(query);
  if (type === 'article') return searchArticles(query, type);
  if (type === 'podcast') return searchItunes(query, type);
  if (type === 'audiobook') {
    const [books, audio] = await Promise.allSettled([searchBooks(query), searchItunes(query, type)]);
    return [
      ...(audio.status === 'fulfilled' ? audio.value : []),
      ...(books.status === 'fulfilled' ? books.value.map((item) => ({ ...item, type })) : []),
    ].slice(0, 8);
  }
  if (type === 'movie' || type === 'documentary') {
    const [tmdb, archive] = await Promise.allSettled([searchMovies(query, type), searchInternetArchive(query, type)]);
    return [
      ...(tmdb.status === 'fulfilled' ? tmdb.value : []),
      ...(archive.status === 'fulfilled' ? archive.value : []),
    ].slice(0, 8);
  }
  if (type === 'book') return searchBooks(query);
  if (['video', 'course', 'lecture', 'interview', 'conversation', 'other'].includes(type)) return searchInternetArchive(query, type);
  return searchInternetArchive(query, type);
}
