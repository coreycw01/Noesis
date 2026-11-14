export const publicProfileCacheRule = {
  source: '/p/:slug',
  headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' }],
};
