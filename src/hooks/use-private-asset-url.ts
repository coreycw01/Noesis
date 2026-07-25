'use client';

import { useEffect, useState } from 'react';
import { privateAssetObjectUrl } from '@/lib/storage-assets';

export function usePrivateAssetUrl(storagePath?: string, fallback = '') {
  const [url, setUrl] = useState(fallback);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setError(null);
    if (!storagePath) {
      setUrl(fallback);
      return;
    }
    void privateAssetObjectUrl(storagePath)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
      })
      .catch((reason) => {
        if (active) {
          setUrl(fallback);
          setError(reason instanceof Error ? reason : new Error('Unable to load private asset.'));
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fallback, storagePath]);

  return { url, error };
}
