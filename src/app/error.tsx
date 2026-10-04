"use client";

import { useEffect } from 'react';
import { PageErrorState } from '@/components/shared/PageState';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkFailure = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(error.message);

  useEffect(() => {
    console.error('[NoesisRouteError]', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="min-h-screen bg-background p-6">
      <PageErrorState
        title={chunkFailure ? 'Noesis was updated' : 'Noesis could not open this page'}
        description={chunkFailure ? 'Your browser has an older app file cached. Reload to open the current version.' : 'The page hit a runtime problem while loading its workspace data or interface.'}
        savedState="Your persisted Firestore data was not cleared by this page error."
        nextStep={chunkFailure ? 'Reloading is safe and does not delete saved work.' : 'Retry the page. If it fails again, refresh the browser or return to Atlas.'}
        retryLabel={chunkFailure ? 'Reload Updated App' : 'Retry Page'}
        onRetry={chunkFailure ? () => window.location.reload() : reset}
        className="min-h-[calc(100vh-3rem)]"
      />
    </main>
  );
}
