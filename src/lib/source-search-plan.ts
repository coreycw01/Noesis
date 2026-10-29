import type { MediaType } from './types';

export type SourceSearchProvider = 'books' | 'papers' | 'movies' | 'itunes' | 'articles' | 'archive' | 'youtube';

export const SOURCE_SEARCH_PLAN: Record<MediaType, readonly SourceSearchProvider[]> = {
  book: ['books'],
  audiobook: ['itunes', 'books', 'archive'],
  podcast: ['itunes', 'archive'],
  video: ['youtube', 'archive'],
  movie: ['movies', 'archive'],
  article: ['articles', 'archive'],
  course: ['youtube', 'archive', 'articles'],
  lecture: ['youtube', 'archive', 'papers'],
  documentary: ['movies', 'youtube', 'archive'],
  interview: ['youtube', 'archive', 'itunes'],
  conversation: ['youtube', 'archive', 'itunes'],
  paper: ['papers', 'articles'],
  other: ['archive', 'articles'],
};

export function sourceSearchProviders(type: MediaType) {
  return SOURCE_SEARCH_PLAN[type];
}
