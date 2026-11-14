export function noesisApiUrl(input: string, origin: string) {
  const url = new URL(input, origin);
  if (url.origin !== origin || !url.pathname.startsWith('/api/') || url.username || url.password) {
    throw new Error('Noesis can only attach credentials to its own API.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
