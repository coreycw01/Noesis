'use client';

import { useEffect, useState } from 'react';
import { privateAssetObjectUrl } from '@/lib/storage-assets';
import { demoRecordingUrl, isDemoAsset } from '@/lib/demo-assets';

export function usePrivateAssetUrl(storagePath?: string, fallback = '') {
  const [url, setUrl] = useState(fallback);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setError(null);
    const local = isDemoAsset(fallback);
    setUrl(local ? '' : fallback);
    if (!storagePath && !local) {
      setUrl(fallback);
      return;
    }
    void (local ? demoRecordingUrl(fallback) : privateAssetObjectUrl(storagePath!))
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
        else URL.revokeObjectURL(nextUrl);
      })
      .catch((reason) => {
        if (active) {
          setUrl(local ? '' : fallback);
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
