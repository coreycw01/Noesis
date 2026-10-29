import 'server-only';

import type { MediaType } from '@/lib/types';
import { buildCatalogSummary, type NormalizedSourceResult } from '@/lib/source-intake';
import { sourceSearchProviders, type SourceSearchProvider } from '@/lib/source-search-plan';
import { cleanMetadataText, inferMediaType, parsePageMetadata, youtubeVideoId } from '@/lib/source-url-metadata';
import { fetchVerifiedPublicResource } from './public-url';

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

function withCatalogSummary(result: NormalizedSourceResult): NormalizedSourceResult {
  return {
    ...result,
    catalogSummary: result.catalogSummary || buildCatalogSummary(result.description),
  };
}

function resultIdentity(result: NormalizedSourceResult) {
  const strongId = result.doi || result.isbn || result.externalIds?.doi || result.externalIds?.isbn;
  if (strongId) return `id:${strongId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  return [result.title, result.creators[0], result.year]
    .map((value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
    .join('|');
}

function mergeSearchResults(groups: NormalizedSourceResult[][], forcedType: MediaType) {
  const merged = new Map<string, NormalizedSourceResult>();
  groups.flat().forEach((raw) => {
    const result = withCatalogSummary({ ...raw, type: forcedType });
    const key = resultIdentity(result);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, result);
      return;
    }
    const description = (result.description || '').length > (existing.description || '').length
      ? result.description
      : existing.description;
    merged.set(key, withCatalogSummary({
      ...existing,
      description,
      creators: unique([...existing.creators, ...result.creators]),
      thumbnailUrl: existing.thumbnailUrl || result.thumbnailUrl,
      sourceUrl: existing.sourceUrl || result.sourceUrl,
      publisher: existing.publisher || result.publisher,
      platform: existing.platform || result.platform,
      isbn: existing.isbn || result.isbn,
      doi: existing.doi || result.doi,
      tags: unique([...(existing.tags || []), ...(result.tags || [])]),
      externalIds: { ...result.externalIds, ...existing.externalIds },
    }));
  });
  return Array.from(merged.values()).slice(0, 10);
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Provider request failed (${response.status}).`);
  return readProviderJson(response);
}

async function readProviderJson(response: Response, maxBytes = 2_000_000) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new Error('Provider response was too large.');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error('Provider response was too large.');
  }
  return JSON.parse(text);
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
  return readProviderJson(response);
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

function youtubeApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YouTube search requires YOUTUBE_API_KEY in the server environment.');
  return key;
}

function normalizeYouTubeVideo(item: any, forcedType: MediaType): NormalizedSourceResult | null {
  const snippet = item?.snippet;
  const youtubeId = cleanText(typeof item?.id === 'string' ? item.id : item?.id?.videoId);
  if (!snippet?.title || !youtubeId) return null;
  const sourceUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
  return {
    provider: 'youtube',
    externalId: youtubeId,
    type: forcedType,
    title: cleanText(snippet.title),
    creators: unique([snippet.channelTitle]),
    year: yearFromDate(snippet.publishedAt || snippet.publishTime),
    description: cleanText(snippet.description),
    thumbnailUrl: snippet.thumbnails?.maxres?.url
      || snippet.thumbnails?.high?.url
      || snippet.thumbnails?.medium?.url
      || snippet.thumbnails?.default?.url
      || '',
    sourceUrl,
    publisher: cleanText(snippet.channelTitle || 'YouTube'),
    platform: 'YouTube',
    tags: unique(snippet.tags || []),
    externalIds: { youtubeId, url: sourceUrl },
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

export async function searchYouTube(query: string, type: MediaType) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '8',
    q: query,
    safeSearch: 'moderate',
    key: youtubeApiKey(),
  });
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  return (data.items || []).map((item: any) => normalizeYouTubeVideo(item, type)).filter(Boolean).slice(0, 8);
}

interface OEmbedResponse {
  type?: string;
  title?: string;
  author_name?: string;
  provider_name?: string;
  thumbnail_url?: string;
  description?: string;
}

async function fetchOEmbed(url: URL): Promise<OEmbedResponse | null> {
  try {
    const response = await fetchVerifiedPublicResource(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      maxBytes: 256_000,
      allowedContentTypes: ['application/json', 'text/json'],
    });
    if (!response.ok) return null;
    return JSON.parse(response.text) as OEmbedResponse;
  } catch {
    return null;
  }
}

async function fetchYouTubeVideo(videoId: string) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !videoId) return null;
  try {
    const params = new URLSearchParams({ part: 'snippet', id: videoId, key });
    const data = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
    return data.items?.[0] || null;
  } catch {
    return null;
  }
}

export async function metadataFromUrl(rawUrl: string, forcedType?: MediaType): Promise<NormalizedSourceResult> {
  const url = new URL(rawUrl);
  const videoId = youtubeVideoId(url);
  let page = parsePageMetadata('', url);
  let pageWasRead = false;
  try {
    const response = await fetchVerifiedPublicResource(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1',
        'user-agent': USER_AGENT,
      },
      maxBytes: 2_000_000,
      allowedContentTypes: ['text/html', 'application/xhtml+xml', 'text/plain'],
    });
    if (response.ok) {
      page = parsePageMetadata(response.text, response.url);
      pageWasRead = true;
    }
  } catch {
    // Known media providers can still resolve through their structured endpoint.
  }

  const oEmbedUrl = videoId
    ? new URL(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`)
    : page.oEmbedUrl ? new URL(page.oEmbedUrl) : null;
  const [oEmbed, youtube] = await Promise.all([
    oEmbedUrl ? fetchOEmbed(oEmbedUrl) : Promise.resolve(null),
    videoId ? fetchYouTubeVideo(videoId) : Promise.resolve(null),
  ]);
  if (!pageWasRead && !oEmbed && !youtube) throw new Error('URL could not be read by the page or its metadata provider.');

  const youtubeSnippet = youtube?.snippet;
  const detectedType = inferMediaType(url, page)
    || (oEmbed?.type === 'video' ? 'video' : undefined);
  const type = detectedType || forcedType || 'article';
  const title = cleanMetadataText(youtubeSnippet?.title || page.title || oEmbed?.title) || url.toString();
  const author = cleanMetadataText(youtubeSnippet?.channelTitle || page.author || oEmbed?.author_name);
  const platform = cleanMetadataText(page.siteName || oEmbed?.provider_name)
    || (videoId ? 'YouTube' : url.hostname.replace(/^www\./, ''));
  const description = cleanMetadataText(youtubeSnippet?.description || page.description || oEmbed?.description)
    || `${type.charAt(0).toUpperCase()}${type.slice(1)}${author ? ` by ${author}` : ''} on ${platform}.`;
  const canonical = page.canonicalUrl || url.toString();
  const thumbnail = youtubeSnippet?.thumbnails?.maxres?.url
    || youtubeSnippet?.thumbnails?.high?.url
    || page.imageUrl
    || oEmbed?.thumbnail_url
    || '';
  const tags = unique([...(page.tags || []), ...(youtubeSnippet?.tags || [])]);

  return withCatalogSummary({
    provider: videoId ? 'youtube' : 'url_metadata',
    externalId: videoId || canonical,
    type,
    title,
    creators: author ? [author] : [],
    year: yearFromDate(youtubeSnippet?.publishedAt || page.publishedAt),
    description,
    thumbnailUrl: thumbnail,
    sourceUrl: canonical,
    publisher: author || platform,
    platform,
    tags,
    externalIds: { url: canonical, ...(videoId ? { youtubeId: videoId } : {}) },
  });
}

async function searchWithProvider(provider: SourceSearchProvider, query: string, type: MediaType): Promise<NormalizedSourceResult[]> {
  if (provider === 'books') return (await searchBooks(query)).map((result: NormalizedSourceResult) => ({ ...result, type }));
  if (provider === 'papers') return (await searchPapers(query)).map((result: NormalizedSourceResult) => ({ ...result, type }));
  if (provider === 'movies') return searchMovies(query, type);
  if (provider === 'itunes') return searchItunes(query, type);
  if (provider === 'articles') return searchArticles(query, type);
  if (provider === 'youtube') return searchYouTube(query, type);
  return searchInternetArchive(query, type);
}

export async function searchSources(query: string, type: MediaType) {
  const providers = sourceSearchProviders(type);
  const settled = await Promise.allSettled(providers.map((provider) => searchWithProvider(provider, query, type)));
  const groups = settled
    .filter((result): result is PromiseFulfilledResult<NormalizedSourceResult[]> => result.status === 'fulfilled')
    .map((result) => result.value);
  return mergeSearchResults(groups, type);
}
