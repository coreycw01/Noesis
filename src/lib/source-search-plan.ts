import type { MediaType } from './types';

export type SourceSearchProvider = 'books' | 'papers' | 'movies' | 'itunes' | 'articles' | 'archive';

export const SOURCE_SEARCH_PLAN: Record<MediaType, readonly SourceSearchProvider[]> = {
  book: ['books'],
  audiobook: ['itunes', 'books', 'archive'],
  podcast: ['itunes', 'archive'],
  video: ['archive'],
  movie: ['movies', 'archive'],
  article: ['articles', 'archive'],
  course: ['archive', 'articles'],
  lecture: ['archive', 'papers'],
  documentary: ['movies', 'archive'],
  interview: ['archive', 'itunes'],
  conversation: ['archive', 'itunes'],
  paper: ['papers', 'articles'],
  other: ['archive', 'articles'],
};

export function sourceSearchProviders(type: MediaType) {
  return SOURCE_SEARCH_PLAN[type];
}
