import type { MediaType, SourceProvider } from './types';

export interface NormalizedSourceResult {
  provider: SourceProvider;
  externalId: string;
  type: MediaType;
  title: string;
  creators: string[];
  year?: string;
  description?: string;
  catalogSummary?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  publisher?: string;
  platform?: string;
  isbn?: string;
  doi?: string;
  tags?: string[];
  externalIds?: {
    googleBooksId?: string;
    openLibraryId?: string;
    openAlexId?: string;
    tmdbId?: string;
    itunesId?: string;
    crossrefId?: string;
    internetArchiveId?: string;
    isbn?: string;
    doi?: string;
    url?: string;
  };
}

export function buildCatalogSummary(value?: string, maxLength = 360) {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;

  const sentences = text.match(/[^.!?]+[.!?]+(?:["'”’)]*)|[^.!?]+$/g) || [text];
  let summary = '';
  for (const sentence of sentences.slice(0, 3)) {
    const candidate = `${summary} ${sentence.trim()}`.trim();
    if (candidate.length > maxLength) break;
    summary = candidate;
  }
  if (summary.length >= Math.min(120, maxLength) && summary.length < text.length) return summary;

  const clipped = text.slice(0, Math.max(1, maxLength - 1));
  const boundary = clipped.lastIndexOf(' ');
  return `${(boundary > maxLength * 0.6 ? clipped.slice(0, boundary) : clipped).trim()}…`;
}

export function sourceResultToMediaPatch(result: NormalizedSourceResult) {
  const description = result.description || '';
  return {
    title: result.title,
    creator: result.creators.join(', '),
    creators: result.creators,
    type: result.type,
    year: result.year || '',
    genre: (result.tags || []).slice(0, 2).join(', '),
    description,
    catalogSummary: result.catalogSummary || buildCatalogSummary(description),
    url: result.sourceUrl || result.externalIds?.url || '',
    thumbnailUrl: result.thumbnailUrl || '',
    publisher: result.publisher || '',
    platform: result.platform || '',
    isbn: result.isbn || result.externalIds?.isbn || '',
    doi: result.doi || result.externalIds?.doi || '',
    tags: result.tags || [],
    sourceProvider: result.provider,
    externalIds: result.externalIds || {},
  };
}
